# Earthlight from the Sky

A page for teaching why a clear night on Earth isn't bitterly cold. The ground glows in the infrared all night and cools. The soil gives back some of the day's heat. The warm air hardly helps, because the air next to cold ground goes still. What saves the night is the Earthlight that comes down from the sky. The reader turns that down, for every night or for one night only, and watches the ground under a grassland through a day and a night. With the sky's glow gone for one night, the ground goes from 17.6 °C at sunset to −21.7 °C at sunrise; with the sky as measured, it ends the night at 6.8 °C. It goes with Chapter 2 (Box 2.2 asks how cold the ground would get in one night if its own glow were its only energy transfer) and Chapter 3.

- **Public address:** `/models/night/` on simpleserioussolvable.org.
- **It's a page of its own.** The models aren't embedded in the book's chapters (Scott, 12 November 2026).
- **Everything runs in the reader's browser.** There's no server and no outside library. The page has no data file: the measured day is 144 numbers inside `web/model.js`.
- **The whole model is eight steps.** A student can read all of `web/model.js`.
- **It's the Moon model with air over it.** [`moon`](../moon/README.md) has the same layers, the same conduction and the same shortcut for the deep layers.
- **The pattern every model follows** is in [`models/README.md`](../README.md).

## What's here

| File | What it is |
|---|---|
| `web/index.html`, `web/style.css` | The page |
| `web/model.js` | The science: the eight steps, the measured day, and the loop that runs them until a day repeats. Nothing in it touches the page, so it can be tested alone |
| `web/app.js` | The controls, the graphs and the words under them |
| `equations.py` | The equations on the Physics tab. It writes them into `web/index.html` |
| `build_data.py` | Makes the measured day from the SURFRAD station's files in the data store, and writes it into `web/model.js` and the table on the Physics tab. Its opening comment says how the clear days are chosen |

`scripts/publish_site.py` copies `web/` to the site as it is. Nothing else in this folder is published.

## When and where, at the top

A box above the switches and tabs says when and where the day is (Scott, 14 November 2026: it sets what a reader expects of the day and the night): early autumn near the equinox, Table Mountain, 40° N and 1,689 m, a 12-hour night, the air from 22 °C (71 °F) in the afternoon to 10 °C (50 °F) before sunrise, and the 11 clear windows (nine from 14 September to 12 October, plus 18 March and 7 April). A test holds it to the data.

