"""FR-69: term and department from the page header."""

import pytest

from conftest import header_lines
from golestan.header import HeaderError, parse_header


def test_fr69_second_semester_04_05_is_4042():
    h = parse_header(header_lines(n=2, of=5))
    assert h.term == "4042"
    assert h.term_title == "نیمسال دوم سال تحصیلی 04-05"
    assert (h.report_date, h.report_time) == ("1405/07/24", "12:46")
    assert (h.page_in_department, h.department_pages) == (2, 5)
    assert (h.faculty, h.department, h.level) == ("مهندسی مواد و متالورژی", "مهندسی مواد", "کارشناسی")
    assert h.university == "دانشگاه سمنان"


def test_fr69_first_semester_05_06_is_4051():
    assert parse_header(header_lines(term="اول", years="05-06")).term == "4051"


def test_fr69_previous_century():
    assert parse_header(header_lines(term="اول", years="99-00")).term == "3991"


def test_academic_years_must_be_consecutive():
    with pytest.raises(HeaderError, match="سال تحصیلی نامعتبر"):
        parse_header(header_lines(years="04-06"))


def test_missing_parts_are_listed():
    lines = [line for line in header_lines() if "زمان" not in line and "گروه آموزشی" not in line]
    with pytest.raises(HeaderError, match="زمان تهیه گزارش، گروه آموزشی"):
        parse_header(lines)
