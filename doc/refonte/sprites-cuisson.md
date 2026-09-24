# Sprites — la cuisson (23 septembre 2026)

Décision du propriétaire du 23 septembre (`BRIEF.md`, « Sprites précalculés ») : le jeu ne dessine plus de 3D en temps réel, il **photographie** ses modèles GLB une fois, hors ligne, et compose ces images en WebGL 2. Le contrat entre la cuisson et le rendu est `src/render2d/contrat.ts` ; le rendu est décrit par `doc/18-rendu-sprites.md`. Ce document décrit la chaîne de cuisson (`scripts/sprites/`, agent A de `doc/refonte/plan-sprites-campagne.md`), ses réglages mesurés, ce qu'elle a produit et ce qu'elle ne vérifie pas.

## La commande

```
npm run cuire:sprites -- --tout                       # le catalogue livré (41 entrées)
npm run cuire:sprites -- --famille unite              # une famille : unite, batiment, terrain, decor
npm run cuire:sprites -- --id unite_char_leger_base   # une entrée (répétable)
npm run cuire:sprites -- --liste assets/sources-sprites/decor/liste.json   # des sources d'ailleurs
```

Options : `--force` recuit même ce qui n'a pas changé ; `--sortie <dossier>` écrit ailleurs que `public/assets/sprites` ; `--paralleles <n>` (2 par défaut) ; `--echantillons <n>` ; `--garder-brut` garde les rendus à l'échelle 4 dans `tmp/sprites/brut/`. La variable `BLENDER` désigne un autre exécutable que `/Applications/Blender.app/Contents/MacOS/Blender` (5.1.1).

