/** Conflict detection between groups (FR-10 to FR-13, FR-24, BR-2, BR-3). */

import { daysBetween, overlaps, toMinutes } from "./time";
import type { Day, Exam, Group, Session } from "./types";

/** A blocked weekly time range chosen by the user, e.g. Tuesday afternoon (FR-24). */
export interface TimeBlock {
  day: Day;
  start: string;
  end: string;
}

/** Do the two sessions ever fall in the same week? (A5, A11) */
export function weeksCompatible(a: Session, b: Session): boolean {
  if (a.weekNumber !== null && b.weekNumber !== null) return a.weekNumber === b.weekNumber;
  if (a.weekNumber !== null) return parityMatches(a.weekNumber, b);
  if (b.weekNumber !== null) return parityMatches(b.weekNumber, a);
  return a.week === "all" || b.week === "all" || a.week === b.week;
}

function parityMatches(weekNumber: number, s: Session): boolean {
  if (s.week === "all") return true;
  return (weekNumber % 2 === 1) === (s.week === "odd");
}

/** First-half and second-half sessions never meet (A10); no half means the whole term. */
export function halvesCompatible(a: Session, b: Session): boolean {
  return a.half === null || b.half === null || a.half === b.half;
}

/** FR-10. Single-date sessions (FR-65) take no part in weekly conflicts. */
export function sessionsConflict(a: Session, b: Session): boolean {
  return (
    a.day !== null &&
    a.day === b.day &&
    weeksCompatible(a, b) &&
    halvesCompatible(a, b) &&
    overlaps(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end))
  );
}

/** FR-11 */
export function examsConflict(a: Exam, b: Exam): boolean {
  return a.date === b.date && overlaps(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end));
}

/** FR-24 */
export function sessionInBlock(s: Session, block: TimeBlock): boolean {
  return (
    s.day === block.day &&
    overlaps(toMinutes(s.start), toMinutes(s.end), toMinutes(block.start), toMinutes(block.end))
  );
}

/** Hard conflict between two groups: any session pair or any exam pair (BR-2, BR-3). */
export function groupsConflict(a: Group, b: Group): boolean {
  return (
    a.sessions.some((x) => b.sessions.some((y) => sessionsConflict(x, y))) ||
    a.exams.some((x) => b.exams.some((y) => examsConflict(x, y)))
  );
}

export type Conflict =
  | { kind: "session"; a: Group; b: Group; sessionA: Session; sessionB: Session }
  | { kind: "exam"; a: Group; b: Group; examA: Exam; examB: Exam };

export interface ExamWarning {
  /** same_day: two exams on one day; close: fewer than minExamGapDays days apart (FR-12). */
  kind: "same_day" | "close";
  a: Group;
  b: Group;
  examA: Exam;
  examB: Exam;
  days: number;
}

export interface BlockHit {
  group: Group;
  session: Session;
  block: TimeBlock;
}

export interface ConflictReport {
  /** Every hard conflict, with both sides (FR-13). */
  conflicts: Conflict[];
  warnings: ExamWarning[];
  blocked: BlockHit[];
  /** More than one group of the same course (BR-1). */
  duplicateCourses: string[];
}

export interface ConflictOptions {
  /** Warn when two exams are fewer than this many days apart; null disables (FR-12, default). */
  minExamGapDays?: number | null;
  blocks?: TimeBlock[];
}

/** Full report for a hand-picked schedule (FR-13, FR-42). */
export function findConflicts(groups: readonly Group[], options: ConflictOptions = {}): ConflictReport {
  const minGap = options.minExamGapDays ?? null;
  const report: ConflictReport = { conflicts: [], warnings: [], blocked: [], duplicateCourses: [] };

  for (let i = 0; i < groups.length; i++) {
    const a = groups[i]!;
    for (let j = i + 1; j < groups.length; j++) {
      const b = groups[j]!;
      for (const sessionA of a.sessions)
        for (const sessionB of b.sessions)
          if (sessionsConflict(sessionA, sessionB)) report.conflicts.push({ kind: "session", a, b, sessionA, sessionB });
      for (const examA of a.exams)
        for (const examB of b.exams) {
          if (examsConflict(examA, examB)) {
            report.conflicts.push({ kind: "exam", a, b, examA, examB });
            continue;
          }
          const days = Math.abs(daysBetween(examA.date, examB.date));
          if (days === 0) report.warnings.push({ kind: "same_day", a, b, examA, examB, days });
          else if (minGap !== null && days < minGap) report.warnings.push({ kind: "close", a, b, examA, examB, days });
        }
    }
    for (const block of options.blocks ?? [])
      for (const session of a.sessions) if (sessionInBlock(session, block)) report.blocked.push({ group: a, session, block });
  }

  const seen = new Map<string, number>();
  for (const g of groups) seen.set(g.course, (seen.get(g.course) ?? 0) + 1);
  report.duplicateCourses = [...seen].filter(([, n]) => n > 1).map(([course]) => course);
  return report;
}
