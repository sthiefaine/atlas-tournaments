# Cuirassé — création originale reproductible

`unite_cuirasse_base`, produit le 20 septembre 2026 en Three.js/TypeScript et Python NumPy/Pillow. Le coordinateur signale zéro upload lors de l’inventaire distant du jour et revérifie avant intégration. L’ancien candidat de 1 124 triangles, SHA-256 `755e446ea2dcd7057c2c63cff8cc394f3029fc5c08b12999878f7e4ebfa70c60`, et ses dix PNG ont été inspectés par code ; aucune de leurs données géométriques ou picturales n’est importée. Helpers de géométrie, atlas et GLB copiés localement du chasseur, dessin naval original. Aucun service payant ni opération Blender.

La coque est construite par couples avec une étrave pointue, une poupe étroite, des fonds arrondis par pans et une ligne de flottaison géométrique. Elle porte un pont antidérapant, des pavois, des bittes d’amarrage, un guindeau, des écubiers creux et des défenses épaisses. La passerelle arrière étagée possède des vitrages teintés, des montants, des hublots, des portes, des marchepieds, deux cheminées ouvertes et un radar court. La tourelle avant repose sur une couronne ; son long tube porte bagues, bouche creuse et verrou de route. Aucun texte, insigne, drapeau ou dommage.

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx scripts/production/modeles/unite_cuirasse_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_cuirasse_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_cuirasse_base/mesurer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_cuirasse_base/mesurer-poses.py
npm run controler:asset -- --spec assets/specs/unite_cuirasse_base.json --lot tmp/production-sequentielle/unite_cuirasse_base
npm run typecheck
```

Les quatre scripts acceptent un dossier de sortie facultatif. `inspecter-ancien.py [dossier-archive]` relit l’ancien candidat sans le modifier ; il refuse une empreinte différente. Sa sortie sert de référence de provenance, pas de source de géométrie.

## Lot et articulations

Un LOD0 de 7 216 triangles sur 9 000, huit primitives, deux matériaux (`mat_corps`, `mat_details`), six nœuds. Dimensions au repos : 0,710785 × 0,580000 × 0,950000 m. Emprise centrée, point bas Y=0, avant +Z. GLB : 485 048 octets ; GLB et cinq PNG : 1 654 610 octets, hors rapports. SHA-256 du GLB : `a6dcc16f7ae883fc3ea8a6ad31fc4570d3713b646b9ad6ec30ec661dc15072f4`.

`racine` reste identité ; `corps` porte tout le navire, `base` ses fonds sous la flottaison. `module_tourelle` pivote autour de +Y au-dessus du pont ; son enfant `module_canon_long` recule de 3,6 cm sur -Z et revient en place au tir. `socle` porte le témoin escamotable. Repos : léger pilonnement et veille de tourelle ; déplacement : roulis contenu, tube sur son verrou ; touché : roulis puis retour ; hors-jeu : amortissement, tube abaissé et témoin caché, pose tenue de 0,6 à 0,9 s.

Albédo et normale 1024², rugosité/métal/masque 512² ; atlas 4×4 répété entre matériaux avec gouttières. UV0, normales et tangentes explicites. Masque 0/255, gris strict sous le blanc. Rugosité en G, métal en B et copie éditable identique. Les cartes décrivent des pigments et microreliefs analytiques ; aucune lumière peinte, aucun transfert HD prétendu.

## Mesures et limites

`revue-technique.json` renvoie aux rapports de provenance, fabrication, géométrie/PBR, poses et contrôle. Les cinq clips font exactement 2 400/1 000/700/500/900 ms ; les boucles se ferment. Mesures Three.js aux clés et à 193 instants par clip, puis relecture indépendante du GLB avec NumPy : parité à 2 µm. Rayon horizontal continu majoré maximal 0,492767 m, soit au moins 14,46 mm entre deux voisins sous tout cap pour chaque clip seul. Le secteur avant de tourelle ±70° est également mesuré. Aucun triangle géométrique ou UV dégénéré ; normales et tangentes unitaires et orthogonales.

Contrôle complet du lot conforme, zéro motif ; typage réussi après la dernière modification TypeScript. `approbationArtistique: false`. Aucun test général, build, rendu, capture, contrôle visuel, relevé FPS ou essai téléphone. Vitrages opaques sans intérieur ; atlas de matières répété ; équipement de radar fixe. Les mesures n’attestent pas l’absence d’intersection interne, une rotation arrière traversant la passerelle ni les mélanges entre clips. Le point bas est mesuré aux échantillons, sans prétendre une preuve continue verticale.

Le coordinateur conserve l’ancien candidat, intègre et pousse ce modèle avant le suivant. Cette préparation ne modifie ni les actifs, ni le lot final, ni la spécification, ni le plan, et ne crée aucun commit.
