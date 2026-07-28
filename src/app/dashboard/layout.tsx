import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DecorativeBackdrop } from "@/components/decorative-backdrop";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";

/** Written by `SidebarProvider` on every toggle; read back here on the server. */
const SIDEBAR_COOKIE_NAME = "sidebar_state";

/**
 * Guarded shell for everything behind sign-in.
 *
 * The middleware already turns unauthenticated visitors away; this repeats the
 * check at the layer that actually renders the data, so a future routing change
 * cannot quietly expose a page.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard");
  }

  // Resolving the collapsed state on the server keeps the sidebar from
  // rendering open and then snapping shut for someone who collapsed it.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <DashboardSidebar />

      {/* `SidebarInset` is the <main> element; the backdrop sits under the
          page content rather than behind the sidebar too. */}
      <SidebarInset className="isolate overflow-hidden">
        <DecorativeBackdrop />

        <header className="flex h-14 shrink-0 items-center px-4 sm:px-6">
          <SidebarTrigger />
        </header>

        <div className="flex flex-1 flex-col px-4 pb-10 sm:px-6 sm:pb-12">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
