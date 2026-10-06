import Link from "next/link";
import { isGroup, legalNav, mainNav } from "@/config/navigation";
import { site } from "@/config/site";
import { Logo } from "./Logo";

export function SiteFooter() {
  const groups = mainNav.filter(isGroup);
  const singles = mainNav.filter((i) => !isGroup(i));
  const year = new Date().getFullYear();

  return (
    <footer className="bg-night text-white/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Transfers between Greater London and Heathrow, Gatwick, Stansted, Luton and London City airports.
          </p>
          <ul className="mt-5 space-y-1.5 text-sm">
            <li>
              <a href={site.phone.href} className="font-semibold text-white hover:text-accent">
                {site.phone.display}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-white">
                {site.email}
              </a>
            </li>
            {site.whatsapp && (
              <li>
                <a href={site.whatsapp.href} className="hover:text-white" rel="noopener">
                  {site.whatsapp.display}
                </a>
              </li>
            )}
            {site.openingHours && <li>{site.openingHours}</li>}
          </ul>
        </div>

        {groups.map((g) => (
          <nav key={g.label} aria-label={g.label}>
            <h2 className="text-sm font-bold text-white">{g.label}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {g.children.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="hover:text-white">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-label="Company">
          <h2 className="text-sm font-bold text-white">Company</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {singles.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/quote" className="hover:text-white">
                Get a Quote
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="text-sm font-bold text-white">Legal</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {legalNav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs sm:px-6">
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
