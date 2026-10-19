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
  /** WhatsApp Business on the same number, confirmed by the owner. Opens a chat with a greeting filled in. */
  whatsapp: {
    display: "+44 7470 046660",
    href: `https://wa.me/447470046660?text=${encodeURIComponent("Hello Galaxy Airport Taxi, I would like a quote.")}`,
  } as { display: string; href: string } | null,
  email: "info@galaxyairporttaxi.co.uk",
  /** Confirmed by the owner: 24/7. Shown in the footer and on the contact page. */
  openingHours: "Open 24 hours, 7 days a week" as string | null,
  /** The same hours in schema.org form, for structured data. */
  openingHoursSchema: "Mo-Su 00:00-23:59" as string | null,
  address: "4-6 Greatorex Street, London E1 5NF" as string | null,
  /** The same address split into parts, for structured data. */
  postalAddress: { streetAddress: "4-6 Greatorex Street", addressLocality: "London", postalCode: "E1 5NF", addressCountry: "GB" } as {
    streetAddress: string;
    addressLocality: string;
    postalCode: string;
    addressCountry: string;
  } | null,
  /** None provided. e.g. "Company no. …, registered in England and Wales". */
  companyDetails: null as string | null,
  /** None provided. e.g. "Licensed by Transport for London, operator licence no. …". */
  licence: null as string | null,
} as const;
