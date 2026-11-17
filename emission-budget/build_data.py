"""Carry the book's live numbers into the emission budget model.

The model starts from the last full year's emissions and all the carbon emitted up to its end. Both are live
numbers, in the book's _variables.yml (entry "emissions"), updated each January. This script writes them into
web/model.js, between the lines LIVE START and LIVE END, and works out every number on the About tab that
depends on them. Each of those sits in web/index.html as <span data-live="its-name">.

    python3 build_data.py            print the numbers
    python3 build_data.py --write    put them into web/model.js and web/index.html
    python3 build_data.py --check    fail if either is out of date (the model's tests run this)

The numbers are worked out here with a short copy of the model's equations. The model's tests check them again
with a copy of their own, and check model.js against both.
"""
import json
import math
import re
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODEL_JS, PAGE = HERE / 'web' / 'model.js', HERE / 'web' / 'index.html'
END, TCRE, LIMIT, OPENS = 2100, 2 / 1000, 2, 2.0


def live():
    """The live numbers this model uses, from _variables.yml."""
    e = json.loads((ROOT / '_variables.yml').read_text(encoding='utf-8'))['emissions']
    return {'year': int(e['year']), 'E0': float(e['gtc']), 'fossil': e['fossil_gtc'], 'land': e['land_use_gtc'],
            'S0': float(e['since_1850_gtc'])}


def run(r, start, E0, S0):
    out = {'E': [], 'S': [], 'T': []}
    S = S0
    for n in range(END - start + 1):
        E = E0 * (1 - r / 100) ** n
        out['E'].append(E)
        out['S'].append(S)
        out['T'].append(TCRE * S)
        S += E
    out['limit'] = next((start + n for n, t in enumerate(out['T']) if t >= LIMIT), None)
    out['final'] = TCRE * (S0 + 100 * E0 / r) if r else math.inf
    return out


def f(x, places=1):
    """A number as the page writes it: commas, and halves rounded up, as on a calculator."""
    rounded = Decimal(repr(x)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return '{:,.{}f}'.format(rounded, places)


def plural(count, word):
    return '%d %s%s' % (count, word, '' if count == 1 else 's')


def numbers(v=None):
    """Every number on the About tab that the live numbers change, by the name of its span."""
    v = v or live()
    start, E0, S0 = v['year'] + 1, v['E0'], v['S0']
    last = END - start
    left = 1000 - S0
    needed = 100 * E0 / left
    slider = math.ceil(round(needed * 10, 6)) / 10            # the slider moves in steps of 0.1
    none, opens, slow, enough, fast = (run(r, start, E0, S0) for r in (0, OPENS, 1, slider, 10))
    for name, result in (('no cuts', none), ('2%', opens), ('1%', slow)):
        if result['limit'] is None:
            raise SystemExit('With %s, the warming no longer passes 2 °C by 2100: the About tab needs rewriting.' % name)
    if enough['final'] > LIMIT or run(slider - 0.1, start, E0, S0)['final'] <= LIMIT:
        raise SystemExit('The slider setting that just holds 2 °C is wrong.')
    w = 2050 - start                                          # the worked example's year
    power = round(0.98 ** w, 4)
    wE = round(E0 * power, 2)
    added = round(100 * E0 * round(1 - power, 4) / 2, 1)
    wS = round(S0 + added, 1)
    forever = S0 + 100 * E0 / OPENS
    n2050 = 2050 - start
    out = {
        'start': str(start), 'eyear': str(v['year']), 'prioryear': str(v['year'] - 1),
        'E0': f(E0), 'fossil': v['fossil'], 'land': v['land'], 'S0': f(S0), 'prior': f(S0 - E0),
        'S0-round': f(S0, 0), 'left': f(left), 'left-round': f(left, 0), 'T0': f(TCRE * S0),
        'per-year': f(TCRE * E0, 3), 'hundred-E0': f(100 * E0, 0), 'needed': f(needed, 2), 'slider': f(slider),
        'none-limit': str(none['limit']), 'none-2100': f(none['T'][last]),
        'opens-E2100': f(opens['E'][last]), 'opens-limit': str(opens['limit']), 'opens-T2100': f(opens['T'][last]),
        'opens-F2100': f(opens['T'][last] * 1.8),
        'slow-E2100': f(slow['E'][last]), 'slow-limit': str(slow['limit']), 'slow-gap': plural(slow['limit'] - none['limit'], 'year'),
        'slow-final': f(slow['final']),
        'enough-T2100': f(enough['T'][last], 2), 'enough-final': f(enough['final'], 2),
        'fast-E2050': f(fast['E'][n2050], 2), 'fast-final': f(fast['final'], 2), 'fast-add': f(100 * E0 / 10, 0),
        'fast-addT': f(TCRE * 100 * E0 / 10, 2),
        'w-n': str(w), 'w-power': '%.4f' % power, 'w-E': '%.2f' % wE, 'w-rest': '%.4f' % (1 - power),
        'w-added': f(added), 'w-S': f(wS), 'w-T': '%.2f' % round(TCRE * wS, 2), 'w-S-round': f(wS, 0),
        'w-forever': f(forever), 'w-final': '%.2f' % (TCRE * forever),
    }
    return out


def model_block(v):
    return ('  // LIVE START\n'
            '  var START = %d;\n'
            '  var TODAY = %s;      // E0: GtC a year, fossil fuels %s + land use %s\n'
            '  var SO_FAR = %s;    // S0: GtC emitted from 1850 through %d\n'
            '  // LIVE END\n') % (v['year'] + 1, v['E0'], v['fossil'], v['land'], v['S0'], v['year'])


def written():
    """model.js and index.html as they should be."""
    v = live()
    js = MODEL_JS.read_text(encoding='utf-8')
    js = re.sub(r'  // LIVE START\n.*?  // LIVE END\n', lambda m: model_block(v), js, count=1, flags=re.S)
    page = PAGE.read_text(encoding='utf-8')
    values = numbers(v)
    used = set(re.findall(r'<span data-live="([^"]+)">', page))
    if used != set(values):
        raise SystemExit('The page and this script name different numbers.\n  only in the page: %s\n  only here: %s'
                         % (', '.join(sorted(used - set(values))), ', '.join(sorted(set(values) - used))))
    page = re.sub(r'<span data-live="([^"]+)">[^<]*</span>',
                  lambda m: '<span data-live="%s">%s</span>' % (m.group(1), values[m.group(1)]), page)
    return js, page


def main(arguments):
    if not arguments:
        for key, value in numbers().items():
            print('%-14s %s' % (key, value))
        return
    if arguments not in (['--write'], ['--check']):
        raise SystemExit('usage: build_data.py [--write | --check]')
    js, page = written()
    stale = [p.name for p, new in ((MODEL_JS, js), (PAGE, page)) if p.read_text(encoding='utf-8') != new]
    if arguments == ['--check']:
        if stale:
            raise SystemExit('%s out of date with the live numbers in _variables.yml. Run python3 '
                             'models/emission-budget/build_data.py --write.' % ' and '.join(stale))
        return
    MODEL_JS.write_text(js, encoding='utf-8')
    PAGE.write_text(page, encoding='utf-8')
    print('Wrote %s.' % (' and '.join(stale) if stale else 'nothing: already up to date'))


if __name__ == '__main__':
    main(sys.argv[1:])
