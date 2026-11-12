/* Moon model: the temperature of the ground at the Moon's equator through a day.
 *
 * Sunlight warms the surface. The surface cools by emitting infrared radiation.
 * Heat soaks down into the ground by day and comes back up at night. There's no
 * air, no water and no tilt, so that's the whole model.
 *
 * The ground is crushed rock with vacuum between the fragments. Scientists call
 * it regolith. It isn't soil: there's no soil on the Moon.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   day      P: the length of the day, in seconds
 *   albedo   α: the share of the Sunlight that the surface reflects, 0 to 1
 *   step     Δt: the time step, in seconds
 *   t        t: the time since midnight, in seconds
 *   angle    θ: the Sun's angle from straight overhead, in radians
 *   T[i]     T: the temperature of a layer, in kelvins. T[0] is the top layer,
 *            which the About tab calls layer 1 and the page calls the surface.
 *   dz[i]    Δz: the thickness of a layer, in meters
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Moon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUN = 1361;             // S: W/m², the book's solar constant (Chapter 2)
  var SIGMA = 5.67e-8;        // σ: W/m² per K⁴, the Stefan-Boltzmann constant
  var CONDUCTIVITY = 0.003;   // k: W/m per K, how well the ground carries heat
  var HEAT_CAPACITY = 1.0e6;  // c: J/m³ per K, how much heat the ground holds
  var TOP = 0.005;            // Δz of the top layer: 5 mm
  var THICKER = 1.4;          // each layer is 1.4 times as thick as the one above
  var LAYERS = 13;            // which reaches 0.98 m down
  var EARTH_DAY = 86400;      // seconds
  var MOON_DAY = 29 + 12.75 / 24;   // Earth days, from one noon to the next
  var START = 250;            // K: every layer's temperature before the first day
  var MOST_DAYS = 40;         // give up if the days still differ after this many
  var CLOSE = 0.002;          // K: two days this much alike count as the same
  var KEEP = 10000;           // remember at most this many moments of the day

  /* Δz: the thickness of each layer, from the top down. */
  function thicknesses() {
    var dz = [];
    for (var i = 0; i < LAYERS; i++) dz.push(TOP * Math.pow(THICKER, i));
    return dz;
  }

  /* How far down the middle of each layer is, in meters. */
  function depths() {
    var top = 0;
    return thicknesses().map(function (dz) { top += dz; return top - dz / 2; });
  }

  /* Step 1. θ: the Sun's angle from straight overhead. It's −180° at midnight,
   * −90° at sunrise, 0 at noon and 90° at sunset. */
  function sunAngle(t, day) { return 2 * Math.PI * t / day - Math.PI; }

  /* Step 2. Q: the Sunlight the surface takes in, in W/m². None at night. */
  function sunlight(angle, albedo) {
    return SUN * (1 - albedo) * Math.max(Math.cos(angle), 0);
  }

  /* Step 3. E: the infrared radiation a surface at T emits, in W/m². */
  function glow(kelvin) { return SIGMA * Math.pow(kelvin, 4); }

  /* Step 4. F: the heat flowing down from one layer into the one below it, in
   * W/m². The middles of the two layers are half of (Δz + Δz) apart. */
  function flow(above, below, dzAbove, dzBelow) {
    return 2 * CONDUCTIVITY * (above - below) / (dzAbove + dzBelow);
  }

  /* Step 5. ΔT: how much a layer warms in one step, in kelvins, when `net` W/m²
   * more comes in than goes out. */
  function warming(net, dz, step) { return step * net / (HEAT_CAPACITY * dz); }

  /* Step 6. L: about the longest step that works, in seconds, when the top
   * layer is at T. */
  function longestStep(kelvin) {
    return HEAT_CAPACITY * TOP / (2 * SIGMA * Math.pow(kelvin, 3));
  }

  /* One step for the whole column: steps 2 to 5 for the top layer, then steps 4
   * and 5 for each layer below. Every flow is worked out from the temperatures
   * at the start of the step. Nothing leaves the bottom of the lowest layer. */
  function advance(T, angle, albedo, step, dz) {
    var fromAbove = sunlight(angle, albedo) - glow(T[0]);
    for (var i = 0; i < T.length; i++) {
      var toBelow = i + 1 < T.length ? flow(T[i], T[i + 1], dz[i], dz[i + 1]) : 0;
      T[i] += warming(fromAbove - toBelow, dz[i], step);
      fromAbove = toBelow;
    }
  }

  /* The top layer's part of one step, taken apart: what the page prints under
   * the graph. */
  function topLayer(T, angle, albedo, step, dz) {
    var q = sunlight(angle, albedo), e = glow(T[0]);
    var f = flow(T[0], T[1], dz[0], dz[1]);
    return { sunlight: q, glow: e, down: f, left: q - e - f,
             warming: warming(q - e - f, dz[0], step) };
  }

  /* Run the model until one day repeats the one before it, and return that day.
   *
   * `earthDays` is the length of the day, `albedo` is a share from 0 to 1 and
   * `minutes` is the time step. A whole number of steps has to fit in the day,
   * so the step is trimmed a little if it doesn't.
   *
   * The ground a meter down takes decades to settle, and the model doesn't wait.
   * Over a day that repeats, no heat builds up anywhere, so every layer has the
   * same average temperature as the top one. After each day, each layer is moved
   * by the difference between the top layer's average and its own. That reaches
   * the repeating day in about 8 days, and the test checks it the slow way.
   *
   * `turns` counts how often the surface went from warming to cooling or back
   * in the last day. A sound day has 2. With too long a step it has hundreds,
   * and the numbers aren't to be trusted even if the days repeat (step 6). */
  function run(earthDays, albedo, minutes) {
    var day = earthDays * EARTH_DAY;
    var n = Math.max(1, Math.round(day / (minutes * 60)));   // steps in a day
    var step = day / n;                                      // Δt
    var dz = thicknesses(), T = dz.map(function () { return START; });
    var every = Math.ceil(n / KEEP), count = Math.ceil(n / every);
    var result = {
      days: earthDays, albedo: albedo, minutes: minutes,
      steps: n, step: step, every: every, count: count,
      fraction: new Float64Array(count),      // how far through the day, 0 to 1
      T: dz.map(function () { return new Float64Array(count); }),
      blewUp: false, settled: false, daysRun: 0, turns: 0
    };
    var lastMean = null, heading = 0, i, j;

    for (var d = 1; d <= MOST_DAYS && !result.settled; d++) {
      var sums = dz.map(function () { return 0; });
      var hottest = { kelvin: -Infinity, at: 0 };
      var coldest = { kelvin: Infinity, at: 0 };
      var turns = 0, before;
      for (j = 0; j < n; j++) {
        if (j % every === 0) {
          result.fraction[j / every] = j / n;
          for (i = 0; i < LAYERS; i++) result.T[i][j / every] = T[i];
        }
        for (i = 0; i < LAYERS; i++) sums[i] += T[i];
        if (T[0] > hottest.kelvin) hottest = { kelvin: T[0], at: j / n };
        if (T[0] < coldest.kelvin) coldest = { kelvin: T[0], at: j / n };
        before = T[0];
        advance(T, sunAngle(j * step, day), albedo, step, dz);
        // Count the times the surface stops warming and cools, or the other way.
        if (T[0] !== before) {
          if (heading && (T[0] > before) !== (heading > 0)) turns++;
          heading = T[0] > before ? 1 : -1;
        }
        if (!(T[0] > 0 && T[0] < 1e4)) {      // below zero kelvins, or not a number
          result.blewUp = true;
          result.daysRun = d;
          result.count = Math.floor(j / every) + 1;
          return result;
        }
      }
      var means = sums.map(function (sum) { return sum / n; }), apart = 0;
      for (i = 0; i < LAYERS; i++) {
        apart = Math.max(apart, Math.abs(means[i] - means[0]));
      }
      result.settled = lastMean !== null && apart < CLOSE &&
        Math.abs(means[0] - lastMean) < CLOSE;
      result.daysRun = d;
      result.hottest = hottest;
      result.coldest = coldest;
      result.mean = means[0];
      result.turns = turns;
      lastMean = means[0];
      if (!result.settled) for (i = 0; i < LAYERS; i++) T[i] += means[0] - means[i];
    }
    return result;
  }

  return {
    SUN: SUN, SIGMA: SIGMA, CONDUCTIVITY: CONDUCTIVITY,
    HEAT_CAPACITY: HEAT_CAPACITY, TOP: TOP, THICKER: THICKER, LAYERS: LAYERS,
    EARTH_DAY: EARTH_DAY, MOON_DAY: MOON_DAY, START: START, MOST_DAYS: MOST_DAYS,
    thicknesses: thicknesses, depths: depths, sunAngle: sunAngle,
    sunlight: sunlight, glow: glow, flow: flow, warming: warming,
    longestStep: longestStep, advance: advance, topLayer: topLayer, run: run
  };
});
