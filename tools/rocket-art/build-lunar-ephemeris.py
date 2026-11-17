"""Build the P1 geometric ephemeris and check it against unused Horizons samples."""
import gzip
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np

from lunar_flyby import DATA, START_JD, STEP, COUNT, Ephemeris


def query(body):
    parameters = dict(format="text", COMMAND=body, CENTER="500@399",
                      EPHEM_TYPE="VECTORS", REF_PLANE="FRAME", REF_SYSTEM="ICRF",
                      VEC_CORR="NONE", VEC_TABLE=2, TIME_TYPE="TDB", OUT_UNITS="KM-S",
                      CSV_FORMAT="YES", OBJ_DATA="NO", START_TIME=f"JD{START_JD}",
                      STOP_TIME=f"JD{START_JD + (COUNT - 1) * STEP / 86400}", STEP_SIZE="90 m")
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urlencode(parameters)
    with urlopen(url, timeout=45) as response:
        table = response.read().decode()
    if "$$SOE" not in table:
        raise ValueError(table)
    header, rows = table.split("$$SOE")
    tags = ("{source: DE441}", "ICRF", "Geometric", "TDB", "Earth (399)")
    if not all(tag.lower() in header.lower() for tag in tags):
        raise ValueError(header)
    data = np.array([[float(fields[0]), *map(float, fields[2:8])]
                     for line in rows.split("$$EOE")[0].strip().splitlines()
                     if (fields := line.split(","))])
    expected = START_JD + np.arange(4 * (COUNT - 1) + 1) / 16
    if not np.array_equal(data[:, 0], expected) or not np.isfinite(data).all():
        raise ValueError("Unexpected Horizons sample times or states")
    return url, data[:, 1:] * 1000


def main():
    packed, sources, reference = [], {}, {}
    for name, body, metres in (("moon", 301, 1), ("sun", 10, 100)):
        url, samples = query(body)
        sources[name] = url
        reference[name] = samples
        ticks = np.rint(samples[::4] * ([1/metres]*3 + [10000]*3))
        if abs(ticks).max() > np.iinfo(np.int32).max:
            raise ValueError("Ephemeris quantization overflow")
        packed.append(ticks.astype("<i4").tobytes())

    raw = b"".join(packed)
    table = Ephemeris(raw)
    report = {"source": "JPL Horizons DE441", "queries": sources, "checks": {}}
    for index, (name, samples) in enumerate(reference.items()):
        times = np.arange(len(samples)) * (STEP / 4)
        vectors = np.array([table.body(t, index) for t in times])
        error = vectors - samples
        checks = report["checks"].setdefault(name, {})
        for label, subset in (("nodes", slice(0, None, 4)), ("withheld", times % STEP != 0)):
            delta = error[subset]
            checks[label] = {"samples": len(delta),
                             "maxPositionM": float(np.linalg.norm(delta[:, :3], axis=1).max()),
                             "maxSpeedMS": float(np.linalg.norm(delta[:, 3:], axis=1).max())}
    moon = report["checks"]["moon"]["withheld"]
    if moon["maxPositionM"] > 500 or moon["maxSpeedMS"] > 0.05:
        raise ValueError(f"Interpolation misses the lunar error budget: {moon}")
    compressed = gzip.compress(raw, mtime=0)
    DATA.write_bytes(compressed)
    report.update(rawBytes=len(raw), gzipBytes=len(compressed),
                  sha256=hashlib.sha256(compressed).hexdigest())
    DATA.with_name("lunar-ephemeris-reference.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
