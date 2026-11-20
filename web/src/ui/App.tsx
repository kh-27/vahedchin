import { setLanguage, t, tr, type Language } from "../lib/i18n";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { active, generateInput, initialState, manualEventGroup, pickProblems, reducer, type AppState } from "../app/scenario";
import { runGenerate, type Running } from "../app/runGenerate";
import type { TermIndex } from "../app/termIndex";
import { useTerm } from "../app/useTerm";
import { useInstallPrompt, useOnline } from "../app/usePwa";
import { Backup } from "./Backup";
import { Directory118 } from "./Directory118";
import { loadState, persist, saveState } from "../storage/db";
import { fa, faReportTime } from "../lib/text";
import { Browse } from "./Browse";
import { Plan } from "./Plan";
import { Results, type GenState } from "./Results";
import { Settings } from "./Settings";

type Tab = "courses" | "plan" | "results" | "settings" | "directory";
const TABS: { id: Tab; label: string }[] = [
  { id: "courses", label: "دروس" },
  { id: "plan", label: "برنامه" },
  { id: "results", label: "چیدن خودکار" },
  { id: "settings", label: "تنظیمات" },
  { id: "directory", label: "۱۱۸" },
];

export function App() {
  const [language, changeLanguage] = useState<Language>(() => {
    try { const saved = localStorage.getItem("language"); return saved === "en" || saved === "ar" ? saved : "fa"; } catch { return "fa"; }
  });
  setLanguage(language);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "en" ? "ltr" : "rtl";
    try { localStorage.setItem("language", language); } catch { /* private browsing */ }
  }, [language]);
  const [theme, setTheme] = useState(() => {
    const saved = remembered<string>("theme", "");
    return saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    remember("theme", theme);
  }, [theme]);
  const [entered, setEntered] = useState(() => remembered("entered", false));
  const [firstLoad] = useState(() => !remembered("intro-seen", false));
  const term = useTerm();
  useEffect(() => {
    if (term.status === "ready") remember("intro-seen", true);
  }, [term.status]);
  const controls = <div className="row gap appearance">
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? tr("☀ حالت روشن", "☀ Light mode", "☀ الوضع الفاتح") : tr("☾ حالت تاریک", "☾ Dark mode", "☾ الوضع الداكن")}
    </button>
    <select aria-label="Language / اللغة / زبان" value={language} onChange={(e) => changeLanguage(e.target.value as Language)}>
      <option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option>
    </select>
  </div>;
  if (firstLoad && term.status === "loading") return (
    <main className="intro splash" role="status">
      <span className="seal" aria-hidden="true">و</span>
      <h1>{t("واحدچین")}</h1><progress aria-label={t("در حال دریافت داده ارائه دروس…")} />
      <p>{t("در حال دریافت داده ارائه دروس…")}</p>
    </main>
  );
  if (term.status === "loading") return <Shell>{t("در حال دریافت داده ارائه دروس…")}</Shell>;
  if (term.status === "error") return <Shell>{tr("داده دریافت نشد:", "Could not load data:", "تعذر تحميل البيانات:")} {term.message}</Shell>;
  if (!entered) return (
    <main className="entry app">
      {controls}
      <section className="entry-card">
        <div className="entry-cover" aria-hidden="true"><span className="seal">و</span><div className="calendar-art"><i/><i/><i/><i/></div></div>
        <div className="entry-copy"><p>{tr("دانشگاه سمنان", "Semnan University", "جامعة سمنان")}</p>
          <h1>{t("واحدچین")}</h1>
          <p>{tr("درس‌هایت را انتخاب کن و برنامهٔ هفتگی و امتحان‌هایت را کنار هم ببین.", "Choose your courses and see your weekly timetable and exams together.", "اختر مقرراتك واعرض جدولك الأسبوعي وامتحاناتك معاً.")}</p>
          <button className="primary" onClick={() => { remember("entered", true); setEntered(true); }}>
            {tr("ورود به برنامه", "Open planner", "الدخول إلى المخطط")}
          </button>
        </div>
      </section>
    </main>
  );
  return <Ready index={term.index} controls={controls} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app">
      <header className="top">
        <h1>{t("واحدچین")}</h1>
      </header>
      <p className="card">{children}</p>
    </main>
  );
}

/** Per-viewer convenience: remember where the user was browsing. */
function remembered<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: ignore */
  }
}

