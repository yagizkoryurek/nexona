import { supabase } from '@/lib/supabase';

/**
 * Account-level operations that are not Supabase Auth calls.
 *
 * Deliberately its own module rather than a method on `AuthContext`, for the
 * same reason the web keeps `delete-account-action.ts` out of `auth-actions.ts`:
 * every method on the context maps to `supabase.auth.*`, and this is a Postgres
 * RPC. `lib/analyses.ts` is the established home for talking to the database
 * directly; this is the second instance of that, not a new pattern.
 */

const GENERIC_ERROR =
  "We couldn't delete your account. Please try again, or contact support if the problem continues.";

/**
 * Permanently deletes the signed-in account and everything owned by it.
 *
 * Mirrors the web's `deleteAccount` Server Action step for step. All of the work
 * happens in `public.delete_account()` (migration 0009), a SECURITY DEFINER
 * function owned by `postgres`:
 *
 * - **It takes no parameters, and this call must never pass any.** Identity comes
 *   only from `auth.uid()`, so there is no argument for a caller to point at
 *   another account — deleting someone else's data is impossible by
 *   construction rather than by policy. There is deliberately no user id
 *   anywhere in this file.
 * - No service-role key is involved. The function is granted to `authenticated`
 *   and runs with the caller's own session, exactly like the reads in
 *   `lib/analyses.ts`, so nothing here needs a secret and no API route is
 *   required to hold one.
 * - Every user-owned table cascades from `auth.users`, so removing that one row
 *   takes the analyses, ATS audits, cover letters, career insights, interview
 *   preparation and usage events with it.
 *
 * On success the sign-out clears LargeSecureStore, `onAuthStateChange` fires,
 * and the root layout's `Stack.Protected` unmounts the whole signed-in area —
 * so there is deliberately no navigation call and no success state to render.
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: GENERIC_ERROR };

    const { error } = await supabase.rpc('delete_account');

    if (error) {
      console.error('delete_account RPC failed', error);
      return { error: GENERIC_ERROR };
    }

    // Swallowed for the same reason as `AuthContext.signOut`: a failed sign-out
    // must still leave the user signed out locally rather than stranded in an
    // app whose account no longer exists.
    await supabase.auth.signOut().catch(() => undefined);
    return {};
  } catch (error) {
    console.error('delete_account failed', error);
    return { error: GENERIC_ERROR };
  }
}
