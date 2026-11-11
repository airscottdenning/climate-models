# Milankovitch Cycles: Earth's Orbit and Sunlight

A browser version of Scott's R Shiny app. It shows how slow changes in Earth's orbit change the Sunlight reaching each latitude in each season. It goes with Chapter 5 (Figures 5.13 and 5.15).

- **Public address:** `/models/milankovitch/` on simpleserioussolvable.org.
- **Everything runs in the reader's browser.** There's no server, no build step and no outside library.
- **The pattern every model follows** is in [`models/README.md`](../README.md). This was the first.

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: Sunlight from the orbit. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls and the drawing |
| `web/orbit.bin` | The orbit every 1,000 years, from 20 million years ago to 20 million years ahead (480 kB) |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |
| `build_data.py` | Makes `orbit.bin` from Laskar's table |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The three views

- **Through time:** eccentricity, tilt, the precession index and mid-July Sunlight at 65 °N, over any span. The values under the pointer are read out, and the span can be downloaded as a CSV file.
- **Compare two times:** Sunlight by latitude and season at the first time, and the change from the first to the second.
- **Change the orbit:** set eccentricity, tilt and the longitude of perihelion by hand, and see the change from today's orbit.

## The About tab

The fourth tab explains the model to a student. In order: what the cycles are, how to use the page, the equations, things to try, where the orbit comes from, how the model was checked, and the code.

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/milankovitch/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_milankovitch_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers. Its two sides must agree.
  - Step 5, the day's average, must equal step 3 added up through the day. Over the whole globe it must come to one quarter.
  - The worked example must end on the model's number. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the model and looked for in the text: today's orbit, the three things to try, 10,000 years ago, the lengths of the seasons and the two matches with Berger and Loutre.
  - A label in quotation marks must be a button on the page. Links must lead somewhere. The figure numbers and the chapter's title must match Chapter 5.
- **So some changes elsewhere fail a test until the About text follows:** a new `orbit.bin`, a change to `model.js`, a different range on a slider, a renamed button, or a figure added, removed or moved ahead of Figure 5.15 in Chapter 5. The failure says what the text should say. The tests look for numbers with a few words around them, so the rest of the wording is free.
- **A link can open one section:** `/models/milankovitch/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-orbit`, `about-checked` and `about-code`.
- **The code is shown inside the page.** The last section loads `model.js` and `app.js` and shows them as text. A plain link would open the file in a browser tab, where its Greek letters and degree signs can come out garbled, because the site serves JavaScript without saying it's UTF-8.
- **The tab links to the model's folder on GitHub,** in the public repository `airscottdenning/climate-models`. That repository is a copy, filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8791 --bind 127.0.0.1 --directory models/milankovitch/web
```

Then open `http://127.0.0.1:8791/`. Opening `index.html` straight from the disk doesn't work, because a browser won't load `orbit.bin` that way.

## Addresses that open a chosen state

The page keeps its state in the address, so any view can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `timeseries`, `compare`, `sensitivity` or `about`. After `about`, a `#` and a section's name opens that section |
| `start`, `len` | Through time: the start and the length, in thousands of years |
| `t1`, `t2` | Compare: the two times, in thousands of years from now |
| `e`, `tilt`, `peri` | Change the orbit: eccentricity, tilt (degrees), longitude of perihelion (degrees) |
| `embed=1` | The compact layout for an iframe in the book, with an "Open in a new window" link |

Example: `/models/milankovitch/?view=compare&t1=0&t2=-127`.

## The science

- **Orbit:** Laskar et al. (2004), doi:10.1051/0004-6361:20041335. Columns: eccentricity, obliquity, and the longitude of perihelion measured from the moving equinox.
- **Sunlight:** the standard daily-mean formula for the top of the atmosphere, with the day length, the Sun's height and the Earth–Sun distance. The solar constant is 1,361 W/m², as in Chapters 2 and 3.
- **Season** is the Sun's longitude, counted from the March equinox. "Mid-July" is 120°, the convention of Berger and Loutre (1991).
- **Perihelion:** Laskar's angle is where Earth is, seen from the Sun, when the two are closest: 102.9° today. Seen from Earth, the Sun is then half a turn away, at 282.9°, which it reaches in early January. So Earth's angle from perihelion is the Sun's longitude + 180° − Laskar's angle. Berger and Loutre tabulate the same angle as Laskar. Some sources give the Sun's longitude at perihelion (282.9°) instead and leave out the 180°; Wikipedia's "Solar irradiance" page does. Either pair is right. Mixing them puts perihelion in July.
- **Check:** mid-July Sunlight at 65 °N matches the Berger and Loutre series behind Figures 5.13 and 5.15 to within 3 W/m² at every step of the last 400,000 years (average difference 0.2 W/m²). `tests/test_milankovitch_model.py` holds the model to that. The gap that's left is between the two orbit solutions and the two solar constants (1,361 and 1,360 W/m²), not in the formula: see the next section.
- **How far to trust the dates:** Laskar's table hasn't changed since 2004, and his page still says to use it for tilt and Sunlight. The shape of the orbit is good for the page's whole span. The timing of tilt and precession is less sure, because it depends on how fast the tides have slowed Earth's spin. Against the newer tables of Zeebe and Lourens (2022), a tilt cycle is dated about 5,000 years differently at 10 million years ago and about 19,000 years, nearly half a cycle, at 20 million. In the last million years the two agree to about 10 years. The About tab says this in a short paragraph. The record of the check, of 11 November 2026, is in the data store: `climate-change-textbook-data/models/milankovitch/laskar-table-check-2026-11-11/`.

