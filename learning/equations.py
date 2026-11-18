"""The display equations on the learning page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  X made    X₀ the first year's X    P price    n doublings()    a, b fit()    L learning(), rate
  N doublings still to come    P_N ahead()    g growth()    X_earlier X five years before the last year    T years()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, fn, frac, main, num, op, power, row, slash, sub, times, var  # noqa: E402

X, P, L, N, g = var('X'), var('P'), var('L'), var('N'), var('g')
X0 = sub(X, num('0'))
X_EARLIER = sub(X, '<mtext>earlier</mtext>')

EQUATIONS = {
    # Step 1. How many times X has doubled since the first year.
    'doublings': equation(var('n'), op('='), frac(fn('ln', slash(X, X0)), fn('ln', num('2')))),
    # Step 2. The straight line through the points, on a log-log graph.
    'line': equation(fn('ln', P), op('='), var('a'), op('+'), times(var('b'), fn('ln', X))),
    # Step 3. The learning rate: what each doubling takes off the price.
    'rate': equation(L, op('='), num('1'), op('−'), power(num('2'), var('b'))),
    # Step 4. The price after N more doublings.
    'ahead': equation(sub(P, N), op('='), times(P, power(brackets(num('1'), op('−'), L), N))),
    # Step 5. How fast X has grown each year, over the last five years.
    'growth': equation(g, op('='), power(brackets(slash(X, X_EARLIER)), frac(num('1'), num('5'))), op('−'), num('1')),
    # Step 6. The years N doublings take at that speed.
    'years': equation(var('T'), op('='), frac(row(times(N, fn('ln', num('2')))), fn('ln', brackets(num('1'), op('+'), g)))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
