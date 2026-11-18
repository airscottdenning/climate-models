"""Carry the watersheds' climates into the watershed model.

places.json was made by fetch_places.py from TerraClimate's 1991-2020 monthly normals (CC0): for each
watershed, the average over its grid cells of each month's temperature (the middle of the daily high and low)
and precipitation, and TerraClimate's own water balance and, where there is one, a USGS river gauge's flow,
for checking. This script writes the model's inputs into web/model.js, between PLACES START and PLACES END.

    python3 build_data.py            print the places
    python3 build_data.py --write    put them into web/model.js
    python3 build_data.py --check    fail if web/model.js is out of date (the model's tests run this)

Ts, the temperature below which all precipitation falls as snow, is McCabe and Markstrom's (2007): -1 °C for
places above 1,000 m and -10 °C below. The Merced's gauge alone is at 1,225 m (4,020 feet), so its whole
watershed is above 1,000 m. The French Broad's gauge is at 594 m and the Sierra Morena hills are lower still;
both watersheds lie mostly below 1,000 m.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_JS = HERE / 'web' / 'model.js'
TS = {'merced': -1, 'french-broad': -10, 'sierra-morena': -10}


def places():
    out = []
    for p in json.loads((HERE / 'places.json').read_text(encoding='utf-8'))['places']:
        out.append({'id': p['id'], 'name': p['name'], 'short': p['short'], 'kind': p['kind'],
                    'latitude': p['latitude'], 'Ts': TS[p['id']], 'T': p['T'], 'P': p['P']})
    return out


def block():
    lines = ['  // PLACES START', '  var PLACES = [']
    rows = places()
    for n, p in enumerate(rows):
        lines.append('    { id: %s,' % json.dumps(p['id']))
        lines.append('      name: %s,' % json.dumps(p['name'], ensure_ascii=False))
        lines.append('      short: %s,' % json.dumps(p['short'], ensure_ascii=False))
        lines.append('      kind: %s,' % json.dumps(p['kind'], ensure_ascii=False))
        lines.append('      latitude: %s, Ts: %d,' % (p['latitude'], p['Ts']))
        lines.append('      T: [%s],' % ', '.join('%g' % x for x in p['T']))
        lines.append('      P: [%s] }%s' % (', '.join('%g' % x for x in p['P']), ',' if n < len(rows) - 1 else ''))
    lines += ['  ];', '  // PLACES END']
    return '\n'.join(lines) + '\n'


def written():
    js = MODEL_JS.read_text(encoding='utf-8')
    return re.sub(r'  // PLACES START\n.*?  // PLACES END\n', lambda m: block(), js, count=1, flags=re.S)


def main(arguments):
    if not arguments:
        print(block())
        return
    js = written()
    stale = MODEL_JS.read_text(encoding='utf-8') != js
    if arguments == ['--check']:
        if stale:
            raise SystemExit('web/model.js is out of date with places.json. Run python3 models/watershed/build_data.py --write.')
        return
    if arguments == ['--write']:
        MODEL_JS.write_text(js, encoding='utf-8')
        print('Wrote web/model.js.' if stale else 'Nothing to write.')
        return
    raise SystemExit('usage: build_data.py [--write | --check]')


if __name__ == '__main__':
    main(sys.argv[1:])
