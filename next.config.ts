import type { NextConfig } from "next";

/**
 * Sent with every response. Deliberately no Content-Security-Policy yet: Next's
 * inline scripts need nonces for one, and getting it wrong blanks the site.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // HTTPS only from now on; subdomains are left out in case any still serve plain HTTP.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The app's service worker: always fetched fresh, so updates reach installed apps straight away.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  // One address for search engines: www. goes to the bare domain.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.galaxyairporttaxi.co.uk" }],
        destination: "https://galaxyairporttaxi.co.uk/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
