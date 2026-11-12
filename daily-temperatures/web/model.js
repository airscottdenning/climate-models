// A small shift in the average, a big change in the extremes: the science of the
// page. Nothing here touches the page. app.js does the controls and the drawing.
//
// The About tab explains every step, with the same letters:
//   x, z  a threshold, and how many standard deviations above the average it is
//         (step 1)
//   N     the number of days with a good reading (step 2)
//   m, s  their average (mean) and their standard deviation (step 2)
//   n, f  the days beyond the threshold, and their share of all the days (step 3)
//   h     the width of the smoothing that draws the curves (step 4)
//   ΔL, ΔG  the warming of the place and of the globe between the two periods
//         (step 5)
//   k     the place's warming over the globe's (step 5)
//   P     the place's warming for each 1 °C of global warming, from IPCC AR6
//         (step 6)
//   W, Wr the globe's warming since 1850–1900: by 2081–2100 under a scenario, and
//         already there in the place's recent period (step 6)
//   ΔT    the warming still to come at the place by 2081–2100 (step 6)
//   R     how many times as often days go beyond the threshold (step 7)
//
// Daily temperatures are whole numbers of tenths of a °C, as NOAA stores them:
// 37.8 °C is 378. Everything else is in °C.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DailyTemperatures = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Global warming by 2081–2100 since 1850–1900, in °C: the best estimate and the
  // very likely range of IPCC AR6 (Working Group I, Summary for Policymakers,
  // Table SPM.1).
  const SCENARIOS = [
    { id: 'ssp119', name: 'SSP1-1.9', emissions: 'very low',
      warming: 1.4, range: [1.0, 1.8] },
    { id: 'ssp126', name: 'SSP1-2.6', emissions: 'low',
      warming: 1.8, range: [1.3, 2.4] },
    { id: 'ssp245', name: 'SSP2-4.5', emissions: 'intermediate',
      warming: 2.7, range: [2.1, 3.5] },
    { id: 'ssp370', name: 'SSP3-7.0', emissions: 'high',
      warming: 3.6, range: [2.8, 4.6] },
    { id: 'ssp585', name: 'SSP5-8.5', emissions: 'very high',
      warming: 4.4, range: [3.3, 5.7] }
  ];
  const BEFORE_INDUSTRY = [1850, 1900];  // the scenarios count warming from here
  const ENOUGH_YEARS = 10;               // a period needs this many counted years
  const NONE = -32768;                   // "no value" in a station's file
  const UNMATCHED = 20000;               // added to a reading with no partner

  // ---- Step 1 on the About tab: a bell curve and the share beyond a threshold --

  // The height of the bell curve (the normal distribution) at temperature x. The
  // area under the whole curve is 1.
  function bell(x, mean, spread) {
    const z = (x - mean) / spread;
    return Math.exp(-0.5 * z * z) / (spread * Math.sqrt(2 * Math.PI));
  }

  // z = (x − m) / s says how far out the threshold is. The share of the curve above
  // the threshold is the area under it from there on. No formula gives that area,
  // so this adds it up in 2,000 thin slices (Simpson's rule). Beyond 12 standard
  // deviations there is nothing left to add.
  function shareAbove(threshold, mean, spread) {
    const z = (threshold - mean) / spread;
    if (z >= 12) return 0;
    if (z <= -12) return 1;
    const slices = 2000, width = (12 - z) * spread / slices;
    const end = mean + 12 * spread;
    let sum = bell(threshold, mean, spread) + bell(end, mean, spread);
    for (let i = 1; i < slices; i += 1) {
      sum += (i % 2 ? 4 : 2) * bell(threshold + i * width, mean, spread);
    }
    return sum * width / 3;
  }

  // ---- Reading one place's file (build_data.py says what is in it) ----

  function readStation(buffer) {
    const all = new Int16Array(buffer);
    const first = all[1], years = all[2];
    const station = {
      firstYear: first, early: [all[3], all[4]], recent: [all[5], all[6]],
      north: all[7] === 1, yearly: [], days: null, mapChange: null
    };
    // The yearly averages, in °C. null marks a year that doesn't count.
    for (let i = 0; i < years; i += 1) {
      station.yearly.push(all[8 + i] === NONE ? null : all[8 + i] / 1000);
    }
    const length = 122 * (all[4] - all[3] + 1 + all[6] - all[5] + 1);
    station.days = all.subarray(8 + years, 8 + years + length);
    station.mapChange = all.subarray(8 + years + length, 8 + years + length + 2592);
    return station;
  }

  // The years of a period whose yearly average counts: the year is over, and at
  // least 90% of its days, and 80% of every month's, have a good high and a good
  // low.
  function countedYears(station, period) {
    const years = [];
    for (let year = period[0]; year <= period[1]; year += 1) {
      const value = station.yearly[year - station.firstYear];
      if (value !== null && value !== undefined) years.push(year);
    }
    return years;
  }

  // One period's days in one season, in tenths of a °C: the daily lows of the two
  // coldest months (season 'cold') or the daily highs of the two warmest ('warm').
  // North of the equator the cold months are January and February; south of it,
  // July and August. which is 'early' or 'recent'. With a list of years, only those
  // years are read, and only the days that have both a good high and a good low.
  function days(station, which, season, years) {
    const period = station[which];
    const earlyYears = station.early[1] - station.early[0] + 1;
    const start = which === 'early' ? 0 : 122 * earlyYears;
    const janFeb = (season === 'cold') === station.north;
    const values = [];
    for (let year = period[0]; year <= period[1]; year += 1) {
      if (years && years.indexOf(year) < 0) continue;
      const from = start + 122 * (year - period[0]) + (janFeb ? 0 : 60);
      for (let slot = from; slot < from + (janFeb ? 60 : 62); slot += 1) {
        const stored = station.days[slot];
        if (stored === NONE) continue;
        if (stored < UNMATCHED / 2) values.push(stored);
        else if (!years) values.push(stored - UNMATCHED);
      }
    }
    return values;
  }

  // How many days an average month of the season has: 31 for July and August, and
  // 29.5 or 30 for January and February. It turns a share of the days into days a
  // month.
  function daysAMonth(station, season, years) {
    if ((season === 'cold') !== station.north) return 31;
    let total = 0;
    years.forEach(function (year) {
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      total += 31 + (leap ? 29 : 28);
    });
    return total / (2 * years.length);
  }

  // ---- Step 2: the average and the standard deviation of the days ----

  // m = S / N, in °C: the sum of the readings over how many there are.
  function mean(values) {
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) sum += values[i];
    return sum / values.length / 10;
  }

  // s² = D / (N − 1), in °C. D is the sum of the squares of each day's distance
  // from m.
  function spread(values) {
    const m = mean(values) * 10;
    let squares = 0;
    for (let i = 0; i < values.length; i += 1) {
      squares += (values[i] - m) * (values[i] - m);
    }
    return Math.sqrt(squares / (values.length - 1)) / 10;
  }

  // ---- Step 3: the share of the days beyond a threshold ----

  // A threshold the reader set in whole °F or °C, as tenths of a °C. A threshold in
  // °F is rounded to the nearest tenth of a °C, the grain of the readings: 100 °F
  // is 378.
  function tenths(threshold, unit) {
    if (unit === 'F') return Math.round((threshold - 32) / 1.8 * 10);
    return Math.round(threshold * 10);
  }

  // n: how many days are beyond the threshold. Hot days are those above it; cold
  // days are those at or below it. warming (°C) is added to every day first; leave
  // it out for none.
  function daysBeyond(values, threshold, season, warming) {
    const shift = 10 * (warming || 0);
    let n = 0;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] + shift;
      if (season === 'cold' ? value <= threshold : value > threshold) n += 1;
    }
    return n;
  }

  // Where the threshold starts, in whole °F: the multiple of 5 °F nearest the point
  // that one day in ten of the recent period is beyond (its 10th or 90th
  // percentile).
  function startingThreshold(recentValues, season) {
    const ordered = recentValues.slice().sort(function (a, b) { return a - b; });
    const tail = quantile(ordered, season === 'cold' ? 0.1 : 0.9) / 10 * 1.8 + 32;
    return 5 * Math.floor(tail / 5 + 0.5);
  }

  // ---- Step 4: the smooth curve drawn through the days ----

  // The value a given share of the ordered values lie below, filling in between
  // two of them.
  function quantile(ordered, share) {
    const place = (ordered.length - 1) * share;
    const lower = Math.floor(place), upper = Math.ceil(place);
    return ordered[lower] + (place - lower) * (ordered[upper] - ordered[lower]);
  }

  // h = 0.9 A / N^0.2, in °C. A is the standard deviation, or the middle half's
  // range over 1.34 if that is smaller. (The default width of the statistics
  // language R.)
  function smoothingWidth(values) {
    const ordered = values.slice().sort(function (a, b) { return a - b; });
    const s = spread(values);
    const middle = (quantile(ordered, 0.75) - quantile(ordered, 0.25)) / 10;
    let A = Math.min(s, middle / 1.34);
    if (A <= 0) A = s || 1;
    return 0.9 * A / Math.pow(values.length, 0.2);
  }

  // The curve's height at each temperature in xs (°C): every day becomes a little
  // bell curve of width h (a Gaussian kernel), and the curve is their average. Its
  // height is a share of the days per °C, so the area under the whole curve is 1.
  function smoothCurve(values, h, xs) {
    return xs.map(function (x) {
      let sum = 0;
      for (let i = 0; i < values.length; i += 1) {
        const z = (x - values[i] / 10) / h;
        sum += Math.exp(-0.5 * z * z);
      }
      return sum / (values.length * h * Math.sqrt(2 * Math.PI));
    });
  }

  // ---- Step 5: how much the place and the globe warmed between the periods ----

  // The average of a yearly series over some years. first is the series' first
  // year.
  function averageOver(series, first, years) {
    let sum = 0;
    years.forEach(function (year) { sum += series[year - first]; });
    return sum / years.length;
  }

  // ΔL and ΔG, and k = ΔL / ΔG, the place's warming over the globe's. Both use the
  // same years: those of each period in which the place's yearly average counts.
  // world is the global record ({first, anomaly}). k is left out if the globe
  // changed by less than 0.1 °C.
  function localAndGlobal(station, world) {
    const early = countedYears(station, station.early);
    const recent = countedYears(station, station.recent);
    const result = { earlyYears: early, recentYears: recent,
      enough: early.length >= ENOUGH_YEARS && recent.length >= ENOUGH_YEARS };
    if (!early.length || !recent.length) return result;
    const side = function (series, first) {
      const before = averageOver(series, first, early);
      const after = averageOver(series, first, recent);
      return { early: before, recent: after, change: after - before };
    };
    result.local = side(station.yearly, station.firstYear);
    result.global = side(world.anomaly, world.first);
    result.ratio = Math.abs(result.global.change) >= 0.1
      ? result.local.change / result.global.change : null;
    return result;
  }

  // ---- Step 6: the warming still to come at the place ----

  // Wr: how much warmer the globe was in some years than in 1850–1900, in °C.
  function warmingSince1850(world, years) {
    const base = [];
    for (let y = BEFORE_INDUSTRY[0]; y <= BEFORE_INDUSTRY[1]; y += 1) base.push(y);
    return averageOver(world.anomaly, world.first, years)
      - averageOver(world.anomaly, world.first, base);
  }

  // ΔT = P (W − Wr): the scenario's global warming by 2081–2100 (W), less the
  // global warming the recent period had already seen (Wr), times the place's
  // pattern factor (P).
  function addedWarming(P, scenarioWarming, recentWarming) {
    return P * (scenarioWarming - recentWarming);
  }

  // ---- Step 7: how many times as often ----

  // R = f2 / f1. With no such day in the first set, there is nothing to divide by.
  function timesAsOften(later, earlier) {
    return earlier > 0 ? later / earlier : null;
  }

  return {
    SCENARIOS: SCENARIOS, BEFORE_INDUSTRY: BEFORE_INDUSTRY,
    ENOUGH_YEARS: ENOUGH_YEARS, bell: bell, shareAbove: shareAbove,
    readStation: readStation, countedYears: countedYears, days: days,
    daysAMonth: daysAMonth, mean: mean, spread: spread, tenths: tenths,
    daysBeyond: daysBeyond, startingThreshold: startingThreshold,
    quantile: quantile, smoothingWidth: smoothingWidth, smoothCurve: smoothCurve,
    averageOver: averageOver, localAndGlobal: localAndGlobal,
    warmingSince1850: warmingSince1850, addedWarming: addedWarming,
    timesAsOften: timesAsOften
  };
}));
