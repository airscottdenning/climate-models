# The Push and the Response: Forcing, Feedback and Warming

A page for teaching how a push on the climate turns into warming. The reader sets how hard carbon dioxide, methane and reflective smog push, how strong each feedback is, and how fast heat passes down into the deep ocean. The page draws the warming since 1850 beside the measurements, and the warming to 2100 in five of the IPCC's scenarios. It goes with Chapter 4 (Box 4.1 adds up the feedbacks).

- **Public address:** `/models/forcing-feedback/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters (Scott, 12 November 2026).
- **Everything runs in the reader's browser.** There's no server, no build step and no outside library. The data is one file of 29 kB.
- **The whole model is eight equations,** and `web/model.js` is about 150 lines. A student can read all of it.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the eight equations, and the loop that runs them a year at a time. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the graphs and the lines under them |
| `web/data.json` | The forcing for each year, the measured temperature, a few of the IPCC's numbers, and where each came from |
| `equations.py` | The equations on the About tab. It writes them into `web/index.html` |
| `build_data.py` | Makes `web/data.json` from four small tables |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## The five tabs

The first four are numbered, because each builds on the one before.

- **1. Forcing:** the push for each year from 1850 to 2019, in W/m², counted from 1750. Heavy lines for CO₂, reflective smog and the total, and thin gray lines for the rest.
- **2. Feedback:** two drawings on one scale of gain.
  - The upper one lays the four feedbacks' gains end to end, so the last bar ends at the total.
  - The lower one is the curve that turns the total gain into the warming from doubled CO₂, with a dot at the reader's setting and the IPCC's ranges behind it.
- **3. Response:** the model's surface temperature from 1850 to 2019 beside the measured temperature, and the deep ocean's.
  - The lower graph is the model's energy imbalance, with a bar for what was measured over 2006 to 2018.
  - Under the graphs, a table shows the model's whole sum for the year being read.
- **4. The future:** the model run on to 2100 for five scenarios, with the IPCC's own answer for 2081 to 2100 beside each.
- **About:** the model explained to a student. In order: how to use the page, the equations with a worked example, things to try, where the data come from, how the model was checked, and the code.

"Smog" is the book's word for aerosols. "Vertical mixing" is its word for the lapse-rate feedback.

## The controls

| Control | Range | As the page opens |
|---|---|---|
| Carbon dioxide | 75 to 125% of the IPCC's best estimate | 100% |
| Methane | 60 to 140% | 100% |
| Reflective smog | 40 to 160% | 100% |
| Gain of ice and snow | 0.03 to 0.19 | 0.11 |
| Gain of clouds | −0.15 to 0.41 | 0.13 |
| Gain of water vapor | 0.40 to 0.75 | 0.56 |
| Gain of vertical mixing | −0.35 to 0 | −0.16 |
| "Keep these two adding up to 0.40" | a box to tick | ticked |
| Heat passing down to the deep ocean | 0 to 1.5 W/m² per °C | 0.7 |

- **Each view adds a set of controls.** The first view has the forcing sliders, the second has the gains, and the third and fourth have all of them. On a phone a set is folded away until the reader opens it.
- **The forcing sliders reach past the IPCC's ranges, on purpose.** Each slider's hint gives the forcing it makes in 2019 beside the IPCC's very likely range for that year. The slider for clouds reaches past the IPCC's range too, and its hint gives that range. A student can see when a setting has left the evidence behind.
- **The gains can add up to 1 or more.** Then there's no stable climate. The page says so in words and draws nothing. The About tab explains why.

## The About tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/forcing-feedback/equations.py --write`. It fills each `<div class="eq" data-eq="…">` in `web/index.html`. `--check` fails if the page and `equations.py` differ. Why the equations are written this way: `models/mathml.py`.
- **The tests hold the tab to the model** (`AboutPageTests` in `tests/test_forcing_feedback_model.py`):
  - Every equation on the page is read back and worked out with the model's own numbers. Its two sides must agree.
  - The worked example, for 2019, must end on the model's numbers. It must also print the same when each step starts from the rounded numbers of the step before, the way a reader with a calculator works.
  - The other numbers in the text are worked out from the model and the data and looked for in the text. That covers every section, including each number under "See the equations at work" and "How it was checked".
  - A label in quotation marks must be a tab, a button or a box on the page, or the title of Chapter 4. The sliders must stop where the text says. Links must lead somewhere. What the text says about Chapter 4 must still be in Chapter 4, and what it says about stopping emissions must still be in Chapter 9.
