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

`clouds.webp` is a 1024×512 RGBA atlas baked from warped continuous density at several scales, with broad irregular cloud systems, thin edges and clear gaps. Rebuild only this atlas and its asset hash with `python tools/rocket-art/generate.py --clouds-only`. The generator checks moderate alpha coverage (12–32%) and an exact longitude seam. Low-altitude clouds use 18 rounded, instanced clusters spread from 9.5 to 107 km around the launch area; these are separate from the 1K global atlas. `starfield.webp` is a deliberately dim RGB environment field, intended to sit behind separately rendered foreground star points. Large atmosphere/postprocessing textures, photographic textures, and runtime geographic parsers are not used.

## Reproducibility and limits

The checked-in outputs were generated with Pillow 9.3.0, NumPy 2.2.6 and SciPy 1.16.3. A different WebP codec version may change compressed bytes while preserving the illustration. All full-resolution files were visually inspected; a dark-background composite was used to inspect cloud alpha.

The two global resolutions are alternatives: load exactly one. Shipping both permits phone/desktop selection, but loading both increases GPU memory needlessly. WebP download bytes do not represent decoded GPU texture memory; that estimate belongs in the scene's resource checks.


## Regional 3D terrain (P31)

The same refined source coastlines feed `terrain.bin`: a 480 km square, split into 16 chunks with three prebuilt detail levels and unlit vertex albedo (P37). `generate.py` calls `bake-terrain.mjs` and the installed SciPy's Delaunay triangulator in `triangulate-terrain.py`; coast constraints are recovered and land area checked offline. No browser triangulation, terrain download service or new dependency is used. The binary contains a compact height field and interleaved positions, normals, colors, edge fade and indices. The renderer selects a single level per chunk from projected size with hysteresis; shore and chunk boundaries retain common vertices. Low altitude uses smooth cartoon relief and sparse instanced woodland; orbit retains the existing atlas. Heights are illustrative, not elevation survey data or a change to the physics collision sphere.

The launch clearing and near-pad river stay level. Nearby props sample the actual highest-detail surface once when built. A small curvature/depth clearance and a less extreme follow-camera near plane prevent the globe from cutting through the terrain. The globe supplies quiet water under the vector coast; both blend back to the original atlas at the regional perimeter. No shadow maps, postprocessing targets, extra color textures or per-frame mesh generation are added.


## Global 3D terrain (P32)

Run `python tools/rocket-art/global-terrain.py --prototype` for the full coarse globe plus the western-US fine cell. Run without the flag only after checking that prototype in the browser. The complete build uses the pinned 50m land source and the existing NumPy/SciPy/Pillow installation. No online terrain service or browser triangulation is needed.

The binary starts with a little-endian uint32 JSON length, JSON padded to four bytes, then Float32 XYZ positions (normalized launch E/up/N), normalized Uint8 linear RGBA and Uint32 triangle indices. The merged coarse header records contiguous index ranges for each nonempty 10° cell. Each fine cell has its own binary. Offline constraints preserve coast intersections and common border cuts across cells and levels; pole triangles point outward. Heights and mountain chains are illustrative, capped at 3.5 km, with relief blending out inside the existing regional footprint.

The runtime copies only horizon-visible coarse ranges into one reusable index buffer. Fine details load by projected cell size with hysteresis, at most 4 active, 6 cached and 2 requests. Missing fine files keep coarse land; obsolete geometry is disposed. Coarse sphere chords draw after the ocean with analytical horizon clipping. The regional core clips global land, and the existing outer fade overlaps it. No extra texture, shadow map, postprocessing target or per-frame triangulation is used. Fine-cell failures remain at coarse detail until reload. Metadata/hashes and all runtime files belong in geography.json and the SCORM manifest.


## Regional/global color continuity (P33)

`bake-terrain.mjs` samples the checked-in global coarse mesh's linear vertex colors in the launch E/N chart. P37 removes the former baked local slope shading; runtime normals and a shared sun/skylight model provide the relief lighting. Both runtime meshes share `terrainLighting` and the same sun vector. Rebuild regional colors with `node tools/rocket-art/bake-terrain.mjs output/rocket/terrain-source.json` after changing the global coarse palette, then update geography.json's terrain hash. Coarse global geometry remains the color reference at long viewing distances; region geometry fades by projected size and global land replaces it behind transparency.


