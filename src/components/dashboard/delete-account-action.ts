"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Permanently deletes the caller's own account.
 *
 * The whole security model lives in the database: `public.delete_account()` is
 * a SECURITY DEFINER function that takes **no arguments** and resolves the
 * account to delete from `auth.uid()` alone (migration 0009). Nothing this
 * action sends can name a different user, because there is no parameter to put
 * one in — so no amount of tampering with the request reaches another account.
 *
 * That is also why no service-role key is involved. This uses the same anon-key
 * client every other server path uses, carrying the caller's own session, so
 * the RPC sees exactly the identity the JWT proves.
 */

/**
 * Deliberately one message for every failure. Postgres error text can carry
 * constraint names, column names and row contents; none of that belongs in a
 * browser. The real error goes to the server log instead.
 */
const GENERIC_ERROR =
  "We couldn't delete your account. Please try again, or contact support if the problem continues.";

/**
 * Resolves only on failure. Success redirects from the server, so the caller
 * receives nothing — hence the `undefined` in the return type, which is what
 * the client actually observes on the happy path.
 */
export async function deleteAccount(): Promise<{ error: string } | undefined> {
  const supabase = await createClient();

  // Re-verified server-side with the call that revalidates against the Auth
  // server, never getSession(). A Server Action is directly invocable, so the
  // client having rendered a confirmation dialog proves nothing.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: GENERIC_ERROR };
  }

  try {
    // No arguments — see above. The function derives the user itself.
    const { error } = await supabase.rpc("delete_account");

    if (error) {
      console.error("delete_account RPC failed", error);
      return { error: GENERIC_ERROR };
    }

    // The account row is gone; this clears the session cookies. The Auth
    // server will answer the logout call with a 404 or 401 because the user no
    // longer exists, which @supabase/auth-js explicitly ignores — it still
    // removes the local session in that path, which is the part that matters
    // here. Failing to clear the cookies would leave the browser holding a
    // token for a deleted account until it expired.
    await supabase.auth.signOut();
  } catch (error) {
    console.error("delete_account failed", error);
    return { error: GENERIC_ERROR };
  }

  // Outside the try/catch on purpose: redirect() signals by throwing, so
  // catching it here would swallow the navigation and report a fake failure.
  redirect("/sign-in?notice=account-deleted");
}
