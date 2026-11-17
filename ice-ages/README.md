# A Million Years of Ice Ages: Sunlight, Ice and Carbon Dioxide

A small model of the ice ages that runs in the browser, for Chapter 5 of *Climate Change: Simple, Serious, Solvable*, "Past Climate Change". It's the reduced-complexity model of Talento and Ganopolski (2021): three equations, for the ice on land, the carbon dioxide in the air and the world's average temperature, stepped 1,000 years at a time. Earth's orbit drives it through the summer Sunlight at 65 °N, and for the future, a pulse of fossil carbon can be added.

The page has two views, "The last 800,000 years" (the model beside records of sea level and carbon dioxide) and "The next million years" (with and without fossil carbon). The controls turn off the carbon-dioxide feedback, turn off the faster melting of old ice sheets, or keep only one part of the orbit's effect on the Sunlight. The About tab has every equation and a worked example.

## Files

| File | What it is |
|---|---|
| `web/model.js` | The science: the five steps on the About tab, and the loop that runs them |
| `web/app.js` | The page: the controls, the graphs and the words under them |
| `web/index.html`, `web/style.css` | The page itself, with the About tab |
| `web/data.json` | The summer Sunlight in its two parts, every 1,000 years from 999,000 years ago to 1,000,000 years from now, and the records drawn beside the model |
| `build_data.py` | Makes `web/data.json` from the sources (see below) |
| `equations.py` | The equations on the About tab; `--write` puts them into the page, `--check` checks it |

The tests are in the book's repository, `tests/test_ice_ages_model.py`.

## The model

The equations, their numbers and the order of the steps are Talento and Ganopolski's, from the paper and from the code they published with it (OSF, doi:10.17605/OSF.IO/KB76G). Each step of 1,000 years:

1. **The summer Sunlight.** F = (p − p̄) + 1.04 (o − ō), where p is the precession part of the summer Sunlight at 65 °N and o the tilt part (below).
2. **The temperature.** T = −3 v + 5.556 ln(C/278), from the ice v and the carbon dioxide C at the end of the step before.
3. **The carbon dioxide.** C = 17.28 T − 31.95 v + 120 m + 278 + C_f, never below 150 ppm. m is how much v shrank in the step before; C_f is the fossil carbon dioxide (step 5).
4. **The ice.** G = 0.2196 v − 0.2874 v^(3/2) − 0.0008 F − 0.09525 ln C, and Δv = G / (1 − 0.1841 M) + 0.5260, where M is the average of v over the 30 steps before (by the trapezoid rule, divided by 30) while v is shrinking, and 0 while it's growing. v never goes below 0, nor below 0.05 before 410,000 years ago.
5. **The fossil carbon dioxide.** C_f = 0.469 E A(t), where E is the fossil carbon in GtC and A(t) is the five-part impulse response of Lord et al. (2016), whose shares and times depend on E. Its 40 numbers are their Table S3.

The numbers are the authors' best version of the model (their "Best Solution", the 11th of the 29 parameter sets in `Model/Solutions_Accepted/low_sols1_final_final_info.mat`), rounded to four significant figures. **Four figures are needed.** At three, the model ends some of the oldest ice ages at different times (its correlation with the ice record falls from 0.86 to 0.76), and at the two figures of the paper's Table 2 it starts the next ice age right away. The reason is that the constant 0.5260 and the carbon-dioxide term (−0.09525 ln 278 = −0.5360) nearly cancel, and their difference is the threshold for a new ice age.

### The summer Sunlight

Talento and Ganopolski's code drives the model with `smx_p + 1.04 (smx_o − mean(smx_o))`. Their files aren't documented, but `smx_p` follows the precession index (correlation −0.998) and `smx_o` follows the tilt (0.9999), and they match, to about 0.01 and 0.1 W/m²:

- **p, the precession part:** the strongest daily-mean Sunlight of the northern summer at 65 °N, with the tilt held at a constant;
- **o, the tilt part:** the daily-mean Sunlight at 65 °N on the June solstice, for a circular orbit.

`build_data.py` works both out from Laskar et al. (2004), with the Milankovitch model's equations, the book's solar constant (1,361 W/m²) and the tilt held at its average over the model's 2,000,000 years (23.32°). Driven by these, the four-figure model matches the authors' best version: a correlation of 0.862 with their ice record over the last 800,000 years, and the same next ice age.

