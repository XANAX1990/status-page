# Status Page

A personal uptime monitor and public status page for the things I run: Mini Jira, my portfolio, my Pomodoro app, and my self-hosted n8n. It checks each service every 5 minutes, records response times, opens and closes incidents automatically, and sends a LINE alert when something goes down or comes back.

> **Status:** in development. See [`PLAN.md`](./PLAN.md) for the roadmap and current progress.
> **Live:** _add the Vercel link after Phase 5_

---

## Why

My n8n instance runs on my own PC behind ngrok, so it goes down every time I shut the computer off, and nothing told me. I wanted one page that shows what's up, what's down, and how fast everything has been, with an alert when it changes.

## Features

| Feature | Status |
|---|---|
| HTTP checks every 5 minutes (status code + timeout) | ⏳ Planned |
| Response time history, p50 / p95 latency | ⏳ Planned |
| Uptime % for 24h / 7d / 30d, 90-day history bars | ⏳ Planned |
| Automatic incidents (down after 2 failed checks in a row, resolved on recovery) | ⏳ Planned |
| LINE alert on down and on recovery | ⏳ Planned |
| Public status page (names only, no internal URLs) | ⏳ Planned |

## Architecture

```
cron-job.org (every 5 min)
      │  GET /api/cron/check   Authorization: Bearer CRON_SECRET
      ▼
Next.js route handler on Vercel
      ├─ check all monitors in parallel (10s timeout each)
      ├─ save one Check per monitor          → MongoDB (TTL 90 days)
      ├─ run the state machine per monitor   → open / resolve Incident
      └─ on state change → LINE push (direct to the Messaging API)

Browser ──► status page (Server Component, revalidated every 60s)
              reads Checks + Incidents → uptime %, latency, history
```

**Why an external cron?** Vercel's free plan only allows cron jobs once a day. cron-job.org is free and can call a URL every 5 minutes.

**Why not alert through n8n?** n8n is one of the things being monitored. If it's down, it can't send the alert that it's down, so alerts go straight to the LINE Messaging API.

## Data model

```ts
Check         { monitorId, at, ok, statusCode?, latencyMs?, error? }   // TTL index: deleted after 90 days
MonitorState  { monitorId (unique), status: "up" | "down", consecutiveFails, lastCheckedAt }
Incident      { monitorId, startedAt, resolvedAt?, cause }
```

Monitors themselves live in `src/config/monitors.ts`, not in the database. Adding a service means adding one object and pushing.

## Design decisions

- **Down means 2 failures in a row.** One timeout is often just a blip. Requiring two consecutive failures stops alert spam while still catching real outages within about 10 minutes.
- **Alert only on state changes.** One message when a service goes down and one when it recovers. This also keeps well under LINE's free push quota.
- **The state machine is a pure function.** `nextState(prev, result)` takes the previous state and one check result and returns the new state plus what happened (`opened` / `resolved` / `none`). It has no I/O, so it's fully unit tested.
- **Old checks expire automatically.** A MongoDB TTL index deletes checks after 90 days, so storage stays small without a cleanup job.
- **No internal URLs on the public page.** The page shows service names only. My ngrok URL stays private.
- **No admin UI, no auth.** The page is read-only and monitors come from a config file, so there's nothing to log in to.

## Getting started

```bash
git clone <repo-url> status-page
cd status-page
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Trigger a check manually:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check
```

### Environment variables

| Name | Description |
|---|---|
| `MONGODB_URI` | Atlas connection string, database name `/status-page` before `?` |
| `CRON_SECRET` | Random string; the cron endpoint rejects requests without it (`openssl rand -hex 32`) |
| `LINE_CHANNEL_TOKEN` | Channel access token of the LINE OA that sends alerts |
| `LINE_USER_ID` | My LINE user ID **for that OA's provider** |

Never commit `.env.local`.

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                  # public status page
│  └─ api/cron/check/route.ts   # called by cron-job.org
├─ config/monitors.ts           # what to check
├─ lib/
│  ├─ db.ts
│  ├─ check.ts                  # run one HTTP check
│  ├─ state.ts                  # nextState() state machine (pure)
│  ├─ stats.ts                  # uptime %, percentiles, daily buckets (pure)
│  └─ line.ts                   # push message
├─ models/                      # Check, MonitorState, Incident
└─ components/                  # StatusBanner, MonitorRow, UptimeBars, LatencyChart, IncidentList
```

## License

MIT
