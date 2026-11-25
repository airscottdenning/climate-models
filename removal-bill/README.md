# The Mop and the Bill: What It Costs to Take Carbon Back Out of the Air

A teaching model for Chapter 13, "Cleaning Up the Mess", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

Burning carbon is a running faucet, and carbon dioxide removal is mopping the floor. The reader chooses how much carbon to capture from the air and store each year, for how many years, the price of each ton of CO₂ and the energy each ton takes. The page shows the bill in dollars and in energy, how far the CO₂ in the air falls and how much the planet cools. It holds the bill up against things a reader knows: a year of the world's phones and phone service, the world's paved roads built from scratch, and one estimate of a program to dim the Sun. It holds the energy up against all the electricity the world made in 2025.

The page opens on the chapter's own example: 1 GtC a year for 50 years, at $100 a ton of CO₂. That's 50 GtC, or 183 billion tons of CO₂, for a bill of $18.3 trillion. The CO₂ in the air falls by 11.7 ppm, and the planet cools by 0.10 °C.

Two buttons set the price and the energy together: "Chapter 13's hopeful numbers" ($100 and 1,390 kWh a ton) and "Direct air capture today" ($1,000 and 4,380 kWh a ton).

## The science

Six steps, each on the page's About tab with its equation:

1. The carbon captured: C = R N, at R GtC a year for N years.
2. The same carbon as CO₂: M = (44/12) C, because a molecule of CO₂ weighs 44 and a carbon atom 12.
3. The bill: B = p M, at p dollars a ton of CO₂.
4. The energy each year: W = e (44/12) R terawatt-hours, at e kilowatt-hours a ton.
5. How far the CO₂ in the air falls: x = M / (2 m). One ppm weighs m = 7.81 billion tons of CO₂ (all the air, 5.15 × 10¹⁸ kg, times a millionth, times 44/29). The 2 is the half that comes back out of the land and ocean as the CO₂ in the air falls (Chapter 9).
6. The cooling: T = (2/1,000) C, the book's rule of about 2 °C for every 1,000 GtC. It isn't halved, because the rule already counts the half that comes back.

Turned around, the same sums give the price of lowering the CO₂ in the air by 1 ppm (2 m tons at p dollars) and of cooling the planet by a tenth of a degree (50 GtC at p dollars a ton of CO₂).

The model has no data file. Every number in it is the chapter's. It leaves out the emissions still running, the limits of land, rock, energy and storage, carbon that leaks back out of storage, and gases other than CO₂. The About tab says so.

## How it was checked

`tests/test_removal_bill_model.py` holds the model to:

- **a second copy of the six sums in Python,** at nine settings, to within a billionth;
- **the book:** the chapter's sentences that the page leans on are looked up in Chapters 1 and 13, and the model must give the chapter's answers (about $1.6 trillion for 1 ppm, about $18 trillion for a tenth of a degree, about $160 trillion for 100 ppm, and the chapter's comparisons with the world's electricity: a sixth, a third, a half, two-thirds and 1.7 times);
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, done from a calculator's rounded numbers; and every number in its text;
- **the exercise** that goes with the page (Exercise 13A): every keyed answer, worked out again at the settings its address opens.

## Where the numbers come from

All are Chapter 13's, which cites its sources. The ones the page leans on most: the mass of the atmosphere (Trenberth and Smith, 2005, doi:10.1175/JCLI-3299.1); TCRE (IPCC AR6 WGI, Summary for Policymakers, doi:10.1017/9781009157896.001); the energy of direct air capture (National Academies, 2019, doi:10.17226/25259); its cost (Sievert, Schmidt and Steffen, 2024, doi:10.1016/j.joule.2024.02.005); the world's electricity in 2025 (Ember, *Global Electricity Review 2026*, CC BY 4.0); the world's emissions in 2025 (Global Carbon Budget 2025, doi:10.5194/essd-18-3211-2026); and the cost of a program of aircraft to dim the Sun (Smith and Wagner, 2018, doi:10.1088/1748-9326/aae98d). The sum for one ppm is the chapter's, which Scott Denning credits to Morey Wolfson.
