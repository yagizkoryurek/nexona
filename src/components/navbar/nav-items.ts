export type NavItem = {
  label: string;
  href: string;
};

/**
 * Single source of truth for navigation — consumed by both the desktop bar and
 * the mobile menu so the two can never drift apart.
 */
export const navItems: NavItem[] = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const signInItem: NavItem = { label: "Sign In", href: "/sign-in" };

export const getStartedItem: NavItem = {
  label: "Get Started",
  href: "/get-started",
};
