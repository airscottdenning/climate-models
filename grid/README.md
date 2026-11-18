# Keeping the Lights On: A Year of Sun, Wind and Demand

A teaching model for Chapter 12, "Reinventing Fire", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

The reader runs a real US power grid for every hour of 2025 and tries Chapter 12's five tools for grid integration:

1. **Manage demand:** a share of each day's use can wait.
2. **Mix sources:** gigawatts of solar panels and wind turbines.
3. **Store energy:** gigawatt-hours of four-hour batteries.
4. **Send it far:** build half the solar and wind in a neighbor's weather and wire it in.
5. **Clean firm power:** gigawatts that run every hour.

The grids are MISO (the Midwest), PJM (the Mid-Atlantic) and CISO (California). The page shows:

- the year day by day, and any week hour by hour, with a button for the worst week;
- the share of the year's use met by clean power;
- the hours short and the biggest shortfall in one hour;
- the share of the clean power that's thrown away.

It has no prices.

The page opens on MISO with what it had in 2025: 16.7 GW of solar, 32.6 GW of wind, and 11.6 GW of nuclear and hydropower running every hour. Clean power meets 34.7% of the year's use.

## The science

Five steps of bookkeeping, hour by hour, each on the About tab:

1. **Capacity factors.** The grid's own, or a mix with a neighbor's: c = (1 − f) c_here + f c_there, with f = 0 or 0.5.
2. **Clean power made.** C = Ps cs + Pw cw + F.
3. **Use that waits.** A share w of each day's use is taken from every hour and put back where that day has spare clean power, in proportion to it. What doesn't fit stays where it was, and each day's total is unchanged.
4. **Batteries.** Power is E/4. A surplus charges them, as fast as their power allows and until they're full; the rest is thrown away. A gap is filled from them, as fast as their power allows and until they're empty; the rest, S = D − C − B, is the shortfall. They start the year half full and lose nothing in a round trip.
5. **The clean share.** K = 1 − (the year's shortfall) / (the year's use).

What it leaves out, and says so:

- prices;
- growth in use;
- other years' weather;
- power lines inside each grid;
- losses on the wire to a neighbor (and its length and cost);
- battery losses;
- the batteries the grids already had in 2025.

It also says that California's 2025 capacity factors already reflect some solar power thrown away.

## The data

`web/data.json` (315 kB) holds, for each grid and each hour of 2025 (Eastern Standard Time):

- demand, in hundredths of a gigawatt;
- the capacity factors of the solar and wind fleets, in thousandths;
- the year's measured totals.

It comes from the US Energy Information Administration:

- **Form EIA-930,** the Hourly Electric Grid Monitor's six-month balance files: demand and net generation by source.
- **Form EIA-860M,** the September 2026 monthly generator inventory: each fleet's nameplate capacity month by month, set on a straight line between month ends.

Both are public domain.

`build_data.py --reduce` reads EIA's files, checks each against its SHA-256, and writes the reduced tables, with a record of every repair. The repairs:

- a few missing hours filled from their neighbors;
- single hours far from both neighbors replaced by their neighbors' average;
- the last hour of each day in PJM's wind record from January 1 to February 11, which carries other days' readings;
- California's solar readings below zero at night, set to zero.

`build_data.py --write` packs `web/data.json`, and `--check` holds it to the SHA-256 written in the script. The raw files and the reduced tables are outside Git, in the project's data store under `models/grid/`. The 2025 balance files are with Chapter 12's figures. On 17 November 2026 the reduction was run again from the raw files, and it reproduced the tables and `data.json` exactly.

## How it was checked

`tests/test_grid_model.py` holds the model to:

- **a second copy in Python,** over whole years at eight settings;
- **energy in every hour:** what's made plus what the batteries give equals what's used, charged and thrown away; the batteries stay between empty and full, and within their power;
- **demand that waits** stays within its day;
- **the limits:** nothing built means all shortfall, and enough firm power means none;
- **the year as it was:** set to what each grid had, it gives back the EIA's clean share, to within 0.1 percentage point for MISO and PJM, and a little below for California, where the model throws away a few hours of surplus;
- **the About tab:** its equations, tried with the model's numbers; its worked example, from the data; every number in its text; and the claims about the worst week's wind and how alike the grids' winds are;
- **the exercise** that goes with the page (Exercise 12A): every keyed answer, at the settings its address opens.
