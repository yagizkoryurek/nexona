import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  finalize,
  MAX_EXTRACTED_CHARACTERS,
  MIN_EXTRACTED_CHARACTERS,
} from "./resume-text-extraction.ts";

/**
 * Covers the resume-text length bounds (security finding A1).
 *
 * Runs on Node's built-in test runner (`node:test` + `--experimental-strip-types`)
 * rather than Vitest or Jest, deliberately: this repository has no test
 * framework, and adding one is an architectural decision that belongs to its own
 * discussion. The runtime's own runner needs no dependency at all.
 *
 * `finalize` is tested directly instead of `extractResumeText` because the bound
 * is pure string logic — asserting it through a real PDF or DOCX would test
 * `unpdf`/`mammoth` rather than the limit, and would need binary fixtures this
 * repo has no place for.
 */

/** Realistic-looking filler so the input is text, not a repeated character. */
function textOfLength(length: number): string {
  const sentence = "Led a team of five engineers to ship a payments service. ";
  const filled = sentence
    .repeat(Math.ceil(length / sentence.length))
    .slice(0, length);

  // The filler ends in a space, so a slice can land on whitespace — which
  // `finalize` then trims, leaving a string one character shorter than asked
  // for and silently turning the exact-boundary assertions into off-by-one
  // ones. Guarantee the last character survives trimming.
  return /\s$/.test(filled) ? `${filled.slice(0, -1)}.` : filled;
}

test("text below the limit is accepted and returned unchanged", () => {
  const input = textOfLength(10_000);
  const result = finalize(input);

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.text, input);
  assert.equal(result.text.length, 10_000);
});

test("a typical resume length is unaffected", () => {
  // Matches the longest resume_text currently stored in production (~2,600).
  const result = finalize(textOfLength(2_600));

  assert.ok(result.ok);
  assert.equal(result.text.length, 2_600);
});

test("text exactly at the limit is accepted", () => {
  const input = textOfLength(MAX_EXTRACTED_CHARACTERS);
  const result = finalize(input);

  assert.ok(result.ok, "the boundary value must not be rejected");
  assert.equal(result.text.length, MAX_EXTRACTED_CHARACTERS);
});

test("text one character over the limit is rejected", () => {
  const result = finalize(textOfLength(MAX_EXTRACTED_CHARACTERS + 1));

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.error, /too much text/i);
  // The message must state the real limit so the user can act on it.
  assert.ok(
    result.error.includes("50,000"),
    `error should name the limit, got: ${result.error}`,
  );
});

test("text far over the limit is rejected, not truncated", () => {
  const result = finalize(textOfLength(2_000_000));

  assert.ok(!result.ok);
  // The whole point of rejecting: no truncated text is handed back for
  // analysis, so a document is never silently altered before scoring.
  assert.ok(
    !("text" in result),
    "an oversized extraction must not return any text",
  );
});

test("trimming is applied before the bound is measured", () => {
  // Whitespace padding must not push an otherwise-valid resume over the edge.
  const padded = `\n\n   ${textOfLength(MAX_EXTRACTED_CHARACTERS)}   \n\n`;
  const result = finalize(padded);

  assert.ok(result.ok, "surrounding whitespace should not cause rejection");
  assert.equal(result.text.length, MAX_EXTRACTED_CHARACTERS);
});

test("the existing lower bound still rejects scan artefacts", () => {
  // Guards against this change disturbing the pre-existing MIN behaviour.
  const result = finalize(textOfLength(MIN_EXTRACTED_CHARACTERS - 1));

  assert.ok(!result.ok);
  assert.match(result.error, /couldn't find enough text/i);
});

test("the database CHECK constraint matches the application limit", () => {
  const migration = readFileSync(
    join(
      import.meta.dirname,
      "../../supabase/migrations/0008_resume_text_length_limit.sql",
    ),
    "utf8",
  );

  // Pull the number straight out of the CHECK expression rather than merely
  // asserting the file mentions it somewhere, so a stale comment cannot make
  // this pass while the real constraint drifts.
  const match = migration.match(
    /check\s*\(\s*char_length\s*\(\s*resume_text\s*\)\s*<=\s*(\d+)\s*\)/i,
  );

  assert.ok(match, "migration 0008 must contain the resume_text CHECK");
  assert.equal(
    Number(match[1]),
    MAX_EXTRACTED_CHARACTERS,
    "the CHECK constraint and MAX_EXTRACTED_CHARACTERS must stay equal",
  );
});
