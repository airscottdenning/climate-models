/* EarthCarbon: where the carbon goes, and how warm it gets.
 *
 * Carbon from fossil fuel goes into the air. The ocean and the land take
 * some of it back out, and the rest warms the Earth. This file works out
 * all three, one year at a time, from 1750 to the year 3000:
 *
 *   the air      one well-mixed box of carbon
 *   the ocean    four boxes of water (warm surface, thermocline, cold
 *                surface, deep), carrying carbon, nitrate, alkalinity and
 *                heat; seawater chemistry sets how much CO2 each surface
 *                box holds up against the air
 *   the climate  an energy balance: forcing in, heat out to space and into
 *                the ocean
 *   the land     three regions (boreal, temperate, tropics), each with wood,
 *                litter, soil and stable soil, nitrogen, and land use
 *
 * These are the equations on the page's About tab, in the same order.
 * There's no drawing and no page code here, so the file can be run and
 * tested alone. It is a line-by-line copy of the Python model it was built
 * from (the folder reference/ beside this page in the book's repository);
 * the tests hold the two together.
 *
 * Units: carbon in GtC (billions of tonnes), carbon flows in GtC per year,
 * CO2 in ppm, warming in K (the same as °C of change), forcing in W/m².
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EarthCarbon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * Numbers about the Earth
   * ------------------------------------------------------------------- */
  var SECONDS_PER_YEAR = 365.25 * 24 * 3600;
  var EARTH_AREA = 4 * Math.PI * 6371000 * 6371000;        // m²
  // GtC in the air for each ppm of CO2: the air's mass from its pressure,
  // in moles, times the carbon in a millionth of them.
  var GTC_PER_PPM = 101325e-6 / 9.81 * EARTH_AREA * 0.012 / 0.029 / 1e12;
  var GTC_PER_MOL = 0.012 / 1e12;
  var DENSITY = 1027;                       // kg of seawater per m³
  var KG_PER_YEAR_PER_SV = 1e6 * DENSITY * SECONDS_PER_YEAR;
  var HEAT_CAPACITY = 3990;                 // J to warm 1 kg of seawater 1 K
  var ZJ_PER_WM2_YEAR = EARTH_AREA * SECONDS_PER_YEAR / 1e21;
  var KELVIN = 273.15;
  var SALINITY = 34.78;
  var GEOLOGIC_YEARS = 100000;              // rock weathering, very slowly

  /* The settings, as the page opens: best estimates (see the About tab).
   * Every slider on the page is one of these. */
  var DEFAULTS = {
    // climate
    sensitivity: 2.5,          // K for doubled CO2, once the ocean catches up
    aerosol: 1.0,              // x the best estimate of smog's cooling
    // ocean
    mixing: 150,               // Sv: warm surface <-> thermocline, as at first
    // land
    co2Boost: 45,              // % more growth for doubled CO2, nitrogen ample
    room: 100,                 // % more wood than a mature forest can hold
    q10: 2.0,                  // how much faster rot goes for each 10 K
    width: 10,                 // K: width of growth's temperature curve
    nitrogen: 0.75,            // share of full growth nitrogen allowed at first
    landUse: 1.0,              // x clearing and harvest as recorded
    // the record
    overstated: 0,             // % fossil emissions were over-reported
    aerosolFollowsFossil: false
  };

  /* =====================================================================
   * Step 1. The surface: land warms faster than the sea.
   * ===================================================================== */
  var OCEAN_AREA = 3.6184e14;               // m², measured
  var POLAR_SHARE = 0.15;                   // of the ocean: the cold box
  var OCEAN_FRACTION = OCEAN_AREA / EARTH_AREA;
  var LAND_PER_SEA = 1.6;                   // land warms 1.6 x the warm sea
  var POLAR_FULL = 5;                       // K: polar sea fully free of ice

  /* How much of the globe's warming T the polar sea feels: the rising side
   * of a bell curve, from 1% at no warming to all of it at 5 K. */
  function polarShare(T) {
    if (T >= POLAR_FULL) return 1;
    var x = (POLAR_FULL - T) / (POLAR_FULL / 3);
    return Math.exp(-0.5 * x * x);
  }

  /* Share global warming T out between land, warm sea and polar sea, so
   * that their area-weighted mean is T. */
  function splitWarming(T) {
    var land = 1 - OCEAN_FRACTION;
    var polar = polarShare(T) * T;
    var warm = (T - OCEAN_FRACTION * POLAR_SHARE * polar) /
      (land * LAND_PER_SEA + OCEAN_FRACTION * (1 - POLAR_SHARE));
    return { land: LAND_PER_SEA * warm, warm: warm, polar: polar };
  }

  /* =====================================================================
   * Step 2. Seawater chemistry: how much CO2 a surface box holds up.
   * ===================================================================== */
  var BORON = 0.0004326 * SALINITY / 35;    // mol/kg (Lee et al. 2010)

  /* K0 (solubility), K1 and K2 (carbonic acid), KB (boric acid), KW
   * (water) at temperature TK in kelvin. The standard constants: Weiss
   * (1974), Lueker et al. (2000), Dickson (1990), Millero (1995). */
  function constants(TK) {
    var S = SALINITY, rS = Math.sqrt(S), lnT = Math.log(TK);
    var K0 = Math.exp(-60.2409 + 9345.17 / TK + 23.3585 * Math.log(TK / 100) +
      S * (0.023517 - 0.00023656 * TK + 0.0047036 * (TK / 100) * (TK / 100)));
    var pK1 = 3633.86 / TK - 61.2172 + 9.6777 * lnT - 0.011555 * S +
      0.0001152 * S * S;
    var pK2 = 471.78 / TK + 25.929 - 3.16967 * lnT - 0.01781 * S +
      0.0001122 * S * S;
    var KB = Math.exp((-8966.90 - 2890.53 * rS - 77.942 * S +
      1.728 * Math.pow(S, 1.5) - 0.0996 * S * S) / TK +
      (148.0248 + 137.1942 * rS + 1.62142 * S) +
      (-24.4344 - 25.085 * rS - 0.2474 * S) * lnT +
      0.053105 * rS * TK) * (1 - 0.001005 * S);
    var KW = Math.exp(148.9652 - 13847.26 / TK - 23.6521 * lnT +
      (118.67 / TK - 5.977 + 1.0495 * lnT) * rS - 0.01615 * S);
    return { K0: K0, K1: Math.pow(10, -pK1), K2: Math.pow(10, -pK2),
      KB: KB, KW: KW };
  }

  /* pH and pCO2 (ppm) of seawater at TK with alkalinity A and dissolved
   * carbon C (both per kg). Take away the alkalinity that isn't carbon's,
   * solve a quadratic for H+, repeat until H+ settles. */
  function chemistry(TK, A, C, phGuess) {
    var k = constants(TK);
    var H = Math.pow(10, -phGuess), change = H, Ac = A;
    while (change > 1e-15) {
      var before = H;
      Ac = A - k.KB / (k.KB + H) * BORON - k.KW / H + H;
      var a = Ac, b = k.K1 * (Ac - C), c = k.K1 * k.K2 * (Ac - 2 * C);
      H = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      change = Math.abs(H - before);
    }
    var co2 = Ac / (k.K1 / H + 2 * k.K1 * k.K2 / (H * H));
    return { ph: -Math.log10(H), pco2: co2 / k.K0 * 1e6 };
  }

  /* Solve matrix * x = right by Gaussian elimination (school algebra). */
  function solve(matrix, right) {
    var n = right.length, i, j, k, rows = [];
    for (i = 0; i < n; i++) rows.push(matrix[i].concat([right[i]]));
    for (j = 0; j < n; j++) {
      var p = j;
      for (i = j + 1; i < n; i++) {
        if (Math.abs(rows[i][j]) > Math.abs(rows[p][j])) p = i;
      }
      var t = rows[j]; rows[j] = rows[p]; rows[p] = t;
      for (i = j + 1; i < n; i++) {
        var f = rows[i][j] / rows[j][j];
        for (k = j; k <= n; k++) rows[i][k] -= f * rows[j][k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var known = 0;
      for (k = i + 1; k < n; k++) known += rows[i][k] * x[k];
      x[i] = (rows[i][n] - known) / rows[i][i];
    }
    return x;
  }

  /* =====================================================================
   * Step 3. The ocean: four boxes of water.
   * ===================================================================== */
  var LOW = 0, THERMO = 1, HIGH = 2, DEEP = 3;
  var N_PER_P = 15;

  function Ocean(start, mixingSv) {
    var depth = 3682, highArea = POLAR_SHARE * OCEAN_AREA;
    this.start = start;                      // ppm the ocean starts level with
    this.mixingSv = mixingSv;                // f_lt as the page sets it
    this.lowArea = OCEAN_AREA - highArea;
    this.highArea = highArea;
    var all = OCEAN_AREA * depth * DENSITY;
    var low = this.lowArea * 100 * DENSITY;
    var thermo = this.lowArea * 900 * DENSITY;
    var high = highArea * 250 * DENSITY;
    this.water = [low, thermo, high, all - low - thermo - high];   // kg
    this.highNitrogen = 0.00615 * N_PER_P * highArea;   // mol N/yr sinking
    var elsewhere = 2.09e-6 * N_PER_P * all / (all - low);
    this.nitrate = [0, elsewhere, elsewhere, elsewhere];
    this.alk = [2371e-6, 2371e-6, 2371e-6, 2371e-6];
    this.dic = [1.92e-3, 2.15e-3, 2.15e-3, 2.26e-3];
    this.warming = [0, 0, 0, 0];
    this.ph = { low: 8, high: 8 };
    this.pco2 = { low: start, high: start };
    this.lowExport = 0; this.highExport = 0;
    // Start level with the air: longer and longer steps, air held fixed.
    var spin = [10, 100, 1e3, 1e4, 1e5, 1e6, 1e6];
    for (var i = 0; i < spin.length; i++) this.advance(start, 0, spin[i]);
  }

  /* Each surface box's warming when the globe has warmed T. */
  Ocean.prototype.boxWarming = function (box, T) {
    var s = splitWarming(T);
    return box === 'low' ? s.warm : s.polar;
  };
  Ocean.prototype.tempK = function (box, T) {
    return (box === 'low' ? 21.5 : 2.0) + KELVIN + this.boxWarming(box, T);
  };

  /* flow[from][to]: kg of water a year. Mixing weakens as the layers'
   * temperatures part (warm water floats on cold). */
  Ocean.prototype.flows = function () {
    var sv = KG_PER_YEAR_PER_SV, w = this.warming;
    function weakened(mixing, before, extra) {
      var now = Math.max(before + extra, 0.1 * before);
      return mixing * before / now;
    }
    this.mixingNow = weakened(this.mixingSv, 21.5 - 10, w[LOW] - w[THERMO]);
    var deepMix = weakened(6, 10 - 2, w[THERMO] - w[DEEP]);
    var f = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    f[HIGH][DEEP] = f[DEEP][HIGH] = 20 * sv;              // polar mixing
    f[LOW][THERMO] = f[THERMO][LOW] = this.mixingNow * sv;
    f[THERMO][DEEP] = f[DEEP][THERMO] = deepMix * sv;
    var loop = [DEEP, HIGH, THERMO, LOW, HIGH, DEEP];      // overturning
    for (var i = 0; i + 1 < loop.length; i++) f[loop[i]][loop[i + 1]] += 20 * sv;
    this.flow = f;
    return f;
  };

  /* The four box balances for a backward step of `years`. */
  Ocean.prototype.matrix = function (f, years) {
    var m = [], i, j;
    for (i = 0; i < 4; i++) {
      m.push([0, 0, 0, 0]);
      m[i][i] = this.water[i] / years + f[i][0] + f[i][1] + f[i][2] + f[i][3];
      for (j = 0; j < 4; j++) if (j !== i) m[i][j] = -f[j][i];
    }
    return m;
  };

  /* Each box's warming at the end of a step, the surface boxes being
   * given theirs; water carries it below. */
  Ocean.prototype.warmingAfter = function (m, T, years) {
    var hm = m.map(function (row) { return row.slice(); });
    var right = [], i;
    for (i = 0; i < 4; i++) right.push(this.water[i] * this.warming[i] / years);
    hm[LOW] = [1, 0, 0, 0]; right[LOW] = this.boxWarming('low', T);
    hm[HIGH] = [0, 0, 1, 0]; right[HIGH] = this.boxWarming('high', T);
    return solve(hm, right);
  };

  /* Heat (ZJ) the ocean would gain this year if the globe warmed to T.
   * A question only: nothing changes. The climate asks it. */
  Ocean.prototype.heatGainIf = function (T) {
    var m = this.matrix(this.flows(), 1);
    var after = this.warmingAfter(m, T, 1), gain = 0;
    for (var i = 0; i < 4; i++) {
      gain += this.water[i] * HEAT_CAPACITY * (after[i] - this.warming[i]);
    }
    return gain / 1e21;
  };

  Ocean.prototype.pco2Of = function (box, C, T) {
    var i = box === 'low' ? LOW : HIGH;
    var c = chemistry(this.tempK(box, T), this.alk[i], C, this.ph[box]);
    this.ph[box] = c.ph;
    return c.pco2;
  };

  /* Moles a year through a surface box per ppm of difference with the air:
   * piston velocity x solubility x area. */
  Ocean.prototype.gasRate = function (box, T) {
    var area = box === 'low' ? this.lowArea : this.highArea;
    return 3 * 365.25 * constants(this.tempK(box, T)).K0 * DENSITY * area * 1e-6;
  };

  /* One backward step of `years` with the air at co2 ppm and the globe
   * warmed T. Returns the gas taken up by [low, high], mol C a year. */
  Ocean.prototype.advance = function (co2, T, years) {
    var self = this, f = this.flows(), m = this.matrix(f, years), i, s;
    var inThermo = 0.8, inDeep = 0.2;
    function carried(old) {
      return old.map(function (c, k) { return self.water[k] * c / years; });
    }
    this.warming = this.warmingAfter(m, T, years);

    // Nitrate: the warm surface keeps none; what arrives sinks and
    // dissolves below (80% in the thermocline, 20% in the deep).
    var nm = m.map(function (row) { return row.slice(); });
    var right = carried(this.nitrate);
    for (s = 0; s < 4; s++) {
      nm[THERMO][s] -= inThermo * f[s][LOW];
      nm[DEEP][s] -= inDeep * f[s][LOW];
    }
    nm[LOW] = [1, 0, 0, 0]; right[LOW] = 0;
    right[HIGH] -= this.highNitrogen; right[DEEP] += this.highNitrogen;
    this.nitrate = solve(nm, right);
    var lowN = 0;
    for (s = 0; s < 4; s++) lowN += f[s][LOW] * this.nitrate[s];
    var highN = this.highNitrogen;

    // Carbon that sinks: soft tissue (8.7 C per N) and shells (20% of
    // what reaches the deep).
    var lowSoft = 130 / N_PER_P * lowN, highSoft = 130 / N_PER_P * highN;
    var lowShells = 0.25 * inDeep * lowSoft, highShells = 0.25 * highSoft;
    this.lowExport = lowSoft + lowShells;
    this.highExport = highSoft + highShells;

    // Alkalinity: shells take 2, nitrate uptake gives 1 back.
    right = carried(this.alk);
    right[LOW] += lowN - 2 * lowShells;
    right[THERMO] += -inThermo * lowN;
    right[HIGH] += highN - 2 * highShells;
    right[DEEP] += 2 * (lowShells + highShells) - (inDeep * lowN + highN);
    this.alk = solve(m, right);

    // Carbon, without gas exchange, then per mole of gas taken up.
    right = carried(this.dic);
    right[LOW] -= lowSoft + lowShells;
    right[THERMO] += inThermo * lowSoft;
    right[HIGH] -= highSoft + highShells;
    right[DEEP] += inDeep * lowSoft + lowShells + highSoft + highShells;
    var noGas = solve(m, right);
    var perLow = solve(m, [1, 0, 0, 0]), perHigh = solve(m, [0, 0, 1, 0]);
    function carbon(uL, uH) {
      return noGas.map(function (c, k) {
        return c + uL * perLow[k] + uH * perHigh[k];
      });
    }
    // Uptake = rate x (air - water), but water depends on uptake: Newton.
    var gL = this.gasRate('low', T), gH = this.gasRate('high', T);
    var uL = 0, uH = 0, d = 1e-8;
    for (i = 0; i < 60; i++) {
      var C = carbon(uL, uH);
      var pL = this.pco2Of('low', C[LOW], T), pH = this.pco2Of('high', C[HIGH], T);
      var missL = uL - gL * (co2 - pL), missH = uH - gH * (co2 - pH);
      var sL = (this.pco2Of('low', C[LOW] + d, T) - pL) / d;
      var sH = (this.pco2Of('high', C[HIGH] + d, T) - pH) / d;
      var a = 1 + gL * sL * perLow[LOW], b = gL * sL * perHigh[LOW];
      var c = gH * sH * perLow[HIGH], e = 1 + gH * sH * perHigh[HIGH];
      var det = a * e - b * c;
      var dL = (e * missL - b * missH) / det, dH = (a * missH - c * missL) / det;
      uL -= dL; uH -= dH;
      var moved = Math.max(Math.abs(dL * perLow[LOW] + dH * perHigh[LOW]),
        Math.abs(dL * perLow[HIGH] + dH * perHigh[HIGH]));
      if (moved < 1e-15) break;
    }
    this.dic = carbon(uL, uH);
    this.pco2.low = this.pco2Of('low', this.dic[LOW], T);
    this.pco2.high = this.pco2Of('high', this.dic[HIGH], T);
    return [uL, uH];
  };

  Ocean.prototype.carbon = function () {
    var total = 0;
    for (var i = 0; i < 4; i++) total += this.dic[i] * this.water[i] * GTC_PER_MOL;
    return total;
  };
  Ocean.prototype.heat = function () {           // ZJ gained since 1750
    var total = 0;
    for (var i = 0; i < 4; i++) {
      total += this.water[i] * HEAT_CAPACITY * this.warming[i] / 1e21;
    }
    return total;
  };

  /* One year. Returns carbon taken from the air (GtC) and heat gained (ZJ). */
  Ocean.prototype.step = function (co2, T) {
    var heatBefore = this.heat();
    var u = this.advance(co2, T, 1);
    return { uptake: (u[0] + u[1]) * GTC_PER_MOL, heat: this.heat() - heatBefore };
  };

  /* =====================================================================
   * Step 4. The climate: an energy balance solved with the ocean.
   * ===================================================================== */
  var F2X = 3.93;                  // W/m² from doubled CO2
  var OCEAN_HEAT_SHARE = 0.91;     // of the Earth's energy gain
  var AEROSOL_PER_GTC = -0.109;    // W/m² per GtC a year burnt (2015-2024)

  function Climate(start, settings) {
    this.start = start;
    this.lambda = F2X / settings.sensitivity;     // W/m² shed per K
    this.aerosolStrength = settings.aerosol;
    this.T = 0;
  }

  /* Find this year's warming T: the Earth's gain, less what the ocean takes,
   * must come to nothing. Newton's method from last year's T. */
  Climate.prototype.step = function (co2, fossil, ocean, aerosol, other) {
    var Fco2 = F2X * Math.log(co2 / this.start) / Math.LN2;
    if (aerosol === null) aerosol = AEROSOL_PER_GTC * Math.max(0, fossil);
    var Faer = this.aerosolStrength * aerosol;
    var F = Fco2 + Faer + (other || 0), lambda = this.lambda;
    function surplus(T) {
      return OCEAN_HEAT_SHARE * (F - lambda * T) * ZJ_PER_WM2_YEAR -
        ocean.heatGainIf(T);
    }
    var T = this.T, d = 1e-4;
    for (var i = 0; i < 30; i++) {
      var miss = surplus(T);
      var correction = miss / ((surplus(T + d) - miss) / d);
      T -= correction;
      if (Math.abs(correction) < 1e-12) break;
    }
    this.T = T;
    return { T: T, Fco2: Fco2, Faer: Faer, F: F, imbalance: F - lambda * T,
      land: splitWarming(T).land };
  };

  /* =====================================================================
   * Step 5. The land: three regions of wood, litter and soil.
   * ===================================================================== */
  // Before industry, in balance. Wood after Pan et al. (2024); soil after
  // Shi et al. (2020); the rest round numbers (see the About tab).
  var REGIONS = [
    { name: 'boreal', area: 30, growth: 7, wood: 75, woodShare: 0.25,
      litterYears: 8, respired: 0.84, soilYears: 90, stabilised: 0.05,
      stableYears: 9000, warmer: 1.40, season: 12 },
    { name: 'temperate', area: 32, growth: 13, wood: 125, woodShare: 0.25,
      litterYears: 4, respired: 0.86, soilYears: 45, stabilised: 0.036,
      stableYears: 6500, warmer: 1.05, season: 18 },
    { name: 'tropics', area: 71, growth: 36, wood: 400, woodShare: 0.30,
      litterYears: 1.5, respired: 0.88, soilYears: 25, stabilised: 0.022,
      stableYears: 5000, warmer: 0.80, season: 26 }
  ];
  var COMPENSATION = 40;           // ppm: below this, plants can't grow
  var BEST_TEMP = 25;              // °C: growth's best temperature
  var PRIMING = 0.85;              // rot speeds up with litter supply
  var CN = { wood: 250, leaves: 40, soil: 12 };   // carbon per nitrogen
  var N_FIXED_SHARE = 0.10;        // of uptake, before industry
  var N_PER_FOSSIL_GTC = 0.006;    // GtN deposited per GtC burnt
  var N_SHARES = { boreal: 0.10, temperate: 0.60, tropics: 0.30 };
  var BURNT = 0.5, USED = 0.5;     // of cleared and harvested wood, at once
  var YOUNG_WOOD = 0.5;            // young forest's wood, of old's, at first
  var CROP_SOIL_LOSS = 0.3;        // less litter reaches soil under crops

  /* How much faster plants grow at this CO2 than at the start: a curve
   * that flattens, passing through (1 + boost) at doubled CO2. */
  function co2Growth(co2, start, boost) {
    var g = 1 + boost / 100, c = COMPENSATION;
    var top = 2 * g * (start - c) * start - (2 * start - c) * start;
    var half = top / ((2 * start - c) - g * (start - c));
    function curve(x) { return (x - c) / (x + half); }
    return curve(co2) / curve(start);
  }

  /* How much faster plants grow now that the region has warmed T: a bell
   * curve of the growing season's temperature, peaking at 25 °C. */
  function tempGrowth(season, T, width) {
    if (!width) return 1;
    function curve(t) {
      var x = (t - BEST_TEMP) / width;
      return Math.exp(-0.5 * x * x);
    }
    return curve(season + T) / curve(season);
  }

  function Region(r) {
    this.r = r;
    this.wood = r.wood;
    this.woodYears = r.wood / (r.woodShare * r.growth);
    this.litter = r.growth * r.litterYears;
    var intoSoil = (1 - r.respired) * r.growth;
    this.soil = intoSoil * r.soilYears;
    this.soilSupply = intoSoil;
    this.stable = r.stabilised * intoSoil * r.stableYears;
    this.forest = 1; this.soilBuilding = 1;
    this.young = 0; this.oldForest = null; this.youngForest = null;
    this.atStart = null;
  }

  Region.prototype.carbon = function () {
    return this.wood + this.litter + this.soil + this.stable;
  };

  /* Land use this year: clear, abandon and harvest (old and young forest
   * kept apart). Only changes since 1750 count. Returns carbon sent to
   * the air at once, GtC. */
  Region.prototype.landUse = function (use, strength, N) {
    var displaced = Math.min(0.95, strength * use.farmed);
    var soilLost = Math.min(0.95, strength * use.cropland * CROP_SOIL_LOSS);
    if (this.atStart === null) {
      this.atStart = { displaced: displaced, soilLost: soilLost, use: use };
      this.oldForest = use.old; this.youngForest = use.young;
      this.young = this.wood * (YOUNG_WOOD * use.young /
        (use.old + YOUNG_WOOD * use.young));
    }
    var start = this.atStart.use;
    function above(k) { return strength * Math.max(0, use[k] - start[k]); }
    var oldWood = this.wood - this.young;
    var fromOld = this.oldForest > 0 ? Math.min(oldWood,
      oldWood * above('clearedOld') / Math.max(this.oldForest, 1e-9)) : 0;
    var fromYoung = Math.min(this.young,
      this.young * above('clearedYoung') / Math.max(this.youngForest, 1e-9));
    var cutOld = Math.min(0.5 * (oldWood - fromOld), above('harvestOld'));
    var cutYoung = Math.min(0.5 * (this.young - fromYoung), above('harvestYoung'));
    var toAir = BURNT * (fromOld + fromYoung) + USED * (cutOld + cutYoung);
    var removed = fromOld + fromYoung + cutOld + cutYoung;
    this.wood -= removed;
    this.young -= fromYoung + cutYoung;
    this.litter += removed - toAir;
    if (N && this.litterN !== undefined) {
      this.litterN += (removed - toAir) / CN.wood;
    }
    // Old forest cut over (not cleared) becomes young forest.
    var became = Math.max(0, this.oldForest - use.clearedOld - use.old);
    if (this.oldForest > 0) {
      this.young += (this.wood - this.young) * Math.min(1, became / this.oldForest);
    }
    this.oldForest = use.old; this.youngForest = use.young;
    this.forest = (1 - displaced) / (1 - this.atStart.displaced);
    this.soilBuilding = (1 - soilLost) / (1 - this.atStart.soilLost);
    return toAir;
  };

  /* Nitrogen in balance with the region's carbon, as before industry. */
  Region.prototype.startNitrogen = function (allowed) {
    var r = this.r;
    var perGrowth = r.woodShare / CN.wood + (1 - r.woodShare) / CN.leaves;
    var uptake = r.growth * perGrowth;              // GtN a year
    this.availableN = uptake;                       // turns over in a year
    this.litterN = uptake * r.litterYears;
    this.releasedN = uptake;
    this.fixedN = N_FIXED_SHARE * uptake;
    this.halfN = this.availableN * (1 - allowed) / allowed;
  };

  /* Growth as nitrogen allows it. Growth needs N in proportion; supply is
   * what is available, fixed, deposited and released by rot. The nitrogen
   * left at the year's end solves a quadratic. */
  Region.prototype.nitrogenGrowth = function (full, perGrowth, deposited) {
    var supply = this.availableN + this.fixedN + deposited + this.releasedN;
    var k = this.halfN, a = 1 + N_FIXED_SHARE;
    var b = a * k + full * perGrowth - supply;
    var left = (-b + Math.sqrt(b * b + 4 * a * supply * k)) / (2 * a);
    this.availableN = left;
    return full * left / (left + k);
  };

  /* One year: grow, die, rot. Returns [growth, respiration], GtC/yr. */
  Region.prototype.step = function (co2Factor, T, s, deposited) {
    var r = this.r;
    var growth = r.growth * co2Factor * tempGrowth(r.season, T, s.width);
    var rot = Math.pow(s.q10, T / 10);
    var withN = s.nitrogen < 1;
    if (withN && this.availableN === undefined) this.startNitrogen(s.nitrogen);

    // Wood: only forest grows it, and a forest above its mature amount
    // keeps less of its growth as wood, none when the room is full.
    var mature = this.forest * r.wood, share = r.woodShare * this.forest;
    if (this.wood > mature) {
      var room = s.room / 100 * mature;
      var used = room > 0 ? (this.wood - mature) / room : 1;
      share *= Math.max(0, 1 - used);
    }
    if (withN) {
      var perGrowth = share / CN.wood + (1 - share) / CN.leaves;
      growth = this.nitrogenGrowth(growth / s.nitrogen, perGrowth, deposited);
    }
    var dieRate = 1 / this.woodYears;
    if (this.youngForest !== null) {
      var youngShare = this.youngForest /
        Math.max(this.youngForest + this.oldForest, 1e-9);
      this.young = (this.young + youngShare * share * growth) / (1 + dieRate);
    }
    this.wood = (this.wood + share * growth) / (1 + dieRate);
    this.young = Math.min(this.young, this.wood);
    var died = dieRate * this.wood;

    // Litter, soil, stable soil: each new pool = (old + arrived) / (1 + rate).
    var litterRate = rot / r.litterYears;
    this.litter = (this.litter + (1 - share) * growth + died) / (1 + litterRate);
    var litterRot = litterRate * this.litter;
    var toSoil = (1 - r.respired) * this.soilBuilding * litterRot;
    var extra = Math.max(1, toSoil / this.soilSupply);
    var soilRate = rot * Math.pow(extra, PRIMING) / r.soilYears;
    this.soil = (this.soil + toSoil) / (1 + soilRate);
    var soilRot = soilRate * this.soil, toStable = r.stabilised * soilRot;
    var stableRate = rot / r.stableYears;
    this.stable = (this.stable + toStable) / (1 + stableRate);
    var stableRot = stableRate * this.stable;

    if (withN) {          // nitrogen comes back as things rot, a year later
      var arriving = (1 - share) * growth / CN.leaves + died / CN.wood;
      this.litterN = (this.litterN + arriving) / (1 + litterRate);
      var fromLitter = litterRate * this.litterN;
      var keptBySoil = Math.min(toSoil / CN.soil, fromLitter);
      this.releasedN = fromLitter - keptBySoil +
        (soilRot - toStable + stableRot) / CN.soil;
    }
    var respiration = (litterRot - toSoil) + (soilRot - toStable) + stableRot;
    return [growth, respiration];
  };

  function Land(start, settings) {
    this.start = start;
    this.s = settings;
    this.regions = REGIONS.map(function (r) { return new Region(r); });
    var area = 0, weighted = 0;
    REGIONS.forEach(function (r) {
      area += r.area; weighted += r.area * r.warmer;
    });
    this.warmer = REGIONS.map(function (r) {
      return r.warmer / (weighted / area);
    });
  }

  Land.prototype.carbon = function () {
    return this.regions.reduce(function (t, g) { return t + g.carbon(); }, 0);
  };

  /* One year. use: this year's land use by region (or null for none);
   * deposited: GtN of nitrogen falling on all land. */
  Land.prototype.step = function (co2, T, use, deposited) {
    var s = this.s, f = co2Growth(co2, this.start, s.co2Boost);
    var out = { growth: 0, respiration: 0, landUse: 0, byRegion: {} };
    for (var i = 0; i < this.regions.length; i++) {
      var g = this.regions[i], name = g.r.name;
      var removed = use ? g.landUse(use[name], s.landUse, s.nitrogen < 1) : 0;
      var gr = g.step(f, this.warmer[i] * T, s, deposited * N_SHARES[name]);
      out.growth += gr[0]; out.respiration += gr[1]; out.landUse += removed;
      out.byRegion[name] = gr[0] - gr[1] - removed;
    }
    out.uptake = out.growth - out.respiration - out.landUse;
    return out;
  };

  /* =====================================================================
   * Step 6. All together, one year at a time.
   * ===================================================================== */

  /* The scenario's numbers for one year: fossil emissions (GtC/yr), smog
   * forcing (W/m², or null to work it out from burning) and every other
   * forcing that isn't CO2. */
  function inputsFor(year, data, scenario, settings) {
    var rec = data.record, i = year - rec.first;
    if (year <= rec.last) {
      var ramp = Math.min(1, Math.max(0, (year - 1950) / 50));
      return {
        fossil: rec.fossil[i] * (1 - ramp * settings.overstated / 100),
        aerosol: rec.aerosol[i], other: rec.other[i]
      };
    }
    var all = data.scenarios, sc = all[scenario];
    var j = Math.min(year, all.last) - all.first;
    return {
      fossil: year > all.last ? 0 : sc.fossil[j],
      aerosol: settings.aerosolFollowsFossil ? null : sc.aerosol[j],
      other: sc.other[j]
    };
  }

  /* Land use in one year, by region. Held as in the last year recorded. */
  function landUseFor(year, data) {
    var lu = data.landUse;
    var i = Math.min(Math.max(year, lu.first), lu.last) - lu.first;
    var out = {};
    REGIONS.forEach(function (r) {
      var col = lu[r.name], row = {};
      for (var k in col) row[k] = col[k][i];
      out[r.name] = row;
    });
    return out;
  }

  /* Run the whole model from 1750 to lastYear. Returns a column for each
   * output, one value a year. */
  /* The page's settings, with the opening ones for any it leaves out. */
  function merged(settings) {
    var s = {}, k;
    for (k in DEFAULTS) s[k] = DEFAULTS[k];
    for (k in settings || {}) s[k] = settings[k];
    return s;
  }

  function run(data, scenario, settings, lastYear) {
    var s = merged(settings);
    var first = data.record.first, start = data.record.co2[0];
    var ocean = new Ocean(start, s.mixing);
    var climate = new Climate(start, s);
    var land = new Land(start, s);
    var air = start * GTC_PER_PPM, air0 = air;
    var out = { year: [], co2: [], T: [], landT: [], fossil: [], ocean: [],
      land: [], landUse: [], growth: [], north: [], tropics: [],
      airC: [], oceanC: [], landC: [], wood: [], soil: [], heat: [],
      imbalance: [], Fco2: [], Faer: [], Fother: [], ph: [] };
    var oceanC0 = ocean.carbon(), landC0 = land.carbon();
    for (var year = first; year <= lastYear; year++) {
      var x = inputsFor(year, data, scenario, s);
      var co2 = air / GTC_PER_PPM;
      var c = climate.step(co2, x.fossil, ocean, x.aerosol, x.other);
      var o = ocean.step(co2, c.T);
      var l = land.step(co2, c.land, landUseFor(year, data),
        N_PER_FOSSIL_GTC * Math.max(0, x.fossil));
      air += x.fossil - o.uptake + (-l.uptake);
      air -= (air - air0) / GEOLOGIC_YEARS;
      out.year.push(year); out.co2.push(co2); out.T.push(c.T);
      out.landT.push(c.land); out.fossil.push(x.fossil);
      out.ocean.push(o.uptake); out.land.push(l.uptake);
      out.landUse.push(l.landUse); out.growth.push(l.growth);
      out.north.push(l.byRegion.boreal + l.byRegion.temperate);
      out.tropics.push(l.byRegion.tropics);
      out.airC.push(air - air0); out.oceanC.push(ocean.carbon() - oceanC0);
      out.landC.push(land.carbon() - landC0);
      out.wood.push(land.regions.reduce(function (t, g) { return t + g.wood; }, 0));
      out.soil.push(land.regions.reduce(function (t, g) {
        return t + g.soil + g.stable; }, 0));
      out.heat.push(ocean.heat()); out.imbalance.push(c.imbalance);
      out.Fco2.push(c.Fco2); out.Faer.push(c.Faer); out.Fother.push(x.other || 0);
      out.ph.push(ocean.ph.low);
    }
    return out;
  }

  /* =====================================================================
   * Step 7. What the land sink is made of.
   * ===================================================================== */

  /* The land alone, given the CO2, land warming and fossil emissions of a
   * whole run (`world`), with one cause held as it was in 1750: 'co2',
   * 'warming', 'nitrogen' (none deposited) or 'landUse'. Returns its net
   * uptake each year, GtC. */
  function landAlone(data, world, settings, without) {
    var s = merged(settings), start = data.record.co2[0];
    var land = new Land(start, s), out = [];
    for (var i = 0; i < world.year.length; i++) {
      var year = world.year[i];
      var co2 = without === 'co2' ? start : world.co2[i];
      var T = without === 'warming' ? 0 : world.landT[i];
      var use = landUseFor(without === 'landUse' ? data.record.first : year, data);
      var fallen = without === 'nitrogen' ? 0 :
        N_PER_FOSSIL_GTC * Math.max(0, world.fossil[i]);
      out.push(land.step(co2, T, use, fallen).uptake);
    }
    return out;
  }

  /* Each cause's share of the land sink: the uptake with everything on,
   * less the uptake without that cause. Shares needn't add up to the whole,
   * because the causes work on each other. */
  function landShares(data, world, settings) {
    var all = landAlone(data, world, settings, null), out = { net: all };
    ['co2', 'warming', 'nitrogen', 'landUse'].forEach(function (cause) {
      var without = landAlone(data, world, settings, cause);
      out[cause] = all.map(function (v, i) { return v - without[i]; });
    });
    return out;
  }

  return {
    DEFAULTS: DEFAULTS, GTC_PER_PPM: GTC_PER_PPM, merged: merged,
    landAlone: landAlone, landShares: landShares,
    splitWarming: splitWarming, polarShare: polarShare,
    constants: constants, chemistry: chemistry, solve: solve,
    co2Growth: co2Growth, tempGrowth: tempGrowth,
    Ocean: Ocean, Climate: Climate, Land: Land, Region: Region,
    REGIONS: REGIONS, inputsFor: inputsFor, landUseFor: landUseFor, run: run
  };
});
