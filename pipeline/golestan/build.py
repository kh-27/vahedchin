"""PDF -> TermData, with every check that must pass before publishing."""

from __future__ import annotations

import hashlib
import os
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

from .errors import ClippedPdfError, Issue
from .header import HeaderError, PageHeader, parse_header
from .layout import COLUMNS, PageLayout, Row, read_page
from .model import Department, TermData
from .rows import parse_row

# A word every column title of the full print contains (spaces removed).
# The clipped A4 print lacks the notes, other centers and emergency drop
# columns, so this also rejects it (FR-68).
EXPECTED_TITLES = {
    "emergency_drop": "حذفاضطراری",
    "other_centers": "سایرمراکز",
    "notes": "توضیحات",
    "time": "زمانومکان",
    "teacher": "استاد",
    "gender": "جنسیت",
    "waitlist": "انتظار",
    "registered": "ثبتنام",
    "capacity": "ظرفیت",
    "practical": "ع",
    "units": "کل",
    "name": "نامدرس",
    "code": "شمارهوگروه",
}


@dataclass
class BuildResult:
    data: TermData | None  # None when there is any issue
    issues: list[Issue]
    stats: Counter = field(default_factory=Counter)


def parse_pdf(path: str | Path, workers: int | None = None) -> BuildResult:
    """Parse a full-print report 110. Raises ClippedPdfError for a clipped print."""
    path = Path(path)
    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        # Fail fast on a clipped print before the slow full pass.
        for i, page in enumerate(pdf.pages, start=1):
            layout = read_page(page, i)
            if not layout.empty:
                check_full_print(layout)
                break

    layouts = read_layouts(path, page_count, workers)
    result = assemble(layouts)
    if result.data is not None:
        result.data.source_file = path.name
        result.data.source_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        result.data.pages = page_count
    result.stats["pages"] = page_count
    return result


