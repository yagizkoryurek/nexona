import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

/**
 * Native Sign in with Apple.
 *
 * Deliberately its own module rather than a method body inside
 * `lib/auth-context.tsx`, for the same reason `lib/account.ts` is separate:
 * every other method on that context is a thin wrapper over exactly one
 * `supabase.auth.*` call, and this is a multi-step exchange with a nonce pair,
 * an OS-level sheet, an Apple-specific error taxonomy, and a conditional write
 * to user metadata. The context still exposes it, so screens keep using one
 * hook and never import this file directly.
 *
 * **No OAuth flow, browser, deep link, or Services ID is involved.** Supabase's
 * Apple provider is configured native-only against the App ID
 * (`com.nexona.app`), which means Supabase verifies Apple's identity token
 * against Apple's published public keys and checks the `aud` claim — there is
 * no redirect to catch and no client secret to rotate every six months. That is
 * why `detectSessionInUrl: false` in lib/supabase.ts stays exactly as it is: the
 * token arrives in memory from the operating system, never through a URL.
 *
 * **This function never navigates.** A successful exchange makes auth-js emit
 * `SIGNED_IN`, which the listener in lib/auth-context.tsx already handles, which
 * flips the `Stack.Protected` guard in app/_layout.tsx. Pushing a route here as
 * well would fight the router for control — the same rule the email sign-in
 * screen already documents.
 */

/**
 * One generic message for every failure, matching the posture in
 * `lib/auth-context.tsx`: the raw `AuthError.message` can distinguish a
 * provider-configuration problem from a rejected token, which is more than a
 * signed-out caller should be able to learn.
 */
const GENERIC_ERROR =
  "We couldn't complete sign in with Apple. Please try again.";

/**
 * `cancelled` is deliberately distinct from `error`.
 *
 * Dismissing Apple's sheet is the user doing exactly what they intended, so the
 * caller renders nothing at all rather than red copy. Collapsing the two into a
 * single `error` field would make a deliberate cancellation look like a bug in
 * the app.
 */
export type AppleSignInResult = { error?: string; cancelled?: boolean };

/**
 * `signInAsync` rejects with `ERR_REQUEST_CANCELED` when the user dismisses the
 * sheet. Narrowed by hand because the rejection value is `unknown` — Apple's
 * other codes (`ERR_REQUEST_FAILED`, `ERR_INVALID_RESPONSE`,
 * `ERR_REQUEST_UNKNOWN`, …) are all real failures and fall through to the
 * generic message.
 */
function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
  );
}

/**
 * 32 random bytes as a hex string.
 *
 * `crypto.getRandomValues` is already a live global throughout this app:
 * `lib/large-secure-store.ts` imports `react-native-get-random-values` for its
 * side effect, and `lib/supabase.ts` imports that module — so the polyfill is
 * installed before anything here can run. `expo-crypto` is pulled in for the
 * digest below and not for randomness.
 */
function createRawNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

/**
 * Stores the display name Apple supplied, but only when there is nothing to
 * lose by doing so.
 *
 * **Apple hands over `fullName` on the first authorization and never again.**
 * Every later sign-in returns `null`, and Apple's identity token carries no name
 * claim at all — so Supabase cannot populate this server-side the way it would
 * for a provider that puts the name in the token. If it is not captured here, it
 * is gone until the user revokes the app in iOS Settings and re-authorizes.
 *
 * The `existing` guard is the reason this is not a plain write. A user who
 * signed up by email — where `signUp` stores the name they typed as `full_name`
 * — and who later signs in with Apple on the same address would otherwise have
 * their chosen name silently replaced by whatever Apple has on file.
 *
 * `formatFullName` rather than interpolating `givenName` and `familyName`: it is
 * locale-aware, and any component can be `null`, which naive interpolation turns
 * into `"Yağız null"` or a stray leading space.
 *
 * Failure here is swallowed on purpose. The user *is* signed in by this point; a
 * missing display name must never turn a successful sign-in into an error.
 */
async function persistAppleName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
  user: User | null
): Promise<void> {
  if (!fullName) return;

  const existing = (user?.user_metadata?.full_name as string | undefined)?.trim();
  if (existing) return;

  const formatted = AppleAuthentication.formatFullName(fullName).trim();
  if (!formatted) return;

  await supabase.auth
    .updateUser({ data: { full_name: formatted } })
    .catch(() => undefined);
}

/**
 * Runs the whole flow: Apple's sheet, then the Supabase exchange.
 *
 * **The nonce is passed in two different forms, and swapping them is the single
 * most likely way to break this.** Apple returns the value it was given
 * *unchanged* in the token's `nonce` claim — it does not hash it. So Apple
 * receives `SHA256(raw)` and Supabase receives `raw`, and GoTrue hashes its copy
 * to compare against the claim. Verified against the installed
 * `@supabase/auth-js@2.112.3`, whose `signInWithIdToken` forwards `nonce`
 * verbatim in the request body and does no hashing of its own. Getting the two
 * the wrong way round fails with a generic invalid-token error that points at
 * neither side.
 *
 * `access_token` is not supplied and is not needed: Apple's identity token
 * carries `c_hash`, not the `at_hash` that would require it.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const rawNonce = createRawNonce();

    // Hex, which is `digestStringAsync`'s documented default and what GoTrue
    // compares against.
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Typed `string | null`. A credential with no JWT cannot be exchanged for
    // anything, so this is a real failure rather than a cancellation.
    if (!credential.identityToken) {
      return { error: GENERIC_ERROR };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { error: GENERIC_ERROR };
    }

    // Ordered after the exchange because `updateUser` needs the session that
    // exchange just established.
    await persistAppleName(credential.fullName, data.user);

    return {};
  } catch (error) {
    if (isCancellation(error)) {
      return { cancelled: true };
    }

    return { error: GENERIC_ERROR };
  }
}
