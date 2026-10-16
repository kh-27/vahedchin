/** Lookups over one term's data: by code, by course, by department, and search (FR-47, FR-48). */

import type { Group, TermData } from "../core/types";
import { fold } from "../lib/text";

export interface CourseInfo {
  course: string;
  name: string;
  units: number;
  practicalUnits: number;
  groups: Group[];
  /** Departments that offer at least one group of the course. */
  departments: number[];
  /** Folded name + code + teachers, for search. */
  haystack: string;
}

export interface TermIndex {
  data: TermData;
  byCode: Map<string, Group>;
  courses: Map<string, CourseInfo>;
  /** Courses of each department, by name. */
  byDepartment: Map<number, CourseInfo[]>;
  faculties: string[];
}

export function buildIndex(data: TermData): TermIndex {
  const byCode = new Map<string, Group>();
  const courses = new Map<string, CourseInfo>();
  for (const g of data.groups) {
    byCode.set(g.code, g);
    let c = courses.get(g.course);
    if (!c) {
      c = { course: g.course, name: g.name, units: g.units, practicalUnits: g.practicalUnits, groups: [], departments: [], haystack: "" };
      courses.set(g.course, c);
    }
    c.groups.push(g);
    if (!c.departments.includes(g.department)) c.departments.push(g.department);
  }
  const byDepartment = new Map<number, CourseInfo[]>();
  for (const c of courses.values()) {
    c.groups.sort((a, b) => a.group.localeCompare(b.group));
    c.haystack = fold([c.name, c.course, ...new Set(c.groups.map((g) => g.teacher))].join(" ")).replace(/ /g, "");
    for (const d of c.departments) {
      const list = byDepartment.get(d);
      if (list) list.push(c);
      else byDepartment.set(d, [c]);
    }
  }
  for (const list of byDepartment.values()) list.sort((a, b) => a.name.localeCompare(b.name, "fa"));
  const faculties = [...new Set(data.departments.map((d) => d.faculty))].sort((a, b) => a.localeCompare(b, "fa"));
  return { data, byCode, courses, byDepartment, faculties };
}

/**
 * FR-48: courses whose name, code or teacher contain every query word.
 * Names starting with the query come first, then names containing it, then code/teacher matches.
 */
export function search(index: TermIndex, query: string, limit = 50): { results: CourseInfo[]; more: boolean } {
  const q = fold(query);
  const words = q.split(" ").filter(Boolean);
  if (words.length === 0) return { results: [], more: false };
  const compact = q.replace(/ /g, "");
  const hits: { c: CourseInfo; rank: number }[] = [];
  for (const c of index.courses.values()) {
    if (!words.every((w) => c.haystack.includes(w))) continue;
    const name = fold(c.name).replace(/ /g, "");
    hits.push({ c, rank: name.startsWith(compact) ? 0 : name.includes(compact) ? 1 : 2 });
  }
  hits.sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name, "fa") || a.c.course.localeCompare(b.c.course));
  return { results: hits.slice(0, limit).map((h) => h.c), more: hits.length > limit };
}

/** Department indexes of a faculty, by department then level. */
export function departmentsOf(index: TermIndex, faculty: string): number[] {
  return index.data.departments
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.faculty === faculty)
    .sort((a, b) => a.d.department.localeCompare(b.d.department, "fa") || a.d.level.localeCompare(b.d.level, "fa"))
    .map(({ i }) => i);
}
