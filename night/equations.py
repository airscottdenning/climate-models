"""The display equations on the night page's Physics tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the Physics tab explains. They match web/model.js:
  Q sunlight()    Sₘ the measured Sunlight (SUNLIGHT)    Sᵣ the measured reflected Sunlight (REFLECTED)
  Tₐ air() (measured)    U wind()    w the share of the measured wind    Uₘ the measured wind (WIND)
  L skyGlow()    s share    Lₘ the measured sky (SKY)    σ SIGMA
  E glow()    T₁, T₂ T[0], T[1]    Ri richardson()    g GRAVITY    z HEIGHT    r resistance()
  z₀ ROUGH    z₀ₕ z₀ / HEAT_ROUGH    κ KARMAN    f stirring()    ρ density()    P PRESSURE    R GAS    H airHeat()
  cₚ CP    V vapor()    β BOWEN    ζ stability()    ψₘ, ψₕ psi()    x (inside psi())
  F₁, F₂ flow()    k CONDUCTIVITY
  Δz₁, Δz₂ dz[0], dz[1]    ΔT₁, ΔT₂ warming()    Δt STEP    c HEAT_CAPACITY
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import brackets, delta, equation, fn, frac, main, num, op, power, row, sub, times, var  # noqa: E402


def numbered(letter, index):
    return sub(var(letter), num(index))


# Ri, the Richardson number, is the one name of two letters. It's written as one <mi>, as a function's name is.
RI = '<mi mathvariant="normal">Ri</mi>'
T1, T2, F1, F2 = numbered('T', '1'), numbered('T', '2'), numbered('F', '1'), numbered('F', '2')
TA, LM, SM = sub(var('T'), var('a')), sub(var('L'), var('m')), sub(var('S'), var('m'))
Z0, CP = sub(var('z'), num('0')), sub(var('c'), var('p'))
PM, PH = sub(var('ψ'), var('m')), sub(var('ψ'), var('h'))
Z0H = sub(var('z'), row(num('0'), var('h')))
UM = sub(var('U'), var('m'))
LOG = fn('ln', frac(var('z'), Z0))
LOGH = fn('ln', frac(var('z'), Z0H))
dz1, dz2, dt = delta(numbered('z', '1')), delta(numbered('z', '2')), delta(var('t'))

EQUATIONS = {
    # Step 1. The Sunlight the surface takes in: what reached the ground, less what it reflected (both measured).
    'sunlight': equation(var('Q'), op('='), SM, op('−'), sub(var('S'), var('r'))),
    # Step 2. The air's temperature is read from the measured table, and so is the wind: the share w of it.
    'wind': equation(var('U'), op('='), times(var('w'), UM)),
    # Step 3. The Earthlight that comes down from the sky: the share s of what was measured.
    'sky': equation(var('L'), op('='), times(var('s'), LM)),
    # Step 4. The Earthlight the surface emits (the Stefan–Boltzmann law).
    'emitted': equation(var('E'), op('='), times(var('σ'), power(T1, num('4')))),
    # Step 5. How strongly the air near the ground resists being stirred.
    'richardson': equation(RI, op('='), frac(row(times(var('g'), var('z'), brackets(TA, op('−'), T1))),
                                             row(times(TA, power(var('U'), num('2')))))),
    # Step 6. The resistance of well-stirred air, with heat's roughness a tenth of the wind's (Scott's app).
    'heat-roughness': equation(Z0H, op('='), frac(Z0, num('10'))),
    'resistance': equation(var('r'), op('='), frac(row(times(LOG, LOGH)),
                                                   row(times(power(var('κ'), num('2')), var('U'))))),
    # Step 6. The stability ζ that goes with Ri (Bonan's eqs 14.26, 14.27 and 14.33, as Scott's app has them).
    'ri-zeta': equation(RI, op('='), frac(row(times(var('ζ'), brackets(LOGH, op('−'), PH))),
                                          power(brackets(LOG, op('−'), PM), num('2')))),
    'psi-stable': equation(PM, op('='), op('−'), times(num('5'), var('ζ'))),
    'x': equation(var('x'), op('='), power(brackets(num('1'), op('−'), times(num('16'), var('ζ'))),
                                           frac(num('1'), num('4')))),
    'psi-m': equation(PM, op('='), times(num('2'), fn('ln', frac(row(num('1'), op('+'), var('x')), num('2')))),
                      op('+'), fn('ln', frac(row(num('1'), op('+'), power(var('x'), num('2'))), num('2'))),
                      op('−'), times(num('2'), fn('arctan', var('x'))), op('+'), frac(var('π'), num('2'))),
    'psi-h': equation(PH, op('='), times(num('2'), fn('ln', frac(row(num('1'), op('+'), power(var('x'), num('2'))),
                                                                 num('2'))))),
    'stirring': equation(var('f'), op('='), frac(row(times(LOG, LOGH)),
                                                 row(times(brackets(LOG, op('−'), PM), brackets(LOGH, op('−'), PH))))),
    'density': equation(var('ρ'), op('='), frac(var('P'), row(times(var('R'), TA)))),
    'heat': equation(var('H'), op('='), frac(row(times(var('ρ'), CP, brackets(T1, op('−'), TA), var('f'))),
                                             var('r'))),
    'vapor': equation(var('V'), op('='), frac(var('H'), var('β'))),
    # Step 7. The heat flowing down from the top layer into the one below it.
    'flow': equation(F1, op('='), frac(row(times(num('2'), var('k'), brackets(T1, op('−'), T2))),
                                       row(dz1, op('+'), dz2))),
    # Step 8. How much the top layer warms in one step, and a layer below it.
    'warming': equation(delta(T1), op('='),
                        frac(row(times(dt, brackets(var('Q'), op('+'), var('L'), op('−'), var('E'), op('−'),
                                                    var('H'), op('−'), var('V'), op('−'), F1))),
                             row(times(var('c'), dz1)))),
    'warming-below': equation(delta(T2), op('='),
                              frac(row(times(dt, brackets(F1, op('−'), F2))), row(times(var('c'), dz2)))),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
