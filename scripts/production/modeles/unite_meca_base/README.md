# Méca — binôme original d’appui lourd

Création propre à `unite_meca_base`, sans import de géométrie ni de texture de l’ancien candidat. Une porteuse aux cheveux sombres porte à l’épaule extérieure un caisson de marqueurs-fusées ; un équipier plus grand, aux cheveux châtains, porte les recharges. Leurs proportions, teints, visages fictifs, coiffures, postures et accessoires diffèrent. Plaques de tibia épaisses, bottes à quatre crans, cadres dorsaux segmentés à trois panneaux, casques à visière et plastrons arrondis donnent les volumes de l’appui lourd. Le caisson est horizontal au repos, dirigé vers +Z, avec trois embouchures obturées. Aucun projectile détaché, inscription, symbole national, marque ou personne réelle.

Un seul LOD0, sans variante saisonnière ni kit. Spécification et budget inchangés. Les anciens `kit_fr_meca` et `kit_lu_meca` ne conviennent pas aux nouveaux UV/nœuds : leur archivage et retrait d’alias appartiennent au coordinateur avant activation. Le coordinateur a reconfirmé l’absence d’upload pour ces trois fiches le 20 septembre 2026. Les actifs n’ont pas été modifiés par ce spécialiste.

## Lot figé

Staging : `tmp/production-sequentielle/unite_meca_base`. **3 988 triangles sur 4 000**, **4 primitives**, deux matériaux exacts `mat_corps` / `mat_details`. GLB + cinq PNG : **1 757 448 octets** ; GLB seul **508 252 octets**.

SHA-256 GLB : `9b2bd92c89f3dccd1ce1f0855ecaf6d6d202edda827a86cb8026d5160a0ef6f2`.

Dimensions relues : **0.450000 × 0.601000 × 0.440000 m**, cible 0,45 × 0,60 × 0,45 m ± 0,06. Racine identité centrée au sol, +Y haut et +Z avant. `base` porte le plateau ovale de 18 mm de haut ; `corps` porte les deux primitives skinnées ; `module_lance_roquettes` est l’os de recul ; `socle` est le témoin escamotable. Les 27 os ont des noms uniques et leurs propres pivots. Les quatre semelles reposent au plateau en pose neutre.

Ancien candidat inspecté sans modification : 3 792 triangles, 411 636 octets, SHA `3b1965fe08bf49c2e9a254e34eb449c2c1e14173039d9750a2f3ec598a15c025`. Ses 10 PNG ont été lus numériquement. Aucune de ces données n’entre dans la création.

## Matières et animations

Atlas 4 × 4, UV confinés dans chaque cellule, marge minimale 17.92 pixels en 1024². Albédo et normale 1024² ; rugosité, métal et masque 512². Pigments et microreliefs analytiques originaux : trame du tissu, peinture entretenue, métal brossé, caoutchouc, peau et cheveux. Aucun calcul de lumière ou d’occlusion dans l’albédo, aucun bake HD. Normale +Y tangent, rugosité G et métal B ; le PNG métal séparé reproduit B. Masque strictement 0/255, gris neutre sur les panneaux dorsaux et crêtes des casques ; peau, cheveux, verre, caoutchouc et métal nu sont noirs dans le masque. Le témoin ambre n’utilise pas d’émission.

- `repos`, 2 400 ms : respiration contenue et orientation discrète des têtes ; boucle exacte.
- `deplacement`, 1 000 ms : pas courts, levée du pied jusqu’à 16 mm, résolution des deux segments de jambe, un pied de chaque personne en soutien ; boucle exacte.
- `tir`, 700 ms : recul du caisson de 16 mm, réaction du torse et retour à la pose de travail. La selle et le pont restent attachés au cadre.
- `touche`, 500 ms : brève réaction des torses puis retour, sans dommage ajouté.
- `hors_jeu`, 900 ms : genoux fléchis, torse et tête inclinés, caisson abaissé avec l’épaule et témoin `socle` escamoté. Toutes les pistes tiennent la pose finale ; les semelles restent au plateau.
- `capture`, 1 300 ms : l’équipier lève le bras extérieur et confirme par un petit mouvement de l’avant-bras ; la porteuse incline la tête. Retour exact au repos, base fixe. Le coude se déplace de 60.434 mm depuis sa vraie position neutre, l’avant-bras tourne jusqu’à 0.844 rad.

Le skin articule séparément des pièces rigides de vêtement et d’équipement ; il ne promet pas une peau organique continue. Le jeu doit déplacer la racine et conserver la dernière pose de `hors_jeu`.

## Mesures et limites

Contrôle complet du lot et `npm run typecheck` réussis après la dernière édition TypeScript ; sorties réelles conservées en staging. Aucun triangle dégénéré ou strictement dupliqué, aucune UV dégénérée, normales et tangentes unitaires et orthogonales. Temps d’animation FLOAT SCALAR avec min/max conservés, boucles parfaitement jointives, fin de `hors_jeu` tenue.

`GLTFLoader`, `SkeletonUtils.clone` et `AnimationMixer` relisent la géométrie réellement skinnée : **1 617 poses**, squelettes indépendants. Rayon horizontal maximal échantillonné **0.287984 m** ; marge entre deux enveloppes de cases voisines **0.424033 m** à tous bearings pour ces poses. Écart maximal du pied en soutien : **1.194 micromètres**. Les pieds restent horizontaux et dans l’ellipse du plateau. Le minimum Y global à −2,2×10⁻¹⁰ m relève de l’arrondi flottant (tolérance 10⁻⁸ m).

Jeux minimaux échantillonnés dans le repère des torses : **12.000 mm** entre caisson et casque, **15.500 mm** au-dessus de l’épaule, **0.500 mm** au-dessus du gant porteur. La main reste au contact de sa poignée : distance des centres **1.414 mm**. Les plans séparateurs du bras de capture donnent **13.217 mm** avec le casque et **0.717 mm** avec le torse. Les capsules conservatrices des bras intérieurs conservent **1.243 mm**. La posture du bras libre a été corrigée à partir de ces mesures. Les raccords selle/caisson, pont/épaule et gant/poignée sont des contacts voulus.

Ces mesures sont échantillonnées. Elles ne certifient pas une enveloppe continue, les mélanges de clips, toutes les collisions internes, les futurs kits nationaux ni la lisibilité artistique. **Aucun test général, build, rendu, capture, contrôle visuel ou approbation artistique. Aucun appareil réel ni relevé FPS téléphone.**

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx scripts/production/modeles/unite_meca_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meca_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meca_base/mesurer.py
node --import tsx scripts/production/modeles/unite_meca_base/mesurer-rig.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meca_base/finaliser.py
```

`finaliser.py` exécute lui-même le contrôle ciblé `npm run controler:asset -- --spec assets/specs/unite_meca_base.json --lot tmp/production-sequentielle/unite_meca_base --json` puis `npm run typecheck` et exige leur réussite avant de rédiger cette synthèse. `inspecter-ancien.py` demande le SHA historique : après remplacement, lui fournir le dossier archivé correspondant. Les SHA des six fichiers du lot sont dans `revue-technique.json`.
