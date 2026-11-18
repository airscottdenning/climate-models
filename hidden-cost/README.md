# The Hidden Cost: A Fuel, Its Smoke and a Price on Pollution

A teaching model for Chapter 14, "Planetary Prosperity", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

It draws the supply-and-demand graph of a fuel, the graph of the chapter's section 14.2. The reader sets two things: the harm each ton's smoke does to people outside the market, and a price on the pollution for each ton. The page shows how much is burned, what the buyer pays and the seller keeps, the fuel bill, the money the price brings in, the harm done and the harm avoided. It also shows how much smaller the economists' "pie" is than it could be, and the amount that would make the pie biggest.

The page opens with $30 of harm for each ton and no price. The market burns 100 million tons a year at $80 a ton, and the smoke does $3.00 billion of harm a year. A price of $30 a ton, equal to the harm, cuts the burning to 62.5 million tons and makes the pie as big as it can be.

The market is made up: two straight lines chosen so every number can be checked by hand, not to match any real fuel. The page says so.

## The science

Six steps, each on the page's About tab with its equation. Prices are in dollars a ton and amounts in millions of tons a year.

1. Demand: P = 130 − 0.5 Q.
2. Supply, the seller's own cost: P = 50 + 0.3 Q.
3. The social cost: the supply line plus the harm E.
4. Where the market settles with a price t on each ton: Q = (130 − 50 − t) / (0.5 + 0.3).
5. The harm: H = E Q.
6. The biggest pie burns Q_best = (130 − 50 − E) / (0.5 + 0.3), and any other amount loses the triangle L = (0.8 / 2)(Q − Q_best)², the deadweight loss.

Steps 4 and 6 are the same equation with t in place of E, which is why a price equal to the harm (a Pigouvian tax) gives the biggest pie. The About tab says what the model leaves out: real curves, uncertainty in the harm, cleaner technology, and who gets which slice.

## How it was checked

`tests/test_hidden_cost_model.py` holds the model to:

- **a second copy of the six steps in Python,** at ten settings, to within a billionth;
- **the ideas:** the pie is added up the long way, ton by ton, and step 6's triangle must be what's lost; a search over prices must find the biggest pie where the price equals the harm; the harm must never move the market alone;
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, done from a calculator's rounded numbers; and every number in its text;
- **Chapter 14:** the words the page leans on are looked up in the chapter;
- **the exercise** that goes with the page (Exercise 14C): every keyed answer, worked out again at the settings its address opens.

## Where the ideas come from

The price on pollution is Arthur Pigou's (*The Economics of Welfare*, Macmillan, 1920). The world's real hidden bill for fossil fuels is the International Monetary Fund's (Black and others, 2025, IMF Working Paper WP/25/270, doi:10.5089/9798229034715.001), which Chapter 14 uses in section 14.5. The model has no data file.
