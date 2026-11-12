# Panes of Glass: The Layer Model of the Greenhouse Effect

A page for teaching the layer model of Chapter 3: panes of glass that let Sunlight through and absorb Earthlight, stacked over black ground. The reader chooses the number of panes, the Sunlight and the albedo, and the page draws the stack with every flow of energy and every temperature. With the Earth's Sunlight and albedo it gives the book's numbers: 255 K with no panes, 303 K under one and 335 K under two (Figure 3.3).

- **Public address:** `/models/layers/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters (Scott, 12 November 2026).
- **Everything runs in the reader's browser.** There's no server, no build step, no data file and no outside library.
- **The whole model is five equations,** and `web/model.js` is under 100 lines. A student can read all of it.
- **The next step is [`two-layer`](../two-layer/README.md),** where the panes leak and the air is stirred. The two pages share their letters, their numbering (from the top down), their colors and their wording.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the five equations, and one function that puts a stack together. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the drawing, the sentence under it and the table |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The two tabs

- **The panes:** the stack, drawn after the book's Figure 3.3.
  - Each pane is a pale blue bar and the ground is a black slab. Sunlight comes straight down through every pane as orange arrows. Each pane sends a wavy blue arrow of Earthlight up and another down, and the ground sends one up.
  - Every arrow has its number in W/m² beside it. Every level has its temperature beside it in kelvins, °C and °F.
  - Under the drawing, a sentence gives the ground's temperature and how much warmer that is than with no panes.
  - Under that, a table has each level's heat budget in numbers: what it takes in and from where, and what it emits.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the numbers come from, how the model was checked, and the code.

## The controls

| Control | Range | As the page opens |
|---|---|---|
| Number of panes | 0 to 10 | 1 |
| Sunlight on a square meter that faces the Sun | 800 to 1,500 W/m² | 1,361 W/m², the Earth's |
| Albedo | 0 to 90% | 30%, the Earth's |

One button goes back to one pane and the Earth's Sunlight.

**Why 0 to 10 panes.** The drawing has to show every pane with both of its arrows and their numbers, and ten is as many as fit on a phone. Nothing new happens after that: each pane adds the same 238 W/m² to what the ground emits, and fewer kelvins than the one before. `stack()` in `model.js` has no upper limit, and the tests run it with 99 panes.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/layers/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_layers_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers, at 16 settings of the Sunlight and the albedo and every number of panes. Its two sides must agree.
  - The worked example, for the page as it opens, must end on the model's numbers. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the model and looked for in the text.
  - A label in quotation marks must be a button on the page or the title of Chapter 3. The sliders must stop where the text says. Links must lead somewhere. What the text says about the book must still be in Chapters 2 and 3, and the figure's number is counted from the chapter.
- **So some changes elsewhere fail a test until the About text follows:** a change to `model.js`, a new range for a slider, a renamed button, or a rewrite of the layer model in Chapter 3. The failure says what the text should say.
- **A link can open one section:** `/models/layers/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8792 --bind 127.0.0.1 --directory models/layers/web
```

Then open `http://127.0.0.1:8792/`. The drawing also works when `index.html` is opened straight from the disk. The two boxes of code on the About tab don't, because a browser won't load a file into the page that way. The link to the next model works on the site, where the two pages are neighbors.

## Addresses that open a chosen state

The page keeps its state in the address, so any stack can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `stack` or `about`. After `about`, a `#` and a section's name opens that section |
| `panes` | The number of panes |
| `sun` | The Sunlight on a square meter that faces the Sun, in W/m² |
| `albedo` | The albedo, in percent |
| `embed=1` | The compact layout for an iframe, with an "Open in a new window" link. Nothing uses it yet |

A number beyond a control's range is set to the nearest end. Example: `/models/layers/?panes=2`, the book's two panes.

## The science

The letters are the About tab's. Panes are numbered from the top, so pane 1 is the one that faces space.

