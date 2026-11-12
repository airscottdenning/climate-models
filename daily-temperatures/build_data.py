#!/usr/bin/env python3
"""Pack the station records, the global record and the maps for the browser: everything in web/data/.

    python3 -I models/daily-temperatures/build_data.py [folder with the frozen original]

The source is the data bundle of the app this page was rebuilt from ("Changing Seasonal
Extremes", Scott Denning and OpenAI Codex, commit 307c2a3). It isn't in Git. It's in the data
store. Its manifest lists each station file with its SHA-256, and this script checks every file
before it reads it. It needs nothing but Python's standard library (3.9 or later).

What it writes, and what the page loads when:

    index.json         as the page opens. The places (id, name, country, where, how high, the two
                       periods, the pattern factor P), the global record year by year and the
                       SHA-256 of the other files (the station files as one, in the order of
                       their ids)
    stations/<id>.bin  when the reader picks that place
    pattern.bin        when the map first shows the projected warming
    coast.bin          when the map is first drawn

stations/<id>.bin: 16-bit whole numbers, low byte first. -32768 means "no value".
    8 numbers: 1 (the layout's version), the first year of the yearly averages, how many years,
        the earlier period's first and last year, the recent period's first and last year,
        1 for a place north of the equator and 0 for one south of it
    the yearly averages, in thousandths of a °C: the year's average of each day's midpoint
        between its high and its low. "No value" for a year that fails the rule below
    the days, for each year of the earlier period and then of the recent one:
        60 numbers for 1 January to 29 February, then 62 for 1 July to 31 August, in tenths
        of a °C as NOAA stores them. The cold months hold each day's low and the warm months
        its high: north of the equator January and February are the cold ones, south of it
        July and August. A reading NOAA flagged is "no value". A good reading whose partner
        that day (the low for a high, the high for a low) is missing or flagged has 20000
        added to it, so the page can tell the days with both readings from the rest
    2,592 numbers: how much the HadCRUT5 map warmed between the two periods' years, in
        hundredths of a °C. 36 rows from 87.5 °S to 87.5 °N, each of 72 boxes from 177.5 °W

A year's average counts when the year is over, at least 90% of its days have a good high and a
good low, and so do at least 80% of the days of every month. That is the original's rule, with
"today" fixed at 7 September 2026, the day the bundle was made.

pattern.bin: 180 rows from 89.5 °S to 89.5 °N, each of 360 boxes from 0.5 °E eastward, in
    hundredths of a °C of local warming for each 1 °C of global warming (IPCC AR6).
coast.bin: the coastlines and then the borders, as lines. One number for how many coastlines
    and one for how many borders; then each line's number of points; then every point, as
    longitude and latitude in hundredths of a degree.
"""
import calendar
import csv
import gzip
import hashlib
import io
import json
import math
import re
import struct
import sys
import zipfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "data"
SOURCE = Path("/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data/models/"
              "daily-temperatures/codex-workspace-2026-11-12")
MANIFEST_SHA256 = "4d9a737dd31fd053aa155d74b90e4cf21f177a2228773b43c31146775ce38777"
POOL_SHA256 = "0f204b9d951849a495e76882ab6d2e0f12cd71ce12408bafea0712605cff966a"
SHA256 = {
    "data/world_110m.json": "d75915eaa31c870df6b972c9e5bb86910197825f33dcfef740f3b2f68cffe843",
    "data/runtime/ar6/warming_pattern_1c.npz":
        "9a0a2b15dc3570cdb2dcb6ee8c196f03c32c3c86a40b0868ae6c6c6d3e90af04",
}
AS_OF = date(2026, 9, 7)
NONE = -32768
UNMATCHED = 20000

