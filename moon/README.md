# A Day on the Moon: Sunlight, Crushed Rock and No Air

A page for teaching what a day and a night do to ground with no air over it. The reader sets the length of the day, the albedo and the time step, and the page draws the temperature of the ground at the Moon's equator from one midnight to the next. It goes with Chapter 2 (Box 2.2 asks how cold the ground would get in one night if its own glow were its only energy transfer).

- **Public address:** `/models/moon/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters (Scott, 12 November 2026).
- **There's no soil on the Moon,** and the page never says there is (Scott, 12 November 2026). Soil hosts living things, and they maintain it. The Moon has bedrock that impacts have crushed. The page says *crushed rock* for the material and *the ground* for the place. It says *regolith*, the researchers' word, once to define it and where it reports what they found.
- **Everything runs in the reader's browser.** There's no server, no build step, no data file and no outside library.
- **The whole model is six equations,** and `web/model.js` is under 200 lines. A student can read all of it.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the six equations, and the loop that runs them until a day repeats. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the graph and the lines under it |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The two tabs

- **The Moon's day:** one day at the equator, on the Sun's clock, so sunrise is at 6 a.m. however long the day is.
  - The upper graph has the temperature of the surface (the top 5 mm of the ground) and of the ground 3, 10 and 30 cm down.
  - The lower graph has the heat going into the ground.
  - Under the graphs, a table takes one moment apart: the Sunlight the surface takes in, the infrared radiation it emits, the heat flowing down and how much the surface warms in that step. The arrow keys move the moment along the day.
  - A day can be kept and compared with the next one.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the numbers come from, how the model was checked, and the code.

## The controls

| Control | Range | As the page opens |
|---|---|---|
| Length of the day | 17 stops from 1 to 365 Earth days | 29.53 Earth days, the Moon's own |
| Albedo | 5 to 30% | 11% |
| Time step | 1 to 20 minutes | 5 minutes |

Two buttons set the day to the length of the Earth's, and to an Earth year.

**The time step is a lesson, and it's meant to break.** For the Moon's own day, a step longer than about 13.2 minutes makes the surface's temperature zig-zag. At 20 minutes the model blows up before noon on its first day. The page says so in words when it happens, and step 6 on the About tab explains why.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/moon/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_moon_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers. Its two sides must agree.
  - The worked example, for 8:00 a.m., must end on the model's number. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the model and looked for in the text: the Moon's day and night, the two other lengths of day, the depths on the graph, the longest time step and the checks.
  - A label in quotation marks must be a button on the page or the title of Chapter 2. The sliders must stop where the text says. Links must lead somewhere. What the text says about Box 2.2 must still be in Chapter 2.
- **So some changes elsewhere fail a test until the About text follows:** a change to `model.js`, a new range for a slider, a renamed button, or a rewrite of Box 2.2. The failure says what the text should say.
- **A link can open one section:** `/models/moon/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8791 --bind 127.0.0.1 --directory models/moon/web
```

Then open `http://127.0.0.1:8791/`. The graphs also work when `index.html` is opened straight from the disk. The two boxes of code on the About tab don't, because a browser won't load a file into the page that way.

## Addresses that open a chosen state

The page keeps its state in the address, so any day can be linked or bookmarked.

| Part | Meaning |
|---|---|
| `view` | `day` or `about`. After `about`, a `#` and a section's name opens that section |
| `day` | The length of the day in Earth days. The page takes the nearest of the slider's 17 stops |
| `albedo` | The albedo, in percent |
| `step` | The time step, in minutes |
| `keep` | The kept day, written by the page |
| `embed=1` | The compact layout for an iframe, with an "Open in a new window" link. Nothing uses it yet |

Example: `/models/moon/?day=1`, a Moon that turns as fast as the Earth.

## The science

- **One column of crushed rock at the equator,** in 13 layers. The top layer is 5 mm thick and each layer is 1.4 times as thick as the one above, so the column reaches 0.98 m down.
- **Sunlight:** 1,361 W/m², the book's solar constant, times the cosine of the Sun's angle from overhead, less the share that's reflected. There's none at night. The Moon has no tilt to speak of, so there are no seasons in the model.
- **The surface emits as a black surface does,** by the Stefan–Boltzmann law. Nothing comes down from the sky.
- **Heat moves between layers by conduction.** The crushed rock's conductivity is 0.003 W/m per K and its heat capacity is 1.0 million J/m³ per K, at every depth and every temperature. Nothing leaves the bottom of the lowest layer.
- **Time moves forward in equal steps.** Every flow in a step is worked out from the temperatures at the start of it. That's the simplest way to do it, and it's why too long a step breaks the model.
- **The model runs until a day repeats:** the surface's average is within 0.002 K of the day before, and every layer's average is within 0.002 K of the surface's. The ground a meter down would take decades to get there by itself. So after each day the model moves each layer by the difference between the surface's average and its own. That takes about 8 days.
- **The Moon's day** is 29 days, 12 hours and 45 minutes, from one noon to the next.

