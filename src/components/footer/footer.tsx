import { NavbarBrand } from "@/components/navbar/navbar-brand";

import { footerContent, footerLinkGroups } from "./footer-data";
import { FooterLinkGroup } from "./footer-link-group";

export function Footer() {
  // Server component on a statically prerendered page, so this is evaluated
  // once at build time rather than shipping a client boundary for a year.
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/*
          Brand spans the full row until `lg`, where it becomes a wider first
          column — it carries a wordmark plus a tagline, unlike the link lists.
        */}
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-3 sm:gap-8 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12 lg:py-16">
          <div className="flex flex-col items-start sm:col-span-3 lg:col-span-1">
            <NavbarBrand />
            <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed text-pretty">
              {footerContent.tagline}
            </p>
          </div>

          {footerLinkGroups.map((group) => (
            <FooterLinkGroup key={group.heading} {...group} />
          ))}
        </div>

        <div className="border-border/60 border-t py-6">
          <p className="text-muted-foreground text-sm">
            © {year} {footerContent.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
