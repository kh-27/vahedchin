import { describe, expect, it } from "vitest";
import { exam, group, session } from "../core/test-utils";
import { active, fingerprint, generateInput, initialState, pickProblems, reducer, type Action, type AppState } from "./scenario";

const run = (actions: Action[], start: AppState = initialState("4051")) => actions.reduce(reducer, start);
const g1 = group("1000001_01", [session(0, "08:00", "10:00")], [exam("1405/10/20", "08:00", "10:00")]);
const g2 = group("1000001_02", [session(1, "08:00", "10:00")]);
const h1 = group("1000002_01", [session(2, "08:00", "10:00")], [], { units: 2 });

describe("FR-20, FR-21, FR-22 scenario courses", () => {
  it("adds a course once, required by default; can make it optional and remove it", () => {
    let s = run([{ type: "addCourse", course: "1000001" }, { type: "addCourse", course: "1000001" }]);
    expect(active(s).courses).toEqual([{ course: "1000001", required: true, excluded: [], locked: null }]);
    s = run([{ type: "setRequired", course: "1000001", required: false }], s);
    expect(active(s).courses[0]!.required).toBe(false);
    s = run([{ type: "pick", course: "1000001", group: g1 }, { type: "removeCourse", course: "1000001" }], s);
    expect(active(s)).toMatchObject({ courses: [], picks: {}, snapshot: {} });
  });
  it("lock and exclude are mutually exclusive for a group", () => {
    let s = run([{ type: "addCourse", course: "1000001" }, { type: "toggleExcluded", course: "1000001", code: "1000001_01" }]);
    expect(active(s).courses[0]!.excluded).toEqual(["1000001_01"]);
    s = run([{ type: "setLocked", course: "1000001", code: "1000001_01" }], s);
    expect(active(s).courses[0]).toMatchObject({ locked: "1000001_01", excluded: [] });
    s = run([{ type: "toggleExcluded", course: "1000001", code: "1000001_01" }], s);
    expect(active(s).courses[0]).toMatchObject({ locked: null, excluded: ["1000001_01"] });
    s = run([{ type: "toggleExcluded", course: "1000001", code: "1000001_01" }, { type: "setLocked", course: "1000001", code: null }], s);
    expect(active(s).courses[0]).toMatchObject({ locked: null, excluded: [] });
  });
});

describe("FR-42 picks and applying a generated result", () => {
  it("picking a group adds its course and records a fingerprint", () => {
    let s = run([{ type: "pick", course: "1000001", group: g1 }]);
    expect(active(s).picks).toEqual({ "1000001": "1000001_01" });
    expect(active(s).courses).toHaveLength(1);
    s = run([{ type: "pick", course: "1000001", group: g2 }], s);
    expect(active(s).snapshot).toEqual({ "1000001_02": fingerprint(g2) });
    s = run([{ type: "pick", course: "1000001", group: null }], s);
    expect(active(s).picks).toEqual({});
  });
  it("applyCombination replaces all picks; clearPicks empties them", () => {
    let s = run([{ type: "pick", course: "1000001", group: g1 }, { type: "applyCombination", groups: [g2, h1] }]);
    expect(active(s).picks).toEqual({ "1000001": "1000001_02", "1000002": "1000002_01" });
    s = run([{ type: "clearPicks" }], s);
    expect(active(s).picks).toEqual({});
  });
});

describe("FR-71 changed data", () => {
  it("reports picked groups that disappeared or changed, until accepted", () => {
    const s = active(run([{ type: "applyCombination", groups: [g1, h1] }]));
    const changed = { ...g1, sessions: [session(0, "09:00", "11:00")] };
    const now = new Map([[changed.code, changed]]);
    expect(pickProblems(s, now)).toEqual([
      { course: "1000001", code: "1000001_01", kind: "changed" },
      { course: "1000002", code: "1000002_01", kind: "missing" },
    ]);
    const accepted = active(reducer({ scenarios: [s], activeId: s.id }, { type: "acceptChanges", groups: [changed] }));
    expect(pickProblems(accepted, now)).toEqual([{ course: "1000002", code: "1000002_01", kind: "missing" }]);
  });
});

describe("settings and several scenarios", () => {
  it("updates settings, preferences and blocks", () => {
    const s = run([
      { type: "settings", patch: { gpa: 17.5, gender: "female" } },
      { type: "prefs", patch: { fewerDays: 9 } },
      { type: "addBlock", block: { day: 3, start: "14:00", end: "18:00" } },
      { type: "addBlock", block: { day: 4, start: "08:00", end: "10:00" } },
      { type: "removeBlock", index: 0 },
    ]);
    const set = active(s).settings;
    expect(set).toMatchObject({ gpa: 17.5, gender: "female", blocks: [{ day: 4 }] });
    expect(set.prefs.fewerDays).toBe(9);
    expect(set.prefs.lessIdle).toBe(2);
  });
  it("new, duplicate, rename, switch and delete", () => {
    let s = run([{ type: "addCourse", course: "1000001" }, { type: "newScenario", term: "4051", name: "دوم" }]);
    expect(s.scenarios).toHaveLength(2);
    expect(active(s)).toMatchObject({ name: "دوم", courses: [] });
    s = run([{ type: "duplicateScenario", name: "سوم" }, { type: "renameScenario", name: "سومی" }], s);
    expect(s.scenarios.map((x) => x.name)).toEqual(["برنامه ۱", "دوم", "سومی"]);
    const first = s.scenarios[0]!.id;
    s = run([{ type: "switchScenario", id: first }, { type: "switchScenario", id: "nope" }], s);
    expect(active(s).id).toBe(first);
    s = run([{ type: "deleteScenario" }, { type: "deleteScenario" }, { type: "deleteScenario" }], s);
    expect(s.scenarios).toHaveLength(1); // the last one is never deleted
    expect(run([{ type: "replace", state: initialState("4042") }], s).scenarios[0]!.term).toBe("4042");
  });
});

describe("generateInput", () => {
  it("passes only the scenario's groups and the unit limits from GPA", () => {
    const s = active(
      run([{ type: "addCourse", course: "1000001" }, { type: "settings", patch: { gpa: 11 } }, { type: "toggleExcluded", course: "1000001", code: "1000001_02" }]),
    );
    const input = generateInput(s, [g1, g2, h1]);
    expect(input.groups.map((g) => g.code)).toEqual(["1000001_01", "1000001_02"]);
    expect(input.limits).toEqual({ min: 12, max: 16 });
    expect(input.courses).toEqual([{ course: "1000001", required: true, excluded: ["1000001_02"], locked: null }]);
  });
});