def read_layouts(path: Path, page_count: int, workers: int | None = None) -> list[PageLayout]:
    workers = workers or os.cpu_count() or 1
    if workers <= 1 or page_count < 8:
        return _read_range(str(path), 1, page_count + 1)
    step = max(1, -(-page_count // (workers * 4)))
    ranges = [(s, min(s + step, page_count + 1)) for s in range(1, page_count + 1, step)]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        chunks = pool.map(_read_range, [str(path)] * len(ranges), *zip(*ranges))
        return [layout for chunk in chunks for layout in chunk]


def _read_range(path: str, start: int, stop: int) -> list[PageLayout]:
    with pdfplumber.open(path) as pdf:
        return [read_page(pdf.pages[i - 1], i) for i in range(start, stop)]


def check_full_print(layout: PageLayout) -> None:
    expected = len(COLUMNS) + 1
    if layout.borders != expected:
        raise ClippedPdfError(layout.page, f"{layout.borders} مرز ستون به‌جای {expected}")
    if not layout.has_header:
        return  # continuation pages repeat neither the header nor the titles
    for col, word in EXPECTED_TITLES.items():
        title = layout.column_titles.get(col, "").replace(" ", "").replace("‌", "")
        if word not in title:
            raise ClippedPdfError(layout.page, f"عنوان ستون {col} «{title}» است، نه «{word}»")


def assemble(layouts: list[PageLayout]) -> BuildResult:
    issues: list[Issue] = []
    stats: Counter = Counter()
    first: PageHeader | None = None
    departments: dict[tuple[str, str, str], int] = {}
    dept_runs: dict[int, list[list[tuple[int, int]]]] = {}  # dept -> runs of (page n, of total)
    last_dept: int | None = None
    groups = []
    seen_codes: dict[str, int] = {}
    # (page, department, row), in PDF order; cut rows are re-joined first.
    pending: list[tuple[int, int, Row]] = []
    dept: int | None = None
    prev_page = 0

    for layout in layouts:
        if layout.empty:
            stats["empty_pages"] += 1
            continue
        check_full_print(layout)
        if layout.stray:
            issues.append(Issue(layout.page, "", "متن خارج از جدول", " ".join(layout.stray)))

        if not layout.has_header:
            stats["continuation_pages"] += 1
            if dept is None:
                issues.append(Issue(layout.page, "", "صفحه ادامه بدون سربرگ قبلی", ""))
                continue
            for part in layout.continued:
                if not pending or pending[-1][0] != prev_page:
                    issues.append(Issue(layout.page, "", "تکه سطر بدون سطر قبلی", part.raw()))
                    continue
                stats["joined_rows"] += 1
                last = pending[-1][2]
                for c in COLUMNS:
                    last.cells[c] = last.cells[c] + part.cells[c]
            _queue(layout, dept, pending, issues)
            prev_page = layout.page
            continue

        dept = None
        prev_page = layout.page
        try:
            header = parse_header(layout.header_lines)
        except HeaderError as e:
            issues.append(Issue(layout.page, "", str(e), " / ".join(layout.header_lines)))
            continue

        if first is None:
            first = header
        for attr, label in (
            ("term", "ترم"),
            ("report_date", "تاریخ گزارش"),
            ("report_time", "ساعت گزارش"),
            ("university", "دانشگاه"),
        ):
            if getattr(header, attr) != getattr(first, attr):
                issues.append(
                    Issue(
                        layout.page,
                        "",
                        f"{label} با صفحه اول فرق دارد (چند گزارش در یک PDF؟)",
                        f"{getattr(header, attr)} ≠ {getattr(first, attr)}",
                    )
                )

        key = (header.faculty, header.department, header.level)
        dept = departments.setdefault(key, len(departments))
        runs = dept_runs.setdefault(dept, [])
        if dept != last_dept or header.page_in_department == 1:
            runs.append([])
        runs[-1].append((header.page_in_department, header.department_pages))
        last_dept = dept

        if not layout.rows:
            issues.append(Issue(layout.page, "", "صفحه جدول بدون سطر داده", " / ".join(layout.header_lines)))
        _queue(layout, dept, pending, issues)

    for page, row_dept, row in pending:
        group, problems = parse_row(row, row_dept, page)
        for p in problems:
            issues.append(Issue(page, row.code or "", p, row.raw()))
        if group is None:
            continue
        if group.code in seen_codes:
            issues.append(Issue(page, group.code, f"کد گروه تکراری (قبلاً در صفحه {seen_codes[group.code]})", row.raw()))
            continue
        seen_codes[group.code] = page
        groups.append(group)

    # Every run of report pages of a department must be "1 of n" ... "n of n".
    # A department can have more than one run (seen in all4051.pdf).
    for key, dept in departments.items():
        for run in dept_runs[dept]:
            numbers = [n for n, _ in run]
            totals = {t for _, t in run}
            if len(totals) != 1 or numbers != list(range(1, totals.pop() + 1)):
                issues.append(Issue(0, "", f"صفحه‌های گروه آموزشی کامل یا پشت‌سرهم نیست: {run}", " / ".join(key)))

    if first is None:
        issues.append(Issue(0, "", "هیچ صفحه جدولی پیدا نشد", ""))

    stats.update(_stats(groups, departments))
    stats["issues"] = len(issues)
    if issues or first is None:
        return BuildResult(None, issues, stats)

    data = TermData(
        term=first.term,
        term_title=first.term_title,
        university=first.university,
        report_date=first.report_date,
        report_time=first.report_time,
        source_file="",
        source_sha256="",
        pages=0,
        departments=[Department(*k) for k in departments],
        groups=groups,
    )
    return BuildResult(data, issues, stats)


def _queue(layout: PageLayout, dept: int, pending: list, issues: list[Issue]) -> None:
    for row in layout.rows:
        if row.code is None:
            issues.append(Issue(layout.page, "", "سطر بدون کد گروه", row.raw()))
        else:
            pending.append((layout.page, dept, row))


def _stats(groups, departments) -> Counter:
    s: Counter = Counter()
    s["faculties"] = len({k[0] for k in departments})
    s["departments"] = len({k[:2] for k in departments})
    s["sections"] = len(departments)
    s["courses"] = len({g.course for g in groups})
    s["groups"] = len(groups)
    for g in groups:
        for ses in g.sessions:
            s["sessions"] += 1
            s["dated_sessions" if ses.date else "weekly_sessions"] += 1
            s[f"week_{ses.week}"] += 1
            if ses.half:
                s["half_term_sessions"] += 1
            if ses.week_number:
                s["single_week_sessions"] += 1
        for e in g.exams:
            s["exams" if e.kind == "final" else "practical_exams"] += 1
        if g.notes:
            s["with_notes"] += 1
    return s
