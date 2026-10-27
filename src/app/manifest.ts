import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/** Installs the website as an app. The app loads the live site, so it always matches it. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: site.name,
    short_name: "Galaxy Taxi",
    description: "Fixed-price airport transfers and local rides across London and the UK. Book in a few taps, 24/7.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#071226",
    theme_color: "#071226",
    categories: ["travel", "navigation"],
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Get a quote", url: "/quote", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Local taxi", url: "/taxi", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
