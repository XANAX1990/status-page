import type { Monitor } from "@/config/monitors";

export type CheckResult = {
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
};

const TIMEOUT_MS = 10_000;

// Error text can embed the target URL, so only coarse, URL-free labels are kept.
function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    const code = (err.cause as { code?: unknown } | undefined)?.code;
    if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  }
  return "network error";
}

export async function runCheck(monitor: Monitor): Promise<CheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(monitor.url, {
      method: "GET",
      headers: monitor.headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - start);
    // Drop the body without downloading it.
    void res.body?.cancel().catch(() => {});
    const expected = monitor.expectStatus ?? [200];
    return { ok: expected.includes(res.status), statusCode: res.status, latencyMs };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}
