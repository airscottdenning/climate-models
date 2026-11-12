/* Forcing, feedback and response: the page. model.js is the science. This file is the controls, the four
 * graphs and the words under them. It works out nothing about the climate itself: every number it shows
 * comes from model.js or from data.json. */
(function () {
  'use strict';

  var M = window.Feedback;
  var VIEWS = ['forcing', 'feedback', 'response', 'future', 'about'];
  // What the page shows when the address says nothing. The three forcings are percentages of the IPCC's
  // best estimate. The four gains have no units. `ocean` is γ on the About tab, and `tie` is the box that
  // keeps water vapor and vertical mixing adding up to the same total.
  var DEFAULTS = { view: 'forcing', co2: 100, methane: 100, smog: 100, ice: M.GAINS.ice, clouds: M.GAINS.clouds,
                   water: M.GAINS.water, mixing: M.GAINS.mixing, tie: 1, ocean: M.EXCHANGE };
  var SLIDERS = ['co2', 'methane', 'smog', 'ice', 'clouds', 'water', 'mixing', 'ocean'];
  var PLACES = { co2: 0, methane: 0, smog: 0, ice: 2, clouds: 2, water: 2, mixing: 2, ocean: 2 };
  // The sets of controls, and which of them each view shows.
  var GROUPS = ['forcing', 'feedback', 'ocean'];
  var SHOWN = { forcing: ['forcing'], feedback: ['feedback'], response: GROUPS, future: GROUPS };
  var SCENARIOS = ['ssp119', 'ssp126', 'ssp245', 'ssp370', 'ssp585'];
  var SCENARIO_COLOR = { ssp119: '#009e73', ssp126: '#0072b2', ssp245: '#e69f00', ssp370: '#d55e00',
                         ssp585: '#882255' };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0', SHADE = '#eef2f5';
  var CO2 = '#d55e00', SMOG = '#0072b2', QUIET = '#a3aeb5', MEASURED = '#87959e', BAND = '#dfe5e9';
  var ALARM = '#a32a1e';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';      // a space that keeps a number and its unit on one line
  var GAIN_FROM = -0.1, GAIN_TO = 1.4;    // the second view's scale of gain
  var CEILING = 10;       // the top of its scale of warming, in °C

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var data = null;        // data.json, once it has come
  var limits = null;      // how far the first graph's scale has to reach, whatever the sliders say
  var cursor = { forcing: null, feedback: null, response: null, future: null };   // what's being read
  var plots = {};         // where each graph's left and right edges were last drawn, and what they stand for
  var show = {};          // one function for each control: put the state's number in it
  var chosen = {};        // the sets of controls the reader has opened or closed

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  /* A number to so many places, with a real minus sign, and no sign at all on a zero. */
  function fixed(x, digits) {
    var digitsText = x.toFixed(digits);
    return minus(parseFloat(digitsText) === 0 ? (0).toFixed(digits) : digitsText);
  }
  function hundredths(x) { return Math.round(x * 100) / 100; }
  function degrees(x, digits) { return fixed(x, digits) + NB + '°C'; }
  function watts(x, digits) { return fixed(x, digits) + NB + 'W/m²'; }
  function narrowScreen() { return window.matchMedia('(max-width: 760px)').matches; }

  // ---- The model's answer for the settings that are showing ----

  /* Everything the four views need. The last answer is kept, so reading a graph doesn't run the model again.
   * The total gain is rounded to hundredths, the sliders' own step, so that gains that add up to 1 give
   * exactly 1. */
  var last = null;
  function answer() {
    var key = SLIDERS.map(function (name) { return state[name]; }).join(',');
    if (last && last.key === key) return last;
    var history = data.history, first = history.first;
    var a = { key: key, first: first };
    a.scale = { co2: state.co2 / 100, methane: state.methane / 100, smog: state.smog / 100 };
    a.gains = { water: state.water, mixing: state.mixing, ice: state.ice, clouds: state.clouds };
    a.gain = hundredths(M.totalGain(a.gains));
    a.S = M.sensitivity(a.gain);
    a.stable = isFinite(a.S);
    a.doubling = M.doublingWarming(a.S, a.scale.co2);
    a.F = M.forcings(history, a.scale);
    if (a.stable) {
      a.past = M.run(a.F, a.S, state.ocean);
      a.base = M.baseline(a.past.T, first);
      a.deepBase = M.baseline(a.past.D, first);
      a.misfit = M.misfit(a.past.T, first, data.observed);
      a.futures = {};
      SCENARIOS.forEach(function (name) {
        var F = M.forcings(M.joined(history, data.scenarios[name]), a.scale);
        a.futures[name] = M.run(F, a.S, state.ocean);
      });
    }
    last = a;
    return a;
  }

  /* How far the first graph's scale has to reach, with every slider at whichever end reaches farthest. */
  function forcingLimits() {
    var h = data.history, low = 0, high = 0;
    function end(name, which) { return +$(name)[which] / 100; }
    h.co2.forEach(function (co2, i) {
      high = Math.max(high, end('co2', 'max') * co2 + end('methane', 'max') * h.methane[i] +
        end('smog', 'min') * h.smog[i] + h.other[i]);
      low = Math.min(low, end('co2', 'min') * co2 + end('methane', 'min') * h.methane[i] +
        end('smog', 'max') * h.smog[i] + h.other[i], end('smog', 'max') * h.smog[i], h.parts.volcanoes[i]);
    });
    return { low: Math.floor(low * 2) / 2, high: Math.ceil(high * 2) / 2 };
  }

  // ---- The controls ----

  /* A slider and a number box that hold the same number. With the box ticked, water vapor and vertical
   * mixing move together: one goes up as the other goes down. */
  function pair(key) {
    var number = $(key), range = $(key + '-range'), places = PLACES[key];
    function put() {
      number.value = range.value = state[key].toFixed(places);
      range.setAttribute('aria-valuetext', places ? fixed(state[key], places) : state[key] + '%');
    }
    function take(source) {
      var value = parseFloat(source.value), step = +number.step;
      if (!isFinite(value)) { put(); return; }
      state[key] = +clamp(Math.round(value / step) * step, +number.min, +number.max).toFixed(4);
      if (state.tie && key === 'water') state.mixing = hundredths(M.PAIR - state.water);
      if (state.tie && key === 'mixing') state.water = hundredths(M.PAIR - state.mixing);
      showAll();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* Put the state into every control. */
  function showAll() {
    Object.keys(show).forEach(function (key) { show[key](); });
    $('tie').checked = !!state.tie;
  }

  /* Move the controls into a view, and show the sets that view uses. A view with one set shows it open. A
   * view with all three opens them on a wide screen. On a phone it opens only the newest, and the others'
   * headings give their settings. Either way, a set the reader has opened or closed stays that way. */
  function arrange(view) {
    var shown = SHOWN[view];
    if (!shown) return;
    $('panel-' + view).querySelector('.slot').appendChild($('controls'));
    GROUPS.forEach(function (name) {
      var group = $('group-' + name);
      group.hidden = shown.indexOf(name) < 0;
      if (shown.length === 1) group.open = true;
      else group.open = name in chosen ? chosen[name] : (!narrowScreen() || name === 'ocean');
    });
  }

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
    return { ctx: ctx, w: w, h: h, narrow: w < 560 };
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

  function line(ctx, xa, ya, xb, yb, color) {
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
  }

  function dot(ctx, x, y, color, radius) {
    ctx.beginPath(); ctx.arc(x, y, radius || 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* A round size for the gap between gridlines, so that about `count` of them cover `span`. */
  function roundGap(span, count) {
    var raw = span / count, power = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), lead = raw / power;
    return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
  }

  /* Level gridlines with their numbers, and the left and bottom edges of a graph. */
  function grid(ctx, box, py, low, high, gap) {
    var digits = gap < 1 ? 1 : 0;
    ctx.lineWidth = 1;
    for (var k = Math.ceil(low / gap - 1e-9); k * gap <= high + 1e-9; k++) {
      line(ctx, box.x0, py(k * gap), box.x1, py(k * gap), k === 0 ? SPINE : GRID);
      text(ctx, fixed(k * gap, digits), box.x0 - 7, py(k * gap), { align: 'right', baseline: 'middle' });
    }
    line(ctx, box.x0, box.y1, box.x0, box.y0, SPINE);
    line(ctx, box.x0, box.y0, box.x1, box.y0, SPINE);
  }

  /* Marks for the years along the bottom of a graph, with a number on some of them. */
  function yearMarks(ctx, box, px, from, to, every, labels) {
    ctx.lineWidth = 1;
    for (var year = Math.ceil(from / 10) * 10; year <= to; year += 10) {
      line(ctx, px(year), box.y0, px(year), box.y0 + (year % 50 ? 3 : 6), SPINE);
      if (labels && year % every === 0) text(ctx, String(year), px(year), box.y0 + 19, { align: 'center' });
    }
  }

  /* One line of a graph: a value for each year, from the year `first`. */
  function curve(ctx, values, first, px, py, color, width, dash, from) {
    from = from || 0;
    ctx.beginPath();
    for (var i = from; i < values.length; i++) ctx[i === from ? 'moveTo' : 'lineTo'](px(first + i), py(values[i]));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }

  /* Draw only inside a graph's own box. */
  function inside(ctx, box, drawing) {
    ctx.save(); ctx.beginPath(); ctx.rect(box.x0, box.y1, box.x1 - box.x0, box.y0 - box.y1); ctx.clip();
    drawing(); ctx.restore();
  }

  /* Each line's name beside its right-hand end, moved apart where two would touch. */
  function endNames(ctx, items, x, top, bottom, size) {
    var gap = size + 2, i;
    items.sort(function (p, q) { return p.y - q.y; });
    items[0].y = Math.max(items[0].y, top);
    for (i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + gap);
    for (i = items.length - 1; i >= 0; i--) {
      items[i].y = Math.min(items[i].y, bottom - (items.length - 1 - i) * gap);
    }
    items.forEach(function (item) {
      ctx.lineWidth = item.width; line(ctx, x + 4, item.y, x + 13, item.y, item.color);
      text(ctx, item.name, x + 17, item.y, { size: size, baseline: 'middle', bold: item.bold,
                                               color: item.bold ? INK : TICK });
    });
  }

  /* What a graph says when the gains add up to 1 or more. */
  function noAnswer(ctx, box, a) {
    var middle = (box.x0 + box.x1) / 2, y = (box.y0 + box.y1) / 2;
    text(ctx, 'No stable climate', middle, y - 10, { align: 'center', bold: true, size: 16, color: ALARM,
                                                     halo: '#ffffff' });
    text(ctx, 'The gains add up to ' + fixed(a.gain, 2) + '.', middle, y + 12,
      { align: 'center', color: INK, halo: '#ffffff' });
  }

  // ---- 1. Forcing ----

  function forcingLines(a) {
    var h = data.history;
    function scaled(values, by) { return values.map(function (value) { return by * value; }); }
    return [
      { name: 'Volcanoes', values: h.parts.volcanoes },
      { name: 'Sun', values: h.parts.sun },
      { name: 'Land', values: h.parts.land },
      { name: 'Other gases', values: h.parts.gases },
      { name: 'Methane', values: scaled(h.methane, a.scale.methane) },
      { name: 'CO₂', values: scaled(h.co2, a.scale.co2), color: CO2, width: 2.4 },
      { name: 'Smog', values: scaled(h.smog, a.scale.smog), color: SMOG, width: 2.4 },
      { name: 'All together', values: a.F, color: INK, width: 2.8 }
    ];
  }

  function drawForcing(a) {
    var c = prepare($('forcing-graph')), ctx = c.ctx, h = data.history;
    var box = { x0: c.narrow ? 34 : 44, x1: c.w - (c.narrow ? 88 : 104), y1: 30, y0: c.h - 30 };
    var low = limits.low, high = limits.high;
    function px(year) { return box.x0 + (year - h.first) / (h.last - h.first) * (box.x1 - box.x0); }
    function py(value) { return box.y0 - (value - low) / (high - low) * (box.y0 - box.y1); }
    plots.forcing = { x0: box.x0, x1: box.x1, from: h.first, to: h.last };

    grid(ctx, box, py, low, high, 1);
    yearMarks(ctx, box, px, h.first, h.last, 50, true);
    text(ctx, 'Climate forcing (W/m²)', c.narrow ? 6 : box.x0, box.y1 - 10, { bold: true, color: INK });

    var lines = forcingLines(a), at = h.last - h.first;
    inside(ctx, box, function () {
      lines.forEach(function (each) {
        curve(ctx, each.values, h.first, px, py, each.color || QUIET, each.width || 1.3);
      });
    });
    endNames(ctx, lines.map(function (each) {
      return { name: each.name, y: py(each.values[at]), color: each.color || QUIET, width: each.color ? 3 : 2,
               bold: !!each.color };
    }), box.x1, box.y1 + 6, box.y0 - 4, c.narrow ? 11 : 12);

    if (cursor.forcing === null) return;
    var x = px(cursor.forcing), i = cursor.forcing - h.first;
    ctx.lineWidth = 1; line(ctx, x, box.y1, x, box.y0, INK);
    lines.forEach(function (each) { if (each.color) dot(ctx, x, py(each.values[i]), each.color); });
  }

  function forcingReadout(a) {
    var year = cursor.forcing, h = data.history;
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var i = year - h.first, s = a.scale;
    return 'In ' + year + ': CO₂ ' + watts(s.co2 * h.co2[i], 2) + ', methane ' + fixed(s.methane * h.methane[i], 2) +
      ', other gases ' + fixed(h.parts.gases[i], 2) + ', reflective smog ' + fixed(s.smog * h.smog[i], 2) +
      ', volcanoes ' + fixed(h.parts.volcanoes[i], 2) + ', the Sun ' + fixed(h.parts.sun[i], 2) +
      ', and changes to the land, soot on snow and aircraft trails ' + fixed(h.parts.land[i], 2) +
      '. All together: ' + watts(a.F[i], 2) + '.';
  }

  function forcingSummary(a) {
    var h = data.history, i = h.last - h.first, s = a.scale;
    return 'In ' + h.last + ', with these settings, CO₂ pushes ' + watts(s.co2 * h.co2[i], 2) +
      ' toward warming, methane ' + fixed(s.methane * h.methane[i], 2) + ' and everything else ' +
      fixed(h.other[i], 2) + '. Reflective smog pushes ' + fixed(-s.smog * h.smog[i], 2) +
      ' the other way. All together: ' + watts(a.F[i], 2) + '.';
  }

  /* Under each forcing slider: what it gives in 2019, and the IPCC's range for that year. */
  function forcingHints(a) {
    var h = data.history, i = h.last - h.first, ipcc = data.ipcc.forcing;
    ['co2', 'methane', 'smog'].forEach(function (name) {
      var digits = name === 'smog' ? 1 : 2;
      say(name + '-hint', watts(a.scale[name] * h[name][i], 2) + ' in ' + ipcc.year +
        '. The IPCC\'s very likely range is ' + fixed(ipcc[name][1], digits) + ' to ' +
        fixed(ipcc[name][2], digits) + '.');
    });
  }

  // ---- 2. Feedback ----

  /* Two drawings that share the scale of gain along the bottom: the four gains laid end to end above, and
   * the curve from step 4 on the About tab below. */
  function drawFeedback(a) {
    var c = prepare($('feedback-graph')), ctx = c.ctx, row = 25;
    var x0 = c.narrow ? 30 : 40, x1 = c.w - (c.narrow ? 10 : 18);
    var upper = { x0: x0, x1: x1, y1: 30, y0: 30 + 5 * row + 6 };
    var lower = { x0: x0, x1: x1, y1: upper.y0 + 46, y0: c.h - 46 };
    function px(gain) { return x0 + (gain - GAIN_FROM) / (GAIN_TO - GAIN_FROM) * (x1 - x0); }
    function py(warming) { return lower.y0 - clamp(warming, 0, CEILING) / CEILING * (lower.y0 - lower.y1); }
    function warmingAt(gain) { return M.doublingWarming(M.sensitivity(gain), a.scale.co2); }
    plots.feedback = { x0: x0, x1: x1, from: GAIN_FROM, to: GAIN_TO };

    // Where there's no stable climate.
    ctx.fillStyle = SHADE;
    [upper, lower].forEach(function (box) { ctx.fillRect(px(1), box.y1, x1 - px(1), box.y0 - box.y1); });
    text(ctx, c.narrow ? 'No stable' : 'No stable climate', px(1.2), lower.y1 + 20,
      { align: 'center', color: ALARM, bold: true, size: c.narrow ? 12 : 13 });
    if (c.narrow) text(ctx, 'climate', px(1.2), lower.y1 + 35, { align: 'center', color: ALARM, bold: true, size: 12 });

    // The IPCC's ranges for the warming from doubled CO₂.
    var ipcc = data.ipcc.doubling;
    ctx.fillStyle = SHADE;
    ctx.fillRect(x0, py(ipcc.veryLikely[1]), px(1) - x0, py(ipcc.veryLikely[0]) - py(ipcc.veryLikely[1]));
    ctx.fillStyle = BAND;
    ctx.fillRect(x0, py(ipcc.likely[1]), px(1) - x0, py(ipcc.likely[0]) - py(ipcc.likely[1]));

    // The scales.
    ctx.lineWidth = 1;
    for (var k = 0; k <= 7; k++) {
      var gain = k / 5;
      [upper, lower].forEach(function (box) { line(ctx, px(gain), box.y1, px(gain), box.y0, k ? GRID : SPINE); });
      text(ctx, fixed(gain, 1), px(gain), lower.y0 + 18, { align: 'center' });
    }
    for (var warming = 0; warming <= CEILING; warming += 2) {
      line(ctx, x0, py(warming), x1, py(warming), GRID);
      text(ctx, String(warming), x0 - 7, py(warming), { align: 'right', baseline: 'middle' });
    }
    line(ctx, x0, lower.y1, x0, lower.y0, SPINE);
    line(ctx, x0, lower.y0, x1, lower.y0, SPINE);
    line(ctx, x0, upper.y0, x1, upper.y0, SPINE);
    ctx.setLineDash([5, 4]); line(ctx, x0, py(ipcc.best), px(1), py(ipcc.best), TICK); ctx.setLineDash([]);
    text(ctx, 'The gains, end to end', c.narrow ? 6 : x0, upper.y1 - 10, { bold: true, color: INK });
    text(ctx, 'Total gain', (x0 + x1) / 2, c.h - 8, { align: 'center', color: INK });

    // The four gains, each starting where the one before ended, and then their total.
    var bars = [['Water vapor', a.gains.water], ['Vertical mixing', a.gains.mixing],
                ['Ice and snow', a.gains.ice], ['Clouds', a.gains.clouds]];
    var sum = 0;
    function bar(name, from, to, at, color, bold) {
      var y = upper.y1 + 4 + at * row, left = px(Math.min(from, to)), right = px(Math.max(from, to));
      ctx.fillStyle = color;
      ctx.fillRect(left, y + 3, Math.max(right - left, 1.5), row - 8);
      ctx.font = (bold ? '600 ' : '') + '12px ' + FONT;
      var fits = right + 6 + ctx.measureText(name).width < x1 - 2;
      text(ctx, name, fits ? right + 6 : left - 6, y + row / 2, { size: 12, baseline: 'middle', bold: bold,
        color: INK, align: fits ? 'left' : 'right', halo: '#ffffff' });
    }
    bars.forEach(function (each, at) {
      var next = sum + each[1];
      bar(each[0] + ' ' + (each[1] > 0 ? '+' : '') + fixed(each[1], 2), sum, next, at,
        each[1] < 0 ? SMOG : CO2);
      ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      line(ctx, px(next), upper.y1 + 4 + at * row + 3, px(next), upper.y1 + 4 + (at + 2) * row - 5, SPINE);
      ctx.setLineDash([]);
      sum = next;
    });
    bar('Total ' + fixed(a.gain, 2), 0, a.gain, 4, INK, true);

    // The curve, as far as the top of the graph.
    inside(ctx, lower, function () {
      ctx.beginPath();
      for (var g = GAIN_FROM; g < 0.9999; g += 0.0025) {
        var y = lower.y0 - warmingAt(g) / CEILING * (lower.y0 - lower.y1);
        ctx[g === GAIN_FROM ? 'moveTo' : 'lineTo'](px(g), Math.max(y, lower.y1 - 20));
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    });

    // The reader's own gain, and the place being read.
    var x = px(a.gain);
    ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    line(ctx, x, upper.y1 + 4 + 5 * row - 5, x, a.stable ? py(a.doubling) : lower.y0, INK);
    ctx.setLineDash([]);
    // The names of the IPCC's bands come after the lines that cross them, each on a halo of its band's color.
    // Under the dashed line there's room for "best estimate" only on a tall graph; the text below says it.
    text(ctx, 'IPCC: very likely', x0 + 6, py((ipcc.veryLikely[1] + ipcc.likely[1]) / 2),
      { size: 11, baseline: 'middle', halo: SHADE });
    text(ctx, 'likely', x0 + 6, py((ipcc.likely[1] + ipcc.best) / 2), { size: 11, baseline: 'middle', halo: BAND });
    if (py(ipcc.likely[0]) - py(ipcc.best) >= 13) {
      text(ctx, 'best estimate', x0 + 6, py(ipcc.best) + 4, { size: 11, baseline: 'top', halo: BAND });
    }
    // This title comes after the dashed line, which would run through it on a phone.
    text(ctx, 'Warming from doubling CO₂ (°C)', c.narrow ? 6 : x0, lower.y1 - 10,
      { bold: true, color: INK, halo: '#ffffff' });
    if (a.stable) {
      var over = a.doubling > CEILING;
      dot(ctx, x, py(a.doubling), CO2, 6);
      // The number goes below the curve and to the right, where nothing else is drawn.
      if (over) text(ctx, degrees(a.doubling, 1) + ', off the top', x - 10, py(a.doubling) + 16,
        { align: 'right', bold: true, color: INK, halo: '#ffffff' });
      else {
        var room = py(a.doubling) + 27 < lower.y0 - 3;      // near the bottom, it goes above instead
        text(ctx, degrees(a.doubling, 1), x + 10, py(a.doubling) + (room ? 27 : -12),
          { bold: true, color: INK, halo: '#ffffff' });
      }
    }
    if (cursor.feedback === null) return;
    var read = cursor.feedback, xr = px(read);
    ctx.lineWidth = 1; line(ctx, xr, lower.y1, xr, lower.y0, INK);
    if (read < 1) dot(ctx, xr, py(warmingAt(read)), INK, 4);
  }

  function feedbackReadout(a) {
    var gain = cursor.feedback;
    if (gain === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    if (gain >= 1) return 'On the curve: with a total gain of ' + fixed(gain, 2) + ' there\'s no stable climate.';
    var S = M.sensitivity(gain);
    return 'On the curve: a total gain of ' + fixed(gain, 2) + ' makes the climate sensitivity ' + fixed(S, 2) + NB +
      '°C per W/m², ' + fixed(S / M.BASELINE, 1) + ' times the baseline. Doubling CO₂ then warms the world by ' +
      degrees(M.doublingWarming(S, a.scale.co2), 1) + '.';
  }

  /* Where a warming for doubled CO₂ falls in the IPCC's ranges. */
  function againstIpcc(warming) {
    var ipcc = data.ipcc.doubling;
    function range(ends) { return ends[0] + ' to ' + ends[1] + NB + '°C'; }
    if (warming >= ipcc.likely[0] && warming <= ipcc.likely[1]) {
      return 'That\'s inside the IPCC\'s likely range, ' + range(ipcc.likely) + '.';
    }
    if (warming >= ipcc.veryLikely[0] && warming <= ipcc.veryLikely[1]) {
      return 'That\'s outside the IPCC\'s likely range, ' + range(ipcc.likely) + ', and inside its very likely ' +
        'range, ' + range(ipcc.veryLikely) + '.';
    }
    return 'That\'s outside the IPCC\'s very likely range, ' + range(ipcc.veryLikely) + '.';
  }

  function noClimate() {
    return 'At 1 or more, each round of warming is at least as big as the one before, and there\'s no stable ' +
      'climate. Lower one of the gains to see the model run.';
  }

  function unstableWords(a) { return 'The gains add up to ' + fixed(a.gain, 2) + '. ' + noClimate(); }

  function feedbackSummary(a) {
    var g = a.gains;
    var words = 'Water vapor ' + fixed(g.water, 2) + ', vertical mixing ' + fixed(g.mixing, 2) + ', ice and snow ' +
      fixed(g.ice, 2) + ' and clouds ' + fixed(g.clouds, 2) + ' add up to a total gain of ' + fixed(a.gain, 2) + '. ';
    if (!a.stable) return words + noClimate();
    return words + 'That makes the climate sensitivity ' + fixed(a.S, 2) + NB + '°C per W/m², ' +
      fixed(a.S / M.BASELINE, 1) + ' times the baseline of ' + fixed(M.BASELINE, 2) + '. Doubling CO₂ warms the ' +
      'world by ' + degrees(a.doubling, 1) + ' in the end. ' + againstIpcc(a.doubling) + ' Its best estimate is ' +
      data.ipcc.doubling.best + NB + '°C.';
  }

  // ---- 3. Response ----

  /* A list with the same number taken from every value. */
  function less(values, base) { return values.map(function (value) { return value - base; }); }

  /* The measured temperatures: the 95% range as a band, and the best estimate as a line. */
  function drawMeasured(ctx, px, py) {
    var o = data.observed, i;
    ctx.beginPath();
    for (i = 0; i < o.high.length; i++) ctx[i ? 'lineTo' : 'moveTo'](px(o.first + i), py(o.high[i]));
    for (i = o.low.length - 1; i >= 0; i--) ctx.lineTo(px(o.first + i), py(o.low[i]));
    ctx.closePath(); ctx.fillStyle = BAND; ctx.fill();
    curve(ctx, o.anomaly, o.first, px, py, MEASURED, 1.8);
  }

  /* Two graphs that share the years along the bottom: temperatures above, and the energy imbalance below.
   * They're two graphs because they're two kinds of number. */
  function drawResponse(a) {
    var c = prepare($('response-graph')), ctx = c.ctx, o = data.observed, first = a.first;
    var x0 = c.narrow ? 40 : 44, x1 = c.w - (c.narrow ? 12 : 20), room = c.h - 30 - 32 - 50;
    var upper = { x0: x0, x1: x1, y1: 30, y0: 30 + Math.round(room * 0.64) };
    var lower = { x0: x0, x1: x1, y1: upper.y0 + 50, y0: c.h - 32 };
    var T = a.stable ? less(a.past.T, a.base) : [], D = a.stable ? less(a.past.D, a.deepBase) : [];
    var N = a.stable ? a.past.N : [], ipcc = data.ipcc.imbalance;
    plots.response = { x0: x0, x1: x1, from: first, to: o.last };

    // How far the two scales have to reach.
    var low = Math.min.apply(null, o.low.concat(T)), high = Math.max.apply(null, o.high.concat(T));
    low = Math.floor(low * 2) / 2; high = Math.ceil(high * 2) / 2;
    var nLow = Math.min.apply(null, N.concat([-0.5])), nHigh = Math.max.apply(null, N.concat([ipcc.range[1] + 0.2]));
    var gap = roundGap(nHigh - nLow, 4);
    nLow = Math.floor(nLow / gap) * gap; nHigh = Math.ceil(nHigh / gap) * gap;
    function px(year) { return x0 + (year - first) / (o.last - first) * (x1 - x0); }
    function pyT(value) { return upper.y0 - (value - low) / (high - low) * (upper.y0 - upper.y1); }
    function pyN(value) { return lower.y0 - (value - nLow) / (nHigh - nLow) * (lower.y0 - lower.y1); }

    grid(ctx, upper, pyT, low, high, high - low > 4 ? 1 : 0.5);
    grid(ctx, lower, pyN, nLow, nHigh, gap);
    yearMarks(ctx, upper, px, first, o.last, 50, false);
    yearMarks(ctx, lower, px, first, o.last, 50, true);
    text(ctx, c.narrow ? 'Temperature (°C above 1850–1900)' : 'Temperature (°C above the 1850–1900 average)',
      c.narrow ? 6 : x0, upper.y1 - 10, { bold: true, color: INK });
    text(ctx, 'Energy imbalance (W/m²)', c.narrow ? 6 : x0, lower.y1 - 10, { bold: true, color: INK });

    // What was measured: the temperatures, and the imbalance over a few recent years.
    inside(ctx, upper, function () { drawMeasured(ctx, px, pyT); });
    var bx = px(ipcc.first - 0.5), bw = px(ipcc.last + 0.5) - bx;
    ctx.fillStyle = BAND; ctx.fillRect(bx, pyN(ipcc.range[1]), bw, pyN(ipcc.range[0]) - pyN(ipcc.range[1]));
    ctx.lineWidth = 2; line(ctx, bx, pyN(ipcc.best), bx + bw, pyN(ipcc.best), MEASURED);
    // The word goes under the bar, or under the zero line when there's no room between the two. A phone
    // has no room for it: the list above the graph and the text below name the bar there.
    if (!c.narrow) {
      var under = pyN(0) - pyN(ipcc.range[0]) < 24 ? pyN(0) : pyN(ipcc.range[0]);
      text(ctx, 'Measured', bx + bw, under + 5, { align: 'right', baseline: 'top', size: 12, halo: '#ffffff' });
    }

    if (!a.stable) noAnswer(ctx, upper, a);
    inside(ctx, upper, function () {
      curve(ctx, D, first, px, pyT, SMOG, 1.8, [6, 4]);
      curve(ctx, T, first, px, pyT, INK, 2.6);
    });
    inside(ctx, lower, function () { curve(ctx, N, first, px, pyN, INK, 2.2); });

    var year = cursor.response;
    if (year === null) return;
    var x = px(year), i = year - first;
    ctx.lineWidth = 1; line(ctx, x, upper.y1, x, upper.y0, INK); line(ctx, x, lower.y1, x, lower.y0, INK);
    dot(ctx, x, pyT(o.anomaly[year - o.first]), MEASURED);
    if (i >= T.length) return;
    dot(ctx, x, pyT(D[i]), SMOG); dot(ctx, x, pyT(T[i]), INK); dot(ctx, x, pyN(N[i]), INK);
  }

  /* What was measured in one year, with its range. */
  function measuredWords(year) {
    var o = data.observed, i = year - o.first;
    return degrees(o.anomaly[i], 2) + ' (' + fixed(o.low[i], 2) + ' to ' + fixed(o.high[i], 2) + ')';
  }

  function responseReadout(a) {
    var year = cursor.response, i = year - a.first;
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    if (!a.stable) return 'In ' + year + ' the measured temperature was ' + measuredWords(year) + '.';
    if (i >= a.past.T.length) {
      return 'In ' + year + ' the measured temperature was ' + measuredWords(year) + ' above the 1850 to 1900 ' +
        'average. The forcing data stop in ' + data.history.last + ', so the model does too.';
    }
    return 'In ' + year + ' the model\'s surface is ' + degrees(a.past.T[i] - a.base, 2) + ' above its 1850 to ' +
      '1900 average. The measured temperature was ' + measuredWords(year) + '. The model\'s deep ocean is ' +
      degrees(a.past.D[i] - a.deepBase, 2) + ' above its own average, and the energy imbalance is ' +
      watts(a.past.N[i], 2) + '.';
  }

  /* The model's whole sum for the year being read: steps 1 and 5 to 7 on the About tab, one line each. */
  function budget(a) {
    var year = cursor.response, i = year === null ? -1 : year - a.first;
    var on = a.stable && i >= 0 && i < a.past.T.length;
    $('response-budget').hidden = $('response-budget-note').hidden = !on;
    if (!on) return;
    var T = i ? a.past.T[i - 1] : 0, D = i ? a.past.D[i - 1] : 0, N = a.past.N[i], H = a.past.H[i];
    say('response-budget-caption', 'The model\'s sum for ' + year);
    say('budget-f', watts(a.F[i], 2));
    say('budget-t', degrees(T, 3));
    say('budget-paid', watts(T / a.S, 2));
    say('budget-n', watts(N, 2));
    say('budget-d', degrees(D, 3));
    say('budget-h', watts(H, 2));
    say('budget-dt', degrees(M.surfaceWarming(N, H), 3));
    say('budget-dd', degrees(M.deepWarming(H), 3));
    say('response-budget-note', 'The table counts warming from the model\'s start in ' + a.first + '. The graph ' +
      'counts from the model\'s average over 1850 to 1900, which is ' + degrees(Math.abs(a.base), 2) +
      (a.base < 0 ? ' below' : ' above') + ' its start.');
  }

  function responseSummary(a) {
    if (!a.stable) return unstableWords(a);
    var o = data.observed, ipcc = data.ipcc.imbalance;
    return 'With these settings, doubling CO₂ warms the world by ' + degrees(a.doubling, 1) + ' in the end. The ' +
      'model\'s average for 2010 to 2019 is ' + degrees(M.average(a.past.T, a.first, 2010, 2019) - a.base, 2) +
      ' above 1850 to 1900, and the measured average is ' + degrees(M.average(o.anomaly, o.first, 2010, 2019), 2) +
      '. Over 1850 to 2019 the typical difference between the model and the measurements is ' +
      degrees(a.misfit, 2) + '. The model\'s energy imbalance over ' + ipcc.first + ' to ' + ipcc.last + ' averages ' +
      watts(M.average(a.past.N, a.first, ipcc.first, ipcc.last), 2) + '. The measured imbalance is ' +
      fixed(ipcc.best, 2) + ', very likely between ' + fixed(ipcc.range[0], 2) + ' and ' + fixed(ipcc.range[1], 2) + '.';
  }

  // ---- 4. The future ----

  function drawFuture(a) {
    var c = prepare($('future-graph')), ctx = c.ctx, o = data.observed, first = a.first, ipcc = data.ipcc.warming;
    var to = data.scenarios[SCENARIOS[0]].last, join = data.scenarios[SCENARIOS[0]].first;
    var strip = c.narrow ? 42 : 60, names = c.narrow ? 46 : 68;
    var box = { x0: c.narrow ? 30 : 40, x1: c.w - strip - names, y1: 30, y0: c.h - 30 };
    var lines = a.stable ? SCENARIOS.map(function (name) { return less(a.futures[name].T, a.base); }) : [];
    plots.future = { x0: box.x0, x1: box.x1, from: first, to: to };

    var low = Math.floor(Math.min.apply(null, o.low) * 2) / 2, high = 6;
    lines.forEach(function (values) { high = Math.max(high, Math.max.apply(null, values) + 0.2); });
    high = Math.min(Math.ceil(high), 10);
    function px(year) { return box.x0 + (year - first) / (to - first) * (box.x1 - box.x0); }
    function py(value) { return box.y0 - (clamp(value, low - 1, high + 1) - low) / (high - low) * (box.y0 - box.y1); }

    // The years the bars at the right are averages of.
    ctx.fillStyle = SHADE;
    ctx.fillRect(px(ipcc.first), box.y1, px(ipcc.last) - px(ipcc.first), box.y0 - box.y1);
    grid(ctx, box, py, low, high, high > 7 ? 2 : 1);
    yearMarks(ctx, box, px, first, to, c.narrow ? 100 : 50, true);
    text(ctx, c.narrow ? 'Temperature (°C above 1850–1900)' : 'Temperature (°C above the 1850–1900 average)',
      c.narrow ? 6 : box.x0, box.y1 - 10, { bold: true, color: INK });
    if (!c.narrow) {
      text(ctx, ipcc.first + '–' + ipcc.last, px(ipcc.last) - 4, box.y0 - 7, { align: 'right', size: 11 });
    }

    // The IPCC's own answers: a bar for each scenario's very likely range, and a mark at its best estimate.
    var bars = box.x1 + (c.narrow ? 9 : 12), apart = c.narrow ? 7 : 10;
    // On a phone the graph's title runs the whole width, so the word goes under the bars.
    if (c.narrow) text(ctx, 'IPCC', box.x1 + 19, box.y0 + 19, { size: 11, bold: true, color: INK });
    else text(ctx, 'IPCC', bars + 2 * apart, box.y1 - 10, { align: 'center', size: 11, bold: true, color: INK });
    SCENARIOS.forEach(function (name, at) {
      var x = bars + at * apart, range = ipcc[name];
      ctx.lineWidth = c.narrow ? 3 : 4; ctx.lineCap = 'round';
      line(ctx, x, py(range[1]), x, py(range[2]), SCENARIO_COLOR[name]);
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, py(range[0]) - 1.5, 8, 3);
      ctx.fillStyle = INK; ctx.fillRect(x - 4, py(range[0]) - 0.75, 8, 1.5);
    });

    inside(ctx, box, function () { drawMeasured(ctx, px, py); });
    var from = join - first - 1;      // each scenario's line starts from the last year they share
    if (!a.stable) noAnswer(ctx, box, a);
    else inside(ctx, box, function () {
      SCENARIOS.forEach(function (name, at) {
        curve(ctx, lines[at], first, px, py, SCENARIO_COLOR[name], 2.2, null, from);
      });
      curve(ctx, lines[0].slice(0, from + 1), first, px, py, INK, 2.6);
    });
    if (a.stable) endNames(ctx, SCENARIOS.map(function (name, at) {
      // Two lines that leave the top of the graph end at the same height: the warmer one is named first.
      var label = data.scenarios[name].label, end = lines[at][to - first];
      return { name: c.narrow ? label.replace('SSP', '') : label, y: py(end) - Math.min(end, 1000) * 1e-6,
               color: SCENARIO_COLOR[name], width: 3, bold: false };
    }), box.x1 + strip - 6, box.y1 + 6, box.y0 - 4, c.narrow ? 11 : 12);

    var year = cursor.future;
    if (year === null) return;
    var x = px(year), i = year - first;
    ctx.lineWidth = 1; line(ctx, x, box.y1, x, box.y0, INK);
    if (year <= o.last) dot(ctx, x, py(o.anomaly[year - o.first]), MEASURED);
    if (!a.stable) return;
    if (year < join) dot(ctx, x, py(lines[0][i]), INK);
    else SCENARIOS.forEach(function (name, at) { dot(ctx, x, py(lines[at][i]), SCENARIO_COLOR[name]); });
  }

  function futureReadout(a) {
    var year = cursor.future, o = data.observed, i = year - a.first;
    if (year === null) return 'Move over the graph, or select it and use the arrow keys, to read values.';
    var measured = year <= o.last ? ' The measured temperature was ' + measuredWords(year) + '.' : '';
    if (!a.stable) {
      return measured ? 'In ' + year + ' the measured temperature was ' + measuredWords(year) + '.' :
        'There\'s nothing to read in ' + year + ': the model has no run with these gains.';
    }
    if (year < data.scenarios[SCENARIOS[0]].first) {
      return 'In ' + year + ' the model is ' + degrees(a.futures[SCENARIOS[0]].T[i] - a.base, 2) +
        ' above its 1850 to 1900 average.' + measured;
    }
    return 'In ' + year + ', above the 1850 to 1900 average: ' + SCENARIOS.map(function (name) {
      return data.scenarios[name].label + ' ' + degrees(a.futures[name].T[i] - a.base, 2);
    }).join(', ') + '.' + measured;
  }

  function futureSummary(a) {
    if (!a.stable) return unstableWords(a);
    var ipcc = data.ipcc.warming;
    return 'With these settings, doubling CO₂ warms the world by ' + degrees(a.doubling, 1) + ' in the end. ' +
      'Average warming for ' + ipcc.first + ' to ' + ipcc.last + ', above 1850 to 1900, from the model and then ' +
      'from the IPCC with its very likely range. ' + SCENARIOS.map(function (name) {
        var mine = M.average(a.futures[name].T, a.first, ipcc.first, ipcc.last) - a.base, theirs = ipcc[name];
        return data.scenarios[name].label + ': ' + degrees(mine, 1) + ', and ' + fixed(theirs[0], 1) + ' (' +
          fixed(theirs[1], 1) + ' to ' + fixed(theirs[2], 1) + ').';
      }).join(' ');
  }

  // ---- The words, and the whole page ----

  /* Change the words only when they're different, so a screen reader isn't told the same thing twice. */
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  /* The headings of the sets of controls give their settings, for when a set is folded away. */
  function groupWords(a) {
    say('forcing-now', 'CO₂ ' + state.co2 + '%, methane ' + state.methane + '%, smog ' + state.smog + '%');
    say('feedback-now', 'They add up to ' + fixed(a.gain, 2));
    say('ocean-now', fixed(state.ocean, 2) + NB + 'W/m² per °C');
  }

  function draw() {
    if (!data || state.view === 'about') return;
    var a = answer();
    groupWords(a);
    forcingHints(a);
    if (state.view === 'forcing') {
      drawForcing(a);
      say('forcing-readout', forcingReadout(a));
      say('forcing-summary', forcingSummary(a));
    } else if (state.view === 'feedback') {
      drawFeedback(a);
      say('feedback-readout', feedbackReadout(a));
      say('feedback-summary', feedbackSummary(a));
    } else if (state.view === 'response') {
      drawResponse(a);
      say('response-readout', responseReadout(a));
      budget(a);
      say('response-summary', responseSummary(a));
    } else {
      drawFuture(a);
      say('future-readout', futureReadout(a));
      say('future-summary', futureSummary(a));
    }
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search);
    SLIDERS.forEach(function (key) {
      var number = parseFloat(params.get(key)), box = $(key);
      if (!isFinite(number)) return;
      state[key] = +clamp(Math.round(number / +box.step) * +box.step, +box.min, +box.max).toFixed(4);
    });
    if (params.get('tie') === '0') state.tie = 0;
    if (state.tie) state.mixing = hundredths(M.PAIR - state.water);
    if (VIEWS.indexOf(params.get('view')) >= 0) state.view = params.get('view');
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
    requestAnimationFrame(function () { pending = false; saveToAddress(); draw(); });
  }

  function selectView(view, focus) {
    state.view = view;
    arrange(view);
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
    var reading = state.view === 'about' && location.hash.length > 1;
    var place = reading ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
  }

  /* What a place along a graph stands for: a year, or on the second view a gain to the nearest hundredth. */
  function reading(view, along) {
    var plot = plots[view], value = plot.from + clamp(along, 0, 1) * (plot.to - plot.from);
    return view === 'feedback' ? hundredths(value) : Math.round(value);
  }

  /* Read a graph at the pointer, or move along it with the keys. */
  function point(view) {
    return function (event) {
      var plot = plots[view];
      if (!plot) return;
      var box = $(view + '-graph').getBoundingClientRect();
      cursor[view] = reading(view, (event.clientX - box.left - plot.x0) / (plot.x1 - plot.x0));
      changed();
    };
  }

  function keys(view) {
    return function (event) {
      var plot = plots[view], by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!plot || (by === undefined && event.key !== 'Home' && event.key !== 'End')) return;
      event.preventDefault();
      var gains = view === 'feedback', step = gains ? 0.01 : 1, at;
      // The first press reads the reader's own gain, or the last year the model has.
      if (cursor[view] === null) {
        at = gains ? clamp(answer().gain, plot.from, plot.to) : Math.min(plot.to, lastYear(view));
      } else {
        at = cursor[view] + by * step * (event.shiftKey ? 10 : 1);
      }
      if (event.key === 'Home') at = plot.from;
      if (event.key === 'End') at = plot.to;
      cursor[view] = reading(view, (at - plot.from) / (plot.to - plot.from));
      changed();
    };
  }

  function lastYear(view) {
    return view === 'future' ? data.scenarios[SCENARIOS[0]].last : data.history.last;
  }

  function start() {
    SLIDERS.forEach(function (key) { show[key] = pair(key); });
    readAddress();

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.next button'), function (button) {
      button.addEventListener('click', function () { selectView(button.dataset.view, true); });
    });
    GROUPS.forEach(function (name) {
      var group = $('group-' + name);
      group.querySelector('summary').addEventListener('click', function () {
        if (SHOWN[state.view] && SHOWN[state.view].length > 1) chosen[name] = !group.open;
      });
    });
    $('tie').addEventListener('change', function () {
      state.tie = this.checked ? 1 : 0;
      if (state.tie) state.mixing = hundredths(M.PAIR - state.water);
      showAll();
      changed();
    });
    $('reset').addEventListener('click', function () {
      Object.keys(DEFAULTS).forEach(function (key) { if (key !== 'view') state[key] = DEFAULTS[key]; });
      showAll();
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    VIEWS.slice(0, 4).forEach(function (view) {
      var canvas = $(view + '-graph');
      canvas.addEventListener('pointermove', point(view));
      canvas.addEventListener('pointerdown', point(view));
      canvas.addEventListener('keydown', keys(view));
    });
    window.addEventListener('resize', changed);

    showAll();
    selectView(state.view);
    goToAddressPlace();

    fetch('data.json').then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    }).then(function (loaded) {
      data = loaded;
      limits = forcingLimits();
      $('loading').hidden = true;
      changed();
    }).catch(function () {
      $('loading').textContent = 'The data didn\'t load. Please reload the page.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
