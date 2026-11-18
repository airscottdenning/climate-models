/* Watershed model: follow a year's rain and snow through a watershed, month
 * by month, into snow, soil, the air and the river. It's the US Geological
 * Survey's monthly water-balance model (McCabe and Markstrom, 2007).
 *
 * These are the steps on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab. Water is in mm.
 *   T     T: the month's average temperature, in °C
 *   P     P: the month's precipitation
 *   s     s: the share of it that falls as snow
 *   m     m: the share of the snowpack that melts
 *   Ep    Ep: evaporative demand, the most water that could evaporate
 *   W     W: the water reaching the soil: rain and melt
 *   S     S: the water in the soil, up to C = 150 mm
 *   E     E: the water that evaporates and passes through plants
 *   R     R: runoff, the water that reaches the river
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Watershed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // McCabe and Markstrom's (2007) usual values.
  var T_RAIN = 3.3;      // Tr: above this, everything falls as rain (°C)
  var MELT_MAX = 0.5;    // the most of the snowpack that melts in a month
  var DIRECT = 0.05;     // the share of rain that runs straight off
  var C = 150;           // the soil's capacity (mm)
  var RELEASE = 0.5;     // the share of the waiting water that runs off
  var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var MID = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
  var YEARS = 30;        // years run to settle; the page shows the last

  // The places, written by build_data.py from places.json: TerraClimate's
  // 1991-2020 months for each watershed, and Ts (step 1).
  // PLACES START
  var PLACES = [
    { id: "merced",
      name: "Merced River above Yosemite Valley, California",
      short: "the Merced River above Yosemite Valley",
      kind: "Snow-fed mountains",
      latitude: 37.71, Ts: -1,
      T: [-2.6, -3.4, -2, -0.1, 3.7, 8.4, 13.4, 14.4, 11, 6.4, 1.3, -2.6],
      P: [134, 114, 101, 63, 32, 14, 13, 10, 14, 39, 82, 131] },
    { id: "french-broad",
      name: "French Broad River above Asheville, North Carolina",
      short: "the French Broad River above Asheville",
      kind: "Rain-fed and humid",
      latitude: 35.39, Ts: -10,
      T: [2.9, 4.5, 8.1, 12.5, 16.5, 20.2, 22.1, 21.5, 18.7, 13.3, 7.8, 4.2],
      P: [126, 113, 139, 120, 124, 131, 124, 136, 117, 109, 127, 139] },
    { id: "sierra-morena",
      name: "Sierra Morena hills, Andalusia, Spain",
      short: "the Sierra Morena hills of Andalusia",
      kind: "Mediterranean: wet winters, dry summers",
      latitude: 38.25, Ts: -10,
      T: [7.4, 9.1, 12.1, 14.5, 18.8, 24, 27.2, 26.8, 22.1, 16.8, 11.1, 8.4],
      P: [46, 40, 48, 55, 36, 13, 2, 4, 28, 65, 64, 71] }
  ];
  // PLACES END

  /* Step 1. s: the share that falls as snow. Ts is the temperature below
   * which all of it does. Between Ts and Tr it changes along a line. */
  function snowShare(T, Ts) {
    return Math.min(1, Math.max(0, (T_RAIN - T) / (T_RAIN - Ts)));
  }

  /* Step 2. m: the share of the snowpack that melts this month. */
  function meltShare(T, Ts) {
    var m = MELT_MAX * (T - Ts) / (T_RAIN - Ts);
    return Math.min(MELT_MAX, Math.max(0, m));
  }

  /* D: daylight, in units of 12 hours, on the middle day n of the month at
   * latitude lat (degrees). The Sun's declination follows Cooper (1969). */
  function daylight(lat, n) {
    var dec = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + n) / 365);
    var x = -Math.tan(lat * Math.PI / 180) * Math.tan(dec);
    var hours = 2 * Math.acos(Math.min(1, Math.max(-1, x))) * 180 / Math.PI / 15;
    return hours / 12;
  }

  /* Step 3. Ep: evaporative demand in month k, from Hamon's (1961) formula.
   * rho is the most water vapor the air can hold, in a scaled form. */
  function demand(T, lat, k) {
    var rho = 4.95 * Math.exp(0.062 * T) / 100;
    var D = daylight(lat, MID[k]);
    return 13.97 * DAYS[k] * D * D * rho;
  }

  /* One month. `state` holds the snowpack, the soil water S and the water
   * waiting to run off. Returns the month's numbers. */
  function month(T, P, Ts, lat, k, state) {
    var snow = P * snowShare(T, Ts), rain = P - snow;
    var direct = DIRECT * rain;
    state.snow += snow;
    var melt = state.snow * meltShare(T, Ts);
    state.snow -= melt;
    var W = rain - direct + melt, Ep = demand(T, lat, k), E;
    if (W >= Ep) {
      // Step 4, a wet month: demand is met, and the rest fills the soil.
      // Whatever the soil can't hold waits to run off.
      E = Ep;
      state.S += W - Ep;
      if (state.S > C) { state.wait += state.S - C; state.S = C; }
    } else {
      // Step 4, a dry month: the soil gives up water, less as it dries.
      var draw = Math.min(state.S, (Ep - W) * state.S / C);
      state.S -= draw;
      E = W + draw;
    }
    // Step 5. R: half of the waiting water runs off, with the direct runoff.
    var out = RELEASE * state.wait;
    state.wait -= out;
    return { T: T, P: P, snowfall: snow, melt: melt, Ep: Ep, W: W, E: E,
             R: out + direct, snow: state.snow, S: state.S,
             wait: state.wait };
  }

  /* A year, after YEARS years to settle. T and P are twelve months; dT is
   * the warming in °C and dP the change in precipitation in %. */
  function run(place, dT, dP) {
    var state = { snow: 0, S: C, wait: 0 }, months = [], start = null;
    for (var y = 0; y < YEARS; y++) {
      if (y === YEARS - 1) {
        start = { snow: state.snow, S: state.S, wait: state.wait };
      }
      months = [];
      for (var k = 0; k < 12; k++) {
        months.push(month(place.T[k] + dT, place.P[k] * (1 + dP / 100),
          place.Ts, place.latitude, k, state));
      }
    }
    return { months: months, start: start, totals: totals(months, start) };
  }

  /* The year's totals: P, E and R, the change in storage, the month of the
   * most runoff, and the months with the soil less than half full. */
  function totals(months, start) {
    var sum = function (key) {
      return months.reduce(function (a, m) { return a + m[key]; }, 0);
    };
    var last = months[11], peak = 0, dry = 0;
    for (var k = 0; k < 12; k++) {
      if (months[k].R > months[peak].R) peak = k;
      if (months[k].S < C / 2) dry += 1;
    }
    return { P: sum('P'), E: sum('E'), R: sum('R'), Ep: sum('Ep'),
      dS: last.snow + last.S + last.wait - start.snow - start.S - start.wait,
      peak: peak, dry: dry,
      biggestSnow: Math.max.apply(null, months.map(function (m) {
        return m.snow; })) };
  }

  return { T_RAIN: T_RAIN, MELT_MAX: MELT_MAX, DIRECT: DIRECT, C: C,
    RELEASE: RELEASE, DAYS: DAYS, MID: MID, YEARS: YEARS,
    PLACES: PLACES, snowShare: snowShare, meltShare: meltShare,
    daylight: daylight,
    demand: demand, month: month, run: run };
});
