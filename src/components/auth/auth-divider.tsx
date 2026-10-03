import { Separator } from "@/components/ui/separator";

/**
 * Horizontal rule with a centred label, separating the email form from the
 * Google button — the web counterpart of the mobile `AuthDivider`.
 *
 * `aria-hidden` because the rule carries nothing a screen reader needs: the
 * controls on either side already announce themselves.
 */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-muted-foreground text-sm">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}
