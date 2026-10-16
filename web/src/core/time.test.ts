import { describe, expect, it } from "vitest";
import { DAY_NAMES, daysBetween, isLeapJalali, jalaliToJdn, overlaps, toMinutes, weekdayOf } from "./time";

describe("toMinutes", () => {
  it("parses HH:MM", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("10:30")).toBe(630);
    expect(toMinutes("23:59")).toBe(1439);
  });
  it.each(["9:30", "24:00", "10:60", "1030", ""])("rejects %s", (t) => {
    expect(() => toMinutes(t)).toThrow(/invalid time/);
  });
});

describe("overlaps (FR-10: open intervals)", () => {
  it("US-03: 10-12 vs 11-13 overlap, 10-12 vs 12-14 do not", () => {
    expect(overlaps(600, 720, 660, 780)).toBe(true);
    expect(overlaps(600, 720, 720, 840)).toBe(false);
    expect(overlaps(720, 840, 600, 720)).toBe(false);
    expect(overlaps(600, 720, 630, 690)).toBe(true); // containment
  });
});

describe("Jalali dates", () => {
  it("1405/01/01 is Saturday 2026-03-21 (JDN 2461121)", () => {
    expect(jalaliToJdn("1405/01/01")).toBe(2461121);
    expect(weekdayOf("1405/01/01")).toBe(0);
  });
  it("1403/12/30 exists (1403 is a leap year) and is followed by 1404/01/01", () => {
    expect(daysBetween("1403/12/30", "1404/01/01")).toBe(1);
  });
  it("months 1-6 have 31 days, 7-11 have 30", () => {
    expect(daysBetween("1405/06/31", "1405/07/01")).toBe(1);
    expect(daysBetween("1405/07/30", "1405/08/01")).toBe(1);
    expect(daysBetween("1405/01/01", "1406/01/01")).toBe(365);
  });
  it("weekday of exam dates in the 4051 data (FR-41)", () => {
    // 1405/10/30 = 2027-01-20, a Wednesday
    expect(DAY_NAMES[weekdayOf("1405/10/30")]).toBe("چهارشنبه");
  });
  it("leap years: 1403 and 1408 are leap, 1404 and 1405 are not", () => {
    expect([1403, 1404, 1405, 1408].map(isLeapJalali)).toEqual([true, false, false, true]);
  });
  it.each(["1405/4/06", "1405/13/01", "1405/07/31", "1405/00/10", "1405-04-06", "1404/12/30"])("rejects %s", (d) => {
    expect(() => jalaliToJdn(d)).toThrow(/invalid Jalali date/);
  });
  it("rejects years outside the algorithm's range", () => {
    expect(() => jalaliToJdn("3200/01/01")).toThrow(/out of range/);
  });
});
