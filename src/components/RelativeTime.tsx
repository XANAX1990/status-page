"use client";

import { useEffect, useState } from "react";

function relative(ts: number, now: number): string {
  const min = Math.max(0, Math.floor((now - ts) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Server renders the absolute fallback; the browser swaps in "X min ago" and keeps it fresh. */
export function RelativeTime({ ts, fallback }: { ts: number; fallback: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return <time dateTime={new Date(ts).toISOString()}>{now === null ? fallback : relative(ts, now)}</time>;
}
