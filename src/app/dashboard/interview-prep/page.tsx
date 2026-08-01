import type { Metadata } from "next";

import { InterviewPrepGenerator } from "@/components/dashboard/interview-prep-generator";
import type { SelectableAnalysis } from "@/components/dashboard/resume-picker";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Interview Prep",
};

// Generating preparation (a Gemini call) can run long; raise the default
// serverless function timeout, same reasoning as the other AI tool routes.
// Confirm your hosting plan actually honors this — e.g. Vercel's Hobby tier
// caps at 10s regardless.
export const maxDuration = 60;

export default async function InterviewPrepPage() {
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

  // Which of those already have preparation, so the picker can say so and the
  // action can serve the stored document. A separate query rather than a
  // PostgREST embed, same reasoning as the ATS checker and career insights
  // routes: this only needs a set of ids and stays predictable without
  // depending on relationship detection.
  const { data: prepRows } = await supabase
    .from("interview_preps")
    .select("analysis_id")
    .eq("user_id", user?.id ?? "");

  const preparedIds = new Set(
    (prepRows ?? []).map((row) => row.analysis_id as string),
  );

  const analyses: SelectableAnalysis[] = (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    overallScore: row.overall_score,
    atsScore: row.ats_score,
    annotation: preparedIds.has(row.id) ? "Prep ready" : undefined,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Interview Prep
      </h1>

      <div className="mt-7 w-full">
        <InterviewPrepGenerator analyses={analyses} />
      </div>
    </div>
  );
}
