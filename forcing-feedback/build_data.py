#!/usr/bin/env python3
"""Pack the page's data: web/data.json.

    python3 -I models/forcing-feedback/build_data.py [folder with the source tables]

The source is four small tables that Scott Denning and OpenAI Codex made for the first version
of this page (their scripts/prepare_data.py). They aren't in Git. They're in the data store, in
the frozen copy of the workspace where the page was first built. This script checks each one's
SHA-256 before it reads it. On 12 November 2026 all four were made again from fresh downloads
of their sources, and every number matched (the record is in the data store, in
science-check-2026-11-12/).

What goes into data.json:

    history     climate forcing for each year from 1850 to 2019, in W/m², counted from 1750:
                carbon dioxide, methane, reflective smog (aerosols), and everything else.
                "parts" splits everything else four ways, for the thin lines on the first graph.
    scenarios   the same four numbers from 2015 to 2100, for five of the IPCC's scenarios
    observed    the measured temperature of each year from 1850 to 2025, in °C above the
                1850-1900 average, with the low and high ends of its 95% range
    ipcc        a few numbers from the IPCC's Sixth Assessment Report that the page draws or
                prints beside the model's own, typed here from the report (see IPCC below)
    sources     where each of these came from, and its license

The table of scenarios in the source folder also has CO2 and methane concentrations,
from RCMIP. They're left out: the model doesn't use them, and their license (CC BY-SA 4.0)
would have to travel with this file.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path("/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data/models/"
              "forcing-feedback/codex-workspace-2026-11-12/data/derived")
SHA256 = {
    "ar6_reduced_forcing_1850_2019.csv":
        "f6f4033724b20d57e391912da26baf9d9bb4ac32848b879b12373d1d8c084893",
    "ar6_historical_forcing_components_1850_2019.csv":
        "14496f1f2e1d13d4ccf8785bee50d857f3a9ab3d4f67ee99be3cf18bd69301b3",
    "ar6_ssp_inputs_2015_2100.csv":
        "54cf335ff7159b5268034133322e74ed4dfac78f5eb9bd7eb883efa782cb0151",
    "hadcrut5_annual_1850_2025.csv":
        "76e98ee384eb624a1db59c7eea98fe9d8955958eace342dec86f139de4e2c43e",
}
SCENARIOS = [("ssp119", "SSP1-1.9"), ("ssp126", "SSP1-2.6"), ("ssp245", "SSP2-4.5"),
             ("ssp370", "SSP3-7.0"), ("ssp585", "SSP5-8.5")]
# Everything that isn't carbon dioxide, methane or smog, in four groups. The names on the right
# are the columns of the IPCC's table.
PARTS = {
    "gases": ["n2o", "other_wmghg", "o3", "h2o_stratospheric"],
    "land": ["contrails", "bc_on_snow", "land_use"],
    "volcanoes": ["volcanic"],
    "sun": ["solar"],
}
# From the IPCC's Sixth Assessment Report, Working Group I (2021). Each was read in the report
# itself on 12 November 2026.
IPCC = {
    # Summary for Policymakers, Table SPM.1: warming in 2081-2100 over 1850-1900, the best
    # estimate and the very likely range, in °C.
    "warming": {"first": 2081, "last": 2100,
                "ssp119": [1.4, 1.0, 1.8], "ssp126": [1.8, 1.3, 2.4], "ssp245": [2.7, 2.1, 3.5],
                "ssp370": [3.6, 2.8, 4.6], "ssp585": [4.4, 3.3, 5.7]},
    # Chapter 7, Executive Summary: equilibrium climate sensitivity, °C for a doubling of CO2.
    "doubling": {"best": 3.0, "likely": [2.5, 4.0], "veryLikely": [2.0, 5.0]},
    # Chapter 7, Executive Summary: the Earth's energy imbalance over 2006-2018, in W/m², with
    # its very likely range.
    "imbalance": {"first": 2006, "last": 2018, "best": 0.79, "range": [0.52, 1.06]},
    # Chapter 7, Executive Summary and Table 7.8: forcing in 2019 counted from 1750, in W/m²,
    # the best estimate and the very likely range.
    "forcing": {"year": 2019, "co2": [2.16, 1.90, 2.41], "methane": [0.54, 0.43, 0.65],
                "smog": [-1.1, -1.7, -0.4]},
}
MIT = ("MIT License. Copyright (c) 2020 Chris Smith. Permission is hereby granted, free of "
       "charge, to any person obtaining a copy of this software and associated documentation "
       "files (the \"Software\"), to deal in the Software without restriction, including "
       "without limitation the rights to use, copy, modify, merge, publish, distribute, "
       "sublicense, and/or sell copies of the Software, and to permit persons to whom the "
       "Software is furnished to do so, subject to the following conditions: The above "
       "copyright notice and this permission notice shall be included in all copies or "
       "substantial portions of the Software. THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT "
       "WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES "
       "OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT "
       "SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER "
       "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR "
       "IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.")
SOURCES = {
    "forcing": {
        "what": "Effective radiative forcing, best estimates: 1750-2019 and five SSP scenarios",
        "from": "Smith, C., and others (2021). IPCC WGI AR6 Chapter 7 (v.1.0). Zenodo. "
                "doi:10.5281/zenodo.5211358. Files data_output/AR6_ERF_1750-2019.csv and "
                "data_output/SSPs/ERF_ssp*_1750-2500.csv, from github.com/IPCC-WG1/Chapter-7",
        "license": MIT,
    },
    "observed": {
        "what": "Global mean temperature of each year, HadCRUT.5.1.0.0, 1850-2025, moved to "
                "its 1850-1900 average",
        "from": "Morice, C. P., and others (2021). Journal of Geophysical Research: "
                "Atmospheres, 126, e2019JD032361. doi:10.1029/2019JD032361. File "
                "HadCRUT.5.1.0.0.analysis.summary_series.global.annual.csv, Met Office "
                "Hadley Centre",
        "license": "Contains public sector information licensed under the Open Government "
                   "Licence v3.0. © Crown copyright, Met Office",
    },
    "ipcc": {
        "what": "Numbers quoted from the report, for comparison",
        "from": "IPCC (2021). Climate Change 2021: The Physical Science Basis. Cambridge "
                "University Press. doi:10.1017/9781009157896. Table SPM.1 and Chapter 7",
    },
}


def table(folder, name):
    raw = (folder / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256[name]:
        raise SystemExit(f"{name} isn't the file this was built from (its SHA-256 differs)")
    return list(csv.DictReader(raw.decode("utf-8").splitlines()))


def years(rows, first, last):
    found = [int(row["year"]) for row in rows]
    if found != list(range(first, last + 1)):
        raise SystemExit(f"expected every year from {first} to {last}, once each")


def column(rows, name):
    return [float(row[name]) for row in rows]


def four(rows):
    return {"co2": column(rows, "co2_erf_wm2"), "methane": column(rows, "ch4_erf_wm2"),
            "smog": column(rows, "total_aerosol_erf_wm2"),
            "other": column(rows, "background_erf_wm2")}


def build(folder):
    """Everything that goes into data.json, from the source tables in this folder."""
    reduced = table(folder, "ar6_reduced_forcing_1850_2019.csv")
    years(reduced, 1850, 2019)
    history = {"first": 1850, "last": 2019}
    history.update(four(reduced))

    components = table(folder, "ar6_historical_forcing_components_1850_2019.csv")
    years(components, 1850, 2019)
    history["parts"] = {
        group: [round(sum(float(row[name]) for name in names), 4) for row in components]
        for group, names in PARTS.items()}
    for i, row in enumerate(components):
        # The two tables were rounded to four places apart, so they can differ in the last one.
        smog = (float(row["aerosol-radiation_interactions"])
                + float(row["aerosol-cloud_interactions"]))
        other = sum(history["parts"][group][i] for group in PARTS)
        if (abs(float(row["co2"]) - history["co2"][i]) > 1e-9
                or abs(float(row["ch4"]) - history["methane"][i]) > 1e-9
                or abs(smog - history["smog"][i]) > 0.00011
                or abs(other - history["other"][i]) > 0.0007):
            raise SystemExit(f"the two tables of past forcing disagree in {row['year']}")

    scenarios = {}
    rows = table(folder, "ar6_ssp_inputs_2015_2100.csv")
    for key, label in SCENARIOS:
        mine = [row for row in rows if row["scenario"] == key]
        years(mine, 2015, 2100)
        scenarios[key] = {"label": label, "first": 2015, "last": 2100}
        scenarios[key].update(four(mine))

    measured = table(folder, "hadcrut5_annual_1850_2025.csv")
    years(measured, 1850, 2025)
    observed = {"first": 1850, "last": 2025, "anomaly": column(measured, "anomaly_c"),
                "low": column(measured, "lower_95_c"), "high": column(measured, "upper_95_c")}
    base = sum(observed["anomaly"][:51]) / 51
    if abs(base) > 0.0001:
        raise SystemExit("the measured temperatures should average zero over 1850-1900")

    return {"history": history, "scenarios": scenarios, "observed": observed, "ipcc": IPCC,
            "sources": SOURCES}


def packed(data):
    """The text of data.json: one series to a line, so a change shows as a change to that line."""
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    text = text.replace('],"', '],\n"').replace('},"', '},\n"').replace('{"', '{\n"', 1)
    json.loads(text)
    return text + "\n"


def main(argv):
    data = build(Path(argv[1]) if len(argv) > 1 else SOURCE)
    history, scenarios, observed = data["history"], data["scenarios"], data["observed"]
    text = packed(data)
    (HERE / "web" / "data.json").write_text(text, encoding="utf-8")

    last = len(history["co2"]) - 1
    total = sum(history[name][last] for name in ("co2", "methane", "smog", "other"))
    print(f"wrote web/data.json: {len(text.encode('utf-8')):,} bytes")
    print(f"forcing in 2019: CO2 {history['co2'][last]}, methane {history['methane'][last]}, "
          f"smog {history['smog'][last]}, other {history['other'][last]}, total {total:.4f} W/m²")
    print(f"measured in 2025: {observed['anomaly'][-1]} °C above 1850-1900")
    for key, label in SCENARIOS:
        one = scenarios[key]
        total = sum(one[name][-1] for name in ("co2", "methane", "smog", "other"))
        print(f"{label} in 2100: {total:.2f} W/m²")


if __name__ == "__main__":
    main(sys.argv)
