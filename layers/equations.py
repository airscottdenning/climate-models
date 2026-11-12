"""The display equations on the Layers page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  Q absorbed()    S sun    α albedo    E glow()    σ SIGMA    T kelvin, temperature()    N panes    k k
  E₁, E₂, E₃, E with a k or an N under it: paneGlow() for that pane    E and T with a g: the ground, groundGlow()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, num, op, power, row, slash, sub, times, var  # noqa: E402


def pane(letter, index):
    """A letter for one pane: pane('E', '1') is the top pane's, pane('E', 'k') is pane k's."""
    return sub(var(letter), num(index) if index.isdigit() else var(index))


def ground(letter):
    return sub(var(letter), var('g'))


QUARTER = slash(num('1'), num('4'))     # the power 1/4: a fourth root

EQUATIONS = {
    # Step 1. The Sunlight the ground takes in, averaged over the whole planet.
    'sunlight': equation(var('Q'), op('='),
                         frac(row(times(var('S'), brackets(num('1'), op('−'), var('α')))), num('4'))),
    # Step 2. The Earthlight a black surface emits (the Stefan–Boltzmann law).
    'emitted': equation(var('E'), op('='), times(var('σ'), power(var('T'), num('4')))),
    # Step 3. The stack sends out what it takes in, and only the top pane shows from space.
    'whole': equation(pane('E', '1'), op('='), var('Q')),
    # The top pane's budget: what comes up to it, and what it emits from its two sides.
    'top-pane': equation(pane('E', '2'), op('='), times(num('2'), pane('E', '1'))),
    # The second pane's budget: from above and from below, and its two sides.
    'second-pane': equation(pane('E', '1'), op('+'), pane('E', '3'), op('='), times(num('2'), pane('E', '2'))),
    # The pattern: each pane emits Q more than the one above it.
    'pane': equation(pane('E', 'k'), op('='), times(var('k'), var('Q'))),
    # Step 4. The ground, by the pattern and by its own budget.
    'ground': equation(ground('E'), op('='), times(brackets(var('N'), op('+'), num('1')), var('Q'))),
    'ground-budget': equation(ground('E'), op('='), var('Q'), op('+'), pane('E', 'N')),
    # Step 5. Step 2 turned around, and what it says about the ground and the top pane.
    'temperature': equation(var('T'), op('='), power(brackets(slash(var('E'), var('σ'))), QUARTER)),
    'ratio': equation(ground('T'), op('='),
                      times(power(brackets(var('N'), op('+'), num('1')), QUARTER), pane('T', '1'))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
