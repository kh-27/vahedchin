/** Semnan University undergraduate rules (A6, FR-23) and the gender filter (FR-26). */

import type { Group } from "./types";

/** normal: 20 units; excellent ("الف", previous-term GPA >= 17): 24; probation ("مشروط", GPA < 12): 16. */
export type Standing = "normal" | "excellent" | "probation";

export const MIN_UNITS = 12;
export const MAX_UNITS: Record<Standing, number> = { normal: 20, excellent: 24, probation: 16 };

export function standingFromGpa(gpa: number): Standing {
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > 20) throw new Error(`invalid GPA: ${gpa}`);
  if (gpa >= 17) return "excellent";
  if (gpa < 12) return "probation";
  return "normal";
}

export interface UnitInput {
  /** Previous-term GPA; takes precedence over standing. */
  gpa?: number | null;
  standing?: Standing;
  /** The user's own numbers always win (A6). */
  manualMin?: number | null;
  manualMax?: number | null;
}

export interface UnitLimits {
  min: number;
  max: number;
}

export function unitLimits(input: UnitInput = {}): UnitLimits {
  const standing = input.gpa != null ? standingFromGpa(input.gpa) : (input.standing ?? "normal");
  const min = input.manualMin ?? MIN_UNITS;
  const max = input.manualMax ?? MAX_UNITS[standing];
  if (min < 0 || max < min) throw new Error(`invalid unit limits: ${min}..${max}`);
  return { min, max };
}

/** BR-4 */
export function unitsAllowed(total: number, limits: UnitLimits): boolean {
  return total >= limits.min && total <= limits.max;
}

/** BR-8: with the user's gender set, only "mixed" and that gender's groups are allowed. */
export function genderAllowed(group: Group, userGender: "male" | "female" | null): boolean {
  return userGender === null || group.gender === "mixed" || group.gender === userGender;
}