- **So some changes elsewhere fail a test until the About text follows:** a change to `model.js` or to the data, a new range for a slider, a renamed tab, or a rewrite of Box 4.1 or of Section 9.5. The failure says what the text should say.
- **A link can open one section:** `/models/forcing-feedback/?view=about#about-equations`. The sections are `about-use`, `about-equations`, `about-try`, `about-data`, `about-checked` and `about-code`.
- **The code is shown inside the page,** and the tab links to this folder's copy in the public repository `airscottdenning/climate-models`. That repository is filled by `scripts/export_models.py` each time the site is published. Make changes here, never there.

## Preview

```
python3 -m http.server 8794 --bind 127.0.0.1 --directory models/forcing-feedback/web
```

Then open `http://127.0.0.1:8794/`. The page needs the server: a browser won't load `data.json` into a page that was opened straight from the disk.

## Addresses that open a chosen state

The page keeps its state in the address, so any setting can be linked or bookmarked. A control at its opening value isn't written there.

| Part | Meaning |
|---|---|
| `view` | `forcing`, `feedback`, `response`, `future` or `about`. After `about`, a `#` and a section's name opens that section |
| `co2`, `methane`, `smog` | The three forcing sliders, in percent |
| `ice`, `clouds`, `water`, `mixing` | The four gains |
| `tie=0` | Clears the box that ties water vapor to vertical mixing |
| `ocean` | Heat passing down to the deep ocean, in W/m² per °C |
| `embed=1` | The compact layout for an iframe, with an "Open in a new window" link. Nothing uses it yet |

Example: `/models/forcing-feedback/?view=response&ocean=0`, a world with no deep ocean.

## The science

The eight equations are on the About tab, each with its explanation. In short:

- **The push.** The forcing in a year is the IPCC's best estimate for CO₂, methane, reflective smog and everything else, with the reader's three percentages on the first three.
- **The gains add.** Each feedback's gain is its strength in W/m² per °C, divided by 3.22, the IPCC's value for the response with no feedbacks. The total gain is the four added together.
- **The sensitivity** is the baseline, 1 ÷ 3.22 = 0.3106 °C per W/m², divided by 1 less the total gain. This is the sum of Box 4.1.
- **Doubled CO₂** pushes by 3.93 W/m², so the equilibrium climate sensitivity is that times the sensitivity.
- **Two layers.** The surface layer is the air, the land and the top of the ocean. Under it is the deep ocean.
  - Each year the surface keeps the energy imbalance, less the heat it passes down.
  - The deep ocean keeps what comes down.
  - The model starts in 1850 with both at zero, and takes steps of a year.
- **The graphs count from 1850 to 1900,** as the measurements do: the model's own average over those years is taken away from the model.

**What the model leaves out.** One sensitivity for all time, so nothing for the changing pattern of warming over the oceans. Every W/m² counts the same, whatever made it. No weather and no El Niño. No carbon cycle: the model is handed its forcing, so it can't show that warming stops when emissions stop (Chapter 9). No map. The About tab says each of these to the student, under "Where the equations stop".

## Where the numbers come from

Each was read in the source on 12 November 2026.

- **The feedbacks, the baseline and the forcing from doubled CO₂:** Forster et al. (2021), Chapter 7 of the IPCC's Sixth Assessment Report, Working Group I, doi:10.1017/9781009157896.009.
  - Table 7.10 gives 1.30 W/m² per °C for water vapor and lapse rate together, 0.35 for surface albedo and 0.42 for clouds, against −3.22 for the Planck response. Divided by 3.22, those are the opening gains: 0.40, 0.11 and 0.13.
  - The chapter gives −0.50 for the lapse rate alone. That makes the split of the pair: −0.16 for vertical mixing and 0.56 for water vapor.
  - The forcing from doubled CO₂ is 3.93 W/m².
