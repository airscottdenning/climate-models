/* Emission budget model: cut the world's emissions by the same share every
 * year, starting now, and add up the warming with TCRE.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   cut     r: how much the emissions are cut, in % a year
 *   n       n: years after the start
 *   E       E: emissions from fossil fuels and land use, in GtC a year
 *   TODAY   E0: the emissions in the first year, in GtC a year
 *   SO_FAR  S0: all the carbon emitted from 1850 to the start, in GtC
 *   S       S: all the carbon emitted since 1850, in GtC
 *   T       T: warming since the late 1800s, in °C
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EmissionBudget = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The live numbers, written by build_data.py from the book's _variables.yml.
  // The last full year's emissions, and all the carbon emitted up to its end.
  // LIVE START
  var START = 2026;
  var TODAY = 11.5;      // E0: GtC a year, fossil fuels 10.4 + land use 1.1
  var SO_FAR = 756.5;    // S0: GtC emitted from 1850 through 2025
  // LIVE END
  var END = 2100;
  var TCRE = 2 / 1000;   // °C for each GtC
  var LIMIT = 2;         // °C: the dashed line

  /* Step 1. E: the emissions n years after the start, cut by r% a year. */
  function emissions(cut, n) { return TODAY * Math.pow(1 - cut / 100, n); }

  /* Step 3. T: the warming, from all the carbon emitted so far. */
  function warming(S) { return TCRE * S; }

  /* Step 4. S∞: all the carbon there will ever be, if the cuts go on
   * forever. With no cuts, there's no end to it. */
  function forever(cut) {
    return cut > 0 ? SO_FAR + 100 * TODAY / cut : Infinity;
  }

  /* Every year from the start to 2100, cutting `cut` % a year.
   * Step 2. S: all the carbon emitted before the year begins. It starts at
   * S0, and each year adds that year's emissions. */
  function run(cut) {
    var out = { year: [], E: [], S: [], T: [] }, S = SO_FAR;
    for (var n = 0; n <= END - START; n++) {
      var E = emissions(cut, n);
      out.year.push(START + n); out.E.push(E);
      out.S.push(S); out.T.push(warming(S));
      S += E;
    }
    out.limitYear = null;
    for (n = 0; n < out.T.length; n++) {
      if (out.T[n] >= LIMIT) { out.limitYear = out.year[n]; break; }
    }
    out.finalT = warming(forever(cut));
    return out;
  }

  return {
    START: START, END: END, TODAY: TODAY, SO_FAR: SO_FAR, TCRE: TCRE,
    LIMIT: LIMIT, emissions: emissions, warming: warming,
    forever: forever, run: run
  };
});