Beside it, at the upper right, is a small photo of the station's 10 m tower on the grass (`web/station.jpg`, 768 × 1024, 48 KB, no EXIF), from NOAA GML's Table Mountain page (https://gml.noaa.gov/grad/surfrad/tablemt.html, image `tmtpics/tower1.jpg`, 2002). It's credited "Photo: NOAA Global Monitoring Laboratory (public domain)" under GML's disclaimer (https://gml.noaa.gov/about/disclaimer.html): information on its servers is "in the public domain, unless specifically annotated otherwise", and it asks for acknowledgement of GML. The photo carries no annotation, but no photographer is named either; if certainty is wanted, GML's radiation group can confirm. Scott agreed to it on 14 November 2026. It's hidden in the embedded layout.

## Two views: Simple and Advanced

The model is physics-heavy, so the page has two views of it (Scott, 14 November 2026: "Simple" and "Advanced", because that's more inviting than student and research). A second switch shows every temperature in °C or °F (Scott, 14 November 2026).

| Tab | Simple | Advanced | What it shows |
|---|---|---|---|
| Temperatures | yes | yes | What the day and night feel like: the ground and the air 10 m up, with the station's measured ground temperature as dots, and three tiles (the ground at sunset and sunrise, the air at sunrise) |
| Energy | yes | yes | At the top, broad arrows for one moment, each pointing the way its energy flows (Sunlight and "Earthlight down" into the surface, "Earthlight up" out of it, the air's, the water vapor's and the soil's up or down as the heat flows; the soil's under the surface), with a time slider that moves the same moment as the graphs. Under the surface line, in large bold type, the ground surface's temperature at that moment (Scott, 16 November 2026). Then, in Advanced only, the table for that moment (with T₁, T₂, Tₐ, U, Ri and f, which the worked example uses; Scott removed it from Simple on 16 November 2026, since the arrows show the same flows), and at the bottom the flows over the day, each line switched on or off by the reader |
| Soil | yes | yes | The soil at the surface and 3, 9 and 29 cm down over the day; a heat map of the top 50 cm over the day (time across, depth down, color in bands: blue colder than the soil's daily average, red warmer; worked out for every pixel, with time a straight line between the model's one-minute steps and depth a monotone smooth curve through the layers' middles, so the bands' edges are smooth); and the whole column at one moment inside the day's range |
| About | yes | yes | The story (Box 2.2), how to use the page, things to try and where the numbers come from, with no equations |
| Physics | | yes | The eight steps with every equation, the measured day's table, a worked example, the limits, things to try with the Advanced controls, the sources and how it was checked |
| Code | | yes | `model.js` and `app.js`, shown in the page |

Advanced also adds controls for the wind and the soil. The Simple view always runs the usual settings, whatever the Advanced controls hold.

## The controls

| Control | Range | As the page opens | View |
|---|---|---|---|
| Earthlight from the sky, as a share of what was measured | 0 to 150% | 100%, the sky as measured | both |
| When the sky changes | every day and night; tonight only; one day and night, from noon | every day and night | both |
| Wind, as a share of what was measured | 25 to 200%, steps of 5 | 100% | Advanced |
| Roughness length z₀ | 0.005, 0.03, 0.1 or 0.25 m (four Davenport classes) | 0.03 m, open: short grass | Advanced |
| Bowen ratio β | 0.5 to 5 | 1.5 | Advanced |
| Soil conductivity k | 0.2 to 2.5 W/m per K | 1 | Advanced |
| Soil heat capacity c | 1 to 3 million J/m³ per K | 2 | Advanced |

Two buttons set the sky to 100% and 0%. Above 100% is a cloudy sky (130% is about what low cloud at the air's temperature would send). "Tonight only" gives the days before the sky as measured, and the chosen sky comes out only from tonight's sunset to tomorrow's sunrise. That's Box 2.2's question. "One day and night, from noon" (Scott, 14 November 2026: the point is downward IR's importance to climate, not only at night) does the same from noon to the next noon: with no sky glow the ground falls from 30.5 °C at noon to 1.6 °C by sunset, in full Sunlight, and −24.0 °C by sunrise. The About tab ties this to Chapter 3's energy-budget diagram (the surface takes in 160 W/m² of Sunlight and 342 W/m² from the sky).

## The Physics tab

- **The equations are written in `equations.py`,** not in the page. After changing one, run `python3 models/night/equations.py --write`. `--check` fails if the page and `equations.py` differ.
- **The table of the measured day is written by `build_data.py --write`.** Don't edit it by hand.
- **The tests hold the tabs to the model** (`PageTextTests` in `tests/test_night_model.py`): every equation is worked out with the model's numbers, at four settings; the worked example, for 1:00 a.m., must end on the model's number and print the same from rounded numbers; the other numbers in the text are worked out from the model, including the Advanced things to try; quoted labels must be on the page; links must lead somewhere; the About tab has no equations; what the text says about Box 2.2 must still be in Chapter 2.
- **So some changes elsewhere fail a test until the text follows:** a change to `model.js`, a new range for a control, a renamed button, or a rewrite of Box 2.2. The failure says what the text should say.
- **A link can open one section:** `/models/night/?mode=advanced&view=physics#physics-equations`. The Physics sections are `physics-equations`, `physics-example`, `physics-limits`, `physics-try`, `physics-data` and `physics-checked`; the About sections are `about-use`, `about-try` and `about-data`.

## Preview

```
python3 -m http.server 8793 --bind 127.0.0.1 --directory models/night/web
```

Then open `http://127.0.0.1:8793/`.

## Addresses that open a chosen state

| Part | Meaning |
|---|---|
| `mode` | `simple` or `advanced` |
| `units` | `c` or `f` |
| `view` | `temps`, `energy`, `soil`, `about`, `physics` or `code` (`physics` and `code` only with `mode=advanced`; the old `day` opens `temps`) |
| `sky` | The share of the measured sky, in percent |
| `when` | `0` every day and night, `1` tonight only, `2` one day and night from noon (an old `tonight=1` reads as `when=1`) |
| `wind`, `rough`, `bowen`, `k`, `c` | The Advanced controls: % of the measured wind, z₀ in m, β, W/m per K, million J/m³ per K |
| `hide` | The energy graph's lines that are off, from `sun,sky,glow,air,vapor,soil` (as the page opens: `vapor`) |
| `keep` | The kept day, written by the page: `sky,when,wind,rough,bowen,k,c` |
| `embed=1` | The compact layout for an iframe. Nothing uses it yet |

Example: `/models/night/?sky=0&when=1&keep=100,0,100,0.03,1.5,1,2`, one night with no Earthlight from the sky, beside a usual night.

## The science

- **One column of moist loam under short grass,** in 11 layers. The top layer is 1 cm thick and each layer is 1.4 times as thick as the one above, so the column reaches 0.99 m down. Conductivity 1 W/m per K and heat capacity 2 million J/m³ per K, at every depth. Nothing leaves the bottom.
- **The Sunlight reaching the ground, the Sunlight it reflects, the air 10 m up, the wind and the Earthlight from the sky are measured,** not worked out: hourly averages of 11 clear noon-to-noon windows at SURFRAD Table Mountain, with straight lines between the hours. They follow the same day whatever the ground does. The surface takes in the measured Sunlight less the measured reflected Sunlight. The grass's albedo is 0.21 at noon and 0.31 at 5 p.m. The slider multiplies the measured sky. Night is 6 p.m. to 6 a.m. (an equinox); the hourly means blur sunrise and sunset by half an hour.
- **Why measured, not σTₐ⁴ (Scott, 14 November 2026).** The sky's glow is set by the air aloft, not the air near the ground. At Table Mountain, from 4 p.m. to 7 a.m. the air 10 m up cools by 8.5 K but the downward infrared falls by only 25 W/m²; σT₁₀⁴ would fall by about 47. A first version used ε σTₐ⁴ with Brutsaert's ε; it got the daily shape wrong.
- **The wind is measured too (Scott, 14 November 2026).** It's the station's hourly mean over the same clear windows, using only minutes whose own wind flag is good: 1.5 m/s at 8 a.m. to 4.5 m/s at 9 p.m. Nights are windier than mornings here, likely cold air draining off the Front Range. The station's README gives no height for the wind; the model takes it as 10 m, with the air's temperature. Before this the wind was fixed at 3 m/s.
- **The surface emits as a black surface does,** by the Stefan–Boltzmann law.
- **The air's density** is ρ = P/(R Tₐ), with P the U.S. Standard Atmosphere's pressure at 1,689 m, 101,325 × (1 − 2.25577 × 10⁻⁵ z)^5.25588 = 82,613 Pa, and R = 287 J/kg per K. About 1.00 kg/m³ at 15 °C.
- **Heat carried by the air** is ρcₚ(T₁ − Tₐ) f / r, with cₚ = 1,004 J/kg per K. The resistance of well-stirred air is r = ln(z/z₀) ln(z/z₀ₕ) / (κ²U), with z = 10 m, z₀ = 0.03 m (short grass), and heat's roughness z₀ₕ = z₀/10, as in Scott's app (Scott, 14 November 2026). With the measured wind, r runs from 66 to 195 s/m.
- **The stirring f** is the neutral r over Scott's app's heat resistance, r.h = (ln(z/z₀) − ψₘ)(ln(z/z₀ₕ) − ψₕ)/(κ²U), at the ζ that goes with the bulk Richardson number Ri = gz(Tₐ − T₁)/(TₐU²), from Ri = ζ(ln(z/z₀ₕ) − ψₕ)/(ln(z/z₀) − ψₘ)² (Bonan eqs 14.26, 14.27, 14.33). For stable air ψₘ = ψₕ = −5ζ, which makes that a quadratic in ζ, solved exactly (in the form that doesn't lose digits for small Ri). ζ grows without end as Ri nears 0.2, and f is set to 0 at Ri ≥ 0.2. For unstable air ζ is found by halving [−2, 0] fifty times. At noon Ri is −0.46 and f is 1.79.
- **The floor on ζ.** ζ is never taken below −2: below that, over grass this smooth, ψₕ passes the logarithm, the resistance turns negative and the model blew up in spin-up (seen with one roughness length, 14 November). For the usual day Ri never gets below −0.50, against −0.61 at the floor, so the floor only guards spin-up. With the sky at 120% or more, or a weaker wind, the hot afternoon reaches it for an hour or more, and the Physics tab says so.
- **Heat into water vapor** is V = H/β with a Bowen ratio β = 1.5, while H is above zero; V = 0 when the ground is colder than the air.
- **Time moves forward in steps of 60 seconds.** Every flow in a step is worked out from the temperatures at the start of it.
- **The model runs until a day repeats,** with the Moon model's shortcut for the deep layers. Every layer starts at 288.15 K; the start doesn't matter. Five days for the sky as measured, 18 with no sky glow. Every setting the Advanced controls reach settles (a test runs the corners).
- **Nothing sets the soil's temperature.** It settles where the surface's energy balances over a day: every layer averages 16.9 °C with the sky as measured (the air averages 15 °C) and −35.1 °C with no sky glow on any night.
- **Tonight only** and **one day and night** spin up with the sky as measured, then run one more noon-to-noon day with the chosen sky from sunset to sunrise, or all day.

**Wind and roughness (Scott's question, 14 November 2026).** Roughness enters only through the eddies the wind makes over the ground (r ∝ ln(z/z₀) ln(z/z₀ₕ)/U), and the wind also sets how fast Ri grows as the ground cools (Ri ∝ 1/U²). So the usual day depends on both: halving the measured wind raises the afternoon peak from 31.0 to 35.3 °C; doubling it lowers the peak to 28.7 °C and brings the air's mean help over a usual night from 6.9 to 18.5 W/m². The no-sky night is much less sensitive: −21.7 °C at sunrise with the wind as measured, −22.5 °C over the roughest ground offered. Only a doubled wind keeps the air stirred most of the night (128 W/m² on average, until the wind drops after 4 a.m.), and even then the ground falls to −14.5 °C.

**What the model leaves out.** The air near the ground cooling at night in response to the ground (here it's measured), intermittent turbulence on still nights, convective gusts from the deep afternoon mixed layer (tried with a 1,000 m layer and Beljaars' w*: the afternoon cooled only 0.5 K more at 3 m/s), evaporation that depends on soil water and air humidity, dew, clouds that block the Sun, a grass canopy separate from the soil, soil that's wetter or denser with depth, and heat from below.

## Where the numbers come from

- **The Sunlight, the reflected Sunlight, the air 10 m up, the wind and the Earthlight from the sky:** NOAA SURFRAD, Table Mountain, Colorado (40.125° N, 105.237° W, 1,689 m), one-minute data, public domain (CC0 1.0), https://gml.noaa.gov/aftp/data/radiation/surfrad/tbl/. The 11 clear windows are 2018-257, 2019-285, 2020-280, 2021-276, 2021-277, 2022-097, 2023-267, 2023-268, 2023-269, 2023-280 and 2024-078 (year and day of the first noon). The raw files are in the data store: `climate-change-textbook-data/models/night/surfrad/`. The station's README (README_SURFRAD.txt at that address) gives the air temperature as 10 m and no height for the wind. References: Augustine, DeLuisi and Long (2000), *BAMS* 81, 2341–2357, doi:10.1175/1520-0477(2000)081<2341:SANSRB>2.3.CO;2; Augustine et al. (2005), *JTECH* 22, 1460–1472, doi:10.1175/JTECH1806.1.
- **The soil's heat capacity, 2 million J/m³ per K, and its Bowen ratio, 1.5:** Scott, 14 November 2026, for bare soil between field capacity and the wilting point. Bowen ratio: Ye, Z., and Pielke, R. A. (1995), A parameterization of Bowen ratio with respect to soil moisture availability, *Advances in Atmospheric Sciences* 12(4), 449–474, doi:10.1007/BF02657005. Soil water: Meter Group, "Plant available water: how do I determine field capacity and permanent wilting point?" (https://metergroup.com/measurement-insights/plant-available-water-how-do-i-determine-field-capacity-and-permanent-wilting-point/). The site refused an automated read, so that page wasn't checked.
- **The soil's conductivity, 1 W/m per K:** a normal value for a loam soil (Scott, 14 November 2026). Engineers Edge, "Thermal Conductivity Rocks and Soil" (https://www.engineersedge.com/heat_transfer/thermal_conductivity_rocks_and_soil_15942.htm), gives loams a normal range of 6 to 17.4 Btu·in/h·ft²·°F (0.87 to 2.5 W/m per K), citing Salomone and Marlowe (1989).
- **The roughness length, 0.03 m, and the Advanced choices:** SURFRAD doesn't measure roughness. The Davenport classification in WMO's WIGOS metadata code list (https://codes.wmo.int/wmdr/SurfaceRoughnessDavenport, read 14 November 2026), after Wieringa, J. (1992), Updating the Davenport roughness classification, *Journal of Wind Engineering and Industrial Aerodynamics* 41, 357–368, doi:10.1016/0167-6105(92)90434-C. The four choices are its classes "smooth" (0.005 m), "open" (0.03 m, the station's grass), "roughly open" (0.10 m) and "rough" (0.25 m); the page's short names follow the code list's labels.
- **Heat's roughness length, z₀/10:** Scott's app, which cites the note after equation 14.34 in Bonan.
- **The stirring:** Bonan, G. B. (2008), *Ecological Climatology: Concepts and Applications*, 2nd edition, Cambridge University Press, doi:10.1017/CBO9780511805530, sections 14.5 to 14.7, by way of Scott's app.
- **The air's pressure:** U.S. Standard Atmosphere (1976) at 1,689 m.
- **The height,** 10 m, as in Scott's app and the station's temperature sensor.

## How it was checked

`tests/test_night_model.py` has the eight steps written out a second time, in Python, and runs both copies.

1. **The model, against the ground at Table Mountain.** The station's upward infrared gives the ground's own temperature (as a black surface). The model's surface is within 3 K of it at every hour except 5 to 8 p.m., when it runs warmer, by up to 5.5 K at 6 p.m. (the grass cools fast at sunset; the model's top centimeter of soil doesn't). Its afternoon peak is 31.0 °C against the station's 30.6 °C. Through the night it runs about 2 K warm. The page draws the station's numbers as dots on the temperature graph.
2. **The measured day, against the station's files.** `build_data.py --check` remakes the 144 numbers from the raw files and fails if `model.js` or the Physics tab's table differs. Skipped on a machine without the data store.
3. **The page's code, against the second copy.** On the page as it opens and ten other settings (three of them with Advanced controls changed, one a whole day without the sky), `model.js` and the Python give the same temperatures and flows to a millionth. The test runs `model.js` in Node, or in Chrome where there's no Node.
4. **The shortcut, against the slow way.** The Python also runs the sky as measured for 365 days with no shortcut, and ends within 0.01 K of the shortcut's day.
5. **Energy in, against energy out.** Over the repeating day, Sunlight and sky glow bring in 467.2 W/m² and the ground's glow, the air and the water vapor take out 467.2 W/m²; the soil's mean flow is zero, and every layer has the same average temperature.
6. **A shorter step.** 15 seconds gives the same day as 60 seconds within 0.05 K, and the surface turns around only where a real surface would.
7. **The stirring, against Scott's app.** f is the neutral resistance over the app's r.h, at three roughnesses, for Ri from −0.5 to 0.199, and putting ζ back into the equation for Ri gives Ri.

## Where it came from

Scott's homework "Surviving Night" (Module 2) and his Shiny app "Bulk Aerodynamic Coefficients" are in the data store, read only: `climate-change-textbook-data/models/night/original-2026-11-13/`. The app took the sensible heat flux as an input and drew the resistance against the wind. This model works the flux out from the temperatures, at the measured wind.

## What changed along the way

- 13 November 2026: first version, dry soil (k = 0.3, c = 1.5 million, no evaporation), air set to 15 ± 5 °C, sky ε σTₐ⁴ with Brutsaert's ε.
- 14 November 2026 (Scott): loam, k = 1; then c = 2 million, Bowen ratio 1.5, and the air and sky measured at Table Mountain instead of a formula; then the Sunlight measured there too (replacing 1,361 × 0.75 × cos θ), and the air's density from the standard atmosphere at 1,689 m (replacing 1.2 kg/m³); then the unstable case of his app's stirring by day (replacing f = 1); then the station's measured reflected Sunlight and grass roughness, 0.03 m (replacing bare soil's 0.17 and 0.01 m); then heat's roughness z₀/10 and the station's measured hourly wind (replacing one roughness and a fixed 3 m/s, which had left the afternoon peak at 27.7 °C); then the Simple and Advanced views, the three graph tabs, the About and Physics tabs, the Advanced controls and the °C/°F switch; then a third choice, one whole day and night without the sky from noon, and the link to Chapter 3's energy budget.
- 16 November 2026 (Scott): the ground's line is the boldest on the Temperatures and Soil graphs (4 px, bold name, bold key), as the model's main answer; the title "Earthlight from the Sky" (it was "Surviving the Night: Dirt, Air and the Glow of the Sky", which undersold the whole-day choice); the energy lines renamed "Earthlight down" and "Earthlight up"; the Energy tab's bars remade as up-and-down arrows with a time slider, moved to the top, with the graph over the day at the bottom; and a heat map on the Soil tab.

## Still to do

- A chapter can name the page and its address (Chapter 2's Box 2.2, Chapter 3's greenhouse effect). That's chapter text, so it waits for Scott.
- The site card's image (`site/img/models/night.jpg`) is a crop of the old single graph. Remake it from the new temperature tab once Scott is happy with the look.
