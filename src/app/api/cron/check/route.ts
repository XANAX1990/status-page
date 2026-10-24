import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { monitors } from "@/config/monitors";
import { connectDB } from "@/lib/db";
import { runCheck, type CheckResult } from "@/lib/check";
import { Check } from "@/models/Check";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  // Hash both sides so the compare is constant-time regardless of length.
  return timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  await connection(); // always request-time: never prerendered or cached

  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const at = new Date();

  const settled = await Promise.allSettled(
    monitors.map(async (monitor) => {
      const result = await runCheck(monitor);
      await Check.create({ monitorId: monitor.id, at, ...result });
      return result;
    }),
  );

  const results = settled.map((s, i) => {
    const base = { id: monitors[i].id };
    if (s.status === "fulfilled") {
      const r: CheckResult = s.value;
      return { ...base, ...r };
    }
    console.error(`check failed for ${base.id}`);
    return { ...base, ok: false, error: "internal error" };
  });

  return Response.json({ at, results }, { headers: { "Cache-Control": "no-store" } });
}
