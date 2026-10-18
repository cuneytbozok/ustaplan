import type { MetadataRoute } from "next";
import { isSearchVisible, PRIVATE_PATHS, siteUrl } from "@/lib/site-settings";

/** Hidden (default): nothing may be crawled. Visible: only the landing page and the privacy notice. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await isSearchVisible())) return { rules: { userAgent: "*", disallow: "/" } };
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
