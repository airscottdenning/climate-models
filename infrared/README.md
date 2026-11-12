# Earthlight Seen from Space: Greenhouse Gases and the Infrared Spectrum

A page for teaching how greenhouse gases change the infrared light that Earth sends to space. The reader sets carbon dioxide, methane and water vapor, and the page draws the spectrum a satellite would see looking straight down, with the totals in W/m². It goes with Chapter 3 (Figures 3.8 and 3.9).

- **Public address:** `/models/infrared/` on simpleserioussolvable.org.
- **Everything runs in the reader's browser.** There's no server, no build step and no outside library.
- **The physics was done ahead of time.** A research model, ARTS, calculated the spectra for 90 mixes of gases. The page fills in between them, in about a thousandth of a second.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the glow of a black surface, and the filling in between the calculated mixes. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls and the drawing |
| `web/tables.bin`, `web/tables.json` | The spectra and totals from ARTS (817 kB), and the list of what's in them |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |
| `build_data.py` | Makes the two `tables` files from the ARTS results |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The three tabs

- **The spectrum:** the Earthlight leaving the top of the atmosphere at each wavelength from 4 to 30 µm, for a midlatitude summer sky or a tropical one. Thin curves show how brightly a black surface glows at the surface's temperature and at 220, 240, 260 and 280 K, so the height of the spectrum reads as a temperature. Under the graph are three totals: the Earthlight leaving the top, the Earthlight the sky sends down to the surface, and what the surface loses. A spectrum can be kept and compared with the next one. A menu holds a few far-out mixes, such as air with 1 ppm of carbon dioxide.
- **How it works:** how the air absorbs and gives off infrared light on the way up, with three drawings.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the spectra come from, how the model was checked, and the code.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/infrared/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_infrared_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers. Its two sides must agree.
  - The worked example must end on the model's number. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the tables and looked for in the text: the things to try, the surface's total, the height of the top of the air, and the counts of mixes that were checked.
  - A label in quotation marks must be a button on the page. The sliders must stop where the tables do. Links must lead somewhere. The figure numbers and the chapter's title must match Chapter 3.
- **So some changes elsewhere fail a test until the About text follows:** new tables, a change to `model.js`, a renamed button, or a figure added, removed or moved ahead of Figure 3.9 in Chapter 3. The failure says what the text should say.
- **A link can open one section:** `/models/infrared/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8791 --bind 127.0.0.1 --directory models/infrared/web
```

Then open `http://127.0.0.1:8791/`. Opening `index.html` straight from the disk doesn't work, because a browser won't load `tables.bin` that way.

## Addresses that open a chosen state

