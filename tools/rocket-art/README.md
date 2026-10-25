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
