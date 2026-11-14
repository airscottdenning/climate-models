# Four Factors, One Atmosphere: The Kaya Identity and Economic Convergence

A teaching model for Chapter 11, "Economics of Fire", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

It grows the world's population and income from 2025 to 2100 and turns them into carbon emissions with the Kaya identity: emissions = population × income per person × energy intensity × carbon intensity. The world's people are split into three groups (the richest tenth, the middle eight tenths and the poorest tenth), and each group's income grows by **economic convergence**: 1% a year, like the leading economy, plus 1.4 percentage points for each halving of the gap to the leader (Sachs, 2015, Table 6.2). As incomes rise, population growth slows.

The reader chooses how fast energy intensity and carbon intensity fall, and the catch-up growth. The page opens with them falling 1.2% and 2% a year, with Sachs's catch-up of 1.4: about 3 °C of warming in 2100 (Scott, 13 November 2026). A button sets the two intensities to their 2000–2024 pace, which gives 5.0 °C. The "Climate" view compares the reader's choices with the intensities falling at their 2000–2024 pace (0.9% and 0.3% a year). The "Economy" view shows population, income, energy and emissions for each group.

## The science

Seven steps, each on the About tab with its equation. Every year, from that year's numbers:

1. **Population** grows at r = 0.3 + 1.25 (20,000 − y)/10,000 percent a year below an income of $20,000 a person, and r = 0.3 − (y − 20,000)/80,000 above it.
2. **The leader's** income is L = 60,000 × 1.01ⁿ, n years after 2025.
3. **Income** grows at g = 1 + k ln(L/y)/ln 2 percent a year, with k = 1.4 for Sachs's rule.
4. **The intensities** fall by a fixed share a year: e = e₀ (1 − a/100)ⁿ and c = c₀ (1 − b/100)ⁿ.
5. **Emissions:** F = P y e c, for each group.
6. **CO₂ in the air** rises by 0.47 F / 2 ppm a year: half of each GtC stays in the air (the book's Box 9.2).
7. **Warming** is T = 1.4 + (2/1,000) S, where S is the GtC emitted since the start of 2025: the book's teaching TCRE of 2 °C per 1,000 GtC (Box 9.2).

It starts from the world in 2024, the latest year with all four Kaya factors measured: 8.16 billion people; incomes of $30,000, $11,000 and $730 a person (2015 US dollars at market exchange rates); 1.83 kWh per dollar; 0.0566 kg of carbon per kWh. CO₂ is 426 ppm and the warming 1.4 °C in 2025.

## How it was checked

`tests/test_kaya_model.py`, with the Python copy in `tests/kaya_copy.py`, holds the model to:

- **the Python copy,** at nine settings, to within a billionth;
- **Scott's first version.** A Python copy of the R app's own code reproduces its runs (`tests/kaya-oracle.json`, six settings) to within a billionth. The tests then show each of the three changes below doing what this README says;
- **the data:** the first year's people, income, energy and fossil carbon are within 1% of Chapter 11's 2024 data (`figures/chapter-11/kaya-and-emissions-data/derived-data/world-intensities.csv`), and the 2000–2024 paces are worked out from the same file;
- **the book:** 426 ppm is the live number in `_variables.yml` (the test fails when the yearly update moves it on, which is the signal to move this model's start), and 1.4 °C is Chapter 1's;
- **the About tab:** its equations, read back from the page and tried with the model's numbers for every group and year; its worked example, from a calculator's rounded numbers; and every number in its text.

## What changed from the Shiny app

- **Warming.** The app relaxed the temperature toward the equilibrium for each year's CO₂ (3 °C per doubling, a 30-year lag). That's the fixed-concentration calculation of Box 9.2, and along a path of emissions it keeps warming the world after the emissions stop: at 2.2% and 10% a year, the app's emissions are nearly zero from 2070, and its warming still rises about 0.1 °C by 2100. The rebuild uses Box 9.2's TCRE instead, so warming stops when emissions stop, as the book teaches.
- **The population rule.** The app's rule jumped by 0.125% a year at an income of $20,000, because its last line used 30,000 where it needed 20,000. The rebuild fixes that and joins the app's first two lines into one (they differed by 0.05% a year at $10,000). Population now falls for incomes above $44,000.
- **The start.** The app started in 2021 with 7.9 billion people, incomes of $30,000, $12,500 and $730, 1.5 kWh a dollar and 0.06 kg of carbon a kWh. The rebuild starts in 2025 from Chapter 11's 2024 data. The middle group's income is set so the world's income comes out right.
- **The comparison line.** The app compared the reader's choices with "no action", energy intensity falling 1% a year and carbon intensity not at all, always with a catch-up of 1.4. The rebuild compares with the 2000–2024 paces from the data, using the reader's catch-up, so the two lines differ only in the intensities.
- **Smaller things.** The app's energy-intensity floor (0.25 kWh a dollar, "3x smaller" in its comment, which is 6 times) never came into play within its sliders, and is gone. The leader grows as 1.01ⁿ from 2025 rather than e^(0.01 i) from i = 2. The Description tab said $25,000 and $10,000 where the code used $30,000 and $12,500. The sliders now reach 3% a year for energy intensity.

## Where things are

| | |
|---|---|
| `web/` | The page: `index.html`, `style.css`, `model.js` (the science) and `app.js` (the page) |
| `equations.py` | The About tab's equations. `python3 equations.py --write` puts them into the page; `--check` says whether it's up to date |
| `tests/test_kaya_model.py`, `tests/kaya_copy.py`, `tests/kaya-oracle.json` | In the book's repository |
| `climate-change-textbook-data/models/kaya/` | Outside Git: Scott's Shiny app as he left it (`original-shiny-2026-11-12/`), and `checks-2026-11-12/` with `oracle.R` and its output |

## Updating the start

Each year, after the live numbers move on (`_variables.yml`), move `START` and the starting values in `web/model.js` and `tests/kaya_copy.py` to the new year, from Chapter 11's data when its figure is rebuilt, and update the About tab's numbers. The tests say which.

## Source

Sachs, J. D. (2015). *The Age of Sustainable Development*. Columbia University Press, pages 196–198 and Table 6.2.

## Credits

The model is Scott Denning's. Claude, from Anthropic, rebuilt it to run in the browser on 12 November 2026. The code is under the MIT licence.
