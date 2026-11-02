import { describe, expect, it } from "vitest";
import { isUuid, validateNewBuild } from "./validation";

describe("validateNewBuild", () => {
  it("needs a name with a non-whitespace character and a guitar type", () => {
    expect(validateNewBuild({ name: "", guitarType: null })).toEqual({
      name: "required",
      guitarType: "required",
    });
    expect(validateNewBuild({ name: "  \t ", guitarType: "classical" })).toEqual({
      name: "required",
    });
    expect(validateNewBuild({ name: "Build #1", guitarType: null })).toEqual({
      guitarType: "required",
    });
  });

  it("accepts any other name, of any length, duplicates included", () => {
    expect(validateNewBuild({ name: "Build #1", guitarType: "steel_string" })).toEqual({});
    expect(validateNewBuild({ name: "x".repeat(5000), guitarType: "classical" })).toEqual({});
  });
});

describe("isUuid", () => {
  it("recognises build ids", () => {
    expect(isUuid("6fe2f255-5aba-45fe-985d-68d26d1161ce")).toBe(true);
    expect(isUuid("not-a-build")).toBe(false);
    expect(isUuid("6fe2f255-5aba-45fe-985d-68d26d1161ce/x")).toBe(false);
  });
});
