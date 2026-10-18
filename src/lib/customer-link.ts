import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appEnv, shareLinkEnv } from "@/lib/env";
import { createShareToken, parseShareToken, verifySignature } from "@/lib/share-link";
import { toCustomerJobView, type CustomerJobView } from "@/lib/public-job";
import { hasNotEnded } from "@/lib/domain/time";

/** The full customer URL for a job's current version. Never hard-codes the domain. */
export function shareUrl(jobId: string, version: number) {
  return `${appEnv().baseUrl}/t/${createShareToken(shareLinkEnv().secret, jobId, version)}`;
}

/**
 * Every customer request starts here (plan §5): parse → load share_enabled and
 * share_version → recompute → timingSafeEqual. Malformed, unknown, disabled and
 * rotated links all return null, so callers answer them identically.
 */
export async function verifyCustomerToken(token: string) {
  const parsed = parseShareToken(token);
  if (!parsed) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("jobs")
    .select("id, owner_user_id, share_enabled, share_version")
    .eq("id", parsed.jobId)
    .maybeSingle();
  if (error) throw new Error("job lookup failed");
  if (!data || !data.share_enabled) return null;
  if (!verifySignature(shareLinkEnv().secret, data.id, data.share_version, parsed.signature)) return null;
  return { admin, jobId: data.id, ownerId: data.owner_user_id, shareVersion: data.share_version };
}

/** Loads the allowlisted CustomerJobView for a verified link (admin client, explicit columns only). */
export async function loadCustomerJob(token: string): Promise<CustomerJobView | null> {
  const verified = await verifyCustomerToken(token);
  if (!verified) return null;
  const { admin, jobId, ownerId } = verified;

  const [job, profile, appointments, media, requests] = await Promise.all([
    admin.from("jobs").select("title, status, agreed_price, show_price_to_customer").eq("id", jobId).single(),
    admin.from("profiles").select("display_name, business_name, contact_phone").eq("id", ownerId).single(),
    admin.from("appointments").select("id, starts_at, ends_at").eq("job_id", jobId).eq("status", "scheduled"),
    admin
      .from("job_media")
      .select("id, kind, origin, visibility")
      .eq("job_id", jobId)
      .eq("kind", "image")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100),
    admin
      .from("appointment_requests")
      .select("id, appointment_id, status, requested_starts_at, counter_starts_at, counter_ends_at, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (job.error || profile.error || appointments.error || media.error || requests.error) throw new Error("customer view load failed");

  return toCustomerJobView({
    token,
    profile: profile.data,
    job: job.data,
    upcoming: appointments.data.filter((a) => hasNotEnded(a.ends_at)),
    media: media.data,
    requests: requests.data,
  });
}
