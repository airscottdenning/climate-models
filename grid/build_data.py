"""Make the grid model's data file from the U.S. Energy Information Administration's records.

The page needs three things for every hour of 2025, for three grids: how much electricity people used, and
how hard the Sun and the wind were working (their capacity factors). Both come from EIA, and both are
public domain:

- Hourly demand and hourly generation from solar and wind, from the Hourly Electric Grid Monitor (Form
  EIA-930), six-month BALANCE files. The page uses three balancing authorities: MISO (the Midwest), PJM
  (the Mid-Atlantic) and CISO (California).
- The size of each grid's solar and wind fleets, month by month, from the Preliminary Monthly Electric
  Generator Inventory (Form EIA-860M) for September 2026: every generator's nameplate capacity and the
  month it began operating (or retired).

A capacity factor is an hour's generation divided by the fleet's capacity at that time. The fleets grew
during 2025, so the capacity is a straight line between the ends of the months before and after.

    python3 models/grid/build_data.py --reduce [--raw FOLDER]   read EIA's files; write the reduced tables
    python3 models/grid/build_data.py --write                   pack web/data.json from the reduced tables
    python3 models/grid/build_data.py --check                   fail if web/data.json is out of date

--reduce needs EIA's files (about 160 MB; each is checked against its SHA-256 below). The two 2025
BALANCE files are in the data store with Chapter 12's figures. The other two are looked for in the data
store's models/grid/raw/ folder, or in the folder given with --raw. The reduced tables go to the data
store, in models/grid/reduced/, with a record of every repair. They're outside Git.

--check always holds web/data.json to the SHA-256 written below. Where the reduced tables are at hand,
it also packs them again and compares.

The year runs on Eastern Standard Time (UTC−5), the time MISO and PJM keep their records in: hour 0 is
midnight to 1 a.m. EST on January 1, 2025. EIA stamps each hour with the time it ends.
"""
import csv
import datetime
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / 'web' / 'data.json'
DATA_SHA256 = '1dc32d36c863b26237255d0beb087a5075673a42845469445818436805ea678b'
STORE = Path('/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data')
REDUCED = STORE / 'models' / 'grid' / 'reduced'
RAW = [STORE / 'claude-figures-ch12' / 'eia-930', STORE / 'models' / 'grid' / 'raw']

SOURCES = {
    'EIA930_BALANCE_2024_Jul_Dec.csv': {
        'url': 'https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2024_Jul_Dec.csv',
        'sha256': 'a602a8e577cfdd2fa3083413eaa4dd8ba7f0d2b26a2986f8f6d22917465ea49f'},
    'EIA930_BALANCE_2025_Jan_Jun.csv': {
        'url': 'https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2025_Jan_Jun.csv',
        'sha256': 'fac4bb991dfa1dab3b4b35300ccab54ac99be13a40ce91954db8ddafb2816242'},
    'EIA930_BALANCE_2025_Jul_Dec.csv': {
        'url': 'https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2025_Jul_Dec.csv',
        'sha256': '1146158b972439db7c7f4cc7d0491e07644ddbf244d03b8ecb44cb2c833d10f1'},
    'september_generator2026.xlsx': {
        'url': 'https://www.eia.gov/electricity/data/eia860m/xls/september_generator2026.xlsx',
        'later_url': 'https://www.eia.gov/electricity/data/eia860m/archive/xls/september_generator2026.xlsx',
        'sha256': 'bcef74e1af991680731aeecfda967f5950db4ce739bb584edd8b8774c7e6da17'},
}
RETRIEVED = '2026-11-17 (the 2025 BALANCE files: 2026-10-24)'
LICENCE = 'Public domain (U.S. government work). EIA asks to be credited as the source.'

# The three grids, by EIA's code for the balancing authority.
GRIDS = {'home': ('MISO', 'the Midwest'), 'east': ('PJM', 'the Mid-Atlantic'), 'west': ('CISO', 'California')}
YEAR, HOURS = 2025, 8760
FIRST_END = datetime.datetime(YEAR, 1, 1, 6)        # UTC: the end of the first hour of the year in EST
COLUMNS = {
    'demand': 'Demand (MW) (Adjusted)',
    'sun': 'Net Generation (MW) from Solar without Integrated Battery Storage (Adjusted)',
    'wind': 'Net Generation (MW) from Wind without Integrated Battery Storage (Adjusted)',
    'nuclear': 'Net Generation (MW) from Nuclear (Adjusted)',
    'hydro': 'Net Generation (MW) from Hydropower Excluding Pumped Storage (Adjusted)',
}
# These columns must stay empty or zero, or the fleets' totals would be missing something.
ALSO = ('Net Generation (MW) from Solar with Integrated Battery Storage (Adjusted)',
        'Net Generation (MW) from Wind with Integrated Battery Storage (Adjusted)')
