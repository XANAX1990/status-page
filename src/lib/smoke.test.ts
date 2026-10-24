import { describe, expect, it } from "vitest";
import { monitors } from "@/config/monitors";

describe("monitors config", () => {
  it("has unique ids", () => {
    const ids = monitors.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
