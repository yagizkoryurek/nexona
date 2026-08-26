import { z } from "zod";

import {
  AUDIT_SCHEMA_VERSION,
  atsAuditSchema,
  requestAtsAudit,
  type AtsAudit,
} from "@/lib/ai/ats-audit";
import {
  formatRateLimitError,
  reserveAiUsage,
  resolveAiUsage,
} from "@/lib/ai/rate-limit";
import {
  bearerToken,
  jsonError,
  rateLimitStatus,
} from "@/lib/api/mobile-route";
import { createBearerClient } from "@/lib/supabase/route-handler";

// Gemini calls run inside this handler's own request lifecycle, same as the
// dashboard tool pages — see CLAUDE.md's Known Limitations for why this cap
// is currently moot on Vercel's Hobby tier.
export const maxDuration = 60;

const requestSchema = z.object({
  analysisId: z.string().uuid(),
  /** Force a new audit instead of serving the stored one. */
  refresh: z.boolean().optional().default(false),
});

/**
 * Mobile-facing ATS Compatibility Check endpoint. Mirrors `auditResume`
 * (src/components/dashboard/ats-audit-action.ts) step for step — same UUID
 * validation, same RLS-scoped re-fetch, same stored-audit cache with
 * re-validation on read, same rate limiting, same Gemini call, and the same
 * append-only persistence — reusing every one of those functions directly
 * rather than reimplementing any of them.
 *
 * Two differences, both transport rather than behaviour: a mobile client has
 * no shared cookie jar with this origin, so its Supabase session arrives as a
 * bearer token (see ./route-handler.ts); and the input arrives as a JSON body
 * rather than as Server Action arguments.
 *
 * Notably, no score is produced or requested here either. The `atsScore` in the
 * response is read off `resume_analyses` and passed through untouched — the
 * model is never shown it. See lib/ai/ats-audit.ts for why.
 */
export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return jsonError("You need to sign in again.", 401);
    }

    const supabase = createBearerClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("You need to sign in again.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Expected a JSON request body.", 400);
    }

    // Re-validate server-side — a mobile client's own check is a UX
    // convenience, not a trust boundary, same as the web action.
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("That analysis couldn't be found.", 400);
    }
    const { analysisId, refresh } = parsed.data;

    // No explicit user_id filter needed: RLS already scopes this select to the
    // caller's own rows, so a foreign or nonexistent id resolves to zero rows
    // either way — the same generic error avoids leaking which case it was.
    const { data: row, error: fetchError } = await supabase
      .from("resume_analyses")
      .select("file_name, resume_text, ats_score")
      .eq("id", analysisId)
      .single();

    if (fetchError) {
      // Logged, not surfaced: the user-facing message stays generic, but a real
      // query failure — schema drift, connectivity — must not be silently
      // indistinguishable from "no such row".
      console.error("Failed to fetch analysis for ATS audit:", fetchError);
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!row || !row.resume_text) {
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!refresh) {
      const { data: storedRows, error: storedError } = await supabase
        .from("ats_audits")
        .select("audit, schema_version")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (storedError) {
        // Not fatal: a failed read of the cache falls through to a fresh audit
        // rather than denying the user a result they can still be given.
        console.error("Failed to read stored ATS audit:", storedError);
      }

      const stored = storedRows?.[0];
      if (stored) {
        // Validated on the way out, not just on the way in. A row was valid
        // when written, but the schema evolves and this one may predate the
        // current shape — stored jsonb is untrusted input like any other.
        const validated = atsAuditSchema.safeParse(stored.audit);

        if (validated.success) {
          return Response.json({
            data: {
              audit: validated.data,
              atsScore: row.ats_score,
              fileName: row.file_name,
              source: "stored",
              persisted: true,
            },
          });
        }

        console.error("Stored ATS audit failed validation; re-auditing.", {
          schemaVersion: stored.schema_version,
          issues: validated.error.issues,
        });
      }
    }

    // Reserved only now, after the cache-hit path above has had its chance to
    // return — so re-opening a stored audit never consumes a usage slot, and a
    // `refresh` (which skips the cache-check block entirely) reserves like any
    // other fresh generation.
    const reservation = await reserveAiUsage(supabase, "ats-checker");
    if (!reservation.allowed) {
      return jsonError(
        formatRateLimitError(reservation),
        rateLimitStatus(reservation.reason),
        reservation.retryAfterSeconds,
      );
    }

    let audit: AtsAudit;
    try {
      audit = await requestAtsAudit(row.resume_text);
    } catch (error) {
      // Logged, not surfaced: the user-facing strings stay generic, but the
      // real cause — a provider outage, a quota rejection, a truncated
      // response — must not vanish.
      console.error("ATS audit failed:", error);
      await resolveAiUsage(supabase, reservation.reservationId, "failed");

      if (error instanceof z.ZodError) {
        return jsonError(
          "The audit came back in an unexpected shape. Please try again.",
          502,
        );
      }
      return jsonError("The audit failed. Please try again.", 502);
    }
    await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

    const { error: insertError } = await supabase.from("ats_audits").insert({
      analysis_id: analysisId,
      user_id: user.id,
      audit,
      schema_version: AUDIT_SCHEMA_VERSION,
    });

    if (insertError) {
      console.error("Failed to save ATS audit:", insertError);
    }

    // The audit is returned either way. It is the deliverable and the model
    // call is already paid for, so a failed insert costs the user their
    // history, not their result — `persisted` lets the UI say so quietly. Same
    // deliberate divergence from the analyzer route, where the row *is* the
    // product and a failed insert is a hard error.
    return Response.json({
      data: {
        audit,
        atsScore: row.ats_score,
        fileName: row.file_name,
        source: "fresh",
        persisted: !insertError,
      },
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/mobile/ats-checker:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
