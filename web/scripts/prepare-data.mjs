// Copies data/terms/*.json into public/data/ and writes public/data/index.json,
// the list of terms the app can load (newest first, FR-72).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "data", "terms");
const out = join(here, "..", "public", "data");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const terms = [];
for (const file of readdirSync(src).filter((f) => /^\d{4}\.json$/.test(f))) {
  const data = JSON.parse(readFileSync(join(src, file), "utf-8"));
  if (data.schemaVersion !== 1) throw new Error(`${file}: unsupported schemaVersion ${data.schemaVersion}`);
  copyFileSync(join(src, file), join(out, file));
  terms.push({
    term: data.term,
    termTitle: data.termTitle,
    reportDate: data.reportDate,
    reportTime: data.reportTime,
    file,
    groups: data.groups.length,
  });
}
if (terms.length === 0) throw new Error(`no term data in ${src}`);
terms.sort((a, b) => b.term.localeCompare(a.term));
writeFileSync(join(out, "index.json"), JSON.stringify({ terms }, null, 2) + "\n");
console.log(`data: ${terms.map((t) => `${t.term} (${t.groups} groups)`).join(", ")}`);
