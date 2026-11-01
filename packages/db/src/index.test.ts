import { describe, expect, it } from "vitest";
import { toAppRole } from "./index.ts";

describe("toAppRole", () => {
  it("only recognises admin as administrator; anything else is a regular user", () => {
    expect(toAppRole("admin")).toBe("admin");
    expect(toAppRole("user")).toBe("user");
    expect(toAppRole(undefined)).toBe("user");
    expect(toAppRole(null)).toBe("user");
    expect(toAppRole("superuser")).toBe("user");
  });
});
