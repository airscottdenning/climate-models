# Climate models that run in your browser

Small teaching models from *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. Each one is a single web page. It runs in your browser, with no server and no outside software.

**Use them at [simpleserioussolvable.org](https://simpleserioussolvable.org/).** This repository is where to read the code.

## The models

| Model | Use it | Code |
|---|---|---|
| Milankovitch Cycles: Earth's Orbit and Sunlight | [simpleserioussolvable.org/models/milankovitch/](https://simpleserioussolvable.org/models/milankovitch/) | [`milankovitch/`](milankovitch/) |
| Earthlight Seen from Space: Greenhouse Gases and the Infrared Spectrum | [simpleserioussolvable.org/models/infrared/](https://simpleserioussolvable.org/models/infrared/) | [`infrared/`](infrared/) |
| A Day on the Moon: Sunlight, Crushed Rock and No Air | [simpleserioussolvable.org/models/moon/](https://simpleserioussolvable.org/models/moon/) | [`moon/`](moon/) |
| Earthlight from the Sky | [simpleserioussolvable.org/models/night/](https://simpleserioussolvable.org/models/night/) | [`night/`](night/) |
| Panes of Glass: The Layer Model of the Greenhouse Effect | [simpleserioussolvable.org/models/layers/](https://simpleserioussolvable.org/models/layers/) | [`layers/`](layers/) |
| Leaky and Stirred: Two Layers of Air over Warm Ground | [simpleserioussolvable.org/models/two-layer/](https://simpleserioussolvable.org/models/two-layer/) | [`two-layer/`](two-layer/) |
| The Push and the Response: Forcing, Feedback and Warming | [simpleserioussolvable.org/models/forcing-feedback/](https://simpleserioussolvable.org/models/forcing-feedback/) | [`forcing-feedback/`](forcing-feedback/) |
| A Million Years of Ice Ages: Sunlight, Ice and Carbon Dioxide | [simpleserioussolvable.org/models/ice-ages/](https://simpleserioussolvable.org/models/ice-ages/) | [`ice-ages/`](ice-ages/) |
| A Few Degrees: Hot Days, Cold Nights and the Bell Curve | [simpleserioussolvable.org/models/daily-temperatures/](https://simpleserioussolvable.org/models/daily-temperatures/) | [`daily-temperatures/`](daily-temperatures/) |
| Where the Carbon Goes: Air, Ocean, Land and Warming to the Year 3000 | [simpleserioussolvable.org/models/earthcarbon/](https://simpleserioussolvable.org/models/earthcarbon/) | [`earthcarbon/`](earthcarbon/) |
| Spending the 21st Century Emission Budget | [simpleserioussolvable.org/models/emission-budget/](https://simpleserioussolvable.org/models/emission-budget/) | [`emission-budget/`](emission-budget/) |
| Four Factors, One Atmosphere: The Kaya Identity and Economic Convergence | [simpleserioussolvable.org/models/kaya/](https://simpleserioussolvable.org/models/kaya/) | [`kaya/`](kaya/) |
| Climate Damage: Compounding vs Discounting | [simpleserioussolvable.org/models/discounting/](https://simpleserioussolvable.org/models/discounting/) | [`discounting/`](discounting/) |
| Too Hot to Work: Heat, Humidity and the Human Body | [simpleserioussolvable.org/models/heat-and-work/](https://simpleserioussolvable.org/models/heat-and-work/) | [`heat-and-work/`](heat-and-work/) |
| Keeping the Lights On: A Year of Sun, Wind and Demand | [simpleserioussolvable.org/models/grid/](https://simpleserioussolvable.org/models/grid/) | [`grid/`](grid/) |
| Learning Beats Digging: Why Clean Energy Keeps Getting Cheaper | [simpleserioussolvable.org/models/learning/](https://simpleserioussolvable.org/models/learning/) | [`learning/`](learning/) |
| Rainfall Is Not Water Supply: A Watershed in a Warmer World | [simpleserioussolvable.org/models/watershed/](https://simpleserioussolvable.org/models/watershed/) | [`watershed/`](watershed/) |
| The Mop and the Bill: What It Costs to Take Carbon Back Out of the Air | [simpleserioussolvable.org/models/removal-bill/](https://simpleserioussolvable.org/models/removal-bill/) | [`removal-bill/`](removal-bill/) |
| The Hidden Cost: A Fuel, Its Smoke and a Price on Pollution | [simpleserioussolvable.org/models/hidden-cost/](https://simpleserioussolvable.org/models/hidden-cost/) | [`hidden-cost/`](hidden-cost/) |

More are on the way.

## How to read one

Start with the page's About tab. It explains the model's equations step by step, with a worked example. Then open the model's folder here:

- **`web/model.js` is the science:** the equations on the About tab, in a short file meant to be read from top to bottom.
- **`web/app.js` is the page:** the graphs, the maps and the controls.
- **`web/index.html` and `web/style.css`** are the page itself.
- **`README.md`** says what the model does, where its data come from and how it was checked.
- **`equations.py`** holds the equations shown on the About tab. `mathml.py`, beside this file, writes them into the page.

## Run one on your own computer

Download the repository, then in a terminal:

```
python3 -m http.server 8000 --directory milankovitch/web
```

Open `http://127.0.0.1:8000/` in your browser.

## About this repository

It's a copy. The models are written and tested with the textbook, and this repository is updated from there each time the website is published. So changes made here would be overwritten. If you find a mistake, please open an issue.

The models' own notes mention tests, scripts and a data store. Those live with the textbook, which isn't public yet.

## Licence

The code is under the MIT licence: see [`LICENSE`](LICENSE). You're welcome to use it, change it and teach with it.

The MIT licence covers the code, not the data. Data files keep the terms of their sources, and each model's `README.md` names them and how to cite them.