## Shared contact surface (P34)

`python tools/rocket-art/bake-surface.py` creates surface-data.js from the same pinned Natural Earth land/coast/mountain field plus the existing regional heightfield. It packs land flags and metre heights in Uint16 grids (global0.5°, regional257×257); sea is zero. surface.js owns the deterministic query used by modelVersion2 contact, HUD AGL and the near-flight contact mesh. Orbital/scoring heights retain the reference sphere. The contact mesh uses dense concentric rings and the global coarse color field, while clipping covered old ground; it updates only after100m surface travel and is disabled above5km AGL. This avoids coarse sphere-chord gaps without globally increasing mesh density. Heights remain illustrative, not survey elevation data.


## Continuous terrain lighting and unlit albedo (P37)

Recolor existing meshes without rerunning triangulation:

```text
python tools/rocket-art/global-terrain.py --recolor
node tools/rocket-art/bake-terrain.mjs --recolor
```

These commands update only colors and metadata hashes; headers, positions, normals stored in the regional binary, fades, indices and height grids remain byte-identical. The global color field no longer includes a fixed directional slope shade. Exact shared global positions use identical albedo, including harmonized border vertices. Runtime lighting normals are sampled from the shared contact height field at fixed geographic positions rather than computed separately from tile triangles; the rendered geometry and physical collision data remain unchanged. Global, regional and contact ground share one diffuse sun and local skylight model. No global noise texture, new runtime dependency, shadow pass or postprocessing target is added. P31/P33 descriptions of baked directional lighting are historical.


## Explorer mountains and forests (2026-11)

The independent non-assessed explorer has its own explicit rebuild entry:

```text
python tools/rocket-art/bake-explorer-terrain.py --target sim/rocket-side-booster-lab
```

This command rejects other targets. It reads the pinned USGS region export, Natural Earth coast and original globe seed directions without writing the original activity. The 4097² regional height field covers 480 km with 117.1875 m spacing and 0.1 m packing; 0 denotes water, positive values store height plus one. The gzip file is decoded once before flight. The 257² local fallback is only for startup; the 721×361 global field remains illustrative. Source georeferencing and SHA-256 are in `sources/explorer-natural-region/source.json`; the 31 MB GeoTIFF is build-only. Invalid export values are filled from the nearest valid source before coast masking, and the source invalid fraction is recorded. Land below sea level is clamped to zero in this simplified ocean model. Summit values are retained under a consistent 5000 m physics bound.

The regional mesh uses height-error refinement from Poisson/Sobol points, with common constrained coastal/chunk edges. No regular interior lattice or hand-drawn sine ridge remains. Targets and vertex caps limit refinement; this is a simplified rendering, not a promise that every triangle meets its target. The binary contains meshes only, avoiding a duplicate height grid. A 2049² opaque-data RGBA PNG stores 16-bit height and woodland density for continuous fragment normals without height mipmaps. Land slopes are no longer doubled. The camera-local 81² ground mesh uses the canonical diagonal; its skirt follows the actual displayed regional LOD. A spatial index reuses those triangles for the skirt and middle-distance vegetation roots. Only a 250–650 m launch apron transition is flattened; surrounding facilities follow canonical ground. The region blends into the illustrative globe between 175 and 239.5 km along a rounded boundary.

`bake-terrain.mjs --target` carries the explorer target through its reads and writes; the historical no-target command retains its original behavior. The shared triangulator accepts optional ridge/valley sample points, with all existing callers unchanged. The explorer command owns `output/tmp/explorer-terrain/`; remove that scratch directory after verification, keeping source binaries and metadata. No runtime triangulation or new dependency is added.

`forest.js` retains at most nine active / twelve cached geographic chunks, 1296 near trees and 256 middle-distance nine-crown stands. Seeded random candidates with minimum spacing replace one tree per small cell; continuous value noise replaces periodic moisture stripes. Distance alpha hashing softens near/middle transitions. Plants remain illustrative, with no individual physics, shadows or leaf animation. Far ground retains forest colors when geometry becomes subpixel or adaptive quality disables trees. Coarse-pointer devices use the 2K globe atlas and a 1.5 pixel-ratio cap. The original SCORM activity and its runtime assets remain unchanged.


## Bounded real-terrain review sample

