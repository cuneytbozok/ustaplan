import type { MetadataRoute } from "next";
import { isSearchVisible, siteUrl } from "@/lib/site-settings";

/** Only the landing page, and only once the owner made the site visible. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base || !(await isSearchVisible())) return [];
  return [{ url: `${base}/`, changeFrequency: "monthly", priority: 1 }];
}