# Places left out of the page, and why. This is the one list to change: delete a line and run
# this script again, and the place is back. GHCN-Daily took most or part of these records from
# the European Climate Assessment & Dataset, which offers its data "for non-commercial research
# and education". The book takes non-commercial material only on Scott's recorded decision.
HELD_BACK = {
    "NO000001026": "Tromso, Norway: all from ECA&D",
    "NOE00112071": "Vaernes, Norway: all from ECA&D",
    "FI000007501": "Sodankyla, Finland: all from ECA&D",
    "AU000005901": "Wien, Austria: all from ECA&D",
    "AU000005010": "Kremsmuenster, Austria: all from ECA&D",
    "AU000016402": "Graz, Austria: all from ECA&D",
    "HR000142360": "Zagreb, Croatia: all from ECA&D",
    "IS000004640": "Har Kenaan, Israel: nine-tenths from ECA&D",
    "UK000003005": "Lerwick, United Kingdom: a quarter from ECA&D",
    "UK000003026": "Stornoway, United Kingdom: a sixth from ECA&D",
    "RSM00021432": "Ostrov Kotelnyj, Russia: 7% from ECA&D",
    "RSM00021946": "Chokurdah, Russia: 7% from ECA&D",
    "RSM00024790": "Susuman, Russia: 7% from ECA&D",
}
NON_COMMERCIAL_SOURCES = {"E"}       # GHCN-Daily's source flag for ECA&D
MOST_FROM_THEM = 0.01                # a kept place may have no more than this share from them

# The names the original gave a few stations by hand (station_map.py, friendly_place_name),
# and one more: its rule left "Sacramento 5 Ese".
PLACE_NAMES = {
    "SACRAMENTO 5 ESE": "SACRAMENTO",
    "KALISPELL GLACIER AIRPORT": "KALISPELL",
    "TRAVERSE CITY CHERRY CAPITAL AIRPORT": "TRAVERSE CITY",
    "SAGINAW MBS INTERNATIONAL AIRPORT": "SAGINAW",
    "SCOTTSBLUFF W B HEILIG FIELD AIRPORT": "SCOTTSBLUFF",
    "NY CITY CENTRAL PARK": "NEW YORK CITY",
    "KOUMAC NLLE CALEDO": "KOUMAC",
}


