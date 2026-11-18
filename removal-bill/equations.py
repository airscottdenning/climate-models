"""The display equations on the removal bill page's About tab.

Change an equation here, then run this with --write to put it into web/index.html. Run it with --check to see
whether the page is up to date. How the equations are written, and why: models/mathml.py.

The letters are the ones the About tab explains. They match web/model.js:
  R rate    N years    p price    e energy    C captured()    M asCO2()    B bill()    W energyEachYear()
  m PPM    x airFalls()    T cooling()
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mathml import equation, frac, main, num, op, row, times, var  # noqa: E402

C, M, R = var('C'), var('M'), var('R')
PER_CARBON = frac(num('44'), num('12'))           # tons of CO₂ for each ton of carbon

EQUATIONS = {
    # Step 1. All the carbon captured.
    'captured': equation(C, op('='), times(R, var('N'))),
    # Step 2. The same carbon as CO₂.
    'co2': equation(M, op('='), times(PER_CARBON, C)),
    # Step 3. The bill.
    'bill': equation(var('B'), op('='), times(var('p'), M)),
    # Step 4. The energy each year.
    'energy': equation(var('W'), op('='), times(var('e'), PER_CARBON, R)),
    # Step 5. How far the CO₂ in the air falls: half of what's captured comes back.
    'air': equation(var('x'), op('='), frac(M, row(times(num('2'), var('m'))))),
    # Step 6. The cooling: TCRE times all the carbon captured.
    'cooling': equation(var('T'), op('='), times(frac(num('2'), num('1,000')), C)),
}

if __name__ == '__main__':
    main(EQUATIONS, HERE / 'web' / 'index.html')
