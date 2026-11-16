"""The display equations on the discounting page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  y₀ income    r_cool cool    r_hot hot    p penalty    r_disc disc    t t    T years
  y_cool, y_hot income()    D damage()    s shortfall()    P presentValue()    V total()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, negative, num, op, power, row, sub, times, var  # noqa: E402


def named(letter, name):
    """A letter with a word under it: r with "cool" is r_cool."""
    return sub(var(letter), '<mtext>%s</mtext>' % name)


Y0 = sub(var('y'), num('0'))
Y_COOL, Y_HOT = named('y', 'cool'), named('y', 'hot')
R_COOL, R_HOT, R_DISC = named('r', 'cool'), named('r', 'hot'), named('r', 'disc')
E, T, BIG_T = var('e'), var('t'), var('T')


def grown(rate):
    """One piece of step 4: (e^((rate − r_disc) T) − 1) / (rate − r_disc)."""
    return frac(row(power(E, row(times(brackets(rate, op('−'), R_DISC), BIG_T))), op('−'), num('1')),
                row(rate, op('−'), R_DISC))


EQUATIONS = {
    # Step 1. Income per person t years from now, in the cooler world and the hotter one.
    'income-cool': equation(Y_COOL, op('='), times(Y0, power(E, row(times(R_COOL, T))))),
    'hot-rate': equation(R_HOT, op('='), R_COOL, op('−'), var('p')),
    'income-hot': equation(Y_HOT, op('='), times(Y0, power(E, row(times(R_HOT, T))))),
    # Step 2. The damage per person in year t, and the share of the cooler world's income that it is.
    'damage': equation(var('D'), op('='), Y_COOL, op('−'), Y_HOT),
    'shortfall': equation(var('s'), op('='), num('1'), op('−'), power(E, negative(times(var('p'), T)))),
    # Step 3. What year t's damage is worth today.
    'present-value': equation(var('P'), op('='), times(var('D'), power(E, negative(times(R_DISC, T))))),
    # Step 4. Every year's damage, discounted and added up.
    'total': equation(var('V'), op('='), times(Y0, brackets(grown(R_COOL), op('−'), grown(R_HOT)))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
