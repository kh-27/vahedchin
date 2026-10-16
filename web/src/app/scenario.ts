/** Scenarios: the user's chosen courses, picks and settings (FR-20 to FR-25, FR-42, FR-44, FR-71). */

import type { TimeBlock } from "../core/conflict";
import type { CourseChoice, GenerateInput } from "../core/generate";
import { unitLimits, type Standing } from "../core/rules";
import { DEFAULT_PREFERENCES, type Preferences } from "../core/score";
import type { Group } from "../core/types";

export interface ScenarioCourse {
  course: string;
  required: boolean;
  excluded: string[];
  locked: string | null;
}

export interface Settings {
  standing: Standing;
  gpa: number | null;
  manualMin: number | null;
  manualMax: number | null;
  gender: "male" | "female" | null;
  blocks: TimeBlock[];
  prefs: Preferences;
  minExamGapDays: number | null;
}

export interface Scenario {
  id: string;
  name: string;
  term: string;
  courses: ScenarioCourse[];
  /** The schedule: course -> chosen group code (manual or from a generated result). */
  picks: Record<string, string>;
  /** Fingerprint of each picked group when it was picked (FR-71). */
  snapshot: Record<string, string>;
  settings: Settings;
  updatedAt: number;
}

export interface AppState {
  scenarios: Scenario[];
  activeId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  standing: "normal",
  gpa: null,
  manualMin: null,
  manualMax: null,
  gender: null,
  blocks: [],
  prefs: DEFAULT_PREFERENCES,
  minExamGapDays: null,
};

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createScenario(term: string, name: string, settings: Settings = DEFAULT_SETTINGS): Scenario {
  return { id: newId(), name, term, courses: [], picks: {}, snapshot: {}, settings, updatedAt: Date.now() };
}

export function initialState(term: string): AppState {
  const s = createScenario(term, "برنامه ۱");
  return { scenarios: [s], activeId: s.id };
}

/** What a group looks like to the schedule; a change means the user should re-check it (FR-71). */
export function fingerprint(g: Group): string {
  return JSON.stringify([g.units, g.teacher, g.sessions, g.exams]);
}

export type Action =
  | { type: "addCourse"; course: string }
  | { type: "removeCourse"; course: string }
  | { type: "setRequired"; course: string; required: boolean }
  | { type: "toggleExcluded"; course: string; code: string }
  | { type: "setLocked"; course: string; code: string | null }
  | { type: "pick"; course: string; group: Group | null }
  | { type: "applyCombination"; groups: Group[] }
  | { type: "clearPicks" }
  | { type: "acceptChanges"; groups: Group[] }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "prefs"; patch: Partial<Preferences> }
  | { type: "addBlock"; block: TimeBlock }
  | { type: "removeBlock"; index: number }
  | { type: "newScenario"; term: string; name: string }
  | { type: "duplicateScenario"; name: string }
  | { type: "renameScenario"; name: string }
  | { type: "deleteScenario" }
  | { type: "switchScenario"; id: string }
  | { type: "importScenarios"; scenarios: Scenario[] }
  | { type: "replace"; state: AppState };

export function active(state: AppState): Scenario {
  return state.scenarios.find((s) => s.id === state.activeId) ?? state.scenarios[0]!;
}

function update(state: AppState, f: (s: Scenario) => Scenario): AppState {
  return {
    ...state,
    scenarios: state.scenarios.map((s) => (s.id === state.activeId ? { ...f(s), updatedAt: Date.now() } : s)),
  };
}

function updateCourse(s: Scenario, course: string, f: (c: ScenarioCourse) => ScenarioCourse): Scenario {
  return { ...s, courses: s.courses.map((c) => (c.course === course ? f(c) : c)) };
}

