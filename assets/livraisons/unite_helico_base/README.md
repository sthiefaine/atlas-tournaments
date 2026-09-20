# Hélicoptère — création originale reproductible

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

`unite_helico_base`, produit le 20 septembre 2026 en Three.js/TypeScript et Python NumPy/Pillow. Aucun modèle ni texture externes, aucun service payant et aucune opération Blender. Le coordinateur a revérifié le stockage distant : aucun upload source d’hélicoptère. L’ancien candidat de 796 triangles et 92 428 octets, SHA-256 `29c049ed9ad38800b207b4f3a730f780d13e0ddc98e4afa3b0113549e7513e1d`, et ses PNG ont été inspectés par code. Leur géométrie et leurs textures ne sont pas importées dans cette création.

Le dessin associe une capsule aux épaules arrondies avec deux vitrages, des montants géométriques, des portes aux couleurs d’équipe, un capot de transmission, des admissions à lamelles et deux échappements creux. Le train est formé de patins courbes à nez relevé, de jambes et d’entretoises. Une poutre courte et remontante porte un rotor anticouple entièrement caréné et ouvert, huit pales et une dérive d’équipe. Le rotor principal compte quatre pales légèrement coniques, un moyeu et un plateau cyclique. La nacelle de marquage sous le menton a une bouche réellement creuse. Aucun texte, insigne, drapeau ou dommage.

Les helpers de géométrie, fusion, UV et PBR du char lourd ont été copiés localement ; l’utilitaire GLB local provient de `scripts/infanterie/gltf.ts`. Le dessin et les données des maillages sont propres à l’hélicoptère. Aucun import d’un autre dossier de modèle n’est nécessaire à sa reproduction.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_helico_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_helico_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_helico_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_helico_base.json --lot tmp/production-sequentielle/unite_helico_base
npm run typecheck
```

Les trois scripts acceptent un dossier de sortie facultatif. Ils produisent un seul LOD0, cinq PNG externes et les mesures reproductibles. Aucun test général ni capture.

## Livraison mesurée

5 988 triangles sur 6 000, cinq primitives fusionnées, deux matériaux (`mat_corps`, `mat_details`) et les cinq nœuds du contrat. Dimensions : 0,888 × 0,690627 × 0,888 m, dans les tolérances. Racine identité au sol, haut +Y et avant +Z. Le modèle est à hauteur de vol : point bas à 0,170373 m et sommet à 0,861 m. GLB : 337 840 octets ; total GLB et cinq PNG : 1 506 364 octets, hors rapports. SHA-256 GLB : `ba4147ec3c3de431c58998a3c8fdd2a99a85364c8af6fd425b16b2f4466c2965`.

UV0 en atlas de matières 4×4 avec gouttières de 16 px, répété entre pièces de même matière. Normales de sommet et tangentes explicites, sans triangle géométrique ou UV dégénéré. Albédo et normale 1024² ; rugosité, métal éditable et masque 512². Le masque est strictement noir/blanc, l’albédo sous le blanc est gris neutre. Rugosité en G et métal en B ; le PNG métal séparé correspond exactement au canal B. Pigments et microreliefs analytiques déterministes, aucune lumière peinte ni transfert HD vers low-poly.

## Articulations et encombrement

`corps` porte le fuselage, la queue et les patins. `base`, enfant de `corps`, porte exclusivement le rotor principal, pivot monde `[0, 0.81, 0]`. `module_nacelle` est la nacelle de marquage au menton, et `socle` le témoin escamotable. `racine` reste fixe.

Le chargement GLB dans `src/render3d/unites.ts` met le rotor procédural à `null`. La rotation vient donc uniquement des pistes `base.quaternion`, avec clés tous les 45° et interpolation sphérique : huit tours au repos en 2,4 s, quatre au déplacement en 1 s, deux pendant tir/touché. Les boucles reviennent exactement à leur quaternion initial. Le hors-jeu ralentit le rotor sur deux tours, l’arrête à 0,6 s et tient sa pose jusqu’à 0,9 s ; le corps descend de 11 cm et le témoin disparaît. Le marqueur recule au tir et revient en place, toujours orienté vers +Z.

Les durées exactes sont 2 400/1 000/700/500/900 ms. `mesures-mouvements.json` mesure les sommets transformés aux clés et à 97 instants uniformes par clip, avec le mélangeur Three.js, puis 361 orientations du rotor. Rayon maximal du rotor : 0,444136 m, soit 0,111728 m d’espace entre deux rotors voisins à plat. Les gestes restent dans la case, même après un changement de cap : le rayon horizontal de chaque sommet est inférieur à 0,5 m. Le point bas du hors-jeu reste à 0,052306 m.

## Contrôles et limites

Contrôle complet du lot `ok`, zéro motif ; `npm run typecheck` réussi après la dernière modification TypeScript. Mesures binaires des normales, tangentes, UV, canaux, masques, nœuds, durées, fermetures de boucles, rotations et arrêt final réussies. `revue-technique.json` conserve les empreintes et les chiffres détaillés.

`approbationArtistique: false`. Aucune suite de tests, build, capture, inspection visuelle ou mesure réelle sur téléphone. Les vitrages sont opaques teintés PBR, sans intérieur. Les pales du rotor anticouple sont fixes, les cinq nœuds disponibles étant affectés au rotor principal et aux gestes. Le régime du rotor principal change entre les clips ; leur mélange en jeu n’a pas été examiné visuellement. L’atlas répété convient aux matières, pas à un motif unique par panneau.

Le coordinateur archive l’ancien candidat, intègre et pousse ce modèle avant le suivant. Ce travail n’a modifié ni actif, ni lot final, ni spécification, ni plan de production et n’a créé aucun commit.
