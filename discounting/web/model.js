/* Discounting model: what climate damage that slows growth is worth today.
 *
 * The world's income grows a little more slowly in a hotter world than in a
 * cooler one. Each year's gap between the two is that year's damage. The model
 * discounts each year's damage back to today and adds them all up.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab. Rates are fractions
 * a year (0.025 is 2.5% a year), and money is in trillions of dollars.
 *   income   G0: the world's income this year, in trillion dollars a year
 *   cool     r_cool: how fast income grows if climate change is avoided
 *   hot      r_hot: how fast it grows in the hotter world
 *   disc     r_disc: the discount rate
 *   t        t: years from now
 *   years    T: how many years the model adds up
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Discounting = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Step 1. G: the world's income t years from now, growing at a steady
   * rate, in trillion dollars a year. */
  function income(t, rate, income0) { return income0 * Math.exp(rate * t); }

  /* Step 2. D: the damage in year t, the gap between the cooler world's
   * income and the hotter world's. */
  function damage(t, cool, hot, income0) {
    return income(t, cool, income0) - income(t, hot, income0);
  }

  /* Step 2, again. s: the share of the cooler world's income that the hotter
   * world doesn't have in year t. */
  function shortfall(t, cool, hot) { return 1 - Math.exp((hot - cool) * t); }

  /* Step 3. P: what the damage in year t is worth today, discounted at the
   * rate disc. */
  function presentValue(t, cool, hot, disc, income0) {
    return damage(t, cool, hot, income0) * Math.exp(-disc * t);
  }

  /* Step 4, one piece of it: e^(a t) added up smoothly over the years from
   * 0 to T (an integral), which is (e^(a T) − 1) / a. When a is 0 every year
   * adds 1, so the total is T. Math.expm1(x) is e^x − 1, worked out without
   * losing digits when x is small. */
  function grown(a, years) {
    return a === 0 ? years : Math.expm1(a * years) / a;
  }

  /* Step 4. V: every year's damage from now to T years from now, discounted
   * to today and added up. With disc = 0 it's the damage not discounted. */
  function total(years, cool, hot, disc, income0) {
    return income0 * (grown(cool - disc, years) - grown(hot - disc, years));
  }

  /* Everything the page draws, a year at a time from 0 to T. */
  function run(choice) {
    var cool = choice.cool, hot = choice.cool - choice.penalty;
    var disc = choice.disc, g0 = choice.income, years = choice.years;
    var out = { cool: cool, hot: hot, disc: disc, income: g0, years: years,
      t: [], gCool: [], gHot: [], damage: [], value: [], soFar: [] };
    for (var t = 0; t <= years; t++) {
      out.t.push(t);
      out.gCool.push(income(t, cool, g0));
      out.gHot.push(income(t, hot, g0));
      out.damage.push(damage(t, cool, hot, g0));
      out.value.push(presentValue(t, cool, hot, disc, g0));
      out.soFar.push(total(t, cool, hot, disc, g0));
    }
    out.notDiscounted = total(years, cool, hot, 0, g0);
    out.discounted = total(years, cool, hot, disc, g0);
    out.lastShortfall = shortfall(years, cool, hot);
    var peak = 0;
    for (t = 1; t <= years; t++) if (out.value[t] > out.value[peak]) peak = t;
    out.peak = peak;
    return out;
  }

  return {
    income: income, damage: damage, shortfall: shortfall,
    presentValue: presentValue, grown: grown, total: total, run: run
  };
});
