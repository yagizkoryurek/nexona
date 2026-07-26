// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`.
"use client";

import Link from "next/link";
import { ArrowRight, Check, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AnnouncementBadge } from "./announcement-badge";
import { ProductPreview } from "./product-preview";
import { heroContent } from "./hero-content";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden"
    >
      <HeroBackdrop />

      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: message and calls to action */}
          <div className="flex flex-col items-start">
            <AnnouncementBadge>{heroContent.badge}</AnnouncementBadge>

            <h1
              id="hero-heading"
              className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.05]"
            >
              {heroContent.headline}
            </h1>

            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
              {heroContent.description}
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-11 w-full px-6 sm:w-auto">
                <Link href={heroContent.primaryCta.href}>
                  {heroContent.primaryCta.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 w-full px-6 sm:w-auto"
              >
                <Link href={heroContent.secondaryCta.href}>
                  <Play aria-hidden="true" />
                  {heroContent.secondaryCta.label}
                </Link>
              </Button>
            </div>

            <ul className="text-muted-foreground mt-6 flex flex-col gap-x-5 gap-y-2 text-xs sm:flex-row sm:items-center sm:text-sm">
              {heroContent.trustSignals.map((signal) => (
                <li key={signal} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: product preview */}
          <div className="relative w-full">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Decorative washes and hairline grid behind the hero. */
function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="bg-foreground/[0.04] absolute -top-40 -left-32 size-[34rem] rounded-full blur-3xl" />
      <div className="bg-foreground/[0.05] absolute -top-24 -right-24 size-[38rem] rounded-full blur-3xl" />
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)] [background-size:64px_64px] opacity-40" />
    </div>
  );
}
