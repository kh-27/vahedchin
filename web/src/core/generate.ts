/** Generate and rank every valid combination (FR-30 to FR-33, BR-1 to BR-8). */

import { groupsConflict, sessionInBlock, type TimeBlock } from "./conflict";
import { genderAllowed, type UnitLimits } from "./rules";
import {
  DEFAULT_PREFERENCES,
  SLOT_MINUTES,
  SLOT_WORDS,
  examCloseness,
  features,
  idleSlots,
  popcount,
  profile,
  scoreOf,
  weigh,
  type GroupProfile,
  type Preferences,
  type ScoreParts,
} from "./score";
import type { Group } from "./types";

export interface CourseChoice {
  course: string;
  /** Required courses are in every combination (BR-5, FR-21). */
  required: boolean;
  /** Never chosen (BR-6, FR-22). */
  excluded?: readonly string[];
  /** Always this group (BR-6, FR-22). */
  locked?: string | null;
}

export interface GenerateInput {
  /** Groups of the term; only those of the chosen courses are used. */
  groups: readonly Group[];
  courses: readonly CourseChoice[];
  limits: UnitLimits;
  gender?: "male" | "female" | null;
  blocks?: readonly TimeBlock[];
  preferences?: Partial<Preferences>;
  /** FR-32, default 500. */
  maxResults?: number;
  /** Stop after visiting this many search nodes (safety net). */
  maxNodes?: number;
  /** Polled during the search; return true to stop (FR-34). */
  shouldCancel?: () => boolean;
}

export interface Ranked {
  groups: Group[];
  units: number;
  score: number;
  parts: ScoreParts;
}

export type Explanation =
  | { kind: "no_candidates"; course: string; total: number; gender: number; excluded: number; blocked: number; notLocked: number }
  | { kind: "required_over_max"; minUnits: number; max: number }
  | { kind: "under_min"; maxUnits: number; min: number }
  | { kind: "required_pair"; a: string; b: string }
  | { kind: "combination" };

export interface GenerateResult {
  /** Best combinations, lowest score first, at most maxResults. Equal scores keep search order. */
  results: Ranked[];
  /** Number of valid combinations found. */
  total: number;
  /** total > maxResults (FR-32). */
  truncated: boolean;
  /** False if stopped by maxNodes or cancellation; then total is a lower bound. */
  complete: boolean;
  cancelled: boolean;
  nodes: number;
  /** Why there is no valid combination (FR-33); null when there is one. */
  explanation: Explanation | null;
}

export const DEFAULT_MAX_RESULTS = 500;
export const DEFAULT_MAX_NODES = 50_000_000;
const CANCEL_POLL = 4096;

interface Slot {
  choice: CourseChoice;
  candidates: number[]; // indexes into `pool`
  minUnits: number;
  maxUnits: number;
}

