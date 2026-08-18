import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAccountCard } from "@/components/dashboard/delete-account-card";
import { PasswordResetCard } from "@/components/dashboard/password-reset-card";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account Settings",
};

/**
 * Account information, the one security action the current auth architecture
 * supports, legal links, and the Danger Zone that account deletion will land
 * in.
 *
 * No `maxDuration`: nothing here calls Gemini. No guard either — the dashboard
 * layout runs `getUser()` and the middleware matches `/dashboard/:path*`, so
 * this route is already covered twice.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email;
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const emailConfirmed = Boolean(user?.email_confirmed_at);

  // An explicit locale rather than `undefined`: this renders on the server, so
  // `undefined` would resolve to the server's locale, not the reader's.
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Account Settings
      </h1>

      <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
        Your account details, security, and privacy in one place.
      </p>

      <div className="mt-7 flex flex-col gap-6">
        <SettingsSection
          title="Account information"
          description="The details attached to your Nexona account."
        >
          <dl className="divide-border/60 divide-y">
            <InfoRow label="Email">
              <span className="text-foreground font-medium break-all">
                {email ?? "Unavailable"}
              </span>

              <span
                className={cn(
                  "mt-1 block text-xs",
                  emailConfirmed ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {emailConfirmed ? "Verified" : "Not yet verified"}
              </span>
            </InfoRow>

            <InfoRow label="Name">
              {name ? (
                <span className="text-foreground font-medium">{name}</span>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </InfoRow>

            {memberSince ? (
              <InfoRow label="Member since">
                <span className="text-foreground font-medium">
                  {memberSince}
                </span>
              </InfoRow>
            ) : null}
          </dl>
        </SettingsSection>

        <SettingsSection
          title="Security"
          description="We'll email you a link to choose a new password. Opening it signs you out, so you'll sign back in with the new one."
        >
          {email ? (
            <PasswordResetCard email={email} />
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              We couldn&apos;t read the email address on this account, so a
              reset link can&apos;t be sent right now. Try signing out and back
              in.
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          title="Privacy and legal"
          description="How Nexona handles your resume data, and the terms you agreed to."
        >
          <ul className="flex flex-col gap-3">
            <li>
              <LegalLink href="/privacy">Privacy Policy</LegalLink>
            </li>
            <li>
              <LegalLink href="/terms">Terms of Service</LegalLink>
            </li>
          </ul>
        </SettingsSection>

        <Separator className="my-2" />

        <SettingsSection
          title="Danger Zone"
          tone="danger"
          description="Deleting your account is permanent. It removes your resume analyses, ATS audits, cover letters, career insights, and interview preparation, and none of it can be recovered."
        >
          <DeleteAccountCard />
        </SettingsSection>
      </div>
    </div>
  );
}

/** One label/value pair in the account-information list. */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4 sm:py-4">
      <dt className="text-muted-foreground shrink-0 text-sm sm:w-40">
        {label}
      </dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/**
 * In-app links, not new tabs: both pages live in the `(legal)` route group and
 * carry the marketing Navbar/Footer, so the reader can get back on their own.
 */
function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground rounded-sm text-sm font-medium transition-colors hover:opacity-70",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
        "motion-reduce:transition-none",
      )}
    >
      {children}
    </Link>
  );
}
