"""Make places.json: twelve months of temperature, rain and snow for each of the page's watersheds.

The page's three places are real. This script averages TerraClimate's 1991-2020 monthly normals over each one,
and, for the two with a stream gauge of the U.S. Geological Survey, works out the river's measured flow in the
same years. It needs the network, so it is run by hand, and what it wrote is kept in places.json beside it.
build_data.py then carries places.json into the page; the page and its tests never go to the network.

    python3 models/watershed/fetch_places.py <folder>

<folder> keeps every file as it was downloaded, with SOURCES.json (each file's address and SHA-256). A file
that is already there is read, not downloaded again. The project's copy is outside Git, in
climate-change-textbook-data/models/watershed/sources/.

Sources (all free to share):
- TerraClimate v1.1, 1991-2020 normals (Abatzoglou et al., 2018, doi:10.1038/sdata.2017.191), public domain
  (CC0 1.0). Read in small pieces over OPeNDAP from the Northwest Knowledge Network's server. Monthly highs and
  lows, precipitation, and, for checking the model, TerraClimate's own runoff, evapotranspiration, snow and
  soil water. Its grid is 1/24 of a degree (about 4 km).
- U.S. Geological Survey: each gauge's basin outline (NLDI), its record (NWIS site service) and its monthly
  mean flows (NWIS statistics service). Public domain.

Standard library only.
"""
import hashlib
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
TERRA = 'http://thredds.northwestknowledge.net:8080/thredds/dodsC/TERRACLIMATE_ALL/'
INPUTS = ('tmax', 'tmin', 'ppt')
CHECKS = ('q', 'aet', 'pet', 'swe', 'soil')
AGENT = {'User-Agent': 'python-urllib (research script)'}
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
FIRST, LAST = 1991, 2020          # water years (October to September) of the gauges' flows

PLACES = [
    {'id': 'merced', 'gauge': '11264500',
     'name': 'Merced River above Yosemite Valley, California',
     'short': 'the Merced River above Yosemite Valley',
     'kind': 'Snow-fed mountains'},
    {'id': 'french-broad', 'gauge': '03451500',
     'name': 'French Broad River above Asheville, North Carolina',
     'short': 'the French Broad River above Asheville',
     'kind': 'Rain-fed and humid'},
    # No gauge: a box of hill country, half a degree on a side, north of the Guadalquivir River.
    {'id': 'sierra-morena', 'box': {'south': 38.0, 'north': 38.5, 'west': -4.5, 'east': -4.0},
     'name': 'Sierra Morena hills, Andalusia, Spain',
     'short': 'the Sierra Morena hills of Andalusia',
     'kind': 'Mediterranean: wet winters, dry summers'},
]


