# A Few Degrees: Hot Days, Cold Nights and the Bell Curve

A page for teaching why a small change in the average temperature makes a large change in how often a place has a very hot day or a very cold night. It starts with the sum in the box "A few degrees can multiply rare heat" in Chapter 6, and then does the same sum with the days that weather stations have measured, at 114 places.

- **Public address:** `/models/daily-temperatures/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters.
- **Everything runs in the reader's browser.** There's no server, no build step and no outside library. The map is drawn by the page's own code.
- **The whole model is eight equations,** and `web/model.js` is under 300 lines. A student can read all of it.
- **The model is never called by the name of its smoothing kernel.** The About tab names the kernel once, in step 4.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the eight equations, and how a place's file is read. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the graphs, the map and the lines under them |
| `web/data/index.json` | The places, the global record year by year and the checksums of the other data files. Loaded as the page opens |
| `web/data/stations/<id>.bin` | One place's days and yearly averages. Loaded when the reader picks the place |
| `web/data/pattern.bin`, `web/data/coast.bin` | The map of local warming for each degree of global warming, and the coastlines and borders. Loaded when the map needs them |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |
| `build_data.py` | Makes everything in `web/data/` from the first version's data bundle. Its opening comment lays out each file byte by byte |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

`web/` is 2.6 MB in all. A first visit loads about 180 kB: the page, its two programs, the list of places and one place's file of about 20 kB.

## The six tabs

- **The idea:** a bell curve with a mean and a standard deviation, a second one with every day warmed by the same amount, and a threshold. The page opens on the chapter's example: a mean of 89 °F, a standard deviation of 4 °F, 4 °F of warming and a threshold of 97 °F.
- **Two periods:** one place's measured days in an earlier period and a recent one, as two smooth curves, with the share of days beyond a threshold counted in each. A box slides the earlier curve by the change in the average, to show how far the simple picture holds.
- **Local and global:** each year's average temperature at the place and for the whole globe, and how much each warmed between the place's two periods.
- **Later this century:** the place's recent days with the warming still to come by 2081–2100 added to every one, for one of five scenarios.
- **Map:** a dot for every place, on the world (Mollweide) or the 48 states that touch (Albers equal-area conic). It can be colored by the measured warming between a place's two periods or by the warming still to come. A dot chooses its place.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the data come from, how the model was checked, and the code.

Every graph has lines of text under it that say what it shows now, in numbers.

## The controls

| Control | Where | As the page opens |
|---|---|---|
| Place | Every view but the first. A list, a box that narrows it, and the map | Blue Hill, Massachusetts |
| °F or °C | Every view | °F, the unit of the chapter's box |
| Mean, standard deviation, warming, threshold | The idea | 89 °F, 4 °F, 4 °F and 97 °F |
| Hot days or cold nights | Two periods, Later this century | Hot days |
| Threshold | Two periods, Later this century | Where about one day in ten of the recent period is beyond it, to the nearest 5 °F |
| Scenario | Later this century, Map | SSP3-7.0 |

**Why Blue Hill.** Its record starts in 1885 and has few gaps, so its two periods (1885–1914 and 1996–2025) start 111 years apart. Between them its summer highs warmed by 4.0 °F, the same shift as in the chapter's box. And it isn't in Colorado, where the first version opened.

**Hot days and cold nights** are the daily highs of the two warmest months and the daily lows of the two coldest: July and August, and January and February. South of the equator they swap.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/daily-temperatures/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_daily_temperatures_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers, for every place. Its two sides must agree.
  - The worked example, for Blue Hill's hot days under SSP3-7.0, must end on the numbers under the page's graph. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the data files and looked for in the text: the chapter's shares, the counts of days, the averages, the counts of places and the rest.
  - A label in quotation marks must be a tab, a button or a choice on the page, the title of Chapter 6, 7 or 8, or the title of the chapter's box. Links must lead somewhere. What the text takes from the chapter's box must still be in Chapter 6.
- **So some changes elsewhere fail a test until the About text follows:** a change to `model.js`, new data, a renamed button, or a rewrite of the chapter's box. The failure says what the text should say.
- **A link can open one section:** `/models/daily-temperatures/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8795 --bind 127.0.0.1 --directory models/daily-temperatures/web
```

Then open `http://127.0.0.1:8795/`. The page needs a server, because a browser won't load the data files into a page opened straight from the disk.