function Ready({ index, controls }: { index: TermIndex; controls: React.ReactNode }) {
  const data = index.data;
  const [state, dispatch] = useReducer(reducer, data.term, initialState);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => remembered<Tab>("tab", "courses"));
  const [place, setPlace] = useState(() => remembered<{ faculty: string; department: number | null }>("place", { faculty: "", department: null }));
  const [gen, setGen] = useState<GenState>({ status: "idle" });
  const running = useRef<Running | null>(null);

  // FR-44: restore, then save every change.
  useEffect(() => {
    loadState()
      .then((s) => s && dispatch({ type: "replace", state: s }))
      .catch((e: unknown) => setStorageError(String(e)))
      .finally(() => setLoaded(true));
    void persist();
  }, []);
  // Save at once (a debounce lost the last change when the page closed quickly), and again on pagehide.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    if (loaded) saveState(state).catch((e: unknown) => setStorageError(String(e)));
  }, [state, loaded]);
  useEffect(() => {
    const flush = () => {
      if (loaded) void saveState(latest.current).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [loaded]);

  useEffect(() => remember("tab", tab), [tab]);
  useEffect(() => remember("place", place), [place]);

  const install = useInstallPrompt();
  const online = useOnline();
  const scenario = active(state);
  const colorOf = useCallback(
    (course: string) => {
      const i = scenario.courses.findIndex((c) => c.course === course);
      return i < 0 ? 9 : i;
    },
    [scenario.courses],
  );
  const problems = useMemo(() => pickProblems(scenario, index.byCode), [scenario, index]);

  const run = () => {
    running.current?.cancel();
    setTab("results");
    setGen({ status: "running", startedAt: Date.now() });
    const job = runGenerate(generateInput(scenario, data.groups));
    running.current = job;
    job.result
      .then((result) => setGen({ status: "done", result }))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setGen(msg === "cancelled" ? { status: "idle" } : { status: "error", message: msg });
      })
      .finally(() => {
        if (running.current === job) running.current = null;
      });
  };

  return (
    <main className="app">
      <header className="top">
        <div className="topbar">
          <div className="brand"><span className="brand-mark" aria-hidden="true">و</span><div><h1>{t("واحدچین")}</h1><span>{tr("دانشگاه سمنان", "Semnan University", "جامعة سمنان")}</span></div></div>
          <div className="row wrap gap">{controls}<ScenarioBar state={state} dispatch={dispatch} term={data.term} /></div>
        </div>
        <div className="hero">
          <div><h2>{tr("میز انتخاب واحد", "Semester planner", "تخطيط الفصل الدراسي")}</h2>
            <p>{tr("برنامهٔ فعال", "Current schedule", "الجدول الحالي")} · {scenario.name}</p></div>
          <div className="term-panel"><span>{t("نیمسال جاری")}</span><strong>{fa(data.termTitle)}</strong><small>{t("داده گلستان:")} {faReportTime(data.reportDate, data.reportTime)}</small></div>
        </div>
      </header>

      {!online && (
        <p className="card small" role="status">
          {tr("آفلاین هستید؛ از داده ذخیره‌شده استفاده می‌شود.", "You are offline; using saved data.", "أنت غير متصل؛ تُستخدم البيانات المحفوظة.")} ({faReportTime(data.reportDate, data.reportTime)})
        </p>
      )}
      {storageError && <p className="card warn-text small">{tr("ذخیره در مرورگر کار نکرد؛ برنامه‌ها با بستن صفحه از بین می‌روند.", "Browser storage failed; schedules will be lost when the page closes.", "فشل التخزين في المتصفح؛ ستُفقد الجداول عند إغلاق الصفحة.")} ({storageError})</p>}
      {scenario.term !== data.term && (
        <p className="card warn-text small">{tr(`این برنامه برای ترم ${fa(scenario.term)} ساخته شده ولی داده فعلی ترم ${fa(data.term)} است.`, `This schedule is for semester ${fa(scenario.term)}, but current data is for ${fa(data.term)}.`, `هذا الجدول للفصل ${fa(scenario.term)}، لكن البيانات الحالية للفصل ${fa(data.term)}.`)}</p>
      )}
      {problems.length > 0 && (
        <div className="card warn-text small stack" role="alert">
          <p>
            {tr(`داده جدید منتشر شده و ${fa(problems.length)} گروه انتخاب‌شده شما حذف شده یا تغییر کرده است:`, `New data has been published; ${fa(problems.length)} selected groups have changed or been removed:`, `نُشرت بيانات جديدة؛ تغيرت أو أزيلت ${fa(problems.length)} من مجموعاتك المختارة:`)}
          </p>
          <ul className="plain">
            {problems.map((p) => (
              <li key={p.code}>
                {index.courses.get(p.course)?.name ?? p.course} ({tr("گروه", "Group", "المجموعة")} {fa(p.code.split("_")[1] ?? "")}):{" "}
                {p.kind === "missing" ? t("دیگر ارائه نمی‌شود") : t("ساعت، امتحان یا استاد عوض شده")}
              </li>
            ))}
          </ul>
          <button
            className="secondary small-btn"
            onClick={() =>
              dispatch({
                type: "acceptChanges",
                groups: problems.map((p) => index.byCode.get(p.code)).filter((g) => g !== undefined),
              })
            }
          >
            {t("دیدم")}
          </button>
        </div>
      )}

      <nav className="tabs" aria-label={t("بخش‌ها")}>
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "tab active" : "tab"} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>
            {t(item.label)}
            {item.id === "plan" && scenario.courses.length > 0 && <span className="badge">{fa(scenario.courses.length)}</span>}
          </button>
        ))}
      </nav>

      {tab === "courses" && (
        <Browse
          index={index}
          scenario={scenario}
          dispatch={dispatch}
          faculty={place.faculty}
          department={place.department}
          onPlace={(faculty, department) => setPlace({ faculty, department })}
        />
      )}
      {tab === "plan" && <Plan index={index} scenario={scenario} dispatch={dispatch} colorOf={colorOf} onGenerate={run} onBrowse={() => setTab("courses")} />}
      {tab === "results" && (
        <Results
          gen={gen}
          manualGroups={scenario.manualEvents.map(manualEventGroup)}
          index={index}
          colorOf={colorOf}
          canRun={scenario.courses.length > 0}
          onRun={run}
          onCancel={() => running.current?.cancel()}
          onApply={(groups) => {
            dispatch({ type: "applyCombination", groups });
            setTab("plan");
          }}
        />
      )}
      {tab === "directory" && <Directory118 />}
      {tab === "settings" && (
        <>
          <Settings key={scenario.id} settings={scenario.settings} dispatch={dispatch} teachers={[...new Set(data.groups.map((g) => g.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fa"))} />
          <Backup state={state} dispatch={dispatch} />
        </>
      )}

      {install && (
        <div className="card row between wrap gap">
          <span className="small">{t("واحدچین را مثل یک اپ روی گوشی نصب کنید؛ بعد از آن بدون اینترنت هم باز می‌شود.")}</span>
          <button className="primary small-btn" onClick={() => void install()}>
            {t("نصب")}
          </button>
        </div>
      )}
      <footer className="small muted foot">
        {t("برنامه‌های شما فقط در همین مرورگر ذخیره می‌شود و به هیچ سروری فرستاده نمی‌شود. منبع داده: گزارش ۱۱۰ گلستان دانشگاه سمنان.")}
      </footer>
    </main>
  );
}

function ScenarioBar({ state, dispatch, term }: { state: AppState; dispatch: (a: Parameters<typeof reducer>[1]) => void; term: string }) {
  const s = active(state);
  return (
    <div className="row gap scenario-bar">
      <select aria-label={t("برنامه")} value={s.id} onChange={(e) => dispatch({ type: "switchScenario", id: e.target.value })}>
        {state.scenarios.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <button className="link small" onClick={() => dispatch({ type: "newScenario", term, name: `${t("برنامه")} ${fa(state.scenarios.length + 1)}` })}>
        {t("جدید")}
      </button>
      <button className="link small" onClick={() => dispatch({ type: "duplicateScenario", name: `${s.name} (${t("کپی")})` })}>
        {t("کپی")}
      </button>
      <button
        className="link small"
        onClick={() => {
          const name = window.prompt(t("نام برنامه"), s.name)?.trim();
          if (name) dispatch({ type: "renameScenario", name });
        }}
      >
        {t("نام")}
      </button>
      {state.scenarios.length > 1 && (
        <button
          className="link small bad-text"
          onClick={() => {
            if (window.confirm(tr(`«${s.name}» حذف شود؟`, `Delete “${s.name}”?`, `هل تريد حذف «${s.name}»؟`))) dispatch({ type: "deleteScenario" });
          }}
        >
          {t("حذف")}
        </button>
      )}
    </div>
  );
}
