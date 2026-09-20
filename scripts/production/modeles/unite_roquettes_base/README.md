# Lance-roquettes — création originale

`unite_roquettes_base`, 20 septembre 2026. Camion à six pneus larges, cabine avancée et plateau bas. Son caisson rectangulaire incliné est plus large que le plateau : deux rangées de six logements de marqueurs-fusées, parois et lèvres réellement creuses. Pivot arrière, rails de recul, quatre stabilisateurs télescopiques entre les essieux. Couleur d'équipe uniquement sur les deux portes et les deux joues du caisson. Aucune antenne, parabole, chenille, inscription, livrée nationale ou marque de dommage.

## Provenance et périmètre

Création originale paramétrique Three.js, NumPy et Pillow. Aucun modèle externe, maître HD, ancien candidat ou texture historique importé ; aucune décimation ni aucun bake HD. Helpers GLB, formes élémentaires et méthodes de mesure adaptés des modèles précédents. Les normales sont des microreliefs analytiques de matière ; les pigments ne calculent ni éclairage, ombre, reflet ni occlusion.

Le coordinateur a communiqué une lecture authentifiée réussie le **20 septembre 2026 à 14:56:09.140 UTC**, sans dépôt pour cette base ; aucun maître local, actif ou kit connu. Ancien candidat : **832 triangles**, **100 232 octets**, SHA-256 `013ca147811f5a53e3899552addff5aad681eaf8216f8517434665c30f3c9f04`. Son GLB et ses **dix PNG** ont été inspectés par code avant création, sans modification ni réutilisation. La revalidation distante avant intégration appartient au coordinateur. Aucun secret enregistré.

Écritures du spécialiste limitées à `scripts/production/modeles/unite_roquettes_base/` et `tmp/production-sequentielle/unite_roquettes_base/`. Aucun lot officiel, fichier partagé, alias, registre, plan ou Git modifié. L'intégration, le commit, le push et le contrôle de publication sont réservés au coordinateur.

## Reproduction

