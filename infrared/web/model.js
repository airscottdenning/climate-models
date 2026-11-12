/* Infrared model: the Earthlight leaving the top of the atmosphere, for the
 * air you choose.
 *
 * This file doesn't work out how air absorbs and gives off Earthlight. That
 * takes a research model and a big computer. It was done ahead of time, with
 * a model called ARTS, for 45 mixes of gases in each of two columns of air.
 * The answers are in tables.bin. This file looks an answer up, and fills in
 * smoothly between the mixes that were calculated.
 *
 * These are the equations on the page's About tab. There's no drawing and no
 * page code here, so the same file runs in a browser and in Node (for the
 * tests). Each name is followed by its letter on the About tab.
 *   um       λ: wavelength, in micrometers (µm)
 *   kelvin   T: temperature, in kelvins
 *   u        u: c₂ / (λT), a number with no units
 *   glow     B: brightness at one wavelength, straight up,
 *            in W/m² per steradian per µm
 *   amount   C: how much of a gas is in the air
 *   x        x: that amount, counted in doublings from today's
 *   ys       y₀, y₁ …: one number from the tables, at each calculated amount
 *   a, b     a, b: the slopes of the straight lines between those numbers
 *   gap      h: the distance between two calculated amounts
 *   t        t: how far along you are between them
 *   slope()  d: the slope of the curve at a calculated amount
 *   s        s: the share of the way from y₀ to y₁
 *   bend     q: how much the curve bends between them
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Infrared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C1 = 1.191043e8;   // c₁, in W µm⁴ per m² per steradian
  var C2 = 14387.77;     // c₂, in µm K
  var POINTS = 2000;     // wavelengths in each spectrum, from 4 to 30 µm
  // Today's air. Water is a multiple of the column's usual humidity.
  var TODAY = { co2: 420, ch4: 1900, water: 1 };
  var TOTALS = ['top', 'sky', 'net'];   // the three totals, as tables.bin has them

  /* Step 1 on the About tab. B: how brightly a black surface at temperature T
   * glows at wavelength λ. */
  function planck(um, kelvin) {
    var u = C2 / (um * kelvin);
    return C1 / (Math.pow(um, 5) * Math.expm1(u));   // expm1(u) is eᵘ − 1
  }

  /* Step 2. T: the temperature of the black surface that would glow this
   * brightly at this wavelength. It's step 1 turned around. */
  function brightnessTemperature(um, glow) {
    // log1p(v) is ln(1 + v)
    return C2 / (um * Math.log1p(C1 / (Math.pow(um, 5) * glow)));
  }

  /* Step 3. x: how many times you'd double today's amount to get this one.
   * Half of today's amount is -1. */
  function doublings(amount, today) {
    return Math.log(amount / today) / Math.LN2;
  }

  /* Step 4. Where x falls among the calculated amounts xs: between number k
   * and number k + 1, a fraction t of the way along. */
  function place(xs, x) {
    var last = xs.length - 1;
    if (!(x >= xs[0] - 1e-9 && x <= xs[last] + 1e-9)) {
      throw new RangeError('outside the amounts that were calculated');
    }
    var k = 0;
    while (k < last - 1 && xs[k + 1] < x) k++;
    var gap = xs[k + 1] - xs[k];
    return { k: k, gap: gap, t: Math.min(1, Math.max(0, (x - xs[k]) / gap)) };
  }

  /* Step 5. d: the slope of the curve at calculated amount number i. */
  function slope(xs, ys, i) {
    var last = xs.length - 1, a, b, gapA, gapB, d;
    // The slope of the straight line from amount j to amount j + 1.
    function line(j) { return (ys[j + 1] - ys[j]) / (xs[j + 1] - xs[j]); }
    if (last === 1) return line(0);
    if (i > 0 && i < last) {
      // In the middle: a is the line that arrives, b the line that leaves.
      a = line(i - 1); b = line(i);
      if (a * b <= 0) return 0;   // a peak or a dip, so the curve is level
      gapA = xs[i] - xs[i - 1]; gapB = xs[i + 1] - xs[i];
      // With even gaps this is 2ab / (a + b). Uneven gaps are weighed.
      return 3 * (gapA + gapB) / ((gapA + 2 * gapB) / a + (2 * gapA + gapB) / b);
    }
    // At an end: a is the line that touches it, b the next line in.
    a = line(i === 0 ? 0 : last - 1); b = line(i === 0 ? 1 : last - 2);
    gapA = i === 0 ? xs[1] - xs[0] : xs[last] - xs[last - 1];
    gapB = i === 0 ? xs[2] - xs[1] : xs[last - 1] - xs[last - 2];
    // With even gaps this is (3a − b) / 2.
    d = ((2 * gapA + gapB) * a - gapA * b) / (gapA + gapB);
    if (d * a <= 0) return 0;       // never tilt against the line it touches
    if (a * b <= 0 && Math.abs(d) > 3 * Math.abs(a)) return 3 * a;
    return d;
  }

  /* Step 6. y: the smooth curve through the calculated values ys, read at the
   * place that place() found. It passes through every calculated value, and
   * between two of them it never goes above or below both. */
  function curve(xs, ys, at) {
    var k = at.k, t = at.t;
    var s = t * t * (3 - 2 * t);   // the share of the way from y₀ to y₁
    var bend = (1 - t) * slope(xs, ys, k) - t * slope(xs, ys, k + 1);
    return ys[k] + s * (ys[k + 1] - ys[k]) + at.gap * t * (1 - t) * bend;
  }

  /* Step 7. Three gases at once. A table is a block of numbers with three
   * sides: CO₂, methane and water vapor. Fill in along water vapor first, then
   * along methane, then along CO₂. `width` is how many numbers each mix has. */
  function fill(sky, table, width, co2, ch4, water) {
    var atC = place(sky.xCo2, doublings(co2, TODAY.co2));
    var atM = place(sky.xCh4, doublings(ch4, TODAY.ch4));
    var atW = place(sky.water, water);
    var nC = sky.xCo2.length, nM = sky.xCh4.length, nW = sky.water.length;
    var byC = new Array(nC), byM = new Array(nM), byW = new Array(nW);
    var out = new Float64Array(width);
    for (var p = 0; p < width; p++) {
      for (var c = 0; c < nC; c++) {
        for (var m = 0; m < nM; m++) {
          for (var w = 0; w < nW; w++) {
            byW[w] = table[((c * nM + m) * nW + w) * width + p];
          }
          byM[m] = curve(sky.water, byW, atW);
        }
        byC[c] = curve(sky.xCh4, byM, atM);
      }
      out[p] = curve(sky.xCo2, byC, atC);
    }
    return out;
  }

  /* The Earthlight leaving the top of the atmosphere, straight up, at each of
   * the 2,000 wavelengths. co2 is in parts per million, ch4 in parts per
   * billion, and water is a multiple of the column's usual humidity. `sky` is
   * one column of air from tables(). */
  function spectrum(sky, co2, ch4, water) {
    return fill(sky, sky.spectra, POINTS, co2, ch4, water);
  }

  /* The three totals, over all wavelengths and all directions, in W/m²:
   *   top  Earthlight leaving the top of the atmosphere
   *   sky  Earthlight from the sky that reaches the surface
   *   net  what the surface loses: its own glow, less what the sky sends down */
  function totals(sky, co2, ch4, water) {
    var out = fill(sky, sky.totals, TOTALS.length, co2, ch4, water);
    return { top: out[0], sky: out[1], net: out[2] };
  }

  /* Read tables.bin (an ArrayBuffer) with tables.json (already parsed).
   * build_data.py says what's in them and in what order. The far-out cases
   * are single spectra, shown as they are: nothing is filled in around them. */
  function tables(buffer, meta) {
    var all = new Float32Array(buffer), next = meta.points, skies = {};
    if (all.length !== meta.floats || meta.points !== POINTS) {
      throw new Error('tables.bin and tables.json do not match');
    }
    function take(count) { next += count; return all.subarray(next - count, next); }
    function toX(amounts, today) {
      return amounts.map(function (amount) { return doublings(amount, today); });
    }
    meta.skies.forEach(function (s) {
      var mixes = s.co2.length * s.ch4.length * s.water.length;
      var sky = { id: s.id, label: s.label, surfaceK: s.surfaceK,
        surfaceGlow: s.surfaceGlow, co2: s.co2, ch4: s.ch4, water: s.water,
        xCo2: toX(s.co2, TODAY.co2), xCh4: toX(s.ch4, TODAY.ch4) };
      sky.spectra = take(mixes * POINTS);
      sky.totals = take(mixes * TOTALS.length);
      sky.cases = s.cases.map(function (c) {
        return { id: c.id, co2: c.co2, ch4: c.ch4, water: 1,
          spectrum: take(POINTS) };
      });
      skies[s.id] = sky;
    });
    return { version: meta.version, wavelengths: all.subarray(0, POINTS),
      skies: skies, order: meta.skies.map(function (s) { return s.id; }) };
  }

  return {
    C1: C1, C2: C2, POINTS: POINTS, TODAY: TODAY,
    planck: planck, brightnessTemperature: brightnessTemperature,
    doublings: doublings, place: place, slope: slope, curve: curve,
    spectrum: spectrum, totals: totals, tables: tables
  };
});