1. **The ground takes in** *Q* = *S*(1 − α) ÷ 4, where *S* is the Sunlight on a square meter that faces the Sun and α is the albedo. The panes are clear to Sunlight.
2. **A black surface at temperature** *T* **emits** *E* = σ*T*⁴ (the Stefan–Boltzmann law of Chapter 2). The ground emits from its top. A pane emits *E* from each of its two sides.
3. **Each pane absorbs all the Earthlight that reaches it.** So only the top pane is seen from space, and the stack's own budget makes it emit *E*₁ = *Q*. The top pane's budget then gives the level under it, 2*Q*, and so on down: pane *k* emits *E*ₖ = *kQ* from each side.
4. **The ground emits** (*N* + 1)*Q* under *N* panes. Its own budget, *Q* plus what the lowest pane sends down, says the same.
5. **Each level's temperature** is (*E* ÷ σ) to the power 1/4. So the ground is warmer than the top pane by the fourth root of *N* + 1.

**What the model leaves out.** The panes are perfect: nothing leaks through a window in the spectrum (Section 3.4). The air is still: no heat rises with warm air or with evaporated water (Section 3.5). And one square meter stands for the whole planet. Chapter 3 says the real atmosphere "is more like one pane that's leaky and stirred", and the next model, `two-layer`, adds the leak and the stirring.

## Where the numbers come from

- **The solar constant, 1,361 W/m²:** the book's value in Chapter 2, from Kopp and Lean (2011), doi:10.1029/2010GL045777.
- **The albedo, 30%:** Chapter 2's "about 30 are reflected" of every 100.
- **σ, 5.67 × 10⁻⁸ W/m² per K⁴:** the Stefan–Boltzmann constant, as Chapter 2 gives it.
- **The layer model:** Chapter 3 cites Archer (2012), *Global Warming: Understanding the Forecast*, 2nd edition, John Wiley & Sons.

## How it was checked

`tests/test_layers_model.py` has the five equations written out a second time, in Python, and runs both copies.

1. **The page's code, against the second copy.** For every number of panes from 0 to 10 at 16 settings of the Sunlight and the albedo, and for 20, 50 and 99 panes, `model.js` and the Python give the same temperatures to a millionth of a kelvin. The test runs `model.js` in Node, or in Chrome where there's no Node.
2. **The short way, against the long way.** Step 3's pattern is a shortcut. The test also writes out every level's budget and solves them all at once, as a set of simultaneous equations, with no pattern assumed. The two agree to a millionth of a kelvin.
3. **The first version of the model.** Scott's R function, run unchanged in R 4.6.0 at the same 16 settings with up to 99 panes, agrees to a millionth of a kelvin. Its answers are in `tests/layers-oracle.json`, so the test needs no R.
4. **The book.** With the Earth's Sunlight and albedo the ground is at 255 K with no panes, 303 K with one and 335 K with two, and the top pane is at 255 K however many panes are under it.
5. **Heat in, against heat out.** The stack sends to space what the ground takes in from the Sun, and every level emits what it takes in.
6. **The page itself.** Where there's a Chrome, the test opens the page and reads the sentence and the table under the drawing, as the page opens, with two panes, and at the ends of the controls.

## What changed from the first version

The first version is Scott's R Shiny app, "N-Layer Blackbody Atmosphere". Its science is right, and this page has the same model.

- **The page draws the panes.** The app drew a graph of temperature against layer number. This page draws the stack as Figure 3.3 does, with every arrow and its number, and prints each level's budget in a table.
- **The panes are counted the book's way.** The app counted the ground as a layer and went from 2 to 100 layers, which is 1 to 99 panes. This page has 0 to 10 panes. No panes at all is the planet of Section 3.1, and the app couldn't show it.
- **The model is five equations,** not a matrix. The app built the budgets as a matrix and solved it. The answer has a pattern simple enough to write down, and the tests hold the pattern to the matrix.
- **The Sunlight opens at 1,361 W/m²,** the book's value, and moves in steps of 1. The app opened at 1,360 and moved in steps of 10.
- **The albedo goes down to 0.** The app's stopped at 5%.
- **Temperatures are printed in kelvins, °C and °F together.** The app had a choice of one.
- **The explanation is this model's own.** The app's three pages of text had been copied from a different app (two leaky layers with convection) and didn't describe it.
- Every control works from the keyboard, and the sentence and the table under the drawing say in words and numbers what the drawing shows. Sunlight's arrows are straight and Earthlight's are wavy, so nothing depends on color alone.

Scott's app, and Claude's notes on reading and running it, are in the data store: `climate-change-textbook-data/models/layers/`.

## Still to do

- Nothing is waiting. The compact layout (`?embed=1`) is there if a chapter ever wants the model.