- **The two heat capacities, 7.3 and 110 W yr/m² per °C, and the opening heat exchange, 0.7 W/m² per °C:** the averages over 35 climate models in `data_input/tunings/cmip6_twolayer_tuning_params.json`, from the same chapter's archive (Smith et al., 2021, doi:10.5281/zenodo.5211358). The averages are 7.31, 110.4 and 0.68. The file has two fits for each climate model. These are from the one named EBM-1, which has the same equations as this page. The other, EBM-epsilon, has one more number, an efficacy for the deep ocean's heat uptake.
- **The kind of model:** Held et al. (2010), doi:10.1175/2009JCLI3466.1, and Geoffroy et al. (2013), doi:10.1175/JCLI-D-12-00195.1.
- **The IPCC's numbers drawn beside the model's:**
  - Warming for 2081 to 2100 in each scenario: Table SPM.1 of the Summary for Policymakers, doi:10.1017/9781009157896.001.
  - The equilibrium climate sensitivity (best estimate 3 °C, likely 2.5 to 4, very likely 2 to 5), the transient climate response (1.8 °C, likely 1.4 to 2.2), the energy imbalance over 2006 to 2018 (0.79 W/m², 0.52 to 1.06) and the forcing in 2019 with its ranges: Chapter 7.
- **The forcing and the measured temperature:** see "The data's terms" below.

## How it was checked

`tests/test_forcing_feedback_model.py` has the eight equations written out a second time, in Python, and runs both copies.

1. **The page's code, against the second copy.** For the past and all five futures, at the opening settings and eleven others, `model.js` and the Python give the same temperatures to a billionth of a degree. The test runs `model.js` in Node, or in Chrome where there's no Node.
2. **Box 4.1's sum, the long way.** The Python adds up the rounds of feedback one at a time until they stop growing. The total matches 1 ÷ (1 − *g*).
3. **The end of the story.** With the forcing held at 3.93 W/m², the surface has warmed by 2.50 °C after 100 years and 3.36 °C after 1,000. It settles at 3.39 °C, which is the equilibrium climate sensitivity at the opening settings.
4. **Heat in, against heat kept.** The energy imbalance added up from 1850 to 2019 equals the heat the two layers gained. About 73% of it is in the deep ocean.
5. **Shorter steps and an earlier start.** A hundred steps a year move the model's temperature by 0.04 °C at most. Starting in 1750 changes nothing by more than 0.01 °C after 1855.
6. **The model, against the measurements.** At the opening settings the typical difference is 0.14 °C over 1850 to 2019.
7. **The model, against the IPCC.** See "The model runs warm" below.
8. **The data, against its sources.** The forcing and the temperatures were downloaded again on 12 November 2026 and made into the four tables a second time. Every number matched. `web/data.json` must be exactly what `build_data.py` makes, and a short record of it travels with the tests (`tests/forcing-feedback-oracle.json`), so the check also runs where the tables aren't at hand.
9. **The tests, against mistakes.** Seventeen small errors were put into a copy, one at a time: a sign in `model.js`, a digit in the data, a number in the About text, a slider's end, a sentence in each of the two chapters. The tests caught every one.

**The model runs warm at its opening settings,** and the About tab says so.

| | The model | Measured, or the IPCC |
|---|---|---|
| Average for 2010 to 2019 | 1.25 °C | 1.09 °C measured |
| Energy imbalance, 2006 to 2018 | 0.94 W/m² | 0.79 (0.52 to 1.06) measured |
| Transient climate response | 2.2 °C | 1.8 (likely 1.4 to 2.2) |
| 2081 to 2100, SSP1-1.9 to SSP5-8.5 | 1.5, 2.0, 3.1, 4.2, 5.2 °C | 1.4, 1.8, 2.7, 3.6, 4.4 |

