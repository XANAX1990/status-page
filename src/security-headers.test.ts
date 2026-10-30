import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

async function headersOf(source: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === source);
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

describe("security headers (SECURITY.md)", () => {
  it("every path gets all five headers with the agreed values", async () => {
    expect(await headersOf("/:path*")).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("the policy only forbids framing: a script policy could break Next's inline scripts", async () => {
    const csp = (await headersOf("/:path*"))["Content-Security-Policy"];
    expect(csp).not.toMatch(/script-src|default-src|style-src/);
  });

  it("the original build options are still there", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.partialPrefetching).toBe(true);
    expect(nextConfig.turbopack?.rules).toBeDefined();
  });
});