**Une entrée n'est recuite que si quelque chose a changé** : l'empreinte de cuisson (dans le fichier d'entrée) couvre le SHA-256 du GLB, celui de chacune de ses images et de son masque, tous les réglages de `scripts/sprites/reglages.ts`, le plan de vues et de clips, et `VERSION_CUISSON`. Changer le script Blender ou le traitement Node sans toucher un réglage n'est **pas** vu : c'est `VERSION_CUISSON` qu'on incrémente alors.

**Recuire une entrée** après une livraison de GLB : `npm run cuire:sprites -- --id <id>`. Le manifeste est régénéré à chaque cuisson à partir des fichiers d'entrée présents, donc cuire une entrée seule ne perd pas les autres. `tests/sprites/manifeste.test.ts` échoue tant qu'une entrée n'a pas été recuite depuis sa source courante (SHA-256 comparé).

## Ce qui se cuit

- **Le catalogue** : ce qui est livré dans `public/assets/modeles/` — les 30 unités communes (`unite_<clé>_base`), les 6 bâtiments communs et les 2 QG nationaux (`batiment_qg_fr`, `batiment_qg_lu`, variante = le pays), les 2 rochers (`decor_rocher_archipel`, `decor_rocher_cotier` : clé `rocher`, variante = le biome) et le pont (`terrain_pont`). Les quatre autres terrains livrés (plaine, forêt, rivière, route) ne se cuisent pas : le sol est un nuanceur (`render2d/sol/`) et la forêt vient des essences de décor.
- **Une liste** (`--liste`) : `{ "version": 1, "entrees": [{ id, famille, cle, variante?, fichier, vues?, ombre? }] }`, `fichier` relatif au dossier de la liste — le format du décor de l'agent B (`assets/sources-sprites/decor/liste.json`, `doc/refonte/sprites-decor.md`) et de la calibration (`scripts/sprites/calibration/liste.json`). Une liste fausse est refusée, pas devinée.

**Vues et clips** (`catalogue.ts`, `planVues`) — rien n'est inventé, un clip absent du GLB n'est pas photographié :

| Famille | Vues et clips |
|---|---|
| unité | `deplacement` en `droite`, `bas`, `haut` ; tous ses clips (`repos`, `deplacement`, `tir`, `touche`, `hors_jeu`, `capture`) en `droite` ; `repos`, `tir`, `touche`, `hors_jeu` en `profil` |
| bâtiment | `fixe` : tous ses clips (`repos`, `capture`, et `touche` pour les QG) |
| pont | `fixe` et `travers`, une image (le GLB n'a pas de clip) |
| rocher, décor | `fixe` (ou les vues de la liste) : `repos` animé s'il existe, une image sinon |

Une vue sans aucun clip reçoit une image fixe, la pose de repos, sous le nom `repos`. Les animations sont rangées vue par vue dans l'ordre de `VUES`, clip par clip dans l'ordre de `CLIPS` : la première est `droite/repos` pour une unité, `fixe/repos` pour le reste — mais le rendu les cherche par (vue, clip), jamais par rang.

**Échantillonnage** (`echantillonnage.ts`) : à `IMAGES_PAR_SECONDE` (12) sur la durée réelle du clip, lue dans le GLB, au plus `IMAGES_MAX_PAR_CLIP` (12) images. Un clip qui boucle se découpe sur `[0, durée[`, un clip qui joue une fois sur `[0, durée]` — sa dernière pose est photographiée, celle de `hors_jeu` reste à l'écran. Un clip plus long est échantillonné plus lâchement et son `ips` baisse d'autant : `repos` (2,4 s) passe à 12 images à 5 images par seconde, le `repos` d'un bâtiment (3,2 s) à 3,75, `capture` (1,3 s) à 8,5. La durée lue reste la vraie. `boucle` vaut vrai pour `repos` et `deplacement`, faux sinon (`clipEnBoucle`, la règle de la 3D).

## La chaîne

1. **Préparation** (`glb.ts`). L'importeur glTF de Blender 5.1 ne connaît pas `EXT_meshopt_compression`, que portent six GLB livrés (infanterie, char léger, anti-air, artillerie, barge, QG) : ils sont décompressés sans perte par le décodeur de contrôle du dépôt (`src/assets/compression-glb.ts`), et la copie donnée à Blender pointe ses images en chemin absolu. Le masque d'équipe est l'image dont le nom contient `masque_equipe` (la règle du validateur et de la 3D) ; aucun matériau ne la référence, le script Blender la charge lui-même.
2. **Rendu** (`blender/cuire_entree.py`, Blender 5.1.1 en ligne de commande). Une scène vide, le modèle importé sous un pivot à l'origine qui porte le lacet de la vue, la caméra du contrat, l'éclairage, et Cycles. Chaque image est écrite en EXR multicouche (demi-flottants), relue par OpenImageIO et versée en entiers de 16 bits dans un fichier brut par (vue, clip), avec un `resultat.json` qui dit comment le lire.
3. **Réduction, calques, rognage** (`image.ts`, Node, pur et testé). Voir plus bas.
4. **Pages** (`emballage.ts`) : les images d'une entrée, dédoublonnées octet pour octet, rangées sur des étagères dans des pages d'au plus 2 048 × 2 048 (largeur essayée parmi 256, 512, 1 024, 2 048, retenue au plus petit nombre de pages puis à la plus petite surface, côtés arrondis au multiple de quatre). Bordure transparente d'un pixel autour de chaque image, espacement de quatre entre deux images.
5. **Encodage** (`sharp`) : couleur en WebP avec alpha (qualité 90, alpha sans perte, `exact`), masque en PNG niveaux de gris, émission en WebP sans alpha. Un fichier d'entrée `<famille>/<id>.json` (`{ entree, cuisson }`), puis `manifeste.json` régénéré.

Chemins : `public/assets/sprites/{unites,batiments,terrains,decors}/<id>_<n>.webp`, `<id>_<n>_masque.png`, `<id>_<n>_emission.webp`. Dans le manifeste, sans barre initiale : `assets/sprites/unites/unite_char_leger_base_0.webp`.

### La caméra

Orthographique, lacet nul, tangage `TANGAGE_CARTE` (50°) ou `TANGAGE_PROFIL` (12°) pour `profil`. Dans Blender : la carte est le plan XY, sa colonne va vers +X, sa ligne descend vers le joueur, soit −Y ; l'importeur envoie l'avant glTF (+Z) sur −Y, donc un modèle importé regarde déjà le joueur — le lacet 0 de `LACET_VUE` — et le pivot tourne de `+lacet` autour de Z pour qu'il regarde la direction de la vue (90° : la droite de l'écran, +X). La caméra est tournée de `90° − tangage` autour de X ; son cadre couvre, dans le plan de `versPlan`, `[x0, x0 + l] × [y0, y0 + h]` en pixels, calculé pour contenir le modèle dans **toutes** les images de la vue (enveloppes évaluées, animations comprises, ombre portée et marge d'occlusion pour ce qui est ombré). `ortho_scale` vaut `l / 128`, la résolution `4l × 4h`. Un pixel de l'image réduite vaut donc exactement un pixel de plan, et le pivot tombe sur un entier : `px = −x0 − rognage.x`, `py = −y0 − rognage.y`, en coordonnées continues (le pixel (0, 0) couvre [0, 1[²).

**Prouvé par la mesure**, pas supposé : `scripts/sprites/calibration/` écrit trois GLB (un carré de 1 m au sol, quatre cubes de couleur — devant, à droite du modèle, en l'air, sur l'origine —, un pilier ombré), cuits par la vraie chaîne dans `tests/sprites/calibration/`, et `tests/sprites/calibration.test.ts` mesure les images :

- le carré couvre **128 colonnes pleines et 98,08 lignes** (attendu 128 × 98,05), aire 12 550 px² pour 12 551, centre d'alpha sur le pivot à **0,000 px** ;
- dans les six vues, le centre de chaque cube tombe à **moins de 0,01 px** de sa projection calculée par `versPlan` et `LACET_VUE` (le pire : 0,19 px, un cube en partie caché de profil) ; `droite` met l'avant du modèle 30 px et plus à droite du pivot, `haut` l'éloigne, `bas` le rapproche, et le cube en l'air monte d'autant plus que la vue est rasante ;
- l'ombre du pilier part vers le haut et la droite de l'écran, à l'opposé de la principale.

### La lumière

Les directions sont celles de `ECLAIRAGE_CUISSON` (principale azimut −40°, élévation 55° ; contour azimut 180°, élévation 30°) ; les forces sont réglées pour qu'une **face horizontale blanche sorte à 1,0 exactement** : principale `2,2/π × sin 55°` + contour `0,8/π × sin 30°` + ciel `0,3` = 1,00. Un albédo s'y lit donc tel quel, et une zone d'équipe cuite en blanc, multipliée à l'écran par la couleur d'équipe, rend cette couleur et pas plus claire. Une face tournée vers le joueur (verticale) reçoit 0,61, celle tournée vers la caméra 0,94, le flanc droit, à l'ombre, 0,30. Lumières blanches : la saison, la phase et la météo sont l'étalonnage du rendu. Le contour ne porte pas d'ombre (une seconde ombre, côté joueur, contredirait la première) ; le soleil principal a un diamètre de 3°.

**L'occlusion ambiante** est celle du ciel en lancer de chemins : le ciel uniforme (0,3) éclaire tout et s'éteint dans les creux. **Aucune ombre portée n'est cuite pour une unité** (le rendu pose `OMBRE_UNITE`) ; bâtiments, rochers, pont et décor ont un attrapeur d'ombre à 2 mm sous le sol, qui prend l'ombre de la principale et l'occlusion du ciel. L'attrapeur est invisible mais renvoie la lumière sur le modèle : il a l'albédo d'un sol (0,25), pas le gris clair par défaut de Cycles, qui éclairerait le pied des murs par en dessous. Une unité n'a pas de sol : le ciel l'éclaire aussi par en dessous, ce qui ne se voit que sous un appareil en vol. Cette occlusion assombrit encore le sol de plus de 1 % à plus d'un mètre d'un bâtiment : aucun canevas ne la contient. Le canevas en garde 35 cm autour de l'emprise, et une ombre (un pixel sans surface du modèle) **descend à zéro sur les dix pixels qui précèdent le bord** du canevas, pour ne jamais dessiner de trait droit sur l'herbe ; une ombre plus faible que 3/255 est effacée.

**Gestion des couleurs** : l'EXR est en lumière linéaire (Rec. 709), sans transformation de vue ; la vue « Standard » de Blender — la fonction sRGB par morceaux, sans courbe — est appliquée par Node **après** la réduction (`lineaireVersSrgb`). Aucune courbe AgX ni Filmic : un albédo sRGB ressort tel quel sous la lumière de référence.

### Le rendu Cycles, mesuré

Cycles sur le processeur graphique Metal du M1 (8 cœurs), lancer de chemins avec ciel, rebonds limités (6 au total), échantillonnage adaptatif (seuil 0,01), chaque image dans une scène neuve. Les données persistantes entre images ont été retirées le 24 septembre 2026 (`VERSION_CUISSON` 4) : avec le flou de bouge, la première image immobile après un mouvement sortait parfois ombrée de travers, 6 à 12 % plus sombre, selon l'historique des rendus ; sans elles, une cuisson prend 30 % de plus (char léger : 126 s au lieu de 99). EEVEE n'a pas été retenu : il n'a pas d'attrapeur d'ombre, et l'ombre cuite des bâtiments en dépend.

Le nombre d'échantillons et le débruitage ont été **choisis par la mesure** (`tmp/sprites/etude.ts`, non versionné) : le char léger, vue `droite`, trois images de `repos`, comparées à une référence de 1 024 échantillons sans débruitage, écart quadratique moyen en niveaux sur 255 de la couleur prémultipliée livrée :

| Réglage | Écart | Temps par image (machine chargée) |
|---|---:|---:|
| 32 échantillons, OIDN préfiltre `ACCURATE` | 0,62 | 2,65 s |
| 16, OIDN `ACCURATE` | 0,80–0,81 | 1,79–2,86 s |
| 16, OIDN `FAST` | 0,82 | 2,60 s |
| 16, OIDN sur la couleur seule (`NONE`) | 0,82 | 1,57 s |
| 16, sans débruitage | 0,85 | 0,94–1,53 s |
| 24, sans débruitage | 0,73 | 1,37 s |
| 32, sans débruitage | 0,64 | 1,73 s |
| 8, OIDN `ACCURATE` | 1,10 | 1,11 s |

**Le flou de bouge**, mesuré sur l'hélicoptère (`tmp/sprites/flou.ts`, non versionné) : son rotor tourne de 1 200° par seconde, soit 100° entre deux images de `deplacement` et 240° entre deux images de `repos` (5 images par seconde) — à quatre pales, il paraît presque arrêté ou tourner à l'envers. L'obturateur est donc ouvert **la moitié du pas** entre deux images, centré sur l'instant photographié, comme une caméra de cinéma : l'écart d'alpha moyen d'une image à la suivante passe de 11,6 à 5,8 en `deplacement` et de 11,8 à 3,7 en `repos`, la part de pixels semi-transparents (le disque du rotor) de 12 à 27 %, pour 2 % de temps de rendu en plus en `deplacement` (la mesure du `repos` a doublé, sous une charge qui variait de 400 à 600 : non concluant). L'enveloppe du canevas compte les instants d'ouverture et de fermeture de l'obturateur, sans quoi un flou serait rogné. Une image fixe n'a pas de flou.

La leçon : à l'échelle 4, la réduction **est** le débruitage — elle moyenne seize pixels rendus, soit une variance divisée par seize —, et le débruiteur n'y gagne plus que 0,03 à 0,04 niveau ; avec ses passes d'albédo et de normales, il coûte 55 à 85 % de temps en plus. Retenu : **24 échantillons, OIDN sur la couleur seule** (le débruitage demandé, presque gratuit). Les temps varient du simple au double avec la charge de la machine, qui a oscillé entre 20 et plus de 600 pendant ce chantier (six autres agents) : ils se comparent entre eux, pas dans l'absolu.

### De l'échelle 4 à l'échelle 1

`image.ts`, pur, testé sur des images construites à la main (`tests/sprites/image.test.ts`) :

- **moyenne exacte des blocs 4 × 4**, en lumière linéaire et sur des valeurs prémultipliées — ce que ferait un rendu à l'échelle 1 avec seize fois plus d'échantillons sur une grille régulière. `sharp.resize` ne le garantit pas (son noyau et le `gap` de libvips mélangent boîte et filtre), et moyenner des valeurs sRGB assombrit les bords contrastés : un bord blanc à moitié couvert sort blanc à 50 % d'alpha, pas gris ; noir et blanc moyennés donnent 188, pas 128. `sharp` n'encode que le résultat ;
- la couleur livrée est **non prémultipliée** (WebP), étendue de deux pixels sous les pixels transparents voisins : un rendu qui filtrerait sans prémultiplier ne verrait pas de liseré noir. Le rendu 2D prémultiplie de toute façon au téléversement (`render2d/atlas.ts`) ;
- chaque image est rognée au plus près des pixels d'alpha non nul, plus une bordure transparente d'un pixel ; un modèle qui touche le bord du canevas est signalé (`avertissements` du fichier d'entrée) — le canevas était trop juste ;
- le pivot : `px`, `py` en pixels depuis le coin haut-gauche du rectangle, pixels continus ; il peut sortir du rectangle (un appareil en vol est au-dessus de son pied).

### Le masque d'équipe

Sur les matériaux que la 3D teint (`materiau_teinte`, la règle de `couleurPour` et du décor), l'albédo est remplacé par **blanc** là où le masque vaut 1 (`COULEUR_ZONE_EQUIPE_CUISSON`), et le masque (0 à 255) est écrit en AOV, aux mêmes coordonnées : une page `…_masque.png` en niveaux de gris. Il est **divisé par la couverture du modèle** (une seconde AOV, 1 sur toute surface du modèle), pas par l'alpha — l'alpha compte aussi l'ombre au sol. À l'écran, `couleur × mix(1, équipe, masque)` rend exactement la couleur d'équipe éclairée, ce que fait la 3D en mélangeant l'albédo vers la couleur.

- Unités (base) : `mat_corps`, `mat_details`, `equipe*`, `accent*`. **Mesuré** en échantillonnant le masque aux UV de chaque maillage : dans les 30 unités, le masque ne couvre **jamais** `mat_details` (0 %), et couvre `mat_corps` de 0,1 % (barge) à 100 % (dix-neuf unités : la géométrie de base est teinte en entier, c'est le repli du placeholder, `doc/11` §5.2). Or la 3D teint `mat_corps` de `palette.main` — la couleur d'équipe du contrat — et `mat_details` de `palette.dark` : la cuisson en blanc est donc exacte pour tout le catalogue. Si un GLB masquait un jour `mat_details`, il sortirait en couleur principale au lieu de la sombre (en lumière linéaire, la sombre vaut 0,27 à 0,43 fois la principale selon les 28 palettes).
- Bâtiments : tous les matériaux, comme le décor 3D ; mesuré, le masque ne couvre jamais `mat_vitrage`, et couvre `mat_corps` de 4,5 à 12,5 % (bases) ou 100 % (QG nationaux).
- Les pages de masque existent pour toute entrée dont le GLB porte un masque, et seulement pour elles.
- **Une vérification ajoutée après coup** : la première version relisait la combinée sous le nom de chaque passe (`read_image(0, …)` lit la partie 0 de l'EXR, quelle que soit la partie choisie) — le masque valait la couleur rouge, et couvrait 100 % du char léger. `tests/sprites/manifeste.test.ts` exige désormais que le char léger et l'infanterie, dont le masque couvre 8 et 9 % de `mat_corps` aux UV, ne soient teints que sur 1 à 40 % de leurs pixels visibles (mesuré après correction : 8,7 % pour le char léger de trois quarts, 12,2 % de profil).

### L'émission

- Bâtiments : les matériaux émissifs (les fenêtres, `mat_vitrage`) sont **éteints dans la couleur** et leur lumière propre (couleur d'émission × force, telle que la caméra la voit, prémultipliée par la couverture) va dans une page `…_emission.webp`, encodée sRGB, que le rendu **ajoute** — la 3D les allumait à 0,06 le jour et 1 la nuit (`fenetres`). Le QG commun a une image d'émission que ses matériaux ne référencent pas : la 3D ne l'allume pas, la cuisson non plus.
- Unités : l'émission (les voyants du brouilleur) reste dans la couleur, comme en 3D, où elle n'est jamais modulée. Pas de page d'émission.

### L'échelle

La même qu'en jeu : une case vaut un mètre, et un modèle livré n'est jamais mis à l'échelle (`render3d/modeles.ts`, `monterModele`). Le gabarit `a | b | c` d'une nation (`gabaritDe`) ne s'applique qu'avec un style national ; une entrée de base est cuite au gabarit `b`, l'identité. Le socle à liseré que la 3D posait sous une figurine n'est pas dans le GLB et n'est pas cuit. Les appareils sont modélisés à leur hauteur de vol (`poseAuSol: false`, `doc/11` §4.2) : leur image est au-dessus de leur pivot, qui reste le pied, au sol.

## Ce que le rendu doit savoir des images

- **Pivot** : `px`, `py` sont le point de contact au sol, au centre de la case, en pixels continus depuis le coin haut-gauche du rectangle ; poser le rectangle à `plan − (px, py)`, un pixel d'image pour un pixel de plan à l'échelle 1.
- **Appareils** : les GLB des unités aériennes sont modélisés **à leur hauteur de vol**, et elle n'est pas la même d'un modèle à l'autre — bas de la silhouette au repos, mesuré : transport aérien 0 m (posé), veilleur 0,04, drone ravitailleur 0,06, drone et furtif 0,07, intercepteur 0,10, hélicoptère 0,17, bombardier 0,32, chasseur 0,33. L'image cuite est déjà au-dessus du pivot, qui reste le pied. Une hauteur de vol ajoutée par le rendu (`InstanceSprite.h`, `HAUTEUR_VOL` de 0,34 case dans `render2d/unites.ts` à ce jour) s'ajoute à celle-là.
- **Clips par vue** : `bas` et `haut` n'ont que `deplacement` ; `repos`, `tir`, `touche`, `hors_jeu` et `capture` ne sont qu'en `droite` (la gauche par miroir) et, sauf `capture`, en `profil`.
- **Cadence** : chaque animation porte son `ips` ; il vaut 12 pour les clips courts, moins pour les clips plafonnés à 12 images (`repos` 5, `repos` d'un bâtiment 3,75, `capture` 8,5). La dernière image d'un clip qui ne boucle pas tombe exactement à sa durée.
- **Masque** : niveaux de gris, non prémultiplié, 0 hors du modèle ; les zones d'équipe sont cuites en blanc, éclairées. Un bâtiment **neutre** reçu sans couleur d'équipe montrerait ces zones en blanc, là où la 3D laissait l'albédo neutre (gris de 128 à 190) : lui passer un gris (la palette neutre, `#b9bec7`) garde la lecture « sans propriétaire ».
- **Émission** : lumière linéaire encodée sRGB, prémultipliée par la couverture, à **ajouter** après la couleur, pondérée comme la 3D le faisait (`fenetres` : 0,06 le jour, 1 la nuit).
- **Mipmaps** : six pixels transparents séparent deux silhouettes d'une page (bordure d'un pixel de chaque côté, quatre d'espacement) ; au-delà du niveau 2 (une image affichée au quart de sa taille), une silhouette voisine peut baver. Borner `TEXTURE_MAX_LEVEL` à 2 l'évite.
- **Ombres** : une unité n'a pas d'ombre cuite (`OMBRE_UNITE`) ; un bâtiment, un rocher, le pont et le décor ont la leur dans l'image, noire et translucide, fondue à zéro au bord du canevas.

## Ce que la cuisson a produit

Cuisson complète du 23 septembre 2026 (`npm run cuire:sprites -- --tout --liste assets/sources-sprites/decor/liste.json`) : **101 entrées, aucun échec, aucun avertissement, 82 minutes**, deux Blender de front, sur une machine partagée dont la charge a varié de 60 à 640. 3 678 images rendues à l'échelle 4, en 100,8 minutes de rendu cumulées : **1,64 s par image et par Blender**.

| Famille | Entrées | Images (uniques) | Pages | Poids | Temps cumulé (dont rendu) |
|---|---:|---:|---:|---:|---:|
| unités | 30 | 3 404 (3 316) | 30 | 15,93 Mo | 105,7 min (66,8) |
| bâtiments | 8 | 210 (210) | 8 | 0,94 Mo | 38,5 min (27,7) |
| décor (60 sources de l'agent B, 2 rochers) | 62 | 62 | 62 | 0,19 Mo | 18,6 min (6,1) |
| terrain (le pont) | 1 | 2 | 1 | 0,01 Mo | 0,8 min (0,2) |

Avec les fichiers d'entrée et le manifeste (283 Ko), **17,92 Mo** en tout, pour un budget de 40. Une unité tient dans une page (de 285 Ko pour le méca à 837 Ko pour l'hélicoptère, dont le rotor flou pèse), un bâtiment fait 90 à 146 Ko, un élément de décor 1 à 6 Ko. Les « images uniques » comptent les images identiques octet pour octet, qui partagent leur rectangle : la graine de Cycles étant fixe, deux instants où rien ne bouge donnent la même image.

Une entrée inchangée n'est pas recuite : `npm run cuire:sprites -- --id unite_char_leger_base` rend « inchangée, pas recuite » en une seconde et régénère le manifeste des 101 entrées.

**Trois défauts trouvés en chemin, et corrigés** :

1. l'EXR multicouche de Blender 5.1 range chaque passe dans sa partie, et `read_image(0, …)` relit la partie 0 quelle que soit la partie choisie : le masque et la couverture valaient la couleur rouge, le masque couvrait tout. Trouvé par la mesure (100 % des pixels teints sur un char dont le masque couvre 8 % de la caisse aux UV) ; un test y veille ;
2. pour un modèle à squelette (génie, méca, drone ravitailleur, veilleur), l'importeur crée une icosphère d'un mètre de rayon comme forme d'os, cachée au rendu mais comptée dans l'enveloppe : le canevas en prenait deux mètres de côté. L'import se fait sans forme d'os, et l'enveloppe ne compte que ce qui est rendu ;
3. l'occlusion du ciel sur l'attrapeur d'ombre touchait le bord du canevas (d'où le fondu).

## Les tests

`node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test tests/sprites/*.test.ts` — ils lisent les fichiers produits et n'exigent pas Blender :

- `echantillonnage.test.ts` : cadence, plafond, durée lue ;
- `image.test.ts` : réduction prémultipliée en lumière linéaire, masque divisé par la couverture, ombre effacée et fondue au bord, rognage, extension de couleur, dédoublonnage ;
- `emballage.test.ts` : rien ne déborde ni ne se chevauche ;
- `catalogue.test.ts` : classement des fichiers livrés, plan de vues et de clips, lecture d'une liste ;
- `calibration.test.ts` : la caméra, mesurée (ci-dessus) ;
- `verification.test.ts` : la vérification d'un manifeste voit une image hors de sa page, une page absente ou de la mauvaise taille, un chemin absolu, un doublon, un clip inconnu, une cadence nulle, un pivot perdu, une autre version ;
- `manifeste.test.ts` : version et projection du contrat ; le manifeste est exactement celui des fichiers d'entrée ; chaque page existe à la taille dite et chaque image tient dans sa page ; les 30 unités de `content/unites.json` sont cuites avec exactement les clips que leur GLB porte, dans les vues attendues ; bâtiments, QG nationaux, rochers et pont présents ; chaque entrée a été cuite depuis la source présente (SHA-256) ; masque non vide et pas plein là où il doit être, absent ailleurs ; émission sur les bâtiments qui émettent, jamais sur une unité ; pivot d'une unité au sol dans son image ; poids sous 40 Mo.

## Limites, et ce qui n'est pas vérifié

- **Rien n'a été regardé** (consigne du propriétaire). La lisibilité d'une unité à 48 pixels CSS par case, la justesse des couleurs une fois étalonnées, la force de la lumière de contour et de l'occlusion, la douceur des ombres : **non vérifié**. Aucune approbation artistique n'est revendiquée.
- La **vue de profil** est cuite à la même densité que la carte (128 pixels par mètre) : l'écran de combat, s'il montre ses figurines plus grandes, les agrandira.
- **Pièces rapides** : le flou de bouge lisse le rotor, il ne le rend pas fidèle ; qu'il se lise comme une pièce qui tourne est **non vérifié** à l'écran.
- Les **temps** ont été mesurés sur une machine partagée, à une charge de 20 à plus de 600 : ils varient du simple au quadruple.
- Le bruit résiduel (0,7 niveau en moyenne) a la même graine d'une image à l'autre : il ne scintille pas sur ce qui ne bouge pas, ce qui a aussi rendu identiques, octet pour octet, des images qu'on dédoublonne. Sur ce qui bouge, non mesuré.