function withoutKey<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _drop, ...rest } = rec;
  return rest;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "addCourse":
      return update(state, (s) =>
        s.courses.some((c) => c.course === action.course)
          ? s
          : { ...s, courses: [...s.courses, { course: action.course, required: true, excluded: [], locked: null }] },
      );
    case "removeCourse":
      return update(state, (s) => {
        const code = s.picks[action.course];
        return {
          ...s,
          courses: s.courses.filter((c) => c.course !== action.course),
          picks: withoutKey(s.picks, action.course),
          snapshot: code ? withoutKey(s.snapshot, code) : s.snapshot,
        };
      });
    case "setRequired":
      return update(state, (s) => updateCourse(s, action.course, (c) => ({ ...c, required: action.required })));
    case "toggleExcluded":
      return update(state, (s) =>
        updateCourse(s, action.course, (c) => ({
          ...c,
          excluded: c.excluded.includes(action.code) ? c.excluded.filter((x) => x !== action.code) : [...c.excluded, action.code],
          locked: c.locked === action.code ? null : c.locked,
        })),
      );
    case "setLocked":
      return update(state, (s) =>
        updateCourse(s, action.course, (c) => ({
          ...c,
          locked: action.code,
          excluded: action.code ? c.excluded.filter((x) => x !== action.code) : c.excluded,
        })),
      );
    case "pick":
      return update(state, (s) => {
        const old = s.picks[action.course];
        const snapshot = old ? withoutKey(s.snapshot, old) : { ...s.snapshot };
        if (!action.group) return { ...s, picks: withoutKey(s.picks, action.course), snapshot };
        const withCourse = s.courses.some((c) => c.course === action.course)
          ? s.courses
          : [...s.courses, { course: action.course, required: true, excluded: [], locked: null }];
        return {
          ...s,
          courses: withCourse,
          picks: { ...s.picks, [action.course]: action.group.code },
          snapshot: { ...snapshot, [action.group.code]: fingerprint(action.group) },
        };
      });
    case "applyCombination":
      return update(state, (s) => ({
        ...s,
        picks: Object.fromEntries(action.groups.map((g) => [g.course, g.code])),
        snapshot: Object.fromEntries(action.groups.map((g) => [g.code, fingerprint(g)])),
      }));
    case "clearPicks":
      return update(state, (s) => ({ ...s, picks: {}, snapshot: {} }));
    case "acceptChanges":
      return update(state, (s) => ({ ...s, snapshot: { ...s.snapshot, ...Object.fromEntries(action.groups.map((g) => [g.code, fingerprint(g)])) } }));
    case "settings":
      return update(state, (s) => ({ ...s, settings: { ...s.settings, ...action.patch } }));
    case "prefs":
      return update(state, (s) => ({ ...s, settings: { ...s.settings, prefs: { ...s.settings.prefs, ...action.patch } } }));
    case "addBlock":
      return update(state, (s) => ({ ...s, settings: { ...s.settings, blocks: [...s.settings.blocks, action.block] } }));
    case "removeBlock":
      return update(state, (s) => ({ ...s, settings: { ...s.settings, blocks: s.settings.blocks.filter((_, i) => i !== action.index) } }));
    case "newScenario": {
      const s = createScenario(action.term, action.name, active(state).settings);
      return { scenarios: [...state.scenarios, s], activeId: s.id };
    }
    case "duplicateScenario": {
      const src = active(state);
      const s: Scenario = { ...structuredClone(src), id: newId(), name: action.name, updatedAt: Date.now() };
      return { scenarios: [...state.scenarios, s], activeId: s.id };
    }
    case "renameScenario":
      return update(state, (s) => ({ ...s, name: action.name }));
    case "deleteScenario": {
      if (state.scenarios.length === 1) return state;
      const scenarios = state.scenarios.filter((s) => s.id !== state.activeId);
      return { scenarios, activeId: scenarios[0]!.id };
    }
    case "switchScenario":
      return state.scenarios.some((s) => s.id === action.id) ? { ...state, activeId: action.id } : state;
    case "importScenarios": {
      if (action.scenarios.length === 0) return state;
      const taken = new Set(state.scenarios.map((s) => s.name));
      const added = action.scenarios.map((s) => {
        let name = s.name;
        for (let i = 2; taken.has(name); i++) name = `${s.name} (${i})`;
        taken.add(name);
        return { ...s, id: newId(), name, updatedAt: Date.now() };
      });
      return { scenarios: [...state.scenarios, ...added], activeId: added[0]!.id };
    }
    case "replace":
      return action.state;
  }
}

/** Input for the generator (FR-30): all courses of the scenario with its settings. */
export function generateInput(s: Scenario, groups: readonly Group[]): GenerateInput {
  const set = s.settings;
  const courses: CourseChoice[] = s.courses.map((c) => ({
    course: c.course,
    required: c.required,
    excluded: c.excluded,
    locked: c.locked,
  }));
  const wanted = new Set(courses.map((c) => c.course));
  return {
    groups: groups.filter((g) => wanted.has(g.course)),
    courses,
    limits: unitLimits({ gpa: set.gpa, standing: set.standing, manualMin: set.manualMin, manualMax: set.manualMax }),
    gender: set.gender,
    blocks: set.blocks,
    preferences: set.prefs,
  };
}

export interface PickProblem {
  course: string;
  code: string;
  kind: "missing" | "changed";
}

/** FR-71: picked groups that disappeared from, or changed in, newly loaded data. */
export function pickProblems(s: Scenario, byCode: ReadonlyMap<string, Group>): PickProblem[] {
  const out: PickProblem[] = [];
  for (const [course, code] of Object.entries(s.picks)) {
    const g = byCode.get(code);
    if (!g) out.push({ course, code, kind: "missing" });
    else if (s.snapshot[code] !== undefined && s.snapshot[code] !== fingerprint(g)) out.push({ course, code, kind: "changed" });
  }
  return out;
}

