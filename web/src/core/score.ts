/** Weighted preferences and the score of a combination (FR-25, FR-31). Lower is better. */

import { jalaliToJdn, toMinutes } from "./time";
import type { Group } from "./types";

export interface Preferences {
  /** Penalty per day of the week with a class. */
  fewerDays: number;
  /** Penalty per day with a class starting before `noClassBefore`. */
  early: number;
  noClassBefore: string | null; // "HH:MM"
  /** Penalty per hour of idle time between classes on the same day. */
  lessIdle: number;
  /** Penalty per chosen group not taught by one of `preferredTeachers`. */
  teacher: number;
  preferredTeachers: string[];
  /** Penalty per exam pair closeness: same day 3, next day 2, two days apart 1. */
  examSpacing: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  fewerDays: 3,
  early: 0,
  noClassBefore: null,
  lessIdle: 2,
  teacher: 0,
  preferredTeachers: [],
  examSpacing: 2,
};

export const EXAM_WINDOW_DAYS = 3;

/** Raw measures of one combination. */
export interface Features {
  days: number;
  earlyDays: number;
  idleHours: number;
  otherTeachers: number;
  examCloseness: number;
}

/** Each preference's weighted share of the score (FR-31). */
export type ScoreParts = Record<keyof Features, number>;

// A day is 5-minute slots from 06:00 to 24:00, packed into 32-bit words.
// Idle time = empty slots between the first and last busy slot of the day.
export const SLOT_MINUTES = 5;
const DAY_START = 6 * 60;
const SLOTS = (24 * 60 - DAY_START) / SLOT_MINUTES; // 216
export const SLOT_WORDS = Math.ceil(SLOTS / 32); // 7

/** Per-group data reused at every node of the search. */
export interface GroupProfile {
  dayMask: number;
  earlyMask: number;
  /** Days with weekly sessions, and each day's busy slots (same order). */
  days: number[];
  slots: Uint32Array[];
  examDays: number[];
  otherTeacher: 0 | 1;
}

export function profile(g: Group, prefs: Preferences): GroupProfile {
  const before = prefs.noClassBefore === null ? null : toMinutes(prefs.noClassBefore);
  const byDay = new Map<number, Uint32Array>();
  let dayMask = 0;
  let earlyMask = 0;
  for (const s of g.sessions) {
    if (s.day === null) continue; // single-date sessions (FR-65)
    const start = toMinutes(s.start);
    let words = byDay.get(s.day);
    if (!words) byDay.set(s.day, (words = new Uint32Array(SLOT_WORDS)));
    markSlots(words, start, toMinutes(s.end));
    dayMask |= 1 << s.day;
    if (before !== null && start < before) earlyMask |= 1 << s.day;
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return {
    dayMask,
    earlyMask,
    days,
    slots: days.map((d) => byDay.get(d)!),
    examDays: g.exams.map((e) => jalaliToJdn(e.date)),
    otherTeacher: prefs.preferredTeachers.includes(g.teacher) ? 0 : 1,
  };
}

/** Mark [start, end) minutes; times are rounded outward to whole slots. */
export function markSlots(words: Uint32Array, start: number, end: number): void {
  const a = Math.max(0, Math.floor((start - DAY_START) / SLOT_MINUTES));
  const b = Math.min(SLOTS, Math.ceil((end - DAY_START) / SLOT_MINUTES));
  for (let i = a; i < b; i++) words[i >>> 5]! |= 1 << (i & 31);
}

export function popcount(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Empty slots between the first and last busy slot in words[offset .. offset + SLOT_WORDS). */
export function idleSlots(words: Uint32Array, offset = 0): number {
  let first = -1;
  let last = -1;
  let busy = 0;
  for (let w = 0; w < SLOT_WORDS; w++) {
    const x = words[offset + w]!;
    if (x === 0) continue;
    if (first < 0) first = w * 32 + (31 - Math.clz32(x & -x));
    last = w * 32 + (31 - Math.clz32(x));
    busy += popcount(x);
  }
  return first < 0 ? 0 : last - first + 1 - busy;
}

/** idleSlots of (words[offset ..] | extra), without writing anything. */
export function idleSlotsWith(words: Uint32Array, offset: number, extra: Uint32Array): number {
  let first = -1;
  let last = -1;
  let busy = 0;
  for (let w = 0; w < SLOT_WORDS; w++) {
    const x = (words[offset + w]! | extra[w]!) >>> 0;
    if (x === 0) continue;
    if (first < 0) first = w * 32 + (31 - Math.clz32(x & -x));
    last = w * 32 + (31 - Math.clz32(x));
    busy += popcount(x);
  }
  return first < 0 ? 0 : last - first + 1 - busy;
}

/** Closeness penalty of exam days a against b. */
export function examCloseness(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (const x of a) for (const y of b) sum += Math.max(0, EXAM_WINDOW_DAYS - Math.abs(x - y));
  return sum;
}

/** Features of a combination, computed from scratch (the generator keeps them incrementally). */
export function features(profiles: readonly GroupProfile[]): Features {
  let dayMask = 0;
  let earlyMask = 0;
  let otherTeachers = 0;
  let closeness = 0;
  const day = new Uint32Array(7 * SLOT_WORDS);
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i]!;
    dayMask |= p.dayMask;
    earlyMask |= p.earlyMask;
    otherTeachers += p.otherTeacher;
    // Only pairs across groups: a group's own final and practical exam are fixed.
    for (let j = 0; j < i; j++) closeness += examCloseness(p.examDays, profiles[j]!.examDays);
    p.days.forEach((d, k) => {
      for (let w = 0; w < SLOT_WORDS; w++) day[d * SLOT_WORDS + w]! |= p.slots[k]![w]!;
    });
  }
  let idle = 0;
  for (let d = 0; d < 7; d++) idle += idleSlots(day, d * SLOT_WORDS);
  return {
    days: popcount(dayMask),
    earlyDays: popcount(earlyMask),
    idleHours: (idle * SLOT_MINUTES) / 60,
    otherTeachers,
    examCloseness: closeness,
  };
}

/** The one place the score is summed, so every caller gets bit-identical numbers. */
export function scoreOf(
  prefs: Preferences,
  days: number,
  earlyDays: number,
  idleHours: number,
  otherTeachers: number,
  examCloseness: number,
): number {
  return (
    prefs.fewerDays * days +
    prefs.early * earlyDays +
    prefs.lessIdle * idleHours +
    prefs.teacher * otherTeachers +
    prefs.examSpacing * examCloseness
  );
}

export function weigh(f: Features, prefs: Preferences): { score: number; parts: ScoreParts } {
  return {
    score: scoreOf(prefs, f.days, f.earlyDays, f.idleHours, f.otherTeachers, f.examCloseness),
    parts: {
      days: prefs.fewerDays * f.days,
      earlyDays: prefs.early * f.earlyDays,
      idleHours: prefs.lessIdle * f.idleHours,
      otherTeachers: prefs.teacher * f.otherTeachers,
      examCloseness: prefs.examSpacing * f.examCloseness,
    },
  };
}