## Addresses that open a chosen state

The page keeps its state in the address, so any view of any place can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `idea`, `periods`, `warming`, `future`, `map` or `about`. After `about`, a `#` and a section's name opens that section |
| `place` | The place's station identifier in GHCN-Daily, such as `USC00190736` |
| `unit` | `F` or `C` |
| `season` | `warm` for hot days, `cold` for cold nights |
| `t` | The threshold, in the chosen unit |
| `scenario` | `ssp119`, `ssp126`, `ssp245`, `ssp370` or `ssp585` |
| `move=1` | The box that slides the earlier curve is ticked |
| `mean`, `sd`, `warm`, `at` | The four numbers of the first view |
| `show` | What colors the map: `places`, `observed` or `later` |
| `area` | `world` or `us` |
| `embed=1` | The compact layout for an iframe, with an "Open in a new window" link. Nothing uses it yet |

Example: `/models/daily-temperatures/?view=future&place=USW00026411&season=cold&t=-40`, the nights at or below −40 °F in Fairbanks.

## The science

- **A bell curve** has a mean and a standard deviation. The share of days beyond a threshold depends only on how many standard deviations the threshold is from the mean.
- **The measured days** are each day's high and low from GHCN-Daily, in tenths of a degree Celsius as NOAA stores them. A reading NOAA flagged is left out. A day counts only if both its high and its low are good.
- **Each place has two periods,** an earlier one and a recent one, of 30 years each (20 years at 12 places with shorter records). The first version chose them.
- **The share of days beyond a threshold is counted,** not read from a curve. The smooth curves are for the eye. They're drawn the way the statistics language R draws a density by default.
- **A threshold in °F is turned into tenths of a degree Celsius once,** and the days are compared with it as whole numbers. A day exactly on the threshold isn't above it.
- **A year's average counts** when at least 90% of the year's days have both readings, and so do at least 80% of the days of every month.
- **The warming still to come** at a place is its pattern factor *P* times the global warming a scenario still has to go: the scenario's warming by 2081–2100 since 1850–1900, less the globe's warming up to the place's recent period. *P* is the local warming for each degree of global warming in the climate models of IPCC AR6 (Figure SPM.5).
- **That warming is added to every recent day alike.** The shape of the curve is held fixed.

**What the model leaves out.** These are on the About tab, each beside the claim it qualifies.

- A place's days aren't quite a bell curve, and a curve's shape can change as it shifts.
- The pattern of warming is for the yearly average. Hot days and cold nights can warm more or less than that.
- The page uses each scenario's best estimate. The assessed range is wide.
- The daily records aren't corrected for a station that moved, a new thermometer, a different time of day for reading it or a town growing up around it. A change at one place can have a local cause. Summer highs are cooler in the recent period at 48 of the 114 places, and 38 of those are in the Midwest of the United States.
- "Later this century" is an exercise in what a given warming would do to the days a place has already had. It isn't a forecast for the place.

## Where the data come from

| What | Source | Terms |
|---|---|---|
| Daily highs and lows | NOAA's Global Historical Climatology Network Daily, version 3.34, as it stood on 7 September 2026. Menne et al. (2012), doi:10.1175/JTECH-D-11-00103.1; the dataset, doi:10.7289/V5D21VHZ | Work of the United States government for the stations of the United States. GHCN-Daily states no licence of its own for the records it gathers from other countries' weather services: see "The data's terms" |
| Global temperature | HadCRUT5, version 5.1.0.0, Met Office Hadley Centre and the University of East Anglia. Morice et al. (2021), doi:10.1029/2019JD032361 | Open Government Licence v3.0 |
| The scenarios' warming | IPCC AR6 Working Group I, Summary for Policymakers, Table SPM.1, doi:10.1017/9781009157896.001 | Five numbers and their ranges, cited |
| Local warming for each degree of global warming | The data behind panel (a) of Figure SPM.5 of the same summary. Fischer and Hauser (2021), doi:10.5285/2787230b963942009e452255a3880609 | CC BY 4.0 |
| Coastlines and borders | Natural Earth, 1:110 million | Public domain |

