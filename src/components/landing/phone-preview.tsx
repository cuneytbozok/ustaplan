import { Bell, CalendarDays, ClipboardList, Plus, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const VISITS = [
  { time: "09:30", title: "Kombi bakımı", who: "Ayşe H. · Kadıköy", status: "Planlandı", tone: "primary" },
  { time: "13:00", title: "Banyo bataryası değişimi", who: "Mehmet K. · Ataşehir", status: "Parça bekleniyor", tone: "warning" },
  { time: "16:30", title: "Mutfak dolabı montajı", who: "Elif S. · Üsküdar", status: "Devam ediyor", tone: "primary" },
] as const;

/**
 * Illustration of the Bugün screen, drawn with the app's own tokens (no
 * screenshot, no real data). Decorative: hidden from assistive tech, the
 * text around it says the same thing.
 */
export function PhonePreview() {
  return (
    <div aria-hidden className="mx-auto w-[17rem] rounded-[2.25rem] border border-border bg-surface p-2.5">
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-background px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">U</span>
            <span className="text-sm font-bold text-ink">UstaPlan</span>
          </div>
          <span className="relative flex size-7 items-center justify-center rounded-lg border border-border bg-surface text-ink">
            <Bell className="size-3.5" />
            <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">2</span>
          </span>
        </div>

        <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
          <p className="text-base font-bold text-ink">Bugün</p>
          <p className="-mt-1.5 text-[11px] text-muted-foreground">3 randevu · 2 iş takip bekliyor</p>
          {VISITS.map((visit) => (
            <div key={visit.time} className="rounded-xl border border-border bg-surface p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink tabular-nums">{visit.time}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    visit.tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary-soft text-primary",
                  )}
                >
                  {visit.status}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-ink">{visit.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{visit.who}</p>
            </div>
          ))}
          <div className="flex items-center justify-end">
            <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
              <Plus className="size-3" /> Yeni iş
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 border-t border-border bg-surface py-1.5 text-[9px] font-semibold">
          {[
            { label: "Bugün", icon: Sun, active: true },
            { label: "Takvim", icon: CalendarDays },
            { label: "İşler", icon: ClipboardList },
            { label: "Müşteriler", icon: Users },
          ].map(({ label, icon: Icon, active }) => (
            <span key={label} className={cn("flex flex-col items-center gap-0.5", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-3.5" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
