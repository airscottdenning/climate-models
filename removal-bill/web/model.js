/* The removal bill: capture carbon dioxide from the air, store it, and add up
 * what that costs, in dollars and in energy, and how much good it does.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   rate    R: carbon captured and stored, in GtC a year
 *   years   N: how many years the capture goes on
 *   price   p: dollars for each ton of CO2 captured and stored
 *   energy  e: kilowatt-hours of energy for each ton of CO2
 *   C       C: all the carbon captured, in GtC
 *   M       M: the same carbon as CO2, in billions of tons
 *   B       B: the bill, in billions of dollars
 *   W       W: the energy used each year, in terawatt-hours (TWh)
 *   PPM     m: what one ppm of CO2 in the air weighs, in billions of tons
 *   x       x: how far the CO2 in the air falls, in ppm
 *   T       T: how much the planet cools, in °C
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RemovalBill = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Chapter 13's numbers.
  var CARBON = 12, CO2 = 44, AIR = 29;  // what a carbon atom, CO2 and air weigh
  var ATMOSPHERE = 5.15e18;             // all the air there is, in kg
  var BACK = 0.5;                       // the share that comes back out of the
                                        // land and ocean
  var TCRE = 2 / 1000;                  // °C for each GtC
  var ELECTRICITY = 31800;              // TWh: all the world made in 2025
  var EMISSIONS = 11.5;                 // GtC the world emitted in 2025,
  var FOSSIL = 10.4;                    // and the part from fossil fuels

  // Things to hold the bill up against, from Chapters 1 and 13.
  var PHONES = 1700;                    // $ billion a year: phones and service
  var ROADS = [35000, 70000];           // $ billion: every paved road on Earth
  var SUN = { yearly: 2.25, years: 15 };  // $ billion a year: aircraft that
                                          // dim the Sun, a 2018 estimate

  /* m: one part per million of all the air, made heavier by 44/29 because
   * CO2 weighs more than air. From kg to billions of tons is 1e12. */
  var PPM = ATMOSPHERE / 1e6 * (CO2 / AIR) / 1e12;

  /* Step 1. C: the carbon captured in n years, at R GtC a year. */
  function captured(rate, n) { return rate * n; }

  /* Step 2. M: the same carbon as CO2. Each ton of carbon makes 44/12 tons. */
  function asCO2(C) { return CO2 / CARBON * C; }

  /* Step 3. B: the bill. Dollars a ton times billions of tons. */
  function bill(price, M) { return price * M; }

  /* Step 4. W: the energy each year. A kilowatt-hour for each of a billion
   * tons is a terawatt-hour. */
  function energyEachYear(energy, rate) { return energy * asCO2(rate); }

  /* Step 5. x: how far the CO2 in the air falls. Half of what's captured
   * comes back out of the land and ocean, so it takes 2 m to lower 1 ppm. */
  function airFalls(M) { return (1 - BACK) * M / PPM; }

  /* Step 6. T: the cooling. The rule already counts the half that comes
   * back, so it uses all the carbon captured. */
  function cooling(C) { return TCRE * C; }

  /* Everything the page shows, for one set of choices. */
  function run(rate, years, price, energy) {
    var out = { year: [], C: [], back: [], air: [] };
    for (var n = 0; n <= years; n++) {
      var c = captured(rate, n);
      out.year.push(n); out.C.push(c);
      out.back.push(BACK * c); out.air.push((1 - BACK) * c);
    }
    var C = captured(rate, years), M = asCO2(C), W = energyEachYear(energy, rate);
    out.totalC = C; out.M = M;
    out.B = bill(price, M);
    out.yearlyB = bill(price, asCO2(rate));
    out.W = W;
    out.shareOfElectricity = W / ELECTRICITY;
    out.x = airFalls(M);
    out.T = cooling(C);
    out.shareOfEmissions = rate / EMISSIONS;
    // Turned around: the bill for 1 ppm, and for a tenth of a degree.
    out.onePpm = bill(price, PPM / (1 - BACK));
    out.oneTenth = bill(price, asCO2(0.1 / TCRE));
    return out;
  }

  return {
    CARBON: CARBON, CO2: CO2, AIR: AIR, ATMOSPHERE: ATMOSPHERE, BACK: BACK,
    TCRE: TCRE, ELECTRICITY: ELECTRICITY, EMISSIONS: EMISSIONS, FOSSIL: FOSSIL,
    PHONES: PHONES, ROADS: ROADS, SUN: SUN, PPM: PPM,
    captured: captured, asCO2: asCO2, bill: bill,
    energyEachYear: energyEachYear, airFalls: airFalls, cooling: cooling,
    run: run
  };
});
