"""The display equations on the Moon page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  θ angle    t t    P day    Q sunlight()    S SUN    α albedo    E glow()    σ SIGMA    T₁, T₂ T[0], T[1]
  F₁, F₂ flow()    k CONDUCTIVITY    Δz₁, Δz₂ dz[0], dz[1]    ΔT₁, ΔT₂ warming()    Δt step    c HEAT_CAPACITY
  L longestStep()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, fn, frac, main, num, op, power, row, sub, times, var  # noqa: E402


def numbered(letter, index):
    return sub(var(letter), num(index))


T1, T2, F1, F2 = numbered('T', '1'), numbered('T', '2'), numbered('F', '1'), numbered('F', '2')
dz1, dz2, dt = delta(numbered('z', '1')), delta(numbered('z', '2')), delta(var('t'))

EQUATIONS = {
    # Step 1. The Sun's angle from straight overhead: −180° at midnight, 0° at noon.
    'angle': equation(var('θ'), op('='), times(num('360°'), frac(var('t'), var('P'))), op('−'), num('180°')),
    # Step 2. The Sunlight the surface takes in, by day.
    'sunlight': equation(var('Q'), op('='),
                         times(var('S'), brackets(num('1'), op('−'), var('α')), fn('cos', var('θ')))),
    # Step 3. The infrared radiation the surface emits (the Stefan–Boltzmann law).
    'emitted': equation(var('E'), op('='), times(var('σ'), power(T1, num('4')))),
    # Step 4. The heat flowing down from the top layer into the one below it.
    'flow': equation(F1, op('='), frac(row(times(num('2'), var('k'), brackets(T1, op('−'), T2))),
                                       row(dz1, op('+'), dz2))),
    # Step 5. How much the top layer warms in one step, and a layer below it.
    'warming': equation(delta(T1), op('='),
                        frac(row(times(dt, brackets(var('Q'), op('−'), var('E'), op('−'), F1))),
                             row(times(var('c'), dz1)))),
    'warming-below': equation(delta(T2), op('='),
                              frac(row(times(dt, brackets(F1, op('−'), F2))), row(times(var('c'), dz2)))),
    # Step 6. About the longest time step that works.
    'longest': equation(var('L'), op('='), frac(row(times(var('c'), dz1)),
                                                row(times(num('2'), var('σ'), power(T1, num('3')))))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
