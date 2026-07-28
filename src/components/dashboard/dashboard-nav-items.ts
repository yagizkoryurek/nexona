import { LayoutDashboard, ScanSearch, type LucideIcon } from "lucide-react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Exact-match routes are active only on themselves. Overview sits at the
   * root of the section, so a prefix test would light it up on every child
   * route; tool routes use a prefix test instead, so any page nested under
   * them still marks its parent active.
   */
  match: "exact" | "prefix";
};

/**
 * Single source of truth for dashboard navigation.
 *
 * Only shipped destinations belong here — an entry in this list is a promise
 * that the route exists and works. Planned tools (Optimizer, ATS Checker,
 * Cover Letter, Career Insights) get added as they ship.
 */
export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    label: "Resume Analyzer",
    href: "/dashboard/resume-analyzer",
    icon: ScanSearch,
    match: "prefix",
  },
];

/** Whether `pathname` should mark `item` as the current page. */
export function isNavItemActive(item: DashboardNavItem, pathname: string) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
