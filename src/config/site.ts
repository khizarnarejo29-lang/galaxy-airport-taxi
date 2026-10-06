/**
 * Business details used across the site, as confirmed in NOTES.md.
 * Optional fields set to null are simply not shown anywhere — only fill them
 * with details the business has provided.
 */
export const site = {
  name: "Galaxy Airport Taxi",
  /** Production domain. NEXT_PUBLIC_SITE_URL can override it (e.g. for a preview). */
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://galaxyairporttaxi.co.uk",
  /** False now that real contact details are set; allows business structured data. */
  isPlaceholder: false,
  phone: { display: "+44 7470 046660", href: "tel:+447470046660" },
  /** None provided. */
  whatsapp: null as { display: string; href: string } | null,
  email: "info@galaxyairporttaxi.co.uk",
  /** e.g. "Mon–Sun, 24 hours". Not shown until set. */
  openingHours: null as string | null,
  address: "4-6 Greatorex Street, London E1 5NF" as string | null,
  /** None provided. e.g. "Company no. …, registered in England and Wales". */
  companyDetails: null as string | null,
  /** None provided. e.g. "Licensed by Transport for London, operator licence no. …". */
  licence: null as string | null,
} as const;
