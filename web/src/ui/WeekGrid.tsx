/** FR-40: weekly table with continuous hours, a color per course and odd/even marks. */

import { DAY_NAMES } from "../core/time";
import type { Group } from "../core/types";
import { weekLabel } from "../lib/labels";
import { fa } from "../lib/text";
import { weekLayout } from "./weekLayout";

const PX_PER_MIN = 0.9;

export function courseColor(index: number): string {
  return `var(--c${index % 10})`;
}

export function WeekGrid({ groups, colorOf }: { groups: Group[]; colorOf: (course: string) => number }) {
  const layout = weekLayout(groups);
  if (!layout) return <p className="muted">هنوز کلاسی در این برنامه نیست.</p>;
  const { days, t0, t1, blocks } = layout;
  const hours = Array.from({ length: (t1 - t0) / 60 + 1 }, (_, i) => t0 / 60 + i);
  const columns = `2.2rem repeat(${days.length}, 1fr)`;

  return (
    <div className="week" role="table" aria-label="جدول هفتگی">
      <div className="week-head" role="row" style={{ gridTemplateColumns: columns }}>
        <span />
        {days.map((d) => (
          <span key={d} role="columnheader">
            {DAY_NAMES[d]}
          </span>
        ))}
      </div>
      <div className="week-body" style={{ gridTemplateColumns: columns, height: (t1 - t0) * PX_PER_MIN }}>
        <div className="week-hours">
          {hours.map((h) => (
            <span key={h} style={{ top: (h * 60 - t0) * PX_PER_MIN }}>
              {fa(h)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="week-day" role="cell" style={{ backgroundSize: `100% ${60 * PX_PER_MIN}px` }}>
            {blocks
              .filter((b) => b.day === d)
              .map((b, i) => {
                const extra = weekLabel(b.session);
                return (
                  <div
                    key={i}
                    className={`block${b.conflict ? " conflict" : ""}${b.mark ? " partial" : ""}`}
                    style={{
                      top: (b.start - t0) * PX_PER_MIN,
                      height: Math.max(18, (b.end - b.start) * PX_PER_MIN - 2),
                      insetInlineStart: `${(b.lane / b.lanes) * 100}%`,
                      width: `${100 / b.lanes}%`,
                      background: courseColor(colorOf(b.group.course)),
                    }}
                    title={`${fa(b.group.name)} — ${fa(b.session.start)} تا ${fa(b.session.end)}${extra ? ` — ${extra}` : ""}${b.session.place ? ` — ${fa(b.session.place)}` : ""}`}
                  >
                    {b.mark && <span className="mark">{b.mark}</span>}
                    <span className="block-name">{fa(b.group.name)}</span>
                    <span className="block-time">
                      {fa(b.session.start)}–{fa(b.session.end)}
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
