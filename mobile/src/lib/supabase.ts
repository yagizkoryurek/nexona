// Must come first: @supabase/supabase-js relies on a complete `URL` /
// `URLSearchParams` implementation internally, which React Native's JS engine
// does not ship. Without this polyfill the SDK fails at runtime, not at build
// time — so it is easy to miss until a real request is made.
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import { LargeSecureStore } from '@/lib/large-secure-store';

/**
 * The app's single Supabase client.
 *
 * Deliberately `@supabase/supabase-js` directly, not `@supabase/ssr` — that
 * package is built around a cookie jar and a server request/response cycle,
 * neither of which exists here. The web app keeps using it; this is the mobile
 * counterpart, not a replacement.
 *
 * `detectSessionInUrl: false` because there is no browser URL to read a session
 * out of: both email flows are completed with an OTP code typed into the app
 * (see lib/auth-context.tsx), so no deep link or callback route is involved.
 *
 * `autoRefreshToken` is enabled, but the SDK only ticks its refresh timer while
 * told to — see the AppState wiring in app/_layout.tsx, which is this app's
 * stand-in for the web middleware that refreshes on every request.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
