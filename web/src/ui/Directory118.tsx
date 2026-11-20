import { useMemo, useState } from "react";
import { tr } from "../lib/i18n";
import { fold } from "../lib/text";
import directory from "./directory118.json";

export function Directory118() {
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState("");
  const faculties = useMemo(() => [...new Set(directory.map((entry) => entry.faculty))], []);
  const rows = directory.filter((entry) => (!faculty || entry.faculty === faculty) && (!query.trim() || fold(Object.values(entry).join(" ")).includes(fold(query))));
  return <section className="stack"><div className="card stack"><h2>{tr("دفتر تلفن ۱۱۸ دانشگاه", "University directory 118", "دليل الجامعة ١١٨")}</h2>
    <p className="small muted">{tr("فهرست واحدهای مرتبط با آموزش بر اساس اطلاعات عمومی دانشگاه؛ دریافت‌شده در ۲۰ نوامبر ۲۰۲۶. برای اطلاعات به‌روز به منبع اصلی مراجعه کنید.", "Education contacts from the university directory, retrieved on 20 November 2026. Check the official source for updates.", "جهات الاتصال التعليمية من دليل الجامعة، جُمعت في ٢٠ نوفمبر ٢٠٢٦. راجع المصدر الرسمي للتحديثات.")} <a href="https://118.semnan.ac.ir/" target="_blank" rel="noreferrer">118.semnan.ac.ir</a></p>
    <div className="row wrap gap"><label className="field grow"><span>{tr("جست‌وجو", "Search", "بحث")}</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label className="field grow"><span>{tr("دانشکده یا واحد", "Faculty or unit", "الكلية أو الوحدة")}</span><select value={faculty} onChange={(e) => setFaculty(e.target.value)}><option value="">{tr("همه", "All", "الكل")}</option>{faculties.map((f) => <option key={f}>{f}</option>)}</select></label></div>
    <p className="small muted">{rows.length} {tr("نتیجه", "results", "نتيجة")}</p></div>
    {rows.map((entry, i) => <article className="card stack" key={i}><strong>{entry.faculty}</strong><p>{entry.unit} — {entry.role}</p><div className="row wrap gap">{entry.phone && <span>{tr("تلفن مستقیم", "Direct phone", "هاتف مباشر")}: <bdi>{entry.phone}</bdi></span>}{entry.extension && <span>{tr("داخلی", "Extension", "التحويلة")}: <bdi>{entry.extension}</bdi></span>}{entry.email && <a href={`mailto:${entry.email}`}><bdi>{entry.email}</bdi></a>}</div>{entry.address && <p className="small muted">{entry.address}</p>}</article>)}
    {rows.length === 0 && <p>{tr("نتیجه‌ای پیدا نشد.", "No results found.", "لا توجد نتائج.")}</p>}</section>;
}
