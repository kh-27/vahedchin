"""Markdown run summary for the GitHub Actions job page (FR-63)."""

from __future__ import annotations

from collections import Counter

from .errors import Issue

MAX_ISSUES_SHOWN = 200

_ROWS = (
    ("pages", "صفحه"),
    ("empty_pages", "صفحه خالی"),
    ("continuation_pages", "صفحه ادامه (بدون سربرگ)"),
    ("joined_rows", "سطر بریده‌شده بین دو صفحه (وصل شد)"),
    ("faculties", "دانشکده"),
    ("departments", "گروه آموزشی"),
    ("sections", "گروه آموزشی × مقطع"),
    ("courses", "درس"),
    ("groups", "گروه درسی"),
    ("sessions", "جلسه"),
    ("weekly_sessions", "جلسه هفتگی"),
    ("dated_sessions", "جلسه تک‌تاریخی"),
    ("exams", "امتحان"),
    ("practical_exams", "امتحان عملی"),
    ("week_odd", "هفته فرد (ف)"),
    ("week_even", "هفته زوج (ز)"),
    ("half_term_sessions", "جلسه نیم‌ترم (نیمه1/نیمه2)"),
    ("single_week_sessions", "جلسه فقط در یک هفته (هفتهN)"),
    ("with_notes", "گروه دارای توضیحات"),
    ("issues", "خطا"),
)


def render(source: str, stats: Counter, issues: list[Issue], term: str | None, fatal: str | None = None) -> str:
    lines = [f"## پارس گزارش ۱۱۰: `{source}`", ""]
    if fatal:
        lines += [f"❌ **{fatal}**", ""]
    elif issues:
        lines += [f"❌ **{len(issues)} خطا؛ داده منتشر نشد.**", ""]
    else:
        lines += [f"✅ ترم `{term}` بدون خطا خوانده شد.", ""]

    if stats:
        lines += ["| شاخص | تعداد |", "|---|---:|"]
        lines += [f"| {label} | {stats.get(key, 0)} |" for key, label in _ROWS]
        lines.append("")

    if issues:
        lines += ["### خطاها", ""]
        lines += [f"- {i.format()}" for i in issues[:MAX_ISSUES_SHOWN]]
        if len(issues) > MAX_ISSUES_SHOWN:
            lines.append(f"- … و {len(issues) - MAX_ISSUES_SHOWN} خطای دیگر")
        lines.append("")
    return "\n".join(lines)
