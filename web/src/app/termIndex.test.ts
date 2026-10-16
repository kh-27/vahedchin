import { describe, expect, it } from "vitest";
import { group } from "../core/test-utils";
import type { TermData } from "../core/types";
import { buildIndex, departmentsOf, search } from "./termIndex";

const data: TermData = {
  schemaVersion: 1,
  term: "4051",
  termTitle: "نیمسال اول سال تحصیلی 05-06",
  university: "دانشگاه سمنان",
  reportDate: "1405/07/24",
  reportTime: "17:19",
  source: { file: "x.pdf", sha256: "", pages: 1 },
  departments: [
    { faculty: "علوم پایه", department: "شیمی", level: "کارشناسی" },
    { faculty: "مهندسی مواد و متالورژی", department: "مهندسی مواد", level: "کارشناسی" },
    { faculty: "علوم پایه", department: "شیمی", level: "ارشد" },
  ],
  groups: [
    group("1118425_01", [], [], { name: "آزمایشگاه شیمی عمومی", teacher: "قاسمی لیانا", department: 1 }),
    group("1118424_02", [], [], { name: "شیمی عمومی", teacher: "صالحی مهدی", department: 1 }),
    group("1118424_01", [], [], { name: "شیمی عمومی", teacher: "صالحی مهدی", department: 0 }),
    group("2000001_01", [], [], { name: "ریاضی عمومی", teacher: "شیمی‌دان", department: 0 }),
  ],
};

describe("FR-47, FR-48 term index", () => {
  const index = buildIndex(data);
  it("groups by course, sorted by group number, across departments", () => {
    const c = index.courses.get("1118424")!;
    expect(c.groups.map((g) => g.group)).toEqual(["01", "02"]);
    expect(c.departments.sort()).toEqual([0, 1]);
    expect(index.byDepartment.get(1)!.map((x) => x.name)).toEqual(["آزمایشگاه شیمی عمومی", "شیمی عمومی"]);
    expect(index.byCode.get("2000001_01")!.name).toBe("ریاضی عمومی");
  });
  it("search ranks names starting with the query first, then names containing it, then teachers", () => {
    expect(search(index, "شيمي").results.map((c) => c.course)).toEqual(["1118424", "1118425", "2000001"]);
    expect(search(index, "صالحی").results.map((c) => c.course)).toEqual(["1118424"]);
    expect(search(index, "۲۰۰۰۰۰۱").results.map((c) => c.course)).toEqual(["2000001"]);
    expect(search(index, "  ").results).toEqual([]);
    expect(search(index, "شیمی", 1)).toMatchObject({ more: true });
  });
  it("lists a faculty's departments and levels", () => {
    expect(index.faculties).toEqual(["علوم پایه", "مهندسی مواد و متالورژی"]);
    expect(departmentsOf(index, "علوم پایه")).toEqual([2, 0]); // ارشد before کارشناسی
  });
});
