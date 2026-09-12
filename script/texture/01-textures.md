# Textures : matière lisible, couleur propre

## A — Albedo générique

Usage : Gemini en génération d’image. Remplacer les cinq champs. `TAILLE_PHYSIQUE` désigne la surface couverte par l’image, pas un objet à mettre dans une scène. Produire un seul canal à la fois. Les dimensions demandées sont à vérifier après export.

```text
Create ONE production diffuse base-color texture for a stylised-realistic top-down tactics game.

MATERIAL: {{MATIERE}}
PHYSICAL COVERAGE: {{TAILLE_PHYSIQUE}}
PALETTE: {{PALETTE}}
SURFACE STRUCTURE: {{STRUCTURE}}
DELIVERY SIZE: {{RESOLUTION}} pixels, square PNG.

Show only the material, straight overhead, edge to edge. This is an unlit albedo map, not a photograph, not a shaded render, and not a picture of a tile. Use credible pigment variation and clearly organized material features. Prioritize a calm overall color, readable medium-size structure, then restrained fine detail. Keep tiny grain subordinate; do not fill the surface with uniform high-frequency noise.

The texture will repeat over a large map. Distribute small irregular features evenly without a central focal point, isolated signature stain, border, corner decoration, obvious diagonal, or large recurring motif. Opposite edges should continue seamlessly. Keep all four boundary regions statistically similar so rotated neighboring tiles do not create visible bands. Do not paint a uniform frame to hide seams.

Base color only: no directional lighting, shadows, ambient occlusion, highlights, reflections, depth-of-field, vignette, perspective, rim light, or bevel shading. Dark pigments are allowed; black crevice shadows are not. No text, watermark, grid, symbols, people, objects placed on the surface, or national colors.

Return only the texture image. Do not arrange different channels or material samples in a collage.
```

Une apparence raccordable n’est pas une preuve de raccord exact. Pour la plaine, les quatre bords et leurs inversions doivent être compatibles avec les quarts de tour. Une retouche des bords suivie d’un contrôle numérique reste nécessaire, y compris pour les vecteurs de normales.

## B — Plaine : prompt complet à essayer en premier

```text
Create ONE square diffuse ALBEDO texture for a one-metre patch of short, maintained grass in a premium miniature tactics game. Target output: 1024 by 1024 pixels.

The surface should feel lush, fresh and tactile without looking like a close-up lawn photograph. Use a balanced medium leaf-green foundation, small olive-green variations and a few muted straw-green blades. Avoid a yellow-green wash, neon green, almost-black gaps, and isolated bright flecks.

Build the visual structure at three scales: a calm continuous green carpet; softly interlocking irregular groups of short blades roughly 3 to 8 centimetres across; then sparse individual blade and clover details. These groups are differences in blade direction and pigment, not raised mounds or shadows. Mix their directions so they do not read as stripes, radial rosettes, repeated stars or a checkerboard. Leave no large uniquely recognizable cluster.

Include scattered tiny three-leaf clover groups, very occasional small dandelion flower heads, and a few broken earth flecks. Keep all of these subordinate to the grass. Bare earth occupies less than roughly three percent of the image; flowers must not become repeated yellow landmarks. The faint mowing variation must stay softer than the blade groups.

Render only the flat material surface in a true overhead view, covering the full canvas, without a tile rim, side wall, slab, horizon or surrounding scene. The image is a BASE-COLOR map: retain only pigmentation. No shading beneath leaves, no baked ambient occlusion, no sunlight, specular highlights, cast shadows, bevels or photographed lighting. Do not simulate depth by making the spaces between blades black.

Make the image seamlessly repeatable. Keep density and color consistent across all four boundary regions and avoid visible seams after rotating neighboring tiles by 90 degrees. Do not solve this with a blurred or flat-color border. No text, grid, watermark, border or objects.

The result must remain pleasant when reduced to a small game tile: broad color harmony first, gentle organic structure second, fine grain last. Output only this single albedo image, not a beauty render and not a texture-map contact sheet.
```

## C — Intention de rendu, à ne jamais utiliser comme albedo

Joindre une capture de l’herbe de base que **le propriétaire** préfère, si disponible. Ce prompt explore l’effet visuel avant la production ; il ne prouve pas que le moteur obtiendra ce résultat.

```text
Create one visual target for an in-game grass surface in a miniature tactics game. If a game reference image is attached, preserve its overall palette, camera scale and art direction; improve only the grass.

Show a small continuous patch of terrain from 65 degrees above the horizontal. The grass is short and maintained: dense low turf with small irregular groups of bent blades, sparse clover leaves and occasional tiny earth scuffs. Build a readable transition between the flat carpet and a restrained layer of actual short three-dimensional blades. Use heights around 2 to 5 centimetres, not tall meadow grass. Keep the central standing area suitable for a game unit. The terrain is continuous, without visible square rims or isolated diorama pedestals.

Use soft neutral daylight and plausible material response. The image should suggest soft organic volume, not a shiny plastic carpet or a collection of spikes. Stronger form belongs to blade groups, while fine details remain quiet. Avoid huge flowers, dark holes, fuzzy fur, uniform needles and excessive contrast. No tilt-shift blur, cinematic haze, dramatic sunset, bloom or oversized decorative props. No characters, vehicles, labels or UI.

This is a shaded art-direction reference only, not a base-color texture. Return one image.
```

## D — Cartes PBR cohérentes

Ne pas demander à Gemini d’inventer séparément une normale, une rugosité et une occlusion depuis des descriptions indépendantes : les feuilles et joints changeraient de place. Une fausse normale violette peut sembler correcte sans décrire le relief.

Pour la livraison : produire ou sculpter un relief commun, en dériver les normales tangentes, et définir les propriétés de matière dans les mêmes UV. Albedo en sRGB ; normale/rugosité/métal/occlusion/masque en données linéaires. Vérifier le sens du canal vert des normales dans le chargeur glTF. L’herbe est non métallique ; ne pas utiliser la carte de métal pour assombrir les creux. L’AO reste séparée de l’albedo. Détails dans 05.
