import Link from "next/link";

import { cn } from "@/lib/utils";

type NavbarBrandProps = {
  className?: string;
};

/**
 * Nexona wordmark. Kept standalone so later sections (e.g. the footer) can
 * reuse the same mark without duplicating its styling.
 */
export function NavbarBrand({ className }: NavbarBrandProps) {
  return (
    <Link
      href="/"
      className={cn(
        "text-foreground rounded-sm text-lg font-semibold tracking-tight transition-opacity",
        "hover:opacity-70",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
        className,
      )}
    >
      Nexona
    </Link>
  );
}
