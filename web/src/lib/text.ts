/** Persian text for display and search (FR-48, FR-50, FR-70). */

import { getLanguage, t, tr } from "./i18n";
import { DAY_NAMES, weekdayOf } from "../core/time";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

/** ASCII digits -> Persian digits (FR-50). */
export function fa(x: string | number): string {
  return getLanguage() === "en" ? String(x) : String(x).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

/** Units like 0.5 are shown as "۰٫۵". */
export function faNumber(x: number): string {
  return getLanguage() === "en" ? String(x) : fa(String(x)).replace(".", "٫");
}

/** Persian and Arabic digits -> ASCII, so input in either works (FR-50). */
export function latinDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
}

/** Folded form for matching: letters unified, digits ASCII, no diacritics or ZWNJ, lower case. */
export function fold(s: string): string {
  return latinDigits(s.normalize("NFKC"))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/[ً-ْٰ]/g, "") // harakat
    .replace(/[‌‏‎]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every query word appears somewhere in the haystack ("شیمی عمو" matches "شیمی عمومی"). */
export function matches(haystack: string, query: string): boolean {
  const h = fold(haystack).replace(/ /g, "");
  return fold(query)
    .split(" ")
    .every((w) => w === "" || h.includes(w));
}

/** "1405/04/06" -> "۶ تیر ۱۴۰۵" */
export function faDate(date: string, withYear = true): string {
  const [y, m, d] = date.split("/").map(Number) as [number, number, number];
  const month = getLanguage() === "en" ? ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"][m - 1] : MONTHS[m - 1];
  return withYear ? `${fa(d)} ${month} ${fa(y)}` : `${fa(d)} ${month}`;
}

/** "1405/04/06" -> "شنبه ۶ تیر" (FR-41) */
export function faDayDate(date: string): string {
  return `${t(DAY_NAMES[weekdayOf(date)]!)} ${faDate(date, false)}`;
}

/** FR-70: "۲۴ مهر ۱۴۰۵، ساعت ۱۷:۱۹" */
export function faReportTime(date: string, time: string): string {
  return `${faDate(date)}${tr("، ساعت ", ", ", "، الساعة ")}${fa(time)}`;
}