def checked(folder, name, sha256):
    raw = (folder / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha256:
        raise SystemExit(f"{name} isn't the file this was built from (its SHA-256 differs)")
    return raw


def place_name(name):
    """A station's catalog name as a place a reader knows. The original's rule, step for step."""
    place = name.split(",", 1)[0].strip().upper()
    place = PLACE_NAMES.get(place, place)
    place = re.sub(r"^DOWNTOWN\s+", "", place)
    place = re.split(r"\s+(?:INTERNATIONAL\s+AIRPORT|REGIONAL\s+AIRPORT|MUNICIPAL\s+AIRPORT|"
                     r"AIRPORT|INTL|INTER\.\s+AIRP|AERODROME|AERO|AMO|AWS)\b", place, maxsplit=1)[0]
    place = re.split(r"\s+(?:WATER\s+TREATMENT\s+PLANT|WWTP|WPCC|U\s+OF\s+|CORNELL\s+UNIVERSITY|"
                     r"WEST\s+CENTRAL\s+RESEARCH|LIGHTHOUSE|COOP|CDA|NP)\b", place, maxsplit=1)[0]
    place = re.sub(r"\s+(?:NUMBER\s+)?\d+\s+(?:N|S|E|W|NE|NW|SE|SW|NNE|NNW|SSE|SSW)$", "", place)
    place = re.sub(r"\s+(?:NUMBER\s+)?\d+$", "", place)
    place = re.sub(r"\s+(?:A\s+S|ST\s+SCHOOL)$", "", place)
    place = re.sub(r"^FT\s+", "FORT ", place)
    place = re.sub(r"^ST\s+", "SAINT ", place)
    return place.title().replace("Mcgrath", "McGrath")


def arrays(raw):
    """The arrays in a NumPy .npz file, as flat lists with their shapes. No NumPy needed."""
    found = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for name in archive.namelist():
            body = archive.read(name)
            if body[:6] != b"\x93NUMPY" or body[6] != 1:
                raise SystemExit(f"{name}: not a version-1 .npy file")
            (length,) = struct.unpack("<H", body[8:10])
            header = body[10:10 + length].decode("latin-1")
            kind = re.search(r"'descr': '([^']+)'", header).group(1)
            shape = tuple(int(n) for n in re.search(r"'shape': \(([^)]*)\)", header).group(1)
                          .replace(" ", "").split(",") if n)
            if "'fortran_order': False" not in header or kind not in ("<f8", "<i8"):
                raise SystemExit(f"{name}: an array layout this script doesn't read")
            count = 1
            for side in shape:
                count *= side
            letter = "d" if kind == "<f8" else "q"
            found[name[:-4]] = (struct.unpack(f"<{count}{letter}", body[10 + length:]), shape)
    return found


def station_rows(raw):
    """One station's days: (date, high, low) in tenths of a °C, None for missing or flagged."""
    rows, sources = [], {}
    text = gzip.decompress(raw).decode("utf-8-sig")
    for row in csv.DictReader(io.StringIO(text, newline="")):
        pair = []
        for key in ("TMAX", "TMIN"):
            value = row[key].strip()
            flags = (row[key + "_ATTRIBUTES"] or "").split(",")
            if value:
                source = flags[2].strip() if len(flags) > 2 else ""
                sources[source] = sources.get(source, 0) + 1
            flagged = len(flags) > 1 and flags[1].strip()
            if not value or flagged:
                pair.append(None)
            else:
                number = float(value)
                if number != int(number):
                    raise SystemExit("a temperature that isn't a whole number of tenths")
                pair.append(int(number))
        rows.append((date.fromisoformat(row["DATE"].strip()), pair[0], pair[1],
                     float(row["LATITUDE"]), row["ELEVATION"].strip()))
    return rows, sources


def yearly_averages(rows):
    """Each year's average of the daily midpoints, or None for a year that doesn't count."""
    first = min(row[0].year for row in rows)
    last = min(max(row[0].year for row in rows), AS_OF.year)
    good = {year: [] for year in range(first, last + 1)}
    for day, high, low, _, _ in rows:
        if day <= AS_OF and high is not None and low is not None:
            good[day.year].append((day.month, high + low))
    averages = []
    for year in range(first, last + 1):
        days = good[year]
        whole = 366 if calendar.isleap(year) else 365
        counts = [sum(1 for month, _ in days if month == m) for m in range(1, 13)]
        thin = any(counts[m - 1] / calendar.monthrange(year, m)[1] < 0.8 for m in range(1, 13))
        if year >= AS_OF.year or len(days) / whole < 0.9 or thin:
            averages.append(None)
        else:
            averages.append(math.fsum(total / 20 for _, total in days) / len(days))
    while averages and averages[-1] is None:      # nothing to keep after the last good year
        averages.pop()
    return first, averages


def packed_days(rows, periods, north):
    by_day = {row[0]: (row[1], row[2]) for row in rows}
    out = []
    for first, last in periods:
        for year in range(first, last + 1):
            for month, length, cold in ((1, 31, north), (2, 29, north), (7, 31, not north),
                                        (8, 31, not north)):
                for number in range(1, length + 1):
                    try:
                        high, low = by_day.get(date(year, month, number), (None, None))
                    except ValueError:              # 29 February in a year without one
                        high, low = None, None
                    value, partner = (low, high) if cold else (high, low)
                    if value is None:
                        out.append(NONE)
                    else:
                        if not -9000 < value < 9000:
                            raise SystemExit("a temperature out of range")
                        out.append(value if partner is not None else value + UNMATCHED)
    return out


def map_change(grid, early_years, recent_years):
    """How much each box of the HadCRUT5 map warmed between two sets of years (the original's
    grid_change): the box needs a value in at least 90% of the years of each set."""
    (years, _), (anomaly, shape) = grid["years"], grid["anomaly"]
    cells = shape[1] * shape[2]
    place = {int(year): number for number, year in enumerate(years)}

    def averages(wanted):
        sums, counts = [0.0] * cells, [0] * cells
        for year in wanted:
            start = place[year] * cells
            for cell in range(cells):
                value = anomaly[start + cell]
                if value == value:                 # not NaN
                    sums[cell] += value
                    counts[cell] += 1
        return sums, counts

    if not early_years or not recent_years:
        return [NONE] * cells
    (early, early_n), (recent, recent_n) = averages(early_years), averages(recent_years)
    out = []
    for cell in range(cells):
        if early_n[cell] / len(early_years) >= 0.9 and recent_n[cell] / len(recent_years) >= 0.9:
            change = recent[cell] / recent_n[cell] - early[cell] / early_n[cell]
            out.append(int(round(change * 100)))
        else:
            out.append(NONE)
    return out


def nearest_pattern(pattern, latitude, longitude):
    """The 1° box of the AR6 map nearest a place (the original's nearest_pattern_value)."""
    (lats, _), (lons, _), (values, shape) = (pattern["latitude"], pattern["longitude"],
                                             pattern["warming_per_degree"])
    target = longitude % 360
    row = min(range(len(lats)), key=lambda i: abs(lats[i] - latitude))
    column = min(range(len(lons)), key=lambda i: abs(((lons[i] - target + 180) % 360) - 180))
    value = values[row * shape[1] + column]
    if value != value:
        raise SystemExit("no AR6 value near a station")
    return value


def coast(raw):
    world = json.loads(raw)
    (sx, sy), (tx, ty) = world["transform"]["scale"], world["transform"]["translate"]
    lines = []
    for arc in world["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x, y = x + dx, y + dy
            points.append((int(round((x * sx + tx) * 100)), int(round((y * sy + ty) * 100))))
        lines.append(points)

    def used(name):
        found = set()

        def walk(item):
            if isinstance(item, list):
                for inner in item:
                    walk(inner)
            else:
                found.add(item if item >= 0 else ~item)

        for geometry in world["objects"][name]["geometries"]:
            walk(geometry.get("arcs", []))
        return found

    shore = used("coastlines")
    borders = (used("countries") | used("subunits")) - shore
    numbers = [len(shore), len(borders)]
    order = sorted(shore) + sorted(borders)
    numbers += [len(lines[arc]) for arc in order]
    for arc in order:
        for lon, lat in lines[arc]:
            numbers += [max(-18000, min(18000, lon)), lat]
    return struct.pack(f"<{len(numbers)}h", *numbers)


def main(argv):
    folder = Path(argv[1]) if len(argv) > 1 else SOURCE
    manifest_raw = checked(folder, "data/runtime/manifest.json", MANIFEST_SHA256)
    manifest = json.loads(manifest_raw)
    listed = {item["station_id"]: item for item in manifest["stations"]}
    derived = {item["path"]: item["runtime_sha256"] for item in manifest["derived_files"]}
    pool_raw = checked(folder, "analysis/station-audit/global_station_pool.csv", POOL_SHA256)
    pool = [row for row in csv.DictReader(io.StringIO(pool_raw.decode("utf-8"), newline=""))
            if int(row["recent_end_year"]) >= 2010]
    if len(pool) != 127 or set(HELD_BACK) - {row["station_id"] for row in pool}:
        raise SystemExit("the station list isn't the one this was written for")

    annual_raw = checked(folder, "data/runtime/global/annual.csv",
                         derived["data/runtime/global/annual.csv"])
    world = {}
    for row in csv.DictReader(io.StringIO(annual_raw.decode("utf-8"), newline="")):
        if int(row["Time"]) < AS_OF.year:           # 2026 was only part of a year
            world[int(row["Time"])] = float(row["Anomaly (deg C)"])
    if sorted(world) != list(range(1850, AS_OF.year)):
        raise SystemExit("the global record should run from 1850 with no gap")
    grid = arrays(checked(folder, "data/runtime/global/annual_grid.npz",
                          derived["data/runtime/global/annual_grid.npz"]))
    if grid["anomaly"][1] != (176, 36, 72) or grid["latitude"][0][0] != -87.5 \
            or grid["longitude"][0][0] != -177.5:
        raise SystemExit("the HadCRUT5 map isn't laid out as this script expects")
    pattern = arrays(checked(folder, "data/runtime/ar6/warming_pattern_1c.npz",
                             SHA256["data/runtime/ar6/warming_pattern_1c.npz"]))
    if pattern["warming_per_degree"][1] != (180, 360) or pattern["latitude"][0][0] != -89.5 \
            or pattern["longitude"][0][0] != 0.5:
        raise SystemExit("the AR6 map isn't laid out as this script expects")

    (OUT / "stations").mkdir(parents=True, exist_ok=True)
    places, files = [], {}
    for row in pool:
        station = row["station_id"]
        if station in HELD_BACK:
            continue
        rows, sources = station_rows(checked(folder, f"data/runtime/stations/{station}.csv.gz",
                                             listed[station]["runtime_sha256"]))
        barred = sum(n for flag, n in sources.items() if flag in NON_COMMERCIAL_SOURCES)
        if barred / sum(sources.values()) > MOST_FROM_THEM:
            raise SystemExit(f"{station}: too much of it is from a non-commercial source")
        latitude, longitude = float(row["latitude"]), float(row["longitude"])
        north = latitude >= 0
        early = (int(row["early_start_year"]), int(row["early_end_year"]))
        recent = (int(row["recent_start_year"]), int(row["recent_end_year"]))
        first, averages = yearly_averages(rows)
        counted = {first + n for n, value in enumerate(averages) if value is not None}
        matched = [[year for year in range(a, b + 1) if year in counted and year in world]
                   for a, b in (early, recent)]
        numbers = [1, first, len(averages), early[0], early[1], recent[0], recent[1], int(north)]
        for value in averages:
            if value is not None and not -32.7 < value < 32.7:
                raise SystemExit("a yearly average that doesn't fit")
            numbers.append(NONE if value is None else int(round(value * 1000)))
        numbers += packed_days(rows, (early, recent), north)
        numbers += map_change(grid, matched[0], matched[1])
        packed = struct.pack(f"<{len(numbers)}h", *numbers)
        (OUT / "stations" / f"{station}.bin").write_bytes(packed)
        files[station] = packed
        name = place_name(row["station_name"])
        country = row["country"].split(" [", 1)[0]
        us = row["country"] == "United States"
        elevation = rows[0][4]
        places.append({
            "id": station, "name": name, "label": f"{name}, {row['state']}, US" if us
            else f"{name}, {country}", "country": row["country"], "state": row["state"],
            "lat": latitude, "lon": longitude,
            "elevation": float(elevation) if elevation else None,
            "early": list(early), "recent": list(recent),
            "shortPeriods": row["selection_tier"] != "standard",
            "P": nearest_pattern(pattern, latitude, longitude),
        })
        print(f"{station}  {len(packed):6d} bytes  {places[-1]['label']}", file=sys.stderr)
    places.sort(key=lambda place: (-place["lat"], place["label"]))

    values = pattern["warming_per_degree"][0]
    pattern_bin = struct.pack(f"<{len(values)}h", *(NONE if value != value
                                                     else int(round(value * 100)) for value in values))
    (OUT / "pattern.bin").write_bytes(pattern_bin)
    coast_bin = coast(checked(folder, "data/world_110m.json", SHA256["data/world_110m.json"]))
    (OUT / "coast.bin").write_bytes(coast_bin)
    joined = hashlib.sha256()
    for station in sorted(files):                  # every station file, in the order of the ids
        joined.update(files[station])
    index = {
        "made": "models/daily-temperatures/build_data.py",
        "source": "Changing Seasonal Extremes (Scott Denning and OpenAI Codex), commit 307c2a3",
        "ghcnDaily": "3.34", "hadcrut": "HadCRUT.5.1.0.0", "retrieved": "2026-09-07",
        "sha256": {"stations": joined.hexdigest(),
                   "pattern.bin": hashlib.sha256(pattern_bin).hexdigest(),
                   "coast.bin": hashlib.sha256(coast_bin).hexdigest()},
        "world": {"first": 1850, "anomaly": [world[year] for year in sorted(world)]},
        "stations": places,
    }
    text = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    text = text.replace('{"id"', '\n{"id"').replace('],"stations"', '],\n"stations"') + "\n"
    (OUT / "index.json").write_text(text, encoding="utf-8")
    print(f"{len(places)} places kept, {len(HELD_BACK)} held back", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv)