SOLAR = ('Solar Photovoltaic', 'Solar Thermal without Energy Storage', 'Solar Thermal with Energy Storage')
WIND = ('Onshore Wind Turbine', 'Offshore Wind Turbine')
MONTHS = [(YEAR - 1, 12)] + [(YEAR, m) for m in range(1, 13)]


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def raw_file(name, extra):
    """Find one of EIA's files and check it is the one this script was written for."""
    for folder in RAW + ([Path(extra)] if extra else []):
        path = folder / name
        if path.is_file():
            if sha256(path) != SOURCES[name]['sha256']:
                raise SystemExit('%s is not the file this script expects (its SHA-256 differs).' % path)
            return path
    raise SystemExit('%s was not found. Download it from %s into %s, or name its folder with --raw.'
                     % (name, SOURCES[name]['url'], RAW[1]))


# ---- Form EIA-930: demand and generation, hour by hour ---------------------------------------------------

def number(text):
    text = (text or '').replace(',', '').strip()
    return float(text) if text else None


def read_930(extra):
    """Every 2025 hour (EST) for the three grids: {code: [row or None] * 8760}, as EIA reports them."""
    codes = {code for code, _ in GRIDS.values()}
    hours = {code: [None] * HOURS for code in codes}
    for name in sorted(n for n in SOURCES if n.startswith('EIA930')):
        with open(raw_file(name, extra), newline='', encoding='utf-8-sig') as handle:
            for row in csv.DictReader(handle):
                code = row['Balancing Authority']
                if code not in codes:
                    continue
                end = datetime.datetime.strptime(row['UTC Time at End of Hour'], '%m/%d/%Y %I:%M:%S %p')
                at = int((end - FIRST_END).total_seconds() // 3600)
                if not 0 <= at < HOURS:
                    continue
                for column in ALSO:
                    if number(row.get(column)):
                        raise SystemExit('%s reports %s, which this script leaves out.' % (code, column))
                hours[code][at] = {key: number(row.get(column)) for key, column in COLUMNS.items()}
    return hours


def repair(hours, table):
    """Fill what is missing, clip what cannot be and smooth out single hours that are plainly wrong.
    Returns the repaired hours and a list of the repairs."""
    repairs = []
    for code, rows in hours.items():
        for key in COLUMNS:
            values = [None if row is None else row[key] for row in rows]
            if key in ('sun', 'wind'):
                below = [at for at, v in enumerate(values) if v is not None and v < 0]
                if below:
                    repairs.append({'grid': code, 'what': key, 'hours': len(below),
                                    'lowest_mw': min(values[at] for at in below),
                                    'repair': 'readings below zero (plants drawing a little power at night) set to 0'})
                    for at in below:
                        values[at] = 0.0
            missing = [at for at, v in enumerate(values) if v is None]
            if missing and key in ('demand', 'sun', 'wind'):
                if len(missing) > 6 or 0 in missing or HOURS - 1 in missing:
                    raise SystemExit('%s is missing %d hours of %s: too many to fill.' % (code, len(missing), key))
                for at in missing:
                    before = max(k for k in range(at) if values[k] is not None)
                    after = min(k for k in range(at, HOURS) if values[k] is not None)
                    values[at] = values[before] + (values[after] - values[before]) * (at - before) / (after - before)
                repairs.append({'grid': code, 'what': key, 'hours': len(missing),
                                'utc_end_of_hours': [stamp(at) for at in missing],
                                'repair': 'missing hours filled along a straight line between their neighbors'})
            elif missing:
                for at in missing:
                    values[at] = 0.0
            if key in ('demand', 'sun', 'wind'):
                repairs += smooth(code, key, values, table)
            for at, value in enumerate(values):
                if rows[at] is None:
                    rows[at] = {}
                rows[at][key] = value
    return hours, repairs


def stamp(at):
    return (FIRST_END + datetime.timedelta(hours=at)).isoformat()


# PJM's wind record has the wrong reading in the last hour of each day (the hour that ends at midnight
# Eastern Standard Time) from January 1 to February 11, 2025: the readings there belong to other days. In
# 31 of those 42 hours the reading is more than 1,000 MW from the mean of its neighbors; over the rest of
# the year the typical difference at that hour is about 120 MW.
PJM_WIND_LAST_HOURS = [24 * day + 23 for day in range(42)]


def smooth(code, key, values, table):
    """Replace single hours that are plainly wrong with the mean of the hours before and after.

    The rule: the reading is further from the mean of its two neighbors than a fifth of the scale, while
    the neighbors are within a tenth of the scale of each other. The scale is the mean of the neighbors for
    demand, and the fleet's mid-year capacity for sun and wind. A real change doesn't come and go in one hour
    like that.
    """
    found = []
    for at in range(1, HOURS - 1):
        before, after = values[at - 1], values[at + 1]
        scale = (before + after) / 2 if key == 'demand' else table[code, key, YEAR, 6]
        named = code == 'PJM' and key == 'wind' and at in PJM_WIND_LAST_HOURS
        if named or (abs(values[at] - (before + after) / 2) > 0.2 * scale and abs(before - after) < 0.1 * scale):
            found.append((at, values[at], (before + after) / 2, named))
    for at, _, mean, _ in found:
        values[at] = mean
    out = []
    for named in (False, True):
        some = [f for f in found if f[3] == named]
        if some:
            out.append({'grid': code, 'what': key, 'hours': len(some),
                        'repair': ('the last hour of each day, January 1 to February 11, where the file carries '
                                   "other days' readings" if named else
                                   'single hours far from both neighbors') + ': replaced by the mean of the neighbors',
                        'utc_end_of_hours': [stamp(f[0]) for f in some],
                        'mw_before': [round(f[1], 1) for f in some], 'mw_after': [round(f[2], 1) for f in some]})
    return out


# ---- Form EIA-860M: the size of the fleets, month by month -----------------------------------------------

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def sheet_rows(book, sheet):
    """The rows of one sheet of an .xlsx file, each a list of its cells' text. Standard library only."""
    workbook = ET.fromstring(book.read('xl/workbook.xml'))
    targets = {r.get('Id'): r.get('Target') for r in ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))}
    member = next('xl/' + targets[s.get(REL)] for s in workbook.find(NS + 'sheets') if s.get('name') == sheet)
    strings = []
    for _, element in ET.iterparse(book.open('xl/sharedStrings.xml')):
        if element.tag == NS + 'si':
            strings.append(''.join(t.text or '' for t in element.iter(NS + 't')))
            element.clear()
    for _, element in ET.iterparse(book.open(member)):
        if element.tag != NS + 'row':
            continue
        cells = {}
        for cell in element.iter(NS + 'c'):
            column = 0
            for letter in re.match(r'[A-Z]+', cell.get('r')).group(0):
                column = column * 26 + ord(letter) - 64
            value = cell.find(NS + 'v')
            if value is not None:
                cells[column - 1] = strings[int(value.text)] if cell.get('t') == 's' else value.text
        yield [cells.get(k, '') for k in range(max(cells) + 1)] if cells else []
        element.clear()


