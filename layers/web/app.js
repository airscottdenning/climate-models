/* Layers model: the page. model.js is the science. This file is the controls, the drawing and the words
 * under it. It works out nothing about the panes itself: every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Layers;
  var VIEWS = ['stack', 'about'];
  // What the page shows when the address says nothing.
  var DEFAULTS = { view: 'stack', panes: 1, sun: 1361, albedo: 30 };
  var INK = '#152e3d', TICK = '#394b57';
  var SUNLIGHT = '#a85400', EARTHLIGHT = '#0072b2';
  var GLASS = '#cfe5f3', GLASS_EDGE = '#3b6e96', GLASS_INK = '#173f5f', GROUND = '#1f2023';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line
  var PANE = 16, SLAB = 46, EDGE = 6;   // a pane's thickness, the ground's, and the drawing's margin, in pixels

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  /* A whole number with a comma in the thousands, a real minus sign, and no sign at all on a zero. */
  function whole(x) { return minus((Math.round(x) || 0).toLocaleString('en-US')); }

  // ---- The controls ----

  /* A slider and a number box that hold the same whole number. */
  function pair(key) {
    var number = $(key), range = $(key + '-range');
    function put() { number.value = range.value = state[key]; }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = clamp(Math.round(value), +number.min, +number.max);
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* Put the state into every control. */
  function showAll() { Object.keys(show).forEach(function (key) { show[key](); }); }

  // ---- Temperatures and flows in words ----

  /* A temperature on the three scales. The page prints whole kelvins, and works out the other two from
   * the whole kelvins, so a reader with a calculator gets the same Celsius and Fahrenheit. */
  function scales(kelvin) {
    var k = Math.round(kelvin), celsius = k - 273.15;
    return { k: whole(k) + NB + 'K', c: whole(celsius) + NB + '°C', f: whole(celsius * 1.8 + 32) + NB + '°F' };
  }
  function threeWays(kelvin) {
    var t = scales(kelvin);
    return t.k + ' (' + t.c + ', ' + t.f + ')';
  }
  function flow(wattsPerSquareMeter) { return whole(wattsPerSquareMeter) + NB + 'W/m²'; }

  // ---- The drawing ----

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
    if (options.halo) {
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = options.halo;
      ctx.strokeText(string, x, y);
    }
    ctx.fillStyle = options.color || TICK;
    ctx.fillText(string, x, y);
  }

  /* An arrow's head at (x, y), pointing up (-1) or down (+1). */
  function head(ctx, x, y, way, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - 5.5, y - way * 10); ctx.lineTo(x + 5.5, y - way * 10);
    ctx.closePath(); ctx.fill();
  }

  /* Sunlight: a straight arrow down from y0 to y1. */
  function sunArrow(ctx, x, y0, y1) {
    ctx.strokeStyle = SUNLIGHT; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 - 8); ctx.stroke();
    head(ctx, x, y1, 1, SUNLIGHT);
  }

  /* Earthlight: a wavy arrow from y0 to y1, up or down. The wave dies away at both ends, so the arrow
   * starts and finishes on its own line. */
  function earthArrow(ctx, x, y0, y1) {
    var way = y1 > y0 ? 1 : -1, length = Math.abs(y1 - y0) - 8;
    ctx.strokeStyle = EARTHLIGHT; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var t = 0; t <= length; t += 1) {
      var fade = clamp(Math.min(t, length - t - 4) / 9, 0, 1);
      var across = 4.5 * fade * Math.sin(2 * Math.PI * t / 24);
      if (t === 0) ctx.moveTo(x + across, y0 + way * t); else ctx.lineTo(x + across, y0 + way * t);
    }
    ctx.stroke();
    head(ctx, x, y1, way, EARTHLIGHT);
  }

  /* How tall the drawing has to be for this many panes, and where its levels go. The drawing is 440 pixels
   * tall until the panes would be too close together to label. After that each pane adds to its height. */
  function plan(panes) {
    var room = 440 - 2 * EDGE - SLAB - PANE * panes;
    var gap = Math.max(46, room / (panes + 1)), top = Math.max(64, gap);
    var tops = [], y = EDGE + top;
    for (var k = 1; k <= panes; k++) { tops.push(y); y += PANE + gap; }
    return { tops: tops, ground: y, height: y + SLAB + EDGE };
  }

  function drawStack(answer) {
    var canvas = $('stack'), panes = answer.panes, where = plan(panes);
    canvas.style.height = Math.round(where.height) + 'px';
    var area = prepare(canvas), ctx = area.ctx;
    // The panes are on the left, and each one's temperature is to its right. On a phone the temperature
    // takes three short lines, so the panes can be wider.
    var narrow = area.w < 480, labels = narrow ? 58 : 132;
    var width = Math.min(470, area.w - labels - 2 * EDGE);
    var x0 = Math.max(EDGE, (area.w - width - labels) / 2), x1 = x0 + width;
    var sunAt = narrow ? [x0 + width * 0.31, x0 + width * 0.39] : [x0 + width * 0.36, x0 + width * 0.46];
    var upAt = x0 + width * (narrow ? 0.665 : 0.67), downAt = x0 + width * (narrow ? 0.925 : 0.91);

    // Each gap, from space down to the ground: where it is, what goes up through it and what comes down.
    var gaps = [], above = EDGE;
    answer.levels.forEach(function (level, at) {
      gaps.push({ y0: above, y1: where.tops[at], up: level.glow, down: at ? answer.levels[at - 1].glow : null });
      above = where.tops[at] + PANE;
    });
    gaps.push({ y0: above, y1: where.ground, up: answer.ground.glow, down: panes ? answer.ground.fromAbove : null });

    // The panes and the ground.
    answer.levels.forEach(function (level, at) {
      var y = where.tops[at];
      ctx.fillStyle = GLASS; ctx.strokeStyle = GLASS_EDGE; ctx.lineWidth = 1.2;
      ctx.fillRect(x0, y, width, PANE); ctx.strokeRect(x0 + 0.5, y + 0.5, width - 1, PANE - 1);
    });
    ctx.fillStyle = GROUND; ctx.fillRect(x0, where.ground, width, SLAB);

    // Sunlight goes straight down through every pane.
    sunAt.forEach(function (x) { sunArrow(ctx, x, EDGE + 2, where.ground - 1); });
    text(ctx, 'Sunlight', x0 + 2, EDGE + 20, { bold: true, color: SUNLIGHT });
    text(ctx, whole(answer.absorbed), x0 + 2, EDGE + 37, { bold: true, color: SUNLIGHT });

    // Earthlight: up through every gap, and down through every gap that has a pane over it.
    gaps.forEach(function (gap, at) {
      var middle = (gap.y0 + gap.y1) / 2 + 4.5;
      earthArrow(ctx, upAt, gap.y1 - 2, gap.y0 + (at ? 2 : 3));
      text(ctx, whole(gap.up), upAt - 10, middle, { bold: true, align: 'right', color: EARTHLIGHT, halo: '#ffffff' });
      if (gap.down !== null) {
        earthArrow(ctx, downAt, gap.y0 + 2, gap.y1 - 2);
        text(ctx, whole(gap.down), downAt - 10, middle,
          { bold: true, align: 'right', color: EARTHLIGHT, halo: '#ffffff' });
      } else {
        text(ctx, 'Earthlight', upAt + 11, middle - 8, { bold: true, color: EARTHLIGHT });
        text(ctx, 'to space', upAt + 11, middle + 8, { color: EARTHLIGHT });
      }
    });

    // Each pane's name, inside its left end, and its temperature, to its right.
    answer.levels.forEach(function (level, at) {
      var y = where.tops[at] + PANE / 2, t = scales(level.kelvin);
      text(ctx, 'Pane ' + level.pane, x0 + 6, y + 0.5, { bold: true, size: 11, baseline: 'middle', color: GLASS_INK });
      if (narrow) {
        text(ctx, t.k, x1 + 6, y - 9, { bold: true, baseline: 'middle', color: INK });
        text(ctx, t.c, x1 + 6, y + 6, { size: 12, baseline: 'middle' });
        text(ctx, t.f, x1 + 6, y + 20, { size: 12, baseline: 'middle' });
      } else {
        text(ctx, t.k, x1 + 9, y - 2, { bold: true, size: 15, baseline: 'middle', color: INK });
        text(ctx, t.c + ', ' + t.f, x1 + 9, y + 15, { size: 12, baseline: 'middle' });
      }
    });

    // The ground's temperature, written on the ground. It takes two lines where one won't fit.
    var g = scales(answer.ground.kelvin), middle = where.ground + SLAB / 2;
    var first = 'Ground: ' + g.k, second = '(' + g.c + ', ' + g.f + ')';
    var white = { bold: true, size: 14, align: 'center', baseline: 'middle', color: '#ffffff' };
    ctx.font = '600 14px ' + FONT;
    if (ctx.measureText(first + ' ' + second).width < width - 20) {
      text(ctx, first + ' ' + second, x0 + width / 2, middle + 0.5, white);
    } else {
      text(ctx, first, x0 + width / 2, middle - 8.5, white);
      text(ctx, second, x0 + width / 2, middle + 9.5, white);
    }
  }

  // ---- The words under the drawing ----

  function summary(answer) {
    var q = flow(answer.absorbed), ground = threeWays(answer.ground.kelvin);
    if (!answer.panes) {
      return 'With no panes, the ground takes in ' + q + ' of Sunlight and emits it straight to space. ' +
        'It settles at ' + ground + '.';
    }
    var bare = M.temperature(answer.absorbed);
    var warmer = Math.round(answer.ground.kelvin) - Math.round(bare);
    return 'Under ' + (answer.panes > 1 ? answer.panes + ' panes' : 'one pane') + ', the ground settles at ' + ground + '. That\'s ' +
      whole(warmer) + NB + 'K warmer than with no panes. The ' + (answer.panes > 1 ? 'top ' : '') + 'pane is at ' +
      scales(answer.levels[0].kelvin).k + '. The ground takes in ' + q + ' of Sunlight and ' +
      flow(answer.ground.fromAbove) + ' of Earthlight from the pane above it.';
  }

  /* The table: one row for each level, from the top pane down to the ground. */
  function budgets(answer) {
    var body = $('levels-rows'), panes = answer.panes, rows = [];
    function below(k) { return k < panes ? 'pane ' + (k + 1) : 'the ground'; }
    answer.levels.forEach(function (level) {
      var k = level.pane, each = whole(level.glow);
      rows.push({
        name: 'Pane ' + k + (k === 1 && panes > 1 ? ' (the top)' : ''),
        kelvin: level.kelvin,
        takes: (k > 1 ? whole(level.fromAbove) + ' from pane ' + (k - 1) + ', ' : '') +
          whole(level.fromBelow) + ' from ' + below(k),
        emits: each + ' up' + (k === 1 ? ' to space' : '') + ', ' + each + ' down'
      });
    });
    rows.push({
      name: 'Ground', kelvin: answer.ground.kelvin, ground: true,
      takes: whole(answer.ground.sunlight) + ' of Sunlight' +
        (panes ? ', ' + whole(answer.ground.fromAbove) + ' from pane ' + panes : ''),
      emits: whole(answer.ground.glow) + ' up' + (panes ? '' : ' to space')
    });
    var signature = JSON.stringify(rows);
    if (body.dataset.rows === signature) return;
    body.dataset.rows = signature;
    body.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr'), th = document.createElement('th');
      if (row.ground) tr.className = 'ground';
      th.scope = 'row'; th.textContent = row.name; tr.appendChild(th);
      [threeWays(row.kelvin), row.takes, row.emits].forEach(function (words) {
        var td = document.createElement('td');
        td.textContent = words; tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function sunHint() {
    var average = 'Averaged over the whole planet, day and night, that\'s ' + flow(state.sun / 4) + '.';
    return state.sun === M.SUN ? 'The Earth\'s own. ' + average :
      average + ' The Earth gets ' + flow(M.SUN) + ' where it faces the Sun.';
  }

  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    say('sun-hint', sunHint());
    if (state.view !== 'stack') return;
    var answer = M.stack(state.panes, state.sun, state.albedo / 100);
    drawStack(answer);
    say('stack-summary', summary(answer));
    budgets(answer);
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key), number = parseFloat(value);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (isFinite(number)) state[key] = clamp(Math.round(number), +$(key).min, +$(key).max);
    });
    if (VIEWS.indexOf(state.view) < 0) state.view = DEFAULTS.view;
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] !== DEFAULTS[key]) parts.push(key + '=' + encodeURIComponent(state[key]));
    });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    // On the About tab, the address keeps the place on the tab as well.
    try {
      history.replaceState(null, '', query + (state.view === 'stack' ? '' : location.hash));
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
    var reading = state.view !== 'stack' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-' + state.view).contains(place)) place.scrollIntoView();
  }

  function start() {
    readAddress();
    ['panes', 'sun', 'albedo'].forEach(function (key) { show[key] = pair(key); });

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
      state.panes = DEFAULTS.panes; state.sun = DEFAULTS.sun; state.albedo = DEFAULTS.albedo;
      showAll();
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    // Draw once now. A page in a background tab gets no animation frame until someone looks at it.
    saveToAddress();
    draw();
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
