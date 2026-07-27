import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default async function ResetPasswordPage() {
  // Reachable only with the recovery session the emailed link creates. The
  // middleware cannot enforce this — it lets signed-in users through here on
  // purpose — so the page checks for itself.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a new password for your account."
      footer={
        <AuthFooterLink
          prompt="Changed your mind?"
          label="Sign in"
          href="/sign-in"
        />
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