// FR-07: moving scenarios between devices as a JSON file.

export const EXPORT_APP = "vahedchin";
export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: typeof EXPORT_APP;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  scenarios: Scenario[];
}

export function exportFile(state: AppState, now = new Date()): ExportFile {
  return { app: EXPORT_APP, version: EXPORT_VERSION, exportedAt: now.toISOString(), scenarios: state.scenarios };
}

export class ImportError extends Error {}

/** Reads an exported file; throws ImportError (Persian message) when it is not one. */
export function parseImport(text: string): Scenario[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("فایل JSON معتبر نیست.");
  }
  const f = raw as Partial<ExportFile> | null;
  if (!f || typeof f !== "object" || f.app !== EXPORT_APP) throw new ImportError("این فایل خروجی واحدچین نیست.");
  if (f.version !== EXPORT_VERSION) throw new ImportError(`نسخه فایل (${String(f.version)}) پشتیبانی نمی‌شود.`);
  if (!Array.isArray(f.scenarios)) throw new ImportError("فایل هیچ برنامه‌ای ندارد.");
  const scenarios = f.scenarios.map(normalizeScenario);
  if (scenarios.some((s) => s === null)) throw new ImportError("بعضی برنامه‌های فایل خراب‌اند.");
  return scenarios as Scenario[];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isStrRecord = (x: unknown): x is Record<string, string> => isObj(x) && Object.values(x).every((v) => typeof v === "string");
const numOrNull = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Checks a stored or imported scenario and fills settings added in later versions. */
export function normalizeScenario(x: unknown): Scenario | null {
  if (!isObj(x) || typeof x.id !== "string" || typeof x.name !== "string" || typeof x.term !== "string") return null;
  if (!Array.isArray(x.courses) || !isStrRecord(x.picks) || !isStrRecord(x.snapshot ?? {})) return null;
  const courses: ScenarioCourse[] = [];
  for (const c of x.courses) {
    if (!isObj(c) || typeof c.course !== "string") return null;
    courses.push({
      course: c.course,
      required: c.required !== false,
      excluded: Array.isArray(c.excluded) ? c.excluded.filter((e): e is string => typeof e === "string") : [],
      locked: typeof c.locked === "string" ? c.locked : null,
    });
  }
  const st = isObj(x.settings) ? x.settings : {};
  const prefs = isObj(st.prefs) ? st.prefs : {};
  const standing = st.standing === "excellent" || st.standing === "probation" ? st.standing : "normal";
  const gender = st.gender === "male" || st.gender === "female" ? st.gender : null;
  const blocks = Array.isArray(st.blocks)
    ? st.blocks.filter(
        (b): b is TimeBlock =>
          isObj(b) && Number.isInteger(b.day) && (b.day as number) >= 0 && (b.day as number) <= 6 && typeof b.start === "string" && typeof b.end === "string",
      )
    : [];
  const weight = (k: keyof Preferences) => (typeof prefs[k] === "number" ? (prefs[k] as number) : (DEFAULT_PREFERENCES[k] as number));
  return {
    id: x.id,
    name: x.name,
    term: x.term,
    courses,
    picks: x.picks,
    snapshot: (x.snapshot as Record<string, string> | undefined) ?? {},
    settings: {
      standing,
      gpa: numOrNull(st.gpa),
      manualMin: numOrNull(st.manualMin),
      manualMax: numOrNull(st.manualMax),
      gender,
      blocks,
      minExamGapDays: numOrNull(st.minExamGapDays),
      prefs: {
        fewerDays: weight("fewerDays"),
        early: weight("early"),
        noClassBefore: typeof prefs.noClassBefore === "string" && prefs.noClassBefore ? prefs.noClassBefore : null,
        lessIdle: weight("lessIdle"),
        teacher: weight("teacher"),
        preferredTeachers: Array.isArray(prefs.preferredTeachers) ? prefs.preferredTeachers.filter((t): t is string => typeof t === "string") : [],
        examSpacing: weight("examSpacing"),
      },
    },
    updatedAt: typeof x.updatedAt === "number" ? x.updatedAt : Date.now(),
  };
}

/** A stored AppState, checked; null if unusable. */
export function normalizeState(x: unknown): AppState | null {
  if (!isObj(x) || !Array.isArray(x.scenarios)) return null;
  const scenarios = x.scenarios.map(normalizeScenario).filter((s): s is Scenario => s !== null);
  if (scenarios.length === 0) return null;
  const activeId = typeof x.activeId === "string" && scenarios.some((s) => s.id === x.activeId) ? x.activeId : scenarios[0]!.id;
  return { scenarios, activeId };
}