def read_860m(extra):
    """The solar and wind generators of the three grids: operating ones, and ones that have retired."""
    codes = {code for code, _ in GRIDS.values()}
    units = []
    with zipfile.ZipFile(raw_file('september_generator2026.xlsx', extra)) as book:
        for sheet in ('Operating', 'Retired'):
            head = None
            for cells in sheet_rows(book, sheet):
                if head is None:
                    if cells and cells[0] == 'Entity ID':
                        head = cells
                    continue
                row = {name: (cells[at].strip() if at < len(cells) else '') for at, name in enumerate(head)}
                if row['Balancing Authority Code'] not in codes or row['Technology'] not in SOLAR + WIND:
                    continue
                units.append({
                    'sheet': sheet, 'grid': row['Balancing Authority Code'], 'plant_id': row['Plant ID'],
                    'plant': row['Plant Name'], 'generator': row['Generator ID'], 'state': row['Plant State'],
                    'technology': row['Technology'], 'mw': row['Nameplate Capacity (MW)'],
                    'operating_year': row['Operating Year'], 'operating_month': row['Operating Month'],
                    'retirement_year': row.get('Retirement Year', ''),
                    'retirement_month': row.get('Retirement Month', '')})
    return units


def capacity(units):
    """Nameplate capacity (MW) of each grid's solar and wind fleets at the end of each month."""
    table = {}
    for code, _ in GRIDS.values():
        for kind, technologies in (('sun', SOLAR), ('wind', WIND)):
            for year, month in MONTHS:
                total = 0.0
                for unit in units:
                    if unit['grid'] != code or unit['technology'] not in technologies:
                        continue
                    if (int(unit['operating_year']), int(unit['operating_month'])) > (year, month):
                        continue
                    if unit['retirement_year'] and \
                            (int(unit['retirement_year']), int(unit['retirement_month'] or 1)) <= (year, month):
                        continue
                    total += float(unit['mw'])
                table[code, kind, year, month] = round(total, 1)
    return table


