/* Discounting model: the page. model.js is the science. This file is the controls, the graph and the words
 * under it. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Discounting;
  var VIEWS = ['damage', 'about'];
  // What the page shows when the address says nothing: the example in Box 14.1 of the book. Rates are in
  // percent a year, as on the controls; model.js gets them as fractions.
  var DEFAULTS = { view: 'damage', cool: 2.5, penalty: 0.01, disc: 4.5, income: 100, years: 100 };
  var PLACES = { cool: 1, penalty: 2, disc: 1, income: 0, years: 0 };   // decimal places on each control
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var COOL = '#0072b2', HOT = '#d55e00', DAMAGE = '#7a4a14', VALUE = '#00795a';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var cursor = null;    // the year being read, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function round(x, places) { return +x.toFixed(places); }
  function commas(x, places) {
    return x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
  }

  /* An amount of money, from trillions of dollars: $1,218 trillion, $14.8 trillion, $183 billion. */
  function money(trillions) {
    var size = Math.abs(trillions);
    if (size >= 999.95) return '$' + commas(trillions, 0) + NB + 'trillion';
    if (size >= 0.9995) return '$' + commas(trillions, 1) + NB + 'trillion';
    var billions = trillions * 1000;
    return '$' + commas(billions, Math.abs(billions) >= 99.95 ? 0 : 1) + NB + 'billion';
  }

  function percent(x, places) { return commas(x, places) + '%'; }

  /* The model's choice from the controls, with the rates as fractions a year. */
  function choice() {
    return { cool: state.cool / 100, penalty: state.penalty / 100, disc: state.disc / 100,
      income: state.income, years: state.years };
  }

  var last = null;
  function answer() {
    var key = JSON.stringify(choice());
    if (!last || last.key !== key) { last = M.run(choice()); last.key = key; }
    return last;
  }

  // ---- The controls ----

  /* A slider and a number box that hold the same number. */
  function pair(key) {
    var number = $(key), range = $(key + '-range');
    function put() { number.value = range.value = state[key].toFixed(PLACES[key]); }
    function take(source) {
      var value = parseFloat(source.value), step = +number.step;
      if (!isFinite(value)) { put(); return; }
      value = Math.round(value / step) * step;
      state[key] = round(clamp(value, +number.min, +number.max), PLACES[key]);
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  function showAll() {
    Object.keys(show).forEach(function (key) { show[key](); });
    $('penalty-hint').textContent = 'So the hotter world grows at ' +
      percent(state.cool - state.penalty, 2) + ' a year.';
  }

  // ---- The graph ----

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

  /* A tick's label: a round number with as few decimals as its gap needs. */
  function tickText(value, gap) {
    var places = Math.max(0, -Math.floor(Math.log(gap) / Math.LN10 + 1e-9));
    return '$' + commas(value, places);
  }

  /* A graph's scale: in billions when everything in it is under $1 trillion, with `room` to spare above. */
  function scaleOf(group, room) {
    var high = 0;
    group.forEach(function (values) { values.forEach(function (v) { high = Math.max(high, v); }); });
    var billions = high < 1, scale = billions ? 1000 : 1;
    high = Math.max(high * scale * room, 1e-9);
    var gap = roundGap(high, 4);
    return { billions: billions, scale: scale, gap: gap, ceiling: Math.ceil(high / gap - 1e-9) * gap };
  }

  /* Three graphs that share the years along the bottom: the two incomes, the damage each year, and the
   * damage each year valued today. They're three graphs because the three are of very different sizes. */
  function drawDamage(run) {
    var c = prepare($('damage')), ctx = c.ctx, narrow = c.w < 560;
    var groups = [[run.gCool, run.gHot], [run.damage], [run.value]];
    var scales = groups.map(function (group, index) { return scaleOf(group, index === 2 ? 1.2 : 1); });
    // Room on the left for the widest label on any of the three scales.
    ctx.font = '13px ' + FONT;
    var widest = 0;
    scales.forEach(function (sc) {
      for (var v = 0; v <= sc.ceiling + sc.gap / 2; v += sc.gap) {
        widest = Math.max(widest, ctx.measureText(tickText(v, sc.gap)).width);
      }
    });
    var left = Math.ceil(widest) + 14, right = narrow ? 14 : 24, top = 26, bottom = 46, between = 52;
    var x0 = left, x1 = c.w - right, each = (c.h - top - bottom - 2 * between) / 3;
    var T = run.years;
    plot = { x0: x0, x1: x1 };
    function px(year) { return x0 + year / T * (x1 - x0); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }

    /* One graph: its frame, grid, labels and lines, on the scale worked out for it above. */
    function panel(index, title, series, options) {
      var y1 = top + index * (each + between), y0 = y1 + each;
      var sc = scales[index], billions = sc.billions, scale = sc.scale, gap = sc.gap, ceiling = sc.ceiling;
      function py(v) { return y0 - v * scale / ceiling * (y0 - y1); }
      ctx.lineWidth = 1;
      for (var v = 0; v <= ceiling + gap / 2; v += gap) {
        var y = y0 - v / ceiling * (y0 - y1);
        line(x0, y, x1, y, v ? GRID : SPINE);
        text(ctx, tickText(v, gap), x0 - 7, y, { align: 'right', baseline: 'middle' });
      }
      line(x0, y1, x0, y0, SPINE);
      var tickGap = T > 150 ? 50 : 25;
      for (var year = 0; year <= T; year += tickGap) {
        line(px(year), y0, px(year), y0 + 5, SPINE);
        text(ctx, String(year), px(year), y0 + 18, { align: 'center' });
      }
      text(ctx, title + (billions ? ' (billion dollars' : ' (trillion dollars') + (options.perYear ? ' a year)' : ')'),
        narrow ? 4 : x0, y1 - 14, { bold: true, color: INK });
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y1 - 2, x1 - x0, y0 - y1 + 2); ctx.clip();
      if (options.fill) {
        ctx.beginPath();
        options.fill.under.forEach(function (v, k) { ctx[k ? 'lineTo' : 'moveTo'](px(k), py(v)); });
        for (var k = T; k >= 0; k--) ctx.lineTo(px(k), py(options.fill.over ? options.fill.over[k] : 0));
        ctx.closePath(); ctx.fillStyle = options.fill.color; ctx.fill();
      }
      series.forEach(function (s) {
        ctx.beginPath();
        s.values.forEach(function (v, k) { ctx[k ? 'lineTo' : 'moveTo'](px(k), py(v)); });
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      });
      ctx.restore();
      if (options.note) {
        text(ctx, options.note, x0 + 10, y1 + 16, { color: INK, halo: '#ffffff', size: 13 });
      }
      return py;
    }

    var pyIncome = panel(0, 'World income', [
      { values: run.gCool, color: COOL }, { values: run.gHot, color: HOT }
    ], { perYear: true, fill: { under: run.gCool, over: run.gHot, color: 'rgba(213, 94, 0, 0.25)' } });
    var pyDamage = panel(1, 'Damage each year', [{ values: run.damage, color: DAMAGE }], { perYear: true });
    var pyValue = panel(2, 'Damage each year, valued today', [{ values: run.value, color: VALUE }], {
      fill: { under: run.value, color: 'rgba(0, 121, 90, 0.18)' },
      note: 'Shaded area: ' + money(run.discounted).replace(NB, ' ') + ' today'
    });
    text(ctx, 'Years from now', (x0 + x1) / 2, c.h - 6, { align: 'center', color: INK });

    if (cursor === null) return;
    var at = Math.min(cursor, T), x = px(at);
    function dot(y, color) {
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      var y1 = top + i * (each + between);
      line(x, y1, x, y1 + each, INK);
    }
    dot(pyIncome(run.gCool[at]), COOL); dot(pyIncome(run.gHot[at]), HOT);
    dot(pyDamage(run.damage[at]), DAMAGE); dot(pyValue(run.value[at]), VALUE);
  }

  // ---- The words under the graph ----

  function readout(run) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var t = Math.min(cursor, run.years);
    return 'In year ' + t + ', the cooler world\'s income is ' + money(run.gCool[t]) + ' a year and the hotter ' +
      'world\'s is ' + money(run.gHot[t]) + '. The damage that year is ' + money(run.damage[t]) + ', worth ' +
      money(run.value[t]) + ' today. The damage from now to year ' + t + ', valued today, adds up to ' +
      money(run.soFar[t]) + '.';
  }

  function summary(run) {
    var T = run.years;
    return 'In ' + T + ' years the cooler world\'s income is ' + money(run.gCool[T]) + ' a year and the hotter ' +
      'world\'s is ' + money(run.gHot[T]) + ', ' + percent(run.lastShortfall * 100, 1) + ' lower. Added up over ' +
      'the ' + T + ' years, the hotter world loses ' + money(run.notDiscounted) + ', not discounted. Discounted at ' +
      percent(state.disc, 1) + ' a year, that damage is worth ' + money(run.discounted) + ' today. It would pay ' +
      'to spend up to that much this year to avoid it.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view !== 'damage') return;
    var run = answer();
    drawDamage(run);
    say('damage-readout', readout(run));
    say('damage-summary', summary(run));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key), number = parseFloat(value);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (!isFinite(number)) return;
      var box = $(key), step = +box.step;
      state[key] = round(clamp(Math.round(number / step) * step, +box.min, +box.max), PLACES[key]);
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
      history.replaceState(null, '', query + (state.view === 'damage' ? '' : location.hash));
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
    var reading = state.view !== 'damage' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-' + state.view).contains(place)) place.scrollIntoView();
  }

  /* Read the graph at the pointer, or move along it with the keys. */
  function point(event) {
    if (!plot) return;
    var box = $('damage').getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = Math.round(clamp(along, 0, 1) * state.years);
    changed();
  }

  function keys(event) {
    var by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (by === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    // The first press starts halfway along. With Shift, each press is ten years.
    var at = cursor === null ? Math.round(state.years / 2) : cursor + by * (event.shiftKey ? 10 : 1);
    if (event.key === 'Home') at = 0;
    if (event.key === 'End') at = state.years;
    cursor = clamp(at, 0, state.years);
    changed();
  }

  function start() {
    readAddress();
    Object.keys(PLACES).forEach(function (key) { show[key] = pair(key); });

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.presets button'), function (button) {
      button.addEventListener('click', function () { state.disc = parseFloat(button.dataset.disc); changed(); });
    });
    $('reset').addEventListener('click', function () {
      Object.keys(PLACES).forEach(function (key) { state[key] = DEFAULTS[key]; });
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    $('damage').addEventListener('pointermove', point);
    $('damage').addEventListener('pointerdown', point);
    $('damage').addEventListener('keydown', keys);
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
