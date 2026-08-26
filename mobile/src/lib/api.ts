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

/**
 * What varies between the two POST flavours below: the body, and whether a
 * Content-Type has to be stated. Everything else — the bearer header, the
 * refresh-and-retry, the error envelope — is identical, so it lives in one
 * place rather than being copied per tool.
 */
type AuthedBody = {
  body: BodyInit;
  headers?: Record<string, string>;
};

async function send(
  path: string,
  request: AuthedBody,
  accessToken: string
): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...request.headers,
      Authorization: `Bearer ${accessToken}`,
    },
    body: request.body,
  });
}

/**
 * POSTs to an /api/mobile/* route with the caller's Supabase session attached.
 *
 * On 401 the session is refreshed once and the request retried once. If that
 * also fails the user is signed out locally, which flips the navigation guard
 * in app/_layout.tsx and returns them to the sign-in screen — rather than the
 * app inventing its own recovery UI for a session that is genuinely gone.
 *
 * Note the retry replays the same body. That is safe for both callers here: a
 * FormData built from a file URI and a JSON string are each re-readable, unlike
 * a consumed stream.
 */
async function postToApi<T>(
  path: string,
  request: AuthedBody
): Promise<ApiResult<T>> {
  try {
    const token = await currentAccessToken();
    if (!token) {
      await supabase.auth.signOut().catch(() => undefined);
      return { error: SIGNED_OUT_ERROR };
    }

    let response = await send(path, request, token);

    if (response.status === 401) {
      const { data, error } = await supabase.auth.refreshSession();
      const refreshedToken = data.session?.access_token;

      if (error || !refreshedToken) {
        await supabase.auth.signOut().catch(() => undefined);
        return { error: SIGNED_OUT_ERROR };
      }

      response = await send(path, request, refreshedToken);

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
 * POSTs multipart form data — the file-upload tools.
 *
 * Content-Type is deliberately not set: fetch derives it from the FormData body
 * and appends the multipart boundary, which cannot be written by hand.
 */
export async function postFormToApi<T>(
  path: string,
  body: FormData
): Promise<ApiResult<T>> {
  return postToApi<T>(path, { body });
}

/**
 * POSTs a JSON body — the tools that act on an already-stored analysis rather
 * than on a freshly uploaded file.
 */
export async function postJsonToApi<T>(
  path: string,
  payload: unknown
): Promise<ApiResult<T>> {
  return postToApi<T>(path, {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
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