export function generate(input: GenerateInput): GenerateResult {
  const prefs: Preferences = { ...DEFAULT_PREFERENCES, ...input.preferences };
  const maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
  const maxNodes = input.maxNodes ?? DEFAULT_MAX_NODES;
  const { min, max } = input.limits;

  // Candidates per course after locks, exclusions, gender and blocked times.
  const byCourse = new Map<string, Group[]>();
  for (const g of input.groups) {
    const list = byCourse.get(g.course);
    if (list) list.push(g);
    else byCourse.set(g.course, [g]);
  }
  const pool: Group[] = [];
  const slots: Slot[] = [];
  for (const choice of input.courses) {
    const all = byCourse.get(choice.course) ?? [];
    const counts = { total: all.length, gender: 0, excluded: 0, blocked: 0, notLocked: 0 };
    const ok: number[] = [];
    for (const g of all) {
      if (choice.locked != null && g.code !== choice.locked) counts.notLocked++;
      else if (choice.excluded?.includes(g.code)) counts.excluded++;
      else if (!genderAllowed(g, input.gender ?? null)) counts.gender++;
      else if (input.blocks?.some((b) => g.sessions.some((s) => sessionInBlock(s, b)))) counts.blocked++;
      else ok.push(pool.push(g) - 1);
    }
    if (ok.length === 0 && choice.required) {
      return empty({ kind: "no_candidates", course: choice.course, ...counts });
    }
    if (ok.length === 0) continue; // an optional course with no candidate is simply never taken
    const units = ok.map((i) => pool[i]!.units);
    slots.push({ choice, candidates: ok, minUnits: Math.min(...units), maxUnits: Math.max(...units) });
  }

  // Required courses first, fewest candidates first: prunes earliest.
  slots.sort((a, b) => Number(b.choice.required) - Number(a.choice.required) || a.candidates.length - b.candidates.length);

  const requiredMin = slots.filter((s) => s.choice.required).reduce((t, s) => t + s.minUnits, 0);
  if (requiredMin > max) return empty({ kind: "required_over_max", minUnits: requiredMin, max });
  const reachable = slots.reduce((t, s) => t + s.maxUnits, 0);
  if (reachable < min) return empty({ kind: "under_min", maxUnits: reachable, min });

  // Pairwise conflicts, as adjacency lists over pool indexes.
  const n = pool.length;
  const conflictsWith: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (pool[i]!.course !== pool[j]!.course && groupsConflict(pool[i]!, pool[j]!)) {
        conflictsWith[i]!.push(j);
        conflictsWith[j]!.push(i);
      }
  const profiles: GroupProfile[] = pool.map((g) => profile(g, prefs));
  const close = new Int32Array(n * n); // exam closeness of every pair
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) close[i * n + j] = examCloseness(profiles[i]!.examDays, profiles[j]!.examDays);

  // Suffix sums of max units, for the floor (BR-4) pruning.
  const restMax = new Array<number>(slots.length + 1).fill(0);
  for (let d = slots.length - 1; d >= 0; d--) restMax[d] = restMax[d + 1]! + slots[d]!.maxUnits;

  // Search state, kept incrementally and undone on the way back.
  const W = SLOT_WORDS;
  const blockedBy = new Int32Array(n); // > 0: conflicts with a chosen group
  const chosen: number[] = [];
  const busy = new Uint32Array(7 * W); // busy slots per day
  const idleOfDay = new Int32Array(7);
  const savedBusy = new Uint32Array((slots.length + 1) * 7 * W);
  const savedIdle = new Int32Array((slots.length + 1) * 7);
  let dayMask = 0;
  let earlyMask = 0;
  let idle = 0; // idle slots, all days
  let others = 0;
  let closeness = 0;

  const heap = new WorstFirstHeap(maxResults);
  let total = 0;
  let nodes = 0;
  let stopped = false;
  let cancelled = false;

  const take = (c: number, depth: number) => {
    const p = profiles[c]!;
    for (let k = 0; k < p.days.length; k++) {
      const d = p.days[k]!;
      const words = p.slots[k]!;
      const at = d * W;
      const save = (depth * 7 + d) * W;
      for (let w = 0; w < W; w++) {
        savedBusy[save + w] = busy[at + w]!;
        busy[at + w]! |= words[w]!;
      }
      savedIdle[depth * 7 + d] = idleOfDay[d]!;
      const now = idleSlots(busy, at);
      idle += now - idleOfDay[d]!;
      idleOfDay[d] = now;
    }
    others += p.otherTeacher;
    for (const j of chosen) closeness += close[c * n + j]!;
    for (const x of conflictsWith[c]!) blockedBy[x]!++;
    chosen.push(c);
  };

  const untake = (c: number, depth: number) => {
    chosen.pop();
    const p = profiles[c]!;
    for (const x of conflictsWith[c]!) blockedBy[x]!--;
    for (const j of chosen) closeness -= close[c * n + j]!;
    others -= p.otherTeacher;
    for (let k = p.days.length - 1; k >= 0; k--) {
      const d = p.days[k]!;
      const at = d * W;
      const save = (depth * 7 + d) * W;
      for (let w = 0; w < W; w++) busy[at + w] = savedBusy[save + w]!;
      idle += savedIdle[depth * 7 + d]! - idleOfDay[d]!;
      idleOfDay[d] = savedIdle[depth * 7 + d]!;
    }
  };

  const leaf = (units: number) => {
    total++;
    if (maxResults === 0) return;
    const score = scoreOf(prefs, popcount(dayMask), popcount(earlyMask), (idle * SLOT_MINUTES) / 60, others, closeness);
    if (!heap.accepts(score)) return;
    const groups = chosen.map((i) => pool[i]!);
    const { parts } = weigh(features(chosen.map((i) => profiles[i]!)), prefs);
    heap.push({ score, seq: total, ranked: { groups, units, score, parts } });
  };

  const visit = (depth: number, units: number): void => {
    if (++nodes >= maxNodes) {
      stopped = true;
      return;
    }
    if (input.shouldCancel && nodes % CANCEL_POLL === 0 && input.shouldCancel()) {
      stopped = cancelled = true;
      return;
    }
    if (units + restMax[depth]! < min) return;
    if (depth === slots.length) {
      leaf(units);
      return;
    }
    const slot = slots[depth]!;
    for (const c of slot.candidates) {
      const u = units + pool[c]!.units;
      if (blockedBy[c]! > 0 || u > max) continue;
      const prevDays = dayMask;
      const prevEarly = earlyMask;
      dayMask |= profiles[c]!.dayMask;
      earlyMask |= profiles[c]!.earlyMask;
      take(c, depth);
      visit(depth + 1, u);
      untake(c, depth);
      dayMask = prevDays;
      earlyMask = prevEarly;
      if (stopped) return;
    }
    if (!slot.choice.required) visit(depth + 1, units);
  };
  visit(0, 0);

  return {
    results: heap.sorted().map((e) => e.ranked),
    total,
    truncated: total > maxResults,
    complete: !stopped,
    cancelled,
    nodes,
    explanation: total === 0 && !stopped ? explain(slots, conflictsWith) : null,
  };
}

