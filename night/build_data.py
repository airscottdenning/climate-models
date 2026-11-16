"""The night model's measured sky and air: an average clear day and night at Table Mountain, Colorado.

The model takes five things from measurements instead of from a formula: the Sunlight reaching the ground, the
Sunlight the ground reflects, the temperature of the air 10 m up, the wind and the Earthlight that comes down
from the sky. All come from NOAA's SURFRAD station at Table Mountain, near Boulder (40.125° N, 105.237° W,
1,689 m), which measures them every minute. Its data are public domain (CC0 1.0). The station's README gives
the air temperature's height, 10 m, and no height for the wind; the model takes the wind as 10 m up too.

What this script does:

1. Reads the station's daily files for 2018 to 2024, days 59 to 100 (about March 1 to April 10) and 245 to 286
   (about September 2 to October 13), from the data store (outside Git):
   climate-change-textbook-data/models/night/surfrad/tbl/<year>/tblYYDDD.dat. Each file is one UTC day of
   one-minute records, with a quality flag after each value (0 = good). The columns are in README_SURFRAD.txt
   at https://gml.noaa.gov/aftp/data/radiation/surfrad/tbl/.
2. Finds the clear windows, from noon on one day to noon on the next (local solar time = UTC + longitude/15):
   - both days clear: under the Sun more than 10° above the horizon, the one-minute Sunlight is smooth (the
     average size of its second difference is under 1.0 W/m²), with at least 400 good minutes;
   - the night clear: from 6:30 p.m. to 5:30 a.m. the downward infrared, less a straight line through it,
     varies by under 4 W/m² (standard deviation). A passing cloud makes it jump;
   - at least 95% of the minutes have good flags for Sunlight, downward and upward infrared and air temperature.
3. Averages them hour by hour: each hour's value is the average of the minutes within half an hour of it.
4. Writes six sets of 24 hourly values into web/model.js (after the line marked "measured:"): the Sunlight
   reaching the ground, the Sunlight the ground reflects, the air's temperature, the wind, the sky's Earthlight
   and the ground's own temperature. And a table of them into the Physics tab of web/index.html.
   The wind's minutes are the ones whose own flag is good.

    python3 models/night/build_data.py            print the average day
    python3 models/night/build_data.py --write    put it into web/model.js and web/index.html
    python3 models/night/build_data.py --check    fail if they differ from the raw files

The station's upward infrared gives the ground's own temperature too (as a black surface, like the model's).
The model doesn't use it; the page draws it beside the model's surface, and the tests compare the two.
At night the Sunlight sensor reads a watt or two below zero; those hours are written as 0.
"""
import glob
import json
import math
import os
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STORE = Path('/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data/models/night/surfrad/tbl')
YEARS = range(2018, 2025)
DAYS = list(range(59, 101)) + list(range(245, 287))
SIGMA = 5.67e-8
SMOOTH_SUN = 1.0       # W/m²: the average second difference of a clear day's one-minute Sunlight
SMOOTH_NIGHT = 4.0     # W/m²: the spread of a clear night's downward infrared about a straight line
GOOD = 0.95            # the share of minutes with good flags
COLUMNS = {'sun': 0, 'reflected': 1, 'sky': 4, 'up': 7, 'air': 15, 'humidity': 16, 'wind': 17}


def read(path):
    """A station file: its longitude, and its minutes as (UTC hour, Sun's zenith angle, values, all good)."""
    rows = []
    with open(path) as f:
        f.readline()
        longitude = float(f.readline().split()[1])
        for line in f:
            p = line.split()
            if len(p) < 48:
                continue
            values = {name: float(p[8 + 2 * k]) for name, k in COLUMNS.items()}
            good = all(int(p[9 + 2 * COLUMNS[name]]) == 0 and values[name] > -9000 for name in ('sun', 'sky', 'up', 'air'))
            for name in ('wind', 'humidity'):       # not in `good`: these two are averaged over their own good minutes
                if int(p[9 + 2 * COLUMNS[name]]) != 0:
                    values[name] = -9999.9
            rows.append((float(p[6]), float(p[7]), values, good))
    return longitude, rows


def clear_day(rows):
    sun = [v['sun'] for _, zenith, v, good in rows if zenith < 80 and good]
    if len(sun) < 400:
        return False
    return sum(abs(sun[i + 1] - 2 * sun[i] + sun[i - 1]) for i in range(1, len(sun) - 1)) / len(sun) < SMOOTH_SUN


def window(first, second):
    """The minutes from local noon on the first day to local noon on the second: (hours after noon, values,
    good). A few minutes either side are kept, so each end hour has a full hour around it."""
    (longitude, rows1), (_, rows2) = first, second
    out = []
    for rows, offset in ((rows1, 0), (rows2, 24)):
        for utc, _, values, good in rows:
            hours = utc + longitude / 15 + offset - 12
            if -0.5 <= hours < 23.5:
                out.append((hours, values, good))
    return out


def clear_night(minutes):
    night = [(h, v['sky']) for h, v, good in minutes if good and 6.5 <= h <= 17.5]
    if len(night) < 500:
        return False
    n = len(night)
    mean_h, mean_v = sum(h for h, _ in night) / n, sum(v for _, v in night) / n
    slope = sum((h - mean_h) * (v - mean_v) for h, v in night) / sum((h - mean_h) ** 2 for h, _ in night)
    return statistics.pstdev([v - mean_v - slope * (h - mean_h) for h, v in night]) < SMOOTH_NIGHT


