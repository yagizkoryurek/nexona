import { navItems, type NavItem } from "@/components/navbar/nav-items";

export type FooterLinkGroup = {
  heading: string;
  links: NavItem[];
};

export const footerContent = {
  tagline:
    "Know exactly where your application stands, in about forty seconds.",
  copyright: "Nexona. All rights reserved.",
} as const;

/**
 * Product reuses `navItems` by reference rather than restating it, so the
 * footer and the navbar can never drift apart — adding a section to the nav
 * adds it here too.
 *
 * NOTE: the Legal destinations (`/privacy`, `/terms`) are real placeholder
 * pages under `src/app/(legal)/`. The Company destinations (`/about`,
 * `/contact`) do not exist yet and will 404 until those pages are built.
 */
export const footerLinkGroups: FooterLinkGroup[] = [
  {
    heading: "Product",
    links: navItems,
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
