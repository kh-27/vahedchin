import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { active, generateInput, initialState, pickProblems, reducer, type AppState } from "../app/scenario";
import { runGenerate, type Running } from "../app/runGenerate";
import type { TermIndex } from "../app/termIndex";
import { useTerm } from "../app/useTerm";
import { useInstallPrompt, useOnline } from "../app/usePwa";
import { Backup } from "./Backup";
import { loadState, persist, saveState } from "../storage/db";
import { fa, faReportTime } from "../lib/text";
import { Browse } from "./Browse";
import { Plan } from "./Plan";
import { Results, type GenState } from "./Results";
import { Settings } from "./Settings";

type Tab = "courses" | "plan" | "results" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "courses", label: "دروس" },
  { id: "plan", label: "برنامه" },
  { id: "results", label: "چیدن خودکار" },
  { id: "settings", label: "تنظیمات" },
];

export function App() {
  const term = useTerm();
  if (term.status === "loading") return <Shell>در حال دریافت داده ارائه دروس…</Shell>;
  if (term.status === "error") return <Shell>داده دریافت نشد: {term.message}</Shell>;
  return <Ready index={term.index} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app">
      <header className="top">
        <h1>واحدچین</h1>
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

function Ready({ index }: { index: TermIndex }) {
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
        <div className="row between wrap gap">
          <h1>واحدچین</h1>
          <ScenarioBar state={state} dispatch={dispatch} term={data.term} />
        </div>
        <p className="small muted">
          {fa(data.termTitle)}، داده گلستان: {faReportTime(data.reportDate, data.reportTime)}
        </p>
      </header>

      {!online && (
        <p className="card small" role="status">
          آفلاین هستید؛ از داده ذخیره‌شده ({faReportTime(data.reportDate, data.reportTime)}) استفاده می‌شود. برنامه‌چینی کار می‌کند.
        </p>
      )}
      {storageError && <p className="card warn-text small">ذخیره در مرورگر کار نکرد؛ برنامه‌ها با بستن صفحه از بین می‌روند. ({storageError})</p>}
      {scenario.term !== data.term && (
        <p className="card warn-text small">این برنامه برای ترم {fa(scenario.term)} ساخته شده ولی داده فعلی ترم {fa(data.term)} است.</p>
      )}
      {problems.length > 0 && (
        <div className="card warn-text small stack" role="alert">
          <p>
            داده جدید منتشر شده و {fa(problems.length)} گروه انتخاب‌شده شما {problems.some((p) => p.kind === "missing") ? "حذف شده یا " : ""}
            تغییر کرده است:
          </p>
          <ul className="plain">
            {problems.map((p) => (
              <li key={p.code}>
                {index.courses.get(p.course)?.name ?? p.course} (گروه {fa(p.code.split("_")[1] ?? "")}):{" "}
                {p.kind === "missing" ? "دیگر ارائه نمی‌شود" : "ساعت، امتحان یا استاد عوض شده"}
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
            دیدم
          </button>
        </div>
      )}

      <nav className="tabs" aria-label="بخش‌ها">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab active" : "tab"} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "plan" && scenario.courses.length > 0 && <span className="badge">{fa(scenario.courses.length)}</span>}
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
      {tab === "settings" && (
        <>
          <Settings key={scenario.id} settings={scenario.settings} dispatch={dispatch} />
          <Backup state={state} dispatch={dispatch} />
        </>
      )}

      {install && (
        <div className="card row between wrap gap">
          <span className="small">واحدچین را مثل یک اپ روی گوشی نصب کنید؛ بعد از آن بدون اینترنت هم باز می‌شود.</span>
          <button className="primary small-btn" onClick={() => void install()}>
            نصب
          </button>
        </div>
      )}
      <footer className="small muted foot">
        برنامه‌های شما فقط در همین مرورگر ذخیره می‌شود و به هیچ سروری فرستاده نمی‌شود. منبع داده: گزارش ۱۱۰ گلستان دانشگاه سمنان.
      </footer>
    </main>
  );
}

function ScenarioBar({ state, dispatch, term }: { state: AppState; dispatch: (a: Parameters<typeof reducer>[1]) => void; term: string }) {
  const s = active(state);
  return (
    <div className="row gap scenario-bar">
      <select aria-label="برنامه" value={s.id} onChange={(e) => dispatch({ type: "switchScenario", id: e.target.value })}>
        {state.scenarios.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <button className="link small" onClick={() => dispatch({ type: "newScenario", term, name: `برنامه ${fa(state.scenarios.length + 1)}` })}>
        جدید
      </button>
      <button className="link small" onClick={() => dispatch({ type: "duplicateScenario", name: `${s.name} (کپی)` })}>
        کپی
      </button>
      <button
        className="link small"
        onClick={() => {
          const name = window.prompt("نام برنامه", s.name)?.trim();
          if (name) dispatch({ type: "renameScenario", name });
        }}
      >
        نام
      </button>
      {state.scenarios.length > 1 && (
        <button
          className="link small bad-text"
          onClick={() => {
            if (window.confirm(`«${s.name}» حذف شود؟`)) dispatch({ type: "deleteScenario" });
          }}
        >
          حذف
        </button>
      )}
    </div>
  );
}