**What the model leaves out.** The Moon's real regolith is loose at the top and packed below, and it carries heat better when it's warm. Its albedo rises when the Sun is low. It isn't quite black in the infrared. A little heat comes up from the Moon's interior, and the Sun's distance changes through the year. The research models have all of these (Vasavada et al., 2012; Hayne et al., 2017). This one has the same crushed rock all the way down, and it's here to be read.

## Where the numbers come from

- **The crushed rock's conductivity, 0.003 W/m per K:** Vasavada et al. (2012), doi:10.1029/2011JE003987, who compared the night temperatures Diviner measured at the equator with models of the regolith. That's the conductivity they used for a regolith that's the same at every depth.
- **The crushed rock's heat capacity, 1.0 million J/m³ per K:** chosen with the conductivity so that the thermal inertia, the square root of the two multiplied together, is 54.8 J/m² per K per √s. Hayne et al. (2017), doi:10.1002/2017JE005387, found 55 ± 2 for the top few centimeters.
- **The albedo, 11%, and the length of the day:** NASA's Moon Fact Sheet (Williams, D. R., 2024) gives a Bond albedo of 0.11 and 29.53 days from one noon to the next.
- **What the Moon measures:** Williams, J.-P., et al. (2017), doi:10.1016/j.icarus.2016.08.012.
- **The word regolith:** Merrill, G. P. (1897), *A Treatise on Rocks, Rock-Weathering and Soils* (Macmillan), page 299: "This entire mantle of unconsolidated material, whatever its nature or origin, it is proposed to call the regolith", from the Greek words for a blanket and a stone. Read in a scan of the University of California's copy.

## How it was checked

`tests/test_moon_model.py` has the six equations written out a second time, in Python, and runs both copies.

1. **The page's code, against the second copy.** On the page as it opens and seven other settings, `model.js` and the Python give the same temperatures to a millionth of a kelvin. The test runs `model.js` in Node, or in Chrome where there's no Node.
2. **The shortcut, against the slow way.** The Python also runs with no shortcut: every layer starts at 250 K and the model runs for 495 of the Moon's days, which is 40 years. After 10 years the lowest layer is still more than 3 K too warm. After 40 years every layer is within 0.01 K of what the shortcut gives in 8 days.
3. **Energy in, against energy out.** Over the repeating day the surface takes in 385.6 W/m² and emits 385.6 W/m², and every layer has the same average temperature.
4. **A shorter step, against the usual one.** Steps of 1 and 13 minutes give the same day as 5 minutes, within 0.02 K.
5. **The step that breaks.** The longest step from step 6 on the About tab falls between 13 and 14 minutes. At 13 minutes the surface warms once and cools once. At 14 it zig-zags.
6. **The model, against the Moon.** Diviner found about 387 to 397 K at noon on the equator and about 95 K just before sunrise. NASA's fact sheet gives 95 K to 390 K. The model gives 381.5 K and 94.1 K.

**A run that breaks doesn't break the same way twice.** With too long a step, the zig-zag grows out of the last digit of the arithmetic. So the moment the model blows up differs a little between the page and the Python copy (by a few minutes on the graph's clock), and it may differ between browsers. The tests hold such a run loosely: it blows up between 10 a.m. and noon on its first day. The page's text says "before noon" for the same reason. Don't put a clock time in it.

**Noon is a little cool.** A black surface in balance with 1,361 W/m² at an albedo of 11% is at 382.3 K, so no choice of those two numbers would lift the model's noon into Diviner's range. That would take the things the model leaves out.

## What changed from the first version

The first version is Scott's R Shiny app, which began as a homework assignment. This one keeps its equations and its idea of a time step that can break.

- **The crushed rock's two numbers are new,** with Scott's agreement (11 November 2026). The app had a heat capacity of 4.4 million J/m³ per K and a conductivity of 0.025 W/m per K, after an engineering study of storing heat in the Moon's regolith (Colozza, 1991, NASA Contractor Report 189073). Ground like that holds too much of the day's heat, and the app's surface was at 144 K before sunrise, about 50 K warmer than Diviner found. With 1.0 million and 0.003 it's at 94 K.
- **The day's length is a control.** The app had only the Moon's own day.
- **The model runs until a day repeats.** The app ran 10 of the Moon's days from 273 K, which left the deep layers near where they started.
- **The layers are thinner and the column is shallower:** 13 layers to 0.98 m, with a top layer of 5 mm. The Moon's daily cycle fades out well above the bottom.
- **The time step is in minutes,** from 1 to 20. The app's was in hours. The thinner top layer and the new numbers for the crushed rock make the longest sound step much shorter.
- **The Sun is 1,361 W/m²,** the book's value, and nothing comes down from the sky. The app had 1,367 W/m² and a sky at 5 K.
- **The page prints one step taken apart,** so a student can check the arithmetic with a calculator.
- Every control works from the keyboard, and the graph has a text summary. Each line is labeled on the graph as well as in the key, so nothing depends on color alone.

Scott's app, and Claude's notes on reading and running it, are in the data store: `climate-change-textbook-data/models/moon/`. The app's folder also holds Scott's later and more careful version of the model, with regolith that changes with depth and temperature. Nothing here uses it yet.

## Still to do

- Nothing is waiting. The compact layout (`?embed=1`) is there if a chapter ever wants the model.
