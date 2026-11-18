/* Heat and work model: how much of each hour a person can safely work on a
 * hot afternoon, from the air's temperature and humidity.
 *
 * These are the steps on the page's About tab, in the same order. There's
 * no drawing and no page code here, so the file can be run and tested alone.
 *
 * Each name is followed by its letter on the About tab.
 *   T0      T0: the afternoon's air temperature as measured, in °C
 *   dT      ΔT: the warming you add to the air, in °C
 *   T       T: the air's temperature after the warming, in °C
 *   H       H: the relative humidity, in %
 *   Tw      Tw: the wet-bulb temperature, in °C
 *   G       G: how much hotter than the air a black globe runs, in °C
 *   W       W: the wet-bulb globe temperature (WBGT), in °C
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HeatAndWork = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // G in full Sun. In sugarcane fields in Costa Rica, the black globe ran
  // 6 to 14 °C hotter than the air, about 10 on average (Crowe et al. 2010).
  // In the shade G is 0.
  var GLOBE_IN_SUN = 10;
  var ROOM = { T: 25, H: 50 };     // a cooled room: 25 °C, 50% humidity

  // The classic work/rest table of Chapter 10 (ACGIH's threshold limits).
  // Each row is a share of the hour spent working. Each number is the
  // highest WBGT, in °C, at which that row is allowed, for light, moderate
  // and heavy work.
  var MINUTES = [60, 45, 30, 15];
  var LIMITS = {
    light: [30.0, 30.6, 31.4, 32.2],
    moderate: [26.7, 28.0, 29.4, 31.1],
    heavy: [25.0, 25.9, 27.9, 30.0]
  };
  var LOADS = ['light', 'moderate', 'heavy'];

  // The places, written by build_data.py from places-source.json. Each is
  // the average afternoon of its hottest month, 1991-2020: the id, the name,
  // the country or state, the month, T0 in °C and H in %.
  // PLACES START
  var PLACES = [
    ['accra', 'Accra', 'Ghana', 'April', 33.3, 63],
    ['bandar-abbas', 'Bandar Abbas', 'Iran', 'July', 37.3, 58],
    ['bangkok', 'Bangkok', 'Thailand', 'April', 35.1, 55],
    ['darwin', 'Darwin', 'Australia', 'November', 33.4, 56],
    ['dhaka', 'Dhaka', 'Bangladesh', 'June', 32.6, 67],
    ['houston', 'Houston', 'Texas', 'July', 34.6, 53],
    ['jacobabad', 'Jacobabad', 'Pakistan', 'June', 44.4, 29],
    ['london', 'London', 'England', 'July', 24.0, 47],
    ['manaus', 'Manaus', 'Brazil', 'September', 33.7, 55],
    ['new-haven', 'New Haven', 'Connecticut', 'July', 29.5, 49],
    ['niamey', 'Niamey', 'Niger', 'May', 40.7, 27],
    ['phoenix', 'Phoenix', 'Arizona', 'August', 41.4, 21],
    ['seville', 'Seville', 'Spain', 'August', 35.8, 31],
    ['shanghai', 'Shanghai', 'China', 'July', 32.3, 62]
  ];
  // PLACES END

  /* A number to the nearest tenth, with halves rounded up. */
  function tenth(x) { return Math.floor(x * 10 + 0.5) / 10; }

  /* Step 1. T: the air's temperature after the warming. The relative
   * humidity H stays the same. */
  function warmed(T0, dT) { return T0 + dT; }

  /* Step 2. Tw: what a wet thermometer reads in a breeze, in the shade.
   * Stull's (2011) fit for air at sea level. The four arctangents are
   * angles in radians. It holds for H from 5 to 99 and T up to 50. */
  function wetBulb(T, H) {
    var a = Math.atan(0.151977 * Math.sqrt(H + 8.313659));
    var b = Math.atan(T + H);
    var c = Math.atan(H - 1.676331);
    var d = Math.atan(0.023101 * H);
    return T * a + b - c + 0.00391838 * Math.pow(H, 1.5) * d - 4.686035;
  }

  /* Step 3. W: the wet-bulb globe temperature. The wet thermometer counts
   * for 0.7, the black globe (the air plus G) for 0.2 and the air for 0.1.
   * In the shade G is 0, and this is 0.7 Tw + 0.3 T. */
  function index(T, Tw, G) { return 0.7 * Tw + 0.2 * (T + G) + 0.1 * T; }

  /* Step 4. The minutes of work in each hour that the table allows: the
   * first row whose limit W doesn't pass. Past the last row, there's none.
   * W is rounded to a tenth of a degree first, as the table is written. */
  function minutes(W, load) {
    var limits = LIMITS[load], at = tenth(W);
    for (var row = 0; row < limits.length; row++) {
      if (at <= limits[row]) return MINUTES[row];
    }
    return 0;
  }

  /* One person in one place: the air around them, Tw, W and the minutes for
   * each kind of work. `where` is 'sun', 'shade' or 'room'. In the cooled
   * room the air is the room's, whatever it's like outside. */
  function person(T, H, where) {
    var air = where === 'room' ? ROOM : { T: T, H: H };
    var G = where === 'sun' ? GLOBE_IN_SUN : 0;
    var Tw = wetBulb(air.T, air.H), W = index(air.T, Tw, G);
    var out = { T: air.T, H: air.H, G: G, Tw: Tw, W: W, minutes: {} };
    LOADS.forEach(function (load) { out.minutes[load] = minutes(W, load); });
    return out;
  }

  /* The afternoon as measured and the afternoon after the warming. */
  function run(T0, H, dT, where) {
    return { now: person(T0, H, where), later: person(warmed(T0, dT), H, where) };
  }

  function place(id) {
    for (var k = 0; k < PLACES.length; k++) {
      var p = PLACES[k];
      if (p[0] === id) {
        return { id: p[0], name: p[1], region: p[2], month: p[3],
                 T: p[4], H: p[5] };
      }
    }
    return null;
  }

  return {
    GLOBE_IN_SUN: GLOBE_IN_SUN, ROOM: ROOM, MINUTES: MINUTES, LIMITS: LIMITS,
    LOADS: LOADS, PLACES: PLACES, tenth: tenth, warmed: warmed,
    wetBulb: wetBulb, index: index, minutes: minutes, person: person,
    run: run, place: place
  };
});
