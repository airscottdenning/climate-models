/* Learning beats digging: what happens to a price each time the world doubles
 * all it has ever made of something.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 * The data (data.json) are Figures 12.4 and 12.16 of the book.
 *
 * Each name is followed by its letter on the About tab.
 *   made     X: all of it ever made (or produced, or installed), to that year
 *   price    P: its price that year, after inflation
 *   n        n: how many times X has doubled since the first year
 *   a, b     a, b: the straight line through the points on a log-log graph
 *   rate     L: how much the price falls with each doubling (0.2 is 20%)
 *   N        N: doublings still to come
 *   g        g: how fast X grew each year over the last five years
 *   T        T: the years N more doublings take at that speed
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Learning = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SPAN = 5;   // years: today's growth is the average over the last five

  /* Step 1. n: how many times X has doubled since X0. */
  function doublings(X, X0) { return Math.log(X / X0) / Math.LN2; }

  /* Step 2. a and b: the straight line ln P = a + b ln X that comes closest
   * to every year's point (a least-squares fit). */
  function fit(made, price) {
    var k = made.length, mx = 0, my = 0, top = 0, bottom = 0, i;
    for (i = 0; i < k; i++) {
      mx += Math.log(made[i]) / k; my += Math.log(price[i]) / k;
    }
    for (i = 0; i < k; i++) {
      var dx = Math.log(made[i]) - mx;
      top += dx * (Math.log(price[i]) - my); bottom += dx * dx;
    }
    var b = top / bottom;
    return { a: my - b * mx, b: b };
  }

  /* Step 3. L: each doubling multiplies the price by 2 to the power b. */
  function learning(b) { return 1 - Math.pow(2, b); }

  /* Step 4. The price after N more doublings, falling by L each time. */
  function ahead(P, rate, N) { return P * Math.pow(1 - rate, N); }

  /* Step 5. g: the average yearly growth of X over the last five years. */
  function growth(made) {
    var k = made.length - 1;
    return Math.pow(made[k] / made[k - SPAN], 1 / SPAN) - 1;
  }

  /* Step 6. T: the years N doublings take, growing by g a year. */
  function years(N, g) { return N * Math.LN2 / Math.log(1 + g); }

  /* Everything the learning view shows for one curve, a chosen rate and N. */
  function run(curve, rate, N) {
    var k = curve.made.length - 1, line = fit(curve.made, curve.price);
    var own = learning(line.b), g = growth(curve.made), P = curve.price[k];
    return {
      first: { year: curve.year[0], made: curve.made[0], price: curve.price[0] },
      last: { year: curve.year[k], made: curve.made[k], price: P },
      n: doublings(curve.made[k], curve.made[0]),
      times: curve.price[0] / P,
      a: line.a, b: line.b, own: own,
      g: g, perDoubling: years(1, g),
      N: N, rate: rate,
      atOwn: ahead(P, own, N), atRate: ahead(P, rate, N),
      madeThen: curve.made[k] * Math.pow(2, N),
      T: years(N, g)
    };
  }

  /* The first year a series is below a value and stays below. */
  function staysBelow(year, values, level) {
    for (var i = 0; i < values.length; i++) {
      var after = values.slice(i).every(function (v) { return v < level; });
      if (after) return year[i];
    }
    return null;
  }

  /* The cost view: how far solar and wind fell, and when each went below
   * the cheapest new fossil-fuel plants. */
  function costs(c) {
    var k = c.year.length - 1;
    return {
      solar: { first: c.solar[0], last: c.solar[k], times: c.solar[0] / c.solar[k],
               below: staysBelow(c.year, c.solar, c.fossil[0]) },
      wind: { first: c.wind[0], last: c.wind[k], times: c.wind[0] / c.wind[k],
              below: staysBelow(c.year, c.wind, c.fossil[0]) },
      fossil: c.fossil
    };
  }

  return {
    SPAN: SPAN, doublings: doublings, fit: fit, learning: learning,
    ahead: ahead, growth: growth, years: years, run: run,
    staysBelow: staysBelow, costs: costs
  };
});
