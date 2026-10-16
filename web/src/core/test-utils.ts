/** Builders for tests. Not part of the app. */

import type { Day, Exam, Group, Session } from "./types";

export function session(day: Day | null, start: string, end: string, over: Partial<Session> = {}): Session {
  return {
    kind: "lecture",
    type: "theory",
    day,
    date: null,
    start,
    end,
    week: "all",
    half: null,
    place: "",
    weekNumber: null,
    ...over,
  };
}

export function exam(date: string, start: string, end: string, kind: Exam["kind"] = "final"): Exam {
  return { kind, date, start, end };
}

/** code "1000001_01" -> course "1000001". */
export function group(code: string, sessions: Session[] = [], exams: Exam[] = [], over: Partial<Group> = {}): Group {
  const [course = code, grp = "01"] = code.split("_");
  return {
    code,
    course,
    group: grp,
    name: `درس ${course}`,
    units: 3,
    practicalUnits: 0,
    capacity: 30,
    registered: 0,
    waitlist: 0,
    gender: "mixed",
    teacher: "",
    sessions,
    exams,
    notes: "",
    otherCenters: false,
    emergencyDrop: true,
    department: 0,
    ...over,
  };
}
