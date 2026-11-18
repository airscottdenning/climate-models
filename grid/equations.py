"""The display equations on the grid page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  c factor()    ch here    cn there    f far    C clean()    Ps sunGW    cs    Pw windGW    cw    F firmGW
  P power    E store    S short    D use    B give    K cleanShare    Sy, Dy the year's totals
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, num, op, sub, times, var  # noqa: E402

EQUATIONS = {
    # Step 1. How hard the Sun (or the wind) works this hour, with a share f built far away.
    'factor': equation(var('c'), op('='), times(brackets(num('1'), op('−'), var('f')), sub(var('c'), var('h'))),
                       op('+'), times(var('f'), sub(var('c'), var('n')))),
    # Step 2. The clean power made this hour.
    'clean': equation(var('C'), op('='), times(sub(var('P'), var('s')), sub(var('c'), var('s'))), op('+'),
                      times(sub(var('P'), var('w')), sub(var('c'), var('w'))), op('+'), var('F')),
    # Step 4. The batteries' power.
    'power': equation(var('P'), op('='), frac(var('E'), num('4'))),
    # Step 4. The shortfall in an hour when the clean power falls short.
    'short': equation(var('S'), op('='), var('D'), op('−'), var('C'), op('−'), var('B')),
    # Step 5. The share of the year's use met by clean power.
    'share': equation(var('K'), op('='), num('1'), op('−'), frac(sub(var('S'), var('y')), sub(var('D'), var('y')))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
