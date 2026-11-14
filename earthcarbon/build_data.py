#!/usr/bin/env python3
"""Make the page's data files from the reference model's tables.

    python3 models/earthcarbon/build_data.py          (Python 3.10 or later)

Writes three files into web/, one for each licence:

  record.json      the measured past, 1750-2024: fossil emissions, forcing,
                   CO2, warming and where the carbon went
  land-use.json    land use in each of the model's three regions, 1750-2023
  scenarios.json   six SSP scenarios, 2025-2500

The tables they are made from are in reference/data/, made there by the
reference model's own scripts (see reference/data/*.py). This script asks the
reference model itself to join the past to each future and to sum land use
over each region, so the page is given exactly what the Python model uses.

Sources and licences (the full citations are in each file's "sources"):

  Global Carbon Budget 2025 (Friedlingstein et al. 2026): CC BY 4.0
  Indicators of Global Climate Change 2024 (Forster et al. 2025): CC BY 4.0
  HadCRUT5 (Morice et al. 2021): Open Government Licence v3.0
  LUH1 (Hurtt et al. 2011; ORNL DAAC): open, with citation
  HYDE 3.3 (Klein Goldewijk 2024): CC BY 4.0
  RCMIP v5.1.0 (Nicholls et al. 2020): CC BY-SA 4.0. scenarios.json alone
      is derived from it, so scenarios.json alone carries that licence
      (Scott's decision, 13 November 2026). Nothing else on the page does.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REFERENCE = HERE / "reference"
WEB = HERE / "web"
sys.path.insert(0, str(REFERENCE))

from earthcarbon import observations  # noqa: E402
from earthcarbon.land.farmland import land_use_history  # noqa: E402
from earthcarbon.scenarios import SSP_NAMES, history_then_ssp  # noqa: E402

FIRST, LAST_MEASURED, LAST_LAND_USE, LAST_SCENARIO = 1750, 2024, 2023, 2500
LAND_USE_KEYS = {"farmed": "forest_farmed", "cropland": "cropland", "old": "old_forest",
                 "young": "young_forest", "clearedOld": "cleared_old",
                 "clearedYoung": "cleared_young", "harvestOld": "harvest_old",
                 "harvestYoung": "harvest_young"}
SCENARIO_NAMES = {"ssp119": "SSP1-1.9", "ssp126": "SSP1-2.6", "ssp245": "SSP2-4.5",
                  "ssp370": "SSP3-7.0", "ssp534-over": "SSP5-3.4-overshoot",
                  "ssp585": "SSP5-8.5"}


def rounded(values, digits=7):
    """Numbers to `digits` significant figures; None stays None."""
    return [None if v is None else float(f"{v:.{digits}g}") for v in values]


def record():
    data = observations.load(FIRST, LAST_MEASURED)
    zero = observations.zero_where_missing
    return {
        "about": "The measured past. Units: GtC/yr, W/m2, ppm, K above 1850-1900.",
        "first": FIRST, "last": LAST_MEASURED,
        "fossil": rounded(zero(data["fossil_emissions"])),
        "aerosol": rounded(zero(data["aerosol_forcing"])),
        "other": rounded(zero(data["other_forcing"])),
        "co2": rounded(data["co2_ppm"]),
        "warming": rounded(data["warming"]),
        "landUse": rounded(data["land_use_emissions"]),
        "airGrowth": rounded(data["atmospheric_growth"]),
        "oceanSink": rounded(data["ocean_sink"]),
        "netLand": rounded(data["net_land_uptake"]),
        "sources": [
            "Fossil emissions, land-use emissions, growth in the air, ocean sink and the net land uptake "
            "(fossil less growth in the air less the ocean sink): Global Carbon Budget 2025, "
            "Friedlingstein et al. (2026), Earth System Science Data 18, 3211-3288, "
            "doi:10.5194/essd-18-3211-2026. CC BY 4.0.",
            "Forcing and CO2: Indicators of Global Climate Change 2024, Forster et al. (2025), "
            "doi:10.5194/essd-17-2641-2025. CC BY 4.0. CO2 for 1751-1849 is filled between "
            "the 1750 and 1850 values with the shape of the Global Carbon Budget's growth.",
            "Warming: HadCRUT.5.1.0.0, Morice et al. (2021), doi:10.1029/2019JD032361. "
            "Contains public sector information licensed under the Open Government Licence "
            "v3.0.",
        ],
    }


def land_use():
    history = land_use_history()
    out = {"about": "Land use in each region: shares of its forest land, and wood "
                    "harvested (GtC/yr). Held as in 2023 after that.",
           "first": FIRST, "last": LAST_LAND_USE}
    rows = [history(year) for year in range(FIRST, LAST_LAND_USE + 1)]
    for region in ("boreal", "temperate", "tropics"):
        out[region] = {short: rounded([row[region][long] for row in rows])
                       for short, long in LAND_USE_KEYS.items()}
    out["sources"] = [
        "LUH1: Chini, Hurtt and Frolking (2014), Harmonized Global Land Use for Years "
        "1500-2100, V1, ORNL DAAC, doi:10.3334/ORNLDAAC/1248; Hurtt et al. (2011), Climatic "
        "Change 109, 117-161, doi:10.1007/s10584-011-0153-2. Summed over three bands of "
        "latitude by the reference model (data/build_land_use_luh1.py).",
        "After 2004, farmland follows HYDE 3.3 by country to 2023: Klein Goldewijk (2024), "
        "History Database of the Global Environment 3.3, Utrecht University, "
        "doi:10.24416/UU01-94FNH0 (CC BY 4.0); method in Klein Goldewijk et al. (2017), "
        "doi:10.5194/essd-9-927-2017.",
    ]
    return out


def scenarios():
    out = {"about": "Six SSP scenarios after 2024: fossil emissions (GtC/yr), smog forcing "
                    "and every other non-CO2 forcing (W/m2). Each starts from the measured "
                    "2024 value and returns to the scenario over 20 years. After 2500: no "
                    "emissions, forcing held.",
           "licence": "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). "
                      "Derived from RCMIP v5.1.0, which carries that licence. This file "
                      "alone; the rest of the page is MIT (code) and CC BY 4.0 (text).",
           "first": LAST_MEASURED + 1, "last": LAST_SCENARIO, "names": SCENARIO_NAMES}
    for name in SSP_NAMES:
        joined = history_then_ssp(name, LAST_SCENARIO, aerosol_follows_fossil_fuel=False)
        keep = [i for i, year in enumerate(joined.years) if year > LAST_MEASURED]
        out[name] = {
            "fossil": rounded([joined.fossil_emissions[i] for i in keep]),
            "aerosol": rounded([joined.aerosol_forcing[i] for i in keep]),
            "other": rounded([joined.other_forcing[i] for i in keep]),
        }
    out["sources"] = [
        "RCMIP v5.1.0: Nicholls et al. (2020), Geoscientific Model Development 13, 5175-5190, "
        "doi:10.5194/gmd-13-5175-2020; protocol data doi:10.5281/zenodo.4589756 (CC BY-SA "
        "4.0). Extensions after 2100 follow Meinshausen et al. (2020), Geoscientific Model "
        "Development 13, 3571-3605, doi:10.5194/gmd-13-3571-2020.",
        "Fossil emissions are RCMIP's \"Fossil and Industrial\" CO2; other forcing is its "
        "anthropogenic total less CO2 and aerosols.",
    ]
    return out


if __name__ == "__main__":
    for name, content in (("record.json", record()), ("land-use.json", land_use()),
                          ("scenarios.json", scenarios())):
        path = WEB / name
        path.write_text(json.dumps(content, separators=(",", ":")) + "\n")
        print(f"wrote web/{name}: {path.stat().st_size / 1024:.0f} KB")
