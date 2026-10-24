#!/usr/bin/env python3
# Made with Grok Bot.
"""Replace the LEDGER-DATA marker block in Claudia's Brain canvas with new JSON.

Usage:
  python3 inject.py TEMPLATE.canvas.tsx LEDGER.json -o OUTPUT.canvas.tsx
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

START = "/* LEDGER-DATA-START */"
END = "/* LEDGER-DATA-END */"


def inject(template: str, ledger_obj: object) -> str:
    start = template.find(START)
    end = template.find(END)
    if start < 0 or end < 0 or end < start:
        raise SystemExit(
            "error: LEDGER-DATA markers missing or out of order "
            f"(need {START!r} then {END!r})"
        )
    end_after = end + len(END)
    payload = json.dumps(ledger_obj, ensure_ascii=False, indent=2)
    block = f"{START}\nconst LEDGER: Ledger = {payload};\n{END}"
    return template[:start] + block + template[end_after:]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Inject ledger JSON into Claudia's Brain canvas (marker block only)."
    )
    p.add_argument("template", type=Path, help="Downloaded claudia-brain.canvas.tsx")
    p.add_argument("ledger", type=Path, help="Ledger JSON file")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        required=True,
        help="Output .canvas.tsx path",
    )
    args = p.parse_args(argv)

    template_text = args.template.read_text(encoding="utf-8")
    try:
        ledger_obj = json.loads(args.ledger.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"error: invalid ledger JSON: {e}") from e

    out = inject(template_text, ledger_obj)
    args.output.write_text(out, encoding="utf-8")
    print(f"wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
