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

export function Settings({ settings, dispatch }: { settings: S; dispatch: (a: Action) => void }) {
  const set = settings;
  let limitsText: string;
  try {
    const l = unitLimits({ gpa: set.gpa, standing: set.standing, manualMin: set.manualMin, manualMax: set.manualMax });
    limitsText = `واحد مجاز: ${fa(l.min)} تا ${fa(l.max)}`;
  } catch {
    limitsText = "مقادیر واحد نامعتبر است.";
  }
  const patch = (p: Partial<S>) => dispatch({ type: "settings", patch: p });

  return (
    <section className="stack">
      <fieldset className="card stack">
        <legend>سقف و کف واحد</legend>
        {STANDING.map((s) => (
          <label key={s.value} className="check">
            <input type="radio" name="standing" checked={set.gpa === null && set.standing === s.value} onChange={() => patch({ standing: s.value, gpa: null })} />
            {s.label}
          </label>
        ))}
        <label className="field">
          <span>یا معدل ترم قبل</span>
          <NumberInput value={set.gpa} onChange={(gpa) => patch({ gpa: gpa !== null && gpa >= 0 && gpa <= 20 ? gpa : null })} placeholder="مثلاً ۱۷٫۵" />
        </label>
        <div className="row gap">
          <label className="field grow">
            <span>کف دستی</span>
            <NumberInput value={set.manualMin} onChange={(manualMin) => patch({ manualMin })} placeholder="۱۲" />
          </label>
          <label className="field grow">
            <span>سقف دستی</span>
            <NumberInput value={set.manualMax} onChange={(manualMax) => patch({ manualMax })} placeholder="خودکار" />
          </label>
        </div>
        <p className="small">{limitsText}</p>
      </fieldset>

      <fieldset className="card stack">
        <legend>جنسیت</legend>
        <p className="small muted">گروه‌های مختلط همیشه نشان داده می‌شوند.</p>
        {[
          { v: null, l: "نمایش همه گروه‌ها" },
          { v: "female" as const, l: "خواهران" },
          { v: "male" as const, l: "برادران" },
        ].map((o) => (
          <label key={o.l} className="check">
            <input type="radio" name="gender" checked={set.gender === o.v} onChange={() => patch({ gender: o.v })} />
            {o.l}
          </label>
        ))}
      </fieldset>

      <BlocksEditor settings={set} dispatch={dispatch} />

      <fieldset className="card stack">
        <legend>ترجیحات چیدن خودکار</legend>
        <p className="small muted">وزن ۰ یعنی مهم نیست؛ ۱۰ یعنی خیلی مهم.</p>
        {WEIGHTS.map((w) => (
          <label key={w.key} className="field">
            <span>
              {w.label}: {fa(set.prefs[w.key])}
            </span>
            <input type="range" min={0} max={10} step={1} value={set.prefs[w.key]} onChange={(e) => dispatch({ type: "prefs", patch: { [w.key]: Number(e.target.value) } })} />
          </label>
        ))}
        <label className="field">
          <span>ساعت «صبح زود» (کلاس قبل از این ساعت جریمه می‌شود)</span>
          <input type="time" value={set.prefs.noClassBefore ?? ""} onChange={(e) => dispatch({ type: "prefs", patch: { noClassBefore: e.target.value || null } })} />
        </label>
        <label className="field">
          <span>استادهای ترجیحی (با «،» جدا کنید، همان‌طور که در فهرست دروس آمده)</span>
          <input
            type="text"
            defaultValue={set.prefs.preferredTeachers.join("، ")}
            onBlur={(e) =>
              dispatch({
                type: "prefs",
                patch: { preferredTeachers: e.target.value.split(/[،,]/).map((t) => t.trim()).filter(Boolean) },
              })
            }
          />
        </label>
      </fieldset>

      <fieldset className="card stack">
        <legend>هشدار فاصله امتحان‌ها</legend>
        <label className="field">
          <span>اگر دو امتحان کمتر از این تعداد روز فاصله داشتند هشدار بده (خالی: خاموش)</span>
          <NumberInput value={set.minExamGapDays} onChange={(v) => patch({ minExamGapDays: v !== null && v >= 1 ? Math.round(v) : null })} placeholder="خاموش" />
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
      <legend>بازه‌های مسدود</legend>
      <p className="small muted">در این بازه‌ها کلاسی چیده نمی‌شود (مثلاً کار یا رفت‌وآمد).</p>
      <ul className="plain stack">
        {settings.blocks.map((b, i) => (
          <li key={i} className="row between gap">
            <span>
              {DAY_NAMES[b.day]} {timeRange(b.start, b.end)}
            </span>
            <button className="link bad-text" onClick={() => dispatch({ type: "removeBlock", index: i })}>
              حذف
            </button>
          </li>
        ))}
      </ul>
      <div className="row wrap gap">
        <select aria-label="روز" value={day} onChange={(e) => setDay(Number(e.target.value) as Day)}>
          {DAY_NAMES.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input aria-label="از ساعت" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input aria-label="تا ساعت" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button className="secondary" disabled={!valid} onClick={() => dispatch({ type: "addBlock", block: { day, start, end } })}>
          افزودن
        </button>
      </div>
    </fieldset>
  );
}
