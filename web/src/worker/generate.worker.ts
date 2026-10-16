/// <reference lib="webworker" />
/** FR-34: combinations are generated off the main thread; the page cancels by terminating the worker. */

import { generate, type GenerateInput } from "../core/generate";

export interface WorkerResult {
  total: number;
  truncated: boolean;
  complete: boolean;
  nodes: number;
  ms: number;
  bestUnits: number;
  explanation: ReturnType<typeof generate>["explanation"];
  /** Group codes per result, best first, with the score and its parts. */
  results: { codes: string[]; units: number; score: number; parts: Record<string, number> }[];
}

self.onmessage = (e: MessageEvent<Omit<GenerateInput, "shouldCancel">>) => {
  const t0 = performance.now();
  const r = generate(e.data);
  const out: WorkerResult = {
    total: r.total,
    truncated: r.truncated,
    complete: r.complete,
    nodes: r.nodes,
    bestUnits: r.bestUnits,
    ms: performance.now() - t0,
    explanation: r.explanation,
    results: r.results.map((x) => ({ codes: x.groups.map((g) => g.code), units: x.units, score: x.score, parts: x.parts })),
  };
  (self as unknown as Worker).postMessage(out);
};
