import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a dashboard route resolves its server-side data.
 *
 * One boundary at this level rather than one per tool: nested segments inherit
 * the nearest ancestor, and five of the seven dashboard routes open with two to
 * three sequential Supabase round trips (`getUser()`, then the analyses list,
 * then that tool's own table for the "already generated" annotation). Until
 * those return, the content area was previously blank.
 *
 * `dashboard/layout.tsx` has already rendered by this point, so the sidebar and
 * header stay in place and only this region swaps — which is exactly why the
 * skeleton mirrors the tool pages' shell (centred, `max-w-3xl`, a heading and
 * then a panel) instead of covering the whole viewport.
 *
 * `resume-analyzer` is fully synchronous and inherits this too. It resolves
 * immediately, so the boundary is effectively invisible there rather than a
 * gratuitous flash.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
      {/* Stands in for the page's <h1>, at roughly its rendered width. */}
      <Skeleton className="h-8 w-56" />

      <div className="mt-7 w-full">
        <DashboardPanel>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-sm" />

          {/*
            Four rows approximating ResumePicker's list items — the most common
            thing this boundary is waiting for. A fixed count rather than the
            real one, which is unknowable until the query it is covering returns.
          */}
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </DashboardPanel>
      </div>

      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  );
}
