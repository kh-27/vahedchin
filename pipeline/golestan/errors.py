"""Problems found while parsing. Any issue fails the build (FR-62, BR-9)."""

from __future__ import annotations

from dataclasses import dataclass

CLIPPED_MESSAGE = "PDF بریده است؛ با A3 افقی دوباره چاپ کنید"


@dataclass(frozen=True)
class Issue:
    page: int
    code: str  # group code if known, else ""
    message: str  # Persian, shown in the Actions summary
    raw: str  # the raw row/cell text, so the team can find it in the PDF

    def format(self) -> str:
        where = f"صفحه {self.page}" + (f"، گروه {self.code}" if self.code else "")
        return f"{where}: {self.message} — «{self.raw}»"


class ClippedPdfError(Exception):
    """The PDF was not printed full width (A3 landscape), FR-68."""

    def __init__(self, page: int, detail: str):
        super().__init__(f"{CLIPPED_MESSAGE} (صفحه {page}: {detail})")
        self.page = page
        self.detail = detail
