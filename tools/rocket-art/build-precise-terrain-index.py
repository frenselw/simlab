"""Pack the pinned Copernicus GLO-90 AWS tile inventory for the viewer."""
import hashlib
from pathlib import Path
import re
import sys


raw = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'e5a5efe088e70506bc1007d22006bdcb09b0ec03177b62f9652363c13f49ed97'
index = bytearray(8100)
for line in raw.decode('ascii').splitlines():
    match = re.fullmatch(r'Copernicus_DSM_COG_30_([NS])(\d\d)_00_([EW])(\d\d\d)_00_DEM', line)
    assert match, line
    ns, latitude, ew, longitude = match.groups()
    lat = int(latitude) * (1 if ns == 'N' else -1)
    lon = int(longitude) * (1 if ew == 'E' else -1)
    assert -90 <= lat < 90 and -180 <= lon < 180, line
    position = (lat + 90) * 360 + lon + 180
    byte, bit = divmod(position, 8)
    assert not index[byte] & (1 << bit), line
    index[byte] |= 1 << bit

assert sum(byte.bit_count() for byte in index) == 26475
root = Path(__file__).resolve().parents[2]
(root / 'sim/rocket-side-booster-lab/assets/precise-terrain-index.bin').write_bytes(index)
