# SEO, AEO and GEO report

Galaxy Airport Taxi, galaxyairporttaxi.co.uk. Work done 19–21 October 2026, checked on the live site
on 21 October 2026. No search volumes, rankings or AI citations are claimed or promised: they depend on
Google, Bing and the AI services, and only Search Console data can show them over the coming weeks.

The original brief named another business (a web-development agency). It was applied to the real
business, a fixed-price taxi service: no web-development, portfolio or case-study pages were made.

## 1. Audit (starting point)

- Strong technical base: Next.js, server-rendered pages, one h1 per page, canonical URLs, image alt
  text, security headers, www → apex redirect, a proper 404.
- Blocking issue: indexing was switched off (`noindex` and `Disallow: /`).
- Content issues: pages still said the service covered "our London service area" only, that stops and
  extras showed "Price on request", and that phone was "the most reliable way" to get a quote.
- Missing: FAQ markup on airport pages, a service schema, `llms.txt`, internal links in page content.

## 2. Technical SEO

- Indexing switched on (`SITE_INDEXING=on`); robots.txt allows everything except `/api/`, `/booking/`
  and `/admin`, and lists the sitemap.
- Sitemap: 31 pages (home, quote, airports ×5, prices, fleet, services ×4, about, FAQ, contact,
  local taxi, areas ×12, privacy, terms).
- Every page: unique title (≤ 65 characters) and description (≤ 160), canonical, `index, follow`,
  Open Graph image. The 404 page is `noindex`.
- Live crawl: 31/31 pages return 200, 0 broken internal links.

## 3. Structured data (schema.org)

- `LocalBusiness` with a stable `@id`, logo, structured address (4-6 Greatorex Street, London E1 5NF),
  phone, email, 24/7 hours, area served United Kingdom. `WebSite` points to it as publisher.
- `TaxiService` on the airport pages (with the airport and its IATA code), the area pages (with the
  place), the local taxi, airport transfers, Meet & Greet and corporate pages, all linked to the business.
- `FAQPage` only where every question and answer is shown in full on the page: FAQ, prices, airports,
  areas, local taxi, Meet & Greet.
- `BreadcrumbList` on every inner page.
- Deliberately absent: reviews, ratings, prices in markup. There are no real reviews yet.

## 4. Answer engine optimisation (AEO)

- Direct answers to the questions customers ask, written as short complete answers: price from central
  London to each airport, per area and airport, waiting time (60 minutes free after landing), flight
  delays (never charged), child seats (free), cancellation (free up to 24 hours), per-vehicle not
  per-person pricing, returns, extra charges.
- Every price in an answer is computed from the live tariff, so it cannot disagree with a quote.

## 5. Generative engine optimisation (GEO) and AI crawlers

- `/llms.txt`: a plain-text summary of the business (services, airports with starting prices, vehicles,
  policies, contact, page list), built from the site's own configuration.
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) are allowed by the general rule.
- Bing Webmaster Tools set up (imported from Search Console); Bing results feed ChatGPT search and Copilot.

## 6. Keyword and intent map (no volumes claimed)

| Search intent | Page |
| --- | --- |
| airport taxi London, London airport transfers | `/`, `/airport-transfers` |
| Heathrow / Gatwick / Stansted / Luton / London City airport taxi | the five airport pages |
| airport taxi prices, taxi to Heathrow price | `/prices`, airport pages |
| taxi in Croydon, Wembley, Ealing… / taxi from X to the airport | `/taxi/<area>` |
| taxi to hospital, station taxi, local minicab, long-distance taxi | `/taxi` |
| meet and greet airport pickup | `/services/meet-and-greet` |
| corporate airport transfers | `/services/corporate-travel` |
| 8-seater, MPV, executive car | `/fleet` |

## 7. Service and location pages

- New: `/prices`, `/taxi` (any journey: hospital, station, office, shopping, long distance), and twelve
  area pages (Croydon, Wembley, Ealing, Romford, Stratford, Canary Wharf, Wimbledon, Harrow, Kingston,
  Enfield, Bromley, Hounslow). Each area page has its own prices to every airport and to nearby places,
  computed from the tariff; no invented local facts.
- Not made: airport-to-airport pages (those journeys can't be priced online), or pages for every
  borough or town (thin near-duplicates risk being treated as doorway pages).
- Local rides: priced by a new local tariff set from 18 reference-site quotes, at least £2 under each
  (tests hold the quotes).

## 8. Internal linking

- "Plan your trip" links (fleet, Meet & Greet, FAQ, terms) on airport and price pages; "More help"
  links on the FAQ; links between prices and airport pages; nearby-area links on every area page;
  the local taxi page lists every area. Local Taxi is in the Services menu.

## 9. Images and accessibility

- All images have alt text. axe-core (WCAG 2 A/AA): no violations on the new pages at phone, laptop and
  desktop widths; price tables scroll sideways and are keyboard focusable on small screens.

## 10. Performance (live, phone size, 21 October 2026)

| Page | Time to first byte | Largest contentful paint | Layout shift |
| --- | --- | --- | --- |
| Home | 579 ms | 1.1 s | 0 |
| Heathrow | 534 ms | 0.9 s | 0 |
| Croydon | 473 ms | 0.9 s | 0 |
| Prices | 545 ms | 0.9 s | 0 |
| FAQ | 504 ms | 0.9 s | 0.003 |

All inside Google's "good" range (LCP under 2.5 s, CLS under 0.1). Lab measurements: Search Console's
Core Web Vitals report will show real-user figures once there is enough traffic.

## 11. Local SEO

- Done on the site: consistent name, address and phone everywhere, LocalBusiness markup, 24/7 hours,
  area pages.
- To do (owner): Google Business Profile at 4-6 Greatorex Street, London E1 5NF, category "Taxi service",
  hours 24 hours, website link; verify it; add real photos. This matters most for Maps and "near me".

## 12. External authority plan (owner; no fake links or mentions)

1. Ask real customers for Google reviews after each ride (a short link in the confirmation message).
2. List the business on genuine directories with the same name, address and phone: Bing Places,
   Apple Business Connect, Yell, Trustpilot.
3. If licensed by Transport for London, show the operator licence number on the site and in the
   business profile (send it and it will be added).
4. Local partnerships that would link naturally: hotels, offices, venues you already serve.

## 13. Measurement

- Google Search Console: verified (domain), sitemap submitted; indexing requested for key pages.
- Bing Webmaster Tools: imported from Search Console.
- Check weekly: Pages (indexed / not indexed and why), Performance (queries, clicks, positions),
  Core Web Vitals. Expect first data in 1–2 weeks and steadier trends after 4–8 weeks.
- No analytics or tracking scripts added: the privacy policy says none are used; adding Google
  Analytics would need a cookie consent banner first.

## 14. Staged implementation (all merged and live)

1. Content accuracy (PR #20).
2. Schema, `llms.txt` (merged 20 October).
3. Indexing on, Search Console, Bing.
4. Google address search (PR #21), prices page and internal links (PR #23).
5. Local rides, local taxi and area pages (PR #24).
6. Final polish: home description, Kingston title (this change).

## 15. Testing

- 548 automated tests pass (pricing against reference quotes, schema, sitemap, content, booking flow).
- Production builds pass. Live checks: every sitemap page 200 with one h1, canonical, index and valid
  JSON-LD; 0 broken internal links; live quotes for an airport and a local ride; Google address search
  and card payments switched on.
