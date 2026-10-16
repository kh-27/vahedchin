/** FR-41: exams in Jalali date order with the weekday; FR-11/FR-12 marks. */

import { examsConflict } from "../core/conflict";
import { daysBetween } from "../core/time";
import type { Exam, Group } from "../core/types";
import { timeRange } from "../lib/labels";
import { fa, faDayDate } from "../lib/text";
import { courseColor } from "./WeekGrid";

export function ExamList({ groups, colorOf, minGapDays }: { groups: Group[]; colorOf: (course: string) => number; minGapDays: number | null }) {
  const exams = groups
    .flatMap((g) => g.exams.map((exam) => ({ g, exam })))
    .sort((a, b) => a.exam.date.localeCompare(b.exam.date) || a.exam.start.localeCompare(b.exam.start));
  if (exams.length === 0) return <p className="muted">امتحانی در این برنامه نیست.</p>;

  const status = (g: Group, e: Exam) => {
    const others = exams.filter((o) => o.g.code !== g.code);
    if (others.some((o) => examsConflict(o.exam, e))) return "conflict";
    if (others.some((o) => o.exam.date === e.date)) return "same-day";
    if (minGapDays !== null && others.some((o) => Math.abs(daysBetween(o.exam.date, e.date)) < minGapDays)) return "close";
    return "";
  };

  return (
    <ol className="exams">
      {exams.map(({ g, exam }) => {
        const st = status(g, exam);
        return (
          <li key={`${g.code}-${exam.kind}`} className={st}>
            <span className="dot" style={{ background: courseColor(colorOf(g.course)) }} />
            <span className="exam-date">{faDayDate(exam.date)}</span>
            <span className="exam-time">{timeRange(exam.start, exam.end)}</span>
            <span className="exam-name">
              {fa(g.name)}
              {exam.kind === "practical" && " (عملی)"}
            </span>
            {st === "conflict" && <span className="tag bad">تداخل</span>}
            {st === "same-day" && <span className="tag warn">هم‌روز</span>}
            {st === "close" && <span className="tag warn">نزدیک</span>}
          </li>
        );
      })}
    </ol>
  );
}
