import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GENERIC_AUTH_ERROR,
  mapAuthEmailError,
  RATE_LIMITED_COOLDOWN_SECONDS,
  RATE_LIMITED_ERROR,
} from "./auth-errors.ts";

test("the rate-limit cooldown is the five minutes the plan committed to", () => {
  assert.equal(RATE_LIMITED_COOLDOWN_SECONDS, 300);
});

test("both Supabase rate-limit codes map to the rate-limited copy and cooldown", () => {
  for (const code of [
    "over_email_send_rate_limit",
    "over_request_rate_limit",
  ]) {
    assert.deepEqual(mapAuthEmailError({ code }), {
      error: RATE_LIMITED_ERROR,
      retryAfterSeconds: RATE_LIMITED_COOLDOWN_SECONDS,
    });
  }
});

test("every other code falls through to the generic copy with no cooldown hint", () => {
  for (const code of [
    "user_already_exists",
    "same_password",
    "email_address_invalid",
    "over_sms_send_rate_limit",
    "unexpected_failure",
    "",
    null,
    undefined,
  ]) {
    assert.deepEqual(mapAuthEmailError({ code }), {
      error: GENERIC_AUTH_ERROR,
    });
  }
});

test("an error with no code at all (a fetch failure) is generic", () => {
  assert.deepEqual(mapAuthEmailError({}), { error: GENERIC_AUTH_ERROR });
});
