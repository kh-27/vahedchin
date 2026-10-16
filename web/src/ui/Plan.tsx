/** FR-42: hand-made schedule with live warnings; FR-21, FR-22 per course; FR-40, FR-41 views. */

import { useMemo, useState } from "react";
import { findConflicts, groupsConflict } from "../core/conflict";
import { genderAllowed, unitLimits, unitsAllowed } from "../core/rules";
import type { Group } from "../core/types";
import type { Action, Scenario } from "../app/scenario";
import type { TermIndex } from "../app/termIndex";
import { conflictText, groupTitle, sessionLabel, timesSummary, warningText } from "../lib/labels";
import { fa, faNumber } from "../lib/text";
import { ExamList } from "./ExamList";
import { WeekGrid } from "./WeekGrid";

export function Plan({
  index,
  scenario,
  dispatch,
  colorOf,
  onGenerate,
  onBrowse,
}: {
  index: TermIndex;
  scenario: Scenario;
  dispatch: (a: Action) => void;
  colorOf: (course: string) => number;
  onGenerate: () => void;
  onBrowse: () => void;
}) {
  const set = scenario.settings;
  const picked = useMemo(
    () => Object.values(scenario.picks).map((code) => index.byCode.get(code)).filter((g): g is Group => g !== undefined),
    [scenario.picks, index],
  );
  const report = useMemo(
    () => findConflicts(picked, { minExamGapDays: set.minExamGapDays, blocks: set.blocks }),
    [picked, set.minExamGapDays, set.blocks],
  );
  const limits = unitLimits({ gpa: set.gpa, standing: set.standing, manualMin: set.manualMin, manualMax: set.manualMax });
  const units = picked.reduce((t, g) => t + g.units, 0);
  const singleDate = picked.flatMap((g) => g.sessions.filter((s) => s.day === null).map((s) => ({ g, s })));

  if (scenario.courses.length === 0) {
    return (
      <section className="card stack">
        <p>هنوز درسی به این برنامه اضافه نکرده‌اید.</p>
        <button className="primary" onClick={onBrowse}>
          رفتن به فهرست دروس
        </button>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="card stack">
        <div className="row between wrap gap">
          <h2>دروس این برنامه</h2>
          <button className="primary" onClick={onGenerate}>
            چیدن خودکار
          </button>
        </div>
        <ul className="plain stack">
          {scenario.courses.map((c) => {
            const info = index.courses.get(c.course);
            return (
              <CourseRow
                key={c.course}
                course={c.course}
                name={fa(info?.name ?? c.course)}
                groups={(info?.groups ?? []).filter((g) => genderAllowed(g, set.gender))}
                required={c.required}
                excluded={c.excluded}
                locked={c.locked}
                pickedCode={scenario.picks[c.course]}
                others={picked.filter((g) => g.course !== c.course)}
                color={colorOf(c.course)}
                dispatch={dispatch}
              />
            );
          })}
        </ul>
        <p className={unitsAllowed(units, limits) ? "small" : "small bad-text"}>
          جمع واحدهای جدول: {faNumber(units)} (مجاز: {fa(limits.min)} تا {fa(limits.max)})
        </p>
      </div>

      <Warnings report={report} />

      <div className="card">
        <h2>جدول هفتگی</h2>
        <WeekGrid groups={picked} colorOf={colorOf} />
        {singleDate.length > 0 && (
          <div className="small">
            <h3>جلسه‌های تک‌تاریخی (در تداخل هفتگی حساب نمی‌شوند)</h3>
            <ul className="plain">
              {singleDate.map(({ g, s }, i) => (
                <li key={i}>
                  {fa(g.name)}: {sessionLabel(s)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>برنامه امتحانات</h2>
        <ExamList groups={picked} colorOf={colorOf} minGapDays={set.minExamGapDays} />
      </div>
    </section>
  );
}

function Warnings({ report }: { report: ReturnType<typeof findConflicts> }) {
  const items = [
    ...report.conflicts.map((c) => ({ bad: true, text: conflictText(c) })),
    ...report.blocked.map((b) => ({ bad: true, text: `در بازه مسدود: ${groupTitle(b.group)} — ${sessionLabel(b.session)}` })),
    ...report.warnings.map((w) => ({ bad: false, text: warningText(w) })),
  ];
  if (items.length === 0) return null;
  return (
    <div className="card" role="status" aria-live="polite">
      <ul className="plain stack small">
        {items.map((it, i) => (
          <li key={i} className={it.bad ? "bad-text" : "warn-text"}>
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseRow(props: {
  course: string;
  name: string;
  groups: Group[];
  required: boolean;
  excluded: string[];
  locked: string | null;
  pickedCode: string | undefined;
  others: Group[];
  color: number;
  dispatch: (a: Action) => void;
}) {
  const { course, name, groups, required, excluded, locked, pickedCode, others, color, dispatch } = props;
  const [open, setOpen] = useState(false);
  const clashes = (g: Group) => others.some((o) => groupsConflict(o, g));

  return (
    <li className="course-row" style={{ borderInlineStartColor: `var(--c${color % 10})` }}>
      <div className="row between wrap gap">
        <strong>{name}</strong>
        <div className="row gap">
          <label className="check small">
            <input type="checkbox" checked={required} onChange={(e) => dispatch({ type: "setRequired", course, required: e.target.checked })} />
            ضروری
          </label>
          <button className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
            قفل / کنار گذاشتن
          </button>
          <button className="link small bad-text" onClick={() => dispatch({ type: "removeCourse", course })}>
            حذف
          </button>
        </div>
      </div>
      <select
        aria-label={`گروه ${name}`}
        value={pickedCode ?? ""}
        onChange={(e) => dispatch({ type: "pick", course, group: groups.find((g) => g.code === e.target.value) ?? null })}
      >
        <option value="">— بدون گروه در جدول —</option>
        {groups.map((g) => (
          <option key={g.code} value={g.code}>
            {clashes(g) ? "⚠ " : ""}گروه {fa(g.group)}، {g.teacher || "?"}، {timesSummary(g)}
          </option>
        ))}
      </select>
      {open && (
        <ul className="plain small stack">
          {groups.map((g) => (
            <li key={g.code} className="row between gap">
              <span>
                گروه {fa(g.group)}، {g.teacher || "?"}
              </span>
              <span className="row gap">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={locked === g.code}
                    onChange={(e) => dispatch({ type: "setLocked", course, code: e.target.checked ? g.code : null })}
                  />
                  قفل
                </label>
                <label className="check">
                  <input type="checkbox" checked={excluded.includes(g.code)} onChange={() => dispatch({ type: "toggleExcluded", course, code: g.code })} />
                  کنار
                </label>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
