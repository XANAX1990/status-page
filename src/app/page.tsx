import { LatencyChart } from "@/components/LatencyChart";
import { RelativeTime } from "@/components/RelativeTime";
import { UptimeBars, UptimeLegend } from "@/components/UptimeBars";
import { formatDuration } from "@/lib/line";
import { getStatusData, type IncidentView, type MonitorView } from "@/lib/status-data";
import type { OverallStatus } from "@/lib/stats";

const BANNER: Record<OverallStatus, { text: string; dot: string; ring: string }> = {
  operational: { text: "All systems operational", dot: "bg-up", ring: "border-up/40" },
  partial: { text: "Partial outage", dot: "bg-partial", ring: "border-partial/40" },
  major: { text: "Major outage", dot: "bg-down", ring: "border-down/40" },
  unknown: { text: "No data yet", dot: "bg-border", ring: "border-border" },
};

function bangkok(ts: number): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(ts)} (Bangkok)`;
}

const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(v === 100 ? 0 : 2)}%`);

function StatusPill({ state, bestEffort }: { state: MonitorView["state"]; bestEffort: boolean }) {
  const map = {
    up: { label: "Operational", dot: "bg-up" },
    down: { label: "Down", dot: "bg-down" },
    // Best-effort services that are down show a neutral note, not a red Down.
    note: { label: "Runs on my home PC", dot: "bg-muted" },
    none: { label: "No data", dot: "bg-border" },
  } as const;
  const s = map[state === "down" && bestEffort ? "note" : (state ?? "none")];
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={`inline-block size-2.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function MonitorCard({ m }: { m: MonitorView }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 min-w-0 truncate text-base font-medium">{m.name}</h3>
        <StatusPill state={m.state} bestEffort={m.bestEffort} />
      </div>
      <dl className="m-0 mt-3 grid grid-cols-4 gap-2">
        <Stat label="24h" value={pct(m.uptime24h)} />
        <Stat label="7d" value={pct(m.uptime7d)} />
        <Stat label="30d" value={pct(m.uptime30d)} />
        <Stat label="p95" value={m.p95Ms === null ? "–" : `${m.p95Ms} ms`} />
      </dl>
      <div className="mt-4">
        <UptimeBars buckets={m.buckets} name={m.name} />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </li>
  );
}

function IncidentRow({ i }: { i: IncidentView }) {
  const ongoing = i.resolvedAt === null;
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 text-base font-medium">{i.monitorName}</h3>
        <span className={`text-sm ${ongoing ? "text-down" : "text-muted"}`}>
          {ongoing ? "Ongoing" : `Resolved · down ${formatDuration(i.resolvedAt! - i.startedAt)}`}
        </span>
      </div>
      <p className="m-0 mt-1 text-sm text-muted">
        {i.cause} · started {bangkok(i.startedAt)}
      </p>
    </li>
  );
}

export default async function Home() {
  const data = await getStatusData();
  const banner = BANNER[data.overall];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Status</h1>
        <p className="m-0 mt-1 text-sm text-muted">
          {data.lastCheckedAt === null ? (
            "No checks recorded yet"
          ) : (
            <>
              Last checked{" "}
              <RelativeTime ts={data.lastCheckedAt} fallback={bangkok(data.lastCheckedAt)} />
            </>
          )}
        </p>
      </header>

      <div
        role="status"
        className={`mb-8 flex items-center gap-3 rounded-xl border bg-surface p-4 ${banner.ring}`}
      >
        <span className={`inline-block size-3 shrink-0 rounded-full ${banner.dot}`} aria-hidden />
        <p className="m-0 text-lg font-medium">{banner.text}</p>
      </div>

      <section aria-labelledby="services" className="mb-10">
        <h2 id="services" className="mb-3 mt-0 text-lg font-semibold">
          Services
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.monitors.map((m) => (
            <MonitorCard key={m.id} m={m} />
          ))}
        </ul>
        <div className="mt-3">
          <UptimeLegend />
        </div>
      </section>

      <section aria-labelledby="latency" className="mb-10">
        <h2 id="latency" className="mb-3 mt-0 text-lg font-semibold">
          Response time · last 24 hours
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {data.monitors.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-surface p-4">
              <h3 className="m-0 mb-2 text-sm font-medium">{m.name}</h3>
              <LatencyChart series={m.series} name={m.name} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Red ticks mark 15-minute intervals where every check failed.</p>
      </section>

      <section aria-labelledby="incidents">
        <h2 id="incidents" className="mb-3 mt-0 text-lg font-semibold">
          Incidents
        </h2>
        {data.openIncidents.length + data.resolvedIncidents.length === 0 ? (
          <p className="m-0 text-sm text-muted">No incidents recorded.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {[...data.openIncidents, ...data.resolvedIncidents].map((i) => (
              <IncidentRow key={i.id} i={i} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
