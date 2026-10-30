export type Monitor = {
  id: string; // stable: used as the DB key
  name: string; // shown on the page
  url: string; // never sent to the client
  expectStatus?: number[]; // default [200]; e.g. [200, 307] for a redirecting home page
  headers?: Record<string, string>;
  bestEffort?: boolean; // still checked and alerted on, but excluded from the overall banner
};

export const monitors: Monitor[] = [
  { id: "mini-jira", name: "Mini Jira", url: "https://mini-jira-tan.vercel.app/login" },
  { id: "portfolio", name: "Portfolio", url: "https://portfolio-xanax.vercel.app/" },
  { id: "pomodoro", name: "Pomodoro", url: "https://pomodoro-webapp-870c6.web.app/" },
  {
    id: "n8n",
    name: "n8n (self-hosted)",
    // The address of my PC's tunnel must stay out of this (public) repo: it comes from the host's
    // env settings. Unset behaves like a "TODO" placeholder, so the monitor is skipped everywhere.
    url: process.env.N8N_HEALTH_URL?.trim() || "TODO",
    headers: { "ngrok-skip-browser-warning": "true" },
    bestEffort: true,
  },
];

/** Monitors with a real URL; placeholders (url "TODO") are kept in the config but skipped everywhere. */
export const activeMonitors = monitors.filter((m) => m.url !== "TODO");

if (process.env.NODE_ENV === "production" && !activeMonitors.some((m) => m.id === "n8n")) {
  // Without this, forgetting the env var on the host would silently stop the n8n checks.
  console.warn("N8N_HEALTH_URL is not set: the n8n monitor is skipped");
}
