import type { Metadata } from "next";

import { WelcomeScreen } from "@/components/dashboard/welcome-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

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
