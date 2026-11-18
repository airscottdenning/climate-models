/* Heat and work model: the page. model.js is the science. This file is the controls, the WBGT scale, the bars
 * and the tables. Every number it shows comes from model.js. */
(function () {
  'use strict';

  var M = window.HeatAndWork;
  var VIEWS = ['model', 'about'];
  var WHERE = ['sun', 'shade', 'room'];
  var OWN = 'own';                                // the place when the reader sets their own numbers
  // The page opens on an average June afternoon in Dhaka, warmed by 3 °C, in the shade.
  var DEFAULTS = { view: 'model', place: 'dhaka', w: 3, where: 'shade' };
  var NAMES = { light: 'Light work', moderate: 'Moderate work', heavy: 'Heavy work' };
  var SHADES = { 60: '#d8ece3', 45: '#f3e3a6', 30: '#ecb87c', 15: '#d9775a', 0: '#9e3a3a' };
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', LATER = '#b2182b';
  var LOW = 18, HIGH = 40;                        // the ends of the WBGT scale, in °C
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var NB = ' ';

  var start = M.place(DEFAULTS.place);
  var state = { view: DEFAULTS.view, place: DEFAULTS.place, t: start.T, h: start.H, w: DEFAULTS.w,
                where: DEFAULTS.where };

  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function fixed(x, places) { return (Math.round(x * Math.pow(10, places) + 1e-9) / Math.pow(10, places)).toFixed(places); }
  function degrees(c) { return fixed(c, 1) + NB + '°C (' + fixed(c * 1.8 + 32, 1) + NB + '°F)'; }
  function minutesText(m) { return m === 0 ? 'none (past the table)' : m + NB + 'minutes an hour'; }

  function result() { return M.run(state.t, state.h, state.w, state.where); }

  // ---- The controls ----

  var SLIDERS = { t: 1, h: 0, w: 1 };            // decimal places of each

  function tidy(key, value) {
    var box = $(key), step = +box.step;
    return +clamp(Math.round(value / step) * step, +box.min, +box.max).toFixed(SLIDERS[key]);
  }

  function pair(key) {
    var box = $(key), range = $(key + '-range');
    function take(source) {
      var value = parseFloat(source.value);
      if (!isFinite(value)) { show(); return; }
      state[key] = tidy(key, value);
      if (key !== 'w') state.place = OWN;          // the reader's own afternoon
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    box.addEventListener('change', function () { take(box); });
  }

  function fillPlaces() {
    var select = $('place');
    M.PLACES.forEach(function (p) {
      var option = document.createElement('option');
      option.value = p[0];
      option.textContent = p[1] + ', ' + p[2] + ' (' + p[3] + ')';
      select.appendChild(option);
    });
    var own = document.createElement('option');
    own.value = OWN; own.textContent = 'Your own numbers';
    select.appendChild(own);
    select.addEventListener('change', function () {
      var p = M.place(select.value);
      state.place = select.value;
      if (p) { state.t = p.T; state.h = p.H; }
      changed();
    });
  }

  /* Put the state back into every control. */
  function show() {
    $('place').value = state.place;
    Object.keys(SLIDERS).forEach(function (key) {
      $(key).value = $(key + '-range').value = state[key].toFixed(SLIDERS[key]);
    });
    $('t-f').textContent = 'That\'s ' + fixed(state.t * 1.8 + 32, 1) + NB + '°F.';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="where"]'), function (radio) {
      radio.checked = radio.value === state.where;
    });
  }

  // ---- The graph: a WBGT scale with a strip for each kind of work ----

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

  function drawGraph(out) {
    var c = prepare($('graph')), ctx = c.ctx, narrow = c.w < 560;
    ctx.font = '13px ' + FONT;
    var labelWidth = narrow ? 0 : Math.ceil(ctx.measureText('Moderate').width) + 12;
    var x0 = labelWidth + 10, x1 = c.w - 14, top = narrow ? 46 : 34, strip = narrow ? 26 : 34, gap = narrow ? 22 : 10;
    function px(v) { return x0 + (clamp(v, LOW, HIGH) - LOW) / (HIGH - LOW) * (x1 - x0); }
    text(ctx, 'Wet-bulb globe temperature (°C)', x0, 18, { bold: true, color: INK });
    M.LOADS.forEach(function (load, k) {
      var y = top + k * (strip + gap), limits = M.LIMITS[load], from = LOW;
      limits.concat([HIGH]).forEach(function (to, row) {
        ctx.fillStyle = SHADES[row < M.MINUTES.length ? M.MINUTES[row] : 0];
        ctx.fillRect(px(from), y, px(to) - px(from), strip);
        from = to;
      });
      if (narrow) text(ctx, NAMES[load], x0 + 4, y - 4, { size: 12, color: INK });
      else text(ctx, load.charAt(0).toUpperCase() + load.slice(1), x0 - 8, y + strip / 2,
        { align: 'right', baseline: 'middle', color: INK });
    });
    var bottom = top + 3 * strip + 2 * gap;
    ctx.strokeStyle = SPINE; ctx.lineWidth = 1;
    for (var v = LOW; v <= HIGH; v += 2) {
      ctx.beginPath(); ctx.moveTo(px(v), bottom); ctx.lineTo(px(v), bottom + 5); ctx.stroke();
      if (!narrow || v % 4 === 0) text(ctx, String(v), px(v), bottom + 18, { align: 'center' });
    }
    [{ W: out.now.W, color: INK, label: 'now' }, { W: out.later.W, color: LATER, label: 'warmer' }]
      .forEach(function (mark, k) {
        var x = px(mark.W);
        ctx.fillStyle = mark.color;
        ctx.fillRect(x - 2, top - 6, 4, bottom - top + 6);
        var y = bottom + (k ? 36 : 36), align = k ? 'left' : 'right';
        if (Math.abs(out.later.W - out.now.W) < 1e-9) { if (k) return; align = 'center'; }
        text(ctx, mark.label + ' ' + fixed(mark.W, 1), x + (k ? 4 : -4), y,
          { size: 12, bold: true, color: mark.color, halo: '#ffffff', align: align });
      });
  }

  // ---- The bars for each hour ----

  function drawHours(out) {
    var list = $('hours');
    list.textContent = '';
    M.LOADS.forEach(function (load) {
      [['now', out.now.minutes[load], ''], ['with the warming', out.later.minutes[load], ' later']]
        .forEach(function (row) {
          var item = document.createElement('li'), top = document.createElement('div');
          var name = document.createElement('span'), value = document.createElement('strong');
          var track = document.createElement('div'), work = document.createElement('div');
          top.className = 'label'; track.className = 'track'; work.className = 'work' + row[2];
          name.textContent = NAMES[load] + ', ' + row[0];
          value.textContent = row[1] === 0 ? 'no regular work' : row[1] + NB + 'min work, ' + (60 - row[1]) + NB + 'min rest';
          work.style.width = (row[1] / 60 * 100) + '%';
          track.appendChild(work);
          top.appendChild(name); top.appendChild(value);
          item.appendChild(top); item.appendChild(track);
          list.appendChild(item);
        });
    });
  }

  // ---- The tables ----

  function drawTable(out) {
    [['now', out.now], ['later', out.later]].forEach(function (pair) {
      var name = pair[0], p = pair[1];
      $(name + '-t').textContent = degrees(p.T);
      $(name + '-h').textContent = p.H + '%';
      $(name + '-tw').textContent = fixed(p.Tw, 1) + NB + '°C';
      $(name + '-g').textContent = fixed(p.T + p.G, 1) + NB + '°C';
      $(name + '-w').textContent = fixed(p.W, 1) + NB + '°C';
    });
  }

  function drawPlaces() {
    var body = $('places'), rows = M.PLACES.map(function (p) {
      var out = M.run(p[4], p[5], state.w, state.where);
      return { id: p[0], name: p[1] + ', ' + p[2], month: p[3], out: out };
    });
    rows.sort(function (a, b) { return b.out.now.W - a.out.now.W || (a.name < b.name ? -1 : 1); });
    body.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row.id === state.place) tr.className = 'chosen';
      var cells = [row.name, row.month, fixed(row.out.now.W, 1) + NB + '°C', fixed(row.out.later.W, 1) + NB + '°C',
        row.out.now.minutes.heavy + ' → ' + row.out.later.minutes.heavy];
      cells.forEach(function (value, k) {
        var cell = document.createElement(k ? 'td' : 'th');
        if (!k) cell.scope = 'row';
        cell.textContent = value;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
  }

  function summary(out) {
    var p = M.place(state.place);
    var where = { sun: 'outdoors in full Sun', shade: 'outdoors in the shade', room: 'indoors with air conditioning' }[state.where];
    var start = p ? 'An average ' + p.month + ' afternoon in ' + p.name : 'Your afternoon';
    return start + ', ' + where + ': the WBGT is ' + fixed(out.now.W, 1) + NB + '°C now and ' + fixed(out.later.W, 1) + NB +
      '°C with ' + fixed(state.w, 1) + NB + '°C of warming. Heavy work: ' + minutesText(out.now.minutes.heavy) +
      ' now; ' + minutesText(out.later.minutes.heavy) + ' with the warming.';
  }

  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  function draw() {
    if (state.view === 'about') return;
    var out = result();
    drawGraph(out); drawHours(out); drawTable(out); drawPlaces(); say('summary', summary(out));
  }

  // ---- The address, the tabs and the start ----

  function readAddress() {
    var params = new URLSearchParams(location.search), view = params.get('view');
    if (view !== null) state.view = VIEWS.indexOf(view) < 0 ? DEFAULTS.view : view;
    var place = params.get('place');
    if (place !== null && (place === OWN || M.place(place))) state.place = place;
    var p = M.place(state.place);
    if (p) { state.t = p.T; state.h = p.H; }
    ['t', 'h', 'w'].forEach(function (key) {
      var value = parseFloat(params.get(key));
      if (isFinite(value)) state[key] = tidy(key, value);
    });
    if (params.get('t') !== null || params.get('h') !== null) {
      if (!p || state.t !== p.T || state.h !== p.H) state.place = OWN;
    }
    if (WHERE.indexOf(params.get('where')) >= 0) state.where = params.get('where');
    if (params.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    if (state.view !== DEFAULTS.view) parts.push('view=' + state.view);
    if (state.place !== DEFAULTS.place) parts.push('place=' + state.place);
    if (state.place === OWN) parts.push('t=' + state.t, 'h=' + state.h);
    if (state.w !== DEFAULTS.w) parts.push('w=' + state.w);
    if (state.where !== DEFAULTS.where) parts.push('where=' + state.where);
    if (document.body.classList.contains('embed')) parts.push('embed=1');
    var query = parts.length ? '?' + parts.join('&') : location.pathname;
    try {
      history.replaceState(null, '', query + (state.view === 'about' ? location.hash : ''));
    } catch (error) { /* some embedded pages can't */ }
    $('open-link').href = '?' + parts.filter(function (p) { return p !== 'embed=1'; }).join('&');
  }

  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; show(); saveToAddress(); draw(); });
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

  function goToAddressPlace() {
    var place = state.view === 'about' && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (place && $('panel-about').contains(place)) place.scrollIntoView();
  }

  function begin() {
    fillPlaces();
    readAddress();
    Object.keys(SLIDERS).forEach(pair);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="where"]'), function (radio) {
      radio.addEventListener('change', function () { if (radio.checked) { state.where = radio.value; changed(); } });
    });
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
      var p = M.place(DEFAULTS.place);
      state.place = DEFAULTS.place; state.t = p.T; state.h = p.H; state.w = DEFAULTS.w; state.where = DEFAULTS.where;
      changed();
    });
    Array.prototype.forEach.call(document.querySelectorAll('details[data-src]'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);
    show();
    selectView(state.view);
    goToAddressPlace();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
