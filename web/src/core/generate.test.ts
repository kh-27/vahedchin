import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { groupsConflict } from "./conflict";
import { generate, type CourseChoice, type GenerateInput } from "./generate";
import { DEFAULT_PREFERENCES, features, profile, weigh } from "./score";
import { exam, group, session } from "./test-utils";
import type { Day, Group } from "./types";

const limits = { min: 0, max: 30 };
const req = (course: string, over: Partial<CourseChoice> = {}): CourseChoice => ({ course, required: true, ...over });
const codes = (r: { groups: Group[] }) => r.groups.map((g) => g.code).sort().join(" ");

/** Position p -> Saturday..Monday, 08-10 or 10-12. */
function at(p: number) {
  const start = p % 2 === 0 ? "08:00" : "10:00";
  const end = p % 2 === 0 ? "10:00" : "12:00";
  return session((p >> 1) as Day, start, end);
}

describe("US-05: 4 courses x 3 groups, exactly 5 of 81 valid", () => {
  // Found by search: these positions give exactly 5 conflict-free combinations.
  const layout = [
    [0, 1, 1],
    [1, 3, 5],
    [3, 3, 5],
    [5, 5, 3],
  ];
  const groups = layout.flatMap((row, c) => row.map((p, i) => group(`100000${c}_0${i + 1}`, [at(p)])));
  const courses = layout.map((_, c) => req(`100000${c}`));

  it("returns exactly those 5", () => {
    const r = generate({ groups, courses, limits: { min: 12, max: 20 } });
    expect(r.total).toBe(5);
    expect(r.complete && !r.truncated && !r.cancelled).toBe(true);
    expect(r.results.map(codes).sort()).toEqual(
      ["0000", "0001", "0010", "0011", "0022"]
        .map((t) => [...t].map((d, c) => `100000${c}_0${Number(d) + 1}`).join(" "))
        .sort(),
    );
    for (const res of r.results) expect(res.units).toBe(12);
  });

  it("FR-32: caps the list and says so", () => {
    const r = generate({ groups, courses, limits: { min: 12, max: 20 }, maxResults: 2 });
    expect(r.results).toHaveLength(2);
    expect(r.total).toBe(5);
    expect(r.truncated).toBe(true);
    // the two kept are the two best of all five
    const all = generate({ groups, courses, limits: { min: 12, max: 20 } }).results;
    expect(r.results.map(codes)).toEqual(all.slice(0, 2).map(codes));
  });
});

describe("US-06: ranking by fewer days", () => {
  // Course X: one group on Sat. Course Y: group 01 on Sat (3 days total), 02 on Wed (4 days).
  const a = group("2000001_01", [session(0, "08:00", "10:00"), session(1, "08:00", "10:00")]);
  const b = group("2000002_01", [session(2, "08:00", "10:00")]);
  const y3 = group("2000003_01", [session(0, "10:00", "12:00")]);
  const y4 = group("2000003_02", [session(4, "10:00", "12:00")]);
  it("puts the 3-day combination above the 4-day one, with the share of each preference (FR-31)", () => {
    const r = generate({
      groups: [a, b, y3, y4],
      courses: [req("2000001"), req("2000002"), req("2000003")],
      limits,
      preferences: { fewerDays: 10, lessIdle: 1, examSpacing: 1 },
    });
    expect(r.results.map((x) => x.groups.find((g) => g.course === "2000003")!.code)).toEqual(["2000003_01", "2000003_02"]);
    expect(r.results[0]!.parts.days).toBe(30);
    expect(r.results[1]!.parts.days).toBe(40);
    expect(r.results[0]!.score).toBe(30);
  });
});

