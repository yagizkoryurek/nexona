"use client";

import * as React from "react";

/**
 * Countdown for controls that send an auth email, so a user cannot fire the
 * same email repeatedly.
 *
 * This is a UX guard, not the enforcement: Supabase Auth throttles email sends
 * server-side regardless. What this adds is that the user is told when to try
 * again instead of spending their allowance on attempts that will be refused.
 *
 * The deadline is persisted to localStorage, keyed by flow and address, so a
 * page refresh resumes the countdown rather than resetting it. Storage that is
 * unavailable (private mode, blocked) degrades to an in-memory countdown.
 */

/** Adjustable — a product choice, not a value Supabase dictates. */
export const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

const STORAGE_PREFIX = "nexona:resend-cooldown:";

export type CooldownPurpose = "signup" | "recovery";

/** One key per flow and address, so different flows never share a countdown. */
export function cooldownKey(purpose: CooldownPurpose, email: string) {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

export function remainingCooldownSeconds(deadlineMs: number, nowMs: number) {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

function readDeadline(key: string): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    const deadline = raw ? Number(raw) : 0;
    return Number.isFinite(deadline) ? deadline : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a cooldown without a mounted hook — for a send that happens before
 * the control it guards is on screen (the sign-up form, whose resend button
 * only appears once the confirmation has gone out).
 */
export function startResendCooldown(key: string, seconds: number) {
  const deadline = Date.now() + seconds * 1000;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, String(deadline));
  } catch {
    // Storage unavailable: the in-memory deadline in the hook still applies.
  }
  return deadline;
}

export function useResendCooldown(key: string | null) {
  const [deadline, setDeadline] = React.useState(0);
  const [now, setNow] = React.useState(0);

  // Read after hydration rather than during render, so the server render and
  // the first client render agree; the countdown appears one tick later.
  React.useEffect(() => {
    setDeadline(key ? readDeadline(key) : 0);
    setNow(Date.now());
  }, [key]);

  const remainingSeconds = remainingCooldownSeconds(deadline, now);
  const isActive = remainingSeconds > 0;

  React.useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const start = React.useCallback(
    (seconds: number) => {
      if (!key) return;
      setDeadline(startResendCooldown(key, seconds));
      setNow(Date.now());
    },
    [key],
  );

  return { remainingSeconds, isActive, start };
}
