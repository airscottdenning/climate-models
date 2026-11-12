/* Moon model: the page. model.js is the science. This file is the controls, the graph and the words under
 * it. It works out nothing about the Moon itself: every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.Moon;
  var VIEWS = ['day', 'about'];
  // The lengths of day the slider stops at, in Earth days.
  var STOPS = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, M.MOON_DAY, 45, 60, 90, 120, 180, 270, 365];
  // What the page shows when the address says nothing. `keep` is the kept day: "days,albedo,minutes".
  var DEFAULTS = { view: 'day', day: M.MOON_DAY, albedo: 11, step: 5, keep: '' };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var NIGHT = '#eef2f5', KEPT = '#5f6d75', ALARM = '#a32a1e';
  // The layers the graph follows, drawn in this order: the middles of layers 10, 7 and 4 are about 30, 10
  // and 3 cm down, and layer 1 is the surface.
  var LINES = [
    { layer: 9, name: '30 cm', color: '#009e73', width: 1.8 },
    { layer: 6, name: '10 cm', color: '#d55e00', width: 1.8 },
    { layer: 3, name: '3 cm', color: '#0072b2', width: 1.8 },
    { layer: 0, name: 'Surface', color: INK, width: 2.3 }
  ];
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = '\u00a0';     // a space that keeps a number and its unit on one line
  var QUARTERS = 96;     // the graph is read every quarter of an hour on its own clock

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var cursor = null;    // which quarter of an hour is being read, 0 to 95, or null
  var plot = null;      // where the graph's left and right edges were last drawn
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  /* A number to so many places, with a real minus sign, and no sign at all on a zero. */
  function fixed(x, digits) {
    var digitsText = x.toFixed(digits);
    return minus(parseFloat(digitsText) === 0 ? (0).toFixed(digits) : digitsText);
  }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  // ---- The day that's showing, and the day that was kept ----

  function nearestStop(days) {
    return STOPS.reduce(function (best, stop) {
      return Math.abs(Math.log(stop / days)) < Math.abs(Math.log(best / days)) ? stop : best;
    });
  }

  function dayText(days) {
    if (days === M.MOON_DAY) return '29.53 Earth days';
    return days === 1 ? '1 Earth day' : days + ' Earth days';
  }

  function currentDay() { return { day: state.day, albedo: state.albedo, step: state.step }; }

  /* A day as the address keeps it: "29.5313,11,5". */
  function dayKey(choice) {
    return [+choice.day.toFixed(4), choice.albedo, choice.step].join(',');
  }

  /* The other way: a day from the address, or null if the controls don't reach it. */
  function parseDay(string) {
    var parts = String(string || '').split(',').map(parseFloat);
    var inside = parts.length === 3 && parts[0] >= 0.99 && parts[0] <= 366 &&
      parts[1] >= +$('albedo').min && parts[1] <= +$('albedo').max &&
      parts[2] >= +$('step').min && parts[2] <= +$('step').max;
    return inside ? { day: nearestStop(parts[0]), albedo: Math.round(parts[1]), step: Math.round(parts[2]) } : null;
  }

  function describe(choice) {
    return dayText(choice.day) + ' long, with an albedo of ' + choice.albedo + '% and a time step of ' +
      plural(choice.step, 'minute');
  }

  /* The model's day for a choice of the three controls. The last answer for each of the two days on the graph
   * is kept, so moving over the graph doesn't run the model again. `heat` is what goes into the ground at each
   * moment: the Sunlight taken in, less the infrared radiation emitted (steps 2 and 3 on the About tab). */
  var answers = {};
  function answer(choice, line) {
    var key = dayKey(choice);
    if (answers[line] && answers[line].key === key) return answers[line];
    var run = M.run(choice.day, choice.albedo / 100, choice.step);
    run.key = key;
    run.choice = choice;
    run.heat = new Float64Array(run.count);
    for (var i = 0; i < run.count; i++) {
      var angle = M.sunAngle(i * run.every * run.step, choice.day * M.EARTH_DAY);
      run.heat[i] = M.sunlight(angle, run.albedo) - M.glow(run.T[0][i]);
    }
    // A sound day repeats, and its surface turns around twice: after noon and at sunrise.
    run.sound = run.settled && !run.blewUp && run.turns <= 2;
    answers[line] = run;
    return run;
  }

  // ---- The controls ----

  /* The slider for the length of the day. It moves from one stop to the next. */
  function dayControl() {
    var range = $('day-range');
    function put() {
      var hours = state.day === 1 ? 'is one of ours' : 'lasts ' + dayText(state.day).replace('days', 'hours');
      range.value = STOPS.indexOf(state.day);
      range.setAttribute('aria-valuetext', dayText(state.day));
      $('day-value').textContent = dayText(state.day);
      $('day-hint').textContent = (state.day === M.MOON_DAY ? 'The Moon\'s own day, from one noon to the next. ' :
        state.day === 1 ? 'As long as a day on Earth. ' : '') + 'Each hour on the graph\'s clock ' + hours + '.';
    }
    range.addEventListener('input', function () { state.day = STOPS[+range.value]; put(); changed(); });
    return put;
  }

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
  function showAll() {
    Object.keys(show).forEach(function (key) { show[key](); });
    $('key-kept').hidden = $('kept-line').hidden = !state.keep;
  }

  // ---- Times and temperatures in words ----

  /* A place in the day, from 0 to 1, as a time on the graph's clock. */
  function clock(fraction) {
    var minutes = Math.round(fraction * 1440) % 1440, hour = Math.floor(minutes / 60), minute = minutes % 60;
    if (minutes === 0) return 'midnight';
    if (minutes === 720) return 'noon';
    return ((hour + 11) % 12 + 1) + ':' + (minute < 10 ? '0' : '') + minute + NB + (hour < 12 ? 'a.m.' : 'p.m.');
  }

  /* The same place as time on our own clocks. */
  function earthTime(fraction, days) {
    return days <= 2 ? (fraction * days * 24).toFixed(1) + ' Earth hours' : (fraction * days).toFixed(2) + ' Earth days';
  }

  function kelvins(kelvin, digits) { return fixed(kelvin, digits) + NB + 'K'; }

  /* A temperature three ways. */
  function threeWays(kelvin, digits) {
    var celsius = kelvin - 273.15;
    return kelvins(kelvin, digits) + ' (' + fixed(celsius, 1) + NB + '°C, ' + fixed(celsius * 1.8 + 32, 1) + NB + '°F)';
  }

  /* Which of a run's remembered moments is nearest to a quarter of an hour, or −1 if it blew up before then. */
  function moment(run, quarter) {
    var at = Math.round(quarter / QUARTERS * run.steps / run.every);
    return at < run.count ? at : -1;
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

  /* Two graphs that share the clock along the bottom: temperatures above, and the heat going into the ground
   * below. They're two graphs because they're two kinds of number. */
  function drawDay(now, kept) {
    var c = prepare($('day')), ctx = c.ctx, narrow = c.w < 560;
    var left = narrow ? 44 : 58, right = narrow ? 68 : 82, top = 30, bottom = 50, between = 50;
    var x0 = left, x1 = c.w - right;
    var a1 = top, a0 = top + Math.round((c.h - top - bottom - between) * 0.66);   // the upper graph's edges
    var b1 = a0 + between, b0 = c.h - bottom;                                    // the lower graph's edges
    var runs = kept ? [kept, now] : [now], i;
    plot = { x0: x0, x1: x1 };

    // How far the two scales have to reach.
    var hottest = 0, low = 0, high = 0;
    runs.forEach(function (run) {
      for (i = 0; i < run.count; i++) {
        hottest = Math.max(hottest, run.T[0][i]);
        low = Math.min(low, run.heat[i]); high = Math.max(high, run.heat[i]);
      }
    });
    var ceiling = hottest > 400 ? 500 : 400;       // a run that zig-zags goes over the top
    low = Math.max(low, -600); high = Math.min(high, 600);
    var gap = roundGap(Math.max(high - low, 20), 4);
    low = Math.min(Math.floor(low / gap), -1) * gap; high = Math.max(Math.ceil(high / gap), 1) * gap;
    function px(fraction) { return x0 + fraction * (x1 - x0); }
    function pyA(kelvin) { return a0 - clamp(kelvin, -100, 1000) / ceiling * (a0 - a1); }
    function pyB(heat) { return b0 - (clamp(heat, -5000, 5000) - low) / (high - low) * (b0 - b1); }
    function line(xa, ya, xb, yb, color) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }

    // Night and day, the grids and the axes.
    ctx.lineWidth = 1;
    [[a1, a0], [b1, b0]].forEach(function (edges) {
      ctx.fillStyle = NIGHT;
      ctx.fillRect(px(0), edges[0], px(0.25) - px(0), edges[1] - edges[0]);
      ctx.fillRect(px(0.75), edges[0], px(1) - px(0.75), edges[1] - edges[0]);
    });
    for (var kelvin = 0; kelvin <= ceiling; kelvin += 100) {
      line(x0, pyA(kelvin), x1, pyA(kelvin), GRID);
      text(ctx, String(kelvin), x0 - 8, pyA(kelvin), { align: 'right', baseline: 'middle' });
    }
    for (var heat = low; heat <= high + gap / 2; heat += gap) {
      line(x0, pyB(heat), x1, pyB(heat), Math.abs(heat) < gap / 2 ? SPINE : GRID);
      text(ctx, fixed(heat, 0), x0 - 8, pyB(heat), { align: 'right', baseline: 'middle' });
    }
    [[a1, a0], [b1, b0]].forEach(function (edges) {
      line(x0, edges[0], x0, edges[1], SPINE);
      line(x0, edges[1], x1, edges[1], SPINE);
      for (var hour = 0; hour <= 24; hour += 2) {
        line(px(hour / 24), edges[1], px(hour / 24), edges[1] + (hour % 6 ? 3 : 6), SPINE);
      }
    });
    ['Midnight', '6 a.m.', 'Noon', '6 p.m.', 'Midnight'].forEach(function (name, at) {
      text(ctx, name, px(at / 4), b0 + 19, { align: 'center' });
    });
    ['Night', 'Day', 'Night'].forEach(function (name, at) {
      text(ctx, name, px([0.125, 0.5, 0.875][at]), a0 - 9, { align: 'center', size: 12, color: '#4a5a66' });
    });
    text(ctx, 'Temperature (K)', narrow ? 6 : x0, a1 - 10, { bold: true, color: INK });
    text(ctx, 'Heat going into the ground (W/m²)', narrow ? 6 : x0, b1 - 10, { bold: true, color: INK });
    text(ctx, 'Time of day, where one day is ' + dayText(now.days), (x0 + x1) / 2, c.h - 7,
      { align: 'center', color: INK });

    // The lines. A day that repeats ends where it began, so its lines run on to the right-hand midnight.
    function curve(run, value, py, color, width, dash) {
      ctx.beginPath();
      for (var k = 0; k < run.count; k++) ctx[k ? 'lineTo' : 'moveTo'](px(run.fraction[k]), py(value(k)));
      if (run.settled) ctx.lineTo(px(1), py(value(0)));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
      ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    function inside(y1, y0, drawing) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y1, x1 - x0, y0 - y1); ctx.clip(); drawing(); ctx.restore();
    }
    function layer(run, at) { return function (k) { return run.T[at][k]; }; }
    function heatOf(run) { return function (k) { return run.heat[k]; }; }
    inside(a1, a0, function () {
      if (kept) curve(kept, layer(kept, 0), pyA, KEPT, 1.8, [6, 4]);
      LINES.forEach(function (each) { curve(now, layer(now, each.layer), pyA, each.color, each.width); });
    });
    inside(b1, b0, function () {
      if (kept) curve(kept, heatOf(kept), pyB, KEPT, 1.8, [6, 4]);
      curve(now, heatOf(now), pyB, INK, 2);
    });

    if (now.blewUp) {
      var end = px(now.fraction[now.count - 1]), room = x1 - end > 90;      // the mess is on the left
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; line(end, a1, end, b0, ALARM); ctx.setLineDash([]);
      text(ctx, 'Blew up here', end + (room ? 7 : -7), a1 + 36,
        { bold: true, color: ALARM, halo: '#ffffff', align: room ? 'left' : 'right' });
    } else {
      // Each line's name at its right-hand end, moved apart where two would touch.
      var ends = LINES.map(function (each) {
        return { each: each, y: pyA(clamp(now.T[each.layer][now.settled ? 0 : now.count - 1], 0, ceiling)) };
      }).sort(function (p, q) { return p.y - q.y; });
      for (i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 15);
      for (i = ends.length - 1; i >= 0; i--) ends[i].y = Math.min(ends[i].y, a0 - 5 - (ends.length - 1 - i) * 15);
      ends.forEach(function (end) {
        ctx.lineWidth = 3; line(x1 + 5, end.y, x1 + 15, end.y, end.each.color);
        text(ctx, end.each.name, x1 + 19, end.y, { size: 12, baseline: 'middle' });
      });
    }

    // The moment being read.
    if (cursor === null) return;
    var at = moment(now, cursor), x = px(at < 0 ? cursor / QUARTERS : now.fraction[at]);
    function dot(xDot, y, color) {
      ctx.beginPath(); ctx.arc(xDot, y, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.lineWidth = 1;
    line(x, a1, x, a0, INK); line(x, b1, x, b0, INK);
    var keptAt = kept ? moment(kept, cursor) : -1;
    if (keptAt >= 0) {
      dot(px(kept.fraction[keptAt]), pyA(kept.T[0][keptAt]), KEPT);
      dot(px(kept.fraction[keptAt]), pyB(kept.heat[keptAt]), KEPT);
    }
    if (at < 0) return;
    LINES.forEach(function (each) { dot(x, pyA(now.T[each.layer][at]), each.color); });
    dot(x, pyB(now.heat[at]), INK);
  }

  // ---- The words under the graph ----

  /* The Sun's angle at one of a run's remembered moments (step 1 on the About tab), in radians. */
  function angleAt(run, at) { return M.sunAngle(at * run.every * run.step, run.days * M.EARTH_DAY); }

  function readout(now, kept) {
    if (cursor === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var at = moment(now, cursor);
    if (at < 0) return 'The model had blown up before ' + clock(cursor / QUARTERS) + ', so there\'s nothing to read here.';
    var fraction = now.fraction[at], degrees = angleAt(now, at) * 180 / Math.PI;
    var words = 'At ' + clock(fraction) + (at ? ', ' + earthTime(fraction, now.days) + ' after midnight, ' : ', ') +
      (Math.abs(degrees) < 90 ? 'the Sun is ' + Math.abs(degrees).toFixed(1) + '° from straight overhead' :
        'the Sun is down') + ' (θ' + NB + '=' + NB + fixed(degrees, 1) + '°). The surface is at ' +
      threeWays(now.T[0][at], 2) + ', and the layer under it is at ' + kelvins(now.T[1][at], 2) + '. Farther down it\'s ' +
      kelvins(now.T[3][at], 1) + ' at 3' + NB + 'cm, ' + kelvins(now.T[6][at], 1) + ' at 10' + NB + 'cm and ' +
      kelvins(now.T[9][at], 1) + ' at 30' + NB + 'cm.';
    var keptAt = kept ? moment(kept, cursor) : -1;
    if (keptAt >= 0) {
      words += ' On the day you kept, the surface is at ' + kelvins(kept.T[0][keptAt], 2) + ' at this time of day.';
    }
    return words;
  }

  /* The top layer's sums for the step being read: steps 2 to 5 on the About tab, one line each. */
  function budget(now) {
    var at = cursor === null ? -1 : moment(now, cursor), unit = NB + 'W/m²';
    $('day-budget').hidden = at < 0;
    if (at < 0) return;
    var top = M.topLayer([now.T[0][at], now.T[1][at]], angleAt(now, at), now.albedo, now.step, M.thicknesses());
    $('budget-q').textContent = fixed(top.sunlight, 1) + unit;
    $('budget-e').textContent = fixed(top.glow, 1) + unit;
    $('budget-f').textContent = fixed(top.down, 1) + unit;
    $('budget-left').textContent = fixed(top.left, 1) + unit;
    $('budget-warming').textContent = fixed(top.warming, 2) + NB + 'K';
  }

  /* What became of a run: its hottest, coldest and average, or what went wrong. */
  function verdict(run) {
    var fix = ' Step 6 on the About tab says why. A shorter time step fixes it.';
    if (run.blewUp) {
      return 'With this time step the model blew up at ' + clock(run.fraction[run.count - 1]) + ' on ' +
        (run.daysRun === 1 ? 'its first day' : 'day ' + run.daysRun) + ': the surface temperature went below ' +
        'zero kelvins or above 10,000. The graph shows the day up to that moment.' + fix;
    }
    if (run.turns > 2) {
      return 'This time step is too long. The surface temperature zig-zags: it turns around ' + commas(run.turns) +
        ' times in the day, and a real surface turns around twice. Don\'t trust these numbers.' + fix;
    }
    return 'The surface is hottest at ' + clock(run.hottest.at) + ', at ' + threeWays(run.hottest.kelvin, 1) +
      ', and coldest at ' + clock(run.coldest.at) + ', at ' + threeWays(run.coldest.kelvin, 1) +
      '. Its average over the day is ' + threeWays(run.mean, 1) + '. ' + (run.settled ?
        'The model ran ' + run.daysRun + ' days to reach a day that repeats.' :
        'After ' + run.daysRun + ' days the model still hadn\'t reached a day that repeats, so these aren\'t final.');
  }

  function summary(now, kept) {
    var words = 'This day is ' + describe(now.choice) + '. ' + verdict(now);
    if (!kept) return words;
    return words + ' The day you kept was ' + describe(kept.choice) + '. ' + (kept.sound ?
      'Its surface was hottest at ' + kelvins(kept.hottest.kelvin, 1) + ' and coldest at ' +
      kelvins(kept.coldest.kelvin, 1) + ', and its average was ' + kelvins(kept.mean, 1) + '.' :
      'Its time step was too long, so it has no numbers to compare.');
  }

  /* Under the time step: how many steps fit in the day, and about the longest step that would work (step 6). */
  function stepHint(run) {
    var words = commas(run.steps) + ' steps in the day.';
    if (Math.abs(run.step - run.minutes * 60) > 0.05) {
      words += ' Each is ' + commas(Math.floor(run.step)) + (run.step % 1).toFixed(1).slice(1) +
        ' seconds, so that a whole number of them fits.';
    }
    if (run.sound) {
      words += ' For this day, a step longer than about ' + (M.longestStep(run.hottest.kelvin) / 60).toFixed(1) +
        ' minutes would zig-zag.';
    }
    return words;
  }

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view !== 'day') return;
    var now = answer(currentDay(), 'now'), choice = state.keep ? parseDay(state.keep) : null;
    var kept = choice ? answer(choice, 'kept') : null;
    drawDay(now, kept);
    say('day-readout', readout(now, kept));
    budget(now);
    say('day-summary', summary(now, kept));
    say('step-hint', stepHint(now));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = params.get(key), number = parseFloat(value);
      if (value === null) return;
      if (typeof DEFAULTS[key] !== 'number') { state[key] = value; return; }
      if (!isFinite(number)) return;
      state[key] = key === 'day' ? nearestStop(clamp(number, STOPS[0], STOPS[STOPS.length - 1])) :
        clamp(Math.round(number), +$(key).min, +$(key).max);
    });
    if (VIEWS.indexOf(state.view) < 0) state.view = DEFAULTS.view;
    state.keep = state.keep && parseDay(state.keep) ? dayKey(parseDay(state.keep)) : '';
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
    // On the About tab, the address keeps the place on the tab as well.
    try {
      history.replaceState(null, '', query + (state.view === 'day' ? '' : location.hash));
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
    var reading = state.view !== 'day' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-' + state.view).contains(place)) place.scrollIntoView();
  }

  /* Read the graph at the pointer, or move along it with the keys. */
  function point(event) {
    if (!plot) return;
    var box = $('day').getBoundingClientRect();
    var along = (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0);
    cursor = clamp(Math.round(clamp(along, 0, 1) * QUARTERS), 0, QUARTERS - 1);
    changed();
  }

  function keys(event) {
    var by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (by === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    // The first press starts at noon. With Shift, each press is an hour.
    var at = cursor === null ? QUARTERS / 2 : cursor + by * (event.shiftKey ? 4 : 1);
    if (event.key === 'Home') at = 0;
    if (event.key === 'End') at = QUARTERS - 1;
    cursor = clamp(at, 0, QUARTERS - 1);
    changed();
  }

  function start() {
    readAddress();
    show.day = dayControl();
    show.albedo = pair('albedo');
    show.step = pair('step');
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
    Array.prototype.forEach.call(document.querySelectorAll('.presets button'), function (button) {
      button.addEventListener('click', set(function () { state.day = nearestStop(parseFloat(button.dataset.day)); }));
    });
    $('reset').addEventListener('click', set(function () {
      state.day = DEFAULTS.day; state.albedo = DEFAULTS.albedo; state.step = DEFAULTS.step;
    }));
    $('keep').addEventListener('click', set(function () { state.keep = dayKey(currentDay()); }));
    $('unkeep').addEventListener('click', set(function () { state.keep = ''; $('keep').focus(); }));
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    $('day').addEventListener('pointermove', point);
    $('day').addEventListener('pointerdown', point);
    $('day').addEventListener('keydown', keys);
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
