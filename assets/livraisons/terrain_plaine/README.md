# terrain_plaine

One-metre square tournament turf, grid P, defence 1/4. The grass material has short blades, a faint mowing pattern, scattered small clover/dandelion and tiny earth scuffs. No text, symbols, national livery or large identifying feature.

Two glTF 2.0 binary files and four PNG channels:
- `terrain_plaine_lod0.glb`: 522 triangles.
- `terrain_plaine_lod1.glb`: 138 triangles.
- Albedo, tangent normal and grayscale roughness: 1024 × 1024.
- Grayscale occlusion: 512 × 512.

Dimensions are 1 × 0.02 × 1 metres: a perfectly level 2 cm slab, matching the revised flat-slab contract (0.02 ± 0.002 m). The root is at ground level, footprint centred, +Y up and +Z front. The top is horizontal; there is no geometric undulation or displacement. The six-centimetre landscape undulation belongs to the game's terrain mesh. The microscopic normal map describes only turf blades. Float32 thickness is 0.0200000014 m to remain above the inclusive lower tolerance despite quantisation.

Exactly two nodes, `racine` and `sol`, and one metallic-roughness material, `mat_sol`. No animation. Metalness is zero. Roughness uses the PNG green channel; occlusion uses its separate PNG red channel. All four maps are external PNGs shared by both GLBs, referenced by relative URI; no image bytes are embedded.

Albedo contains pigment colour only. No illumination, ambient occlusion, directional shadows or highlights are baked into it. Occlusion is a separate, mild map of local turf interstices. Previews use external Blender lighting.

Every scalar map has byte-identical edge samples on all four sides and their reversals. The tangent normal map matches under all 16 adjacent quarter-turn combinations after rotating the vectors with the tile. A 48-pixel boundary collar supplies the compatible boundary, while the interior stays asymmetric, so rotations change the interior pattern. `texture-validation.json` records measured edge differences; `validation.json` records mesh dimensions, budgets and repository-validator verdicts.

The surface UVs cover [0,1]². Rotate the tile and tangent basis together. If applying the PNGs directly to a separate terrain mesh, rotate sampled tangent normals together with the UV transform; rotating only normal-map pixels would misorient the relief. The level slab is intended for asset interchange/preview; the renderer may use these same maps on its own continuous terrain surface.

Regenerate textures with Blender's bundled Python:
`/Applications/Blender.app/Contents/Resources/5.1/python/bin/python3.13 scripts/plaine/textures.py`

Generate GLBs: `node --import tsx scripts/generer-plaine.ts`.
Test: `node --import tsx --test tests/assets/plaine.test.ts`.
Preview: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/plaine/apercu.py`.

Full delivery check: `npm run controler:asset -- --spec assets/specs/terrain_plaine.json --lot public/assets/modeles`. Technical acceptance is separate from human visual approval.
