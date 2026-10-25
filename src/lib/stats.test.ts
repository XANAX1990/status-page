import { describe, expect, it } from "vitest";
import {
  bangkokDay,
  dailyBuckets,
  latencySeries,
  latencyStats,
  overallStatus,
  percentile,
  uptimePct,
  type Point,
} from "@/lib/stats";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 9, 25, 5, 0); // 12:00 in Bangkok

const pt = (agoMs: number, ok = true, latencyMs?: number): Point => ({
  at: now - agoMs,
  ok,
  latencyMs: latencyMs ?? (ok ? 100 : undefined),
});

describe("uptimePct", () => {
  it("returns null with no data in the window", () => {
    expect(uptimePct([], now, DAY)).toBeNull();
    expect(uptimePct([pt(2 * DAY)], now, DAY)).toBeNull();
  });
  it("computes the share of ok checks inside the window only", () => {
    const pts = [pt(MIN), pt(2 * MIN), pt(3 * MIN, false), pt(4 * MIN), pt(2 * DAY, false)];
    expect(uptimePct(pts, now, DAY)).toBe(75);
  });
});

describe("percentile / latencyStats", () => {
  it("uses nearest rank", () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 95)).toBe(100);
    expect(percentile([], 50)).toBeNull();
  });
  it("ignores failed checks", () => {
    const pts = [pt(MIN, true, 100), pt(2 * MIN, true, 300), pt(3 * MIN, false, 5000)];
    expect(latencyStats(pts)).toEqual({ p50: 100, p95: 300 });
    expect(latencyStats([pt(MIN, false)])).toBeNull();
  });
});

describe("bangkokDay", () => {
  it("rolls over at 17:00 UTC", () => {
    expect(bangkokDay(Date.UTC(2026, 9, 24, 16, 59))).toBe("2026-10-24");
    expect(bangkokDay(Date.UTC(2026, 9, 24, 17, 0))).toBe("2026-10-25");
  });
});

describe("dailyBuckets", () => {
  it("returns `days` buckets ending today, oldest first", () => {
    const b = dailyBuckets([], now, 90);
    expect(b).toHaveLength(90);
    expect(b[89].date).toBe("2026-10-25");
    expect(b[0].date).toBe("2026-07-28");
    expect(b.every((d) => d.status === "no-data" && d.uptimePct === null)).toBe(true);
  });
  it("classifies up / partial / down and groups by Bangkok day", () => {
    const today = Array.from({ length: 100 }, (_, i) => pt(i * MIN)); // all ok, today
    const yesterday = Array.from({ length: 10 }, (_, i) => pt(DAY + i * MIN, i < 8)); // 80%
    const dayBefore = [pt(2 * DAY, false), pt(2 * DAY + MIN, false)]; // 0%
    const b = dailyBuckets([...today, ...yesterday, ...dayBefore], now, 3);
    expect(b.map((d) => d.status)).toEqual(["down", "partial", "up"]);
    expect(b[1].uptimePct).toBe(80);
  });
  it("treats one failure in 288 checks (99.65%) as up", () => {
    const pts = Array.from({ length: 288 }, (_, i) => pt(i * MIN, i !== 5));
    expect(dailyBuckets(pts, now, 1)[0].status).toBe("up");
  });
});

describe("overallStatus", () => {
  it("maps current states to the banner", () => {
    expect(overallStatus(["up", "up"])).toBe("operational");
    expect(overallStatus(["up", "down"])).toBe("partial");
    expect(overallStatus(["down", "down"])).toBe("major");
    expect(overallStatus([undefined])).toBe("unknown");
    expect(overallStatus(["up", undefined])).toBe("operational");
  });
});

describe("latencySeries", () => {
  it("buckets by time, averages ok latency, flags all-failed buckets", () => {
    const s = latencySeries([pt(MIN, true, 100), pt(2 * MIN, true, 200), pt(20 * MIN, false)], now);
    expect(s).toHaveLength(96);
    expect(s[95]).toMatchObject({ ms: 150, failed: false });
    expect(s[94]).toMatchObject({ ms: null, failed: true });
    expect(s[0]).toMatchObject({ ms: null, failed: false });
  });
});
