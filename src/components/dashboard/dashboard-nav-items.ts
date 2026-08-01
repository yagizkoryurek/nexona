import {
  Compass,
  FileText,
  LayoutDashboard,
  ScanSearch,
  ShieldCheck,
  Wand2,
  type LucideIcon,
} from "lucide-react";

type AvailableNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  status: "available";
  href: string;
  /**
   * Exact-match routes are active only on themselves. Overview sits at the
   * root of the section, so a prefix test would light it up on every child
   * route; tool routes use a prefix test instead, so any page nested under
   * them still marks its parent active.
   */
  match: "exact" | "prefix";
};

type ComingSoonNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  status: "comingSoon";
};

export type DashboardNavItem = AvailableNavItem | ComingSoonNavItem;

/**
 * Single source of truth for dashboard navigation.
 *
 * `available` items are real, working routes — an entry with that status is
 * a promise the route exists. `comingSoon` items have no `href` at all, so a
 * dead link is a compile error rather than something to remember not to do;
 * they render as non-navigable placeholders until they ship, at which point
 * an item moves to `status: "available"` and gains `href`/`match`.
 */
export const dashboardNavItems: DashboardNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    status: "available",
    href: "/dashboard",
    match: "exact",
  },
  {
    id: "resume-analyzer",
    label: "Resume Analyzer",
    icon: ScanSearch,
    status: "available",
    href: "/dashboard/resume-analyzer",
    match: "prefix",
  },
  {
    id: "resume-optimizer",
    label: "Resume Optimizer",
    icon: Wand2,
    status: "available",
    href: "/dashboard/resume-optimizer",
    match: "prefix",
  },
  {
    id: "ats-checker",
    label: "ATS Compatibility Check",
    icon: ShieldCheck,
    status: "available",
    href: "/dashboard/ats-checker",
    match: "prefix",
  },
  {
    id: "cover-letter",
    label: "Cover Letter Generator",
    icon: FileText,
    status: "available",
    href: "/dashboard/cover-letter",
    match: "prefix",
  },
  {
    id: "career-insights",
    label: "AI Career Insights",
    icon: Compass,
    status: "available",
    href: "/dashboard/career-insights",
    match: "prefix",
  },
];

/** Whether `pathname` should mark `item` as the current page. */
export function isNavItemActive(item: AvailableNavItem, pathname: string) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
