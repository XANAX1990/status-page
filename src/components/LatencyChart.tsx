import type { SeriesPoint } from "@/lib/stats";

const W = 300;
const H = 64;
const PAD_TOP = 4;
const PAD_BOTTOM = 8; // room for the failed-check ticks

export function LatencyChart({ series, name }: { series: SeriesPoint[]; name: string }) {
  const values = series.map((p) => p.ms).filter((v): v is number => v !== null);
  const failed = series.filter((p) => p.failed).length;

  if (values.length === 0 && failed === 0) {
    return <p className="text-xs text-muted">No checks in the last 24 hours.</p>;
  }

  const max = Math.max(1, ...values);
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (ms: number) => PAD_TOP + (1 - ms / max) * (H - PAD_TOP - PAD_BOTTOM);

  // Split into runs so gaps (no successful check) break the line.
  const runs: string[][] = [[]];
  series.forEach((p, i) => {
    if (p.ms === null) {
      if (runs[runs.length - 1].length) runs.push([]);
    } else {
      runs[runs.length - 1].push(`${x(i).toFixed(1)},${y(p.ms).toFixed(1)}`);
    }
  });


  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label={`${name}: response time over the last 24 hours, peak ${max} ms${
          failed ? `, ${failed} intervals with failed checks` : ""
        }`}
        preserveAspectRatio="none"
      >
        <line x1="0" x2={W} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {runs.map((pts, i) =>
          pts.length > 1 ? (
            <polyline
              key={i}
              points={pts.join(" ")}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : pts.length === 1 ? (
            <circle key={i} cx={pts[0].split(",")[0]} cy={pts[0].split(",")[1]} r="1.5" className="fill-accent" />
          ) : null,
        )}
        {series.map((p, i) =>
          p.failed ? (
            <rect
              key={p.t}
              x={Math.max(0, x(i) - 1.5)}
              y={H - PAD_BOTTOM + 2}
              width="3"
              height="6"
              rx="1"
              className="fill-down"
            />
          ) : null,
        )}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>24h ago</span>
        <span>{values.length ? `peak ${max} ms` : ""}{failed ? ` · ${failed} failed` : ""}</span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}
