/* Milankovitch model: Sunlight at the top of the atmosphere from Earth's orbit.
 *
 * These are the equations on the page's About tab. There's no drawing and no
 * page code here, so the same file runs in a browser and in Node (for the tests).
 *
 * Angles are in radians unless a name ends in Deg. Each name is followed by its
 * letter on the About tab.
 *   ecc   e: eccentricity of Earth's orbit
 *   obl   ε: obliquity, the tilt of Earth's axis
 *   peri  ϖ: longitude of perihelion, measured from the moving March equinox,
 *         as in Laskar et al. (2004). It's Earth's own position, seen from the
 *         Sun, when Earth is closest to the Sun (102.9° today).
 *   lam   λ: the Sun's longitude seen from Earth, which is the season.
 *         0 = March equinox, 90° = June solstice, 180° = September equinox,
 *         270° = December solstice.
 *   lat   φ: latitude, positive to the north
 * Earth, seen from the Sun, is half a turn from the Sun seen from Earth. That's
 * the "+ PI" below.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Milankovitch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RAD = Math.PI / 180;
  var S0 = 1361;              // S: W/m², the book's solar constant (Chapter 2)
  var FIRST_KYR = -20000;     // orbit.bin's first and last rows,
  var LAST_KYR = 20000;       // in thousands of years from now
  var MID_JULY = 120 * RAD;   // Berger and Loutre's "mid-month" July (Figure 5.13)
  // Laskar et al. (2004) at year 0 (J2000).
  var PRESENT = { ecc: 0.016702, obl: 23.4393 * RAD, peri: 102.918 * RAD };

  /* Step 1 on the About tab. (a/r)²: (mean distance / distance)², the factor by
   * which Sunlight is stronger than at the mean distance. */
  function distanceFactor(ecc, peri, lam) {
    var anomaly = lam + Math.PI - peri;           // θ: Earth's angle from perihelion
    var ratio = (1 + ecc * Math.cos(anomaly)) / (1 - ecc * ecc);   // a/r
    return ratio * ratio;
  }

  /* Steps 2 to 6 on the About tab. Q: daily-mean Sunlight at the top of the
   * atmosphere, W/m², at latitude lat in season lam. */
  function dailyInsolation(ecc, obl, peri, lam, lat) {
    // Step 2. δ: the latitude where the Sun is overhead at noon.
    var dec = Math.asin(Math.sin(obl) * Math.sin(lam));
    // Step 4. h₀: the angle Earth turns between noon and sunset. It's half a
    // turn where the Sun never sets, and zero where the Sun never rises.
    var x = -Math.tan(lat) * Math.tan(dec);
    var h0 = x <= -1 ? Math.PI : x >= 1 ? 0 : Math.acos(x);
    // Step 5. C: the average over the 24 hours of cos Z, which is step 3.
    var meanCos = (h0 * Math.sin(lat) * Math.sin(dec) +
                   Math.cos(lat) * Math.cos(dec) * Math.sin(h0)) / Math.PI;
    // Step 6. Q.
    var q = S0 * distanceFactor(ecc, peri, lam) * meanCos;
    return q > 0 ? q : 0;
  }

  /* Mid-July Sunlight at 65 °N: the series in the book's Figures 5.13 and 5.15. */
  function summer65N(ecc, obl, peri) {
    return dailyInsolation(ecc, obl, peri, MID_JULY, 65 * RAD);
  }

  /* The precession index, e sin ϖ. It's positive when Earth is farthest from the
   * Sun in northern summer, as it is today. */
  function precessionIndex(ecc, peri) {
    return ecc * Math.sin(peri);
  }

  /* Sunlight by latitude (rows, south to north) and by season (columns, from one
   * December solstice to the next). Returns { nLat, nLon, latDeg[], lamDeg[], q }.
   * q is a Float32Array, and q[j * nLon + i] is row j, column i. */
  function insolationGrid(ecc, obl, peri, nLat, nLon) {
    nLat = nLat || 91; nLon = nLon || 181;
    var latDeg = [], lamDeg = [], q = new Float32Array(nLat * nLon), i, j;
    for (j = 0; j < nLat; j++) latDeg.push(-90 + 180 * j / (nLat - 1));
    for (i = 0; i < nLon; i++) lamDeg.push(-90 + 360 * i / (nLon - 1));
    for (j = 0; j < nLat; j++) {
      for (i = 0; i < nLon; i++) {
        q[j * nLon + i] =
          dailyInsolation(ecc, obl, peri, lamDeg[i] * RAD, latDeg[j] * RAD);
      }
    }
    return { nLat: nLat, nLon: nLon, latDeg: latDeg, lamDeg: lamDeg, q: q };
  }

  /* Read orbit.bin (an ArrayBuffer): three numbers for every thousand years.
   * Returns at(kyr) -> { ecc, obl, peri }. */
  function orbitTable(buffer) {
    var view = new DataView(buffer);
    var rows = LAST_KYR - FIRST_KYR + 1;
    if (buffer.byteLength !== rows * 12) {
      throw new Error('orbit.bin has the wrong size');
    }
    return {
      first: FIRST_KYR, last: LAST_KYR,
      at: function (kyr) {
        var k = Math.round(kyr);
        if (k < FIRST_KYR || k > LAST_KYR) {
          throw new RangeError('outside the orbital data: ' + kyr);
        }
        var o = (k - FIRST_KYR) * 12;
        return {
          ecc: view.getFloat32(o, true),
          obl: view.getFloat32(o + 4, true),
          peri: view.getFloat32(o + 8, true)
        };
      }
    };
  }

  /* Roughly when in the year the Sun is at longitude lamDeg, in thirds of a
   * month: 120 gives "mid-July", the name Berger and Loutre use for it. The
   * solstices and equinoxes (the 20th or 21st) fall at the end of the middle
   * third, so 90 gives "mid-June". It's approximate: it counts equal shares of
   * the orbit, from the March equinox, as equal shares of the year. */
  function seasonName(lamDeg) {
    var lam = ((lamDeg % 360) + 360) % 360;
    var day = (79 + lam / 360 * 365.25) % 365.25;      // March 20 is about day 79
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    var starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365.25];
    var m = 11;
    for (var k = 0; k < 12; k++) {
      if (day >= starts[k] && day < starts[k + 1]) { m = k; break; }
    }
    var part = (day - starts[m]) / (starts[m + 1] - starts[m]);
    return (part < 1 / 3 ? 'early ' : part < 2 / 3 ? 'mid-' : 'late ') + months[m];
  }

  /* Roughly when in the year Earth is closest to the Sun: "early January" today. */
  function perihelionSeason(peri) {
    return seasonName(peri / RAD + 180);        // the Sun's longitude at perihelion
  }

  return {
    S0: S0, RAD: RAD, FIRST_KYR: FIRST_KYR, LAST_KYR: LAST_KYR, MID_JULY: MID_JULY,
    PRESENT: PRESENT,
    distanceFactor: distanceFactor, dailyInsolation: dailyInsolation,
    summer65N: summer65N, precessionIndex: precessionIndex,
    insolationGrid: insolationGrid, orbitTable: orbitTable,
    seasonName: seasonName, perihelionSeason: perihelionSeason
  };
});
