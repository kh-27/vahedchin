/** FR-47 department browsing, FR-48 search across all courses, FR-49 group details, FR-26 gender. */

import { useMemo, useState } from "react";
import { genderAllowed } from "../core/rules";
import type { Action, Scenario } from "../app/scenario";
import { departmentsOf, search, type CourseInfo, type TermIndex } from "../app/termIndex";
import { timesSummary } from "../lib/labels";
import { fa, faNumber } from "../lib/text";
import { GroupDetails } from "./GroupDetails";

const PAGE = 40;

export function Browse({
  index,
  scenario,
  dispatch,
  faculty,
  department,
  onPlace,
}: {
  index: TermIndex;
  scenario: Scenario;
  dispatch: (a: Action) => void;
  faculty: string;
  department: number | null;
  onPlace: (faculty: string, department: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const depts = useMemo(() => (faculty ? departmentsOf(index, faculty) : []), [index, faculty]);

  const found = useMemo(() => (query.trim() ? search(index, query, 200) : null), [index, query]);
  const list: CourseInfo[] = found ? found.results : department !== null ? (index.byDepartment.get(department) ?? []) : [];

  return (
    <section>
      <div className="card stack">
        <label className="field">
          <span>جست‌وجو در همه دروس (نام، کد یا استاد)</span>
          <input
            type="search"
            value={query}
            placeholder="مثلاً شیمی عمومی"
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        {!query.trim() && (
          <div className="row wrap gap">
            <label className="field grow">
              <span>دانشکده</span>
              <select value={faculty} onChange={(e) => onPlace(e.target.value, null)}>
                <option value="">انتخاب کنید</option>
                {index.faculties.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field grow">
              <span>گروه آموزشی و مقطع</span>
              <select
                value={department ?? ""}
                disabled={!faculty}
                onChange={(e) => onPlace(faculty, e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">انتخاب کنید</option>
                {depts.map((i) => (
                  <option key={i} value={i}>
                    {index.data.departments[i]!.department} — {index.data.departments[i]!.level}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {found && (
        <p className="muted small">
          {found.results.length === 0 ? "درسی پیدا نشد." : `${fa(found.results.length)}${found.more ? "+" : ""} درس`}
        </p>
      )}
      {!found && department === null && <p className="muted">دانشکده و گروه آموزشی را انتخاب کنید، یا جست‌وجو کنید.</p>}

      <ul className="plain courses">
        {list.slice(0, shown).map((c) => (
          <CourseCard key={c.course} c={c} index={index} scenario={scenario} dispatch={dispatch} showFaculty={found !== null} />
        ))}
      </ul>
      {list.length > shown && (
        <button className="secondary wide" onClick={() => setShown(shown + PAGE)}>
          نمایش {fa(Math.min(PAGE, list.length - shown))} درس دیگر
        </button>
      )}
    </section>
  );
}

function CourseCard({
  c,
  index,
  scenario,
  dispatch,
  showFaculty,
}: {
  c: CourseInfo;
  index: TermIndex;
  scenario: Scenario;
  dispatch: (a: Action) => void;
  showFaculty: boolean;
}) {
  const faculties = [...new Set(c.departments.map((d) => index.data.departments[d]!.faculty))].join("، ");
  const [open, setOpen] = useState(false);
  const inPlan = scenario.courses.some((x) => x.course === c.course);
  const gender = scenario.settings.gender;
  const groups = c.groups.filter((g) => genderAllowed(g, gender));
  const hidden = c.groups.length - groups.length;
  const picked = scenario.picks[c.course];

  return (
    <li className={`card course${inPlan ? " in-plan" : ""}`}>
      <div className="course-head">
        <button className="link course-title" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="course-name">{fa(c.name)}</span>
          <span className="muted small">
            {fa(c.course)}، {faNumber(c.units)} واحد، {fa(groups.length)} گروه
          </span>
          {showFaculty && <span className="muted small">{faculties}</span>}
        </button>
        <button
          className={inPlan ? "secondary" : "primary"}
          onClick={() => dispatch(inPlan ? { type: "removeCourse", course: c.course } : { type: "addCourse", course: c.course })}
        >
          {inPlan ? "حذف از برنامه" : "افزودن"}
        </button>
      </div>
      {open && (
        <ul className="plain groups">
          {groups.map((g) => (
            <li key={g.code} className={picked === g.code ? "picked" : ""}>
              <GroupDetails g={g} reportDate={index.data.reportDate} />
              <div className="row gap">
                <button
                  className={picked === g.code ? "secondary small-btn" : "small-btn"}
                  onClick={() => dispatch({ type: "pick", course: c.course, group: picked === g.code ? null : g })}
                >
                  {picked === g.code ? "برداشتن از جدول" : "گذاشتن در جدول"}
                </button>
                <span className="muted small">{timesSummary(g)}</span>
              </div>
            </li>
          ))}
          {hidden > 0 && <li className="muted small">{fa(hidden)} گروه با جنسیت دیگر پنهان شد.</li>}
        </ul>
      )}
    </li>
  );
}
