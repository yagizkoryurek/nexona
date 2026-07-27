import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Placeholder for the real dashboard. It exists so route protection has
 * something to protect and so the session can be seen end to end — nothing
 * here is intended to survive the sprint that builds the actual product.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = user?.user_metadata?.full_name as string | undefined;

  return (
    <div className="w-full max-w-md">
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {name ? `Welcome back, ${name}` : "Welcome back"}
        </h1>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          You&apos;re signed in as{" "}
          <span className="text-foreground font-medium break-all">
            {user?.email}
          </span>
          . The dashboard itself arrives in a future sprint.
        </p>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
