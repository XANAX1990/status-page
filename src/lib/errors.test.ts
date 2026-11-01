import { describe, expect, it } from "vitest";
import { errorLabel } from "@/lib/errors";

describe("errorLabel", () => {
  it("is the class name, plus a numeric code when there is one", () => {
    const authFailed = Object.assign(new Error("x"), { name: "MongoServerError", code: 18 });
    expect(errorLabel(authFailed)).toBe("MongoServerError 18");
  });

  it("keeps a plain network code such as ECONNREFUSED", () => {
    expect(errorLabel(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe("Error ECONNREFUSED");
  });

  it("never includes the message, which can carry hosts and connection strings", () => {
    const leaky = Object.assign(new Error("failed for user:hunter2@cluster.example"), {
      name: "MongoNetworkError",
    });
    const label = errorLabel(leaky);
    expect(label).toBe("MongoNetworkError");
    expect(label).not.toMatch(/mongodb|hunter2|cluster/);
  });

  it("ignores a code that is not a short plain token", () => {
    expect(errorLabel(Object.assign(new Error("x"), { code: "see https://host/secret?token=abc" }))).toBe("Error");
  });

  it("copes with things that are not errors", () => {
    expect(errorLabel("boom")).toBe("unknown error");
    expect(errorLabel(null)).toBe("unknown error");
    expect(errorLabel({ message: "secret" })).toBe("unknown error");
  });
});
