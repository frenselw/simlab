"""Build view-streamed, genuine kilometre-scale global slope tiles from ETOPO."""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
import rasterio
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'sim/rocket-side-booster-lab'
OUT = TARGET / 'assets/global-detail'
SOURCE = Path(__file__).parent / 'sources/explorer-global-detail'
SAMPLES, BORDER, SIZE, R = 1024, 1, 1027, 6371000.
PINNED_SHA = '8630abc401cc6bdd30b507a68d3eb9eda5b65f5636f7199e4b1eefd476b5a9e2'


def tile(image, x, y):
    # PixelIsArea source centres; output nodes and gutters agree across every cell.
    axis = np.arange(-2, SAMPLES + 3, dtype='f8')
    lon = -180 + x * 10 + axis * 10 / SAMPLES
    lat = -90 + y * 10 + axis * 10 / SAMPLES
    px = (lon + 180) * 120 - .5
    py = np.clip((90 - lat) * 120 - .5, 0, image.height - 1)
    left, right = math.floor(px.min()), math.ceil(px.max()) + 1
    top, bottom = math.floor(py.min()), min(image.height, math.ceil(py.max()) + 1)
    pieces = []
    cursor = left
    while cursor < right:
        start = cursor % image.width
        count = min(right - cursor, image.width - start)
        pieces.append(image.read(1, window=Window(start, top, count, bottom-top)))
        cursor += count
    patch = pieces[0] if len(pieces) == 1 else np.concatenate(pieces, axis=1)
    xx, yy = np.meshgrid(px - left, py - top)
    h = np.maximum(0, map_coordinates(patch, [yy, xx], order=1, mode='nearest'))
    assert np.isfinite(h).all() and h.max() < 9000
    step = 2 * (10 / SAMPLES) * math.pi / 180 * R
    dx = (h[1:-1, 2:] - h[1:-1, :-2]) / (step * np.maximum(.03, np.cos(np.radians(lat[1:-1])))[:, None])
    dy = (h[2:, 1:-1] - h[:-2, 1:-1]) / step
    polar = np.clip((90 - np.abs(lat[1:-1])) / .1, 0, 1)[:, None]
    normal = np.stack((-dx * polar, -dy * polar, np.ones_like(dx)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    pixels = np.clip(np.rint(normal * 127 + 128), 1, 255).astype('u1')
    assert pixels.shape == (SIZE, SIZE, 3)
    return pixels, float(h.min()), float(h.max())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    assert args.source.is_file()
    record = json.loads(args.source.with_name('download.json').read_text(encoding='utf-8'))
    assert record['url'] == 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/30s/30s_surface_elev_gtif/ETOPO_2022_v1_30s_N90W180_surface.tif'
    with args.source.open('rb') as f:
        assert hashlib.file_digest(f, 'sha256').hexdigest() == record['sha256'] == PINNED_SHA
    assert args.source.stat().st_size == record['bytes']
    Image.MAX_IMAGE_PIXELS = 1000000000
    with Image.open(args.source) as reference:
        keys=reference.tag_v2[34735];keys={keys[i]:keys[i+3] for i in range(4,len(keys),4)}
        assert keys[2048]==4326 and keys[1025]==1
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    blob = (TARGET / 'assets/global/coarse.bin').read_bytes()
    header = json.loads(blob[4:4 + int.from_bytes(blob[:4], 'little')])
    cells = {}
    # Window reads avoid keeping the 3.7 GB decoded raster in desktop memory.
    with rasterio.Env(GDAL_CACHEMAX=64*1024*1024), rasterio.open(args.source) as image:
        assert (image.width, image.height) == (43200, 21600) and image.dtypes == ('float32',)
        assert image.tags().get('AREA_OR_POINT') == 'Area'
        record['crs']=str(image.crs);record['horizontalCrs']='EPSG:4326'
        assert np.allclose([image.transform.a,image.transform.e,image.transform.c,image.transform.f],[1/120,-1/120,-180,90],atol=1e-12)
        for cell in header['cells']:
            if not cell.get('file'):
                continue
            x, y = map(int, cell['id'].split('-'))
            pixels, low, high = tile(image, x, y)
            file = OUT / ('cell-' + cell['id'] + '.png')
            Image.fromarray(pixels, 'RGB').save(file, optimize=True)
            sy,sx=np.unravel_index(np.argmax(np.abs(pixels[1:-1,1:-1,0].astype(int)-128)),(SIZE-2,SIZE-2));probes=[[1,1],[513,513],[1025,1025],[int(sx)+1,int(sy)+1]]
            cells[cell['id']] = dict(file=file.name, bounds=cell['bounds'], bytes=file.stat().st_size, sha256=hashlib.sha256(file.read_bytes()).hexdigest(), minimumMetres=low, maximumMetres=high, probes=[dict(x=x,y=y,rgb=pixels[y,x].tolist()) for x,y in probes])
            if len(cells) % 40 == 0:
                print(json.dumps(dict(built=len(cells), bytes=sum(c['bytes'] for c in cells.values()))), flush=True)
    # Normals at the shared grid nodes must agree, including the antimeridian.
    for name in cells:
        x, y = map(int, name.split('-'))
        a = np.asarray(Image.open(OUT / cells[name]['file']))
        for other, axis in [(f'{(x + 1) % 36}-{y}', 0), (f'{x}-{y + 1}', 1)]:
            if other in cells:
                b = np.asarray(Image.open(OUT / cells[other]['file']))
                assert np.max(np.abs((a[:, -2] if axis == 0 else a[-2]).astype(int) - (b[:, 1] if axis == 0 else b[1]).astype(int))) <= 1, (name, other)
    record.update(width=43200, height=21600, pixelIsArea=True, processing='Bilinear source-centre samples; 1024 intervals per 10-degree cell; shared one-node gutters; physical central-difference East/North/Up normals; RGB8 signed components encoded 127*n+128; sea elevations clamped zero; pole tangent slopes converge.')
    (SOURCE / 'source.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    metadata = dict(version=1, size=SIZE, samples=SAMPLES, border=BORDER, cellDegrees=10, encoding='tangent-rgb8-127', source=record, cells=cells, bytes=sum(c['bytes'] for c in cells.values()))
    (OUT / 'index.json').write_text(json.dumps(metadata, separators=(',', ':')) + '\n', encoding='utf-8')
    manifest = json.loads((TARGET / 'assets.json').read_text(encoding='utf-8'))
    files = ['rocket-side-booster-lab/terrain-detail.js', 'rocket-side-booster-lab/assets/global-detail/index.json'] + ['rocket-side-booster-lab/assets/global-detail/' + c['file'] for c in cells.values()]
    manifest['files'] = [f for f in manifest['files'] if not f.startswith('rocket-side-booster-lab/assets/global-detail/') and f != 'rocket-side-booster-lab/terrain-detail.js'] + files
    (TARGET / 'assets.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(cells=len(cells), bytes=metadata['bytes'])), flush=True)


if __name__ == '__main__':
    main()