describe("constraints", () => {
  const s1 = group("3000001_01", [session(0, "08:00", "10:00")]);
  const s2 = group("3000001_02", [session(1, "08:00", "10:00")], [], { gender: "male" });
  const s3 = group("3000001_03", [session(3, "15:00", "17:00")]);
  const t1 = group("3000002_01", [session(0, "09:00", "11:00")], [], { units: 2 });
  const groups = [s1, s2, s3, t1];

  it("BR-1: one group per course; BR-2: no conflicting pair", () => {
    const r = generate({ groups, courses: [req("3000001"), req("3000002")], limits });
    expect(r.results.map(codes).sort()).toEqual(["3000001_02 3000002_01", "3000001_03 3000002_01"]);
  });
  it("BR-6: a locked group is always used, an excluded one never", () => {
    expect(generate({ groups, courses: [req("3000001", { locked: "3000001_03" })], limits }).results.map(codes)).toEqual(["3000001_03"]);
    expect(generate({ groups, courses: [req("3000001", { excluded: ["3000001_01", "3000001_03"] })], limits }).results.map(codes)).toEqual(["3000001_02"]);
  });
  it("BR-8 and FR-24: gender and blocked times filter groups", () => {
    const r = generate({
      groups,
      courses: [req("3000001")],
      limits,
      gender: "female",
      blocks: [{ day: 3, start: "14:00", end: "18:00" }],
    });
    expect(r.results.map(codes)).toEqual(["3000001_01"]);
  });
  it("FR-21: optional courses may be left out; BR-4: units within limits", () => {
    const r = generate({ groups, courses: [req("3000001"), { course: "3000002", required: false }], limits: { min: 3, max: 4 } });
    // 3 + 2 = 5 > 4, so only the 3-unit combinations without the optional course
    expect(r.results.map(codes).sort()).toEqual(["3000001_01", "3000001_02", "3000001_03"]);
    const r2 = generate({ groups, courses: [req("3000001"), { course: "3000002", required: false }], limits: { min: 5, max: 5 } });
    expect(r2.results.map(codes).sort()).toEqual(["3000001_02 3000002_01", "3000001_03 3000002_01"]);
  });
  it("an optional course with no usable group is ignored", () => {
    const r = generate({ groups, courses: [req("3000002"), { course: "9999999", required: false }], limits });
    expect(r.total).toBe(1);
  });
  it("maxResults 0 only counts", () => {
    const r = generate({ groups, courses: [req("3000001")], limits, maxResults: 0 });
    expect(r).toMatchObject({ total: 3, results: [], truncated: true });
  });
});

describe("FR-33: why there is no combination", () => {
  const a1 = group("4000001_01", [session(0, "08:00", "10:00")], [], { gender: "male" });
  const a2 = group("4000001_02", [session(0, "10:00", "12:00")]);
  const b1 = group("4000002_01", [session(0, "08:00", "12:00")]);
  const c1 = group("4000003_01", [session(1, "08:00", "10:00")], [], { units: 10 });

  it("a required course with no usable group, with the reasons", () => {
    const r = generate({ groups: [a1, a2], courses: [req("4000001", { excluded: ["4000001_02"] })], limits, gender: "female" });
    expect(r.explanation).toEqual({ kind: "no_candidates", course: "4000001", total: 2, gender: 1, excluded: 1, blocked: 0, notLocked: 0 });
    const r2 = generate({ groups: [a1], courses: [req("4000009")], limits });
    expect(r2.explanation).toMatchObject({ kind: "no_candidates", total: 0 });
  });
  it("required units above the maximum, or the minimum out of reach", () => {
    expect(generate({ groups: [a2, c1], courses: [req("4000001"), req("4000003")], limits: { min: 0, max: 12 } }).explanation).toEqual({
      kind: "required_over_max",
      minUnits: 13,
      max: 12,
    });
    expect(generate({ groups: [a2], courses: [req("4000001")], limits: { min: 12, max: 20 } }).explanation).toEqual({
      kind: "under_min",
      maxUnits: 3,
      min: 12,
    });
  });
  it("two required courses that always clash", () => {
    const r = generate({ groups: [a1, a2, b1], courses: [req("4000001"), req("4000002")], limits });
    expect(r.explanation).toEqual({ kind: "required_pair", a: "4000002", b: "4000001" });
  });
  it("a clash among three courses", () => {
    const x = group("5000001_01", [session(0, "08:00", "10:00")]);
    const y1 = group("5000002_01", [session(0, "08:00", "10:00")]);
    const y2 = group("5000002_02", [session(1, "08:00", "10:00")]);
    const z1 = group("5000003_01", [session(1, "08:00", "10:00")]);
    const z2 = group("5000003_02", [session(0, "09:00", "11:00")]);
    const r = generate({ groups: [x, y1, y2, z1, z2], courses: [req("5000001"), req("5000002"), req("5000003")], limits });
    expect(r.explanation).toEqual({ kind: "combination" });
  });
  it("is null when combinations exist", () => {
    expect(generate({ groups: [a2], courses: [req("4000001")], limits }).explanation).toBeNull();
  });
});

describe("FR-34: stop early", () => {
  const many = Array.from({ length: 6 }, (_, c) =>
    Array.from({ length: 6 }, (_, i) => group(`600000${c}_0${i + 1}`, [session(c as Day, `${String(8 + i).padStart(2, "0")}:00`, `${String(9 + i).padStart(2, "0")}:00`)])),
  ).flat();
  const courses = Array.from({ length: 6 }, (_, c) => req(`600000${c}`));
  it("cancellation is reported and partial", () => {
    let polls = 0;
    const r = generate({ groups: many, courses, limits, shouldCancel: () => ++polls > 2 });
    expect(r.cancelled).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.total).toBeLessThan(6 ** 6);
  });
  it("maxNodes stops the search", () => {
    const r = generate({ groups: many, courses, limits, maxNodes: 100 });
    expect(r).toMatchObject({ complete: false, cancelled: false, nodes: 100, explanation: null });
  });
  it("without limits it finds all 6^6", () => {
    expect(generate({ groups: many, courses, limits, maxResults: 10 }).total).toBe(6 ** 6);
  });
});

