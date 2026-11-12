"""The display equations on the daily-temperatures page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  z, x, m, s  shareAbove(threshold, mean, spread)    S, N, D  mean(), spread()    n daysBeyond()    f n / N
  h, A smoothingWidth()    ΔL, ΔG, k localAndGlobal()    P the place's P in data/index.json
  W a scenario's warming in SCENARIOS    W with a small r  warmingSince1850()    ΔT addedWarming()
  R timesAsOften()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, frac, main, num, op, power, row, sub, times, var  # noqa: E402

EQUATIONS = {
    # Step 1. How far a threshold is above the average, counted in standard deviations.
    'distance': equation(var('z'), op('='), frac(row(var('x'), op('−'), var('m')), var('s'))),
    # Step 2. The average of the days, and their standard deviation.
    'mean': equation(var('m'), op('='), frac(var('S'), var('N'))),
    'spread': equation(power(var('s'), num('2')), op('='), frac(var('D'), row(var('N'), op('−'), num('1')))),
    # Step 3. The share of the days beyond the threshold.
    'share': equation(var('f'), op('='), frac(var('n'), var('N'))),
    # Step 4. The width of the smoothing that draws the curves.
    'width': equation(var('h'), op('='), frac(row(times(num('0.9'), var('A'))), power(var('N'), num('0.2')))),
    # Step 5. The place's warming over the globe's.
    'ratio': equation(var('k'), op('='), frac(delta(var('L')), delta(var('G')))),
    # Step 6. The warming still to come at the place.
    'added': equation(delta(var('T')), op('='),
                      times(var('P'), brackets(var('W'), op('−'), sub(var('W'), var('r'))))),
    # Step 7. How many times as often.
    'times': equation(var('R'), op('='), frac(sub(var('f'), num('2')), sub(var('f'), num('1')))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
