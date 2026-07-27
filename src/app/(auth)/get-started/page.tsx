import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up",
};

/**
 * Lives at /get-started rather than /sign-up: every CTA on the landing page
 * already points here.
 */
export default function GetStartedPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Start free. No credit card required."
      footer={
        <AuthFooterLink
          prompt="Already have an account?"
          label="Sign in"
          href="/sign-in"
        />
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
