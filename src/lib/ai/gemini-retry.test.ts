import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { ApiError } from "@google/genai";

import {
  BASE_RETRY_DELAY_MS,
  isRetryableGeminiError,
  MAX_ATTEMPTS,
  retryOnTransientGeminiError,
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
