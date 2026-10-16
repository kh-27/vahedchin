/** Persian labels for sessions, exams, conflicts and explanations (FR-13, FR-33, FR-49). */

import type { Conflict, ExamWarning } from "../core/conflict";
import type { Explanation } from "../core/generate";
import { DAY_NAMES } from "../core/time";
import type { Exam, Gender, Group, Session } from "../core/types";
import { fa, faDate, faDayDate } from "./text";

export const GENDER: Record<Gender, string> = { mixed: "مختلط", male: "برادران", female: "خواهران" };

export function timeRange(start: string, end: string): string {
  return `${fa(start)} تا ${fa(end)}`;
}

export function sessionKind(s: Session): string {
  const kind = s.kind === "problem_solving" ? "حل تمرین" : s.type === "practical" ? "عملی" : "نظری";
  return kind;
}

/** Week pattern: "", "هفته فرد", "فقط هفته ۱۴", "نیمه اول ترم" ... */
export function weekLabel(s: Session): string {
  const parts: string[] = [];
  if (s.weekNumber !== null) parts.push(`فقط هفته ${fa(s.weekNumber)}`);
  else if (s.week === "odd") parts.push("هفته فرد");
  else if (s.week === "even") parts.push("هفته زوج");
  if (s.half !== null) parts.push(s.half === 1 ? "نیمه اول ترم" : "نیمه دوم ترم");
  return parts.join("، ");
}

export function sessionLabel(s: Session): string {
  const when = s.day !== null ? DAY_NAMES[s.day] : `فقط ${faDate(s.date!)}`;
  const week = weekLabel(s);
  return [sessionKind(s), `${when} ${timeRange(s.start, s.end)}`, week].filter(Boolean).join("، ");
}

export function examLabel(e: Exam): string {
  return `${e.kind === "practical" ? "امتحان عملی" : "امتحان"} ${faDayDate(e.date)}، ${timeRange(e.start, e.end)}`;
}

export function groupTitle(g: Group): string {
  return `${fa(g.name)} (گروه ${fa(g.group)})`;
}

/** One-line summary of a group's weekly times, for pickers. */
export function timesSummary(g: Group): string {
  const weekly = g.sessions.filter((s) => s.day !== null);
  if (weekly.length === 0) return "بدون ساعت هفتگی";
  return weekly
    .map((s) => {
      const mark = s.weekNumber !== null ? ` (هفته ${fa(s.weekNumber)})` : s.week === "odd" ? " (ف)" : s.week === "even" ? " (ز)" : "";
      return `${DAY_NAMES[s.day!]} ${fa(s.start)}${mark}`;
    })
    .join("، ");
}

export function conflictText(c: Conflict): string {
  if (c.kind === "session") {
    return `تداخل کلاس: ${groupTitle(c.a)} — ${sessionLabel(c.sessionA)}، با ${groupTitle(c.b)} — ${sessionLabel(c.sessionB)}`;
  }
  return `تداخل امتحان: ${groupTitle(c.a)} و ${groupTitle(c.b)}، ${faDayDate(c.examA.date)} (${timeRange(c.examA.start, c.examA.end)} و ${timeRange(c.examB.start, c.examB.end)})`;
}

export function warningText(w: ExamWarning): string {
  if (w.kind === "same_day") return `دو امتحان در یک روز: ${groupTitle(w.a)} و ${groupTitle(w.b)}، ${faDayDate(w.examA.date)}`;
  return `فاصله امتحان‌ها ${fa(w.days)} روز: ${groupTitle(w.a)} (${faDayDate(w.examA.date)}) و ${groupTitle(w.b)} (${faDayDate(w.examB.date)})`;
}

export function explanationText(e: Explanation, courseName: (code: string) => string): string {
  switch (e.kind) {
    case "no_candidates": {
      const reasons = [
        e.total === 0 ? "این درس در داده این ترم گروهی ندارد" : "",
        e.notLocked ? `${fa(e.notLocked)} گروه چون گروه دیگری قفل شده` : "",
        e.excluded ? `${fa(e.excluded)} گروه کنار گذاشته‌شده` : "",
        e.gender ? `${fa(e.gender)} گروه با جنسیت دیگر` : "",
        e.blocked ? `${fa(e.blocked)} گروه در بازه‌های مسدود` : "",
      ].filter(Boolean);
      return `درس ضروری «${courseName(e.course)}» هیچ گروه قابل انتخابی ندارد: ${reasons.join("، ")}.`;
    }
    case "required_over_max":
      return `دروس ضروری دست‌کم ${fa(e.minUnits)} واحدند ولی سقف واحد ${fa(e.max)} است. سقف را بالا ببرید یا درسی را اختیاری کنید.`;
    case "under_min":
      return `با همه دروس انتخاب‌شده حداکثر ${fa(e.maxUnits)} واحد می‌شود ولی کف واحد ${fa(e.min)} است. درس اضافه کنید یا کف را پایین بیاورید.`;
    case "required_pair":
      return `همه گروه‌های «${courseName(e.a)}» با همه گروه‌های «${courseName(e.b)}» تداخل دارند. یکی را اختیاری کنید.`;
    case "below_min":
      return `ترکیب بدون تداخل هست، ولی بیشترین واحد ممکن ${fa(e.bestUnits)} است و به کف ${fa(e.min)} واحد نمی‌رسد. درس دیگری اضافه کنید، درسی را ضروری کنید، یا کف واحد را در تنظیمات کم کنید.`;
    case "combination":
      return "هیچ ترکیب بدون تداخلی پیدا نشد؛ تداخل بین سه درس یا بیشتر است. درسی را اختیاری کنید یا بازه‌های مسدود را کم کنید.";
  }
}
