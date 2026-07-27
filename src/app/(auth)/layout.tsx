import { DecorativeBackdrop } from "@/components/decorative-backdrop";
import { NavbarBrand } from "@/components/navbar/navbar-brand";

/**
 * Shared shell for every auth screen.
 *
 * Rendered without the site Navbar and Footer: these are focused, single-task
 * pages, so the wordmark is the one deliberate way back to the landing page.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
