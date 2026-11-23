# Climate Damage: Compounding vs Discounting

A teaching model for Chapter 14, "Planetary Prosperity", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

It compares two worlds. In the cooler world, climate change is avoided and income per person grows at a steady rate. In the hotter world, climate damage makes it grow a little more slowly. Everything is per person, so the model never needs the number of people. The gap between the two incomes each year is that year's damage. The model discounts each year's damage back to today and adds it all up. The total is the most it would be worth spending this year, for each person, to avoid the damage.

The page opens on Box 14.1 of the book, as Scott revised it on 21 November 2026: income of $14,700 a person a year (the world's average in 2025), growing at 2.5% a year in the cooler world and 2.2% in the hotter one, over one 40-year working life, with each year's loss discounted at 2.5% a year. Added up, the losses come to $67,612 a person; discounted, the damage is worth $33,910 a person today, the most it would be worth spending here and now to avoid it. Because the book's discount rate equals the cooler world's growth, the page opens on the case the About tab calls Where the equations stop. (Until 21 November the page opened on $10,000 a person, 2.50% vs 2.49%, 4.5%, 100 years: $1,481.)

The reader chooses the cooler world's growth rate, how much slower the hotter world grows, the discount rate, this year's income per person and the number of years to add up. Three buttons set discount rates that economists have argued for: 1.4% (the Stern Review), 2% (the median of more than 200 experts surveyed by Drupp and colleagues, 2018) and 5.5% (William Nordhaus).

## The science

Four steps, each on the page's About tab with its equation:

1. Income per person grows exponentially: y = y₀ e^(r t), at r_cool in the cooler world and r_hot = r_cool − p in the hotter one.
2. The damage per person in year t is D = y_cool − y_hot. As a share of the cooler world's income it's s = 1 − e^(−p t).
3. Its value today is P = D e^(−r_disc t), the book's formula for discounting.
4. The total is the area under step 3's curve, from now to T years from now:
   V = y₀ [ (e^((r_cool − r_disc) T) − 1) / (r_cool − r_disc) − (e^((r_hot − r_disc) T) − 1) / (r_hot − r_disc) ].
   Where a growth rate equals the discount rate, its fraction is 0 ÷ 0; its true value there is T, and the model uses it. `Math.expm1` keeps the digits when the two rates are close.

The model has no data file. It leaves out temperature, emissions and the cost of avoiding the damage; the About tab lists what else it leaves out.

## How it was checked

`tests/test_discounting_model.py` holds the model to:

- **a second copy of the equations in Python,** at 16 settings, to within a billionth;
- **the long way:** step 4's closed form against the area under step 3's curve by the trapezoid rule, with 100,000 slices, to within a millionth, including where the discount rate equals a growth rate;
- **Scott's first version,** an R Shiny app. Its `climate.damage.R` was run at 144 settings (`tests/discounting-oracle.json`; the whole set, and the R script that made it, are in the data store, below). Every yearly series agrees. The totals agree to within a millionth, except at 58 settings where the app's answer was wrong (see below);
- **the book:** Box 14.1 and Figure 14.11 (from 2025's world average of about $14,700 a person: about $45 lost in the first year; about $40,000 and $35,400 a year in 2065, about 11% lower and about $4,500 apart; about $68,000 lost, not discounted; 2065's loss worth about $1,700 today; about $34,000 a person in all);
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, done exactly and from a calculator's rounded numbers; and every number in its text.

## What changed from the Shiny app

- **The total near the discount rate.** To avoid dividing by zero, the app's `ipvt()` swapped in a gap of 0.01 whenever a growth rate was within 0.01 of the discount rate. That was wrong whenever the true gap wasn't 0.01: at the app's own opening settings (2.5%, 0.1 point, 2%, $100 trillion of world income) it printed $1,569 trillion, where the right answer is $678.8 trillion. The rebuild uses the formula's true value.
- **The derivation.** The app's "Derivation" tab wrote r_cool in both terms of the discounted damage (the second should be r_hot), put an extra G₀ inside the integral, and dropped the −1 from each term of the result. The app's code had the −1 terms right.
- **The undiscounted total** is now the same smooth sum as the discounted one, with a discount rate of 0. The app added up whole years from 0 to 99.
- **Income per person, not world income** (Scott, 16 November 2026). The app grew the world's whole income. The page grows income per person at the rates on the sliders, so there's no population to grow and divide by. The equations are the same, with y for income per person.
- **The page opens on Box 14.1** instead of the app's settings, so it matches the book. The penalty now moves in steps of 0.01 percentage point, from 0.01, and the discount rate reaches from 0% to 7%. Income per person and the number of years are new controls; the years run from 10 to 300 (from 50 until 21 November 2026, when Box 14.1 moved to one 40-year working life).
- **The comments.** The app's Comments tab is not carried over. Its argument is in Box 14.1 of the book, in the book's words.

## Where things are

| | |
|---|---|
| `web/` | The page: `index.html`, `style.css`, `model.js` (the science) and `app.js` (the page) |
| `equations.py` | The About tab's equations. `python3 equations.py --write` puts them into the page; `--check` says whether it's up to date |
| `tests/test_discounting_model.py`, `tests/discounting-oracle.json` | In the book's repository |
| `climate-change-textbook-data/models/discounting/` | Outside Git: Scott's Shiny app as he left it (`original-shiny-2026-11-12/`), and `checks-2026-11-12/` with `oracle.R` and its whole output |

## Credits

The model is Scott Denning's. Claude, from Anthropic, rebuilt it to run in the browser on 12 November 2026. The code is under the MIT licence.
