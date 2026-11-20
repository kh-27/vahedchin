/** Persian labels for sessions, exams, conflicts and explanations (FR-13, FR-33, FR-49). */

import { t, tr } from "./i18n";
import type { Conflict, ExamWarning } from "../core/conflict";
import type { Explanation } from "../core/generate";
import { DAY_NAMES } from "../core/time";
import type { Exam, Gender, Group, Session } from "../core/types";
import { fa, faDate, faDayDate } from "./text";

export const GENDER: Record<Gender, string> = { mixed: "مختلط", male: "برادران", female: "خواهران" };

export function timeRange(start: string, end: string): string {
  return `${fa(start)} ${tr("تا", "to", "إلى")} ${fa(end)}`;
}

export function sessionKind(s: Session): string {
  const kind = s.kind === "problem_solving" ? "حل تمرین" : s.type === "practical" ? "عملی" : "نظری";
  return t(kind);
}

/** Week pattern: "", "هفته فرد", "فقط هفته ۱۴", "نیمه اول ترم" ... */
export function weekLabel(s: Session): string {
  const parts: string[] = [];
  if (s.weekNumber !== null) parts.push(tr(`فقط هفته ${fa(s.weekNumber)}`, `Week ${fa(s.weekNumber)} only`, `الأسبوع ${fa(s.weekNumber)} فقط`));
  else if (s.week === "odd") parts.push(tr("هفته فرد", "Odd weeks", "الأسابيع الفردية"));
  else if (s.week === "even") parts.push(tr("هفته زوج", "Even weeks", "الأسابيع الزوجية"));
  if (s.half !== null) parts.push(s.half === 1 ? tr("نیمه اول ترم", "First half of semester", "النصف الأول من الفصل") : tr("نیمه دوم ترم", "Second half of semester", "النصف الثاني من الفصل"));
  return parts.join("، ");
}

export function sessionLabel(s: Session): string {
  const when = s.day !== null ? t(DAY_NAMES[s.day]!) : `${tr("فقط", "Only", "فقط")} ${faDate(s.date!)}`;
  const week = weekLabel(s);
  return [sessionKind(s), `${when} ${timeRange(s.start, s.end)}`, week].filter(Boolean).join("، ");
}

export function examLabel(e: Exam): string {
  return `${e.kind === "practical" ? tr("امتحان عملی", "Practical exam", "امتحان عملي") : tr("امتحان", "Exam", "امتحان")} ${faDayDate(e.date)}، ${timeRange(e.start, e.end)}`;
}

export function groupTitle(g: Group): string {
  return `${fa(g.name)} (${tr("گروه", "Group", "المجموعة")} ${fa(g.group)})`;
}

/** One-line summary of a group's weekly times, for pickers. */
export function timesSummary(g: Group): string {
  const weekly = g.sessions.filter((s) => s.day !== null);
  if (weekly.length === 0) return t("بدون ساعت هفتگی");
  return weekly
    .map((s) => {
      const mark = s.weekNumber !== null ? ` (${tr("هفته", "Week", "الأسبوع")} ${fa(s.weekNumber)})` : s.week === "odd" ? ` (${tr("ف", "odd", "فردي")})` : s.week === "even" ? ` (${tr("ز", "even", "زوجي")})` : "";
      return `${t(DAY_NAMES[s.day!]!)} ${fa(s.start)}${mark}`;
    })
    .join("، ");
}

export function conflictText(c: Conflict): string {
  if (c.kind === "session") {
    return `${tr("تداخل کلاس", "Class conflict", "تعارض المحاضرات")}: ${groupTitle(c.a)} — ${sessionLabel(c.sessionA)} / ${groupTitle(c.b)} — ${sessionLabel(c.sessionB)}`;
  }
  return `${tr("تداخل امتحان", "Exam conflict", "تعارض الامتحانات")}: ${groupTitle(c.a)} / ${groupTitle(c.b)}، ${faDayDate(c.examA.date)} (${timeRange(c.examA.start, c.examA.end)} / ${timeRange(c.examB.start, c.examB.end)})`;
}

export function warningText(w: ExamWarning): string {
  if (w.kind === "same_day") return `${tr("دو امتحان در یک روز", "Two exams on the same day", "امتحانان في اليوم نفسه")}: ${groupTitle(w.a)} / ${groupTitle(w.b)}، ${faDayDate(w.examA.date)}`;
  return `${tr("فاصله امتحان‌ها", "Days between exams", "الأيام بين الامتحانات")}: ${fa(w.days)} — ${groupTitle(w.a)} (${faDayDate(w.examA.date)}) / ${groupTitle(w.b)} (${faDayDate(w.examB.date)})`;
}

