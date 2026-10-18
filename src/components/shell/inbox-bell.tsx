import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentArtisan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Header bell with the unread inbox count (plan §9). Re-renders on every refresh. */
export async function InboxBell() {
  await getCurrentArtisan();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("in_inbox", true)
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <Link
      href="/bildirimler"
      aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
      className="relative flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-ink hover:bg-muted"
    >
      <Bell className="size-5" aria-hidden />
      {unread ? (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
