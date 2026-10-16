import { describe, expect, it } from "vitest";
import {
  examsConflict,
  findConflicts,
  groupsConflict,
  halvesCompatible,
  sessionInBlock,
  sessionsConflict,
  weeksCompatible,
} from "./conflict";
import { exam, group, session } from "./test-utils";

const sat = (start: string, end: string, over = {}) => session(0, start, end, over);

describe("FR-10 / US-03 session conflicts", () => {
  it("Saturday 10-12 conflicts with Saturday 11-13", () => {
    expect(sessionsConflict(sat("10:00", "12:00"), sat("11:00", "13:00"))).toBe(true);
  });
  it("Saturday 10-12 does not conflict with Saturday 12-14 (touching ends)", () => {
    expect(sessionsConflict(sat("10:00", "12:00"), sat("12:00", "14:00"))).toBe(false);
  });
  it("different days never conflict", () => {
    expect(sessionsConflict(sat("10:00", "12:00"), session(1, "10:00", "12:00"))).toBe(false);
  });
  it("odd week does not conflict with even week at the same time", () => {
    expect(sessionsConflict(sat("10:00", "12:00", { week: "odd" }), sat("10:00", "12:00", { week: "even" }))).toBe(false);
  });
  it("every week conflicts with odd week", () => {
    expect(sessionsConflict(sat("10:00", "12:00"), sat("10:00", "12:00", { week: "odd" }))).toBe(true);
    expect(sessionsConflict(sat("10:00", "12:00", { week: "even" }), sat("11:00", "12:00", { week: "even" }))).toBe(true);
  });
  it("FR-65: single-date sessions are not part of weekly conflicts", () => {
    const dated = session(null, "10:00", "12:00", { date: "1405/02/17" });
    expect(sessionsConflict(dated, sat("10:00", "12:00"))).toBe(false);
    expect(sessionsConflict(dated, dated)).toBe(false);
  });
});

describe("A11 week-number sessions", () => {
  const w = (n: number) => sat("17:00", "19:00", { weekNumber: n });
  it("meets only the same week, any-week sessions, or the matching parity", () => {
    expect(weeksCompatible(w(14), w(14))).toBe(true);
    expect(weeksCompatible(w(14), w(15))).toBe(false);
    expect(weeksCompatible(w(14), sat("17:00", "19:00"))).toBe(true);
    expect(weeksCompatible(w(14), sat("17:00", "19:00", { week: "even" }))).toBe(true);
    expect(weeksCompatible(sat("17:00", "19:00", { week: "odd" }), w(14))).toBe(false);
    expect(weeksCompatible(sat("17:00", "19:00", { week: "odd" }), w(15))).toBe(true);
  });
});

describe("A10 half-term sessions", () => {
  it("first half never meets second half; no half meets both", () => {
    const h1 = sat("08:30", "10:30", { half: 1 });
    const h2 = sat("08:30", "10:30", { half: 2 });
    expect(halvesCompatible(h1, h2)).toBe(false);
    expect(sessionsConflict(h1, h2)).toBe(false);
    expect(sessionsConflict(h1, sat("09:00", "10:00"))).toBe(true);
    expect(sessionsConflict(h2, sat("09:00", "10:00", { half: 2 }))).toBe(true);
  });
});

describe("FR-11 / US-04 exam conflicts", () => {
  it("1405/04/27 08-10 vs 09-11 is a hard conflict", () => {
    expect(examsConflict(exam("1405/04/27", "08:00", "10:00"), exam("1405/04/27", "09:00", "11:00"))).toBe(true);
  });
  it("08-10 vs 10-12 on the same day is only a same-day warning", () => {
    const a = group("1000001_01", [], [exam("1405/04/27", "08:00", "10:00")]);
    const b = group("1000002_01", [], [exam("1405/04/27", "10:00", "12:00")]);
    const r = findConflicts([a, b]);
    expect(r.conflicts).toEqual([]);
    expect(r.warnings).toMatchObject([{ kind: "same_day", days: 0, a, b }]);
  });
  it("different dates never conflict", () => {
    expect(examsConflict(exam("1405/04/27", "08:00", "10:00"), exam("1405/04/28", "08:00", "10:00"))).toBe(false);
  });
});

describe("FR-12 exam gap warning", () => {
  const a = group("1000001_01", [], [exam("1405/04/27", "08:00", "10:00")]);
  const b = group("1000002_01", [], [exam("1405/04/29", "08:00", "10:00")]);
  it("is disabled by default", () => {
    expect(findConflicts([a, b]).warnings).toEqual([]);
  });
  it("warns when exams are fewer than N days apart", () => {
    expect(findConflicts([a, b], { minExamGapDays: 3 }).warnings).toMatchObject([{ kind: "close", days: 2 }]);
    expect(findConflicts([a, b], { minExamGapDays: 2 }).warnings).toEqual([]);
  });
});

describe("FR-13 report lists both sides", () => {
  it("names both groups and the clashing sessions or exams", () => {
    const a = group("1118061_01", [sat("10:30", "12:30")], [exam("1405/04/06", "16:00", "18:00")]);
    const b = group("1118424_01", [sat("11:00", "12:00")], [exam("1405/04/06", "17:00", "19:00")]);
    const r = findConflicts([a, b]);
    expect(r.conflicts).toHaveLength(2);
    expect(r.conflicts[0]).toMatchObject({ kind: "session", a: { code: "1118061_01" }, b: { code: "1118424_01" } });
    expect(r.conflicts[1]).toMatchObject({ kind: "exam", examA: { start: "16:00" }, examB: { start: "17:00" } });
    expect(groupsConflict(a, b)).toBe(true);
  });
  it("groups without overlap do not conflict", () => {
    expect(groupsConflict(group("1000001_01", [sat("08:00", "10:00")]), group("1000002_01", [sat("10:00", "12:00")]))).toBe(false);
  });
  it("BR-1: two groups of one course are reported", () => {
    expect(findConflicts([group("1000001_01"), group("1000001_02"), group("1000002_01")]).duplicateCourses).toEqual(["1000001"]);
  });
});

describe("FR-24 blocked time ranges", () => {
  const block = { day: 3 as const, start: "14:00", end: "18:00" };
  it("hits sessions overlapping the block on that day", () => {
    expect(sessionInBlock(session(3, "13:00", "15:00"), block)).toBe(true);
    expect(sessionInBlock(session(3, "12:00", "14:00"), block)).toBe(false);
    expect(sessionInBlock(session(2, "15:00", "16:00"), block)).toBe(false);
    const g = group("1000001_01", [session(3, "15:00", "17:00")]);
    expect(findConflicts([g], { blocks: [block] }).blocked).toMatchObject([{ group: g, block }]);
  });
});
