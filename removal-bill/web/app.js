/* The removal bill: the page. model.js is the science. This file is the sliders, the graph, the bars and the
 * table. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.RemovalBill;
  var VIEWS = ['model', 'about'];
  // The page opens on Chapter 13's sum for a tenth of a degree: 1 GtC a year for 50 years, at $100 a ton.
  var DEFAULTS = { view: 'model', r: 1, n: 50, p: 100, e: 1390 };
  var PLACES = { r: 1, n: 0, p: 0, e: 0 };        // decimal places of each slider
  var PRESETS = { hopeful: { p: 100, e: 1390 }, today: { p: 1000, e: 4380 } };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var AIR = '#00795a', BACK = '#e9d8a6';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var show = [];         // one function for each slider: put the state back into it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function commas(x, places) {
    return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
  }

  /* Dollars, from a number of billions: $367 billion, $1.56 trillion, $18.3 trillion, $156 trillion. */
  function money(billions) {
    var trillion = billions >= 999.5, x = trillion ? billions / 1000 : billions;
    var places = x < 9.995 ? 2 : x < 99.95 ? 1 : 0;
    return '$' + commas(x, places) + ' ' + (trillion ? 'trillion' : 'billion');
  }

  /* A share of the world's electricity: 16% of it, or 1.7 times all of it. */
  function ofElectricity(share) {
    return share < 0.995 ? commas(share * 100, 0) + '% of the world\'s electricity'
      : commas(share, 1) + ' times all the world\'s electricity';
  }

  function result() { return M.run(state.r, state.n, state.p, state.e); }

  // ---- The sliders ----

  /* A slider and a number box that hold the same number. */
  function pair(key) {
    var number = $(key), range = $(key + '-range'), places = PLACES[key];
    function put() { number.value = range.value = state[key].toFixed(places); }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = tidy(key, value);
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* A number as a slider can hold it: on one of its steps, and inside its ends. */
  function tidy(key, value) {
    var number = $(key), step = +number.step;
    var snapped = Math.round(value / step) * step;
    return +clamp(snapped, +number.min, +number.max).toFixed(PLACES[key]);
  }

  // ---- The graph: carbon against the years ----

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

  function drawGraph(out) {
    var c = prepare($('graph')), ctx = c.ctx, narrow = c.w < 560;
    var high = Math.max(out.totalC, 1e-6), gap = roundGap(high, 4);
    var ceiling = Math.ceil(high / gap - 1e-9) * gap;
    ctx.font = '13px ' + FONT;
    var widest = 0;
    for (var v = 0; v <= ceiling + gap / 2; v += gap) widest = Math.max(widest, ctx.measureText(tickText(v, gap)).width);
    var top = 30, bottom = 44, x0 = Math.ceil(widest) + 14, x1 = c.w - (narrow ? 14 : 24), y1 = top, y0 = c.h - bottom;
    var years = out.year, span = years[years.length - 1];
    function px(year) { return x0 + year / span * (x1 - x0); }
    function py(value) { return y0 - value / ceiling * (y0 - y1); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (v = 0; v <= ceiling + gap / 2; v += gap) {
      line(x0, py(v), x1, py(v), v < gap / 2 ? SPINE : GRID);
      text(ctx, tickText(v, gap), x0 - 7, py(v), { align: 'right', baseline: 'middle' });
    }
    line(x0, y1, x0, y0, SPINE);
    var yearGap = roundGap(span, narrow ? 4 : 8);
    if (yearGap < 1) yearGap = 1;
    for (var year = 0; year <= span + 1e-9; year += yearGap) {
      line(px(year), y0, px(year), y0 + 5, SPINE);
      text(ctx, String(year), px(year), y0 + 18, { align: 'center' });
    }
    text(ctx, 'Carbon (GtC)', narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
    text(ctx, 'Years of capture', (x0 + x1) / 2, c.h - 6, { align: 'center', color: INK });

    // The band between the two lines: what came back out of the land and ocean.
    ctx.beginPath();
    years.forEach(function (y, k) { ctx[k ? 'lineTo' : 'moveTo'](px(y), py(out.C[k])); });
    for (var k = years.length - 1; k >= 0; k--) ctx.lineTo(px(years[k]), py(out.air[k]));
    ctx.closePath(); ctx.fillStyle = BACK; ctx.fill();
    [{ values: out.C, color: INK }, { values: out.air, color: AIR }].forEach(function (s) {
      ctx.beginPath();
      s.values.forEach(function (value, at) { ctx[at ? 'lineTo' : 'moveTo'](px(years[at]), py(value)); });
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
    });
    if (out.totalC > 0) {
      var last = years.length - 1;
      // Each label sits clear of its rising line: above and to the left of one, below and to the right of the other.
      text(ctx, commas(out.C[last], 1) + NB + 'GtC captured', x1 - 4, py(out.C[last]) - 8,
        { size: 12, bold: true, color: INK, halo: '#ffffff', align: 'right' });
      var at = Math.round(last * 0.4);
      text(ctx, 'the air: ' + commas(out.air[last], 1) + NB + 'GtC lower', px(years[at]) + 4, py(out.air[at]) + 17,
        { size: 12, bold: true, color: AIR, halo: '#ffffff' });
    }
  }

  // ---- The bars ----

  /* One bar: a label, its amount in words, and a bar `share` of the way across. A range has a paler bar
   * out to its far end. */
  function bar(label, amount, share, kind, farShare) {
    var item = document.createElement('li'), top = document.createElement('div');
    var name = document.createElement('span'), value = document.createElement('strong');
    var track = document.createElement('div');
    top.className = 'label'; track.className = 'track';
    name.textContent = label; value.textContent = amount;
    top.appendChild(name); top.appendChild(value);
    if (farShare !== undefined) track.appendChild(fill('range', farShare));
    track.appendChild(fill(kind, share));
    item.appendChild(top); item.appendChild(track);
    return item;
  }

  function fill(kind, share) {
    var piece = document.createElement('div');
    piece.className = 'fill ' + kind;
    piece.style.width = (clamp(share, 0, 1) * 100).toFixed(2) + '%';
    return piece;
  }

  function drawBars(out) {
    var sun = M.SUN.yearly * M.SUN.years;
    var most = Math.max(out.B, M.ROADS[1]);
    var dollars = $('dollars'), power = $('power');
    dollars.textContent = ''; power.textContent = '';
    dollars.appendChild(bar('Your bill', money(out.B), out.B / most, 'yours'));
    dollars.appendChild(bar('A year of the world\'s phones and phone service', '$' + commas(M.PHONES / 1000, 1) +
      ' trillion', M.PHONES / most, 'other'));
    dollars.appendChild(bar('Every paved road on Earth', '$' + commas(M.ROADS[0] / 1000, 0) + ' to $' +
      commas(M.ROADS[1] / 1000, 0) + ' trillion', M.ROADS[0] / most, 'other', M.ROADS[1] / most));
    dollars.appendChild(bar('Dimming the Sun from aircraft for ' + M.SUN.years + ' years (a 2018 estimate)', money(sun),
      sun / most, 'other'));
    var top = Math.max(out.W, M.ELECTRICITY);
    power.appendChild(bar('Your capture', commas(out.W, 0) + NB + 'TWh a year', out.W / top, 'yours'));
    power.appendChild(bar('All the electricity the world made in 2025', commas(M.ELECTRICITY, 0) + NB + 'TWh',
      M.ELECTRICITY / top, 'other'));
  }

  // ---- The table and the words under the graph ----

  function fahrenheit(celsius) { return commas(celsius * 1.8, 2) + NB + '°F'; }

  function drawTable(out) {
    var back = out.totalC * M.BACK, air = out.totalC - back;
    $('out-captured').textContent = commas(out.totalC, 1) + NB + 'GtC (' + commas(out.M, 0) + ' billion tons of CO₂)';
    $('out-back').textContent = commas(back, 1) + NB + 'GtC';
    $('out-air').textContent = commas(out.x, 1) + NB + 'ppm (' + commas(air, 1) + NB + 'GtC)';
    $('out-cooling').textContent = commas(out.T, 2) + NB + '°C (' + fahrenheit(out.T) + ')';
    $('out-bill').textContent = money(out.B) + ' (' + money(out.yearlyB) + ' a year)';
    $('out-energy').textContent = commas(out.W, 0) + NB + 'TWh: as much energy as ' + ofElectricity(out.shareOfElectricity);
    $('out-ppm').textContent = money(out.onePpm);
    $('out-tenth').textContent = money(out.oneTenth);
    $('out-faucet').textContent = commas(out.shareOfEmissions * 100, 0) + '% of the ' + commas(M.EMISSIONS, 1) + NB +
      'GtC the world emitted in 2025';
  }

  function summary(out) {
    if (state.r === 0) return 'With nothing captured, nothing changes and there\'s no bill.';
    return 'Capturing ' + commas(state.r, 1) + NB + 'GtC a year for ' + state.n + (state.n === 1 ? ' year' : ' years') +
      ' takes ' + commas(out.totalC, 1) + NB + 'GtC out of the air. About half comes back out of the land and ocean, so ' +
      'the CO₂ in the air falls by ' + commas(out.x, 1) + NB + 'ppm, and the planet cools by ' + commas(out.T, 2) + NB +
      '°C (' + fahrenheit(out.T) + '). The bill is ' + money(out.B) + '.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var out = result();
    drawGraph(out); drawBars(out); drawTable(out); say('summary', summary(out));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search), view = params.get('view');
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    Object.keys(PLACES).forEach(function (key) {
      var value = parseFloat(params.get(key));
      if (isFinite(value)) state[key] = tidy(key, value);
    });
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
    requestAnimationFrame(function () {
      pending = false;
      show.forEach(function (put) { put(); });
      saveToAddress(); draw();
    });
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

  function start() {
    readAddress();
    Object.keys(PLACES).forEach(function (key) { show.push(pair(key)); });

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Object.keys(PRESETS).forEach(function (name) {
      $('preset-' + name).addEventListener('click', function () {
        state.p = PRESETS[name].p; state.e = PRESETS[name].e; changed();
      });
    });
    $('reset').addEventListener('click', function () {
      Object.keys(PLACES).forEach(function (key) { state[key] = DEFAULTS[key]; });
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);

    show.forEach(function (put) { put(); });
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
