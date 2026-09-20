# Génie de terrain — binôme original

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Création propre à `unite_genie_base`, sans import de géométrie ni de texture de l’ancien candidat. Le binôme réunit un technicien et une technicienne en tenue de terrain entretenue : casques, harnais, poches, bottes, maillet et clé de montage. Les proportions, les visages fictifs, les teints, les coiffures et les accessoires sont distincts. Le technicien porte une capsule de diagnostic arrondie, son support arrière et une petite parabole tournante ; la technicienne porte un terminal sans texte. Un marqueur compact matérialise le geste de tir prévu par la fiche. Aucune livrée nationale, arme réaliste, marque, inscription ou personne réelle n’a servi de source.

Un seul LOD0, sans variante saisonnière ni kit. La spécification et son budget restent inchangés. Les anciens `kit_fr_genie` et `kit_lu_genie` ne conviennent pas à ces nouveaux UV/nœuds : leur archivage et retrait d’alias appartiennent au coordinateur avant activation. Le coordinateur revérifie également l’absence d’un upload. Les fichiers actifs n’ont pas été modifiés par ce spécialiste.

## Lot figé

Staging : `tmp/production-sequentielle/unite_genie_base`. **3 728 triangles sur 4 000**, cinq primitives, deux matériaux exacts `mat_corps` / `mat_details`. GLB + cinq PNG : **1 699 165 octets** ; GLB seul **433 332 octets**.

SHA-256 GLB : `4e521a848f92acfa1d9214187d0ddbd80563dc26f0a722a49dc5e6c14284d812`.

Dimensions relues : **0,450 × 0,617055 × 0,434 m**, pour une cible 0,45 × 0,60 × 0,45 m ± 0,06. Racine identité au centre du socle ovale, +Y haut et +Z avant. Le plateau est posé au sol et culmine à 18 mm ; les quatre semelles sont à 18 mm en pose neutre. `base` porte ce plateau, `corps` les deux primitives skinnées, `module_radar` est un vrai os de rotation, `socle` désigne le témoin de disponibilité escamotable. Les 28 os ont des noms uniques et leurs propres pivots.

Ancien candidat inspecté sans modification : 3 964 triangles, 426 904 octets, SHA `ce2760c103f02ad596052d8e74bffcc2311c08b0b648e5b7c0759989cdec5ed9`. Les douze PNG anciens ont été lus numériquement. Aucune de ces données n’entre dans la création.

## Matières et animations

Atlas 4 × 4 avec UV à l’intérieur des cellules. Albédo et normale 1024² ; rugosité, métal et masque 512². Peinture, trame textile, caoutchouc, métal brossé, peau et chevelures reposent sur des pigments et microreliefs analytiques originaux. L’albédo ne comporte aucun calcul de lumière ou d’occlusion. Aucun bake HD. Normale +Y tangent, rugosité G et métal B ; le PNG métal séparé est identique au canal B. Le masque est strictement 0/255, avec gris neutre sous les zones d’équipe. Peaux, cheveux, caoutchouc, métal nu et verre sont noirs dans le masque ; cette propriété est relue dans les pixels. Pas de carte d’émission : le témoin ambre est masqué par échelle nulle.

- `repos`, 2 400 ms : respiration discrète des torses, orientation des têtes et balayage du radar ; boucle exacte.
- `deplacement`, 1 000 ms : marche en place résolue par cinématique de deux segments, une jambe en soutien, levée de l’autre jusqu’à 23 mm, pieds horizontaux et bras articulés ; boucle exacte.
- `tir`, 700 ms : recul de 19 mm puis récupération du marqueur compact et réaction des torses ; aucun projectile en géométrie.
- `touche`, 500 ms : bref mouvement des torses puis récupération, sans dommage ajouté.
- `hors_jeu`, 900 ms : genoux fléchis, torse et tête inclinés, radar arrêté et témoin `socle` à zéro. Toutes les pistes tiennent leur pose finale ; les semelles restent sur le plateau.

Le skin utilise un os par pièce rigide de vêtement ou d’équipement ; il articule bien les membres séparément, sans promettre une peau organique continue. Le plateau et la racine demeurent fixes. Le moteur doit déplacer la racine et conserver la dernière pose du clip `hors_jeu`.

## Mesures et limites

Contrôle complet du lot et `npm run typecheck` réussis après la dernière édition TypeScript. Aucun triangle dégénéré, UV dégénérée ou triangle strictement dupliqué ; normales et tangentes unitaires/orthogonales. Les temps d’animation FLOAT SCALAR conservent min/max. Les deux boucles se raccordent exactement et les extrémités de `hors_jeu` restent identiques.

Le GLB est relu avec `GLTFLoader`, cloné avec `SkeletonUtils.clone` et mesuré après `AnimationMixer`/skin : **1 131 poses**, squelettes indépendants. Rayon horizontal échantillonné maximal **0.238734 m** ; marge entre deux enveloppes de cases voisines **0.522533 m**, tous bearings pour ces poses neutres. Jeu minimal échantillonné derrière le casque pour le radar : **21.216 mm**. Écart maximal du pied en soutien au plateau : **1.727 micromètres**. Les pieds restent horizontaux. Le minimum Y du plateau vaut −2,2×10⁻¹⁰ m, erreur flottante inférieure à la tolérance de 10⁻⁸ m ; aucune pose hors jeu ne descend sous le sol à cette tolérance.

Ces mesures sont échantillonnées. Elles ne certifient pas une enveloppe continue, les mélanges de clips, toutes les collisions internes, les futurs kits nationaux ni la lisibilité artistique. **Aucun test général, build, rendu, capture, contrôle visuel ou approbation artistique. Aucun appareil réel ni mesure FPS téléphone.** La réception technique ne vaut pas approbation artistique.

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx scripts/production/modeles/unite_genie_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_genie_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_genie_base/mesurer.py
node --import tsx scripts/production/modeles/unite_genie_base/mesurer-rig.ts
npm run controler:asset -- --spec assets/specs/unite_genie_base.json --lot tmp/production-sequentielle/unite_genie_base
npm run typecheck
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_genie_base/finaliser.py
```

`finaliser.py` synthétise les fichiers et les contrôles effectués juste avant lui ; il ne remplace pas ces commandes. `inspecter-ancien.py` requiert le SHA historique : après remplacement, fournir le dossier archivé correspondant. Les helpers d’export sont locaux, avec préservation des bornes des temps d’animation. Les SHA de chacun des six fichiers du lot figurent dans `revue-technique.json`.
