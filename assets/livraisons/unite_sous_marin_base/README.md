# Sous-marin — création originale

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

`unite_sous_marin_base`, 20 septembre 2026. Coque capsule aux épaules arrondies, ceinture de flottaison en relief, kiosque compact, plans latéraux et avant, dérive arrière et hélice à cinq pales dans une couronne ouverte. Fouet de 22 mm sur ressort réel à trois tours ; petit lanceur de marqueur creux sur rail. Aucun texte, insigne, livrée nationale, projectile ou dommage.

## Provenance et reproduction

Lecture distante authentifiée communiquée par le coordinateur le **20 septembre 2026 à 15:17:22.723 UTC** : aucun upload. Aucun maître local trouvé dans les chemins vérifiés (`provenance.json`). Ancien candidat inspecté par code : **596 triangles**, **71 700 octets**, SHA `1f0bd035995797145cd838eef9b20e8f64dbd5f5750a9c97eb137c11131afdde`, dix PNG. Ces fichiers restent inchangés ; leur contenu n'est pas importé. Revalidation distante avant intégration à la charge du coordinateur.

Géométrie originale Three.js. Helpers d'export, formes élémentaires, atlas analytique et mesures copiés depuis les modèles précédents. Aucun maître HD, décimation ou bake HD. Les normales décrivent peinture, joints et fixations ; l'albédo est un pigment sans éclairage, ombre ou reflet calculé. Atlas 4 × 4 répété avec gouttières. Les cinq PNG sont externes : albédo/normale 1024², rugosité/métal/masque 512². Le masque est strictement 0/255, le gris sous les zones blanches reste neutre ; rugosité en G et métal en B, identique au PNG métal.

Depuis la racine du dépôt, scripts sous `scripts/production/modeles/unite_sous_marin_base/` ; staging par défaut `tmp/production-sequentielle/unite_sous_marin_base/`. Tous acceptent un chemin de staging facultatif, sauf `inspecter-ancien.py` qui accepte d'abord le dossier historique, puis le staging. Après remplacement officiel, lui fournir l'archive historique : sa garde SHA refuse le nouveau modèle.

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/unite_sous_marin_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/mesurer.py
node --import tsx scripts/production/modeles/unite_sous_marin_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/mesurer-poses.py
node --import tsx scripts/production/modeles/unite_sous_marin_base/mesurer-natif.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/verifier.py
cp scripts/production/modeles/unite_sous_marin_base/README.md tmp/production-sequentielle/unite_sous_marin_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_sous_marin_base/assembler-revue.py
```

`verifier.py` exécute seulement le contrôle de ce lot et le typage sans compilation incrémentale. Les SHA des sources TypeScript sont conservés dans `validation-typage.json` ; `assembler-revue.py` les recoupe avant gel.

## Livraison et mesures

**5 060 / 6 000 triangles**, **sept primitives**, deux matériaux, sept nœuds dont les cinq requis. Dimensions **0,610 × 0,523 × 0,840 m**, avant +Z, haut +Y, racine immobile, quille à Y=0 et emprise centrée. GLB **252 820 octets**, SHA `8e9228111c21bb21f3e702f252af59d892d45c26db7e8fcb5aa89f862960e09c`. Poids exact des six fichiers et empreintes dans `revue-technique.json`.

Cinq clips : repos **2400 ms**, déplacement **1000 ms**, tir **700 ms**, touche **500 ms**, hors jeu **900 ms**. Repos : oscillation légère du fouet. Déplacement : hélice tournante, roulis et pilonnement de faible amplitude ; la racine reste fixe, aucune plongée sous le plateau. Tir : recul de 11 mm puis récupération du marqueur. Touche : inclinaison brève sans dommages. Hors jeu : coque abaissée de 5 mm sur sa quille, fouet parqué, marqueur rétracté et témoin masqué ; pose finale tenue. Temps FLOAT SCALAR strictement croissants et bornes min/max conservées. Boucles raccordées en pose et vitesse.

**973 poses** concordantes à 2 µm entre relecture NumPy, Three.js et GLTFLoader natif avec clones indépendants. Seules les références des textures sont retirées en mémoire pour le contrôle natif sous Node ; géométrie et clips restent intacts. Normales, tangentes et UV finis ; aucune face géométrique/UV dégénérée, normale opposée au winding ou face dupliquée dans une primitive.

Les trois gabarits du runtime sont mesurés après RY(π/2), avec majoration continue du rayon horizontal par nœud et vitesse LINEAR/slerp : **a 0,414811 m**, **b 0,428153 m**, **c 0,485350 m**. Le plus petit espace garanti entre voisins à tous caps est donc **29,300 mm**, en c. Sol vérifié aux poses ; détails dans `mesures-gabarits.json`.

Contrôles mécaniques ciblés (`mesures-jeux.json`) : **35 raccords**, dont plans/coque, kiosque/antenne, quille/coque et appuis du propulseur. Hélice/couronne : **6,172 mm** de jeu conservateur à tout angle ; hélice/traverses : **6,500 mm**. Ressort : **7,710 mm** autour de l'âme et **8,449 mm** entre portions de spires distinctes, 363 couples sondés. Treize sondes confirment la chambre du marqueur et son départ libre vers +Z ; trois sondes vérifient son appui sur la coque. Corrections avant gel : extrémités raccourcies de 10 mm, âme prolongée dans la collerette supérieure, embase du marqueur abaissée pour suivre l'avant de la coque.

## Limites et périmètre

`approbationArtistique: false`. Aucun rendu, capture, contrôle visuel à 65° ou 48 px/m, test général, build, téléphone ni FPS. Clips isolés ; mélanges et transitions exclus. Sol et jeux mobiles contrôlés aux poses, rayon majoré continûment. Mesures mécaniques localisées et sondes ponctuelles, aucune certification globale des collisions. Raccords avec recouvrement intentionnel ; plans et dérive rigides, capteurs opaques, atlas répété. Aucun bake HD ; lisibilité et point de départ des effets du moteur restent à apprécier humainement.

Écritures limitées au dossier de scripts et à son staging. Aucun Git, lot officiel, alias, registre, plan ou fichier partagé modifié par le spécialiste. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.
