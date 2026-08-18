"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const SETTINGS_HREF = "/dashboard/settings";

type SettingsLinkProps = {
  className?: string;
};

/**
 * Account Settings, in the sidebar footer alongside sign-out.
 *
 * Deliberately outside `dashboardNavItems`, which stays a list of Overview plus
 * the shipped AI tools — settings is account configuration, not a tool, and it
 * belongs where users look for it. The cost of sitting outside that array is
 * that `isNavItemActive` doesn't cover it, so the active test lives here.
 *
 * Styled to match `VisitWebsiteLink`, its neighbour in the same footer, rather
 * than `SidebarMenuButton`.
 */
export function SettingsLink({ className }: SettingsLinkProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const active =
    pathname === SETTINGS_HREF || pathname.startsWith(`${SETTINGS_HREF}/`);

  return (
    <Link
      href={SETTINGS_HREF}
      aria-current={active ? "page" : undefined}
      // The mobile sidebar is a sheet; navigating inside it leaves it open over
      // the page it just moved to.
      onClick={() => setOpenMobile(false)}
      className={cn(
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors",
        "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-hidden",
        "motion-reduce:transition-none",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground",
        className,
      )}
    >
      <Settings aria-hidden="true" className="size-4 shrink-0" />
      <span>Account Settings</span>
    </Link>
  );
}
