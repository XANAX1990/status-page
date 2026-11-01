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
