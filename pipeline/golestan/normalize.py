"""Text normalization for words extracted from Golestan PDFs (FR-61).

pdfplumber returns Persian words in visual order using Arabic presentation
forms. Each word is converted to logical order like this:

1. reverse the characters (and swap parentheses), *before* NFKC, otherwise
   the lam-alef ligature expands to "لا" and then reverses to "ال"
   ("کلاس" would become "کالس");
2. NFKC (presentation forms -> base letters);
3. Arabic letters ي/ك/ھ/ۀ -> Persian ی/ک/ه, Arabic/Persian digits -> ASCII;
4. restore the order of digit runs, which were already logical.
"""

from __future__ import annotations

import re
import unicodedata

_DIGITS = {0x660 + i: ord("0") + i for i in range(10)}
_DIGITS.update({0x6F0 + i: ord("0") + i for i in range(10)})

_LETTERS = str.maketrans(
    {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ھ": "ه",
        "ۀ": "ه",
        "‏": None,  # RLM
        "‎": None,  # LRM
    }
)

_PARENS = str.maketrans("()[]", ")(][")

# Arabic-script letters, including presentation forms, but not digits.
_RTL_LETTER = re.compile(r"[؀-ٟ٪-ۯۺ-ۿﭐ-﷿ﹰ-﻿]")
_DIGIT_RUN = re.compile(r"[0-9][0-9:/\-_.]*[0-9]|[0-9]")
_SPACES = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """NFKC plus Persian letter and digit folding. Does not reorder."""
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(_DIGITS).translate(_LETTERS)
    return _SPACES.sub(" ", text).strip()


def logical_word(token: str) -> str:
    """Convert one visual-order word from the PDF into logical order."""
    if not _RTL_LETTER.search(token):
        # Digits and Latin are already in logical order.
        return normalize_text(token)
    reversed_token = token[::-1].translate(_PARENS)
    text = normalize_text(reversed_token)
    return _DIGIT_RUN.sub(lambda m: m.group(0)[::-1], text)
