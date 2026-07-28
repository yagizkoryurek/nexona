"use client";

import * as React from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  MAX_RESUME_SIZE_BYTES,
  validateResumeFile,
} from "@/lib/resume-file";
import { cn } from "@/lib/utils";

const ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx";

type ResumeDropzoneProps = {
  /** Called with the selected file when "Analyze Resume" is clicked. */
  onAnalyze: (file: File) => void;
  /** True while the analysis request from a previous click is in flight. */
  pending: boolean;
  /** Server-side failure from the last analyze attempt, if any. */
  analysisError?: string | null;
};

/**
 * Drag-and-drop + click-to-browse resume picker, plus the button that kicks
 * off analysis. File selection is entirely local; analysis itself is owned
 * by the caller (`ResumeAnalyzer`) so this component stays focused on one
 * thing — getting a valid file selected.
 */
export function ResumeDropzone({
  onAnalyze,
  pending,
  analysisError,
}: ResumeDropzoneProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const dragDepth = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const acceptFile = (candidate: File) => {
    const result = validateResumeFile(candidate);
    if (!result.ok) {
      setError(result.error);
      setFile(null);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const openPicker = () => inputRef.current?.click();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0];
    if (candidate) acceptFile(candidate);
    // Reset so choosing the same file again still fires a change event.
    event.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    // Required for onDrop to fire at all — browsers reject drops by default.
    event.preventDefault();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const candidate = event.dataTransfer.files?.[0];
    if (candidate) acceptFile(candidate);
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  if (file) {
    return (
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-12 shrink-0 items-center justify-center rounded-full border"
          >
            <FileText className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {file.name}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatFileSize(file.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={removeFile}
            disabled={pending}
            aria-label="Remove file"
            className={cn(
              "text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1 transition-colors",
              "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
              "motion-reduce:transition-none",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() => onAnalyze(file)}
            className="h-11 w-full px-6 sm:w-auto"
          >
            {pending ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
                Analyzing…
              </>
            ) : (
              "Analyze Resume"
            )}
          </Button>
          <p className="text-muted-foreground text-sm">
            {pending
              ? "This can take up to a minute."
              : "Takes about 30 seconds."}
          </p>
        </div>

        {analysisError ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {analysisError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPicker}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-border/60 bg-background/60 flex w-full flex-col items-center rounded-2xl border border-dashed p-10 text-center backdrop-blur-md sm:p-14",
          "transition-colors duration-200 ease-out",
          "hover:border-foreground/30",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
          "motion-reduce:transition-none",
          isDragging && "border-foreground/40 bg-foreground/[0.03]",
        )}
      >
        <span
          aria-hidden="true"
          className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-12 items-center justify-center rounded-full border"
        >
          <Upload className="size-5" />
        </span>

        <p className="text-foreground mt-5 text-base font-medium">
          Drag and drop your resume
        </p>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          or click to browse — PDF, DOC or DOCX,{" "}
          {formatFileSize(MAX_RESUME_SIZE_BYTES)} max
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
