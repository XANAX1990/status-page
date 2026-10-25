export const FAIL_THRESHOLD = 2;

export type MonitorStatus = "up" | "down";

export type PrevState = { state: MonitorStatus; consecutiveFails: number } | null;

export type StateEvent = "opened" | "resolved" | "none";

export type NextState = {
  state: MonitorStatus;
  consecutiveFails: number;
  event: StateEvent;
};

export function nextState(prev: PrevState, result: { ok: boolean }): NextState {
  const state = prev?.state ?? "up";
  const fails = prev?.consecutiveFails ?? 0;

  if (state === "up") {
    if (result.ok) return { state: "up", consecutiveFails: 0, event: "none" };
    const next = fails + 1;
    if (next >= FAIL_THRESHOLD) return { state: "down", consecutiveFails: next, event: "opened" };
    return { state: "up", consecutiveFails: next, event: "none" };
  }

  if (result.ok) return { state: "up", consecutiveFails: 0, event: "resolved" };
  return { state: "down", consecutiveFails: fails + 1, event: "none" };
}