- Every one of the model's futures is inside the IPCC's very likely range.
- Most of the gap is the opening sensitivity. The IPCC's feedbacks, added one at a time, give 3.4 °C for doubled CO₂. Its best estimate from all the evidence is 3 °C.
- The opening settings are the IPCC's central values, and they weren't tuned to close the gap. With clouds at 0.07 the sensitivity is 2.9 °C and the futures are 1.4, 1.8, 2.8, 3.8 and 4.7 °C.

## What changed from the first version

The first version is Scott's, built with OpenAI Codex. This one keeps its idea, its data and its numbers for the feedbacks.

- **A deep ocean replaces a single delay.** The first version moved the temperature toward its final value with one response time, 12 years as it opened. That warmed too fast:
  - Its 2010 to 2019 average was 1.51 °C, where 1.09 °C was measured.
  - Its futures for 2081 to 2100 were 2.1, 2.8, 4.2, 5.6 and 6.9 °C, all above the IPCC's very likely ranges.
  - No single response time fits both the last 50 years and the next 80. The surface answers a push within a few years, and the deep ocean takes centuries.
- **With two layers there's an energy imbalance to draw,** and a measurement to draw it beside.
- **One slider for clouds** in place of two. The first version split clouds into low and high with gains of 0.08 and 0.05. The IPCC's table doesn't give that split, so the page has their total, 0.13.
- **The futures are a view of their own,** with the IPCC's answers beside the model's.
- **The CO₂ and methane concentrations are gone.** The first version showed them when the pointer was over a graph. The model doesn't use them, and their license (CC BY-SA 4.0) would have had to travel with the data.
- **The words are the book's:** smog for aerosols, vertical mixing for lapse rate, gain for feedback factor, and W/m² throughout.
- **The About tab is new:** the equations, a worked example for 2019 that a calculator can follow, things to try, and how the model was checked.
- Every control works from the keyboard, and every graph has a text summary. Each line is labeled on the graph as well as in the key, so nothing depends on color alone.

The first version and the notes on checking it are in the data store: `climate-change-textbook-data/models/forcing-feedback/`.

## Rebuilding the data

```
/usr/bin/python3 -I models/forcing-feedback/build_data.py
```

It reads four small tables (not in Git) from the frozen copy of the first version's workspace in the data store, `climate-change-textbook-data/models/forcing-feedback/codex-workspace-2026-11-12/data/derived/`, and checks each one's SHA-256 first. To build from the tables somewhere else, give their folder as an argument. `DataTests` fails if `web/data.json` isn't what the script makes.

**The measured temperatures grow by a year each January.** To add one, make the table again from the Met Office's file, change its SHA-256 and the last year in `build_data.py`, and run the tests. They will say which numbers in the About text to change.

## The data's terms

`web/data.json` holds data from two sources. The MIT license on this model's code doesn't cover the second one. Each source's terms travel inside the file, under `sources`.

- **The forcing:** Smith, C., et al. (2021), *IPCC WGI AR6 Chapter 7* (v.1.0), Zenodo, doi:10.5281/zenodo.5211358. The files are `data_output/AR6_ERF_1750-2019.csv` and `data_output/SSPs/ERF_ssp*_1750-2500.csv`, from github.com/IPCC-WG1/Chapter-7. The archive's license is the MIT License, "Copyright (c) 2020 Chris Smith". Its notice is in `data.json` in full, as that license asks.
- **The measured temperature:** HadCRUT.5.1.0.0, the global average for each year (Morice et al., 2021, doi:10.1029/2019JD032361). "Contains public sector information licensed under the Open Government Licence v3.0. © Crown copyright, Met Office." The page moves it to its own 1850 to 1900 average. If you reuse it, keep that sentence with it.
- **The IPCC's numbers** in the file were typed from the report, for comparison. No text, table or figure from the report is here.

## Still to do

- **The forcing stops in 2019.** Chapter 4 uses an update to 2025, and the About tab says so. A newer yearly forcing would let the third view run to the end of the measurements.
- The compact layout (`?embed=1`) is there if a chapter ever wants the model.
