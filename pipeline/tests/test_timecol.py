"""FR-62, FR-65: the time/place/exam column."""

import pytest

from golestan.model import Exam, Session
from golestan.timecol import check_date, check_time, parse_time_cell


def one(text):
    sessions, exams, problems = parse_time_cell(text)
    assert problems == []
    return sessions, exams


def test_us14_weekly_sessions_tutorial_and_exam():
    text = (
        "درس(ت): شنبه 12:30-10:30 مکان: دانشکده مهندسی مواد و متالورژی کلاس 4 "
        "درس(ت): دوشنبه 18:00-17:00 مکان: کلاس 4 "
        "حل تمرین(ت): دوشنبه 19:00-18:00 مکان: کلاس 4 "
        "امتحان(1405/04/06) ساعت : 18:00-16:00"
    )
    sessions, exams = one(text)
    assert sessions[0] == Session("lecture", "theory", 0, None, "10:30", "12:30", "all", None, None, "دانشکده مهندسی مواد و متالورژی کلاس 4")
    assert (sessions[1].day, sessions[1].start, sessions[1].end) == (2, "17:00", "18:00")
    assert sessions[2].kind == "problem_solving"
    assert exams == [Exam("final", "1405/04/06", "16:00", "18:00")]


@pytest.mark.parametrize(
    "mark,week",
    [("ف", "odd"), ("ز", "even"), ("", "all")],
)
def test_a5_odd_even_week(mark, week):
    sessions, _ = one(f"درس(ت): دوشنبه 12:30-10:30 {mark} مکان: پردیس علوم")
    assert sessions[0].week == week


@pytest.mark.parametrize(
    "day,index",
    [("شنبه", 0), ("یک شنبه", 1), ("یکشنبه", 1), ("یک‌شنبه", 1), ("دوشنبه", 2), ("سه شنبه", 3),
     ("چهارشنبه", 4), ("پنج شنبه", 5), ("پنجشنبه", 5), ("جمعه", 6)],
)
def test_day_names(day, index):
    sessions, _ = one(f"درس(ع): {day} 10:00-08:00 مکان: آزمایشگاه")
    assert sessions[0].day == index
    assert sessions[0].type == "practical"


def test_half_term_sessions():
    sessions, _ = one(
        "درس(ت): چهارشنبه 10:30-08:30 نیمه1 ت مکان: کلاس 1 درس(ت): سه شنبه 15:00-13:00 نیمه2 ت مکان: کلاس 1"
    )
    assert [s.half for s in sessions] == [1, 2]


def test_odd_week_and_half_term_together():
    sessions, _ = one("درس(ت): شنبه 10:30-08:30 ف نیمه2 ت مکان: کلاس 1")
    assert (sessions[0].week, sessions[0].half) == ("odd", 2)


def test_a11_session_in_one_week_only():
    # all405-1.pdf, 6060086_02: a 6-hour course as three 2-hour sessions
    sessions, _ = one("درس(ت): شنبه 19:00-17:00 هفته14 درس(ت): شنبه 19:00-17:00 هفته15 درس(ت): شنبه 19:00-17:00 هفته16")
    assert [(s.week, s.week_number) for s in sessions] == [("all", 14), ("all", 15), ("all", 16)]
    assert sessions[0].week_number and sessions[0].day == 0


@pytest.mark.parametrize("n", ["0", "21"])
def test_a11_week_number_out_of_range(n):
    _, _, problems = parse_time_cell(f"درس(ت): شنبه 19:00-17:00 هفته{n}")
    assert any("شماره هفته نامعتبر" in p for p in problems)


def test_fr65_single_date_session():
    sessions, _ = one("درس(ت): 1405/02/17 19:00-17:00 مکان: سالن")
    assert (sessions[0].day, sessions[0].date, sessions[0].start) == (None, "1405/02/17", "17:00")


def test_session_without_place():
    sessions, _ = one("درس(ت): سه شنبه 10:00-08:00 درس(ت): سه شنبه 16:00-15:00")
    assert [s.place for s in sessions] == ["", ""]


def test_practical_exam_glued_to_previous_entry():
    _, exams = one("امتحان(1405/06/07) ساعت : 17:00-14:00امتحان عملی(1405/06/07) ساعت : 17:00-14:00")
    assert [e.kind for e in exams] == ["final", "practical"]


def test_empty_cell():
    assert parse_time_cell("") == ([], [], [])


@pytest.mark.parametrize(
    "text,expected",
    [
        ("حل تمرین(ت): دوشنبه 2:30-11:30 مکان: x", "ساعت ناقص (2:30)"),  # clipped print
        ("درس(ت): شنبه 10:30-12:30 مکان: x", "پایان (10:30) قبل از شروع (12:30)"),
        ("درس(ت): شنبه 10:30-10:30", "یا برابر آن"),
        ("درس(ت): شنبه 25:00-10:30", "ساعت نامعتبر (25:00)"),
        ("درس(ت): فردا 12:30-10:30", "ورودی ناشناخته"),
        ("مکان: کلاس 4", "ورودی ناشناخته"),
        ("درس(ت): 1405/13/01 12:30-10:30", "تاریخ نامعتبر"),
        ("امتحان(1405/04/06) ساعت : 16:00", "امتحان بدون ساعت پایان"),  # clipped print
        ("امتحان(1405/4/06) ساعت : 18:00-16:00", "تاریخ ناقص"),
        ("امتحان(1405/04/06) ساعت : 16:00-18:00", "قبل از شروع"),
        ("امتحان(1405/04/06) ساعت : 18:00-16:00 امتحان(1405/04/07) ساعت : 18:00-16:00", "بیش از یک امتحان"),
    ],
)
def test_fr62_invalid_values_are_reported(text, expected):
    sessions, exams, problems = parse_time_cell(text)
    assert any(expected in p for p in problems), problems


def test_fr62_bad_session_is_not_kept():
    sessions, _, problems = parse_time_cell("درس(ت): شنبه 10:30-12:30")
    assert sessions == [] and problems


def test_check_helpers():
    assert check_time("08:30") == []
    assert check_date("1405/06/31") == []
    assert check_date("1405/07/31") != []  # second half of the year has 30 days
    assert check_date("1405/00/10") != []