class Store:
    """The downloaded files, kept as they came, with a list of where each came from."""

    def __init__(self, folder):
        self.folder = Path(folder)
        self.folder.mkdir(parents=True, exist_ok=True)
        self.list = self.folder / 'SOURCES.json'
        self.sources = json.loads(self.list.read_text()) if self.list.exists() else {}

    def get(self, name, url):
        path = self.folder / name
        if not path.exists():
            with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=180) as reply:
                path.write_bytes(reply.read())
        raw = path.read_bytes()
        self.sources[name] = {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        self.list.write_text(json.dumps(self.sources, indent=1, sort_keys=True) + '\n')
        return raw.decode('utf-8')


# ---- Outlines ---------------------------------------------------------------------------------------------------

def rings(place, store):
    """The place's outline: a list of polygons, each a list of rings of (longitude, latitude)."""
    if 'box' in place:
        b = place['box']
        return [[[(b['west'], b['south']), (b['east'], b['south']), (b['east'], b['north']), (b['west'], b['north'])]]]
    text = store.get('basin-%s.geojson' % place['gauge'],
                     'https://api.water.usgs.gov/nldi/linked-data/nwissite/USGS-%s/basin?f=json' % place['gauge'])
    shape = json.loads(text)['features'][0]['geometry']
    polygons = [shape['coordinates']] if shape['type'] == 'Polygon' else shape['coordinates']
    return [[[(x, y) for x, y in ring] for ring in polygon] for polygon in polygons]


def inside(lon, lat, polygons):
    """Is the point inside the outline? Count the crossings of a line running east from it."""
    hit = False
    for polygon in polygons:
        within = False
        for ring in polygon:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
                if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
                    within = not within
        hit = hit or within
    return hit


# ---- TerraClimate -----------------------------------------------------------------------------------------------

def row_of(lat):
    return round((89.979167 - lat) * 24)


def column_of(lon):
    return round((lon + 179.979167) * 24)


def lat_of(row):
    return 89.979167 - row / 24


def lon_of(column):
    return -179.979167 + column / 24


def packing(variable, store):
    """A variable's scale, offset and missing value, from the file's own description."""
    das = store.get('TerraClimate_19912020_%s.das' % variable,
                    TERRA + 'climatology/TerraClimate_19912020_%s.nc.das' % variable)
    block = das[das.index('    %s {' % variable):]
    block = block[:block.index('\n    }')]
    scale = float(re.search(r'scale_factor ([-\d.eE]+)', block).group(1))
    offset = float(re.search(r'add_offset ([-\d.eE]+)', block).group(1))
    missing = float(re.search(r'_FillValue ([-\d.eE]+)', block).group(1))
    return scale, offset, missing


def grid(text):
    """The numbers in an OPeNDAP ASCII reply, by their indices: {(month, row, column): value} or {(row, column): …}."""
    out = {}
    for line in text.splitlines():
        found = re.match(r'((?:\[\d+\])+), (.*)', line)
        if not found:
            continue
        lead = tuple(int(n) for n in re.findall(r'\[(\d+)\]', found.group(1)))
        for column, value in enumerate(found.group(2).split(', ')):
            out[lead + (column,)] = float(value)
    return out


def climate(place, store):
    """The place's twelve months, averaged over the grid cells whose centers are inside its outline."""
    polygons = rings(place, store)
    lons = [x for polygon in polygons for ring in polygon for x, _ in ring]
    lats = [y for polygon in polygons for ring in polygon for _, y in ring]
    r0, r1 = row_of(max(lats)), row_of(min(lats))
    c0, c1 = column_of(min(lons)), column_of(max(lons))
    cells = [(r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1) if inside(lon_of(c), lat_of(r), polygons)]
    if not cells:
        raise SystemExit('no grid cell inside ' + place['id'])
    weight = {cell: math.cos(math.radians(lat_of(cell[0]))) for cell in cells}
    total = sum(weight.values())
    window = '[%d:1:%d][%d:1:%d]' % (r0, r1, c0, c1)

    def mean(values, month=None):
        got = [(values[(cell[0] - r0, cell[1] - c0) if month is None else (month, cell[0] - r0, cell[1] - c0)], weight[cell])
               for cell in cells]
        return sum(v * w for v, w in got) / total

    out = {'cells': len(cells), 'latitude': round(sum(lat_of(r) * weight[(r, c)] for r, c in cells) / total, 2)}
    high = store.get('%s-elevation.ascii' % place['id'], TERRA + 'layers/terraclim_dem.nc.ascii?elevation' + window)
    out['elevation_m'] = round(mean(grid(high)))
    for variable in INPUTS + CHECKS:
        scale, offset, missing = packing(variable, store)
        text = store.get('%s-%s.ascii' % (place['id'], variable),
                         TERRA + 'climatology/TerraClimate_19912020_%s.nc.ascii?%s[0:1:11]%s' % (variable, variable, window))
        raw = grid(text)
        if any(raw[(m, r - r0, c - c0)] == missing for m in range(12) for r, c in cells):
            raise SystemExit('%s has a missing value inside %s' % (variable, place['id']))
        out[variable] = [mean(raw, m) * scale + offset for m in range(12)]
    return out


# ---- The river's measured flow ----------------------------------------------------------------------------------

def table(text):
    lines = [line for line in text.splitlines() if line and not line.startswith('#')]
    names = lines[0].split('\t')
    return [dict(zip(names, line.split('\t'))) for line in lines[2:]]


def gauge(place, store):
    """The gauge's record, and its flow in each month, averaged over water years 1991 to 2020, as a depth of
    water over the basin in millimeters."""
    number = place['gauge']
    site = table(store.get('site-%s.rdb' % number, 'https://waterservices.usgs.gov/nwis/site/?format=rdb&sites=%s'
                           '&siteOutput=expanded' % number))[0]
    months = table(store.get('monthly-%s.rdb' % number,
                             'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=%s&statReportType=monthly'
                             '&statTypeCd=mean&parameterCd=00060&startDT=%d-10&endDT=%d-09' % (number, FIRST - 1, LAST)))
    area_m2 = float(site['drain_area_va']) * 2.589988110336e6          # square miles to square meters
    by_month = {m: [] for m in range(1, 13)}
    for row in months:
        year, month = int(row['year_nu']), int(row['month_nu'])
        if (FIRST - 1, 10) <= (year, month) <= (LAST, 9) and row['mean_va']:
            by_month[month].append(float(row['mean_va']))
    counts = {m: len(v) for m, v in by_month.items()}
    if min(counts.values()) < 28:
        raise SystemExit('gauge %s is missing too many months: %s' % (number, counts))
    depth = []
    for m in range(1, 13):
        cfs = sum(by_month[m]) / len(by_month[m])
        depth.append(cfs * 0.028316846592 * 86400 * DAYS[m - 1] / area_m2 * 1000)      # ft³/s to mm in the month
    return {'number': number, 'name': site['station_nm'], 'area_mi2': float(site['drain_area_va']),
            'altitude_ft': float(site['alt_va']), 'years': '%d-%d' % (FIRST, LAST), 'months_counted': min(counts.values()),
            'flow_mm': [round(v, 1) for v in depth]}


def main(arguments):
    if len(arguments) != 1:
        raise SystemExit(__doc__)
    store = Store(arguments[0])
    out = {'made_by': 'models/watershed/fetch_places.py',
           'terraclimate': 'TerraClimate v1.1, 1991-2020 monthly normals, doi:10.1038/sdata.2017.191, CC0 1.0',
           'places': []}
    for place in PLACES:
        c = climate(place, store)
        entry = {k: place[k] for k in ('id', 'name', 'short', 'kind')}
        entry.update({
            'latitude': c['latitude'], 'elevation_m': c['elevation_m'], 'cells': c['cells'],
            # The model's inputs. Temperature is the middle of the average daily high and low.
            'T': [round((a + b) / 2, 1) for a, b in zip(c['tmax'], c['tmin'])],
            'P': [round(v) for v in c['ppt']],
            # TerraClimate's own water balance, for checking the model. Not used by the page.
            'terraclimate': {v: [round(x, 1) for x in c[v]] for v in CHECKS},
        })
        if 'box' in place:
            entry['box'] = place['box']
        if 'gauge' in place:
            entry['gauge'] = gauge(place, store)
        out['places'].append(entry)
        print('%-14s %3d cells, %5d m, %.2f°N  T %s  P %s = %d mm'
              % (entry['id'], entry['cells'], entry['elevation_m'], entry['latitude'], entry['T'], entry['P'], sum(entry['P'])))
        print('  TerraClimate: runoff %d, AET %d, PET %d mm a year; most snow %d mm'
              % tuple(round(x) for x in (sum(c['q']), sum(c['aet']), sum(c['pet']), max(c['swe']))))
        if 'gauge' in entry:
            print('  gauge %s: %d mm a year %s' % (entry['gauge']['number'], sum(entry['gauge']['flow_mm']), entry['gauge']['flow_mm']))
    (HERE / 'places.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Wrote places.json.')


if __name__ == '__main__':
    main(sys.argv[1:])
