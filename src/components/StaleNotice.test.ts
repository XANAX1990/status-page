import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaleNotice } from "@/components/StaleNotice";

const MIN = 60_000;
const RENDERED_AT = Date.UTC(2026, 10, 1, 12, 0, 0);

const html = (minutesOld: number) =>
  renderToStaticMarkup(createElement(StaleNotice, { lastCheckedAt: RENDERED_AT - minutesOld * MIN, renderedAt: RENDERED_AT }));

describe("StaleNotice (server render)", () => {
  it("shows the age when the newest check is over 30 minutes old", () => {
    const out = html(45);
    expect(out).toContain("ข้อมูลล่าสุดเมื่อ 45 นาทีที่แล้ว");
    expect(out).toContain('role="status"');
  });

  it("shows nothing for fresh data, at 30 minutes exactly, or right after a check", () => {
    expect(html(0)).toBe("");
    expect(html(10)).toBe("");
    expect(html(30)).toBe("");
  });

  it("shows hours and days for older data", () => {
    expect(html(3 * 60 + 10)).toContain("3 ชั่วโมง");
    expect(html(2 * 24 * 60 + 5)).toContain("2 วัน");
  });
});
