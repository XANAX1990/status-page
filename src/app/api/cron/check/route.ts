import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { activeMonitors as monitors, type Monitor } from "@/config/monitors";
import { connectDB } from "@/lib/db";
import { runCheck, type CheckResult } from "@/lib/check";
import { downMessage, pushLine, recoveredMessage } from "@/lib/line";
import { nextState } from "@/lib/state";
import { Check } from "@/models/Check";
import { Incident } from "@/models/Incident";
import { MonitorState } from "@/models/MonitorState";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  // Hash both sides so the compare is constant-time regardless of length.
  return timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}

function causeOf(result: CheckResult): string {
  if (result.statusCode !== undefined) return `HTTP ${result.statusCode}`;
  return result.error ?? "unknown";
}

async function checkAndTrack(monitor: Monitor, at: Date): Promise<CheckResult> {
  const result = await runCheck(monitor);
  await Check.create({ monitorId: monitor.id, at, ...result });

  const prev = await MonitorState.findOne({ monitorId: monitor.id }).lean();
  const next = nextState(prev, result);
  await MonitorState.updateOne(
    { monitorId: monitor.id },
    { $set: { state: next.state, consecutiveFails: next.consecutiveFails, lastCheckedAt: at } },
    { upsert: true },
  );

  if (next.event === "opened") {
    const open = await Incident.exists({ monitorId: monitor.id, resolvedAt: null });
    if (!open) {
      await Incident.create({ monitorId: monitor.id, startedAt: at, cause: causeOf(result) });
      await pushLine(downMessage(monitor.name, causeOf(result), at));
    }
  } else if (next.event === "resolved") {
    const incident = await Incident.findOneAndUpdate(
      { monitorId: monitor.id, resolvedAt: null },
      { $set: { resolvedAt: at } },
      { sort: { startedAt: -1 } },
    );
    const downtimeMs = incident ? at.getTime() - incident.startedAt.getTime() : 0;
    await pushLine(recoveredMessage(monitor.name, downtimeMs));
  }

  return result;
}

export async function GET(request: Request) {
  await connection(); // always request-time: never prerendered or cached

  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const at = new Date();

  const settled = await Promise.allSettled(monitors.map((m) => checkAndTrack(m, at)));

  const results = settled.map((s, i) => {
    const base = { id: monitors[i].id };
    if (s.status === "fulfilled") return { ...base, ...s.value };
    console.error(`check failed for ${base.id}`);
    return { ...base, ok: false, error: "internal error" };
  });

  return Response.json({ at, results }, { headers: { "Cache-Control": "no-store" } });
}
