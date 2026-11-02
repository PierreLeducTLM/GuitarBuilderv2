import { describe, expect, it } from "vitest";
import { stepPhotoPath, toAppRole, toGuitarType } from "./index.ts";

describe("toAppRole", () => {
  it("only recognises admin as administrator; anything else is a regular user", () => {
    expect(toAppRole("admin")).toBe("admin");
    expect(toAppRole("user")).toBe("user");
    expect(toAppRole(undefined)).toBe("user");
    expect(toAppRole(null)).toBe("user");
    expect(toAppRole("superuser")).toBe("user");
  });
});

describe("toGuitarType", () => {
  it("accepts the two stored guitar types and reads anything else as not set", () => {
    expect(toGuitarType("classical")).toBe("classical");
    expect(toGuitarType("steel_string")).toBe("steel_string");
    expect(toGuitarType(null)).toBeNull();
    expect(toGuitarType("electric")).toBeNull();
  });
});

describe("stepPhotoPath", () => {
  it("places a photo in its build's step folder", () => {
    expect(stepPhotoPath("b1", "TapTest", "1733500000000_k3j9x2ab.jpg")).toBe(
      "b1/TapTest/1733500000000_k3j9x2ab.jpg",
    );
  });
});
