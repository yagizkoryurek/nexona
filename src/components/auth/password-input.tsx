"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * Password field with a show/hide toggle.
 *
 * The toggle is a real, tabbable button with an `aria-label` that tracks its
 * state. It deliberately stays in the tab order: taking it out would make
 * revealing the password impossible for a keyboard-only user, which is a
 * WCAG 2.1.1 failure — worth one extra Tab stop.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={cn(
          "text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 transition-colors",
          "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
          "motion-reduce:transition-none",
        )}
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}
