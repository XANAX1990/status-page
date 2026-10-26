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
    url: "https://your-ngrok-domain.example/healthz",
    headers: { "ngrok-skip-browser-warning": "true" },
    bestEffort: true,
  },
];

/** Monitors with a real URL; placeholders (url "TODO") are kept in the config but skipped everywhere. */
export const activeMonitors = monitors.filter((m) => m.url !== "TODO");
