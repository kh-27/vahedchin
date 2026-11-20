import { t, tr } from "../lib/i18n";
/** FR-47 department browsing, FR-48 search across all courses, FR-49 group details, FR-26 gender. */

import { useMemo, useState } from "react";
import { sessionsConflict } from "../core/conflict";
import { manualEventGroup } from "../app/scenario";
import { readReport212 } from "../lib/report212";
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
  const [reportMessage, setReportMessage] = useState("");
  const [reading, setReading] = useState(false);
  const reportCodes = useMemo(() => scenario.reportGroups ? new Set(scenario.reportGroups) : null, [scenario.reportGroups]);
  const reportCourses = useMemo(() => reportCodes ? [...index.courses.values()].filter((c) => c.groups.some((g) => reportCodes.has(g.code))) : null, [index, reportCodes]);
  const depts = useMemo(() => (faculty ? departmentsOf(index, faculty) : []), [index, faculty]);

  const found = useMemo(() => (query.trim() ? search(index, query, reportCodes ? index.courses.size : 200) : null), [index, query, reportCodes]);
  const list: CourseInfo[] = found ? found.results.filter((c) => !reportCodes || c.groups.some((g) => reportCodes.has(g.code))) : reportCourses ?? (department !== null ? (index.byDepartment.get(department) ?? []) : []);

  return (
    <section>
      <div className="card stack"><h2>{tr("گزارش ۲۱۲ گلستان", "Golestan report 212", "تقرير گلستان ٢١٢")}</h2>
        <p className="small muted">{tr("فایل فقط در مرورگر شما خوانده می‌شود. گروه‌های تطبیق‌یافته نمایش داده می‌شوند؛ درس‌های موردنظر را خودتان انتخاب کنید.", "The file is read only in your browser. Matching groups are shown; choose your courses yourself.", "يُقرأ الملف في متصفحك فقط. تظهر المجموعات المطابقة؛ اختر مقرراتك بنفسك.")}</p>
        <label className="field"><span>{tr("بارگذاری فایل PDF", "Upload PDF", "تحميل ملف PDF")}</span><input type="file" accept="application/pdf,.pdf" disabled={reading} onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setReading(true); setReportMessage(""); try { const codes = await readReport212(file); const matches = codes.filter((code) => index.byCode.has(code)); if (!matches.length) { setReportMessage(tr("هیچ گروهی با داده ترم فعلی تطبیق نداشت؛ ترم گزارش را بررسی کنید.", "No groups match the current semester data; check the report semester.", "لا توجد مجموعات مطابقة لبيانات الفصل الحالي؛ تحقق من فصل التقرير.")); return; } dispatch({ type: "setReportGroups", codes: matches }); setShown(PAGE); setReportMessage(tr(`${fa(matches.length)} گروه تطبیق یافت؛ ${fa(codes.length - matches.length)} گروه در داده فعلی نبود.`, `${matches.length} groups matched; ${codes.length - matches.length} were absent from current data.`, `طابقت ${fa(matches.length)} مجموعة؛ لم توجد ${fa(codes.length - matches.length)} مجموعة في البيانات الحالية.`)); } catch { setReportMessage(tr("فایل خوانده نشد یا ساختار گزارش پشتیبانی نمی‌شود.", "The file could not be read or the report format is unsupported.", "تعذرت قراءة الملف أو أن تنسيق التقرير غير مدعوم.")); } finally { setReading(false); } }} /></label>
        {reportMessage && <p role="status" className="small">{reportMessage}</p>}{reportCodes && <div className="row wrap gap"><span>{tr("فیلتر گزارش ۲۱۲ فعال است", "Report 212 filter is active", "تصفية التقرير ٢١٢ مفعّلة")}</span><button className="secondary small-btn" onClick={() => { dispatch({ type: "setReportGroups", codes: null }); setReportMessage(""); }}>{tr("حذف فیلتر", "Clear filter", "إزالة التصفية")}</button></div>}
      </div>
      <div className="card stack">
        <label className="field">
          <span>{t("جست‌وجو در همه دروس (نام، کد یا استاد)")}</span>
          <input
            type="search"
            value={query}
            placeholder={t("مثلاً شیمی عمومی")}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        {!query.trim() && !reportCodes && (
          <div className="row wrap gap">
            <label className="field grow">
              <span>{t("دانشکده")}</span>
              <select value={faculty} onChange={(e) => onPlace(e.target.value, null)}>
                <option value="">{t("انتخاب کنید")}</option>
                {index.faculties.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field grow">
              <span>{t("گروه آموزشی و مقطع")}</span>
              <select
                value={department ?? ""}
                disabled={!faculty}
                onChange={(e) => onPlace(faculty, e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">{t("انتخاب کنید")}</option>
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
        <p className="muted small search-count">
          {list.length === 0 ? t("درسی پیدا نشد.") : `${fa(list.length)}${found.more && !reportCodes ? "+" : ""} ${tr("درس", "courses", "مقررات")}`}
        </p>
      )}
      {!found && !reportCodes && department === null && <p className="muted">{t("دانشکده و گروه آموزشی را انتخاب کنید، یا جست‌وجو کنید.")}</p>}

      <ul className="plain courses">
        {list.slice(0, shown).map((c) => (
          <CourseCard key={c.course} c={c} index={index} scenario={scenario} dispatch={dispatch} showFaculty={found !== null} />
        ))}
      </ul>
      {list.length > shown && (
        <button className="secondary wide" onClick={() => setShown(shown + PAGE)}>
          {tr("نمایش", "Show", "عرض")} {fa(Math.min(PAGE, list.length - shown))} {tr("درس دیگر", "more courses", "مقررات أخرى")}
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
  const groups = c.groups.filter((g) => genderAllowed(g, gender) && (!scenario.reportGroups || scenario.reportGroups.includes(g.code)));
  const hidden = c.groups.length - groups.length;
  const picked = scenario.picks[c.course];
  const others = [...Object.entries(scenario.picks).filter(([course]) => course !== c.course).map(([, code]) => index.byCode.get(code)).filter((g) => g !== undefined), ...scenario.manualEvents.map(manualEventGroup)];
  const classClash = (g: typeof groups[number]) => others.some((other) => g.sessions.some((a) => other.sessions.some((b) => sessionsConflict(a, b))));

  return (
    <li className={`card course${inPlan ? " in-plan" : ""}`}>
      <div className="course-head">
        <button className="link course-title" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="course-name">{fa(c.name)}</span>
          <span className="muted small">
            {fa(c.course)}، {faNumber(c.units)} {tr("واحد", "credits", "وحدات")}، {fa(groups.length)} {tr("گروه", "groups", "مجموعات")}
          </span>
          {showFaculty && <span className="muted small">{faculties}</span>}
        </button>
        <button
          className={inPlan ? "secondary" : "primary"}
          onClick={() => dispatch(inPlan ? { type: "removeCourse", course: c.course } : { type: "addCourse", course: c.course })}
        >
          {inPlan ? t("حذف از برنامه") : t("افزودن")}
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
                  disabled={picked !== g.code && !scenario.settings.allowClassConflicts && classClash(g)}
                  title={picked !== g.code && !scenario.settings.allowClassConflicts && classClash(g) ? tr("تداخل کلاس؛ برای مجاز کردن، گزینه ترم آخر را در تنظیمات فعال کنید.", "Class conflict; enable final-semester mode in settings to allow it.", "تعارض محاضرة؛ فعّل خيار الفصل الأخير للسماح به.") : undefined}
                  onClick={() => dispatch({ type: "pick", course: c.course, group: picked === g.code ? null : g })}
                >
                  {picked === g.code ? t("برداشتن از جدول") : t("گذاشتن در جدول")}
                </button>
                <span className="muted small">{timesSummary(g)} {picked !== g.code && !scenario.settings.allowClassConflicts && classClash(g) && tr("— تداخل کلاس؛ گزینه ترم آخر را در تنظیمات فعال کنید.", "— Class conflict; enable final-semester mode in settings.", "— تعارض محاضرة؛ فعّل خيار الفصل الأخير في الإعدادات.")}</span>
              </div>
            </li>
          ))}
          {hidden > 0 && <li className="muted small">{fa(hidden)} {tr("گروه با جنسیت دیگر پنهان شد.", "groups hidden by the gender filter.", "مجموعات مخفية حسب فلتر الجنس.")}</li>}
        </ul>
      )}
    </li>
  );
}
