/** Clock times and Jalali dates as they appear in the term data. */

import type { Day } from "./types";

const HHMM = /^(\d{2}):(\d{2})$/;
const JALALI = /^(\d{4})\/(\d{2})\/(\d{2})$/;

/** "10:30" -> 630. */
export function toMinutes(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new Error(`invalid time: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`invalid time: ${hhmm}`);
  return h * 60 + min;
}

/** Open intervals overlap: [s1, e1) and [s2, e2). Touching ends do not (FR-10). */
export function overlaps(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

// Jalali calendar (the 33-year-cycle "breaks" algorithm, as in jalaali-js).
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

/** Day of March (Gregorian year jy + 621) on which Farvardin 1 falls. */
function farvardinFirst(jy: number): { gy: number; march: number } {
  const last = BREAKS[BREAKS.length - 1]!;
  if (jy < BREAKS[0]! || jy >= last) throw new Error(`Jalali year out of range: ${jy}`);
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  return { gy, march: 20 + leapJ - leapG };
}

/** Julian Day Number of a Gregorian date. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** "1405/04/06" -> Julian Day Number. */
export function jalaliToJdn(date: string): number {
  const m = JALALI.exec(date);
  if (!m) throw new Error(`invalid Jalali date: ${date}`);
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  const maxDay = jm <= 6 ? 31 : jm <= 11 ? 30 : isLeapJalali(jy) ? 30 : 29;
  if (jm < 1 || jm > 12 || jd < 1 || jd > maxDay) throw new Error(`invalid Jalali date: ${date}`);
  return farvardinFirstJdn(jy) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function farvardinFirstJdn(jy: number): number {
  const { gy, march } = farvardinFirst(jy);
  return gregorianToJdn(gy, 3, march);
}

export function isLeapJalali(jy: number): boolean {
  return farvardinFirstJdn(jy + 1) - farvardinFirstJdn(jy) === 366;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return jalaliToJdn(b) - jalaliToJdn(a);
}

/** Weekday of a Jalali date, Saturday = 0 (FR-41). */
export function weekdayOf(date: string): Day {
  return ((jalaliToJdn(date) + 2) % 7) as Day;
}

export const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;
