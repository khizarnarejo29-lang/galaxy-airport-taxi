import { airports } from "@/lib/domain/airports";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  /** Overview page for the group; also the first link in its menu. */
  href: string;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => "children" in item;

/** Main navigation, used by the header, mobile menu and footer. */
export const mainNav: NavItem[] = [
  {
    label: "Airport Transfers",
    href: "/airport-transfers",
    children: [
      { label: "All London airports", href: "/airport-transfers" },
      ...airports.map((a) => ({ label: `${a.shortName} Airport Taxi`, href: `/${a.slug}` })),
      { label: "Prices", href: "/prices" },
    ],
  },
  { label: "Fleet", href: "/fleet" },
  {
    label: "Services",
    href: "/services",
    children: [
      { label: "All services", href: "/services" },
      { label: "Local Taxi (any journey)", href: "/taxi" },
      { label: "Meet & Greet", href: "/services/meet-and-greet" },
      { label: "Corporate Travel", href: "/services/corporate-travel" },
    ],
  },
  { label: "About Us", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const legalNav: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
];
