# Chasseur — création originale reproductible

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

`unite_chasseur_base`, produit le 20 septembre 2026 en Three.js/TypeScript et Python NumPy/Pillow. Aucune source externe, aucun service payant, aucun usage de Blender. Le coordinateur a inventorié les sources distantes sans trouver d’upload de chasseur ; il les revérifie avant l’intégration. Ancien candidat inspecté par code : 820 triangles, 93 972 octets, SHA-256 `b956f6fe3ad21928964039f98738a45889e245ab8ec745253b6361209d58e20b`. Aucune de ses géométries ou textures n’est importée. Voir `inspection-ancien-candidat.json` en staging.

Le dessin original associe un fuselage élancé en capsule, des ailes en flèche à profil elliptique fermé, une verrière en volume avec arceaux, deux admissions creuses à lamelles, une tuyère creuse à pétales, un empennage épais et des trappes fermées sous le ventre. Deux bouches intégrées regardent +Z. La voilure et la dérive portent les zones grises d’équipe. Aucun texte, insigne, drapeau, pylône rapporté ni dommage. Le contrat français et `poseAuSol: false` font foi : c’est un avion en vol malgré la formule anglaise générique « ground vehicle ».

Les helpers de géométrie/PBR ont été copiés localement depuis l’hélicoptère, sans importer ses données de maillages. `gltf.ts` conserve l’utilitaire local d’export Three.js issu de `scripts/infanterie/gltf.ts`. Les sections de fuselage, profils de voilure et tous les assemblages sont propres au chasseur.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_chasseur_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_chasseur_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_chasseur_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_chasseur_base.json --lot tmp/production-sequentielle/unite_chasseur_base
npm run typecheck
```

Les trois scripts acceptent un dossier de sortie facultatif. `inspecter-ancien.py` sert seulement à l’inspection préalable de l’ancien candidat et vérifie son empreinte ; il ne se relance pas contre le modèle remplacé.

## Livraison et contrôles

Un LOD0 à **8 944 triangles / 9 000**, trois primitives fusionnées, un matériau `mat_corps`. Dimensions **0,920 × 0,4185 × 0,834 m**, dans les tolérances. Racine identité au sol, haut +Y, avant +Z ; le volume au repos va de 0,3265 à 0,745 m en hauteur. GLB : **410 444 octets** ; GLB et cinq PNG : **1 579 660 octets** hors rapports. SHA-256 GLB : `ac3f52dc8af4bae34104bea6334f851c9c7d1ebb0804fc559f3ff346e22851d1`.

Atlas UV0 de matières 4×4, gouttières de 16 px et coordonnées répétées entre pièces de même matière. Albédo/normale 1024² ; rugosité, métal éditable et masque 512². Masque strict 0/255, albédo gris sous le blanc, rugosité G et métal B conformes. Normales et tangentes explicites, zéro triangle géométrique ou UV dégénéré, zéro normale inversée. Pigments et microreliefs analytiques déterministes, sans lumière peinte ni transfert HD vers low-poly. Détails dans `textures-fabrication.json` et `mesures-geometrie.json`.

Nœuds exacts `racine/corps/base/socle` : `corps` porte la cellule complète, `base` les deux culasses à recul axial, `socle` le témoin escamotable. Cinq clips de 2 400/1 000/700/500/900 ms. Repos et déplacement ferment exactement leurs boucles ; aucune piste racine. Tir : recul de 22 mm des culasses selon −Z et retour, bouches vers +Z. Hors-jeu : descente de 14 cm, inclinaison douce, témoin masqué à 0,6 s, pose tenue jusqu’à 0,9 s ; pas de débris.

`mesures-mouvements.json` mesure toutes les clés et 193 instants uniformes par clip. Une majoration par vitesses de translation, rotation sphérique et échelle borne les intervalles entre échantillons. Rayon horizontal mesuré maximal 0,489078 m ; majoration continue maximale **0,490022 m**. Les gestes restent dans la case pour tous les caps, avec au moins **0,019956 m** entre deux voisins identiques, hors mélange entre clips. Le point bas mesuré en hors-jeu reste à 0,176932 m.

Contrôle complet du lot `ok`, zéro motif ; `npm run typecheck` réussi après la dernière modification TypeScript. Reproduction de l’export à SHA identique. `revue-technique.json` conserve le résumé et les renvois de mesures.

## Limites

`approbationArtistique: false`. Aucune suite de tests, build, capture, inspection visuelle ou mesure sur téléphone. Les gouvernes restent fixes et l’inclinaison porte la cellule entière. Verrière opaque teintée sans intérieur. L’atlas répété n’offre pas un motif unique par panneau. Le mélange des clips et le rendu en jeu n’ont pas été examinés visuellement. Aucun gain FPS revendiqué.

Le coordinateur archive l’ancien candidat, intègre et pousse avant le modèle suivant. Le spécialiste ne modifie ni spécification, ni plan, ni actif, ni lot final et ne crée aucun commit.
