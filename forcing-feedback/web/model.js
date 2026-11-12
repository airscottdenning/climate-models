/* Forcing, feedback and response: how much the world warms when it's pushed.
 *
 * A climate forcing pushes the Earth's energy out of balance. Feedbacks make
 * the response to that push bigger or smaller. The ocean makes it slow. This
 * file works out all three, one year at a time, for the whole Earth at once.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   scale     a, with c, m or s under it: how hard the reader takes carbon
 *             dioxide, methane or reflective smog to push, as a share of the
 *             IPCC's best estimate. 1 leaves it alone.
 *   forcing   F: the climate forcing, in W/m²
 *   gains     g, with w, v, i or c under it: the gain of the water vapor,
 *             vertical mixing, ice and snow or cloud feedback. No units.
 *   gain      g: all the gains added together
 *   S         S: the climate sensitivity, in °C per W/m²
 *   T         T: how much the surface has warmed since the start, in °C
 *   D         D: how much the deep ocean has warmed since the start, in °C
 *   exchange  γ: how fast heat passes from the surface layer to the deep
 *             ocean, in W/m² per °C of difference between them
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Feedback = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLANCK = 3.22;       // W/m² per °C: the extra energy the Earth sends to
                           // space for each °C it warms, with no feedbacks
  var BASELINE = 1 / PLANCK;   // S₀: the baseline climate sensitivity
  var DOUBLING = 3.93;     // F₂ₓ: W/m², the forcing from doubling carbon dioxide
  var SURFACE = 7.3;       // C: W/m² for a year to warm the surface layer 1 °C
  var DEEP = 110;          // C with a d under it: the same for the deep ocean
  var EXCHANGE = 0.7;      // γ as the page opens
  // The gain of each feedback as the page opens.
  var GAINS = { water: 0.56, mixing: -0.16, ice: 0.11, clouds: 0.13 };
  var PAIR = 0.40;         // water vapor and vertical mixing together
  var BASE_FIRST = 1850, BASE_LAST = 1900;   // "before industry", for the graphs

  /* Step 1. F: the forcing in one year. `row` has that year's forcing from
   * carbon dioxide, methane, reflective smog and everything else. */
  function forcing(row, scale) {
    return scale.co2 * row.co2 + scale.methane * row.methane +
      scale.smog * row.smog + row.other;
  }

  /* Step 2. g: the gains of the separate feedbacks add together. */
  function totalGain(gains) {
    return gains.water + gains.mixing + gains.ice + gains.clouds;
  }

  /* Step 3. S: the climate sensitivity. At a gain of 1 or more the warming
   * would feed itself without end, and there's no answer. */
  function sensitivity(gain) {
    return gain < 1 ? BASELINE / (1 - gain) : Infinity;
  }

  /* Step 4. T₂ₓ: the warming from doubling carbon dioxide, once the ocean has
   * caught up, in °C. */
  function doublingWarming(S, co2Scale) { return DOUBLING * co2Scale * S; }

  /* Step 5. N: the energy imbalance, in W/m². It's the part of the forcing
   * that the warming hasn't paid back yet. */
  function imbalance(F, T, S) { return F - T / S; }

  /* Step 6. H: the heat passing down into the deep ocean, in W/m². */
  function uptake(T, D, exchange) { return exchange * (T - D); }

  /* Step 7. ΔT and ΔD: how much the surface layer and the deep ocean warm in
   * one year, in °C. */
  function surfaceWarming(N, H) { return (N - H) / SURFACE; }
  function deepWarming(H) { return H / DEEP; }

  /* The forcing for every year of a table like the ones in data.json. */
  function forcings(table, scale) {
    return table.co2.map(function (co2, i) {
      return forcing({ co2: co2, methane: table.methane[i], smog: table.smog[i],
                       other: table.other[i] }, scale);
    });
  }

  /* The past up to the year before a scenario starts, then the scenario. */
  function joined(history, scenario) {
    var keep = scenario.first - history.first, table = { first: history.first,
      last: scenario.last };
    ['co2', 'methane', 'smog', 'other'].forEach(function (name) {
      table[name] = history[name].slice(0, keep).concat(scenario[name]);
    });
    return table;
  }

  /* Run the model through a list of yearly forcings.
   *
   * Everything starts at zero: before the first year, the surface and the deep
   * ocean are where they were, in balance. Each year takes steps 5 to 7 once,
   * with that year's forcing and the temperatures the year began with.
   *
   * What's kept for a year: N and H as the year's sum used them, and T and D
   * as the year left them.
   *
   * With S infinite (step 3) there's nothing to run, and the answer is null. */
  function run(F, S, exchange) {
    if (!isFinite(S)) return null;
    var T = 0, D = 0, result = { T: [], D: [], N: [], H: [] };
    for (var i = 0; i < F.length; i++) {
      var N = imbalance(F[i], T, S), H = uptake(T, D, exchange);
      T += surfaceWarming(N, H);
      D += deepWarming(H);
      result.N.push(N);
      result.H.push(H);
      result.T.push(T);
      result.D.push(D);
    }
    return result;
  }

  /* The average of a list of yearly values over some years. `first` is the
   * year of the list's first value. */
  function average(values, first, from, to) {
    var sum = 0;
    for (var year = from; year <= to; year++) sum += values[year - first];
    return sum / (to - from + 1);
  }

  /* The graphs count warming from the average of 1850 to 1900, as the measured
   * temperatures do. This is the model's own average over those years. */
  function baseline(T, first) { return average(T, first, BASE_FIRST, BASE_LAST); }

  /* How far the model is from the measurements, in °C: the square root of the
   * average squared difference, over the years both have. Each is counted
   * from its own 1850 to 1900 average. */
  function misfit(T, first, observed) {
    var base = baseline(T, first), sum = 0, count = 0;
    for (var i = 0; i < T.length; i++) {
      var j = first + i - observed.first;
      if (j < 0 || j >= observed.anomaly.length) continue;
      sum += Math.pow(T[i] - base - observed.anomaly[j], 2);
      count++;
    }
    return Math.sqrt(sum / count);
  }

  return {
    PLANCK: PLANCK, BASELINE: BASELINE, DOUBLING: DOUBLING, SURFACE: SURFACE,
    DEEP: DEEP, EXCHANGE: EXCHANGE, GAINS: GAINS, PAIR: PAIR,
    BASE_FIRST: BASE_FIRST, BASE_LAST: BASE_LAST,
    forcing: forcing, totalGain: totalGain, sensitivity: sensitivity,
    doublingWarming: doublingWarming, imbalance: imbalance, uptake: uptake,
    surfaceWarming: surfaceWarming, deepWarming: deepWarming,
    forcings: forcings, joined: joined, run: run, average: average,
    baseline: baseline, misfit: misfit
  };
});
