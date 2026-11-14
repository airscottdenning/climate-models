/* Kaya model: population, income, energy and carbon from 2025 to 2100.
 *
 * The world is split into three groups of people: the richest tenth, the
 * middle eight tenths and the poorest tenth. Each year, each group's
 * population and income grow, and the world's energy and carbon intensities
 * fall. The Kaya identity turns them into emissions, and the emissions into
 * CO2 in the air and warming.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   P       P: people in a group, in billions
 *   y       y: income per person, in 2015 US dollars a year
 *   leader  L: income per person in the leading economy
 *   catchUp k: extra growth for each halving of the gap, in % a year
 *   e       e: energy intensity, in kWh per dollar
 *   c       c: carbon intensity, in kg of carbon per kWh
 *   a, b    a, b: how fast e and c fall, in % a year
 *   F       F: emissions, in billion tonnes of carbon (GtC) a year
 *   co2     C: CO2 in the air, in ppm
 *   T       T: warming since the late 1800s, in °C
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kaya = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The world in 2025. The Kaya factors are 2024's, the latest year with all
  // four measured (Chapter 11's data).
  var START = 2025, END = 2100;
  var PEOPLE = 8.16;                    // billion
  var SHARES = [0.1, 0.8, 0.1];         // richest, middle, poorest
  var INCOMES = [30000, 11000, 730];    // dollars a person a year
  var LEADER = 60000;                   // L in 2025
  var LEADER_GROWTH = 1;                // % a year
  var ENERGY = 1.83;                    // e: kWh per dollar
  var CARBON = 0.0566;                  // c: kg of carbon per kWh
  var CO2 = 426;                        // C: ppm
  var WARMING = 1.4;                    // T: °C
  var PPM_PER_GTC = 0.47, STAYS = 0.5;  // step 6
  var TCRE = 2 / 1000;                  // step 7: °C per GtC
  var TRENDS = { a: 0.9, b: 0.3 };      // 2000 to 2024, % a year

  /* Step 1. r: how fast a group's population grows, in % a year, from its
   * income per person. Two straight lines that meet at $20,000 and 0.3%. */
  function birthRate(y) {
    return y < 20000 ? 0.3 + 1.25 * (20000 - y) / 10000
      : 0.3 - (y - 20000) / 80000;
  }

  /* Step 2. L: the leading economy's income per person, n years after 2025.
   */
  function leader(n) { return LEADER * Math.pow(1 + LEADER_GROWTH / 100, n); }

  /* Step 3. g: how fast a group's income per person grows, in % a year: the
   * leader's 1%, plus k for each halving of the gap to the leader. */
  function growth(y, L, catchUp) {
    return LEADER_GROWTH + catchUp * Math.log(L / y) / Math.LN2;
  }

  /* Step 4. e and c: the energy and carbon intensities n years after 2025,
   * each falling by a fixed share every year. */
  function falling(start, rate, n) { return start * Math.pow(1 - rate / 100, n); }

  /* Step 5. F: the Kaya identity, for one group, in GtC a year. P is in
   * billions, so P × y × e × c is in billions of kg, and 10^12 kg is 1 Gt. */
  function emissions(P, y, e, c) { return P * 1e9 * y * e * c / 1e12; }

  /* Step 5, again: the same group's energy use, in exajoules (EJ) a year.
   * A kWh is 3.6 million joules, and an EJ is 10^18 joules. */
  function energy(P, y, e) { return P * 1e9 * y * e * 3.6e6 / 1e18; }

  /* Step 6. ΔC: how much the CO2 in the air rises in a year, in ppm. About
   * half of what's emitted stays in the air. */
  function co2Rise(F) { return PPM_PER_GTC * STAYS * F; }

  /* Step 7. T: warming, from the carbon emitted since the start of 2025, S. */
  function warming(S) { return WARMING + TCRE * S; }

  /* Every year from 2025 to 2100. `choice` holds a and b (% a year) and k. */
  function run(choice) {
    var P = SHARES.map(function (s) { return s * PEOPLE; });
    var y = INCOMES.slice(), C = CO2, S = 0;
    var out = { year: [], P: [[], [], []], y: [[], [], []], leader: [],
      F: [[], [], []], energy: [[], [], []], world: { P: [], y: [], F: [],
        energy: [], income: [] }, co2: [], T: [] };
    for (var n = 0; n <= END - START; n++) {
      var e = falling(ENERGY, choice.a, n), c = falling(CARBON, choice.b, n);
      var people = 0, income = 0, F = 0, used = 0;
      for (var i = 0; i < 3; i++) {
        out.P[i].push(P[i]); out.y[i].push(y[i]);
        out.F[i].push(emissions(P[i], y[i], e, c));
        out.energy[i].push(energy(P[i], y[i], e));
        people += P[i]; income += P[i] * y[i];
        F += out.F[i][n]; used += out.energy[i][n];
      }
      out.year.push(START + n); out.leader.push(leader(n));
      out.world.P.push(people); out.world.y.push(income / people);
      out.world.income.push(income / 1000);       // trillion dollars a year
      out.world.F.push(F); out.world.energy.push(used);
      out.co2.push(C); out.T.push(warming(S));
      // On to next year: steps 1, 3 and 6, with this year's numbers.
      for (i = 0; i < 3; i++) {
        var r = birthRate(y[i]), g = growth(y[i], leader(n), choice.k);
        P[i] *= 1 + r / 100;
        y[i] *= 1 + g / 100;
      }
      C += co2Rise(F);
      S += F;
    }
    return out;
  }

  return {
    START: START, END: END, PEOPLE: PEOPLE, SHARES: SHARES, INCOMES: INCOMES,
    LEADER: LEADER, LEADER_GROWTH: LEADER_GROWTH, ENERGY: ENERGY,
    CARBON: CARBON, CO2: CO2, WARMING: WARMING, PPM_PER_GTC: PPM_PER_GTC,
    STAYS: STAYS, TCRE: TCRE, TRENDS: TRENDS,
    birthRate: birthRate, leader: leader, growth: growth, falling: falling,
    emissions: emissions, energy: energy, co2Rise: co2Rise, warming: warming,
    run: run
  };
});
