// Shared by the push sender (lib/push.ts) and the inbox, so a tap and an
// inbox row always lead to the same place.

/**
 * Where a notification leads and which earlier one it replaces on the phone.
 * Date-request notifications open the job with `?talep=<request>` so the job
 * page can say what happened to that request since (withdrawn, replaced,
 * answered, closed). A withdrawal reuses the request's tag, so it replaces the
 * "yeni tarih istedi" notification instead of stacking under it.
 */
export function notificationTarget(row: { job_id: string | null; request_id: string | null; category: string }, dedupeKey: string) {
  const url = !row.job_id ? "/bildirimler" : row.request_id ? `/isler/${row.job_id}?talep=${row.request_id}` : `/isler/${row.job_id}`;
  const tag = row.category === "request_withdrawn" && row.request_id ? `request:${row.request_id}` : dedupeKey;
  return { url, tag };
}
