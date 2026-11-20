import translations from "./translations.json";

export type Language = "fa" | "en" | "ar";
let language: Language = "fa";
export function setLanguage(value: Language) { language = value; }
export function getLanguage(): Language { return language; }
export function t(text: string): string {
  if (language === "fa") return text;
  return (translations as Record<string, { en: string; ar: string }>)[text]?.[language] ?? text;
}

export function tr(fa: string, en: string, ar: string): string { return language === "en" ? en : language === "ar" ? ar : fa; }
