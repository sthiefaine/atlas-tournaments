# Port commun — création originale

Lot isolé `batiment_port_base`, sources dans ce dossier, staging dans `tmp/production-sequentielle/batiment_port_base/`. Aucun actif, lot officiel, registre ou fichier Git modifié par le spécialiste. Approbation artistique : **false**.

## Provenance et portée

Le coordinateur a communiqué une lecture authentifiée du stockage le **20 septembre 2026 à 16:09:40.005 UTC**, sans dépôt. Aucun maître local identifié aux chemins dédiés de source, de livraison et d’optimisation. L’ancien candidat et l’actif ont été lus avant génération : SHA `d7b9b6463f022fb08576f8a2edd2f805162830e63cf3fecc09385bf64f98b59c`, **900 triangles, 111 648 octets**. Quinze PNG antérieurs inspectés par code avec dimensions et empreintes. Aucun sommet ni pixel ancien réutilisé. Le helper GLTF et les fonctions de mesure viennent de l’aéroport récent et conservent les bornes des temps d’animation.

## Construction

Quai arrière et deux doigts de quai en béton biseauté ; bassin ouvert vers **+Z**, sans eau ajoutée. Ouverture entre quais : **0,490 m**. Le rectangle **X ±0,225 m, Z 0,075 à 0,440 m** ne contient aucune géométrie. Il expose le terrain du jeu : la livraison n’ajoute pas de dalle sous le bassin. Une rampe arrière de 0,420 m de large descend de 40 à 2 mm entre Z −0,080 et +0,070. Cabine vitrée à l’arrière gauche, grue de manutention à droite, treuil arrière, quatre bollards et quatre défenses latérales en caoutchouc. Aucun texte, logo, drapeau, unité décorative ou identité nationale.

La grue comprend une semelle, un pied et un fût fixes, une couronne mobile, une flèche à treillis, un contrepoids, le tambour et ses flasques, la poulie, un câble reliant réellement tambour/poulie/crochet et un crochet à section fermée. Les câbles et tirants structurants ont au moins 20 mm de diamètre. La cabine, ses murs, la toiture, les quais et la rampe restent fixes.

**4 668 triangles / budget 5 000**, **5 primitives**, **2 matériaux** (`mat_corps`, `mat_vitrage`). Dimensions mesurées : **0,902 × 0,714 × 0,880 m**, origine au sol, +Y haut, +Z avant. GLB **353 656 octets**, cinq PNG **1 402 975 octets**, total binaire **1 756 631 octets**. SHA GLB `965f78ef622ac64e40f73fc0526e18ba988dc27e55e3304f0c555ed59cb948f8`.

Atlas UV 4×4 stable avec gouttières de 16 px en 1024². Albédo/normale 1024² ; rugosité/émission/masque 512². Béton, métal, peinture, caoutchouc et verre distincts ; rugosité en G, métal en B, R=255. Les pigments et microreliefs sont analytiques, sans lumière, reflet, ombre ou occlusion cuits. Normale tangentielle +Y. Peinture d’équipe strictement grise, masque 0/255 sur toiture, bande de cabine, fût et flèche ; verre et métal exclus. L’émission n’occupe que les vitrages et les deux lentilles de cabine. Pas de bake HD ni de décimation.

## Animation et mesures

`racine.extras.atlasAnimationsBatiment=true`. `repos` **3,2 s** : la grue pivote autour de Y de **±0,045 rad** ; pose et vitesse se raccordent. `capture` **1,4 s** : l’indicateur de toiture coulisse de 75 mm puis revient à sa pose initiale. Aucun autre clip. Les seuls nœuds animés sont `grue` et `enseigne` ; `racine`, `corps`, `toit` conservent leur matrice.

Le GLB réel est relu : zéro triangle géométrique ou UV dégénéré, normales cohérentes avec le winding (produit scalaire minimal 0,9208), tangentes unitaires, UV bornés et cinq PNG externes. **69 paires de raccords listées** vérifiées avec distance entre triangles ; les intersections d’assemblage sont intentionnelles. Ces mesures ne constituent pas une recherche exhaustive entre toutes les pièces.

**264 poses**, dont clés et grille uniforme, comparées entre NumPy et `GLTFLoader`/`AnimationMixer` natifs sans renderer. Enveloppes et matrices concordent à 2 µm (écart maximal aux matrices clés 2,40×10⁻⁹). Les clones possèdent leurs nœuds animés propres. Séparation X crochet/cabine : **45,500 mm** aux poses ; majorant continu conservateur : **29,948 mm**. Séparation Y flèche/cabine **251 mm**. La grue reste à Z < −0,1579 dans le majorant continu, loin du couloir avant. L’indicateur garde **4,000 mm** entre ses rails et reste posé sur le fond. Les limites du port sont respectées pendant les deux clips.

Corrections effectuées : crochet initial à courbure trop serrée (deux faces inversées) remplacé par un arc torique et une tige raccordée, deux sections du crochet fermées, deux flasques rapprochés du tambour pour supprimer un vide de 2 mm. Les câbles sont reliés à la poulie et au tambour. Les surfaces et limites décrites ont été mesurées après ces corrections.

Contrôle ciblé `controler:asset` et typage global final réussis. Aucun rendu, capture, inspection visuelle, test général, build ni mesure FPS/téléphone. Sous Node, seules les références de cartes sont retirées en mémoire pour charger le GLB ; les fichiers restent inchangés et les PNG/UV sont contrôlés séparément. Les transitions réelles entre clips et l’adéquation de toutes les silhouettes d’unités au bassin restent hors de ces mesures. L’activation technique ne constitue pas une approbation artistique.

## Reproduction

Depuis la racine du dépôt :

```sh
# Inspection historique seulement avant l’intégration.
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_port_base/inspecter-ancien.py
npx tsx scripts/production/modeles/batiment_port_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_port_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_port_base/mesurer.py
npx tsx scripts/production/modeles/batiment_port_base/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/batiment_port_base.json --lot tmp/production-sequentielle/batiment_port_base
npm run typecheck -- --incremental false
```

`generer.ts`, `textures.py` et les mesures acceptent un dossier de sortie en premier argument. Les textures emploient des graines fixes et les UV dépendent uniquement des rôles de matière. `assembler-revue.py --code-typecheck 0` archive les journaux déjà obtenus ; ce script ne remplace pas le contrôle de typage. Les empreintes et commandes sont décrites dans les JSON voisins du lot.
