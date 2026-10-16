/** Runs the generator in a Web Worker (FR-34). */

import type { GenerateInput } from "../core/generate";
import type { WorkerResult } from "../worker/generate.worker";

export interface Running {
  result: Promise<WorkerResult>;
  /** Stops the search immediately; the promise rejects with "cancelled". */
  cancel: () => void;
}

export function runGenerate(input: Omit<GenerateInput, "shouldCancel">): Running {
  const worker = new Worker(new URL("../worker/generate.worker.ts", import.meta.url), { type: "module" });
  let reject: (e: Error) => void = () => {};
  const result = new Promise<WorkerResult>((res, rej) => {
    reject = rej;
    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      worker.terminate();
      res(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      rej(new Error(e.message || "worker error"));
    };
  });
  worker.postMessage(input);
  return {
    result,
    cancel: () => {
      worker.terminate();
      reject(new Error("cancelled"));
    },
  };
}
