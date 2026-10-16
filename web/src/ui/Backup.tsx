/** FR-07: save all scenarios to a JSON file, and add scenarios from such a file. */

import { useRef, useState } from "react";
import { exportFile, ImportError, parseImport, type Action, type AppState } from "../app/scenario";
import { fa } from "../lib/text";
import { download } from "./exportPng";

export function Backup({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(exportFile(state), null, 1)], { type: "application/json" });
    download(blob, `vahedchin-${today}.json`);
  };

  const load = async (file: File) => {
    try {
      const scenarios = parseImport(await file.text());
      dispatch({ type: "importScenarios", scenarios });
      setMessage({ ok: true, text: `${fa(scenarios.length)} برنامه اضافه شد.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ImportError ? e.message : "خواندن فایل ممکن نشد." });
    }
  };

  return (
    <fieldset className="card stack">
      <legend>پشتیبان و انتقال به دستگاه دیگر</legend>
      <p className="small muted">برنامه‌ها فقط در همین مرورگر ذخیره‌اند. برای انتقال یا پشتیبان، فایل بگیرید و در دستگاه دیگر وارد کنید.</p>
      <div className="row wrap gap">
        <button className="secondary" onClick={save}>
          دانلود همه برنامه‌ها ({fa(state.scenarios.length)})
        </button>
        <button className="secondary" onClick={() => input.current?.click()}>
          ورود از فایل
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="فایل برنامه‌ها"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
      </div>
      {message && (
        <p className={message.ok ? "small" : "small bad-text"} role="status">
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
