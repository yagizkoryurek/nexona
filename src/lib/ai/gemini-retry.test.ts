import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { ApiError } from "@google/genai";

import { z } from "zod";

import {
  BASE_RETRY_DELAY_MS,
  isRetryableGeminiError,
  MAX_ATTEMPTS,
  PRIMARY_ATTEMPTS_BEFORE_FALLBACK,
  retryOnTransientGeminiError,
  withModelFallback,
} from "./gemini-retry.ts";

/**
 * Covers the retry layer around the Gemini call — the one piece of AI runtime
 * behaviour in this repo that can be tested without a live model call, because
 * `retryOnTransientGeminiError` takes the call as a function.
 *
 * Runs on Node's built-in runner (`node:test` + `--experimental-strip-types`),
 * like the other three test files, and uses its mock timers so the backoff
 * schedule is asserted exactly (500ms, then 1000ms) rather than slept through.
 * `setImmediate` is deliberately left unmocked: `flush()` uses it to let every
 * pending promise reaction settle between ticks.
 */

function apiError(status: number): ApiError {
  return new ApiError({
    status,
    message: JSON.stringify({ error: { code: status, status: "TEST" } }),
  });
}

/** Lets pending microtasks settle. Not mocked, so it always advances. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * A stub call that fails with each error in `failures` in turn, then resolves
 * with `result`. Records how many times it was invoked.
 */
function scheduledCall<T>(failures: unknown[], result: T) {
  let calls = 0;
  const fn = async (): Promise<T> => {
    calls++;
    const failure = failures[calls - 1];
    if (failure !== undefined) throw failure;
    return result;
  };
  return { fn, calls: () => calls };
}

/**
 * Captures the promise's outcome the moment it settles, so a rejection that
 * lands mid-test is never an unhandled rejection while the test is still
 * stepping timers.
 */
function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

function withMockTimers(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const warn = t.mock.method(console, "warn", () => undefined);
  return { warn };
}

test("the bounds are the ones the plan committed to", () => {
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(BASE_RETRY_DELAY_MS, 500);
});

test("isRetryableGeminiError: only an ApiError with 429 or 503", () => {
  assert.equal(isRetryableGeminiError(apiError(503)), true);
  assert.equal(isRetryableGeminiError(apiError(429)), true);

  assert.equal(isRetryableGeminiError(apiError(400)), false);
  assert.equal(isRetryableGeminiError(apiError(401)), false);
  assert.equal(isRetryableGeminiError(apiError(500)), false);
  assert.equal(isRetryableGeminiError(new Error("fetch failed")), false);
  assert.equal(isRetryableGeminiError(new TypeError("fetch failed")), false);
  assert.equal(isRetryableGeminiError({ status: 503 }), false);
  assert.equal(isRetryableGeminiError(null), false);
  assert.equal(isRetryableGeminiError(undefined), false);
});

test("a call that succeeds first time is made once, with no delay", async (t) => {
  const { warn } = withMockTimers(t);
  const call = scheduledCall([], "ok");

  const outcome = await settle(retryOnTransientGeminiError(call.fn));

  assert.deepEqual(outcome, { ok: true, value: "ok" });
  assert.equal(call.calls(), 1);
  assert.equal(warn.mock.callCount(), 0);
});

test("two 503s then success: retried on the exact 500ms / 1000ms schedule", async (t) => {
  const { warn } = withMockTimers(t);
  const call = scheduledCall([apiError(503), apiError(503)], "ok");

  const outcome = settle(retryOnTransientGeminiError(call.fn));
  await flush();

  // First attempt has failed; the 500ms backoff is pending.
  assert.equal(call.calls(), 1);
  t.mock.timers.tick(499);
  await flush();
  assert.equal(call.calls(), 1, "must not retry before 500ms");

  t.mock.timers.tick(1);
  await flush();
  assert.equal(call.calls(), 2, "second attempt at exactly 500ms");

  // Second attempt has failed; the 1000ms backoff is pending.
  t.mock.timers.tick(999);
  await flush();
  assert.equal(call.calls(), 2, "must not retry before 1000ms");

  t.mock.timers.tick(1);
  await flush();
  assert.equal(call.calls(), 3, "third attempt at exactly 1000ms");

  assert.deepEqual(await outcome, { ok: true, value: "ok" });

  assert.equal(warn.mock.callCount(), 2);
  const messages = warn.mock.calls.map((c) => String(c.arguments[0]));
  assert.match(messages[0], /status 503 \(attempt 1\/3\); retrying in 500ms/);
  assert.match(messages[1], /status 503 \(attempt 2\/3\); retrying in 1000ms/);
});

test("a 429 is retried too", async (t) => {
  const { warn } = withMockTimers(t);
  const call = scheduledCall([apiError(429)], "ok");

  const outcome = settle(retryOnTransientGeminiError(call.fn));
  await flush();
  t.mock.timers.tick(BASE_RETRY_DELAY_MS);
  await flush();

  assert.deepEqual(await outcome, { ok: true, value: "ok" });
  assert.equal(call.calls(), 2);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /status 429/);
});

