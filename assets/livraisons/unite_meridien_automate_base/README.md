# Automate de combat méridien — création originale

Modèle LOD0 réalisé et intégré le 16 septembre 2026 à partir de la spécification versionnée, par un script TypeScript / Three.js et des cartes PBR Python. Blender n’a pas été utilisé. Aucun modèle externe ou placeholder n’a été repris. Le coordinateur a vérifié la fiche distante : aucune source GLB uploadée pour cet identifiant à cette date.

## Forme et articulation

Véhicule chenillé compact, caisse à joues inclinées, tourelle basse octogonale, long tube de marquage à bouche creuse et verrou de route, antenne épaisse sur soufflet. Les deux chenilles ont une bande continue, 46 patins et douze galets avec flasques et moyeux. La ventilation et les grands panneaux sont géométriques ; les microreliefs de matière passent par la normale.

Sept nœuds nommés : racine, base, corps, module_tourelle, module_canon_long, module_antenne, socle. `socle` est le témoin de disponibilité, pas un piédestal. L’origine mesurée est au centre de l’emprise et au sol, avant +Z, haut +Y, un mètre par unité. Dimensions : 0,620 × 0,504 × 0,860 m.

Cinq clips rigides : repos 2,4 s, déplacement 1 s, tir 0,7 s, touché 0,5 s, hors-jeu 0,9 s. Recul propre au tube, suspension sur la caisse, faible balayage de tourelle au repos. Hors-jeu parque l’équipement, baisse la caisse et masque le témoin. Pas de mouvement de racine ni de projectile intégré.

## Matières et fichiers

Deux matériaux, `mat_corps` et `mat_details`, huit primitives, soit huit appels de dessin estimés pour la seule passe couleur d’un exemplaire ; les ombres et passes supplémentaires ne sont pas comprises. Atlas UV0 4 × 4 avec gouttières, normales de sommet et tangentes explicites. Le masque noir/blanc désigne les joues, le plastron frontal et la tourelle ; leur albédo est gris strict. Les caoutchoucs, métaux nus, vitrages et grilles restent hors masque.

Cinq PNG voisins : albédo et normale 1024² ; rugosité, métal et masque 512². La rugosité est dans G, le métal dans B, identique au métal éditable séparé. L’albédo contient pigment et grain sans direction lumineuse, reflet ou ombre calculée. Le microrelief normal est analytique, sans bake depuis un maître HD. Aucune texture embarquée, aucun LOD supplémentaire, aucune variante nationale ou saisonnière.

## Contrôle et limites

**5 892 triangles sur 6 000 ; 1 635 455 octets (1,56 Mio) pour les six fichiers de jeu. Verdict technique : ok.** GLB : 489 356 octets ; SHA-256 `67ae06df30f78f935ad53d5e14163d6b38fd08537406a4a5692c205ede0200bc`.

Le contrôle ciblé confirme les dimensions, noms, PNG, masque et animations. La mesure binaire complémentaire relève zéro triangle dégénéré, zéro normale inversée par rapport à la face, données finies, tangentes unitaires orthogonales, extrémités de boucles identiques et absence d’animation de racine.

Le contrôle de typage du dépôt réussit. Aucune suite de tests, capture ou inspection visuelle n’a été effectuée. La réception technique n’est pas une approbation artistique. Les patins ne défilent pas : le déplacement anime la suspension. L’impact visuel à la caméra du jeu, les poses intermédiaires et les performances sur téléphone restent non évalués.

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx scripts/production/modeles/unite_meridien_automate_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_automate_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_automate_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_meridien_automate_base.json --lot tmp/production-sequentielle/unite_meridien_automate_base
```

Le Python nécessite NumPy et Pillow. Chaque script accepte le dossier de sortie en premier argument ; seuls les fichiers du candidat sont écrits. Les sources sont sous `scripts/production/modeles/unite_meridien_automate_base/`. Les rapports `fabrication.json`, `textures-fabrication.json` et `mesures-geometrie.json` documentent la génération, sans porter d’approbation visuelle.
