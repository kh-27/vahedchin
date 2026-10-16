/** The published term data works with the core (pipeline <-> app contract). */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findConflicts } from "./conflict";
import { generate } from "./generate";
import { jalaliToJdn, toMinutes } from "./time";
import type { Group, TermData } from "./types";

const data = JSON.parse(readFileSync(new URL("../../../data/terms/4051.json", import.meta.url), "utf-8")) as TermData;

describe("data/terms/4051.json", () => {
  it("has the schema the core expects", () => {
    expect(data.schemaVersion).toBe(1);
    expect(data.term).toMatch(/^\d{4}$/);
    const g = data.groups[0]!;
    expect(Object.keys(g).sort()).toEqual(
      ["capacity", "code", "course", "department", "emergencyDrop", "exams", "gender", "group", "name", "notes", "otherCenters", "practicalUnits", "registered", "sessions", "teacher", "units", "waitlist"].sort(),
    );
    const s = data.groups.find((x) => x.sessions.length > 0)!.sessions[0]!;
    expect(Object.keys(s).sort()).toEqual(["date", "day", "end", "half", "kind", "place", "start", "type", "week", "weekNumber"].sort());
  });

  it("every time and date parses, every session ends after it starts", () => {
    for (const g of data.groups) {
      expect(data.departments[g.department]).toBeDefined();
      for (const s of g.sessions) {
        expect(toMinutes(s.end)).toBeGreaterThan(toMinutes(s.start));
        if (s.date !== null) jalaliToJdn(s.date);
        expect(s.day === null).toBe(s.date !== null);
      }
      for (const e of g.exams) {
        jalaliToJdn(e.date);
        expect(toMinutes(e.end)).toBeGreaterThan(toMinutes(e.start));
      }
    }
  });

  it("a real department's term: the 8 courses with most groups, under 2 s", () => {
    const byCourse = new Map<string, Group[]>();
    for (const g of data.groups.filter((x) => x.department === 0)) byCourse.set(g.course, [...(byCourse.get(g.course) ?? []), g]);
    const top = [...byCourse.entries()]
      .filter(([, gs]) => gs.some((g) => g.sessions.length > 0))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);
    const t0 = performance.now();
    const r = generate({
      groups: data.groups,
      courses: top.map(([course]) => ({ course, required: false })),
      limits: { min: 12, max: 20 },
    });
    const ms = performance.now() - t0;
    console.log(`real data, ${data.departments[0]!.department}: ${top.length} courses, ${ms.toFixed(0)} ms, ${r.nodes} nodes, ${r.total} valid`);
    expect(r.complete).toBe(true);
    expect(ms).toBeLessThan(2000);
    for (const res of r.results.slice(0, 20)) {
      expect(findConflicts(res.groups).conflicts).toEqual([]);
      expect(res.units).toBeGreaterThanOrEqual(12);
      expect(res.units).toBeLessThanOrEqual(20);
    }
  });
});
