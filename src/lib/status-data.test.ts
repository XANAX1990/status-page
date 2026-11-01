import { beforeEach, describe, expect, it, vi } from "vitest";

interface Chain {
  select: () => Chain;
  sort: () => Chain;
  limit: () => Chain;
  lean: () => Promise<unknown[]>;
}
function chain(rows: unknown[] | Error): Chain {
  const c: Chain = {
    select: () => c,
    sort: () => c,
    limit: () => c,
    lean: async () => {
      if (rows instanceof Error) throw rows;
      return rows;
    },
  };
  return c;
}

const m = vi.hoisted(() => ({
  connectDB: vi.fn(),
  checkFind: vi.fn(),
  stateFind: vi.fn(),
  incidentFind: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/config/monitors", () => ({
  activeMonitors: [
    { id: "alpha", name: "Alpha", url: "https://alpha.invalid" },
    { id: "beta", name: "Beta", url: "https://beta.invalid" },
  ],
}));
vi.mock("@/lib/db", () => ({ connectDB: m.connectDB }));
vi.mock("@/models/Check", () => ({ Check: { find: m.checkFind } }));
vi.mock("@/models/MonitorState", () => ({ MonitorState: { find: m.stateFind } }));
vi.mock("@/models/Incident", () => ({ Incident: { find: m.incidentFind } }));

import { getStatusData } from "@/lib/status-data";

const leaky = Object.assign(new Error("bad auth : svc:hunter2@cluster.invalid"), {
  name: "MongoServerError",
  code: 18,
});

let logged: string;

beforeEach(() => {
  vi.resetAllMocks();
  m.connectDB.mockResolvedValue(undefined);
  m.checkFind.mockImplementation(() => chain([]));
  m.stateFind.mockImplementation(() => chain([]));
  m.incidentFind.mockImplementation(() => chain([]));
  logged = "";
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged += args.map(String).join(" ") + "\n";
  });
});

describe("getStatusData", () => {
  it("returns the data when the database answers, even if there are no checks", async () => {
    const result = await getStatusData();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lastCheckedAt).toBeNull(); // genuinely no checks: a different case from an error
      expect(result.data.monitors.map((x) => x.id)).toEqual(["alpha", "beta"]);
    }
  });

  it("reports the latest check time when there are checks", async () => {
    const at = new Date(Date.now() - 5 * 60_000);
    m.checkFind.mockImplementation(() => chain([{ monitorId: "alpha", at, ok: true, latencyMs: 40 }]));
    const result = await getStatusData();
    expect(result.ok && result.data.lastCheckedAt).toBe(at.getTime());
  });

  it("returns ok: false, not an empty result, when the connection fails", async () => {
    m.connectDB.mockRejectedValue(leaky);
    expect(await getStatusData()).toEqual({ ok: false });
    expect(m.checkFind).not.toHaveBeenCalled();
  });

  it("returns ok: false when a query fails after connecting", async () => {
    m.checkFind.mockImplementation(() => chain(leaky));
    expect(await getStatusData()).toEqual({ ok: false });
  });

  it("returns ok: false when reading incidents fails", async () => {
    m.incidentFind.mockImplementation(() => chain(leaky));
    expect(await getStatusData()).toEqual({ ok: false });
  });

  it("logs the kind of error, never its message, and returns nothing about it", async () => {
    m.connectDB.mockRejectedValue(leaky);
    const result = await getStatusData();
    expect(logged).toContain("MongoServerError 18");
    expect(logged).not.toMatch(/mongodb|hunter2|cluster\.invalid|bad auth/);
    expect(JSON.stringify(result)).not.toMatch(/mongodb|hunter2|bad auth/);
  });
});
