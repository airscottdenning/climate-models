"""The display equations on the emission budget page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  E emissions()    E0 TODAY    S0 SO_FAR    r cut    n n    S S    T warming()    S∞ forever()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, num, op, power, row, sub, times, var  # noqa: E402

E, R, N, S = var('E'), var('r'), var('n'), var('S')
E0, S0 = sub(var('E'), num('0')), sub(var('S'), num('0'))
SHARE = brackets(num('1'), op('−'), frac(R, num('100')))       # what's left of each year's emissions: 1 − r/100

EQUATIONS = {
    # Step 1. The emissions n years after the start.
    'emissions': equation(E, op('='), times(E0, power(SHARE, N))),
    # Step 2. All the carbon emitted by the start of year n: S0, plus the years since the start, added up.
    'total': equation(S, op('='), S0, op('+'),
                      frac(row(times(num('100'), E0, brackets(num('1'), op('−'), power(SHARE, N)))), R)),
    # Step 3. The warming: TCRE times all the carbon emitted.
    'warming': equation(var('T'), op('='), times(frac(num('2'), num('1,000')), S)),
    # Step 4. All the carbon there will ever be, if the cuts go on forever.
    'forever': equation(sub(S, num('∞')), op('='), S0, op('+'), frac(row(times(num('100'), E0)), R)),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
