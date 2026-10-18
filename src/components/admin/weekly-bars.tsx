import { formatShortDate } from "@/lib/domain/time";

/**
 * Single-series weekly column chart (dataviz: ≤ 24 px columns, 4 px rounded
 * tops on one baseline, hairline grid, value on the latest column, hover/focus
 * tooltip per column, table view). No chart library.
 */
export function WeeklyBars({ title, unit, points }: { title: string; unit: string; points: { weekStart: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const top = niceCeil(max);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const last = points.at(-1);

  return (
    <figure className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-base font-semibold text-ink">{title}</span>
        <span className="text-sm text-muted-foreground">
          {TREND_LABEL}: {total.toLocaleString("tr-TR")} {unit}
        </span>
      </figcaption>

      {/* Top margin: room for the value label when the latest column reaches the top tick. */}
      <div className="mt-3 flex gap-2">
        <div className="relative h-40 w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
          <span className="absolute top-0 right-0 -translate-y-1/2">{top.toLocaleString("tr-TR")}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-border" aria-hidden />
          <ol className="relative flex h-40 items-end gap-0.5 border-b border-border" aria-label={`${title}, haftalık`}>
            {points.map((point, index) => {
              const label = `${formatShortDate(point.weekStart)} haftası: ${point.value.toLocaleString("tr-TR")} ${unit}`;
              const height = point.value === 0 ? 0 : Math.max(2, (point.value / top) * 100);
              const isLast = index === points.length - 1;
              return (
                <li key={point.weekStart} className="group relative flex h-full flex-1 items-end justify-center">
                  {/* Hit target: the whole column slot, wider and taller than the mark. */}
                  <span tabIndex={0} aria-label={label} className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                  <span className="pointer-events-none w-full max-w-6 rounded-t-[4px] bg-primary group-hover:bg-primary/80" style={{ height: `${height}%` }} />
                  {isLast && point.value > 0 ? (
                    <span className="pointer-events-none absolute text-xs font-semibold text-ink tabular-nums group-hover:invisible" style={{ bottom: `calc(${height}% + 2px)` }}>
                      {point.value.toLocaleString("tr-TR")}
                    </span>
                  ) : null}
                  <span
                    role="tooltip"
                    className={`pointer-events-none invisible absolute z-10 ${index < 3 ? "left-0" : index >= points.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"} rounded-lg border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink shadow-sm group-focus-within:visible group-hover:visible`}
                    style={{ bottom: `calc(${height}% + 6px)` }}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden>
            <span>{points[0] ? formatShortDate(points[0].weekStart) : ""}</span>
            <span>{last ? `${formatShortDate(last.weekStart)} (bu hafta)` : ""}</span>
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer py-1 font-medium text-muted-foreground hover:text-ink">Tablo olarak göster</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">Hafta</th>
              <th className="py-1 text-right font-medium">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.weekStart} className="border-t border-border">
                <td className="py-1 text-ink">{formatShortDate(point.weekStart)}</td>
                <td className="py-1 text-right text-ink tabular-nums">{point.value.toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

const TREND_LABEL = "12 haftada";

/** 1, 2, 5 × 10^n at or above the max, so the top tick is a clean number. */
function niceCeil(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}
