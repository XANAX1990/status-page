# Lessons

<!-- Entry format: symptom / root cause / fix / rule -->

## A real tunnel URL ended up in a public repository

- **Symptom:** a security audit found the address of my home n8n (an ngrok tunnel) in `src/config/monitors.ts` and in the config example in `PLAN.md`, in every commit since phase 1, in a public GitHub repo.
- **Root cause:** the plan's example config used the real URL and the code was written straight from it. The rule "monitor URLs never reach the client" was checked at runtime (page source, API responses), but nobody asked what the repository itself exposes: source files and history are public too.
- **Fix:** the address now comes from the `N8N_HEALTH_URL` environment variable (unset means the monitor is skipped, with a build/startup warning). The plan and README use placeholders, and a test fails if a tunnel address appears in the config, README, PLAN or `.env.example`. History was rewritten with `git filter-repo --replace-text` and force-pushed. GitHub kept serving the old commits by hash afterwards, so for a leaked address the real fix is to change the address.
- **Rule:** ห้ามใส่ URL จริงของ infra ลงใน PLAN หรือในตัวอย่างโค้ด ให้ใช้ placeholder เสมอ (never put a real infrastructure URL in a PLAN or in example code; always use a placeholder). Real addresses live in env settings only, and a leaked address is rotated before history is cleaned.

## The cron route answered 200 for two days while nothing was saved

- **Symptom:** the public page showed "No checks recorded yet" for every service and the LINE alert for n8n never came. cron-job.org showed every run as successful, so nobody knew.
- **Root cause:** the route ran the monitors with `Promise.allSettled` and turned each rejected one (a failed `Check.create`, for example) into an `{ ok: false, error: "internal error" }` entry inside a normal 200 response. The scheduler only looks at the status code, so a run that saved nothing looked like a success. The page had the matching blind spot: an empty result and a failed read were not told apart.
- **Fix:** the route answers 500 with a body that says nothing but `Internal error` when the database is unreachable or any check fails to save (the other monitors are still checked and saved first). The reason goes to the host's logs as the error's class name and code only. `getStatusData` now catches its own failure and returns `{ ok: false }`, which the page renders as "Status data unavailable"; because it is a returned value it is cached like any other result and retried within the 60 s revalidate.
- **Rule:** an endpoint a scheduler calls must report failure through its status code. `Promise.allSettled` is for not letting one failure stop the others, not for hiding it: inspect the results before answering. And a page must show "could not load" differently from "nothing there".

## Changing the database user broke everything that still held the old one

- **Symptom:** both dev servers (Mini Jira and Status Page) showed `MongoServerError: bad auth : authentication failed`. At the same time the cron route kept answering 200 while saving nothing, and the public page showed "No checks recorded yet" instead of its data.
- **Root cause:** the Atlas database user was replaced, but the old credentials lived in several places that were not all updated together: each project's `.env.local`, each project's Vercel environment variables, and the cron-job.org job. The Mini Jira and Status Page files even held different credentials, so there was no single value to change. Each place failed on its own and, until the cron route and the page were fixed, quietly.
- **Fix:** the new user was put into every place that used the old one and the cron job was connected again. The route now answers 500 when a check can't be saved, the page shows an error panel when it can't read, and it warns when the newest check is over 30 minutes old (see the entry above).
- **Rule:** changing a database user or password is a checklist, not one edit. Update `.env.local` and the Vercel variables of **every** project on that cluster (Mini Jira and Status Page), then the cron job; delete or change the old user last. Then check each one: both dev servers start without `bad auth`, a cron run answers 200 and the page's "Last checked" is a few minutes old, and Mini Jira's production login works (its "Operational" on the status page only proves `/login` answers, not that its database does).
