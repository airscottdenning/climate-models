/* Ice ages: summer Sunlight, ice and carbon dioxide over a million years.
 *
 * A small model of the ice ages, by Talento and Ganopolski (2021). Earth's
 * orbit changes the summer Sunlight at 65 °N. The ice on land grows or melts,
 * the carbon dioxide in the air follows the temperature and the ice, and the
 * temperature follows the ice and the carbon dioxide. Each step is 1,000 years.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Years are in thousands, counted from now: -21 is 21,000 years ago.
 * Each name is followed by its letter on the About tab.
 *   p       p: the precession part of the summer Sunlight at 65 °N, in W/m²
 *   o       o: the tilt part of the same Sunlight, in W/m²
 *   F       F: how far the summer Sunlight is above its average, in W/m²
 *   v       v: the ice on land. 0 is today's, and 1 is the most there was in
 *           the last ice age, about 21,000 years ago.
 *   co2     C: the carbon dioxide in the air, in ppm
 *   T       T: the world's average temperature, in °C above preindustrial
 *   melted  m: how much v shrank in the step before (0 if it grew)
 *   memory  M: about the average of v over the last 30,000 years, while the
 *           ice is shrinking, and 0 while it's growing
 *   G       G: the ice's budget before the old ice is counted
 *   E       E: the fossil carbon put into the air now, in GtC
 *   A       A: the share of that carbon still in the air
 *   fossil  Cf: the fossil carbon dioxide still in the air, in ppm
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IceAges = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIRST = -999, LAST = 1000;    // the years in data.json
  var STILL = 30;                   // the first 30 years are held at the start:
  var START = { v: 0.05, co2: 300, T: 0 };

  // Talento and Ganopolski's best version of the model, to four figures.
  var TILT = 1.04;                  // step 1: the tilt part counts 4% extra
  var D1 = 3, D2 = 5.556;           // step 2
  var C1 = 17.28, C2 = 31.95, C3 = 120, C4 = 278;   // step 3, ppm
  var LOWEST = 150;                 // ppm: the carbon dioxide never goes lower
  var B1 = 0.2196, B2 = 0.2874, B3 = 0.0008, B4 = 0.09525;   // step 4
  var B5 = 0.1841, B6 = 0.5260;
  var MEMORY = 30;                  // thousands of years of old ice
  var EARLY = -410, EARLY_ICE = 0.05;   // before 410,000 years ago, v >= 0.05
  var PPM_PER_GTC = 0.469;          // step 5

  // Step 5, from Lord et al. (2016): five parts of a pulse of fossil carbon,
  // each fading from the air at its own pace. A part's share a and its time
  // τ (in years) change a little with the size of the pulse, E in GtC:
  //   a = α + β1 E + β2 E² + β3 E³     τ = γ + δ1 E + δ2 E² + δ3 E³
  // The numbers are their Table S3. Talento and Ganopolski's code has
  // −6.15e-8 for part 2's δ2, which makes no difference to the runs.
  var PARTS = [
    // α      β1        β2         β3         γ       δ1        δ2        δ3
    [0.253, -4.63e-5, 3.44e-9, -8.42e-14, 6.28, -1.05e-3, 6.9e-8, -1.49e-12],
    [0.245, -3.54e-5, 2.40e-9, -5.57e-14, 58.7, -2.99e-3, 6.15e-8, 1.69e-12],
    [0.312, 5.00e-5, -5.87e-9, 1.65e-13, 112.6, 0.121, -7.87e-6, 1.86e-10],
    [0.079, 3.96e-5, -4.83e-10, -1.46e-14, 2780, 0.816, 6.29e-6, -7.27e-10],
    [0.075, -8.57e-7, 5.89e-11, -1.15e-15, 246294, 0.450, 2.55e-4, -9.69e-9]
  ];

  /* Step 1. F: how far the summer Sunlight is above its average. The orbit
   * can hold one part at its average: 'tilt' keeps only the tilt part, and
   * 'precession' only the precession part. */
  function sunlight(p, o, data, orbit) {
    var fromP = orbit === 'tilt' ? 0 : p - data.pMean;
    var fromO = orbit === 'precession' ? 0 : TILT * (o - data.oMean);
    return fromP + fromO;
  }

  /* Step 2. T: the temperature, from the ice and the carbon dioxide. */
  function temperature(v, co2) {
    return -D1 * v + D2 * Math.log(co2 / C4);
  }

  /* Step 3. C: the carbon dioxide, from the temperature, the ice, the ice
   * that just melted and any fossil carbon dioxide. */
  function carbonDioxide(T, v, melted, fossil) {
    return Math.max(C1 * T - C2 * v + C3 * melted + C4 + fossil, LOWEST);
  }

  /* Step 4. G: the ice's budget before the old ice is counted, and Δv: how
   * much v changes in 1,000 years. `old` is 0.1841, or 0 with the old-ice
   * switch off. */
  function budget(v, F, co2) {
    return B1 * v - B2 * Math.pow(v, 1.5) - B3 * F - B4 * Math.log(co2);
  }
  function iceChange(v, F, co2, memory, old) {
    return budget(v, F, co2) / (1 - old * memory) + B6;
  }

  /* M, for step 4: the ice in the 30 steps before step k, added up the way a
   * trapezoid adds up an area (the first and the last count half), over 30. */
  function memoryAt(v, k) {
    var sum = (v[k - MEMORY] + v[k - 1]) / 2;
    for (var j = k - MEMORY + 1; j < k - 1; j++) sum += v[j];
    return sum / MEMORY;
  }

  /* Step 5. A: the share of a pulse of E GtC still in the air `years`
   * thousand years after it, and Cf: the fossil carbon dioxide, in ppm. */
  function stillInAir(E, years) {
    var A = 0;
    PARTS.forEach(function (q) {
      var a = q[0] + q[1] * E + q[2] * E * E + q[3] * E * E * E;
      var tau = q[4] + q[5] * E + q[6] * E * E + q[7] * E * E * E;
      A += a * Math.exp(-years * 1000 / tau);
    });
    return A;
  }
  function fossilCO2(E, years) {
    return E > 0 && years >= 0 ? PPM_PER_GTC * E * stillInAir(E, years) : 0;
  }

  /* The whole run, from 999,000 years ago to 1,000,000 years from now.
   * `data` is data.json. The options are the page's controls:
   *   fossil      E, in GtC, put into the air now (0 unless given)
   *   co2Follows  false holds the carbon dioxide at 278 ppm, plus any fossil
   *   oldIce      false turns off the faster melting of old ice
   *   orbit       'both' (as it was), 'tilt' or 'precession'
   * Each step uses the numbers from the end of the step before. */
  function run(data, options) {
    options = options || {};
    var E = options.fossil || 0, follows = options.co2Follows !== false;
    var old = options.oldIce === false ? 0 : B5;
    var orbit = options.orbit || 'both';
    var n = LAST - FIRST + 1, k;
    var r = { year: [], F: [], f: [], v: [], co2: [], T: [], fossil: [] };
    for (k = 0; k < n; k++) {
      r.year.push(FIRST + k);
      r.F.push(sunlight(data.p[k], data.o[k], data, orbit));
      r.f.push(data.pMean + r.F[k]);     // the Sunlight the model uses
      r.fossil.push(fossilCO2(E, r.year[k]));
    }
    for (k = 0; k < STILL; k++) {
      r.v.push(START.v); r.co2.push(follows ? START.co2 : C4); r.T.push(START.T);
    }
    for (k = STILL; k < n; k++) {
      var v = r.v[k - 1], change = v - r.v[k - 2];
      var melted = change < 0 ? -change : 0;
      r.T.push(temperature(v, r.co2[k - 1]));
      r.co2.push(follows ? carbonDioxide(r.T[k], v, melted, r.fossil[k])
                         : C4 + r.fossil[k]);
      var memory = change < 0 ? memoryAt(r.v, k) : 0;
      var lowest = r.year[k] < EARLY ? EARLY_ICE : 0;
      var next = v + iceChange(v, r.F[k - 1], r.co2[k - 1], memory, old);
      r.v.push(Math.max(next, lowest));
    }
    return r;
  }

  /* Where `year` is in a run. */
  function at(r, year) { return year - FIRST; }

  /* The first year from `from` on when v is above `level`, or null. */
  function firstAbove(r, level, from) {
    for (var k = at(r, from); k < r.v.length; k++) {
      if (r.v[k] > level) return r.year[k];
    }
    return null;
  }

  /* How closely two lists rise and fall together: 1 if exactly, 0 if not at
   * all (Pearson's correlation). */
  function correlation(a, b) {
    var n = a.length, ma = 0, mb = 0, sab = 0, saa = 0, sbb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i] / n; mb += b[i] / n; }
    for (i = 0; i < n; i++) {
      sab += (a[i] - ma) * (b[i] - mb);
      saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb);
    }
    return sab / Math.sqrt(saa * sbb);
  }

  return {
    FIRST: FIRST, LAST: LAST, STILL: STILL, START: START, TILT: TILT,
    D1: D1, D2: D2, C1: C1, C2: C2, C3: C3, C4: C4, LOWEST: LOWEST,
    B1: B1, B2: B2, B3: B3, B4: B4, B5: B5, B6: B6, MEMORY: MEMORY,
    EARLY: EARLY, EARLY_ICE: EARLY_ICE, PPM_PER_GTC: PPM_PER_GTC, PARTS: PARTS,
    sunlight: sunlight, temperature: temperature, carbonDioxide: carbonDioxide,
    budget: budget, iceChange: iceChange, memoryAt: memoryAt,
    stillInAir: stillInAir, fossilCO2: fossilCO2, run: run, at: at,
    firstAbove: firstAbove, correlation: correlation
  };
});