function empty(explanation: Explanation): GenerateResult {
  return { results: [], total: 0, truncated: false, complete: true, cancelled: false, nodes: 0, explanation };
}

/** FR-33: a pair of required courses whose every group pair conflicts, else a general reason. */
function explain(slots: Slot[], conflictsWith: number[][]): Explanation {
  const required = slots.filter((s) => s.choice.required);
  for (let i = 0; i < required.length; i++)
    for (let j = i + 1; j < required.length; j++) {
      const a = required[i]!;
      const b = required[j]!;
      const allClash = a.candidates.every((x) => b.candidates.every((y) => conflictsWith[x]!.includes(y)));
      if (allClash) return { kind: "required_pair", a: a.choice.course, b: b.choice.course };
    }
  return { kind: "combination" };
}

interface Entry {
  score: number;
  /** Discovery order; among equal scores the earlier one ranks first and is kept. */
  seq: number;
  ranked: Ranked;
}

function worse(a: Entry, b: Entry): boolean {
  return a.score > b.score || (a.score === b.score && a.seq > b.seq);
}

/** Keeps the best `cap` entries; the root is the worst kept. */
class WorstFirstHeap {
  private readonly items: Entry[] = [];
  constructor(private readonly cap: number) {}

  /** A later entry with an equal score never displaces a kept one. */
  accepts(score: number): boolean {
    return this.items.length < this.cap || score < this.items[0]!.score;
  }

  push(e: Entry): void {
    const a = this.items;
    if (a.length < this.cap) {
      a.push(e);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!worse(a[i]!, a[p]!)) break;
        [a[i], a[p]] = [a[p]!, a[i]!];
        i = p;
      }
      return;
    }
    a[0] = e;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < a.length && worse(a[l]!, a[m]!)) m = l;
      if (r < a.length && worse(a[r]!, a[m]!)) m = r;
      if (m === i) break;
      [a[i], a[m]] = [a[m]!, a[i]!];
      i = m;
    }
  }

  sorted(): Entry[] {
    return [...this.items].sort((x, y) => x.score - y.score || x.seq - y.seq);
  }
}
