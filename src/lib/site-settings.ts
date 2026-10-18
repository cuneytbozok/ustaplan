import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { appEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Site-wide settings (plan L-2), stored in public.app_settings and changed
 * only from the admin panel. Read through a tagged cache so the landing page,
 * robots.txt and sitemap.xml stay static; the admin action expires the tag.
 */
export const SITE_SETTINGS_TAG = "site-settings";

async function readVisibility() {
  const { data, error } = await createAdminClient()
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "search_visibility")
    .maybeSingle();
  if (error) throw new Error(`Could not read site settings: ${error.message}`);
  return { visible: (data?.value as { visible?: unknown } | null)?.visible === true, updatedAt: data?.updated_at ?? null };
}

/** Whether search engines may index the landing page. Hidden unless the owner opened it, and on any error. */
export async function isSearchVisible(): Promise<boolean> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("hours");
  try {
    return (await readVisibility()).visible;
  } catch {
    return false;
  }
}

/** Uncached, for the admin panel (shows the stored value and when it changed). */
export async function getSearchVisibilitySetting() {
  return readVisibility();
}

/** Canonical origin for SEO links; null when APP_BASE_URL isn't configured (e.g. a local build without env). */
export function siteUrl() {
  try {
    return appEnv().baseUrl;
  } catch {
    return null;
  }
}

/** Paths that are never meant for search engines (robots.txt). */
export const PRIVATE_PATHS = ["/admin", "/api/", "/t/", "/giris", "/bugun", "/takvim", "/isler", "/musteriler", "/ayarlar", "/bildirimler"];
