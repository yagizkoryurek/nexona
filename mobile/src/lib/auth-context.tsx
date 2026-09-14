import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  signInWithApple as requestAppleSignIn,
  type AppleSignInResult,
} from '@/lib/apple-auth';
import { otpRedirectSentinel } from '@/lib/env';
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
  /**
   * True while `session` is a recovery session that began from a signed-out
   * state — i.e. the user verified a recovery code on `(auth)/verify` and still
   * has to set a new password.
   *
   * The root guards read this to keep the `(auth)` group mounted, because a
   * recovery session is otherwise indistinguishable from a normal one and would
   * hand the user straight to the tabs with their old password still valid.
   *
   * This is a navigation aid, never a security boundary. A recovery session is
   * a full-privilege session as far as Supabase is concerned, and this flag is
   * React state that does not survive a cold launch — see the `PASSWORD_RECOVERY`
   * handling below.
   */
  isRecoverySession: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /**
   * Native Sign in with Apple. Resolves `{ cancelled: true }` when the user
   * dismisses Apple's sheet, which callers must not render as an error.
   *
   * Like every method here it returns a result and nothing else — the session
   * listener below is what moves the user, not this call.
   */
  signInWithApple: () => Promise<AppleSignInResult>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  /** Confirms a new account with the emailed code, which also signs the user in. */
  verifySignUp: (email: string, token: string) => Promise<Result>;
  /** Re-sends the signup confirmation code. Needs only the address, not the password. */
  resendSignUp: (email: string) => Promise<Result>;
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
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  // Mirrors `session` for the auth listener, which has to know whether a
  // session already existed *before* the event it is handling. Reading that
  // from inside a `setSession` updater would make the updater impure, and the
  // listener's closure over `session` would be stale.
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let active = true;

    // Reads the persisted session through LargeSecureStore. Safe to trust
    // locally: it only decides which screens to show, and every request the
    // session authorises is verified server-side by `getUser()` against the
    // Auth server (see src/lib/supabase/route-handler.ts in the web app).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      sessionRef.current = data.session;
      setSession(data.session);
      setLoading(false);
    });

    // Fires for sign-in, sign-out, token refresh and user updates, so the
    // navigation guard follows session state without any screen pushing it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        // `verifyOtp({ type: 'recovery' })` emits this and establishes a real
        // session, which would otherwise read as a completed sign-in and send
        // the user to the tabs with the reset screen never shown.
        //
        // Only a recovery that starts signed out sets the flag. Settings runs
        // the identical `verifyPasswordReset` with a live session
        // (components/settings/change-password-card.tsx), and flagging that
        // would unmount the very card the user is standing on, halfway through
        // the change. The prior session is the only thing that separates the
        // two, since the event and the session are the same in both.
        setIsRecoverySession(sessionRef.current === null);
      } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsRecoverySession(false);
      }
      // Every other event deliberately leaves the flag alone. TOKEN_REFRESHED
      // fires while the user is still choosing a password, and USER_UPDATED
      // fires from `updatePassword` just before the sign-out that ends the
      // flow — clearing on either would flip the guard mid-reset.

      sessionRef.current = nextSession;
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
      isRecoverySession,

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

      // Delegates wholesale to lib/apple-auth.ts. Exposed here as a method so
      // screens reach every auth mutation through one hook, rather than
      // importing the provider module directly and bypassing the context.
      signInWithApple: requestAppleSignIn,

      async signUp(name, email, password) {
        try {
          const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              // `full_name` matches what the web sign-up stores, so an account
              // created on either client looks the same.
              data: { full_name: name.trim() },
              // Not a destination — the discriminator the email template reads
              // to send a code rather than the web's link. See
              // `otpRedirectSentinel` in lib/env.ts for why it must be sent
              // rather than omitted.
              emailRedirectTo: otpRedirectSentinel,
            },
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
            // Deliberately mentions signing in. The confirmation code and the
            // link in the same email are two encodings of ONE single-use
            // token, so a user who opened the link has already confirmed their
            // account and this code is now spent. Without that hint the most
            // likely reading of this message — "my account is broken" — is
            // exactly wrong.
            return {
              error:
                "That code is incorrect or has expired. Request a new one, or sign in if you've already confirmed your account.",
            };
          }

          // A successful verification establishes a real session;
          // onAuthStateChange flips the navigation guard.
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async resendSignUp(email) {
        try {
          // Must carry the sentinel, exactly as `signUp` does. The templates
          // branch on an exact `{{ .RedirectTo }}` match, and GoTrue fills in
          // the Site URL when a client sends nothing — so omitting it here
          // would make a resend arrive as the web's link while the user sits on
          // a code screen. Every path that triggers an auth email sends it.
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: { emailRedirectTo: otpRedirectSentinel },
          });

          if (error) return { error: GENERIC_ERROR };
          return {};
        } catch {
          return { error: GENERIC_ERROR };
        }
      },

      async requestPasswordReset(email) {
        try {
          // Supabase does not error on an unknown address, and this must not
          // undermine that by branching on a "no such user" case.
          //
          // The sentinel is what makes the Reset password template send a code
          // rather than the web's link — the same mechanism as `signUp`, and
          // the reason recovery needs it too: nothing else distinguishes a
          // mobile recovery request from a web one at send time.
          const { error } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo: otpRedirectSentinel }
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
    [session, loading, isRecoverySession]
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
