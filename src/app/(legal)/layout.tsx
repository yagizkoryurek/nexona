import { Footer } from "@/components/footer/footer";
import { Navbar } from "@/components/navbar/navbar";

/**
 * Shared shell for standalone legal pages (Terms, Privacy).
 *
 * Reuses the landing page's own chrome — `Navbar` and `Footer` verbatim —
 * rather than the auth screens' minimal shell: these are public, linkable
 * pages a visitor might land on directly, not a focused single-task flow, so
 * they keep full site navigation and the footer's link groups.
 *
 * `Navbar`'s section links (`#features`, `#pricing`, etc.) target sections
 * that only exist on `/` — clicking one from here is a pre-existing property
 * of that shared nav, not something this layout introduces or fixes.
 */
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
