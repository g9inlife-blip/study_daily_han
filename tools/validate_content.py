#!/usr/bin/env python3
"""Validate manifest and the daily XML question files used by study_daily_han."""
from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "manifest.json"
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]
EXPECTED_SUBJECT = {"월": "국어", "화": "수학", "수": "과학", "목": "역사", "금": "영어"}


def fail(message: str) -> None:
    raise ValueError(message)


def text(node: ET.Element | None) -> str:
    return (node.text or "").strip() if node is not None else ""


def main() -> int:
    if not MANIFEST.exists():
        fail("data/manifest.json 파일이 없습니다.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    days = manifest.get("days")
    if not isinstance(days, list) or not days:
        fail("manifest.days가 비어 있거나 배열이 아닙니다.")

    errors: list[str] = []
    seen_dates: set[str] = set()
    for entry in days:
        date = entry.get("date", "")
        file_name = entry.get("file", "")
        if date in seen_dates:
            errors.append(f"{date}: manifest 날짜 중복")
            continue
        seen_dates.add(date)

        path = ROOT / file_name
        if not path.is_file():
            errors.append(f"{date}: 파일 없음: {file_name}")
            continue
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError as exc:
            errors.append(f"{date}: XML 파싱 오류: {exc}")
            continue

        if root.get("date") != date:
            errors.append(f"{date}: XML date 속성과 manifest 날짜 불일치")
        if root.get("weekday") != entry.get("weekday"):
            errors.append(f"{date}: XML weekday와 manifest weekday 불일치")
        if root.get("subject") != entry.get("subject"):
            errors.append(f"{date}: XML subject와 manifest subject 불일치")

        questions = root.findall("./questions/q")
        mcq = [q for q in questions if q.get("type") == "mcq"]
        short = [q for q in questions if q.get("type") == "short"]
        if len(questions) != 5 or len(mcq) != 3 or len(short) != 2:
            errors.append(f"{date}: 문제 구성 오류 (전체 {len(questions)}, 객관식 {len(mcq)}, 주관식 {len(short)})")

        for i, q in enumerate(questions, 1):
            stem = text(q.find("stem"))
            answer = text(q.find("answer"))
            explanation = text(q.find("explanation"))
            if not stem:
                errors.append(f"{date} Q{i}: 문제 문장이 비어 있음")
            if not answer:
                errors.append(f"{date} Q{i}: 정답이 비어 있음")
            if not explanation:
                errors.append(f"{date} Q{i}: 해설이 비어 있음")
            if q.get("type") == "mcq":
                choices = q.findall("./choices/choice")
                if len(choices) != 4:
                    errors.append(f"{date} Q{i}: 객관식 선택지는 4개여야 함")
                try:
                    answer_num = int(answer)
                    if answer_num < 1 or answer_num > len(choices):
                        errors.append(f"{date} Q{i}: 객관식 정답 번호 범위 오류")
                except ValueError:
                    errors.append(f"{date} Q{i}: 객관식 정답은 1-based 숫자여야 함")

        english = root.find("./english")
        words = english.findall("./word") if english is not None else []
        idioms = english.findall("./idiom") if english is not None else []
        if len(words) != 2:
            errors.append(f"{date}: 영어 단어 {len(words)}개 (2개 필요)")
        if len(idioms) != 2:
            errors.append(f"{date}: 영어 숙어 {len(idioms)}개 (2개 필요)")

        # Math-focused day: two medium MCQs and one high MCQ.
        if entry.get("subject") == "수학":
            medium = sum(q.get("difficulty") in ("중", "medium", "medium") for q in mcq)
            high = sum(q.get("difficulty") in ("상", "high") for q in mcq)
            if medium != 2 or high != 1:
                errors.append(f"{date}: 수학 객관식 난이도는 중 2개 + 상 1개여야 함 (중 {medium}, 상 {high})")

        weekday = entry.get("weekday")
        if weekday in EXPECTED_SUBJECT and entry.get("subject") != EXPECTED_SUBJECT[weekday]:
            errors.append(f"{date}: {weekday}요일 기본 과목은 {EXPECTED_SUBJECT[weekday]}")

    if errors:
        print("콘텐츠 검증 실패:")
        for error in errors:
            print(" - " + error)
        return 1
    print(f"콘텐츠 검증 성공: 날짜 {len(days)}개")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"검증 실패: {exc}", file=sys.stderr)
        sys.exit(1)
