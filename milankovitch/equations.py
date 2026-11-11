"""The display equations on the Milankovitch page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  φ lat    λ lam    e ecc    ε obl    ϖ peri    θ anomaly    δ dec    h₀ h0    S S0
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, fn, frac, main, negative, num, op, power, row, slash, sub, times, var  # noqa: E402

h0 = sub(var('h'), num('0'))

EQUATIONS = {
    # Earth's angle from its closest point to the Sun.
    'anomaly': equation(var('θ'), op('='), var('λ'), op('+'), num('180°'), op('−'), var('ϖ')),
    # Average distance over today's distance.
    'distance': equation(
        frac(var('a'), var('r')), op('='),
        frac(row(num('1'), op('+'), times(var('e'), fn('cos', var('θ')))),
             row(num('1'), op('−'), power(var('e'), num('2'))))),
    # The latitude where the Sun is overhead at noon.
    'declination': equation(fn('sin', var('δ')), op('='), times(fn('sin', var('ε')), fn('sin', var('λ')))),
    # The Sun's angle from overhead, at any time of day.
    'zenith': equation(
        fn('cos', var('Z')), op('='),
        times(fn('sin', var('φ')), fn('sin', var('δ'))), op('+'),
        times(fn('cos', var('φ')), fn('cos', var('δ')), fn('cos', var('h')))),
    # Half the length of the day, as an angle.
    'daylength': equation(fn('cos', h0), op('='), negative(times(fn('tan', var('φ')), fn('tan', var('δ'))))),
    # The day's average of the cosine of the Sun's angle from overhead.
    'daymean': equation(
        var('C'), op('='),
        frac(row(times(h0, fn('sin', var('φ')), fn('sin', var('δ'))), op('+'),
                 times(fn('cos', var('φ')), fn('cos', var('δ')), fn('sin', h0))),
             var('π'))),
    # Daily-average Sunlight at the top of the atmosphere.
    'insolation': equation(
        var('Q'), op('='),
        times(var('S'), power(brackets(slash(var('a'), var('r'))), num('2')), var('C'))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
