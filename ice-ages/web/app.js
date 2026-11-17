/* Ice-age model: the page. model.js is the science. This file is the controls, the graphs and the words
 * under them. Every number it shows comes from model.js or data.json. */
(function () {
  'use strict';

  var M = window.IceAges;
  var VIEWS = ['past', 'future', 'about'];
  // The page opens on the last 800,000 years, with everything on, and 1,000 GtC for the future.
  var DEFAULTS = { view: 'past', co2: 'on', old: 'on', orbit: 'both', E: 1000 };
  var ORBITS = ['both', 'tilt', 'precession'];
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var MODEL = '#2a78d6', GRAY = '#7d8a92', SUN = '#eb6834';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line
  var SPANS = { past: { first: -800, last: 0, start: -21 }, future: { first: 0, last: 1000, start: 100 } };
  var SKIP = 3;            // after fossil carbon goes in, the carbon dioxide and temperature aren't drawn for 3 steps
  var SEA_LEVEL = 120;     // meters: about how far the seas fell for v = 1 (Chapter 5)

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var data = null;
  var cursor = null;    // the year being read, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var showControls = null;

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  /* A number with commas and a true minus sign: "1,000", "−0.07". */
  function commas(x, places) {
    var words = x.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
    return words.replace(/^-/, '−').replace(/^−(0\.?0*)$/, '$1');
  }

  /* The runs on the page. A few are kept, so that moving between views doesn't run them again. */
  var runs = {}, kept = 0;
  function runWith(fossil) {
    var o = { fossil: fossil, co2Follows: state.co2 === 'on', oldIce: state.old === 'on', orbit: state.orbit };
    var key = JSON.stringify(o);
    if (!runs[key]) {
      if (kept >= 8) { runs = {}; kept = 0; }
      runs[key] = M.run(data, o);
      kept += 1;
    }
    return runs[key];
  }
  var asItWas = null;     // the Sunlight with both parts of the orbit, drawn in gray when one is held still
  function bothOrbits() { return asItWas || (asItWas = M.run(data, {})); }

  // ---- Years in words ----

  /* "21,000 years ago", "now", "100,000 years from now". */
  function when(year) {
    if (year === 0) return 'Now';
    return commas(Math.abs(year) * 1000, 0) + ' years ' + (year < 0 ? 'ago' : 'from now');
  }

  function degrees(t) {
    var size = commas(Math.abs(t), 1);
    if (size === '0.0') return 'the same as preindustrial';
    return size + NB + '°C (' + commas(Math.abs(t) * 1.8, 1) + NB + '°F) ' + (t < 0 ? 'colder' : 'warmer') +
      ' than preindustrial';
  }

  // ---- The controls ----

  function controls() {
    var number = $('E'), range = $('E-range');
    function put() {
      $('co2').checked = state.co2 === 'on';
      $('old').checked = state.old === 'on';
      $('orbit').value = state.orbit;
      number.value = range.value = String(state.E);
      $('fossil-control').hidden = state.view !== 'future';
    }
    function takeE(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state.E = clamp(Math.round(value / 50) * 50, +number.min, +number.max);
      put();
      changed();
    }
    range.addEventListener('input', function () { takeE(range); });
    number.addEventListener('change', function () { takeE(number); });
    $('co2').addEventListener('change', function () { state.co2 = $('co2').checked ? 'on' : 'off'; changed(); });
    $('old').addEventListener('change', function () { state.old = $('old').checked ? 'on' : 'off'; changed(); });
    $('orbit').addEventListener('change', function () { state.orbit = $('orbit').value; changed(); });
    $('so-far').addEventListener('click', function () { state.E = 750; changed(); });
    $('reset').addEventListener('click', function () {
      ['co2', 'old', 'orbit', 'E'].forEach(function (key) { state[key] = DEFAULTS[key]; });
      changed();
    });
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
  function text(ctx, string, x, y, opts) {
    opts = opts || {};
    ctx.font = (opts.bold ? '600 ' : '') + (opts.size || 13) + 'px ' + FONT;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'alphabetic';
    if (opts.halo) {
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = opts.halo;
      ctx.strokeText(string, x, y);
    }
    ctx.fillStyle = opts.color || TICK;
    ctx.fillText(string, x, y);
  }

  /* A round size for the gap between gridlines, so that about `count` of them cover `span`. */
  function roundGap(span, count) {
    var raw = span / count, power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 2.5 ? 2.5 : lead <= 5 ? 5 : 10) * power;
  }

  function tickText(value, gap) {
    var places = Math.max(0, -Math.floor(Math.log(gap) / Math.LN10 + 1e-9));
    if (gap === 2.5 || gap === 0.25 || gap === 0.025) places += 1;
    return commas(Math.abs(value) < gap / 1e6 ? 0 : value, places);
  }

  /* A panel's scale: round numbers that cover every value it draws and the range it always shows. */
  function scaleOf(panel) {
    var low = panel.range[0], high = panel.range[1];
    panel.series.forEach(function (s) {
      s.values.forEach(function (v) { if (v !== null) { low = Math.min(low, v); high = Math.max(high, v); } });
    });
    var gap = panel.gap || roundGap(high - low, 4);
    return { low: Math.floor(low / gap + 1e-9) * gap, high: Math.ceil(high / gap - 1e-9) * gap, gap: gap };
  }

  /* A stack of graphs that share the years along the bottom. Each panel has a title, a range and lines.
   * A line's values run with `years`; null leaves a gap. */
  function drawStack(view, panels, span, years) {
    var c = prepare($('graph-' + view)), ctx = c.ctx, narrow = c.w < 560;
    var scales = panels.map(scaleOf);
    ctx.font = '13px ' + FONT;
    var widest = 0;
    scales.forEach(function (sc) {
      for (var v = sc.low; v <= sc.high + sc.gap / 2; v += sc.gap) {
        widest = Math.max(widest, ctx.measureText(tickText(v, sc.gap)).width);
      }
    });
    var count = panels.length, top = 30, bottom = 44, between = 54;
    var x0 = Math.ceil(widest) + 14, x1 = c.w - (narrow ? 14 : 24);
    var each = (c.h - top - bottom - (count - 1) * between) / count;
    var first = span.first, width = span.last - span.first;
    plot = { x0: x0, x1: x1 };
    function px(year) { return x0 + (year - first) / width * (x1 - x0); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
    var pys = [];
    panels.forEach(function (panel, index) {
      var y1 = top + index * (each + between), y0 = y1 + each, sc = scales[index];
      function py(v) { return y0 - (v - sc.low) / (sc.high - sc.low) * (y0 - y1); }
      pys.push(py);
      ctx.lineWidth = 1;
      for (var v = sc.low; v <= sc.high + sc.gap / 2; v += sc.gap) {
        line(x0, py(v), x1, py(v), Math.abs(v - (panel.zero || 0)) < sc.gap / 2 && panel.zero !== undefined ? SPINE : GRID);
        text(ctx, tickText(v, sc.gap), x0 - 7, py(v), { align: 'right', baseline: 'middle' });
      }
      line(x0, y1, x0, y0, SPINE); line(x0, y0, x1, y0, SPINE);
      // A tick every 100,000 years, with every other one labeled on a narrow screen.
      for (var year = first; year <= span.last; year += 100) {
        line(px(year), y0, px(year), y0 + 5, SPINE);
        if (narrow && year % 200 !== 0) continue;
        var label = commas(Math.abs(year), 0), half = ctx.measureText(label).width / 2 + 2;
        text(ctx, label, Math.min(px(year), c.w - half), y0 + 18, { align: 'center' });
      }
      text(ctx, narrow && panel.short ? panel.short : panel.title, narrow ? 4 : x0, y1 - 12, { bold: true, color: INK });
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y1 - 3, x1 - x0, y0 - y1 + 3); ctx.clip();
      panel.series.forEach(function (s) {
        ctx.beginPath();
        var drawing = false;
        s.values.forEach(function (v, k) {
          if (v === null) { drawing = false; return; }
          ctx[drawing ? 'lineTo' : 'moveTo'](px(years[k]), py(v));
          drawing = true;
        });
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2; ctx.lineJoin = 'round';
        ctx.stroke();
      });
      ctx.restore();
    });
    text(ctx, span.first < 0 ? 'Thousands of years ago' : 'Thousands of years from now', (x0 + x1) / 2, c.h - 6,
      { align: 'center', color: INK });

    if (cursor === null) return;
    var at = cursor - first, x = px(cursor);
    ctx.lineWidth = 1;
    panels.forEach(function (panel, index) {
      var y1 = top + index * (each + between);
      line(x, y1, x, y1 + each, INK);
      panel.series.forEach(function (s) {
        if (s.values[at] === null) return;
        ctx.beginPath(); ctx.arc(x, pys[index](s.values[at]), 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = s.color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    });
  }

  /* The part of a run, or of a record, from span.first to span.last. */
  function slice(values, run, span) {
    return values.slice(M.at(run, span.first), M.at(run, span.last) + 1);
  }

  function recordOn(name, span) {
    var rec = data.record[name], out = [];
    for (var year = span.first; year <= span.last; year++) {
      var k = year - rec.first;
      out.push(k >= 0 && k < rec.values.length ? rec.values[k] : null);
    }
    return out;
  }

  /* After fossil carbon goes in, the model's first steps can't follow it: those values are left out. */
  function afterPulse(values, years, fossil) {
    return values.map(function (v, k) { return fossil > 0 && years[k] >= 0 && years[k] < SKIP ? null : v; });
  }

  function sunlightPanel(run, span) {
    var series = [];
    if (state.orbit !== 'both') series.push({ values: slice(bothOrbits().f, bothOrbits(), span), color: GRAY, width: 1.4 });
    series.push({ values: slice(run.f, run, span), color: SUN, width: 1.8 });
    return { title: 'Summer Sunlight at 65 °N (W/m²)', range: [430, 560], series: series };
  }

  function panelsFor(view) {
    var span = SPANS[view], years = [];
    for (var year = span.first; year <= span.last; year++) years.push(year);
    var ice = { title: 'Ice on land (1 = the last ice age at its biggest)', short: 'Ice on land (last ice age = 1)',
      range: [0, 1], gap: 0.25, zero: 0, series: [] };
    var co2 = { title: 'Carbon dioxide in the air (ppm)', range: [150, 300], series: [] };
    var temp = { title: 'Temperature compared with preindustrial (°C)', short: 'Temperature vs preindustrial (°C)',
      range: [-6, 1], zero: 0, series: [] };
    if (view === 'past') {
      var run = runWith(0);
      ice.series.push({ values: recordOn('ice', span), color: GRAY, width: 1.6 });
      co2.series.push({ values: recordOn('co2', span), color: GRAY, width: 1.6 });
      ice.series.push({ values: slice(run.v, run, span), color: MODEL, width: 2.4 });
      co2.series.push({ values: slice(run.co2, run, span), color: MODEL, width: 2.4 });
      temp.series.push({ values: slice(run.T, run, span), color: MODEL, width: 2.4 });
      return { panels: [sunlightPanel(run, span), ice, co2, temp], years: years, span: span };
    }
    var none = runWith(0), yours = runWith(state.E);
    [[none, GRAY, 2, 0], [yours, MODEL, 2.4, state.E]].forEach(function (r) {
      ice.series.push({ values: slice(r[0].v, r[0], span), color: r[1], width: r[2] });
      co2.series.push({ values: afterPulse(slice(r[0].co2, r[0], span), years, r[3]), color: r[1], width: r[2] });
      temp.series.push({ values: afterPulse(slice(r[0].T, r[0], span), years, r[3]), color: r[1], width: r[2] });
    });
    return { panels: [sunlightPanel(yours, span), ice, co2, temp], years: years, span: span };
  }

  // ---- The words under the graphs ----

  /* The ice, with the sea level it would hold: v × 120 m, to the nearest 5 m, or 1 m when it's under 10 m. */
  function iceWords(v) {
    if (v < 0.005) return commas(v, 2) + ' (no more ice than today)';
    var meters = v * SEA_LEVEL, step = meters < 10 ? 1 : 5;
    return commas(v, 2) + ' (enough to lower the seas about ' + commas(Math.max(1, Math.round(meters / step) * step), 0) +
      NB + 'm)';
  }

  function readout() {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    if (state.view === 'past') {
      var run = runWith(0), k = M.at(run, cursor), rec = {};
      ['ice', 'co2'].forEach(function (name) {
        var r = data.record[name];
        rec[name] = cursor - r.first >= 0 && cursor - r.first < r.values.length ? r.values[cursor - r.first] : null;
      });
      var words = when(cursor) + '. Summer Sunlight at 65' + NB + '°N: ' + commas(run.f[k], 0) + NB + 'W/m². ' +
        'Ice on land: ' + iceWords(run.v[k]) + ' in the model';
      words += rec.ice !== null ? ', and ' + commas(rec.ice, 2) + ' in the sea-level record. ' : '. ';
      words += 'Carbon dioxide: ' + commas(run.co2[k], 0) + NB + 'ppm in the model';
      words += rec.co2 !== null ? ', and ' + commas(rec.co2, 0) + NB + 'ppm in the ice cores. ' : '. ';
      return words + 'Temperature: ' + degrees(run.T[k]) + ' in the model.';
    }
    var none = runWith(0), yours = runWith(state.E), j = M.at(yours, cursor);
    var head = when(cursor) + '. Summer Sunlight at 65' + NB + '°N: ' + commas(yours.f[j], 0) + NB + 'W/m². ';
    function one(r, fossil) {
      var words = 'ice ' + iceWords(r.v[j]);
      if (fossil > 0 && cursor < SKIP) {
        return words + '; the model\'s 1,000-year steps can\'t follow the carbon dioxide and the temperature ' +
          'in the first few thousand years after the fossil carbon goes in';
      }
      return words + ', carbon dioxide ' + commas(r.co2[j], 0) + NB + 'ppm and a temperature ' + degrees(r.T[j]);
    }
    return head + 'With no fossil carbon: ' + one(none, 0) + '. With ' + commas(state.E, 0) + NB + 'GtC: ' +
      one(yours, state.E) + '.';
  }

  /* When the ice starts to grow again, and when it's half as big as in the last ice age, in words. */
  function nextIceAge(r) {
    if (r.v[M.at(r, 0)] > 0.05) {
      return 'the ice of the last ice age never melts away, so the ice age goes on';
    }
    var start = M.firstAbove(r, 0.05, 0), half = M.firstAbove(r, 0.5, 0);
    if (start === null) return 'no ice grows in the next million years';
    var words = 'ice starts to grow again ' + when(start);
    words += half === null ? ', but it never reaches half the size of the last ice age\'s in the next million years'
      : ', and it\'s half as big as in the last ice age ' + when(half);
    return words;
  }

  function summary() {
    if (state.view === 'past') {
      var run = runWith(0), span = SPANS.past, model = slice(run.v, run, span), rec = recordOn('ice', span);
      var pairs = [[], []];
      rec.forEach(function (v, k) { if (v !== null) { pairs[0].push(model[k]); pairs[1].push(v); } });
      var r = M.correlation(pairs[0], pairs[1]), most = Math.max.apply(null, model);
      var co2 = slice(run.co2, run, span);
      return 'Over the last 800,000 years, the ice in the model and in the sea-level record rise and fall together ' +
        'with a correlation of ' + commas(r, 2) + ' (1 would be a perfect match). The model\'s ice grows as big as ' +
        commas(most, 2) + ', and its carbon dioxide stays between ' + commas(Math.min.apply(null, co2), 0) + ' and ' +
        commas(Math.max.apply(null, co2), 0) + NB + 'ppm.';
    }
    var words = 'With no fossil carbon, ' + nextIceAge(runWith(0)) + '. With ' + commas(state.E, 0) + NB +
      'GtC of fossil carbon, ' + nextIceAge(runWith(state.E)) + '.';
    if (state.E > 0) {
      words += ' A hundred thousand years from now, ' + commas(M.fossilCO2(state.E, 100), 0) + NB +
        'ppm of the fossil carbon dioxide is still in the air.';
    }
    return words;
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function keyFor(view) {
    var items = view === 'past'
      ? [['model', 'The model'], ['gray', 'The records'], ['sun', 'The Sunlight the model uses']]
      : [['gray', 'No fossil carbon'], ['model', 'Your fossil carbon: ' + commas(state.E, 0) + NB + 'GtC'],
        ['sun', 'The Sunlight the model uses']];
    if (state.orbit !== 'both') items.push(['gray thin', 'The Sunlight as it was']);
    var html = items.map(function (item) {
      return '<li><span class="line ' + item[0] + '"></span><span>' + item[1] + '</span></li>';
    }).join('');
    if ($('key-' + view).innerHTML !== html) $('key-' + view).innerHTML = html;
  }

  function draw() {
    if (state.view === 'about' || !data) return;
    if (cursor !== null) cursor = clamp(cursor, SPANS[state.view].first, SPANS[state.view].last);
    var made = panelsFor(state.view);
    keyFor(state.view);
    drawStack(state.view, made.panels, made.span, made.years);
    say('readout-' + state.view, readout()); say('summary-' + state.view, summary());
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    var view = params.get('view'), orbit = params.get('orbit'), E = parseFloat(params.get('E'));
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    ['co2', 'old'].forEach(function (key) { if (params.get(key) === 'off') state[key] = 'off'; });
    if (ORBITS.indexOf(orbit) >= 0) state.orbit = orbit;
    if (isFinite(E)) state.E = clamp(Math.round(E / 50) * 50, 0, 3000);
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
    requestAnimationFrame(function () { pending = false; showControls(); saveToAddress(); draw(); });
  }

  function selectView(view, focus) {
    if (view !== state.view) cursor = null;
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
    if (!plot || state.view === 'about') return;
    var span = SPANS[state.view], box = event.currentTarget.getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = span.first + Math.round(clamp(along, 0, 1) * (span.last - span.first));
    changed();
  }

  function keys(event) {
    var by = { ArrowLeft: -1, ArrowRight: 1 }[event.key], span = SPANS[state.view];
    if (!span || (by === undefined && event.key !== 'Home' && event.key !== 'End')) return;
    event.preventDefault();
    // The first press starts at the last ice age (or 100,000 years from now). With Shift, each press is 10 steps.
    var at = cursor === null ? span.start : cursor + by * (event.shiftKey ? 10 : 1);
    if (event.key === 'Home') at = span.first;
    if (event.key === 'End') at = span.last;
    cursor = clamp(at, span.first, span.last);
    changed();
  }

  function start() {
    readAddress();
    showControls = controls();

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
    ['past', 'future'].forEach(function (view) {
      $('graph-' + view).addEventListener('pointermove', point);
      $('graph-' + view).addEventListener('pointerdown', point);
      $('graph-' + view).addEventListener('keydown', keys);
    });
    window.addEventListener('resize', changed);

    selectView(state.view);
    goToAddressPlace();
    fetch('data.json').then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    }).then(function (loaded) {
      data = loaded;
      changed();
    }).catch(function () {
      say('summary-past', 'The model\'s data didn\'t load. Check your connection, then reload the page.');
      say('summary-future', $('summary-past').textContent);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
