import { afterEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "@/lib/check";

const monitor = { id: "t", name: "T", url: "https://secret.example/health" };

afterEach(() => vi.unstubAllGlobals());

describe("runCheck", () => {
  it("is ok when status is in expectStatus (default 200)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 200 })));
    expect((await runCheck(monitor)).ok).toBe(true);
  });

  it("fails on unexpected status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 503 })));
    const r = await runCheck(monitor);
    expect(r).toMatchObject({ ok: false, statusCode: 503 });
  });

  it("honours expectStatus", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 307 })));
    expect((await runCheck({ ...monitor, expectStatus: [200, 307] })).ok).toBe(true);
  });

  it("returns network errors as results without leaking the URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed https://secret.example/health")));
    const r = await runCheck(monitor);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("secret.example");
  });

  it("labels timeouts", async () => {
    const e = new Error("t");
    e.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(e));
    expect((await runCheck(monitor)).error).toBe("timeout");
  });
});
