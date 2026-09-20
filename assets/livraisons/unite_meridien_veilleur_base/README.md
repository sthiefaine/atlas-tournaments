# Veilleur méridien — LOD0 original

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Création originale pour `unite_meridien_veilleur_base`, à partir de la spécification versionnée. Aucun upload ne figurait dans l'inventaire distant authentifié relu par le coordinateur le 20 septembre 2026 à 13:36 UTC. L'ancien candidat de 728 triangles (SHA-256 `c4f7b5e469fe4519e8591201a168518cc1fa04b14909ab9a2927db7ec574fc9b`) et ses douze PNG ont été inspectés numériquement avant fabrication. Aucun de leurs sommets, UV, pixels ou clips n'est importé dans ce lot.

Un seul LOD0 : capsule électronique arrondie et courte, deux rotors diagonaux à quatre pales chacun, large radôme lenticulaire sur bras pliant, deux patins et fouet épais sur ressort. Aucun armement. La diagonale sépare les disques de rotor et conserve une empreinte inférieure à une case, même à un azimut quelconque. La géométrie est paramétrique en mètres, +Y vers le haut et +Z vers l'avant, racine au centre de la case et jamais animée.

Le GLB contient sept primitives et deux matériaux (`mat_corps`, `mat_details`). Les deux os de rotor rigidement pondérés font partie du modèle et sont animés par les quatre clips. Les autres pièces suivent des nœuds rigides. Les matériaux et cellules d'UV sont partagés ; les cinq PNG restent externes et leur URI est exactement le nom du fichier voisin. Albédo/normal 1024² ; rugosité/métal/masque 512². La rugosité lit G et le métal B. Le masque noir/blanc réserve des panneaux strictement gris à la couleur d'équipe. La texture d'albédo calcule les pigments et leur grain, sans éclairage, reflet, occlusion ou ombre peinte. Les petites têtes de fixation et joints viennent de la normale analytique ; aucun bake HD n'est revendiqué.

## Pose et mouvements

- Neutre : 0,82 × 0,622 × 0,82 m, patins à 35 mm au-dessus du sol, hauteur maximale 0,657 m. Le modèle est construit à une très faible altitude de vol comme le prévoit `poseAuSol:false`.
- `repos` : 2,4 s, rotors contrarotatifs et rotation complète du radar, légère sustentation ; boucle exacte.
- `deplacement` : 1 s, rotors, inclinaison modérée, radar légèrement relevé et fouet souple ; boucle exacte, aucun déplacement de racine.
- `touche` : 0,5 s, petite inclinaison puis retour neutre, sans perte de géométrie.
- `hors_jeu` : 0,9 s, arrêt des rotors, descente de 35 mm jusqu'au contact des deux patins, repli du radar à 0,65 rad et disparition du témoin. La pose finale est maintenue ; aucune explosion.

Les pales pénètrent volontairement dans leur moyeu : ce sont des assemblages. Deux petits axes fixes entrent dans les paliers des moyeux ; les cols des moteurs restent 4 mm sous les pales. Le radôme est fermé et son disque est distingué de la capsule par un espace réel. Le ressort possède trois spires espacées, un fil de 8 mm et une âme de 12 mm ; les faces sont contrôlées séparément. Le fouet principal mesure 20 mm de diamètre.

## Reproduction

Depuis la racine du dépôt, avec Node, les dépendances existantes, NumPy et Pillow :

```sh
node --import tsx scripts/production/modeles/unite_meridien_veilleur_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/mesurer.py
node --import tsx scripts/production/modeles/unite_meridien_veilleur_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/mesurer-poses.py
node --import tsx scripts/production/modeles/unite_meridien_veilleur_base/mesurer-rig.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/mesurer-ressort.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/mesurer-degagements.py
npm run controler:asset -- --spec assets/specs/unite_meridien_veilleur_base.json --lot tmp/production-sequentielle/unite_meridien_veilleur_base
npm run typecheck
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_veilleur_base/assembler-revue.py
```

`inspecter-ancien.py` sert uniquement avant le remplacement officiel, ou avec le chemin d'une archive de l'ancien candidat. Son empreinte fixe empêche de confondre le nouveau lot avec l'ancien. `reperes-pieces.json` décrit des plages de triangles de primitives réellement exportées, relues et comptées par les mesures mécaniques ; ce fichier n'est pas chargé en jeu.

## Portée des contrôles

Mesures numériques uniquement, sans image ni rendu. Les 6 258 poses exportées sont recoupées entre Three.js, NumPy et le chargement natif GLTFLoader suivi de SkeletonUtils.clone ; les deux squelettes clonés sont privés. Une majoration continue par vitesse et demi-pas maintient le rayon horizontal sous 0,5 m pour chacun des quatre clips en gabarit `b=[1,1,1]`, effectivement utilisé par `atl`. Les autres gabarits nationaux et les mélanges entre clips ne sont pas certifiés.

Les disques balayés, les obstacles fixes, le radar, le fouet et le ressort font l'objet de contrôles localisés. Cela ne constitue pas un certificat global d'absence d'intersections. Les contacts d'assemblage sont intentionnels. Les jeux mécaniques animés sont échantillonnés, à distinguer de la majoration continue d'encombrement. Aucun test général, build, mesure FPS téléphone ou approbation artistique n'est effectué. Le verdict technique seul ne juge pas la qualité visuelle.

Le coordinateur gère l'archivage, les alias, l'activation directe, le plan et le commit/push. Le spécialiste ne modifie que ses scripts et son staging.