// NFR-03: on small random inputs the result equals brute force.
function bruteForce(input: GenerateInput): { key: string; score: number }[] {
  const prefs = { ...DEFAULT_PREFERENCES, ...input.preferences };
  const options = input.courses.map((c) => {
    const gs = input.groups.filter((g) => g.course === c.course);
    return c.required ? gs.map((g) => [g]) : [[], ...gs.map((g) => [g])];
  });
  const out: { key: string; score: number }[] = [];
  const walk = (i: number, acc: Group[]) => {
    if (i === options.length) {
      const units = acc.reduce((t, g) => t + g.units, 0);
      if (units < input.limits.min || units > input.limits.max) return;
      for (let x = 0; x < acc.length; x++) for (let y = x + 1; y < acc.length; y++) if (groupsConflict(acc[x]!, acc[y]!)) return;
      const { score } = weigh(features(acc.map((g) => profile(g, prefs))), prefs);
      out.push({ key: acc.map((g) => g.code).sort().join(","), score });
      return;
    }
    for (const o of options[i]!) walk(i + 1, [...acc, ...o]);
  };
  walk(0, []);
  return out.sort((a, b) => a.score - b.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const arbSession = fc
  .record({
    day: fc.integer({ min: 0, max: 2 }),
    start: fc.integer({ min: 8, max: 11 }),
    len: fc.integer({ min: 1, max: 2 }),
    week: fc.constantFrom("all", "odd", "even" as const),
    half: fc.constantFrom(null, 1, 2),
  })
  .map((s) =>
    session(s.day as Day, `${String(s.start).padStart(2, "0")}:00`, `${String(s.start + s.len).padStart(2, "0")}:00`, {
      week: s.week as "all",
      half: s.half as 1 | null,
    }),
  );
const arbExam = fc
  .record({ day: fc.integer({ min: 1, max: 4 }), start: fc.constantFrom(8, 10, 11) })
  .map((e) => exam(`1405/10/0${e.day}`, `${String(e.start).padStart(2, "0")}:00`, `${String(e.start + 2).padStart(2, "0")}:00`));
const arbGroup = fc.record({
  sessions: fc.array(arbSession, { minLength: 0, maxLength: 2 }),
  exams: fc.array(arbExam, { maxLength: 1 }),
  units: fc.integer({ min: 1, max: 3 }),
  teacher: fc.constantFrom("الف", "ب"),
});
const arbInput = fc
  .record({
    courses: fc.array(fc.record({ groups: fc.array(arbGroup, { minLength: 1, maxLength: 3 }), required: fc.boolean() }), {
      minLength: 1,
      maxLength: 4,
    }),
    min: fc.integer({ min: 0, max: 6 }),
    span: fc.integer({ min: 0, max: 6 }),
    weights: fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })),
    maxResults: fc.integer({ min: 1, max: 6 }),
  })
  .map(({ courses, min, span, weights, maxResults }) => {
    const groups = courses.flatMap((c, ci) =>
      c.groups.map((g, gi) => group(`70000${ci}0_0${gi + 1}`, g.sessions, g.exams, { units: g.units, teacher: g.teacher })),
    );
    const input: GenerateInput = {
      groups,
      courses: courses.map((c, ci) => ({ course: `70000${ci}0`, required: c.required })),
      limits: { min, max: min + span },
      preferences: {
        fewerDays: weights[0],
        early: weights[1],
        noClassBefore: "10:00",
        lessIdle: weights[2],
        teacher: weights[3],
        preferredTeachers: ["الف"],
        examSpacing: weights[4],
      },
      maxResults,
    };
    return input;
  });

describe("NFR-03: equals brute force on small inputs", () => {
  it("same count, same best scores, every result valid and distinct, parts add up", () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const expected = bruteForce(input);
        const valid = new Map(expected.map((e) => [e.key, e.score]));
        const r = generate(input);
        expect(r.total).toBe(expected.length);
        expect(r.complete).toBe(true);
        const k = Math.min(input.maxResults ?? 500, expected.length);
        // Ties may be broken in any order, so compare scores and membership.
        expect(r.results.map((x) => x.score)).toEqual(expected.slice(0, k).map((e) => e.score));
        const keys = r.results.map((x) => x.groups.map((g) => g.code).sort().join(","));
        expect(new Set(keys).size).toBe(keys.length);
        for (const [i, key] of keys.entries()) {
          expect(valid.get(key)).toBe(r.results[i]!.score);
          const p = r.results[i]!.parts;
          expect(p.days + p.earlyDays + p.idleHours + p.otherTeachers + p.examCloseness).toBeCloseTo(r.results[i]!.score, 9);
        }
        expect(r.explanation === null).toBe(expected.length > 0);
      }),
      { numRuns: 400, seed: 4051 },
    );
  });
});