def capacity_at(table, code, kind, hour):
    """The fleet's capacity (MW) in the middle of an hour: a straight line between the ends of the months
    before and after."""
    middle = FIRST_END - datetime.timedelta(hours=5.5) + datetime.timedelta(hours=hour)    # Eastern Standard Time
    start = datetime.datetime(middle.year, middle.month, 1)
    end = datetime.datetime(middle.year + (middle.month == 12), middle.month % 12 + 1, 1)
    before = (middle.year - 1, 12) if middle.month == 1 else (middle.year, middle.month - 1)
    a, b = table[(code, kind) + before], table[code, kind, middle.year, middle.month]
    return a + (b - a) * ((middle - start) / (end - start))


# ---- The reduced tables, in the data store ---------------------------------------------------------------

def reduce(extra):
    units = read_860m(extra)
    table = capacity(units)
    hours, repairs = repair(read_930(extra), table)
    REDUCED.mkdir(parents=True, exist_ok=True)
    codes = [code for code, _ in GRIDS.values()]
    with open(REDUCED / 'hourly-2025.csv', 'w', newline='', encoding='utf-8') as handle:
        out = csv.writer(handle)
        out.writerow(['hour', 'utc_end'] + ['%s_%s_mw' % (code, key) for code in codes for key in COLUMNS])
        for at in range(HOURS):
            out.writerow([at, (FIRST_END + datetime.timedelta(hours=at)).isoformat()] +
                         [repr(round(hours[code][at][key], 3)) for code in codes for key in COLUMNS])
    with open(REDUCED / 'capacity-2025.csv', 'w', newline='', encoding='utf-8') as handle:
        out = csv.writer(handle)
        out.writerow(['grid', 'fleet', 'year', 'month', 'nameplate_mw_at_end_of_month'])
        for key in sorted(table):
            out.writerow(list(key) + [table[key]])
    with open(REDUCED / 'units-860m-slice.csv', 'w', newline='', encoding='utf-8') as handle:
        out = csv.DictWriter(handle, fieldnames=list(units[0]))
        out.writeheader()
        out.writerows(units)
    record = {'made': 'python3 models/grid/build_data.py --reduce', 'retrieved': RETRIEVED, 'licence': LICENCE,
              'sources': SOURCES, 'grids': {key: code for key, (code, _) in GRIDS.items()},
              'columns': COLUMNS, 'repairs': repairs, 'units_in_slice': len(units)}
    (REDUCED / 'sources-and-repairs.json').write_text(json.dumps(record, indent=1) + '\n', encoding='utf-8')
    print('Wrote the reduced tables to %s (%d repairs).' % (REDUCED, len(repairs)))


def read_reduced():
    with open(REDUCED / 'hourly-2025.csv', newline='', encoding='utf-8') as handle:
        hourly = list(csv.DictReader(handle))
    with open(REDUCED / 'capacity-2025.csv', newline='', encoding='utf-8') as handle:
        table = {(r['grid'], r['fleet'], int(r['year']), int(r['month'])): float(r['nameplate_mw_at_end_of_month'])
                 for r in csv.DictReader(handle)}
    if len(hourly) != HOURS:
        raise SystemExit('The reduced table has %d hours, not %d.' % (len(hourly), HOURS))
    return hourly, table


