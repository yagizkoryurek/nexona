import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to Nexona"
      description="Welcome back. Enter your details to continue."
      footer={
        <AuthFooterLink
          prompt="Don't have an account?"
          label="Sign up"
          href="/get-started"
        />
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
