import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type BodyRole,
  type MeasurementRoles,
  type StepMeasurement,
  stepPhotoPath,
  toAppRole,
  toGuitarType,
} from "./index.ts";

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

describe("step measurement roles", () => {
  it("accepts a measurement with Air, Top and Back roles and one without roles", () => {
    const top: BodyRole = {
      frequency: 196.94,
      level: -21.3,
      spectralQ: 31.2,
      decayQ: null,
      origin: "user",
    };
    const withRoles: StepMeasurement = {
      id: "m1",
      timestamp: 1762257600000,
      description: "Box closed",
      frequency: 196.94,
      spectrum: {
        frequencies: [],
        magnitudes: [],
        magnitudesDb: [],
        sampleRate: 48000,
        fftSize: 32768,
        binWidth: 1.46484375,
      },
      roles: { top },
    };
    const { roles: _ignored, ...legacy } = withRoles;
    expectTypeOf(legacy).toMatchTypeOf<StepMeasurement>();
    expectTypeOf<MeasurementRoles>().toEqualTypeOf<
      Partial<Record<"air" | "top" | "back", BodyRole>>
    >();
    expectTypeOf<BodyRole["origin"]>().toEqualTypeOf<"auto" | "user">();
    expect(withRoles.roles?.top?.frequency).toBe(196.94);
  });
});
