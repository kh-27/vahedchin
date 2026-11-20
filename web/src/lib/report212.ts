import { latinDigits } from "./text";

/** Extract course/group codes only from the rightmost table column, leaving personal data in memory. */
export async function readReport212(file: File): Promise<string[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("too_large");
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 50) throw new Error("too_many_pages");
    const codes = new Set<string>();
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const width = page.view[2]! - page.view[0]!;
      const height = page.view[3]! - page.view[1]!;
      const content = await page.getTextContent();
      if (n === 1) {
        const heading = latinDigits(content.items.filter((item) => "str" in item && item.transform[5]! > height * 0.92).map((item) => "str" in item ? item.str : "").join(""));
        if (!heading.includes("212")) throw new Error("not_report_212");
      }
      const rows = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [x, y] = [item.transform[4]!, item.transform[5]!];
        if (x < width * 0.91 || y > height * 0.88 || y < height * 0.03) continue;
        const key = Math.round(y);
        const row = rows.get(key) ?? [];
        row.push({ x, text: item.str }); rows.set(key, row);
      }
      for (const row of rows.values()) {
        const value = latinDigits(row.sort((a, b) => a.x - b.x).map((item) => item.text).join("").replace(/\s/g, ""));
        if (/^\d{7}_\d{2}$/.test(value)) codes.add(value);
      }
      page.cleanup();
    }
    if (!codes.size) throw new Error("no_codes");
    return [...codes];
  } finally { await task.destroy(); }
}
