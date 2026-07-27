import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
};

type SignInPageProps = {
  searchParams: Promise<{ next?: string; notice?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Read on the server so the form stays free of `useSearchParams`, which
  // would otherwise need a Suspense boundary here.
  const { next, notice } = await searchParams;

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
      <SignInForm next={next} notice={notice} />
    </AuthCard>
  );
}
