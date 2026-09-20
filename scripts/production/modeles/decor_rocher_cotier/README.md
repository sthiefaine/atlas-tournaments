# Rocher côtier — source originale

Création paramétrique autorisée après lecture distante authentifiée du coordinateur le 20 septembre 2026 à 17:28:24.848 UTC : aucun dépôt. Aucun maître côtier identifié dans les sources du projet ni les noms des fichiers 3D des téléchargements ; les sources de rocher plaine sont une autre commande. L’ancien candidat est préservé : SHA `1f877d6b7ae0a9493c414a9c7605ed3bd3572c22ff9e5fb61adc0aedf6de8374`, 240 triangles, 26 860 octets. Ses neuf PNG ont été inspectés numériquement. Aucun ancien actif. Ni sa géométrie ni ses textures ne sont réutilisées.

Ce granit est distinct du calcaire archipel : treize nouveaux plans composent une masse asymétrique, avec sommet incliné, épaulement latéral et pans de fracture conservés. Le retrait constant de 9 mm et le bombement de 1,4 mm donnent des chanfreins géométriques à 33 arêtes et 22 coins, avec normales raccordées. Onze balanes hexagonales courtes forment la ceinture basse : elles ont un bord épais, une coupe creuse à fond fermé et une base implantée de 1,5 mm dans huit pans. Il n’y a ni sphère bruitée, trou ouvert dans la coque, face flottante ni aiguille. Les fonctions d’export, de lecture et de contrôle reprennent le pipeline compact archipel ; la géométrie et la matière sont nouvelles.

Un seul LOD0 : **858 triangles**, dont **330 pour le bloc** et **528 pour les onze balanes**. Une primitive et un matériau `mat_roche`, nœuds `racine` / `bloc`, aucun clip. Dimensions **0,457895 × 0,301099 × 0,453320 m** ; enveloppe centrée sur XZ, pied à Y=0. GLB **130 392 octets**, GLB et trois PNG **918 235 octets**. Les PNG sont externes, sans images embarquées.

Atlas de quatorze îlots dans une grille 4 × 4 ; marge de 8 texels à 512 px. Les chanfreins utilisent l’îlot du pan adjacent ; les coins utilisent un pan dont la projection n’est pas dégénérée. Un îlot commun couvre les onze balanes, y compris leurs dessous et fonds. Albédo 1024² : grains de quartz, feldspath légèrement rosé et mica anthracite, patine marine basse, dépôts de sel et sommet sec clair. La variation de hauteur représente le pigment de surface, aucune lumière ni ombre. Normale 512² : grain minéral et stries calcaires en espace tangent +Y, sans bake HD. Rugosité 512² en G : flancs polis et fractures plus mates ; B=0 métal, R=255 inutilisé. Les gouttières prolongent les pigments et dilatent les normales. Aucune variante saisonnière dédiée : cartes communes.

Reproduction depuis la racine, avant remplacement du candidat :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_cotier/inspecter-ancien.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_cotier/generer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_cotier/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_cotier/mesurer.py
node --import tsx scripts/production/modeles/decor_rocher_cotier/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/decor_rocher_cotier.json --lot tmp/production-sequentielle/decor_rocher_cotier > tmp/production-sequentielle/decor_rocher_cotier/validation-lot.log
npm run typecheck -- --incremental false > tmp/production-sequentielle/decor_rocher_cotier/typecheck.log
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_cotier/assembler-revue.py --code-typecheck 0
```

Le code de sortie final doit être réellement constaté. Les contrôles relisent le GLB exporté : douze volumes fermés, deux faces par arête avec sens opposé, volumes signés positifs, normales sortantes et tangentes orthogonales. Les parois intérieures des balanes regardent l’intérieur de leurs coupes ; leurs fonds et dessous ont des normales opposées. Toute base se situe à au moins **19,459 mm** d’un bord du pan de support. Les 55 paires de balanes sont séparées par leurs sphères englobantes, avec une garde minimale de **38,423 mm**. Les treize grands pans restent plans ; les UV des coins et chanfreins ne sont pas dégénérées et respectent les marges.

Cinq rayons verticaux par quart de tour mesurent quatre profils distincts : pour chaque paire, au moins une sonde diffère d’au moins **37,949 mm**. Cela ne certifie pas leur lisibilité artistique. GLTFLoader natif retrouve exactement les mêmes bornes, une mesh et 858 triangles ; les références PNG sont retirées seulement en mémoire pour Node, tandis que le lot contrôle les cartes séparément. Le contrôle de lot et le typage réussissent.

Aucun rendu, capture, contrôle visuel, approbation artistique, test général, build ou relevé FPS téléphone. Continuité artistique des coutures et visibilité d’une unité derrière le rocher non évaluées. La vérification d’instanciation par le runtime appartient au coordinateur après gel du lot ; ce rapport ne prétend pas l’avoir réalisée.
