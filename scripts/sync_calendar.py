#!/usr/bin/env python3
"""
sync_calendar.py
Stáhne ICS feed z Google Kalendáře a přegeneruje schedule.json.

Formát názvu události v Google Kalendáři:
  "Téma: Výroba rekvizit [Veruru]"
   ^prefix^  ^--title--^  ^garant^

Výstupní formát schedule.json:
  { "id": "fri-1", "title": "Výroba rekvizit", "time": "11:00-13:30",
    "day": "Pátek", "description": "Garant: Veruru" }
"""

import os
import json
import re
import sys
from datetime import datetime, timezone

import requests
import pytz
from icalendar import Calendar

# Timezone konference
TZ = pytz.timezone("Europe/Prague")

# Mapování čísel dne týdne (Python weekday()) na česká jména
DAY_NAMES = {
    0: "Pondělí",
    1: "Úterý",
    2: "Středa",
    3: "Čtvrtek",
    4: "Pátek",
    5: "Sobota",
    6: "Neděle",
}

# Zkratky pro generování ID
DAY_PREFIXES = {
    "Pondělí": "mon",
    "Úterý":   "tue",
    "Středa":  "wed",
    "Čtvrtek": "thu",
    "Pátek":   "fri",
    "Sobota":  "sat",
    "Neděle":  "sun",
}


def to_local(dt):
    """Převede datetime na časovou zónu konference."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            # Naive datetime — předpokládáme lokální čas konference
            return TZ.localize(dt)
        return dt.astimezone(TZ)
    # icalendar může vrátit pouze date (bez času) pro celodenní události
    from datetime import date
    if isinstance(dt, date):
        return TZ.localize(datetime(dt.year, dt.month, dt.day, 0, 0, 0))
    return None


def parse_summary(summary: str):
    """
    Parsuje název události. Formát: "Téma: Název akce [Garant]"
    Vrací (title, garant).
    """
    # Odstraníme prefix "Téma: " (case-insensitive)
    text = re.sub(r"^[Tt]éma:\s*", "", summary.strip())

    # Extrahujeme garanta z posledních hranatých závorek
    garant_match = re.search(r"\[([^\]]+)\]\s*$", text)
    garant = garant_match.group(1).strip() if garant_match else ""

    # Odstraníme garanta z názvu
    title = re.sub(r"\s*\[[^\]]+\]\s*$", "", text).strip()

    return title, garant


def fetch_events(ics_url: str):
    """Stáhne a parsuje ICS feed. Vrací seřazený seznam event dictů."""
    resp = requests.get(ics_url, timeout=15)
    resp.raise_for_status()

    cal = Calendar.from_ical(resp.content)
    events = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        summary = str(component.get("SUMMARY", "")).strip()
        if not summary:
            continue

        dtstart = to_local(component.get("DTSTART").dt if component.get("DTSTART") else None)
        dtend   = to_local(component.get("DTEND").dt   if component.get("DTEND")   else None)

        if dtstart is None:
            continue

        title, garant = parse_summary(summary)
        if not title:
            continue

        day_name = DAY_NAMES.get(dtstart.weekday(), "")
        time_start = dtstart.strftime("%H:%M")
        time_end   = dtend.strftime("%H:%M") if dtend else time_start
        time_str   = f"{time_start}-{time_end}"

        events.append({
            "_sort_key": dtstart,  # pro řazení, odstraníme na výstupu
            "day":   day_name,
            "time":  time_str,
            "title": title,
            "garant": garant,
        })

    # Seřadíme: nejdříve podle dne, pak podle času začátku
    events.sort(key=lambda e: e["_sort_key"])

    return events


def build_schedule(events):
    """Převede raw eventy na finální schedule.json formát."""
    counters = {}  # počítadlo ID pro každý den
    schedule = []

    for ev in events:
        day  = ev["day"]
        prefix = DAY_PREFIXES.get(day, "day")
        counters[prefix] = counters.get(prefix, 0) + 1
        event_id = f"{prefix}-{counters[prefix]}"

        entry = {
            "id":    event_id,
            "title": ev["title"],
            "time":  ev["time"],
            "day":   day,
        }
        if ev["garant"]:
            entry["description"] = f"Garant: {ev['garant']}"

        schedule.append(entry)

    return schedule


def main():
    ics_url = os.environ.get("CALENDAR_ICS_URL")
    if not ics_url:
        print("CHYBA: Proměnná CALENDAR_ICS_URL není nastavena.", file=sys.stderr)
        sys.exit(1)

    print(f"Stahuji ICS feed...")
    events = fetch_events(ics_url)
    print(f"Nalezeno {len(events)} událostí.")

    schedule = build_schedule(events)

    output_path = os.path.join(os.path.dirname(__file__), "..", "schedule.json")
    output_path = os.path.normpath(output_path)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    print(f"schedule.json úspěšně aktualizován ({len(schedule)} položek).")


if __name__ == "__main__":
    main()
