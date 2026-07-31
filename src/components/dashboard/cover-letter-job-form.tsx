"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  coverLetterInputSchema,
  type CoverLetterInput,
} from "@/lib/ai/cover-letter-schema";

import { DashboardPanel } from "./dashboard-panel";

type CoverLetterJobFormProps = {
  onSubmit: (values: CoverLetterInput) => void;
  defaultValues?: Partial<CoverLetterInput>;
  pending: boolean;
};

/**
 * Collects the job this letter is for. The one form in the dashboard so far —
 * built inline rather than as a shared wrapper, since there is no second
 * consumer yet to justify extracting one. Uses the same
 * `coverLetterInputSchema` the Server Action re-validates with, so the
 * client-side check and the trust boundary agree on the same bounds.
 *
 * Not `AuthField`: that helper is deliberately scoped to the auth folder (see
 * its own comment) rather than promoted to a shared primitive, since this
 * project has no shadcn Form/FormField registry entry to build a general
 * version on top of.
 */
export function CoverLetterJobForm({
  onSubmit,
  defaultValues,
  pending,
}: CoverLetterJobFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CoverLetterInput>({
    resolver: zodResolver(coverLetterInputSchema),
    defaultValues: {
      jobTitle: defaultValues?.jobTitle ?? "",
      companyName: defaultValues?.companyName ?? "",
      jobDescription: defaultValues?.jobDescription ?? "",
    },
  });

  return (
    <DashboardPanel className="text-left">
      <form
        noValidate
        aria-busy={pending}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            {...register("jobTitle")}
            placeholder="Senior Frontend Engineer"
            disabled={pending}
            aria-invalid={Boolean(errors.jobTitle)}
            className="h-11"
          />
          {errors.jobTitle && (
            <p className="text-destructive text-sm">
              {errors.jobTitle.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">Company name (optional)</Label>
          <Input
            id="companyName"
            {...register("companyName")}
            placeholder="Acme Inc."
            disabled={pending}
            aria-invalid={Boolean(errors.companyName)}
            className="h-11"
          />
          {errors.companyName && (
            <p className="text-destructive text-sm">
              {errors.companyName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="jobDescription">Job description</Label>
          <Textarea
            id="jobDescription"
            {...register("jobDescription")}
            placeholder="Paste the job posting…"
            disabled={pending}
            aria-invalid={Boolean(errors.jobDescription)}
            className="min-h-40"
          />
          {errors.jobDescription && (
            <p className="text-destructive text-sm">
              {errors.jobDescription.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-11 w-full px-6"
        >
          {pending ? "Generating…" : "Generate cover letter"}
        </Button>
      </form>
    </DashboardPanel>
  );
}
