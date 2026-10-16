/** FR-45: the weekly table and the exam list as one PNG, drawn on a canvas (no libraries). */

import { DAY_NAMES } from "../core/time";
import type { Group } from "../core/types";
import { timeRange } from "../lib/labels";
import { fa, faDayDate } from "../lib/text";
import { weekLayout, type WeekLayout } from "./weekLayout";

/** Light palette (same as the page's light theme) so the image prints well. */
const COURSE = ["#dbe7ff", "#ffe3cf", "#d9f4e3", "#f8dcef", "#fff3c2", "#dcf2f8", "#e9e0ff", "#ffdcdc", "#e3f0d0", "#e7e9ee"];
const INK = "#1c1d21";
const MUTED = "#5f636d";
const LINE = "#dfe2e8";
const BAD = "#c0352b";
const ACCENT = "#2f5bd3";
const FONT = 'Vazirmatn, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif';

export const WIDTH = 1100;
const PAD = 32;
const GUTTER = 44;
const HEAD = 34;
const PX_PER_MIN = 0.95;
const EXAM_ROW = 34;

export interface PngInput {
  title: string;
  subtitle: string;
  footer: string;
  groups: Group[];
  colorOf: (course: string) => number;
}

interface Sizes {
  top: number; // y of the table header
  tableHeight: number;
  examsTop: number;
  height: number;
}

export function measure(layout: WeekLayout | null, exams: number): Sizes {
  const top = PAD + 74;
  const tableHeight = layout ? HEAD + (layout.t1 - layout.t0) * PX_PER_MIN : 40;
  const examsTop = top + tableHeight + 36;
  const height = examsTop + 40 + Math.max(1, exams) * EXAM_ROW + 56;
  return { top, tableHeight, examsTop, height };
}

function examsOf(groups: Group[]) {
  return groups
    .flatMap((g) => g.exams.map((exam) => ({ g, exam })))
    .sort((a, b) => a.exam.date.localeCompare(b.exam.date) || a.exam.start.localeCompare(b.exam.start));
}

/** Word wrap, at most maxLines lines; the last one gets "…" if cut. */
export function wrap(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function draw(ctx: CanvasRenderingContext2D, input: PngInput): void {
  const layout = weekLayout(input.groups);
  const exams = examsOf(input.groups);
  const size = measure(layout, exams.length);
  const right = WIDTH - PAD;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, size.height);
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(input.title, right, PAD + 26);
  ctx.fillStyle = MUTED;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(input.subtitle, right, PAD + 54);

  // Weekly table: hour gutter on the right, Saturday next to it (RTL).
  if (layout) {
    const colW = (WIDTH - 2 * PAD - GUTTER) / layout.days.length;
    const colX = (i: number) => right - GUTTER - (i + 1) * colW;
    const y0 = size.top + HEAD;
    const yOf = (min: number) => y0 + (min - layout.t0) * PX_PER_MIN;

    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    layout.days.forEach((d, i) => ctx.fillText(DAY_NAMES[d], colX(i) + colW / 2, size.top + 22));

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.font = `12px ${FONT}`;
    for (let m = layout.t0; m <= layout.t1; m += 60) {
      const y = Math.round(yOf(m)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(right - GUTTER, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(fa(m / 60), right - 6, y + 4);
    }
    for (let i = 0; i <= layout.days.length; i++) {
      const x = Math.round(right - GUTTER - i * colW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, yOf(layout.t1));
      ctx.stroke();
    }

    for (const b of layout.blocks) {
      const i = layout.days.indexOf(b.day);
      const laneW = colW / b.lanes;
      const x = colX(i) + colW - (b.lane + 1) * laneW + 2;
      const y = yOf(b.start) + 1;
      const w = laneW - 4;
      const h = Math.max(20, (b.end - b.start) * PX_PER_MIN - 2);
      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = COURSE[input.colorOf(b.group.course) % COURSE.length]!;
      ctx.fill();
      ctx.lineWidth = b.conflict ? 2.5 : 1;
      ctx.strokeStyle = b.conflict ? BAD : "rgba(28,29,33,0.18)";
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.textAlign = "right";
      ctx.fillStyle = INK;
      ctx.font = `bold 13px ${FONT}`;
      const lineH = 17;
      const room = Math.max(1, Math.floor((h - 22) / lineH));
      const lines = wrap(ctx, fa(b.group.name), w - 10 - (b.mark ? 22 : 0), Math.min(3, room));
      lines.forEach((t, k) => ctx.fillText(t, x + w - 5, y + 16 + k * lineH));
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = MUTED;
      const timeY = y + 16 + lines.length * lineH;
      if (timeY < y + h - 2) ctx.fillText(`${fa(b.session.start)}–${fa(b.session.end)}`, x + w - 5, timeY);
      if (b.mark) {
        ctx.textAlign = "left";
        ctx.fillStyle = ACCENT;
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillText(b.mark, x + 5, y + 16);
      }
      ctx.restore();
    }
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = `15px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("کلاس هفتگی ندارد.", right, size.top + 24);
  }

  // Exams
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText("برنامه امتحانات", right, size.examsTop + 20);
  ctx.font = `15px ${FONT}`;
  if (exams.length === 0) {
    ctx.fillStyle = MUTED;
    ctx.fillText("امتحانی ندارد.", right, size.examsTop + 40 + 22);
  }
  exams.forEach(({ g, exam }, k) => {
    const y = size.examsTop + 40 + k * EXAM_ROW;
    ctx.fillStyle = COURSE[input.colorOf(g.course) % COURSE.length]!;
    roundRect(ctx, right - 14, y + 8, 12, 12, 6);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(faDayDate(exam.date), right - 24, y + 20);
    ctx.font = `15px ${FONT}`;
    ctx.fillText(timeRange(exam.start, exam.end), right - 200, y + 20);
    ctx.fillText(`${fa(g.name)}${exam.kind === "practical" ? " (عملی)" : ""}`, right - 360, y + 20);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y + EXAM_ROW - 0.5);
    ctx.lineTo(right, y + EXAM_ROW - 0.5);
    ctx.stroke();
  });

  ctx.fillStyle = MUTED;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(input.footer, right, size.height - PAD + 6);
}

/** Draws at 2x for sharp text and returns a PNG blob. */
export function schedulePng(input: PngInput, scale = 2): Promise<Blob> {
  const layout = weekLayout(input.groups);
  const { height } = measure(layout, examsOf(input.groups).length);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas is not available"));
  ctx.scale(scale, scale);
  draw(ctx, input);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Saves a blob as a file on the user's device (nothing is uploaded). */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
