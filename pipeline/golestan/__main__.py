"""Command line: python -m golestan <report110.pdf> --out-dir data/terms

Exit codes: 0 published, 1 invalid data (FR-62), 2 clipped print (FR-68).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .build import parse_pdf
from .errors import ClippedPdfError
from .model import TermData
from .summary import render


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="golestan", description=__doc__.splitlines()[0])
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--out-dir", type=Path, default=Path("data/terms"))
    ap.add_argument("--summary", type=Path, help="append the Markdown summary here (GITHUB_STEP_SUMMARY)")
    ap.add_argument("--github-output", type=Path, help="append term=… and report_date=… here (GITHUB_OUTPUT)")
    ap.add_argument("--workers", type=int, default=None)
    args = ap.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    t0 = time.monotonic()
    try:
        result = parse_pdf(args.pdf, workers=args.workers)
    except ClippedPdfError as e:
        _emit(args, render(args.pdf.name, {}, [], None, fatal=str(e)))
        print(f"error: {e}", file=sys.stderr)
        return 2

    data = result.data
    _emit(args, render(args.pdf.name, result.stats, result.issues, data.term if data else None))
    print(f"{time.monotonic() - t0:.1f}s", file=sys.stderr)
    if data is None:
        for issue in result.issues:
            print(f"error: {issue.format()}", file=sys.stderr)
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"{data.term}.json"
    out.write_text(dump(data), encoding="utf-8", newline="\n")
    print(f"wrote {out}", file=sys.stderr)
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as f:
            f.write(f"term={data.term}\nreport_date={data.report_date}\njson={out.as_posix()}\n")
    return 0


def dump(data: TermData) -> str:
    """Compact JSON with one group per line, so git diffs stay readable."""
    obj = data.to_json()
    groups = obj.pop("groups")
    head = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    body = ",\n".join(json.dumps(g, ensure_ascii=False, separators=(",", ":")) for g in groups)
    return head[:-1] + ',"groups":[\n' + body + "\n]}\n"


def _emit(args, markdown: str) -> None:
    print(markdown)
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as f:
            f.write(markdown + "\n")


if __name__ == "__main__":
    sys.exit(main())
