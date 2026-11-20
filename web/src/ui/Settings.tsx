import { t, tr } from "../lib/i18n";
/** FR-23 unit limits, FR-24 blocked times, FR-25 weighted preferences, FR-26 gender, FR-12 exam gap. */

import { useState } from "react";
import { MAX_UNITS, unitLimits, type Standing } from "../core/rules";
import { DAY_NAMES } from "../core/time";
import type { Day } from "../core/types";
import type { Action, Settings as S } from "../app/scenario";
import { timeRange } from "../lib/labels";
import { fa, latinDigits } from "../lib/text";

const STANDING: { value: Standing; label: string }[] = [
  { value: "normal", label: `عادی (سقف ${fa(MAX_UNITS.normal)})` },
  { value: "excellent", label: `ممتاز، معدل ≥ ۱۷ (سقف ${fa(MAX_UNITS.excellent)})` },
  { value: "probation", label: `مشروط، معدل < ۱۲ (سقف ${fa(MAX_UNITS.probation)})` },
];

const WEIGHTS: { key: "fewerDays" | "lessIdle" | "examSpacing" | "early" | "teacher"; label: string }[] = [
  { key: "fewerDays", label: "روزهای کمتر" },
  { key: "lessIdle", label: "ساعت خالی کمتر بین کلاس‌ها" },
  { key: "examSpacing", label: "فاصله بیشتر بین امتحان‌ها" },
  { key: "early", label: "کلاس نداشتن قبل از ساعت مشخص" },
  { key: "teacher", label: "استادهای ترجیحی" },
];

