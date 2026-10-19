import Link from "next/link";
import { isGroup, legalNav, mainNav } from "@/config/navigation";
import { site } from "@/config/site";
import { Logo } from "./Logo";
import { QuoteLink } from "./QuoteLink";

export function SiteFooter() {
  const groups = mainNav.filter(isGroup);
  const singles = mainNav.filter((i) => !isGroup(i));
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-4 border-accent bg-night text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Transfers between London, anywhere in the UK, and Heathrow, Gatwick, Stansted, Luton and London City airports.
          </p>
          <ul className="mt-5 space-y-0.5 text-sm">
            <li>
              <a href={site.phone.href} className="inline-block py-1 font-display text-lg font-semibold text-white transition-colors hover:text-accent">
                {site.phone.display}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="inline-block py-1.5 transition-colors hover:text-white">
                {site.email}
              </a>
            </li>
            {site.whatsapp && (
              <li>
                <a href={site.whatsapp.href} className="inline-block py-1.5 transition-colors hover:text-white" target="_blank" rel="noopener">
                  WhatsApp {site.whatsapp.display}
                </a>
              </li>
            )}
            {site.openingHours && <li>{site.openingHours}</li>}
          </ul>
        </div>

        {groups.map((g) => (
          <nav key={g.label} aria-label={g.label}>
            <h2 className="text-xs font-bold tracking-wider text-white uppercase">{g.label}</h2>
            <ul className="mt-3 space-y-0.5 text-sm">
              {g.children.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="inline-block py-1.5 transition-colors hover:text-white">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-label="Company">
          <h2 className="text-xs font-bold tracking-wider text-white uppercase">Company</h2>
          <ul className="mt-3 space-y-0.5 text-sm">
            {singles.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-1.5 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <QuoteLink className="inline-block py-1.5 transition-colors hover:text-white">
                Get a Quote
              </QuoteLink>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="text-xs font-bold tracking-wider text-white uppercase">Legal</h2>
          <ul className="mt-3 space-y-0.5 text-sm">
            {legalNav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-1.5 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/65 sm:px-6">
          <div className="space-y-1">
            <p>
              © {year} {site.name}
            </p>
            {site.companyDetails && <p>{site.companyDetails}</p>}
            {site.licence && <p>{site.licence}</p>}
            {site.address && <p>{site.address}</p>}
          </div>
        </div>
      </div>
    </footer>
  );
}
