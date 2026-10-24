# Status Page: Implementation Plan

## Working agreement (for Claude Code)

- Do **one phase at a time**. Stop at the end of each phase, show what to verify, and wait for "ok" before the next one.
- **Commit after each phase** (`feat(phase-N): ...`).
- This is **Next.js 16**. Read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, caching/revalidation, or anything touching Cache Components. Don't rely on memory of older versions.
- Run these checks at the end of every phase, and the phase isn't done until all pass:
  `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build`
- **Scope is fixed.** No admin UI, no auth, no user accounts, no TCP/ping checks, no multi-region, no email/SMS, no queues. If something seems needed, ask first.
- Pure logic (`state.ts`, `stats.ts`) has **no I/O** and is covered by Vitest.
- Never log or expose secrets or monitor URLs in the UI or in error messages returned to the client.
- When a bug takes more than one try to fix, add an entry to `LESSONS.md` (symptom / root cause / fix / rule).

## Monitor config shape

```ts
// src/config/monitors.ts
export type Monitor = {
  id: string;              // "mini-jira" (stable: used as the DB key)
  name: string;            // shown on the page
  url: string;             // never sent to the client
  expectStatus?: number[]; // default [200]; e.g. [200, 307] for a redirecting home page
  headers?: Record<string, string>;
};

export const monitors: Monitor[] = [
  { id: "mini-jira", name: "Mini Jira", url: "https://mini-jira-tan.vercel.app/login" },
  { id: "portfolio", name: "Portfolio", url: "TODO" },
  { id: "pomodoro",  name: "Pomodoro",  url: "TODO" },
  { id: "n8n",       name: "n8n (self-hosted)",
    url: "https://your-ngrok-domain.example/healthz",
    headers: { "ngrok-skip-browser-warning": "true" } },
];
```

---

## Phase 1: Scaffold + models

- [ ] `create-next-app` (TypeScript, Tailwind, App Router, ESLint, `src/`), add Mongoose, Zod, Vitest
- [ ] `src/lib/db.ts`: cached Mongoose connection on `globalThis` (same pattern as Mini Jira), throws if `MONGODB_URI` is missing
- [ ] Models: `Check` (TTL index on `at`, 30 days; index `{ monitorId, at }`), `MonitorState` (unique `monitorId`), `Incident` (index `{ monitorId, startedAt }`)
- [ ] `src/config/monitors.ts` as above
- [ ] `.env.example` with the 4 variable names (no values)
- [ ] `CLAUDE.md` (`@AGENTS.md`, `@PLAN.md`, LESSONS rule) + empty `LESSONS.md`

**Verify:** dev server starts; models compile; `.env.local` is in `.gitignore`.

## Phase 2: Checker + cron endpoint

- [ ] `src/lib/check.ts`: `runCheck(monitor)` does `fetch` with `AbortSignal.timeout(10_000)`, `redirect: "manual"`, `cache: "no-store"`; measures latency; returns `{ ok, statusCode?, latencyMs?, error? }`. `ok` = status in `expectStatus`. Network errors/timeouts are results, not thrown.
- [ ] `GET /api/cron/check`: reject without `Authorization: Bearer ${CRON_SECRET}` (401, constant-time compare); run all monitors with `Promise.allSettled`; insert one `Check` each; return a summary **without URLs**
- [ ] Make sure the route is never cached or prerendered

**Verify:** `curl` with the secret → 4 checks saved in Atlas; without it → 401; a monitor pointed at a bad URL is saved as `ok: false`, not a crash.

## Phase 3: State machine + incidents + LINE alerts

- [ ] `src/lib/state.ts`: `nextState(prev, result) → { state, event: "opened" | "resolved" | "none" }`
  - up + success → up, fails reset to 0
  - up + failure → fails + 1; at 2 → **down**, event `opened`
  - down + failure → still down, no event
  - down + success → **up**, event `resolved`
  - no previous state → treat as up with 0 fails
- [ ] Vitest: every transition above, plus "one blip doesn't open an incident"
- [ ] Wire into the cron route: load/save `MonitorState`; on `opened` create `Incident` (cause = status code or error); on `resolved` set `resolvedAt`
- [ ] `src/lib/line.ts`: push to `LINE_USER_ID`. Messages:
  - `🔴 <name> is DOWN` + cause + time (Asia/Bangkok)
  - `🟢 <name> recovered` + downtime duration
- [ ] A failed LINE push is logged and does not fail the cron run

**Verify:** tests pass; stop n8n → after 2 cron runs exactly one 🔴 message and one open incident; start n8n → one 🟢 message, incident resolved.

## Phase 4: Stats + status page

- [ ] `src/lib/stats.ts` (pure, tested): uptime % over a window, p50/p95 latency, daily buckets for the last 90 days (`up` / `partial` / `down` / `no-data`), all in Asia/Bangkok days
- [ ] Page (Server Component, revalidated every 60 s using the Next 16 way, check the docs):
  - **Banner:** "All systems operational" / "Partial outage" / "Major outage"
  - **Per monitor:** name, current status dot, uptime 24h / 7d / 30d, p95 latency, 90-day bars (tooltip with date + uptime %)
  - **Latency chart:** last 24h per monitor (small line chart)
  - **Incidents:** open first, then last 10 resolved with duration
  - "Last checked X min ago"
- [ ] Nothing on the page includes a monitor URL
- [ ] Works at 360px; dark theme matching the portfolio

**Verify:** stats tests pass; page shows real data; view-source contains no ngrok or other monitor URLs.

## Phase 5: Deploy + schedule

- [ ] Push to GitHub, import into Vercel (preset **Next.js**), set env vars (Production), deploy
- [ ] Fill in the `TODO` URLs in `monitors.ts`
- [ ] cron-job.org: new job → `https://<domain>/api/cron/check`, every 5 minutes, header `Authorization: Bearer <CRON_SECRET>`; confirm successful runs in its history
- [ ] Rename the Vercel domain to something short (Settings → Domains)

**Verify:** after an hour the page has ~12 checks per monitor; shutting down the PC produces a 🔴 for n8n on LINE.

## Phase 6: Polish + portfolio

- [ ] README: live link, screenshot, tick the feature table
- [ ] Add "Status Page" to the portfolio's `src/data/projects.ts` (problem / solution / highlights / lessons)
- [ ] Optional: link "Status" from the portfolio footer

**Verify:** README renders on GitHub; portfolio shows the new project.

---

## What the human has to do (prepare ahead)

| When | What |
|---|---|
| Phase 1 | Copy the Mini Jira Atlas URI and change the DB name to `/status-page` |
| Phase 1 | Generate `CRON_SECRET` (`openssl rand -hex 32`, or any long random string) |
| Phase 3 | Reuse the "Mini Jira Alerts" OA token + my user ID for that provider (or make a new OA) |
| Phase 5 | Vercel env vars, cron-job.org account, Pomodoro + portfolio URLs |
