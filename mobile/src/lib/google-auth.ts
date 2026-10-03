import * as WebBrowser from 'expo-web-browser';

import { googleAuthRedirectUri } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with Google, through Supabase's OAuth flow in an in-app browser.
 *
 * Its own module for the same reason lib/apple-auth.ts is: a browser session, a
 * redirect to parse and an OAuth error taxonomy are more than the one-call
 * wrappers in lib/auth-context.tsx, which still exposes this as a method.
 *
 * **Why OAuth rather than a native Google SDK.** The native route hands
 * Supabase an ID token, and Google's iOS SDK embeds a nonce in that token which
 * the free `@react-native-google-signin/google-signin` cannot surface — so
 * Supabase would accept it only with "Skip nonce checks" enabled. Here Supabase
 * performs the code exchange with Google itself, server-side, using the Web
 * client and its secret held in the Supabase dashboard; no Google client ID or
 * secret is in this app.
 *
 * **Why the tokens are read from the redirect, not exchanged as a code.** The
 * app's Supabase client uses the SDK's default implicit flow, so Supabase
 * returns the session in the redirect's fragment — the approach in Supabase's
 * Expo deep-linking guide. Switching the client to PKCE would also change how
 * `signUp` and `resetPasswordForEmail` behave, and the email flows' OTP codes
 * are deliberately left exactly as they are. The hand-off stays private:
 * `openAuthSessionAsync` is `ASWebAuthenticationSession` on iOS, which returns
 * the callback URL to this call alone rather than opening it as a system-wide
 * deep link. That is also why there is no `Linking` listener and why
 * `detectSessionInUrl: false` in lib/supabase.ts is unchanged — the URL never
 * passes through the router or a window location, and a `nexona://` link opened
 * from anywhere else is never treated as a sign-in.
 *
 * **This function never navigates**, exactly like Apple's. `setSession` makes
 * auth-js emit `SIGNED_IN`, the listener in lib/auth-context.tsx updates the
 * session, and `Stack.Protected` in app/_layout.tsx swaps the groups. The
 * session is persisted through LargeSecureStore by that same call.
 */

/**
 * One generic message for every failure, matching lib/apple-auth.ts: the
 * underlying error can distinguish a configuration problem from a rejected
 * token, which is more than a signed-out caller should learn.
 */
const GENERIC_ERROR =
  "We couldn't complete sign in with Google. Please try again.";

/** Same shape as Apple's: a cancellation is the user's choice, not an error. */
export type GoogleSignInResult = { error?: string; cancelled?: boolean };

/**
 * Collects the parameters Supabase put on the redirect, or `null` if the URL is
 * not the one this flow asked for.
 *
 * Supabase sends the session in the fragment and reports errors in both the
 * query and the fragment, so both are read. Parsed by hand rather than with
 * `new URL`, whose handling of a custom scheme's fragment is not something to
 * rely on for a security hand-off. The prefix check is defence in depth — the
 * browser session only ever completes on this scheme, but not necessarily this
 * host.
 */
function readRedirectParams(url: string): URLSearchParams | null {
  if (!url.startsWith(googleAuthRedirectUri)) return null;

  const rest = url.slice(googleAuthRedirectUri.length);
  if (rest !== '' && !/^[/?#]/.test(rest)) return null;

  const hashIndex = rest.indexOf('#');
  const beforeHash = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : rest.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);

  const params = new URLSearchParams(query);
  new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));
  return params;
}

/** Turns the redirect Supabase sent back into a stored session. */
async function completeFromRedirect(url: string): Promise<GoogleSignInResult> {
  const params = readRedirectParams(url);
  if (!params) return { error: GENERIC_ERROR };

  // Declining Google's consent screen arrives as `access_denied`. Like closing
  // the sheet, that is the user doing what they meant to, so it shows nothing.
  const oauthError = params.get('error');
  if (oauthError) {
    return oauthError === 'access_denied'
      ? { cancelled: true }
      : { error: GENERIC_ERROR };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return { error: GENERIC_ERROR };

  // Validates the access token against the Auth server before storing it, so a
  // well-formed but forged redirect cannot create a session.
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return error ? { error: GENERIC_ERROR } : {};
}

/** Runs the whole flow: Supabase's authorize URL, Google, then the session. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    // `skipBrowserRedirect` because there is no browser window to redirect —
    // the SDK only builds the URL, and the in-app browser opens it below.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: googleAuthRedirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) return { error: GENERIC_ERROR };

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      googleAuthRedirectUri
    );

    if (result.type === 'success') return await completeFromRedirect(result.url);

    // `cancel` and `dismiss` are the user closing the sheet. `locked` means
    // another auth session already holds the browser, which the user did not
    // choose, so it is reported.
    return result.type === WebBrowser.WebBrowserResultType.LOCKED
      ? { error: GENERIC_ERROR }
      : { cancelled: true };
  } catch {
    return { error: GENERIC_ERROR };
  }
}
