export type Monitor = {
  id: string; // stable: used as the DB key
  name: string; // shown on the page
  url: string; // never sent to the client
  expectStatus?: number[]; // default [200]; e.g. [200, 307] for a redirecting home page
  headers?: Record<string, string>;
};

export const monitors: Monitor[] = [
  { id: "mini-jira", name: "Mini Jira", url: "https://mini-jira-tan.vercel.app/login" },
  { id: "portfolio", name: "Portfolio", url: "TODO" },
  { id: "pomodoro", name: "Pomodoro", url: "TODO" },
  {
    id: "n8n",
    name: "n8n (self-hosted)",
    url: "https://your-ngrok-domain.example/healthz",
    headers: { "ngrok-skip-browser-warning": "true" },
  },
];
