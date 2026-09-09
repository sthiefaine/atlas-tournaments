# unite_artillerie_base

Shared unmarked tournament carrier: open pivot mount, raised long marker tube, offset front cab, folded side ladder and two rear ground spades. No turret, shield or national ornament.

Delivery: three glTF 2.0 GLBs and five PNG channels. LOD triangle counts: **2,840 / 1,912 / 600**. Rest dimensions: **0.620 × 0.484 × 0.850 m**, within all prescribed tolerances. Footprint centred at ground level, +Y up, +Z front.

Exactly two materials: `mat_corps`, `mat_details`. Exactly five nodes: `racine`, `corps`, `base`, `socle`, `module_canon_long`. `base` carries the tracks; `socle` is the common rear-spade hinge. The tube follows the hull through its elevation pivot. All articulation uses node transforms; no skin or extra nodes.

Animations:
- `repos`: 2400 ms, looping, raised tube and planted spades.
- `deplacement`: 1000 ms, looping, tube parked on the travel lock, spades folded forward clear of the ground, slight suspension movement. World travel is controlled by the game.
- `tir`: 700 ms, gentle axial recoil and return, spades planted.
- `touche`: 500 ms, brief deck oscillation and return.
- `hors_jeu`: 900 ms, deck settles, tube parks, green mechanical readiness tab retracts into its dark housing. No explosion or violence. No emissive channel is required.

Loop intent is recorded in animation `extras.loop`; glTF core leaves repeat behaviour to the player. Set repeat mode for the two loops and clamp the end of shutdown.

The team mask is binary black/white: white only on deck skirts and cradle cheeks. All corresponding albedo texels have exactly equal R/G/B values. Rubber, glazing, bare metal and the functional readiness tab stay unmasked. Albedo contains only material colour with subtle pigment variation, without baked light, shadows or ambient occlusion.

External PNGs are shared by all LODs via relative image URIs. The roughness PNG packs G = roughness and B = metalness for standard glTF PBR; the separate metal PNG remains editable. No image bytes are embedded. Team-mask index and filename are in material/document extras for custom recolouring. `atlas.json` gives the fixed part addresses and guard bands, shared across LODs and future national kits.

Validation checks the delivered GLB accessors, exact names, normals, UV ranges, clip durations, looping endpoints and the five PNG resolutions. It verifies every mask value and neutral albedo under the mask, plus sampled animation bounds and raised-spade ground clearance across all LODs.

Regenerate: `node --import tsx scripts/generer-artillerie.ts`.
Test: `node --import tsx --test tests/assets/artillerie.test.ts`.
Render: `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/artillerie/apercu.py`.

Full delivery check: `npm run controler:asset -- --spec assets/specs/unite_artillerie_base.json --lot public/assets/modeles`. Technical acceptance is separate from human visual approval.
