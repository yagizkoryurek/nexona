import { Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type AuthAlertProps = {
  /** `error` for account-level failures, `info` for neutral notices. */
  variant?: "error" | "info";
  children: React.ReactNode;
  className?: string;
};

const variantStyles = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border/60 bg-foreground/[0.04] text-foreground",
} as const;

const variantIcons = {
  error: TriangleAlert,
  info: Info,
} as const;

/**
 * Form-level message, as opposed to the per-field errors handled by
 * `AuthField`. Covers both the account-level failures a backend will produce
 * ("Invalid email or password") and neutral notices.
 *
 * `role="alert"` because this always appears in response to a submit — it must
 * be announced when it arrives, not waited for.
 */
export function AuthAlert({
  variant = "error",
  children,
  className,
}: AuthAlertProps) {
  const Icon = variantIcons[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed text-pretty">{children}</p>
    </div>
  );
}
