"""Page layout: columns from borders, rows cut across pages."""

from conftest import XS, cells, header_lines, page, vborders, vis, word
from golestan.layout import layout_from, text_lines


def test_header_page_rows_and_titles():
    words, rects = page([cells(), cells(code="1118424_01")], header=header_lines())
    L = layout_from(words, rects, 1)
    assert L.borders == 14 and L.has_header and not L.empty
    assert L.header_lines[0] == "دانشگاه سمنان"
    assert L.column_titles["emergency_drop"] == "حذف اضطراری"
    assert [r.code for r in L.rows] == ["1118061_01", "1118424_01"]
    assert L.rows[0].cells["time"][1] == "امتحان(1405/04/06) ساعت : 18:00-16:00"
    assert L.continued == [] and L.stray == []


def test_continuation_page_with_fragment_and_cut_last_row():
    fragment = {"time": "امتحان(1405/04/09) ساعت : 18:00-16:00"}
    words, rects = page([cells()], header=None, fragment=fragment, cut_last=True)
    L = layout_from(words, rects, 3)
    assert not L.has_header and L.header_lines == [] and L.column_titles == {}
    assert len(L.continued) == 1 and L.continued[0].code is None
    assert L.continued[0].cells["time"] == ["امتحان(1405/04/09) ساعت : 18:00-16:00"]
    assert [r.code for r in L.rows] == ["1118061_01"]  # last row has no bottom border


def test_row_raw_lists_cells_right_to_left():
    words, rects = page([cells()], header=header_lines())
    raw = layout_from(words, rects, 1).rows[0].raw()
    assert raw.startswith("1118061_01 | ریاضی مهندسی | 3 | 0")


def test_text_outside_table_is_stray():
    words, rects = page([cells()], header=header_lines())
    words.append(word("یادداشت", None, 115, x0=200))
    assert layout_from(words, rects, 1).stray == ["یادداشت"]


def test_clipped_print_has_fewer_borders():
    words, rects = page([cells()], header=header_lines())
    rects = [r for r in rects if r["width"] >= 2] + vborders(100, 160, XS[3:])
    L = layout_from(words, rects, 1)
    assert L.borders == 11 and L.rows == []


def test_page_with_vertical_borders_only():
    words, rects = page([cells()], header=header_lines())
    rects = [r for r in rects if r["width"] < 2]
    L = layout_from(words, rects, 1)
    assert L.rows == [] and L.header_lines


def test_empty_page():
    assert layout_from([], [], 328).empty


def test_text_lines_orders_rtl_and_top_down():
    ws = [
        {"text": "ب", "x0": 10, "x1": 15, "top": 20.0, "bottom": 28},
        {"text": "ج", "x0": 0, "x1": 5, "top": 21.0, "bottom": 29},
        {"text": vis("الف"), "x0": 20, "x1": 30, "top": 19.5, "bottom": 27},
        {"text": "د", "x0": 20, "x1": 25, "top": 40.0, "bottom": 48},
    ]
    assert text_lines(ws) == ["الف ب ج", "د"]
