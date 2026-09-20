# Bastion méridien — création originale LOD0

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Modèle `unite_meridien_bastion_base`, créé le 20 septembre 2026 dans un staging isolé. Coque basse octogonale aux extrémités resserrées, joues inclinées, chenilles à 34 patins par côté, six galets plus deux renvois et deux rouleaux de retour par train. Tourelle compacte, deux marqueurs creux de 160 mm parallèles vers +Z, parabole tournante et fouet sur un vrai ressort. Aucune variante, nationalité, livrée, inscription ou source géométrique externe.

Le candidat précédent a été inspecté numériquement avant la création : **1 132 triangles, 139 112 octets**, SHA-256 `5d747baa4976b7ff6a65cac36bd015f519c82cabd4e98c2bd322d16e25916eb6`. Ses douze PNG (six standard et six hiver) ont été ouverts et mesurés ; aucun n'est repris. Le coordinateur a reconfirmé l'absence d'upload du Bastion pendant cette production. L'ancien candidat et les données immuables restent du ressort de son intégration.

## Lot et géométrie

Un GLB et cinq PNG voisins : **8 996 triangles sur 9 000**, neuf primitives, deux matériaux (`mat_corps`, `mat_details`), **1 809 557 octets** au total dont **639 292 octets** de GLB. Dimensions réellement relues : **0,698638 × 0,615340 × 0,892500 m**. Racine identité, avant +Z, haut +Y, base fixe au sol. Les huit nœuds comprennent les sept noms contractuels et l'articulation rigide supplémentaire `os_recul`. Aucun squelette skinné n'est nécessaire à ces assemblages mécaniques.

Les roues ont été réespacées avant livraison. Des fourreaux réellement creux entourent les quatre tiges de suspension ; celles-ci restent engagées d'au moins 11,5 mm. Les têtes de moyeux et supports sont des assemblages raccordés, pas des pièces censées rester séparées. Les tubes portent une paroi intérieure et une couronne de bouche : leurs optiques se trouvent en retrait, sans projectile. Les plages de triangles de chaque pièce sont conservées dans `extras.pieces` pour permettre une relecture mécanique du GLB.

## Matières et animation

Albédo et normale 1024² ; métal, rugosité et masque 512². Rugosité en G et métal en B du PNG rugosité, avec carte métal éditable identique à B. Les panneaux d'équipe du glacis et de la tourelle restent strictement gris et le masque est strictement 0/255. Caoutchouc, métal nu, composites et optiques restent noirs dans le masque. Atlas 4×4 avec marge UV, pigments sans lumière peinte et microreliefs analytiques déterministes ; **aucun bake HD**. Pas de carte d'émission optionnelle : le témoin ambré est non lumineux.

Les cinq clips contractuels sont `repos` 2 400 ms, `deplacement` 1 000 ms, `tir` 700 ms, `touche` 500 ms et `hors_jeu` 900 ms. Radar en rotation dans les deux boucles, suspension verticale raccordée et fouet oscillant. Les deux marqueurs reculent brièvement sans projectile. `hors_jeu` conserve son affaissement pendant ses 350 dernières millisecondes et escamote le témoin `socle` ; le moteur conserve désormais cette pose finale. Les boucles raccordent poses et vitesses de jointure, en tenant compte du signe équivalent des quaternions. Chenilles et galets restent rigides, sans défilement.

## Mesures et limites

Les positions, matrices, indices, UV, normales, tangentes et clips ont été relus dans le GLB exporté. **977 poses** comparées entre Three.js sans rendu et NumPy à 2 µm près. Aucun triangle dégénéré, superposé à l'identique ou à normale inversée ; aucun triangle UV dégénéré. Temps FLOAT SCALAR à bornes min/max conservées, clips de durées exactes. Masque et neutralité des zones d'équipe contrôlés pixel par pixel.

Le rayon horizontal échantillonné est **0,490129 m**. Une majoration continue par vitesse donne moins de **0,493010 m** entre les poses. Une borne analytique distincte couvre aussi **tous les azimuts de tourelle et de radar**, les reculs et le fouet des clips livrés : rayon maximal **0,490129 m**, soit **19,743 mm** d'espace minimal entre deux unités voisines dans ce gabarit. Cela concerne le gabarit b `[1,1,1]` effectivement utilisé par `atl`, pas les déformations nationales a/c ni les mélanges arbitraires de clips.

Les **47 mesures mécaniques localisées** relisent les vrais triangles : galets voisins, renvois, patins/bandes, caisse/jupes au point bas, coulisseaux/fourreaux et tubes jumelés. Jeu géométrique minimum positif de **0,902 mm** aux coulisseaux. Spires : **7,227 mm** entre portions distinctes du fil et **7,864 mm** autour de l'âme. Parabole/tubes : séparation verticale d'au moins 50 mm ; parabole/fouet : borne horizontale positive pendant le balayage. Ce sont des contrôles localisés, **pas une certification globale de collision ou de qualité artistique**. Les assemblages qui se raccordent intentionnellement sont explicitement exclus de cette interprétation.

`validation-lot.json` porte le contrôle ciblé réussi. `validation-typage.json` porte le typage complet exécuté après la dernière modification TypeScript, y compris `scripts/production/verifier-publication.ts`, avec empreintes des sources. Aucun test général, build, rendu, capture, contrôle visuel, approbation artistique, essai téléphone ou chiffre FPS. Lisibilité et appréciation artistique restent humaines ; l'activation technique ne les atteste pas.

## Reproduction depuis la racine du dépôt

```sh
node --import tsx scripts/production/modeles/unite_meridien_bastion_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_bastion_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_bastion_base/verifier.py
cp scripts/production/modeles/unite_meridien_bastion_base/README.md tmp/production-sequentielle/unite_meridien_bastion_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_bastion_base/assembler-revue.py
```

Three.js/tsx du dépôt, Python avec NumPy/Pillow. Le dossier de sortie peut être donné en premier argument. `inspecter-ancien.py` est le contrôle préalable conservé ; après intégration, il faut lui fournir l'état historique du candidat, pas l'exécuter contre le nouveau lot. La génération et les mesures n'écrivent que dans le staging. Le helper GLB local dérive de celui du furtif et conserve les bornes d'entrées d'animation. Les scripts ne modifient aucun actif, lot officiel, spécification, plan ou registre et ne font aucune opération Git. `revue-technique.json` lie les fichiers, mesures et sources à leurs SHA-256.
