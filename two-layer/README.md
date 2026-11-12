# Leaky and Stirred: Two Layers of Air over Warm Ground

A page for teaching the step after the layer model of Chapter 3. The layer model's panes absorb all the Earthlight, and its air is still. Chapter 3 says the real atmosphere "is more like one pane that's leaky and stirred". This page has two layers of air over black ground. The reader chooses the share of the Earthlight each layer absorbs and the heat that rising air carries up, and the page draws every flow of energy and works out the three temperatures. With perfect layers and still air it gives the book's two panes: 255 K, 303 K and 335 K (Figure 3.3). As it opens, with layers that absorb 75% and rising air that carries 103 W/m² from the ground, the ground is at 288 K.

- **Public address:** `/models/two-layer/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters (Scott, 12 November 2026).
- **Everything runs in the reader's browser.** There's no server, no build step, no data file and no outside library.
- **The whole model is seven equations,** and `web/model.js` is about 160 lines. A student can read all of it.
- **The step before is [`layers`](../layers/README.md),** with perfect panes and still air. The two pages share their letters, their numbering (from the top down), their colors and their wording.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the seven equations, the model's limits, and one function that lists every flow between the levels. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the drawing, the graph, the sentences under them and the table |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The three tabs

The first two are two views of the same model. They share the controls and the notes.

- **The flows:** the model seen from the side, with space at the top, then the upper layer, the lower layer and the black ground.
  - Sunlight comes straight down through both layers as an orange arrow.
  - Earthlight is wavy blue arrows in three columns: what the ground emits, what the lower layer emits and what the upper layer emits. Each is followed up or down through the layers it passes, with a dotted line where it goes through a layer and a smaller number on the other side.
  - Heat carried by rising air is two broad dashed purple arrows, from the ground into the lower layer and from the lower layer into the upper layer.
  - Every arrow has its number in W/m² beside it. Every level has its temperature beside it.
  - Under the drawing, a sentence gives the three temperatures and the Earthlight that leaves the top, by where it came from.
  - Under that, a table has each level's heat budget in numbers: what it takes in and from where, and what it gives off.
- **The temperatures:** a graph with the ground at the bottom and temperature along the bottom.
  - A solid line joins the three temperatures for the reader's settings.
  - A dashed gray line joins the temperatures the same layers would have in still air, so the reader sees what the stirring does.
  - A thin upright line marks 288 K, the average temperature of the Earth's surface in Chapter 3.
  - The scale runs from 200 K to 340 K and widens when a temperature goes beyond it.
  - Under the graph, a sentence gives the three temperatures on all three scales and says what the stirring did to each level.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the numbers come from, how the model was checked, and the code.

## The controls

| Control | Range | As the page opens |
|---|---|---|
| Earthlight the upper layer absorbs | 1 to 100% | 75% |
| Earthlight the lower layer absorbs | 1 to 100% | 75% |
| Heat carried by rising air from the ground | 0 to the Sunlight the ground takes in | 103 W/m² |
| Heat carried by rising air from the lower layer | 0 to what's carried from the ground | 86 W/m² |
| Sunlight on a square meter that faces the Sun | 800 to 1,500 W/m² | 1,361 W/m², the Earth's |
| Albedo | 0 to 90% | 30%, the Earth's |

Three buttons set the air and leave the Sunlight and the albedo alone: two perfect panes with still air, leaky layers with still air, and back to the start.

**The limits are the first versions'.** A layer absorbs at least 1%, because a layer that absorbs nothing emits nothing and has no temperature. Rising air carries from the ground no more than the Sunlight the ground takes in, and from the lower layer no more than it brings up from the ground. Inside those limits every level emits more than nothing. The page moves the two sliders' stops as the Sunlight, the albedo and the other flow change, and says under each slider where it stops and why. `column()` in `model.js` refuses anything outside the limits, and `trouble()` says in words what's wrong.

**Where the page opens.** The 103 W/m² from the ground is the book's: Figure 3.10 has 82 W/m² leaving the surface by evaporation and 21 in rising warm air. The two shares of 75% and the 86 W/m² from the lower layer aren't measurements. They were chosen so that the ground comes out at 288 K, and the About tab says so. Other choices give 288 K too, and one of the things to try shows that.

**A layer can come out warmer than the level under it.** The reader chooses the heat the rising air carries, and the model carries it whatever the temperatures are. Real air wouldn't rise into warmer air above it. When a setting does this the page says so under the drawing and the graph, and still shows the answer.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/two-layer/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_two_layer_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers, at 3,240 settings. Its two sides must agree.
  - The worked example, for the page as it opens, must end on the model's numbers. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works. In one place a calculator gives 214.5 and the page prints 215, and the text says so.
  - The other numbers in the text are worked out from the model and looked for in the text.
  - A label in quotation marks must be a button on the page or the title of Chapter 3. The sliders must stop where the text says. Links must lead somewhere. What the text says about the book must still be in Chapters 2 and 3, and each figure's number is counted from the chapter.
- **So some changes elsewhere fail a test until the About text follows:** a change to `model.js`, a new range for a slider, a renamed button, a new title for the `layers` or `infrared` page, or a rewrite of the layer model or the energy budget in Chapter 3. The failure says what the text should say.
- **A link can open one section:** `/models/two-layer/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8793 --bind 127.0.0.1 --directory models/two-layer/web
```

Then open `http://127.0.0.1:8793/`. The drawing and the graph also work when `index.html` is opened straight from the disk. The two boxes of code on the About tab don't, because a browser won't load a file into the page that way. The links to the other models work on the site, where the pages are neighbors.

