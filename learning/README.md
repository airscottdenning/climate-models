# Learning Beats Digging: Why Clean Energy Keeps Getting Cheaper

A teaching model for Chapter 12, "Reinventing Fire", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

Each time the world doubles all the solar panels or batteries it has ever made, their price falls by about a fifth. That's a learning curve, and the chapter's section 12.5 calls the comparison with fossil fuels "learning beats digging", after a chart by the energy think tank Ember.

The page has two views:

- **Learning curves** (Figure 12.16 of the book): price against all of it ever made, on logarithmic axes, for solar panels (1975–2024), lithium-ion batteries (1991–2023) and oil (1890–2025). The page fits a straight line through the points and reports the learning rate: 23.5% for each doubling for solar panels, 19.5% for batteries, and a rise of about 10% for oil. The reader chooses a learning rate and a number of doublings still to come, and sees the price after them and how many years they take at the speed of the last five years.
- **Against coal and gas** (Figure 12.4): the cost of electricity from new solar and onshore wind farms around the world, 2010–2025, against IRENA's range for new coal and gas plants.

The page opens on solar panels, at the chapter's "about 20%" and three doublings: $0.265 a watt in 2024 becomes $0.136, and the three doublings take about 8.9 years.

## The science

Six steps, each on the page's About tab with its equation:

1. Doublings: n = ln(X / X₀) / ln 2, where X is all of it ever made.
2. The straight line through the points: ln P = a + b ln X, a least-squares fit, as Figure 12.16 uses.
3. The learning rate: L = 1 − 2^b.
4. The price after N more doublings: P_N = P (1 − L)^N.
5. Today's speed: g = (X / X_earlier)^(1/5) − 1, the average over the last five years of data.
6. The years N doublings take: T = N ln 2 / ln(1 + g).

The About tab says where the curve stops: it describes the past and promises nothing; each doubling is as much again as all of history; a panel's price isn't a solar farm's cost; and prices have gone up for a year or more before.

## The data

`web/data.json` is made by `build_data.py` from the files that draw Figures 12.4 and 12.16, in `figures/chapter-12/costs-and-learning/derived-data/`. Each file is held to the SHA-256 the figure package records, so the page and the figures can't drift apart. Sources, as in the figures' credit lines:

- Solar panels: IRENA, Nemet (2009), and Farmer and Lafond (2016), via Our World in Data (CC BY 4.0).
- Batteries: Rupert Way (2026), after Ziegler and Trancik (2021), doi:10.1039/d0ee02681f, BloombergNEF and Avicenne Energy, via Our World in Data (CC BY 4.0).
- Oil: Energy Institute, *Statistical Review of World Energy* (2026), via Our World in Data; Hubbert (1974), US Senate committee print (public domain), for production before 1965.
- Costs of electricity: IRENA (2026), *Renewable Power Generation Costs in 2025*, via Our World in Data, used with acknowledgement of IRENA as source and copyright holder; the fossil-fuel range from IRENA (2021).

## How it was checked

`tests/test_learning_model.py` holds the model to:

- **the figure package:** `data.json` must be what `build_data.py` makes from the package's files, and the fit must give the package's own learning rates, doublings and crossing years;
- **Chapter 12:** the sentences the page leans on are looked up in the chapter;
- **a second copy of the six steps in Python,** for all three curves, to within a billionth;
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, done from a calculator's rounded numbers; and every number in its text;
- **the exercise** that goes with the page (Exercise 12C): every keyed answer, worked out again at the settings its address opens.
