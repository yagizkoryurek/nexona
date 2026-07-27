"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/auth-redirect";
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

const GENERIC_ERROR = "Something went wrong. Please try again.";
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

export async function signUp(values: SignUpValues) {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { error: INVALID_FORM };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name },
        emailRedirectTo: `${await origin()}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return {
        error:
          error.code === "user_already_exists"
            ? "An account with this email already exists. Try signing in instead."
            : GENERIC_ERROR,
      };
    }
  } catch {
    return { error: GENERIC_ERROR };
  }

  // No redirect: the account is not usable until the emailed link is clicked,
  // so the form swaps to its "check your email" panel instead.
  return {};
}

export async function requestPasswordReset(values: ForgotPasswordValues) {
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

    if (error) return { error: GENERIC_ERROR };
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

/** Absolute origin for the links Supabase emails back to this app. */
async function origin() {
  const headerList = await headers();
  const fromHeader = headerList.get("origin");
  if (fromHeader) return fromHeader;

  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
