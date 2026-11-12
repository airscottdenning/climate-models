/* Layers model: panes of glass over black ground.
 *
 * Each pane lets Sunlight through and absorbs all the Earthlight that reaches
 * it. The ground is black: it takes in the Sunlight and the Earthlight that
 * come down to it. Everything glows as a black surface does, and each pane
 * glows from both of its sides. Nothing else moves heat. When every level
 * takes in as much as it emits, the temperatures stay put, and those are the
 * temperatures this file works out.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   sun      S: the Sunlight on a square meter that faces the Sun, in W/m²
 *   albedo   α: the share of the Sunlight that's reflected, 0 to 1
 *   panes    N: the number of panes
 *   k        k: a pane's number, counted from the top. Pane 1 is the top pane.
 *   q        Q: the Sunlight the ground takes in, in W/m²
 *   glow     E: the Earthlight a level emits, in W/m². A pane emits E from
 *            each of its two sides. The ground emits it from its top.
 *   kelvin   T: a level's temperature, in kelvins
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Layers = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUN = 1361;        // S: W/m², the book's solar constant (Chapter 2)
  var ALBEDO = 0.3;      // α: the Earth's albedo in the book (Chapter 3)
  var SIGMA = 5.67e-8;   // σ: W/m² per K⁴, the Stefan-Boltzmann constant
  var MOST_PANES = 10;   // the page draws every pane, and 10 still fit a phone

  /* Step 1. Q: the Sunlight the ground takes in, in W/m². A planet catches
   * Sunlight on a disk and has four times that area, and it reflects a share
   * α of what it catches. */
  function absorbed(sun, albedo) { return sun * (1 - albedo) / 4; }

  /* Step 2. E: the Earthlight a black surface at T emits, in W/m². */
  function glow(kelvin) { return SIGMA * Math.pow(kelvin, 4); }

  /* Step 3. E: what pane k emits from each side, in W/m². The top pane emits
   * Q, because the whole stack has to send out what it takes in. Each pane
   * emits Q more than the one above it, because a pane emits from two sides
   * what it takes in on two sides. */
  function paneGlow(k, q) { return k * q; }

  /* Step 4. E: what the ground under N panes emits, in W/m². It takes in the
   * Sunlight and what the lowest pane sends down. */
  function groundGlow(panes, q) { return (panes + 1) * q; }

  /* Step 5. T: the temperature of a black surface that emits E, in kelvins.
   * It's step 2 turned around. */
  function temperature(emitted) { return Math.pow(emitted / SIGMA, 0.25); }

  /* The whole stack, from the top pane down to the ground: what each level
   * emits, its temperature, and what it takes in. The page draws this and
   * prints it as a table.
   *
   * `fromAbove` and `fromBelow` are the Earthlight a level takes in from the
   * levels next to it. `toSpace` is the Earthlight that leaves the top. */
  function stack(panes, sun, albedo) {
    var q = absorbed(sun, albedo), levels = [];
    var ground = groundGlow(panes, q);
    for (var k = 1; k <= panes; k++) {
      levels.push({
        pane: k, glow: paneGlow(k, q), kelvin: temperature(paneGlow(k, q)),
        fromAbove: k > 1 ? paneGlow(k - 1, q) : 0,
        fromBelow: k < panes ? paneGlow(k + 1, q) : ground
      });
    }
    return {
      panes: panes, sun: sun, albedo: albedo,
      arriving: sun / 4,             // Sunlight, averaged over the planet
      absorbed: q,
      levels: levels,
      ground: { glow: ground, kelvin: temperature(ground), sunlight: q,
                fromAbove: panes ? paneGlow(panes, q) : 0 },
      toSpace: panes ? paneGlow(1, q) : ground
    };
  }

  return {
    SUN: SUN, ALBEDO: ALBEDO, SIGMA: SIGMA, MOST_PANES: MOST_PANES,
    absorbed: absorbed, glow: glow, paneGlow: paneGlow,
    groundGlow: groundGlow, temperature: temperature, stack: stack
  };
});
