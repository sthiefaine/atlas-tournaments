# Bombardier — création originale reproductible

`unite_bombardier_base`, produit le 20 septembre 2026 avec Three.js/TypeScript et Python NumPy/Pillow. Aucun upload identifié lors de l’inventaire distant communiqué par le coordinateur ; il revérifie avant intégration. Ancien candidat inspecté par code : 1 208 triangles, 136 488 octets, SHA-256 `63e33e97b3c2493eeed94bd7f4cf55e0015333fed943254a74e614df917d4c84`, douze PNG inspectés. Aucune donnée géométrique ou picturale importée. Helpers de construction, d’atlas et d’export copiés localement ; dessin entièrement original. Aucun service payant ni opération Blender.

Le modèle possède une voilure large presque droite, un fuselage octogonal à joues inclinées, une nacelle vitrée facettée, deux nacelles moteurs avec admissions et échappements creux, des volets épais, deux dérives trapézoïdales et une cassette ventrale de marquage. Aucun texte, insigne, drapeau, personnage, projectile ou dommage. L’appareil regarde +Z, les sorties ventrales regardent −Y. La mention anglaise générique « ground vehicle » est interprétée selon le rôle aérien et `pivot.poseAuSol: false`.

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx scripts/production/modeles/unite_bombardier_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_bombardier_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_bombardier_base/mesurer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_bombardier_base/mesurer-poses.py
npm run controler:asset -- --spec assets/specs/unite_bombardier_base.json --lot tmp/production-sequentielle/unite_bombardier_base
npm run typecheck
```

Les quatre scripts de fabrication et mesure acceptent un dossier de sortie facultatif. `inspecter-ancien.py [dossier-archive]` relit l’ancien candidat sans modification et exige son empreinte exacte.

## Résultat technique

Un LOD0 : **6 188 triangles sur 9 000**, six primitives, deux matériaux `mat_corps` et `mat_details`, cinq nœuds exacts. Dimensions : **0,94 × 0,45 × 0,85 m**, emprise centrée, point bas à Y=0,32 m et racine identité à l’origine du sol. GLB : **383 512 octets** ; GLB et cinq PNG : **1 552 728 octets**. SHA-256 : `e26abe1dc41fbd2b818ba7923e2fa64701a6715563825baadad3f9027f4aa837`.

`corps` porte l’appareil ; `module_nacelle` contient la cabine ; `base` porte la cassette ventrale ; `socle` est le témoin escamotable. Clips de 2 400/1 000/700/500/900 ms, boucles fermées et aucune piste de racine. Tir : recul vertical de la cassette de 25 mm et retour. Hors-jeu : descente de 14 cm, inclinaison douce, cassette rentrée et témoin masqué ; tenue finale entre 0,6 et 0,9 s.

Albédo et normale 1024² ; rugosité, métal et masque 512². PNG externes uniquement, atlas 4×4 à gouttières, UV0/normales/tangentes explicites. Masque strict 0/255, gris strict sous le blanc, rugosité en G et métal en B identique au canal éditable. Pigments et microreliefs analytiques sans lumière peinte ; aucun transfert HD vers low-poly revendiqué.

Relecture indépendante des sommets et de **975 poses du GLB** avec NumPy, concordant avec Three.js à 2 µm. Rayon mesuré maximal 0,480325 m ; majoration continue 0,481606 m, soit 36,79 mm au minimum entre deux voisins sous tout cap pour chaque clip seul. Point bas minimal mesuré : 0,190812 m. Aucune face géométrique/UV dégénérée, normale inversée ou superposition exacte au sein d’une primitive. Un défaut initial de 96 triangles superposés dans les stators a été corrigé en remplaçant les barres diamétrales par des lamelles radiales courtes.

Contrôle de lot `ok`, six fichiers acceptés et zéro motif ; typage réussi après la dernière modification TypeScript. Résumé et liens vers les rapports dans `revue-technique.json` du dossier de sortie.

## Limites

`approbationArtistique: false`. Aucun test général, build, rendu, capture, inspection visuelle, mesure de FPS ou essai téléphone. La lisibilité à 48 px/m reste à apprécier. Vitrages opaques sans intérieur ; atlas de matières répété ; voilure et gouvernes fixes. Les mesures d’enveloppe ne certifient ni les intersections internes ni les mélanges entre clips. Aucun gain FPS annoncé.

Le coordinateur archive l’ancien candidat, intègre et pousse avant le modèle suivant. Le spécialiste ne modifie ni spécification, ni plan, ni actifs, ni lot final et ne crée aucun commit.
