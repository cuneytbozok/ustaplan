import type { MetadataRoute } from "next";

// Installed-app definition. scope "/" keeps every artisan page inside the
// home-screen app (iOS otherwise opens other pages in an in-app browser).
// Service worker, offline page and install guide come in M5.5.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UstaPlan",
    short_name: "UstaPlan",
    description: "Ustalar için iş, randevu ve müşteri takibi.",
    lang: "tr",
    start_url: "/bugun",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#19745A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
