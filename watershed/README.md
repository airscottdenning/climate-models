# Rainfall Is Not Water Supply: A Watershed in a Warmer World

A teaching model for Chapter 8, "Future Climate Change", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

The reader picks one of three real watersheds and warms its 1991–2020 climate by up to 6 °C, and changes its rain and snow by up to 30% either way:

- **the Merced River above Yosemite Valley,** snow-fed mountains in California;
- **the French Broad River above Asheville,** rain-fed and humid, in North Carolina;
- **the Sierra Morena hills,** Mediterranean, in Andalusia, Spain.

The page follows the water month by month into the snowpack, the soil, the air and the river. It shows the year's precipitation, evapotranspiration, runoff, evaporative demand, deepest snowpack, month of most runoff and months with the soil less than half full, then and warmer, with the warmer year month by month. It opens on the Merced, 3 °C warmer with the same rain and snow:

- runoff falls from 369 to 341 mm;
- the peak moves from May to April;
- the deepest snowpack falls from 514 to 220 mm;
- the soil is less than half full for 3 months instead of none.

## The science

It's the US Geological Survey's monthly water-balance model (McCabe and Markstrom, 2007, doi:10.3133/ofr20071088), with the report's usual values. Each month:

1. **Snow or rain.** The share falling as snow is (3.3 − T)/(3.3 − Ts), between 0 and 1, with Ts = −1 °C above 1,000 m and −10 °C below.
2. **Melt.** The share of the snowpack that melts is 0.5 (T − Ts)/(3.3 − Ts), between 0 and 0.5.
3. **Demand.** Evaporative demand comes from Hamon's formula: Ep = 13.97 d D² ρ, with ρ = 4.95 e^(0.062 T)/100. Day length comes from Cooper's (1969) declination.
4. **Soil.** The soil holds 150 mm. In a wet month, demand is met and the rest fills the soil, and what it can't hold waits to run off. In a dry month the soil gives up (Ep − W) S/150. This reads the report's equation 9 as the storage left after that withdrawal.
5. **Runoff.** Half of the waiting water runs off each month, plus the 5% of rain that runs straight off.

The same year is run 30 times and the last is shown, so the storage settles and P − E = R.

The page says what the model leaves out:

- Hamon's temperature-only demand probably dries the land too fast with warming (Scheff and Frierson, 2014, doi:10.1175/JCLI-D-13-00233.1).
- Plants respond to CO₂.
- Storms, groundwater, dams and irrigation are left out.
- Warming and precipitation change by the same amount every month.
- Snow melts slowly: at most half the snowpack in a month.

## The data

`places.json` was made by `fetch_places.py` from TerraClimate's 1991–2020 monthly normals (Abatzoglou et al., 2018, doi:10.1038/sdata.2017.191; CC0), averaged over the grid cells in each watershed. The Merced and French Broad outlines come from the USGS's basin boundaries for their gauges. The Sierra Morena is a half-degree box. Each place's temperature is the middle of the daily high and low.

The file also holds TerraClimate's own water balance and the USGS gauges' monthly flow for 1991–2020. These are for checking only; the page doesn't use them. `build_data.py --write` puts the model's inputs into `web/model.js`.

Two cautions:

- **Mountain precipitation is low.** TerraClimate's precipitation is too low in high mountains: the Merced's gauge measures almost as much runoff as TerraClimate's precipitation.
- **The elevations aren't scaled.** `places.json`'s `elevation_m` values look unscaled and aren't used. Ts is set from the gauges' altitudes, as `build_data.py` explains.

## How it was checked

`tests/test_watershed_model.py` holds:

- `model.js` to a Python copy, month by month, at 27 settings;
- water balancing every month and over the settled year;
- the places to `places.json`;
- the model's timing to the gauges: the Merced's May peak, and the French Broad's high winter and low summer;
- the About tab's equations, worked example and numbers;
- Exercise 8A's keyed answers.
