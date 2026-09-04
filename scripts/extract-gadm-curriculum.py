"""Build the offline SD curriculum corpus from official Kemendikdasmen PDFs.

The script intentionally extracts only Fase A, B, and C. It never generates,
paraphrases, or translates official CP text.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


GENERAL_SUBJECTS = (
    ("pendidikan_pancasila", "Pendidikan Pancasila", 76, 88),
    ("bahasa_indonesia", "Bahasa Indonesia", 88, 100),
    ("matematika", "Matematika", 106, 120),
    ("bahasa_inggris", "Bahasa Inggris", 126, 139),
    ("ipas", "Ilmu Pengetahuan Alam dan Sosial (IPAS)", 146, 153),
    ("seni_musik", "Seni Musik", 234, 243),
    ("seni_rupa", "Seni Rupa", 243, 250),
    ("seni_tari", "Seni Tari", 250, 260),
    ("seni_teater", "Seni Teater", 260, 268),
    ("pjok", "Pendidikan Jasmani, Olahraga, dan Kesehatan", 302, 316),
    ("koding_ka", "Koding dan Kecerdasan Artifisial", 338, 348),
)

PHASE_MARKERS = {
    "faseA": ("A", "B"),
    "faseB": ("B", "C"),
    "faseC": ("C", "D"),
}


def normalize_pdf_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u200b", " ")).strip()


def source_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def extract_page_range(reader: PdfReader, first_page: int, next_page: int) -> str:
    pages = []
    for page_number in range(first_page, next_page):
        pages.append(reader.pages[page_number - 1].extract_text() or "")
    return normalize_pdf_text(" ".join(pages))


def phase_pattern(current: str, following: str) -> re.Pattern[str]:
    return re.compile(
        rf"(?:^|\s)(?:[1-6]\.)?\s*Fase\s*{current}\b.*?(?=(?:[1-6]\.)?\s*Fase\s*{following}\b)",
        re.IGNORECASE,
    )


def extract_phase(text: str, phase_id: str) -> str | None:
    current, following = PHASE_MARKERS[phase_id]
    match = phase_pattern(current, following).search(text)
    if match:
        return normalize_pdf_text(match.group(0))
    if phase_id != "faseC":
        return None
    terminal = re.search(
        r"(?:^|\s)(?:[1-6]\.)?\s*Fase\s*C\b.*?(?=(?:[1-6]\.)?\s*Fase\s*D\b|$)",
        text,
        re.IGNORECASE,
    )
    return normalize_pdf_text(terminal.group(0)) if terminal else None


def build_general_records(pdf_path: Path) -> list[dict[str, object]]:
    reader = PdfReader(str(pdf_path))
    records: list[dict[str, object]] = []
    for subject_id, label, first_page, next_page in GENERAL_SUBJECTS:
        subject_text = extract_page_range(reader, first_page, next_page)
        found = 0
        for phase_id in PHASE_MARKERS:
            official_text = extract_phase(subject_text, phase_id)
            if not official_text:
                continue
            records.append(
                {
                    "id": f"cp_046_2025_{subject_id}_{phase_id}",
                    "subjectId": subject_id,
                    "subjectLabel": label,
                    "phase": phase_id,
                    "officialText": official_text,
                    "sourceId": "cp_046_2025",
                    "decisionNumber": "046/H/KR/2025",
                    "effectiveFrom": "2025-07-16",
                    "sourcePages": [first_page, next_page - 1],
                    "status": "active_2026",
                }
            )
            found += 1
        expected = {"ipas": 2, "koding_ka": 1}.get(subject_id, 3)
        if found != expected:
            raise ValueError(f"{label}: expected {expected} SD phases, found {found}")
    return records


def build_payload(general_pdf: Path) -> dict[str, object]:
    records = build_general_records(general_pdf)
    return {
        "schemaVersion": 1,
        "verifiedAt": "2026-09-02",
        "scope": "SD/MI Fase A-C",
        "sources": {
            "cp_046_2025": {
                "authority": "Kementerian Pendidikan Dasar dan Menengah / BSKAP",
                "decisionNumber": "046/H/KR/2025",
                "officialUrl": "https://kurikulum.kemendikdasmen.go.id/file/1753929861_manage_file.pdf",
                "sha256": source_hash(general_pdf),
                "effectiveFrom": "2025-07-16",
                "statusIn2026": "active_except_religion_amendment",
            },
            "cp_020_2026": {
                "authority": "Kementerian Pendidikan Dasar dan Menengah / BKPDM",
                "decisionNumber": "020 Tahun 2026",
                "officialNoticeUrl": "https://www.kemendikdasmen.go.id/siaran-pers/15636-capaian-pembelajaran-baru-telah-terbit-yang-berubah-hanya-mata-pelajaran-agama-dan-budi-pekerti",
                "effectiveFrom": "2026-06-11",
                "statusIn2026": "active_religion_only",
            },
        },
        "records": records,
    }


def write_module(payload: dict[str, object], output_path: Path) -> None:
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    output = (
        "/** Generated from the official Kemendikdasmen CP decision. Do not edit manually. */\n"
        f"export const GADM_CURRICULUM_2026 = Object.freeze({serialized});\n\n"
        "export default GADM_CURRICULUM_2026;\n"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8", newline="\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--general-pdf", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.general_pdf.is_file():
        raise FileNotFoundError(args.general_pdf)
    payload = build_payload(args.general_pdf)
    write_module(payload, args.output)
    print(f"Generated {len(payload['records'])} verified SD phase records: {args.output}")


if __name__ == "__main__":
    main()
