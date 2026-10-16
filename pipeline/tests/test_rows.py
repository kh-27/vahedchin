"""FR-62: every column of a row is validated."""

import pytest

from conftest import cells
from golestan.layout import COLUMNS, Row
from golestan.rows import parse_row


def row(**over) -> Row:
    c = cells(**over)
    return Row(top=0, cells={k: ([v] if isinstance(v, str) and v else ([] if v == "" else v)) for k, v in c.items()})


def test_valid_row():
    g, problems = parse_row(row(), department=3, page=7)
    assert problems == []
    assert (g.code, g.course, g.group, g.department, g.page) == ("1118061_01", "1118061", "01", 3, 7)
    assert (g.units, g.capacity, g.gender, g.other_centers, g.emergency_drop) == (3, 20, "mixed", False, True)
    assert len(g.sessions) == 1 and len(g.exams) == 1


def test_decimal_units_use_slash():
    g, problems = parse_row(row(units="21", practical="10/5"), 0, 1)
    assert problems == [] and g.practical_units == 10.5


@pytest.mark.parametrize(
    "over,expected",
    [
        ({"capacity": "۲O"}, "ظرفیت عدد نیست"),
        ({"registered": ""}, "ثبت‌نام‌شده عدد نیست"),
        ({"waitlist": "-1"}, "لیست انتظار عدد نیست"),
        ({"units": "سه"}, "واحد کل عدد نیست"),
        ({"gender": "نامشخص"}, "جنسیت ناشناخته"),
        ({"other_centers": "شاید"}, "سایر مراکز ناشناخته"),
        ({"emergency_drop": "دارد"}, "حذف اضطراری ناشناخته"),
        ({"units": "1", "practical": "2"}, "بیشتر از واحد کل"),
        ({"name": ""}, "نام درس خالی است"),
        ({"time": "درس(ت): شنبه 9:30-08:30"}, "ساعت ناقص"),
    ],
)
def test_fr62_invalid_columns(over, expected):
    g, problems = parse_row(row(**over), 0, 1)
    assert g is None
    assert any(expected in p for p in problems), problems


def test_bad_code():
    g, problems = parse_row(row(code="111806_01"), 0, 1)
    assert g is None and "کد گروه نامعتبر" in problems[0]


def test_multiline_cells_are_joined():
    r = row(name=["آشنایی با رشته مهندسی", "عمران(کاربینی)"])
    g, _ = parse_row(r, 0, 1)
    assert g.name == "آشنایی با رشته مهندسی عمران(کاربینی)"
    assert set(r.cells) == set(COLUMNS)
