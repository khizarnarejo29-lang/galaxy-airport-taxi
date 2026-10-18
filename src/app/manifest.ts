import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Galaxy Taxi",
    description: "London airport transfers with fixed prices agreed before you book.",
    start_url: "/",
    display: "standalone",
    background_color: "#071226",
    theme_color: "#071226",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
