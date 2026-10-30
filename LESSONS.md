# Lessons

<!-- Entry format: symptom / root cause / fix / rule -->

## A real tunnel URL ended up in a public repository

- **Symptom:** a security audit found the address of my home n8n (an ngrok tunnel) in `src/config/monitors.ts` and in the config example in `PLAN.md`, in every commit since phase 1, in a public GitHub repo.
- **Root cause:** the plan's example config used the real URL and the code was written straight from it. The rule "monitor URLs never reach the client" was checked at runtime (page source, API responses), but nobody asked what the repository itself exposes: source files and history are public too.
- **Fix:** the address now comes from the `N8N_HEALTH_URL` environment variable (unset means the monitor is skipped, with a build/startup warning). The plan and README use placeholders, and a test fails if a tunnel address appears in the config, README, PLAN or `.env.example`. History was rewritten with `git filter-repo --replace-text` and force-pushed. GitHub kept serving the old commits by hash afterwards, so for a leaked address the real fix is to change the address.
- **Rule:** ห้ามใส่ URL จริงของ infra ลงใน PLAN หรือในตัวอย่างโค้ด ให้ใช้ placeholder เสมอ (never put a real infrastructure URL in a PLAN or in example code; always use a placeholder). Real addresses live in env settings only, and a leaked address is rotated before history is cleaned.
