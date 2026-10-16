/** FR-40: weekly table with continuous hours, a color per course and odd/even marks. */

import { sessionsConflict } from "../core/conflict";
import { DAY_NAMES, toMinutes } from "../core/time";
import type { Group, Session } from "../core/types";
import { weekLabel } from "../lib/labels";
import { fa } from "../lib/text";

const PX_PER_MIN = 0.9;

interface Block {
  group: Group;
  session: Session;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  conflict: boolean;
}

export function courseColor(index: number): string {
  return `var(--c${index % 10})`;
}

/** Side-by-side lanes for sessions that overlap in time on the same day. */
function layoutDay(items: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1));
    for (const b of cluster) b.lanes = lanes;
    out.push(...cluster);
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((b) => b.end > it.start).map((b) => b.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

export function WeekGrid({ groups, colorOf }: { groups: Group[]; colorOf: (course: string) => number }) {
  const weekly = groups.flatMap((g) => g.sessions.filter((s) => s.day !== null).map((session) => ({ group: g, session })));
  if (weekly.length === 0) return <p className="muted">هنوز کلاسی در این برنامه نیست.</p>;

  const days = [0, 1, 2, 3, 4, 5, ...(weekly.some((w) => w.session.day === 6) ? [6] : [])];
  const t0 = Math.min(...weekly.map((w) => Math.floor(toMinutes(w.session.start) / 60) * 60));
  const t1 = Math.max(...weekly.map((w) => Math.ceil(toMinutes(w.session.end) / 60) * 60));
  const hours = Array.from({ length: (t1 - t0) / 60 + 1 }, (_, i) => t0 / 60 + i);
  const height = (t1 - t0) * PX_PER_MIN;

  const blocksOf = (day: number) =>
    layoutDay(
      weekly
        .filter((w) => w.session.day === day)
        .map((w) => ({
          ...w,
          start: toMinutes(w.session.start),
          end: toMinutes(w.session.end),
          conflict: weekly.some((o) => o.group.course !== w.group.course && sessionsConflict(o.session, w.session)),
        })),
    );

  return (
    <div className="week" role="table" aria-label="جدول هفتگی">
      <div className="week-head" role="row" style={{ gridTemplateColumns: `2.2rem repeat(${days.length}, 1fr)` }}>
        <span />
        {days.map((d) => (
          <span key={d} role="columnheader">
            {DAY_NAMES[d]}
          </span>
        ))}
      </div>
      <div className="week-body" style={{ gridTemplateColumns: `2.2rem repeat(${days.length}, 1fr)`, height }}>
        <div className="week-hours">
          {hours.map((h) => (
            <span key={h} style={{ top: (h * 60 - t0) * PX_PER_MIN }}>
              {fa(h)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="week-day" role="cell" style={{ backgroundSize: `100% ${60 * PX_PER_MIN}px` }}>
            {blocksOf(d).map((b, i) => {
              const mark = b.session.weekNumber !== null ? `ه${fa(b.session.weekNumber)}` : b.session.week === "odd" ? "ف" : b.session.week === "even" ? "ز" : "";
              const extra = weekLabel(b.session);
              return (
                <div
                  key={i}
                  className={`block${b.conflict ? " conflict" : ""}${b.session.week !== "all" || b.session.weekNumber !== null ? " partial" : ""}`}
                  style={{
                    top: (b.start - t0) * PX_PER_MIN,
                    height: Math.max(18, (b.end - b.start) * PX_PER_MIN - 2),
                    insetInlineStart: `${(b.lane / b.lanes) * 100}%`,
                    width: `${100 / b.lanes}%`,
                    background: courseColor(colorOf(b.group.course)),
                  }}
                  title={`${fa(b.group.name)} — ${fa(b.session.start)} تا ${fa(b.session.end)}${extra ? ` — ${extra}` : ""}${b.session.place ? ` — ${fa(b.session.place)}` : ""}`}
                >
                  {mark && <span className="mark">{mark}</span>}
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
