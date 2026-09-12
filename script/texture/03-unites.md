# Unités — silhouette avant décoration

## A — Concept générique pour Gemini

Remplacer les champs depuis la fiche choisie. Ce prompt produit une référence visuelle, pas le GLB final. Décrire une unité seule ; un groupe d’infanterie se compose ensuite à partir du même personnage.

```text
Design ONE original game unit for Atlas Tournament, a fictional strategic warfare game with stylised-realistic miniature proportions.

UNIT AND TACTICAL ROLE: {{UNITE_ET_ROLE}}
MANDATORY SILHOUETTE FEATURES: {{SILHOUETTE}}
PHYSICAL WIDTH / HEIGHT / LENGTH: {{DIMENSIONS_METRES}}
FIXED PART COUNTS AND ASYMMETRY: {{PIECES_FIXES}}
ARTICULATED PARTS IN THEIR REST POSE: {{PIECES_MOBILES}}
MATERIALS: {{MATIERES}}
TEAM-COLOR SURFACES: {{ZONES_EQUIPE}}

Make the role immediately readable from a game camera 65 degrees above the horizontal, even around 48 pixels per metre. Use a strong primary mass, clearly separated functional secondary masses and restrained surface details. Maintain generous readable gaps around moving parts. Slightly emphasize important equipment and wheel/track thickness within the specified overall proportions. Do not rely on hair-thin antennas, tiny insignia or painted lines to identify the unit.

This is the SHARED BASE design. Team-color surfaces are medium neutral gray; rubber, glass, exposed metal and fabric keep their own plausible neutral material colors. No national livery. Show believable painted panels, dusty matte rubber and technical fabric through broad material differences, with only gentle wear. Avoid multicolored stripes, edge tracing, toy-like plastic gloss, random glowing seams, excessive rivets and camouflage noise.

One complete unit, centered and isolated, with its front facing toward the viewer in a modest elevated front three-quarter view. Use near-orthographic projection, a plain light-neutral gray background and soft studio light that describes volume. Include the full silhouette with margin. No pedestal, terrain, road, painted shadow, dramatic lighting, depth-of-field or effects. No extra unit, crew surrounding a vehicle, detached parts or exploded view. No real insignia, flags, brands, readable text, gore or explicit violence.

Return a single production concept image. Favor a coherent buildable shape over illustration-only detail.
```

## B — Char léger : prêt à copier

Exemple de base partagé, dérivé de `assets/specs/unite_char_leger_base.json`. La silhouette et les cinq galets viennent de la fiche ; la position des petits accessoires ci-dessous fixe une proposition cohérente à conserver entre vues.

```text
Create one original compact LIGHT TRACKED TANK as a production concept for a stylised-realistic miniature tactics game.

Its overall proportions correspond to 0.62 metres wide, 0.50 metres high and 0.85 metres long, including its forward-pointing barrel. It must look agile and compact. Use a low angular hull, broad sloped front cheeks, two clearly readable rubber-padded track runs with exactly five visible road wheels per side, and one compact rounded rotating turret. The turret faces straight forward in its neutral pose. Keep the gun within the stated total length; give it a chunky readable tube and a simple dark muzzle opening, without exaggerated fins or decorative muzzle attachments.

Leave a visible dark separation between turret and hull, and readable gaps between road wheels. Integrate a modest rectangular storage box on the right fender and one short rolled technical-fabric tarpaulin on the left rear fender. Keep these attachments identical in every future view. Do not add a radar, a second turret, a second barrel, crew, flags or thin aerials.

The hull sides and turret cheeks are broad uninterrupted NEUTRAL GRAY painted areas reserved for team color. Tracks are dusty charcoal rubber. Small mechanical surfaces are subdued dark steel; the tarpaulin is muted gray-green fabric. No colored stripes, no red edge lines, no all-over metallic shine. Panel seams are geometry or shallow relief, never bright painted outlines. Good maintenance, light use, no battle damage.

Prioritize the silhouette from 65 degrees above the horizontal at small game scale. It should feel like a carefully made game miniature with credible materials, not a flat cardboard shape and not a photoreal full-size military photograph. Show one elevated front three-quarter near-orthographic view, centered on a plain light-gray background, with gentle neutral studio illumination. Entire asset visible with a clear margin. No ground, plinth, effects, labels, logos, real-world insignia, readable text or watermark. Output one image only.
```

## C — Infanterie : bloc spécifique à mettre dans le générique

```text
One fictional infantry character, full body, alone. Compact figurine proportions with readable headgear, torso, boots and held equipment. Use a neutral rig-friendly stance: legs slightly separated, elbows clear of the torso, hands and equipment visibly separate from the chest. No crossed limbs, running pose, crouch, floating equipment or duplicated fingers. Keep the face fictional and simple, with no resemblance to a real person. Broad neutral-gray uniform panels are reserved for team color; boots, gloves and equipment remain distinct matte materials. No base disk, squad mates or scenery. Preserve a readable silhouette from above without enlarging the weapon beyond the asset footprint.
```

Lire les dimensions et le rig propres à l’infanterie. Ne pas lui appliquer les animations rigides ou les nœuds d’un char. Si l’image représente une escouade, Meshy risque de fusionner les personnages : générer un personnage puis composer les instances dans le jeu.

## D — Variante nationale : géométrie verrouillée

Une image similaire ne suffit pas à assurer le même maillage. Le kit doit être peint sur les UV du modèle de base approuvé ; ne pas relancer la reconstruction 3D pour chaque nation. Pour une recherche de palette seulement :

```text
Using the attached approved base unit, propose only a material-color treatment. Keep the silhouette, camera, pose, geometry, panel positions and every attachment unchanged. Apply {{PALETTE_STYLE}} only to the permitted decorative material zones. Keep all gameplay team-mask zones neutral gray for runtime recoloring. Preserve dark rubber, glass and bare metal. No new meshes, flags, real symbols, readable text, bright edge stripes or decorative lines covering every panel. This image is a paint reference for the existing UV layout, not a new 3D model.
```

Les zones d’équipe restent grises dans l’albedo de livraison, même si une prévisualisation en jeu les colore. Ne pas peindre les chenilles en bleu pour faire comprendre le camp.

## E — Si Meshy propose une génération texte-vers-3D

Réutiliser la description de l’unité seule et les caractéristiques fixes de A/B, sans les consignes de caméra ou de fond. Demander une unité complète avec ses pièces mobiles séparables ; considérer cette séparation comme un objectif à reprendre manuellement. Ne pas transformer un prompt d’illustration en promesse de topologie, de nœuds ou d’animations exacts. Le contrat d’export est dans 05.
