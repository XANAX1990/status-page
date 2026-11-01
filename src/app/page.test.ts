import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusData, StatusResult } from "@/lib/status-data";

const m = vi.hoisted(() => ({ getStatusData: vi.fn() }));
vi.mock("@/lib/status-data", () => ({ getStatusData: m.getStatusData }));

import Home from "./page";

const emptyData = (over: Partial<StatusData> = {}): StatusData => ({
  generatedAt: Date.now(),
  overall: "unknown",
  lastCheckedAt: null,
  monitors: [],
  openIncidents: [],
  resolvedIncidents: [],
  ...over,
});

async function render(result: StatusResult): Promise<string> {
  m.getStatusData.mockResolvedValue(result);
  return renderToStaticMarkup(await Home());
}

beforeEach(() => vi.resetAllMocks());

describe("status page", () => {
  it("shows an error, not 'No checks', when the database can't be read", async () => {
    const html = await render({ ok: false });
    expect(html).toContain("Status data unavailable");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("No checks recorded yet");
    expect(html).not.toContain("No data yet");
    expect(html).not.toMatch(/All systems operational|Partial outage|Major outage/);
  });

  it("explains nothing technical in the error", async () => {
    const html = await render({ ok: false });
    expect(html).not.toMatch(/mongo|auth|cluster|error code|stack|https?:\/\//i);
  });

  it("still says 'No checks recorded yet' when the database answered and really has none", async () => {
    const html = await render({ ok: true, data: emptyData() });
    expect(html).toContain("No checks recorded yet");
    expect(html).not.toContain("Status data unavailable");
  });

  it("shows the normal page, with the last check time, when there is data", async () => {
    const html = await render({ ok: true, data: emptyData({ overall: "operational", lastCheckedAt: Date.now() - 120_000 }) });
    expect(html).toContain("All systems operational");
    expect(html).not.toContain("No checks recorded yet");
    expect(html).not.toContain("Status data unavailable");
  });

  describe("stale data notice", () => {
    const MIN = 60_000;
    const GENERATED = Date.UTC(2026, 10, 1, 12, 0, 0);
    const withLastCheck = (minutesOld: number | null) =>
      render({
        ok: true,
        data: emptyData({
          overall: "operational",
          generatedAt: GENERATED,
          lastCheckedAt: minutesOld === null ? null : GENERATED - minutesOld * MIN,
        }),
      });

    it("shows how old the data is when no check came in for over 30 minutes", async () => {
      const html = await withLastCheck(45);
      expect(html).toContain("ข้อมูลล่าสุดเมื่อ 45 นาทีที่แล้ว");
    });

    it("keeps the rest of the page: the notice warns, it does not replace the banner", async () => {
      const html = await withLastCheck(45);
      expect(html).toContain("All systems operational");
    });

    it("shows nothing extra when the data is fresh", async () => {
      expect(await withLastCheck(5)).not.toContain("ข้อมูลล่าสุดเมื่อ");
      expect(await withLastCheck(30)).not.toContain("ข้อมูลล่าสุดเมื่อ");
    });

    it("does not call it stale when there are no checks at all", async () => {
      const html = await withLastCheck(null);
      expect(html).toContain("No checks recorded yet");
      expect(html).not.toContain("ข้อมูลล่าสุดเมื่อ");
    });

    it("does not show it on the error page either", async () => {
      expect(await render({ ok: false })).not.toContain("ข้อมูลล่าสุดเมื่อ");
    });
  });
});
