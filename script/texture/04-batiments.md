# Bâtiments — fonction, toit et capture lisibles

## A — Concept générique pour Gemini

Le toit est la façade principale depuis la caméra du jeu. Le pays guide les matériaux et les proportions ; il ne justifie ni de copier un monument réel ni de multiplier les petits accessoires.

```text
Design ONE original building asset for Atlas Tournament, a stylised-realistic miniature tactics game.

GAMEPLAY FUNCTION: {{FONCTION}}
ARCHITECTURAL CHARACTER: {{STYLE_ARCHITECTURAL}}
OVERALL WIDTH / HEIGHT / DEPTH IN METRES: {{DIMENSIONS}}
FIXED VOLUMES, ROOF AND OPENINGS: {{VOLUMES_FIXES}}
MATERIAL PALETTE: {{MATIERES}}
RUNTIME TEAM-COLOR AREAS: {{ZONES_EQUIPE}}
CLEAR APPROACH FOR A UNIT: {{ACCES}}

Make the gameplay function recognizable from 65 degrees above the horizontal, around 48 pixels per metre. Organize the building into a few strong masses, a distinctive roof shape and a clearly readable entrance. Roofs, awnings and upper trim should communicate ownership without needing readable signs. Keep important functional structures chunky and separated; use medium-scale material detail rather than dozens of tiny pipes or roof ornaments.

Respect the stated total footprint, including roof overhangs, stairs and attached structures. Preserve a usable clear approach on the specified side. No decorative elements outside the footprint. Do not add a giant base platform to frame the building. This is one building asset, not a village, city block or landscaped diorama.

Keep all runtime team-color areas medium neutral gray, including any team roof trim. Use plausible matte wall materials, restrained roof texture and dark simple glass. Glass must not reflect a photographic environment or contain a miniature interior scene. If lit windows are required, define their locations clearly but show no bloom or illumination painted onto the facade; emission will be a separate map.

Show one complete elevated front three-quarter near-orthographic view on a uniform light-gray background with gentle neutral studio illumination. Every roof edge and attachment must be visible within the image bounds. No dramatic shadows, tilt-shift blur, people, vehicles, trees, surrounding pavement, real flags, real monuments, logos, readable text, symbols or watermark. Keep the asset maintained, with restrained material wear and no violent damage.

Return one coherent production concept image suitable for deriving consistent orthographic views.
```

## B — QG Luxembourg : prêt à copier

Proposition visuelle fondée sur `assets/specs/batiment_qg_lu.json`. Les couleurs nationales décrites historiquement dans la fiche sont remplacées par du gris **sur les zones recolorées à la capture**. Ce bâtiment doit pouvoir appartenir à un autre camp sans ambiguïté.

```text
Design one compact headquarters pavilion for a stylised-realistic miniature tactics game, inspired by precise Luxembourg workshop craftsmanship without copying any real building or symbol.

The complete building, including its roof, canopy and plain pennant pole, fits within 0.85 metres width, 0.95 metres height and 0.85 metres depth. Create a coherent two-storey pavilion: a compact lower volume, a recessed upper balcony overlooking the front entrance, one deep clean overhanging pitched roof, and one broad front entrance canopy. The roof should be the strongest identifying shape from above. Place a simple narrow pole with one plain unmarked pennant at the rear-right corner within the total bounds. Reserve a clear front approach; no landscaping or large plinth.

Use warm timber sections, quiet pale wall panels, simple dark glazing and a few broad brushed-steel trim pieces. Keep the palette controlled and the construction precise. Team-color regions are the roof edge, entrance canopy trim and the plain pennant: paint all of them NEUTRAL MEDIUM GRAY in this base reference. Do not paint a blue or red national livery. Windows should read as a few organized dark shapes, not dozens of tiny reflective squares. No glowing facade; future window lighting belongs to a separate emission map.

It should clearly read as headquarters at 65 degrees above the horizontal: taller and more distinctive than an ordinary city building, with an unmistakable roof and entrance, while preserving a clear place for a game unit to approach. No clutter that hides the building's function. Avoid excessive realism in tiny brick joints, oversized hinges, intricate railing filigree and random rooftop machines.

Show exactly one complete building in an elevated front three-quarter near-orthographic view. Uniform light-gray background, soft neutral studio light, crisp silhouette, generous image margins. No terrain tile, street scene, characters, vehicles, neighboring buildings, detached pieces, real flags, real symbols, signage, readable text, logos or watermark. Return one image only.
```

## C — Verrouillage avant les vues multiples

Fixer le type de toit, sa pente, le nombre d’étages, les ouvertures par façade, l’accès et l’emplacement du mât. Les panneaux vitrés ne doivent pas devenir des portes au dos. Le dessous est une fondation fermée simple, sans sous-sol visible. Ne pas demander de coupe intérieure : elle pourrait devenir une géométrie ouverte.

Les bâtiments peuvent varier en architecture par région lorsque la fiche le prévoit. Réutiliser des pièces et atlas de matériaux lorsque possible. Les variations d’ambiance, neige, humidité ou appartenance ne doivent pas imposer une reconstruction 3D complète.

## D — Bâtiment désaffecté

Seulement si demandé par la fiche : fermetures, matériaux ternis, équipements arrêtés, accès identifiable. Conserver les volumes structuraux et éviter de transformer le modèle en amas de gravats. Ne pas changer un bâtiment normal en version désaffectée entre ses vues.
