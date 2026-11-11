#!/usr/bin/env python3
"""Pack Laskar et al. (2004) orbital elements for the browser: web/orbit.bin.

    python3 -I models/milankovitch/build_data.py [INSOL.LA2004.txt]

The source text file isn't in Git (6.5 MB). It's in the data store, in the frozen copy of Scott's
original Shiny app. Its columns are: thousands of years from now (J2000), eccentricity, obliquity
(radians) and longitude of perihelion from the moving equinox (radians), every 1,000 years.

orbit.bin holds the rows from FIRST_KYR to LAST_KYR as little-endian 32-bit floats, three per row:
eccentricity, obliquity, longitude of perihelion. web/model.js reads it with the same two constants.
"""
import hashlib
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path("/Volumes/Big SSD/Developer/CODEX/climate-change-textbook-data/models/milankovitch/"
              "original-shiny-2026-11-11/data/INSOL.LA2004.txt")
SOURCE_SHA256 = "8300ea90b913507dc31227f236be04012d579baa0244c4e3df0ed4555b2e60d8"
FIRST_KYR, LAST_KYR = -20000, 20000


def main(argv):
    source = Path(argv[1]) if len(argv) > 1 else SOURCE
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise SystemExit(f"{source} isn't the file this was built from (SHA-256 differs)")
    rows = {}
    for line in raw.decode("ascii").splitlines()[1:]:
        parts = line.split()
        if parts:
            rows[round(float(parts[0]))] = tuple(float(x) for x in parts[1:4])
    out = bytearray()
    for kyr in range(FIRST_KYR, LAST_KYR + 1):
        out += struct.pack("<3f", *rows[kyr])
    target = HERE / "web" / "orbit.bin"
    target.write_bytes(out)
    print(f"wrote {target}: {LAST_KYR - FIRST_KYR + 1} rows, {len(out)} bytes, "
          f"sha256 {hashlib.sha256(out).hexdigest()}")


if __name__ == "__main__":
    main(sys.argv)
