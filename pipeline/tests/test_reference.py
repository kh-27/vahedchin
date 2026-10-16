"""NFR-13, US-11, US-14 on the real PDFs (slow; skipped if a file is missing).

Expected counts are the parser's real output on all4051.pdf, checked against
the prototype: dropping the 58 rows cut across pages reproduces the
prototype's 6881 sessions / 3608 exams exactly (SRS v0.6).
"""

import pytest

from conftest import FIXTURES
from golestan.build import parse_pdf
from golestan.errors import ClippedPdfError

pytestmark = pytest.mark.reference

FULL = FIXTURES / "all4051.pdf"
CLIPPED = [FIXTURES / "all4042-clipped.pdf", FIXTURES / "all405-clipped.pdf"]


def need(path):
    if not path.exists():
        pytest.skip(f"{path.name} not present")
    return path


@pytest.fixture(scope="module")
def full():
    return parse_pdf(need(FULL))


def test_nfr13_counts(full):
    s = full.stats
    assert full.issues == []
    assert s["pages"] == 471 and s["empty_pages"] == 1
    assert s["groups"] == 5297
    assert s["sessions"] == 6884
    assert s["dated_sessions"] == 18
    assert s["exams"] == 3658 and s["practical_exams"] == 1
    assert (s["week_odd"], s["week_even"]) == (130, 146)
    assert s["half_term_sessions"] == 4 and s["single_week_sessions"] == 0
    assert s["joined_rows"] == 58
    assert s["faculties"] == 28 and s["departments"] == 115


def test_fr69_term_from_header(full):
    d = full.data
    assert (d.term, d.report_date, d.report_time) == ("4042", "1405/07/24", "12:46")
    assert d.source_file == "all4051.pdf" and len(d.source_sha256) == 64


def by_code(full, code):
    return next(g for g in full.data.groups if g.code == code)


def test_us14_riazi_mohandesi(full):
    g = by_code(full, "1118061_01")
    dept = full.data.departments[g.department]
    assert (dept.faculty, dept.department, dept.level) == ("مهندسی مواد و متالورژی", "مهندسی مواد", "کارشناسی")
    assert g.name == "ریاضی مهندسی"
    got = [(s.kind, s.day, s.start, s.end) for s in g.sessions]
    assert got == [
        ("lecture", 0, "10:30", "12:30"),
        ("lecture", 2, "17:00", "18:00"),
        ("problem_solving", 2, "18:00", "19:00"),
    ]
    assert [(e.date, e.start, e.end) for e in g.exams] == [("1405/04/06", "16:00", "18:00")]


def test_us14_shimi_omoomi_odd_week(full):
    g = by_code(full, "1118424_01")
    assert g.name == "شیمی عمومی"
    assert (g.sessions[0].day, g.sessions[0].start, g.sessions[0].end, g.sessions[0].week) == (2, "10:30", "12:30", "odd")


def test_lam_alef_in_real_place_names(full):
    places = " ".join(s.place for g in full.data.groups for s in g.sessions)
    assert "کلاس" in places and "کالس" not in places


@pytest.mark.parametrize("path", CLIPPED, ids=lambda p: p.name)
def test_us11_fr68_clipped_print_rejected(path):
    with pytest.raises(ClippedPdfError, match="PDF بریده است؛ با A3 افقی دوباره چاپ کنید"):
        parse_pdf(need(path))
