# Security: Status Page

Security rules and audit checklist for the Status Page (Next.js 16 on Vercel, MongoDB Atlas, cron-job.org, LINE push alerts). Claude Code: follow these rules while writing code, and follow **Audit procedure** at the bottom when asked to "run the security audit".

## What we protect

| Asset | Where it lives | Why it matters |
|---|---|---|
| Monitor URLs (incl. my ngrok URL) | `src/config/monitors.ts`, server only | The ngrok URL leads to my PC's n8n |
| `CRON_SECRET` | Vercel env, cron-job.org | Anyone with it can trigger checks and alerts |
| LINE channel access token + my user ID | Vercel env | Send messages as my bot |
| `MONGODB_URI` | Vercel env | Database access |

## Entry points

1. `GET /api/cron/check` (public URL, protected by `CRON_SECRET`)
2. The public status page
3. Responses from the monitored services (status codes, errors)

## Project rules

- [ ] The cron endpoint requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time; missing or wrong → 401 with no details.
- [ ] The cron route is never cached or prerendered.
- [ ] **Monitor URLs never reach the client**: not in props, not in HTML, not in JSON responses, not in error messages. Check by viewing page source and searching for `ngrok` / `http`.
- [ ] Monitors come only from the config file, never from user input (so the checker can't be turned into an SSRF tool).
- [ ] Checks use a timeout and `redirect: "manual"`; response bodies are not stored.
- [ ] The public page is read-only: no forms, no write endpoints.
- [ ] Security headers in `next.config` on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` (plus `X-Frame-Options: DENY`), `Permissions-Policy`. Covered by `src/security-headers.test.ts`.
- [ ] Alerts are sent only on state changes (no spam) and contain the service name, not the URL.
- [ ] The DB user can only read/write the `status-page` database.
- [ ] A failed LINE push is logged without the token.

### Files that must never be tracked
`.env`, `.env.local`, `.vercel/`.

## Rules that apply to every project

### Secrets
- [ ] No secret in source code, tests, fixtures, docs, screenshots or commit messages. Secrets come from `.env` / the host's env settings (Vercel, Firebase) / n8n credentials.
- [ ] `.env*` files (except `.env.example`) are in `.gitignore`; `.env.example` lists names only, no values.
- [ ] Different secrets for dev and prod.
- [ ] If a secret was ever committed: **rotate it first**, then clean history. Deleting the file is not enough.

### Private data
- [ ] Logs never contain secrets, tokens, full emails or other personal data.
- [ ] Error messages sent to a browser or chat don't include stack traces, file paths, internal URLs or DB details.
- [ ] Images committed to the repo (README screenshots, assets) are checked for personal data and have EXIF stripped.

### Dependencies
- [ ] Versions locked (`package-lock.json` / pinned `requirements.txt`).
- [ ] `npm audit --omit=dev` / `pip-audit` show no high or critical issues, or each one is noted with why it doesn't apply.
- [ ] No packages added "just in case"; unused packages removed.

### Least privilege
- [ ] Every key, token and DB user has only the access this project needs (one database, read/write only where needed, narrowest OAuth scopes).

---

## Audit procedure (for Claude Code)

Run this when I say "run the security audit", before making a repo public, and before a big deploy.

1. List every tracked file with `git ls-files` and check **each one** against the rules in this file. Also check untracked files that aren't ignored: `git status --porcelain`.
2. Search for secrets in the current tree **and in history**:
   ```bash
   git grep -nIiE "(secret|token|password|passwd|api[_-]?key|bearer|mongodb(\+srv)?://)"
   git grep -nIE "[A-Za-z0-9+/_-]{60,}={0,2}"     # long tokens
   git grep -nIE "\b[0-9a-f]{32}\b"               # 32-hex secrets
   git log -p --all | grep -nIiE "(secret|token|password|bearer|mongodb(\+srv)?://)"
   ```
3. Check `.gitignore` against the private files listed for this project; confirm none of them is tracked.
4. Read every place that handles untrusted input (listed under **Entry points**) and check it against the project rules.
5. Run the dependency audit (`npm audit --omit=dev` and/or `pip-audit`).
6. **Report first, don't fix yet.** Output one table:

   | File | Line | Rule broken | Severity (High / Medium / Low) | Suggested fix |
   |---|---|---|---|---|

   Then a short list of rules that passed. Wait for my "ok" before changing anything. Fix High items first, one commit per fix.
7. If a real secret is found in the tree or history, **stop** and tell me which one, so I can rotate it before anything else.
