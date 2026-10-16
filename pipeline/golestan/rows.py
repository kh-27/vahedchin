"""Convert a table row into a Group, validating every column (FR-62)."""

from __future__ import annotations

import re

from .layout import Row
from .model import Group
from .timecol import parse_time_cell

_INT = re.compile(r"^\d+$")
_NUM = re.compile(r"^\d+(?:/\d+)?$")  # Golestan writes 0.5 as "0/5"
_GENDER = {"مختلط": "mixed", "مرد": "male", "زن": "female"}
_YES_NO = {"بله": True, "خیر": False}
_DROP = {"امکان دارد": True, "امکان ندارد": False}


def parse_row(row: Row, department: int, page: int) -> tuple[Group | None, list[str]]:
    """Return (group, problems). The group is None if any problem was found."""
    c = {k: " ".join(v).strip() for k, v in row.cells.items()}
    problems: list[str] = []

    code = row.code
    if code is None:
        return None, [f"کد گروه نامعتبر: «{c['code']}»"]

    def integer(col: str, label: str) -> int:
        if not _INT.match(c[col]):
            problems.append(f"{label} عدد نیست: «{c[col]}»")
            return 0
        return int(c[col])

    def number(col: str, label: str) -> float:
        if not _NUM.match(c[col]):
            problems.append(f"{label} عدد نیست: «{c[col]}»")
            return 0.0
        return float(c[col].replace("/", "."))

    def choice(col: str, label: str, options: dict):
        if c[col] not in options:
            problems.append(f"{label} ناشناخته: «{c[col]}»")
            return next(iter(options.values()))
        return options[c[col]]

    units = number("units", "واحد کل")
    practical = number("practical", "واحد عملی")
    capacity = integer("capacity", "ظرفیت")
    registered = integer("registered", "ثبت‌نام‌شده")
    waitlist = integer("waitlist", "لیست انتظار")
    gender = choice("gender", "جنسیت", _GENDER)
    other_centers = choice("other_centers", "امکان اخذ توسط سایر مراکز", _YES_NO)
    emergency_drop = choice("emergency_drop", "حذف اضطراری", _DROP)
    if practical > units:
        problems.append(f"واحد عملی ({c['practical']}) بیشتر از واحد کل ({c['units']})")
    if not c["name"]:
        problems.append("نام درس خالی است")

    sessions, exams, time_problems = parse_time_cell(c["time"])
    problems += time_problems
    if problems:
        return None, problems

    course, group = code.split("_")
    return (
        Group(
            code=code,
            course=course,
            group=group,
            name=c["name"],
            units=units,
            practical_units=practical,
            capacity=capacity,
            registered=registered,
            waitlist=waitlist,
            gender=gender,
            teacher=c["teacher"],
            sessions=sessions,
            exams=exams,
            notes=c["notes"],
            other_centers=other_centers,
            emergency_drop=emergency_drop,
            department=department,
            page=page,
        ),
        [],
    )
