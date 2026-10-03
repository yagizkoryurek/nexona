import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cooldownKey,
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  remainingCooldownSeconds,
} from "./use-resend-cooldown.ts";

/**
 * Covers the pure half of the cooldown hook. The localStorage and interval
 * wiring around it needs a DOM, which this repo's Node-only runner does not
 * provide, so that half is verified by click-through.
 */

const NOW = 1_700_000_000_000;

test("the default cooldown is the sixty seconds the plan committed to", () => {
  assert.equal(DEFAULT_RESEND_COOLDOWN_SECONDS, 60);
});

test("a deadline in the past or present leaves nothing remaining", () => {
  assert.equal(remainingCooldownSeconds(NOW - 5_000, NOW), 0);
  assert.equal(remainingCooldownSeconds(NOW, NOW), 0);
  assert.equal(remainingCooldownSeconds(0, NOW), 0);
});

test("whole seconds are exact and partial seconds round up", () => {
  assert.equal(remainingCooldownSeconds(NOW + 60_000, NOW), 60);
  assert.equal(remainingCooldownSeconds(NOW + 59_001, NOW), 60);
  assert.equal(remainingCooldownSeconds(NOW + 1, NOW), 1);
  assert.equal(remainingCooldownSeconds(NOW + 999, NOW), 1);
  assert.equal(remainingCooldownSeconds(NOW + 1_000, NOW), 1);
  assert.equal(remainingCooldownSeconds(NOW + 1_001, NOW), 2);
});

test("a corrupt stored deadline never produces a negative or NaN countdown", () => {
  assert.equal(remainingCooldownSeconds(Number.NaN, NOW), 0);
  assert.equal(remainingCooldownSeconds(Number.POSITIVE_INFINITY, NOW), 0);
  assert.equal(remainingCooldownSeconds(NOW + 10_000, Number.NaN), 0);
});

test("keys separate flows and ignore case and surrounding whitespace", () => {
  assert.equal(
    cooldownKey("signup", "  Ada@Example.com "),
    "signup:ada@example.com",
  );
  assert.notEqual(
    cooldownKey("signup", "ada@example.com"),
    cooldownKey("recovery", "ada@example.com"),
  );
});
