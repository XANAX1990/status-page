import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("@/config/monitors");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("n8n monitor address comes from the environment", () => {
  it("is skipped when N8N_HEALTH_URL is not set", async () => {
    vi.stubEnv("N8N_HEALTH_URL", "");
    const { activeMonitors, monitors } = await loadConfig();
    expect(monitors.find((m) => m.id === "n8n")?.url).toBe("TODO");
    expect(activeMonitors.map((m) => m.id)).not.toContain("n8n");
  });

  it("is skipped when the variable is only whitespace", async () => {
    vi.stubEnv("N8N_HEALTH_URL", "   ");
    const { activeMonitors } = await loadConfig();
    expect(activeMonitors.map((m) => m.id)).not.toContain("n8n");
  });

  it("is checked, as a best-effort monitor, when the variable is set", async () => {
    vi.stubEnv("N8N_HEALTH_URL", " https://n8n.example.test/healthz ");
    const { activeMonitors } = await loadConfig();
    const n8n = activeMonitors.find((m) => m.id === "n8n");
    expect(n8n?.url).toBe("https://n8n.example.test/healthz");
    expect(n8n?.bestEffort).toBe(true);
  });

  it("keeps the other monitors regardless", async () => {
    vi.stubEnv("N8N_HEALTH_URL", "");
    const { activeMonitors } = await loadConfig();
    expect(activeMonitors.map((m) => m.id)).toEqual(["mini-jira", "portfolio", "pomodoro"]);
  });
});

describe("the repository is public: no tunnel address in tracked files", () => {
  const files = ["src/config/monitors.ts", "README.md", "PLAN.md", ".env.example"];
  for (const file of files) {
    it(`${file} has no ngrok address`, () => {
      const text = readFileSync(path.resolve(__dirname, "../..", file), "utf8");
      expect(text).not.toMatch(/[a-z0-9-]+\.ngrok[a-z.-]*\.(dev|io|app|com)/i);
    });
  }
});
