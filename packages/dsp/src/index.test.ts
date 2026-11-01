import { describe, expect, it } from "vitest";
import { DSP_PACKAGE_NAME } from "./index.ts";

describe("@gb/dsp", () => {
  it("is wired into the workspace test run", () => {
    expect(DSP_PACKAGE_NAME).toBe("@gb/dsp");
  });
});
