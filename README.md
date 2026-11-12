# Climate models that run in your browser

Small teaching models from *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. Each one is a single web page. It runs in your browser, with no server and no outside software.

**Use them at [simpleserioussolvable.org](https://simpleserioussolvable.org/).** This repository is where to read the code.

## The models

| Model | Use it | Code |
|---|---|---|
| Milankovitch Cycles: Earth's Orbit and Sunlight | [simpleserioussolvable.org/models/milankovitch/](https://simpleserioussolvable.org/models/milankovitch/) | [`milankovitch/`](milankovitch/) |
| Earthlight Seen from Space: Greenhouse Gases and the Infrared Spectrum | [simpleserioussolvable.org/models/infrared/](https://simpleserioussolvable.org/models/infrared/) | [`infrared/`](infrared/) |
| A Day on the Moon: Sunlight, Crushed Rock and No Air | [simpleserioussolvable.org/models/moon/](https://simpleserioussolvable.org/models/moon/) | [`moon/`](moon/) |
| Panes of Glass: The Layer Model of the Greenhouse Effect | [simpleserioussolvable.org/models/layers/](https://simpleserioussolvable.org/models/layers/) | [`layers/`](layers/) |
| Leaky and Stirred: Two Layers of Air over Warm Ground | [simpleserioussolvable.org/models/two-layer/](https://simpleserioussolvable.org/models/two-layer/) | [`two-layer/`](two-layer/) |
| The Push and the Response: Forcing, Feedback and Warming | [simpleserioussolvable.org/models/forcing-feedback/](https://simpleserioussolvable.org/models/forcing-feedback/) | [`forcing-feedback/`](forcing-feedback/) |
| A Few Degrees: Hot Days, Cold Nights and the Bell Curve | [simpleserioussolvable.org/models/daily-temperatures/](https://simpleserioussolvable.org/models/daily-temperatures/) | [`daily-temperatures/`](daily-temperatures/) |

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

Data files keep the terms of their sources. Each model's `README.md` names them.
