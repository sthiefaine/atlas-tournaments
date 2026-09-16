# Char moyen — source originale reproductible

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Création originale paramétrique pour `unite_char_moyen_base`, en Three.js/TypeScript et Python NumPy/Pillow. Aucun GLB importé. L’inventaire next-upload du coordinateur du 16 septembre 2026 ne trouve aucun dépôt source ; l’ancien candidat de 996 triangles (SHA-256 `7a7e5d4d28835ca702a861810b0e3f41089d3e02d2529137f41cc0c0c1c999bc`) a été inspecté par code et demeure intact.

La silhouette associe une caisse à larges joues inclinées, une tourelle prismatique avec coffre arrière et un long tube sur verrou de route. Six galets par côté restent visibles sous les jupes séparées ; le tube possède une bouche creuse réelle. Aucune forme de char léger uploadé ou d’automate n’est importée. Les helpers mathématiques de l’automate et du transport ont été copiés localement ; le dessin et ses pièces sont spécifiques à ce modèle.

```sh
node --import tsx scripts/production/modeles/unite_char_moyen_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_char_moyen_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_char_moyen_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_char_moyen_base.json --lot tmp/production-sequentielle/unite_char_moyen_base
```

Chaque script accepte un dossier de sortie facultatif. Aucun service externe, dépendance ajoutée ou opération Blender. Les scripts produisent un seul LOD0 et cinq PNG externes, avec rapports de fabrication et de mesure.

5 944 triangles sur 6 000, sept primitives, deux matériaux et six nœuds. Dimensions mesurées : 0,624 × 0,504 × 0,866725 m. GLB 489 976 octets. UV0 en atlas de matière 4 × 4, îlots répétés entre pièces de même matière, gouttières 16 px, tangentes explicites. Albédo et normale 1024² ; rugosité, métal et masque 512². Le masque noir/blanc couvre les panneaux de caisse et de tourelle ; leur albédo reste gris. Les joints, fixations et grains sont dans les normales analytiques, sans éclairage peint ni bake HD.

Cinq clips rigides : repos 2 400 ms, déplacement 1 000 ms, tir 700 ms, touché 500 ms, hors-jeu 900 ms. Racine fixe, boucles fermées, recul axial du tube et pose finale tassée avec témoin escamoté. Les chenilles ne défilent pas et le verrou de route reste fixe ; les clips limitent le pointage.

Le contrôle ciblé du lot est `ok`. Aucune suite de tests, build, capture, inspection visuelle ou mesure sur téléphone. La conformité technique n’est pas une approbation artistique. Le coordinateur archive l’ancien candidat, intègre, commit et pousse ce modèle avant le suivant.

Le détail des fichiers, des empreintes, des pivots et des limites se trouve dans `revue-technique.json`. Poids des six fichiers GLB/PNG : 1659323 octets.
