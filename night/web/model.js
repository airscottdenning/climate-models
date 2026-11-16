/* Night model: the temperature of moist soil under grass through a clear day
 * and night.
 *
 * Sunlight warms the ground by day. The ground glows in the infrared day and
 * night. The air glows too, and some of that Earthlight comes down from the
 * sky. Moving air carries heat to or from the ground, but only while the air
 * near the ground is stirred, and some heat leaves as water vapor. Heat soaks
 * down into the soil by day and comes back up at night.
 *
 * The Sunlight reaching the ground, the air's temperature and wind 10 m up and
 * the Earthlight from the sky aren't worked out here. They're measured: an
 * average clear day and night at NOAA's SURFRAD station at Table Mountain,
 * Colorado (1,689 m up), written in by build_data.py.
 *
 * These are the equations on the page's Physics tab, in the same order.
 * There's no drawing and no page code here, so the file can be run and tested
 * alone.
 *
 * Each name is followed by its letter on the Physics tab.
 *   t        t: the time since noon, in seconds
 *   share    s: the share of the measured Earthlight from the sky, 0 to 1.5
 *   T[i]     T: the temperature of a soil layer, in kelvins. T[0] is the top
 *            layer, which the Physics tab calls layer 1 and the page the
 *            surface.
 *   dz[i]    Δz: the thickness of a layer, in meters
 *   knobs    the settings the page's Advanced view can change (USUAL below):
 *            the share of the measured wind, z₀, β, k and c
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Night = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400;            // seconds from one noon to the next
  var SUNSET = 6 * 3600;      // seconds after noon. At an equinox the Sun sets
  var SUNRISE = 18 * 3600;    // at 6 p.m. and rises at 6 a.m.
  var SIGMA = 5.67e-8;        // σ: W/m² per K⁴, the Stefan-Boltzmann constant
  var GRAVITY = 9.81;         // g: m/s²
  var HEIGHT = 10;            // z: m, where the air's temperature and wind are
  var ROUGH = 0.03;           // z₀: m, the roughness length of short grass
  var HEAT_ROUGH = 10;        // z₀ ÷ z₀ₕ: heat's roughness length is a tenth
  var KARMAN = 0.4;           // κ: von Kármán's constant
  var ELEVATION = 1689;       // m: Table Mountain's height above sea level
  // P: Pa, the standard atmosphere's pressure at that height
  var PRESSURE = 101325 * Math.pow(1 - 2.25577e-5 * ELEVATION, 5.25588);
  var GAS = 287;              // R: J/kg per K, the gas constant for dry air
  var CP = 1004;              // cₚ: J/kg per K, warming a kilogram of air
  var STIRRED = 0.2;          // Ri at and above this: the air near the ground
                              // is still
  var STABLE = 5;             // ψ = −5ζ when the ground is colder than the air
  var STEEPEST = -2;          // ζ is never taken below this (step 6)
  var BOWEN = 1.5;            // β: heat carried by the air ÷ heat in vapor
  var CONDUCTIVITY = 1.0;     // k: W/m per K, how well loam carries heat
  var HEAT_CAPACITY = 2.0e6;  // c: J/m³ per K, how much heat the soil holds
  var TOP = 0.01;             // Δz of the top layer: 1 cm
  var THICKER = 1.4;          // each layer is 1.4 times as thick as the one above
  var LAYERS = 11;            // which reaches 0.99 m down
  var STEP = 60;              // Δt: seconds
  var START = 288.15;         // K: every layer's temperature before the first day
  var MOST_DAYS = 40;         // give up if the days still differ after this many
  var CLOSE = 0.002;          // K: two days this much alike count as the same

  // The settings the page opens with. Its Advanced view can change each one.
  var USUAL = { wind: 1, rough: ROUGH, bowen: BOWEN,
                conductivity: CONDUCTIVITY, capacity: HEAT_CAPACITY };

  // The average clear day at Table Mountain, hour by hour from noon: the
  // Sunlight reaching the ground and the Sunlight it reflects, in W/m²; the
  // air 10 m up, in °C; the wind, in m/s; the Earthlight from the sky, in
  // W/m²; and the ground's own temperature, in °C, which the model doesn't use
  // (the page draws it beside the model's).
  // measured: build_data.py writes these six lines. Hours after noon, 0 to 23.
  var SUNLIGHT = [815.0, 772.4, 667.5, 508.5, 309.9, 115.7, 10.7, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 16.6, 155.7,
    363.0, 552.5, 697.2, 783.1];
  var REFLECTED = [172.8, 165.7, 148.2, 120.9, 83.3, 35.3, 2.7, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 6.1, 48.6, 90.5,
    121.0, 140.2, 148.9];
  var AIR = [20.01, 21.00, 21.71, 21.87, 21.52, 20.06, 16.40, 14.42,
    13.28, 12.38, 11.78, 11.41, 11.28, 10.88, 10.54, 9.99, 9.74,
    9.97, 10.37, 12.98, 15.69, 17.02, 18.71, 20.56];
  var WIND = [2.78, 2.88, 2.99, 3.35, 3.06, 2.53, 3.21, 4.11, 4.29, 4.45,
    4.38, 4.04, 3.67, 3.86, 3.40, 3.59, 2.92, 2.69, 2.70, 1.84,
    1.51, 1.94, 2.23, 2.47];
  var SKY = [284.7, 288.9, 291.9, 293.8, 294.2, 292.8, 289.5, 284.7,
    283.1, 281.2, 278.9, 277.0, 275.7, 273.6, 271.7, 270.6,
    269.6, 268.9, 269.5, 268.8, 272.7, 276.8, 282.2, 289.3];
  var GROUND = [30.36, 30.60, 29.33, 26.62, 22.89, 17.02, 12.11, 10.88,
    10.09, 9.46, 8.78, 8.29, 7.61, 7.17, 6.56, 6.26, 5.52, 4.86,
    5.81, 10.91, 17.38, 22.46, 26.85, 30.41];

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

  /* The usual settings, with any of them changed by `changes`. */
  function settings(changes) {
    var knobs = {};
    Object.keys(USUAL).forEach(function (key) {
      var changed = changes && changes[key] !== undefined;
      knobs[key] = changed ? changes[key] : USUAL[key];
    });
    return knobs;
  }

  /* A measured value at time t: a straight line between the two hours on
   * either side. After 11 a.m. the line runs back to noon's value. */
  function measured(table, t) {
    var hours = t / 3600, h = Math.floor(hours) % 24;
    var part = hours - Math.floor(hours);
    return table[h] + (table[(h + 1) % 24] - table[h]) * part;
  }

  /* Step 1. Q: the Sunlight the surface takes in, in W/m²: what reached the
   * ground, less what it reflected (both measured). */
  function sunlight(t) { return measured(SUNLIGHT, t) - measured(REFLECTED, t); }

  /* Step 2. Tₐ: the temperature of the air 10 m up, in kelvins (measured). */
  function air(t) { return measured(AIR, t) + 273.15; }

  /* Step 2. U: the wind 10 m up, in m/s: the measured wind, times the share
   * the Advanced view sets (1 unless it's changed). */
  function wind(t, knobs) { return (knobs || USUAL).wind * measured(WIND, t); }

  /* Step 3. L: the Earthlight that comes down from the sky, in W/m²: the
   * share s of what was measured. */
  function skyGlow(share, t) { return share * measured(SKY, t); }

  /* Step 4. E: the Earthlight the surface emits, in W/m². */
  function glow(kelvin) { return SIGMA * Math.pow(kelvin, 4); }

  /* Step 5. Ri: how strongly the air resists being stirred. Above zero, the
   * air near the ground is colder and heavier than the air over it. */
  function richardson(surface, airK, u) {
    return GRAVITY * HEIGHT * (airK - surface) / (airK * u * u);
  }

  /* Step 6. The two logarithms: ln(z/z₀) for the wind (m) and ln(z/z₀ₕ) for
   * heat (h). Heat's roughness length z₀ₕ is a tenth of z₀. */
  function logs(knobs) {
    var rough = (knobs || USUAL).rough;
    return { m: Math.log(HEIGHT / rough),
             h: Math.log(HEIGHT * HEAT_ROUGH / rough) };
  }

  /* Step 6. r: the air's resistance to carrying heat when it's well stirred,
   * in s/m. */
  function resistance(u, knobs) {
    var l = logs(knobs);
    return l.m * l.h / (KARMAN * KARMAN * u);
  }

  /* Step 6. ψ: how much the air's stability changes the stirring of the wind
   * (m) and of heat (h). ζ, the stability, is below zero when warm air is
   * rising from the ground, and above zero when the ground is colder. */
  function psi(zeta) {
    if (zeta >= 0) return { m: -STABLE * zeta, h: -STABLE * zeta };
    var x = Math.pow(1 - 16 * zeta, 0.25);
    return {
      m: 2 * Math.log((1 + x) / 2) + Math.log((1 + x * x) / 2) -
        2 * Math.atan(x) + Math.PI / 2,
      h: 2 * Math.log((1 + x * x) / 2)
    };
  }

  /* Step 6. The Ri that goes with a stability ζ. */
  function riOf(zeta, knobs) {
    var l = logs(knobs), p = psi(zeta);
    return zeta * (l.h - p.h) / Math.pow(l.m - p.m, 2);
  }

  /* Step 6. ζ for an Ri below 0.2.
   * Above zero, ψ = −5ζ turns riOf into a quadratic, a ζ² + b ζ + c = 0, and
   * this is its root that is 0 when Ri is 0 (written so that it doesn't lose
   * digits when Ri is small).
   * Below zero, halve the range 50 times. riOf grows steadily from ζ = −2 to
   * ζ = 0, so the answer is in between. Far below −2 the equations break down,
   * so for an Ri below riOf(−2), ζ is −2. */
  function stability(ri, knobs) {
    var l = logs(knobs);
    if (ri >= 0) {
      var a = STABLE * STABLE * ri - STABLE, b = 2 * STABLE * ri * l.m - l.h;
      var c = ri * l.m * l.m;
      return 2 * c / (Math.sqrt(b * b - 4 * a * c) - b);
    }
    if (ri <= riOf(STEEPEST, knobs)) return STEEPEST;
    var low = STEEPEST, high = 0;
    for (var i = 0; i < 50; i++) {
      var middle = (low + high) / 2;
      if (riOf(middle, knobs) < ri) low = middle; else high = middle;
    }
    return (low + high) / 2;
  }

  /* Step 6. f: how much stronger or weaker the stirring is than in neutral
   * air. Above 1 when the ground is warmer than the air; 0 when it's still. */
  function stirring(ri, knobs) {
    if (ri >= STIRRED) return 0;
    var l = logs(knobs), p = psi(stability(ri, knobs));
    return l.m * l.h / ((l.m - p.m) * (l.h - p.h));
  }

  /* Step 6. ρ: the air's density, in kg/m³, from its pressure and its
   * temperature (the ideal gas law). */
  function density(airK) { return PRESSURE / (GAS * airK); }

  /* Step 6. H: the heat the air carries up from the surface, in W/m². It's
   * below zero when the air brings heat down. */
  function airHeat(surface, airK, u, knobs) {
    return density(airK) * CP * (surface - airK) *
      stirring(richardson(surface, airK, u), knobs) / resistance(u, knobs);
  }

  /* Step 6. V: the heat that leaves as water vapor, in W/m². Only while the
   * air carries heat away: nothing evaporates from ground colder than the air. */
  function vapor(h, knobs) { return h > 0 ? h / (knobs || USUAL).bowen : 0; }

  /* Step 7. F: the heat flowing down from one layer into the one below it, in
   * W/m². The middles of the two layers are half of (Δz + Δz) apart. */
  function flow(above, below, dzAbove, dzBelow, knobs) {
    return 2 * (knobs || USUAL).conductivity * (above - below) /
      (dzAbove + dzBelow);
  }

  /* Step 8. ΔT: how much a layer warms in one step, in kelvins, when `net`
   * W/m² more comes in than goes out. */
  function warming(net, dz, knobs) {
    return STEP * net / ((knobs || USUAL).capacity * dz);
  }

  /* Everything at the surface at time t, with the share s of the sky. */
  function surface(T, t, share, dz, knobs) {
    knobs = knobs || USUAL;
    var a = air(t), u = wind(t, knobs), q = sunlight(t), l = skyGlow(share, t);
    var e = glow(T[0]), ri = richardson(T[0], a, u);
    var h = airHeat(T[0], a, u, knobs), v = vapor(h, knobs);
    var f = flow(T[0], T[1], dz[0], dz[1], knobs), left = q + l - e - h - v - f;
    return { air: a, wind: u, sunlight: q, sky: l, glow: e, airHeat: h,
             vapor: v, down: f, left: left, warming: warming(left, dz[0], knobs),
             richardson: ri, stirring: stirring(ri, knobs) };
  }

  /* One step for the whole column: steps 1 to 8 for the top layer, then steps
   * 7 and 8 for each layer below. Every flow is worked out from the
   * temperatures at the start of the step. Nothing leaves the bottom. */
  function advance(T, t, share, dz, knobs) {
    var top = surface(T, t, share, dz, knobs);
    var fromAbove = top.sunlight + top.sky - top.glow - top.airHeat - top.vapor;
    for (var i = 0; i < T.length; i++) {
      var toBelow = i + 1 < T.length ?
        flow(T[i], T[i + 1], dz[i], dz[i + 1], knobs) : 0;
      T[i] += warming(fromAbove - toBelow, dz[i], knobs);
      fromAbove = toBelow;
    }
    return top;
  }

  /* Is it night at time t? */
  function night(t) { return t >= SUNSET && t < SUNRISE; }

  var RECORDED = ['air', 'wind', 'sunlight', 'sky', 'glow', 'airHeat', 'vapor',
                  'down', 'richardson', 'stirring'];

  /* One day from noon to noon. `shareAt(t)` gives the share of the sky. If
   * `record` is given, each step's temperatures and surface flows go in it. */
  function oneDay(T, dz, shareAt, knobs, record) {
    var n = DAY / STEP, sums = dz.map(function () { return 0; });
    for (var j = 0; j < n; j++) {
      var t = j * STEP;
      for (var i = 0; i < LAYERS; i++) {
        sums[i] += T[i];
        if (record) record.T[i][j] = T[i];
      }
      var top = advance(T, t, shareAt(t), dz, knobs);
      if (record) RECORDED.forEach(function (key) { record[key][j] = top[key]; });
    }
    return sums.map(function (sum) { return sum / n; });
  }

  /* Run days with the share `share` of the sky until one day repeats the one
   * before it.
   *
   * The soil a meter down takes months to settle, and the model doesn't wait.
   * Over a day that repeats, no heat builds up anywhere, so every layer has the
   * same average temperature as the top one. After each day, each layer is
   * moved by the difference between the top layer's average and its own. */
  function settle(share, dz, knobs) {
    var T = dz.map(function () { return START; }), lastMean = null;
    for (var d = 1; d <= MOST_DAYS; d++) {
      var means = oneDay(T, dz, function () { return share; }, knobs);
      var apart = 0, i;
      for (i = 0; i < LAYERS; i++) {
        apart = Math.max(apart, Math.abs(means[i] - means[0]));
      }
      var same = Math.abs(means[0] - lastMean) < CLOSE;
      if (lastMean !== null && apart < CLOSE && same) {
        return { T: T, days: d, settled: true };
      }
      lastMean = means[0];
      for (i = 0; i < LAYERS; i++) T[i] += means[0] - means[i];
    }
    return { T: T, days: MOST_DAYS, settled: false };
  }

  // When the chosen sky shines: every day and night, until a day repeats
  // (EVERY); tonight only, from sunset to sunrise (TONIGHT); or for one whole
  // day and night, from noon to noon (ONE_DAY). For the last two, the days
  // before have the sky as measured.
  var EVERY = 0, TONIGHT = 1, ONE_DAY = 2;

  /* The share of the sky at time t, for a run with the share `share` and the
   * choice `when`. */
  function skyShare(share, when, t) {
    return when === TONIGHT && !night(t) ? 1 : share;
  }

  /* The day the page draws, from noon to noon.
   *
   * `share` is the share of the measured sky, 0 to 1.5, and `when` is EVERY,
   * TONIGHT or ONE_DAY (true counts as TONIGHT). `changes` holds any settings
   * the Advanced view has changed (see USUAL). */
  function run(share, when, changes) {
    when = when === true ? TONIGHT : when || EVERY;
    var dz = thicknesses(), n = DAY / STEP, knobs = settings(changes);
    var start = settle(when === EVERY ? share : 1, dz, knobs);
    var T = start.T.slice();
    var result = {
      share: share, when: when, once: when !== EVERY,
      tonightOnly: when === TONIGHT, knobs: knobs, steps: n,
      days: start.days, settled: start.settled,
      T: dz.map(function () { return new Float64Array(n); })
    };
    RECORDED.forEach(function (key) { result[key] = new Float64Array(n); });
    oneDay(T, dz, function (t) { return skyShare(share, when, t); }, knobs,
           result);
    var hot = 0, cold = 0, i;
    for (i = 1; i < n; i++) {
      if (result.T[0][i] > result.T[0][hot]) hot = i;
      if (result.T[0][i] < result.T[0][cold]) cold = i;
    }
    result.hottest = { kelvin: result.T[0][hot], at: hot };
    result.coldest = { kelvin: result.T[0][cold], at: cold };
    return result;
  }

  return {
    DAY: DAY, SUNSET: SUNSET, SUNRISE: SUNRISE, SIGMA: SIGMA,
    GRAVITY: GRAVITY, HEIGHT: HEIGHT, ROUGH: ROUGH, HEAT_ROUGH: HEAT_ROUGH,
    KARMAN: KARMAN, ELEVATION: ELEVATION, PRESSURE: PRESSURE, GAS: GAS, CP: CP,
    STIRRED: STIRRED, STABLE: STABLE, STEEPEST: STEEPEST, BOWEN: BOWEN,
    CONDUCTIVITY: CONDUCTIVITY, HEAT_CAPACITY: HEAT_CAPACITY, TOP: TOP,
    THICKER: THICKER, LAYERS: LAYERS, STEP: STEP, START: START,
    MOST_DAYS: MOST_DAYS, CLOSE: CLOSE, USUAL: USUAL, SUNLIGHT: SUNLIGHT,
    REFLECTED: REFLECTED, AIR: AIR, WIND: WIND, SKY: SKY, GROUND: GROUND,
    thicknesses: thicknesses, depths: depths, settings: settings,
    measured: measured, sunlight: sunlight, air: air, wind: wind,
    skyGlow: skyGlow, glow: glow, richardson: richardson, logs: logs,
    resistance: resistance, psi: psi, riOf: riOf, stability: stability,
    stirring: stirring, density: density, airHeat: airHeat, vapor: vapor,
    flow: flow, warming: warming, surface: surface, advance: advance,
    night: night, settle: settle, EVERY: EVERY, TONIGHT: TONIGHT,
    ONE_DAY: ONE_DAY, skyShare: skyShare, run: run
  };
});
