"""Page header of report 110 (FR-69): term, report time, department."""

from __future__ import annotations

import re
from dataclasses import dataclass

_TERM = re.compile(r"نیمسال\s+(?P<sem>اول|دوم)\s+سال\s+تحصیلی\s*(?P<y1>\d{2})\s*-\s*(?P<y2>\d{2})")
_TIME = re.compile(r"زمان\s*:\s*(?P<time>\d{2}:\d{2})\s*-\s*(?P<date>\d{4}/\d{2}/\d{2})")
_PAGE = re.compile(r"صفحه\s*:\s*(?P<n>\d+)\s+از\s+(?P<of>\d+)")
_FACULTY = re.compile(r"دانشکده\s+درس\s*:\s*(?P<faculty>.+?)\s+مقطع\s*:\s*(?P<level>.+)$")
_DEPARTMENT = re.compile(r"گروه\s+آموزشی\s*:\s*(?P<dept>.+)$")
_SEMESTER = {"اول": "1", "دوم": "2"}


@dataclass(frozen=True)
class PageHeader:
    university: str
    term: str  # "4042"
    term_title: str  # "نیمسال دوم سال تحصیلی 04-05"
    report_date: str
    report_time: str
    page_in_department: int
    department_pages: int
    faculty: str
    department: str
    level: str


class HeaderError(ValueError):
    pass


def parse_header(lines: list[str]) -> PageHeader:
    text = "\n".join(lines)
    missing = []

    def find(pattern: re.Pattern, what: str) -> re.Match | None:
        for line in lines:
            if m := pattern.search(line):
                return m
        missing.append(what)
        return None

    term = find(_TERM, "نیمسال و سال تحصیلی")
    time = find(_TIME, "زمان تهیه گزارش")
    page = find(_PAGE, "شماره صفحه")
    faculty = find(_FACULTY, "دانشکده و مقطع")
    dept = find(_DEPARTMENT, "گروه آموزشی")
    if missing:
        raise HeaderError("سربرگ ناقص است؛ پیدا نشد: " + "، ".join(missing) + f" — «{text}»")

    y1, y2 = int(term["y1"]), int(term["y2"])
    if (y1 + 1) % 100 != y2:
        raise HeaderError(f"سال تحصیلی نامعتبر: {term['y1']}-{term['y2']}")
    year = (1300 if y1 >= 50 else 1400) + y1
    university = next((line for line in lines if line.startswith("دانشگاه")), "")
    return PageHeader(
        university=university,
        term=str(year)[1:] + _SEMESTER[term["sem"]],
        term_title=f"نیمسال {term['sem']} سال تحصیلی {term['y1']}-{term['y2']}",
        report_date=time["date"],
        report_time=time["time"],
        page_in_department=int(page["n"]),
        department_pages=int(page["of"]),
        faculty=faculty["faculty"].strip(),
        department=dept["dept"].strip(),
        level=faculty["level"].strip(),
    )
