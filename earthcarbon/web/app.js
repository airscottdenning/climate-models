/* Where the carbon goes: the page. model.js is the science. This file is the
 * controls, the four graphs and the words under them. It works out nothing
 * about the carbon or the climate itself: every number it shows comes from
 * model.js or from the data files. */
(function () {
  'use strict';

  var M = window.EarthCarbon;
  var VIEWS = ['past', 'future', 'carbon', 'land', 'about'];
  var GRAPHS = ['past', 'future', 'carbon', 'land'];
  var SLIDERS = ['sensitivity', 'aerosol', 'mixing', 'co2Boost', 'room', 'nitrogen',
    'q10', 'width', 'landUse', 'overstated'];
  var PLACES = { sensitivity: 1, aerosol: 2, mixing: 0, co2Boost: 0, room: 0,
    nitrogen: 2, q10: 1, width: 0, landUse: 2, overstated: 0 };
  // What the page shows when the address says nothing: the model's best
  // estimates (model.js), SSP2-4.5 and the years up to 2300.
  var DEFAULTS = { view: 'past', scenario: 'ssp245', until: 2300, smog: 0 };
  SLIDERS.forEach(function (key) { DEFAULTS[key] = M.DEFAULTS[key]; });
  var GROUPS = ['scenario', 'climate', 'ocean', 'land', 'record'];
  var SCENARIOS = ['ssp119', 'ssp126', 'ssp534-over', 'ssp245', 'ssp370', 'ssp585'];
  var COLOR = { ssp119: '#009e73', ssp126: '#0072b2', ssp245: '#e69f00',
    ssp370: '#d55e00', 'ssp534-over': '#56b4e9', ssp585: '#882255' };
  var KEY_CLASS = { ssp119: 's119', ssp126: 's126', ssp245: 's245', ssp370: 's370',
    'ssp534-over': 's534', ssp585: 's585' };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var MEASURED = '#87959e', AIR = '#d55e00', OCEAN = '#0072b2', LAND = '#009e73';
  var CAUSE = { co2: '#009e73', nitrogen: '#882255', warming: '#d55e00',
    landUse: '#8a6d3b' };
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ' +
    '"Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit together

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var data = null;
  var cursor = { past: null, future: null, carbon: null, land: null };
  var plots = {};
  var show = {};

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  /* A number to so many places, with a real minus sign and no sign on zero. */
  function fixed(x, digits) {
    var t = x.toFixed(digits);
    return (parseFloat(t) === 0 ? (0).toFixed(digits) : t).replace('-', '−');
  }
  function signed(x, digits) { return (x > 0 ? '+' : '') + fixed(x, digits); }
  function settings() {
    var s = { aerosolFollowsFossil: !!state.smog };
    SLIDERS.forEach(function (key) { s[key] = state[key]; });
    return s;
  }

  // ---- The model's answers, kept until a setting changes ----

  var kept = {};
  function cached(name, key, work) {
    if (!kept[name] || kept[name].key !== key) kept[name] = { key: key, value: work() };
    return kept[name].value;
  }
  function settingsKey() {
    return SLIDERS.map(function (k) { return state[k]; }).join(',') + ',' + state.smog;
  }
  /* The chosen scenario, to the last year shown. */
  function chosen() {
    var key = settingsKey() + state.scenario + state.until;
    return cached('chosen', key, function () {
      return M.run(data, state.scenario, settings(), state.until);
    });
  }
  /* Every scenario, for the second view. */
  function every() {
    var key = settingsKey() + state.until;
    return cached('every', key, function () {
      var out = {};
      SCENARIOS.forEach(function (name) {
        out[name] = name === state.scenario ? chosen() :
          M.run(data, name, settings(), state.until);
      });
      return out;
    });
  }
  /* The land sink's causes, for the fourth view. */
  function shares() {
    var key = settingsKey() + state.scenario + state.until;
    return cached('shares', key, function () {
      return M.landShares(data, chosen(), settings());
    });
  }

  // ---- Controls ----

  function pair(key) {
    var number = $(key), range = $(key + '-range'), places = PLACES[key];
    function put() {
      number.value = range.value = state[key].toFixed(places);
      range.setAttribute('aria-valuetext', fixed(state[key], places));
    }
    function take(source) {
      var value = parseFloat(source.value), step = +number.step;
      if (!isFinite(value)) { put(); return; }
      state[key] = +clamp(Math.round(value / step) * step,
        +number.min, +number.max).toFixed(4);
      showAll();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  function showAll() {
    Object.keys(show).forEach(function (key) { show[key](); });
    $('scenario').value = state.scenario;
    $('until').value = String(state.until);
    $('smog').checked = !!state.smog;
  }

  /* Move the controls into a view. The future's group shows on the views
   * that look ahead. On a phone only the first group starts open. */
  var opened = {};
  function arrange(view) {
    if (GRAPHS.indexOf(view) < 0) return;
    $('panel-' + view).querySelector('.slot').appendChild($('controls'));
    $('group-scenario').hidden = view === 'past';
    var narrow = window.matchMedia('(max-width: 760px)').matches;
    GROUPS.forEach(function (name, at) {
      var group = $('group-' + name);
      if (name in opened) group.open = opened[name];
      else group.open = narrow ? at < 2 : true;
    });
  }

  // ---- Drawing ----

  function prepare(canvas) {
    var box = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    var w = Math.max(50, box.width), h = Math.max(50, box.height);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h, narrow: w < 560 };
  }

  function text(ctx, string, x, y, options) {
    options = options || {};
    ctx.font = (options.bold ? '600 ' : '') + (options.size || 13) + 'px ' + FONT;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    if (options.halo) {
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = options.halo;
      ctx.strokeText(string, x, y);
    }
    ctx.fillStyle = options.color || TICK;
    ctx.fillText(string, x, y);
  }

  function line(ctx, xa, ya, xb, yb, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
  }

  function roundGap(span, count) {
    var raw = span / count;
    var power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  }

  /* The range a set of lines needs, with a little room, and zero in it if
   * `withZero`. */
  function span(lines, from, to, withZero) {
    var lo = withZero ? 0 : Infinity, hi = withZero ? 0 : -Infinity;
    lines.forEach(function (l) {
      for (var y = from; y <= to; y++) {
        var v = l.values[y - l.first];
        if (v === null || v === undefined || !isFinite(v)) continue;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    });
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var pad = 0.06 * (hi - lo);
    return [lo - (withZero && lo === 0 ? 0 : pad), hi + pad];
  }

  /* One graph inside `box`: gridlines, years along the bottom, a title, and
   * a line for each item of `lines` ({values, first, color, width, dash}). */
  function panel(ctx, box, from, to, lines, title, withZero, yearLabels) {
    var range = span(lines, from, to, withZero), lo = range[0], hi = range[1];
    function px(year) { return box.x0 + (year - from) / (to - from) * (box.x1 - box.x0); }
    function py(v) { return box.y0 - (v - lo) / (hi - lo) * (box.y0 - box.y1); }
    var gap = roundGap(hi - lo, 5), digits = gap < 1 ? 1 : 0, k;
    for (k = Math.ceil(lo / gap - 1e-9); k * gap <= hi + 1e-9; k++) {
      line(ctx, box.x0, py(k * gap), box.x1, py(k * gap), k === 0 ? SPINE : GRID);
      text(ctx, fixed(k * gap, digits), box.x0 - 7, py(k * gap),
        { align: 'right', baseline: 'middle' });
    }
    line(ctx, box.x0, box.y1, box.x0, box.y0, SPINE);
    var every = roundGap(to - from, box.x1 - box.x0 < 400 ? 4 : 7);
    for (var year = Math.ceil(from / every) * every; year <= to; year += every) {
      line(ctx, px(year), box.y0, px(year), box.y0 + 5, SPINE);
      if (yearLabels) text(ctx, String(year), px(year), box.y0 + 19, { align: 'center' });
    }
    // A title is [long, short]; the short one is for a narrow screen.
    text(ctx, box.x1 - box.x0 < 420 ? title[1] : title[0], box.x0, box.y1 - 8,
      { bold: true, color: INK });
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x0, box.y1, box.x1 - box.x0, box.y0 - box.y1); ctx.clip();
    lines.forEach(function (l) {
      ctx.beginPath();
      var started = false;
      for (var y = Math.max(from, l.first); y <= to; y++) {
        var v = l.values[y - l.first];
        if (v === null || v === undefined || !isFinite(v)) { started = false; continue; }
        ctx[started ? 'lineTo' : 'moveTo'](px(y), py(v));
        started = true;
      }
      ctx.strokeStyle = l.color; ctx.lineWidth = l.width || 2;
      ctx.lineJoin = 'round'; ctx.setLineDash(l.dash || []); ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.restore();
    return { px: px, py: py };
  }

  /* Boxes for one or two graphs on a canvas. */
  function boxes(c, count) {
    var left = c.narrow ? 46 : 58, right = c.w - (c.narrow ? 20 : 26), top = 30, bottom = c.h - 34;
    if (count === 1) return [{ x0: left, x1: right, y1: top, y0: bottom }];
    var middle = (top + bottom) / 2;
    return [{ x0: left, x1: right, y1: top, y0: middle - 14 },
      { x0: left, x1: right, y1: middle + 26, y0: bottom }];
  }

  /* A thin upright line at the year being read. */
  function marker(ctx, box, px, view) {
    if (cursor[view] === null) return;
    var x = px(cursor[view]);
    line(ctx, x, box.y1, x, box.y0, '#394b57');
  }

  function remember(view, box, from, to) {
    plots[view] = { x0: box.x0, x1: box.x1, from: from, to: to };
  }

  // ---- 1. The past ----

  function measuredCo2() { return { values: data.record.co2, first: data.record.first }; }
  function measuredT() { return { values: data.record.warming, first: data.record.first }; }

  function drawPast() {
    var c = prepare($('past-graph')), b = boxes(c, 2), run = chosen(), r = data.record;
    var from = 1850, to = r.last;
    var top = panel(c.ctx, b[0], from, to, [
      { values: r.co2, first: r.first, color: MEASURED, width: 2 },
      { values: run.co2, first: run.year[0], color: INK, width: 2.6 }
    ], ['Carbon dioxide in the air (ppm)', 'CO₂ in the air (ppm)'], false, false);
    var low = panel(c.ctx, b[1], from, to, [
      { values: r.warming, first: r.first, color: MEASURED, width: 1.6 },
      { values: run.T, first: run.year[0], color: INK, width: 2.6 }
    ], ['Warming since 1850–1900 (°C)', 'Warming (°C)'], true, true);
    marker(c.ctx, b[0], top.px, 'past'); marker(c.ctx, b[1], low.px, 'past');
    remember('past', b[0], from, to);
  }

  function at(series, year) { return series.values[year - series.first]; }

  function pastReadout() {
    var year = cursor.past, run = chosen(), r = data.record;
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, ' +
      'to read values.';
    var i = year - run.year[0], t = at(measuredT(), year);
    return year + ': carbon dioxide ' + fixed(run.co2[i], 1) + NB + 'ppm in the model, ' +
      fixed(r.co2[year - r.first], 1) + NB + 'ppm measured. Warming ' +
      fixed(run.T[i], 2) + NB + '°C in the model' +
      (t === null ? '.' : ', ' + fixed(t, 2) + NB + '°C measured.');
  }

  function budgetSince1850(run) {
    var r = data.record, i0 = 1850 - run.year[0], i1 = r.last - run.year[0];
    var sum = function (values, a, b) { var t = 0; for (var i = a; i <= b; i++) t += values[i]; return t; };
    var j0 = 1850 - r.first, j1 = r.last - r.first;
    return {
      model: {
        burned: sum(run.fossil, i0, i1),
        air: run.airC[i1] - (i0 > 0 ? run.airC[i0 - 1] : 0),
        ocean: sum(run.ocean, i0, i1),
        land: sum(run.land, i0, i1)
      },
      measured: {
        burned: sum(r.fossil, j0, j1),
        ocean: sum(r.oceanSink, j0, j1),
        land: sum(r.netLand, j0, j1),
        air: sum(r.airGrowth, j0, j1)
      }
    };
  }

  function pastTable() {
    var b = budgetSince1850(chosen());
    ['burned', 'air', 'ocean', 'land'].forEach(function (k) {
      say('b-' + k, fixed(b.model[k], 0));
      say('m-' + k, fixed(b.measured[k], 0));
    });
  }

  function pastSummary() {
    var run = chosen(), r = data.record, i = r.last - run.year[0];
    var miss = 0, n = 0;
    for (var y = 1960; y <= r.last; y++) {
      miss += Math.pow(run.co2[y - run.year[0]] - r.co2[y - r.first], 2); n++;
    }
    return 'In ' + r.last + ' the model has ' + fixed(run.co2[i], 0) + NB +
      'ppm of carbon dioxide; ' + fixed(r.co2[r.last - r.first], 0) + NB +
      'ppm was measured. Since 1960 it is off by ' + fixed(Math.sqrt(miss / n), 0) + NB +
      'ppm in a typical year. Warming over the last ten years: ' +
      fixed(mean(run.T, i - 9, i), 2) + NB + '°C in the model, ' +
      fixed(mean(r.warming, r.last - r.first - 9, r.last - r.first), 2) + NB +
      '°C measured.';
  }

  function mean(values, a, b) {
    var t = 0; for (var i = a; i <= b; i++) t += values[i];
    return t / (b - a + 1);
  }

  // ---- 2. The future ----

  function drawFuture() {
    var c = prepare($('future-graph')), b = boxes(c, 2), runs = every(), r = data.record;
    var from = 1850, to = state.until;
    function lines(key) {
      var out = SCENARIOS.filter(function (n) { return n !== state.scenario; })
        .map(function (n) {
          return { values: runs[n][key], first: runs[n].year[0], color: COLOR[n], width: 1.4 };
        });
      out.push({ values: key === 'co2' ? r.co2 : r.warming, first: r.first,
        color: MEASURED, width: 2 });
      out.push({ values: runs[state.scenario][key], first: runs[state.scenario].year[0],
        color: COLOR[state.scenario], width: 3.2 });
      return out;
    }
    var top = panel(c.ctx, b[0], from, to, lines('co2'),
      ['Carbon dioxide in the air (ppm)', 'CO₂ in the air (ppm)'], false, false);
    var low = panel(c.ctx, b[1], from, to, lines('T'),
      ['Warming since 1850–1900 (°C)', 'Warming (°C)'], true, true);
    marker(c.ctx, b[0], top.px, 'future'); marker(c.ctx, b[1], low.px, 'future');
    remember('future', b[0], from, to);
  }

  function futureKey() {
    var html = SCENARIOS.map(function (n) {
      return '<li><span class="line ' + KEY_CLASS[n] + '"></span>' +
        data.scenarios.names[n] + '</li>';
    }).join('') + '<li><span class="line measured"></span>Measured</li>';
    if ($('future-key').innerHTML !== html) $('future-key').innerHTML = html;
  }

  function futureReadout() {
    var year = cursor.future, runs = every();
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, ' +
      'to read values.';
    var i = year - runs[state.scenario].year[0];
    return year + ', ' + data.scenarios.names[state.scenario] + ': carbon dioxide ' +
      fixed(runs[state.scenario].co2[i], 1) + NB + 'ppm, warming ' +
      fixed(runs[state.scenario].T[i], 2) + NB + '°C. Warming in the others: ' +
      SCENARIOS.filter(function (n) { return n !== state.scenario; }).map(function (n) {
        return data.scenarios.names[n] + ' ' + fixed(runs[n].T[i], 1);
      }).join(', ') + NB + '°C.';
  }

  function peakOf(values) {
    var best = 0;
    for (var i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    return best;
  }

  function futureSummary() {
    var run = every()[state.scenario], last = run.year.length - 1;
    var pc = peakOf(run.co2), pt = peakOf(run.T);
    return data.scenarios.names[state.scenario] + ': carbon dioxide peaks at ' +
      fixed(run.co2[pc], 0) + NB + 'ppm in ' + run.year[pc] + ' and is ' +
      fixed(run.co2[last], 0) + NB + 'ppm in ' + run.year[last] + '. Warming peaks at ' +
      fixed(run.T[pt], 2) + NB + '°C in ' + run.year[pt] + ' and is ' +
      fixed(run.T[last], 2) + NB + '°C in ' + run.year[last] + '.';
  }

  // ---- 3. Where the carbon goes ----

  function cumulative(values) {
    var t = 0;
    return values.map(function (v) { t += v; return t; });
  }

  function drawCarbon() {
    var c = prepare($('carbon-graph')), b = boxes(c, 2), run = chosen();
    var from = 1850, to = state.until, first = run.year[0];
    var top = panel(c.ctx, b[0], from, to, [
      { values: cumulative(run.fossil), first: first, color: INK, width: 2, dash: [6, 4] },
      { values: run.airC, first: first, color: AIR, width: 2.6 },
      { values: run.oceanC, first: first, color: OCEAN, width: 2.6 },
      { values: run.landC, first: first, color: LAND, width: 2.6 }
    ], ['Carbon added since 1750 (billion tonnes)', 'Carbon added (billion tonnes)'], true, false);
    var low = panel(c.ctx, b[1], from, to, [
      { values: run.ocean, first: first, color: OCEAN, width: 2.2 },
      { values: run.land, first: first, color: LAND, width: 2.2 }
    ], ['Taken up each year (billion tonnes a year)', 'Taken up (billion tonnes a year)'], true, true);
    marker(c.ctx, b[0], top.px, 'carbon'); marker(c.ctx, b[1], low.px, 'carbon');
    remember('carbon', b[0], from, to);
  }

  function carbonReadout() {
    var year = cursor.carbon, run = chosen();
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, ' +
      'to read values.';
    var i = year - run.year[0], burned = cumulative(run.fossil)[i];
    return year + ': burned so far ' + fixed(burned, 0) + NB + 'billion tonnes of carbon. ' +
      'In the air ' + fixed(run.airC[i], 0) + ', in the ocean ' + fixed(run.oceanC[i], 0) +
      ', in the land ' + fixed(run.landC[i], 0) + '. This year the ocean took up ' +
      fixed(run.ocean[i], 2) + ' and the land ' + fixed(run.land[i], 2) + NB +
      'billion tonnes.';
  }

  function carbonSummary() {
    var run = chosen(), burned = cumulative(run.fossil), last = run.year.length - 1;
    var i2024 = data.record.last - run.year[0];
    return 'Of the carbon burned since 1750, ' +
      fixed(100 * run.airC[i2024] / burned[i2024], 0) + '% was still in the air in ' +
      data.record.last + ', and ' + fixed(100 * run.airC[last] / burned[last], 0) +
      '% is in ' + run.year[last] + ' (' + data.scenarios.names[state.scenario] + ').';
  }

  // ---- 4. The land sink ----

  function smooth(values, half) {
    return values.map(function (v, i) {
      var t = 0, n = 0;
      for (var k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k++) {
        t += values[k]; n++;
      }
      return t / n;
    });
  }

  function drawLand() {
    var c = prepare($('land-graph')), b = boxes(c, 1), s = shares(), first = chosen().year[0];
    var from = 1850, to = state.until, half = to > 2500 ? 10 : 5;
    var lines = ['landUse', 'warming', 'nitrogen', 'co2'].map(function (k) {
      return { values: smooth(s[k], half), first: first, color: CAUSE[k], width: 2 };
    });
    lines.push({ values: smooth(s.net, half), first: first, color: INK, width: 3 });
    var p = panel(c.ctx, b[0], from, to, lines,
      ['Carbon the land takes up (billion tonnes a year)', 'Land uptake (billion t a year)'], true, true);
    marker(c.ctx, b[0], p.px, 'land');
    remember('land', b[0], from, to);
  }

  function landReadout() {
    var year = cursor.land, s = shares();
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, ' +
      'to read values.';
    var i = year - chosen().year[0];
    return year + ': the land takes up ' + signed(s.net[i], 2) + NB +
      'billion tonnes. More CO₂ ' + signed(s.co2[i], 2) + ', nitrogen from burning ' +
      signed(s.nitrogen[i], 2) + ', warming ' + signed(s.warming[i], 2) +
      ', clearing and logging ' + signed(s.landUse[i], 2) + '.';
  }

  function landSummary() {
    var s = shares(), run = chosen(), first = run.year[0], net = smooth(s.net, 5);
    var from = data.record.last - first, peak = from;
    for (var i = from; i < net.length; i++) if (net[i] > net[peak]) peak = i;
    var after = null;
    for (i = peak; i < net.length; i++) if (net[i] < 0) { after = i; break; }
    return data.scenarios.names[state.scenario] + ': after 2024 the land sink is largest in ' +
      run.year[peak] + ', at ' + fixed(net[peak], 2) + NB + 'billion tonnes a year' +
      (after === null ? ', and stays a sink to ' + run.year[run.year.length - 1] + '.' :
        ', and turns to a source in ' + run.year[after] + '.');
  }

  // ---- The words, and the whole page ----

  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function groupWords() {
    say('scenario-now', data ? data.scenarios.names[state.scenario] + ', to ' + state.until : '');
    say('climate-now', fixed(state.sensitivity, 1) + NB + '°C, smog ×' +
      fixed(state.aerosol, 2));
    say('ocean-now', fixed(state.mixing, 0) + ' million m³ a second');
    say('land-now', 'CO₂ ' + state.co2Boost + '%, wood room ' + state.room + '%, Q10 ' +
      fixed(state.q10, 1));
    say('record-now', state.overstated + '% over-reported');
  }

  function draw() {
    groupWords();
    if (!data || state.view === 'about') return;
    if (state.view === 'past') {
      drawPast(); pastTable();
      say('past-readout', pastReadout()); say('past-summary', pastSummary());
    } else if (state.view === 'future') {
      futureKey(); drawFuture();
      say('future-readout', futureReadout()); say('future-summary', futureSummary());
    } else if (state.view === 'carbon') {
      drawCarbon();
      say('carbon-readout', carbonReadout()); say('carbon-summary', carbonSummary());
    } else {
      drawLand();
      say('land-readout', landReadout()); say('land-summary', landSummary());
    }
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    SLIDERS.forEach(function (key) {
      var number = parseFloat(params.get(key)), box = $(key);
      if (!isFinite(number)) return;
      state[key] = +clamp(Math.round(number / +box.step) * +box.step,
        +box.min, +box.max).toFixed(4);
    });
    if (SCENARIOS.indexOf(params.get('scenario')) >= 0) state.scenario = params.get('scenario');
    if (['2100', '2300', '3000'].indexOf(params.get('until')) >= 0) {
      state.until = +params.get('until');
    }
    if (params.get('smog') === '1') state.smog = 1;
    if (VIEWS.indexOf(params.get('view')) >= 0) state.view = params.get('view');
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] !== DEFAULTS[key]) parts.push(key + '=' + encodeURIComponent(state[key]));
    });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    try {
      history.replaceState(null, '', query + (state.view === 'about' ? location.hash : ''));
    } catch (error) { /* some embedded pages can't */ }
    $('open-link').href = '?' + parts.filter(function (p) { return p !== 'embed=1'; }).join('&');
  }

  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; saveToAddress(); draw(); });
  }

  function selectView(view, focus) {
    state.view = view;
    arrange(view);
    VIEWS.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + name).hidden = !on;
      if (on && focus) tab.focus();
    });
    changed();
  }

  /* The code, shown on the About tab: fetched when its section is first opened. */
  function showCode(details) {
    var pre = details.querySelector('pre');
    if (!details.open || pre.dataset.loaded) return;
    pre.dataset.loaded = 'yes';
    pre.textContent = 'Loading…';
    fetch(details.getAttribute('data-src')).then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.text();
    }).then(function (code) { pre.textContent = code; }).catch(function () {
      pre.dataset.loaded = '';
      pre.textContent = 'The code didn\'t load. Check your connection, then close this ' +
        'and open it again.';
    });
  }

  function goToAddressPlace() {
    var reading = state.view === 'about' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
  }

  function yearAt(view, along) {
    var plot = plots[view];
    return Math.round(plot.from + clamp(along, 0, 1) * (plot.to - plot.from));
  }

  function point(view) {
    return function (event) {
      var plot = plots[view];
      if (!plot) return;
      var box = $(view + '-graph').getBoundingClientRect();
      cursor[view] = yearAt(view, (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0));
      changed();
    };
  }

  function keys(view) {
    return function (event) {
      var plot = plots[view], by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!plot || (by === undefined && event.key !== 'Home' && event.key !== 'End')) return;
      event.preventDefault();
      var year = cursor[view] === null ? Math.min(plot.to, data.record.last) :
        cursor[view] + by * (event.shiftKey ? 10 : 1);
      if (event.key === 'Home') year = plot.from;
      if (event.key === 'End') year = plot.to;
      cursor[view] = clamp(year, plot.from, plot.to);
      changed();
    };
  }

  function load(name) {
    return fetch(name).then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    });
  }

  function start() {
    SLIDERS.forEach(function (key) { show[key] = pair(key); });
    readAddress();

    VIEWS.forEach(function (name, place) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: place + 1, ArrowLeft: place - 1, Home: 0,
          End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.next button'), function (button) {
      button.addEventListener('click', function () { selectView(button.dataset.view, true); });
    });
    GROUPS.forEach(function (name) {
      var group = $('group-' + name);
      group.querySelector('summary').addEventListener('click', function () {
        opened[name] = !group.open;
      });
    });
    $('scenario').addEventListener('change', function () {
      state.scenario = this.value; changed();
    });
    $('until').addEventListener('change', function () {
      state.until = +this.value;
      GRAPHS.forEach(function (v) {
        if (cursor[v] !== null) cursor[v] = Math.min(cursor[v], state.until);
      });
      changed();
    });
    $('smog').addEventListener('change', function () {
      state.smog = this.checked ? 1 : 0; changed();
    });
    $('reset').addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (key) {
        if (key !== 'view') state[key] = DEFAULTS[key];
      });
      showAll();
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (d) {
      d.addEventListener('toggle', function () { showCode(d); });
    });
    GRAPHS.forEach(function (view) {
      var canvas = $(view + '-graph');
      canvas.addEventListener('pointermove', point(view));
      canvas.addEventListener('pointerdown', point(view));
      canvas.addEventListener('keydown', keys(view));
    });
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    goToAddressPlace();

    Promise.all([load('record.json'), load('land-use.json'), load('scenarios.json')])
      .then(function (files) {
        data = { record: files[0], landUse: files[1], scenarios: files[2] };
        $('loading').hidden = true;
        changed();
      }).catch(function () {
        $('loading').textContent = 'The data didn\'t load. Please reload the page.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
