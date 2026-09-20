# Porte-avions — création originale

`unite_porte_avions_base`, 20 septembre 2026. Coque flottante avec ceinture de flottaison, pont d'envol large et continu, îlot tribord avancé avec passerelle vitrée, radar parabolique tournant et fouet sur ressort. La plateforme de manutention affleurante et les deux voies de lancement restent sans avion fixe. Supports d'encorbellement, défenses, amarrages, accès et grilles ont une fonction. Petit marqueur de proximité sur berceau devant l'îlot. Aucun texte, insigne, nationalité ou dommage.

## Provenance

Création paramétrique originale Three.js et NumPy/Pillow. Aucun maître HD ni source externe importés ; aucune décimation ou bake HD. Les helpers d'export, formes élémentaires, atlas analytique et mesures viennent des modèles précédents. La géométrie du porte-avions est originale. Les normales décrivent grain de peinture, brossage, joints et fixations ; les pigments n'utilisent aucun éclairage, reflet, ombre ou occlusion calculée.

Le coordinateur a communiqué une lecture authentifiée réussie du stockage le **20 septembre 2026 à 14:27:43.312 UTC**, sans upload, maître local, actif ni kit. Ancien candidat inspecté par code avant création : **996 triangles**, **123 304 octets**, SHA-256 `92da0a6f5f10fc8d918db4b38152fdf69132c80435634cae2721b283edc19390`. **Douze PNG** inspectés et inchangés. Aucun contenu du candidat ou de ses PNG n'est réutilisé. Aucun secret enregistré. Revalidation distante avant intégration à la charge du coordinateur.

## Reproduction

