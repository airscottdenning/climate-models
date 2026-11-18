/* Grid model: keep the lights on for a whole year, hour by hour, with the
 * Sun, the wind, batteries, demand that can wait, a wire to a neighbor and
 * clean firm power.
 *
 * These are the steps on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab. Power is in
 * gigawatts (GW); energy in gigawatt-hours (GWh). One hour at 1 GW is 1 GWh.
 *   sunGW   Ps: the solar panels built, in GW
 *   windGW  Pw: the wind turbines built, in GW
 *   cs, cw  cs, cw: the capacity factors of the Sun and the wind this hour
 *   far     f: the share of the solar and wind built in the neighbor's
 *           weather and wired in (0 or 0.5)
 *   firmGW  F: clean firm power, running every hour, in GW
 *   wait    w: the share of each day's use that can wait, from 0 to 1
 *   store   E: the batteries' energy, in GWh; their power is E/4 in GW
 *   D       D: what people use this hour, in GW
 *   C       C: the clean power made this hour, in GW
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Grid = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOURS_OF_STORAGE = 4;     // a battery's energy is 4 hours of its power

  /* The year's hours for one grid, unpacked from data.json: demand in GW,
   * and the Sun's and the wind's capacity factors from 0 to 1. */
  function unpack(grid) {
    return {
      demand: grid.demand.map(function (d) { return d / 100; }),
      sun: grid.sun.map(function (c) { return c / 1000; }),
      wind: grid.wind.map(function (c) { return c / 1000; })
    };
  }

  /* Step 1. cs and cw: how hard the Sun and the wind work this hour. With
   * a share f built far away, it's a mix of the two places' weather. */
  function factor(here, there, f) { return (1 - f) * here + f * there; }

  /* Step 2. C: the clean power made this hour. */
  function clean(sunGW, cs, windGW, cw, firmGW) {
    return sunGW * cs + windGW * cw + firmGW;
  }

  /* Step 3. D: what people use this hour, after the share w of the day's
   * use that can wait has moved to the day's hours with the most spare
   * clean power. `day` is the day's 24 hours of use, `spare` the clean
   * power left over in each hour once the rest of the use is met. */
  function shifted(day, spare, wait) {
    var moved = 0, room = 0, k;
    for (k = 0; k < day.length; k++) {
      moved += wait * day[k];
      room += Math.max(0, spare[k]);
    }
    var out = [];
    for (k = 0; k < day.length; k++) {
      // The use that can wait goes where the spare power is, in proportion
      // to it, as far as there's room. Whatever doesn't fit stays where it
      // was.
      var share = room > 0 ? Math.max(0, spare[k]) / room : 0;
      var fits = Math.min(moved, room);
      out.push((1 - wait) * day[k] + fits * share +
               (moved - fits) * (moved > 0 ? wait * day[k] / moved : 0));
    }
    return out;
  }

  /* Step 4. The batteries, the surplus and the shortfall, for one hour.
   * Clean power C meets use D. A surplus charges the batteries, as fast as
   * their power allows and until they're full; the rest is thrown away. A
   * gap is filled from the batteries, as fast as their power allows and
   * until they're empty; the rest is a shortfall. `held` is the energy in
   * the batteries at the start of the hour. */
  function hour(C, D, held, store) {
    var power = store / HOURS_OF_STORAGE, out = { charge: 0, give: 0,
      thrown: 0, short: 0 };
    if (C >= D) {
      out.charge = Math.min(C - D, power, store - held);
      out.thrown = C - D - out.charge;
    } else {
      out.give = Math.min(D - C, power, held);
      out.short = D - C - out.give;
    }
    out.held = held + out.charge - out.give;
    return out;
  }

  /* The whole year. `home` and `away` are unpacked grids; `choices` holds
   * sunGW, windGW, firmGW, far, wait and store. The batteries start the
   * year half full. */
  function run(home, away, choices) {
    var n = home.demand.length, f = away ? choices.far : 0;
    var hours = { D: [], sun: [], wind: [], firm: [], give: [], charge: [],
      thrown: [], short: [] };
    var held = choices.store / 2, totals = { D: 0, C: 0, used: 0, thrown: 0,
      short: 0, give: 0, charge: 0 };
    for (var start = 0; start < n; start += 24) {
      var day = home.demand.slice(start, start + 24), made = [], spare = [];
      for (var k = 0; k < day.length; k++) {
        var at = start + k;
        var cs = factor(home.sun[at], away ? away.sun[at] : 0, f);
        var cw = factor(home.wind[at], away ? away.wind[at] : 0, f);
        var parts = [choices.sunGW * cs, choices.windGW * cw, choices.firmGW];
        made.push(parts);
        spare.push(clean(choices.sunGW, cs, choices.windGW, cw,
          choices.firmGW) - (1 - choices.wait) * day[k]);
      }
      var use = shifted(day, spare, choices.wait);
      for (k = 0; k < day.length; k++) {
        var C = made[k][0] + made[k][1] + made[k][2];
        var h = hour(C, use[k], held, choices.store);
        held = h.held;
        hours.D.push(use[k]); hours.sun.push(made[k][0]);
        hours.wind.push(made[k][1]); hours.firm.push(made[k][2]);
        hours.give.push(h.give); hours.charge.push(h.charge);
        hours.thrown.push(h.thrown); hours.short.push(h.short);
        totals.D += use[k]; totals.C += C; totals.thrown += h.thrown;
        totals.short += h.short; totals.give += h.give;
        totals.charge += h.charge;
      }
    }
    totals.used = totals.D - totals.short;
    totals.cleanShare = totals.used / totals.D;
    totals.shortHours = hours.short.filter(function (s) {
      return s > 1e-9; }).length;
    totals.biggestShort = Math.max.apply(null, hours.short);
    totals.thrownShare = totals.C > 0 ? totals.thrown / totals.C : 0;
    totals.endHeld = held;
    return { hours: hours, totals: totals };
  }

  return {
    HOURS_OF_STORAGE: HOURS_OF_STORAGE, unpack: unpack, factor: factor,
    clean: clean, shifted: shifted, hour: hour, run: run
  };
});