```text
python tools/rocket-art/build-terrain-sample.py
```

This offline-only command reads the pinned `sources/explorer-terrain-sample/usgs-santa-ynez-dem.tif` and `source.json`. It writes only `sim/rocket-side-booster-lab/assets/terrain-sample/`. The 40 km square is centered 28 km east of the launch reference, with real USGS 3DEP elevation projected into local E/N. The source is a best-available multi-resolution service export, not a claim that the source was uniformly 30 m. The source sidecar records request extent, EPSG:4326 pixel-is-area georeferencing, export settings, service data date, license and SHA-256; no API key is used. The TIFF remains a build source and is not served or packaged.

`terrain-sample.html` is a review page within the existing explorer Site. It does not replace the main flight terrain, its physics or its controls. It uses existing Three.js and shared fullscreen support, with no new browser dependency. The artifact contains a 513² canonical height grid (0.1 m packing), deterministic woodland density, error-refined irregular meshes and sample stand locations. Coarse/middle candidates remain recorded for later evaluation; the review page uses the fine mesh, plus a camera-local canonical-grid detail patch for low flight. Reported mesh error statistics are measured errors, separate from target thresholds; the vertex budget can stop refinement before a target is met.

An opaque RGB PNG packs 16-bit heights into RG to calculate continuous fragment normals; it uses linear sampling without mipmaps to avoid byte-carry rounding. Lossless WebP albedo avoids compression blocks. Gray/normal diagnostics include the local patch; the wire view explicitly shows the distant irregular mesh. A 200 m overlap at the patch edge prevents sky gaps from differing triangulations. Near tree roots use the same local grid triangles. Woodland uses two bounded instance batches with distance alpha hashing, a capped 32-cell CPU cache and at most 1690 near trees; positions remain seeded and stable. Trees are illustrative, not a land-cover survey. Pixel ratio is capped at 1.5; no real-time shadow or reflection pass is added.

The existing explorer browser owner runs this via its `sample` case for source and extracted standalone ZIP. The user accepted this sample, authorizing full-area integration; the sample remains unchanged for comparison. Its independent build does not rebuild the flight terrain.

## Explorer global elevations and coherent night lighting

The original activity's illustrative pipeline above is historical and unchanged. For the explorer, run these offline commands in order:

```text
python tools/rocket-art/build-world-height.py
python tools/rocket-art/bake-explorer-terrain.py --target sim/rocket-side-booster-lab
```

The checked-in `sources/explorer-world-terrain/height-land-8k.png` is a SHA-pinned derivative of NOAA ETOPO 2022 ice-surface 60-arc-second elevations. Its sidecar records the public URL, raw TIFF hash and processing; the 466 MB original is only an import cache. `build-world-height.py --source <TIFF>` verifies that original before regenerating the derivative. The runtime 8193 by 4097 point grid generalizes elevations to about 5 km at the equator, with periodic longitude and constant poles. A Uint16 stores metre height plus a land bit; sea and below-sea-level land remain zero. Row deltas plus deterministic gzip reduce transmission to about 10.6 MB; decoding reconstructs the shared 67.1 MB buffer in place. Flight waits for world and regional data. The accepted elevation bound is 9000 m; generalization does not preserve every summit.

The global mesh retains common coast/cell topology and bounded 4-active/6-cached/2-request loading. Heights and biome colors are rebaked from the same data; desert and latitude/elevation limits also constrain illustrative woodland. A 4096 by 2049 RG8 texture derived in memory supplies continuous global normals, with no extra download or mipmaps. The USGS core and accepted sample retain higher detail. Contact skirts and middle woodland roots follow displayed coarse/fine triangles. Dense ocean rings follow the controlled craft without moving geography. No dynamic shadow or reflection target is added.

`lighting.js` calculates solar height and spherical Earth occlusion. Sky, clouds, terrain, ocean, trees and bodies share the sun; bodies above a dark surface can receive direct light when the sun clears the horizon. Dim blue fill preserves body outlines. The browser owner's `world` case checks regions, real GPU heights, twilight/night pixels, model isolation and coarse-pointer budgets. These are Chromium checks, not physical iPad Safari FPS or peak-memory measurements. See the [global implementation plan](../../plans/42-rocket-explorer-global-terrain-and-night.md) for evidence and deployment receipts.
