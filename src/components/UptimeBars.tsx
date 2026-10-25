import type { DayBucket, DayStatus } from "@/lib/stats";

const FILL: Record<DayStatus, string> = {
  up: "bg-up",
  partial: "bg-partial",
  down: "bg-down",
  "no-data": "bg-border",
};

const LABEL: Record<DayStatus, string> = {
  up: "Operational",
  partial: "Partial outage",
  down: "Major outage",
  "no-data": "No data",
};

function tooltip(b: DayBucket): string {
  const pct = b.uptimePct === null ? "" : ` · ${b.uptimePct.toFixed(2)}% uptime`;
  return `${b.date} · ${LABEL[b.status]}${pct}`;
}

export function UptimeBars({ buckets, name }: { buckets: DayBucket[]; name: string }) {
  return (
    <div
      role="img"
      aria-label={`${name}: daily status for the last ${buckets.length} days`}
      className="flex h-8 w-full items-stretch gap-px"
    >
      {buckets.map((b) => (
        <span
          key={b.date}
          title={tooltip(b)}
          className={`min-w-0 flex-1 rounded-[1px] ${FILL[b.status]}`}
        />
      ))}
    </div>
  );
}

export function UptimeLegend() {
  const items: DayStatus[] = ["up", "partial", "down", "no-data"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-[2px] ${FILL[s]}`} aria-hidden />
          {LABEL[s]}
        </li>
      ))}
    </ul>
  );
}
