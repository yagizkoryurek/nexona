import type { Metadata } from "next";

import { CoverLetterGenerator } from "@/components/dashboard/cover-letter-generator";
import type { SelectableAnalysis } from "@/components/dashboard/resume-picker";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cover Letter Generator",
};

// Cover letter generation (a Gemini call) can run long; raise the default
// serverless function timeout, same reasoning as the other AI routes. Confirm
// your hosting plan actually honors this — e.g. Vercel's Hobby tier caps at
// 10s regardless.
export const maxDuration = 60;

export default async function CoverLetterPage() {
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

  // No "already has a letter" annotation here, unlike the ATS Check's picker:
  // a letter is keyed to a job, not a resume, so one boolean per analysis
  // wouldn't mean anything — an analysis can have many letters for many jobs.
  const analyses: SelectableAnalysis[] = (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    overallScore: row.overall_score,
    atsScore: row.ats_score,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Cover Letter Generator
      </h1>

      <div className="mt-7 w-full">
        <CoverLetterGenerator analyses={analyses} />
      </div>
    </div>
  );
}
