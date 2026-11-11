/* Milankovitch model: the page. The maths is in model.js. */
(function () {
  'use strict';
  var M = window.Milankovitch, RAD = M.RAD;
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', SECOND = '#5f6d75', GRID = '#e7edf0';
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
  var BLUE_RED = ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'];
  var VIEWS = ['timeseries', 'compare', 'sensitivity', 'about'];
  var DEFAULTS = { view: 'timeseries', start: -400, len: 400, t1: 0, t2: -21,
    e: M.PRESENT.ecc, tilt: M.PRESENT.obl / RAD, peri: M.PRESENT.peri / RAD };
  var state = {}, orbit = null, series = null, cursor = null, mapLayouts = {};
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- small helpers ---------- */

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function minus(text) { return text.replace('-', '−'); }
  function fixed(x, digits) { return minus(x.toFixed(digits)); }
  function signed(x, digits) { return (x > 0 ? '+' : '') + fixed(x, digits); }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }

  function timeText(kyr) {
    if (kyr === 0) return 'today';
    var years = Math.abs(kyr) * 1000;
    var amount = years >= 1e6 ? (years / 1e6).toFixed(3).replace(/\.?0+$/, '') + ' million years' : commas(years) + ' years';
    return amount + (kyr < 0 ? ' ago' : ' from now');
  }
  function capital(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  function niceStep(span, count) {
    var raw = span / Math.max(1, count), power = Math.pow(10, Math.floor(Math.log10(raw))), unit = raw / power;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  }
  function ticks(lo, hi, count) {
    var step = niceStep(hi - lo, count), out = [];
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { values: out, step: step };
  }
  function decimals(step) { return Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); }

  function hex(color) { return [1, 3, 5].map(function (i) { return parseInt(color.substr(i, 2), 16); }); }
  function ramp(colors) {
    var stops = colors.map(hex);
    return function (u) {
      u = clamp(u, 0, 1) * (stops.length - 1);
      var i = Math.min(stops.length - 2, Math.floor(u)), f = u - i, a = stops[i], b = stops[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
  }
  var sequential = ramp(VIRIDIS), diverging = ramp(BLUE_RED);

  /* A canvas sized to its box, sharp on high-density screens. */
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
    ctx.fillStyle = options.color || TICK;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillText(string, x, y);
  }

  /* ---------- controls ---------- */

  /* A slider and a number box that show the same value. */
  function pair(id, key, digits) {
    var number = $(id), range = $(id + '-range');
    function show() { number.value = state[key].toFixed(digits); range.value = state[key]; }
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { show(); return; }
      state[key] = clamp(value, parseFloat(number.min), parseFloat(number.max));
      if (source === range) number.value = state[key].toFixed(digits); else range.value = state[key];
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); show(); });
    return show;
  }
  var shows = [];
  function showAll() { shows.forEach(function (show) { show(); }); }

  function selectView(view, focus) {
    state.view = view;
    VIEWS.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + name).hidden = !on || (!orbit && name !== 'about');
      if (on && focus) tab.focus();
    });
    changed();
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] !== DEFAULTS[key]) parts.push(key + '=' + encodeURIComponent(typeof state[key] === 'number' ? +state[key].toFixed(4) : state[key]));
    });
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    /* On the About tab the address keeps its #place, so a link can point at one section. */
    try { history.replaceState(null, '', query + (state.view === 'about' ? location.hash : '')); } catch (error) { /* some embedded pages can't */ }
    $('open-link').href = '?' + parts.filter(function (p) { return p !== 'embed=1'; }).join('&');
  }
  function readAddress() {
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      state[key] = DEFAULTS[key];
      if (!params.has(key)) return;
      if (key === 'view') { if (VIEWS.indexOf(params.get(key)) >= 0) state.view = params.get(key); return; }
      var value = parseFloat(params.get(key));
      if (isFinite(value)) state[key] = value;
    });
    state.start = clamp(state.start, -20000, 10000); state.len = clamp(state.len, 10, 10000);
    state.t1 = clamp(Math.round(state.t1), -1000, 1000); state.t2 = clamp(Math.round(state.t2), -1000, 1000);
    state.e = clamp(state.e, 0, 0.06); state.tilt = clamp(state.tilt, 22, 24.6); state.peri = clamp(state.peri, 0, 360);
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; saveToAddress(); draw(); });
  }
  function draw() {
    if (!orbit) return;
    if (state.view === 'timeseries') drawTimeseries();
    if (state.view === 'compare') drawCompare();
    if (state.view === 'sensitivity') drawSensitivity();
  }

  /* ---------- view 1: through time ---------- */

  var PANELS = [
    { key: 'ecc', title: 'Eccentricity: how stretched the orbit is', brief: 'Eccentricity', color: '#c24f00', digits: 4, unit: '' },
    { key: 'tilt', title: 'Tilt of Earth\'s axis (degrees)', brief: 'Tilt (degrees)', color: '#007a5a', digits: 2, unit: '°' },
    { key: 'prec', title: 'Precession index: above zero, Earth is far from the Sun in northern summer', brief: 'Precession index', color: '#0072b2', digits: 4, unit: '' },
    { key: 'sun', title: 'Mid-July Sunlight at 65 °N (W/m²)', brief: 'Mid-July Sunlight, 65 °N (W/m²)', color: '#b35c00', digits: 1, unit: ' W/m²' }
  ];

  function buildSeries() {
    var first = Math.round(state.start), last = Math.min(M.LAST_KYR, first + Math.round(state.len));
    if (series && series.first === first && series.last === last) return series;
    var n = last - first + 1;
    series = { first: first, last: last, n: n, ecc: new Float64Array(n), tilt: new Float64Array(n),
      prec: new Float64Array(n), sun: new Float64Array(n), range: {} };
    for (var i = 0; i < n; i++) {
      var o = orbit.at(first + i);
      series.ecc[i] = o.ecc; series.tilt[i] = o.obl / RAD;
      series.prec[i] = M.precessionIndex(o.ecc, o.peri); series.sun[i] = M.summer65N(o.ecc, o.obl, o.peri);
    }
    PANELS.forEach(function (panel) {
      var lo = Infinity, hi = -Infinity, data = series[panel.key];
      for (var k = 0; k < n; k++) { if (data[k] < lo) lo = data[k]; if (data[k] > hi) hi = data[k]; }
      series.range[panel.key] = [lo, hi];
    });
    cursor = null;
    return series;
  }

  var timeLayout = null;
  function drawTimeseries() {
    var s = buildSeries(), c = prepare($('timeseries')), ctx = c.ctx;
    var left = 62, right = 16, top = 6, bottom = 44, gap = 26;
    var plotW = c.w - left - right, each = (c.h - top - bottom) / 4;
    var millions = s.last - s.first >= 2000, scale = millions ? 1000 : 1;
    var xOf = function (kyr) { return left + (kyr - s.first) / (s.last - s.first) * plotW; };
    var xt = ticks(s.first / scale, s.last / scale, Math.max(3, Math.floor(plotW / 90)));
    timeLayout = { left: left, plotW: plotW };

    PANELS.forEach(function (panel, p) {
      var y0 = top + p * each + gap, y1 = top + (p + 1) * each - 6, data = s[panel.key], range = s.range[panel.key];
      var pad = (range[1] - range[0]) * 0.08 || Math.abs(range[1]) * 0.05 || 1;
      var lo = range[0] - pad, hi = range[1] + pad;
      var yOf = function (v) { return y1 - (v - lo) / (hi - lo) * (y1 - y0); };
      var yt = ticks(lo, hi, Math.max(2, Math.floor((y1 - y0) / 34)));
      text(ctx, c.w < 640 ? panel.brief : panel.title, left, y0 - 9, { bold: true, color: INK, size: 14 });
      ctx.lineWidth = 1; ctx.strokeStyle = GRID;
      yt.values.forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(left, yOf(v)); ctx.lineTo(left + plotW, yOf(v)); ctx.stroke();
        text(ctx, fixed(v, decimals(yt.step)), left - 7, yOf(v), { align: 'right', baseline: 'middle' });
      });
      xt.values.forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(xOf(v * scale), y0); ctx.lineTo(xOf(v * scale), y1); ctx.stroke();
      });
      if (lo < 0 && hi > 0) { ctx.strokeStyle = '#7b8991'; ctx.beginPath(); ctx.moveTo(left, yOf(0)); ctx.lineTo(left + plotW, yOf(0)); ctx.stroke(); }
      if (s.first < 0 && s.last > 0) {
        ctx.strokeStyle = INK; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(xOf(0), y0); ctx.lineTo(xOf(0), y1); ctx.stroke(); ctx.setLineDash([]);
        if (p === 0) text(ctx, 'today', xOf(0) + 4, y0 + 12, { color: INK, size: 12 });
      }
      ctx.strokeStyle = panel.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      for (var i = 0; i < s.n; i++) { var x = xOf(s.first + i), y = yOf(data[i]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.strokeStyle = SPINE; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(left, y1); ctx.lineTo(left + plotW, y1); ctx.stroke();
      if (cursor !== null) {
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xOf(s.first + cursor), y0); ctx.lineTo(xOf(s.first + cursor), y1); ctx.stroke();
        ctx.fillStyle = panel.color; ctx.beginPath(); ctx.arc(xOf(s.first + cursor), yOf(data[cursor]), 4.5, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
    var base = c.h - bottom + 2;
    xt.values.forEach(function (v) { text(ctx, millions ? fixed(v, decimals(xt.step)) : minus(commas(v)), xOf(v * scale), base + 14, { align: 'center' }); });
    text(ctx, (millions ? 'Millions' : 'Thousands') + ' of years from now (negative is the past)', left + plotW / 2, base + 34, { align: 'center', color: INK });

    var r = s.range;
    $('timeseries-summary').textContent = capital(timeText(s.first)) + ' to ' + timeText(s.last) + ': eccentricity runs from ' +
      r.ecc[0].toFixed(4) + ' to ' + r.ecc[1].toFixed(4) + ' (today ' + M.PRESENT.ecc.toFixed(4) + '); tilt from ' + r.tilt[0].toFixed(2) + '° to ' +
      r.tilt[1].toFixed(2) + '° (today ' + (M.PRESENT.obl / RAD).toFixed(2) + '°); mid-July Sunlight at 65 °N from ' + r.sun[0].toFixed(0) + ' to ' +
      r.sun[1].toFixed(0) + ' W/m² (today ' + M.summer65N(M.PRESENT.ecc, M.PRESENT.obl, M.PRESENT.peri).toFixed(0) + ').';
  }

  function readCursor() {
    var s = series, i = cursor;
    $('timeseries-readout').textContent = capital(timeText(s.first + i)) + ': eccentricity ' + s.ecc[i].toFixed(4) + '; tilt ' + s.tilt[i].toFixed(2) +
      '°; precession index ' + fixed(s.prec[i], 4) + '; mid-July Sunlight at 65 °N ' + s.sun[i].toFixed(1) + ' W/m².';
  }
  function moveCursor(index) { cursor = clamp(Math.round(index), 0, series.n - 1); readCursor(); drawTimeseries(); }

  function downloadSeries() {
    var s = buildSeries(), lines = [
      '# Milankovitch model, Climate Change: Simple, Serious, Solvable (Scott Denning)',
      '# Orbit: Laskar et al. (2004), doi:10.1051/0004-6361:20041335',
      '# kyr: thousands of years from now (negative is the past)',
      '# perihelion_deg: longitude of perihelion from the moving March equinox',
      '# precession_index: eccentricity x sin(longitude of perihelion)',
      '# sunlight_65N_midJuly_W_m2: daily mean at the top of the atmosphere, solar constant ' + M.S0 + ' W/m2',
      'kyr,eccentricity,tilt_deg,perihelion_deg,precession_index,sunlight_65N_midJuly_W_m2'];
    for (var i = 0; i < s.n; i++) {
      var o = orbit.at(s.first + i);
      lines.push([s.first + i, o.ecc.toFixed(6), s.tilt[i].toFixed(4), (o.peri / RAD).toFixed(3), s.prec[i].toFixed(6), s.sun[i].toFixed(2)].join(','));
    }
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    link.download = 'milankovitch-' + s.first + '-to-' + s.last + '-kyr.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  /* ---------- views 2 and 3: maps of Sunlight by latitude and season ---------- */

  var SEASONS = [[-90, 'Dec solstice', 'Dec'], [0, 'Mar equinox', 'Mar'], [90, 'Jun solstice', 'Jun'], [180, 'Sep equinox', 'Sep'], [270, 'Dec solstice', 'Dec']];
  function latText(lat) { return lat === 0 ? 'the equator' : Math.abs(lat).toFixed(0) + ' °' + (lat > 0 ? 'N' : 'S'); }

  function image(grid, values, colorOf) {
    var off = document.createElement('canvas'); off.width = grid.nLon; off.height = grid.nLat;
    var octx = off.getContext('2d'), data = octx.createImageData(grid.nLon, grid.nLat);
    for (var j = 0; j < grid.nLat; j++) for (var i = 0; i < grid.nLon; i++) {
      var rgb = colorOf(values[(grid.nLat - 1 - j) * grid.nLon + i]), o = (j * grid.nLon + i) * 4;
      data.data[o] = rgb[0]; data.data[o + 1] = rgb[1]; data.data[o + 2] = rgb[2]; data.data[o + 3] = 255;
    }
    octx.putImageData(data, 0, 0);
    return off;
  }

  /* Two maps, one above the other: a state and a change. */
  function drawMaps(canvasId, grid, base, change, titles) {
    var c = prepare($(canvasId)), ctx = c.ctx, narrow = c.w < 520;
    var left = 58, right = 78, titleH = 30, axisH = 30, each = c.h / 2;
    var plotW = c.w - left - right, maxBase = 0, maxChange = 0, k;
    for (k = 0; k < base.length; k++) { if (base[k] > maxBase) maxBase = base[k]; if (Math.abs(change[k]) > maxChange) maxChange = Math.abs(change[k]); }
    var top1 = Math.ceil(maxBase / 50) * 50, stepC = niceStep(Math.max(maxChange, 0.5), 4), top2 = Math.ceil(Math.max(maxChange, 0.5) / stepC) * stepC;
    var scales = [
      { values: base, lo: 0, hi: top1, color: function (v) { return sequential(v / top1); }, title: titles[0], digits: 0 },
      { values: change, lo: -top2, hi: top2, color: function (v) { return diverging((v + top2) / (2 * top2)); }, title: titles[1], digits: decimals(niceStep(2 * top2, 6)) }
    ];
    var plots = [];
    scales.forEach(function (scale, p) {
      var y0 = p * each + titleH, y1 = (p + 1) * each - axisH, plotH = y1 - y0;
      plots.push({ y0: y0, y1: y1 });
      text(ctx, scale.title, left, y0 - 10, { bold: true, color: INK, size: narrow ? 12 : 14 });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image(grid, scale.values, scale.color), left, y0, plotW, plotH);
      ctx.strokeStyle = 'rgba(21,46,61,0.35)'; ctx.lineWidth = 1;
      SEASONS.slice(1, 4).forEach(function (season) {
        var x = left + (season[0] + 90) / 360 * plotW; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(left, (y0 + y1) / 2); ctx.lineTo(left + plotW, (y0 + y1) / 2); ctx.stroke();
      ctx.strokeStyle = SPINE; ctx.lineWidth = 1.1; ctx.strokeRect(left, y0, plotW, plotH);
      SEASONS.forEach(function (season, n) {
        var x = left + (season[0] + 90) / 360 * plotW;
        text(ctx, season[narrow ? 2 : 1], x, y1 + 17, { align: n === 0 ? 'left' : n === 4 ? 'right' : 'center' });
      });
      [-90, -60, -30, 0, 30, 60, 90].forEach(function (lat) {
        var y = y1 - (lat + 90) / 180 * plotH;
        text(ctx, lat === 0 ? 'Equator' : Math.abs(lat) + '°' + (lat > 0 ? 'N' : 'S'), left - 7, y, { align: 'right', baseline: lat === 90 ? 'top' : lat === -90 ? 'bottom' : 'middle', size: 12 });
      });
      var barX = left + plotW + 14, barW = 14;
      for (var row = 0; row < plotH; row++) {
        var rgb = scale.color(scale.hi - (scale.hi - scale.lo) * row / (plotH - 1));
        ctx.fillStyle = 'rgb(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ')';
        ctx.fillRect(barX, y0 + row, barW, 1.5);
      }
      ctx.strokeRect(barX, y0, barW, plotH);
      ticks(scale.lo, scale.hi, 6).values.forEach(function (v) {
        var y = y1 - (v - scale.lo) / (scale.hi - scale.lo) * plotH;
        text(ctx, p === 1 && v > 0 ? '+' + fixed(v, scale.digits) : fixed(v, scale.digits), barX + barW + 5, y, { baseline: 'middle', size: 12 });
      });
      text(ctx, 'W/m²', barX, y0 - 10, { size: 12, color: SECOND });
    });
    mapLayouts[canvasId] = { left: left, plotW: plotW, plots: plots, grid: grid, base: base, change: change };
  }

  function mapReadout(canvasId, names) {
    var canvas = $(canvasId), out = $(canvasId + '-readout');
    canvas.addEventListener('pointermove', function (event) {
      var L = mapLayouts[canvasId]; if (!L) return;
      var box = canvas.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
      var plot = L.plots.filter(function (p) { return y >= p.y0 && y <= p.y1; })[0];
      if (!plot || x < L.left || x > L.left + L.plotW) return;
      var i = Math.round((x - L.left) / L.plotW * (L.grid.nLon - 1)), j = Math.round((plot.y1 - y) / (plot.y1 - plot.y0) * (L.grid.nLat - 1));
      var b = L.base[j * L.grid.nLon + i], d = L.change[j * L.grid.nLon + i];
      out.textContent = capital(latText(L.grid.latDeg[j])) + ', about ' + M.seasonName(L.grid.lamDeg[i]) + ': ' + names()[0] + ' ' + b.toFixed(0) +
        ' W/m²; ' + names()[1] + ' ' + (b + d).toFixed(0) + ' W/m² (' + signed(d, 1) + ').';
    });
  }

  function difference(a, b) { var out = new Float32Array(a.length); for (var k = 0; k < a.length; k++) out[k] = b[k] - a[k]; return out; }

  function mapSummary(a, b, grid, change, nameA, nameB) {
    var at = function (o, lamDeg, latDeg) { return M.dailyInsolation(o.ecc, o.obl, o.peri, lamDeg * RAD, latDeg * RAD); };
    var line = function (label, lamDeg, latDeg) {
      var x = at(a, lamDeg, latDeg), y = at(b, lamDeg, latDeg);
      return label + ': ' + x.toFixed(0) + ' W/m² ' + nameA + ', ' + y.toFixed(0) + ' ' + nameB + ' (' + signed(y - x, 1) + ').';
    };
    var hi = 0, lo = 0;
    for (var k = 0; k < change.length; k++) { if (change[k] > change[hi]) hi = k; if (change[k] < change[lo]) lo = k; }
    var where = function (k) { return latText(grid.latDeg[Math.floor(k / grid.nLon)]) + ' in ' + M.seasonName(grid.lamDeg[k % grid.nLon]); };
    var extremes = Math.abs(change[hi]) < 0.05 && Math.abs(change[lo]) < 0.05 ? ' The two are the same.' :
      ' Largest gain: ' + signed(change[hi], 1) + ' W/m² at ' + where(hi) + '. Largest loss: ' + signed(change[lo], 1) + ' W/m² at ' + where(lo) + '.';
    return line('At 65 °N on the June solstice', 90, 65) + ' ' + line('At 65 °S on the December solstice', 270, -65) + extremes;
  }

  function drawCompare() {
    var a = orbit.at(state.t1), b = orbit.at(state.t2);
    var g = M.insolationGrid(a.ecc, a.obl, a.peri), h = M.insolationGrid(b.ecc, b.obl, b.peri), change = difference(g.q, h.q);
    var nameA = capital(timeText(state.t1)), nameB = timeText(state.t2);
    drawMaps('compare', g, g.q, change, ['Sunlight ' + timeText(state.t1), 'Change: ' + nameB + ' minus ' + timeText(state.t1)]);
    $('compare-summary').textContent = mapSummary(a, b, g, change, timeText(state.t1), nameB) + ' ' + nameA + ', Earth is closest to the Sun in ' +
      M.perihelionSeason(a.peri) + '; ' + nameB + ', in ' + M.perihelionSeason(b.peri) + '.';
  }

  function drawSensitivity() {
    var a = M.PRESENT, b = { ecc: state.e, obl: state.tilt * RAD, peri: state.peri * RAD };
    var g = M.insolationGrid(a.ecc, a.obl, a.peri), h = M.insolationGrid(b.ecc, b.obl, b.peri), change = difference(g.q, h.q);
    drawMaps('sensitivity', g, g.q, change, ['Sunlight with today\'s orbit', 'Change: your orbit minus today\'s']);
    $('sensitivity-summary').textContent = mapSummary(a, b, g, change, 'today', 'with your orbit');
    $('peri-hint').textContent = 'Earth is closest to the Sun in ' + M.perihelionSeason(b.peri) + '. Today it\'s early January (102.9°).';
    drawOrbit(b);
  }

  /* The orbit from above the North Pole. Earth goes round counterclockwise. */
  function drawOrbit(o) {
    var c = prepare($('orbit')), ctx = c.ctx, shown = Math.min(0.75, o.ecc * 10);
    var radius = function (angle) { return (1 - shown * shown) / (1 + shown * Math.cos(angle - o.peri)); };
    var point = function (angle) { var r = radius(angle); return [r * Math.cos(angle), -r * Math.sin(angle)]; };
    var xs = [], ys = [], n, p;
    for (n = 0; n <= 180; n++) { p = point(n * 2 * RAD); xs.push(p[0]); ys.push(p[1]); }
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 34, scale = Math.min((c.w - 2 * pad) / (maxX - minX), (c.h - 2 * pad) / (maxY - minY));
    var cx = c.w / 2 - (minX + maxX) / 2 * scale, cy = c.h / 2 - (minY + maxY) / 2 * scale;
    ctx.strokeStyle = SPINE; ctx.lineWidth = 1.5; ctx.beginPath();
    xs.forEach(function (x, k) { if (k) ctx.lineTo(cx + x * scale, cy + ys[k] * scale); else ctx.moveTo(cx + x * scale, cy + ys[k] * scale); });
    ctx.stroke();
    ctx.fillStyle = '#e69f00'; ctx.strokeStyle = '#b35c00'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    [[180, 'Mar'], [270, 'Jun'], [0, 'Sep'], [90, 'Dec']].forEach(function (mark) {
      var q = point(mark[0] * RAD), x = cx + q[0] * scale, y = cy + q[1] * scale;
      ctx.fillStyle = '#0072b2'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 2 * Math.PI); ctx.fill();
      text(ctx, mark[1], x + (q[0] > 0.05 ? 9 : q[0] < -0.05 ? -9 : 0), y + (q[1] > 0.05 ? 17 : q[1] < -0.05 ? -9 : 4),
        { align: q[0] > 0.05 ? 'left' : q[0] < -0.05 ? 'right' : 'center', size: 12, color: INK });
    });
    if (o.ecc > 0) {
      var near = point(o.peri), nx = cx + near[0] * scale, ny = cy + near[1] * scale;
      ctx.strokeStyle = '#c24f00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.fillStyle = '#c24f00'; ctx.beginPath(); ctx.moveTo(nx, ny - 6); ctx.lineTo(nx + 6, ny); ctx.lineTo(nx, ny + 6); ctx.lineTo(nx - 6, ny); ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- the About tab ---------- */

  /* Show a code file inside the page. Read this way its Greek letters and degree signs always come out right;
     opened in a tab of its own, a browser may garble them. */
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

  /* An address can point into the About tab, as in ?view=about#about-equations. The tab is hidden while the page
     loads, so the browser can't go there by itself. Returns how far down the page is scrolled. */
  function goToAddressPlace() {
    var place = state.view === 'about' && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
    return window.scrollY;
  }

  /* ---------- start ---------- */

  function start() {
    readAddress();
    shows = [pair('start', 'start', 0), pair('duration', 'len', 0), pair('t1', 't1', 0), pair('t2', 't2', 0),
      pair('ecc', 'e', 3), pair('obl', 'tilt', 2), pair('peri', 'peri', 1)];
    showAll();

    VIEWS.forEach(function (name, n) {
      var tab = $('tab-' + name);
      tab.addEventListener('click', function () { selectView(name); });
      tab.addEventListener('keydown', function (event) {
        var to = event.key === 'ArrowRight' ? n + 1 : event.key === 'ArrowLeft' ? n - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? VIEWS.length - 1 : null;
        if (to === null) return;
        event.preventDefault(); selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.presets button'), function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.start) { state.start = +button.dataset.start; state.len = +button.dataset.duration; }
        if (button.dataset.t1) { state.t1 = +button.dataset.t1; state.t2 = +button.dataset.t2; }
        showAll(); changed();
      });
    });
    $('reset-orbit').addEventListener('click', function () { state.e = DEFAULTS.e; state.tilt = DEFAULTS.tilt; state.peri = DEFAULTS.peri; showAll(); changed(); });
    $('download').addEventListener('click', downloadSeries);
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });

    var graph = $('timeseries');
    graph.addEventListener('pointermove', function (event) {
      if (!series || !timeLayout) return;
      var x = event.clientX - graph.getBoundingClientRect().left;
      moveCursor((x - timeLayout.left) / timeLayout.plotW * (series.n - 1));
    });
    graph.addEventListener('keydown', function (event) {
      if (!series) return;
      var jump = event.shiftKey ? Math.max(10, Math.round(series.n / 20)) : 1, at = cursor === null ? series.n - 1 : cursor;
      var to = event.key === 'ArrowRight' ? at + jump : event.key === 'ArrowLeft' ? at - jump : event.key === 'Home' ? 0 : event.key === 'End' ? series.n - 1 : null;
      if (to === null) return;
      event.preventDefault(); moveCursor(to);
    });
    mapReadout('compare', function () { return [timeText(state.t1), timeText(state.t2)]; });
    mapReadout('sensitivity', function () { return ['today', 'with your orbit']; });
    window.addEventListener('resize', changed);

    selectView(state.view);
    var scrolledTo = goToAddressPlace();
    fetch('orbit.bin').then(function (response) {
      if (!response.ok) throw new Error('orbit.bin: ' + response.status);
      return response.arrayBuffer();
    }).then(function (buffer) {
      orbit = M.orbitTable(buffer);
      $('loading').hidden = true;
      selectView(state.view);
      if (window.scrollY === scrolledTo) goToAddressPlace();   /* the loading line has gone, so the page has moved */
    }).catch(function (error) {
      $('loading').textContent = 'The orbital data didn\'t load. Please reload the page. (' + error.message + ')';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
