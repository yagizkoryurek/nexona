import Link from "next/link";

import { cn } from "@/lib/utils";

import type { FooterLinkGroup as FooterLinkGroupData } from "./footer-data";

type FooterLinkGroupProps = FooterLinkGroupData & {
  className?: string;
};

/**
 * One labelled column of footer links, rendered three times (Product, Company,
 * Legal) so the columns are never duplicated markup.
 *
 * Each column is its own `<nav>` named after its heading: screen-reader users
 * get "Product", "Company" and "Legal" as separately jumpable landmarks,
 * distinct from the navbar's "Main" and "Mobile" navigation.
 */
export function FooterLinkGroup({
  heading,
  links,
  className,
}: FooterLinkGroupProps) {
  return (
    <nav aria-label={heading} className={className}>
      <p className="text-foreground text-xs font-medium tracking-[0.14em] uppercase">
        {heading}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              // Matches the navbar's text-link treatment exactly — colour-only
              // hover, outline focus ring. Deliberately not the lift-and-shadow
              // used by the Feature, Step and Pricing cards.
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-sm text-sm transition-colors",
                "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                "motion-reduce:transition-none",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
