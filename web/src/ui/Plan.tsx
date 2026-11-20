import { t, tr } from "../lib/i18n";
/** FR-42: hand-made schedule with live warnings; FR-21, FR-22 per course; FR-40, FR-41 views. */

import { useMemo, useState } from "react";
import { findConflicts, groupsConflict, sessionsConflict } from "../core/conflict";
import { genderAllowed, unitLimits, unitsAllowed } from "../core/rules";
import type { Day, Group } from "../core/types";
import { DAY_NAMES } from "../core/time";
import { manualEventGroup, newId } from "../app/scenario";
import type { Action, Scenario } from "../app/scenario";
import type { TermIndex } from "../app/termIndex";
import { conflictText, groupTitle, sessionLabel, timesSummary, warningText } from "../lib/labels";
import { fa, faNumber, faReportTime } from "../lib/text";
import { download, schedulePng } from "./exportPng";
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
  const allGroups = useMemo(() => [...picked, ...scenario.manualEvents.map(manualEventGroup)], [picked, scenario.manualEvents]);
  const report = useMemo(
    () => findConflicts(allGroups, { minExamGapDays: set.minExamGapDays, blocks: set.blocks }),
    [allGroups, set.minExamGapDays, set.blocks],
  );
  const limits = unitLimits({ gpa: set.gpa, standing: set.standing, manualMin: set.manualMin, manualMax: set.manualMax });
  const units = picked.reduce((t, g) => t + g.units, 0);
  const [saving, setSaving] = useState(false);
  const singleDate = picked.flatMap((g) => g.sessions.filter((s) => s.day === null).map((s) => ({ g, s })));


  return (
    <section className="stack">
      <div className="card stack">
        <div className="row between wrap gap">
          <h2>{t("دروس این برنامه")}</h2>
          <button className="primary" onClick={onGenerate}>
            {t("چیدن خودکار")}
          </button>
        </div>
        {scenario.courses.length === 0 && <p>{t("هنوز درسی به این برنامه اضافه نکرده‌اید.")} <button className="link" onClick={onBrowse}>{t("رفتن به فهرست دروس")}</button></p>}
        <ul className="plain stack">
          {scenario.courses.map((c) => {
            const info = index.courses.get(c.course);
            return (
              <CourseRow
                key={c.course}
                course={c.course}
                name={fa(info?.name ?? c.course)}
                groups={(info?.groups ?? []).filter((g) => genderAllowed(g, set.gender) && (!scenario.reportGroups || scenario.reportGroups.includes(g.code)))}
                required={c.required}
                excluded={c.excluded}
                locked={c.locked}
                pickedCode={scenario.picks[c.course]}
                others={allGroups.filter((g) => g.course !== c.course)}
                allowClassConflicts={set.allowClassConflicts}
                color={colorOf(c.course)}
                dispatch={dispatch}
              />
            );
          })}
        </ul>
        <p className={unitsAllowed(units, limits) ? "small" : "small bad-text"}>
          {tr("جمع واحدهای جدول", "Total credits", "إجمالي الوحدات")}: {faNumber(units)} ({tr("مجاز", "allowed", "المسموح")}: {fa(limits.min)}–{fa(limits.max)})
        </p>
      </div>

      <ManualEvents scenario={scenario} dispatch={dispatch} />
      <Warnings report={report} />

      <div className="card">
        <div className="row between wrap gap">
          <h2>{t("جدول هفتگی")}</h2>
          <button
            className="secondary small-btn"
            disabled={allGroups.length === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const blob = await schedulePng({
                  title: scenario.name,
                  subtitle: `${fa(index.data.termTitle)}، ${faNumber(units)} واحد، داده گلستان: ${faReportTime(index.data.reportDate, index.data.reportTime)}`,
                  footer: "ساخته‌شده با واحدچین — kh-27.github.io/vahedchin",
                  groups: allGroups,
                  colorOf,
                });
                download(blob, `vahedchin-${index.data.term}-${scenario.name.replace(/[\\/:*?"<>|]+/g, "-")}.png`);
              } finally {
                setSaving(false);
              }
            }}
          >
            {t("دانلود تصویر (PNG)")}
          </button>
        </div>
        <WeekGrid groups={allGroups} colorOf={colorOf} />
        {singleDate.length > 0 && (
          <div className="small">
            <h3>{t("جلسه‌های تک‌تاریخی (در تداخل هفتگی حساب نمی‌شوند)")}</h3>
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
        <h2>{t("برنامه امتحانات")}</h2>
        <ExamList groups={picked} colorOf={colorOf} minGapDays={set.minExamGapDays} />
      </div>
    </section>
  );
}