test("503 on every attempt: gives up after MAX_ATTEMPTS and re-throws the last error unwrapped", async (t) => {
  const { warn } = withMockTimers(t);
  const errors = [apiError(503), apiError(503), apiError(503)];
  const call = scheduledCall(errors, "never");

  const outcome = settle(retryOnTransientGeminiError(call.fn));
  await flush();
  t.mock.timers.tick(500);
  await flush();
  t.mock.timers.tick(1000);
  await flush();

  const result = await outcome;
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.error, errors[2], "same instance");
  assert.ok(result.ok === false && result.error instanceof ApiError);
  assert.equal(call.calls(), MAX_ATTEMPTS);
  // Two backoffs logged; the final failure is the caller's to log.
  assert.equal(warn.mock.callCount(), MAX_ATTEMPTS - 1);
});

test("a non-retryable error is thrown immediately after one attempt", async (t) => {
  for (const error of [
    new Error("The model did not return anything."),
    new TypeError("fetch failed"),
    apiError(400),
    apiError(500),
  ]) {
    const { warn } = withMockTimers(t);
    const call = scheduledCall([error], "never");

    const outcome = await settle(retryOnTransientGeminiError(call.fn));

    assert.equal(outcome.ok, false);
    assert.equal(outcome.ok === false && outcome.error, error, "same instance");
    assert.equal(call.calls(), 1);
    assert.equal(warn.mock.callCount(), 0);
    t.mock.reset();
    t.mock.timers.reset();
  }
});

test("the retry log never carries the request", async (t) => {
  const { warn } = withMockTimers(t);
  const secret = "RESUME TEXT THAT MUST NOT BE LOGGED";
  // The stub closes over the "request" the way the real call closes over
  // `contents`; the log line must not be able to reach it.
  const call = scheduledCall([apiError(503)], secret);

  const outcome = settle(retryOnTransientGeminiError(call.fn));
  await flush();
  t.mock.timers.tick(500);
  await flush();
  await outcome;

  for (const c of warn.mock.calls) {
    for (const arg of c.arguments) {
      assert.equal(String(arg).includes(secret), false);
    }
  }
});

// --- Model fallback ---------------------------------------------------------

const PRIMARY = "primary-model";
const FALLBACK = "fallback-model";

/**
 * Like `scheduledCall`, but takes the model each call was made with and records
 * it — so a test can assert not just how many calls ran, but on which model.
 */
function scheduledModelCall<T>(failures: unknown[], result: T) {
  const models: string[] = [];
  const fn = async (model: string): Promise<T> => {
    models.push(model);
    const failure = failures[models.length - 1];
    if (failure !== undefined) throw failure;
    return result;
  };
  return { fn, models: () => [...models] };
}

/** A real ZodError, as `schema.parse` would throw it. */
function zodError(): z.ZodError {
  const parsed = z.object({ ok: z.literal(true) }).safeParse({});
  if (parsed.success) throw new Error("unreachable");
  return parsed.error;
}

test("fallback bounds: two primary attempts leave room for one fallback call", () => {
  assert.equal(PRIMARY_ATTEMPTS_BEFORE_FALLBACK, 2);
  assert.ok(PRIMARY_ATTEMPTS_BEFORE_FALLBACK < MAX_ATTEMPTS);
});

test("maxAttempts is honoured when given", async (t) => {
  withMockTimers(t);
  const errors = [apiError(503), apiError(503)];
  const call = scheduledCall(errors, "never");

  const outcome = settle(
    retryOnTransientGeminiError(call.fn, { maxAttempts: 2 }),
  );
  await flush();
  t.mock.timers.tick(500);
  await flush();

  const result = await outcome;
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.error, errors[1]);
  assert.equal(call.calls(), 2);
});

test("no fallback configured: identical to the plain retry, never another model", async (t) => {
  withMockTimers(t);
  const errors = [apiError(503), apiError(503), apiError(503)];
  const call = scheduledModelCall(errors, "never");

  const outcome = settle(withModelFallback(call.fn, { primary: PRIMARY }));
  await flush();
  t.mock.timers.tick(500);
  await flush();
  t.mock.timers.tick(1000);
  await flush();

  const result = await outcome;
  assert.equal(result.ok === false && result.error, errors[2]);
  assert.deepEqual(call.models(), [PRIMARY, PRIMARY, PRIMARY]);
});

test("fallback configured, primary succeeds first time: one call, primary only", async (t) => {
  const { warn } = withMockTimers(t);
  const call = scheduledModelCall([], "ok");

  const result = await withModelFallback(call.fn, {
    primary: PRIMARY,
    fallback: FALLBACK,
  });

  assert.equal(result, "ok");
  assert.deepEqual(call.models(), [PRIMARY]);
  assert.equal(warn.mock.callCount(), 0);
});

