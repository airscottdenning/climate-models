#!/usr/bin/env python3
"""Make the ice-age model's data file, web/data.json.

    python3 -I models/ice-ages/build_data.py

It holds two things:

- The summer Sunlight at 65 °N that drives the model, in its two parts, every 1,000 years from 999,000 years ago
  to 1,000,000 years from now. They're worked out here from Earth's orbit in Laskar et al. (2004), the table the
  Milankovitch model uses, with that model's equations and the book's solar constant:
    p, the precession part: the strongest daily Sunlight of the northern summer, with the tilt held at its
       average over these 2,000,000 years;
    o, the tilt part: the Sunlight on the June solstice, if the orbit were a circle.
  This is Talento and Ganopolski's way of splitting the Sunlight (their published code, OSF doi:10.17605/OSF.IO/KB76G).
- The records the page draws beside the model, every 1,000 years over the last 800,000 years:
    ice: the sea-level stack of Spratt and Lisiecki (2016), from PANGAEA (doi:10.1594/PANGAEA.979830, CC BY 3.0):
         the 0-430 ka stack joined to the 431-798 ka part of the long stack, as the paper does, divided by its
         lowest point (-130 m, 24,000 years ago), as Talento and Ganopolski did. 1 is the most ice.
    co2: the Antarctic ice-core composite of Bereiter et al. (2015), as processed for Figure 5.11
         (figures/chapter-05/ice-core-record/derived-data/co2-composite.csv): the mean of the samples within 500
         years of each step, or a straight line between the nearest samples where there are none.

    python3 -I models/ice-ages/build_data.py            write web/data.json
    python3 -I models/ice-ages/build_data.py --check    fail if web/data.json isn't what the sources make

The orbit and the sea level aren't in Git: they're in the book's data store. Each source is checked against its
SHA-256 before it's used.
"""
import csv
import hashlib
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STORE = Path('/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data')
ORBIT = STORE / 'models/milankovitch/original-shiny-2026-11-11/data/INSOL.LA2004.txt'
ORBIT_SHA256 = '8300ea90b913507dc31227f236be04012d579baa0244c4e3df0ed4555b2e60d8'
SEA = STORE / 'models/ice-ages/records-2026-11-16/spratt_lisiecki_2016/PANGAEA.979830_sea_level_stack_v2.tab'
SEA_SHA256 = '3de6b7998554ec8ce8c44a6ce18fb23fd3b8a529bbe3bfa0af69992622803fb0'
CO2 = HERE.parents[1] / 'figures/chapter-05/ice-core-record/derived-data/co2-composite.csv'
CO2_SHA256 = '3a3df64fceabad72e1ca2bc00bd4c9750271d051c1c740f1d25c5745e15d656e'
SHORT_UNTIL = 430                   # ka: the short stack to here, the long stack before it
FIRST, LAST = -999, 1000            # thousands of years from now
S0 = 1361                           # W/m², the book's solar constant (Chapter 2)
LATITUDE = math.radians(65)
SOLSTICE = math.pi / 2              # the Sun's longitude on the June solstice


def checked(path, sha256):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha256:
        raise SystemExit(f'{path} is not the file this was built from (its SHA-256 differs)')
    return raw


def orbit_rows():
    """Eccentricity, tilt and longitude of perihelion (radians), by thousands of years from now."""
    rows = {}
    for line in checked(ORBIT, ORBIT_SHA256).decode('ascii').splitlines()[1:]:
        parts = line.split()
        if parts:
            rows[round(float(parts[0]))] = tuple(float(x) for x in parts[1:4])
    return rows


def daily_sunlight(ecc, tilt, peri, lam):
    """Daily-mean Sunlight at 65 °N at the top of the air, W/m²: the Milankovitch model's steps 1 to 6."""
    ratio = (1 + ecc * math.cos(lam + math.pi - peri)) / (1 - ecc * ecc)
    dec = math.asin(math.sin(tilt) * math.sin(lam))
    x = -math.tan(LATITUDE) * math.tan(dec)
    h0 = math.pi if x <= -1 else 0.0 if x >= 1 else math.acos(x)
    mean_cos = (h0 * math.sin(LATITUDE) * math.sin(dec) + math.cos(LATITUDE) * math.cos(dec) * math.sin(h0)) / math.pi
    return S0 * ratio * ratio * mean_cos


def strongest(ecc, tilt, peri):
    """The strongest daily Sunlight of the northern summer: a golden-section search over the Sun's longitude."""
    lo, hi = math.radians(45), math.radians(135)
    g = (math.sqrt(5) - 1) / 2
    a, b = hi - g * (hi - lo), lo + g * (hi - lo)
    fa, fb = daily_sunlight(ecc, tilt, peri, a), daily_sunlight(ecc, tilt, peri, b)
    while hi - lo > 1e-10:
        if fa > fb:
            hi, b, fb = b, a, fa
            a = hi - g * (hi - lo)
            fa = daily_sunlight(ecc, tilt, peri, a)
        else:
            lo, a, fa = a, b, fb
            b = lo + g * (hi - lo)
            fb = daily_sunlight(ecc, tilt, peri, b)
    return daily_sunlight(ecc, tilt, peri, (lo + hi) / 2)


