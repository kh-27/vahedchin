/** NFR-01, NFR-02: timings. Real numbers are printed so they can be reported. */

import { describe, expect, it } from "vitest";
import { findConflicts } from "./conflict";
import { generate } from "./generate";
import { exam, group, session } from "./test-utils";
import type { Day, Group } from "./types";

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const STARTS = ["08:00", "10:00", "13:00", "15:00", "17:00"];
const ENDS = ["10:00", "12:00", "15:00", "17:00", "19:00"];

/** 10 courses x 5 groups, each group two 2-hour sessions and one exam, like a real term. */
function realistic(seed: number): Group[] {
  const rnd = lcg(seed);
  const pick = (n: number) => Math.floor(rnd() * n);
  const groups: Group[] = [];
  for (let c = 0; c < 10; c++)
    for (let g = 0; g < 5; g++) {
      const sessions = [0, 1].map(() => {
        const t = pick(5);
        return session(pick(6) as Day, STARTS[t]!, ENDS[t]!);
      });
      const day = 1 + pick(20);
      const exams = [exam(`1405/10/${String(day).padStart(2, "0")}`, pick(2) ? "08:00" : "13:00", pick(2) ? "10:00" : "15:00")];
      groups.push(group(`80000${String(c).padStart(2, "0")}_0${g + 1}`, sessions, exams, { units: 2 }));
    }
  return groups;
}

const courses = Array.from({ length: 10 }, (_, c) => ({ course: `80000${String(c).padStart(2, "0")}`, required: true }));

function time<T>(f: () => T): [T, number] {
  const t0 = performance.now();
  const r = f();
  return [r, performance.now() - t0];
}

describe("NFR-01: 10 courses x 5 groups under 2 s", () => {
  it.each([1, 2, 3, 4, 5])("realistic schedule, seed %i", (seed) => {
    const [r, ms] = time(() => generate({ groups: realistic(seed), courses, limits: { min: 12, max: 20 } }));
    console.log(`NFR-01 realistic seed ${seed}: ${ms.toFixed(0)} ms, ${r.nodes} nodes, ${r.total} valid`);
    expect(r.complete).toBe(true);
    expect(ms).toBeLessThan(2000);
  });

  it("worst case: no conflict at all, every one of 5^10 combinations is valid", () => {
    // Course c meets only on its own day/time, so groups of different courses never clash.
    const groups = courses.flatMap(({ course }, c) =>
      Array.from({ length: 5 }, (_, g) => group(`${course}_0${g + 1}`, [session((c % 6) as Day, STARTS[Math.floor(c / 6)]!, ENDS[Math.floor(c / 6)]!)], [], { units: 2 })),
    );
    const [r, ms] = time(() => generate({ groups, courses, limits: { min: 12, max: 20 } }));
    console.log(`NFR-01 worst case: ${ms.toFixed(0)} ms, ${r.total} valid`);
    expect(r.total).toBe(5 ** 10);
    expect(r.results).toHaveLength(500);
    expect(ms).toBeLessThan(2000);
  }, 120_000);
});

describe("NFR-02: live conflict check under 100 ms", () => {
  it("a 10-group hand-made schedule", () => {
    const picked = realistic(9).filter((_, i) => i % 5 === 0);
    const [r, ms] = time(() => findConflicts(picked, { minExamGapDays: 2 }));
    console.log(`NFR-02: ${ms.toFixed(2)} ms, ${r.conflicts.length} conflicts`);
    expect(ms).toBeLessThan(100);
  });
});
