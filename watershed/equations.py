"""The display equations on the watershed page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  s snowShare()    m meltShare()    T    Tr T_RAIN    Ts    Ep demand()    d DAYS    D daylight()    ρ (rho)
  G the soil's draw    W rain and melt    S soil water    C the soil's capacity    R runoff    r rain
  X the water waiting to run off    P    E    ΔS the change in stored water
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, frac, main, num, op, power, row, sub, times, var  # noqa: E402

T, Tr, Ts, Ep = var('T'), sub(var('T'), var('r')), sub(var('T'), var('s')), sub(var('E'), var('p'))
EQUATIONS = {
    'snow': equation(var('s'), op('='), frac(row(Tr, op('−'), T), row(Tr, op('−'), Ts))),
    'melt': equation(var('m'), op('='), times(num('0.5'), frac(row(T, op('−'), Ts), row(Tr, op('−'), Ts)))),
    'demand': equation(Ep, op('='), times(num('13.97'), var('d'), power(var('D'), num('2')), var('ρ'))),
    'rho': equation(var('ρ'), op('='), frac(row(times(num('4.95'), power(var('e'), row(times(num('0.062'), T))))),
                                            num('100'))),
    'draw': equation(var('G'), op('='), times(brackets(Ep, op('−'), var('W')), frac(var('S'), var('C')))),
    'runoff': equation(var('R'), op('='), times(num('0.05'), var('r')), op('+'), times(num('0.5'), var('X'))),
    'balance': equation(var('P'), op('−'), var('E'), op('='), var('R'), op('+'), delta(var('S'))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
