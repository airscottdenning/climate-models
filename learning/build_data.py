"""Make the learning model's data file from Chapter 12's figure package.

The page draws the same numbers as Figures 12.4 and 12.16 of the book, so it takes them from the package that
draws those figures, figures/chapter-12/costs-and-learning/. Nothing is downloaded or worked out again here:

- derived-data/solar-learning-curve.csv: solar module prices (2025 dollars a watt) against all the solar ever
  installed (GW), 1975-2024 (IRENA, Nemet, and Farmer and Lafond, via Our World in Data; CC BY 4.0);
- derived-data/battery-learning-curve.csv: lithium-ion cell prices (2024 dollars a kWh) against all the
  batteries ever made (GWh), 1991-2023 (Rupert Way, 2026, via Our World in Data; CC BY 4.0);
- derived-data/oil-learning-curve.csv: crude oil prices (2025 dollars a barrel) against all the oil ever
  produced (billion barrels), 1890-2025 (Energy Institute via Our World in Data; Hubbert, 1974);
- derived-data/lcoe-2010-2025.csv: the cost of electricity from new solar and onshore wind farms (2025 dollars
  a MWh), 2010-2025 (IRENA via Our World in Data), and source-data/irena-fossil-band.json with
  derived-data/checks.json: IRENA's range for new fossil-fuel plants, $67.3-181.0 a MWh in 2025 dollars.

Each file is held to the SHA-256 the package records in provenance/sha256.json, so the page and the figures
can't drift apart without a test saying so.

    python3 models/learning/build_data.py --write    write web/data.json
    python3 models/learning/build_data.py --check    fail if web/data.json is out of date
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PACKAGE = ROOT / 'figures' / 'chapter-12' / 'costs-and-learning'
DATA = HERE / 'web' / 'data.json'

CURVES = {
    'solar': ('solar-learning-curve.csv', 'cumulative_capacity_GW', 'module_price_usd2025_per_W'),
    'batteries': ('battery-learning-curve.csv', 'cumulative_production_GWh', 'cell_price_usd2024_per_kWh'),
    'oil': ('oil-learning-curve.csv', 'cumulative_world_oil_bn_barrels', 'usd2025_per_barrel'),
}
WORDS = {
    'solar': {'name': 'Solar panels', 'madeWords': 'Solar installed worldwide, all time', 'madeUnit': 'GW',
              'priceWords': 'Price per watt', 'priceUnit': 'a watt', 'dollars': 2025},
    'batteries': {'name': 'Batteries', 'madeWords': 'Batteries made worldwide, all time', 'madeUnit': 'GWh',
                  'priceWords': 'Price per kWh', 'priceUnit': 'a kWh', 'dollars': 2024},
    'oil': {'name': 'Oil', 'madeWords': 'Oil produced worldwide, all time', 'madeUnit': 'billion barrels',
            'priceWords': 'Price per barrel', 'priceUnit': 'a barrel', 'dollars': 2025},
}


def checked(name):
    """A file of the package, after checking it against the SHA-256 the package records."""
    path = PACKAGE / name
    recorded = json.loads((PACKAGE / 'provenance' / 'sha256.json').read_text(encoding='utf-8'))
    key = str(path.relative_to(ROOT))
    found = hashlib.sha256(path.read_bytes()).hexdigest()
    if recorded.get(key) != found:
        raise SystemExit('%s has changed since the figure package recorded it. Rebuild the package first.' % key)
    return path


def rows(name):
    with checked('derived-data/' + name).open(newline='', encoding='utf-8') as fh:
        return list(csv.DictReader(fh))


def build():
    out = {'curves': {}}
    for key, (name, made, price) in CURVES.items():
        table = rows(name)
        out['curves'][key] = dict(WORDS[key], year=[int(r['year']) for r in table],
                                  made=[float(r[made]) for r in table], price=[float(r[price]) for r in table])
    table = rows('lcoe-2010-2025.csv')
    band = json.loads(checked('derived-data/checks.json').read_text(encoding='utf-8'))['fig_12_04']
    checked('source-data/irena-fossil-band.json')
    out['costs'] = {'year': [int(r['year']) for r in table],
                    'solar': [float(r['solar_pv_usd2025_per_MWh']) for r in table],
                    'wind': [float(r['onshore_wind_usd2025_per_MWh']) for r in table],
                    'fossil': band['fossil_band_usd2025_per_MWh']}
    return json.dumps(out, separators=(',', ':'), ensure_ascii=False) + '\n'


def main(arguments):
    if arguments == ['--write']:
        text = build()
        if not DATA.exists() or DATA.read_text(encoding='utf-8') != text:
            DATA.write_text(text, encoding='utf-8')
        print('%s: %d bytes' % (DATA.name, len(text.encode('utf-8'))))
    elif arguments == ['--check']:
        if DATA.read_text(encoding='utf-8') != build():
            raise SystemExit('%s is out of date. Run this script with --write.' % DATA)
    else:
        raise SystemExit('usage: build_data.py --write | --check')


if __name__ == '__main__':
    main(sys.argv[1:])