The plain strongest summer Sunlight, without the split and the 1.04, drives the model nearly the same way over the last 700,000 years (a correlation of 0.876 instead of 0.878), but it ends the oldest ice ages at other times. The model is that sensitive to its forcing.

## Where the data come from

- **The orbit:** Laskar, J., et al. (2004). A long-term numerical solution for the insolation quantities of the Earth. *Astronomy & Astrophysics*, 428, 261–285. doi:10.1051/0004-6361:20041335. The table `INSOL.LA2004.txt`, kept with the Milankovitch model's sources.
- **Sea level:** Spratt, R. M., and Lisiecki, L. E. (2016). A Late Pleistocene sea level stack. *Climate of the Past*, 12, 1079–1092. doi:10.5194/cp-12-1079-2016. Turned into v by dividing by its lowest value, as Talento and Ganopolski did.
- **Carbon dioxide:** Bereiter, B., et al. (2015). Revision of the EPICA Dome C CO₂ record from 800 to 600 kyr before present. *Geophysical Research Letters*, 42, 542–549. doi:10.1002/2014GL061957. The Antarctic composite, as processed for the book's Figure 5.11.

## How it was checked

- **Against the authors' runs.** The tests' Python copy of the model, given the authors' forcing and their parameters in full, reproduces all 29 of their Accepted runs (v, CO₂ and T, every 1,000 years, for 0, 1,000 and 3,000 GtC) to within 10⁻⁸. Those runs aren't in Git: the OSF record states no licence, so they stay in the book's data store, and the test skips where they aren't.
- **Lord's numbers against Lord's.** The 40 numbers of step 5 are Table S3 of Lord et al.'s supporting information, and they agree with the authors' own code (their Software S1, `Lordetal_sfts01.py`) to within 0.3%. Talento and Ganopolski's code has −6.15 × 10⁻⁸ for part 2's δ₂, where the table and Lord's code have +6.15 × 10⁻⁸. The test against Talento and Ganopolski's runs uses their sign. With ours, the carbon dioxide changes by less than a millionth of a ppm, and the ice not at all.
- **`model.js` against the Python copy,** at every combination of the controls the tests try, to within 10⁻⁹.
- **The Sunlight against the Milankovitch model's own code,** and the records against their sources.
- **The About tab against the model:** its equations, its worked example and every number in its text.

## What it leaves out

- It can't melt today's ice sheets: v never goes below 0. It says nothing about future sea-level rise.
- Its steps are 1,000 years long, and the fossil carbon goes in all at once, so its first steps after the pulse overshoot. The page leaves out the carbon dioxide and the temperature for the first 3,000 years after the pulse.
- Its climate sensitivity is 3.85 °C for a doubling of carbon dioxide, the CMIP6 average the authors chose; the IPCC's best estimate is 3 °C.
- Its carbon dioxide falls to its floor of 150 ppm in the deepest ice ages, below the ice cores' lowest, about 174 ppm.
- No temperature record is drawn beside its temperature: none of the 800,000-year reconstructions of the world's average temperature found so far is openly licensed and referenced to preindustrial.
- In the Earth system model behind step 5, about 8% of a 1,000 GtC pulse is left in the air after 10,000 years, at the low end of other models.
- Lord et al. fitted step 5 to pulses of 1,000 to 20,000 GtC. Smaller pulses, including the page's "so far" setting of 750 GtC, use the fit a little below that range.

## Rebuilding the data

```sh
python3 -I models/ice-ages/build_data.py
```

It reads the sources from the book's data store and checks each against its SHA-256 before using it.

## Credits

The model is Talento and Ganopolski's (2021): Talento, S., and Ganopolski, A. (2021). Reduced-complexity model for the impact of anthropogenic CO₂ emissions on future glacial cycles. *Earth System Dynamics*, 12, 1275–1293. doi:10.5194/esd-12-1275-2021. The fossil carbon dioxide follows Lord, N. S., et al. (2016). An impulse response function for the "long tail" of excess atmospheric CO₂ in an Earth system model. *Global Biogeochemical Cycles*, 30, 2–17. doi:10.1002/2014GB005074. This version, for the browser, was written by Claude (Anthropic) for Scott Denning's book, and its code is under the MIT licence.
