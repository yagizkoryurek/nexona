import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase client for browser (client component) use.
 *
 * Nothing in this sprint needs it — every auth mutation runs in a Server
 * Action, because only a server context can write session cookies. It exists
 * as the counterpart to the server client for future client-side reads.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
