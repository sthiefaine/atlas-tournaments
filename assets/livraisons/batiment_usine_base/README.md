# Usine commune — livraison technique

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Lot original de **5 572 triangles, six primitives, deux matériaux**, **1 820 188 octets** pour le GLB et les cinq PNG. Dimensions **0,90 × 0,809 × 0,90 m**, pivot au sol, +Y haut, +Z avant. GLB : 453 348 octets, SHA-256 `897ab4bfd4ea9eec439da367bb4d4f88d6a2d89ae875ce9296f63e1c65d33087`.

Halle unique à trois sheds, verrières nord émissives, rideau gris d’équipe fermé, portique latéral à palan, caisses et palette de galets à gauche, râtelier fixé au mur. L’approche frontale est libre à partir de Z=0,230 m. Repos 3,2 s : chariot latéral sur ses galets ; capture 1,4 s : petit indicateur coulissant puis retour. Dalle, murs et toiture fixes ; opt-in `racine.extras.atlasAnimationsBatiment: true`.

`revue-technique.json` réunit provenance, SHA, contrôle du lot et limites. `fabrication.json` compte la géométrie, `textures.json` décrit l’atlas par matière, `mesures.json` consigne 76 raccords et 40 poses. `mesures-natif-glb.json` confirme la parité NumPy/GLTFLoader sans rendu. Garde continue chariot/halle : 45,500 mm ; chariot/butées : 154,500 mm. Onze maillons séparés de 1,357 mm au minimum ; crochet avec bouchons orientés vers l’extérieur et section fermée. Chaîne stylisée sans simulation physique.

Ancien actif/candidat et quinze PNG inspectés par code et conservés ; aucun maître local dédié. Lecture authentifiée distante sans dépôt communiquée par le coordinateur le 20 septembre 2026 à 16:45:12.134 UTC. Sources reproductibles dans `scripts/production/modeles/batiment_usine_base/`.

Contrôle technique et typage consignés. Aucun rendu, capture, contrôle visuel, approbation artistique, test général, build ou FPS. Mesures ciblées uniquement : collisions exhaustives, transitions en jeu et visibilité de toutes les unités non certifiées.
