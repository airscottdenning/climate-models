/* Watershed model: the page. model.js is the science. This file is the controls, the graphs and the tables. Every
 * number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Watershed;
  var VIEWS = ['model', 'about'];
  var DEFAULTS = { view: 'model', place: 'merced', t: 3, p: 0 };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
              'November', 'December'];
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0', NOW = '#8a959c', LATER = '#c0392b';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function fixed(x, places) { return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }); }
  function place() { for (var i = 0; i < M.PLACES.length; i++) if (M.PLACES[i].id === state.place) return M.PLACES[i]; return M.PLACES[0]; }

  // ---- The controls ----

  function tidy(key, value) {
    var box = $(key), step = +box.step;
    return clamp(Math.round(value / step) * step, +box.min, +box.max);
  }

  function pair(key) {
    var box = $(key), range = $(key + '-range');
    function take(source) {
      var value = parseFloat(source.value);
      if (isFinite(value)) state[key] = tidy(key, value);
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    box.addEventListener('change', function () { take(box); });
  }

  function show() {
    $('place').value = state.place;
    $('place-hint').textContent = place().kind + '.';
    $('t').value = $('t-range').value = state.t.toFixed(1);
    $('p').value = $('p-range').value = String(state.p);
    $('t-f').textContent = 'That\'s ' + fixed(state.t * 1.8, 1) + NB + '°F warmer, every month.';
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

  function text(ctx, string, x, y, options) {
    options = options || {};
    ctx.font = (options.bold ? '600 ' : '') + (options.size || 13) + 'px ' + FONT;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillStyle = options.color || TICK;
    ctx.fillText(string, x, y);
  }

  function roundGap(span, count) {
    var raw = span / count, power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  }

  /* Three panels of the twelve months, each with the 1991-2020 line and the warmer one. */
  function drawGraph(now, later) {
    var c = prepare($('graph')), ctx = c.ctx, narrow = c.w < 560;
    var panels = [['snow', 'Snowpack (mm of water)'], ['S', 'Water in the soil (mm)'], ['R', 'Runoff to the river (mm a month)']];
    var top = 28, gap = 48, bottom = 30, x0 = 44, x1 = c.w - (narrow ? 10 : 18);
    var each = (c.h - top - bottom - gap * (panels.length - 1)) / panels.length;
    function px(k) { return x0 + (k + 0.5) / 12 * (x1 - x0); }
    panels.forEach(function (panel, i) {
      var key = panel[0], y1 = top + i * (each + gap), y0 = y1 + each;
      var high = Math.max.apply(null, now.months.concat(later.months).map(function (m) { return m[key]; }));
      if (key === 'S') high = M.C;
      var step = roundGap(Math.max(high, 1), 3), ceiling = Math.max(step, Math.ceil(high / step) * step);
      function py(v) { return y0 - v / ceiling * (y0 - y1); }
      ctx.lineWidth = 1;
      for (var v = 0; v <= ceiling + step / 2; v += step) {
        ctx.strokeStyle = v ? GRID : SPINE;
        ctx.beginPath(); ctx.moveTo(x0, py(v)); ctx.lineTo(x1, py(v)); ctx.stroke();
        text(ctx, fixed(v, 0), x0 - 6, py(v), { align: 'right', baseline: 'middle' });
      }
      text(ctx, panel[1], narrow ? 4 : x0, y1 - 10, { bold: true, color: INK });
      [[now, NOW, 2], [later, LATER, 2.6]].forEach(function (run) {
        ctx.beginPath();
        run[0].months.forEach(function (m, k) { ctx[k ? 'lineTo' : 'moveTo'](px(k), py(m[key])); });
        ctx.strokeStyle = run[1]; ctx.lineWidth = run[2]; ctx.lineJoin = 'round'; ctx.stroke();
      });
      MONTHS.forEach(function (name, k) {
        if (!narrow || k % 2 === 0) text(ctx, name, px(k), y0 + 15, { align: 'center', size: 12 });
      });
    });
  }

  // ---- The tables ----

  function drawTables(now, later) {
    [['now', now.totals], ['later', later.totals]].forEach(function (pair) {
      var name = pair[0], t = pair[1];
      $(name + '-P').textContent = fixed(t.P, 0) + NB + 'mm';
      $(name + '-E').textContent = fixed(t.E, 0) + NB + 'mm';
      $(name + '-R').textContent = fixed(t.R, 0) + NB + 'mm';
      $(name + '-Ep').textContent = fixed(t.Ep, 0) + NB + 'mm';
      $(name + '-snow').textContent = fixed(t.biggestSnow, 0) + NB + 'mm';
      $(name + '-peak').textContent = LONG[t.peak];
      $(name + '-dry').textContent = String(t.dry);
    });
    var rows = [['Temperature (°C)', 'T', 1], ['Precipitation', 'P', 1], ['Snowfall', 'snowfall', 1], ['Melt', 'melt', 1],
      ['Evaporative demand', 'Ep', 1], ['Evapotranspiration', 'E', 1], ['Snowpack at the end', 'snow', 1],
      ['Soil water at the end', 'S', 1], ['Runoff', 'R', 1]];
    var head = $('months-head'), body = $('months-body');
    head.textContent = ''; body.textContent = '';
    var tr = document.createElement('tr');
    [''].concat(MONTHS).forEach(function (name) {
      var th = document.createElement('th'); th.scope = 'col'; th.textContent = name; tr.appendChild(th);
    });
    head.appendChild(tr);
    rows.forEach(function (row) {
      var line = document.createElement('tr'), th = document.createElement('th');
      th.scope = 'row'; th.textContent = row[0]; line.appendChild(th);
      later.months.forEach(function (m) {
        var td = document.createElement('td'); td.textContent = fixed(m[row[1]], row[2]); line.appendChild(td);
      });
      body.appendChild(line);
    });
  }

  function summary(now, later) {
    var a = now.totals, b = later.totals, p = place();
    var change = 100 * (b.R / a.R - 1);
    return 'On ' + p.short + ', ' + fixed(state.t, 1) + NB + '°C warmer' + (state.p ? ' with ' + (state.p > 0 ? '+' : '') + state.p +
      '% rain and snow' : ' with the same rain and snow') + ': the yearly runoff goes from ' + fixed(a.R, 0) + ' to ' + fixed(b.R, 0) +
      NB + 'mm (' + (change >= 0 ? '+' : '−') + fixed(Math.abs(change), 0) + '%), the biggest month from ' + LONG[a.peak] + ' to ' +
      LONG[b.peak] + ', and the months with the soil less than half full from ' + a.dry + ' to ' + b.dry + '.';
  }

  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var now = M.run(place(), 0, 0), later = M.run(place(), state.t, state.p);
    drawGraph(now, later); drawTables(now, later); say('summary', summary(now, later));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    if (VIEWS.indexOf(params.get('view')) >= 0) state.view = params.get('view');
    M.PLACES.forEach(function (p) { if (p.id === params.get('place')) state.place = p.id; });
    ['t', 'p'].forEach(function (key) {
      var value = parseFloat(params.get(key));
      if (isFinite(value)) state[key] = tidy(key, value);
    });
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) { if (state[key] !== DEFAULTS[key]) parts.push(key + '=' + state[key]); });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    try { history.replaceState(null, '', query + (state.view === 'about' ? location.hash : '')); } catch (error) { /* embedded */ }
    $('open-link').href = '?' + parts.filter(function (p) { return p !== 'embed=1'; }).join('&');
  }

  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; show(); saveToAddress(); draw(); });
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

  function begin() {
    var select = $('place');
    M.PLACES.forEach(function (p) {
      var option = document.createElement('option');
      option.value = p.id; option.textContent = p.name;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { state.place = select.value; changed(); });
    readAddress();
    ['t', 'p'].forEach(pair);
    $('reset').addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (key) { if (key !== 'view') state[key] = DEFAULTS[key]; });
      changed();
    });
    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);
    selectView(state.view);
    var spot = state.view === 'about' && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (spot) spot.scrollIntoView();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
