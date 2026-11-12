"""The display equations on the forcing and feedback page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  F forcing()    a scale    F with c, m, s, o: a year's row of data.json (co2, methane, smog, other)
  g totalGain()    g with w, v, i, c: gains (water, mixing, ice, clouds)    S sensitivity()    S₀ BASELINE
  T₂ₓ doublingWarming()    F₂ₓ DOUBLING    N imbalance()    T, D the surface's and the deep ocean's warming
  H uptake()    γ exchange    ΔT surfaceWarming()    ΔD deepWarming()    C SURFACE    C with a d: DEEP
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, frac, main, num, op, row, sub, times, var  # noqa: E402


def of(letter, index):
    return sub(var(letter), var(index))


DOUBLED = num('2×')

EQUATIONS = {
    # Step 1. The climate forcing in one year: three pushes the reader can make stronger or weaker, and the rest.
    'forcing': equation(var('F'), op('='), times(of('a', 'c'), of('F', 'c')), op('+'),
                        times(of('a', 'm'), of('F', 'm')), op('+'), times(of('a', 's'), of('F', 's')),
                        op('+'), of('F', 'o')),
    # Step 2. The gains of the separate feedbacks add together.
    'gain': equation(var('g'), op('='), of('g', 'w'), op('+'), of('g', 'v'), op('+'), of('g', 'i'),
                     op('+'), of('g', 'c')),
    # Step 3. The climate sensitivity.
    'sensitivity': equation(var('S'), op('='), frac(sub(var('S'), num('0')),
                                                    row(num('1'), op('−'), var('g')))),
    # Step 4. The warming from doubling carbon dioxide, in the end.
    'doubling': equation(sub(var('T'), DOUBLED), op('='), times(of('a', 'c'), sub(var('F'), DOUBLED), var('S'))),
    # Step 5. The energy imbalance: the part of the push not yet paid back.
    'imbalance': equation(var('N'), op('='), var('F'), op('−'), frac(var('T'), var('S'))),
    # Step 6. The heat passing down into the deep ocean.
    'uptake': equation(var('H'), op('='), times(var('γ'), brackets(var('T'), op('−'), var('D')))),
    # Step 7. How much the surface layer and the deep ocean warm in a year.
    'surface': equation(delta(var('T')), op('='), frac(row(var('N'), op('−'), var('H')), var('C'))),
    'deep': equation(delta(var('D')), op('='), frac(var('H'), sub(var('C'), var('d')))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
