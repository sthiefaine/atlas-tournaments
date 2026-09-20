# Aéroport commun — création originale

Lot isolé `batiment_aeroport_base`, sans identité nationale, régionale ou saisonnière. Sources reproductibles dans ce dossier ; staging dans `tmp/production-sequentielle/batiment_aeroport_base/`. Aucune intégration ni opération Git par le spécialiste.

## Provenance

Le coordinateur a communiqué une lecture distante authentifiée réussie le **20 septembre 2026 à 15:48:03.183 UTC**, sans dépôt. La recherche locale n’a identifié aucun maître (`provenance.json`). Le candidat et l’actif antérieurs sont préservés : SHA `51e17c267aef8476c47737348c6235a63e431a9915d46e5b977a6c92220fd2ca`, **996 triangles, 116 108 octets**. L’inspection par code couvre géométrie, UV, normales, nœuds, clips et quinze PNG, sans rendu. Aucun sommet ni texture ancien n’est importé. Le helper d’export GLTF provient du transport aérien récent ; il préserve les min/max des temps d’animation.

## Construction

Dalle biseautée de **0,920 × 0,920 m**, origine au sol ; hauteur **0,4145 m**. Apron circulaire de rayon **0,300 m** centré en X/Z **(0,020 ; 0,075)**, sans obstacle dans le disque. L’anneau est exclusivement pigmentaire, peint sur la texture du disque ; aucune lettre ni couche coplanaire. Cabine à l’arrière gauche, parois vitrées entre soubassement et toiture, camion ravitailleur en retrait à droite, manche creuse articulée et quatre feux cardinaux encastrés. La cabine reste le point culminant. L’avant garde un accès large de **0,42 m** au-dessus du plan de l’aire ; les feux culminent à **28 mm**, comme le disque. Aucune unité décorative.

**4 116 triangles / budget 4 200**, **5 primitives**, **2 matériaux** (`mat_corps`, `mat_vitrage`). GLB **279 880 octets**, cinq PNG **1 408 740 octets**, total binaire **1 688 620 octets**. Albédo/normales 1024², rugosité/émission/masque 512². Atlas 4×4 avec gouttières de 16 pixels en 1024² ; surfaces d’équipe en gris strict, masque 0/255. Béton, métal nu, vitrage, pneus et tissu sont exclus du masque. La carte d’émission ne porte que le vitrage de cabine et les quatre lentilles ; vitrage du camion noir dans l’émission. Les joints sciés, grain et panneaux sont dans la normale ; pigment et fines variations de matière sans éclairage, ombre, reflet ou occlusion peints. ORM : rugosité G, métal B, R=255. Aucun bake HD.

Nœuds `racine`, `corps`, `toit`, `enseigne`, `manche_air`. Extras `racine.atlasAnimationsBatiment=true` pour le raccordement du coordinateur. `repos` **3,2 s** : oscillation de la seule manche autour d’un axe fixe, pose et vitesse raccordées. `capture` **1,4 s** : déplacement d’un indicateur dans une glissière de toit, retour au départ. Dalle et cabine immobiles. Pas de `touche` facultatif.

## Contrôles et corrections

Le GLB réel est relu pour les triangles, UV, normales, tangentes, axes, enveloppes, noms et temps de clips. Les **42 paires de raccords listées** dans `mesures.json` présentent un contact ou une intersection de montage ; cela ne vérifie pas toutes les pièces entre elles. Les normales extérieure/intérieure de la manche sont contrôlées séparément. Sa liaison au cerceau, le raccord de pompe et le mât ont été corrigés ; les petits biseaux sont bornés pour empêcher une inversion des faces fines. Cabine et camion sont reculés hors du disque. Les feux encastrés restent à **1 mm du bord du disque** ; leur faible hauteur libère l’approche.

**264 poses** : 133 repos, 131 capture, comprenant grille uniforme et clés. Dalle, corps et toiture ne changent pas de matrice. L’indicateur conserve **1,99997 mm** de jeu entre ses rails et reste posé sur le fond. Le majorant continu de déplacement de la manche reste sous **0,363068 m** de hauteur, sous la toiture, et dans la parcelle. Les enveloppes des pièces mobiles et globales concordent avec `GLTFLoader` et `AnimationMixer` natifs à 2 µm ; les **14 matrices clés** concordent à **3,37 × 10⁻⁹** au maximum. Les clones possèdent leurs nœuds animés propres. Le chargeur natif retire les références de cartes en mémoire uniquement, faute de canevas, sans modifier le lot ; les PNG et leurs références sont contrôlés séparément.

Le contrôle ciblé de lot et `npm run typecheck -- --incremental false` passent. Empreintes des sources et des trois fichiers runtime modifiés par le coordinateur dans `typecheck.json`. Aucune suite de tests, build, image, capture, inspection visuelle, mesure FPS ni téléphone. **Approbation artistique : false.** Le disque ouvert n’est pas une garantie que toutes les silhouettes d’unités tiennent entièrement entre les accessoires. Les poses échantillonnées ne constituent pas une recherche exhaustive des collisions ni une validation des transitions du jeu.

## Reproduction

Depuis la racine du dépôt :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_aeroport_base/inspecter-ancien.py
npx tsx scripts/production/modeles/batiment_aeroport_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_aeroport_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_aeroport_base/mesurer.py
npx tsx scripts/production/modeles/batiment_aeroport_base/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/batiment_aeroport_base.json --lot tmp/production-sequentielle/batiment_aeroport_base
npm run typecheck -- --incremental false
```

`generer.ts` et `textures.py` acceptent un chemin de sortie comme premier argument. `assembler-revue.py --code-typecheck 0` archive le résultat vérifié par le coordinateur/spécialiste à partir des journaux existants ; il ne remplace pas l’exécution du typage. Les rapports ne contiennent aucune donnée d’authentification.
