# Sprites du décor — les sources à photographier (23 septembre 2026)

Décision du propriétaire du 23 septembre (`BRIEF.md`, « Sprites précalculés ») : le jeu ne dessine plus de 3D en temps réel, il **photographie** des modèles une fois, hors ligne, et compose ces images en WebGL 2. Le contrat entre la cuisson et le rendu est `src/render2d/contrat.ts` ; ce document décrit le lot « décor » du plan (`doc/refonte/plan-sprites-campagne.md`, agent B) : les **sources** GLB de tout ce que le placement du sol (`render2d/sol/`) pose sur la carte — arbres, buissons, hautes herbes, roseaux, montagnes. La cuisson elle-même est l'affaire de `scripts/sprites/` (`doc/refonte/sprites-cuisson.md`).

## Ce qui est livré

- `assets/sources-sprites/decor/` : **60 GLB**, un par variante, nommés exactement `idDecor(essence, saison, n)` (`decor_feuillu_automne_2.glb`), et **`liste.json`** au format que la cuisson lit — `{ version: 1, entrees: [{ id, famille: 'decor', cle, variante, fichier, vues: ['fixe'], ombre: true }] }`, `fichier` relatif au dossier de la liste, `cle` l'essence, `variante` la saison ou `toutes`. Rien d'autre dans une entrée.
- `scripts/decor-sprites/` : le générateur. `generer.py` (point d'entrée), `essences.py` (le plan : saisons, variantes, gabarits), `geometrie.py` (primitives et bruit, numpy pur), `arbres.py`, `plantes.py`, `montagnes.py` (les formes et les couleurs), `blender_io.py` (le seul module qui touche `bpy` : il recopie, il ne décide rien). `glb.ts` et `mesurer.ts` relisent les fichiers produits.
- `tests/decor-sprites/sources.test.ts` : la commande vérifiée sur les fichiers eux-mêmes.

## La commande

Depuis la racine du dépôt :

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 \
    -P scripts/decor-sprites/generer.py
```

Vingt à trente secondes (mesuré sous une charge de 35, puis de 430). Options après `--` : `--graine N` (défaut **20260923**), `--sortie DOSSIER`, `--seulement PRÉFIXE` (quelques modèles, sans réécrire la liste), `--verifier` (tout refaire dans un dossier temporaire et comparer octet pour octet ; code 1 au moindre écart). Le script **refuse d'écrire** un modèle hors gabarit ou au-delà de 3 000 triangles : une commande qui échoue vaut mieux qu'une source fausse qui passe à la cuisson.

**Reproductible, mesuré** : `--verifier` rend « 61 fichiers identiques octet pour octet » ; un modèle produit seul (`--seulement`) est identique au même modèle produit dans le lot complet ; une autre graine donne d'autres fichiers. Le hasard passe par `rng_de` (SHA-256 d'une clé lisible), jamais par `hash()` de Python, qui est salé à chaque processus.

Relire les gabarits réels : `npx tsx scripts/decor-sprites/mesurer.ts` (tableau Markdown, ou `--json`).

## Conventions des sources

- **Repère glTF** : +Y en haut, +Z vers l'avant — le joueur, le bas de l'écran, ce que voit la vue `fixe` (lacet 0). Une unité = un mètre = une case. Aucune échelle ni rotation sur les nœuds : la géométrie est posée en place.
- **Origine au centre de l'emprise, au sol** : le pied de chaque modèle est à y = 0, le centre de la boîte englobante au sol sur l'origine. La pose se décide **sur la saison de référence** (été, ou `toutes`) et s'applique telle quelle aux autres saisons : l'arbre n° 2 d'hiver est l'arbre n° 2 d'été qui a perdu ses feuilles, au même endroit, à la même taille — un changement de saison peut fondre une image dans l'autre sans que rien ne saute.
- **Une racine `racine`** et un nœud enfant par pièce : `tronc`, `feuillage`, `fleurs`, `fruits`, `herbe`, `epis`, `neige`, `relief`, `aiguille` — la convention des GLB livrés (`decor_rocher_cotier`).
- **Couleur d'albédo par sommet** (`COLOR_0`, lumière linéaire), branchée sur la couleur de base d'un Principled BSDF blanc. L'importeur glTF de Blender 5.1 la rebranche à l'identique (vérifié en réimportant des fichiers du lot). **Aucune texture, aucune image, aucun texte.**
- **Aucune ombre peinte** : les nuances sont des pigments, jamais une fonction du relief ou de la direction de la lumière. Une touffe de feuillage est colorée **bouquet par bouquet** — chaque bosse tire au hasard un vert un peu plus sombre, un peu plus clair, ou celui d'une pousse neuve —, pas selon qu'elle pointe vers le soleil ; s'y ajoutent les pousses claires au bout des branches de sapin au printemps, les strates du grès, le vernis du désert sur les parois raides, la cendre au pied du volcan. La neige est blanche partout ; c'est la lumière de la cuisson qui bleuira son dessous.
- **Matériaux PBR simples**, double face, métal nul, une rugosité par matière : `mat_ecorce` 0,9 · `mat_feuillage` 0,72 · `mat_fleurs` 0,6 · `mat_fruits` 0,5 · `mat_herbe` 0,78 · `mat_neige` 0,5 · `mat_roche` 0,86 · `mat_coulee` 0,42 (la coulée de basalte et la neige sont les deux seules surfaces qui doivent accrocher un reflet).
- **Volumes francs** : une couronne est six ou sept touffes bosselées qui se chevauchent, pas mille feuilles ; un sapin, cinq ou six jupes dentées ; une montagne, un champ de hauteur à arêtes vives. À trente pixels, c'est la silhouette et la lumière qui la modèle qui se lisent.

## Les essences

| Essence | Ce qu'elle représente | Saisons | Variantes |
|---|---|---|---|
| `feuillu` | Arbre à feuilles : n° 1 un chêne rond, n° 2 un tilleul en ogive, n° 3 un érable champêtre étalé en deux lobes. Printemps vert tendre et un soupçon de fleurs roses, été vert profond, automne roux et or (chaque touffe sa teinte), hiver **branches nues** — tronc, charpentières, rameaux, brindilles — et un peu de neige couchée sur la fourche et les branches les moins raides. | 4 | 3 |
| `conifere` | Épicéa élancé (6 étages), sapin trapu (5), pin haut de fût aux étages décalés (5). Jupes de branches dentées qui retombent ; pousses claires au printemps, vert olive à l'automne, calotte de neige sur chaque étage l'hiver. | 4 | 3 |
| `palmier` | Stipe annelé (les anneaux sont dans la forme), bourre, noix de coco, 7 à 9 frondes arquées aux folioles dentées. N° 1 presque droit, n° 2 cocotier penché, n° 3 deux stipes d'une même souche. | `toutes` | 3 |
| `tropical` | Arbre de jungle, écorce pâle et **contreforts** au pied : n° 1 le géant en parasol qui perce la canopée, n° 2 un arbre dense aux grandes feuilles, n° 3 un fromager à deux étages. | `toutes` | 3 |
| `buisson` | Dôme de quatre masses (n° 1), haie courte de cinq masses (n° 2). Fleurs au printemps, rouge-orangé à l'automne, persistant endormi (olive éteint) sous ses calottes de neige l'hiver. | 4 | 2 |
| `touffe` | Hautes herbes : une touffe dressée (n° 1), une touffe en fontaine (n° 2). Vert tendre, **dru** (six brins de plus l'été), **blond** (épis au bout des plus hauts brins), **givré** (pointes blanches, port plus affaissé). | 4 | 2 |
| `roseau` | Massettes de marais : feuilles longues, tiges, épis bruns. L'hiver : paille, feuilles cassées net aux deux tiers, épis coiffés de bourre blanche. | `toutes`, `hiver` | 2 |
| `montagne` | Roche tempérée grise veinée, **herbe au pied** sur les pentes douces, terre à la transition. N° 1 un pic franc, n° 2 deux pics et un col face à la caméra, n° 3 un massif : pic en arrière à gauche, épaule plate en avant à droite. L'hiver : neige au-dessus de la mi-hauteur sur les faces qui la tiennent (les parois raides restent rocheuses), herbe givrée et plaques de neige au pied. | `toutes`, `hiver` | 3 |
| `montagne_aride` | Grès du désert en strates ocre, rouge et crème : n° 1 une mesa (plateau, falaise en marches, talus de sable), n° 2 une butte basse et une aiguille coiffée — une cheminée de fée — en avant à gauche. | `toutes` | 2 |
| `montagne_volcan` | Basalte sombre, lèvre du cratère oxydée, cendre et un peu de mousse au pied, **coulées refroidies** en relief, presque noires et un peu brillantes — aucune lave vive. N° 1 un cône et son cratère, n° 2 un cône égueulé ouvert à l'avant droit, d'où sort la coulée. | `toutes` | 2 |

Soit 12 feuillus, 12 conifères, 3 palmiers, 3 tropicaux, 8 buissons, 8 touffes, 4 roseaux, 6 montagnes, 2 montagnes arides, 2 volcans : **60 modèles**. Les rochers gardent leurs GLB livrés (`decor_rocher_cotier`, `decor_rocher_archipel`), que la cuisson prend dans son catalogue.

### Où chaque essence a été pensée pour aller

Le placement (`render2d/sol/`) décide seul ; voici seulement l'intention des sources, reprise de ce que faisait la 3D (`render3d/decor.ts`, `paysage.ts`) :

- **forêt** : trois à cinq arbres par case — feuillus et conifères mêlés en plaine et en forêt tempérée, conifères seuls en montagne, neige et côte, tropicaux et palmiers en jungle et archipel ;
- **plaine** : buissons, et touffes près des haies ; **hautes herbes** (`herbe_haute`) : des touffes, denses ; palmiers d'oasis au bord de l'eau dans le désert ;
- **marais** : roseaux au bord de l'eau ;
- **montagne** (le terrain) : `montagne` partout, sauf `montagne_aride` dans le désert et `montagne_volcan` dans le biome volcanique ; la variante `hiver` quand la saison l'est.

## Gabarits réels mesurés

Relevés par `mesurer.ts` sur les fichiers livrés (graine 20260923). « Image » est la silhouette de l'image cuite, en pixels de plan à 128 pixels par case, calculée en projetant chaque sommet par `versPlan` — la caméra de cuisson — sans rien rendre ; la « couverture » est la part de ce cadre que le modèle remplit (l'ombre portée, cuite à part, n'y est pas). La commande demandait des silhouettes d'environ 30 à 90 pixels de haut.

Par essence (le détail modèle par modèle : `npx tsx scripts/decor-sprites/mesurer.ts`) — « largeur » est la plus grande des deux emprises au sol, sauf pour les montagnes, où la plage couvre les deux :

| essence | saisons | modèles | triangles | largeur (m) | hauteur (m) | image (px de plan, l × h) | couverture |
|---|---|---:|---|---|---|---|---|
| `feuillu` | printemps, été, automne | 9 | 2284–2564 | 0,30–0,41 | 0,64–0,84 | 38–49 × 64–79 | 52–57 % |
| `feuillu` | hiver | 3 | 1232 | 0,27–0,42 | 0,63–0,87 | 33–50 × 64–77 | 18–25 % |
| `conifere` | printemps, été, automne | 9 | 763–903 | 0,34–0,38 | 0,68–0,84 | 44–48 × 70–83 | 45–52 % |
| `conifere` | hiver | 3 | 1193–1403 | 0,34–0,38 | 0,68–0,84 | 44–48 × 70–83 | 47–53 % |
| `palmier` | toutes | 3 | 976–1734 | 0,38–0,41 | 0,64–0,69 | 45–52 × 57–74 | 21–24 % |
| `tropical` | toutes | 3 | 2364–2666 | 0,41–0,43 | 0,66–0,84 | 51–55 × 69–89 | 42–48 % |
| `buisson` | printemps, été, automne | 6 | 1280–1880 | 0,27–0,28 | 0,21 | 35–36 × 29–30 | 60–67 % |
| `buisson` | hiver | 2 | 1704–2130 | 0,28–0,29 | 0,21–0,22 | 35–37 × 29–31 | 61–70 % |
| `touffe` | printemps, été, automne | 6 | 288–724 | 0,14–0,22 | 0,14–0,17 | 13–28 × 18–24 | 19–24 % |
| `touffe` | hiver | 2 | 288–324 | 0,17–0,21 | 0,14–0,16 | 16–27 × 20–21 | 19–21 % |
| `roseau` | toutes | 2 | 474–611 | 0,17–0,22 | 0,28–0,29 | 20–21 × 27–30 | 17 % |
| `roseau` | hiver | 2 | 634–851 | 0,17–0,23 | 0,28–0,29 | 21–22 × 26–29 | 18–19 % |
| `montagne` | toutes, hiver | 6 | 2496 | 0,94–0,95 | 0,66–0,78 | 120–121 × 108–114 | 76–78 % |
| `montagne_aride` | toutes | 2 | 2496–2784 | 0,94–0,95 | 0,56–0,73 | 120–121 × 102–113 | 78–81 % |
| `montagne_volcan` | toutes | 2 | 2496 | 0,94 | 0,62–0,74 | 121 × 111–118 | 76–78 % |

Les arbres sortent entre 57 et 89 pixels de plan de haut, dans la fourchette demandée ; à 48 pixels CSS par case, un arbre fait donc de 21 à 33 pixels CSS, une touffe de 7 à 9. Une montagne remplit sa case (128 × 98 pixels de plan) et dépasse son bord haut de 7 à 23 pixels, comme un sommet d'Advance Wars. Le pied du tronc est à moins de 2 cm de l'origine sur les feuillus et les conifères, à 3,1 cm au plus sur les tropicaux et les palmiers n° 1 et 3, à 10,9 cm sur le palmier n° 2 (voir les limites).

## Ce que le test vérifie

`node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test tests/decor-sprites/*.test.ts` — onze tests, sur les fichiers eux-mêmes, avec **sa propre** table de la commande (pas celle du générateur) :

- la liste a exactement le format de la cuisson, sans clé de plus ; chaque identifiant est `idDecor(cle, variante, n)`, chaque fichier `id.glb` ;
- chaque essence a ses saisons, numérotées de 1 sans trou, au moins trois variantes par saison pour un arbre et deux pour le reste, le même nombre à chaque saison ;
- le dossier dit exactement ce que la liste dit (aucun GLB orphelin) ;
- chaque GLB est un glTF 2.0 sain, accepté par le lecteur du projet (`src/assets/valider-gltf.ts`), sans ressource externe, sans animation, aux matériaux connus, avec son nœud `racine`, et le compte de triangles de `mesurerGltf` égale celui qu'on relit sommet par sommet ;
- au plus 3 000 triangles, aucune échelle négative (ni composante d'échelle, ni déterminant de la chaîne de nœuds) ;
- le gabarit : arbres 0,25–0,45 de large et 0,5–0,9 de haut ; buisson 0,18–0,3, touffe 0,12–0,25, roseau 0,15–0,3 **en largeur et en hauteur** ; montagne 0,9–1,0 d'emprise **dans les deux sens** et 0,5–0,9 de haut ; pied à |y| ≤ 5 mm ; emprise centrée à 4 cm près ;
- une variante garde sa place (centres à 6 cm près) et sa taille (rapport des hauteurs ≤ 1,2) d'une saison à l'autre ;
- normales et couleurs de sommet présentes sur chaque primitive, couleurs dans [0, 1], au moins huit teintes par modèle ;
- l'hiver se voit : de la neige sur les feuillus, conifères, buissons, roseaux et montagnes d'hiver, jamais hors de l'hiver, et aucun feuillage sur un feuillu d'hiver ;
- aucune silhouette ne se réduit à des traits (couverture ≥ 10 %) ;
- les arbres et les montagnes dominent les herbes.

Le générateur fait les mêmes contrôles de gabarit avant d'écrire, et **resserre** l'emprise ou la hauteur d'une variante quand une autre graine la ferait déborder (la même correction pour toutes ses saisons, marge de 3 %) : sur treize graines essayées, aucune variante n'est refusée.

## Limites, et ce qui n'est pas vérifié

- **Rien n'a été regardé** (consigne du propriétaire). La lisibilité des silhouettes, l'harmonie des couleurs une fois éclairées, la force de la neige, le rendu des coulées, la façon dont une couronne se découpe sur un sol de forêt : **non vérifié**. Les couleurs ont été choisies pour rester de la famille de `render/ambiance.ts` et de `render3d/decor.ts` / `paysage.ts`, sans approbation artistique.
- **Aucune source n'a été cuite** : la cuisson est la chaîne de l'agent A. La compatibilité est raisonnée, pas mesurée : l'importeur glTF de Blender 5.1 rebranche `COLOR_0` sur la couleur de base, avec la rugosité et la double face (vérifié en réimportant deux fichiers de ce lot, une montagne d'hiver et un feuillu d'automne) ; aucune image ne porte `masque_equipe`, donc aucune zone d'équipe ; aucun matériau n'émet.
- **`toutes` veut dire toutes** : une montagne tempérée garde son herbe verte à l'automne, un palmier est le même en hiver. L'étalonnage de saison du rendu fera le reste, ou non.
- **Le buisson d'hiver n'est pas nu** : c'est un persistant endormi sous sa neige. Des brindilles de 5 mm à trente pixels n'auraient été que du bruit ; le feuillu, lui, est nu, comme la commande le demande.
- **Touffes et roseaux sont faits de traits** : 17 à 24 % de couverture, contre 45 à 57 % pour un arbre qui porte ses feuilles. Leurs lames ont été élargies (1,5 à 2,1 cm pour l'herbe, 1,1 à 1,4 cm pour le roseau) pour rester lisibles ; à 48 pixels CSS par case, une touffe fait moins d'une dizaine de pixels, et sa lisibilité à cette taille est **non vérifiée**.
- **Le palmier n° 2 penche** : l'origine est au centre de son emprise, comme la commande le demande, et son pied est donc à 10,9 cm de l'origine. Si le placement veut poser les arbres par le pied, c'est la seule source où la différence se verra ; pour les autres arbres, l'écart reste sous 3,1 cm.
- **L'hiver d'un feuillu** a une emprise un peu différente de son été (les brindilles vont jusqu'au bord des touffes, sans les remplir) : le pied ne bouge pas, la boîte bouge de quelques centimètres.
- Les montagnes d'une chaîne se posent chacune dans sa case (emprise 0,94) : entre deux cases de montagne, le sol de la case se voit sur quelques centimètres. C'est la grammaire d'Advance Wars (un sommet par case), pas une chaîne continue.
- Les modèles ne portent pas d'animation : le vent dans les feuilles, s'il vient, sera un effet du rendu.
- La reproductibilité octet pour octet est mesurée avec **Blender 5.1.1** (et son numpy 2.3.4) : l'exportateur glTF écrit sa version dans le fichier, et un autre Blender peut ranger autrement la même géométrie. Changer de Blender, c'est régénérer, relancer le test, et recuire.

## Ce que la cuisson doit en faire

`npm run cuire:sprites -- --liste assets/sources-sprites/decor/liste.json` : une vue `fixe`, une image par modèle, l'ombre au sol cuite (`ombre: true`), ni masque ni émission. Aucune mise à l'échelle : les sources sont déjà à l'échelle du jeu, leur origine est le point de pose. Avec l'éclairage de la cuisson (une face horizontale blanche sort à 1,0), les albédos se lisent tels quels sur le dessus des volumes.
