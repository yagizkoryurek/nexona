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
 * NOTE: every Company and Legal destination is a route that does not exist
 * yet, alongside the existing `/sign-in` and `/get-started`. They will 404
 * until those pages are built.
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
