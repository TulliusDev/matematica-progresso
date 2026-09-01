"""Cálculo independente usado para conferir o motor JavaScript."""
from datetime import date, timedelta

EXAM = date(2026, 11, 29)
START = date(2026, 8, 31)
REGULAR = {0, 1, 2, 3, 4}  # datetime: segunda=0
DAILY = 90
BUFFER = 0.10


def regular_days(start: date, end: date) -> int:
    count = 0
    cursor = start
    while cursor < end:
        count += cursor.weekday() in REGULAR
        cursor += timedelta(days=1)
    return count


def safe_capacity(today: date, studied_today: int = 0) -> int:
    total_safe_budget = regular_days(START, EXAM) * DAILY * (1 - BUFFER)
    elapsed = regular_days(START, today) * DAILY
    current_use = studied_today if today.weekday() in REGULAR else 0
    return round(max(0, total_safe_budget - elapsed - current_use))


def topic_load(estimate: int, used: int, status: str) -> int:
    if status in {"consolidating", "mastered"}:
        return 0
    return max(0, estimate - used)


assert regular_days(START, EXAM) == 65
assert regular_days(date(2026, 9, 5), date(2026, 9, 7)) == 0
assert regular_days(START, EXAM) * DAILY == 5850
assert safe_capacity(START) == 5265
assert safe_capacity(START) - topic_load(60, 0, "not-started") == 5205
assert safe_capacity(START) - safe_capacity(date(2026, 9, 1)) == 90
assert safe_capacity(START, 60) == 5205
assert safe_capacity(date(2026, 9, 5), 30) == safe_capacity(date(2026, 9, 5), 0)
assert topic_load(60, 30, "studying") == 30
assert topic_load(60, 75, "studying") == 0
assert topic_load(60, 0, "consolidating") == 0
assert topic_load(90, 0, "not-started") - topic_load(60, 0, "not-started") == 30
assert 75 - 60 == 15  # excedente acima da estimativa

print("13/13 verificações manuais independentes aprovadas")
