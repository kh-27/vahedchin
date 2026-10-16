"""Helpers that build synthetic pdfplumber words/rects like Chrome's print."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from golestan.layout import COLUMNS

REPO = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"

_PARENS = str.maketrans("()[]", ")(][")
_DIGIT_RUN = re.compile(r"[0-9][0-9:/\-_.]*[0-9]|[0-9]")
_RTL = re.compile(r"[؀-ۿ]")


def vis(text: str) -> str:
    """Logical Persian text -> visual-order token as pdfplumber returns it.

    Characters are reversed, but digit runs stay in logical order (as seen in
    the real PDF, e.g. '١ﻪﻤﯿﻧ' for 'نیمه1')."""
    if not _RTL.search(text):
        return text
    r = text[::-1].translate(_PARENS)
    return _DIGIT_RUN.sub(lambda m: m.group(0)[::-1], r)


# 13 columns, each 10pt wide: COLUMNS[i] spans XS[i]..XS[i+1].
XS = [float(i * 10) for i in range(len(COLUMNS) + 1)]
LEFT, RIGHT = XS[0], XS[-1]


def word(text: str, col: str | None, top: float, x0: float | None = None) -> dict:
    if col is not None:
        i = COLUMNS.index(col)
        x0, x1 = XS[i] + 1, XS[i + 1] - 1
    else:
        x1 = x0 + 5
    return {"text": vis(text), "x0": x0, "x1": x1, "top": top, "bottom": top + 8}


def vborders(top: float, bottom: float, xs=XS) -> list[dict]:
    return [{"x0": x, "x1": x + 0.75, "width": 0.75, "top": top, "bottom": bottom, "height": bottom - top} for x in xs]


def hborder(y: float) -> dict:
    return {"x0": LEFT, "x1": RIGHT, "width": RIGHT - LEFT, "top": y, "bottom": y + 0.75, "height": 0.75}


TITLES = {
    "emergency_drop": "حذف اضطراری",
    "other_centers": "امکان اخذ درس توسط سایر مراکز",
    "notes": "توضیحات",
    "time": "زمان و مکان ارائه/ امتحان",
    "teacher": "نام استاد",
    "gender": "جنسیت",
    "waitlist": "تعداد لیست انتظار",
    "registered": "ثبت نام شده",
    "capacity": "ظر فیت",
    "practical": "ع",
    "units": "واحد کل",
    "name": "نام درس",
    "code": "شماره و گروه درس",
}


def header_lines(n: int = 1, of: int = 1, dept: str = "مهندسی مواد", level: str = "کارشناسی", term="دوم", years="04-05", time="12:46 - 1405/07/24") -> list[str]:
    return [
        "دانشگاه سمنان",
        f"سیستم جامع دانشگاهی گلستان زمان: {time}",
        f"دروس ارائه شده در نیمسال {term} سال تحصیلی{years}",
        f"شماره گزارش: 110 صفحه : {n} از {of}",
        f"دانشکده درس :مهندسی مواد و متالورژی مقطع :{level}",
        f"گروه آموزشی :{dept}",
    ]


def cells(code="1118061_01", **over) -> dict[str, list[str] | str]:
    base = {
        "code": code,
        "name": "ریاضی مهندسی",
        "units": "3",
        "practical": "0",
        "capacity": "20",
        "registered": "20",
        "waitlist": "0",
        "gender": "مختلط",
        "teacher": "ایران خواه رضا",
        "time": ["درس(ت): شنبه 12:30-10:30 مکان: کلاس 4", "امتحان(1405/04/06) ساعت : 18:00-16:00"],
        "notes": "",
        "other_centers": "خیر",
        "emergency_drop": "امکان دارد",
    }
    base.update(over)
    return base


def page(
    rows: list[dict],
    header: list[str] | None = None,
    titles: bool = True,
    fragment: dict | None = None,
    cut_last: bool = False,
) -> tuple[list[dict], list[dict]]:
    """Words and rects of one physical page.

    header=None makes a continuation page (no report header, no titles).
    fragment: cells shown above the first border (rest of a cut row).
    cut_last: no bottom border under the last row (row continues on next page)."""
    words: list[dict] = []
    rects: list[dict] = []
    y = 100.0
    if header is not None:
        for i, line in enumerate(header):
            words.append(word(line, None, 10 + i * 12, x0=50))
    elif fragment is not None:
        words += _cell_words(fragment, 20)
    ys = [y]
    if header is not None and titles:
        words += _cell_words(TITLES, y + 2)
        y += 30
        ys.append(y)
    for r in rows:
        words += _cell_words(r, y + 2)
        y += 30
        ys.append(y)
    if cut_last:
        ys.pop()
    rects += [hborder(v) for v in ys]
    rects += vborders(0 if header is None else 100, y)
    return words, rects


def _cell_words(row: dict, top: float) -> list[dict]:
    out = []
    for col, value in row.items():
        lines = [value] if isinstance(value, str) else value
        for i, line in enumerate(lines):
            if line:
                out.append(word(line, col, top + i * 10))
    return out


@pytest.fixture
def make_page():
    return page
