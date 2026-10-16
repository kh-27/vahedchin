"""Parse the "زمان و مکان ارائه/امتحان" column (FR-62, FR-65).

Entries (after normalization and joining the cell's lines):

    درس(ت): شنبه 12:30-10:30 ف مکان: ...
    حل تمرین(ت): دوشنبه 19:00-18:00 مکان: ...
    درس(ت): 1405/02/17 19:00-17:00 مکان: ...      (single-date session)
    امتحان(1405/04/06) ساعت : 18:00-16:00

Time ranges are extracted in visual order, i.e. "end-start".
"""

from __future__ import annotations

import re

from .model import DAYS, Exam, Session

_DAY_PATTERNS = {
    "یکشنبه": r"یک[ ‌]?شنبه",
    "سه شنبه": r"سه[ ‌]?شنبه",
    "چهارشنبه": r"چهار[ ‌]?شنبه",
    "پنجشنبه": r"پنج[ ‌]?شنبه",
    "دوشنبه": r"دو[ ‌]?شنبه",
    "شنبه": r"شنبه",
    "جمعه": r"جمعه",
}
_DAY_RE = "|".join(f"(?P<d{i}>{p})" for i, p in enumerate(_DAY_PATTERNS.values()))
_DAY_NAMES = list(_DAY_PATTERNS)

_ENTRY_START = re.compile(r"(?=(?:درس|حل تمرین|امتحان(?: عملی)?)\s*\()")
_TIME = r"\d{1,2}:\d{1,2}"
_DATE = r"\d{4}/\d{1,2}/\d{1,2}"

_SESSION = re.compile(
    r"^(?P<kind>درس|حل تمرین)\s*\(\s*(?P<type>ت|ع)\s*\)\s*:\s*"
    rf"(?:(?:{_DAY_RE})|(?P<date>{_DATE}))\s+"
    rf"(?P<a>{_TIME})\s*-\s*(?P<b>{_TIME})"
    r"(?:\s+(?:(?P<week>ف|ز)|هفته\s*(?P<week_number>\d{1,2})))?"
    r"(?:\s+نیمه(?P<half>[12])\s+ت)?"
    r"(?:\s+مکان\s*:\s*(?P<place>.*))?$"
)
_EXAM = re.compile(
    rf"^امتحان(?P<practical>\s+عملی)?\s*\(\s*(?P<date>{_DATE})\s*\)\s*ساعت\s*:\s*"
    rf"(?P<a>{_TIME})(?:\s*-\s*(?P<b>{_TIME}))?$"
)

MAX_WEEK = 20  # a semester has about 16-18 weeks
_KIND = {"درس": "lecture", "حل تمرین": "problem_solving"}
_TYPE = {"ت": "theory", "ع": "practical"}
_WEEK = {None: "all", "ف": "odd", "ز": "even"}


def parse_time_cell(text: str) -> tuple[list[Session], list[Exam], list[str]]:
    """Return (sessions, exams, problems). Any problem must fail the build."""
    sessions: list[Session] = []
    exams: list[Exam] = []
    problems: list[str] = []
    for entry in (e.strip() for e in _ENTRY_START.split(text)):
        if not entry:
            continue
        if m := _SESSION.match(entry):
            session, errs = _session(m)
            problems += [f"{e}: «{entry}»" for e in errs]
            if session:
                sessions.append(session)
        elif m := _EXAM.match(entry):
            exam, errs = _exam(m)
            problems += [f"{x}: «{entry}»" for x in errs]
            if exam and any(e.kind == exam.kind for e in exams):
                problems.append(f"بیش از یک امتحان از یک نوع: «{entry}»")
            elif exam:
                exams.append(exam)
        else:
            problems.append(f"ورودی ناشناخته در ستون زمان: «{entry}»")
    return sessions, exams, problems


def _session(m: re.Match) -> tuple[Session | None, list[str]]:
    day = next((DAYS[_DAY_NAMES[i]] for i in range(len(_DAY_NAMES)) if m[f"d{i}"]), None)
    date = m["date"]
    errs: list[str] = []
    if date is not None:
        errs += check_date(date)
    start, end, time_errs = _range(m["a"], m["b"])
    errs += time_errs
    week_number = int(m["week_number"]) if m["week_number"] else None
    if week_number is not None and not 1 <= week_number <= MAX_WEEK:
        errs.append(f"شماره هفته نامعتبر ({week_number})")
    if errs:
        return None, errs
    return (
        Session(
            kind=_KIND[m["kind"]],
            type=_TYPE[m["type"]],
            day=day,
            date=date,
            start=start,
            end=end,
            week=_WEEK[m["week"]],
            week_number=week_number,
            half=int(m["half"]) if m["half"] else None,
            place=(m["place"] or "").strip(),
        ),
        [],
    )


def _exam(m: re.Match) -> tuple[Exam | None, list[str]]:
    errs = check_date(m["date"])
    if m["b"] is None:
        # The full print always has both ends (A7); a single time means clipping.
        return None, errs + ["امتحان بدون ساعت پایان"]
    start, end, time_errs = _range(m["a"], m["b"])
    errs += time_errs
    if errs:
        return None, errs
    kind = "practical" if m["practical"] else "final"
    return Exam(kind=kind, date=m["date"], start=start, end=end), []


def _range(visual_first: str, visual_second: str) -> tuple[str, str, list[str]]:
    end, start = visual_first, visual_second
    errs = check_time(start) + check_time(end)
    if not errs and to_minutes(end) <= to_minutes(start):
        errs.append(f"پایان ({end}) قبل از شروع ({start}) یا برابر آن")
    return start, end, errs


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def check_time(hhmm: str) -> list[str]:
    h, m = hhmm.split(":")
    if len(h) != 2 or len(m) != 2:
        # Golestan always prints two digits; one digit means a clipped value.
        return [f"ساعت ناقص ({hhmm})"]
    if int(h) > 23 or int(m) > 59:
        return [f"ساعت نامعتبر ({hhmm})"]
    return []


def check_date(date: str) -> list[str]:
    y, mo, d = date.split("/")
    if len(y) != 4 or len(mo) != 2 or len(d) != 2:
        return [f"تاریخ ناقص ({date})"]
    month, day = int(mo), int(d)
    max_day = 31 if month <= 6 else 30
    if not 1 <= month <= 12 or not 1 <= day <= max_day:
        return [f"تاریخ نامعتبر ({date})"]
    return []
