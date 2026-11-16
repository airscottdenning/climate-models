/* Night model: the page. model.js is the science. This file is the controls, the graphs and the words under
 * them. It works out nothing about the ground itself: every number it shows comes from model.js.
 *
 * The page has two views of the same model. Simple shows what the day and night feel like, with one control:
 * the sky. Advanced adds the physics, the code, a table of every number in the surface's energy, and controls
 * for the wind and the soil. */
(function () {
  'use strict';

  var M = window.Night;
  var GRAPHS = ['temps', 'energy', 'soil'];                  // the tabs with graphs and controls
  var TABS = { simple: GRAPHS.concat(['about']), advanced: GRAPHS.concat(['about', 'physics', 'code']) };
  var MOST = 150;        // the sky slider's top: the share of the measured sky, in percent
  // What the page shows when the address says nothing. `when` is when the chosen sky shines: 0 every day and
  // night, 1 tonight only, 2 for one day and night from noon (model.js's EVERY, TONIGHT and ONE_DAY). `keep` is
  // the kept day, as dayKey writes it, and `hide` lists the energy graph's lines that are switched off.
  // `units` is c or f: every temperature on the graphs and under them is in °C or °F.
  var DEFAULTS = { mode: 'simple', units: 'c', view: 'temps', sky: 100, when: 0, wind: 100, rough: 0.03,
                   bowen: 1.5, k: 1, c: 2, keep: '', hide: 'vapor' };
  // The Advanced view's controls for the wind and the soil: their ranges, and the model's setting each one gives.
  var NUMBERS = {
    sky: { lo: 0, hi: MOST, step: 1 },
    wind: { lo: 25, hi: 200, step: 5, knob: 'wind', scale: 0.01 },          // % of the measured wind
    bowen: { lo: 0.5, hi: 5, step: 0.1, knob: 'bowen', scale: 1 },
    k: { lo: 0.2, hi: 2.5, step: 0.1, knob: 'conductivity', scale: 1 },     // W/m per K
    c: { lo: 1, hi: 3, step: 0.1, knob: 'capacity', scale: 1e6 }            // million J/m³ per K
  };
  var ROUGHNESS = [0.005, 0.03, 0.1, 0.25];                                 // m: the choices in the list
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var NIGHT = '#eef2f5', KEPT = '#5f6d75', STATION = '#d55e00';
  var AIR_LINE = { name: 'Air, 10 m up', color: '#0072b2', width: 2, value: function (run, k) { return run.air[k]; } };
  var SURFACE_LINE = { name: 'Ground', color: INK, width: 2.4, value: layer(0) };
  // The soil graph's lines, drawn in this order: layers 8, 5 and 3 (their middles are 29, 9 and 3 cm down),
  // then layer 1, the surface.
  var SOIL = [
    { name: '29 cm', color: '#8a8a8a', width: 1.8, value: layer(7) },
    { name: '9 cm', color: '#bf812d', width: 1.8, value: layer(4) },
    { name: '3 cm', color: '#8c510a', width: 1.8, value: layer(2) },
    { name: 'Surface', color: INK, width: 2.4, value: layer(0) }
  ];
  // The energy graph's lines: each flow of energy at the surface, counted as energy coming into it. `up` is the
  // same flow counted the way the arrows draw it: upward is positive. The soil's arrow is under the surface.
  var FLOWS = [
    { key: 'sun', name: 'Sunlight', color: '#e69f00', value: function (run, k) { return run.sunlight[k]; },
      up: function (run, k) { return -run.sunlight[k]; } },
    { key: 'sky', name: 'Earthlight down', color: '#0072b2', value: function (run, k) { return run.sky[k]; },
      up: function (run, k) { return -run.sky[k]; } },
    { key: 'glow', name: 'Earthlight up', color: '#cc79a7', value: function (run, k) { return -run.glow[k]; },
      up: function (run, k) { return run.glow[k]; } },
    { key: 'air', name: 'From the air', color: '#009e73', value: function (run, k) { return -run.airHeat[k]; },
      up: function (run, k) { return run.airHeat[k]; } },
    { key: 'vapor', name: 'Into vapor', color: '#56b4e9', value: function (run, k) { return -run.vapor[k]; },
      up: function (run, k) { return run.vapor[k]; } },
    { key: 'soil', name: 'From the soil', color: '#8c510a', value: function (run, k) { return -run.down[k]; },
      up: function (run, k) { return -run.down[k]; }, below: true }
  ];
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line
  var QUARTERS = 96;     // the graphs are read every quarter of an hour

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var cursor = null;    // which quarter of an hour after noon is being read, 0 to 95, or null
  var plots = {};       // where each graph's left and right edges were last drawn
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function layer(i) { return function (run, k) { return run.T[i][k]; }; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  /* A number to so many places, with a real minus sign, and no sign at all on a zero. */
  function fixed(x, digits) {
    var digitsText = x.toFixed(digits);
    return minus(parseFloat(digitsText) === 0 ? (0).toFixed(digits) : digitsText);
  }
  function advanced() { return state.mode === 'advanced'; }

  // ---- The day that's showing, and the day that was kept ----

  var KEY_ORDER = ['sky', 'when', 'wind', 'rough', 'bowen', 'k', 'c'];

  /* The controls that make a day. In the Simple view the wind and the soil are always as usual. */
  function currentDay() {
    var choice = {};
    KEY_ORDER.forEach(function (key) {
      choice[key] = advanced() || key === 'sky' || key === 'when' ? state[key] : DEFAULTS[key];
    });
    return choice;
  }
  function dayKey(choice) { return KEY_ORDER.map(function (key) { return choice[key]; }).join(','); }

  /* A number from the address or a box, moved onto the control's steps and inside its range. */
  function snap(key, value) {
    var spec = NUMBERS[key];
    return parseFloat(clamp(Math.round(value / spec.step) * spec.step, spec.lo, spec.hi).toFixed(2));
  }
  function nearestRoughness(value) {
    return ROUGHNESS.reduce(function (best, each) {
      return Math.abs(Math.log(each / value)) < Math.abs(Math.log(best / value)) ? each : best;
    });
  }

  /* The other way: a day from the address, or null if the controls don't reach it. */
  function parseDay(string) {
    var parts = String(string || '').split(',').map(parseFloat), choice = {};
    if (parts.length !== KEY_ORDER.length || parts.some(function (x) { return !isFinite(x); })) return null;
    KEY_ORDER.forEach(function (key, i) { choice[key] = parts[i]; });
    if ([0, 1, 2].indexOf(choice.when) < 0) return null;
    if (ROUGHNESS.indexOf(choice.rough) < 0) return null;
    var inside = Object.keys(NUMBERS).every(function (key) { return snap(key, choice[key]) === choice[key]; });
    return inside ? choice : null;
  }

  /* The settings for model.js that a day's controls give. */
  function knobs(choice) {
    var changes = { rough: choice.rough };
    Object.keys(NUMBERS).forEach(function (key) {
      if (NUMBERS[key].knob) changes[NUMBERS[key].knob] = choice[key] * NUMBERS[key].scale;
    });
    return changes;
  }

  function usualGround(choice) {
    return ['wind', 'rough', 'bowen', 'k', 'c'].every(function (key) { return choice[key] === DEFAULTS[key]; });
  }

  function describe(choice) {
    var words = choice.sky === DEFAULTS.sky || choice.when === 0 ?
      'the sky at ' + choice.sky + '% of what was measured, every day and night' : choice.when === 1 ?
        'the sky as measured by day and ' + choice.sky + '% of it from tonight\'s sunset to sunrise' :
        'the sky at ' + choice.sky + '% of what was measured for one day and night, from noon to noon, after ' +
        'days with the sky as measured';
    return usualGround(choice) ? words : words + ', and the wind or the soil changed';
  }

  /* The model's day for a choice of the controls. The last answer for each of the two days on the graph is
   * kept, so moving over the graph doesn't run the model again. */
  var answers = {};
  function answer(choice, line) {
    var key = dayKey(choice);
    if (answers[line] && answers[line].key === key) return answers[line];
    var run = M.run(choice.sky / 100, choice.when, knobs(choice));
    run.key = key;
    run.choice = choice;
    answers[line] = run;
    return run;
  }

  // ---- The controls ----

  /* A slider and its number box, which hold the same number. */
  function numberControl(key, hint) {
    var number = $(key), range = $(key + '-range');
    function put() {
      number.value = range.value = state[key];
      if (hint) hint();
    }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = snap(key, value);
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  function skyHint() {
    var glow = M.skyGlow(state.sky / 100, 16 * 3600);
    $('sky-hint').textContent = state.sky === 0 ? 'No Earthlight at all comes down from the sky.' :
      'At 4' + NB + 'a.m. the sky sends down ' + fixed(glow, 0) + NB + 'W/m².';
  }

  function windHint() {
    var speeds = M.WIND.map(function (u) { return u * state.wind / 100; });
    $('wind-hint').textContent = 'Between ' + fixed(Math.min.apply(null, speeds), 1) + ' and ' +
      fixed(Math.max.apply(null, speeds), 1) + NB + 'm/s through the day.';
  }

  function roughControl() {
    var list = $('rough');
    list.addEventListener('change', function () { state.rough = parseFloat(list.value); changed(); });
    return function () { list.value = String(state.rough); };
  }

  /* When the chosen sky shines: three round buttons. */
  function whenControl() {
    var buttons = document.querySelectorAll('input[name="when"]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('change', function () { state.when = +button.value; changed(); });
    });
    return function () {
      Array.prototype.forEach.call(buttons, function (button) { button.checked = +button.value === state.when; });
    };
  }

  /* The energy graph's switches: one tick box for each line. */
  function lineSwitches() {
    var boxes = document.querySelectorAll('#energy-lines input');
    Array.prototype.forEach.call(boxes, function (box) {
      box.addEventListener('change', function () {
        state.hide = Array.prototype.filter.call(boxes, function (each) { return !each.checked; })
          .map(function (each) { return each.value; }).join(',');
        changed();
      });
    });
    return function () {
      var hidden = state.hide.split(',');
      Array.prototype.forEach.call(boxes, function (box) { box.checked = hidden.indexOf(box.value) < 0; });
    };
  }

  /* Put the state into every control. */
  function showAll() {
    Object.keys(show).forEach(function (key) { show[key](); });
    ['c', 'f'].forEach(function (unit) {
      $('unit-' + unit).setAttribute('aria-pressed', state.units === unit ? 'true' : 'false');
    });
    var kept = !!state.keep;
    $('key-kept').hidden = $('kept-line').hidden = !kept;
    $('ground-note').hidden = !advanced() || usualGround(currentDay());
  }

  // ---- Times and temperatures in words ----

  /* A step of the day as a time on the clock. Step 0 is noon. */
  function clock(k) {
    var minutes = (Math.round(k * M.STEP / 60) + 720) % 1440, hour = Math.floor(minutes / 60), minute = minutes % 60;
    if (minutes === 0) return 'midnight';
    if (minutes === 720) return 'noon';
    return ((hour + 11) % 12 + 1) + ':' + (minute < 10 ? '0' : '') + minute + NB + (hour < 12 ? 'a.m.' : 'p.m.');
  }

  /* A temperature in the units the page shows: °C or °F. */
  function toUnits(kelvin) {
    return state.units === 'f' ? (kelvin - 273.15) * 1.8 + 32 : kelvin - 273.15;
  }
  function unitName() { return state.units === 'f' ? '°F' : '°C'; }
  function degrees(kelvin, digits) {
    return fixed(toUnits(kelvin), digits === undefined ? 1 : digits) + NB + unitName();
  }

  function DAY_STEPS() { return M.DAY / M.STEP; }
  /* The step of the day at a quarter of an hour after noon. */
  function moment(quarter) { return quarter * DAY_STEPS() / QUARTERS; }
  /* The step being read: the cursor's, or midnight when there's no cursor yet. */
  function reading() { return moment(cursor === null ? QUARTERS / 2 : cursor); }

  /* The steps at sunset and sunrise. */
  function sunset() { return DAY_STEPS() / 4; }
  function sunrise() { return DAY_STEPS() * 3 / 4; }

  // ---- Drawing ----

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

  /* Words on a graph. `halo` is the color behind them: it keeps a line from running through the letters. */
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

  function segment(ctx, xa, ya, xb, yb, color) {
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
  }

  function dot(ctx, x, y, color, size) {
    ctx.beginPath(); ctx.arc(x, y, size || 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* A round size for the gap between gridlines, so that about `count` of them cover `span`. */
  function roundGap(span, count) {
    var raw = span / count, power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  }

  /* Each line's name at its right-hand end, moved apart where two would touch. */
  function names(ctx, ends, x, top, bottom) {
    ends = ends.slice().sort(function (p, q) { return p.y - q.y; });
    var i;
    for (i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 15);
    for (i = ends.length - 1; i >= 0; i--) ends[i].y = Math.min(ends[i].y, bottom - 5 - (ends.length - 1 - i) * 15);
    for (i = 0; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, top + 5 + i * 15);
    ends.forEach(function (end) {
      ctx.lineWidth = 3; segment(ctx, x + 5, end.y, x + 15, end.y, end.color);
      text(ctx, end.name, x + 19, end.y, { size: 12, baseline: 'middle' });
    });
  }

  /* A graph of one day, from noon to noon, with the night shaded in the middle.
   * `lines` are { name, color, width, dash, run, value(run, k) }, with values in kelvins or W/m²; `toShown`
   * turns a value into the number on the axis. `dots` are { k, shown } in the axis's own numbers. */
  function dayGraph(id, spec) {
    var c = prepare($(id)), ctx = c.ctx, narrow = c.w < 560, n = DAY_STEPS();
    var x0 = narrow ? 40 : 52, x1 = c.w - (narrow ? 96 : 112), y1 = 30, y0 = c.h - 48;
    var lines = spec.lines, low = spec.floor === undefined ? Infinity : spec.floor;
    var high = spec.floor === undefined ? -Infinity : spec.floor, k;
    plots[id] = { x0: x0, x1: x1 };
    lines.forEach(function (each) {
      for (k = 0; k < n; k++) {
        var v = spec.toShown(each.value(each.run, k)); low = Math.min(low, v); high = Math.max(high, v);
      }
    });
    (spec.dots || []).forEach(function (d) { low = Math.min(low, d.shown); high = Math.max(high, d.shown); });
    if (!isFinite(low)) { low = 0; high = 1; }
    var gap = roundGap(Math.max(high - low, spec.span), spec.ticks);
    // Room above the highest line for the words Day and Night.
    low = Math.floor(low / gap) * gap; high = Math.ceil((high + 0.1 * (high - low)) / gap) * gap;
    function px(j) { return x0 + j / n * (x1 - x0); }
    function py(shown) { return y0 - (shown - low) / (high - low) * (y0 - y1); }

    ctx.lineWidth = 1;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(px(sunset()), y1, px(sunrise()) - px(sunset()), y0 - y1);
    for (var v = low; v <= high + gap / 2; v += gap) {
      segment(ctx, x0, py(v), x1, py(v), Math.abs(v) < gap / 2 ? SPINE : GRID);
      text(ctx, fixed(v, 0), x0 - 8, py(v), { align: 'right', baseline: 'middle' });
    }
    segment(ctx, x0, y1, x0, y0, SPINE);
    segment(ctx, x0, y0, x1, y0, SPINE);
    for (var hour = 0; hour <= 24; hour += 2) segment(ctx, px(hour * n / 24), y0, px(hour * n / 24), y0 + (hour % 6 ? 3 : 6), SPINE);
    // On a phone there's room for only three times of day.
    (narrow ? ['Noon', '', 'Midnight', '', 'Noon'] : ['Noon', '6 p.m.', 'Midnight', '6 a.m.', 'Noon'])
      .forEach(function (name, at) { text(ctx, name, px(at * n / 4), y0 + 19, { align: 'center' }); });
    ['Day', 'Night', 'Day'].forEach(function (name, at) {
      text(ctx, name, px([0.125, 0.5, 0.875][at] * n), y1 + 14, { align: 'center', size: 12, color: '#4a5a66' });
    });
    text(ctx, spec.title, narrow ? 6 : x0, y1 - 10, { bold: true, color: INK });
    text(ctx, 'Time of day', (x0 + x1) / 2, c.h - 7, { align: 'center', color: INK });

    // The lines. A day that repeats ends where it began, so its lines run on to the right-hand noon.
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y1, x1 - x0, y0 - y1); ctx.clip();
    lines.forEach(function (each) {
      ctx.beginPath();
      for (var j = 0; j < n; j++) ctx[j ? 'lineTo' : 'moveTo'](px(j), py(spec.toShown(each.value(each.run, j))));
      if (!each.run.once) ctx.lineTo(px(n), py(spec.toShown(each.value(each.run, 0))));
      ctx.strokeStyle = each.color; ctx.lineWidth = each.width || 2; ctx.lineJoin = 'round';
      ctx.setLineDash(each.dash || []); ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();
    (spec.dots || []).forEach(function (d) { dot(ctx, px(d.k), py(d.shown), STATION, 3.5); });
    var labelled = lines.filter(function (each) { return !each.dash; });
    names(ctx, labelled.map(function (each) {
      var last = each.run.once ? n - 1 : 0;
      return { name: each.name, color: each.color, y: py(spec.toShown(each.value(each.run, last))) };
    }), x1, y1, y0);

    // The moment being read.
    if (cursor === null) return;
    var at = moment(cursor), x = px(at);
    ctx.lineWidth = 1;
    segment(ctx, x, y1, x, y0, INK);
    lines.forEach(function (each) { dot(ctx, x, py(spec.toShown(each.value(each.run, at))), each.color); });
  }

  function same(value) { return value; }
  function span() { return state.units === 'f' ? 18 : 10; }

  function drawTemps(now, kept) {
    var lines = [Object.assign({ run: now }, AIR_LINE), Object.assign({ run: now }, SURFACE_LINE)];
    if (kept) lines.unshift({ name: 'Kept', color: KEPT, width: 1.8, dash: [6, 4], run: kept, value: layer(0) });
    var dots = M.GROUND.map(function (celsius, hour) {
      return { k: hour * 60, shown: toUnits(celsius + 273.15) };
    });
    dayGraph('temps-graph', { lines: lines, dots: dots, toShown: toUnits, span: span(), ticks: 5,
                              title: 'Temperature (' + unitName() + ')' });
  }

  function drawSoil(now) {
    dayGraph('soil-graph', { lines: SOIL.map(function (each) { return Object.assign({ run: now }, each); }),
                             toShown: toUnits, span: span(), ticks: 5,
                             title: 'Temperature in the soil (' + unitName() + ')' });
    drawHeatMap(now);
    drawProfile(now);
  }

  function drawEnergy(now) {
    var hidden = state.hide.split(',');
    var lines = FLOWS.filter(function (each) { return hidden.indexOf(each.key) < 0; })
      .map(function (each) { return Object.assign({ run: now, width: 2 }, each); });
    dayGraph('energy-graph', { lines: lines, toShown: same, span: 20, ticks: 7, floor: 0,
                               title: 'Energy coming into the surface (W/m²)' });
    drawArrows(now);
    showMoment();
  }

  /* A broad arrow down the middle of a column, from y `from` to its point at y `to`. */
  function broadArrow(ctx, x, from, to, shaft, color) {
    var length = Math.abs(to - from), sign = to > from ? 1 : -1;
    var head = Math.min(length * 0.6, shaft * 0.9), wing = shaft * 0.85, neck = to - sign * head;
    ctx.beginPath();
    ctx.moveTo(x - shaft / 2, from); ctx.lineTo(x - shaft / 2, neck); ctx.lineTo(x - wing, neck);
    ctx.lineTo(x, to); ctx.lineTo(x + wing, neck); ctx.lineTo(x + shaft / 2, neck); ctx.lineTo(x + shaft / 2, from);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  /* A column's name in one line, or two if it's too wide for the column. */
  function columnName(ctx, name, x, y, width) {
    ctx.font = '600 12px ' + FONT;
    if (ctx.measureText(name).width <= width - 4 || name.indexOf(' ') < 0) {
      text(ctx, name, x, y, { align: 'center', size: 12, bold: true, color: INK });
      return y;
    }
    var cut = name.indexOf(' ');
    text(ctx, name.slice(0, cut), x, y, { align: 'center', size: 12, bold: true, color: INK });
    text(ctx, name.slice(cut + 1), x, y + 14, { align: 'center', size: 12, bold: true, color: INK });
    return y + 14;
  }

  /* The surface's energy at one moment, as broad arrows that point the way each flow goes: Sunlight and the
   * Earthlight from the sky come down, the ground's Earthlight goes up, and so on. The soil's arrow is under the
   * surface. Every arrow on a day is drawn to the same scale, so they grow and shrink as the time moves. */
  function drawArrows(now) {
    var c = prepare($('energy-now')), ctx = c.ctx, at = reading(), n = DAY_STEPS();
    var columns = FLOWS.length, left = 8, right = c.w - 8, column = (right - left) / columns;
    var namesY = 46, top = 82, bottom = c.h - 12;
    // The biggest flow above the surface and below it over the whole day sets the scale.
    var above = 1, below = 1, k;
    FLOWS.forEach(function (each) {
      for (k = 0; k < n; k++) {
        var size = Math.abs(each.up(now, k));
        if (each.below) below = Math.max(below, size); else above = Math.max(above, size);
      }
    });
    var scale = (bottom - top) / (above + below), ground = top + above * scale;
    text(ctx, 'At ' + clock(at) + ': energy at the surface (W/m²)', 6, 18, { bold: true, color: INK });
    // The soil, under the surface.
    ctx.fillStyle = '#efe4d2'; ctx.fillRect(0, ground, c.w, c.h - ground);
    text(ctx, 'Soil', 8, c.h - 10, { size: 12, color: '#6b5a3e' });
    text(ctx, 'Air', 8, top + 4, { size: 12, color: '#4a5a66', baseline: 'top' });
    var shaft = clamp(column * 0.38, 12, 34);
    FLOWS.forEach(function (each, i) {
      var x = left + (i + 0.5) * column, flow = each.up(now, at), size = Math.abs(flow), length = size * scale;
      var last = columnName(ctx, each.name, x, namesY - 14, column);
      text(ctx, fixed(size, 0), x, last + 16, { align: 'center', size: 12, color: TICK });
      if (length < 1) return;
      var from, to;
      if (each.below) { from = flow > 0 ? ground + length : ground; to = flow > 0 ? ground : ground + length; }
      else { from = flow > 0 ? ground : ground - length; to = flow > 0 ? ground - length : ground; }
      broadArrow(ctx, x, from, to, shaft, each.color);
    });
    ctx.lineWidth = 2;
    segment(ctx, 0, ground, c.w, ground, INK);
  }

  /* The time slider under the arrows: it and the cursor on every graph are the same moment. */
  function showMoment() {
    var slider = $('moment'), at = cursor === null ? QUARTERS / 2 : cursor;
    slider.value = at;
    var words = clock(moment(at));
    slider.setAttribute('aria-valuetext', words);
    say('moment-time', words);
  }

  // The heat map's colors: blue for colder than the soil's average over the day, red for warmer, and a light
  // gray for the average itself. Every layer has the same average over a day that repeats.
  var COLD = [33, 102, 172], MIDDLE = [242, 242, 242], WARM = [178, 24, 43];
  var MAP_DEPTH = 50;    // cm: the heat map stops here, where the day's swing is nearly gone
  function mix(p, q, f) { return p.map(function (v, i) { return Math.round(v + (q[i] - v) * f); }); }
  function rgbOf(f) { return f < 0 ? mix(MIDDLE, COLD, -f) : mix(MIDDLE, WARM, f); }    // f from −1 to 1
  function shade(f) { return 'rgb(' + rgbOf(f).join(',') + ')'; }

  /* Slopes for a smooth curve through points (xs, ys) that never overshoots them: the Fritsch–Carlson
   * monotone cubic. Between two points the curve can't go above or below both, so no false warm or cold
   * spots appear between the layers. */
  function smoothSlopes(xs, ys) {
    var count = xs.length, gaps = [], secants = [], slopes = [], i;
    for (i = 0; i < count - 1; i++) { gaps.push(xs[i + 1] - xs[i]); secants.push((ys[i + 1] - ys[i]) / gaps[i]); }
    slopes.push(secants[0]);
    for (i = 1; i < count - 1; i++) {
      if (secants[i - 1] * secants[i] <= 0) { slopes.push(0); continue; }
      var w1 = 2 * gaps[i] + gaps[i - 1], w2 = gaps[i] + 2 * gaps[i - 1];
      slopes.push((w1 + w2) / (w1 / secants[i - 1] + w2 / secants[i]));
    }
    slopes.push(secants[count - 2]);
    return slopes;
  }
  /* The curve's value at x, inside the segment that starts at point i. */
  function smoothAt(xs, ys, slopes, i, x) {
    var h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * slopes[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * slopes[i + 1];
  }

  /* A heat map of the soil: the time of day across, the depth down, and the temperature as color, in bands. */
  function drawHeatMap(now) {
    var c = prepare($('soil-map')), ctx = c.ctx, narrow = c.w < 560, n = DAY_STEPS(), depths = M.depths();
    var x0 = narrow ? 40 : 52, x1 = c.w - (narrow ? 70 : 92), y1 = 30, y0 = c.h - 48;
    plots['soil-map'] = { x0: x0, x1: x1 };
    var total = 0, count = 0;
    now.T.forEach(function (line) { for (var j = 0; j < n; j++) { total += line[j]; count++; } });
    var mean = total / count;
    var lowest = Math.min.apply(null, now.T[0]), highest = Math.max.apply(null, now.T[0]);
    // Bands of a round width in the page's units, about 15 to 20 across the day's range at the surface.
    var shownLow = toUnits(lowest), shownHigh = toUnits(highest);
    var band = roundGap(Math.max(shownHigh - shownLow, 1), 20);
    var reach = Math.max(toUnits(highest) - toUnits(mean), toUnits(mean) - toUnits(lowest), band);
    function bandOf(kelvin) { return Math.floor(toUnits(kelvin) / band); }
    function colorOf(index) { return shade(clamp(((index + 0.5) * band - toUnits(mean)) / reach, -1, 1)); }
    function py(cm) { return y1 + cm / MAP_DEPTH * (y0 - y1); }
    // Every pixel gets its own temperature, so the bands' edges are smooth. Across, the time is a straight
    // line between the model's one-minute steps. Down, a smooth curve runs through the middles of the layers;
    // above the top layer's middle the temperature is the top layer's.
    var ratio = window.devicePixelRatio || 1;
    var left = Math.round(x0 * ratio), top = Math.round(y1 * ratio);
    var wide = Math.round(x1 * ratio) - left, tall = Math.round(y0 * ratio) - top;
    var image = ctx.createImageData(wide, tall), pixels = image.data;
    var rows = [], at = 0, row, col;
    for (row = 0; row < tall; row++) {
      var meters = (row + 0.5) / tall * MAP_DEPTH / 100;
      while (at < depths.length - 2 && meters > depths[at + 1]) at++;
      rows.push({ meters: meters, segment: at, above: meters <= depths[0] });
    }
    var palette = {};
    for (col = 0; col < wide; col++) {
      var step = (col + 0.5) / wide * n, k0 = Math.floor(step), f = step - k0;
      var k1 = k0 + 1 >= n ? (now.once ? n - 1 : 0) : k0 + 1;
      var ys = now.T.map(function (line) { return line[k0] + f * (line[k1] - line[k0]); });
      var slopes = smoothSlopes(depths, ys);
      for (row = 0; row < tall; row++) {
        var spot = rows[row];
        var kelvin = spot.above ? ys[0] : smoothAt(depths, ys, slopes, spot.segment, spot.meters);
        var index = bandOf(kelvin);
        var rgb = palette[index] || (palette[index] = rgbOf(clamp(((index + 0.5) * band - toUnits(mean)) / reach, -1, 1)));
        var p = 4 * (row * wide + col);
        pixels[p] = rgb[0]; pixels[p + 1] = rgb[1]; pixels[p + 2] = rgb[2]; pixels[p + 3] = 255;
      }
    }
    ctx.putImageData(image, left, top);
    // Axes: the time of day along the bottom, the depth down the side.
    ctx.lineWidth = 1;
    for (var cm = 0; cm <= MAP_DEPTH; cm += 10) {
      segment(ctx, x0 - 4, py(cm), x0, py(cm), SPINE);
      text(ctx, cm + '', x0 - 8, py(cm), { align: 'right', baseline: 'middle' });
    }
    for (var hour = 0; hour <= 24; hour += 2) {
      segment(ctx, x0 + hour / 24 * (x1 - x0), y0, x0 + hour / 24 * (x1 - x0), y0 + (hour % 6 ? 3 : 6), SPINE);
    }
    (narrow ? ['Noon', '', 'Midnight', '', 'Noon'] : ['Noon', '6 p.m.', 'Midnight', '6 a.m.', 'Noon'])
      .forEach(function (name, at) { text(ctx, name, x0 + at / 4 * (x1 - x0), y0 + 19, { align: 'center' }); });
    [0.25, 0.75].forEach(function (share) {     // sunset and sunrise
      var x = x0 + share * (x1 - x0);
      ctx.setLineDash([3, 3]); segment(ctx, x, y1, x, y0, '#ffffff'); ctx.setLineDash([]);
    });
    ctx.strokeStyle = SPINE; ctx.strokeRect(x0, y1, x1 - x0, y0 - y1);
    text(ctx, 'Depth (cm)', narrow ? 6 : x0, y1 - 10, { bold: true, color: INK });
    text(ctx, 'Time of day', (x0 + x1) / 2, c.h - 7, { align: 'center', color: INK });
    // The key: each band's color, with its edges in the page's units.
    var first = bandOf(lowest), last = bandOf(highest), keyX = x1 + 12, keyW = 14;
    var step = Math.min(22, (y0 - y1) / (last - first + 1));
    text(ctx, unitName(), keyX, y1 - 10, { color: INK, bold: true });
    for (var b = last; b >= first; b--) {
      var y = y1 + (last - b) * step;
      ctx.fillStyle = colorOf(b); ctx.fillRect(keyX, y, keyW, step);
      var every = Math.ceil(16 / step);
      if ((last - b) % every === 0) {
        text(ctx, fixed((b + 1) * band, band < 1 ? 1 : 0), keyX + keyW + 4, y, { baseline: 'middle', size: 11 });
      }
    }
    var keyBottom = y1 + (last - first + 1) * step;
    text(ctx, fixed(first * band, band < 1 ? 1 : 0), keyX + keyW + 4, keyBottom, { baseline: 'middle', size: 11 });
    ctx.strokeStyle = SPINE; ctx.strokeRect(keyX, y1, keyW, keyBottom - y1);

    if (cursor === null) return;
    var x = x0 + moment(cursor) / n * (x1 - x0);
    ctx.lineWidth = 1.5; segment(ctx, x, y1, x, y0, INK);
  }

  /* The soil's temperature against depth at one moment, inside the range it covers over the day. */
  function drawProfile(now) {
    var c = prepare($('soil-now')), ctx = c.ctx, at = reading(), depths = M.depths();
    var x0 = 52, x1 = c.w - 20, y1 = 54, y0 = c.h - 40, deepest = 100;
    var lows = now.T.map(function (layerLine) { return Math.min.apply(null, layerLine); });
    var highs = now.T.map(function (layerLine) { return Math.max.apply(null, layerLine); });
    var cold = toUnits(Math.min.apply(null, lows)), hot = toUnits(Math.max.apply(null, highs));
    var gap = roundGap(Math.max(hot - cold, span()), 5);
    cold = Math.floor(cold / gap) * gap; hot = Math.ceil(hot / gap) * gap;
    function px(kelvin) { return x0 + (toUnits(kelvin) - cold) / (hot - cold) * (x1 - x0); }
    function py(meters) { return y1 + meters * 100 / deepest * (y0 - y1); }
    text(ctx, 'The soil at ' + clock(at), 6, 18, { bold: true, color: INK });
    ctx.lineWidth = 1;
    for (var v = cold; v <= hot + gap / 2; v += gap) {
      var x = x0 + (v - cold) / (hot - cold) * (x1 - x0);
      segment(ctx, x, y1, x, y0, GRID);
      text(ctx, fixed(v, 0), x, y0 + 16, { align: 'center', size: 12 });
    }
    for (var cm = 0; cm <= deepest; cm += 20) {
      segment(ctx, x0, py(cm / 100), x1, py(cm / 100), GRID);
      text(ctx, cm + '', x0 - 8, py(cm / 100), { align: 'right', baseline: 'middle', size: 12 });
    }
    text(ctx, 'Temperature (' + unitName() + ')', (x0 + x1) / 2, c.h - 6, { align: 'center', color: INK, size: 12 });
    text(ctx, 'Depth (cm)', 6, y1 - 14, { color: INK, size: 12 });
    // The day's range at each depth, shaded.
    ctx.beginPath();
    depths.forEach(function (d, i) { ctx[i ? 'lineTo' : 'moveTo'](px(lows[i]), py(d)); });
    for (var i = depths.length - 1; i >= 0; i--) ctx.lineTo(px(highs[i]), py(depths[i]));
    ctx.closePath(); ctx.fillStyle = '#efe4d2'; ctx.fill();
    ctx.beginPath();
    depths.forEach(function (d, j) { ctx[j ? 'lineTo' : 'moveTo'](px(now.T[j][at]), py(d)); });
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    depths.forEach(function (d, j) { dot(ctx, px(now.T[j][at]), py(d), INK, 3.5); });
    segment(ctx, x0, y1, x1, y1, SPINE);
    text(ctx, 'Shaded: the day’s range', x1, y0 - 8, { align: 'right', size: 12, color: '#6b5a3e', halo: '#ffffff' });
  }

  // ---- The words under the graphs ----

  function stationAt(at) {
    var hours = at * M.STEP / 3600;
    return hours === Math.floor(hours) ? M.GROUND[hours] : null;
  }

  function tempsReadout(now, kept) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read the temperatures.';
    var at = moment(cursor);
    var words = 'At ' + clock(at) + ', the ground is at ' + degrees(now.T[0][at]) + ' and the air 10' + NB +
      'm up is at ' + degrees(now.air[at]) + '.';
    var measured = stationAt(at);
    if (measured !== null) {
      words += ' On the usual days the station measured the ground at ' + degrees(measured + 273.15) + '.';
    }
    if (kept) words += ' On the day you kept, the ground is at ' + degrees(kept.T[0][at]) + ' at this time.';
    return words;
  }

  function soilReadout(now) {
    var at = reading(), up = -now.down[at];
    var words = 'At ' + clock(at) + ', the surface is at ' + degrees(now.T[0][at]) + ', 3' + NB + 'cm down ' +
      degrees(now.T[2][at]) + ', 9' + NB + 'cm down ' + degrees(now.T[4][at]) + ' and 29' + NB +
      'cm down ' + degrees(now.T[7][at]) + '. ';
    return words + (up > 0 ? 'Heat is flowing up out of the soil, ' + fixed(up, 0) + NB + 'W/m².' :
      'Heat is soaking down into the soil, ' + fixed(-up, 0) + NB + 'W/m².');
  }

  /* The surface's sums for the step being read: the Physics tab's steps, one line each. */
  function budget(now) {
    var at = reading(), unit = NB + 'W/m²';
    var sky = M.skyShare(now.share, now.when, at * M.STEP);
    var top = M.surface([now.T[0][at], now.T[1][at]], at * M.STEP, sky, M.thicknesses(), now.knobs);
    $('budget-time').textContent = clock(at);
    $('budget-t1').textContent = fixed(now.T[0][at], 3) + NB + 'K';
    $('budget-t2').textContent = fixed(now.T[1][at], 3) + NB + 'K';
    $('budget-ta').textContent = fixed(top.air, 3) + NB + 'K';
    $('budget-u').textContent = fixed(top.wind, 2) + NB + 'm/s';
    $('budget-q').textContent = fixed(top.sunlight, 1) + unit;
    $('budget-l').textContent = fixed(top.sky, 1) + unit;
    $('budget-e').textContent = fixed(top.glow, 1) + unit;
    $('budget-ri').textContent = fixed(top.richardson, 3);
    $('budget-f-stir').textContent = fixed(top.stirring, 3);
    $('budget-h').textContent = fixed(top.airHeat, 1) + unit;
    $('budget-v').textContent = fixed(top.vapor, 1) + unit;
    $('budget-f').textContent = fixed(top.down, 1) + unit;
    $('budget-left').textContent = fixed(top.left, 1) + unit;
    $('budget-warming').textContent = fixed(top.warming, 3) + NB + 'K';
    return top;
  }

  function energyReadout(top, at) {
    var left = top.left;
    return 'At ' + clock(at) + ', ' + fixed(top.sunlight + top.sky, 0) + NB + 'W/m² of light comes into the ' +
      'surface, and it glows away ' + fixed(top.glow, 0) + NB + 'W/m². ' +
      (Math.abs(top.airHeat) < 0.5 ? 'The air near the ground is still and carries nothing' :
        top.airHeat < 0 ? 'The air brings down ' + fixed(-top.airHeat, 0) + NB + 'W/m²' :
          'The air and water vapor carry away ' + fixed(top.airHeat + top.vapor, 0) + NB + 'W/m²') + ', and ' +
      (top.down < 0 ? 'the soil brings up ' + fixed(-top.down, 0) : 'the soil soaks up ' + fixed(top.down, 0)) +
      NB + 'W/m². ' + (Math.abs(left) < 0.5 ? 'It all balances, so the surface holds its temperature.' :
        left > 0 ? 'What\'s left over warms the surface.' : 'The surface loses more than it gets, so it cools.');
  }

  /* What became of a run: its hottest and coldest, and its sunset and sunrise. */
  function verdict(run) {
    var words = 'The ground is warmest at ' + clock(run.hottest.at) + ', at ' + degrees(run.hottest.kelvin) +
      ', and coldest at ' + clock(run.coldest.at) + ', at ' + degrees(run.coldest.kelvin) + '.';
    if (run.once) {
      return words + ' The day before had the sky as measured. The model ran ' + run.days + ' days to reach it.';
    }
    return words + (run.settled ? ' The model ran ' + run.days + ' days to reach a day that repeats.' :
      ' After ' + run.days + ' days the model still hadn\'t reached a day that repeats, so these aren\'t final.');
  }

  function summary(now, kept) {
    var words = 'This day has ' + describe(now.choice) + '. ' + verdict(now);
    if (!kept) return words;
    return words + ' The day you kept had ' + describe(kept.choice) + '. Its ground was at ' +
      degrees(kept.T[0][sunset()]) + ' at sunset and ' + degrees(kept.T[0][sunrise()]) + ' at sunrise.';
  }

  function tiles(now) {
    $('tile-sunset').textContent = degrees(now.T[0][sunset()]);
    $('tile-sunrise').textContent = degrees(now.T[0][sunrise()]);
    $('tile-air').textContent = degrees(now.air[sunrise()]);
    var frozen = now.T[0][sunrise()] < 273.15;
    $('tile-frost').textContent = frozen ? 'Frozen ground by sunrise.' : 'No frost by sunrise.';
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (GRAPHS.indexOf(state.view) < 0) return;
    var now = answer(currentDay(), 'now'), choice = state.keep ? parseDay(state.keep) : null;
    var kept = choice ? answer(choice, 'kept') : null;
    if (state.view === 'temps') {
      drawTemps(now, kept);
      tiles(now);
      say('temps-readout', tempsReadout(now, kept));
    } else if (state.view === 'energy') {
      drawEnergy(now);
      say('energy-readout', energyReadout(budget(now), reading()));
    } else {
      drawSoil(now);
      say('soil-readout', soilReadout(now));
    }
    say('summary', summary(now, kept));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key), number = parseFloat(value);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (!isFinite(number)) return;
      if (key === 'when') state.when = [0, 1, 2].indexOf(number) >= 0 ? number : 0;
      else if (key === 'rough') state.rough = nearestRoughness(Math.max(number, 1e-6));
      else state[key] = snap(key, number);
    });
    if (state.view === 'day') state.view = 'temps';            // the page's first address for its graph
    if (params.get('tonight') === '1' && params.get('when') === null) state.when = 1;     // and its first tick
    if (state.mode !== 'advanced') state.mode = 'simple';
    if (state.units !== 'f') state.units = 'c';
    if (TABS[state.mode].indexOf(state.view) < 0) state.view = DEFAULTS.view;
    state.keep = state.keep && parseDay(state.keep) ? dayKey(parseDay(state.keep)) : '';
    state.hide = state.hide.split(',').filter(function (key) {
      return FLOWS.some(function (each) { return each.key === key; });
    }).join(',');
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
    // On a tab of reading, the address keeps the place on the tab as well.
    try {
      history.replaceState(null, '', query + (GRAPHS.indexOf(state.view) >= 0 ? '' : location.hash));
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
    TABS.advanced.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + name).hidden = !on;
      if (on && focus) tab.focus();
    });
    $('workspace').hidden = GRAPHS.indexOf(view) < 0;
    changed();
  }

  function selectMode(mode) {
    state.mode = mode;
    document.body.classList.toggle('advanced', mode === 'advanced');
    ['simple', 'advanced'].forEach(function (name) {
      $('mode-' + name).setAttribute('aria-pressed', name === mode ? 'true' : 'false');
    });
    TABS.advanced.forEach(function (name) { $('tab-' + name).hidden = TABS[mode].indexOf(name) < 0; });
    if (TABS[mode].indexOf(state.view) < 0) selectView('about');
    else changed();
  }

  /* The code, shown on the Code tab: fetched when its section is first opened. */
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

  /* An address can point at a place on a tab of reading, such as ?view=physics#physics-equations. Go there. */
  function goToAddressPlace() {
    var reading = GRAPHS.indexOf(state.view) < 0 && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-' + state.view).contains(place)) place.scrollIntoView();
  }

  /* Read a graph at the pointer, or move along it with the keys. */
  function point(event) {
    var plot = plots[this.id];
    if (!plot) return;
    var box = this.getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = clamp(Math.round(clamp(along, 0, 1) * QUARTERS), 0, QUARTERS - 1);
    changed();
  }

  function keys(event) {
    var by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (by === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    // The first press starts at midnight. With Shift, each press is an hour.
    var at = cursor === null ? QUARTERS / 2 : cursor + by * (event.shiftKey ? 4 : 1);
    if (event.key === 'Home') at = 0;
    if (event.key === 'End') at = QUARTERS - 1;
    cursor = clamp(at, 0, QUARTERS - 1);
    changed();
  }

  function start() {
    readAddress();
    show.sky = numberControl('sky', skyHint);
    show.wind = numberControl('wind', windHint);
    show.bowen = numberControl('bowen');
    show.k = numberControl('k');
    show.c = numberControl('c');
    show.rough = roughControl();
    show.when = whenControl();
    show.lines = lineSwitches();
    function set(change) { return function () { change(this); changed(); }; }

    ['simple', 'advanced'].forEach(function (name) {
      $('mode-' + name).addEventListener('click', function () { selectMode(name); });
    });
    ['c', 'f'].forEach(function (unit) {
      $('unit-' + unit).addEventListener('click', function () { state.units = unit; changed(); });
    });
    TABS.advanced.forEach(function (name) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var tabs = TABS[state.mode], at = tabs.indexOf(name);
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(tabs[(to + tabs.length) % tabs.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.presets button'), function (button) {
      button.addEventListener('click', set(function () { state.sky = +button.dataset.share; }));
    });
    $('reset').addEventListener('click', set(function () {
      KEY_ORDER.forEach(function (key) { state[key] = DEFAULTS[key]; });
    }));
    $('keep').addEventListener('click', set(function () { state.keep = dayKey(currentDay()); }));
    $('unkeep').addEventListener('click', set(function () { state.keep = ''; $('keep').focus(); }));
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    $('moment').addEventListener('input', function () { cursor = clamp(+this.value, 0, QUARTERS - 1); changed(); });
    ['temps-graph', 'energy-graph', 'soil-graph', 'soil-map'].forEach(function (id) {
      $(id).addEventListener('pointermove', point);
      $(id).addEventListener('pointerdown', point);
      $(id).addEventListener('keydown', keys);
    });
    window.addEventListener('resize', changed);

    showAll();
    selectMode(state.mode);
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