def average_day(store=STORE):
    files = {}
    for year in YEARS:
        for day in DAYS:
            path = store / str(year) / ('tbl%02d%03d.dat' % (year % 100, day))
            if path.is_file():
                files[(year, day)] = path
    read_files = {}

    def get(key):
        if key not in read_files:
            read_files[key] = read(files[key])
        return read_files[key]

    chosen = []
    for (year, day) in sorted(files):
        if (year, day + 1) not in files or day + 1 not in DAYS:
            continue
        first, second = get((year, day)), get((year, day + 1))
        if not (clear_day(first[1]) and clear_day(second[1])):
            continue
        minutes = window(first, second)
        if sum(good for _, _, good in minutes) / 1440 < GOOD or not clear_night(minutes):
            continue
        chosen.append(((year, day), minutes))
    hours = {name: [] for name in ('air', 'sky', 'surface', 'sun', 'reflected', 'wind', 'humidity')}
    for hour in range(24):
        near = [v for _, minutes in chosen for h, v, good in minutes if good and abs(h - hour) <= 0.5]

        def mean(key):      # wind and humidity: only their own good minutes (read() marks the rest -9999.9)
            values = [v[key] for v in near if v[key] > -900]
            return sum(values) / len(values)
        hours['air'].append(round(mean('air'), 2))
        hours['sky'].append(round(mean('sky'), 1))
        hours['surface'].append(round((mean('up') / SIGMA) ** 0.25 - 273.15, 2))
        hours['sun'].append(round(max(mean('sun'), 0), 1))     # at night the sensor reads a watt or two below 0
        hours['reflected'].append(round(max(mean('reflected'), 0), 1))
        hours['wind'].append(round(mean('wind'), 2))
        hours['humidity'].append(round(mean('humidity'), 1))
    return {'windows': ['%d-%03d' % key for key, _ in chosen], 'hours': hours}


# ---- Writing it into the page ----------------------------------------------------------------------------------

def model_lines(day):
    h = day['hours']
    line = lambda name, key, form: '  var %s = [%s];\n' % (name, wrap(', '.join(form % x for x in h[key])))
    return ('  // measured: build_data.py writes these six lines. Hours after noon, 0 to 23.\n' +
            line('SUNLIGHT', 'sun', '%.1f') + line('REFLECTED', 'reflected', '%.1f') + line('AIR', 'air', '%.2f') +
            line('WIND', 'wind', '%.2f') + line('SKY', 'sky', '%.1f') + line('GROUND', 'surface', '%.2f'))


def wrap(text, width=62):
    words, lines, line = text.split(' '), [], ''
    for word in words:
        if len(line) + len(word) + 1 > width:
            lines.append(line.rstrip())
            line = ''
        line += word + ' '
    lines.append(line.rstrip())
    return '\n    '.join(lines)


def table_html(day):
    rows = []
    for hour in range(24):
        clock = (hour + 12) % 24
        name = 'noon' if clock == 12 else 'midnight' if clock == 0 else '%d %s' % ((clock + 11) % 12 + 1,
                                                                                   'a.m.' if clock < 12 else 'p.m.')
        rows.append('<tr><th scope="row">%s</th><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td>'
                    '</tr>' % (
            name, '%.1f' % day['hours']['sun'][hour], '%.1f' % day['hours']['reflected'][hour],
            ('%.1f' % day['hours']['air'][hour]).replace('-', '−'), '%.1f' % day['hours']['wind'][hour],
            '%.1f' % day['hours']['sky'][hour],
            ('%.1f' % day['hours']['surface'][hour]).replace('-', '−')))
    return '\n'.join(rows)


def placed(model_text, page_text, day):
    model_text = re.sub(r'  // measured:.*?\n  var GROUND = \[[^\]]*\];\n', lambda m: model_lines(day), model_text,
                        flags=re.S)
    page_text = re.sub(r'(<tbody id="measured-rows">\n).*?(</tbody>)',
                       lambda m: m.group(1) + table_html(day) + '\n' + m.group(2), page_text, flags=re.S)
    return model_text, page_text


def main(arguments):
    day = average_day()
    if not arguments:
        print(json.dumps(day, indent=1))
        return
    model, page = HERE / 'web' / 'model.js', HERE / 'web' / 'index.html'
    old = model.read_text(encoding='utf-8'), page.read_text(encoding='utf-8')
    new = placed(*old, day)
    if arguments == ['--write']:
        model.write_text(new[0], encoding='utf-8')
        page.write_text(new[1], encoding='utf-8')
        print('%d clear windows: %s' % (len(day['windows']), ', '.join(day['windows'])))
    elif arguments == ['--check']:
        if new != old:
            raise SystemExit('web/model.js or web/index.html differs from the raw files. Run build_data.py --write.')
        print('up to date: %d clear windows' % len(day['windows']))
    else:
        raise SystemExit('usage: build_data.py [--write | --check]')


if __name__ == '__main__':
    main(sys.argv[1:])
