import type { Metadata } from "next";

import { WelcomeScreen } from "@/components/dashboard/welcome-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Resume analysis (text extraction + an LLM call) can run long; raise the
// default serverless function timeout for this route. Confirm your hosting
// plan actually honors this — e.g. Vercel's Hobby tier caps at 10s regardless.
export const maxDuration = 60;

/**
 * Where every successful sign-in lands. The session is read here rather than in
 * the client component so the greeting renders on the server with no auth call
 * from the browser.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = user?.user_metadata?.full_name as string | undefined;

  return <WelcomeScreen name={name} email={user?.email} />;
}
