import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase client for HTTP Route Handlers authenticated via a client-supplied
 * bearer token, for callers with no shared cookie jar with this origin (e.g.
 * a future React Native client) — unlike the cookie-based client in
 * ./server.ts, which only Server Actions/Components can use.
 *
 * The token is attached as the Authorization header for every call this
 * client makes: auth.getUser() verifies it against the Auth server (never
 * trusted blindly, same as the cookie-based client), and PostgREST/RPC calls
 * (table inserts, reserve_ai_usage/resolve_ai_usage) carry it too, so RLS and
 * auth.uid() resolve exactly as they do for the web app.
 *
 * A new client per request — never share one across requests, since it
 * carries that request's token.
 */
export function createBearerClient(accessToken: string) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
