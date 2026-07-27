"use client";

import { Button } from "@/components/ui/button";

import { signOut } from "./auth-actions";

/**
 * A real submit button inside a form, not a link: signing out is a mutation,
 * and it must not be triggerable by anything that prefetches URLs.
 *
 * Marked as a client component because `ui/button.tsx` pulls in Radix's Slot,
 * which needs `createContext` — it carries no "use client" of its own, and
 * that file is shadcn-generated, so the boundary is declared here instead.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="lg" className="h-11 px-6">
        Sign Out
      </Button>
    </form>
  );
}
