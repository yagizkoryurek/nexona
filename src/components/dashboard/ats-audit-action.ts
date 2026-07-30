"use server";

import { z } from "zod";

import {
  AUDIT_SCHEMA_VERSION,
  atsAuditSchema,
  requestAtsAudit,
  type AtsAudit,
} from "@/lib/ai/ats-audit";
import { createClient } from "@/lib/supabase/server";

const analysisIdSchema = z.string().uuid();

export type AtsAuditResult = {
  audit: AtsAudit;
  /**
   * The ATS score already stored on the analysis — read, never recomputed.
   * Carried here so the results view is self-contained.
   */
  atsScore: number;
  fileName: string;
  /** Whether this came from the database or from a fresh model call. */
  source: "stored" | "fresh";
  /** False when a fresh audit was generated but could not be saved. */
  persisted: boolean;
};

/**
 * Returns an ATS audit for one of the caller's own analyses.
 *
 * Reads a stored audit when one exists, so re-opening a resume costs nothing
 * and the persisted rows are actually read back rather than write-only. Pass
 * `refresh` to force a new audit; each one appends a row rather than replacing
 * the last (see migration 0003 for why the table is append-only).
 */
export async function auditResume(
  analysisId: string,
  refresh = false,
): Promise<{ data: AtsAuditResult } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  // Re-validate server-side — the client's selection is a UX convenience, not
  // a trust boundary; this action is directly callable.
  const idResult = analysisIdSchema.safeParse(analysisId);
  if (!idResult.success) {
    return { error: "That analysis couldn't be found." };
  }

  // No explicit user_id filter needed: RLS already scopes this select to the
  // caller's own rows, so a foreign or nonexistent id resolves to zero rows
  // either way — the same generic error avoids leaking which case it was.
  const { data: row, error: fetchError } = await supabase
    .from("resume_analyses")
    .select("file_name, resume_text, ats_score")
    .eq("id", idResult.data)
    .single();

  if (fetchError) {
    // Logged, not surfaced: the user-facing message stays generic, but a real
    // query failure — schema drift, connectivity — must not be silently
    // indistinguishable from "no such row".
    console.error("Failed to fetch analysis for ATS audit:", fetchError);
    return { error: "That analysis couldn't be found." };
  }

  if (!row || !row.resume_text) {
    return { error: "That analysis couldn't be found." };
  }

  if (!refresh) {
    const { data: storedRows, error: storedError } = await supabase
      .from("ats_audits")
      .select("audit, schema_version")
      .eq("analysis_id", idResult.data)
      .order("created_at", { ascending: false })
      .limit(1);

    if (storedError) {
      // Not fatal: a failed read of the cache falls through to a fresh audit
      // rather than denying the user a result they can still be given.
      console.error("Failed to read stored ATS audit:", storedError);
    }

    const stored = storedRows?.[0];
    if (stored) {
      // Validated on the way out, not just on the way in. A row was valid when
      // written, but the schema evolves and this one may predate the current
      // shape — stored jsonb is untrusted input like any other.
      const validated = atsAuditSchema.safeParse(stored.audit);

      if (validated.success) {
        return {
          data: {
            audit: validated.data,
            atsScore: row.ats_score,
            fileName: row.file_name,
            source: "stored",
            persisted: true,
          },
        };
      }

      console.error("Stored ATS audit failed validation; re-auditing.", {
        schemaVersion: stored.schema_version,
        issues: validated.error.issues,
      });
    }
  }

  let audit: AtsAudit;
  try {
    audit = await requestAtsAudit(row.resume_text);
  } catch (error) {
    // Logged, not surfaced: the user-facing strings stay generic, but the real
    // cause — a provider outage, a quota rejection, a truncated response —
    // must not vanish.
    console.error("ATS audit failed:", error);

    if (error instanceof z.ZodError) {
      return {
        error: "The audit came back in an unexpected shape. Please try again.",
      };
    }
    return { error: "The audit failed. Please try again." };
  }

  const { error: insertError } = await supabase.from("ats_audits").insert({
    analysis_id: idResult.data,
    user_id: user.id,
    audit,
    schema_version: AUDIT_SCHEMA_VERSION,
  });

  if (insertError) {
    console.error("Failed to save ATS audit:", insertError);
  }

  // The audit is returned either way. It is the deliverable and the model call
  // is already paid for, so a failed insert costs the user their history, not
  // their result — `persisted` lets the UI say so quietly. This deliberately
  // diverges from `analyzeResume`, which errors outright on a failed insert:
  // there the row *is* the product, since the analysis is what gets stored.
  return {
    data: {
      audit,
      atsScore: row.ats_score,
      fileName: row.file_name,
      source: "fresh",
      persisted: !insertError,
    },
  };
}