/** Accepts "۱۷٫۵", "17.5", "17/5"; empty -> null. */
function parseNumber(s: string): number | null {
  const t = latinDigits(s).replace(/[٫/,]/g, ".").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function Settings({ settings, dispatch, teachers }: { settings: S; dispatch: (a: Action) => void; teachers: string[] }) {
  const set = settings;
  let limitsText: string;
  try {
    const l = unitLimits({ gpa: set.gpa, standing: set.standing, manualMin: set.manualMin, manualMax: set.manualMax });
    limitsText = `${tr("واحد مجاز", "Allowed credits", "الوحدات المسموحة")}: ${fa(l.min)}–${fa(l.max)}`;
  } catch {
    limitsText = t("مقادیر واحد نامعتبر است.");
  }
  const patch = (p: Partial<S>) => dispatch({ type: "settings", patch: p });

  return (
    <section className="stack">
      <fieldset className="card stack">
        <legend>{t("سقف و کف واحد")}</legend>
        {STANDING.map((s) => (
          <label key={s.value} className="check">
            <input type="radio" name="standing" checked={set.gpa === null && set.standing === s.value} onChange={() => patch({ standing: s.value, gpa: null })} />
            {s.value === "normal" ? tr(`عادی (سقف ${fa(MAX_UNITS.normal)})`, `Normal (maximum ${fa(MAX_UNITS.normal)})`, `عادي (الحد الأقصى ${fa(MAX_UNITS.normal)})`) : s.value === "excellent" ? tr(`ممتاز، معدل ≥ ۱۷ (سقف ${fa(MAX_UNITS.excellent)})`, `Excellent, GPA ≥ 17 (maximum ${fa(MAX_UNITS.excellent)})`, `متفوق، المعدل ≥ ١٧ (الحد الأقصى ${fa(MAX_UNITS.excellent)})`) : tr(`مشروط، معدل < ۱۲ (سقف ${fa(MAX_UNITS.probation)})`, `Probation, GPA < 12 (maximum ${fa(MAX_UNITS.probation)})`, `إنذار، المعدل < ١٢ (الحد الأقصى ${fa(MAX_UNITS.probation)})`)}
          </label>
        ))}
        <label className="field">
          <span>{t("یا معدل ترم قبل")}</span>
          <NumberInput value={set.gpa} onChange={(gpa) => patch({ gpa: gpa !== null && gpa >= 0 && gpa <= 20 ? gpa : null })} placeholder="مثلاً ۱۷٫۵" />
        </label>
        <div className="row gap">
          <label className="field grow">
            <span>{t("کف دستی")}</span>
            <NumberInput value={set.manualMin} onChange={(manualMin) => patch({ manualMin })} placeholder="۱۲" />
          </label>
          <label className="field grow">
            <span>{t("سقف دستی")}</span>
            <NumberInput value={set.manualMax} onChange={(manualMax) => patch({ manualMax })} placeholder={t("خودکار")} />
          </label>
        </div>
        <p className="small">{limitsText}</p>
      </fieldset>

      <fieldset className="card stack">
        <legend>{t("جنسیت")}</legend>
        <p className="small muted">{t("گروه‌های مختلط همیشه نشان داده می‌شوند.")}</p>
        {[
          { v: null, l: "نمایش همه گروه‌ها" },
          { v: "female" as const, l: "خواهران" },
          { v: "male" as const, l: "برادران" },
        ].map((o) => (
          <label key={t(o.l)} className="check">
            <input type="radio" name="gender" checked={set.gender === o.v} onChange={() => patch({ gender: o.v })} />
            {t(o.l)}
          </label>
        ))}
      </fieldset>

      <fieldset className="card stack">
        <legend>{tr("ترم آخر", "Final semester", "الفصل الأخير")}</legend>
        <label className="check"><input type="checkbox" checked={set.allowClassConflicts} onChange={(e) => patch({ allowClassConflicts: e.target.checked })} />{tr("اجازه تداخل کلاس‌ها در چیدمان خودکار", "Allow overlapping classes in generated schedules", "السماح بتعارض المحاضرات في الجداول المقترحة")}</label>
        <p className="small muted">{tr("تداخل کلاس‌ها همچنان در برنامه مشخص می‌شود؛ تداخل امتحان مجاز نیست. تأیید نهایی با دانشگاه است.", "Class conflicts remain visible; exam conflicts are not allowed. University approval may be required.", "تظل تعارضات المحاضرات ظاهرة؛ لا يُسمح بتعارض الامتحانات. قد تتطلب موافقة الجامعة.")}</p>
      </fieldset>
      <fieldset className="card stack">
        <legend>{tr("انتخاب استادها", "Instructor selection", "اختيار الأساتذة")}</legend>
        <p className="small muted">{tr("استاد ترجیحی در رتبه‌بندی اثر دارد؛ استاد کنارگذاشته‌شده در چیدمان خودکار استفاده نمی‌شود.", "Preferred instructors affect ranking; excluded instructors are omitted from generated schedules.", "يؤثر الأساتذة المفضلون في الترتيب؛ ويُستبعد الآخرون من الجداول المقترحة.")}</p>
        <label className="field"><span>{tr("استاد ترجیحی", "Preferred instructor", "الأستاذ المفضل")}</span><select value="" onChange={(e) => { const value = e.target.value; if (value && !set.prefs.preferredTeachers.includes(value)) dispatch({ type: "prefs", patch: { preferredTeachers: [...set.prefs.preferredTeachers, value], teacher: set.prefs.teacher || 3 } }); }}><option value="">{t("انتخاب کنید")}</option>{teachers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="row wrap gap">{set.prefs.preferredTeachers.map((name) => <button type="button" key={name} onClick={() => dispatch({ type: "prefs", patch: { preferredTeachers: set.prefs.preferredTeachers.filter((x) => x !== name) } })}>{name} ×</button>)}</div>
        <label className="field"><span>{tr("استادانی که نمی‌خواهم", "Excluded instructors", "الأساتذة المستبعدون")}</span><select value="" onChange={(e) => { const value = e.target.value; if (value && !set.excludedTeachers.includes(value)) patch({ excludedTeachers: [...set.excludedTeachers, value] }); }}><option value="">{t("انتخاب کنید")}</option>{teachers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="row wrap gap">{set.excludedTeachers.map((name) => <button type="button" key={name} onClick={() => patch({ excludedTeachers: set.excludedTeachers.filter((x) => x !== name) })}>{name} ×</button>)}</div>
      </fieldset>
      <BlocksEditor settings={set} dispatch={dispatch} />

      <fieldset className="card stack">
        <legend>{t("ترجیحات چیدن خودکار")}</legend>
        <p className="small muted">{t("وزن ۰ یعنی مهم نیست؛ ۱۰ یعنی خیلی مهم.")}</p>
        {WEIGHTS.map((w) => (
          <label key={w.key} className="field">
            <span>
              {t(w.label)}: {fa(set.prefs[w.key])}
            </span>
            <input type="range" min={0} max={10} step={1} value={set.prefs[w.key]} onChange={(e) => dispatch({ type: "prefs", patch: { [w.key]: Number(e.target.value) } })} />
          </label>
        ))}
        <label className="field">
          <span>{t("ساعت «صبح زود» (کلاس قبل از این ساعت جریمه می‌شود)")}</span>
          <input type="time" value={set.prefs.noClassBefore ?? ""} onChange={(e) => dispatch({ type: "prefs", patch: { noClassBefore: e.target.value || null } })} />
        </label>
      </fieldset>

      <fieldset className="card stack">
        <legend>{t("هشدار فاصله امتحان‌ها")}</legend>
        <label className="field">
          <span>{t("اگر دو امتحان کمتر از این تعداد روز فاصله داشتند هشدار بده (خالی: خاموش)")}</span>
          <NumberInput value={set.minExamGapDays} onChange={(v) => patch({ minExamGapDays: v !== null && v >= 1 ? Math.round(v) : null })} placeholder={t("خاموش")} />
        </label>
      </fieldset>
    </section>
  );
}

function NumberInput({ value, onChange, placeholder }: { value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  const [text, setText] = useState(value === null ? "" : fa(value).replace(".", "٫"));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumber(e.target.value));
      }}
    />
  );
}

function BlocksEditor({ settings, dispatch }: { settings: S; dispatch: (a: Action) => void }) {
  const [day, setDay] = useState<Day>(3);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("18:00");
  const valid = start < end;
  return (
    <fieldset className="card stack">
      <legend>{t("بازه‌های مسدود")}</legend>
      <p className="small muted">{t("در این بازه‌ها کلاسی چیده نمی‌شود (مثلاً کار یا رفت‌وآمد).")}</p>
      <ul className="plain stack">
        {settings.blocks.map((b, i) => (
          <li key={i} className="row between gap">
            <span>
              {t(DAY_NAMES[b.day]!)} {timeRange(b.start, b.end)}
            </span>
            <button className="link bad-text" onClick={() => dispatch({ type: "removeBlock", index: i })}>
              {t("حذف")}
            </button>
          </li>
        ))}
      </ul>
      <div className="row wrap gap">
        <select aria-label={t("روز")} value={day} onChange={(e) => setDay(Number(e.target.value) as Day)}>
          {DAY_NAMES.map((d, i) => (
            <option key={d} value={i}>
              {t(d)}
            </option>
          ))}
        </select>
        <input aria-label={t("از ساعت")} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input aria-label={t("تا ساعت")} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button className="secondary" disabled={!valid} onClick={() => dispatch({ type: "addBlock", block: { day, start, end } })}>
          {t("افزودن")}
        </button>
      </div>
    </fieldset>
  );
}
