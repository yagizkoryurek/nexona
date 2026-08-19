import { apiBaseUrl } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Authenticated client for the web app's /api/mobile/* routes.
 *
 * Those routes authenticate with a bearer token rather than cookies, because a
 * mobile app shares no cookie jar with the deployed origin — see
 * `src/lib/supabase/route-handler.ts` and
 * `src/app/api/mobile/resume-analyzer/route.ts` on the web side. Nothing here
 * changes that contract; this is just the client for it.
 *
 * The web app gets session freshness for free: middleware calls `getUser()`
 * ahead of every matched request and rotates cookies before a page renders.
 * There is no such interceptor on mobile, so freshness is handled explicitly —
 * a token is fetched immediately before each request, and a 401 triggers one
 * refresh and one retry before giving up.
 */

export type ApiResult<T> = { data: T } | { error: string };

const SIGNED_OUT_ERROR = 'You need to sign in again.';

/**
 * `getSession()` rather than reading stored state directly: the SDK refreshes
 * locally when the cached token is at or near expiry, so this returns a token
 * that is good *now* rather than whatever was last written to disk.
 */
async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(
  path: string,
  body: FormData,
  accessToken: string
): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Content-Type is deliberately omitted: fetch derives it from the
      // FormData body and appends the multipart boundary, which cannot be
      // written by hand.
    },
    body,
  });
}

/**
 * POSTs multipart form data to an /api/mobile/* route.
 *
 * On 401 the session is refreshed once and the request retried once. If that
 * also fails the user is signed out locally, which flips the navigation guard
 * in app/_layout.tsx and returns them to the sign-in screen — rather than the
 * app inventing its own recovery UI for a session that is genuinely gone.
 */
export async function postFormToApi<T>(
  path: string,
  body: FormData
): Promise<ApiResult<T>> {
  try {
    const token = await currentAccessToken();
    if (!token) {
      await supabase.auth.signOut().catch(() => undefined);
      return { error: SIGNED_OUT_ERROR };
    }

    let response = await send(path, body, token);

    if (response.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();
      const refreshedToken = data.session?.access_token;

      if (error || !refreshedToken) {
        await supabase.auth.signOut().catch(() => undefined);
        return { error: SIGNED_OUT_ERROR };
      }

      response = await send(path, body, refreshedToken);

      if (response.status === 401) {
        await supabase.auth.signOut().catch(() => undefined);
        return { error: SIGNED_OUT_ERROR };
      }
    }

    return readResult<T>(response);
  } catch {
    // Network failure, DNS, timeout — never surfaced as a raw error string.
    return {
      error: "We couldn't reach Nexona. Check your connection and try again.",
    };
  }
}

/**
 * The routes answer with `{ data }` or `{ error }` and already phrase their
 * errors for end users (including rate-limit messages), so a present `error` is
 * passed through as-is. Only an unparseable or shapeless response needs copy
 * invented here.
 */
async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { error: 'Something went wrong. Please try again.' };
  }

  if (payload && typeof payload === 'object') {
    if ('error' in payload && typeof payload.error === 'string') {
      return { error: payload.error };
    }
    if (response.ok && 'data' in payload) {
      return { data: (payload as { data: T }).data };
    }
  }

  return { error: 'Something went wrong. Please try again.' };
}