Depuis la racine du dépôt, les scripts acceptent un staging facultatif. Après intégration, l'inspecteur doit recevoir le chemin de l'archive historique : sa garde SHA refuse un autre candidat.

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/unite_roquettes_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/mesurer.py
node --import tsx scripts/production/modeles/unite_roquettes_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/mesurer-poses.py
node --import tsx scripts/production/modeles/unite_roquettes_base/mesurer-natif.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/verifier.py
cp scripts/production/modeles/unite_roquettes_base/README.md tmp/production-sequentielle/unite_roquettes_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_roquettes_base/assembler-revue.py
```

`verifier.py` exécute seulement `controler:asset` pour ce lot et `npm run typecheck -- --incremental false`, sans cache TypeScript partagé. Aucun test général ni build.

## Lot mesuré

**8 800 / 9 000 triangles**, **21 primitives**, deux matériaux `mat_corps` et `mat_details`, vingt nœuds dont les cinq requis. Dimensions **0,668 × 0,633310 × 0,870 m**, avant +Z, haut +Y et origine centrée au sol. Le caisson porte une largeur de 0,668 m avec ses renforts, le plateau 0,438 m. GLB **487 904 octets**, lot GLB et cinq PNG **1 657 795 octets**. SHA-256 GLB : `20a51a56f38647de207226cb922b9c7eca4d2f09713d89892b34f2e273a29daa`.

Albedo et normale 1024² ; rugosité, métal et masque 512². PNG externes sans copie embarquée, atlas 4 × 4 avec gouttières. Masque strict 0/255 et gris strict dans les zones d'équipe. Rugosité dans G et métal dans B identique à la carte métal éditable. Témoin ambré sans émission.

Cinq clips : repos 2400 ms, déplacement 1000 ms, tir 700 ms, touche 500 ms, hors jeu 900 ms. Le caisson oscille légèrement au repos, s'abaisse de 0,07 rad pendant le déplacement et s'élève de 0,10 rad pour la salve. Les six roues tournent autour de leurs centres ; le corps oscille verticalement de ±3 mm. Les appuis sont au sol au repos et au tir, rentrent de 37 mm et remontent de 64 mm en déplacement. Le recul revient à sa pose de travail. Hors jeu tasse le corps de 8 mm, parque le caisson, cache le témoin et tient sa pose finale. La racine n'est jamais animée. Boucles raccordées en pose et vitesse ; entrées d'animation FLOAT SCALAR, temps croissants et bornes min/max présents.

Aucun triangle géométrique ou UV dégénéré, face inversée ou triangle superposé dans une primitive ; normales, tangentes et UV finis et normalisés. **973 poses** concordantes à 2 µm entre NumPy, Three.js et le chargeur natif GLTFLoader avec SkeletonUtils.clone. Nœuds des copies indépendants, pivot stable. Le contrôle natif retire en mémoire les seules références de textures ; les données PNG sont contrôlées séparément.

Les gabarits sont mesurés après RY(π/2) puis S : a `(0,9 ; 0,98 ; 1,06)`, b `(1 ; 1 ; 1)`, c `(1,14 ; 1,06 ; 0,95)`. Rayons horizontaux majorés continûment : **0,448482 / 0,457854 / 0,498267 m**, soit au moins **103,036 / 84,293 / 3,467 mm** entre deux voisins à tous caps. Chaque nœud reçoit sa borne de vitesse LINEAR/slerp et le demi-pas d'échantillonnage ; le témoin contracté a une borne sphérique distincte. La marge du gabarit c est étroite et documentée, sans changement du runtime ou du contrat.

## Mesures mécaniques localisées

Quarante distances de triangles : pneus voisins, pneus/plateau, cellules voisines, alésages et coulisseaux. Vingt-deux raccords intentionnels : rails/patins/caisson, axe/tourillons/berceaux, cabine/toit/témoin, coulisseaux/colliers et jambes/semelles. Les six jantes dépassent les talons et les recouvrent radialement malgré les polygones différents. Les quatre vitrages sont encastrés dans les plans réels de cabine.

Sur les 973 poses : garde pneus/gardes-boue au moins **6,456 mm**, stabilisateurs entre les pneus au moins **9,228 mm** longitudinalement, colliers/fourreaux verticaux latéralement hors du plateau, semelles et rotules sous celui-ci. Le caisson garde **7,153 mm** au-dessus de la cabine dans la pose hors jeu ; les rails et patins conservent au moins **1 mm** de recouvrement. Appuis au sol hors déplacement ; pieds repliés mesurés à 64 mm du sol. Les pneus tournants utilisent leur enveloppe circonscrite, avec un très léger écart au sol selon la facette.

Les douze logements ont chacun treize sondes intérieures jusqu'au fond, soit **156 sondes**. À deux instants de salve, **312 sondes** issues de toutes les bouches restent libres sur 650 mm devant la cabine. Ces sondes ponctuelles ne certifient pas chaque point de la section.

Corrections avant gel : extrémités resserrées pour le gabarit c, roues placées selon le rayon circonscrit des crampons, vitrages alignés sur les plans inclinés, patins descendus pour rejoindre les rails et attaches de garde-boue relevées hors des pneus.

## Limites

`approbationArtistique: false`. Aucun rendu, capture, contrôle visuel à 65° ou 48 px/m, test général, build, téléphone ou FPS. Les distances sont locales ; aucune certification globale des collisions. Sol et dégagements vérifiés aux poses ; rayon extérieur majoré continûment. Clips isolés, transitions et mélanges exclus. Vitrages opaques sans intérieur, atlas répété, suspension simplifiée, quatre vérins verticaux sans flexibles. Les 21 primitives résultent des articulations rigides ; leur coût réel sur téléphone n'est pas mesuré. Lisibilité, matière et correspondance des effets de bouche du moteur restent à apprécier humainement.
