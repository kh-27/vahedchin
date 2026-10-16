import { describe, expect, it } from "vitest";
import { group, session } from "../core/test-utils";
import { weekLayout, weekMark } from "./weekLayout";

describe("FR-40 week layout", () => {
  it("is null without weekly sessions", () => {
    expect(weekLayout([group("1000001_01", [session(null, "08:00", "10:00", { date: "1405/08/01" })])])).toBeNull();
  });
  it("spans whole hours, Saturday to Thursday, Friday only when used", () => {
    const l = weekLayout([group("1000001_01", [session(0, "08:30", "10:15")]), group("1000002_01", [session(3, "13:00", "15:00")])])!;
    expect([l.t0, l.t1]).toEqual([480, 900]);
    expect(l.days).toEqual([0, 1, 2, 3, 4, 5]);
    expect(weekLayout([group("1000001_01", [session(6, "08:00", "09:00")])])!.days).toHaveLength(7);
  });
  it("puts overlapping sessions side by side and marks conflicts and week patterns", () => {
    const a = group("1000001_01", [session(0, "08:00", "10:00", { week: "odd" })]);
    const b = group("1000002_01", [session(0, "08:00", "10:00", { week: "even" })]);
    const c = group("1000003_01", [session(0, "09:00", "11:00")]);
    const d = group("1000004_01", [session(0, "12:00", "13:00", { weekNumber: 14 })]);
    const l = weekLayout([a, b, c, d])!;
    const by = (code: string) => l.blocks.find((x) => x.group.code === code)!;
    expect([by("1000001_01").lane, by("1000002_01").lane, by("1000003_01").lane]).toEqual([0, 1, 2]);
    expect(by("1000001_01").lanes).toBe(3);
    expect(by("1000004_01")).toMatchObject({ lane: 0, lanes: 1, mark: "ه۱۴", conflict: false });
    expect(by("1000001_01").conflict).toBe(true); // odd overlaps the every-week class
    expect(by("1000001_01").mark).toBe("ف");
    expect(weekMark(by("1000002_01").session)).toBe("ز");
    expect(weekMark(by("1000003_01").session)).toBe("");
  });
});
