"use client";

import Link from "next/link";
import { Globe } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type VisitWebsiteLinkProps = {
  className?: string;
};

/**
 * Leaves the authenticated app for the public marketing site. Deliberately a
 * plain link, not a `SidebarMenuButton` — it's never "active" the way a tool
 * route is, so it doesn't belong in `dashboardNavItems`, which promises only
 * shipped in-app destinations.
 */
export function VisitWebsiteLink({ className }: VisitWebsiteLinkProps) {
  const { setOpenMobile } = useSidebar();

  return (
    <Link
      href="/"
      onClick={() => setOpenMobile(false)}
      className={cn(
        "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors",
        "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-hidden",
        className,
      )}
    >
      <Globe aria-hidden="true" className="size-4 shrink-0" />
      <span>Visit Website</span>
    </Link>
  );
}
