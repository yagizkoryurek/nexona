import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Session state plus every auth mutation, in one place — the mobile counterpart
 * to the web's `src/components/auth/auth-actions.ts`.
 *
 * The web performs these as Server Actions because only a server context can
 * write session cookies. Here there is no server boundary to cross: the SDK
 * talks to Supabase Auth directly and persists the result through
 * LargeSecureStore. The *security posture* is carried over deliberately though —
 * identical error copy for unknown-email and wrong-password (a distinguishable
 * response lets an attacker enumerate accounts), and never revealing whether an
 * address exists during password recovery.
 *
 * Both email flows are completed with an OTP code rather than a clicked link, so
 * no deep link, URL scheme, or callback route is involved anywhere in this app.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.';

type Result = { error?: string };

type AuthContextValue = {
  session: Session | null;
  /** True until the persisted session has been read off disk at least once. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  /** Confirms a new account with the emailed code, which also signs the user in. */
  verifySignUp: (email: string, token: string) => Promise<Result>;
  requestPasswordReset: (email: string) => Promise<Result>;
  /** Exchanges the emailed recovery code for a short-lived recovery session. */
  verifyPasswordReset: (email: string, token: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Reads the persisted session through LargeSecureStore. Safe to trust
    // locally: it only decides which screens to show, and every request the
    // session authorises is verified server-side by `getUser()` against the
    // Auth server (see src/lib/supabase/route-handler.ts in the web app).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Fires for sign-in, sign-out, token refresh and user updates, so the
    // navigation guard follows session state without any screen pushing it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,

      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          // Deliberately identical whether the account is missing, unconfirmed
          // or the password is wrong — same reasoning as the web action.
          if (error) return { error: 'Invalid email or password.' };
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async signUp(name, email, password) {
        try {
          const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            // `full_name` matches what the web sign-up stores, so an account
            // created on either client looks the same.
            options: { data: { full_name: name.trim() } },
          });

          if (error) {
            return {
              error:
                error.code === 'user_already_exists'
                  ? 'An account with this email already exists. Try signing in instead.'
                  : GENERIC_ERROR,
            };
          }

          // No session yet: the account is unusable until the emailed code is
          // verified, so the caller moves to the code-entry screen.
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async verifySignUp(email, token) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: 'signup',
          });

          if (error) {
            return {
              error:
                'That code is incorrect or has expired. Request a new one and try again.',
            };
          }

          // A successful verification establishes a real session;
          // onAuthStateChange flips the navigation guard.
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async requestPasswordReset(email) {
        try {
          // Supabase does not error on an unknown address, and this must not
          // undermine that by branching on a "no such user" case.
          const { error } = await supabase.auth.resetPasswordForEmail(
            email.trim()
          );

          if (error) return { error: GENERIC_ERROR };
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async verifyPasswordReset(email, token) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: 'recovery',
          });

          if (error) {
            return {
              error:
                'That code is incorrect or has expired. Request a new one and try again.',
            };
          }

          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async updatePassword(password) {
        try {
          const { error } = await supabase.auth.updateUser({ password });

          if (error) {
            return {
              error:
                error.code === 'same_password'
                  ? 'Choose a password you have not used before.'
                  : "We couldn't update your password. The reset code may have expired.",
            };
          }

          // End the recovery session so the new password is actually exercised
          // on the next sign-in — the same choice the web reset flow makes.
          await supabase.auth.signOut();
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async signOut() {
        // Clears both halves of LargeSecureStore. Errors are swallowed on
        // purpose: a failed sign-out must still leave the user signed out
        // locally rather than trapped in the app.
        await supabase.auth.signOut().catch(() => undefined);
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
