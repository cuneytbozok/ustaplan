"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarClock, ChevronRight, ImagePlus, NotebookPen, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { cn } from "@/lib/utils";

export type InboxItem = {
  id: string;
  category: string;
  /** Where tapping leads (the job, with ?talep= for date requests); null = nowhere to go. */
  href: string | null;
  /** Where a date request stands now ("Geri çekildi"…), when it no longer waits for the artisan. */
  status: string | null;
  title: string;
  body: string;
  when: string;
  unread: boolean;
};

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  customer_cancelled: { icon: XCircle, tone: "bg-danger/10 text-danger" },
  reschedule_requested: { icon: CalendarClock, tone: "bg-warning/12 text-warning" },
  counter_accepted: { icon: CalendarCheck, tone: "bg-primary-soft text-primary" },
  request_withdrawn: { icon: Undo2, tone: "bg-muted text-muted-foreground" },
  customer_photo_added: { icon: ImagePlus, tone: "bg-primary-soft text-primary" },
  customer_note: { icon: NotebookPen, tone: "bg-primary-soft text-primary" },
};

/** One inbox row: opening it marks it read and goes to the job. */
function Row({ item }: { item: InboxItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { icon: Icon, tone } = ICONS[item.category] ?? { icon: CalendarClock, tone: "bg-muted text-muted-foreground" };

  function open() {
    setError(null);
    startTransition(async () => {
      if (item.unread) {
        const result = await markNotificationRead(item.id);
        if (!result.ok) return setError(result.error);
      }
      if (item.href) router.push(item.href);
    });
  }

  return (
    <li>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border p-4 text-left hover:bg-muted disabled:opacity-70",
          item.unread ? "border-primary/30 bg-surface" : "border-border bg-surface/60",
        )}
      >
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-base break-words text-ink", item.unread ? "font-semibold" : "font-medium")}>{item.title}</span>
          {item.body ? <span className="block text-sm break-words text-muted-foreground">{item.body}</span> : null}
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {item.unread ? <span className="size-2 rounded-full bg-primary" aria-hidden /> : null}
            {item.unread ? "Yeni · " : ""}
            {item.when}
          </span>
          {item.status ? (
            <span className="mt-1.5 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-ink">{item.status}</span>
          ) : null}
        </span>
        {item.href ? <ChevronRight className="mt-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </button>
      {error ? (
        <p role="alert" className="mt-1 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function InboxList({ items }: { items: InboxItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </ul>
  );
}

export function MarkAllReadButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markAllNotificationsRead();
            setError(result.ok ? null : result.error);
          })
        }
        className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Tümünü okundu işaretle"}
      </button>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
