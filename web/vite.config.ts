import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Files under public/ that belong to the app shell (term data is cached at run time instead). */
function publicShellFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(dir);
  return out.filter((f) => !f.startsWith("data/"));
}

/** Emits sw.js: src/sw/sw.js with the precache list and a version hash prepended. */
function serviceWorker(): Plugin {
  return {
    name: "vahedchin-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      const files = ["./", ...new Set([...built, ...publicShellFiles(join(import.meta.dirname, "public"))])].sort();
      const hash = createHash("sha256");
      for (const f of built) {
        const item = bundle[f]!;
        hash.update(f).update(item.type === "chunk" ? item.code : item.source);
      }
      const head = `const VERSION = ${JSON.stringify(hash.digest("hex").slice(0, 12))};\nconst PRECACHE = ${JSON.stringify(files)};\n`;
      this.emitFile({ type: "asset", fileName: "sw.js", source: head + readFileSync(join(import.meta.dirname, "src/sw/sw.js"), "utf-8") });
    },
  };
}

// The site is served from https://kh-27.github.io/vahedchin/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/vahedchin/",
  plugins: [react(), serviceWorker()],
  worker: { format: "es" },
  build: { target: "es2022" },
});
