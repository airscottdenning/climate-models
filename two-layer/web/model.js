/* Two-layer model: black ground under two layers of air that leak and are
 * stirred.
 *
 * The air lets Sunlight through. Each layer absorbs a share of the Earthlight
 * that reaches it and lets the rest pass straight through: that's the leak.
 * Rising air carries heat up from the ground into the lower layer, and from
 * the lower layer into the upper layer: that's the stirring. Each layer glows
 * from both of its sides, as strongly as it absorbs. When every level takes
 * in as much as it gives off, the temperatures stay put, and those are the
 * temperatures this file works out.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab. The layers are
 * numbered from the top: layer 1 is the upper layer and layer 2 is the lower.
 *   sun       S: the Sunlight on a square meter that faces the Sun, in W/m²
 *   albedo    α: the share of the Sunlight that's reflected, 0 to 1
 *   share1    ε₁: the share of the Earthlight that the upper layer absorbs
 *   share2    ε₂: the share that the lower layer absorbs, 0.01 to 1
 *   carriedG  C with a g: the heat rising air carries from the ground into
 *             the lower layer, in W/m²
 *   carried2  C₂: the heat rising air carries from the lower layer into the
 *             upper layer, in W/m²
 *   q         Q: the Sunlight the ground takes in, in W/m²
 *   glow      E: the Earthlight a level emits, in W/m². A layer emits E from
 *             each of its two sides. The ground emits it from its top.
 *   up        U: the Earthlight that comes up to the upper layer, in W/m²
 *   kelvin    T: a level's temperature, in kelvins
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TwoLayer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUN = 1361;        // S: W/m², the book's solar constant (Chapter 2)
  var ALBEDO = 0.3;      // α: the Earth's albedo in the book (Chapter 3)
  var SIGMA = 5.67e-8;   // σ: W/m² per K⁴, the Stefan-Boltzmann constant
  var LEAST_SHARE = 0.01;   // a layer that absorbs nothing has no temperature

  /* Step 1. Q: the Sunlight the ground takes in, in W/m². A planet catches
   * Sunlight on a disk and has four times that area, and it reflects a share
   * α of what it catches. */
  function absorbed(sun, albedo) { return sun * (1 - albedo) / 4; }

  /* Step 2. E: the Earthlight a level at T emits, in W/m². A layer that
   * absorbs a share ε of the Earthlight emits ε times what a black surface
   * would. Leave the share out for the ground, which is black. */
  function glow(kelvin, share) {
    return (share === undefined ? 1 : share) * SIGMA * Math.pow(kelvin, 4);
  }

  /* Step 3. E: what the upper layer emits from each side, in W/m². Two
   * budgets give it: the whole stack sends out the Q it takes in, and the
   * layer emits from two sides what it absorbs and what rising air brings. */
  function upperGlow(q, share1, carried2) {
    return (share1 * q + (1 - share1) * carried2) / (2 - share1);
  }

  /* Step 4. U: the Earthlight that comes up to the upper layer, in W/m².
   * Between the layers, what goes up (U and the rising air's heat) equals
   * what comes down (the Sunlight and the upper layer's glow). */
  function reaching(q, glow1, carried2) { return q + glow1 - carried2; }

  /* Step 5. E: what the ground emits, in W/m². It takes in the Sunlight and
   * the Earthlight that comes down to it, and what rising air carries away
   * it doesn't have to emit. */
  function groundGlow(q, glow1, share2, carriedG, carried2) {
    return glow1 + (2 * q - carriedG - carried2) / (2 - share2);
  }

  /* Step 6. E: what the lower layer emits from each side, in W/m². It's U
   * less the part of the ground's Earthlight that passes through the layer. */
  function lowerGlow(up, glowG, share2) { return up - (1 - share2) * glowG; }

  /* Step 7. T: the temperature of a level that emits E, in kelvins. It's
   * step 2 turned around. Leave the share out for the ground. */
  function temperature(emitted, share) {
    return Math.pow(emitted / ((share === undefined ? 1 : share) * SIGMA), 0.25);
  }

  /* What's wrong with a set of choices, in words, or nothing if they're
   * within the model's limits. Inside the limits every level emits more than
   * nothing, so every level has a temperature. */
  function trouble(sun, albedo, share1, share2, carriedG, carried2) {
    var q = absorbed(sun, albedo);
    if (!(sun > 0) || !(albedo >= 0 && albedo < 1)) {
      return 'the Sunlight must be more than 0 and the albedo from 0 to under 1';
    }
    if (!(share1 >= LEAST_SHARE && share1 <= 1 &&
          share2 >= LEAST_SHARE && share2 <= 1)) {
      return 'each layer must absorb a share from ' + LEAST_SHARE + ' to 1';
    }
    if (!(carriedG >= 0 && carriedG <= q)) {
      return 'rising air can carry from the ground no less than 0 and no ' +
        'more than the Sunlight the ground takes in';
    }
    if (!(carried2 >= 0 && carried2 <= carriedG)) {
      return 'rising air can carry from the lower layer no less than 0 and ' +
        'no more than it carries from the ground';
    }
    return '';
  }

  /* The whole column, from the top down: what each level emits, its
   * temperature, and every flow between the levels. The page draws this and
   * prints it as a table. Every flow is in W/m².
   *
   * In `upper`, `lower` and `ground`, each name that starts with `from` is
   * something the level takes in. `passes` is the Earthlight a layer lets
   * straight through, by where it came from. `toSpace` is the Earthlight
   * that leaves the top, by where it came from. */
  function column(sun, albedo, share1, share2, carriedG, carried2) {
    var wrong = trouble(sun, albedo, share1, share2, carriedG, carried2);
    if (wrong) throw new RangeError(wrong);
    var q = absorbed(sun, albedo);
    var glow1 = upperGlow(q, share1, carried2);
    var up = reaching(q, glow1, carried2);
    var glowG = groundGlow(q, glow1, share2, carriedG, carried2);
    var glow2 = lowerGlow(up, glowG, share2);
    var throughLower = (1 - share2) * glowG;      // the ground's, above layer 2
    return {
      sun: sun, albedo: albedo,
      arriving: sun / 4,             // Sunlight, averaged over the planet
      absorbed: q,
      reaching: up,
      upper: {
        share: share1, glow: glow1, kelvin: temperature(glow1, share1),
        fromGround: share1 * throughLower, fromLower: share1 * glow2,
        fromAir: carried2,
        passes: { ground: (1 - share1) * throughLower,
                  lower: (1 - share1) * glow2 }
      },
      lower: {
        share: share2, glow: glow2, kelvin: temperature(glow2, share2),
        fromGround: share2 * glowG, fromUpper: share2 * glow1,
        fromAir: carriedG, toAir: carried2,
        passes: { ground: throughLower, upper: (1 - share2) * glow1 }
      },
      ground: {
        glow: glowG, kelvin: temperature(glowG), sunlight: q,
        fromLower: glow2, fromUpper: (1 - share2) * glow1, toAir: carriedG
      },
      toSpace: {
        ground: (1 - share1) * throughLower, lower: (1 - share1) * glow2,
        upper: glow1,
        all: (1 - share1) * throughLower + (1 - share1) * glow2 + glow1
      }
    };
  }

  return {
    SUN: SUN, ALBEDO: ALBEDO, SIGMA: SIGMA, LEAST_SHARE: LEAST_SHARE,
    absorbed: absorbed, glow: glow, upperGlow: upperGlow, reaching: reaching,
    groundGlow: groundGlow, lowerGlow: lowerGlow, temperature: temperature,
    trouble: trouble, column: column
  };
});
