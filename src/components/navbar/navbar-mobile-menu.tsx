"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getStartedItem, navItems, signInItem } from "./nav-items";

/** Matches the `md:` breakpoint the desktop navigation appears at. */
const DESKTOP_QUERY = "(min-width: 48rem)";

type NavbarMobileMenuProps = {
  className?: string;
};

/**
 * Disclosure-pattern mobile menu: a hamburger trigger plus a slide-down panel.
 * Focus intentionally stays on the trigger when opening — the panel follows it
 * in the DOM, so Tab walks straight into the menu.
 */
export function NavbarMobileMenu({ className }: NavbarMobileMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  const close = React.useCallback(() => setOpen(false), []);

  // Escape closes the panel and hands focus back to the trigger.
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A pointer press anywhere outside the trigger or panel dismisses the menu.
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Resizing up to the desktop layout hides the trigger, so drop the panel too
  // rather than leaving orphaned open state behind.
  React.useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);

    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The panel now covers the full remaining viewport; without this the page
  // underneath keeps scrolling behind what's meant to read as an isolated
  // surface.
  React.useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-lg"
        className={className}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span
          className="relative flex size-5 items-center justify-center"
          aria-hidden="true"
        >
          <Menu
            className={cn(
              "absolute size-5 transition-all duration-200 ease-out",
              open ? "scale-75 opacity-0" : "scale-100 opacity-100",
            )}
          />
          <X
            className={cn(
              "absolute size-5 transition-all duration-200 ease-out",
              open ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
        </span>
      </Button>

      {/*
        Opaque and full-height so the panel is a true isolated surface: it must
        span every pixel below the header, or the Hero (and its own "Get
        Started" CTA, which intentionally shares the navbar's label) is visible
        right beneath it.

        Positioned `absolute`, not `fixed`: the header carries `backdrop-blur`,
        and an element with a backdrop-filter is a containing block for fixed
        descendants — a fixed panel would resolve against the 4rem header
        instead of the viewport. `top-full` puts it at the header's bottom edge
        and the explicit height fills what remains.

        `inert` keeps the closed panel out of the tab order and accessibility
        tree; `pointer-events-none` is the belt-and-braces for it, since a
        full-viewport transparent overlay would otherwise swallow every click.
      */}
      <div
        ref={panelRef}
        id={panelId}
        inert={!open}
        className={cn(
          "bg-background absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t",
          "transition-opacity duration-200 ease-out",
          "motion-reduce:transition-none md:hidden",
          open
            ? "border-border opacity-100"
            : "pointer-events-none border-transparent opacity-0",
        )}
      >
        <nav aria-label="Mobile" className="px-4 pt-6 pb-6 sm:px-6">
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-muted block rounded-md px-3 py-2.5 text-base font-medium transition-colors",
                    "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-border mt-6 flex flex-col gap-2 border-t pt-6">
            <Button asChild variant="ghost" size="lg" className="w-full">
              <Link href={signInItem.href} onClick={close}>
                {signInItem.label}
              </Link>
            </Button>
            <Button asChild size="lg" className="w-full">
              <Link href={getStartedItem.href} onClick={close}>
                {getStartedItem.label}
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
}
