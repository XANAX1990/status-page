const PUSH_URL = "https://api.line.me/v2/bot/message/push";

function formatBangkok(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(date);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  if (totalMin < 1) return "<1 min";
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

export function downMessage(name: string, cause: string, at: Date): string {
  return `🔴 ${name} is DOWN\nCause: ${cause}\nSince: ${formatBangkok(at)} (Asia/Bangkok)`;
}

export function recoveredMessage(name: string, downtimeMs: number): string {
  return `🟢 ${name} recovered\nDowntime: ${formatDuration(downtimeMs)}`;
}

/** Never throws: a failed push is logged and swallowed so it cannot fail the cron run. */
export async function pushLine(text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;
  if (!token || !to) {
    console.error("LINE push skipped: credentials not configured");
    return;
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`LINE push failed: HTTP ${res.status}`);
  } catch (err) {
    console.error("LINE push failed:", err instanceof Error ? err.name : "unknown error");
  }
}
