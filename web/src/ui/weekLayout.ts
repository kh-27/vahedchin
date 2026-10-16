/** Layout of the weekly table, shared by the page (FR-40) and the PNG export (FR-45). */

import { sessionsConflict } from "../core/conflict";
import { toMinutes } from "../core/time";
import type { Day, Group, Session } from "../core/types";
import { fa } from "../lib/text";

export interface Block {
  group: Group;
  session: Session;
  day: Day;
  start: number; // minutes
  end: number;
  /** Side-by-side position among overlapping blocks of the same day. */
  lane: number;
  lanes: number;
  conflict: boolean;
  /** "ف", "ز", "ه۱۴" or "" */
  mark: string;
}

export interface WeekLayout {
  days: Day[];
  /** Whole hours around all sessions, in minutes. */
  t0: number;
  t1: number;
  blocks: Block[];
}

export function weekMark(s: Session): string {
  if (s.weekNumber !== null) return `ه${fa(s.weekNumber)}`;
  return s.week === "odd" ? "ف" : s.week === "even" ? "ز" : "";
}

/** null when no group has a weekly session. Saturday..Thursday, plus Friday if used. */
export function weekLayout(groups: readonly Group[]): WeekLayout | null {
  const weekly = groups.flatMap((g) => g.sessions.filter((s) => s.day !== null).map((session) => ({ group: g, session })));
  if (weekly.length === 0) return null;
  const days: Day[] = [0, 1, 2, 3, 4, 5, ...(weekly.some((w) => w.session.day === 6) ? [6 as Day] : [])];
  const t0 = Math.min(...weekly.map((w) => Math.floor(toMinutes(w.session.start) / 60) * 60));
  const t1 = Math.max(...weekly.map((w) => Math.ceil(toMinutes(w.session.end) / 60) * 60));
  const blocks: Block[] = [];
  for (const day of days) {
    const items = weekly
      .filter((w) => w.session.day === day)
      .map((w) => ({
        ...w,
        day,
        start: toMinutes(w.session.start),
        end: toMinutes(w.session.end),
        conflict: weekly.some((o) => o.group.course !== w.group.course && sessionsConflict(o.session, w.session)),
        mark: weekMark(w.session),
      }));
    blocks.push(...lanes(items));
  }
  return { days, t0, t1, blocks };
}

/** Greedy lanes within each cluster of overlapping blocks. */
function lanes(items: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((b) => b.lane + 1));
    for (const b of cluster) b.lanes = n;
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
