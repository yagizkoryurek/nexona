import type { Metadata } from "next";

import { AtsChecker } from "@/components/dashboard/ats-checker";
import type { SelectableAnalysis } from "@/components/dashboard/resume-picker";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ATS Compatibility Check",
};

// An ATS audit (a Gemini call) can run long; raise the default serverless
// function timeout, same reasoning as the analyzer and optimizer routes.
// Confirm your hosting plan actually honors this — e.g. Vercel's Hobby tier
// caps at 10s regardless.
export const maxDuration = 60;

export default async function AtsCheckerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only analyses with a stored resume_text are eligible — anything from
  // before that column existed is simply absent here, not shown as broken.
  const { data } = await supabase
    .from("resume_analyses")
    .select("id, file_name, created_at, overall_score, ats_score")
    .eq("user_id", user?.id ?? "")
    .not("resume_text", "is", null)
    .order("created_at", { ascending: false });

  // Which of those already have an audit, so the picker can say so and the
  // action can serve the stored one. A separate query rather than a PostgREST
  // embed: the embed would work off the foreign key, but this only needs a set
  // of ids and stays predictable without depending on relationship detection.
  const { data: auditRows } = await supabase
    .from("ats_audits")
    .select("analysis_id")
    .eq("user_id", user?.id ?? "");

  const auditedIds = new Set(
    (auditRows ?? []).map((row) => row.analysis_id as string),
  );

  const analyses: SelectableAnalysis[] = (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    overallScore: row.overall_score,
    atsScore: row.ats_score,
    annotation: auditedIds.has(row.id) ? "Audited" : undefined,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        ATS Compatibility Check
      </h1>

      <div className="mt-7 w-full">
        <AtsChecker analyses={analyses} />
      </div>
    </div>
  );
}
