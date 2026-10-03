import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown for controls that send an auth email — the mobile counterpart to
 * the web's src/hooks/use-resend-cooldown.ts, with the same shape and the same
 * two windows.
 *
 * A UX guard, not the enforcement: Supabase Auth throttles sends server-side
 * regardless. What this adds is telling the user when to try again instead of
 * letting them spend their allowance on attempts that will be refused.
 *
 * Deadlines live in a module-level map rather than component state, so they
 * outlast any one screen: the verify screen sees the countdown the
 * forgot-password screen started for the same address. They do not survive the
 * app being killed — deliberately in-memory only, the same limitation
 * `isRecoverySession` in lib/auth-context.tsx already accepts.
 */

/** Adjustable — a product choice, not a value Supabase dictates. */
export const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

const deadlines = new Map<string, number>();

export type CooldownPurpose = 'signup' | 'recovery';

/** One key per flow and address, so different flows never share a countdown. */
export function cooldownKey(purpose: CooldownPurpose, email: string) {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

function remainingSeconds(deadlineMs: number, nowMs: number) {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function useResendCooldown(key: string | null) {
  const [deadline, setDeadline] = useState(() =>
    key ? (deadlines.get(key) ?? 0) : 0
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setDeadline(key ? (deadlines.get(key) ?? 0) : 0);
    setNow(Date.now());
  }, [key]);

  const remaining = remainingSeconds(deadline, now);
  const isActive = remaining > 0;

  // Recomputed from the deadline on every tick, so a timer that iOS pauses
  // while the app is backgrounded catches up on the first tick after it
  // returns instead of drifting.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const start = useCallback(
    (seconds: number) => {
      if (!key) return;
      const next = Date.now() + seconds * 1000;
      deadlines.set(key, next);
      setDeadline(next);
      setNow(Date.now());
    },
    [key]
  );

  /** Starts a countdown only if none is running — for a send made on a previous screen. */
  const ensureStarted = useCallback(
    (seconds: number) => {
      if (!key) return;
      if (remainingSeconds(deadlines.get(key) ?? 0, Date.now()) > 0) return;
      start(seconds);
    },
    [key, start]
  );

  return { remainingSeconds: remaining, isActive, start, ensureStarted };
}
