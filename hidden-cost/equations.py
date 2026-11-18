"""The display equations on the hidden-cost page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  Q burned()    E harm    t price    P_demand demand()    P_supply supply()    P_social social()    H harmDone()
  Q_best best()    L lost()
The made-up market's four numbers (130, 0.5, 50 and 0.3) are written into the equations, as on the About tab.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, num, op, power, row, sub, times, var  # noqa: E402


def named(letter, name):
    """A letter with a word under it: P with "demand" is P_demand."""
    return sub(var(letter), '<mtext>%s</mtext>' % name)


Q, E, t = var('Q'), var('E'), var('t')
P_SUPPLY, Q_BEST = named('P', 'supply'), named('Q', 'best')
SLOPES = row(num('0.5'), op('+'), num('0.3'))

EQUATIONS = {
    # Step 1. Demand: what buyers will pay for one more ton.
    'demand': equation(named('P', 'demand'), op('='), num('130'), op('−'), times(num('0.5'), Q)),
    # Step 2. Supply: what one more ton costs the seller.
    'supply': equation(P_SUPPLY, op('='), num('50'), op('+'), times(num('0.3'), Q)),
    # Step 3. The social cost: the seller's cost plus the harm to other people.
    'social': equation(named('P', 'social'), op('='), P_SUPPLY, op('+'), E),
    # Step 4. Where the market settles, with a price t on the pollution.
    'burned': equation(Q, op('='), frac(row(num('130'), op('−'), num('50'), op('−'), t), SLOPES)),
    # Step 5. The harm to other people.
    'harm': equation(var('H'), op('='), times(E, Q)),
    # Step 6. The amount that makes the pie biggest, and how much smaller the pie is anywhere else.
    'best': equation(Q_BEST, op('='), frac(row(num('130'), op('−'), num('50'), op('−'), E), SLOPES)),
    'lost': equation(var('L'), op('='), times(frac(SLOPES, num('2')),
                                              power(brackets(Q, op('−'), Q_BEST), num('2')))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
