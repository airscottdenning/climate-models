/* Emission budget model: the page. model.js is the science. This file is the slider, the graphs and the words
 * under them. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.EmissionBudget;
  var VIEWS = ['model', 'about'];
  var DEFAULTS = { view: 'model', r: 2 };    // the page opens with the emissions cut 2% a year
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var NONE = '#6b7780', YOURS = '#00795a', LIMIT = '#b2182b';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var cursor = null;    // the year being read, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var showSlider = null;

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function commas(x, places) {
    return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
  }
  function warmth(t) { return commas(t, 1) + NB + '°C (' + commas(t * 1.8, 1) + NB + '°F)'; }

  /* The two runs on the page: yours, and no cuts at all. */
  var none = M.run(0), last = {};
  function yours() {
    if (last.r !== state.r) last = { r: state.r, run: M.run(state.r) };
    return last.run;
  }

  // ---- The slider ----

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

  function tickText(value, gap) {
    var places = Math.max(0, -Math.floor(Math.log(gap) / Math.LN10 + 1e-9));
    return commas(value, places);
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
        widest = Math.max(widest, ctx.measureText(tickText(v, sc.gap)).width);
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
        text(ctx, tickText(v, sc.gap), x0 - 7, py(v), { align: 'right', baseline: 'middle' });
      }
      line(x0, y1, x0, y0, SPINE);
      // A tick every ten years from 2030, with every other one labeled on a narrow screen.
      for (var year = Math.ceil(first / 10) * 10; year <= first + span; year += 10) {
        line(px(year), y0, px(year), y0 + 5, SPINE);
        if (!narrow || year % 20 === 0) text(ctx, String(year), px(year), y0 + 18, { align: 'center' });
      }
      text(ctx, panel.title, narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
      (panel.marks || []).forEach(function (mark) {
        if (mark.at > sc.ceiling) return;
        ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
        line(x0, py(mark.at), x1, py(mark.at), LIMIT); ctx.setLineDash([]);
        text(ctx, mark.label, x1 - 6, py(mark.at) + (mark.below ? 15 : -6),
          { size: 12, bold: true, color: LIMIT, halo: '#ffffff', align: 'right' });
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

  function drawGraphs(y) {
    drawStack('graph', [
      { title: 'Carbon emissions from fossil fuels and land use (GtC a year)',
        series: [{ values: none.E, color: NONE, width: 2 }, { values: y.E, color: YOURS, width: 2.6 }] },
      { title: 'Warming since the late 1800s (°C)', low: 1,
        series: [{ values: none.T, color: NONE, width: 2 }, { values: y.T, color: YOURS, width: 2.6 }],
        marks: [{ at: M.LIMIT, label: '2 °C above preindustrial' }] }
    ], y.year);
  }

  // ---- The words under the graphs ----

  function readout(y) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var n = cursor - M.START;
    return 'In ' + cursor + ', with no cuts, the world emits ' + commas(none.E[n], 2) + NB + 'GtC, ' +
      commas(none.S[n], 0) + NB + 'GtC has been emitted in all and the warming is ' + commas(none.T[n], 2) + NB +
      '°C. With your cuts, the world emits ' + commas(y.E[n], 2) + NB + 'GtC, ' + commas(y.S[n], 0) + NB +
      'GtC has been emitted in all and the warming is ' + commas(y.T[n], 2) + NB + '°C.';
  }

  /* The year the warming reaches 2 °C, in words. */
  function passes(run) {
    return run.limitYear ? 'passes 2' + NB + '°C in ' + run.limitYear : 'stays below 2' + NB + '°C through 2100';
  }

  function summary(y) {
    var n = M.END - M.START;
    var words = 'With no cuts, the warming ' + passes(none) + ' and reaches ' + warmth(none.T[n]) + ' in 2100. ';
    if (state.r === 0) return words + 'Your line is the same: with no cuts, the warming never stops rising.';
    return words + 'Cutting ' + commas(state.r, 1) + '% a year, the emissions fall to ' + commas(y.E[n], 2) + NB +
      'GtC a year by 2100, and the warming ' + passes(y) + ' and reaches ' + warmth(y.T[n]) + ' in 2100. ' +
      'If the cuts go on after 2100, ' + commas(M.forever(state.r), 0) + NB + 'GtC will be emitted in all, ' +
      'and the warming ends at ' + warmth(y.finalT) + '.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var y = yours();
    drawGraphs(y); say('readout', readout(y)); say('summary', summary(y));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    var view = params.get('view'), r = parseFloat(params.get('r'));
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    if (isFinite(r)) state.r = +clamp(Math.round(r * 10) / 10, +$('r').min, +$('r').max).toFixed(1);
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
    requestAnimationFrame(function () { pending = false; showSlider(); saveToAddress(); draw(); });
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

  /* Read the graph at the pointer, or move along it with the keys. */
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
    showSlider = pair('r');

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    $('reset').addEventListener('click', function () { state.r = DEFAULTS.r; changed(); });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    $('graph').addEventListener('pointermove', point);
    $('graph').addEventListener('pointerdown', point);
    $('graph').addEventListener('keydown', keys);
    window.addEventListener('resize', changed);

    showSlider();
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
