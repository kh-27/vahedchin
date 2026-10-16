"""assemble(): cross-page checks, cut rows, FR-62/FR-68 failures."""

import pytest

from conftest import cells, header_lines, page
from golestan.build import assemble, check_full_print
from golestan.errors import ClippedPdfError
from golestan.layout import PageLayout, layout_from


def L(no, rows, **kw):
    return layout_from(*page(rows, **kw), no)


def messages(result):
    return [i.message for i in result.issues]


def test_two_departments_publish():
    r = assemble(
        [
            L(1, [cells(), cells(code="1118424_01")], header=header_lines(1, 1)),
            PageLayout(page=2, empty=True),
            L(3, [cells(code="1210001_01")], header=header_lines(1, 1, dept="مهندسی متالورژی")),
        ]
    )
    assert r.issues == []
    d = r.data
    assert (d.term, d.report_date, d.university) == ("4042", "1405/07/24", "دانشگاه سمنان")
    assert [g.department for g in d.groups] == [0, 0, 1]
    assert len(d.departments) == 2
    s = r.stats
    assert (s["groups"], s["courses"], s["sessions"], s["exams"], s["empty_pages"]) == (3, 3, 3, 3, 1)
    assert (s["faculties"], s["departments"], s["sections"]) == (1, 2, 2)


def test_cut_row_is_joined_with_previous_page():
    first = L(1, [cells(time=["درس(ت): شنبه 12:30-10:30 مکان: کلاس 4"])], header=header_lines(1, 1), cut_last=True)
    cont = L(2, [cells(code="1118424_01")], header=None, fragment={"time": "امتحان(1405/04/09) ساعت : 18:00-16:00"})
    r = assemble([first, cont])
    assert r.issues == []
    g = r.data.groups[0]
    assert g.exams[0].date == "1405/04/09"  # the prototype silently lost this
    assert [x.department for x in r.data.groups] == [0, 0]
    assert (r.stats["joined_rows"], r.stats["continuation_pages"]) == (1, 1)


def test_fragment_without_previous_row():
    cont = L(2, [], header=None, fragment={"time": "مکان: کلاس"})
    r = assemble([L(1, [], header=header_lines()), cont])
    assert "تکه سطر بدون سطر قبلی" in messages(r)
    assert "صفحه جدول بدون سطر داده" in messages(r)
    assert r.data is None


def test_continuation_page_first_in_pdf():
    r = assemble([L(1, [cells()], header=None)])
    assert "صفحه ادامه بدون سربرگ قبلی" in messages(r)
    assert "هیچ صفحه جدولی پیدا نشد" in messages(r)


def test_duplicate_group_code():
    r = assemble([L(1, [cells(), cells()], header=header_lines())])
    assert any("کد گروه تکراری" in m for m in messages(r))


def test_row_problems_fail_the_build_with_raw_row():
    r = assemble([L(1, [cells(capacity="x")], header=header_lines())])
    assert r.data is None
    issue = r.issues[0]
    assert (issue.page, issue.code) == (1, "1118061_01")
    assert "1118061_01 | ریاضی مهندسی" in issue.raw
    assert issue.format().startswith("صفحه 1، گروه 1118061_01: ظرفیت عدد نیست")


def test_row_without_code_in_the_middle():
    r = assemble([L(1, [cells(), cells(code="")], header=header_lines())])
    assert "سطر بدون کد گروه" in messages(r)


def test_stray_text_and_bad_header():
    lay = L(1, [cells()], header=header_lines()[:4])
    lay.stray = ["x"]
    r = assemble([lay])
    assert "متن خارج از جدول" in messages(r)
    assert any(m.startswith("سربرگ ناقص است") for m in messages(r))


def test_mixed_reports_in_one_pdf():
    r = assemble(
        [
            L(1, [cells()], header=header_lines(1, 1)),
            L(2, [cells(code="1210001_01")], header=header_lines(1, 1, dept="x", time="13:00 - 1405/07/25")),
        ]
    )
    assert any("تاریخ گزارش با صفحه اول فرق دارد" in m for m in messages(r))
    assert any("ساعت گزارش با صفحه اول فرق دارد" in m for m in messages(r))


def test_department_pages_must_be_complete():
    # "1 of 3", "3 of 3": page 2 is missing
    r = assemble([L(1, [cells()], header=header_lines(1, 3)), L(2, [cells(code="1118061_02")], header=header_lines(3, 3))])
    assert any("کامل یا پشت‌سرهم نیست" in m for m in messages(r))


def test_department_may_have_two_complete_runs():
    # seen in all4051.pdf: a department printed as "1..3 of 3" and later "1 of 1"
    other = header_lines(1, 1, dept="دیگر")
    r = assemble(
        [
            L(1, [cells()], header=header_lines(1, 2)),
            L(2, [cells(code="1118061_02")], header=header_lines(2, 2)),
            L(3, [cells(code="1210001_01")], header=other),
            L(4, [cells(code="1118061_03")], header=header_lines(1, 1)),
        ]
    )
    assert r.issues == []
    assert [g.department for g in r.data.groups] == [0, 0, 1, 0]


def test_fr68_wrong_column_titles_rejected():
    lay = L(1, [cells()], header=header_lines())
    lay.column_titles["notes"] = ""
    with pytest.raises(ClippedPdfError, match="PDF بریده است"):
        check_full_print(lay)


def test_fr68_border_count_rejected_in_assemble():
    lay = L(1, [cells()], header=header_lines())
    lay.borders = 10
    with pytest.raises(ClippedPdfError, match="10 مرز ستون به‌جای 14"):
        assemble([lay])
