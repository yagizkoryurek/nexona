"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  GENERIC_AUTH_ERROR,
  GOOGLE_SIGN_IN_ERROR,
  mapAuthEmailError,
  type AuthEmailResult,
} from "@/lib/auth-errors";
import { OAUTH_PROVIDER_PARAM, safeRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "./auth-schemas";

/**
 * Every auth mutation lives here as a Server Action rather than an API route:
 * React Hook Form's `handleSubmit` already wants an async callback, and Server
 * Actions come with Next's Origin-header CSRF check built in.
 *
 * Each action re-validates with the same Zod schema the client uses. Client
 * validation is a convenience, not a trust boundary — an action can be invoked
 * directly.
 */

const GENERIC_ERROR = GENERIC_AUTH_ERROR;
const INVALID_FORM = "Please check the form and try again.";

export async function signIn(values: SignInValues, next?: string) {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    // Deliberately identical whether the account is missing, unconfirmed or
    // the password is wrong: a distinguishable response lets an attacker
    // enumerate which addresses have accounts.
    if (error) return { error: "Invalid email or password." };
  } catch {
    return { error: GENERIC_ERROR };
  }

  redirect(safeRedirectPath(next));
}

/**
 * Starts Google sign-in, for both new and returning users — Google has no
 * separate sign-up step, so the sign-in and sign-up screens share this.
 *
 * `signInWithOAuth` makes no request of its own here: it builds the authorize
 * URL and, because the `@supabase/ssr` server client runs the PKCE flow, writes
 * the code verifier cookie that `/auth/callback` later exchanges against. The
 * browser is then sent to Google, so this resolves only on failure.
 *
 * `next` is attacker-controllable, so it goes through `safeRedirectPath` here
 * and again in the callback.
 */
export async function signInWithGoogle(
  next?: string,
): Promise<{ error?: string }> {
  let authorizeUrl: string;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: googleRedirectTo(await origin(), next) },
    });

    if (error || !data.url) return { error: GOOGLE_SIGN_IN_ERROR };
    authorizeUrl = data.url;
  } catch {
    return { error: GOOGLE_SIGN_IN_ERROR };
  }

  // Outside the try: `redirect` works by throwing, and the catch above would
  // swallow it.
  redirect(authorizeUrl);
}

export async function signUp(values: SignUpValues): Promise<AuthEmailResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name },
        emailRedirectTo: signUpRedirectTo(await origin()),
      },
    });

    if (error) {
      if (error.code === "user_already_exists") {
        return {
          error:
            "An account with this email already exists. Try signing in instead.",
        };
      }
      return mapAuthEmailError(error);
    }
  } catch {
    return { error: GENERIC_ERROR };
  }

  // No redirect: the account is not usable until the emailed link is clicked,
  // so the form swaps to its "check your email" panel instead.
  return {};
}

/**
 * Re-sends the sign-up confirmation link. Needs only the address, not the
 * password — the web counterpart to `resendSignUp` in the mobile app's
 * lib/auth-context.tsx.
 *
 * Only ever called with the address the sign-up form just submitted, never
 * with free-typed input, so it adds no way to probe which addresses exist.
 */
export async function resendSignUp(email: string): Promise<AuthEmailResult> {
  // Structurally the same single-field check, so reused rather than restated.
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: signUpRedirectTo(await origin()) },
    });

    if (error) return mapAuthEmailError(error);
  } catch {
    return { error: GENERIC_ERROR };
  }

  return {};
}

export async function requestPasswordReset(
  values: ForgotPasswordValues,
): Promise<AuthEmailResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    // Supabase does not error on an unknown address, and the UI must not
    // undermine that by branching on a "no such user" case.
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${await origin()}/auth/callback?next=/reset-password` },
    );

    if (error) return mapAuthEmailError(error);
  } catch {
    return { error: GENERIC_ERROR };
  }

  return {};
}

export async function resetPassword(values: ResetPasswordValues) {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return {
        error:
          error.code === "same_password"
            ? "Choose a password you have not used before."
            : "We couldn't update your password. The reset link may have expired.",
      };
    }

    // End the recovery session so the new password is actually exercised, and
    // so the sign-in page is reachable to show the confirmation.
    await supabase.auth.signOut();
  } catch {
    return { error: GENERIC_ERROR };
  }

  redirect("/sign-in?notice=reset-success");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/");
}

/** Shared by `signUp` and `resendSignUp`, so a resent link lands where the first one did. */
function signUpRedirectTo(appOrigin: string) {
  return `${appOrigin}/auth/callback?next=/dashboard`;
}

/**
 * Where Supabase returns the browser after Google. Built with `URLSearchParams`
 * rather than interpolated, because `next` can itself carry a query string.
 */
function googleRedirectTo(appOrigin: string, next?: string) {
  const url = new URL("/auth/callback", appOrigin);
  url.searchParams.set("next", safeRedirectPath(next));
  url.searchParams.set(OAUTH_PROVIDER_PARAM, "google");
  return url.toString();
}

/** Absolute origin for the links Supabase emails back to this app. */
async function origin() {
  const headerList = await headers();
  const fromHeader = headerList.get("origin");
  if (fromHeader) return fromHeader;

  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
