/* Grid model: the page. model.js is the science, data.json the year's hours. This file is the controls, the
 * graphs and the table. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Grid;
  var VIEWS = ['model', 'about'];
  var KEYS = { s: 'sunGW', w: 'windGW', c: 'firmGW', e: 'store', d: 'wait' };
  var PLACES = { s: 1, w: 1, c: 1, e: 0, d: 0 };          // decimal places of each slider
  var DEFAULTS = { view: 'model', g: 'home', far: 'none', week: 0, s: null, w: null, c: null, e: 0, d: 0 };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID_LINE = '#e7edf0';
  var COLORS = { firm: '#6a51a3', wind: '#2b8cbe', sun: '#f2b51d', give: '#00795a', short: '#c0392b' };
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var data = null, grids = {}, state = {};
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function fixed(x, places) { return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }); }

  /* What a grid had in 2025: its solar and wind fleets, and its nuclear and hydropower as clean firm power. */
  function asBuilt(key) {
    var m = data.grids[key].measured;
    function tenth(x) { return Math.round(x * 10) / 10; }
    return { s: tenth(m.sun_gw), w: tenth(m.wind_gw), c: tenth((m.nuclear_gwh + m.hydro_gwh) / data.hours) };
  }

  function choices() {
    return { sunGW: state.s, windGW: state.w, firmGW: state.c, store: state.e, wait: state.d / 100,
             far: state.far === 'none' ? 0 : 0.5 };
  }

  function result() {
    return M.run(grids[state.g], state.far === 'none' ? null : grids[state.far], choices());
  }

  // ---- The controls ----

  function tidy(key, value) {
    var box = $(key), step = +box.step;
    return +clamp(Math.round(value / step) * step, +box.min, +box.max).toFixed(PLACES[key]);
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

  function fillSelects() {
    var home = $('g');
    Object.keys(data.grids).forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = data.grids[key].code + ' (' + data.grids[key].name + ')';
      home.appendChild(option);
    });
    home.addEventListener('change', function () {
      state.g = home.value;
      var built = asBuilt(state.g);
      state.s = built.s; state.w = built.w; state.c = built.c;
      if (state.far === state.g) state.far = 'none';
      changed();
    });
    $('far').addEventListener('change', function () { state.far = $('far').value; changed(); });
    var week = $('week');
    for (var k = 0; k < 52; k++) {
      var option = document.createElement('option');
      option.value = k;
      option.textContent = 'Week ' + (k + 1) + ', from ' + dateOf(k * 168);
      week.appendChild(option);
    }
    week.addEventListener('change', function () { state.week = +week.value; changed(); });
  }

  function dateOf(hour) {
    var day = Math.floor(hour / 24), when = new Date(Date.UTC(data.year, 0, 1 + day));
    return MONTHS[when.getUTCMonth()] + ' ' + when.getUTCDate();
  }

  function show() {
    $('g').value = state.g;
    var far = $('far');
    far.textContent = '';
    [['none', 'Build it all here']].concat(Object.keys(data.grids).filter(function (key) { return key !== state.g; })
      .map(function (key) { return [key, 'Build half in ' + data.grids[key].name + ' (' + data.grids[key].code + ')']; }))
      .forEach(function (item) {
        var option = document.createElement('option');
        option.value = item[0]; option.textContent = item[1];
        far.appendChild(option);
      });
    far.value = state.far;
    Object.keys(PLACES).forEach(function (key) {
      $(key).value = $(key + '-range').value = state[key].toFixed(PLACES[key]);
    });
    $('e-power').textContent = 'That\'s ' + fixed(state.e / M.HOURS_OF_STORAGE, 1) + NB + 'GW for ' +
      M.HOURS_OF_STORAGE + NB + 'hours.';
    $('week').value = state.week;
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

  /* Averages over blocks of `size` hours, from hour `from` for `count` blocks. */
  function blocks(series, from, count, size) {
    var out = [];
    for (var b = 0; b < count; b++) {
      var sum = 0;
      for (var k = 0; k < size; k++) sum += series[from + b * size + k];
      out.push(sum / size);
    }
    return out;
  }

  /* A stack of clean power (firm, wind, Sun, then the batteries) under the line of use, with the shortfall in
   * red between them. `ticks` gives the labels along the bottom. */
  function drawStack(canvasId, title, parts, ticks) {
    var c = prepare($(canvasId)), ctx = c.ctx, narrow = c.w < 560, n = parts.D.length;
    var high = 0;
    for (var k = 0; k < n; k++) {
      high = Math.max(high, parts.D[k], parts.firm[k] + parts.wind[k] + parts.sun[k] + parts.give[k]);
    }
    var gap = roundGap(Math.max(high, 1), 4), ceiling = Math.ceil(high / gap) * gap;
    var x0 = 44, x1 = c.w - (narrow ? 10 : 18), y1 = 30, y0 = c.h - 34;
    function px(at) { return x0 + at / n * (x1 - x0); }
    function py(v) { return y0 - v / ceiling * (y0 - y1); }
    ctx.lineWidth = 1;
    for (var v = 0; v <= ceiling + gap / 2; v += gap) {
      ctx.strokeStyle = v ? GRID_LINE : SPINE;
      ctx.beginPath(); ctx.moveTo(x0, py(v)); ctx.lineTo(x1, py(v)); ctx.stroke();
      text(ctx, fixed(v, 0), x0 - 6, py(v), { align: 'right', baseline: 'middle' });
    }
    text(ctx, narrow ? title.split(' (')[0] + ' (GW)' : title, narrow ? 4 : x0, 18, { bold: true, color: INK });
    var under = new Array(n).fill(0);
    ['firm', 'wind', 'sun', 'give'].forEach(function (name) {
      var top = under.map(function (u, at) { return u + parts[name][at]; });
      ctx.beginPath();
      for (var at = 0; at < n; at++) { ctx.lineTo(px(at), py(top[at])); ctx.lineTo(px(at + 1), py(top[at])); }
      for (at = n - 1; at >= 0; at--) { ctx.lineTo(px(at + 1), py(under[at])); ctx.lineTo(px(at), py(under[at])); }
      ctx.closePath(); ctx.fillStyle = COLORS[name]; ctx.fill();
      under = top;
    });
    // The shortfall: from the top of the clean power up to the line of use, where the clean power falls short.
    ctx.fillStyle = COLORS.short;
    for (var at = 0; at < n; at++) {
      if (parts.D[at] > under[at] + 1e-9) {
        ctx.fillRect(px(at), py(parts.D[at]), Math.max(1, px(at + 1) - px(at)), py(under[at]) - py(parts.D[at]));
      }
    }
    ctx.beginPath();
    for (at = 0; at < n; at++) { ctx.lineTo(px(at), py(parts.D[at])); ctx.lineTo(px(at + 1), py(parts.D[at])); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = SPINE; ctx.lineWidth = 1;
    ticks.forEach(function (tick, k) {
      ctx.beginPath(); ctx.moveTo(px(tick.at), y0); ctx.lineTo(px(tick.at), y0 + 5); ctx.stroke();
      if (!narrow || k % 2 === 0) text(ctx, tick.label, px(tick.at) + 2, y0 + 18);
    });
  }

  function drawGraphs(out) {
    var H = out.hours, size = 24, days = Math.floor(H.D.length / size);
    var year = {};
    ['D', 'firm', 'wind', 'sun', 'give'].forEach(function (name) { year[name] = blocks(H[name], 0, days, size); });
    var monthTicks = [];
    for (var m = 0; m < 12; m++) {
      var day = Math.round((Date.UTC(data.year, m, 1) - Date.UTC(data.year, 0, 1)) / 864e5);
      monthTicks.push({ at: day, label: MONTHS[m] });
    }
    drawStack('year', 'The year, day by day (GW, the average of each day)', year, monthTicks);
    var from = state.week * 168, week = {};
    ['D', 'firm', 'wind', 'sun', 'give'].forEach(function (name) { week[name] = H[name].slice(from, from + 168); });
    var dayTicks = [];
    for (var d = 0; d < 7; d++) dayTicks.push({ at: d * 24, label: dateOf(from + d * 24) });
    drawStack('hours', 'One week, hour by hour (GW)', week, dayTicks);
  }

  /* The week with the most energy short. */
  function worstWeek(out) {
    var best = 0, most = -1;
    for (var k = 0; k < 52; k++) {
      var sum = 0;
      for (var at = k * 168; at < (k + 1) * 168; at++) sum += out.hours.short[at];
      if (sum > most + 1e-9) { most = sum; best = k; }
    }
    return best;
  }

  // ---- The table ----

  function drawTable(out) {
    var t = out.totals;
    $('out-clean').textContent = fixed(100 * t.cleanShare, 1) + '% of the year\'s use';
    $('out-short').textContent = fixed(t.short, 0) + NB + 'GWh, in ' + fixed(t.shortHours, 0) + ' of ' +
      fixed(data.hours, 0) + ' hours';
    $('out-biggest').textContent = fixed(t.biggestShort, 1) + NB + 'GW';
    $('out-thrown').textContent = fixed(100 * t.thrownShare, 1) + '% of the clean power made';
    $('out-use').textContent = fixed(t.D / 1000, 1) + NB + 'TWh, on average ' + fixed(t.D / data.hours, 1) + NB +
      'GW (the most in one hour: ' + fixed(Math.max.apply(null, out.hours.D), 1) + NB + 'GW)';
  }

  function summary(out) {
    var t = out.totals, g = data.grids[state.g];
    return 'On ' + g.code + ', ' + g.name + ', in ' + data.year + ': clean power meets ' + fixed(100 * t.cleanShare, 1) +
      '% of the year\'s use. It falls short in ' + fixed(t.shortHours, 0) + ' hours, by as much as ' +
      fixed(t.biggestShort, 1) + NB + 'GW, and ' + fixed(100 * t.thrownShare, 1) + '% of the clean power made is thrown away.';
  }

  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about' || !data) return;
    var out = result();
    drawGraphs(out); drawTable(out); say('summary', summary(out));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search), view = params.get('view');
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    if (data.grids[params.get('g')]) state.g = params.get('g');
    var built = asBuilt(state.g);
    state.s = built.s; state.w = built.w; state.c = built.c;
    Object.keys(PLACES).forEach(function (key) {
      var value = parseFloat(params.get(key));
      if (isFinite(value)) state[key] = tidy(key, value);
    });
    var far = params.get('far');
    if (far && data.grids[far] && far !== state.g) state.far = far;
    var week = parseInt(params.get('week'), 10);
    if (week >= 1 && week <= 52) state.week = week - 1;
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [], built = asBuilt(state.g);
    if (state.view !== DEFAULTS.view) parts.push('view=' + state.view);
    if (state.g !== DEFAULTS.g) parts.push('g=' + state.g);
    ['s', 'w', 'c'].forEach(function (key) { if (state[key] !== built[key]) parts.push(key + '=' + state[key]); });
    ['e', 'd'].forEach(function (key) { if (state[key] !== DEFAULTS[key]) parts.push(key + '=' + state[key]); });
    if (state.far !== 'none') parts.push('far=' + state.far);
    if (state.week !== DEFAULTS.week) parts.push('week=' + (state.week + 1));
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
    requestAnimationFrame(function () { pending = false; if (data) { show(); saveToAddress(); } draw(); });
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

  function goToAddressPlace() {
    var place = state.view === 'about' && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
  }

  function begin(loaded) {
    data = loaded;
    Object.keys(data.grids).forEach(function (key) { grids[key] = M.unpack(data.grids[key]); });
    Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
    fillSelects();
    readAddress();
    Object.keys(PLACES).forEach(pair);
    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    $('built').addEventListener('click', function () {
      var built = asBuilt(state.g);
      state.s = built.s; state.w = built.w; state.c = built.c; state.e = 0; state.d = 0; state.far = 'none';
      changed();
    });
    $('worst').addEventListener('click', function () { state.week = worstWeek(result()); changed(); });
    $('reset').addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (key) { if (key !== 'view') state[key] = DEFAULTS[key]; });
      var built = asBuilt(state.g);
      state.s = built.s; state.w = built.w; state.c = built.c;
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);
    selectView(state.view);
    goToAddressPlace();
  }

  function start() {
    fetch('data.json').then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    }).then(begin).catch(function () {
      $('summary').textContent = 'The year\'s data didn\'t load. Check your connection and reload the page.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
