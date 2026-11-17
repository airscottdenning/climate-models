"""The display equations on the ice-age page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  F sunlight()    p data.p    o data.o    T temperature()    v v    C co2    m melted    Cf fossilCO2()
  G budget()    Δv iceChange()    M memoryAt()    E fossil    A stillInAir()    a, τ PARTS    t years × 1,000

The two averages in step 1 are data.json's pMean and oMean. The tests check that they match.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import (brackets, delta, equation, fn, frac, main, negative, num, op, power, row, slash,  # noqa: E402
                    sub, times, var)

DATA = json.loads((HERE / 'web' / 'data.json').read_text(encoding='utf-8'))
P_MEAN, O_MEAN = '%.2f' % DATA['pMean'], '%.2f' % DATA['oMean']

V, C, T, F, G, M, E, A = (var(x) for x in 'vCTFGMEA')
C_FOSSIL = sub(var('C'), var('f'))


def part(i):
    """One part of the fossil carbon dioxide still in the air: a e^(−t/τ), with the part's number under a and τ."""
    n = num(str(i))
    return times(sub(var('a'), n), power(var('e'), negative(slash(var('t'), sub(var('τ'), n)))))


EQUATIONS = {
    # Step 1. How far the summer Sunlight is above its average: the precession part plus 1.04 times the tilt part.
    'sunlight': equation(F, op('='), brackets(var('p'), op('−'), num(P_MEAN)), op('+'),
                         times(num('1.04'), brackets(var('o'), op('−'), num(O_MEAN)))),
    # Step 2. The temperature, from the ice and the carbon dioxide.
    'temperature': equation(T, op('='), negative(times(num('3'), V)), op('+'),
                            times(num('5.556'), fn('ln', brackets(slash(C, num('278')))))),
    # Step 3. The carbon dioxide, from the temperature, the ice, the ice that just melted and the fossil carbon.
    'co2': equation(C, op('='), times(num('17.28'), T), op('−'), times(num('31.95'), V), op('+'),
                    times(num('120'), var('m')), op('+'), num('278'), op('+'), C_FOSSIL),
    # Step 4. The ice's budget before the old ice is counted, then the change in the ice in 1,000 years.
    'budget': equation(G, op('='), times(num('0.2196'), V), op('−'),
                       times(num('0.2874'), power(V, slash(num('3'), num('2')))), op('−'),
                       times(num('0.0008'), F), op('−'), times(num('0.09525'), fn('ln', C))),
    'ice': equation(delta(V), op('='), frac(G, row(num('1'), op('−'), times(num('0.1841'), M))), op('+'),
                    num('0.5260')),
    # Step 5. The fossil carbon dioxide still in the air, and the share A of the carbon still there.
    'fossil': equation(C_FOSSIL, op('='), times(num('0.469'), E, A)),
    'airborne': equation(A, op('='), part(1), op('+'), part(2), op('+'), part(3), op('+'), part(4), op('+'),
                         part(5)),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
