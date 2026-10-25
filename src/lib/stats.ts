// Pure statistics for the status page. No I/O; timestamps are epoch milliseconds.

export type Point = { at: number; ok: boolean; latencyMs?: number };

export type DayStatus = "up" | "partial" | "down" | "no-data";
export type DayBucket = { date: string; uptimePct: number | null; status: DayStatus };
export type OverallStatus = "operational" | "partial" | "major" | "unknown";
export type SeriesPoint = { t: number; ms: number | null; failed: boolean };

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok is UTC+7 with no DST
const DAY_MS = 24 * 60 * 60 * 1000;

/** A day is "up" at or above this uptime, "down" below DOWN_BELOW, "partial" in between. */
export const UP_AT_LEAST = 99;
export const DOWN_BELOW = 50;

function ratio(points: Point[]): number | null {
  if (points.length === 0) return null;
  return (points.filter((p) => p.ok).length / points.length) * 100;
}

export function uptimePct(points: Point[], now: number, windowMs: number): number | null {
  return ratio(points.filter((p) => p.at > now - windowMs && p.at <= now));
}

/** Nearest-rank percentile; p in (0, 100]. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function latencyStats(points: Point[]): { p50: number; p95: number } | null {
  const ms = points.filter((p) => p.ok && p.latencyMs !== undefined).map((p) => p.latencyMs!);
  const p50 = percentile(ms, 50);
  const p95 = percentile(ms, 95);
  return p50 === null || p95 === null ? null : { p50, p95 };
}

/** "YYYY-MM-DD" of the Asia/Bangkok calendar day containing `at`. */
export function bangkokDay(at: number): string {
  return new Date(at + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

function dayStatus(pct: number | null): DayStatus {
  if (pct === null) return "no-data";
  if (pct >= UP_AT_LEAST) return "up";
  if (pct < DOWN_BELOW) return "down";
  return "partial";
}

/** Last `days` Bangkok days, oldest first, ending with the day containing `now`. */
export function dailyBuckets(points: Point[], now: number, days = 90): DayBucket[] {
  const byDay = new Map<string, Point[]>();
  for (const p of points) {
    const key = bangkokDay(p.at);
    const list = byDay.get(key);
    if (list) list.push(p);
    else byDay.set(key, [p]);
  }
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = bangkokDay(now - i * DAY_MS);
    const pct = ratio(byDay.get(date) ?? []);
    out.push({ date, uptimePct: pct, status: dayStatus(pct) });
  }
  return out;
}

/**
 * Overall banner from each monitor's current state (undefined = never checked).
 * All up -> operational; all down -> major; mixed -> partial.
 */
export function overallStatus(states: Array<"up" | "down" | undefined>): OverallStatus {
  const known = states.filter((s): s is "up" | "down" => s !== undefined);
  if (known.length === 0) return "unknown";
  const down = known.filter((s) => s === "down").length;
  if (down === 0) return "operational";
  return down === known.length ? "major" : "partial";
}

/**
 * Latency over the trailing window in fixed buckets: mean latency of successful
 * checks (null when none), `failed` when the bucket has failures and no success.
 */
export function latencySeries(
  points: Point[],
  now: number,
  windowMs = DAY_MS,
  bucketMs = 15 * 60 * 1000,
): SeriesPoint[] {
  const n = Math.ceil(windowMs / bucketMs);
  const start = now - n * bucketMs;
  const sums = Array.from({ length: n }, () => ({ sum: 0, ok: 0, bad: 0 }));
  for (const p of points) {
    if (p.at <= start || p.at > now) continue;
    const b = sums[Math.min(n - 1, Math.floor((p.at - start) / bucketMs))];
    if (p.ok && p.latencyMs !== undefined) {
      b.sum += p.latencyMs;
      b.ok++;
    } else if (!p.ok) b.bad++;
  }
  return sums.map((b, i) => ({
    t: start + (i + 0.5) * bucketMs,
    ms: b.ok > 0 ? Math.round(b.sum / b.ok) : null,
    failed: b.ok === 0 && b.bad > 0,
  }));
}
