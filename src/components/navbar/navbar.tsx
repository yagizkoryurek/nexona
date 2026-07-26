"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { NavbarBrand } from "./navbar-brand";
import { NavbarMobileMenu } from "./navbar-mobile-menu";
import { getStartedItem, navItems, signInItem } from "./nav-items";
import { useScrolled } from "./use-scrolled";

export function Navbar() {
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-sm",
        "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
        "motion-reduce:transition-none",
        scrolled
          ? "border-border bg-background/80 shadow-sm backdrop-blur-md"
          : "border-border/40 bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 justify-start">
          <NavbarBrand />
        </div>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-6 lg:gap-8">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "text-muted-foreground hover:text-foreground rounded-sm text-sm font-medium transition-colors",
                    "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="lg">
              <Link href={signInItem.href}>{signInItem.label}</Link>
            </Button>
            <Button asChild size="lg">
              <Link href={getStartedItem.href}>{getStartedItem.label}</Link>
            </Button>
          </div>

          <NavbarMobileMenu className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