function ManualEvents({ scenario, dispatch }: { scenario: Scenario; dispatch: (a: Action) => void }) {
  const [name, setName] = useState("");
  const [day, setDay] = useState<Day>(0);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [place, setPlace] = useState("");
  return <section className="card stack"><h2>{tr("افزودن فعالیت دستی", "Add a personal activity", "إضافة نشاط يدوي")}</h2>
    <p className="small muted">{tr("حل تمرین، کلاس مازاد یا کار شخصی را به جدول اضافه کنید. این بازه در چیدمان خودکار مسدود می‌شود.", "Add a tutorial, extra class or personal activity. This time is blocked when generating schedules.", "أضف تمريناً أو محاضرة إضافية أو نشاطاً شخصياً. يُحظر هذا الوقت عند إنشاء الجداول.")}</p>
    <div className="row wrap gap"><label className="field grow"><span>{tr("عنوان", "Title", "العنوان")}</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label className="field"><span>{t("روز")}</span><select value={day} onChange={(e) => setDay(Number(e.target.value) as Day)}>{DAY_NAMES.map((d, i) => <option value={i} key={d}>{t(d)}</option>)}</select></label>
    <label className="field"><span>{t("از ساعت")}</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="field"><span>{t("تا ساعت")}</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
    <label className="field grow"><span>{tr("مکان (اختیاری)", "Location (optional)", "المكان (اختياري)")}</span><input type="text" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
    <button className="secondary" disabled={!name.trim() || !start || !end || start >= end} onClick={() => { dispatch({ type: "addManualEvent", event: { id: newId(), name: name.trim(), day, start, end, place: place.trim() } }); setName(""); setPlace(""); }}>{t("افزودن")}</button></div>
    <ul className="plain stack">{scenario.manualEvents.map((event) => <li key={event.id} className="row between gap"><span>{event.name} — {t(DAY_NAMES[event.day]!)} {fa(event.start)}–{fa(event.end)} {event.place}</span><button className="link bad-text" onClick={() => dispatch({ type: "removeManualEvent", id: event.id })}>{t("حذف")}</button></li>)}</ul>
  </section>;
}

function Warnings({ report }: { report: ReturnType<typeof findConflicts> }) {
  const items = [
    ...report.conflicts.map((c) => ({ bad: true, text: conflictText(c) })),
    ...report.blocked.map((b) => ({ bad: true, text: `${tr("در بازه مسدود", "Blocked time", "وقت محظور")}: ${groupTitle(b.group)} — ${sessionLabel(b.session)}` })),
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
  allowClassConflicts: boolean;
  color: number;
  dispatch: (a: Action) => void;
}) {
  const { course, name, groups, required, excluded, locked, pickedCode, others, allowClassConflicts, color, dispatch } = props;
  const [open, setOpen] = useState(false);
  const clashes = (g: Group) => others.some((o) => groupsConflict(o, g));
  const classClash = (g: Group) => others.some((o) => g.sessions.some((a) => o.sessions.some((b) => sessionsConflict(a, b))));

  return (
    <li className="course-row" style={{ borderInlineStartColor: `var(--c${color % 10})` }}>
      <div className="row between wrap gap">
        <strong>{name}</strong>
        <div className="row gap">
          <label className="check small">
            <input type="checkbox" checked={required} onChange={(e) => dispatch({ type: "setRequired", course, required: e.target.checked })} />
            {t("ضروری")}
          </label>
          <button className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
            {t("قفل / کنار گذاشتن")}
          </button>
          <button className="link small bad-text" onClick={() => dispatch({ type: "removeCourse", course })}>
            {t("حذف")}
          </button>
        </div>
      </div>
      {!allowClassConflicts && groups.some(classClash) && <p className="small muted">{tr("گروه‌های دارای تداخل کلاس فقط با فعال‌کردن گزینه ترم آخر قابل انتخاب‌اند.", "Overlapping classes require final-semester mode.", "تتطلب المحاضرات المتعارضة تفعيل خيار الفصل الأخير.")}</p>}
      <select
        aria-label={`${tr("گروه", "Group", "المجموعة")} ${name}`}
        value={pickedCode ?? ""}
        onChange={(e) => dispatch({ type: "pick", course, group: groups.find((g) => g.code === e.target.value) ?? null })}
      >
        <option value="">{t("— بدون گروه در جدول —")}</option>
        {groups.map((g) => (
          <option key={g.code} value={g.code} disabled={g.code !== pickedCode && !allowClassConflicts && classClash(g)}>
            {clashes(g) ? "⚠ " : ""}{tr("گروه", "Group", "المجموعة")} {fa(g.group)}، {g.teacher || "?"}، {timesSummary(g)}
          </option>
        ))}
      </select>
      {open && (
        <ul className="plain small stack">
          {groups.map((g) => (
            <li key={g.code} className="row between gap">
              <span>
                {tr("گروه", "Group", "المجموعة")} {fa(g.group)}، {g.teacher || "?"}
              </span>
              <span className="row gap">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={locked === g.code}
                    onChange={(e) => dispatch({ type: "setLocked", course, code: e.target.checked ? g.code : null })}
                  />
                  {t("قفل")}
                </label>
                <label className="check">
                  <input type="checkbox" checked={excluded.includes(g.code)} onChange={() => dispatch({ type: "toggleExcluded", course, code: g.code })} />
                  {t("کنار")}
                </label>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
