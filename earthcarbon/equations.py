"""The display equations on the EarthCarbon page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  C carbon in the air (air in run())    E fossil emissions    O ocean uptake    L land uptake
  c CO2 in ppm    c₀ CO2 in 1750 (start)    F forcing    F₂ₓ F2X    a aerosol strength
  F with s, o: smog and other forcing    λ lambda    S sensitivity    T warming    H the ocean's heat uptake
  k gasRate()    p the water's pCO2    f co2Growth()    c with c: COMPENSATION    h half
  r a pool's rate of rot    Q₁₀ q10    τ a pool's turnover time    P₀, P a pool last year and this year    I what arrives
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, fn, frac, main, num, op, power, row, sub, times, var  # noqa: E402


def of(letter, index):
    return sub(var(letter), var(index))


DOUBLED = sub(var('F'), num('2×'))
START = sub(var('c'), num('0'))

EQUATIONS = {
    # Step 1. What the sinks don't take stays in the air.
    'air': equation(delta(var('C')), op('='), var('E'), op('−'), var('O'), op('−'), var('L')),
    'ppm': equation(var('c'), op('='), frac(var('C'), num('2.18'))),
    # Step 2. The forcing: carbon dioxide's logarithm, smog and everything else.
    'forcing': equation(var('F'), op('='),
                        frac(row(times(DOUBLED, fn('ln', frac(var('c'), START)))), fn('ln', num('2'))),
                        op('+'), times(var('a'), of('F', 's')), op('+'), of('F', 'o')),
    # Step 3. The heat sent to space for each degree, and the balance the warming must strike.
    'feedback': equation(var('λ'), op('='), frac(DOUBLED, var('S'))),
    'balance': equation(times(num('0.91'), brackets(var('F'), op('−'), times(var('λ'), var('T')))),
                        op('='), var('H')),
    # Step 4. Gas through a surface box.
    'gas': equation(var('O'), op('='), times(var('k'), brackets(var('c'), op('−'), var('p')))),
    # Step 5. How much faster plants grow with more carbon dioxide.
    'co2growth': equation(var('f'), op('='),
                          frac(frac(row(var('c'), op('−'), of('c', 'c')), row(var('c'), op('+'), var('h'))),
                               frac(row(START, op('−'), of('c', 'c')), row(START, op('+'), var('h'))))),
    # Step 6. How fast a pool rots, and the pool a year later.
    'rot': equation(var('r'), op('='), frac(power(sub(var('Q'), num('10')), frac(var('T'), num('10'))),
                                            var('τ'))),
    'pool': equation(var('P'), op('='), frac(row(sub(var('P'), num('0')), op('+'), var('I')),
                                             row(num('1'), op('+'), var('r')))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
