"""Command line, JSON output and the Actions summary (FR-63, FR-69)."""

import json
from collections import Counter

import pytest

from conftest import cells, header_lines, page
from golestan import __main__ as cli
from golestan.build import BuildResult, assemble
from golestan.errors import ClippedPdfError, Issue
from golestan.layout import layout_from
from golestan.summary import MAX_ISSUES_SHOWN, render


def ok_result():
    r = assemble([layout_from(*page([cells(), cells(code="1118424_01")], header=header_lines()), 1)])
    r.data.source_file, r.data.source_sha256, r.data.pages = "all4051.pdf", "ab", 1
    return r


@pytest.fixture
def run(monkeypatch, tmp_path):
    def go(result_or_exc):
        def fake(path, workers=None):
            if isinstance(result_or_exc, Exception):
                raise result_or_exc
            return result_or_exc

        monkeypatch.setattr(cli, "parse_pdf", fake)
        summary, output = tmp_path / "summary.md", tmp_path / "out.txt"
        code = cli.main(
            ["x.pdf", "--out-dir", str(tmp_path / "terms"), "--summary", str(summary), "--github-output", str(output)]
        )
        return code, tmp_path, summary.read_text(encoding="utf-8"), output

    return go


def test_fr69_success_writes_term_json(run):
    code, tmp, summary, output = run(ok_result())
    assert code == 0
    text = (tmp / "terms" / "4042.json").read_text(encoding="utf-8")
    data = json.loads(text)
    assert data["schemaVersion"] == 1 and data["term"] == "4042"
    assert data["source"] == {"file": "all4051.pdf", "sha256": "ab", "pages": 1}
    g = data["groups"][0]
    assert g["code"] == "1118061_01" and g["units"] == 3 and g["exams"][0]["kind"] == "final"
    assert text.count("\n") == 4  # head, one line per group, closing
    assert "✅ ترم `4042` بدون خطا" in summary
    assert output.read_text(encoding="utf-8").splitlines()[:2] == ["term=4042", "report_date=1405/07/24"]


def test_fr62_issues_exit_1_and_write_nothing(run):
    issue = Issue(5, "1118061_01", "ظرفیت عدد نیست", "raw row")
    code, tmp, summary, output = run(BuildResult(None, [issue], Counter(groups=1, issues=1)))
    assert code == 1
    assert not (tmp / "terms").exists() and not output.exists()
    assert "❌ **1 خطا؛ داده منتشر نشد.**" in summary
    assert "صفحه 5، گروه 1118061_01: ظرفیت عدد نیست — «raw row»" in summary


def test_fr68_clipped_exit_2(run):
    code, tmp, summary, _ = run(ClippedPdfError(1, "10 مرز ستون به‌جای 14"))
    assert code == 2
    assert "PDF بریده است؛ با A3 افقی دوباره چاپ کنید" in summary


def test_fr63_summary_lists_counts_and_truncates_issues():
    issues = [Issue(1, "", f"خطا {i}", "") for i in range(MAX_ISSUES_SHOWN + 3)]
    md = render("a.pdf", Counter(groups=5297, week_odd=130), issues, None)
    assert "| گروه درسی | 5297 |" in md and "| هفته فرد (ف) | 130 |" in md
    assert "… و 3 خطای دیگر" in md


def test_decimal_units_in_json():
    r = assemble([layout_from(*page([cells(units="1", practical="0/5")], header=header_lines()), 1)])
    assert '"practicalUnits":0.5' in cli.dump(r.data)
