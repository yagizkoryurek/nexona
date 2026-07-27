"use client";

import * as React from "react";
import {
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldRenderProps = {
  id: string;
  name: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
};

type AuthFieldProps<TValues extends FieldValues> = {
  name: FieldPath<TValues>;
  label: string;
  /** Receives the ids and ARIA attributes to spread onto the control. */
  children: (field: AuthFieldRenderProps) => React.ReactNode;
  /** Right-aligned element on the label row, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
  className?: string;
};

/**
 * Label + control + error message, with the ARIA wiring done once.
 *
 * The `radix-nova` registry ships an empty `form` item, so shadcn's
 * Form/FormField primitives are not available in this project. Rather than
 * hand-writing a file into `ui/` that shadcn never generated, this keeps the
 * equivalent wiring in the auth folder where it is used.
 *
 * Reads errors straight from React Hook Form context, so a control only has to
 * spread the props it is handed.
 */
export function AuthField<TValues extends FieldValues>({
  name,
  label,
  children,
  labelAction,
  className,
}: AuthFieldProps<TValues>) {
  const {
    formState: { errors },
  } = useFormContext<TValues>();
  const reactId = React.useId();

  const error = errors[name];
  const message =
    typeof error?.message === "string" ? error.message : undefined;

  const id = `${reactId}-${name}`;
  const messageId = `${id}-message`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>

      {children({
        id,
        name,
        "aria-invalid": Boolean(message),
        "aria-describedby": message ? messageId : undefined,
      })}

      {message ? (
        <p id={messageId} className="text-destructive text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