## How it was checked

`tests/test_daily_temperatures_model.py` has the model written out a second time, in Python, and reads the page's data files with it.

1. **The page's data, against the first version.** The first version's Python was run for every one of its 127 places and its numbers kept. For each of the 114 places on the page, the page's data give those numbers: how many good days, their sum, mean and standard deviation, the smoothing width, the warming of the place and of the globe, the pattern factor and the warming still to come. A sample of the numbers is in `tests/daily-temperatures-oracle.json`. Where the data store is at hand the test compares the whole set, and packs a few places' files again from the source to compare them byte for byte.
2. **The one rule that changed.** The first version compared a day's temperature with the threshold as decimal numbers in °F, and a day exactly on the threshold could land on either side. At Sacramento it counted 486 days above 100 °F in the recent period, and 73 of them had a high of exactly 37.8 °C, which is how NOAA stores a reading of 100 °F. The page counts 413. The test has both rules: the first version's must give the first version's counts, and the page's must differ by exactly the days on the threshold.
3. **The page's code, against the second copy.** For every place, both seasons and all five scenarios, `model.js` and the Python give the same numbers. The test runs `model.js` in Node, or in Chrome where there's no Node.
4. **The bell curve, against the chapter.** The first view gives the numbers in the chapter's box: 2.3% and 15.9% of days above 97 °F, 0.13% and 2.3% above 101 °F.
5. **The scenarios, against the IPCC.** The five best estimates and their very likely ranges are the ones in Table SPM.1.

## What changed from the first version

The first version is "Changing Seasonal Extremes", a Python app with a server that Scott Denning wrote with OpenAI Codex. It grew from an R app of his for one weather station.

- **It runs in the browser.** The first version needed a server running Python.
- **The first view is new:** the chapter's bell curve, before any data.
- **Days on the threshold are counted the same way every time** (see "How it was checked").
- **SSP1-2.6 is added,** so the page has all five scenarios of Table SPM.1. The first version had four.
- **13 of the first version's 127 places are left out,** most of them in Europe. See "The data's terms".
- **The place the page opens on is Blue Hill,** not Fort Collins.
- **Each data file is small.** The first version read a compressed table for each station. The page reads only the two seasons of the two periods, as whole numbers.
- **The world map is an equal-area one,** drawn by the page. The first version used a mapping library.
- **The About tab is new.** It gives the equations, a worked example and things to try.
- Every control works from the keyboard, and every graph has a text summary. Nothing depends on color alone.

The first version, and Claude's notes on reading and running it, are in the data store: `climate-change-textbook-data/models/daily-temperatures/`.

## Rebuilding the data

```
python3 -I models/daily-temperatures/build_data.py
```

It reads the first version's data bundle (not in Git) from the frozen copy in the data store, `climate-change-textbook-data/models/daily-temperatures/codex-workspace-2026-11-12/`, and checks each file's SHA-256 first. It needs only Python's standard library.

## The data's terms

The MIT licence on the code doesn't cover the data in `web/data/`.

- **Places left out.** GHCN-Daily took all or part of 13 places' records from the European Climate Assessment & Dataset, which offers part of its data "for non-commercial research and education". The book takes non-commercial material only on Scott Denning's recorded decision, so those places are held back. They're one list, `HELD_BACK`, in `build_data.py`: delete a line and run the script again, and the place is back. The script refuses to keep any other place with more than 1% of its readings from that source.
- **Places outside the United States that are kept.** Their records reached GHCN-Daily from other countries' weather services, through NOAA. GHCN-Daily's own documents state no licence for them, and no terms were found that prohibit this use. Scott Denning's decision (12 November 2026) is to keep every place unless there is a specific prohibition against using it: the page needs places in the tropics and the Southern Hemisphere, not only in the United States.
- **If you reuse the data,** cite the sources in the table above. HadCRUT5 asks for this line: "Contains public sector information licensed under the Open Government Licence v3.0."

## Still to do

- The compact layout (`?embed=1`) is there if a chapter ever wants the model.
