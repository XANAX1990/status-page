import { cacheLife } from "next/cache";
import { activeMonitors } from "@/config/monitors";
import { connectDB } from "@/lib/db";
import {
  dailyBuckets,
  latencySeries,
  latencyStats,
  overallStatus,
  uptimePct,
  type DayBucket,
  type OverallStatus,
  type Point,
  type SeriesPoint,
} from "@/lib/stats";
import { Check } from "@/models/Check";
import { Incident } from "@/models/Incident";
import { MonitorState } from "@/models/MonitorState";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 90;

// Only ids, names and numbers leave this module: never monitor URLs or headers.
export type MonitorView = {
  id: string;
  name: string;
  bestEffort: boolean;
  state: "up" | "down" | undefined;
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  p95Ms: number | null;
  buckets: DayBucket[];
  series: SeriesPoint[];
};

export type IncidentView = {
  id: string;
  monitorName: string;
  cause: string;
  startedAt: number;
  resolvedAt: number | null;
};

export type StatusData = {
  generatedAt: number;
  overall: OverallStatus;
  lastCheckedAt: number | null;
  monitors: MonitorView[];
  openIncidents: IncidentView[];
  resolvedIncidents: IncidentView[];
};

export async function getStatusData(): Promise<StatusData> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });

  await connectDB();
  const now = Date.now();
  const ids = activeMonitors.map((m) => m.id);
  const names = new Map(activeMonitors.map((m) => [m.id, m.name]));

  const [checks, states, open, resolved] = await Promise.all([
    Check.find({ monitorId: { $in: ids }, at: { $gt: new Date(now - HISTORY_DAYS * DAY) } })
      .select({ _id: 0, monitorId: 1, at: 1, ok: 1, latencyMs: 1 })
      .lean(),
    MonitorState.find({ monitorId: { $in: ids } }).lean(),
    Incident.find({ monitorId: { $in: ids }, resolvedAt: null }).sort({ startedAt: -1 }).lean(),
    Incident.find({ monitorId: { $in: ids }, resolvedAt: { $ne: null } })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const pointsById = new Map<string, Point[]>();
  let lastCheckedAt: number | null = null;
  for (const c of checks) {
    const at = c.at.getTime();
    const list = pointsById.get(c.monitorId) ?? [];
    list.push({ at, ok: c.ok, latencyMs: c.latencyMs ?? undefined });
    pointsById.set(c.monitorId, list);
    if (lastCheckedAt === null || at > lastCheckedAt) lastCheckedAt = at;
  }
  const stateById = new Map(states.map((s) => [s.monitorId, s.state]));

  const monitors: MonitorView[] = activeMonitors.map((m) => {
    const points = pointsById.get(m.id) ?? [];
    return {
      id: m.id,
      name: m.name,
      bestEffort: m.bestEffort ?? false,
      state: stateById.get(m.id),
      uptime24h: uptimePct(points, now, DAY),
      uptime7d: uptimePct(points, now, 7 * DAY),
      uptime30d: uptimePct(points, now, 30 * DAY),
      p95Ms: latencyStats(points.filter((p) => p.at > now - DAY))?.p95 ?? null,
      buckets: dailyBuckets(points, now, HISTORY_DAYS),
      series: latencySeries(points, now),
    };
  });

  const toView = (i: (typeof open)[number]): IncidentView => ({
    id: String(i._id),
    monitorName: names.get(i.monitorId) ?? i.monitorId,
    cause: i.cause ?? "unknown",
    startedAt: i.startedAt.getTime(),
    resolvedAt: i.resolvedAt ? i.resolvedAt.getTime() : null,
  });

  return {
    generatedAt: now,
    overall: overallStatus(monitors.filter((m) => !m.bestEffort).map((m) => m.state)),
    lastCheckedAt,
    monitors,
    openIncidents: open.map(toView),
    resolvedIncidents: resolved.map(toView),
  };
}
