import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, staleAge, staleLabel } from "@/lib/stale";

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const ago = (ms: number) => NOW - ms;

describe("staleAge", () => {
  it("is 30 minutes", () => {
    expect(STALE_AFTER_MS).toBe(30 * MIN);
  });

  it("is null for fresh data", () => {
    expect(staleAge(ago(0), NOW)).toBeNull();
    expect(staleAge(ago(5 * MIN), NOW)).toBeNull();
    expect(staleAge(ago(29 * MIN), NOW)).toBeNull();
  });

  it("is not stale at exactly 30 minutes, and is stale one millisecond later", () => {
    expect(staleAge(ago(30 * MIN), NOW)).toBeNull();
    expect(staleAge(ago(30 * MIN + 1), NOW)).toBe(30 * MIN + 1);
  });

  it("returns the age once past the limit", () => {
    expect(staleAge(ago(45 * MIN), NOW)).toBe(45 * MIN);
    expect(staleAge(ago(2 * 24 * 60 * MIN), NOW)).toBe(2 * 24 * 60 * MIN);
  });

  it("is null when there are no checks at all: that is a different message", () => {
    expect(staleAge(null, NOW)).toBeNull();
  });

  it("is never stale for a timestamp in the future (clock skew)", () => {
    expect(staleAge(NOW + 5 * MIN, NOW)).toBeNull();
    expect(staleAge(NOW + 24 * 60 * MIN, NOW)).toBeNull();
  });
});

describe("staleLabel", () => {
  it("says the minutes just past the limit", () => {
    expect(staleLabel(30 * MIN + 1)).toBe("ข้อมูลล่าสุดเมื่อ 30 นาทีที่แล้ว");
    expect(staleLabel(45 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 45 นาทีที่แล้ว");
  });

  it("rounds down, so 59 minutes 59 seconds is still 59 minutes", () => {
    expect(staleLabel(59 * MIN + 59_000)).toBe("ข้อมูลล่าสุดเมื่อ 59 นาทีที่แล้ว");
  });

  it("switches to hours at 60 minutes", () => {
    expect(staleLabel(60 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 1 ชั่วโมงที่แล้ว");
    expect(staleLabel(5 * 60 * MIN + 59 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 5 ชั่วโมงที่แล้ว");
    expect(staleLabel(23 * 60 * MIN + 59 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 23 ชั่วโมงที่แล้ว");
  });

  it("switches to days at 24 hours", () => {
    expect(staleLabel(24 * 60 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 1 วันที่แล้ว");
    expect(staleLabel(2 * 24 * 60 * MIN + 3 * 60 * MIN)).toBe("ข้อมูลล่าสุดเมื่อ 2 วันที่แล้ว");
  });

  it("always has a whole, positive amount", () => {
    for (const minutes of [30, 31, 59, 60, 61, 1439, 1440, 2880, 100_000]) {
      const label = staleLabel(minutes * MIN + 1);
      expect(label).toMatch(/^ข้อมูลล่าสุดเมื่อ [1-9][0-9]* (นาที|ชั่วโมง|วัน)ที่แล้ว$/);
    }
  });
});
