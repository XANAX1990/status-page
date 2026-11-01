import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  connectDB: vi.fn(),
  runCheck: vi.fn(),
  checkCreate: vi.fn(),
  stateFindOne: vi.fn(),
  stateUpdate: vi.fn(),
  incidentExists: vi.fn(),
  incidentCreate: vi.fn(),
  incidentFindOneAndUpdate: vi.fn(),
  pushLine: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/config/monitors", () => ({
  activeMonitors: [
    { id: "alpha", name: "Alpha", url: "https://alpha.invalid/health" },
    { id: "beta", name: "Beta", url: "https://beta.invalid/health" },
  ],
}));
vi.mock("@/lib/db", () => ({ connectDB: m.connectDB }));
vi.mock("@/lib/check", () => ({ runCheck: m.runCheck }));
vi.mock("@/lib/line", () => ({ pushLine: m.pushLine, downMessage: () => "down", recoveredMessage: () => "up" }));
vi.mock("@/models/Check", () => ({ Check: { create: m.checkCreate } }));
vi.mock("@/models/MonitorState", () => ({
  MonitorState: { findOne: () => ({ lean: m.stateFindOne }), updateOne: m.stateUpdate },
}));
vi.mock("@/models/Incident", () => ({
  Incident: { exists: m.incidentExists, create: m.incidentCreate, findOneAndUpdate: m.incidentFindOneAndUpdate },
}));

import { GET } from "./route";

const SECRET = "test-cron-secret";
const authorized = () =>
  new Request("http://localhost/api/cron/check", { headers: { authorization: `Bearer ${SECRET}` } });

// The kind of error the driver throws: its message must never reach the response or the logs.
const leaky = Object.assign(new Error("not authorized on status-page: svc:hunter2@cluster.invalid"), {
  name: "MongoServerError",
  code: 13,
});

let logged: string;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  m.connectDB.mockResolvedValue(undefined);
  m.runCheck.mockResolvedValue({ ok: true, statusCode: 200, latencyMs: 12 });
  m.checkCreate.mockResolvedValue(undefined);
  m.stateFindOne.mockResolvedValue(null);
  m.stateUpdate.mockResolvedValue(undefined);
  m.pushLine.mockResolvedValue(undefined);
  logged = "";
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged += args.map(String).join(" ") + "\n";
  });
});

describe("GET /api/cron/check: authorization", () => {
  it("rejects a missing or wrong secret with 401 and touches nothing", async () => {
    const none = await GET(new Request("http://localhost/api/cron/check"));
    const wrong = await GET(new Request("http://localhost/api/cron/check", { headers: { authorization: "Bearer nope" } }));
    expect([none.status, wrong.status]).toEqual([401, 401]);
    expect(m.connectDB).not.toHaveBeenCalled();
    expect(m.checkCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/check: when every check is saved", () => {
  it("answers 200 with one result per monitor and no URLs", async () => {
    const res = await GET(authorized());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(["alpha", "beta"]);
    expect(m.checkCreate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(body)).not.toMatch(/invalid|https?:/);
  });
});

describe("GET /api/cron/check: when a check cannot be saved", () => {
  it("answers 500, so the scheduler sees a failure", async () => {
    m.checkCreate.mockRejectedValue(leaky);
    const res = await GET(authorized());
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("says nothing about why: no error text, host, monitor or result in the body", async () => {
    m.checkCreate.mockRejectedValue(leaky);
    const text = await (await GET(authorized())).text();
    expect(JSON.parse(text)).toEqual({ error: "Internal error" });
    expect(text).not.toMatch(/mongodb|hunter2|cluster|authorized|alpha|beta|13/i);
  });

  it("still checks and saves the other monitors when one fails to save", async () => {
    m.checkCreate.mockImplementation(async (doc: { monitorId: string }) => {
      if (doc.monitorId === "alpha") throw leaky;
    });
    const res = await GET(authorized());
    expect(res.status).toBe(500);
    expect(m.runCheck).toHaveBeenCalledTimes(2);
    expect(m.checkCreate).toHaveBeenCalledTimes(2);
    expect(m.stateUpdate).toHaveBeenCalledTimes(1); // beta went all the way through
    expect(m.stateUpdate.mock.calls[0][0]).toEqual({ monitorId: "beta" });
  });

  it("answers 500 when every monitor fails to save", async () => {
    m.checkCreate.mockRejectedValue(leaky);
    expect((await GET(authorized())).status).toBe(500);
    expect(m.checkCreate).toHaveBeenCalledTimes(2);
  });

  it("answers 500 when the monitor state cannot be saved either", async () => {
    m.stateUpdate.mockRejectedValue(leaky);
    expect((await GET(authorized())).status).toBe(500);
  });

  it("logs which monitor and what kind of error, never the error message", async () => {
    m.checkCreate.mockRejectedValue(leaky);
    await GET(authorized());
    expect(logged).toContain("alpha");
    expect(logged).toContain("beta");
    expect(logged).toContain("MongoServerError 13");
    expect(logged).not.toMatch(/mongodb|hunter2|cluster\.invalid|not authorized/);
  });
});

describe("GET /api/cron/check: when the database is unreachable", () => {
  it("answers 500 with the same empty body, and runs no checks", async () => {
    m.connectDB.mockRejectedValue(Object.assign(new Error("bad auth : authentication failed"), { name: "MongoServerError", code: 18 }));
    const res = await GET(authorized());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
    expect(m.runCheck).not.toHaveBeenCalled();
    expect(logged).toContain("MongoServerError 18");
    expect(logged).not.toMatch(/bad auth|authentication failed/);
  });
});