## Addresses that open a chosen state

The page keeps its state in the address, so any setting can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `flows`, `profile` or `about`. After `about`, a `#` and a section's name opens that section |
| `upper` | The share of the Earthlight the upper layer absorbs, in percent |
| `lower` | The share the lower layer absorbs, in percent |
| `fromground` | The heat rising air carries from the ground into the lower layer, in W/m² |
| `fromlower` | The heat rising air carries from the lower layer into the upper layer, in W/m² |
| `sun` | The Sunlight on a square meter that faces the Sun, in W/m² |
| `albedo` | The albedo, in percent |
| `embed=1` | The compact layout for an iframe, with an "Open in a new window" link. Nothing uses it yet |

A number beyond a control's range is set to the nearest end, and a flow of rising air beyond the model's limits is set to the limit. Example: `/models/two-layer/?upper=100&lower=100&fromground=0&fromlower=0`, the book's two panes.

## The science

The letters are the About tab's. The levels are numbered from the top, as in `layers`: 1 is the upper layer, 2 is the lower layer and g is the ground.

**What the model assumes.**

- The air lets all the Sunlight through. The ground is black: it absorbs all the Sunlight that isn't reflected and all the Earthlight that reaches it.
- Each layer absorbs a share ε of the Earthlight that reaches it and lets the rest straight through. It emits as strongly as it absorbs (Kirchhoff's law), so a layer at temperature *T* emits *E* = εσ*T*⁴ from each of its two sides. Scientists call ε the emissivity.
- Rising air carries a chosen amount of heat, *C*<sub>g</sub>, from the ground into the lower layer and another, *C*₂, from the lower layer into the upper layer. This stands for warm air rising and for water that evaporates at the surface and condenses higher up. Chapter 3 calls it vertical mixing, and scientists call it convection.
- Every level takes in as much as it gives off.

**The three budgets and the top.**

- The ground: *Q* + *E*₂ + (1 − ε₂)*E*₁ = *E*<sub>g</sub> + *C*<sub>g</sub>
- The lower layer: ε₂*E*<sub>g</sub> + ε₂*E*₁ + *C*<sub>g</sub> = 2*E*₂ + *C*₂
- The upper layer: ε₁*U* + *C*₂ = 2*E*₁, where *U* = (1 − ε₂)*E*<sub>g</sub> + *E*₂ is the Earthlight that comes up to it
- The top: *Q* = *E*₁ + (1 − ε₁)*U*

**The seven steps** solve them one level at a time, from the top down.

1. **The ground takes in** *Q* = *S*(1 − α) ÷ 4.
2. **A level at temperature** *T* **emits** *E* = εσ*T*⁴, with ε = 1 for the ground.
3. **The upper layer.** The top's budget and the layer's own budget have the same two unknowns, and together they give *E*₁ = (ε₁*Q* + (1 − ε₁)*C*₂) ÷ (2 − ε₁).
4. **What comes up to the upper layer.** Between the layers, what goes up equals what comes down: *U* = *Q* + *E*₁ − *C*₂.
5. **The ground.** Its budget, with step 4, gives *E*<sub>g</sub> = *E*₁ + (2*Q* − *C*<sub>g</sub> − *C*₂) ÷ (2 − ε₂).
6. **The lower layer.** *E*₂ = *U* − (1 − ε₂)*E*<sub>g</sub>.
7. **Each level's temperature** is (*E* ÷ εσ) to the power 1/4.

With ε₁ = ε₂ = 1 and no rising air these give *Q*, 2*Q* and 3*Q*, which is `layers` with two panes.

**What the model leaves out.**

- **The air decides nothing for itself.** The reader chooses how much heat rises. In the real atmosphere the temperatures decide that.
- **One share for all the Earthlight.** A real gas absorbs some colors of Earthlight almost completely and others hardly at all (Sections 3.3 and 3.4, and the `infrared` model). So the model can match the surface's 288 K and not every flow of Figure 3.10 at once: as it opens, 24 W/m² of the ground's Earthlight goes straight to space (Figure 3.10 has 22), and its sky sends 255 W/m² down (Figure 3.10 has 342).
- **The air absorbs no Sunlight.** In Figure 3.10 it absorbs 80 W/m².
- **One square meter stands for the whole planet,** day and night, in every season.

## Where the numbers come from

- **The solar constant, 1,361 W/m²:** the book's value in Chapter 2, from Kopp and Lean (2011), doi:10.1029/2010GL045777.
- **The albedo, 30%:** Chapter 2's "about 30 are reflected" of every 100.
- **σ, 5.67 × 10⁻⁸ W/m² per K⁴:** the Stefan–Boltzmann constant, as Chapter 2 gives it.
- **The surface's 288 K:** Chapter 3.
- **The 103 W/m² that rising air carries from the ground:** 82 + 21, from Figure 3.10 of the book.
- **The 75%, 75% and 86 W/m²:** chosen to give 288 K. They're no one's measurements.
- **The layer model:** Chapter 3 cites Archer (2012), *Global Warming: Understanding the Forecast*, 2nd edition, John Wiley & Sons.

## How it was checked

`tests/test_two_layer_model.py` has the seven equations written out a second time, in Python, and runs both copies.

1. **The page's code, against the second copy.** At 339 settings of the six controls and at the edges of the limits, `model.js` and the Python give the same temperatures to a millionth of a kelvin. The test runs `model.js` in Node, or in Chrome where there's no Node.
2. **The short way, against the long way.** The test also takes the three budgets above and solves them all at once, as a set of simultaneous equations. The two ways agree to a millionth of a kelvin at 3,240 settings.
3. **The first versions of the model.** Scott's R function and the Python version he made with Codex both solve the budgets as a matrix. Run unchanged at 339 settings (R 4.6.0, and Python with NumPy), they agree with each other and with this page to a millionth of a kelvin. Their answers are in `tests/two-layer-oracle.json`, so the test needs neither R nor NumPy.
4. **The simpler model and the book.** With perfect layers and still air the levels emit *Q*, 2*Q* and 3*Q*, and with the Earth's Sunlight and albedo they're at 255 K, 303 K and 335 K.
5. **Heat in, against heat out.** At every setting the Earthlight that leaves the top equals the Sunlight the ground takes in, and each level gives off what it takes in. The flows that `column()` lists for the drawing and the table are added up the same way.
6. **The limits.** Inside them, every level emits more than nothing at 3,240 settings and at every corner of the page's controls. Outside them, `column()` refuses.
7. **What the About tab says the model does.** In still air the temperatures always fall with height. Rising air always cools the ground and never cools the upper layer.
8. **The page itself.** Where there's a Chrome, the test opens the page and reads the sentences and the table: as the page opens, with two perfect panes, at the least Sunlight the controls can give, with an address that asks for more than the controls allow, and with a layer warmer than the level under it.

## What changed from the first versions

The first version is Scott's R Shiny app, "2-Layer Atmosphere with Solar, Longwave, & Convection". The second is a Python Shiny version he made with Codex, with tests, the model's limits and a redrawn diagram. Their science is right, and this page has the same model. Their code is public at `github.com/climate-toy-models/two-layer-graybody`.

- **The model is seven equations,** not a matrix. Both first versions built the three budgets as a matrix and solved it. The budgets can be solved one level at a time, and the tests hold the seven steps to the matrix.
- **The levels are numbered from the top,** as in `layers` and in Chapter 3's panes. The first versions numbered them from the ground.
- **A layer's share is in percent, from 1 to 100,** and the page opens at 75%. The first versions had an emissivity from 0.01 to 1 and opened at 0.5.
- **The page opens stirred,** with 103 and 86 W/m² of rising air and the ground at 288 K. The first versions opened with still air.
- **The Sunlight opens at 1,361 W/m²,** the book's value, and moves in steps of 1. The first versions opened at 1,368 and moved in steps of 10.
- **The albedo goes down to 0.** The first versions' stopped at 5%.
- **The graph has a second line,** for the same layers in still air, and a mark at 288 K.
- **The page says when a layer is warmer than the level under it.** The first versions drew it without a word.
- **Temperatures are printed in kelvins, °C and °F together.** The first versions had a choice of one.
- **The words are the book's:** Sunlight and Earthlight for shortwave and longwave, the share a layer absorbs for emissivity, heat carried by rising air for convective flux. The About tab names emissivity, Kirchhoff's law and convection once each.
- **The drawing and the graph are drawn by the page's own code.** The Python version drew them with Matplotlib, on a server.
- Every control works from the keyboard, and the sentences and the table say in words and numbers what the pictures show. Sunlight's arrow is straight, Earthlight's are wavy and rising air's are broad and dashed, so nothing depends on color alone.

Both first versions, and Claude's notes on reading and running them, are in the data store: `climate-change-textbook-data/models/two-layer/`.

## Still to do

- Nothing is waiting. The compact layout (`?embed=1`) is there if a chapter ever wants the model.
