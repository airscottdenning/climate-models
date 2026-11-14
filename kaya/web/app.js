/* Kaya model: the page. model.js is the science. This file is the controls, the graphs and the words under
 * them. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Kaya;
  var VIEWS = ['climate', 'economy', 'about'];
  // What the page shows when the address says nothing: the intensities falling faster than their
  // 2000-2024 pace, enough for about 3 °C in 2100 (Scott, 13 November 2026), and Sachs's catch-up growth.
  var DEFAULTS = { view: 'climate', a: 1.2, b: 2, k: 1.4 };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var TREND = '#6b7780', YOURS = '#00795a';
  var GROUPS = [
    { name: 'Richest tenth', color: '#0072b2' },
    { name: 'Middle eight tenths', color: '#d55e00' },
    { name: 'Poorest tenth', color: '#9b4f96' }
  ];
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var cursor = null;    // the year being read, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function commas(x, places) {
    return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
  }
  function dollars(x) { return '$' + commas(x, 0); }
  function warmth(t) { return commas(t, 1) + NB + '°C (' + commas(t * 1.8, 1) + NB + '°F)'; }

  /* The two runs on the page: yours, and the same with the intensities at their 2000-2024 pace. */
  var last = {};
  function runs() {
    var key = [state.a, state.b, state.k].join(',');
    if (last.key !== key) {
      last = { key: key, yours: M.run({ a: state.a, b: state.b, k: state.k }),
        trend: M.run({ a: M.TRENDS.a, b: M.TRENDS.b, k: state.k }) };
    }
    return last;
  }

  // ---- The controls ----

  /* A slider and a number box that hold the same number, to one decimal place. */
  function pair(key) {
    var number = $(key), range = $(key + '-range');
    function put() { number.value = range.value = state[key].toFixed(1); }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = +clamp(Math.round(value * 10) / 10, +number.min, +number.max).toFixed(1);
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  function showAll() { Object.keys(show).forEach(function (key) { show[key](); }); }

  // ---- The graphs ----

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
    return { ctx: ctx, w: w, h: h };
  }

  /* Words on the graph. `halo` is the color behind them: it keeps a line from running through the letters. */
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

  /* A round size for the gap between gridlines, so that about `count` of them cover `span`. */
  function roundGap(span, count) {
    var raw = span / count, power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  }

  function tickText(value, gap, money) {
    var places = Math.max(0, -Math.floor(Math.log(gap) / Math.LN10 + 1e-9));
    return (money ? '$' : '') + commas(value, places);
  }

  /* A graph's scale: from `low` (0 unless a panel says otherwise) to a round number above every value. */
  function scaleOf(panel) {
    var high = -Infinity;
    panel.series.forEach(function (s) { s.values.forEach(function (v) { high = Math.max(high, v); }); });
    var low = panel.low === undefined ? 0 : panel.low;
    var gap = roundGap(Math.max(high - low, 1e-9), 4);
    return { low: low, gap: gap, ceiling: low + Math.ceil((high - low) / gap - 1e-9) * gap };
  }

  /* A stack of graphs that share the years along the bottom. Each panel has a title, a unit and lines. */
  function drawStack(canvasId, panels, years) {
    var c = prepare($(canvasId)), ctx = c.ctx, narrow = c.w < 560;
    var scales = panels.map(scaleOf);
    ctx.font = '13px ' + FONT;
    var widest = 0;
    scales.forEach(function (sc, i) {
      for (var v = sc.low; v <= sc.ceiling + sc.gap / 2; v += sc.gap) {
        widest = Math.max(widest, ctx.measureText(tickText(v, sc.gap, panels[i].money)).width);
      }
    });
    var count = panels.length, top = 30, bottom = 44, between = 56;
    var x0 = Math.ceil(widest) + 14, x1 = c.w - (narrow ? 14 : 24);
    var each = (c.h - top - bottom - (count - 1) * between) / count;
    var first = years[0], span = years[years.length - 1] - first;
    plot = { x0: x0, x1: x1, first: first, span: span };
    function px(year) { return x0 + (year - first) / span * (x1 - x0); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    var pys = [];
    panels.forEach(function (panel, index) {
      var y1 = top + index * (each + between), y0 = y1 + each, sc = scales[index];
      function py(v) { return y0 - (v - sc.low) / (sc.ceiling - sc.low) * (y0 - y1); }
      pys.push(py);
      ctx.lineWidth = 1;
      for (var v = sc.low; v <= sc.ceiling + sc.gap / 2; v += sc.gap) {
        line(x0, py(v), x1, py(v), Math.abs(v - sc.low) < sc.gap / 2 ? SPINE : GRID);
        text(ctx, tickText(v, sc.gap, panel.money), x0 - 7, py(v), { align: 'right', baseline: 'middle' });
      }
      line(x0, y1, x0, y0, SPINE);
      for (var year = first; year <= first + span; year += 25) {
        line(px(year), y0, px(year), y0 + 5, SPINE);
        text(ctx, String(year), px(year), y0 + 18, { align: 'center' });
      }
      text(ctx, panel.title, narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
      (panel.marks || []).forEach(function (mark) {
        if (mark.at > sc.ceiling) return;
        ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        line(x0, py(mark.at), x1, py(mark.at), SPINE); ctx.setLineDash([]);
        text(ctx, mark.label, x1 - 6, py(mark.at) + (mark.below ? 13 : -5),
          { size: 12, color: TICK, halo: '#ffffff', align: 'right' });
      });
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y1 - 3, x1 - x0, y0 - y1 + 3); ctx.clip();
      panel.series.forEach(function (s) {
        ctx.beginPath();
        s.values.forEach(function (v, k) { ctx[k ? 'lineTo' : 'moveTo'](px(years[k]), py(v)); });
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2; ctx.lineJoin = 'round';
        ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.restore();
    });
    text(ctx, 'Year', (x0 + x1) / 2, c.h - 6, { align: 'center', color: INK });

    if (cursor === null) return;
    var at = cursor - first, x = px(cursor);
    ctx.lineWidth = 1;
    panels.forEach(function (panel, index) {
      var y1 = top + index * (each + between);
      line(x, y1, x, y1 + each, INK);
      panel.series.forEach(function (s) {
        ctx.beginPath(); ctx.arc(x, pys[index](s.values[at]), 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = s.color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    });
  }

  function drawClimate(r) {
    function both(get) {
      return [{ values: get(r.trend), color: TREND, dash: [7, 5] }, { values: get(r.yours), color: YOURS, width: 2.6 }];
    }
    drawStack('climate', [
      { title: 'Carbon emissions from fossil fuels (GtC a year)', series: both(function (x) { return x.world.F; }) },
      { title: 'CO₂ in the air (ppm)', low: 400, series: both(function (x) { return x.co2; }) },
      { title: 'Warming since the late 1800s (°C)', series: both(function (x) { return x.T; }),
        marks: [{ at: 1.5, label: '1.5 °C', below: true }, { at: 2, label: '2 °C' }] }
    ], r.yours.year);
  }

  function drawEconomy(r) {
    var x = r.yours;
    function groups(get) {
      return GROUPS.map(function (g, i) { return { values: get(i), color: g.color }; });
    }
    function world(values) { return { values: values, color: INK, width: 3 }; }
    drawStack('economy', [
      { title: 'People (billions)', series: [world(x.world.P)].concat(groups(function (i) { return x.P[i]; })) },
      { title: 'Income per person (dollars a year)', money: true,
        series: groups(function (i) { return x.y[i]; }).concat([world(x.world.y)]) },
      { title: 'Energy use (EJ a year)', series: [world(x.world.energy)].concat(groups(function (i) {
        return x.energy[i]; })) },
      { title: 'Carbon emissions (GtC a year)', series: [world(x.world.F)].concat(groups(function (i) {
        return x.F[i]; })) }
    ], x.year);
  }

  // ---- The words under the graphs ----

  function climateReadout(r) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var n = cursor - M.START, t = r.trend, y = r.yours;
    return 'In ' + cursor + ', at the 2000–2024 pace, the world emits ' + commas(t.world.F[n], 2) + NB +
      'GtC, the air holds ' + commas(t.co2[n], 1) + NB + 'ppm of CO₂ and the warming is ' +
      commas(t.T[n], 2) + NB + '°C. With your choices, the world emits ' + commas(y.world.F[n], 2) + NB +
      'GtC, the air holds ' + commas(y.co2[n], 1) + NB + 'ppm and the warming is ' + commas(y.T[n], 2) +
      NB + '°C.';
  }

  function economyReadout(r) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var n = cursor - M.START, x = r.yours;
    return 'In ' + cursor + ', the world has ' + commas(x.world.P[n], 2) + NB + 'billion people, earning ' +
      dollars(x.world.y[n]) + ' a person on average. The richest tenth earn ' + dollars(x.y[0][n]) +
      ' a person, the middle eight tenths ' + dollars(x.y[1][n]) + ' and the poorest tenth ' +
      dollars(x.y[2][n]) + '. The world uses ' + commas(x.world.energy[n], 0) + NB + 'EJ of energy and emits ' +
      commas(x.world.F[n], 2) + NB + 'GtC.';
  }

  /* The first year the warming reaches 2 °C, in words. */
  function passes(run) {
    for (var n = 0; n < run.T.length; n++) if (run.T[n] >= 2) return 'passes 2' + NB + '°C in ' + run.year[n];
    return 'stays below 2' + NB + '°C through 2100';
  }

  function climateSummary(r) {
    var n = M.END - M.START, t = r.trend, y = r.yours;
    return 'In 2100, at the 2000–2024 pace, the world emits ' + commas(t.world.F[n], 1) + NB + 'GtC a year, ' +
      'the air holds ' + commas(t.co2[n], 0) + NB + 'ppm of CO₂, and the warming is ' + warmth(t.T[n]) +
      '. With your choices, the world emits ' + commas(y.world.F[n], 1) + NB + 'GtC a year, the air holds ' +
      commas(y.co2[n], 0) + NB + 'ppm, and the warming is ' + warmth(y.T[n]) + '. At the 2000–2024 pace, ' +
      'the warming ' + passes(t) + '. With your choices, it ' + passes(y) + '.';
  }

  function economySummary(r) {
    var x = r.yours, n = M.END - M.START, peak = 0;
    for (var i = 1; i <= n; i++) if (x.world.P[i] > x.world.P[peak]) peak = i;
    var people = 'In 2100, the world has ' + commas(x.world.P[n], 1) + NB + 'billion people' +
      (peak < n ? ', after a peak of ' + commas(x.world.P[peak], 1) + NB + 'billion in ' + x.year[peak] : '') + '. ';
    return people + 'The richest tenth earn ' + dollars(x.y[0][n]) + ' a person, the middle eight tenths ' +
      dollars(x.y[1][n]) + ' and the poorest tenth ' + dollars(x.y[2][n]) + ', and the world\'s income is $' +
      commas(x.world.income[n], 0) + NB + 'trillion a year. It uses ' + commas(x.world.energy[n], 0) +
      NB + 'EJ of energy a year, against ' + commas(x.world.energy[0], 0) + NB + 'EJ in 2025.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var r = runs();
    if (state.view === 'climate') {
      drawClimate(r); say('climate-readout', climateReadout(r)); say('climate-summary', climateSummary(r));
    } else {
      drawEconomy(r); say('economy-readout', economyReadout(r)); say('economy-summary', economySummary(r));
    }
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key), number = parseFloat(value);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (!isFinite(number)) return;
      state[key] = +clamp(Math.round(number * 10) / 10, +$(key).min, +$(key).max).toFixed(1);
    });
    if (VIEWS.indexOf(state.view) < 0) state.view = DEFAULTS.view;
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] === DEFAULTS[key]) return;
      parts.push(key + '=' + encodeURIComponent(state[key]));
    });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    // On the About tab, the address keeps the place on the tab as well.
    try {
      history.replaceState(null, '', query + (state.view === 'about' ? location.hash : ''));
    } catch (error) { /* some embedded pages can't */ }
    $('open-link').href = '?' + parts.filter(function (p) { return p !== 'embed=1'; }).join('&');
  }

  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; showAll(); saveToAddress(); draw(); });
  }

  function selectView(view, focus) {
    state.view = view;
    VIEWS.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + name).hidden = !on;
      if (on && focus) tab.focus();
    });
    $('workbench').hidden = $('notes').hidden = view === 'about';
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
      pre.textContent = 'The code didn\'t load. Check your connection, then close this and open it again.';
    });
  }

  /* An address can point at a place on the About tab, such as ?view=about#about-equations. Go there. */
  function goToAddressPlace() {
    var place = state.view === 'about' && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
  }

  /* Read a graph at the pointer, or move along it with the keys. */
  function point(event) {
    if (!plot) return;
    var box = event.currentTarget.getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = M.START + Math.round(clamp(along, 0, 1) * (M.END - M.START));
    changed();
  }

  function keys(event) {
    var by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (by === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    // The first press starts in 2050. With Shift, each press is ten years.
    var at = cursor === null ? 2050 : cursor + by * (event.shiftKey ? 10 : 1);
    if (event.key === 'Home') at = M.START;
    if (event.key === 'End') at = M.END;
    cursor = clamp(at, M.START, M.END);
    changed();
  }

  function start() {
    readAddress();
    ['a', 'b', 'k'].forEach(function (key) { show[key] = pair(key); });

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    $('reset').addEventListener('click', function () {
      state.a = DEFAULTS.a; state.b = DEFAULTS.b; state.k = DEFAULTS.k;
      changed();
    });
    $('pace').addEventListener('click', function () {
      state.a = M.TRENDS.a; state.b = M.TRENDS.b;
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    ['climate', 'economy'].forEach(function (id) {
      $(id).addEventListener('pointermove', point);
      $(id).addEventListener('pointerdown', point);
      $(id).addEventListener('keydown', keys);
    });
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
