"""OCR a scanned curriculum decision into page-addressable JSON for verification."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    if not match:
        raise ValueError(f"Page number missing in filename: {path.name}")
    return int(match.group(1))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pages = sorted(args.images.glob("*.png"), key=page_number)
    if not pages:
        raise FileNotFoundError(f"No PNG pages in {args.images}")
    engine = RapidOCR()
    output = []
    for position, path in enumerate(pages, 1):
        result, _ = engine(str(path))
        lines = [str(item[1]).strip() for item in (result or []) if str(item[1]).strip()]
        output.append({"page": page_number(path), "text": "\n".join(lines)})
        print(f"OCR {position}/{len(pages)}: page {page_number(path)}", flush=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(output)} pages to {args.output}")


if __name__ == "__main__":
    main()
