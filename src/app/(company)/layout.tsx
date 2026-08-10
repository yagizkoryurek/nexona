import { Footer } from "@/components/footer/footer";
import { Navbar } from "@/components/navbar/navbar";

/**
 * Shared shell for the standalone company pages (About, Contact).
 *
 * Deliberately identical to `(legal)/layout.tsx` — same chrome, same measure —
 * because these pages have the same job: public, linkable destinations reached
 * from the footer that a visitor may land on directly, rather than a focused
 * single-task flow like the auth screens. A separate group rather than an
 * extension of `(legal)` only because these are not legal documents.
 *
 * `Navbar`'s section links (`#features`, `#pricing`, etc.) target sections that
 * only exist on `/` — clicking one from here is a pre-existing property of that
 * shared nav, not something this layout introduces or fixes.
 */
export default function CompanyLayout({
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
