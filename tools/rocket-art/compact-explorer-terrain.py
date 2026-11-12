"""Convert the baked explorer terrain to the static delivery format.

Run against the existing full-resolution bake in a separate source directory.
Requires NumPy and Pillow, as do the upstream terrain bakers.
"""
import argparse
import gzip
import hashlib
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'sim/rocket-side-booster-lab'
STRIDE = 32
RADIUS = 6371000


def digest(blob):
    return hashlib.sha256(blob).hexdigest()


def packed(path, raw):
    blob = gzip.compress(raw, compresslevel=9, mtime=0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)
    return dict(bytes=len(blob), decodedBytes=len(raw), sha256=digest(blob))


def heights(path, height, land, step, maximum, near=None):
    stride = STRIDE
    decoded = height[::stride, ::stride].copy()
    pieces = [np.packbits(land, bitorder='little').tobytes(), decoded.astype('<u2').tobytes()]
    while stride > 1:
        stride //= 2
        shape = height[::stride, ::stride].shape
        next_grid = np.zeros(shape, dtype=np.int32)
        next_grid[::2, ::2] = decoded
        predictions = (
            (0, 1, (decoded[:, :-1] + decoded[:, 1:]) // 2),
            (1, 0, (decoded[:-1] + decoded[1:]) // 2),
            (1, 1, (decoded[:-1, :-1] + decoded[:-1, 1:] + decoded[1:, :-1] + decoded[1:, 1:]) // 4),
        )
        for row, col, prediction in predictions:
            source = height[row * stride::2 * stride, col * stride::2 * stride]
            mask = land[row * stride::2 * stride, col * stride::2 * stride]
            residual = np.where(mask, (source - prediction + step // 2) // step, 0)
            assert residual.min() >= -128 and residual.max() <= 127
            pieces.append(residual.astype('i1').tobytes())
            next_grid[row::2, col::2] = np.where(mask, np.clip(prediction + residual * step, 0, maximum), 0)
        decoded = next_grid
    if near:
        start, size = near['start'], near['size']
        patch = height[start:start+size, start:start+size]
        delta = np.diff(patch, axis=1, prepend=np.zeros((size, 1), dtype=np.int32))
        assert delta.min() >= -32768 and delta.max() <= 32767
        pieces.append(delta.astype('<i2').tobytes())
    else:
        decoded[:, -1] = decoded[:, 0]
        decoded[0, :] = height[0, 0]
        decoded[-1, :] = height[-1, 0]
    assert np.abs(decoded - height).max() <= step // 2
    return dict(file='assets/' + path.name, width=height.shape[1], height=height.shape[0],
                codec='pyramid-i8-v1', step=step, maximum=maximum, near=near,
                **packed(path, b''.join(pieces)))


def header(blob):
    length = struct.unpack_from('<I', blob)[0]
    return json.loads(blob[4:4+length]), 4 + (length + 3) // 4 * 4


def prefix(metadata):
    raw = json.dumps(metadata, separators=(',', ':')).encode()
    return struct.pack('<I', len(raw)) + raw + b' ' * (-len(raw) % 4)


def regional_mesh(source):
    blob = source.read_bytes()
    metadata, start = header(blob)
    payload = bytearray()
    for chunk in metadata['chunks']:
        for level in chunk['levels']:
            offset = start + level['offset']
            vertices = np.frombuffer(blob, '<f4', level['vertices'] * 10, offset).reshape(-1, 10)
            indices = np.frombuffer(blob, '<u4', level['indices'], offset + vertices.nbytes)
            assert level['vertices'] < 32768
            payload += b'\0' * (-len(payload) % 4)
            level['offset'] = len(payload)
            payload += vertices[:, [0, 2]].T.copy().tobytes()
            payload += np.diff(indices.astype('i4'), prepend=np.int32(0)).astype('<i2').tobytes()
    metadata['version'] = 2
    return prefix(metadata) + payload


def global_mesh(source):
    blob = source.read_bytes()
    metadata, start = header(blob)
    count = metadata['vertexCount']
    vertices = np.frombuffer(blob, '<f4', count * 3, start).astype('f8').reshape(-1, 3)
    x, y, z = vertices.T
    coordinates = np.rint(np.stack((np.arctan2(z, x), np.arctan2(y, np.hypot(x, z)))) * 1e7).astype('<i4')
    indices = np.frombuffer(blob, '<u4', metadata['indexCount'], start + count * 16).astype('i4')
    longitude, latitude = coordinates / 1e7
    cos_lat = np.cos(latitude)
    directions = np.stack((cos_lat*np.cos(longitude), np.sin(latitude), cos_lat*np.sin(longitude)), axis=1)
    metadata['version'] = 2
    blocks = []
    offset = 0
    for cell in metadata['cells']:
        if cell.get('file'):
            cell['file'] += '.gz'
        first = cell['firstIndex']
        faces = indices[first:first+cell['indexCount']].reshape(-1, 3)
        a, b, c = directions[faces].transpose(1, 0, 2)
        winding = np.sum(np.cross(b-a, c-a)*a, axis=1)
        # Rounding to sub-metre directions can collapse slivers at the poles.
        keep = np.abs(winding) > 1e-18
        outward = faces[keep].copy()
        reversed_faces = winding[keep] < 0
        outward[reversed_faces] = outward[reversed_faces][:, [0, 2, 1]]
        cell['firstIndex'] = offset
        cell['indexCount'] = outward.size
        offset += outward.size
        blocks.append(outward.ravel())
    metadata['indexCount'] = offset
    indices = np.concatenate(blocks)
    return (prefix(metadata) + np.diff(coordinates, axis=1, prepend=np.zeros((2, 1), dtype='i4')).tobytes()
            + np.diff(indices, prepend=np.int32(0)).astype('<i4').tobytes())


def normal_tiles(source, target):
    index = json.loads((source / 'index.json').read_text(encoding='utf-8'))
    target.mkdir(parents=True, exist_ok=True)
    cells, paths = {}, []
    for cell_id, record in index['cells'].items():
        x, y = map(int, cell_id.split('-'))
        with Image.open(source / record['file']) as image:
            for dy in range(4):
                for dx in range(4):
                    tile = image.crop((dx*256, dy*256, dx*256+259, dy*256+259))
                    if tile.getextrema() == ((128,128),(128,128),(255,255)):
                        continue
                    tile_id = f'{4*x+dx}-{4*y+dy}'
                    file = target / f'normal-{tile_id}.webp'
                    tile.save(file, lossless=True, method=4)
                    with Image.open(file) as result:
                        assert result.tobytes() == tile.tobytes()
                    cells[tile_id] = file.stat().st_size
                    paths.append(file)
    index = dict(version=2, size=259, samples=256, border=1, encoding=index['encoding'],
                 source=index['source'], cells=cells, bytes=sum(cells.values()))
    path = target / 'tiles.json.gz'
    packed(path, json.dumps(index, separators=(',', ':')).encode())
    return [path, *paths]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='directory of the full-resolution activity bake')
    parser.add_argument('--target', type=Path, default=TARGET)
    args = parser.parse_args()
    source, target = args.source.resolve(), args.target.resolve()
    assert source != target, 'Use a separate source bake'
    assets = source / 'assets'
    out = target / 'assets'
    local = np.frombuffer(gzip.decompress((assets / 'regional-heights.bin.gz').read_bytes()), '<u2').reshape(4097, 4097)
    global_delta = np.frombuffer(gzip.decompress((assets / 'world-heights.bin.gz').read_bytes()), '<u2').reshape(4097, 8193)
    world = np.cumsum(global_delta, axis=1, dtype='u4').astype('<u2')
    fine = heights(out/'region-v2.gz', np.maximum(local.astype('i4')-1, 0), local > 0, 100, 50000,
                   dict(start=1792, size=513, feather=16))
    globe = heights(out/'world-v2.gz', (world & 32767).astype('i4'), world >= 32768, 80, 9000)
    data = dict(version=2, extent=240000, fine=fine, world=globe)
    (target/'surface-data.js').write_text(
        '(function(root,data){if(typeof module==="object"&&module.exports)module.exports=data;'
        'root.RocketSurfaceData=data;})(globalThis,' + json.dumps(data, separators=(',', ':')) + ');\n',
        encoding='utf-8')
    geography = json.loads((assets/'geography.json').read_text(encoding='utf-8'))
    terrain = packed(out/'region-mesh-v2.gz', regional_mesh(assets/'terrain.bin'))
    global_files = {}
    for record in geography['globalTerrain']['files']:
        name = record['file']
        global_files[name+'.gz'] = packed(out/(name+'.gz'), global_mesh(assets/name))
    site = dict(coastRows=geography['coastRows'], ridges=len(geography['ridges']))
    packed(out/'geography-v2.gz', json.dumps(site, separators=(',', ':')).encode())
    generated = [out/fine['file'].split('/')[-1], out/globe['file'].split('/')[-1],
                 out/'geography-v2.gz', out/'region-mesh-v2.gz', *(out/name for name in global_files)]
    generated.extend(normal_tiles(assets/'global-detail', out/'global-detail'))
    manifest = json.loads((source/'assets.json').read_text(encoding='utf-8'))
    slug = 'rocket-side-booster-lab/'
    replaced = {'geography.json', 'terrain.bin', 'regional-surface.png', 'regional-heights.bin.gz', 'world-heights.bin.gz'}
    manifest['files'] = [
        file for file in manifest['files']
        if file.removeprefix(slug+'assets/') not in replaced
        and not file.startswith((slug+'assets/global/', slug+'assets/global-detail/'))
    ]
    manifest['files'] += [slug+'surface-codec.js', slug+'surface-worker.js']
    manifest['files'] += [slug+file.relative_to(target).as_posix() for file in sorted(generated)]
    (target/'assets.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(dict(fine=fine, world=globe, terrain=terrain, coarse=global_files['global/coarse.bin.gz'],
                          files=len(generated), bytes=sum(p.stat().st_size for p in generated)), indent=2))


if __name__ == '__main__':
    main()
