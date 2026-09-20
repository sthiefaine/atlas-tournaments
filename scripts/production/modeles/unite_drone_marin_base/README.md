# Drone marin — création originale

`unite_drone_marin_base`, réalisé le 20 septembre 2026. Petit catamaran de reconnaissance : deux flotteurs épais, ceintures de flottaison en caoutchouc, pont bas, capsule étanche arrondie, radar concave court et antenne fouet sur ressort. Le radar et l’antenne portent des pistes GLB réelles. Aucun cockpit, passager ou tube de tir. Les panneaux du pont et du nez sont gris strict sous le masque d’équipe ; caoutchouc, métal et capteur restent neutres. Aucun texte, insigne, drapeau, dommage ou variante.

L’ancien candidat a été inspecté par code avant création : **648 triangles**, **78 900 octets**, SHA-256 `7fc7ec57f421da9f69f878e7d54b6e2ed5e9e11625b8e840ec820faf0a95a750` ; ses **12 PNG** ont été relus. Aucun fichier ancien n’a été modifié ou importé. L’inventaire distant communiqué ne signale aucun upload ; le coordinateur effectue la dernière vérification avant intégration.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_drone_marin_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_marin_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_marin_base/mesurer.py
node --import tsx scripts/production/modeles/unite_drone_marin_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_marin_base/mesurer-poses.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_marin_base/mesurer-ressort.py
npm run controler:asset -- --spec assets/specs/unite_drone_marin_base.json --lot tmp/production-sequentielle/unite_drone_marin_base
npm run typecheck
```

Chaque script accepte un dossier de sortie facultatif. `inspecter-ancien.py [archive]` exige l’empreinte précédente. Helpers copiés localement ; aucune dépendance de génération entre modèles. Textures originales NumPy/Pillow déterministes, sans service externe ni bake HD. Les joints et microreliefs sont analytiques, les pigments ne contiennent aucun éclairage peint.

## Résultat technique

Un LOD0 à **3 488 / 3 500 triangles**, **six primitives**, deux matériaux exacts `mat_corps`/`mat_details` et six nœuds exacts `racine`/`corps`/`base`/`socle`/`module_radar`/`module_antenne`. Dimensions **0,506 × 0,403 × 0,700 m**, dans les tolérances absolues de 0,06 m ; point bas statique à 0 m à l’arrondi numérique. +Y haut, +Z avant, origine au centre du niveau de référence et racine fixe identité ; `poseAuSol:true`.

GLB **205 484 octets**, GLB et cinq PNG **1 374 735 octets**. SHA-256 GLB `f19380b28b782d2aa3e1f46a90dbbab976c098dd084f6218510e8682350e61af`.

Quatre clips exacts : `repos` 2 400 ms, `deplacement` 1 000 ms, `touche` 500 ms et `hors_jeu` 900 ms. Aucun clip `tir`. Repos et déplacement ferment leurs boucles ; `corps` porte un balancement discret et `module_antenne` fléchit depuis son embase. Le radar accomplit un tour par clip puis s’arrête à 0,522 s dans hors-jeu. Hors-jeu conserve une gîte légère, masque le témoin `socle` à 0,52 s et tient tous les états à partir de 0,57 s. Il ne simule pas un naufrage. La racine n’est jamais animée. Le runtime n’a pas besoin de faire tourner ce radar lui-même.

UV0, normales et tangentes explicites, finies et cohérentes. Aucune face géométrique ou UV dégénérée, superposition exacte dans une primitive ou normale opposée à l’orientation de ses triangles. Albédo et normale tangentielle +Y 1024² ; rugosité G, métal B et masque 512². Masque strict 0/255 et gris strict sous le blanc ; carte métal égale au canal B de la rugosité. Tous les PNG sont externes, sans copie embarquée ni saison. Les bornes min/max des entrées temporelles d’animation sont conservées et contrôlées.

**804 poses relues dans le GLB exporté**, indépendamment avec Three.js et NumPy, concordantes à 2 µm ; les mesures Three.js recoupent aussi la scène avant export. Rayon horizontal maximal **0,402459 m**, majoration continue **0,405832 m** : au moins **188,3 mm** entre deux voisins neutres sous tout cap pour chaque clip isolé. La majoration ajoute au rayon échantillonné la vitesse maximale des articulations multipliée par le demi-pas ; le témoin rétractable est borné séparément par sa sphère locale.

**Jeux locaux du ressort relus après correction.** Deux tours sur 50 mm, rayon central 22 mm et fil Ø20 mm. Les 19 584 paires de faces de portions éloignées d’au moins deux tiers de tour donnent un jeu minimal entre spires de **4,595 mm**, sans traversée. Le minimum radial continu des faces triangulaires donne au moins **0,478 mm** de jeu par rapport à l’âme cylindrique de Ø22 mm. Ces jeux sont invariants dans le module antenne rigide ; cette mesure ciblée ne certifie pas toutes les intersections internes. Voir `mesures-ressort.json`.

**Portée : GLB neutre et gabarit runtime b=[1,1,1] seulement.** Les étirements runtime `a=[.9,.98,1.06]` et `c=[1.14,1.06,.95]` ne sont pas certifiés. Le sol est contrôlé aux poses échantillonnées ; seule l’enveloppe horizontale reçoit une majoration continue.

Contrôle de lot **ok**, six fichiers acceptés, aucun motif ; typage **ok** après la dernière modification TypeScript. `revue-technique.json` porte l’identifiant exact et `approbationArtistique:false` dans le staging, avec une copie du présent README.

## Limites et remise

Aucun test général, build, rendu, capture, contrôle visuel, approbation artistique ni FPS téléphone. Lisibilité à caméra de jeu non attestée. Atlas de matières répété, surfaces optiques opaques, flotteurs et propulsion rigides ; antenne articulée en bloc avec ressort géométrique, aucune simulation physique. Mélanges entre clips, collisions internes et déformations nationales non certifiés.

Les sources et le staging sont les seuls dossiers modifiés par ce spécialiste. Le coordinateur archive, intègre, commit et pousse. Aucun actif public, lot final, plan ou spécification modifié. La suppression indépendante de `.vscode/settings.json` est restée intacte.
