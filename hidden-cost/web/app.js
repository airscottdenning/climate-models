/* The hidden cost: the page. model.js is the science. This file is the sliders, the graph and the table.
 * Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.HiddenCost;
  var VIEWS = ['model', 'about'];
  // The page opens with $30 of harm for each ton and no price on it: the market failure of section 14.2.
  var DEFAULTS = { view: 'model', h: 30, t: 0 };
  var PLACES = { h: 0, t: 0 };                    // decimal places of each slider
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var DEMAND = '#0072b2', SOCIAL = '#b8321a', PRICED = '#00795a', LOST = '#f3cdbf';
  var TOP = { Q: 160, P: 180 };                   // the graph's axes: million tons a year, and $ a ton
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

  /* Money, from millions of dollars a year: $3.00 billion a year. */
  function money(millions) { return '$' + commas(millions / 1000, 2) + NB + 'billion a year'; }
  function perTon(dollars) { return '$' + commas(dollars, 2) + ' a ton'; }
  function tons(millions) { return commas(millions, 1) + ' million tons a year'; }

  function result() { return M.run(state.h, state.t); }

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

  // ---- The graph: price against the amount burned ----

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

  function drawGraph(out) {
    var c = prepare($('graph')), ctx = c.ctx, narrow = c.w < 560;
    var x0 = 44, x1 = c.w - (narrow ? 12 : 24), y1 = 30, y0 = c.h - 44;
    function px(Q) { return x0 + Q / TOP.Q * (x1 - x0); }
    function py(P) { return y0 - P / TOP.P * (y0 - y1); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (var P = 0; P <= TOP.P; P += 20) {
      line(x0, py(P), x1, py(P), P ? GRID : SPINE);
      text(ctx, String(P), x0 - 7, py(P), { align: 'right', baseline: 'middle' });
    }
    line(x0, y1, x0, y0, SPINE);
    for (var Q = 0; Q <= TOP.Q; Q += narrow ? 40 : 20) {
      line(px(Q), y0, px(Q), y0 + 5, SPINE);
      text(ctx, String(Q), px(Q), y0 + 18, { align: 'center' });
    }
    text(ctx, 'Price ($ a ton)', narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
    text(ctx, 'Fuel burned (million tons a year)', (x0 + x1) / 2, c.h - 6, { align: 'center', color: INK });

    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y1, x1 - x0, y0 - y1); ctx.clip();
    // The pie that's lost: the triangle between demand and the social cost, from the best amount to what's burned.
    if (out.L > 1e-9) {
      ctx.beginPath();
      ctx.moveTo(px(out.best), py(out.bestPrice));
      ctx.lineTo(px(out.Q), py(M.demand(out.Q)));
      ctx.lineTo(px(out.Q), py(M.social(out.Q, state.h)));
      ctx.closePath(); ctx.fillStyle = LOST; ctx.fill();
    }
    function straight(f, color, width, dash) {
      ctx.setLineDash(dash || []); ctx.lineWidth = width; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(px(0), py(f(0))); ctx.lineTo(px(TOP.Q), py(f(TOP.Q))); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.t > 0) straight(function (q) { return M.supply(q) + state.t; }, PRICED, 2);
    if (state.h > 0) straight(function (q) { return M.social(q, state.h); }, SOCIAL, 2.4, [8, 5]);
    straight(M.supply, INK, 2.6);
    straight(M.demand, DEMAND, 2.6);
    ctx.restore();

    // Where the market alone settles, and where it settles now.
    function dot(Q, P, filled, color) {
      ctx.beginPath(); ctx.arc(px(Q), py(P), 6, 0, 2 * Math.PI);
      ctx.fillStyle = filled ? color : '#ffffff'; ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = color; ctx.stroke();
    }
    dot(out.Q1, out.P1, state.t === 0, INK);
    if (state.t > 0) dot(out.Q, out.paid, true, INK);
    text(ctx, 'Market alone', px(out.Q1) + 10, py(out.P1) + 20, { size: 12, bold: true, color: INK, halo: '#ffffff' });
    if (state.t > 0) {
      text(ctx, 'With the price', px(out.Q) - 10, py(out.paid) - 12,
        { size: 12, bold: true, color: INK, halo: '#ffffff', align: out.Q > 20 ? 'right' : 'left' });
    }
    text(ctx, 'Demand', px(10), py(M.demand(10)) - 9, { size: 12, bold: true, color: DEMAND, halo: '#ffffff' });
    text(ctx, 'Supply', px(TOP.Q) - 4, py(M.supply(TOP.Q)) + 18,
      { size: 12, bold: true, color: INK, halo: '#ffffff', align: 'right' });
    if (state.h > 0 && M.social(TOP.Q * 0.85, state.h) < TOP.P - 4) {
      text(ctx, 'Social cost', px(TOP.Q * 0.85), py(M.social(TOP.Q * 0.85, state.h)) - 9,
        { size: 12, bold: true, color: SOCIAL, halo: '#ffffff', align: 'right' });
    }
  }

  // ---- The table and the words under the graph ----

  function drawTable(out) {
    $('out-burned').textContent = tons(out.Q) + (out.fewer > 0 ? ' (' + commas(out.fewer, 1) +
      ' fewer than the market alone)' : '');
    $('out-paid').textContent = perTon(out.paid) + (state.t > 0 ? ' (the market alone: ' + perTon(out.P1) + ')' : '');
    $('out-kept').textContent = perTon(out.kept);
    $('out-bill').textContent = money(out.fuelBill);
    $('out-money').textContent = money(out.priceMoney);
    $('out-harm').textContent = money(out.H);
    $('out-avoided').textContent = money(out.avoided);
    $('out-lost').textContent = out.L > 1e-9 ? money(out.L) : 'Nothing: this is the biggest pie';
    $('out-best').textContent = tons(out.best) + ', at ' + perTon(out.bestPrice);
  }

  function summary(out) {
    var words = 'Buyers burn ' + tons(out.Q) + ' and pay ' + perTon(out.paid) + '. ';
    words += state.h > 0 ? 'The smoke does ' + money(out.H) + ' of harm to other people. '
      : 'The smoke does no harm to anyone else. ';
    words += out.L > 1e-9 ? 'The pie is ' + money(out.L) + ' smaller than it could be.' : 'The pie is as big as it can be.';
    return words;
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var out = result();
    drawGraph(out); drawTable(out); say('summary', summary(out));
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
