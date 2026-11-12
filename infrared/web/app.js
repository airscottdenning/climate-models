/* Infrared model: the page. model.js is the science. This file is the controls, the graph and the words under
 * it. It works out nothing about the air itself: every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Infrared;
  var VIEWS = ['spectrum', 'how', 'about'];
  // What the page shows when the address says nothing. `far` is a far-out case, and `keep` is the kept spectrum.
  var DEFAULTS = { view: 'spectrum', sky: 'midlatitude', co2: 420, ch4: 1900, water: 1, far: '', keep: '' };
  var GASES = {
    co2: { name: 'CO₂', unit: 'ppm', words: 'parts per million' },
    ch4: { name: 'methane', unit: 'ppb', words: 'parts per billion' }
  };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var RED = '#c0392b', BLUE = '#0072b2', GRAY = '#7b8991', BAND = '#e9f3fa';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';                    // a space that keeps a number and its unit on one line
  var FIRST = 4, LAST = 30, TOP = 11;   // the graph's edges: wavelengths in µm, and the tallest brightness
  var BLACK = [220, 240, 260, 280];     // the gray curves, in kelvins

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var data = null;      // the tables, once they've loaded
  var cursor = null;    // which of the 2,000 wavelengths is being read, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var show = {};        // one function for each pair of controls: put the state's number in them

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  function fixed(x, digits) { return minus(x.toFixed(digits)); }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }
  function amountText(n) { return n < 1 ? String(n) : commas(n); }

  // ---- The air that's showing, and the air that was kept ----

  /* A mix is a column of air and what's in it. A far-out mix is one the research model calculated by itself. */
  function currentMix() {
    return { sky: state.sky, far: state.far, co2: state.co2, ch4: state.ch4, water: state.water };
  }

  function farCase(sky, id) {
    return sky.cases.filter(function (c) { return c.id === id; })[0] || null;
  }

  function farLabel(c) {
    if (c.co2 !== M.TODAY.co2) return 'CO₂ at ' + amountText(c.co2) + NB + 'ppm';
    return 'Methane at ' + amountText(c.ch4) + NB + 'ppb';
  }

  /* A mix as the address keeps it: "midlatitude,840,1900,1" or "midlatitude,co2-10". */
  function mixText(mix) {
    return mix.far ? mix.sky + ',' + mix.far : [mix.sky, mix.co2, mix.ch4, +mix.water.toFixed(4)].join(',');
  }

  /* The other way: a mix from the address, or null if the tables don't cover it. */
  function parseMix(string) {
    var parts = String(string || '').split(','), sky = data.skies[parts[0]];
    if (!sky) return null;
    if (parts.length === 2) {
      return farCase(sky, parts[1]) ? { sky: sky.id, far: parts[1], co2: 0, ch4: 0, water: 1 } : null;
    }
    var co2 = parseFloat(parts[1]), ch4 = parseFloat(parts[2]), water = parseFloat(parts[3]);
    var inside = parts.length === 4 && co2 >= sky.co2[0] && co2 <= sky.co2[sky.co2.length - 1] &&
      ch4 >= sky.ch4[0] && ch4 <= sky.ch4[sky.ch4.length - 1] &&
      water >= sky.water[0] && water <= sky.water[sky.water.length - 1];
    return inside ? { sky: sky.id, far: '', co2: co2, ch4: ch4, water: water } : null;
  }

  function describe(mix) {
    var sky = data.skies[mix.sky];
    if (mix.far) return sky.label + ', with ' + farLabel(farCase(sky, mix.far)) + ' and the rest as it is today';
    return sky.label + ', with ' + commas(mix.co2) + NB + 'ppm of CO₂, ' + commas(mix.ch4) + NB +
      'ppb of methane and ' + mix.water.toFixed(2) + ' times the usual water vapor';
  }

  /* The spectrum and the totals for a mix. The last answer for each of the two lines on the graph is kept, so
   * moving over the graph doesn't work it all out again. A far-out mix has a spectrum but no totals. */
  var answers = {};
  function answer(mix, line) {
    var key = mixText(mix);
    if (answers[line] && answers[line].key === key) return answers[line];
    var sky = data.skies[mix.sky], found = mix.far ? farCase(sky, mix.far) : null;
    answers[line] = {
      key: key, mix: mix, sky: sky,
      spectrum: found ? found.spectrum : M.spectrum(sky, mix.co2, mix.ch4, mix.water),
      totals: found ? null : M.totals(sky, mix.co2, mix.ch4, mix.water)
    };
    return answers[line];
  }

  // ---- The controls ----

  /* A slider and a number box for one gas. The box holds the amount. The slider counts doublings from today's
   * amount (step 3 on the About tab), so each doubling is the same distance along it. */
  function gasPair(key) {
    var number = $(key), range = $(key + '-range'), hint = $(key + '-hint');
    var today = M.TODAY[key], step = parseFloat(number.step), gas = GASES[key];
    function tell() {
      var ratio = state[key] / today;
      hint.textContent = state[key] === today ? 'Today\'s amount.' :
        ratio.toFixed(2) + ' times today\'s ' + commas(today) + NB + gas.unit + '.';
      range.setAttribute('aria-valuetext', commas(state[key]) + ' ' + gas.words);
    }
    function put() { number.value = state[key]; range.value = M.doublings(state[key], today); tell(); }
    function take(source) {
      var amount = parseFloat(source.value);
      if (!isFinite(amount)) { put(); return; }
      if (source === range) amount = Math.round(today * Math.pow(2, amount) / step) * step;
      state[key] = clamp(amount, parseFloat(number.min), parseFloat(number.max));
      if (source === range) { number.value = state[key]; tell(); } else put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* A slider and a number box that hold the same number. */
  function pair(id, key, digits) {
    var number = $(id), range = $(id + '-range');
    function put() { number.value = state[key].toFixed(digits); range.value = state[key]; }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = clamp(value, parseFloat(number.min), parseFloat(number.max));
      if (source === range) number.value = state[key].toFixed(digits); else put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* The far-out choices for the column that's showing: CO₂ first, then methane, each from least to most. */
  function fillFar() {
    var select = $('far'), sky = data.skies[state.sky];
    while (select.options.length > 1) select.remove(1);
    sky.cases.slice().sort(function (a, b) {
      return (a.co2 !== M.TODAY.co2 ? 0 : 1) - (b.co2 !== M.TODAY.co2 ? 0 : 1) || a.co2 - b.co2 || a.ch4 - b.ch4;
    }).forEach(function (c) { select.add(new Option(farLabel(c), c.id)); });
  }

  /* Put the state into every control. */
  function showAll() {
    var far = !!state.far, kept = !!state.keep;
    $('sky').value = state.sky;
    Object.keys(show).forEach(function (key) {
      show[key]();
      $(key).disabled = $(key + '-range').disabled = far;
    });
    $('key-kept').hidden = $('kept-line').hidden = !kept;
    if (!data) return;
    var sky = data.skies[state.sky];
    $('sky-hint').textContent = 'A clear sky, with no clouds. The surface is at ' + sky.surfaceK.toFixed(1) + NB +
      'K (' + fixed(sky.surfaceK - 273.15, 0) + NB + '°C).';
    fillFar();
    $('far').value = state.far;
    $('far-hint').textContent = far ?
      'The research model calculated this spectrum by itself, with the rest of the air as it is today. ' +
      'The sliders are off while it\'s showing, and there are no totals.' :
      'Air with almost none of a gas, or far more than the sliders reach.';
  }

  /* Once the tables are here: drop anything in the address that they don't cover. */
  function settle() {
    if (!data.skies[state.sky]) state.sky = DEFAULTS.sky;
    if (state.far && !farCase(data.skies[state.sky], state.far)) state.far = '';
    if (state.keep && !parseMix(state.keep)) state.keep = '';
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

  /* The wavelength nearest to `um`, as its place among the 2,000. */
  function nearest(um) {
    var w = data.wavelengths, last = w.length - 1;
    return clamp(Math.round((um - w[0]) / (w[last] - w[0]) * last), 0, last);
  }

  /* The gases that take each bite, as bars above the graph. Methane's bite overlaps water vapor's, so it
   * goes on a second row. A narrow screen gets the short names. */
  var BITES = [
    { from: 5, to: 8, name: 'Water vapor', short: 'H₂O', row: 0 },
    { from: 9.3, to: 10, name: 'Ozone', short: 'O₃', row: 0 },
    { from: 13, to: 17, name: 'CO₂', short: 'CO₂', row: 0 },
    { from: 17, to: 30, name: 'Water vapor', short: 'H₂O', row: 0 },
    { from: 7.3, to: 8.3, name: 'Methane', short: 'CH₄', row: 1 }
  ];

  function drawSpectrum(now, kept) {
    var c = prepare($('spectrum')), ctx = c.ctx, narrow = c.w < 560;
    var left = narrow ? 46 : 64, right = narrow ? 10 : 16, top = 56, bottom = 46;
    var x0 = left, x1 = c.w - right, y0 = c.h - bottom, y1 = top;
    var w = data.wavelengths, surfaceK = now.sky.surfaceK;
    function px(um) { return x0 + (um - FIRST) / (LAST - FIRST) * (x1 - x0); }
    function py(glow) { return y0 - glow / TOP * (y0 - y1); }
    function curve(value, color, width, dash) {
      ctx.beginPath();
      for (var i = 0; i < w.length; i++) ctx[i ? 'lineTo' : 'moveTo'](px(w[i]), py(value(i)));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
      ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    function black(kelvin) { return function (i) { return M.planck(w[i], kelvin); }; }
    function from(spectrum) { return function (i) { return spectrum[i]; }; }
    plot = { x0: x0, x1: x1 };

    // The window, the grid and the axes.
    ctx.fillStyle = BAND; ctx.fillRect(px(8), y1, px(13) - px(8), y0 - y1);
    text(ctx, 'Window', px(10.5), y1 + 17, { bold: true, align: 'center', color: '#2f6f99' });
    ctx.lineWidth = 1;
    for (var glow = 0; glow <= TOP; glow += 2) {
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(x0, py(glow)); ctx.lineTo(x1, py(glow)); ctx.stroke();
      text(ctx, String(glow), x0 - 8, py(glow), { align: 'right', baseline: 'middle' });
    }
    ctx.strokeStyle = SPINE;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
    for (var um = 5; um <= LAST; um += 5) {
      ctx.beginPath(); ctx.moveTo(px(um), y0); ctx.lineTo(px(um), y0 + 5); ctx.stroke();
      text(ctx, String(um), px(um), y0 + 19, { align: 'center' });
    }
    text(ctx, 'Wavelength (µm)', (x0 + x1) / 2, c.h - 8, { align: 'center', color: INK });
    ctx.save();
    ctx.translate(narrow ? 13 : 18, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    text(ctx, narrow ? 'W/m² per steradian per µm' : 'Earthlight (W/m² per steradian per µm)', 0, 0,
      { align: 'center', color: INK });
    ctx.restore();

    // Which gas takes which bite.
    BITES.forEach(function (bite) {
      var y = 22 + bite.row * 24, a = px(bite.from) + 1, b = px(bite.to) - 1;
      ctx.fillStyle = GRAY; ctx.fillRect(a, y, b - a, 4);
      text(ctx, narrow ? bite.short : bite.name, (a + b) / 2, y - 5, { align: 'center', size: 12 });
    });

    // Black surfaces at four temperatures, then the surface, the kept spectrum and the one that's showing.
    BLACK.forEach(function (kelvin) {
      curve(black(kelvin), GRAY, 1.2);
      text(ctx, kelvin + NB + 'K', px(11.6), py(M.planck(11.6, kelvin)) + 15,
        { size: 12, color: '#4a5a66', align: 'center', halo: BAND });
    });
    curve(black(surfaceK), RED, 2.2);
    text(ctx, 'Surface, ' + surfaceK.toFixed(0) + NB + 'K', px(17.2), py(M.planck(17.2, surfaceK)) - 9,
      { bold: true, color: RED, halo: '#ffffff' });
    if (kept) curve(from(kept.spectrum), BLUE, 1.8, [6, 4]);
    curve(from(now.spectrum), INK, 1.9);

    // The wavelength being read.
    if (cursor === null) return;
    var x = px(w[cursor]);
    function dot(glow, color) {
      ctx.beginPath(); ctx.arc(x, py(glow), 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y0); ctx.stroke();
    dot(M.planck(w[cursor], surfaceK), RED);
    if (kept) dot(kept.spectrum[cursor], BLUE);
    dot(now.spectrum[cursor], INK);
  }

  // ---- The words under the graph ----

  /* A brightness, and the temperature of the black surface that glows that brightly (step 2). */
  function asTemperature(um, glow) {
    var kelvin = M.brightnessTemperature(um, glow);
    return kelvin.toFixed(0) + NB + 'K (' + fixed(kelvin - 273.15, 0) + NB + '°C)';
  }

  function readout(now, kept) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var um = data.wavelengths[cursor], glow = now.spectrum[cursor];
    var words = 'At ' + um.toFixed(2) + NB + 'µm, the Earthlight leaving the top of the atmosphere is ' +
      glow.toFixed(2) + NB + 'W/m² per steradian per µm. That\'s how brightly a black surface at ' +
      asTemperature(um, glow) + ' glows. The surface itself gives off ' +
      M.planck(um, now.sky.surfaceK).toFixed(2) + '.';
    if (kept) {
      words += ' The spectrum you kept is at ' + kept.spectrum[cursor].toFixed(2) + ', like a black surface at ' +
        asTemperature(um, kept.spectrum[cursor]) + '.';
    }
    return words;
  }

  function summary(now, kept) {
    var unit = NB + 'W/m²', words = describe(now.mix) + '. ';
    if (!now.totals) {
      words += 'This is one of the far-out spectra, so there are no totals for it.';
    } else {
      var t = now.totals, glow = now.sky.surfaceGlow;
      words += 'Leaving the top of the atmosphere, at all wavelengths and in all directions (the outgoing ' +
        'longwave radiation, OLR): ' + t.top.toFixed(1) + unit + '. The surface gives off ' + glow.toFixed(1) +
        unit + ' and gets ' + t.sky.toFixed(1) + ' back from the sky, so it loses ' + t.net.toFixed(1) + '.';
    }
    if (!kept) return words;
    words += ' The spectrum you kept: ' + describe(kept.mix) + '.';
    if (now.totals && kept.totals) {
      var change = now.totals.top - kept.totals.top, size = Math.abs(change).toFixed(1);
      words += ' It had ' + kept.totals.top.toFixed(1) + unit + ' leaving the top of the atmosphere. Now ' +
        (size === '0.0' ? 'the same amount leaves.' : size + (change < 0 ? ' less' : ' more') + ' leaves.');
    }
    return words;
  }

  function draw() {
    if (!data || state.view !== 'spectrum') return;
    var now = answer(currentMix(), 'now'), keptMix = state.keep ? parseMix(state.keep) : null;
    var kept = keptMix ? answer(keptMix, 'kept') : null;
    drawSpectrum(now, kept);
    $('spectrum-readout').textContent = readout(now, kept);
    $('spectrum-summary').textContent = summary(now, kept);
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (isFinite(parseFloat(value))) state[key] = clamp(parseFloat(value), +$(key).min, +$(key).max);
    });
    if (VIEWS.indexOf(state.view) < 0) state.view = DEFAULTS.view;
    if (!$('sky').querySelector('option[value="' + state.sky.replace(/[^a-z]/g, '') + '"]')) state.sky = DEFAULTS.sky;
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] === DEFAULTS[key]) return;
      parts.push(key + '=' + encodeURIComponent(typeof state[key] === 'number' ? +state[key].toFixed(4) : state[key]));
    });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    // On the two tabs for reading, the address keeps the place on the tab as well.
    try {
      history.replaceState(null, '', query + (state.view === 'spectrum' ? '' : location.hash));
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
    VIEWS.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      // Until the tables are here there's nothing to draw, but the two tabs for reading can be read.
      $('panel-' + name).hidden = !on || (!data && name === 'spectrum');
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

  /* An address can point at a place on a reading tab, such as ?view=about#about-equations. Go there. */
  function goToAddressPlace() {
    var reading = state.view !== 'spectrum' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-' + state.view).contains(place)) place.scrollIntoView();
    return window.scrollY;
  }

  /* Read the graph at the pointer, or step along it with the keys. */
  function point(event) {
    if (!data || !plot) return;
    var box = $('spectrum').getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = nearest(FIRST + clamp(along, 0, 1) * (LAST - FIRST));
    changed();
  }

  function step(event) {
    var by = { ArrowLeft: -0.1, ArrowRight: 0.1 }[event.key];
    if (!data || (by === undefined && event.key !== 'Home' && event.key !== 'End')) return;
    event.preventDefault();
    // The first press starts in the middle of carbon dioxide's bite.
    var um = cursor === null ? 15 : Math.round(data.wavelengths[cursor] * 10) / 10 + by * (event.shiftKey ? 10 : 1);
    if (event.key === 'Home') um = FIRST;
    if (event.key === 'End') um = LAST;
    cursor = nearest(clamp(um, FIRST, LAST));
    changed();
  }

  function start() {
    readAddress();
    show.co2 = gasPair('co2');
    show.ch4 = gasPair('ch4');
    show.water = pair('water', 'water', 2);
    function set(change) { return function () { change(this); showAll(); changed(); }; }

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    $('sky').addEventListener('change', set(function (select) {
      state.sky = select.value;
      if (data && state.far && !farCase(data.skies[state.sky], state.far)) state.far = '';
    }));
    $('far').addEventListener('change', set(function (select) { state.far = select.value; }));
    Array.prototype.forEach.call(document.querySelectorAll('.presets button'), function (button) {
      button.addEventListener('click', set(function () { state.co2 = parseFloat(button.dataset.co2); state.far = ''; }));
    });
    $('reset').addEventListener('click', set(function () {
      state.co2 = M.TODAY.co2; state.ch4 = M.TODAY.ch4; state.water = M.TODAY.water; state.far = '';
    }));
    $('keep').addEventListener('click', set(function () { state.keep = mixText(currentMix()); }));
    $('unkeep').addEventListener('click', set(function () { state.keep = ''; $('keep').focus(); }));
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    $('spectrum').addEventListener('pointermove', point);
    $('spectrum').addEventListener('pointerdown', point);
    $('spectrum').addEventListener('keydown', step);
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    var scrolledTo = goToAddressPlace();
    Promise.all([
      fetch('tables.bin').then(function (response) {
        if (!response.ok) throw new Error('tables.bin: ' + response.status);
        return response.arrayBuffer();
      }),
      fetch('tables.json').then(function (response) {
        if (!response.ok) throw new Error('tables.json: ' + response.status);
        return response.json();
      })
    ]).then(function (loaded) {
      data = M.tables(loaded[0], loaded[1]);
      settle();
      $('loading').hidden = true;
      showAll();
      selectView(state.view);
      if (window.scrollY === scrolledTo) goToAddressPlace();
    }).catch(function (error) {
      $('loading').textContent = 'The spectra didn\'t load. Please reload the page. (' + error.message + ')';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
