import type { Metadata } from "next";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { InboxList, MarkAllReadButton, type InboxItem } from "@/components/notifications/inbox-list";
import { notificationTarget } from "@/lib/push/target";
import { renderNotification } from "@/lib/push/render";
import { requestStatusLabel } from "@/lib/domain/request-outcome";
import { formatShortDate, formatTime } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bildirimler" };

export default function NotificationsPage() {
  return (
    <>
      {/* Back (to wherever the bell was tapped; Bugün without in-app history) sits on the title row. */}
      <Suspense
        fallback={
          <>
            <PageHeader backHref="/bugun" title="Bildirimler" />
            <ListSkeleton rows={5} />
          </>
        }
      >
        <Inbox />
      </Suspense>
    </>
  );
}

/** In-app inbox (plan §9, spec §2): newest first, read individually or all at once. */
async function Inbox() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, category, job_id, request_id, payload, read_at, created_at")
    .eq("in_inbox", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const requestStatus = await loadRequestStatus(supabase, data.flatMap((n) => (n.category === "reschedule_requested" && n.request_id ? [n.request_id] : [])));

  const items: InboxItem[] = data.map((n) => ({
    id: n.id,
    category: n.category,
    href: n.job_id ? notificationTarget(n, n.id).url : null,
    status: n.category === "reschedule_requested" && n.request_id ? (requestStatus.get(n.request_id) ?? null) : null,
    ...renderNotification(n.category, n.payload),
    when: `${formatShortDate(n.created_at)} ${formatTime(n.created_at)}`,
    unread: n.read_at === null,
  }));
  const unread = items.filter((i) => i.unread).length;

  return (
    <>
      <PageHeader backHref="/bugun" title="Bildirimler" subtitle={unread ? `${unread} okunmamış` : items.length ? "Hepsi okundu" : undefined} />
      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Henüz bildirim yok"
          description="Müşterin işi iptal ettiğinde, yeni tarih istediğinde ya da fotoğraf eklediğinde burada görürsün."
        />
      ) : (
        <>
          {unread ? <MarkAllReadButton /> : null}
          <InboxList items={items} />
        </>
      )}
    </>
  );
}

/** Where each date request stands now, as a short label ("Geri çekildi"…); RLS scopes the rows. */
async function loadRequestStatus(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const labels = new Map<string, string>();
  if (!ids.length) return labels;
  const { data: requests, error } = await supabase.from("appointment_requests").select("id, status, appointment_id, created_at").in("id", ids);
  if (error) throw new Error(error.message);
  const { data: siblings, error: siblingsError } = await supabase
    .from("appointment_requests")
    .select("appointment_id, created_at")
    .in("appointment_id", [...new Set(requests.map((r) => r.appointment_id))]);
  if (siblingsError) throw new Error(siblingsError.message);
  for (const r of requests) {
    const replaced = siblings.some((other) => other.appointment_id === r.appointment_id && other.created_at > r.created_at);
    const label = requestStatusLabel(r.status, replaced);
    if (label) labels.set(r.id, label);
  }
  return labels;
}
