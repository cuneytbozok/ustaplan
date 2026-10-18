import type { Metadata } from "next";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { InboxList, MarkAllReadButton, type InboxItem } from "@/components/notifications/inbox-list";
import { renderNotification } from "@/lib/push/render";
import { formatShortDate, formatTime } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bildirimler" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Inbox />
    </Suspense>
  );
}

/** In-app inbox (plan §9, spec §2): newest first, read individually or all at once. */
async function Inbox() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, category, job_id, payload, read_at, created_at")
    .eq("in_inbox", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const items: InboxItem[] = data.map((n) => ({
    id: n.id,
    category: n.category,
    jobId: n.job_id,
    ...renderNotification(n.category, n.payload),
    when: `${formatShortDate(n.created_at)} ${formatTime(n.created_at)}`,
    unread: n.read_at === null,
  }));
  const unread = items.filter((i) => i.unread).length;

  return (
    <>
      <PageHeader title="Bildirimler" subtitle={unread ? `${unread} okunmamış` : "Hepsi okundu"} />
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