## How the signs were checked

A wrong sign in this model puts Earth's closest approach to the Sun in the wrong season. The page's signs were checked five ways on 11 November 2026. All five agree with the page.

1. **Berger and Loutre's own table.** Their file gives an orbit and the Sunlight it produces, side by side. Fed their orbit and their solar constant, the page's formula returns their Sunlight to within 0.02 W/m²: at 65 °N and 15 °N in mid-July and at 65 °S and 15 °S in mid-January over 5 million years, and at seven latitudes in June over 1 million years. With the perihelion angle read any other way, the formula's worst miss on the mid-July and mid-January values is 104 W/m² (without the half turn), 90 W/m² (mirrored) or 52 W/m² (both).
2. **The calendar.** Earth moves fastest when it's closest to the Sun, so the lengths of the seasons show when that is. The page's geometry makes the four seasons from the March equinox last 92.76, 93.65, 89.84 and 88.99 days. The US Naval Observatory's equinoxes and solstices for 2026–27 make them 92.73, 93.65, 89.86 and 88.98 days. With perihelion half a turn away, the page's list would start 89.84, 88.99. The Observatory puts Earth's closest approach on 3 January 2026.
3. **A calculation from scratch.** Earth was set on its ellipse with a tilted axis and turned once, and the Sunlight on a level patch was added up through the day. The totals match the formula to within 0.0001 W/m² in 442 cases. This checks the signs for latitude and season. The calendar checks the perihelion angle.
4. **NCAR's climate model.** Its orbit code (`shr_orb_mod.F90` in CDEPS) adds 180° to the same angle and then uses the same formula.
5. **The two orbit solutions.** Laskar's and Berger's perihelion angles stay within about 10° of each other through the last 400,000 years, so the two tables mean the same angle.

The change maps were checked as well. Berger and Loutre give 523.3 W/m² at the North Pole in June today and 579.2 W/m² 10,000 years ago, a gain of 55.9. The page's map for "10,000 years ago minus today" shows its largest gain, 55.6 W/m², at the North Pole in late June.

`tests/test_milankovitch_model.py` holds the model to the first two checks. The scripts and downloads for all five are in the data store, in `climate-change-textbook-data/models/milankovitch/sign-check-2026-11-11/`.

## What changed from the Shiny app

- **The 65 °N series is the full daily mean.** The old formula took the Sun to be up all day at the June solstice, which is true only inside the Arctic Circle. Its signs were right, and at 65 °N it read 0.2 to 2% low through the last million years (0.7% low today).
- **Perihelion is in the right season on the maps.** The old map code put it 180° away, in early July: it took its formula from Wikipedia, which wants the Sun's longitude at perihelion (282.9°), and gave it Laskar's angle (102.9°). So the old maps of today were brightest at the North Pole in June. The brightest day is really at the South Pole in December.
- **"Change" means second minus first.** The old maps showed first minus second under a title that said the opposite. Together with the perihelion slip, that left the effects of perihelion's timing and of eccentricity about right, because the two slips cancelled, and it showed the effect of tilt with the wrong sign.
- **"Change the orbit" starts from today's orbit.** The old slider started at 70.3° instead of 102.9°.
- **Summer Sunlight is for mid-July,** to match Figure 5.13. The old app used the June solstice.
- **The span is 20 million years each way.** The old app went back 51 million years. The shorter span keeps the data file small; `FIRST_KYR` and `LAST_KYR` in `build_data.py` and `web/model.js` set it.
- Every control works from the keyboard, each graph has a text summary, and the colours are colour-blind safe.

## Rebuilding the data

```
/usr/bin/python3 -I models/milankovitch/build_data.py
```

It reads `INSOL.LA2004.txt` (6.5 MB, not in Git) from the frozen copy of the Shiny app in the data store, `climate-change-textbook-data/models/milankovitch/original-shiny-2026-11-11/`, and checks its SHA-256 first.

## The data's terms

Laskar's table is posted for scientific use, with no stated licence. `web/orbit.bin` is a reduced copy of three of its columns. The MIT licence on the code doesn't cover it: if you reuse it, cite Laskar et al. (2004).

## Still to do

- Embed the model in Chapter 5, with a still image and a short address for the PDF.
