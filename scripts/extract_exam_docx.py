#!/usr/bin/env python3
"""Extract paragraphs and tables from the repository's 2025 Korean exam DOCX."""
from pathlib import Path
import sys
from docx import Document

SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])

doc = Document(SOURCE)
lines = [
    "# 2025학년도 2학기 기말고사 2학년 국어 문제",
    "",
    f"> 원본: `{SOURCE.name}`",
    "> 자동 추출본입니다. 표/문단 순서는 가능한 한 원문 흐름을 따릅니다.",
    "",
]

def clean(value):
    return " ".join((value or "").replace("\u00a0", " ").split())

for block in doc.iter_inner_content():
    if hasattr(block, "rows"):
        lines.append("[표]")
        for row in block.rows:
            cells = [clean(cell.text) for cell in row.cells]
            lines.append(" | ".join(cells))
        lines.append("[표 끝]")
        lines.append("")
    elif hasattr(block, "text"):
        value = clean(block.text)
        if value:
            lines.append(value)
            lines.append("")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
print(f"Extracted {len(doc.paragraphs)} paragraphs and {len(doc.tables)} tables -> {OUTPUT}")
