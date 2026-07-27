import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser (client component) use.
 *
 * Nothing in this sprint needs it — every auth mutation runs in a Server
 * Action, because only a server context can write session cookies. It exists
 * as the counterpart to the server client for future client-side reads.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
