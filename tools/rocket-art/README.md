# Rocket artwork sources and rebuild

Run from the repository root:

```text
python tools/rocket-art/generate.py
```

The build is offline and deterministic (`seed = 731`). It uses the installed Python, Pillow, NumPy and SciPy only; none is a browser/runtime dependency. It writes the five WebP images and `geography.json` under `sim/rocket-space-mission-lab/assets/`. The generator includes assertions for shape parsing, dry launch land, local coast clearance, the longitude seam, the shader-coordinate roundtrip and the combined image byte budget. Source ZIPs are intentionally retained so reproducing the art does not depend on a future download.

## Geographic sources

Made with Natural Earth. The source geography is public domain, including modification and redistribution: <https://www.naturalearthdata.com/about/terms-of-use/>.

- Land, 1:50m: <https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/>
- Lakes/reservoirs, 1:50m: <https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-lakes-reservoirs/>
- Rivers/lake centerlines, 1:50m: <https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-rivers-lake-centerlines/>
- Official source repository: <https://github.com/nvkelso/natural-earth-vector/tree/master/50m_physical>

The Natural Earth site identifies Amazon Web Services as its download host. The included source ZIPs were obtained from `https://naturalearth.s3.amazonaws.com/50m_physical/`. `geography.json` records each exact URL and SHA-256. ZIP `VERSION.txt` files specify land **4.1.0** and lakes/rivers **5.0.0**. The land webpage still labels its link 4.0.0; the archived file's own version is the one recorded here.

The data is educational artwork, not a navigation map. There are no borders or labels. Local coastline corners are gently rounded and small coves are added within about 400 m; those *same refined polygons* feed both the world and local masks. Local vegetation, ridge shading, and the near-pad river are illustrative. Ridge footprints and the river's central 4.4 km preserve the existing simulation geometry.

## Texture and coordinate contract

All images are north-up. Standard Three.js `TextureLoader` with its default `flipY = true` matches these images to the existing shader:

- Global image X: `(longitudeDegrees + 180) / 360`; image Y: `(90 - latitudeDegrees) / 180`.
- Regional image X: `(eastMetres + 120000) / 240000`; image Y: `(120000 - northMetres) / 240000`.
- Local sphere vector: `(east/R, sqrt(1 - (east²+north²)/R²), north/R)`, `R = 6371000`.
- Launch latitude/longitude are exactly the shader's `0.605629`, `-2.101376` radians, with the east/up/north basis in that shader.
- Shader scene X/Z to regional chart: `east = 0.764842*x + 0.644218*z`, `north = -0.644218*x + 0.764842*z`.

`coastRows` use `{z: northMetres, x: eastMetres}` and identify the western edge of the mainland connected to the region's eastern border, every 500 m. A null X means no such mainland on that row; offshore islands do not masquerade as mainland. The small `landGrid` separately preserves islands and is north-up. It is a coarse placement aid, not a collision surface; keep near-pad trees clear of the river using its explicit formula and width.

The local patch retains detailed coast shape and interpolates its *color* to the global atlas outside a 90 km radius, exactly matching global color at 112 km. The shader independently fades the patch between 75 and 115 km. These blends depend on surface coordinates, not camera altitude, so coastline positions do not move during flight.

`clouds.webp` is RGBA, with fragmented cloud bands distributed across all four longitude quarters. The generator checks moderate alpha coverage (12–32%) and an exact longitude seam. Low-altitude clouds use 18 rounded, instanced clusters spread from 9.5 to 107 km around the launch area; these are separate from the 1K global atlas. `starfield.webp` is a deliberately dim RGB environment field, intended to sit behind separately rendered foreground star points. Large atmosphere/postprocessing textures, photographic textures, and runtime geographic parsers are not used.

## Reproducibility and limits

The checked-in outputs were generated with Pillow 9.3.0, NumPy 2.2.6 and SciPy 1.16.3. A different WebP codec version may change compressed bytes while preserving the illustration. All full-resolution files were visually inspected; a dark-background composite was used to inspect cloud alpha.

The two global resolutions are alternatives: load exactly one. Shipping both permits phone/desktop selection, but loading both increases GPU memory needlessly. WebP download bytes do not represent decoded GPU texture memory; that estimate belongs in the scene's resource checks.


## Regional 3D terrain (P31)

The same refined source coastlines feed `terrain.bin`: a 480 km square, split into 16 chunks with three prebuilt detail levels and baked directional shading. `generate.py` calls `bake-terrain.mjs` and the installed SciPy's Delaunay triangulator in `triangulate-terrain.py`; coast constraints are recovered and land area checked offline. No browser triangulation, terrain download service or new dependency is used. The binary contains a compact height field and interleaved positions, normals, colors, edge fade and indices. The renderer selects a single level per chunk from projected size with hysteresis; shore and chunk boundaries retain common vertices. Low altitude uses smooth cartoon relief and sparse instanced woodland; orbit retains the existing atlas. Heights are illustrative, not elevation survey data or a change to the physics collision sphere.

The launch clearing and near-pad river stay level. Nearby props sample the actual highest-detail surface once when built. A small curvature/depth clearance and a less extreme follow-camera near plane prevent the globe from cutting through the terrain. The globe supplies quiet water under the vector coast; both blend back to the original atlas at the regional perimeter. No shadow maps, postprocessing targets, extra color textures or per-frame mesh generation are added.


## Global 3D terrain (P32)

Run `python tools/rocket-art/global-terrain.py --prototype` for the full coarse globe plus the western-US fine cell. Run without the flag only after checking that prototype in the browser. The complete build uses the pinned 50m land source and the existing NumPy/SciPy/Pillow installation. No online terrain service or browser triangulation is needed.

The binary starts with a little-endian uint32 JSON length, JSON padded to four bytes, then Float32 XYZ positions (normalized launch E/up/N), normalized Uint8 linear RGBA and Uint32 triangle indices. The merged coarse header records contiguous index ranges for each nonempty 10° cell. Each fine cell has its own binary. Offline constraints preserve coast intersections and common border cuts across cells and levels; pole triangles point outward. Heights and mountain chains are illustrative, capped at 3.5 km, with relief blending out inside the existing regional footprint.

The runtime copies only horizon-visible coarse ranges into one reusable index buffer. Fine details load by projected cell size with hysteresis, at most 4 active, 6 cached and 2 requests. Missing fine files keep coarse land; obsolete geometry is disposed. Coarse sphere chords draw after the ocean with analytical horizon clipping. The regional core clips global land, and the existing outer fade overlaps it. No extra texture, shadow map, postprocessing target or per-frame triangulation is used. Fine-cell failures remain at coarse detail until reload. Metadata/hashes and all runtime files belong in geography.json and the SCORM manifest.


## Regional/global color continuity (P33)

`bake-terrain.mjs` samples the checked-in global coarse mesh's linear vertex colors in the launch E/N chart. It retains local slope shading near the pad and fades that variation before the regional edge. Both runtime meshes share `terrainLighting` and the same sun vector. Rebuild regional colors with `node tools/rocket-art/bake-terrain.mjs output/rocket/terrain-source.json` after changing the global coarse palette, then update geography.json's terrain hash. Coarse global geometry remains the color reference at long viewing distances; region geometry fades by projected size and global land replaces it behind transparency.
