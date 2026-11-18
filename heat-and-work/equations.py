"""The display equations on the heat and work page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  T0 T0    ΔT dT    T warmed()    H H    Tw wetBulb()    G G    W index()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, fn, frac, main, num, op, power, sub, times, var  # noqa: E402

T, H, G = var('T'), var('H'), var('G')
TW = sub(var('T'), var('w'))

EQUATIONS = {
    # Step 1. The air after the warming.
    'warmed': equation(T, op('='), sub(var('T'), num('0')), op('+'), delta(var('T'))),
    # Step 2. Stull's (2011) fit for the wet-bulb temperature.
    'wetbulb': equation(
        TW, op('='),
        times(T, fn('arctan', brackets(times(num('0.151977'),
                                             power(brackets(H, op('+'), num('8.313659')), frac(num('1'), num('2'))))))),
        op('+'), fn('arctan', brackets(T, op('+'), H)),
        op('−'), fn('arctan', brackets(H, op('−'), num('1.676331'))),
        op('+'), times(num('0.00391838'), power(H, frac(num('3'), num('2'))),
                       fn('arctan', brackets(times(num('0.023101'), H)))),
        op('−'), num('4.686035')),
    # Step 3. The wet-bulb globe temperature.
    'wbgt': equation(var('W'), op('='), times(num('0.7'), TW), op('+'),
                     times(num('0.2'), brackets(T, op('+'), G)), op('+'), times(num('0.1'), T)),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
