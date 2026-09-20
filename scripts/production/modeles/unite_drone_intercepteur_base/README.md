# Drone intercepteur — création originale

`unite_drone_intercepteur_base`, réalisé le 20 septembre 2026. Capsule effilée à épaules arrondies, deux ailes épaisses en flèche, deux admissions creuses et deux lanceurs de marqueurs dirigés vers le ciel. Le radar concave tourne dans les cinq clips du GLB. Coque opaque sans cockpit habité, nez et ailes gris neutre sous le masque d’équipe. Aucun texte, insigne, drapeau, dommage ou variante. +Y haut, +Z avant, racine fixe identité ; appareil aérien, `poseAuSol:false`.

L’ancien candidat a été inspecté par code avant création : **872 triangles**, **101 976 octets**, SHA-256 `996ffed9eb862b3e8240adb27fec8647d0330c7e844d8eec4b10d648a231e471` ; ses **12 PNG** ont été relus. Aucun fichier ancien n’a été modifié ou importé. L’inventaire distant communiqué ne signale aucun upload ; le coordinateur effectue la dernière vérification avant intégration.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_drone_intercepteur_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_intercepteur_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_intercepteur_base/mesurer.py
node --import tsx scripts/production/modeles/unite_drone_intercepteur_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_intercepteur_base/mesurer-poses.py
npm run controler:asset -- --spec assets/specs/unite_drone_intercepteur_base.json --lot tmp/production-sequentielle/unite_drone_intercepteur_base
npm run typecheck
```

Chaque script accepte un dossier de sortie facultatif. `inspecter-ancien.py [archive]` exige l’empreinte précédente. Helpers copiés localement ; aucune dépendance de génération entre modèles. Textures originales NumPy/Pillow déterministes, sans service externe ni bake HD. Les joints et microreliefs sont analytiques, les pigments ne contiennent aucun éclairage peint.

## Résultat technique

Un LOD0 à **3 380 / 3 500 triangles**, **cinq primitives**, deux matériaux exacts `mat_corps`/`mat_details` et cinq nœuds exacts `racine`/`corps`/`base`/`socle`/`module_radar`. Dimensions **0,926 × 0,471916 × 0,850 m**, dans les tolérances ; point bas statique à 0,098 m. GLB **200 868 octets**, GLB et cinq PNG **1 370 649 octets**. SHA-256 GLB `87804e9cd1dab17d9c1882c55610e15e73634bb554bd34750700079a4d9a68c6`.

Cinq clips exacts : `repos` 2 400 ms, `deplacement` 1 000 ms, `tir` 700 ms, `touche` 500 ms, `hors_jeu` 900 ms. Repos et déplacement ferment leurs boucles. `base` porte le recul vertical des deux lanceurs (22 mm) ; `module_radar` porte un tour complet, avec arrêt à 0,54 s dans hors-jeu. Hors-jeu abaisse et incline le corps sur le train, rétracte l’indicateur `socle` à zéro et conserve tous ses états après 0,62 s ; point bas final à 3 mm. La racine n’est jamais animée. Le runtime n’a pas besoin de faire tourner ce radar lui-même.

UV0, normales et tangentes explicites, finies et cohérentes. Aucune face géométrique ou UV dégénérée, superposition exacte dans une primitive ou normale opposée à l’orientation de ses triangles. Albédo et normale tangentielle +Y 1024² ; rugosité G, métal B et masque 512². Masque strict 0/255 et gris strict sous le blanc ; carte métal égale au canal B de la rugosité. Tous les PNG sont externes, sans copie embarquée ni saison.

**1 012 poses relues dans le GLB exporté**, indépendamment avec Three.js et NumPy, concordantes à 2 µm ; les mesures Three.js recoupent aussi la scène avant export. Rayon horizontal maximal **0,478274 m**, majoration continue **0,481090 m** : au moins **37,8 mm** entre deux voisins neutres sous tout cap pour chaque clip isolé. La majoration ajoute au rayon échantillonné la vitesse maximale des articulations multipliée par le demi-pas ; le témoin rétractable est borné séparément par sa sphère locale.

**Portée : GLB neutre et gabarit runtime b=[1,1,1] seulement.** Les étirements runtime `a=[.9,.98,1.06]` et `c=[1.14,1.06,.95]` ne sont pas certifiés. Le sol est contrôlé aux poses échantillonnées ; seule l’enveloppe horizontale reçoit une majoration continue.

Contrôle de lot **ok**, six fichiers acceptés, aucun motif ; typage **ok** après la dernière modification TypeScript. `revue-technique.json` porte l’identifiant exact et `approbationArtistique:false` dans le staging, avec une copie du présent README.

## Limites et remise

Aucun test général, build, rendu, capture, contrôle visuel, approbation artistique ni FPS téléphone. Lisibilité à caméra de jeu non attestée. Atlas de matières répété, surfaces optiques opaques, volets et train rigides ; aucune simulation physique. Mélanges entre clips, collisions internes et déformations nationales non certifiés.

Les sources et le staging sont les seuls dossiers modifiés par ce spécialiste. Le coordinateur archive, intègre, commit et pousse. Les spécifications, le plan, les actifs publics, le lot final et la suppression indépendante de `.vscode/settings.json` restent à sa charge ou intacts.
