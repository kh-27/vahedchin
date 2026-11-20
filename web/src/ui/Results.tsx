import { t, tr } from "../lib/i18n";
/** FR-30..FR-34: generated combinations, best first, with each preference's share. */

import { useState } from "react";
import { findConflicts } from "../core/conflict";
import { conflictText } from "../lib/labels";
import type { Group } from "../core/types";
import type { TermIndex } from "../app/termIndex";
import type { WorkerResult } from "../worker/generate.worker";
import { explanationText } from "../lib/labels";
import { fa, faNumber } from "../lib/text";
import { WeekGrid } from "./WeekGrid";

export type GenState =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "done"; result: WorkerResult }
  | { status: "error"; message: string };

const PARTS: Record<string, string> = {
  days: "روزها",
  earlyDays: "کلاس صبح زود",
  idleHours: "ساعت خالی",
  otherTeachers: "استاد غیرترجیحی",
  examCloseness: "نزدیکی امتحان",
};

const PAGE = 20;

export function Results({
  gen,
  index,
  colorOf,
  onCancel,
  onRun,
  onApply,
  canRun,
  manualGroups,
}: {
  gen: GenState;
  index: TermIndex;
  colorOf: (course: string) => number;
  onCancel: () => void;
  onRun: () => void;
  onApply: (groups: Group[]) => void;
  canRun: boolean;
  manualGroups: Group[];
}) {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(0);

  if (gen.status === "idle") {
    return (
      <section className="card stack">
        <p>{t("برای چیدن خودکار، دروس را به برنامه اضافه کنید و ترجیحات را در «تنظیمات» تعیین کنید.")}</p>
        <button className="primary" disabled={!canRun} onClick={onRun}>
          {t("چیدن خودکار")}
        </button>
      </section>
    );
  }
  if (gen.status === "running") {
    return (
      <section className="card stack" aria-busy="true">
        <p>{tr("در حال ساختن ترکیب‌ها…", "Generating schedules…", "جارٍ إنشاء الجداول…")}</p>
        <button className="secondary" onClick={onCancel}>
          {t("لغو")}
        </button>
      </section>
    );
  }
  if (gen.status === "error") {
    return (
      <section className="card stack">
        <p className="bad-text">{tr("خطا در چیدن برنامه:", "Schedule generation error:", "خطأ في إنشاء الجدول:")} {gen.message}</p>
        <button className="primary" onClick={onRun}>
          {t("دوباره")}
        </button>
      </section>
    );
  }

  const r = gen.result;
  const name = (course: string) => `${fa(index.courses.get(course)?.name ?? course)} (${fa(course)})`;
  return (
    <section className="stack">
      <div className="card stack">
        <div className="row between wrap gap">
          <p>
            {r.total === 0
              ? t("هیچ ترکیب معتبری پیدا نشد.")
              : `${fa(r.total.toLocaleString("en-US"))} ${tr("ترکیب معتبر", "valid combinations", "جدول صالح")}${r.truncated ? `; ${tr("نمایش برترین‌ها", "top results shown", "عرض أفضل النتائج")}: ${fa(r.results.length)}` : ""}.`}
            {!r.complete && tr(" جست‌وجو کامل نشد.", " Search was incomplete.", " لم يكتمل البحث.")}
          </p>
          <button className="secondary" onClick={onRun}>
            {t("چیدن دوباره")}
          </button>
        </div>
        {r.explanation && <p className="warn-text">{explanationText(r.explanation, name)}</p>}
        <p className="muted small">{tr("امتیاز کمتر بهتر است. زمان محاسبه:", "Lower scores are better. Calculation time:", "الدرجة الأقل أفضل. وقت الحساب:")} {fa(Math.round(r.ms))} {tr("میلی‌ثانیه.", "ms.", "مللي ثانية.")}</p>
      </div>

      <ol className="plain stack">
        {r.results.slice(0, shown).map((res, i) => {
          const groups = res.codes.map((c) => index.byCode.get(c)).filter((g): g is Group => g !== undefined);
          return (
            <li key={i} className="card stack">
              <div className="row between wrap gap">
                <button className="link" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <strong>
                    {tr("ترکیب", "Combination", "الجدول")} {fa(i + 1)}، {tr("امتیاز", "score", "الدرجة")} {faNumber(Math.round(res.score * 10) / 10)}، {faNumber(res.units)} {tr("واحد", "credits", "وحدات")}
                  </strong>
                </button>
                <button className="primary small-btn" onClick={() => onApply(groups)}>
                  {t("انتخاب این برنامه")}
                </button>
              </div>
              <p className="small muted">
                {Object.entries(res.parts)
                  .filter(([, v]) => v !== 0)
                  .map(([k, v]) => `${t(PARTS[k] ?? k)}: ${faNumber(Math.round(v * 10) / 10)}`)
                  .join("، ") || t("بدون جریمه")}
              </p>
              <p className="small">{groups.map((g) => `${fa(g.name)} (${fa(g.group)})`).join("، ")}</p>
              {open === i && <><WeekGrid groups={[...groups, ...manualGroups]} colorOf={colorOf} />{findConflicts([...groups, ...manualGroups]).conflicts.map((conflict, n) => <p className="bad-text small" key={n}>{conflictText(conflict)}</p>)}</>}
            </li>
          );
        })}
      </ol>
      {r.results.length > shown && (
        <button className="secondary wide" onClick={() => setShown(shown + PAGE)}>
          {t("ترکیب‌های بیشتر")}
        </button>
      )}
    </section>
  );
}
