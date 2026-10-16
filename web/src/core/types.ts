/** Shape of data/terms/<term>.json (schemaVersion 1), written by pipeline/golestan. */

/** Saturday = 0 ... Friday = 6. */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Week = "all" | "odd" | "even";
export type Gender = "mixed" | "male" | "female";

export interface Session {
  kind: "lecture" | "problem_solving";
  type: "theory" | "practical";
  /** Weekly session; null for a single-date session (FR-65). */
  day: Day | null;
  /** "YYYY/MM/DD" (Jalali) for a single-date session. */
  date: string | null;
  start: string; // "HH:MM"
  end: string;
  week: Week;
  /** "نیمه1 ت" / "نیمه2 ت": first or second half of the term (A10). */
  half: 1 | 2 | null;
  place: string;
  /** "هفتهN": held only in week N of the term (A11). */
  weekNumber: number | null;
}

export interface Exam {
  kind: "final" | "practical";
  date: string; // "YYYY/MM/DD" (Jalali)
  start: string;
  end: string;
}

export interface Group {
  code: string; // "1118061_01"
  course: string; // "1118061"
  group: string; // "01"
  name: string;
  units: number;
  practicalUnits: number;
  capacity: number;
  registered: number;
  waitlist: number;
  gender: Gender;
  teacher: string;
  sessions: Session[];
  exams: Exam[];
  notes: string;
  otherCenters: boolean;
  emergencyDrop: boolean;
  /** Index into TermData.departments. */
  department: number;
}

export interface Department {
  faculty: string;
  department: string;
  level: string;
}

export interface TermData {
  schemaVersion: 1;
  term: string;
  termTitle: string;
  university: string;
  reportDate: string;
  reportTime: string;
  source: { file: string; sha256: string; pages: number };
  departments: Department[];
  groups: Group[];
}
