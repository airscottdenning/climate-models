# Where the Carbon Goes: Air, Ocean, Land and Warming to the Year 3000

A model of the carbon cycle and the climate together, for the whole Earth, one year at a time from 1750 to the year 3000. It goes with Chapter 9 of *Climate Change: Simple, Serious, Solvable*, "The One-Way Thermostat". Use it at [simpleserioussolvable.org/models/earthcarbon/](https://simpleserioussolvable.org/models/earthcarbon/).

Fossil fuel puts carbon into the air. The ocean and the land take some of it back out. The carbon that stays in the air warms the world, and the warming changes how much the ocean and the land take up. The page shows:

1. **The past.** Given only how much fossil fuel was burned each year, the model works out the carbon dioxide in the air and the warming, beside the measurements, and where the carbon went since 1850.
2. **The future.** Six of the IPCC's scenarios, to 2100, 2300 or 3000.
3. **Where the carbon goes.** The carbon burned, and how much of it is in the air, the ocean and the land, year by year.
4. **The land sink.** What the land's uptake is made of: more carbon dioxide, nitrogen from burning, warming, and clearing and logging. Each part has its own reason to stop.

It began as Scott Denning's EarthCarbon, an R Shiny app his students have used for years to make a model match the past and then follow it a thousand years ahead. It was rebuilt in November 2026, first in Python and then for the browser.

## The science

- **The air** is one box of carbon: 2.18 billion tonnes of carbon (GtC) for each part per million of CO₂.
- **The ocean** is four boxes of water: a warm surface 100 m deep, the thermocline under it to 1,000 m, a cold surface near the poles and the deep ocean, after Toggweiler (1999). Water sinks at the poles, rises and mixes, and carries carbon, alkalinity, nitrate and heat. Plankton take carbon down with the nitrate. Each surface box trades CO₂ with the air at a rate set by its area, its temperature and a gas-transfer speed of 3 m a day. The CO₂ it holds up against the air comes from seawater chemistry with the standard constants (Lueker et al. 2000 and others), which agree with PyCO2SYS to within 1.5%. The exchange is solved by a backward step, so it never runs unstable. Warming makes the layers harder to mix.
- **The climate** is an energy balance. Forcing from CO₂ (3.93 W/m² for each doubling), smog and everything else, less the heat sent to space (3.93 W/m² for each °C, divided by the climate sensitivity), goes 91% into the ocean. The model finds the warming at which the ocean's own heat uptake matches. There is no fixed delay: the ocean sets it. Land warms 1.6 times as much as the warm sea, and the polar sea only as its ice goes.
- **The land** is three regions (boreal, temperate, tropics), each with wood, dead leaves, soil and stable soil. Growth rises with CO₂ along a curve that flattens, is held back when plants run short of nitrogen, and follows a bell curve of temperature that peaks at 25 °C. Wood can rise only so far above a mature forest's. Rot speeds up with warming (Q10) and with more litter arriving. Soil is mostly old, as radiocarbon shows (Shi et al. 2020). Clearing, farming, abandonment and logging follow LUH1, with old and young forest kept apart, so that young forest grows back and then stops.
- **The sink by cause.** The land is run again with one cause at a time held as in 1750; the difference is that cause's share.

Settings on the page: climate sensitivity, smog's cooling, ocean mixing, CO₂ fertilization, room for more wood, nitrogen limitation, Q10, the width of growth's temperature curve, clearing and logging, and how much fossil emissions may have been over-reported since 1950. They open at the model's best estimates. The address keeps any settings, so an assignment can link to a page that opens somewhere else.

## Files

| Where | What |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science, in the order of the About tab's steps. Nothing in it touches the page |
| `web/app.js` | The controls and the graphs |
| `web/record.json` | The measured past, 1750–2024 |
| `web/land-use.json` | Land use in each region, 1750–2023 |
| `web/scenarios.json` | Six SSP scenarios, 2025–2500. Licensed CC BY-SA 4.0 (below) |
| `equations.py` | The equations on the About tab (`--write` puts them into the page) |
| `build_data.py` | Makes the three data files from the Python model's tables |
| `reference/` | The Python model the page was copied from, with its tests and notes. In the book's private repository only |

## Data and licences

- Fossil emissions, and the sinks the page compares with: Global Carbon Budget 2025, Friedlingstein et al. (2026), *Earth System Science Data* 18, 3211–3288, doi:10.5194/essd-18-3211-2026. CC BY 4.0.
- Measured CO₂ and the forcing of the past: Indicators of Global Climate Change 2024, Forster et al. (2025), *Earth System Science Data* 17, 2641–2680, doi:10.5194/essd-17-2641-2025. CC BY 4.0.
- Measured warming: HadCRUT.5.1.0.0, Morice et al. (2021), doi:10.1029/2019JD032361. Contains public sector information licensed under the Open Government Licence v3.0.
- Land use: LUH1, Hurtt et al. (2011), *Climatic Change* 109, 117–161, doi:10.1007/s10584-011-0153-2; data Chini, Hurtt and Frolking (2014), doi:10.3334/ORNLDAAC/1248. After 2004, HYDE 3.3, Klein Goldewijk (2024), doi:10.24416/UU01-94FNH0, CC BY 4.0.
- Scenarios: RCMIP v5.1.0, Nicholls et al. (2020), *Geoscientific Model Development* 13, 5175–5190, doi:10.5194/gmd-13-5175-2020; protocol data doi:10.5281/zenodo.4589756, CC BY-SA 4.0. Extensions after 2100 after Meinshausen et al. (2020), doi:10.5194/gmd-13-3571-2020. **`web/scenarios.json` is derived from RCMIP's data, so it alone is licensed CC BY-SA 4.0.**
- The code is MIT. The MIT licence doesn't cover the data files.

## How it was checked

- **The browser against the Python model.** Eight runs to the year 3000, at very different settings and in all six scenarios, are saved in the book's tests. `model.js` gives the same CO₂, warming, ocean and land uptake, wood and ocean heat to about one part in a million.
- **The Python model against the world.** Its ocean alone, given measured CO₂, takes up 198 GtC over 1850–2024 (the Global Carbon Budget says 200) and 2.7 GtC a year over 2000–2019. Its warming, given measured forcing, stays within about 0.1 °C of the record on average since 1960. Its land puts the sink in the north and near zero in the tropics, as the air's CO₂ gradients say, and gains about as much wood since 2000 as satellites saw.
- **What it doesn't match.** Following the recorded clearing, the model's CO₂ runs about 18 ppm high by 2024. The Global Carbon Budget has the same gap: its own counts of clearing and of the land's growth miss what the air and the ocean say by about 1.6 GtC a year in the 1950s. Lower clearing, stronger CO₂ fertilization or over-reported emissions each close most of it, and several settings match the past equally well. That is the lesson the page is built to teach.

## What changed from the Shiny app

- The ocean has four boxes in place of two, and modern seawater chemistry in place of Tans's scheme. Its gas exchange can't run unstable.
- The climate is an energy balance solved with the ocean, in place of a fixed delay. TCRE (warming per tonne of carbon emitted) comes out of it; it isn't put in.
- The land has three regions, wood, nitrogen, a temperature curve for growth, old soil and recorded land use. Every sink has a cause. The app's three prescribed sinks, which rose and fell on a calendar, are gone, and so is the carbon they made from nothing.
- The record runs to 2024 and the scenarios are the SSPs, not the RCPs.
- The sliders open at best estimates. In the app they opened where CO₂ came out too high, on purpose, so that students had to move them.
