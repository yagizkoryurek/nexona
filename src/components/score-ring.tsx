import { cn } from "@/lib/utils";

type ScoreRingProps = {
  /** Score out of 100. Values outside 0–100 are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/**
 * Circular score indicator from the design system. Pure SVG — no chart library.
 * Decorative by default: the surrounding preview supplies the accessible name.
 */
export function ScoreRing({
  value,
  size = 104,
  strokeWidth = 8,
  className,
}: ScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="stroke-foreground"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {clamped}
        </span>
        <span className="text-muted-foreground text-[0.625rem] tracking-wide uppercase">
          Score
        </span>
      </div>
    </div>
  );
}
