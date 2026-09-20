# Chasseur furtif — base originale

Création paramétrique propre à `unite_furtif_base`, sans import de maillage ou de texture de l’ancien candidat. Un seul LOD0 neutre, sans kit national, saison ou région. Le contrat air/vol fait foi malgré le mot « ground vehicle » dans la description anglaise héritée. La spécification n’a pas été modifiée.

La silhouette associe une voilure intégrée large et effilée, un bord de fuite à décrochements, un fuselage étroit à facettes et une cabine avancée anguleuse. Le pont dorsal bas porte deux entrées creuses ; l’arrière comporte deux sorties rectangulaires autour d’une quille centrale étroite. Il n’y a ni dérive haute ni nacelle moteur externe. L’antenne de tournoi conserve un vrai ressort, une âme et un fouet épais. Le matériel est entretenu, sans texte, signe national, marque ou dommage de combat.

## Fichiers et chiffres figés

Le staging est `tmp/production-sequentielle/unite_furtif_base`. Le lot comprend le GLB et cinq PNG externes : **5 088 triangles sur 9 000**, cinq primitives, deux matériaux (`mat_corps`, `mat_details`), **1 479 343 octets**. GLB seul : **308 892 octets**.

SHA-256 GLB : `e85a5b25fde204b5f8dd3aa26785c1e24f24f6c3ecdb81c58188ab1bb920f55b`.

Dimensions mesurées dans le fichier : **0,950 × 0,462 × 0,850 m**, contre 0,950 × 0,450 × 0,850 m, tolérance 0,090 m par axe. Racine identité au centre du plan de la case, +Y haut et +Z avant ; pose de vol, sans promesse de contact au sol. Nœuds : `racine > corps > base / socle / module_antenne`. La racine n’est pas animée. `base` porte la cassette de marquage, `socle` le témoin escamotable.

L’ancien candidat a été inspecté en lecture : 704 triangles, GLB 82 952 octets, SHA `19de1007e96194fef9dddc1aa459a57b8025d82ea80df60cf4ed290b0006557b`. Son GLB et ses PNG ne sont pas utilisés pour fabriquer le nouveau. Le coordinateur revérifie l’absence d’un upload juste avant l’activation et gère les archives, les actifs et la publication.

## Matières et animations

Atlas 4 × 4, UV réservées à l’intérieur des cellules avec gouttières. Albédo et normale 1024² ; rugosité, métal et masque 512². Pigments et microreliefs analytiques déterministes : peau de peinture, joints, fixations, métal brossé et caoutchouc. Aucun éclairage, reflet ni occlusion n’est calculé dans l’albédo ; aucun bake HD n’est revendiqué. Normales +Y tangent ; rugosité en G et métal en B de la carte glTF, la carte métal séparée lui est identique. Le masque est strictement 0/255 et l’albédo des zones blanches est gris neutre. Métal, vitrages, caoutchouc et témoin restent noirs dans le masque. Pas d’émission.

Cinq clips, sans translation de la racine :

- `repos` 2 400 ms : légère suspension et réponse de l’antenne, raccord exact de boucle.
- `deplacement` 1 000 ms : assiette légèrement abaissée, petit roulis et flexion rigide de l’antenne, raccord exact.
- `tir` 700 ms : recul puis récupération de la cassette vers −Z, représentant le marquage dirigé +Z. Aucun projectile ou effet d’explosion en géométrie.
- `touche` 500 ms : bref roulis et récupération, sans géométrie de dommage.
- `hors_jeu` 900 ms : descente discrète, inclinaison tenue et témoin `socle` à échelle nulle ; toutes les pistes conservent leur pose finale.

Le ressort utilise un fil de 21 mm, un rayon central de 35 mm et trois tours sur 90 mm ; l’âme fait 20 mm. Le fouet et les arceaux font au moins 21 mm. Le maillage du ressort est localement dense (2 304 triangles), dans le budget total inchangé. Toutes les pièces de l’antenne suivent la même articulation : les jeux internes restent invariants dans les clips.

## Mesures techniques et limites

Le contrôle de lot et `npm run typecheck` passent après la dernière édition TypeScript. Aucun triangle ou UV dégénéré, aucune face dupliquée identique, normales et tangentes unitaires et orthogonales, valeurs finies et temps d’animation FLOAT SCALAR avec min/max cohérents. Les deux boucles ont les mêmes valeurs au début et à la fin.

Les clips du GLB sont relus séparément par Three.js puis NumPy : **974 poses**, rayon horizontal maximal **0,487327 m**. La majoration continue par les vitesses de translation/slerp donne **0,488180 m**, soit au moins **23,64 mm** entre deux enveloppes neutres voisines, tous bearings. La hauteur reste positive aux instants mesurés. Ces mesures ne certifient ni les gabarits nationaux appliqués au runtime, ni les mélanges de clips.

Le ressort relu présente **14,447 mm** de jeu radial minimal avec l’âme et **8,734 mm** entre spires ; aucune intersection sur les 63 864 paires de faces retenues par la borne AABB. Les faces écartées sont séparées d’au moins 20 mm. Les portions contiguës du même fil sont des raccords intentionnels. Les deux conduits arrière ont un volume libre de coque prouvé par séparation des AABB de triangles ; 18 rayons entre les diffuseurs atteignent leur fond reculé à 56 mm sans obstacle préalable.

Ces résultats sont des contrôles numériques ciblés. **Aucun test général, build, rendu, capture, contrôle visuel ou approbation artistique. Aucun téléphone ni mesure FPS.** Les collisions internes complètes et les raccordements visuels des effets de tir ne sont pas certifiés. Le rapport `revue-technique.json` recense les empreintes, les mesures et les limites. L’intégration et la publication appartiennent au coordinateur ; elles ne constituent pas une approbation artistique.

## Reproduction

Depuis la racine du dépôt, avec les dépendances Node du projet et Python NumPy/Pillow déjà installées :

```sh
node --import tsx scripts/production/modeles/unite_furtif_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_furtif_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_furtif_base/mesurer.py
node --import tsx scripts/production/modeles/unite_furtif_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_furtif_base/mesurer-poses.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_furtif_base/mesurer-ressort.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_furtif_base/mesurer-conduits.py
npm run controler:asset -- --spec assets/specs/unite_furtif_base.json --lot tmp/production-sequentielle/unite_furtif_base
npm run typecheck
```

`inspecter-ancien.py` vise le candidat historique et vérifie son SHA : après remplacement, lui fournir le dossier archivé correspondant. Les helpers d’export et de mesures sont copiés localement ; la génération ne dépend d’aucun dossier d’un autre modèle.
