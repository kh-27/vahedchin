import { describe, expect, it } from "vitest";
import { genderAllowed, standingFromGpa, unitLimits, unitsAllowed } from "./rules";
import { group } from "./test-utils";

describe("US-13 unit limits", () => {
  it.each([
    [17.5, 24],
    [11.99, 16],
    [15, 20],
    [17, 24],
    [12, 20],
  ])("GPA %s -> max %s", (gpa, max) => {
    expect(unitLimits({ gpa })).toEqual({ min: 12, max });
  });
  it("an 11-unit combination is invalid (floor 12)", () => {
    expect(unitsAllowed(11, unitLimits())).toBe(false);
    expect(unitsAllowed(12, unitLimits())).toBe(true);
    expect(unitsAllowed(21, unitLimits())).toBe(false);
  });
  it("the user's manual value wins", () => {
    expect(unitLimits({ gpa: 18, manualMax: 22 })).toEqual({ min: 12, max: 22 });
    expect(unitLimits({ standing: "probation", manualMin: 10 })).toEqual({ min: 10, max: 16 });
  });
  it("standing without GPA; default is normal", () => {
    expect(unitLimits({ standing: "excellent" }).max).toBe(24);
    expect(unitLimits().max).toBe(20);
    expect(unitLimits({ gpa: null, standing: "probation" }).max).toBe(16);
  });
  it("rejects nonsense", () => {
    expect(() => standingFromGpa(21)).toThrow(/invalid GPA/);
    expect(() => standingFromGpa(Number.NaN)).toThrow(/invalid GPA/);
    expect(() => unitLimits({ manualMin: 20, manualMax: 14 })).toThrow(/invalid unit limits/);
  });
});

describe("FR-26 gender filter", () => {
  it("mixed is always allowed; otherwise only the user's gender", () => {
    const [mixed, male, female] = (["mixed", "male", "female"] as const).map((gender) => group("1000001_01", [], [], { gender }));
    expect([mixed!, male!, female!].map((g) => genderAllowed(g, "female"))).toEqual([true, false, true]);
    expect([mixed!, male!, female!].map((g) => genderAllowed(g, "male"))).toEqual([true, true, false]);
    expect([mixed!, male!, female!].map((g) => genderAllowed(g, null))).toEqual([true, true, true]);
  });
});
