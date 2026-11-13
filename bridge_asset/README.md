# ArcadeBridge_01

Open stone arcade bridge made in Blender 5.2.3 LTS from the supplied reference. Four transverse pointed arches cross a single checker-tiled bridge deck; each side has three matching longitudinal arches. There is no roof slab, cross-bracing, furniture, or other decoration.

## Files

- `ArcadeBridge_01.blend`: editable mesh model, packed textures, and separate preview collection.
- `ArcadeBridge_01.glb`: game asset; the script also copies this to `public/assets/ArcadeBridge_01.glb` after verification.
- `scripts/generate_bridge.py`: deterministic Blender generator, export, actual rendering, reimport, and validation.
- `parameters.json`: dimensions, materials, texture seed `63112042`, and world-placement contract.
- `textures/`: two 256 × 256 PNG images, both embedded in the GLB.
- `previews/`: head, side, oblique, passage, and reimport renders.
- `bridge_report.json`: measured dimensions, per-component topology, embedded-image inspection, clearance rays, and collision contract.

## Coordinates and placement

Metres, bottom-centre origin, glTF Y-up. X is the 10 m bridge length; Z is the 3.8 m width. The complete deck occupies local Y = 0 to 0.20. Place the root at `(39, -0.18, -8)` to align its walking surface with world Y = 0.02. The maximum local height is approximately 4.80149 m.

Column X centres are `[-4.2, -1.4, 1.4, 4.2]`, with rows at Z = ±1.55. Square bases are 0.56 m wide; their inside gap is 2.54 m. Eight-sided shaft radii taper from 0.19 to 0.175 m. The arch spring is 2.35 m above the deck. Each arch half has five straight segments, and all faces are flat shaded.

Low side edges are centred at Z = ±1.835, with width 0.13 m and height 0.16 m above the deck. Both bridge ends are open. Use explicit column/edge colliders and the deck footprint, never a solid collision box covering the arcade height.

## Materials

The stone is warm grey/pink/beige with subdued mottling. The deck has one checker texture at 0.5 m per tile, using actual UV coordinates. Checker tiles are not individual objects. Materials are opaque, metallic = 0, roughness = 0.9, and low specular. No procedural texture dependency remains in the GLB.

## Rebuild

From PowerShell:

```powershell
& 'E:\BLEND\blender.exe' --background --factory-startup --python 'E:\6311 final\old-web-outpost\bridge_asset\scripts\generate_bridge.py'
```

The script writes the blend and GLB, renders the source mesh from four cameras, reimports the GLB, and checks matching dimensions/triangle counts, closed components with outward volume, UVs and embedded textures, the deck top and bottom, twelve unobstructed walking rays, and three open-sky rays. It renders the imported GLB again before copying the verified asset into the game assets directory. Preview floor, lights, and camera are excluded from export.
