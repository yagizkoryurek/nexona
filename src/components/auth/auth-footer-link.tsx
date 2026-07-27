import Link from "next/link";

import { cn } from "@/lib/utils";

type AuthFooterLinkProps = {
  /** Static text before the link, e.g. "Don't have an account?". */
  prompt: string;
  label: string;
  href: string;
  className?: string;
};

/**
 * Cross-link between auth screens. Matches the navbar's text-link treatment:
 * colour-only hover, outline focus ring.
 */
export function AuthFooterLink({
  prompt,
  label,
  href,
  className,
}: AuthFooterLinkProps) {
  return (
    <p className={cn("text-muted-foreground text-center text-sm", className)}>
      {prompt}{" "}
      <Link
        href={href}
        className={cn(
          "text-foreground rounded-sm font-medium transition-colors hover:opacity-70",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
          "motion-reduce:transition-none",
        )}
      >
        {label}
      </Link>
    </p>
  );
}
