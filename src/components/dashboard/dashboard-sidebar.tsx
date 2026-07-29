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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import { dashboardNavItems, isNavItemActive } from "./dashboard-nav-items";
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
                {dashboardNavItems.map((item) => {
                  const active = isNavItemActive(item, pathname);

                  return (
                    <SidebarMenuItem key={item.href}>
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
      </SidebarContent>

      <SidebarFooter className="p-4">
        <VisitWebsiteLink />
        <SidebarSeparator className="my-1" />
        <SignOutButton />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
