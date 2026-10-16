/** Loads the newest published term (FR-70, FR-72). */

import { useEffect, useState } from "react";
import type { TermData } from "../core/types";
import { buildIndex, type TermIndex } from "./termIndex";

export interface TermListing {
  term: string;
  termTitle: string;
  reportDate: string;
  reportTime: string;
  file: string;
  groups: number;
}

export type TermState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; index: TermIndex; terms: TermListing[] };

export function useTerm(): TermState {
  const [state, setState] = useState<TermState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      const base = import.meta.env.BASE_URL;
      const listRes = await fetch(`${base}data/index.json`, { cache: "no-cache" });
      if (!listRes.ok) throw new Error(`index.json: HTTP ${listRes.status}`);
      const { terms } = (await listRes.json()) as { terms: TermListing[] };
      const newest = terms[0];
      if (!newest) throw new Error("هیچ ترمی منتشر نشده است");
      const res = await fetch(`${base}data/${newest.file}`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${newest.file}: HTTP ${res.status}`);
      const data = (await res.json()) as TermData;
      if (data.schemaVersion !== 1) throw new Error(`نسخه داده پشتیبانی نمی‌شود: ${data.schemaVersion}`);
      if (alive) setState({ status: "ready", index: buildIndex(data), terms });
    })().catch((e: unknown) => alive && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
