import { describe, expect, it } from "vitest";
import { group, session } from "../core/test-utils";
import { measure, wrap } from "./exportPng";
import { weekLayout } from "./weekLayout";

// measureText stand-in: 10px per character
const ctx = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };

describe("FR-45 PNG layout", () => {
  it("wraps words to the width and cuts with an ellipsis", () => {
    expect(wrap(ctx, "اصول مهندسی سرامیک", 90, 3)).toEqual(["اصول", "مهندسی", "سرامیک"]);
    expect(wrap(ctx, "اصول مهندسی سرامیک", 200, 3)).toEqual(["اصول مهندسی سرامیک"]);
    expect(wrap(ctx, "یک دو سه چهار", 50, 2)).toEqual(["یک دو", "سه…"]);
    expect(wrap(ctx, "یک دو سه چهار", 40, 2)).toEqual(["یک", "دو…"]);
    expect(wrap(ctx, "خیلی‌خیلی‌طولانی", 20, 1)).toEqual(["خیلی‌خیلی‌طولانی"]); // a single long word stays
    expect(wrap(ctx, "  ", 20, 1)).toEqual([]);
  });
  it("is taller with more hours and more exams", () => {
    const short = weekLayout([group("1000001_01", [session(0, "08:00", "10:00")])]);
    const long = weekLayout([group("1000001_01", [session(0, "08:00", "18:00")])]);
    expect(measure(long, 1).height).toBeGreaterThan(measure(short, 1).height);
    expect(measure(short, 5).height).toBeGreaterThan(measure(short, 1).height);
    expect(measure(null, 0).tableHeight).toBe(40);
  });
});
