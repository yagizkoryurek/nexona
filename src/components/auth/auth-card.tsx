import { cn } from "@/lib/utils";

type AuthCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Cross-link row rendered under the card body. */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * The surface every auth screen sits on.
 *
 * Reuses the Pricing card's treatment (border, translucent background, blur,
 * soft shadow) without its hover lift — this is a task surface, not a
 * browsable tile.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <div className={cn("w-full max-w-md", className)}>
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {description}
            </p>
          ) : null}
        </div>

        <div className="mt-6">{children}</div>
      </div>

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}