Depuis la racine du dépôt. Tous les scripts acceptent un staging facultatif. `inspecter-ancien.py [archive] [staging]` doit recevoir l'archive historique après remplacement du candidat ; sa garde SHA refusera le nouveau lot.

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/unite_porte_avions_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/mesurer.py
node --import tsx scripts/production/modeles/unite_porte_avions_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/mesurer-poses.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/mesurer-gabarit-a.py
node --import tsx scripts/production/modeles/unite_porte_avions_base/mesurer-natif.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/verifier.py
cp scripts/production/modeles/unite_porte_avions_base/README.md tmp/production-sequentielle/unite_porte_avions_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_porte_avions_base/assembler-revue.py
```

`verifier.py` lance uniquement le contrôle du lot de cette fiche et `npm run typecheck`, puis conserve sorties et SHA des scripts TypeScript. Aucun test général ou build.

## Livraison mesurée

**6 308 / 9 000 triangles**, **neuf primitives**, deux matériaux `mat_corps` et `mat_details`, sept nœuds dont les six requis et `os_marqueur`. Dimensions **0,650 × 0,620 × 0,890 m**, avant +Z et haut +Y, racine identité, emprise centrée, quille à Y=0. GLB **409 812 octets**, GLB et cinq PNG **1 579 869 octets**. SHA-256 GLB : `5d19a909650aed2953ffa0c9a441b36eed989592c3ec42cd576ab395c20a81b9`.

Albedo et normale 1024² ; rugosité, métal et masque 512². PNG externes sans copie embarquée. Atlas 4 × 4 avec gouttières. Masque strict 0/255 et gris neutre sous le blanc ; verre, métal, caoutchouc et pont hors masque. Rugosité en G, métal en B identique au PNG métal éditable. Témoin ambré sans émission.

Cinq clips aux durées du contrat : repos 2400 ms, déplacement 1000 ms, tir 700 ms, touche 500 ms, hors jeu 900 ms. Radar à rotation complète et légère oscillation du fouet au repos/déplacement ; le déplacement ajoute pilonnement et roulis. Le petit marqueur recule de 12 mm puis récupère. Hors jeu parque le radar et le fouet, abaisse le marqueur, cache le témoin et tient la pose finale. Aucune piste sur la racine. Boucles raccordées en pose et vitesse, temps FLOAT SCALAR croissants avec min/max conservés.

Normales, UV0 et tangentes finis et normalisés ; aucune face géométrique ou UV dégénérée, normale inversée selon le winding ou face superposée au sein d'une primitive. **974 poses** relues par Three.js et NumPy, puis GLTFLoader natif et `SkeletonUtils.clone`, concordantes à 2 µm. Le contrôle natif enlève uniquement les références de textures en mémoire pour fonctionner sous Node ; sommets et clips restent inchangés. Les clones ont des nœuds indépendants et le centre du radar reste fixe dans le corps.

Gabarit **b** : rayon horizontal échantillonné **0,480424 m**, majoration continue **0,482347 m**, espace minimal entre deux voisins à tous caps **35,305 mm**. Gabarit **a**, utilisé par défaut par les styles sans clé : `S(0,9 ; 0,98 ; 1,06) × RY(π/2)`, rayon échantillonné **0,444041 m**, majoration continue **0,452854 m**, espace minimal **94,293 mm**. La majoration continue utilise les vitesses LINEAR/slerp et le demi-pas d'échantillonnage ; la contraction du témoin a une borne sphérique séparée. Sol contrôlé aux poses ; `c` et mélanges de clips exclus.

## Mécanique ciblée

Dix raccords de supports mesurés avec intersections intentionnelles de leurs surfaces, dont bras/récepteur, dos/axe/parabole, axe/support, console/antenne, console/jambe/îlot, guides/ascenseur et coque/pont. Le récepteur ne flotte pas. Radar/toit **4,500 mm** de jeu ; radar/antenne **119,000 mm** ; antenne/toit au moins **74,561 mm** sur les poses. Ces valeurs utilisent des plans séparateurs dans le repère commun de coque, y compris pendant le roulis.

Ressort à trois tours, fil de **8,4 mm**, fouet de **21 mm** ; jeu fil/âme **5,517 mm**. **243 couples** de portions distinctes du ressort proches en angle : écart minimal **11,022 mm**. Collerettes aux extrémités.

La plateforme et le pont partagent Y=**0,210 m** : réservation réelle dans le pont, neuf sondes traversent celle-ci et atteignent la plateforme sans surface de pont superposée. Deux voies ouvertes de 26 mm, fonds à Y=**0,1995 m**, rails à Y=**0,212 m**, soit 2 mm au-dessus du pont ; six sondes de fond. Vingt sondes de la plage d'envol avant atteignent seulement les bas reliefs du pont, sans îlot ni équipement élevé. Treize sondes du marqueur atteignent sa chambre après plus de 50 mm et restent libres vers +Z sur 650 mm. Ces sondes sont ponctuelles et ne certifient pas la totalité des sections.

Corrections avant gel : récepteur raccordé en prolongeant son bras ; réservations du pont ajoutées pour l'ascenseur et les voies ; ensemble tournant du radar relevé de 4 mm pour dégager le toit ; roulis de déplacement uniaxial pour une vitesse continue à la jointure. Contrôle de lot et typage réussis après les dernières modifications TypeScript.

## Limites

`approbationArtistique: false`. Aucun rendu, image, capture, contrôle visuel, appréciation à 65° ou 48 px/m, test général, build, téléphone ou FPS. Les volumes répondent au contrat de conception sans approbation humaine de leur lisibilité. Gabarits a/b et clips isolés seulement. Distances locales et sondes ponctuelles, aucune certification globale des intersections. Raccords avec recouvrements intentionnels. Ascenseur et catapultes rigides ; vitrages opaques sans intérieur ; atlas de matières répété. Aucun maître HD ni nouveau bake. Position des effets de tir du moteur et perception en jeu à apprécier humainement.

Le spécialiste écrit seulement dans `scripts/production/modeles/unite_porte_avions_base/` et `tmp/production-sequentielle/unite_porte_avions_base/`. Aucun lot officiel, actif, alias, registre, plan, fichier partagé ou Git modifié. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.
