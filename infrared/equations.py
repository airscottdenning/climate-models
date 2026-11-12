"""The display equations on the infrared page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  λ um    T kelvin    u u    B glow    C amount    C₀ today    x x    h gap    t t
  a, b a, b    d slope()    s s    q bend    y the value read from the curve
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, equation, fn, frac, main, num, op, power, row, slash, sub, times, var  # noqa: E402


def numbered(letter, index):
    return sub(var(letter), num(index))


c1, c2, C0 = numbered('c', '1'), numbered('c', '2'), numbered('C', '0')
x0, x1, y0, y1 = numbered('x', '0'), numbered('x', '1'), numbered('y', '0'), numbered('y', '1')
d0, d1 = numbered('d', '0'), numbered('d', '1')
wavelength5 = power(var('λ'), num('5'))

EQUATIONS = {
    # Step 1. A number with no units that the next equation needs.
    'ratio': equation(var('u'), op('='), frac(c2, row(times(var('λ'), var('T'))))),
    # How brightly a black surface glows (the Planck distribution).
    'planck': equation(
        var('B'), op('='),
        frac(c1, row(times(wavelength5, brackets(power(var('e'), var('u')), op('−'), num('1')))))),
    # Step 2. The last equation turned around: the temperature that glows this brightly.
    'brightness': equation(
        var('T'), op('='),
        frac(c2, row(times(var('λ'), fn('ln', brackets(num('1'), op('+'),
                                                      slash(c1, brackets(times(wavelength5, var('B')))))))))),
    # Step 3. An amount of gas, counted in doublings from today's.
    'doublings': equation(var('x'), op('='), frac(fn('ln', brackets(slash(var('C'), C0))), fn('ln', num('2')))),
    # Step 4. The gap between two calculated amounts, and how far along it you are.
    'gap': equation(var('h'), op('='), x1, op('−'), x0),
    'along': equation(var('t'), op('='), frac(row(var('x'), op('−'), x0), var('h'))),
    # Step 5. The slope of the curve at a calculated amount: in the middle, and at an end.
    'slope-middle': equation(var('d'), op('='), frac(row(times(num('2'), var('a'), var('b'))),
                                                     row(var('a'), op('+'), var('b')))),
    'slope-end': equation(var('d'), op('='), frac(row(times(num('3'), var('a')), op('−'), var('b')), num('2'))),
    # Step 6. The curve between two calculated amounts.
    'share': equation(var('s'), op('='), times(power(var('t'), num('2')),
                                               brackets(num('3'), op('−'), times(num('2'), var('t'))))),
    'bend': equation(var('q'), op('='), times(brackets(num('1'), op('−'), var('t')), d0), op('−'), times(var('t'), d1)),
    'curve': equation(
        var('y'), op('='), y0, op('+'), times(var('s'), brackets(y1, op('−'), y0)), op('+'),
        times(var('h'), var('t'), brackets(num('1'), op('−'), var('t')), var('q'))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
