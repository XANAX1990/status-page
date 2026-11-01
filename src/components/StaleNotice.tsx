"use client";

import { useEffect, useState } from "react";
import { staleAge, staleLabel } from "@/lib/stale";

/**
 * A warning strip when no new check has come in for over 30 minutes: the banner below it may be out of date.
 * The server renders it from the moment the page was generated; the browser then uses its own clock, which
 * matters because this page is cached and can be served long after it was built.
 */
export function StaleNotice({ lastCheckedAt, renderedAt }: { lastCheckedAt: number; renderedAt: number }) {
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const age = staleAge(lastCheckedAt, now);
  if (age === null) return null;

  return (
    <p role="status" className="mb-4 rounded-xl border border-partial/40 bg-surface px-4 py-2 text-sm text-partial">
      {staleLabel(age)}
    </p>
  );
}
