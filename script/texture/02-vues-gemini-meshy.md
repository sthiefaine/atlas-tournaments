# Vues cohérentes pour Gemini → Meshy

## Préparer le design

Commencer par le concept de l’unité ou du bâtiment. Retenir une seule référence. Noter les éléments fixes : nombre de roues, longueur du tube, pièces asymétriques, nombre d’étages, forme du toit, ouvertures, position des zones d’équipe. Joindre cette référence à **chaque** génération suivante ; joindre aussi les vues déjà acceptées. Éviter une chaîne où chaque image ne dépend que de la dernière : elle accumule les changements.

## A — Planche de six vues

La planche répond au besoin face/profil/back/bottom/top. Deux profils sont inclus pour éviter de fabriquer un côté par simple miroir. Elle sert de contrôle et de source à découper ; pas d’import comme image unique dans Meshy.

```text
Using the attached approved asset as the design authority, create ONE orthographic six-view turnaround sheet of EXACTLY THE SAME OBJECT. This is a reconstruction reference, not six alternative designs.

ASSET: {{DESCRIPTION_COURTE}}
LOCKED FEATURES: {{CARACTERISTIQUES_FIXES}}
WORLD PROPORTIONS, width X / height Y / length Z: {{DIMENSIONS}}

Layout: six equal square panels in a three-column, two-row grid, separated by narrow empty gutters. Reading left to right:
TOP ROW: FRONT, LEFT SIDE, BACK.
BOTTOM ROW: RIGHT SIDE, TOP, BOTTOM.
Do not print these names or any other labels inside the image.

Coordinate convention: +Y is up, +Z is the object's front, +X is its right side. Front is seen from +Z; back from -Z; left side from -X; right side from +X. In both side panels the top of the object stays at the top of the image; in the left-side panel the front points right, and in the right-side panel the front points left. Top is seen from +Y looking down, with the front at the top of its panel. Bottom is seen from -Y looking up, also with the front at the top; it is a true underside view, not a mirrored top.

Use true orthographic projection for every panel. No vanishing points, lens distortion, isometric view, cutaway, transparency, exploded assembly or internal parts visible through solid surfaces. Keep exactly the same physical scale per pixel in all six panels. Shorter projections naturally occupy less of a panel; do not stretch or enlarge them independently. Use the same projected object-center placement and at least 10 percent empty margin around the largest projection. Include every protruding part.

Keep geometry, number and placement of parts, proportions, colors, material boundaries, seams, attachments and articulated pose identical in every view. Do not rotate a turret relative to its hull or open a roof between panels. Preserve actual asymmetry; never mirror one side to invent the other. The underside should be a plausible simple continuation of the approved object, without invented ornamental machinery.

Plain uniform light-neutral gray background. Soft diffuse neutral studio illumination sufficient to show shape, consistent across views. No floor plane, pedestal, cast shadow on the background, strong ambient occlusion, reflections of a room, dramatic lighting or depth-of-field. The object must have a clean silhouette with clear gaps between separate parts. No labels, dimensions, arrows, text, logos or watermark.

Target a 3072 by 2048 pixel sheet if supported. Return only the sheet.
```

## B — Une vue isolée, méthode préférable si la planche dérive

Une génération par vue. Ne pas demander de nouveaux détails. Pour les proportions, une cote textuelle aide à guider l’image mais ne remplace pas une mise à l’échelle dans Blender.

```text
Generate ONE isolated {{VUE}} view of the exact object in the attached approved design and turnaround references. The references define one object; do not combine them into a new design.

Camera instruction: {{CAMERA}}
Locked identity: {{CARACTERISTIQUES_FIXES}}
Physical width / height / length: {{DIMENSIONS}}

Change only the camera. Preserve the same geometry, articulation pose, asymmetry, part counts, material boundaries and colors. Use orthographic projection, the same pixels-per-metre scale and neutral background as the accepted views. Keep the projected object center at the image center. Include the entire object with generous empty margin. Do not scale a narrow view up just to fill the canvas. No perspective, cutaway, exploded view, floor, stand, labels, shadows on the background or extra objects. Use gentle consistent studio illumination on the object so its volumes are legible.

Output a single square image of this one view, at 1024 by 1024 pixels or higher if available. Do not output a contact sheet. Do not crop protrusions or redesign unseen surfaces decoratively.
```

Valeurs de `CAMERA` :

- `front` : `Camera on +Z looking toward the origin, +Y upward.`
- `left` : `Camera on -X looking toward the origin, +Y upward, front pointing right in the image.`
- `back` : `Camera on -Z looking toward the origin, +Y upward.`
- `right` : `Camera on +X looking toward the origin, +Y upward, front pointing left in the image.`
- `top` : `Camera on +Y looking down, +Z pointing toward the top edge of the image.`
- `bottom` : `Camera on -Y looking up, +Z pointing toward the top edge of the image; show the actual underside.`

Enregistrer sous `<id>_front.png`, `_left.png`, `_back.png`, `_right.png`, `_top.png`, `_bottom.png`. Les noms sont des noms de fichiers, jamais des légendes dessinées.

## C — Corriger une seule incohérence

```text
Correct only this inconsistency in the attached {{VUE}} image: {{DEFAUT_PRECIS}}.
The attached approved master reference is authoritative. Match {{DETAIL_ATTENDU}} exactly. Preserve camera, crop, pixel scale, lighting, background, all other geometry and all material colors. Do not redesign, add details or improve unrelated areas. Return the corrected single view only.
```

## D — Import Meshy

Découper la planche en six images avec la même taille de cadre, sans légende ni gouttière. Conserver l’échelle commune : pas de recadrage automatique qui agrandit chaque silhouette différemment. Préférer les générations individuelles si le découpage donne des vues trop petites.

Utiliser face, gauche, dos, droite dans les champs correspondants du mode multi-vues documenté. Conserver top/bottom pour corriger le toit, le dessus de tourelle ou le dessous dans l’outil 3D. Ne pas mettre un dessus dans un champ nommé « dos ». Si l’outil utilisé accepte d’autres angles, suivre son contrat explicite.

Un détail incohérent est une raison de corriger ou retirer une vue, pas d’en ajouter davantage. Le maillage produit est un candidat à retopologie, pas une livraison automatiquement conforme. Si le mode Image-to-3D n’a pas de champ texte, ne chercher aucun champ caché : le design doit déjà être visible dans les images.
