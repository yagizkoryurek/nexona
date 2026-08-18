"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavbarBrand } from "@/components/navbar/navbar-brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import { dashboardNavItems, isNavItemActive } from "./dashboard-nav-items";
import { SettingsLink } from "./settings-link";
import { VisitWebsiteLink } from "./visit-website-link";

/**
 * Persistent navigation for everything behind sign-in.
 *
 * Client-side because the active item is derived from the current pathname.
 * Collapsing is left at the block's `offcanvas` default rather than `icon`:
 * icon mode needs a tooltip on every item, and this project's generated
 * `ui/tooltip.tsx` exports `TooltipProvider` separately instead of wrapping
 * itself — using it without a provider ancestor throws at runtime.
 */
export function DashboardSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const availableItems = dashboardNavItems.filter(
    (item) => item.status === "available",
  );
  const comingSoonItems = dashboardNavItems.filter(
    (item) => item.status === "comingSoon",
  );

  return (
    <Sidebar>
      {/*
        Points at the app's own home, not the marketing site — leaving the app
        is an explicit, labelled action in the footer instead.
      */}
      <SidebarHeader className="px-4 py-5">
        <NavbarBrand href="/dashboard" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {/*
              `Sidebar` renders plain divs, so the landmark has to be declared
              here — same pattern the marketing nav uses.
            */}
            <nav aria-label="Dashboard">
              <SidebarMenu>
                {availableItems.map((item) => {
                  const active = isNavItemActive(item, pathname);

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          // The mobile sidebar is a sheet; navigating inside it
                          // leaves it open over the page it just moved to.
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Not-yet-built tools. Real <button>s with no `href` at all — the type
          system makes a dead link here a compile error, not a convention to
          remember. `aria-disabled` (not the `disabled` attribute) is what
          `sidebarMenuButtonVariants` keys its dimmed styling off of, and,
          unlike `disabled`, still leaves the button focusable — a native
          `disabled` button is skipped by Tab entirely, which would hide the
          roadmap from keyboard and screen-reader users that sighted users can
          see. `pointer-events-none` in that same variant already blocks mouse
          clicks; the handlers below are the keyboard-equivalent guard, since
          `pointer-events-none` has no effect on Enter/Space activation.

          The whole group is conditional because shipping the last planned tool
          empties it: without this, flipping the final `comingSoon` item to
          `available` leaves a "Coming Soon" heading standing over nothing.
        */}
        {comingSoonItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Coming Soon</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {comingSoonItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      aria-disabled="true"
                      tabIndex={0}
                      onClick={(event) => event.preventDefault()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                        }
                      }}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <VisitWebsiteLink />
        <SettingsLink />
        <SidebarSeparator className="my-1" />
        <SignOutButton />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
