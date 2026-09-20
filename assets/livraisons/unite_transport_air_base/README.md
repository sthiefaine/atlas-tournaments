# Transport aérien — création originale

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

unite_transport_air_base, 20 septembre 2026. Cabine avancée, plateau cargo bas et ouvert, rotor principal à quatre pales, patins cintrés, pylône moteur dorsal et grue repliable à deux articulations. Petit coffre arrimé, crochet de manutention court, témoin masqué hors jeu. Aucun lanceur, clip tir, texte, insigne ou livrée nationale.

## Provenance et reproduction

Lecture distante authentifiée communiquée par le coordinateur le **20 septembre 2026 à 15:32:10.512 UTC** : aucun upload. Aucun maître local trouvé dans les quatre chemins de provenance.json. Ancien candidat inspecté par code, contenu jamais importé : **576 triangles**, **70 316 octets**, SHA 379ea6aefb4b100e339860d638018e4494d140bcee285027d3aef77fd4191659, dix PNG. Les empreintes sont revérifiées avant gel ; revalidation distante avant intégration à la charge du coordinateur.

Géométrie originale Three.js ; helpers d'export, primitives, atlas analytique et mesures repris des modèles précédents. Aucun maître HD, décimation ou bake HD. PNG externes : albédo/normale 1024², rugosité/métal/masque 512². Atlas répété 4 × 4 avec gouttières ; albédo composé de pigments et grain, sans éclairage calculé. Normales de matière analytiques +Y. Masque strictement 0/255, gris neutre sous le blanc, métal en B de rugosité identique au PNG métal.

Scripts sous scripts/production/modeles/unite_transport_air_base/, staging par défaut tmp/production-sequentielle/unite_transport_air_base/. Chacun accepte un chemin de staging facultatif, sauf inspecter-ancien.py : dossier historique puis staging. Après remplacement, lui fournir l'archive historique ; sa garde SHA refuse le nouveau modèle.

    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/inspecter-ancien.py
    node --import tsx scripts/production/modeles/unite_transport_air_base/generer.ts
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/textures.py
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/mesurer.py
    node --import tsx scripts/production/modeles/unite_transport_air_base/mesurer-poses.ts
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/mesurer-poses.py
    node --import tsx scripts/production/modeles/unite_transport_air_base/mesurer-natif.ts
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/mesurer-jeux.py
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/verifier.py
    cp scripts/production/modeles/unite_transport_air_base/README.md tmp/production-sequentielle/unite_transport_air_base/README.md
    tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_air_base/assembler-revue.py

## Livraison et preuves

**4 508 / 6 000 triangles**, **neuf primitives**, deux matériaux, sept nœuds dont les cinq requis. Dimensions **0,834 × 0,644 × 0,834 m**, origine au sol, avant +Z, haut +Y. GLB **263 556 octets**, lot de six fichiers **1 433 466 octets**, SHA GLB 2934c2dcb3742d4c3c9147f74bcc31586825a259c102d549fbea316c7ed6f322.

Quatre clips exacts : repos **2400 ms** (rotor lent, légère oscillation du coude), déplacement **1000 ms** (rotor plus rapide, petit pilonnement, grue contenue), touche **500 ms** (brève inclinaison récupérée avec garde au sol), hors jeu **900 ms** (rotor arrêté, grue rabattue et témoin caché). Racine immobile ; poses et vitesses des boucles raccordées. La dernière pose hors jeu est tenue sur les deux dernières clés. Les temps FLOAT SCALAR gardent min/max cohérents.

**805 poses** concordantes à 2 µm entre NumPy, Three.js et GLTFLoader natif, clones de nœuds indépendants. Les seules références de textures sont retirées en mémoire pour le chargement natif Node ; géométrie et clips restent inchangés. Aucun triangle ou UV dégénéré, normale inversée ou face dupliquée dans une primitive ; normales, tangentes et UV finis.

Après RY(π/2), les rayons horizontaux majorés continûment en gabarits a/b/c sont **0,456814 / 0,431016 / 0,491284 m**, soit au moins **17,432 mm** entre voisins à tous caps dans le cas le plus contraignant. Le rotor est entraîné autour de son vrai axe Y. Les patins au repos et en fin hors jeu sont à Y=0 ; aucune pose échantillonnée ne passe sous le sol.

Contrôles mécaniques : **51 raccords structurels**, cinq distances triangulaires statiques et 16 colonnes cargo libres jusqu'au plancher. Pales/palier : **10,000 mm** ; pales/mât : **4,500 mm**, invariants pour tout angle du rotor. Aux poses, pales/grue ≥ **196,113 mm**, grue/cabine ≥ **147,801 mm**, crochet/bras ≥ **9,722 mm**. Coffre en appui avec recouvrement intentionnel sur le plancher. Le repli du coude a été corrigé après franchissement du seuil interne de 3 mm crochet/bras ; ce seuil est un choix de fabrication, pas une exigence chiffrée de la spec. Les patins ont aussi été relevés du dépassement sous le sol mesuré sur leur courbe réelle.

verifier.py contrôle uniquement ce lot et le typage sans compilation incrémentale ; les SHA TypeScript sont recoupés avant gel. Détails et empreintes dans revue-technique.json.

## Limites et périmètre

approbationArtistique: false. Aucun rendu, capture, inspection à 65°/48 px/m, test général, build, téléphone ni FPS. Clips isolés ; transitions et mélanges exclus. Sol et jeux animés mesurés aux poses, rayon majoré continûment. Les distances locales et sondes ponctuelles ne certifient pas toutes les collisions. Quatre pales rigides, vitrages opaques et atlas répété ; lisibilité à apprécier humainement.

Écritures limitées au dossier de scripts et au staging. Aucun lot officiel, alias, registre, plan, runtime ou Git modifié par le spécialiste. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.
