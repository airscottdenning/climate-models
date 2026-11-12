/* A Few Degrees: the controls and the drawing. The science is in model.js; nothing here changes a number.
 *
 * The page keeps one state (below). Every control writes to it and calls changed(), which saves the state in
 * the address and draws the view that's open. The data come as they're needed: the list of places as the page
 * opens, one small file for a place when it's chosen, and the map's files when the map is first shown. */
(function () {
  'use strict';

  var M = window.DailyTemperatures;
  var VIEWS = ['idea', 'periods', 'warming', 'future', 'map', 'about'];
  var TAP_HINT = 'Click or tap a dot to choose that place. Where the dots crowd together, the list above ' +
    'is easier.';
  var DEFAULTS = {
    view: 'idea', place: 'USC00190736', unit: 'F', season: 'warm', t: null, scenario: 'ssp370', move: false,
    mean: null, sd: null, warm: null, at: null, show: 'places', area: 'world'
  };
  var NUMBERS = ['t', 'mean', 'sd', 'warm', 'at'];   // null means "where the page starts"

  // The chapter's example, and how far each control of the first view goes: lowest, highest, step.
  var CHAPTER = { F: { mean: 89, sd: 4, warm: 4, at: 97 }, C: { mean: 32, sd: 2, warm: 2, at: 36 } };
  var REACH = {
    F: { mean: [0, 110, 1], sd: [1, 15, 0.5], warm: [0, 15, 0.5], at: [-20, 140, 1] },
    C: { mean: [-20, 45, 1], sd: [0.5, 8, 0.5], warm: [0, 8, 0.5], at: [-30, 60, 1] }
  };
  var IDEA = ['mean', 'sd', 'warm', 'at'];

  var state = {};
  Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });

  var index = null;          // data/index.json, once it has come
  var places = {};           // id -> the place's line in the index
  var stations = {};         // id -> the place's days, 'loading' or 'failed'
  var coast = null;          // the coastlines and borders, 'loading' or 'failed'
  var pattern = null;        // the AR6 map of warming for each 1 °C, 'loading' or 'failed'
  var curves = {};           // smooth curves already worked out
  var failed = false;        // the list of places didn't load

  function $(id) { return document.getElementById(id); }
  function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }

  // ---- Numbers in words ----

  var NB = ' ';
  function fixed(value, digits) {
    var words = Math.abs(value).toFixed(digits);
    return (value < 0 && +words !== 0 ? '−' : '') + words;
  }
  function commas(value) { return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function unitName(unit) { return '°' + (unit || state.unit); }

  /* A temperature kept in °C, in the unit the reader chose. */
  function shown(celsius) { return state.unit === 'F' ? celsius * 1.8 + 32 : celsius; }
  function celsius(value) { return state.unit === 'F' ? (value - 32) / 1.8 : value; }
  function size(celsiusDegrees) { return state.unit === 'F' ? celsiusDegrees * 1.8 : celsiusDegrees; }
  function degrees(value, digits) { return fixed(value, digits || 0) + NB + unitName(); }
  function temperature(c, digits) { return degrees(shown(c), digits === undefined ? 1 : digits); }

  /* A difference kept in °C, said both ways, the reader's unit first. */
  function both(c, digits) {
    digits = digits === undefined ? 1 : digits;
    var f = fixed(Math.abs(c) * 1.8, digits) + NB + '°F', k = fixed(Math.abs(c), digits) + NB + '°C';
    return state.unit === 'F' ? f + ' (' + k + ')' : k + ' (' + f + ')';
  }
  function percent(share) {
    var value = share * 100;
    if (value === 0) return '0%';
    if (value < 0.01) return 'less than 0.01%';
    return fixed(value, value < 1 ? 2 : 1) + '%';
  }
  function perMonth(daysInAMonth) { return fixed(daysInAMonth, daysInAMonth < 1 ? 2 : 1); }
  function times(ratio) { return fixed(ratio, ratio >= 10 ? 0 : ratio < 1 ? 2 : 1); }
  function years(period) { return period[0] + '–' + period[1]; }
  function where(place) {
    return fixed(Math.abs(place.lat), 2) + '°' + NB + (place.lat < 0 ? 'S' : 'N') + ', ' +
      fixed(Math.abs(place.lon), 2) + '°' + NB + (place.lon < 0 ? 'W' : 'E');
  }
  function say(id, words) { if ($(id).textContent !== words) $(id).textContent = words; }

  // ---- The data ----

  function fetched(path, kind) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return kind === 'json' ? response.json() : response.arrayBuffer();
    });
  }

  function loadIndex() {
    fetched('data/index.json', 'json').then(function (data) {
      index = data;
      data.stations.forEach(function (place) { places[place.id] = place; });
      if (!places[state.place]) state.place = DEFAULTS.place;
      $('loading').hidden = true;
      fillPlaces();
      showAll();
      changed();
    }).catch(function () {
      failed = true;
      $('loading').className = 'failed';
      say('loading', 'The list of places didn\'t load. Check your connection, then load the page again.');
      changed();
    });
  }

  /* The chosen place's days, or null while they're on their way. */
  function station() {
    var id = state.place, have = stations[id];
    if (!index || !places[id]) return null;
    if (!have) {
      stations[id] = 'loading';
      fetched('data/stations/' + id + '.bin').then(function (buffer) {
        stations[id] = M.readStation(buffer);
        showAll();
        changed();
      }).catch(function () { stations[id] = 'failed'; changed(); });
      return null;
    }
    return typeof have === 'string' ? null : have;
  }

  /* What to say in place of a graph while a place's days aren't here. */
  function waiting() {
    if (failed) return 'The list of places didn\'t load.';
    if (!index) return 'Loading the list of places…';
    return stations[state.place] === 'failed'
      ? 'The record for ' + places[state.place].label + ' didn\'t load. Check your connection and choose it again.'
      : 'Loading the record for ' + places[state.place].label + '…';
  }

  function loadMapFiles() {
    if (!coast) {
      coast = 'loading';
      fetched('data/coast.bin').then(function (buffer) { coast = readCoast(buffer); changed(); })
        .catch(function () { coast = 'failed'; changed(); });
    }
    if (!pattern && state.show === 'later') {
      pattern = 'loading';
      fetched('data/pattern.bin').then(function (buffer) { pattern = new Int16Array(buffer); changed(); })
        .catch(function () { pattern = 'failed'; changed(); });
    }
  }

  /* coast.bin: how many coastlines and how many borders, each line's number of points, then the points. */
  function readCoast(buffer) {
    var all = new Int16Array(buffer), shores = all[0], lines = [], at = 2 + all[0] + all[1];
    for (var i = 0; i < all[0] + all[1]; i += 1) {
      var points = [];
      for (var j = 0; j < all[2 + i]; j += 1, at += 2) points.push([all[at] / 100, all[at + 1] / 100]);
      lines.push({ border: i >= shores, points: points });
    }
    return lines;
  }

  // ---- The list of places ----

  function countryName(place) { return place.country.replace(' [', ' (').replace(']', ')'); }

  /* The menu, by country: the United States first, since most of the long records are there. */
  function fillPlaces() {
    var typed = $('place-search').value.trim().toLowerCase(), menu = $('place'), groups = {}, names = [], count = 0;
    index.stations.forEach(function (place) {
      var country = countryName(place);
      if (typed && (place.label + ' ' + country).toLowerCase().indexOf(typed) < 0) return;
      if (!groups[country]) { groups[country] = []; names.push(country); }
      groups[country].push(place);
      count += 1;
    });
    names.sort(function (a, b) {
      return (a === 'United States' ? 0 : 1) - (b === 'United States' ? 0 : 1) || (a < b ? -1 : 1);
    });
    menu.textContent = '';
    if (!groups[countryName(places[state.place])] ||
        groups[countryName(places[state.place])].indexOf(places[state.place]) < 0) {
      var none = document.createElement('option');
      none.value = ''; none.disabled = true; none.selected = true;
      none.textContent = count ? 'Choose from ' + count + (count === 1 ? ' place' : ' places') : 'No place matches';
      menu.appendChild(none);
    }
    names.forEach(function (country) {
      var group = document.createElement('optgroup');
      group.label = country;
      groups[country].sort(function (a, b) { return a.label < b.label ? -1 : 1; }).forEach(function (place) {
        var option = document.createElement('option');
        option.value = place.id; option.textContent = place.label;
        option.selected = place.id === state.place;
        group.appendChild(option);
      });
      menu.appendChild(group);
    });
    return count;
  }

  function choosePlace(id) {
    if (!places[id] || id === state.place) return;
    state.place = id;
    state.t = null;
    showAll();
    changed();
  }

  /* The first place the typed letters match, for the Enter key. */
  function firstMatch() {
    var option = $('place').querySelector('optgroup option');
    return option ? option.value : '';
  }

  function placeHint() {
    if (!index) return '';
    var place = places[state.place], typed = $('place-search').value.trim();
    var words = where(place) + ', ' + commas(place.elevation) + NB + 'm above the sea. Compared: ' +
      years(place.early) + ' and ' + years(place.recent) +
      (place.shortPeriods ? ' (20 years each: the record here is shorter).' : '.');
    if (typed) {
      var count = $('place').querySelectorAll('optgroup option').length;
      words = (count ? count + (count === 1 ? ' place matches' : ' places match') : 'No place matches') +
        ' "' + typed + '". ' + words;
    }
    return words;
  }

  // ---- What the chosen place's days say (all of it from model.js) ----

  var prepared = {};

  /* The two periods' days in the season, and everything that doesn't change with the threshold. */
  function prepare(st) {
    var key = state.place + state.season, p = prepared[key], season = state.season;
    if (p) return p;
    var place = places[state.place];
    p = prepared[key] = { key: key, early: M.days(st, 'early', season), recent: M.days(st, 'recent', season) };
    p.compared = M.localAndGlobal(st, index.world);
    p.monthEarly = M.daysAMonth(st, season, span(st.early));
    p.monthRecent = M.daysAMonth(st, season, span(st.recent));
    p.meanEarly = M.mean(p.early); p.meanRecent = M.mean(p.recent);
    p.spreadEarly = M.spread(p.early); p.spreadRecent = M.spread(p.recent);
    p.start = M.startingThreshold(p.recent, season);
    p.janFeb = (season === 'cold') === st.north;
    if (p.compared.enough) {      // the projection uses the days of the years that count
      p.matched = M.days(st, 'recent', season, p.compared.recentYears);
      p.monthMatched = M.daysAMonth(st, season, p.compared.recentYears);
      p.already = M.warmingSince1850(index.world, p.compared.recentYears);
      p.most = M.addedWarming(place.P, M.SCENARIOS[M.SCENARIOS.length - 1].warming, p.already);
    }
    var low = Infinity, high = -Infinity;
    [p.early, p.recent].forEach(function (values) {
      values.forEach(function (value) { low = Math.min(low, value); high = Math.max(high, value); });
    });
    p.low = low / 10; p.high = high / 10;
    return p;
  }
  function span(period) {
    var list = [];
    for (var year = period[0]; year <= period[1]; year += 1) list.push(year);
    return list;
  }

  /* A smooth curve through some days, worked out once: 220 points across the days and a little beyond. */
  function curve(key, values) {
    if (curves[key]) return curves[key];
    var h = M.smoothingWidth(values), low = Infinity, high = -Infinity, xs = [];
    values.forEach(function (value) { low = Math.min(low, value); high = Math.max(high, value); });
    low = low / 10 - 3.5 * h; high = high / 10 + 3.5 * h;
    for (var i = 0; i < 220; i += 1) xs.push(low + (high - low) * i / 219);
    var ys = M.smoothCurve(values, h, xs), top = 0;
    ys.forEach(function (y) { top = Math.max(top, y); });
    return (curves[key] = { xs: xs, ys: ys, h: h, top: top });
  }

  function scenario() {
    for (var i = 0; i < M.SCENARIOS.length; i += 1) if (M.SCENARIOS[i].id === state.scenario) return M.SCENARIOS[i];
    return M.SCENARIOS[3];
  }
  function scenarioWords(s) { return s.name + ' (' + s.emissions + ' emissions)'; }

  /* The whole degrees a threshold can take in a view: the graph's own reach, in the reader's unit. */
  function reach(p, view) {
    var low = p.low, high = p.high;
    if (view === 'future') {
      low = Infinity; high = -Infinity;
      p.matched.forEach(function (value) { low = Math.min(low, value); high = Math.max(high, value); });
      low /= 10; high = high / 10 + Math.max(0, p.most);
    }
    var pad = (high - low) * 0.04 + 1;
    return [Math.floor(shown(low - pad)), Math.ceil(shown(high + pad))];
  }
  function startingThreshold(p) { return state.unit === 'F' ? p.start : Math.round((p.start - 32) / 1.8); }
  function threshold(p, view) {
    var limits = reach(p, view);
    return clamp(state.t === null ? startingThreshold(p) : state.t, limits[0], limits[1]);
  }
  function beyondWords(t) {
    return state.season === 'cold' ? 'at or below ' + degrees(t) : 'above ' + degrees(t);
  }
  function months(p) { return p.janFeb ? 'January and February' : 'July and August'; }

  // ---- The controls ----

  function ideaValue(key) { return state[key] === null ? CHAPTER[state.unit][key] : state[key]; }

  /* A slider and a number box for one of the bell curve's four numbers. */
  function ideaPair(key) {
    var number = $(key), range = $(key + '-range');
    function put() {
      var limits = REACH[state.unit][key];
      [number, range].forEach(function (input) {
        input.min = limits[0]; input.max = limits[1]; input.step = limits[2];
        input.value = ideaValue(key);
      });
    }
    function take(source) {
      var limits = REACH[state.unit][key], value = parseFloat(source.value);
      if (!isFinite(value)) { put(); return; }
      value = clamp(Math.round(value / limits[2]) * limits[2], limits[0], limits[1]);
      state[key] = value === CHAPTER[state.unit][key] ? null : value;
      put();
      changed();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    return put;
  }

  /* The threshold of the two views that use the place's days. They share one threshold. */
  function thresholdPair(view) {
    var number = $('t-' + view), range = $('t-' + view + '-range');
    function take(source) {
      var value = parseFloat(source.value);
      if (isFinite(value)) setThreshold(Math.round(value), view);
      else showAll();
    }
    range.addEventListener('input', function () { take(range); });
    number.addEventListener('change', function () { take(number); });
    $('reset-' + view).addEventListener('click', function () { state.t = null; showAll(); changed(); });
  }
  function setThreshold(value, view) {
    var st = station();
    if (!st) return;
    var p = prepare(st);
    if (view === 'future' && !p.matched) return;
    var limits = reach(p, view);
    value = clamp(value, limits[0], limits[1]);
    state.t = value === startingThreshold(p) ? null : value;
    showAll();
    changed();
  }

  function setUnit(unit) {
    if (unit === state.unit) return;
    var toF = unit === 'F';
    IDEA.forEach(function (key) {
      if (state[key] === null) return;
      var limits = REACH[unit][key], value = state[key];
      if (key === 'mean' || key === 'at') value = toF ? value * 1.8 + 32 : (value - 32) / 1.8;
      else value = toF ? value * 1.8 : value / 1.8;
      state[key] = clamp(Math.round(value / limits[2]) * limits[2], limits[0], limits[1]);
    });
    if (state.t !== null) state.t = Math.round(toF ? state.t * 1.8 + 32 : (state.t - 32) / 1.8);
    state.unit = unit;
    showAll();
    changed();
  }

  function radios(name, key, after) {
    Array.prototype.forEach.call(document.getElementsByName(name), function (input) {
      input.addEventListener('change', function () {
        if (!input.checked || state[key] === input.value) return;
        if (after) after(input.value); else { state[key] = input.value; showAll(); changed(); }
      });
    });
  }
  function check(name, value) {
    Array.prototype.forEach.call(document.getElementsByName(name), function (input) {
      input.checked = input.value === value;
    });
  }

  var putIdea = [];

  /* Put the state into every control, and the words that go with it. */
  function showAll() {
    var unit = unitName();
    check('unit', state.unit);
    putIdea.forEach(function (put) { put(); });
    say('mean-label', 'Average daily high (' + unit + ')');
    say('sd-label', 'Standard deviation (' + unit + ')');
    say('warm-label', 'Warming added to every day (' + unit + ')');
    say('at-label', 'Threshold: count the days above (' + unit + ')');
    say('sd-hint', 'How far a typical day is from the average. About 68% of days are within one standard ' +
      'deviation of it.');
    $('bar').hidden = state.view === 'about';
    $('place-control').hidden = state.view === 'idea';
    $('loading').hidden = !!index && !failed;
    check('season-periods', state.season); check('season-future', state.season);
    check('area', state.area);
    $('show').value = state.show;
    $('scenario').value = $('map-scenario').value = state.scenario;
    $('move').checked = state.move;
    $('key-moved').hidden = !state.move;
    $('map-scenario-control').hidden = state.show !== 'later';
    if (!index) return;
    var place = places[state.place], north = place.lat >= 0;
    if ($('place').value !== state.place) fillPlaces();
    say('place-hint', placeHint());
    var summer = north ? 'July and August' : 'January and February';
    var winter = north ? 'January and February' : 'July and August';
    ['periods', 'future'].forEach(function (view) {
      say('warm-name-' + view, 'Hot days: the daily highs of ' + summer);
      say('cold-name-' + view, 'Cold nights: the daily lows of ' + winter);
      say('t-label-' + view, 'Threshold (' + unit + ')');
    });
    say('key-early-periods', 'The earlier period, ' + years(place.early));
    say('key-recent-periods', 'The recent period, ' + years(place.recent));
    say('key-recent-future', 'The recent period, ' + years(place.recent) + ', as measured');
    var st = station();
    if (!st) return;
    var p = prepare(st);
    ['periods', 'future'].forEach(function (view) {
      var number = $('t-' + view), range = $('t-' + view + '-range'), off = view === 'future' && !p.matched;
      number.disabled = range.disabled = off;
      if (off) { say('t-hint-future', ''); return; }
      var limits = reach(p, view);
      [number, range].forEach(function (input) {
        input.min = limits[0]; input.max = limits[1]; input.step = 1;
        input.value = threshold(p, view);
      });
      say('t-hint-' + view, (state.season === 'cold'
        ? 'A cold night is one whose low is at or below the threshold. '
        : 'A hot day is one whose high is above the threshold. ') +
        'It starts at ' + degrees(startingThreshold(p)) + ', which about one recent ' +
        (state.season === 'cold' ? 'night' : 'day') + ' in ten is beyond.');
    });
  }

  function fillScenarios() {
    ['scenario', 'map-scenario'].forEach(function (id) {
      M.SCENARIOS.forEach(function (s) {
        var option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.emissions.charAt(0).toUpperCase() + s.emissions.slice(1) + ': ' + s.name;
        $(id).appendChild(option);
      });
    });
  }

  // ---- Drawing ----

  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var INK = '#152e3d', SPINE = '#87959e', TICK = '#394b57', GRID = '#e7edf0';
  var BLUE = '#0072b2', VERMILION = '#d55e00', GREEN = '#009e73', DASH = '#5f6d75';

  function ready(canvas) {
    var box = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    var w = Math.max(50, box.width), h = Math.max(50, box.height);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h, ratio: ratio };
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
  function digitsFor(gap) { return gap >= 1 ? 0 : gap >= 0.1 ? 1 : 2; }

  /* A canvas with nothing to draw yet says why. */
  function message(id, words) {
    var c = ready($(id)), ctx = c.ctx, line = '', lines = [], width = c.w - 40;
    ctx.font = '15px ' + FONT;
    words.split(' ').forEach(function (word) {
      if (line && ctx.measureText(line + ' ' + word).width > width) { lines.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    });
    lines.push(line);
    lines.forEach(function (each, i) {
      text(ctx, each, c.w / 2, c.h / 2 + (i - (lines.length - 1) / 2) * 22, { size: 15, align: 'center', color: INK });
    });
  }

  /* The frame every curve graph shares: temperature along the bottom, the share of days up the side.
   * low and high are in the reader's unit; top is the tallest curve, as a share of days in a 1-degree band. */
  function frame(id, low, high, top, across) {
    var c = ready($(id)), ctx = c.ctx, narrow = c.w < 480;
    var g = { ctx: ctx, w: c.w, h: c.h, x0: narrow ? 40 : 52, x1: c.w - (narrow ? 10 : 18), y0: 34, y1: c.h - 46,
      low: low, high: high, top: top * 1.14 };
    g.x = function (value) { return g.x0 + (value - low) / (high - low) * (g.x1 - g.x0); };
    g.y = function (share) { return g.y1 - share / g.top * (g.y1 - g.y0); };
    var gap = roundGap(g.top * 100, 4), digits = digitsFor(gap);
    for (var tick = 0; tick <= g.top * 100 + 1e-9; tick += gap) {
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.x0, g.y(tick / 100)); ctx.lineTo(g.x1, g.y(tick / 100)); ctx.stroke();
      text(ctx, fixed(tick, digits) + '%', g.x0 - 6, g.y(tick / 100), { size: 12, align: 'right', baseline: 'middle' });
    }
    gap = Math.max(1, roundGap(high - low, narrow ? 5 : 9));
    for (tick = Math.ceil(low / gap) * gap; tick <= high + 1e-9; tick += gap) {
      ctx.strokeStyle = GRID;
      ctx.beginPath(); ctx.moveTo(g.x(tick), g.y0); ctx.lineTo(g.x(tick), g.y1); ctx.stroke();
      ctx.strokeStyle = SPINE;
      ctx.beginPath(); ctx.moveTo(g.x(tick), g.y1); ctx.lineTo(g.x(tick), g.y1 + 5); ctx.stroke();
      text(ctx, fixed(tick, 0) + '°', g.x(tick), g.y1 + 9, { size: 12, align: 'center', baseline: 'top' });
    }
    ctx.strokeStyle = SPINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x0, g.y1); ctx.lineTo(g.x1, g.y1); ctx.stroke();
    text(ctx, narrow ? 'Share of days in each 1' + NB + unitName() + ' band'
      : 'Share of the days in each band 1' + NB + unitName() + ' wide', 6, 18, { size: 12.5, color: INK });
    text(ctx, across + ' (' + unitName() + ')', (g.x0 + g.x1) / 2, c.h - 8, { size: 12.5, align: 'center', color: INK });
    return g;
  }

  /* One curve on a frame. points is a list of [temperature, share]; the part beyond the threshold is shaded. */
  function trace(g, points, color, dashed, threshold, cold) {
    var ctx = g.ctx, i, part = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x0, g.y0 - 4, g.x1 - g.x0, g.y1 - g.y0 + 4); ctx.clip();
    for (i = 0; i < points.length; i += 1) {
      var here = points[i], before = points[i - 1];
      if (before && (before[0] - threshold) * (here[0] - threshold) < 0) {     // the curve at the threshold
        var along = (threshold - before[0]) / (here[0] - before[0]);
        part.push([threshold, before[1] + along * (here[1] - before[1])]);
        if (!cold) part = [part[part.length - 1]];
        else break;
      }
      if (cold ? here[0] <= threshold : here[0] >= threshold) part.push(here);
    }
    if (part.length > 1) {
      ctx.beginPath(); ctx.moveTo(g.x(part[0][0]), g.y(0));
      part.forEach(function (point) { ctx.lineTo(g.x(point[0]), g.y(point[1])); });
      ctx.lineTo(g.x(part[part.length - 1][0]), g.y(0)); ctx.closePath();
      ctx.globalAlpha = 0.28; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    points.forEach(function (point, n) {
      if (n) ctx.lineTo(g.x(point[0]), g.y(point[1])); else ctx.moveTo(g.x(point[0]), g.y(point[1]));
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.setLineDash(dashed ? [7, 5] : []); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  /* The threshold: a dashed line from top to bottom, named at the top on the side the counted days are on. */
  function thresholdLine(g, value, cold) {
    var ctx = g.ctx, x = g.x(value), words = cold ? degrees(value) + ' or below' : 'Above ' + degrees(value);
    if (value < g.low || value > g.high) {
      var right = value > g.high;
      text(ctx, right ? 'Threshold ' + degrees(value) + ' →' : '← Threshold ' + degrees(value),
        right ? g.x1 - 4 : g.x0 + 6, g.y0 + 12, { size: 12.5, bold: true, align: right ? 'right' : 'left', color: INK });
      return;
    }
    ctx.strokeStyle = DASH; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(x, g.y0 - 6); ctx.lineTo(x, g.y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 12.5px ' + FONT;
    var width = ctx.measureText(words).width, left = cold;
    if (left && x - 6 - width < g.x0) left = false;
    if (!left && x + 6 + width > g.x1) left = true;
    text(ctx, words, left ? x - 6 : x + 6, g.y0 + 8,
      { size: 12.5, bold: true, align: left ? 'right' : 'left', color: INK, halo: '#ffffff' });
  }

  /* A small mark on the bottom line at a curve's average. */
  function averageMark(g, value, color) {
    var ctx = g.ctx, x = g.x(value);
    if (value < g.low || value > g.high) return;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, g.y1 - 9); ctx.lineTo(x - 5, g.y1); ctx.lineTo(x + 5, g.y1); ctx.closePath(); ctx.fill();
  }

  // ---- View 1: the idea, with bell curves ----

  function drawIdea() {
    var mean = ideaValue('mean'), sd = ideaValue('sd'), warm = ideaValue('warm'), at = ideaValue('at');
    var low = mean - 4 * sd, high = mean + warm + 4 * sd;
    if (at > mean - 8 * sd && at < mean + warm + 8 * sd) { low = Math.min(low, at - sd); high = Math.max(high, at + sd); }
    var g = frame('idea', low, high, M.bell(mean, mean, sd), 'Daily high temperature');
    [[mean, BLUE], [mean + warm, VERMILION]].forEach(function (each) {
      var points = [];
      for (var i = 0; i <= 240; i += 1) {
        var x = low + (high - low) * i / 240;
        points.push([x, M.bell(x, each[0], sd)]);
      }
      trace(g, points, each[1], false, at, false);
      averageMark(g, each[0], each[1]);
    });
    thresholdLine(g, at, false);

    var before = M.shareAbove(at, mean, sd), after = M.shareAbove(at, mean + warm, sd);
    var ratio = M.timesAsOften(after, before);
    var words = 'With an average of ' + degrees(mean) + ' and a standard deviation of ' + degrees(sd, sd % 1 ? 1 : 0) +
      ', ' + percent(before) + ' of days are above ' + degrees(at) + ': about ' + perMonth(before * 31) +
      ' days in a 31-day month. ';
    if (warm > 0) {
      words += 'Warm every day by ' + degrees(warm, warm % 1 ? 1 : 0) + ' and the share is ' + percent(after) +
        ', about ' + perMonth(after * 31) + ' days a month' +
        (ratio !== null && before >= 1e-9 ? ': ' + times(ratio) + ' times as often. ' : '. ');
      words += 'The threshold is ' + fixed((at - mean) / sd, 1) + ' standard deviations from the old average and ' +
        fixed((at - mean - warm) / sd, 1) + ' from the new one.';
    } else {
      words += 'The threshold is ' + fixed((at - mean) / sd, 1) + ' standard deviations from the average. ' +
        'Add some warming to see the share change.';
    }
    say('idea-summary', words);
    say('at-hint', 'Now ' + fixed((at - mean) / sd, 1) + ' standard deviations above the average before the warming.');
  }

  // ---- Views 2 and 4: the place's days, as smooth curves ----

  var plots = {};      // where each graph's temperature axis is, for the pointer

  function curvePoints(c, shift) {
    var scale = state.unit === 'F' ? 1 / 1.8 : 1;      // a share per °C, as a share per degree shown
    return c.xs.map(function (x, i) { return [shown(x + shift), c.ys[i] * scale]; });
  }

  function drawPeriods(st) {
    var p = prepare(st), place = places[state.place], cold = state.season === 'cold';
    var limits = reach(p, 'periods'), t = threshold(p, 'periods'), cut = M.tenths(t, state.unit);
    var early = curve(p.key + 'early', p.early), recent = curve(p.key + 'recent', p.recent);
    var change = p.meanRecent - p.meanEarly, scale = state.unit === 'F' ? 1 / 1.8 : 1;
    var g = frame('periods', limits[0], limits[1], Math.max(early.top, recent.top) * scale,
      cold ? 'Daily low temperature' : 'Daily high temperature');
    plots.periods = g;
    trace(g, curvePoints(early, 0), BLUE, false, t, cold);
    if (state.move) trace(g, curvePoints(early, change), BLUE, true, t, cold);
    trace(g, curvePoints(recent, 0), VERMILION, false, t, cold);
    averageMark(g, shown(p.meanEarly), BLUE); averageMark(g, shown(p.meanRecent), VERMILION);
    thresholdLine(g, t, cold);

    var n1 = M.daysBeyond(p.early, cut, state.season), n2 = M.daysBeyond(p.recent, cut, state.season);
    var f1 = n1 / p.early.length, f2 = n2 / p.recent.length, ratio = M.timesAsOften(f2, f1);
    var thing = cold ? 'nights' : 'days';
    var words = place.label + ', daily ' + (cold ? 'lows' : 'highs') + ' in ' + months(p) + '. ' +
      (cold ? 'Nights ' : 'Days ') + beyondWords(t) + ': ' + commas(n1) + ' of ' + commas(p.early.length) + ' in ' +
      years(st.early) + ' (' + percent(f1) + ', or ' + perMonth(f1 * p.monthEarly) + ' ' + thing + ' a month) and ' + commas(n2) +
      ' of ' + commas(p.recent.length) + ' in ' + years(st.recent) + ' (' + percent(f2) + ', or ' +
      perMonth(f2 * p.monthRecent) + ' ' + thing + ' a month)';
    words += ratio === null ? '. There were none in the earlier period, so there\'s no ratio to work out. '
      : ': ' + times(ratio) + ' times as often. ';
    words += 'The average went from ' + temperature(p.meanEarly) + ' to ' + temperature(p.meanRecent) + ', ' +
      both(change) + (change < 0 ? ' cooler' : ' warmer') + '. The standard deviation went from ' +
      fixed(size(p.spreadEarly), 1) + ' to ' + fixed(size(p.spreadRecent), 1) + NB + unitName() + '.';
    if (state.move) {
      var moved = M.daysBeyond(p.early, cut, state.season, change) / p.early.length;
      words += ' Slide the earlier curve by the change in the average, with its shape kept, and ' + percent(moved) +
        ' of its ' + thing + ' are ' + beyondWords(t) + '.';
    }
    say('periods-summary', words);
  }

  function drawFuture(st) {
    var p = prepare(st), place = places[state.place], cold = state.season === 'cold', s = scenario();
    say('scenario-hint', 'By 2081–2100 the globe is ' + fixed(s.warming, 1) + NB + '°C (' +
      fixed(s.warming * 1.8, 1) + NB + '°F) warmer than in 1850–1900. Very likely range: ' +
      fixed(s.range[0], 1) + ' to ' + fixed(s.range[1], 1) + NB + '°C.');
    if (!p.matched) {
      var counted = p.compared.recentYears.length, before = p.compared.earlyYears.length;
      plots.future = null;
      message('future', 'Not enough complete years at this place to work this out.');
      say('future-summary', place.label + ' has ' + before + ' earlier and ' + counted + ' recent years with enough ' +
        'good days to count. The page needs ' + M.ENOUGH_YEARS + ' of each to say how much warming the recent ' +
        'period had already seen, so it doesn\'t work out the warming still to come here. Choose another place.');
      return;
    }
    var limits = reach(p, 'future'), t = threshold(p, 'future'), cut = M.tenths(t, state.unit);
    var added = M.addedWarming(place.P, s.warming, p.already);
    var recent = curve(p.key + 'matched', p.matched), scale = state.unit === 'F' ? 1 / 1.8 : 1;
    var g = frame('future', limits[0], limits[1], recent.top * scale,
      cold ? 'Daily low temperature' : 'Daily high temperature');
    plots.future = g;
    trace(g, curvePoints(recent, 0), VERMILION, false, t, cold);
    trace(g, curvePoints(recent, added), INK, true, t, cold);
    thresholdLine(g, t, cold);

    var N = p.matched.length, n1 = M.daysBeyond(p.matched, cut, state.season);
    var n2 = M.daysBeyond(p.matched, cut, state.season, added);
    var ratio = M.timesAsOften(n2 / N, n1 / N), left = s.warming - p.already;
    var words = 'Under ' + scenarioWords(s) + ' the globe is ' + fixed(s.warming, 1) + NB + '°C warmer in 2081–2100 ' +
      'than in 1850–1900. It was already ' + fixed(p.already, 2) + NB + '°C warmer in ' + years(st.recent) +
      ', which leaves ' + fixed(left, 2) + NB + '°C ' + (left < 0 ? 'of cooling' : 'still to come') + '. ' +
      place.label + ' warms about ' + fixed(place.P, 2) + NB + '°C for each 1' + NB + '°C of global warming, so the page ' +
      (added < 0 ? 'takes ' : 'adds ') + both(added) + (added < 0 ? ' from' : ' to') + ' every ' +
      (cold ? 'night' : 'day') + '. ' + (cold ? 'Nights ' : 'Days ') + beyondWords(t) + ' in ' + months(p) + ': ' +
      commas(n1) + ' of ' + commas(N) + ' as measured (' + percent(n1 / N) + ', or ' +
      perMonth(n1 / N * p.monthMatched) + (cold ? ' nights' : ' days') + ' a month), and ' + commas(n2) + ' with the added warming (' +
      percent(n2 / N) + ', or ' + perMonth(n2 / N * p.monthMatched) + (cold ? ' nights' : ' days') + ' a month)';
    words += ratio === null ? '. With none as measured, there\'s no ratio to work out.'
      : ': ' + times(ratio) + ' times as often.';
    say('future-summary', words);
  }

  /* Click or drag on a curve graph to put the threshold there; the arrow keys move it a degree at a time. */
  function thresholdByPointer(view) {
    var canvas = $(view), down = false;
    function put(event) {
      var g = plots[view];
      if (!g) return;
      var box = canvas.getBoundingClientRect();
      var value = g.low + (event.clientX - box.left - g.x0) / (g.x1 - g.x0) * (g.high - g.low);
      setThreshold(Math.round(value), view);
    }
    canvas.addEventListener('pointerdown', function (event) {
      down = true;
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* an old browser */ }
      put(event);
    });
    canvas.addEventListener('pointermove', function (event) { if (down && event.pointerType !== 'touch') put(event); });
    ['pointerup', 'pointercancel'].forEach(function (name) {
      canvas.addEventListener(name, function () { down = false; });
    });
    canvas.addEventListener('keydown', function (event) {
      var step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      var st = station();
      if (!step || !st) return;
      event.preventDefault();
      setThreshold(threshold(prepare(st), view) + step * (event.shiftKey ? 5 : 1), view);
    });
  }

  // ---- View 3: the place's years beside the globe's ----

  function drawWarming(st) {
    var p = prepare(st), place = places[state.place], both2 = p.compared, world = index.world;
    var early = both2.earlyYears.length, recent = both2.recentYears.length;
    if (!both2.local) {
      message('warming', 'No year of one of the two periods has enough good days to count.');
      say('warming-summary', place.label + ' has ' + early + ' earlier and ' + recent + ' recent years with ' +
        'enough good days to count, so there is nothing to compare here. Choose another place.');
      return;
    }
    var c = ready($('warming')), ctx = c.ctx, narrow = c.w < 480;
    var x0 = narrow ? 44 : 56, x1 = c.w - (narrow ? 10 : 18), y0 = 34, y1 = c.h - 40;
    var first = st.firstYear, last = first + st.yearly.length - 1, low = Infinity, high = -Infinity, year, value;
    var local = [], globe = [];
    for (year = first; year <= last; year += 1) {
      value = st.yearly[year - first];
      local.push(value === null ? null : size(value - both2.local.early));
      globe.push(size(world.anomaly[year - world.first] - both2.global.early));
    }
    local.concat(globe).forEach(function (each) {
      if (each !== null) { low = Math.min(low, each); high = Math.max(high, each); }
    });
    var gap = roundGap(high - low, 6);
    low = Math.floor(low / gap) * gap; high = Math.ceil(high / gap) * gap;
    function x(yr) { return x0 + (yr - first) / Math.max(1, last - first) * (x1 - x0); }
    function y(v) { return y1 - (v - low) / (high - low) * (y1 - y0); }

    [[st.early, BLUE], [st.recent, VERMILION]].forEach(function (each) {      // the two periods, shaded
      ctx.globalAlpha = 0.1; ctx.fillStyle = each[1];
      ctx.fillRect(x(each[0][0] - 0.5), y0, x(each[0][1] + 0.5) - x(each[0][0] - 0.5), y1 - y0);
      ctx.globalAlpha = 1;
    });
    for (var tick = low; tick <= high + 1e-9; tick += gap) {
      ctx.strokeStyle = Math.abs(tick) < 1e-9 ? SPINE : GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y(tick)); ctx.lineTo(x1, y(tick)); ctx.stroke();
      text(ctx, (tick > 1e-9 ? '+' : '') + fixed(tick, digitsFor(gap)) + '°', x0 - 6, y(tick),
        { size: 12, align: 'right', baseline: 'middle' });
    }
    var step = roundGap(last - first, narrow ? 4 : 8);
    for (year = Math.ceil(first / step) * step; year <= last; year += step) {
      ctx.strokeStyle = SPINE;
      ctx.beginPath(); ctx.moveTo(x(year), y1); ctx.lineTo(x(year), y1 + 5); ctx.stroke();
      text(ctx, String(year), x(year), y1 + 9, { size: 12, align: 'center', baseline: 'top' });
    }
    ctx.strokeStyle = SPINE;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    text(ctx, (narrow ? 'Difference from the ' : 'Difference from the average of ') + years(st.early) +
      (narrow ? ' average (' : ' (') + unitName() + ')', 6, 18, { size: 12.5, color: INK });

    function line(values, color, width, dots) {
      var open = false;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
      ctx.beginPath();
      values.forEach(function (each, i) {
        if (each === null) { open = false; return; }
        if (open) ctx.lineTo(x(first + i), y(each)); else ctx.moveTo(x(first + i), y(each));
        open = true;
      });
      ctx.stroke();
      if (dots) values.forEach(function (each, i) {      // a year with no neighbours would not show as a line
        if (each === null) return;
        ctx.beginPath(); ctx.arc(x(first + i), y(each), 1.8, 0, 2 * Math.PI); ctx.fill();
      });
    }
    line(local, GREEN, 1.6, true);
    line(globe, INK, 2.2, false);
    [[st.early, 0, 0], [st.recent, size(both2.local.change), size(both2.global.change)]].forEach(function (each) {
      [[each[1], GREEN, 6], [each[2], INK, 2.5]].forEach(function (bar) {     // a bar at each period's average
        ctx.strokeStyle = bar[1]; ctx.lineWidth = bar[2];
        ctx.beginPath(); ctx.moveTo(x(each[0][0] - 0.5), y(bar[0])); ctx.lineTo(x(each[0][1] + 0.5), y(bar[0])); ctx.stroke();
      });
    });
    [st.early, st.recent].forEach(function (period, i) {
      var middle = clamp((x(period[0]) + x(period[1])) / 2, x0 + 34, x1 - 34);
      text(ctx, years(period), middle, y0 + 6, { size: 12.5, bold: true, align: 'center', baseline: 'top',
        color: i ? '#a34800' : '#00598c', halo: '#ffffff' });
    });

    var words = place.label + ' was ' + both(both2.local.change) +
      (both2.local.change < 0 ? ' cooler' : ' warmer') + ' in ' + years(st.recent) + ' than in ' + years(st.early) +
      ', going by the ' + early + ' and ' + recent + ' years of those periods with enough good days to count. ' +
      'Over the same years the whole globe warmed ' + both(both2.global.change) + '.';
    if (both2.ratio !== null && both2.local.change > 0 && both2.global.change > 0) {
      words += ' The place warmed ' + times(both2.ratio) + ' times as much as the globe.';
    }
    if (!both2.enough) {
      words += ' With fewer than ' + M.ENOUGH_YEARS + ' years in one period, treat this comparison as rough.';
    }
    say('warming-summary', words);
  }

  // ---- View 5: the map ----

  var RADIAN = Math.PI / 180;

  /* The Mollweide projection of the whole world: an ellipse twice as wide as it is tall, in which every
   * patch keeps its true share of the area. forward gives x and y from -1 to 1; back undoes it. */
  var mollweide = {
    aspect: 2,
    forward: function (lon, lat) {
      var theta = lat * RADIAN, target = Math.PI * Math.sin(lat * RADIAN);
      for (var i = 0; i < 8 && Math.abs(lat) < 89.999; i += 1) {
        theta -= (2 * theta + Math.sin(2 * theta) - target) / (2 + 2 * Math.cos(2 * theta));
      }
      return [lon / 180 * Math.cos(theta), Math.sin(theta)];
    },
    back: function (x, y) {
      if (Math.abs(y) > 1) return null;
      var theta = Math.asin(y), lon = Math.abs(y) === 1 ? 0 : 180 * x / Math.cos(theta);
      if (Math.abs(lon) > 180) return null;
      return [lon, Math.asin(clamp((2 * theta + Math.sin(2 * theta)) / Math.PI, -1, 1)) / RADIAN];
    }
  };

  /* An Albers equal-area conic projection for the 48 states that touch, with standard parallels at
   * 29.5 and 45.5 degrees north and its middle at 96 degrees west. */
  var albers = (function () {
    var n = (Math.sin(29.5 * RADIAN) + Math.sin(45.5 * RADIAN)) / 2;
    var C = Math.pow(Math.cos(29.5 * RADIAN), 2) + 2 * n * Math.sin(29.5 * RADIAN);
    function rho(lat) { return Math.sqrt(C - 2 * n * Math.sin(lat * RADIAN)) / n; }
    var rho0 = rho(37.5), halfWidth = 0.405, top = 0.235, bottom = -0.265;
    return {
      aspect: 2 * halfWidth / (top - bottom),
      forward: function (lon, lat) {
        var angle = n * (lon + 96) * RADIAN, r = rho(lat);
        var x = r * Math.sin(angle), y = rho0 - r * Math.cos(angle);
        return [x / halfWidth, (y - (top + bottom) / 2) / ((top - bottom) / 2)];
      },
      back: function (px, py) {
        var x = px * halfWidth, y = py * (top - bottom) / 2 + (top + bottom) / 2;
        var r = Math.sqrt(x * x + (rho0 - y) * (rho0 - y)), sine = (C - r * r * n * n) / (2 * n);
        if (Math.abs(sine) > 1) return null;
        return [-96 + Math.atan2(x, rho0 - y) / n / RADIAN, Math.asin(sine) / RADIAN];
      }
    };
  }());

  // The colors of the warming maps: three blues for cooling, then pale yellow to dark red.
  var COLORS = ['#2166ac', '#67a9cf', '#d1e5f0', '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
    '#fc4e2a', '#e31a1c', '#b10026'];
  var EDGES = { C: [-1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4, 6], F: [-2, -1, 0, 1, 2, 3, 4, 6, 8, 12] };
  var NO_VALUE = '#d5d9dc', NONE = -32768;

  function colorOf(celsiusChange) {
    var edges = EDGES[state.unit], value = size(celsiusChange), i = 0;
    while (i < edges.length && value >= edges[i]) i += 1;
    return COLORS[i];
  }

  /* The warming the colors show at a longitude and latitude, in °C; null where there is no value.
   * layer.kind 'observed' reads the chosen place's HadCRUT5 map; 'later' reads the AR6 pattern. */
  function valueAt(layer, lon, lat) {
    var row, column, stored;
    if (layer.kind === 'observed') {
      row = clamp(Math.floor((lat + 90) / 5), 0, 35); column = clamp(Math.floor((lon + 180) / 5), 0, 71);
      stored = layer.values[row * 72 + column];
      return stored === NONE ? null : stored / 100;
    }
    row = clamp(Math.floor(lat + 90), 0, 179); column = clamp(Math.floor((lon + 360) % 360), 0, 359);
    stored = layer.values[row * 360 + column];
    return stored === NONE ? null : stored / 100 * layer.left;
  }

  var painted = { key: '', canvas: null };

  /* The colors, pixel by pixel: each pixel asks the projection where on Earth it is. Kept until something
   * changes, so moving the pointer costs nothing. */
  function paint(layer, projection, width, height, ratio) {
    var key = [layer.key, state.area, state.unit, width, height, ratio].join('|');
    if (painted.key === key) return painted.canvas;
    var canvas = document.createElement('canvas'), w = Math.round(width * ratio), h = Math.round(height * ratio);
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d'), image = ctx.createImageData(w, h), data = image.data, known = {};
    function rgb(hex) {
      return known[hex] || (known[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)]);
    }
    for (var j = 0; j < h; j += 1) {
      for (var i = 0; i < w; i += 1) {
        var spot = projection.back((i + 0.5) / w * 2 - 1, 1 - (j + 0.5) / h * 2);
        if (!spot) continue;
        var value = valueAt(layer, spot[0], spot[1]), color = rgb(value === null ? NO_VALUE : colorOf(value));
        var at = 4 * (j * w + i);
        data[at] = color[0]; data[at + 1] = color[1]; data[at + 2] = color[2]; data[at + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    painted = { key: key, canvas: canvas };
    return canvas;
  }

  var mapPlot = null;       // where the map is on the canvas, and where the dots are
  var pointed = '';         // what the pointer is on, in words

  /* What the colors are to show, or the reason they can't. */
  function mapLayer(st, p) {
    if (state.show === 'observed') {
      return { kind: 'observed', key: 'observed' + state.place, values: st.mapChange };
    }
    if (state.show === 'later') {
      if (!p.matched) return { missing: 'There aren\'t enough complete years at this place to say how much ' +
        'warming is still to come, so the map shows the places only.' };
      if (!pattern || typeof pattern === 'string') {
        return { missing: pattern === 'failed' ? 'The map of warming didn\'t load. Check your connection and ' +
          'load the page again.' : 'Loading the map of warming…' };
      }
      return { kind: 'later', key: 'later' + state.place + state.scenario, values: pattern,
        left: scenario().warming - p.already };
    }
    return null;
  }

  function drawMap(st) {
    var canvas = $('map'), projection = state.area === 'us' ? albers : mollweide;
    var place = places[state.place], p = st ? prepare(st) : null, layer = st ? mapLayer(st, p) : null;
    var colored = layer && !layer.missing;
    var box = canvas.getBoundingClientRect(), pad = 6, legend = colored ? 62 : 0;
    var mapWidth = Math.max(50, box.width) - 2 * pad, mapHeight = Math.round(mapWidth / projection.aspect);
    canvas.style.height = (mapHeight + 2 * pad + legend) + 'px';
    var c = ready(canvas), ctx = c.ctx, narrow = c.w < 480;
    function px(spot) { return [pad + (spot[0] + 1) / 2 * mapWidth, pad + (1 - spot[1]) / 2 * mapHeight]; }
    function outline() {
      ctx.beginPath();
      if (projection === mollweide) {
        ctx.ellipse(pad + mapWidth / 2, pad + mapHeight / 2, mapWidth / 2, mapHeight / 2, 0, 0, 2 * Math.PI);
      } else ctx.rect(pad, pad, mapWidth, mapHeight);
    }
    outline(); ctx.fillStyle = '#f3f6f7'; ctx.fill();
    ctx.save(); outline(); ctx.clip();
    if (colored) ctx.drawImage(paint(layer, projection, mapWidth, mapHeight, Math.min(2, c.ratio)), pad, pad, mapWidth, mapHeight);
    if (coast && typeof coast !== 'string') {
      coast.forEach(function (line) {
        var before = null;
        ctx.beginPath();
        line.points.forEach(function (point) {
          var far = projection === albers && (point[0] > -40 || point[1] < 5);
          var jump = before && Math.abs(point[0] - before[0]) > 180;
          var spot = far ? null : px(projection.forward(point[0], point[1]));
          if (spot && before && !jump && !before.far) ctx.lineTo(spot[0], spot[1]);
          else if (spot) ctx.moveTo(spot[0], spot[1]);
          before = [point[0], point[1]]; before.far = far;
        });
        ctx.strokeStyle = line.border ? (colored ? 'rgba(21,46,61,0.45)' : '#b3bdc3') : (colored ? INK : '#5f6d75');
        ctx.lineWidth = line.border ? 0.6 : 0.9;
        ctx.stroke();
      });
    }
    ctx.restore();
    outline(); ctx.strokeStyle = SPINE; ctx.lineWidth = 1; ctx.stroke();

    var dots = [], chosen = null, radius = narrow ? 3 : 3.6;
    index.stations.forEach(function (each) {
      var spot = projection.forward(each.lon, each.lat);
      if (projection === albers && (Math.abs(spot[0]) > 1 || Math.abs(spot[1]) > 1 || each.lon > -40)) return;
      var dot = { place: each, at: px(spot) };
      dots.push(dot);
      if (each.id === state.place) chosen = dot;
    });
    dots.forEach(function (dot) {
      if (dot === chosen) return;
      ctx.beginPath(); ctx.arc(dot.at[0], dot.at[1], radius, 0, 2 * Math.PI);
      ctx.fillStyle = INK; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
    });
    if (chosen) {
      ctx.beginPath(); ctx.arc(chosen.at[0], chosen.at[1], radius + 3.4, 0, 2 * Math.PI);
      ctx.fillStyle = VERMILION; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(chosen.at[0], chosen.at[1], radius + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    }
    mapPlot = { pad: pad, width: mapWidth, height: mapHeight, projection: projection, dots: dots,
      layer: colored ? layer : null };

    if (colored) {        // the legend: a row of the colors with the numbers where one meets the next
      var edges = EDGES[state.unit], wide = Math.min(mapWidth, 520), each = wide / COLORS.length;
      var left = pad + (mapWidth - wide) / 2, top = pad + mapHeight + 28;
      text(ctx, (layer.kind === 'observed' ? 'Measured warming (' : 'Warming still to come (') + unitName() +
        '); blue is cooling', left, top - 8, { size: 12.5, color: INK });
      COLORS.forEach(function (color, i) {
        ctx.fillStyle = color; ctx.fillRect(left + i * each, top, each + 0.5, 12);
      });
      ctx.strokeStyle = SPINE; ctx.lineWidth = 1; ctx.strokeRect(left, top, wide, 12);
      edges.forEach(function (edge, i) {
        text(ctx, fixed(edge, edge % 1 ? 1 : 0), left + (i + 1) * each, top + 16,
          { size: narrow ? 10.5 : 12, align: 'center', baseline: 'top' });
      });
    }

    var inUS = 0;
    index.stations.forEach(function (each) { if (each.country === 'United States') inUS += 1; });
    var words = index.stations.length + ' places have a record long and complete enough to use, ' + inUS +
      ' of them in the states of the United States. Chosen: ' + place.label + ', at ' + where(place) + '.';
    if (state.area === 'us' && !chosen) words += ' It is outside this map.';
    if (layer && layer.missing) words += ' ' + layer.missing;
    if (colored && layer.kind === 'observed') {
      var here = valueAt(layer, place.lon, place.lat);
      words += ' The colors show how much each box of the HadCRUT5 map, 5° on a side, warmed between ' +
        years(st.early) + ' and ' + years(st.recent) + ', the two periods compared at this place. Gray boxes ' +
        'have too few measurements. ' + (here === null ? 'The box around the place is one of them.'
          : 'The box around the place warmed ' + both(here) + '.') +
        (p.compared.local ? ' The station\'s own record ' + (p.compared.local.change < 0 ? 'cooled ' : 'warmed ') +
          both(p.compared.local.change) + '.' : '');
    }
    if (colored && layer.kind === 'later') {
      var s = scenario();
      words += ' The colors show the warming still to come between ' + years(st.recent) + ' and 2081–2100 under ' +
        scenarioWords(s) + ': the ' + fixed(layer.left, 2) + NB + '°C of global warming still to come, times the ' +
        'IPCC\'s map of how much each spot warms for each 1' + NB + '°C. At this place that is ' +
        both(M.addedWarming(place.P, s.warming, p.already)) + '.';
    }
    say('map-summary', words);
    say('show-hint', state.show === 'observed' ? 'From thermometers on land and at sea, gathered into the ' +
      'HadCRUT5 record. The two periods are the chosen place\'s.'
      : state.show === 'later' ? 'A map from the climate models of IPCC AR6, scaled to the scenario. ' +
        'It starts from the chosen place\'s recent period.' : '');
    say('map-readout', pointed || TAP_HINT);
  }

  /* The dot nearest a spot on the canvas, if one is within reach of a finger. */
  function nearestDot(event) {
    if (!mapPlot) return null;
    var box = $('map').getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    var best = null, least = 22 * 22;
    mapPlot.dots.forEach(function (dot) {
      var d = (dot.at[0] - x) * (dot.at[0] - x) + (dot.at[1] - y) * (dot.at[1] - y);
      if (d < least) { least = d; best = dot; }
    });
    return { dot: best, x: x, y: y };
  }

  function mapPointer() {
    var canvas = $('map');
    canvas.addEventListener('pointermove', function (event) {
      var near = nearestDot(event), words = '';
      if (!near) return;
      if (near.dot) {
        words = near.dot.place.label + ' (' + years(near.dot.place.early) + ' and ' + years(near.dot.place.recent) +
          ')' + (near.dot.place.id === state.place ? ': the place you\'ve chosen.' : '. Click or tap to choose it.');
      } else if (mapPlot.layer) {
        var across = (near.x - mapPlot.pad) / mapPlot.width * 2 - 1;
        var up = 1 - (near.y - mapPlot.pad) / mapPlot.height * 2;
        var spot = Math.abs(across) > 1 || Math.abs(up) > 1 ? null : mapPlot.projection.back(across, up);
        var value = spot ? valueAt(mapPlot.layer, spot[0], spot[1]) : null;
        if (spot) {
          words = 'Near ' + fixed(Math.abs(spot[1]), 0) + '°' + NB + (spot[1] < 0 ? 'S' : 'N') + ', ' +
            fixed(Math.abs(spot[0]), 0) + '°' + NB + (spot[0] < 0 ? 'W' : 'E') + ': ' +
            (value === null ? 'too few measurements.' : (value < 0 ? 'cooling of ' : 'warming of ') + both(value) + '.');
        }
      }
      pointed = words;
      say('map-readout', pointed || TAP_HINT);
    });
    canvas.addEventListener('pointerleave', function () {
      pointed = '';
      say('map-readout', TAP_HINT);
    });
    canvas.addEventListener('click', function (event) {
      var near = nearestDot(event);
      if (near && near.dot) { pointed = ''; choosePlace(near.dot.place.id); }
    });
    canvas.addEventListener('keydown', function (event) {
      var step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!step || !index) return;
      event.preventDefault();
      var list = index.stations, at = list.indexOf(places[state.place]);
      pointed = '';
      choosePlace(list[(at + step + list.length) % list.length].id);
    });
  }

  // ---- Putting it together ----

  function draw() {
    var view = state.view, place = index ? places[state.place] : null;
    if (view === 'about') return;
    if (view === 'idea') { drawIdea(); return; }
    var st = station();
    if (place) {
      say('periods-title', place.label + ': the same place, ' + (place.recent[0] - place.early[0]) + ' years apart');
      say('warming-title', 'How much ' + place.name + ' warmed, and how much the globe did');
      say('future-title', place.label + ': add the warming still to come');
    }
    if (view === 'map') {
      if (!index) { message('map', waiting()); return; }
      loadMapFiles();
      drawMap(st);
      return;
    }
    if (!st) {
      message(view, waiting());
      say(view + '-summary', waiting());
      return;
    }
    if (view === 'periods') drawPeriods(st);
    if (view === 'warming') drawWarming(st);
    if (view === 'future') drawFuture(st);
  }

  // ---- The address keeps the state, so a view can be bookmarked or sent to someone ----

  function readAddress() {
    var query = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      if (!query.has(key)) return;
      var value = query.get(key);
      if (NUMBERS.indexOf(key) >= 0) { if (value !== '' && isFinite(+value)) state[key] = +value; }
      else if (key === 'move') state.move = value === '1';
      else state[key] = value;
    });
    if (VIEWS.indexOf(state.view) < 0) state.view = DEFAULTS.view;
    if (state.unit !== 'C') state.unit = 'F';
    if (state.season !== 'cold') state.season = 'warm';
    if (state.area !== 'us') state.area = 'world';
    if (['places', 'observed', 'later'].indexOf(state.show) < 0) state.show = 'places';
    if (!M.SCENARIOS.some(function (s) { return s.id === state.scenario; })) state.scenario = DEFAULTS.scenario;
    if (state.t !== null) state.t = Math.round(state.t);
    IDEA.forEach(function (key) {
      if (state[key] === null) return;
      var limits = REACH[state.unit][key];
      state[key] = clamp(Math.round(state[key] / limits[2]) * limits[2], limits[0], limits[1]);
      if (state[key] === CHAPTER[state.unit][key]) state[key] = null;
    });
    if (query.get('embed') === '1') document.body.classList.add('embed');
  }

  function saveToAddress() {
    var parts = [];
    Object.keys(DEFAULTS).forEach(function (key) {
      if (state[key] === DEFAULTS[key]) return;
      parts.push(key + '=' + encodeURIComponent(state[key] === true ? 1 : state[key]));
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
    VIEWS.forEach(function (name) {
      var tab = $('tab-' + name), on = name === view;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + name).hidden = !on;
      if (on && focus) tab.focus();
    });
    showAll();
    changed();
  }

  /* The code, shown in the page: fetched the first time its box is opened. */
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

  function start() {
    readAddress();
    fillScenarios();
    IDEA.forEach(function (key) { putIdea.push(ideaPair(key)); });
    thresholdPair('periods'); thresholdPair('future');
    thresholdByPointer('periods'); thresholdByPointer('future');
    mapPointer();
    radios('unit', 'unit', setUnit);
    radios('season-periods', 'season', setSeason); radios('season-future', 'season', setSeason);
    radios('area', 'area');
    function setSeason(season) { state.season = season; state.t = null; showAll(); changed(); }
    $('show').addEventListener('change', function () { state.show = $('show').value; showAll(); changed(); });
    ['scenario', 'map-scenario'].forEach(function (id) {
      $(id).addEventListener('change', function () { state.scenario = $(id).value; showAll(); changed(); });
    });
    $('move').addEventListener('change', function () { state.move = $('move').checked; showAll(); changed(); });
    $('place').addEventListener('change', function () { choosePlace($('place').value); });
    $('place-search').addEventListener('input', function () {
      if (!index) return;
      fillPlaces();
      say('place-hint', placeHint());
    });
    $('place-search').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !index) return;
      event.preventDefault();
      var id = firstMatch();
      if (id) { $('place-search').value = ''; choosePlace(id); fillPlaces(); say('place-hint', placeHint()); }
    });
    $('two-sd').addEventListener('click', function () { thresholdAt(2); });
    $('three-sd').addEventListener('click', function () { thresholdAt(3); });
    function thresholdAt(deviations) {
      var limits = REACH[state.unit].at, value = Math.round(ideaValue('mean') + deviations * ideaValue('sd'));
      value = clamp(value, limits[0], limits[1]);
      state.at = value === CHAPTER[state.unit].at ? null : value;
      showAll(); changed();
    }
    $('reset-idea').addEventListener('click', function () {
      IDEA.forEach(function (key) { state[key] = null; });
      showAll(); changed();
    });
    VIEWS.forEach(function (view, i) {
      var tab = $('tab-' + view);
      tab.addEventListener('click', function () { selectView(view, false); });
      tab.addEventListener('keydown', function (event) {
        var to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: VIEWS.length - 1 }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        selectView(VIEWS[(to + VIEWS.length) % VIEWS.length], true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('details.code'), function (details) {
      details.addEventListener('toggle', function () { showCode(details); });
    });
    window.addEventListener('resize', changed);
    selectView(state.view, false);
    goToAddressPlace();
    loadIndex();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
