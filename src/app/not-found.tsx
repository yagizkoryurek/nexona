// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`. Same
// reason `hero.tsx` declares it. The cost is that `Footer` is bundled for the
// client here; on a static 404 that is cheaper than duplicating its markup.
"use client";

import Link from "next/link";

import { DecorativeBackdrop } from "@/components/decorative-backdrop";
import { Footer } from "@/components/footer/footer";
import { Navbar } from "@/components/navbar/navbar";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

/**
 * The 404 every unmatched URL lands on, replacing Next's stock page.
 *
 * Keeps the full site chrome — Navbar and Footer — because a visitor who
 * mistyped a URL is still on the public site and needs a way onward, not a
 * dead end. Both destinations are offered unconditionally: this page is
 * statically prerendered and cannot read the session without becoming dynamic,
 * and a signed-in visitor most likely wants the app rather than the marketing
 * page.
 */
export default function NotFound() {
  return (
    <>
      <Navbar />

      <main className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-6 sm:py-24">
        <DecorativeBackdrop />

        <SectionHeading
          label="404"
          headline="This page doesn't exist."
          description="The link may be out of date, or the address may have a typo. Nothing is broken on our side."
        />

        <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg" className="h-11 w-full px-6 sm:w-auto">
            <Link href="/">Back to home</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 w-full px-6 sm:w-auto"
          >
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </>
  );
}
