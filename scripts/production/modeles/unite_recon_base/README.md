# Reconnaissance — création originale

`unite_recon_base`, 20 septembre 2026. Petite voiture à six roues, caisse en capsule aux épaules arrondies, cabine vitrée basse, parabole horizontale tournante sur le plateau arrière, roue de secours sur le flanc gauche. Bras de suspension apparents, capot et portes gris pour la couleur d'équipe, pneus légèrement poussiéreux, petit marqueur court sur le capot. Aucun texte, insigne, drapeau, nationalité ou dommage. La conception conserve une silhouette de voiture légère, sans chenilles ni grosse tourelle.

## Provenance et périmètre

Création paramétrique originale Three.js, NumPy et Pillow. Aucun maître HD ou modèle externe importé, aucune décimation, aucun bake HD. Les helpers GLB, formes élémentaires et contrôles reprennent les techniques des modèles précédents ; le véhicule et son assemblage sont originaux. Normales analytiques de peinture, caoutchouc, brossage, joints et fixations. Les pigments ne calculent ni lumière, reflet, ombre, ni occlusion.

Le coordinateur a communiqué une lecture authentifiée réussie le **20 septembre 2026 à 14:42:34.126 UTC** : aucun upload pour la base, `kit_fr_recon` et `kit_lu_recon`, aucun maître local connu. Ancien candidat et actif : **692 triangles**, **83 572 octets**, SHA-256 `0800c043edf22b57db7bd120e3274b0668e813e59678cffbeb1f4e794c8ad0df`. GLB et **douze PNG** inspectés par code avant création, inchangés et non réutilisés. Revalidation distante et retrait des anciens kits incompatibles à la charge du coordinateur ; aucun secret enregistré.

Le spécialiste écrit uniquement dans `scripts/production/modeles/unite_recon_base/` et `tmp/production-sequentielle/unite_recon_base/`. Aucun fichier partagé, lot officiel, actif, alias, registre, plan ou opération Git. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.

## Reproduction

Depuis la racine du dépôt. Les scripts acceptent un staging facultatif. Après remplacement, `inspecter-ancien.py [archive] [staging]` doit recevoir l'archive historique : sa garde SHA refuse le nouveau candidat.

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/unite_recon_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/mesurer.py
node --import tsx scripts/production/modeles/unite_recon_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/mesurer-poses.py
node --import tsx scripts/production/modeles/unite_recon_base/mesurer-natif.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/verifier.py
cp scripts/production/modeles/unite_recon_base/README.md tmp/production-sequentielle/unite_recon_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_recon_base/assembler-revue.py
```

`verifier.py` exécute seulement le contrôle de ce lot et `npm run typecheck`, puis conserve les sorties et les empreintes des sources TypeScript. Aucun test général ou build.

## Lot final mesuré

**3 468 / 3 500 triangles**, **douze primitives**, deux matériaux `mat_corps` et `mat_details`, douze nœuds dont les cinq requis, six pivots `os_roue_*` et `os_marqueur`. Dimensions **0,490 × 0,4015 × 0,700 m**, origine centrée au sol, avant +Z et haut +Y. GLB **205 424 octets**, lot GLB et cinq PNG **1 375 315 octets**. SHA-256 GLB : `73b4eba1837c11d12dd09a5b5604d05e00a11de2ddb5011d8e929da2d94eb373`.

Albedo et normale 1024² ; rugosité, métal et masque 512². Atlas de matières 4 × 4 avec gouttières, PNG externes sans copie embarquée. Masque strict 0/255, zones d'équipe strictement grises ; caoutchouc, vitrages, métaux et parabole hors masque. Rugosité en G et métal en B identique au PNG métal éditable. Témoin ambré sans émission.

Cinq clips : repos 2400 ms, déplacement 1000 ms, tir 700 ms, touche 500 ms, hors jeu 900 ms. Radar à rotation complète au repos et en déplacement. Les six roues tournent autour de leurs centres ; le corps oscille de ±3 mm, indépendamment du train roulant. Recul du marqueur de 7 mm puis récupération, légère réaction au contact. Hors jeu parque le radar, tasse la caisse de 8 mm, cache le témoin et tient la pose finale. Aucune piste sur la racine. Boucles raccordées en pose et vitesse ; temps FLOAT SCALAR croissants et bornes min/max conservées.

Normales, tangentes et UV0 finis et normalisés ; aucun triangle géométrique ou UV dégénéré, normale opposée au winding, ou triangle superposé dans une même primitive. **975 poses** concordantes à 2 µm entre NumPy, Three.js et GLTFLoader natif avec `SkeletonUtils.clone`. Nœuds de clones indépendants et pivot radar stable. Pour Node, le chargement natif retire seulement les références de textures en mémoire ; géométrie et clips inchangés, PNG contrôlés séparément.

Les trois gabarits sont mesurés après `RY(π/2)` puis `S` : **a** `(0,9 ; 0,98 ; 1,06)`, **b** `(1 ; 1 ; 1)`, **c** `(1,14 ; 1,06 ; 0,95)`. Rayons horizontaux majorés continûment : **a 0,400906 m**, **b 0,418394 m**, **c 0,451408 m** ; espace minimal de deux voisins à tous caps : **198,188 / 163,212 / 97,184 mm**. La majoration utilise les vitesses LINEAR/slerp et le demi-pas multiplié par la norme maximale de l'échelle ; le témoin rétractable a une borne sphérique séparée. Sol vérifié aux poses, clips isolés.

## Contrôles mécaniques localisés

Treize distances de triangles : pneus voisins, pneus/capsule, secours/roue centrale, secours/garde-boue et radar/cabine. Onze raccords intentionnels entre pièces : bras/récepteur, axe/support/parabole, support/plateau, console de secours, toit/verrière et marqueur. Sept raccords pneu/jante contrôlés par enveloppe polygonale : la jante dépasse les talons de **0,740 mm** sur les roues et **0,460 mm** sur la roue de secours, avec recouvrement radial minimal de **2,554 / 1,801 mm**.

Sur les 975 poses, jeu pneus/gardes-boue minimum **6,348 mm**, secours/roue centrale séparés verticalement d'au moins **32,000 mm**, radar/cabine séparés longitudinalement d'au moins **51,279 mm**, ensemble radar mobile hors axe/plateau séparé verticalement de **82,500 mm**. Treize sondes de la bouche du marqueur entrent dans une chambre réellement creuse d'au moins 49 mm ; leur direction +Z reste libre sur 650 mm.

Corrections avant gel : jantes prolongées axialement et élargies pour couvrir les talons malgré leurs polygones différents ; winding des garde-boue orienté vers l'extérieur. Contrôle de lot et typage réussis après les dernières modifications TypeScript.

## Limites

`approbationArtistique: false`. Aucun rendu, image, capture, contrôle visuel, appréciation à 65° ou 48 px/m, test général, build, téléphone ou FPS. Les distances sont locales, les sondes ponctuelles : aucune certification globale des collisions. Jeux mécaniques et sol vérifiés aux poses ; rayon extérieur majoré continûment. Transitions et mélanges de clips exclus. Vitrages opaques sans intérieur ; atlas de matières répété, suspension simplifiée avec bras rigides sur le train roulant ; la perception de matière, les effets de bouche du moteur et la lisibilité restent à apprécier humainement.