def sunlight_parts():
    rows = orbit_rows()
    years = range(FIRST, LAST + 1)
    mean_tilt = sum(rows[y][1] for y in years) / len(years)
    p = [strongest(rows[y][0], mean_tilt, rows[y][2]) for y in years]
    o = [daily_sunlight(0.0, rows[y][1], 0.0, SOLSTICE) for y in years]
    return p, o, mean_tilt


def full_strongest():
    """The strongest summer Sunlight itself, with the tilt as it was: how far p + o − ō strays from it."""
    rows = orbit_rows()
    return [strongest(*rows[y]) for y in range(FIRST, LAST + 1)]


def ice_record():
    """The sea-level stack as v: {years from now: v}, and its lowest point."""
    lines = checked(SEA, SEA_SHA256).decode('utf-8').splitlines()
    rows = [line.split('\t') for line in lines[lines.index('*/') + 2:] if line.strip()]
    sea = {}
    for row in rows:
        age = round(float(row[0]))
        sea[-age] = float(row[1] if age <= SHORT_UNTIL else row[5])
    lowest = min(sea.values())
    when = next(year for year, value in sea.items() if value == lowest)
    return {year: value / lowest for year, value in sea.items()}, lowest, when


def co2_record():
    """The ice-core carbon dioxide every 1,000 years from 800,000 years ago to now, and its lowest sample."""
    rows = list(csv.DictReader(checked(CO2, CO2_SHA256).decode('utf-8').splitlines()))
    samples = sorted((float(r['age_kyr_BP']), float(r['co2_ppm'])) for r in rows)
    out = {}
    for age in range(0, 801):
        near = [c for a, c in samples if age - 0.5 <= a < age + 0.5]
        if near:
            out[-age] = sum(near) / len(near)
        else:
            older = next(i for i, (a, _) in enumerate(samples) if a >= age)
            (a0, c0), (a1, c1) = samples[older - 1], samples[older]
            out[-age] = c0 + (c1 - c0) * (age - a0) / (a1 - a0)
    return out, min(c for _, c in samples)


def series(record, first, last, places):
    return {'first': first, 'values': [round(record[y], places) for y in range(first, last + 1)]}


def build():
    p, o, mean_tilt = sunlight_parts()
    full = full_strongest()
    o_mean = sum(o) / len(o)
    gaps = [abs(pk + ok - o_mean - fk) for pk, ok, fk in zip(p, o, full)]
    widest = max(range(len(gaps)), key=gaps.__getitem__)
    ice, sea_lowest, sea_when = ice_record()
    co2, co2_lowest = co2_record()
    p = [round(x, 2) for x in p]
    o = [round(x, 2) for x in o]
    data = {
        'about': 'Data for the ice-age model at simpleserioussolvable.org/models/ice-ages/. See README.md.',
        'first': FIRST, 'last': LAST,
        'meanTiltDeg': round(math.degrees(mean_tilt), 4),
        'pMean': round(sum(p) / len(p), 2), 'oMean': round(sum(o) / len(o), 2),
        'partsGap': round(gaps[widest], 3), 'partsGapYear': FIRST + widest,
        'p': p, 'o': o,
        'record': {
            'ice': dict(series(ice, min(ice), 0, 4), seaLevelLowest=sea_lowest, seaLevelLowestYear=sea_when,
                        source='Spratt and Lisiecki (2016), doi:10.5194/cp-12-1079-2016; data: PANGAEA, '
                               'doi:10.1594/PANGAEA.979830, CC BY 3.0'),
            'co2': dict(series(co2, -800, 0, 1), lowest=co2_lowest,
                        source='Bereiter et al. (2015), doi:10.1002/2014GL061957; data: NOAA NCEI, '
                               'doi:10.25921/n8y4-bp27'),
        },
    }
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'


def main(argv):
    missing = [str(path) for path in (ORBIT, SEA, CO2) if not path.exists()]
    if missing:
        print('The sources are not here: ' + ', '.join(missing))
        return 0
    text, target = build(), HERE / 'web' / 'data.json'
    if argv[1:] == ['--check']:
        if target.read_text(encoding='utf-8') != text:
            print('web/data.json is out of date with its sources. Run build_data.py.')
            return 1
        print('web/data.json is what its sources make.')
        return 0
    target.write_text(text, encoding='utf-8')
    print(f'wrote {target}: {len(text):,} bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