The page keeps its state in the address, so any view can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `spectrum`, `how` or `about`. After `how` or `about`, a `#` and a section's name opens that section |
| `sky` | `midlatitude` or `tropical` |
| `co2`, `ch4`, `water` | Carbon dioxide (ppm), methane (ppb) and water vapor (times the sky's usual humidity) |
| `far` | One of the far-out mixes, such as `co2-1` or `ch4-high`. `tables.json` lists them |
| `keep` | The kept spectrum, written by the page |
| `embed=1` | The compact layout for an iframe in the book, with an "Open in a new window" link |

Example: `/models/infrared/?co2=840`.

## The science

- **The research model** is ARTS, the Atmospheric Radiative Transfer Simulator, version 2.6.16: Buehler et al. (2025), doi:10.1016/j.jqsrt.2025.109443. It adds up the absorption lines of each gas, one by one, through 240 levels of air.
- **The air** is one of two standard columns that come with ARTS, the FASCOD midlatitude-summer and tropical profiles, from the surface to about 81 km. The sky is clear. The surface is black, at 294.2 K or 299.7 K.
- **The mixes:** 45 in each column. Carbon dioxide at 105, 420 and 1,680 ppm, methane at 475, 1,900 and 6,000 ppb, and water vapor at 0.5, 0.75, 1, 1.25 and 1.5 times the column's usual humidity.
- **The spectrum** is the brightness looking straight down from the top of the air, in W/m² per steradian per µm, smoothed and read at 2,000 wavelengths from 4 to 30 µm.
- **The totals** were calculated by ARTS separately, over 24 directions and over wavelengths from 2 to 200 µm. They aren't added up from the graph.
- **The filling in** is a smooth curve through the calculated values that never overshoots them (Fritsch and Carlson, 1980, doi:10.1137/0717021; Fritsch and Butland, 1984, doi:10.1137/0905021). It's the curve SciPy calls PCHIP. The page fills in along water vapor first, then methane, then carbon dioxide. The two gases are counted in doublings from today's amount, and water vapor in multiples of the usual humidity.
- **The far-out mixes** aren't filled in. Each is one spectrum that ARTS calculated directly, and the page gives no totals for them.

**This is one clear column of air on one summer day, not the whole Earth.** Its 274 W/m² isn't the planet's average of about 240 W/m², and its surface isn't at the planet's average temperature. What carries over to the whole Earth is how the spectrum changes when a gas is added. The About tab says what stays fixed: no clouds, a surface that doesn't warm, and air whose temperature doesn't change.

## How it was checked

1. **The filling in, against ARTS.** ARTS was run for 16 more mixes that aren't in the tables. The filled-in spectra differ from them by less than 0.1% of the spectrum's peak in the typical case, and by 0.65% at the worst wavelength. For 32 more mixes, the filled-in totals are within 0.08 W/m² at the top of the atmosphere and 0.09 W/m² at the surface. Both sides of this check come from ARTS, so it tests the filling in and not ARTS.
2. **The page's code, against a second program.** The filling in was first written in Python with SciPy. For 186 mixes, `model.js` gives the same 2,000-point spectra and the same totals as that program, to four decimal places. The test runs all 186 when the full set of answers is at hand. A sample of 28 is kept with the test, so the check also runs where the full set isn't.
3. **A second calculation in the test itself.** `tests/test_infrared_model.py` works out the same answers a different way, in plain Python, and compares them with both programs.
4. **The tables, against physics.** No spectrum is brighter at any wavelength than the black surface under it. The surface's total equals the glow of a black surface added up from 2 to 200 µm. More of any gas lets less out of the top and sends more down. The surface's loss is its glow minus what the sky sends back.
5. **The research model, against a measurement.** Chapter 3 lays an ARTS spectrum for the midlatitude summer column over one that NASA's AIRS instrument measured from orbit (Figure 3.8). They agree within a degree or two across the window and the water vapor and ozone bands.

The far-out spectra have had less checking. The two with the most gas (10,000 ppm of carbon dioxide and 100,000 ppb of methane) passed a test of whether the model's wavelengths were fine enough. The others didn't get that test.

## What changed from the first version

The first page was written by Scott Denning with OpenAI Codex, in the project that made the tables. This one keeps its numbers and rebuilds the page around them.

- **The numbers are the same.** The tables are the first version's, packed into one file of 32-bit numbers instead of 17 files of 64-bit ones. That halves the download and changes no number by more than 1 part in 10 million.
- **The code is plain JavaScript in two files** that a student can read, with no step that builds it.
- **The words are the book's:** Earthlight, W/m², "leaving the top of the atmosphere". The How it works tab keeps the first version's text, lightly edited.
- **The About tab is new.** It gives the equations, a worked example and things to try. The first version's About tab listed where the data came from.
- **The graph can be read without a mouse.** The arrow keys move along it, the numbers under it are text, and a sentence under them sums up the spectrum.
- **A slider that couldn't move is gone.** The first page showed a control for the surface's temperature, fixed in place because the tables don't cover it.
- **The page fits a phone,** has a compact layout for the book, and keeps its state in the address.

## Rebuilding the data

```
python3 -I models/infrared/build_data.py
```

It reads the ARTS results (not in Git) from the frozen copy of the first version's workspace in the data store, `climate-change-textbook-data/models/infrared/codex-workspace-2026-11-11/`, and checks each file's SHA-256 first. Afterwards run `python3 tests/test_infrared_model.py --write-sample` only if the second program's answers have changed too.

## The data's terms

`web/tables.bin` holds results calculated with ARTS. Results from ARTS may be shared; if you reuse them, cite Buehler et al. (2025). The MIT licence on the code doesn't cover them. None of the files ARTS reads are here: no line catalogs, no continuum coefficients and no standard profiles.

## Still to do

- The models aren't embedded in the book's chapters (Scott, 12 November 2026); the compact layout (`?embed=1`) is there if that changes.
