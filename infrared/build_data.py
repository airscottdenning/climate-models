#!/usr/bin/env python3
"""Pack the ARTS tables for the browser: web/tables.bin and web/tables.json.

    python3 -I models/infrared/build_data.py [folder with the source tables]

The source is the data package that Scott Denning and OpenAI Codex made from their ARTS 2.6.16
runs (dataset 2026-11-11-production-v1). It isn't in Git. It's in the data store, in the frozen
copy of the workspace where the model was first built. Its model-schema.json lists each file
with its SHA-256, and this script checks every one before it reads it.

The source holds 64-bit floats in 17 files. The page gets one file of little-endian 32-bit
floats, half the size. Rounding to 32 bits changes no number by more than 1 part in 10 million.

tables.bin, in order:
    2,000 wavelengths (µm), from 4 to 30
    for each sky (midlatitude summer, then tropical):
        the spectra: 3 CO₂ amounts × 3 methane amounts × 5 water amounts × 2,000 wavelengths,
            Earthlight leaving the top of the atmosphere, straight up (W/m² per steradian per µm)
        the totals: 3 × 3 × 5 × 3 numbers (W/m²): Earthlight leaving the top, Earthlight
            from the sky reaching the surface, and the surface's net loss of Earthlight
        its far-out cases, one spectrum of 2,000 values each, in the order tables.json lists them

tables.json holds the amounts along each side of the tables, the surface's temperature and the
far-out cases. web/model.js reads both files.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path("/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data/models/infrared/"
              "codex-workspace-2026-11-11/app/working/web-production-2026-11-11")
SCHEMA_SHA256 = "338f19b7f3a8cf86998496d96c88040d114aa09240b126d9d437b90cc6b32db2"
SKIES = [("midlatitude", "midlatitudeSummer", "Midlatitude summer"), ("tropical", "tropical", "Tropical")]
POINTS = 2000


def checked(folder, name, files):
    raw = (folder / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != files[name]["sha256"] or len(raw) != files[name]["bytes"]:
        raise SystemExit(f"{name} isn't the file the schema lists (SHA-256 or size differs)")
    return struct.unpack(f"<{len(raw) // 8}d", raw)


def main(argv):
    folder = Path(argv[1]) if len(argv) > 1 else SOURCE
    schema_raw = (folder / "model-schema.json").read_bytes()
    if hashlib.sha256(schema_raw).hexdigest() != SCHEMA_SHA256:
        raise SystemExit(f"{folder} doesn't hold the tables this was built from (the schema's SHA-256 differs)")
    schema = json.loads(schema_raw)
    files = schema["files"]

    wavelengths = checked(folder, schema["wavelength_file"], files)
    if checked(folder, schema["named_wavelength_file"], files) != wavelengths or len(wavelengths) != POINTS:
        raise SystemExit("the far-out cases and the tables should share one set of 2,000 wavelengths")
    values = list(wavelengths)
    skies = []
    for sky, source_name, label in SKIES:
        source = schema["atmospheres"][source_name]
        axes = source["axes"]
        nodes = len(axes["co2Ppm"]) * len(axes["ch4Ppb"]) * len(axes["waterScale"])
        spectra = checked(folder, source["spectrum_file"], files)
        totals = checked(folder, source["flux_file"], files)
        if len(spectra) != nodes * POINTS or len(totals) != nodes * 3:
            raise SystemExit(f"{source_name}: the tables aren't the size their sides give")
        values += spectra + totals
        cases = []
        for case in source["named_cases"]:
            asked = case["request"]
            if asked["waterScale"] != 1 or asked["surfaceDeltaK"] != 0:
                raise SystemExit(f"{source_name} {case['id']}: a far-out case should change one gas only")
            spectrum = checked(folder, case["spectrum_file"], files)
            if len(spectrum) != POINTS:
                raise SystemExit(f"{source_name} {case['id']}: not 2,000 values")
            values += spectrum
            cases.append({"id": case["id"], "co2": asked["co2Ppm"], "ch4": asked["ch4Ppb"]})
        skies.append({"id": sky, "label": label, "surfaceK": source["surface_reference_K"],
                      "surfaceGlow": round(source["surface_upwelling_W_m2"], 3),
                      "co2": axes["co2Ppm"], "ch4": axes["ch4Ppb"], "water": axes["waterScale"], "cases": cases})

    out = struct.pack(f"<{len(values)}f", *values)
    worst = max(abs(a - b) / abs(b) for a, b in zip(struct.unpack(f"<{len(values)}f", out), values) if b)
    if worst > 1e-7:
        raise SystemExit(f"rounding to 32 bits changed a number by {worst:.2g} of itself")
    (HERE / "web" / "tables.bin").write_bytes(out)
    meta = {"version": schema["dataset_version"], "points": POINTS, "floats": len(values),
            "sha256": hashlib.sha256(out).hexdigest(), "skies": skies}
    (HERE / "web" / "tables.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"wrote web/tables.bin: {len(values)} numbers, {len(out)} bytes, sha256 {meta['sha256']}; "
          f"largest change from rounding: {worst:.2g} of the number")


if __name__ == "__main__":
    main(sys.argv)
