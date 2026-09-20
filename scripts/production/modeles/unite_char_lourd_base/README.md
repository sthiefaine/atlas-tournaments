# Char lourd — création originale reproductible

`unite_char_lourd_base`, produit le 20 septembre 2026 en Three.js/TypeScript et Python NumPy/Pillow. Aucun modèle ni texture étrangers, aucun service externe ou opération Blender. Le coordinateur a revérifié le stockage : aucun upload source. L’ancien candidat de 996 triangles et 123 176 octets, SHA-256 `a0750ff6917d4e0f9b8e39163b14af0a74e9d35f64760f203de6f053d722a496`, a été inspecté par code et reste intact ; sa géométrie n’a pas été importée.

Le dessin propre au char lourd associe une caisse multicouche avec glacis en V, dix jupes profondes, sept galets par côté plus les roues extrêmes, une grande tourelle à coffre, une coupole à six épiscopes et deux câbles lovés. Les helpers de géométrie, fusion, UV et PBR du char moyen ont été copiés localement ; aucune mise à l’échelle de son maillage. Le tube chemisé possède une bouche creuse réelle. Le modèle est neutre, entretenu et sans insigne, texte, drapeau ou dommage.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_char_lourd_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_char_lourd_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_char_lourd_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_char_lourd_base.json --lot tmp/production-sequentielle/unite_char_lourd_base
npm run typecheck
```

Les trois scripts acceptent un dossier de sortie facultatif. Ils produisent un seul LOD0, cinq PNG externes et les mesures reproductibles. Aucun test général ni capture.

## Livraison mesurée

8 848 triangles sur 9 000, sept primitives fusionnées, deux matériaux (`mat_corps`, `mat_details`) et six nœuds. Dimensions de référence : 0,709 × 0,583 × 0,952861 m ; origine centrée au sol, haut +Y et avant +Z. GLB : 679,976 octets ; total GLB et cinq PNG : 1,849,551 octets, hors rapports. SHA-256 GLB : `562e931e5a450875dd8d4b898de16fcc8577c3439bdb99bcab38cfe8c053376e`.

UV0 en atlas 4×4 avec îlots répétés par matière et gouttières de 16 px. Normales de sommet et tangentes explicites, sans triangle géométrique ou UV dégénéré. Albédo et normale 1024² ; rugosité, métal éditable et masque 512². Les zones d’équipe sont les jupes et les flancs de tourelle : blanc strict dans le masque, gris neutre dans l’albédo. Rugosité en G et métal en B ; le PNG métal séparé correspond exactement au canal B. Pigments et microreliefs analytiques déterministes, sans lumière peinte ni transfert HD vers low-poly.

Cinq clips rigides : repos 2 400 ms, déplacement 1 000 ms, tir 700 ms, touché 500 ms, hors-jeu 900 ms. Les boucles se ferment, la racine reste fixe et la pose hors-jeu est tenue avec le témoin escamoté. La pose active et le tir regardent +Z ; le déplacement place la tourelle vers l’arrière sur le plateau et son verrou. Le recul du tube suit correctement son axe au tir.

`mesures-mouvements.json` conserve les bornes des clés et de 21 instants uniformes par clip, via interpolation du mélangeur Three.js, puis 41 orientations de tourelle entre 0 et π en slerp. Toutes les enveloppes mesurées restent dans x/z ±0,5 m et au-dessus du sol. La longueur maximale parmi les clips mesurés est 0,958702 m. Le balayage de tourelle reste entre x −0,354500 et +0,482365 m, z −0,485934 et +0,478795 m.

## Contrôles et limites

Contrôle complet du lot `ok`, zéro motif, sur le GLB ci-dessus ; `npm run typecheck` réussi après la dernière modification TypeScript. Les mesures binaires confirment UV, tangentes, masque, canaux, nœuds, durées et poses. `revue-technique.json` détaille la provenance, les empreintes et les contrôles.

Aucune suite de tests, build, capture, inspection visuelle ou mesure réelle sur téléphone. `approbationArtistique: false`. Les chenilles restent rigides ; la suspension bouge sans défilement des patins. Le verrou est fixe, sans clip autonome de mise en batterie : le mélangeur du jeu assure la transition des orientations. L’appréciation artistique et les transitions en jeu restent non vérifiées visuellement. L’atlas répété convient aux matières, pas à un motif propre à chaque panneau.

Le coordinateur archive l’ancien candidat, intègre et pousse ce modèle avant le suivant. Ce travail n’a modifié ni actif, ni lot final, ni spécification, ni plan de production et n’a créé aucun commit.
