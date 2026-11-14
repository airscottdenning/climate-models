"""The display equations on the Kaya page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  P P    y y    r birthRate()    n n    L leader()    g growth()    k catchUp    e, c falling()
  a, b choice.a, choice.b    F emissions()    C co2    S S    T warming()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, fn, frac, main, num, op, power, row, slash, sub, times, var  # noqa: E402

P, Y, R, G, K, L, N = var('P'), var('y'), var('r'), var('g'), var('k'), var('L'), var('n')

EQUATIONS = {
    # Step 1. How fast a group's population grows, in % a year, and what that adds in a year.
    'birth-poorer': equation(R, op('='), num('0.3'), op('+'),
                             times(num('1.25'), frac(brackets(num('20,000'), op('−'), Y), num('10,000')))),
    'birth-richer': equation(R, op('='), num('0.3'), op('−'), frac(brackets(Y, op('−'), num('20,000')), num('80,000'))),
    'people': equation(delta(P), op('='), times(frac(R, num('100')), P)),
    # Step 2. The leading economy's income per person, n years after 2025.
    'leader': equation(L, op('='), times(num('60,000'), power(brackets(num('1.01')), N))),
    # Step 3. How fast a group's income per person grows, and what that adds in a year.
    'growth': equation(G, op('='), num('1'), op('+'),
                       times(K, frac(fn('ln', brackets(slash(L, Y))), fn('ln', num('2'))))),
    'income': equation(delta(Y), op('='), times(frac(G, num('100')), Y)),
    # Step 4. The energy and carbon intensities, n years after 2025.
    'energy-intensity': equation(var('e'), op('='), times(sub(var('e'), num('0')),
                                                          power(brackets(num('1'), op('−'), frac(var('a'), num('100'))), N))),
    'carbon-intensity': equation(var('c'), op('='), times(sub(var('c'), num('0')),
                                                          power(brackets(num('1'), op('−'), frac(var('b'), num('100'))), N))),
    # Step 5. The Kaya identity, for one group.
    'kaya': equation(var('F'), op('='), times(P, Y, var('e'), var('c'))),
    # Step 6. How much the CO2 in the air rises in a year.
    'co2': equation(delta(var('C')), op('='), frac(row(times(num('0.47'), var('F'))), num('2'))),
    # Step 7. Warming, from the carbon emitted since the start of 2025.
    'warming': equation(var('T'), op('='), num('1.4'), op('+'), times(frac(num('2'), num('1,000')), var('S'))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
