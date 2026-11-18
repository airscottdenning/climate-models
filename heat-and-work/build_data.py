"""Carry the places' hottest afternoons into the heat and work model.

places-source.json holds, for each place, TerraClimate's 1991-2020 monthly normals at the grid cell that holds
it: the average daily high temperature (tmax) and the vapor pressure (vap), as the raw numbers the server sent,
with each answer's SHA-256. This script turns them into the page's places and writes them into web/model.js,
between the lines PLACES START and PLACES END.

    python3 build_data.py            print the places
    python3 build_data.py --write    put them into web/model.js
    python3 build_data.py --check    fail if web/model.js is out of date (the model's tests run this)

For each month:
  T  = tmax, in °C (raw × 0.1 − 73.0)
  e  = vap, in kPa (raw × 0.1)
  es = 0.6106 exp(17.27 T / (237.3 + T)), the most water vapor the air can hold at T, in kPa
       (Lemke and Kjellstrom, 2012, written there in hPa as 6.106)
  H  = 100 e / es, the relative humidity in the afternoon, in %
The vapor pressure is a monthly average over day and night. It changes much less through the day than the
temperature does, so it's paired with the afternoon's high. The place's month is the one whose afternoon has the
highest WBGT in the shade, worked out with the model's own steps 2 and 3 (copied here); in a tie, the
earlier month.
"""
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE, MODEL_JS = HERE / 'places-source.json', HERE / 'web' / 'model.js'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December']


def saturation(T):
    return 0.6106 * math.exp(17.27 * T / (237.3 + T))


def wet_bulb(T, H):
    """Stull (2011), as in model.js step 2."""
    return (T * math.atan(0.151977 * math.sqrt(H + 8.313659)) + math.atan(T + H) - math.atan(H - 1.676331)
            + 0.00391838 * H ** 1.5 * math.atan(0.023101 * H) - 4.686035)


def shade_wbgt(T, H):
    return 0.7 * wet_bulb(T, H) + 0.3 * T


def places():
    out = []
    for p in json.loads(SOURCE.read_text(encoding='utf-8'))['places']:
        months = []
        for k in range(12):
            T = round(p['tmax_raw'][k] * 0.1 - 73.0, 1)
            H = round(100 * p['vap_raw'][k] * 0.1 / saturation(T))
            months.append((shade_wbgt(T, H), -k, T, H))       # in a tie, the earlier month
        _, k, T, H = max(months)
        k = -k
        out.append([p['id'], p['name'], p['region'], MONTHS[k], T, H])
    return sorted(out, key=lambda p: p[0])


def block(rows):
    lines = ['  // PLACES START', '  var PLACES = [']
    for n, (pid, name, region, month, T, H) in enumerate(rows):
        lines.append("    ['%s', '%s', '%s', '%s', %.1f, %d]%s" % (pid, name, region, month, T, H,
                                                                 ',' if n < len(rows) - 1 else ''))
    lines += ['  ];', '  // PLACES END']
    return '\n'.join(lines) + '\n'


def written():
    js = MODEL_JS.read_text(encoding='utf-8')
    return re.sub(r'  // PLACES START\n.*?  // PLACES END\n', lambda m: block(places()), js, count=1, flags=re.S)


def main(arguments):
    if not arguments:
        for row in places():
            print(row)
        return
    if arguments not in (['--write'], ['--check']):
        raise SystemExit('usage: build_data.py [--write | --check]')
    js = written()
    stale = MODEL_JS.read_text(encoding='utf-8') != js
    if arguments == ['--check']:
        if stale:
            raise SystemExit('web/model.js is out of date with places-source.json. Run python3 '
                             'models/heat-and-work/build_data.py --write.')
        return
    MODEL_JS.write_text(js, encoding='utf-8')
    print('Wrote web/model.js.' if stale else 'Nothing to write: web/model.js is up to date.')


if __name__ == '__main__':
    main(sys.argv[1:])
