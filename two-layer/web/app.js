/* Two-layer model: the page. model.js is the science. This file is the controls, the two drawings and the
 * words under them. It works out nothing about the layers itself: every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.TwoLayer;
  var VIEWS = ['flows', 'profile', 'about'];
  // What the page shows when the address says nothing. The two shares and the albedo are in percent.
  var DEFAULTS = { view: 'flows', upper: 75, lower: 75, fromground: 103, fromlower: 86, sun: 1361, albedo: 30 };
  var CONTROLS = ['upper', 'lower', 'fromground', 'fromlower', 'sun', 'albedo'];
  var EARTH = 288;      // kelvins: about the average temperature of the Earth's surface (Chapter 3)
  var INK = '#152e3d', TICK = '#394b57', GRID = '#e3dfd3', STILL = '#5f6d75';
  var SUNLIGHT = '#a85400', EARTHLIGHT = '#0072b2', AIR = '#99306f';
  var LAYER = '#cfe5f3', LAYER_EDGE = '#3b6e96', LAYER_INK = '#173f5f', GROUND = '#1f2023';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';     // a space that keeps a number and its unit on one line
  var BAR = 22, SLAB = 46, EDGE = 6;   // a layer's thickness, the ground's, and the drawing's margin, in pixels

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
  var show = {};        // one function for each control: put the state's number in it

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  /* A whole number with a comma in the thousands, a real minus sign, and no sign at all on a zero. */
  function whole(x) { return minus((Math.round(x) || 0).toLocaleString('en-US')); }

  // ---- The controls ----

  /* The Sunlight the ground takes in, and the most whole W/m² that rising air can carry from the ground. The
   * tiny amount added keeps a Q that should be a whole number, and comes out a hair under, from losing 1. */
  function sunlightIn() { return M.absorbed(state.sun, state.albedo / 100); }
  function mostFromGround() { return Math.floor(sunlightIn() + 1e-9); }

  /* Keep the rising air inside the model's limits: from the ground, no more than the Sunlight the ground takes
   * in, and from the lower layer, no more than from the ground. The two sliders stop at the limits. */
  function settle() {
    var most = mostFromGround();
    state.fromground = clamp(state.fromground, 0, most);
    state.fromlower = clamp(state.fromlower, 0, state.fromground);
    [['fromground', most], ['fromlower', state.fromground]].forEach(function (limit) {
      $(limit[0]).max = $(limit[0] + '-range').max = limit[1];
    });
  }

  /* A slider and a number box that hold the same whole number. */
  function pair(key) {
    var number = $(key), range = $(key + '-range');
    function put() { number.value = range.value = state[key]; }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      state[key] = clamp(Math.round(value), +number.min, +number.max);
      settle();
      showAll();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* Put the state into every control. */
  function showAll() { Object.keys(show).forEach(function (key) { show[key](); }); }

  /* The model's answer for the controls as they stand, or for the same air with other flows of rising air. */
  function answerFor(fromGround, fromLower) {
    var most = Math.min(fromGround, sunlightIn());
    return M.column(state.sun, state.albedo / 100, state.upper / 100, state.lower / 100,
      most, Math.min(fromLower, most));
  }

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

  /* What to say when a layer comes out warmer than the level under it. Still air never does this, so it's
   * always the rising air that was asked for. */
  function upsideDown(answer) {
    var ground = Math.round(answer.ground.kelvin), lower = Math.round(answer.lower.kelvin);
    var upper = Math.round(answer.upper.kelvin), which = [];
    if (lower > ground) which.push('the lower layer is warmer than the ground');
    if (upper > lower) which.push('the upper layer is warmer than the lower layer');
    if (!which.length) return '';
    return ' Here ' + which.join(', and ') + '. Real air wouldn\'t rise into warmer air above it, so rising ' +
      'air couldn\'t carry this much heat. The model carries what you ask for.';
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
  function head(ctx, x, y, way, color, size) {
    var half = (size || 11) / 2, length = size ? size - 1 : 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - half, y - way * length); ctx.lineTo(x + half, y - way * length);
    ctx.closePath(); ctx.fill();
  }

  /* Sunlight: a straight arrow down from y0 to y1. */
  function sunArrow(ctx, x, y0, y1) {
    ctx.strokeStyle = SUNLIGHT; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 - 8); ctx.stroke();
    head(ctx, x, y1, 1, SUNLIGHT);
  }

  /* Earthlight: a wavy arrow from y0 to y1, up or down. The wave dies away at both ends, so the arrow
   * starts and finishes on its own line. */
  function earthArrow(ctx, x, y0, y1) {
    var way = y1 > y0 ? 1 : -1, length = Math.abs(y1 - y0) - 8;
    ctx.strokeStyle = EARTHLIGHT; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    for (var t = 0; t <= length; t += 1) {
      var fade = clamp(Math.min(t, length - t - 4) / 9, 0, 1);
      var across = 4.5 * fade * Math.sin(2 * Math.PI * t / 24);
      if (t === 0) ctx.moveTo(x + across, y0 + way * t); else ctx.lineTo(x + across, y0 + way * t);
    }
    ctx.stroke();
    head(ctx, x, y1, way, EARTHLIGHT);
  }

  /* Heat carried by rising air: a broad dashed arrow up from y0 to y1. */
  function airArrow(ctx, x, y0, y1) {
    ctx.strokeStyle = AIR; ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.setLineDash([7, 4]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 + 12); ctx.stroke();
    ctx.setLineDash([]);
    head(ctx, x, y1, -1, AIR, 15);
  }

  /* Earthlight on its way through a layer: a dotted line from one side of the layer to the other. */
  function through(ctx, x, y0, y1) {
    ctx.strokeStyle = EARTHLIGHT; ctx.lineWidth = 1.6; ctx.lineCap = 'butt'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* The flows: space at the top, then the upper layer, the lower layer and the ground. */
  function drawFlows(answer) {
    var area = prepare($('flows')), ctx = area.ctx;
    // The layers are on the left, and each one's name and temperature are to its right. On a phone they take
    // four short lines, so the layers can be wider.
    var narrow = area.w < 480, labels = narrow ? 58 : 132;
    var width = Math.min(520, area.w - labels - 2 * EDGE);
    var x0 = Math.max(EDGE, (area.w - width - labels) / 2), x1 = x0 + width;
    var ground = area.h - EDGE - SLAB, space = 92;
    var gap = (ground - EDGE - space - 2 * BAR) / 2;
    var upper = EDGE + space, lower = upper + BAR + gap;
    // One column for each kind of arrow. The three on the right are the Earthlight of one level each.
    var at = narrow ? [0.07, 0.27, 0.48, 0.7, 0.92] : [0.08, 0.26, 0.46, 0.67, 0.88];
    var sunAt = x0 + width * at[0], airAt = x0 + width * at[1];
    var groundAt = x0 + width * at[2], lowerAt = x0 + width * at[3], upperAt = x0 + width * at[4];
    // The three gaps, from space down: where each starts and stops.
    var top = { y0: EDGE, y1: upper }, between = { y0: upper + BAR, y1: lower };
    var bottom = { y0: lower + BAR, y1: ground };
    var size = narrow ? 12 : 13;

    // The layers and the ground. The more of the Earthlight a layer absorbs, the darker it's drawn.
    [[upper, answer.upper.share], [lower, answer.lower.share]].forEach(function (layer) {
      ctx.globalAlpha = 0.2 + 0.8 * layer[1];
      ctx.fillStyle = LAYER; ctx.fillRect(x0, layer[0], width, BAR);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = LAYER_EDGE; ctx.lineWidth = 1.2;
      ctx.strokeRect(x0 + 0.5, layer[0] + 0.5, width - 1, BAR - 1);
    });
    ctx.fillStyle = GROUND; ctx.fillRect(x0, ground, width, SLAB);

    /* One arrow in a gap, with its number to its left. Nothing is drawn for a flow that prints as 0. */
    function arrow(kind, x, where, way, amount) {
      if (Math.round(amount) <= 0) return false;
      var from = way < 0 ? where.y1 - 2 : where.y0 + 2;
      var to = way < 0 ? where.y0 + (where === top ? 3 : 2) : where.y1 - 2;
      var color = kind === 'air' ? AIR : EARTHLIGHT;
      if (kind === 'air') airArrow(ctx, x, from, to); else earthArrow(ctx, x, from, to);
      text(ctx, whole(amount), x - (kind === 'air' ? 12 : 10), (where.y0 + where.y1) / 2 + 4.5,
        { bold: true, size: size, align: 'right', color: color, halo: '#ffffff' });
      return true;
    }

    // Sunlight goes straight down through both layers.
    sunArrow(ctx, sunAt, EDGE + 2, ground - 1);
    text(ctx, 'Sunlight', sunAt + 9, EDGE + 18, { bold: true, size: size, color: SUNLIGHT, halo: '#ffffff' });
    text(ctx, whole(answer.absorbed), sunAt + 9, EDGE + 35, { bold: true, size: size, color: SUNLIGHT, halo: '#ffffff' });

    // Rising air: up from the ground, and on up from the lower layer.
    arrow('air', airAt, bottom, -1, answer.lower.fromAir);
    arrow('air', airAt, between, -1, answer.upper.fromAir);

    // The ground's Earthlight: up to the lower layer, through it, and through the upper layer to space.
    arrow('earth', groundAt, bottom, -1, answer.ground.glow);
    if (arrow('earth', groundAt, between, -1, answer.lower.passes.ground)) through(ctx, groundAt, lower + BAR, lower);
    if (arrow('earth', groundAt, top, -1, answer.toSpace.ground)) through(ctx, groundAt, upper + BAR, upper);

    // The lower layer's: down to the ground, and up to the upper layer and through it to space.
    arrow('earth', lowerAt, bottom, 1, answer.ground.fromLower);
    arrow('earth', lowerAt, between, -1, answer.lower.glow);
    if (arrow('earth', lowerAt, top, -1, answer.toSpace.lower)) through(ctx, lowerAt, upper + BAR, upper);

    // The upper layer's: up to space, and down to the lower layer and through it to the ground.
    arrow('earth', upperAt, top, -1, answer.toSpace.upper);
    arrow('earth', upperAt, between, 1, answer.upper.glow);
    if (arrow('earth', upperAt, bottom, 1, answer.ground.fromUpper)) through(ctx, upperAt, lower, lower + BAR);

    // To the right: what leaves for space, and each layer's name and temperature.
    var out = (top.y0 + top.y1) / 2;
    text(ctx, 'To space', x1 + (narrow ? 5 : 9), out - 3, { bold: true, size: narrow ? 11 : 13, color: EARTHLIGHT });
    text(ctx, narrow ? whole(answer.toSpace.all) : flow(answer.toSpace.all), x1 + (narrow ? 5 : 9), out + 13,
      { bold: true, size: size, color: EARTHLIGHT });
    [['Upper', upper, answer.upper.kelvin], ['Lower', lower, answer.lower.kelvin]].forEach(function (layer) {
      var y = layer[1] + BAR / 2, t = scales(layer[2]);
      if (narrow) {
        text(ctx, layer[0], x1 + 5, y - 21, { bold: true, size: 11, baseline: 'middle', color: LAYER_INK });
        text(ctx, t.k, x1 + 5, y - 6, { bold: true, baseline: 'middle', color: INK });
        text(ctx, t.c, x1 + 5, y + 9, { size: 12, baseline: 'middle' });
        text(ctx, t.f, x1 + 5, y + 23, { size: 12, baseline: 'middle' });
      } else {
        text(ctx, layer[0] + ' layer', x1 + 9, y - 17, { bold: true, size: 12, baseline: 'middle', color: LAYER_INK });
        text(ctx, t.k, x1 + 9, y + 1, { bold: true, size: 15, baseline: 'middle', color: INK });
        text(ctx, t.c + ', ' + t.f, x1 + 9, y + 18, { size: 12, baseline: 'middle' });
      }
    });

    // The ground's temperature, written on the ground. It takes two lines where one won't fit.
    var g = scales(answer.ground.kelvin), middle = ground + SLAB / 2;
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

  /* The temperatures: the three levels up the side, temperature along the bottom. The solid line is the
   * model's answer, and the dashed line is the same air with no heat carried by rising air. */
  function drawProfile(answer, still) {
    var area = prepare($('profile')), ctx = area.ctx;
    var narrow = area.w < 480;
    var left = narrow ? 52 : 96, right = 20, top = 30, bottom = 46;
    var plotW = area.w - left - right, plotH = area.h - top - bottom;
    var rows = [
      { name: narrow ? 'Upper' : 'Upper layer', y: top + plotH * 0.16, now: answer.upper.kelvin, still: still.upper.kelvin },
      { name: narrow ? 'Lower' : 'Lower layer', y: top + plotH * 0.5, now: answer.lower.kelvin, still: still.lower.kelvin },
      { name: 'Ground', y: top + plotH * 0.84, now: answer.ground.kelvin, still: still.ground.kelvin }
    ];
    // The scale runs from 200 to 340 K, and wider only when a temperature falls outside that. An eighth of the
    // width is kept clear at each end, so a number has room beside its dot.
    var all = [];
    rows.forEach(function (row) { all.push(row.now, row.still); });
    var least = Math.min.apply(null, all), most = Math.max.apply(null, all);
    var room = 0.12 * (Math.max(340, most) - Math.min(200, least));
    var lo = Math.min(200, 20 * Math.floor((least - room) / 20));
    var hi = Math.max(340, 20 * Math.ceil((most + room) / 20));
    function x(kelvin) { return left + plotW * (kelvin - lo) / (hi - lo); }
    var step = [20, 40, 50, 100, 200].filter(function (s) { return plotW * s / (hi - lo) >= 46; })[0] || 200;

    // The levels, as pale bands: the two layers and the ground.
    rows.forEach(function (row, at) {
      ctx.globalAlpha = at === 2 ? 0.14 : 0.55;
      ctx.fillStyle = at === 2 ? GROUND : LAYER;
      ctx.fillRect(left, row.y - 11, plotW, 22);
      ctx.globalAlpha = 1;
      text(ctx, row.name, left - 8, row.y, { bold: true, size: narrow ? 12 : 13, align: 'right', baseline: 'middle', color: INK });
    });

    // The temperature scale.
    ctx.lineWidth = 1; ctx.setLineDash([]);
    for (var k = Math.ceil(lo / step) * step; k <= hi; k += step) {
      ctx.strokeStyle = GRID;
      ctx.beginPath(); ctx.moveTo(Math.round(x(k)) + 0.5, top); ctx.lineTo(Math.round(x(k)) + 0.5, top + plotH); ctx.stroke();
      text(ctx, whole(k), x(k), top + plotH + 17, { size: 12, align: 'center' });
    }
    ctx.strokeStyle = TICK;
    ctx.beginPath(); ctx.moveTo(left, top + plotH + 0.5); ctx.lineTo(left + plotW, top + plotH + 0.5); ctx.stroke();
    text(ctx, 'Temperature (K)', left + plotW / 2, top + plotH + 37, { size: 12, align: 'center' });

    // About the average temperature of the Earth's surface.
    ctx.strokeStyle = TICK; ctx.lineWidth = 1.2; ctx.setLineDash([1, 3]);
    ctx.beginPath(); ctx.moveTo(x(EARTH), top - 4); ctx.lineTo(x(EARTH), top + plotH); ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, narrow ? '288' + NB + 'K' : 'The Earth\'s surface, about 288' + NB + 'K', x(EARTH), top - 10,
      { size: 12, align: 'center' });

    function line(key, color, widthOfLine, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = widthOfLine; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.setLineDash(dash);
      ctx.beginPath();
      rows.forEach(function (row, at) { if (at) ctx.lineTo(x(row[key]), row.y); else ctx.moveTo(x(row[key]), row.y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Still air first, so the answer is drawn over it.
    line('still', STILL, 1.8, [5, 4]);
    rows.forEach(function (row) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = STILL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x(row.still), row.y, 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
    line('now', INK, 2.6, []);
    rows.forEach(function (row, at) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x(row.now), row.y, 5, 0, 2 * Math.PI); ctx.fill();
      // Each temperature, beside its dot, on the side that keeps it off the lines. Next to a still-air dot
      // it goes on the other side from that. Otherwise it goes on the other side from the levels above and
      // below, which is where the solid line runs.
      var apart = x(row.still) - x(row.now), others = 0;
      [rows[at - 1], rows[at + 1]].forEach(function (other) {
        if (other) others += other.now > row.now ? 1 : other.now < row.now ? -1 : 0;
      });
      var toLeft = Math.abs(apart) >= 3 && Math.abs(apart) < 70 ? apart > 0 : others ? others > 0 : apart > 0;
      if (x(row.now) < left + 52) toLeft = false;
      if (x(row.now) > left + plotW - 52) toLeft = true;
      text(ctx, scales(row.now).k, x(row.now) + (toLeft ? -12 : 12), row.y + 0.5,
        { bold: true, align: toLeft ? 'right' : 'left', baseline: 'middle', color: INK, halo: '#ffffff' });
    });
  }

  // ---- The words under the drawings ----

  function flowsSummary(answer) {
    var out = answer.toSpace;
    return 'The ground settles at ' + threeWays(answer.ground.kelvin) + ', the lower layer at ' +
      scales(answer.lower.kelvin).k + ' and the upper layer at ' + scales(answer.upper.kelvin).k + '. ' +
      flow(out.all) + ' of Earthlight leaves the top: ' + whole(out.ground) + ' straight from the ground, ' +
      whole(out.lower) + ' from the lower layer and ' + whole(out.upper) + ' from the upper layer.' +
      upsideDown(answer);
  }

  /* How the stirring has moved one level, in whole kelvins. */
  function moved(name, now, still) {
    var change = Math.round(now) - Math.round(still);
    if (!change) return 'leaves ' + name + ' where it was';
    return (change < 0 ? 'cools ' : 'warms ') + name + ' by ' + whole(Math.abs(change)) + NB + 'K';
  }

  function profileSummary(answer, still) {
    var words = 'The ground is at ' + threeWays(answer.ground.kelvin) + ', the lower layer at ' +
      threeWays(answer.lower.kelvin) + ' and the upper layer at ' + threeWays(answer.upper.kelvin) + '. ';
    if (!state.fromground) return words + 'No heat is carried by rising air, so the two lines are the same.';
    return words + 'With no heat carried by rising air, the ground would be at ' + scales(still.ground.kelvin).k +
      '. The stirring ' + moved('the ground', answer.ground.kelvin, still.ground.kelvin) + ', ' +
      moved('the lower layer', answer.lower.kelvin, still.lower.kelvin) + ' and ' +
      moved('the upper layer', answer.upper.kelvin, still.upper.kelvin) + '.' + upsideDown(answer);
  }

  /* The table: one row for each level, from the upper layer down to the ground. */
  function budgets(answer) {
    var body = $('levels-rows'), up = answer.upper, low = answer.lower, ground = answer.ground;
    var rows = [{
      name: 'Upper layer', kelvin: up.kelvin,
      takes: whole(up.fromGround) + ' from the ground, ' + whole(up.fromLower) + ' from the lower layer, ' +
        whole(up.fromAir) + ' from rising air',
      gives: whole(up.glow) + ' up to space, ' + whole(up.glow) + ' down'
    }, {
      name: 'Lower layer', kelvin: low.kelvin,
      takes: whole(low.fromGround) + ' from the ground, ' + whole(low.fromUpper) + ' from the upper layer, ' +
        whole(low.fromAir) + ' from rising air',
      gives: whole(low.glow) + ' up, ' + whole(low.glow) + ' down, ' + whole(low.toAir) + ' to rising air'
    }, {
      name: 'Ground', kelvin: ground.kelvin, ground: true,
      takes: whole(ground.sunlight) + ' of Sunlight, ' + whole(ground.fromLower) + ' from the lower layer, ' +
        whole(ground.fromUpper) + ' from the upper layer',
      gives: whole(ground.glow) + ' up, ' + whole(ground.toAir) + ' to rising air'
    }];
    var signature = JSON.stringify(rows);
    if (body.dataset.rows === signature) return;
    body.dataset.rows = signature;
    body.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr'), th = document.createElement('th');
      if (row.ground) tr.className = 'ground';
      th.scope = 'row'; th.textContent = row.name; tr.appendChild(th);
      [threeWays(row.kelvin), row.takes, row.gives].forEach(function (words) {
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
    say('fromground-hint', 'This stands for warm air rising and for water that evaporates and then condenses ' +
      'higher up. It stops at ' + flow(mostFromGround()) + ', all the Sunlight the ground takes in.');
    say('fromlower-hint', state.fromground ?
      'It stops at ' + flow(state.fromground) + ', what rising air brings up from the ground.' :
      'Rising air brings nothing up from the ground, so there\'s nothing to carry on.');
    if (state.view === 'about') return;
    var answer = answerFor(state.fromground, state.fromlower), still = answerFor(0, 0);
    if (state.view === 'flows') drawFlows(answer); else drawProfile(answer, still);
    say('flows-summary', flowsSummary(answer));
    say('profile-summary', profileSummary(answer, still));
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

  /* The two drawings share the controls, so the controls stay put when the view changes. The About tab
   * takes the place of both. */
  function selectView(view, focus) {
    state.view = view;
    $('work').hidden = view === 'about';
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

  /* Set some of the controls, as a button does. */
  function set(values) {
    Object.keys(values).forEach(function (key) { state[key] = values[key]; });
    settle();
    showAll();
    changed();
  }

  function start() {
    readAddress();
    settle();
    CONTROLS.forEach(function (key) { show[key] = pair(key); });

    VIEWS.forEach(function (name, at) {
      $('tab-' + name).addEventListener('click', function () { selectView(name); });
      $('tab-' + name).addEventListener('keydown', function (event) {
        var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    $('preset-panes').addEventListener('click', function () {
      set({ upper: 100, lower: 100, fromground: 0, fromlower: 0 });
    });
    $('preset-leaky').addEventListener('click', function () {
      set({ upper: 75, lower: 75, fromground: 0, fromlower: 0 });
    });
    $('reset').addEventListener('click', function () {
      var values = {};
      CONTROLS.forEach(function (key) { values[key] = DEFAULTS[key]; });
      set(values);
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