# ---- The page's data file --------------------------------------------------------------------------------

def half_up(x):
    return int(x + 0.5)


def packed():
    """web/data.json as it should be: demand in hundredths of a GW, capacity factors in thousandths."""
    hourly, table = read_reduced()
    grids = {}
    for key, (code, name) in GRIDS.items():
        demand = [float(row['%s_demand_mw' % code]) for row in hourly]
        made = {kind: [float(row['%s_%s_mw' % (code, kind)]) for row in hourly] for kind in ('sun', 'wind')}
        factor = {kind: [half_up(1000 * made[kind][at] / capacity_at(table, code, kind, at)) for at in range(HOURS)]
                  for kind in ('sun', 'wind')}
        for kind in factor:
            if max(factor[kind]) > 1000:
                raise SystemExit('%s makes more %s power than its fleet could.' % (code, kind))
        other = {kind: sum(float(row['%s_%s_mw' % (code, kind)]) for row in hourly) / 1000
                 for kind in ('nuclear', 'hydro')}
        grids[key] = {
            'code': code, 'name': name,
            'demand': [half_up(d / 10) for d in demand],
            'sun': factor['sun'], 'wind': factor['wind'],
            # What EIA measured over the year, in GWh, and each fleet's size: the capacity that, at the
            # year's capacity factors, makes what the fleet made.
            'measured': {
                'demand_gwh': round(sum(demand) / 1000), 'sun_gwh': round(sum(made['sun']) / 1000),
                'wind_gwh': round(sum(made['wind']) / 1000), 'nuclear_gwh': round(other['nuclear']),
                'hydro_gwh': round(other['hydro']),
                'sun_gw': round(sum(made['sun']) / sum(factor['sun']), 2),
                'wind_gw': round(sum(made['wind']) / sum(factor['wind']), 2)}}
    data = {
        'about': 'Hourly electricity demand and the capacity factors of solar and wind power in 2025 on three '
                 'U.S. grids, from the U.S. Energy Information Administration (Forms EIA-930 and EIA-860M; '
                 'public domain). demand is in hundredths of a gigawatt; sun and wind are capacity factors in '
                 'thousandths. Hour 0 is midnight to 1 a.m. Eastern Standard Time on January 1, 2025. '
                 'Made by models/grid/build_data.py.',
        'year': YEAR, 'hours': HOURS, 'utc_offset': -5, 'grids': grids}
    lines = ['{']
    for name in ('about', 'year', 'hours', 'utc_offset'):
        lines.append(' %s: %s,' % (json.dumps(name), json.dumps(data[name])))
    lines.append(' "grids": {')
    for count, (key, grid) in enumerate(grids.items()):
        lines.append('  %s: {' % json.dumps(key))
        for name in ('code', 'name', 'measured', 'demand', 'sun', 'wind'):
            lines.append('   %s: %s%s' % (json.dumps(name), json.dumps(grid[name], separators=(',', ':')),
                                        '' if name == 'wind' else ','))
        lines.append('  }' + ('' if count == len(grids) - 1 else ','))
    lines += [' }', '}']
    return '\n'.join(lines) + '\n'


def main(arguments):
    extra = None
    if '--raw' in arguments:
        at = arguments.index('--raw')
        extra = arguments[at + 1]
        arguments = arguments[:at] + arguments[at + 2:]
    if arguments == ['--reduce']:
        reduce(extra)
    elif arguments == ['--write']:
        text = packed()
        DATA.write_text(text, encoding='utf-8')
        print('Wrote %s (%d kB). Its SHA-256, for DATA_SHA256 in this script:\n%s'
              % (DATA, len(text.encode()) // 1000, hashlib.sha256(text.encode()).hexdigest()))
    elif arguments == ['--check']:
        if sha256(DATA) != DATA_SHA256:
            raise SystemExit('web/data.json is not the file build_data.py made (its SHA-256 differs).')
        if (REDUCED / 'hourly-2025.csv').is_file() and DATA.read_text(encoding='utf-8') != packed():
            raise SystemExit('web/data.json is out of date with the reduced tables. Run build_data.py --write.')
    else:
        raise SystemExit('usage: build_data.py --reduce [--raw FOLDER] | --write | --check')


if __name__ == '__main__':
    main(sys.argv[1:])
