import { redirect } from "next/navigation";

import { DecorativeBackdrop } from "@/components/decorative-backdrop";
import { NavbarBrand } from "@/components/navbar/navbar-brand";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <DecorativeBackdrop />

      <header className="flex justify-center px-4 pt-8 sm:px-6 sm:pt-10">
        <NavbarBrand />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
