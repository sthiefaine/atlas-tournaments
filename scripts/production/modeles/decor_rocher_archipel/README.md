# Rocher archipel — source originale

Création paramétrique indépendante du candidat historique. Lecture distante authentifiée du coordinateur le 20 septembre 2026 à 17:13:51.127 UTC : aucun dépôt. Aucun maître archipel local identifié dans les sources du projet ni les fichiers 3D nommés des téléchargements ; les sources locales du rocher plaine appartiennent à une autre commande. Candidat précédent conservé : SHA `a8fbb7d8e0c7f190a6bbc1a9ae5b9f9a7382949f48ce8c49198eaa13f3ec60fa`, 240 triangles, 26 868 octets ; neuf PNG inspectés numériquement. Aucun ancien actif. Aucune géométrie ou texture historique réutilisée.

Le bloc calcaire est défini par quatorze plans : base horizontale, flancs inégaux, angles coupés et trois cassures obliques sous une petite couronne. Les cinq plus grands pans visibles sont creusés par une alvéole de 20 mm, sans trou dans la coque. Quatre valves calcaires larges et fermées reposent au sol, autour du bloc. Il n’y a ni sphère bruitée ni pointe fine, texte, emblème ou variante nationale.

Un seul LOD0, **576 triangles** : 384 pour le bloc et 192 pour les quatre coquillages. **Une primitive, un matériau `mat_roche`, nœuds `racine` / `bloc`, aucun clip.** Dimensions **0,427745 × 0,300000 × 0,444924 m**, pivot centré sur l’enveloppe XZ et au sol Y=0. GLB **88 108 octets** ; GLB et trois PNG **571 274 octets**. Aucune donnée d’image embarquée.

Atlas de 18 îlots dans une grille 5 × 5, marge de 8 texels à 512 px. Un îlot par plan ou coquillage ; le dessous de chaque coquillage réutilise son îlot supérieur. Albédo 1024² : pigments clairs du calcaire, petits écarts minéraux et rares touches gris olive. Normale 512² : porosité minérale et stries des valves, espace tangent +Y. Rugosité 512² en G, métal B=0, R=255 inutilisé ; matériau non métallique. Les générateurs n’utilisent ni éclairage, ombres ni occlusion ; aucun bake HD. Les gouttières prolongent les pigments et dilatent les normales. Aucune variante saisonnière dédiée n’est produite : le jeu conserve les cartes communes.

Reproduction depuis la racine du dépôt, avant remplacement du candidat :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_archipel/inspecter-ancien.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_archipel/generer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_archipel/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_archipel/mesurer.py
node --import tsx scripts/production/modeles/decor_rocher_archipel/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/decor_rocher_archipel.json --lot tmp/production-sequentielle/decor_rocher_archipel > tmp/production-sequentielle/decor_rocher_archipel/validation-lot.log
npm run typecheck -- --incremental false > tmp/production-sequentielle/decor_rocher_archipel/typecheck.log
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/decor_rocher_archipel/assembler-revue.py --code-typecheck 0
```

Le dernier argument consigne un code de sortie réellement constaté. L’export GLB est direct, avec attributs FLOAT et bornes POSITION conservées. Les contrôles relisent le binaire exporté : cinq volumes fermés après soudure des coutures, deux faces par arête avec sens opposé, volumes signés positifs, normales concordantes, tangentes orthogonales et UV non dégénérées. Les cavités restent à distance positive des autres plans. Les coquillages touchent Y=0 et un plan sépare chacun du bloc, avec une garde minimale de **8,628 mm**. Cinq rayons verticaux par quart de tour mesurent des profils distincts ; l’écart maximal entre deux profils est toujours d’au moins **25,471 mm**. Cela ne démontre pas leur lisibilité artistique.

GLTFLoader natif retrouve exactement les mêmes bornes, une mesh et 576 triangles. Ses références aux PNG sont retirées uniquement en mémoire pour cette lecture sous Node ; les cartes sont contrôlées séparément. Le contrôle complet de lot et le typage réussissent. Aucun rendu, capture, contrôle visuel, approbation artistique, test général, build ou mesure FPS téléphone. Continuité artistique des coutures et visibilité d’une unité derrière le rocher non évaluées. Le raccordement et les mesures d’instanciation appartiennent au coordinateur, après livraison ; ce lot ne les certifie pas.
