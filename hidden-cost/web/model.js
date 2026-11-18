/* The hidden cost: a market for a fuel, the harm its smoke does to other
 * people, and a price on that harm.
 *
 * These are the equations on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * The market is made up. Its two straight lines are chosen so the numbers are
 * easy to follow with a calculator, not to match any real fuel.
 *
 * Each name is followed by its letter on the About tab.
 *   harm     E: the cost that falls on other people, in $ for each ton burned
 *   price    t: the price on the pollution, in $ for each ton burned
 *   Q        Q: the fuel burned, in millions of tons a year
 *   paid     P: the price the buyer pays, in $ a ton
 *   kept     s: what the seller keeps, in $ a ton
 *   H        H: the harm to other people, in millions of $ a year
 *   lost     L: how much smaller the pie is than it could be, in millions of
 *               $ a year
 *   best     Q*: the amount that makes the pie as big as it can be
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HiddenCost = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The made-up market. Prices are in $ a ton; amounts in millions of tons.
  var A = 130, B = 0.5;   // demand: buyers would pay A for the first ton, and
                          // B less for each million tons after it
  var C = 50, D = 0.3;    // supply: sellers' cost is C for the first ton, and
                          // D more for each million tons after it

  /* Step 1. Demand: what buyers will pay for one more ton when Q are
   * already burned. */
  function demand(Q) { return A - B * Q; }

  /* Step 2. Supply: what one more ton costs the seller to dig and ship, the
   * private cost. */
  function supply(Q) { return C + D * Q; }

  /* Step 3. The social cost of one more ton: the seller's cost plus the harm
   * that falls on other people. */
  function social(Q, harm) { return supply(Q) + harm; }

  /* Step 4. Q: the market settles where buyers will pay what sellers need,
   * plus the price on the pollution: A - B Q = C + D Q + t. */
  function burned(price) { return Math.max(0, (A - C - price) / (B + D)); }

  /* Step 5. H: the harm to other people, for each ton burned. */
  function harmDone(harm, Q) { return harm * Q; }

  /* Step 6. Q* and L: the pie is biggest where demand meets the social cost,
   * at Q*. Burn more or less than that, and the pie shrinks by a triangle. */
  function best(harm) { return Math.max(0, (A - C - harm) / (B + D)); }
  function lost(harm, Q) {
    var gap = Q - best(harm);
    return (B + D) * gap * gap / 2;
  }

  /* Everything the page shows, for one set of choices. Money is in millions
   * of dollars a year; the page writes it in billions. */
  function run(harm, price) {
    var Q = burned(price), Q1 = burned(0);
    var paid = demand(Q), kept = paid - price;
    return {
      Q: Q, Q1: Q1, P1: demand(Q1), paid: paid, kept: kept,
      fewer: Q1 - Q,
      fuelBill: kept * Q,               // paid to the sellers
      priceMoney: price * Q,            // the price on the pollution brings in
      H: harmDone(harm, Q),
      avoided: harmDone(harm, Q1 - Q),
      best: best(harm), bestPrice: demand(best(harm)),
      L: lost(harm, Q)
    };
  }

  return {
    A: A, B: B, C: C, D: D,
    demand: demand, supply: supply, social: social, burned: burned,
    harmDone: harmDone, best: best, lost: lost, run: run
  };
});
