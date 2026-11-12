"""The display equations on the Two-layer page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  Q absorbed()    S sun    α albedo    σ SIGMA    E glow()    T kelvin, temperature()    U reaching()
  ε₁, ε₂ share1, share2: the share of the Earthlight that the upper layer (1) and the lower layer (2) absorb
  C with a g, C₂ carriedG, carried2: the heat rising air carries up from the ground, and from the lower layer
  E₁ upperGlow()    E₂ lowerGlow()    E with a g: groundGlow()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, frac, main, num, op, power, row, slash, sub, times, var  # noqa: E402


def of(letter, index):
    """A letter for one level: of('E', '1') is the upper layer's, of('E', '2') the lower layer's and
    of('E', 'g') the ground's."""
    return sub(var(letter), num(index) if index.isdigit() else var(index))


def rest(index):
    """The share of the Earthlight that a layer lets through: (1 − ε)."""
    return brackets(num('1'), op('−'), of('ε', index))


def other_side(index):
    """What a layer's two sides come to in a budget that's been solved: (2 − ε)."""
    return row(num('2'), op('−'), of('ε', index))


QUARTER = slash(num('1'), num('4'))     # the power 1/4: a fourth root

EQUATIONS = {
    # Step 1. The Sunlight the ground takes in, averaged over the whole planet.
    'sunlight': equation(var('Q'), op('='),
                         frac(row(times(var('S'), brackets(num('1'), op('−'), var('α')))), num('4'))),
    # Step 2. The Earthlight a level emits. For the black ground ε is 1 (the Stefan–Boltzmann law).
    'emitted': equation(var('E'), op('='), times(var('ε'), var('σ'), power(var('T'), num('4')))),
    # Step 3. The whole stack sends out what it takes in: the upper layer's glow and what it lets through.
    'top': equation(var('Q'), op('='), of('E', '1'), op('+'), times(rest('1'), var('U'))),
    # The upper layer's own budget: what it absorbs and what rising air brings, and its two sides.
    'upper-budget': equation(times(of('ε', '1'), var('U')), op('+'), of('C', '2'), op('='),
                             times(num('2'), of('E', '1'))),
    # The two together, solved for what the upper layer emits.
    'upper': equation(of('E', '1'), op('='),
                      frac(row(times(of('ε', '1'), var('Q')), op('+'), times(rest('1'), of('C', '2'))),
                           other_side('1'))),
    # Step 4. Between the layers, what goes up equals what comes down.
    'reaching': equation(var('U'), op('='), var('Q'), op('+'), of('E', '1'), op('−'), of('C', '2')),
    # Step 5. What U is made of, and the ground's own budget.
    'parts': equation(var('U'), op('='), times(rest('2'), of('E', 'g')), op('+'), of('E', '2')),
    'ground-budget': equation(var('Q'), op('+'), of('E', '2'), op('+'), times(rest('2'), of('E', '1')), op('='),
                              of('E', 'g'), op('+'), of('C', 'g')),
    # The two together, solved for what the ground emits.
    'ground': equation(of('E', 'g'), op('='), of('E', '1'), op('+'),
                       frac(row(times(num('2'), var('Q')), op('−'), of('C', 'g'), op('−'), of('C', '2')),
                            other_side('2'))),
    # Step 6. The lower layer, from what U is made of, and its own budget as a check.
    'lower': equation(of('E', '2'), op('='), var('U'), op('−'), times(rest('2'), of('E', 'g'))),
    'lower-budget': equation(times(of('ε', '2'), of('E', 'g')), op('+'), times(of('ε', '2'), of('E', '1')), op('+'),
                             of('C', 'g'), op('='), times(num('2'), of('E', '2')), op('+'), of('C', '2')),
    # Step 7. Step 2 turned around.
    'temperature': equation(var('T'), op('='),
                            power(brackets(slash(var('E'), brackets(times(var('ε'), var('σ'))))), QUARTER)),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
