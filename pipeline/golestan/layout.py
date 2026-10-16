"""Turn a PDF page into a header plus table rows of cell text.

Column boundaries come from the thin vertical border rects of the table and
row boundaries from the thin horizontal ones (both drawn by Chrome's print).
A full-width print has 13 columns, i.e. 14 vertical borders.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalize import logical_word, normalize_text

# Left to right, as on the page.
COLUMNS = (
    "emergency_drop",
    "other_centers",
    "notes",
    "time",
    "teacher",
    "gender",
    "waitlist",
    "registered",
    "capacity",
    "practical",
    "units",
    "name",
    "code",
)
CODE_RE = re.compile(r"^\d{7}_\d{2}$")
REPORT_MARK = "شماره گزارش"  # present in every report page header

_THIN = 2.0  # pt; border rects are ~0.75pt
_MERGE = 3.0  # pt; borders closer than this are the same line
_LINE_TOL = 2.5  # pt; words whose tops differ less are on the same text line


@dataclass
class Row:
    top: float
    cells: dict[str, list[str]]  # column -> text lines (logical order)

    @property
    def code(self) -> str | None:
        text = " ".join(self.cells["code"])
        return text if CODE_RE.match(text) else None

    def raw(self) -> str:
        return " | ".join(" / ".join(self.cells[c]) for c in reversed(COLUMNS) if self.cells[c])


@dataclass
class PageLayout:
    """One physical PDF page.

    A Golestan report page ("صفحه x از y") is a bit taller than an A3 sheet,
    so Chrome continues it on the next physical page. Such a continuation
    page has no report header and no column titles, and may start with the
    rest of a row cut at the previous page's bottom (``continued``).
    """

    page: int
    empty: bool = False
    borders: int = 0
    has_header: bool = False
    header_lines: list[str] = field(default_factory=list)
    column_titles: dict[str, str] = field(default_factory=dict)
    continued: list[Row] = field(default_factory=list)  # belongs to the previous page's last row
    rows: list[Row] = field(default_factory=list)
    stray: list[str] = field(default_factory=list)  # text outside any cell


def read_page(page, page_no: int) -> PageLayout:
    """Layout of a pdfplumber page."""
    words = page.extract_words(x_tolerance=1.5)
    return layout_from(words, page.rects, page_no)


def layout_from(words: list[dict], rects: list[dict], page_no: int) -> PageLayout:
    if not words:
        return PageLayout(page=page_no, empty=True)

    xs = _cluster(r["x0"] for r in rects if r["width"] < _THIN)
    layout = PageLayout(page=page_no, borders=len(xs))
    if len(xs) != len(COLUMNS) + 1:
        layout.header_lines = text_lines(words)
        return layout

    left, right = xs[0], xs[-1]
    ys = _cluster(
        r["top"]
        for r in rects
        if r["height"] < _THIN and r["x1"] > left + _MERGE and r["x0"] < right - _MERGE
    )
    if not ys:
        layout.header_lines = text_lines(words)
        return layout

    def cy(w: dict) -> float:
        return (w["top"] + w["bottom"]) / 2

    above = [w for w in words if cy(w) < ys[0]]
    layout.has_header = any(REPORT_MARK in line for line in text_lines(above))
    # Rows may be cut at the page's top or bottom edge, where no border is drawn.
    bounds = [*ys, float("inf")]
    if layout.has_header:
        layout.header_lines = text_lines(above)
        words = [w for w in words if cy(w) >= ys[0]]
    else:
        bounds.insert(0, float("-inf"))

    bands: list[list[dict]] = [[] for _ in range(len(bounds) - 1)]
    for w in words:
        if not left <= (w["x0"] + w["x1"]) / 2 < right:
            layout.stray.append(logical_word(w["text"]))
            continue
        bands[_index(bounds, cy(w))].append(w)

    titles: dict[str, list[str]] = {c: [] for c in COLUMNS}
    seen_data = False
    for band_words in bands:
        if not band_words:
            continue
        cells: dict[str, list[dict]] = {c: [] for c in COLUMNS}
        for w in band_words:
            cells[COLUMNS[_index(xs, (w["x0"] + w["x1"]) / 2)]].append(w)
        row = Row(top=min(w["top"] for w in band_words), cells={c: text_lines(ws) for c, ws in cells.items()})
        if not seen_data and row.code is None:
            if layout.has_header:
                for c in COLUMNS:
                    titles[c] += row.cells[c]
            else:
                layout.continued.append(row)
            continue
        seen_data = True
        layout.rows.append(row)

    if layout.has_header:
        layout.column_titles = {c: normalize_text(" ".join(t)) for c, t in titles.items()}
    return layout


def text_lines(words: list[dict]) -> list[str]:
    """Group words into visual lines (top to bottom), each read right to left."""
    lines: list[list[dict]] = []
    tops: list[float] = []
    for w in sorted(words, key=lambda w: w["top"]):
        for i, t in enumerate(tops):
            if abs(t - w["top"]) < _LINE_TOL:
                lines[i].append(w)
                break
        else:
            tops.append(w["top"])
            lines.append([w])
    return [
        normalize_text(" ".join(logical_word(w["text"]) for w in sorted(line, key=lambda w: -w["x1"])))
        for line in lines
    ]


def _cluster(values) -> list[float]:
    out: list[float] = []
    for v in sorted(values):
        if not out or v - out[-1] > _MERGE:
            out.append(v)
    return out


def _index(bounds: list[float], v: float) -> int | None:
    for i in range(len(bounds) - 1):
        if bounds[i] <= v < bounds[i + 1]:
            return i
    return None
