// "Is the data old?" Pure: no clock, no I/O. Timestamps are epoch milliseconds.

/** The cron runs every 5 minutes, so 30 minutes without a new check means about six missed runs. */
export const STALE_AFTER_MS = 30 * 60_000;

const MINUTE = 60_000;

/**
 * How old the newest check is, but only when that is past the limit; otherwise null.
 * Exactly 30 minutes is not stale yet. No checks at all is a different case (the page says so itself),
 * and a timestamp in the future (clock skew) is never stale.
 */
export function staleAge(lastCheckedAt: number | null, now: number): number | null {
  if (lastCheckedAt === null) return null;
  const age = now - lastCheckedAt;
  return age > STALE_AFTER_MS ? age : null;
}

/** "ข้อมูลล่าสุดเมื่อ 45 นาทีที่แล้ว". Minutes up to an hour, then hours, then days, rounded down. */
export function staleLabel(ageMs: number): string {
  const minutes = Math.floor(ageMs / MINUTE);
  let amount: string;
  if (minutes < 60) amount = `${minutes} นาที`;
  else if (minutes < 24 * 60) amount = `${Math.floor(minutes / 60)} ชั่วโมง`;
  else amount = `${Math.floor(minutes / (24 * 60))} วัน`;
  return `ข้อมูลล่าสุดเมื่อ ${amount}ที่แล้ว`;
}
