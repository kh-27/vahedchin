import { describe, expect, it } from "vitest";
import { group, session } from "../core/test-utils";
import { active, exportFile, ImportError, initialState, normalizeScenario, normalizeState, parseImport, reducer, type AppState } from "./scenario";

function sample(): AppState {
  let s = initialState("4051");
  s = reducer(s, { type: "pick", course: "1000001", group: group("1000001_01", [session(0, "08:00", "10:00")]) });
  s = reducer(s, { type: "settings", patch: { gpa: 18, gender: "male", blocks: [{ day: 3, start: "14:00", end: "18:00" }] } });
  s = reducer(s, { type: "prefs", patch: { fewerDays: 7, preferredTeachers: ["الف"] } });
  return s;
}

describe("FR-07 JSON export and import", () => {
  it("round-trips every scenario with its picks and settings", () => {
    const state = sample();
    const file = exportFile(state, new Date("2026-10-16T12:00:00Z"));
    expect(file).toMatchObject({ app: "vahedchin", version: 1, exportedAt: "2026-10-16T12:00:00.000Z" });
    const back = parseImport(JSON.stringify(file));
    expect(back).toEqual(state.scenarios);
  });

  it("imports as new scenarios: new ids, unique names, the first becomes active", () => {
    const state = sample();
    const imported = parseImport(JSON.stringify(exportFile(state)));
    const next = reducer(state, { type: "importScenarios", scenarios: [...imported, ...imported] });
    expect(next.scenarios.map((s) => s.name)).toEqual(["برنامه ۱", "برنامه ۱ (2)", "برنامه ۱ (3)"]);
    expect(new Set(next.scenarios.map((s) => s.id)).size).toBe(3);
    expect(active(next).name).toBe("برنامه ۱ (2)");
    expect(active(next).picks).toEqual(state.scenarios[0]!.picks);
    expect(reducer(state, { type: "importScenarios", scenarios: [] })).toBe(state);
  });

  it.each([
    ["not json", "{", "JSON معتبر نیست"],
    ["another app", JSON.stringify({ app: "x" }), "خروجی واحدچین نیست"],
    ["a newer version", JSON.stringify({ app: "vahedchin", version: 2, scenarios: [] }), "نسخه فایل (2)"],
    ["no scenarios", JSON.stringify({ app: "vahedchin", version: 1 }), "هیچ برنامه‌ای ندارد"],
    ["a broken scenario", JSON.stringify({ app: "vahedchin", version: 1, scenarios: [{ id: 1 }] }), "خراب"],
  ])("rejects %s with a Persian message", (_name, text, message) => {
    expect(() => parseImport(text)).toThrow(ImportError);
    expect(() => parseImport(text)).toThrow(message);
  });
});

describe("normalizing stored data from older versions", () => {
  it("fills missing settings with defaults and drops invalid parts", () => {
    const s = normalizeScenario({
      id: "a",
      name: "قدیمی",
      term: "4042",
      courses: [{ course: "1000001" }, { course: "1000002", required: false, excluded: ["x", 3], locked: 5 }],
      picks: { "1000001": "1000001_01" },
      settings: { standing: "nope", blocks: [{ day: 9, start: "1", end: "2" }, { day: 2, start: "08:00", end: "10:00" }], prefs: { fewerDays: 1 } },
    });
    expect(s).toMatchObject({
      courses: [
        { course: "1000001", required: true, excluded: [], locked: null },
        { course: "1000002", required: false, excluded: ["x"], locked: null },
      ],
      snapshot: {},
      settings: { standing: "normal", gpa: null, gender: null, blocks: [{ day: 2 }], prefs: { fewerDays: 1, lessIdle: 2, noClassBefore: null, preferredTeachers: [] } },
    });
  });
  it.each([null, 5, { id: "a" }, { id: "a", name: "n", term: "t", courses: [5], picks: {} }, { id: "a", name: "n", term: "t", courses: [], picks: { a: 1 } }])(
    "rejects %j",
    (x) => {
      expect(normalizeScenario(x)).toBeNull();
    },
  );
  it("a stored state keeps valid scenarios and a valid active id", () => {
    const state = sample();
    expect(normalizeState(state)).toEqual(state);
    expect(normalizeState({ scenarios: [...state.scenarios, { broken: true }], activeId: "gone" })).toEqual({ scenarios: state.scenarios, activeId: state.scenarios[0]!.id });
    expect(normalizeState({ scenarios: [] })).toBeNull();
    expect(normalizeState("x")).toBeNull();
  });
});
