"""FR-61: normalization. Raw tokens are copied from all4051.pdf."""

from golestan.normalize import logical_word, normalize_text


def test_fr61_reverse_before_nfkc_keeps_lam_alef():
    # 'سﻼﻛ' (U+FEFC lam-alef ligature). NFKC first would give "کالس".
    assert logical_word("سﻼﻛ") == "کلاس"


def test_fr61_presentation_forms_and_arabic_letters():
    # Arabic ي and presentation forms -> Persian ی
    assert logical_word("يژرﻮﻟﺎﺘﻣ") == "متالورژی"
    # ھ (U+06BE via U+FBAB) -> ه, and the visual leading ":" moves to the front
    assert logical_word("ﻲﺳﺪﻨﮫﻣ:") == ":مهندسی"


def test_fr61_mixed_arabic_and_persian_digits_in_code():
    assert logical_word("١١١٨٠۶١_٠١") == "1118061_01"


def test_fr61_digit_runs_keep_order_and_parentheses_swap():
    raw = "(١۴٠۵/٠۴/٠۶)نﺎﺤﺘﻣا"
    assert logical_word(raw) == "امتحان(1405/04/06)"


def test_fr61_digits_glued_to_letters():
    assert logical_word("١ﻪﻤﯿﻧ") == "نیمه1"
    assert logical_word("٠۴-٠۵ﻲﻠﯿﺼﺤﺗ") == "تحصیلی04-05"


def test_fr61_time_range_stays_visual_end_start():
    assert logical_word("١٠:٣٠-٠٨:٣٠") == "10:30-08:30"


def test_latin_is_not_reversed():
    assert logical_word("Lab-A1") == "Lab-A1"


def test_normalize_text_folds_letters_spaces_and_marks():
    assert normalize_text(" كيھۀ‏  ٣۴ ") == "کیهه 34"
    assert normalize_text("می‌شود") == "می‌شود"  # ZWNJ is kept
