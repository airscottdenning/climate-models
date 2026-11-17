# Spending the 21st Century Emission Budget

A teaching model for Chapter 9, "The One-Way Thermostat", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

It starts now, in 2026, with the world emitting 11.5 GtC a year from fossil fuels and land use (2025's emissions), and cuts that by the same share every year, which the reader sets with a slider (0% to 10% a year; the page opens at 2%). It adds each year's emissions to the 756.5 GtC emitted from 1850 through 2025 and turns the total into warming with the book's teaching TCRE of 2 °C per 1,000 GtC. Two graphs show the emissions and the warming from 2026 to 2100, beside a gray line with no cuts, and a dashed line marks 2 °C above preindustrial.

## The science

Four steps, each on the About tab with its equation:

1. **Emissions,** n years after the start: E = E₀ (1 − r/100)ⁿ, with E₀ = 11.5 GtC a year.
2. **All the carbon emitted** by the start of year n: S = S₀ + 100 E₀ (1 − (1 − r/100)ⁿ)/r, with S₀ = 756.5 GtC. The code adds the years up one at a time; the equation is the shortcut.
3. **Warming:** T = (2/1,000) S, in °C above the late 1800s.
4. **Where it ends,** if the cuts go on forever: S∞ = S₀ + 100 E₀/r. So the budget for 2 °C (1,000 GtC, so 243.5 GtC more) needs r ≥ 1,150/243.5 = 4.72% a year: 4.8 on the slider.

With no cuts (r = 0), steps 2 and 4 divide by zero, and the total is S₀ + E₀ n.

## How it was checked

`tests/test_emission_budget_model.py` holds:

- **`model.js` and the About tab** to the live numbers (`build_data.py --check`);
- **`model.js`** to a second copy of the equations, written in Python inside the test, at eleven settings, to within a billionth;
- **the shortcuts** of steps 2 and 4 to the years added up one at a time (200 years for step 2, 20,000 for step 4);
- **the starting numbers:** fossil plus land use adds up to the total, and S₀ is the Global Carbon Budget workbook's 1850–2024 total (745.0 GtC, fossil net of cement carbonation plus land use) plus 2025's 11.5; TCRE is Chapter 9's 2 °C per 1,000 GtC;
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, from a calculator's rounded numbers; and every number in its text.

## The live numbers

The model's first year, E₀ and S₀ are the book's live numbers, in `_variables.yml` (entry `emissions`), updated each January with the rest (see "Annual live-numbers update" in `editorial/INFRASTRUCTURE.md`). The model starts the year after `emissions.year`. After the update, run

    python3 models/emission-budget/build_data.py --write

It writes the numbers into `web/model.js`, between `LIVE START` and `LIVE END`, and works out every number on the About tab that depends on them. Each of those sits in `web/index.html` as a `<span data-live="its-name">`. The model's tests fail until it's been run. If a year's numbers change the story (if, say, a 2% cut no longer passes 2 °C by 2100), the script stops and says the About tab needs rewriting. The Global Carbon Budget's citation on the About tab is typed: change it to the new year's paper.

## Where things are

| | |
|---|---|
| `web/` | The page: `index.html`, `style.css`, `model.js` (the science) and `app.js` (the page) |
| `build_data.py` | Carries the live numbers into the page. `--write` puts them in; `--check` says whether the page is up to date |
| `equations.py` | The About tab's equations. `python3 equations.py --write` puts them into the page; `--check` says whether it's up to date |
| `tests/test_emission_budget_model.py` | In the book's repository |

## Sources

Friedlingstein, P., et al. (2026). Global Carbon Budget 2025. *Earth System Science Data*, 18, 3211–3288. doi:10.5194/essd-18-3211-2026

IPCC (2021). Summary for Policymakers. In *Climate Change 2021: The Physical Science Basis*. Cambridge University Press. doi:10.1017/9781009157896.001

## Credits

The model is Scott Denning's design (16 November 2026). Claude, from Anthropic, wrote it to run in the browser. The code is under the MIT licence.
