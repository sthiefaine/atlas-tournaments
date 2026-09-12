# Finition GLB et amélioration des prompts

## A — Brief à donner à l’agent qui reprend le modèle

Joindre la spécification réelle, le GLB candidat et les images retenues. Ce bloc est destiné à un outil 3D ou un agent de production, pas au générateur d’images.

```text
Prepare the attached candidate for Atlas Tournament using the attached asset specification as the exact technical contract. Preserve the approved visual design. Do not claim that reference images guarantee technical compliance.

First inspect the geometry without textures: validate the silhouette, part counts, underside, disconnected fragments, filled openings and accidental intersections. Retopologize to preserve primary forms and articulated separations. Spend triangles on silhouette, track/wheel volumes, roof edges and visible leaf groups; use normal maps for shallow seams and small surface detail.

Set units to metres, +Y up and +Z front. Place the origin at the footprint centre at ground level. Apply transforms and verify world-space bounds including protrusions. Create exactly the node names, material names and single LOD0 file specified for this asset. Do not add export helper nodes or a ground plane. Preserve the hierarchy and UV registration between the LOD0 base and national material kits. Reuse the approved base mesh for national kits instead of reconstructing variants from images.

Create one coherent UV layout and PBR metallic-roughness materials. Derive normal maps from the actual modeled or authored surface relief. Remove illumination from base color; do not darken albedo to simulate AO. Separate roughness, metallic behavior and optional emission. Team-mask pixels must be strictly black or white: white only on the designated recolorable surfaces, neutral gray in albedo; black on rubber, glass and bare metal. Provide adequate UV-island padding for the smallest delivered texture and check mip bleeding.

Export external PNG textures with the exact filenames and resolutions in the specification, referenced by the single LOD0 GLB. Keep relative texture URIs valid and ship the referenced files together. Do not embed duplicate images or produce other LOD files. Where glTF requires roughness in G and metallic in B, configure the textures and packing deliberately; do not assume that a standalone red-channel grayscale map is automatically interpreted correctly. Follow the existing loader and validator contract. Avoid adding an undocumented packed texture to the lot.

For units, create the exact required clips, durations and rest pivots from the specification. For rigid parts use node transforms; for infantry follow its own rig contract. Do not animate a cannon that is fused to the hull. Looping clips must match at their endpoints. glTF does not standardize the playback loop flag: configure looping in the runtime or supported metadata as well as making seamless keys. Keep missile trails, impact particles and other gameplay effects outside the unit mesh unless explicitly required. Do not create these effects as permanent geometry.

For terrain_plaine, keep the constant-thickness flat slab specified by the project. The game terrain supplies the broad relief. The same GLB now includes curved grass under mat_herbe, reaching 14 cm total height (6–12 cm grass over a 2 cm slab); the renderer extracts this layer onto its continuous relief; do not replace the continuous terrain with disconnected mounds or bake their shadows into its albedo.

Run the project's asset validator on the LOD0 and complete lot. Report actual triangle counts, measured bounds, nodes, materials, UV channels, image dimensions, external references, clip durations and remaining issues. Technical acceptance and owner visual approval are separate outcomes. Never mark the asset artistically approved merely because these checks pass.
```

Dans le dépôt, contrôle du lot :

```sh
node --import tsx scripts/controler-asset.ts --spec assets/specs/terrain_plaine.json --lot public/assets/modeles
```

Adapter l’identifiant et le dossier du candidat. Ne pas copier automatiquement un résultat dans `public/assets/modeles` avant la réception prévue pour le lot.

## B — Optimiser sans perdre ce qui fonctionne

Garder le même objet, la même référence et les mêmes paramètres disponibles. Faire une version A, puis une B en changeant **une priorité** : masse principale, densité de végétation, contraste de matière ou échelle des détails. Documenter le modèle utilisé et sa version si exposée, le prompt exact, les images d’entrée, la date et les paramètres réels. Une graine ne garantit pas la reproductibilité entre fournisseurs ou versions.

Demander au propriétaire de comparer :

1. Depuis la caméra du jeu à 65°, dans la même lumière et au même zoom : rôle/surface reconnaissable, silhouettes séparées, couleurs harmonieuses.
2. À taille réduite, proche de 48 pixels par mètre : les détails restent une matière, pas du bruit ; les unités et leurs déplacements restent lisibles.
3. Pour les terrains, sur plusieurs cases adjacentes avec rotations 0/90/180/270° : aucun bord, quadrillage ou motif reconnaissable répété.
4. Sous deux orientations de lumière : le relief suit l’éclairage ; aucune ombre fixe ne contredit la lumière.
5. Pour les unités/bâtiments, après recoloration dans deux camps très différents : roues, verre et métal restent neutres, les zones d’équipe se lisent d’en haut.

Les tests visuels ne sont pas exécutés automatiquement par ces prompts. Mesurer séparément triangles, appels de dessin, textures chargées, poids et temps de rendu sur les appareils cibles. Une limite de triangles ne remplace pas une mesure de performance.

## C — Prompt d’amélioration ciblée

```text
Improve the attached candidate while preserving its approved identity and all existing correct features.
Observed failure at actual game scale: {{OBSERVATION_CONCRETE}}.
Make only this change: {{CHANGEMENT_UNIQUE}}.
Keep unchanged: {{ELEMENTS_A_PRESERVER}}.
Use the attached original approved reference as the authority for proportions and palette. Do not add decorative detail as a substitute for the requested correction. Preserve the output type: {{ALBEDO_OU_REFERENCE_3D}}. Return one revised image only.
```

Exemples d’observations utiles : « le vert devient jaune en jeu », « les brins disparaissent en vue éloignée », « les deux tubes se confondent vus du dessus », « la ville et le QG ont le même toit ». « Fais plus beau / plus détaillé / qualité AAA » seul ne permet pas une itération contrôlée.

Pour la plaine actuelle, première comparaison proposée : conserver la palette de l’herbe de base appréciée par le propriétaire, puis changer uniquement l’organisation et la densité des groupes de brins. Ne pas augmenter simultanément résolution, saturation, contraste et relief : il deviendrait impossible de savoir quelle modification aide.