export function explanationText(e: Explanation, courseName: (code: string) => string): string {
  switch (e.kind) {
    case "no_candidates": {
      const reasons = [
        e.total === 0 ? tr("این درس در داده این ترم گروهی ندارد", "no groups offered this semester", "لا توجد مجموعات في هذا الفصل") : "",
        e.notLocked ? `${fa(e.notLocked)} ${tr("گروه چون گروه دیگری قفل شده", "groups excluded by a lock", "مجموعات مستبعدة بسبب التثبيت")}` : "",
        e.excluded ? `${fa(e.excluded)} ${tr("گروه کنار گذاشته‌شده", "excluded groups", "مجموعات مستبعدة")}` : "",
        e.gender ? `${fa(e.gender)} ${tr("گروه با جنسیت دیگر", "groups filtered by gender", "مجموعات مستبعدة حسب الجنس")}` : "",
        e.blocked ? `${fa(e.blocked)} ${tr("گروه در بازه‌های مسدود", "groups in blocked times", "مجموعات في أوقات محظورة")}` : "",
      ].filter(Boolean);
      return tr(`درس ضروری «${courseName(e.course)}» هیچ گروه قابل انتخابی ندارد: ${reasons.join("، ")}.`, `Required course “${courseName(e.course)}” has no available groups: ${reasons.join(", ")}.`, `لا توجد مجموعات متاحة للمقرر الإلزامي «${courseName(e.course)}»: ${reasons.join("، ")}.`);
    }
    case "required_over_max":
      return tr(`دروس ضروری دست‌کم ${fa(e.minUnits)} واحدند ولی سقف واحد ${fa(e.max)} است. سقف را بالا ببرید یا درسی را اختیاری کنید.`, `Required courses need at least ${fa(e.minUnits)} credits, above the ${fa(e.max)} credit limit. Raise the limit or make a course optional.`, `تحتاج المقررات الإلزامية إلى ${fa(e.minUnits)} وحدة على الأقل، وتتجاوز الحد ${fa(e.max)}. ارفع الحد أو اجعل مقرراً اختيارياً.`);
    case "under_min":
      return tr(`با همه دروس انتخاب‌شده حداکثر ${fa(e.maxUnits)} واحد می‌شود ولی کف واحد ${fa(e.min)} است. درس اضافه کنید یا کف را پایین بیاورید.`, `Selected courses total at most ${fa(e.maxUnits)} credits, below the minimum of ${fa(e.min)}. Add courses or lower the minimum.`, `مجموع المقررات المختارة ${fa(e.maxUnits)} وحدة كحد أقصى، أقل من الحد الأدنى ${fa(e.min)}. أضف مقررات أو خفّض الحد.`);
    case "required_pair":
      return tr(`همه گروه‌های «${courseName(e.a)}» با همه گروه‌های «${courseName(e.b)}» تداخل دارند. یکی را اختیاری کنید.`, `Every group of “${courseName(e.a)}” conflicts with every group of “${courseName(e.b)}”. Make one optional.`, `تتعارض جميع مجموعات «${courseName(e.a)}» مع مجموعات «${courseName(e.b)}». اجعل أحدهما اختيارياً.`);
    case "below_min":
      return tr(`ترکیب بدون تداخل هست، ولی بیشترین واحد ممکن ${fa(e.bestUnits)} است و به کف ${fa(e.min)} واحد نمی‌رسد. درس دیگری اضافه کنید، درسی را ضروری کنید، یا کف واحد را در تنظیمات کم کنید.`, `Conflict-free schedules exist, but the maximum is ${fa(e.bestUnits)} credits, below ${fa(e.min)}. Add a course, require a course, or lower the minimum.`, `توجد جداول دون تعارض، لكن الحد الممكن ${fa(e.bestUnits)} وحدة وهو أقل من ${fa(e.min)}. أضف مقرراً أو اجعله إلزامياً أو خفّض الحد الأدنى.`);
    case "combination":
      return tr("هیچ ترکیب بدون تداخلی پیدا نشد؛ تداخل بین سه درس یا بیشتر است. درسی را اختیاری کنید یا بازه‌های مسدود را کم کنید.", "No conflict-free combination found; three or more courses conflict. Make a course optional or reduce blocked times.", "لم يُعثر على جدول دون تعارض؛ تتعارض ثلاثة مقررات أو أكثر. اجعل مقرراً اختيارياً أو قلّل الأوقات المحظورة.");
  }
}
