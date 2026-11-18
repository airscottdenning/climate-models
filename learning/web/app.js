/* Learning beats digging: the page. model.js is the science, and data.json is Figures 12.4 and 12.16 of the
 * book. This file is the controls, the two graphs and the tables. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Learning;
  var VIEWS = ['learning', 'costs', 'about'];
  var TECHS = ['solar', 'batteries', 'oil'];
  // The page opens on solar panels, at the chapter's "about 20%" for each doubling, three doublings ahead.
  var DEFAULTS = { view: 'learning', tech: 'solar', rate: 20, n: 3 };
  var PLACES = { rate: 1, n: 0 };                 // decimal places of each slider
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0', FIT = '#6b7780';
  var COLOR = { solar: '#b35c00', batteries: '#1f6fa0', oil: '#5f4b32' };
  var WIND = '#0072b2', BAND = '#e1e4e6';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var show = [];         // one function for each control: put the state back into it
  var DATA = null;       // data.json, once it has loaded

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function commas(x, places) {
    return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
  }

  /* A price to three figures: $0.265, $69.1, $111, $9,210. */
  function figures(x) {
    if (x >= 999.5) return commas(x, 0);
    var places = Math.max(0, 2 - Math.floor(Math.log(x) / Math.LN10 + 1e-12));
    return commas(x, places);
  }
  function price(x, curve) { return '$' + figures(x) + ' ' + curve.priceUnit; }
  function amount(x, curve) { return figures(x) + NB + curve.madeUnit; }
  function percent(share) { return commas(share * 100, 1) + '%'; }

  /* What a rate does to the price, in words: "falls 23.5%" or "rises 10.0%". */
  function change(rate) {
    return rate >= 0 ? 'the price falls ' + percent(rate) : 'the price rises ' + percent(-rate);
  }

  function result() { return M.run(DATA.curves[state.tech], state.rate / 100, state.n); }

  // ---- The controls ----

  /* The three radio buttons for what to follow. */
  function radios() {
    var inputs = document.querySelectorAll('input[name="tech"]');
    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener('change', function () { if (input.checked) { state.tech = input.value; changed(); } });
    });
    return function () {
      Array.prototype.forEach.call(inputs, function (input) { input.checked = input.value === state.tech; });
    };
  }

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

  // ---- The learning graph: price against all of it ever made, both on logarithmic axes ----

  function decadeText(k) {
    return k >= 0 ? commas(Math.pow(10, k), 0) : Math.pow(10, k).toFixed(-k);
  }

  function drawLearning(curve, out) {
    var c = prepare($('graph')), ctx = c.ctx, narrow = c.w < 560, color = COLOR[state.tech];
    var xs = curve.made.concat([out.madeThen]);
    var ys = curve.price.concat([out.atOwn, out.atRate]);
    var lx0 = Math.floor(Math.log10(Math.min.apply(null, xs)));
    // Room on the right for the labels at the ends of the lines ahead.
    var lx1 = Math.ceil(Math.log10(Math.max.apply(null, xs)) + 0.12 * (Math.log10(out.madeThen) - lx0));
    var ly0 = Math.floor(Math.log10(Math.min.apply(null, ys))), ly1 = Math.ceil(Math.log10(Math.max.apply(null, ys)));
    if (ly1 - ly0 < 2) ly0 = ly1 - 2;
    ctx.font = '13px ' + FONT;
    var widest = 0;
    for (var k = ly0; k <= ly1; k++) widest = Math.max(widest, ctx.measureText(decadeText(k)).width);
    var x0 = Math.ceil(widest) + 14, x1 = c.w - (narrow ? 14 : 28), y1 = 30, y0 = c.h - 44;
    function px(X) { return x0 + (Math.log10(X) - lx0) / (lx1 - lx0) * (x1 - x0); }
    function py(P) { return y0 - (Math.log10(P) - ly0) / (ly1 - ly0) * (y0 - y1); }
    function line(xa, ya, xb, yb, stroke) {
      ctx.strokeStyle = stroke; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (k = ly0; k <= ly1; k++) {
      line(x0, py(Math.pow(10, k)), x1, py(Math.pow(10, k)), k === ly0 ? SPINE : GRID);
      text(ctx, decadeText(k), x0 - 7, py(Math.pow(10, k)), { align: 'right', baseline: 'middle' });
    }
    var every = Math.max(1, Math.ceil((lx1 - lx0) * 64 / (x1 - x0)));
    for (k = lx0; k <= lx1; k++) {
      line(px(Math.pow(10, k)), y1, px(Math.pow(10, k)), y0, k === lx0 ? SPINE : GRID);
      var half = ctx.measureText(decadeText(k)).width / 2;
      if ((k - lx0) % every === 0 && px(Math.pow(10, k)) + half <= c.w - 2) {
        text(ctx, decadeText(k), px(Math.pow(10, k)), y0 + 18, { align: 'center' });
      }
    }
    text(ctx, curve.priceWords + ' (' + curve.dollars + ' dollars)', narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
    text(ctx, (narrow ? 'All time' : curve.madeWords) + ' (' + curve.madeUnit + ')', (x0 + x1) / 2, c.h - 6,
      { align: 'center', color: INK });
    // The key's lines take the color of what's drawn.
    Array.prototype.forEach.call(document.querySelectorAll('.key .line.past, .key .line.own'), function (piece) {
      piece.style.borderTopColor = color;
    });

    // The straight line through the points (step 2), across the years of data.
    var first = curve.made[0], last = out.last.made;
    ctx.setLineDash([7, 5]); ctx.lineWidth = 1.6;
    line(px(first), py(Math.exp(out.a + out.b * Math.log(first))), px(last),
      py(Math.exp(out.a + out.b * Math.log(last))), FIT);
    ctx.setLineDash([]);
    // Each year, joined.
    ctx.beginPath();
    curve.made.forEach(function (X, i) { ctx[i ? 'lineTo' : 'moveTo'](px(X), py(curve.price[i])); });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = color;
    curve.made.forEach(function (X, i) {
      ctx.beginPath(); ctx.arc(px(X), py(curve.price[i]), 2.6, 0, 2 * Math.PI); ctx.fill();
    });
    // Ahead: at its own rate, and at the rate chosen (step 4).
    ctx.lineWidth = 2.6;
    ctx.setLineDash([9, 5]); line(px(last), py(out.last.price), px(out.madeThen), py(out.atOwn), color);
    ctx.setLineDash([2, 4]); line(px(last), py(out.last.price), px(out.madeThen), py(out.atRate), INK);
    ctx.setLineDash([]);
    [[out.atOwn, color], [out.atRate, INK]].forEach(function (end) {
      ctx.beginPath(); ctx.arc(px(out.madeThen), py(end[0]), 4.5, 0, 2 * Math.PI); ctx.fillStyle = end[1]; ctx.fill();
    });
    // The two prices ahead, to the right of their dots, kept at least a line apart.
    var yOwn = py(out.atOwn) + 4, yRate = py(out.atRate) + 4;
    if (Math.abs(yOwn - yRate) < 15) {
      var mid = (yOwn + yRate) / 2, sign = out.atOwn >= out.atRate ? -1 : 1;
      yOwn = mid + sign * 7.5; yRate = mid - sign * 7.5;
    }
    text(ctx, '$' + figures(out.atOwn), px(out.madeThen) + 9, yOwn, { size: 12, bold: true, color: color, halo: '#ffffff' });
    text(ctx, '$' + figures(out.atRate), px(out.madeThen) + 9, yRate, { size: 12, bold: true, color: INK, halo: '#ffffff' });
    text(ctx, out.first.year + ': $' + figures(out.first.price), px(first) + 8, py(out.first.price) + 18,
      { size: 12, bold: true, color: color, halo: '#ffffff' });
    text(ctx, out.last.year + ': $' + figures(out.last.price), px(last) - 8,
      py(out.last.price) + (out.own >= 0 ? -12 : 20), { size: 12, bold: true, color: color, halo: '#ffffff', align: 'right' });
  }

  // ---- The cost graph: Figure 12.4 ----

  function drawCosts() {
    var c = prepare($('costs')), ctx = c.ctx, narrow = c.w < 560, data = DATA.costs;
    var x0 = 44, x1 = c.w - (narrow ? 14 : 28), y1 = 30, y0 = c.h - 44, top = 450;
    var first = data.year[0], last = data.year[data.year.length - 1];
    function px(year) { return x0 + (year - first) / (last - first) * (x1 - x0); }
    function py(value) { return y0 - value / top * (y0 - y1); }
    function line(xa, ya, xb, yb, stroke) {
      ctx.strokeStyle = stroke; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    ctx.fillStyle = BAND;
    ctx.fillRect(x0, py(data.fossil[1]), x1 - x0, py(data.fossil[0]) - py(data.fossil[1]));
    ctx.lineWidth = 1;
    for (var v = 0; v <= top; v += 50) {
      line(x0, py(v), x1, py(v), v ? GRID : SPINE);
      text(ctx, String(v), x0 - 7, py(v), { align: 'right', baseline: 'middle' });
    }
    for (var year = first; year <= last; year += 1) {
      line(px(year), y0, px(year), y0 + 5, SPINE);
      if ((year - first) % 5 === 0) text(ctx, String(year), px(year), y0 + 18, { align: 'center' });
    }
    text(ctx, narrow ? 'Dollars a MWh (2025 dollars)' : 'Cost of electricity from new plants (2025 dollars a MWh)',
      narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
    text(ctx, 'New coal and gas plants', x1 - 6, py(data.fossil[1]) + 18,
      { size: 12, bold: true, color: TICK, align: 'right' });
    [['solar', COLOR.solar, 'Solar'], ['wind', WIND, 'Onshore wind']].forEach(function (s) {
      var values = data[s[0]];
      ctx.beginPath();
      values.forEach(function (value, i) { ctx[i ? 'lineTo' : 'moveTo'](px(data.year[i]), py(value)); });
      ctx.strokeStyle = s[1]; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = s[1];
      values.forEach(function (value, i) {
        var x = px(data.year[i]), y = py(value);
        ctx.beginPath();
        if (s[0] === 'wind') ctx.rect(x - 3.5, y - 3.5, 7, 7); else ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
      var end = values[values.length - 1];
      text(ctx, s[2] + ' $' + commas(end, 0), px(last) - 6, py(end) + (s[0] === 'solar' ? -12 : 22),
        { size: 12, bold: true, color: s[1], halo: '#ffffff', align: 'right' });
    });
    text(ctx, '$' + commas(data.solar[0], 0), px(first) + 8, py(data.solar[0]) + 4,
      { size: 12, bold: true, color: COLOR.solar, halo: '#ffffff' });
  }

  // ---- The tables and the words under the graph ----

  function drawTable(curve, out) {
    var cheaper = out.times >= 1 ? commas(out.times, 0) + ' times cheaper' : commas(1 / out.times, 1) + ' times dearer';
    $('results-caption').textContent = curve.name + ': the numbers';
    $('out-span').textContent = out.first.year + ': ' + price(out.first.price, curve) + '. ' + out.last.year + ': ' +
      price(out.last.price, curve) + ' (' + cheaper + ')';
    $('out-n').textContent = commas(out.n, 1) + ' (from ' + amount(out.first.made, curve) + ' to ' +
      amount(out.last.made, curve) + ')';
    $('out-own').textContent = change(out.own);
    $('out-g').textContent = percent(out.g) + ' a year, so it doubles every ' + commas(out.perDoubling, 1) + ' years';
    $('out-at-own').textContent = price(out.atOwn, curve);
    $('out-at-rate').textContent = price(out.atRate, curve) + ' (' + change(out.rate) + ' each time)';
    $('out-made').textContent = amount(out.madeThen, curve);
    $('out-years').textContent = commas(out.T, 1) + ' years, to about ' + Math.round(out.last.year + out.T);
  }

  function drawCostTable() {
    var out = M.costs(DATA.costs);
    ['solar', 'wind'].forEach(function (key) {
      $('cost-' + key + '-first').textContent = '$' + commas(out[key].first, 0);
      $('cost-' + key + '-last').textContent = '$' + commas(out[key].last, 0);
      $('cost-' + key + '-times').textContent = commas(out[key].times, 1) + ' times';
      $('cost-' + key + '-below').textContent = String(out[key].below);
    });
    $('cost-fossil').textContent = '$' + commas(out.fossil[0], 0) + ' to $' + commas(out.fossil[1], 0) +
      ' a MWh (IRENA, 2021)';
  }

  function summary(curve, out) {
    return curve.name + ': ' + change(out.own) + ' with each doubling of all of it ever made. ' + commas(state.n, 0) +
      ' more ' + (state.n === 1 ? 'doubling' : 'doublings') + ' at ' + commas(state.rate, 1) + '% would bring it to ' +
      price(out.atRate, curve) + ', and at the speed of the last five years ' + (state.n === 1 ? 'it takes ' :
      'they take ') + commas(out.T, 1) + ' years.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (!DATA || state.view === 'about') return;
    if (state.view === 'costs') { drawCosts(); drawCostTable(); return; }
    var curve = DATA.curves[state.tech], out = result();
    drawLearning(curve, out); drawTable(curve, out); say('summary', summary(curve, out));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search), view = params.get('view'), tech = params.get('tech');
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    if (tech !== null) state.tech = TECHS.indexOf(tech) < 0 ? DEFAULTS.tech : tech;
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
    $('workbench').hidden = view !== 'learning';
    $('notes').hidden = view === 'about';
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
    show.push(radios());

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
      ['tech', 'rate', 'n'].forEach(function (key) { state[key] = DEFAULTS[key]; });
      changed();
    });
    $('own').addEventListener('click', function () {
      if (!DATA) return;
      state.rate = tidy('rate', 100 * M.run(DATA.curves[state.tech], 0, 1).own);
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);

    show.forEach(function (put) { put(); });
    selectView(state.view);
    goToAddressPlace();
    fetch('data.json').then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    }).then(function (data) { DATA = data; changed(); }).catch(function () {
      say('summary', 'The data didn\'t load. Check your connection, then reload the page.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