test("primary 503 then success: retried on the primary, fallback never used", async (t) => {
  withMockTimers(t);
  const call = scheduledModelCall([apiError(503)], "ok");

  const outcome = settle(
    withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
  );
  await flush();
  t.mock.timers.tick(BASE_RETRY_DELAY_MS);
  await flush();

  const result = await outcome;
  assert.deepEqual(result, { ok: true, value: "ok" });
  assert.deepEqual(call.models(), [PRIMARY, PRIMARY]);
});

test("primary exhausted on 503/429: the fallback is called once, and its answer returned", async (t) => {
  for (const errors of [
    [apiError(503), apiError(503)],
    [apiError(429), apiError(503)],
    [apiError(503), apiError(429)],
  ]) {
    const { warn } = withMockTimers(t);
    const call = scheduledModelCall(errors, "fallback answer");

    const outcome = settle(
      withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
    );
    await flush();
    t.mock.timers.tick(BASE_RETRY_DELAY_MS);
    await flush();

    const result = await outcome;
    assert.deepEqual(result, { ok: true, value: "fallback answer" });
    assert.deepEqual(call.models(), [PRIMARY, PRIMARY, FALLBACK]);
    // One backoff on the primary, one fallback notice.
    assert.equal(warn.mock.callCount(), 2);
    assert.match(String(warn.mock.calls[1].arguments[0]), /trying .* once/);
    t.mock.reset();
    t.mock.timers.reset();
  }
});

test("a 400 never falls back: thrown after one primary attempt", async (t) => {
  const { warn } = withMockTimers(t);
  const error = apiError(400);
  const call = scheduledModelCall([error], "never");

  const outcome = await settle(
    withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
  );

  assert.equal(outcome.ok === false && outcome.error, error, "same instance");
  assert.deepEqual(call.models(), [PRIMARY]);
  assert.equal(warn.mock.callCount(), 0);
});

test("schema, parse, empty-response and network failures never fall back", async (t) => {
  for (const error of [
    zodError(),
    new SyntaxError("Unexpected end of JSON input"),
    new Error("The model did not return an ATS audit."),
    new TypeError("fetch failed"),
    apiError(500),
  ]) {
    const { warn } = withMockTimers(t);
    const call = scheduledModelCall([error], "never");

    const outcome = await settle(
      withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
    );

    assert.equal(outcome.ok === false && outcome.error, error, "same instance");
    assert.deepEqual(call.models(), [PRIMARY]);
    assert.equal(warn.mock.callCount(), 0);
    t.mock.reset();
    t.mock.timers.reset();
  }
});

test("fallback failure: the fallback's own error is thrown, unwrapped, with no further calls", async (t) => {
  for (const fallbackError of [apiError(503), apiError(400), zodError()]) {
    withMockTimers(t);
    const errors = [apiError(503), apiError(503), fallbackError];
    const call = scheduledModelCall(errors, "never");

    const outcome = settle(
      withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
    );
    await flush();
    t.mock.timers.tick(BASE_RETRY_DELAY_MS);
    await flush();

    const result = await outcome;
    assert.equal(result.ok === false && result.error, fallbackError);
    assert.deepEqual(call.models(), [PRIMARY, PRIMARY, FALLBACK]);
    t.mock.reset();
    t.mock.timers.reset();
  }
});

test("a model that always 503s is called a bounded number of times — no loop", async (t) => {
  withMockTimers(t);
  const models: string[] = [];
  const alwaysOverloaded = async (model: string): Promise<never> => {
    models.push(model);
    throw apiError(503);
  };

  const outcome = settle(
    withModelFallback(alwaysOverloaded, {
      primary: PRIMARY,
      fallback: FALLBACK,
    }),
  );
  // Far more ticks than any legitimate schedule needs.
  for (let i = 0; i < 20; i++) {
    await flush();
    t.mock.timers.tick(10_000);
  }
  await flush();

  const result = await outcome;
  assert.equal(result.ok, false);
  assert.equal(models.length, PRIMARY_ATTEMPTS_BEFORE_FALLBACK + 1);
  assert.equal(models.filter((m) => m === FALLBACK).length, 1);
});

test("the fallback log never carries the request", async (t) => {
  const { warn } = withMockTimers(t);
  const secret = "RESUME TEXT THAT MUST NOT BE LOGGED";
  const call = scheduledModelCall([apiError(503), apiError(503)], secret);

  const outcome = settle(
    withModelFallback(call.fn, { primary: PRIMARY, fallback: FALLBACK }),
  );
  await flush();
  t.mock.timers.tick(BASE_RETRY_DELAY_MS);
  await flush();
  await outcome;

  for (const c of warn.mock.calls) {
    for (const arg of c.arguments) {
      assert.equal(String(arg).includes(secret), false);
    }
  }
});
