# unite_antiair_base

Shared, unmarked tournament vehicle. Three glTF 2.0 binary models and six separate PNG channels are in the delivery ZIP and `public/assets/modeles/`.

- LOD0 only: 2,704 triangles.
- Rest bounds: 0.620 × 0.503 × 0.850 metres. Ground minimum Y = 0; footprint centred at the origin; +Y up, +Z front.
- Exactly two materials: `mat_corps`, `mat_details`.
- Exactly six nodes: `racine`, `corps`, `base`, `socle`, `module_tourelle`, `module_radar`. `base` contains the track assemblies; `socle` carries the status indicator. No display plinth.
- Rigid hierarchy: turret follows the hull; radar and indicator follow the turret. No skin is needed. Every national kit uses these same files and atlas addresses.
- `repos` 2.4 s and `deplacement` 1.0 s are looping clips; `tir` 0.7 s, `touche` 0.5 s, `hors_jeu` 0.9 s are one-shot clips. Loop intent is in animation `extras.loop`; glTF core does not prescribe player repeat modes. Set the player accordingly and clamp one-shot end poses.
- `hors_jeu` settles the hull, folds the radar and scales the luminous indicator to zero. No explosion, debris or violence.
- Team mask is strictly black/white: only turret flank plates and front hull plate are white. Their albedo pixels have identical R/G/B values. Neutral paint and rubber retain their own material colours.
External PNGs are referenced by the LOD0 via relative image URIs. The roughness PNG packs G = roughness and B = metalness for standard glTF PBR; the separate metal PNG remains editable. No PNG copies are embedded in the GLB.
- Albedo contains material colour and subtle pigment variation only. No lighting, ambient occlusion or shadows are baked. Preview lighting is external to the asset.

`atlas.json` records the stable 16 × 16 part addresses. Each 512 px atlas cell has a four-pixel guard band. The LOD0 uses stable texture files and logical part addresses. The atlas should be painted in place for national kits.

Generate: `node --import tsx scripts/generer-antiair.ts`.
Check: `node --import tsx --test tests/assets/antiair.test.ts tests/assets/gltf.test.ts tests/assets/controler-asset.test.ts`.
Preview the delivered GLB: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/antiair/apercu.py`.

The repository validator now composes parent transforms, quaternion rotations and matrices when measuring mesh bounds; the nested radar exposed its previous local-only measurement. A regression test covers this independently.

Full delivery check: `npm run controler:asset -- --spec assets/specs/unite_antiair_base.json --lot public/assets/modeles`. Technical acceptance is separate from human visual approval.
