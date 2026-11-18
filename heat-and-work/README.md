# Too Hot to Work: Heat, Humidity and the Human Body

A teaching model for Chapter 10, "Climate Justice and Ethics", of *Climate Change: Simple, Serious, Solvable*, an open textbook by Scott Denning. It runs in the browser: open `web/index.html` through any web server (see "Run one on your own computer" in the repository's front page).

## What it does

The reader picks a hot afternoon (one of 14 places around the world, or their own temperature and humidity), warms it by up to 6 °C, and chooses where a person works: outdoors in full Sun, outdoors in the shade, or indoors with air conditioning. The page works out the wet-bulb temperature and the wet-bulb globe temperature (WBGT), and looks up how many minutes of each hour the classic work/rest table allows for light, moderate and heavy work, now and with the warming. A second table lists every place for the same choices.

The page opens on an average June afternoon in Dhaka, Bangladesh, in the shade, warmed by 3 °C. The WBGT goes from 29.0 to 31.9 °C, and heavy work from 15 minutes an hour to none.

## The science

Three steps and a table, each on the About tab:

1. The air after the warming: T = T₀ + ΔT, with the relative humidity held the same.
2. The wet-bulb temperature from Stull's (2011) fit: Tw = T arctan(0.151977 (H + 8.313659)^½) + arctan(T + H) − arctan(H − 1.676331) + 0.00391838 H^(3/2) arctan(0.023101 H) − 4.686035, good to about a degree for 5–99% humidity and −20 to 50 °C at sea level.
3. The WBGT: W = 0.7 Tw + 0.2 (T + G) + 0.1 T (Lemke and Kjellstrom, 2012), where T + G is the black globe's temperature. G is 0 in the shade and indoors, and 10 °C in full Sun.
4. The work/rest table: ACGIH's threshold limits, as Chapter 10 quotes them. The WBGT is rounded to a tenth and the first row it doesn't pass gives the minutes; past the last row the page says none.

The air-conditioned room is set to 25 °C and 50% humidity.

What it leaves out, and says so: the places are average afternoons, not heat waves; Stull's wet bulb is a shaded, fanned one, which reads lower than the natural wet bulb of the WBGT in sunshine, so the page if anything understates the heat; one number stands for the Sun; the table assumes healthy, acclimatized workers resting in the same heat; and it isn't a safety tool.

## The places

`places-source.json` holds TerraClimate's 1991–2020 monthly normals (average daily high, tmax, and vapor pressure, vap) at the grid cell holding each place, as the raw numbers the THREDDS server sent, with the SHA-256 of each answer. `build_data.py` turns them into each place's afternoon: T = tmax, H = 100 vap / es(T) with es = 0.6106 exp(17.27 T / (237.3 + T)) kPa (Lemke and Kjellstrom, 2012), and the month whose afternoon has the highest shade WBGT (the earlier one in a tie). `python3 build_data.py --write` puts them into `web/model.js`. The raw answers are kept outside Git, in the project's data store (`models/heat-and-work/terraclimate-slices-2026-11-17/`; a second, nested copy of the same files sits inside it).

## How it was checked

`tests/test_heat_and_work_model.py` holds the model to:

- **a second copy in Python,** at 54 settings, to within a billionth, with the same minutes;
- **TerraClimate:** the places are rebuilt from the raw answers, and each answer's SHA-256 is checked where the data store is at hand;
- **the book and the sources:** Chapter 10's sentences (37 °C, 100 watts, the table's last row) are looked up in the chapter; the whole table against the one printed by Heidari et al. (2015); the 10 °C for the Sun against Crowe et al.'s (2010) measured globe and air temperatures;
- **the About tab:** its equations, read back from the page and tried with the model's numbers; its worked example, done from a calculator's rounded numbers; and every number in its text;
- **the exercise** that goes with the page (Exercise 10A): every keyed answer, at the settings its address opens.

## Sources and licences

- TerraClimate: Abatzoglou et al. (2018), doi:10.1038/sdata.2017.191. CC0.
- Stull (2011), doi:10.1175/JAMC-D-11-0143.1.
- Lemke and Kjellstrom (2012), doi:10.2486/indhealth.MS1352.
- Crowe et al. (2010), doi:10.3402/gha.v3i0.5619 (the measured globe and air temperatures; numbers only).
- Heidari et al. (2015), doi:10.1186/s40201-015-0199-6 (the table, as printed from ACGIH).
- Douville et al. (2021), IPCC AR6 WGI Chapter 8, doi:10.1017/9781009157896.010 (relative humidity in a warmer world).
