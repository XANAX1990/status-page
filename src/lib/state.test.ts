import { describe, expect, it } from "vitest";
import { nextState, type PrevState } from "@/lib/state";

const ok = { ok: true };
const fail = { ok: false };
const up = (n = 0): PrevState => ({ state: "up", consecutiveFails: n });
const down = (n = 2): PrevState => ({ state: "down", consecutiveFails: n });

describe("nextState", () => {
  it("up + success stays up and resets fails", () => {
    expect(nextState(up(1), ok)).toEqual({ state: "up", consecutiveFails: 0, event: "none" });
  });

  it("up + first failure counts but does not open", () => {
    expect(nextState(up(0), fail)).toEqual({ state: "up", consecutiveFails: 1, event: "none" });
  });

  it("up + second failure goes down and opens", () => {
    expect(nextState(up(1), fail)).toEqual({ state: "down", consecutiveFails: 2, event: "opened" });
  });

  it("down + failure stays down with no event", () => {
    expect(nextState(down(2), fail)).toEqual({ state: "down", consecutiveFails: 3, event: "none" });
  });

  it("down + success recovers and resolves", () => {
    expect(nextState(down(3), ok)).toEqual({ state: "up", consecutiveFails: 0, event: "resolved" });
  });

  it("no previous state is treated as up with 0 fails", () => {
    expect(nextState(null, ok)).toEqual({ state: "up", consecutiveFails: 0, event: "none" });
    expect(nextState(null, fail)).toEqual({ state: "up", consecutiveFails: 1, event: "none" });
  });

  it("one blip does not open an incident", () => {
    let s = nextState(null, ok);
    const events = [s.event];
    for (const r of [fail, ok, ok]) {
      s = nextState(s, r);
      events.push(s.event);
    }
    expect(events.every((e) => e === "none")).toBe(true);
    expect(s.state).toBe("up");
  });

  it("two separated blips never open an incident", () => {
    let s = nextState(null, fail);
    s = nextState(s, ok);
    s = nextState(s, fail);
    expect(s).toMatchObject({ state: "up", event: "none" });
  });
});
