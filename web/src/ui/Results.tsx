/** FR-30..FR-34: generated combinations, best first, with each preference's share. */

import { useState } from "react";
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
}: {
  gen: GenState;
  index: TermIndex;
  colorOf: (course: string) => number;
  onCancel: () => void;
  onRun: () => void;
  onApply: (groups: Group[]) => void;
  canRun: boolean;
}) {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(0);

  if (gen.status === "idle") {
    return (
      <section className="card stack">
        <p>برای چیدن خودکار، دروس را به برنامه اضافه کنید و ترجیحات را در «تنظیمات» تعیین کنید.</p>
        <button className="primary" disabled={!canRun} onClick={onRun}>
          چیدن خودکار
        </button>
      </section>
    );
  }
  if (gen.status === "running") {
    return (
      <section className="card stack" aria-busy="true">
        <p>در حال ساختن همه ترکیب‌های بدون تداخل…</p>
        <button className="secondary" onClick={onCancel}>
          لغو
        </button>
      </section>
    );
  }
  if (gen.status === "error") {
    return (
      <section className="card stack">
        <p className="bad-text">خطا در چیدن برنامه: {gen.message}</p>
        <button className="primary" onClick={onRun}>
          دوباره
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
              ? "هیچ ترکیب معتبری پیدا نشد."
              : `${fa(r.total.toLocaleString("en-US"))} ترکیب معتبر${r.truncated ? `؛ ${fa(r.results.length)} ترکیب برتر نشان داده شده` : ""}.`}
            {!r.complete && " جست‌وجو کامل نشد."}
          </p>
          <button className="secondary" onClick={onRun}>
            چیدن دوباره
          </button>
        </div>
        {r.explanation && <p className="warn-text">{explanationText(r.explanation, name)}</p>}
        <p className="muted small">امتیاز کمتر بهتر است. زمان محاسبه: {fa(Math.round(r.ms))} میلی‌ثانیه.</p>
      </div>

      <ol className="plain stack">
        {r.results.slice(0, shown).map((res, i) => {
          const groups = res.codes.map((c) => index.byCode.get(c)).filter((g): g is Group => g !== undefined);
          return (
            <li key={i} className="card stack">
              <div className="row between wrap gap">
                <button className="link" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <strong>
                    ترکیب {fa(i + 1)}، امتیاز {faNumber(Math.round(res.score * 10) / 10)}، {faNumber(res.units)} واحد
                  </strong>
                </button>
                <button className="primary small-btn" onClick={() => onApply(groups)}>
                  انتخاب این برنامه
                </button>
              </div>
              <p className="small muted">
                {Object.entries(res.parts)
                  .filter(([, v]) => v !== 0)
                  .map(([k, v]) => `${PARTS[k] ?? k}: ${faNumber(Math.round(v * 10) / 10)}`)
                  .join("، ") || "بدون جریمه"}
              </p>
              <p className="small">{groups.map((g) => `${fa(g.name)} (${fa(g.group)})`).join("، ")}</p>
              {open === i && <WeekGrid groups={groups} colorOf={colorOf} />}
            </li>
          );
        })}
      </ol>
      {r.results.length > shown && (
        <button className="secondary wide" onClick={() => setShown(shown + PAGE)}>
          ترکیب‌های بیشتر
        </button>
      )}
    </section>
  );
}
