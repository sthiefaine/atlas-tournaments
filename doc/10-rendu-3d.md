# Atlas Tournament — Le rendu 3D

> Document 10. Découle du canon `BRIEF.md`, section « Direction artistique (révisée le 5 septembre 2026 : 3D) ».
> **Propriétaire du rendu 3D** : caméra, terrain, éclairage, unités, surbrillances, performance, interface commune des rendus.
> Le format des assets appartient à `11-assets-spec.md`. Les règles du climat appartiennent à `04-gameplay.md` §12 : ce document ne fait que les **montrer**.
> Ce qui n'est pas dans le brief et qui apparaît ici est signalé **[proposition]**.

---

## 1. Ce que la 3D change, et surtout ce qu'elle ne change pas

Le pivot du 5 septembre remplace une peau, pas un jeu. Le moteur (`engine/`) ne sait toujours pas qu'il existe un écran ; il rend un `EtatPartie` sérialisable et une file d'`EvenementJeu`, et il en rendrait exactement autant si on l'affichait en texte. Le rendu vectoriel 2D (`render/`), terminé le 5 septembre, **reste** : repli pour les appareils sans WebGL 2, aperçu d'administration (`scripts/apercu-carte.ts`), et référence de lisibilité. Les deux peaux implémentent la **même interface** (§11) et partagent le contrôleur d'interaction (`render/controleur.ts`), le HUD HTML (`render/hud-html.ts`) et l'ambiance climatique (`render/ambiance.ts`).

Quatre invariants survivent au passage en trois dimensions, et ce sont eux qui rendent le pivot possible :

1. **La grille reste une grille.** Une case est une case, carrée, adjacente à quatre voisines. Rien dans la 3D n'introduit de diagonale, de demi-case ou de position continue : une unité est toujours *sur* une case, et le rendu ne parle au reste du jeu qu'en cases (§11, règle 2).
2. **Le rendu n'a aucune autorité.** Il reçoit, il peint. Quand le joueur clique, le contrôleur construit une `Action`, la passe à `appliquer`, reçoit un nouvel état, puis demande au rendu de *rattraper* visuellement. Pendant qu'une animation joue, l'état logique est déjà le nouveau.
3. **Aucune unité n'est connue par son nom.** L'homologation (`BRIEF.md`, arbitrage n° 8) impose que tout code qui énumère les unités lise le catalogue. En 3D, cela devient : une unité sans modèle est rendue par un **placeholder composé depuis sa `Silhouette`** (§7.4), et l'arrivée d'un modèle est un remplacement de fichier, jamais un changement de code.
4. **L'ambiance est cosmétique.** `ambiance = f(saison, phase, météo)` change des couleurs, des lumières et des particules. Une partie jouée calques éteints est exactement la même partie, au bit près.

Ce que la 3D apporte vraiment, et qui justifie le coût : **le relief se voit**. Une colline est haute, une rivière est encaissée, une montagne domine. Le jeu a déjà une défense de terrain à quatre étoiles et un perchoir à 4 (`04-gameplay.md` §4) ; en 2D il fallait le lire dans le HUD, en 3D on le voit. C'est aussi ce qui rend jouable, plus tard, le **relief à niveaux** de `12-au-dela-advance-wars.md` §3.1.

---

## 2. La direction : réaliste dans les matières, léger dans l'esprit

La formule est celle du brief, et elle se décide surface par surface :

- **Les matières sont crédibles.** Tôle peinte griffée, tissu technique mat, béton lavé, bois usé, caoutchouc poussiéreux, herbe tondue avec sa trace de tonte. On travaille en PBR *metallic-roughness* parce que c'est ce qui fait qu'une chose a l'air d'être en quelque chose.
- **Les formes sont simples.** Silhouettes lisibles à trente pixels, volumes ramassés, pas de détail qui n'existe qu'en gros plan. Le modèle de référence n'est pas le simulateur : c'est le **diorama** — une maquette bien faite, éclairée par un studio, qu'on regarde d'un peu haut.
- **Le monde est sportif, pas guerrier.** Une ville est une ville hôte : terrasses, banderoles sans emblème, fenêtres allumées le soir. Un QG est un pavillon d'équipe avec un balcon d'où le commandant regarde le terrain. Le matériel est **homologué** : propre, entretenu, marqué par l'usage et jamais par la violence. Le guide de ton de `01-bible.md` §5 s'applique aux modèles autant qu'aux textes — les interdits sont recopiés dans chaque `AssetSpec` (`11-assets-spec.md` §6).
- **Pas de réalisme de la violence.** Aucune trace de sang, aucun débris organique, aucune ruine fumante. Une unité mise hors jeu s'affaisse, s'éteint et sort du terrain ; elle n'explose pas.

Références conservées : `doc/assets/render-vector.png` pour la lisibilité (c'est l'étalon : si la 3D est moins lisible que le vectoriel, la 3D a tort), `doc/assets/render-3d.png` pour l'esprit diorama, à dépasser en qualité de matières.

---

## 3. La caméra

### 3.1 Perspective, pas orthographique

Caméra **perspective**, champ de vision vertical de **42°** (`render3d/camera.ts`, `FOV`). L'orthographique aurait donné une lisibilité parfaite et un monde en carton : sans fuite, un relief de 1 mètre sur une case de 1 mètre ne se lit pas. Un champ étroit garde la déformation faible aux bords tout en laissant la parallaxe faire son travail sur les montagnes et les bâtiments.

### 3.2 Tangage, lacet, quarts de tour

- **Tangage** (inclinaison au-dessus de l'horizontale) : **60° à 75°**, défaut **68°**. En dessous de 60° les unités du fond se cachent les unes derrière les autres et la grille cesse d'être lisible ; au-dessus de 75° on retombe sur une vue de dessus qui écrase le relief et annule l'intérêt de la 3D.
- **Lacet fixe** par défaut : le nord de la carte est en haut, comme en 2D, parce qu'une carte tactique se mémorise. La rotation libre est refusée : elle désoriente et rend les scénarios impossibles à commenter (« la ville au nord-est » doit vouloir dire quelque chose).
- **Quarts de tour optionnels** : le joueur peut faire pivoter la scène de 90° dans un sens ou dans l'autre, avec une interpolation courte (250 ms **[proposition]**). C'est la réponse au seul vrai problème de la 3D isométrique : une unité cachée derrière une montagne. Quatre orientations, jamais un continuum.
- **Le HUD ne tourne jamais.** Il est en HTML par-dessus (§10) ; les quarts de tour ne le touchent pas.

### 3.3 Zoom par paliers

Le zoom est une **distance caméra-cible**, prise dans une liste fermée : `5, 7, 9.5, 13, 17.5, 24, 33, 45` unités de scène (`PALIERS_DISTANCE`). Le palier par défaut dépend de la carte (§3.4). Les paliers, plutôt qu'un zoom continu, pour trois raisons : les niveaux de détail basculent à des seuils prévisibles, les captures d'écran d'une même carte sont comparables, et le pincement sur téléphone devient un geste qui *arrive quelque part* au lieu de flotter.

### 3.4 Cadrage automatique et contrainte de lisibilité

À l'ouverture d'une carte, `distanceCadrage()` choisit la distance qui fait tenir la carte entière dans la fenêtre, avec une marge, puis **arrondit au palier le plus proche** en dessous — mieux vaut voir un peu moins et voir net.

La **contrainte de lisibilité est chiffrée et non négociable** : au zoom par défaut, **une case occupe au moins 48 pixels CSS de côté à l'écran**. Si le cadrage automatique de la carte demande moins, on ne dézoome pas plus : on prend le palier qui tient les 48 px et on laisse la carte déborder, le joueur fera défiler. Une carte 24 × 16 sur un téléphone de 360 px de large ne peut pas tenir entière et rester jouable ; prétendre le contraire donne des unités de 12 pixels que personne ne distingue. Le rendu 2D applique la même règle avec `TUILE = 64` et ses paliers de zoom : les deux peaux sont donc lisibles au même seuil, ce qui est exactement le rôle du repli.

Conséquence de vérification : un test de rendu calcule, pour chaque taille de carte du catalogue et trois tailles d'écran de référence (téléphone 360 × 640, tablette 820 × 1180, ordinateur 1440 × 900), la taille apparente d'une case au palier par défaut, et échoue sous 48 px **[proposition]**.

### 3.5 Limites et déplacement

La cible de la caméra est bornée à la carte (`limiterCible`) : on ne sort jamais du plateau, et on ne peut pas perdre la carte de vue. Glisser déplace la cible dans le plan de la grille, en tenant compte du lacet courant ; la molette et le pincement changent de palier autour du point visé, pas autour du centre de l'écran.

---

## 4. Le terrain

### 4.1 Un maillage de la grille, pas des tuiles empilées

Le terrain est **un seul maillage** construit depuis la `MapDef` : une grille de sommets, un sommet par coin de case plus les centres, dont l'altitude vient du type de terrain. Ce n'est pas un damier de cubes : les cubes donnent des marches, des faces verticales à texturer et un nombre de draw calls absurde.

**Relief par terrain**, en unités de scène (une case = 1 unité, `render3d/geometrie.ts`) :

| Terrain | Altitude | Pourquoi |
|---|---:|---|
| `plaine`, `route`, `pont`, `aeroport` | 0 | le plan de référence |
| `foret` | 0,05 | le sous-bois est un peu bombé |
| `ville`, `usine`, `qg` | 0,02 | une plateforme, pour que le bâtiment ne flotte pas |
| `plage` | −0,05 | la descente vers l'eau commence ici |
| `riviere` | −0,25 | encaissée : c'est ce qui la rend lisible comme obstacle |
| `mer` | −0,40 | le fond |
| `montagne` | 1,00 | le perchoir |

Le brief fixe les **bornes** (montagne jusqu'à 1,2, rivière −0,3, mer −0,5) ; la table ci-dessus reste volontairement en deçà, parce qu'une montagne à 1,2 sur une case de 1,0 cache la case derrière elle à 60° de tangage. Une colline intermédiaire n'existe pas encore dans `CLES_TERRAIN` ; le jour où le relief jouable arrive (`12-au-dela-advance-wars.md` §3.1), il apporte ses propres altitudes et cette table devient une fonction de (terrain, niveau).

### 4.2 Jonctions adoucies

L'altitude d'un point du maillage est une **moyenne pondérée des cases voisines**, pas la valeur de sa case. Une montagne isolée devient une colline arrondie, une chaîne de montagnes devient une crête, une rivière isolée devient une cuvette et une rivière continue devient une vallée. C'est exactement le comportement voulu : le relief raconte la **topologie** de la carte, pas la liste de ses cases.

Deux garde-fous :
- **Le centre de chaque case reste plat** sur un petit disque, sinon une unité posée sur une pente penche et le décalque de surbrillance se déforme.
- **Les cases de bâtiment sont plates**, elles et leur couronne immédiate : on ne pose pas un QG sur un talus.

### 4.3 Texturage : une *splat map* à quatre canaux

La couleur du sol ne vient pas d'un atlas de tuiles mais d'une **carte de mélange** générée depuis la `MapDef` : une texture dont chaque texel porte, dans ses quatre canaux, la proportion de **herbe, terre, roche, sable** (`Splat` dans `render3d/geometrie.ts`). Le nuancier par terrain :

| Terrain | herbe | terre | roche | sable |
|---|---:|---:|---:|---:|
| `plaine` | 1,00 | — | — | — |
| `foret` | 0,85 | 0,15 | — | — |
| `montagne` | 0,10 | 0,05 | 0,85 | — |
| `route` | 0,05 | 0,95 | — | — |
| `ville` / `qg` / `usine` / `aeroport` | 0,25 → 0,10 | 0,75 → 0,90 | — | — |
| `plage` | 0,05 | — | — | 0,95 |
| `riviere` | 0,10 | 0,30 | — | 0,60 |
| `mer` | — | — | 0,10 | 0,90 |

La splat map est **floutée d'un texel** au passage : les transitions herbe → sable et herbe → roche deviennent des dégradés d'une demi-case, ce qui supprime d'un coup le problème le plus visible d'un jeu à grille — la frontière rectiligne entre deux terrains. Le shader mélange quatre jeux de textures PBR (albédo, normales, rugosité) selon les quatre poids, en *triplanar* sur les pentes fortes pour que la roche d'une montagne ne s'étire pas.

**Le quatrième canal change de sens en hiver** : `sable` devient `neige` quand la saison le demande (`textures.ts`, `Matiere`). Une plage enneigée n'existant pas, la substitution se fait par biome et non globalement — c'est une variante de matière, pas un cinquième canal.

### 4.4 L'eau

Le plan d'eau est **un maillage plat unique** au niveau `−0,12`, au-dessus des lits de rivière (−0,25) et des fonds marins (−0,40). Il est semi-transparent, ce qui rend la profondeur lisible : au-dessus d'une rivière on voit les galets, au-dessus de la mer on ne voit presque rien. Deux cartes de normales animées défilent en sens contraires à des vitesses différentes — la vieille recette, qui marche encore — avec un reflet spéculaire du soleil et une écume générée là où le fond remonte (bord de plage, gué). Sous la pluie, la densité des rides monte ; sous le gel (`rivieres_gelees`, `04-gameplay.md` §12.2), la surface passe à une matière **glace** opaque et la rivière se lit d'un coup comme franchissable : le changement de règle se voit avant d'être lu.

### 4.5 Routes et plages

Les **routes** ne sont pas peintes dans la splat map : ce sont des **bandes de géométrie décalées** de deux centimètres au-dessus du terrain, cousues le long du réseau, avec des raccords calculés sur les **quatre voisins** (la correction déjà notée pour la 2D dans `02-architecture.md` §3.4 : sans elle, les extrémités de route restent des moignons). Une bande décalée règle en une fois les jonctions, les virages, les ponts et le fait qu'une route reste nette quand la splat map est floue.

Les **plages** sont un dégradé et non une frontière : la splat map fait passer l'herbe au sable sur une demi-case côté terre, et le sable disparaît sous l'eau côté mer. Le halo de sable de la démo vectorielle devient ici la conséquence naturelle du mélange.

### 4.6 Décor instancié

Arbres et rochers viennent du catalogue d'assets. La **végétation** est par territoire (`decor_arbre_<biome>_fr_<region>` en France, `decor_arbre_<biome>_<pays>` ailleurs) ; la **roche** reste par biome (`decor_rocher_<biome>`), parce qu'elle est géologique et non culturelle (`11-assets-spec.md` §5.2 ter). Leur placement est **dérivé de la graine de la carte** — jamais d'un aléa de rendu — pour qu'une carte ait toujours le même bois au même endroit, en 2D comme en 3D, à chaque ouverture. Ils sont posés en `InstancedMesh` (§9).

### 4.7 Le style régional des bâtiments et du décor

Le style régional habille **les bâtiments, le décor et le terrain**, jamais les unités. Le rendu le trouve sans qu'aucune carte ait à le déclarer : une carte porte une **mécanique** (`EtatPartie.mecanique.cle`), le registre des mécaniques dit à quelle **région** chacune appartient (`content/mecaniques.json`), et la région a son style (`content/styles/regions/<pays>/<region>.json`). C'est ce que fait `styleRegionParMecanique()`.

Ce que le rendu en tire aujourd'hui, sur les bâtiments composés par le code : la **couleur des toits** (`toits.couleur`) et celle des **murs** (`murs.couleur`), qui remplacent les deux teintes neutres. L'ardoise bleue de Bretagne, la tuile ronde de Provence et la tôle turquoise de Mayotte se voient donc **avant même** qu'un seul bâtiment ait été livré. Les toits blanchissent sous la neige comme le reste du décor.

Une carte **sans mécanique** — une carte d'entraînement, une carte générée hors région — n'a pas de style régional, et ce n'est pas une erreur : on retombe sur les teintes neutres. C'est la même règle que partout ailleurs dans ce document : le rendu ne casse jamais parce qu'une donnée manque.

---

## 5. Les matières par biome et par saison

Chaque biome de `BIOMES` (dix valeurs, `03-schemas.md`) fournit son jeu de quatre matières PBR, et chaque saison une variante. Une matière, c'est trois cartes : **albédo**, **normales**, **rugosité** — le métal est constant sur un sol, on ne le transporte pas.

| Saison | Ce qui change dans les matières |
|---|---|
| `printemps` | herbe saturée, terre sombre et humide (rugosité basse), feuillage clair et jeune |
| `ete` | herbe rase et un peu jaunie, terre claire et poussiéreuse, feuillage dense |
| `automne` | feuillage roux et or, sol jonché de feuilles, rugosité irrégulière (flaques) |
| `hiver` | couche de neige sur les faces horizontales, herbe grise sous la neige, glace possible sur l'eau |

**La neige n'est pas une texture blanche posée dessus** : c'est un poids supplémentaire dans le mélange, appliqué en fonction de l'orientation de la face (les faces plates prennent, les pentes fortes non) et de l'abri (sous un arbre, moins). C'est ce qui évite l'effet nappe.

Les variantes sont livrées par le générateur externe comme des jeux de textures nommés (`terrain_plaine_albedo_hiver.png`, `11-assets-spec.md` §5). Tant qu'ils manquent, `render3d/textures.ts` **synthétise** albédo et normales par bruit fractal : c'est le placeholder du terrain, et il tourne aujourd'hui.

---

## 6. L'éclairage

L'`ambiance` de la 2D (`render/ambiance.ts`) — une palette, un voile, des particules — devient en 3D un jeu de **paramètres d'éclairage** (`render3d/eclairage.ts`, `ParametresAmbiance`), interpolés sur 600 ms quand la journée change (`MS_TRANSITION`). Aucune règle n'en dépend.

### 6.1 Les trois lumières

1. **Soleil directionnel avec ombres.** Une seule source d'ombres portées, en *cascaded shadow maps* légères — deux cascades suffisent à cette échelle **[proposition]**. Les ombres sont ce qui donne le relief : sans elles, la montagne redevient un aplat.
2. **Lumière hémisphérique** ciel/sol : le bleu du ciel par-dessus, le rebond du sol par-dessous. C'est elle qui empêche les faces à l'ombre d'être noires, et elle change de couleur avec la saison et la météo.
3. **Sources ponctuelles de nuit**, uniquement sur les bâtiments éclairés : ville, usine, aéroport, QG. Elles sont accompagnées d'un matériau **émissif** sur les fenêtres (carte `emission` de l'`AssetSpec`). Ce sont les mêmes bâtiments qui gardent leur vision la nuit (`04-gameplay.md` §12.3) : le rendu dit visuellement une règle du jeu, ce qui est le meilleur usage qu'on puisse en faire.

### 6.2 Température de couleur par saison

| Saison | Soleil | Ciel hémisphérique | Intensité |
|---|---|---|---|
| `printemps` | blanc légèrement froid | bleu clair | moyenne |
| `ete` | blanc chaud, dur | bleu profond | haute, ombres courtes et contrastées |
| `automne` | doré, bas | gris bleuté | moyenne, ombres longues |
| `hiver` | pâle, très bas | gris-bleu froid | basse, ombres très longues et douces |

### 6.3 Trajectoire du soleil sur le cycle jour / nuit

La phase (`jour` / `nuit`) et la position dans le cycle `cycleJourNuit` (défaut 4 / 2, `04-gameplay.md` §12.3) donnent l'**élévation** et l'**azimut** de la source directionnelle (`directionSoleil`).

- **Phase `jour`** : le soleil monte de ~20° au début de la journée à ~65° au milieu et redescend, l'azimut balayant environ un quart de tour sur la durée de la phase. Les ombres s'allongent et tournent visiblement au fil des journées — un joueur attentif sait l'heure sans lire le HUD.
- **Phase `nuit`** : la source devient une **lune** — élévation basse, teinte froide, intensité au dixième, ombres à peine marquées — l'hémisphérique passe au bleu nuit, les villes s'allument, et un **brouillard de scène** léger ferme l'horizon. La nuit ne noircit pas la carte : elle la refroidit et la resserre, exactement comme la règle réduit la vision sans supprimer la carte.
- **Cas extrêmes** : `{ jour: 0, nuit: 6 }` (nuit polaire) et `{ jour: 6, nuit: 0 }` sont des configurations valides ; le rendu ne fait alors jamais lever ou jamais coucher le soleil, et c'est tout.

### 6.4 La météo

Six valeurs, six traitements (`04-gameplay.md` §12.4 pour les effets de règle) :

| Météo | Ce que le rendu montre |
|---|---|
| `clair` | rien de plus ; c'est l'étalon |
| `pluie` | particules de gouttes en couches, assombrissement général, **sol mouillé par la rugosité** (la rugosité chute, le spéculaire monte, des flaques apparaissent dans les creux), gouttes sur l'eau |
| `neige` | particules de flocons lents et dérivants, couche blanche qui s'accumule sur les faces horizontales, lumière diffuse et plate |
| `brouillard` | `FogExp2` dense, portée réduite, saturation effondrée ; les unités lointaines s'estompent sans disparaître (la vision est une règle, pas un effet) |
| `tempete` | vent sur les particules et sur le feuillage (oscillation des instances d'arbres), lumière instable, ciel bas ; l'hélicoptère cloué au sol se voit à son rotor arrêté |
| `canicule` | voile chaud, ciel blanchi, léger tremblement de l'air au-dessus des routes, ombres dures et courtes |

**Le brouillard de scène et le brouillard de guerre sont deux choses différentes** et ne doivent jamais être confondus : le premier est atmosphérique et cosmétique, le second est une règle qui se rend par un assombrissement des cases non vues et par l'absence pure et simple des unités adverses. Une case hors vision est **sombre mais visible** ; une unité hors vision **n'est pas dessinée**.

---

## 7. Les unités

### 7.1 Chargement par (unité, nation)

Une unité ne se charge plus par sa seule clé. Depuis l'arbitrage du 5 septembre 2026 au soir (« Pas un simple masque de couleur »), elle se charge par le **couple `(unite, pays)`** :

```
1. kit national      assets/modeles/kit_<pays>_<unite>_lod0.glb
2. géométrie de base assets/modeles/unite_<cle>_base_lod0.glb      (+ liseré d'équipe)
3. placeholder       composé par le code depuis la Silhouette      (+ style, si connu)
```

**Chaque étape est un repli de la précédente, et aucune ne bloque le jeu.** Un kit absent — l'état de vingt-trois nations sur vingt-quatre au début — donne la géométrie de base avec son masque d'équipe ; une base absente donne le placeholder. Il n'existe aucun état cassé, et une livraison est toujours un remplacement de fichier, jamais un changement de code.

Le chargeur garde un cache par clé de kit et un compte de références : deux unités de même type **et de même nation** partagent géométrie et matériaux ; deux nations différentes ne partagent que la géométrie.

### 7.2 Ce qui reste du masque de couleur d'équipe

Le palette swap n'est plus la façon dont une nation se reconnaît — c'est le **kit** qui l'est (`11-assets-spec.md` §5.2 bis). Le masque `masque_equipe` subsiste à deux endroits, et deux seulement :

- **le liseré du socle**, sur tout ce qui est posé sur la grille. Un anneau plat à la couleur du camp, sous l'unité. C'est ce qui distingue deux joueurs de la **même nation** dans un match miroir, et c'est le seul reste de la couleur d'équipe sur une unité. Le brief est explicite : le liseré est là **pour la lisibilité, jamais comme la seule différence** ;
- **le repli du placeholder et de la géométrie de base**, où le masque couvre le corps entier et prend la palette du style national (ou, à défaut, celle du camp).

```
couleur_finale = melange(albedo_du_kit, couleur_equipe, masque_de_socle)
```

Les bâtiments, eux, gardent le masque plein : un bâtiment change de propriétaire en cours de match, et c'est la couleur d'équipe — pas la nation — qui doit s'y lire d'en haut.

### 7.2 bis Le style national appliqué au placeholder

Tant qu'aucun kit n'est livré, le placeholder lit `content/styles/<code>.json` (via `chargerStyleNation()`, couche `assets/`) et en applique quatre choses, par ordre de visibilité :

1. **la palette du style** — `main` sur les grandes surfaces, `dark` sur les ombres propres, le premier **accent** sur les arêtes et les ornements : c'est ce qui sépare deux nations de teinte voisine ;
2. **le liseré d'équipe sur le socle** — voir ci-dessus ;
3. **un ou deux ornements simples** — `antenne` et `fanion`, et eux seuls : ce sont les deux que le code sait poser sans dessiner. Les vingt-huit autres appartiennent au kit livré ;
4. **le gabarit** `a | b | c`, qui étire ou ramasse les proportions du placeholder comme il le fera du modèle.

La nation d'un camp arrive par `creerUnites(doc, hauteurEn, { paysParCamp })`, ou après coup par `definirPays(camp, code)` — le scénario la connaît, le rendu l'apprend. **Sans nation connue, rien ne manque** : palette de camp, gabarit `b`, socle sans ornement. Un aperçu d'administration ou un test n'a pas besoin du canon des pays pour dessiner une unité.

### 7.3 Animations nommées

Les clips portent des **noms imposés** (`11-assets-spec.md` §5) : `repos`, `deplacement`, `tir`, `touche`, `hors_jeu`, `capture`. Le rendu les joue en réponse aux `EvenementJeu` du moteur, jamais de sa propre initiative. Un clip absent n'est pas une erreur d'exécution : on retombe sur `repos`, et le validateur d'assets l'a déjà signalé au moment de la livraison (`asset_animation_absente`).

Règle d'or, héritée de la 2D : **l'état logique est en avance, l'animation rattrape**. `animer()` rend une promesse qui tient jusqu'à la dernière image ; si l'utilisateur clique pendant, l'animation est coupée et l'unité saute à sa position finale. On ne bloque jamais le joueur derrière un effet.

### 7.4 Les placeholders composés depuis la `Silhouette`

Tant qu'un modèle manque — et c'est l'état par défaut du projet aujourd'hui, comme ce sera l'état de toute unité homologuée le jour de son arrivée — l'unité est **composée par le code** à partir de sa `Silhouette` : une `base` (chenilles, roues, pattes, coque, rotor, ailes, rail), un `corps` (bloc, capsule, plateau), jusqu'à trois `modules` posés à des ancres fixes, à l'échelle donnée par `taille`. Ce sont des primitives (boîtes arrondies, cylindres, capsules) assemblées et peintes avec la palette du style national ; le résultat est laid mais **juste** : la bonne taille, la bonne orientation, les bonnes ancres, la bonne couleur, le bon gabarit, le liseré d'équipe au bon endroit, les bonnes animations minimales.

Trois conséquences qui valent d'être écrites :

- Le jeu est **jouable de bout en bout sans un seul asset livré**. C'est ce qui autorise à mener l'étape 3 et l'étape « Assets 3D » en parallèle.
- Le remplacement d'un placeholder par un modèle est un **changement de fichier**. Aucun `if` n'est ajouté, aucune clé n'est écrite en dur.
- Les placeholders 3D et les silhouettes vectorielles 2D sont **le même contrat déclaratif**, ce qui garantit qu'une unité homologuée est jouable dans les deux peaux le jour de son homologation.

### 7.5 Orientation et pose

Une unité regarde `+Z` dans son fichier (`11-assets-spec.md` §4) et est tournée par le rendu vers sa dernière direction de déplacement. Elle est posée sur l'altitude du **centre de sa case** (`solDeCase`), qui est plat par construction (§4.2). Ce qui vole (`domaine === 'air'`) est modélisé à sa hauteur de vol et porte une **ombre projetée au sol** : c'est cette ombre, et non l'objet, qui dit sur quelle case il se trouve.

---

## 8. Les surbrillances de jeu

Cases de déplacement, portée d'attaque, chemin prévisualisé, curseur, case sélectionnée, cases capturables : **toutes en décalques au sol**, jamais en objets volumiques.

Un décalque est un quadrilatère projeté sur le maillage de terrain, en mélange additif ou en transparence, dessiné **après** le terrain et **avant** les unités, sans écriture dans le tampon de profondeur. La règle est absolue : **une surbrillance ne cache jamais une unité**. Un cube bleu translucide posé sur une case cacherait l'infanterie qui s'y trouve, et c'est précisément l'information que le joueur cherche.

Le vocabulaire visuel reprend celui de la 2D pour que le repli ne dépayse pas :

| Surbrillance | Rendu |
|---|---|
| déplacement possible | décalque **vert émeraude** translucide, bord clair |
| portée d'attaque | décalque **rouge carmin** translucide |
| chemin prévisualisé | **flèche** coudée suivant le relief, pointe sur la case d'arrivée |
| curseur | cadre lumineux d'une case, animé en pulsation lente |
| objectif de match | décalque or, pour ne pas se confondre avec un ordre |
| chantier du génie | décalque bleu, pour la même raison |

**Vert, j'y vais ; rouge, j'y tire.** C'est la seule phrase que le joueur ait à retenir, et elle est celle d'Advance Wars — à la couleur du déplacement près, choisie ici verte sur demande. Le vert tire volontairement vers l'émeraude et le rouge vers le carmin : un vert de prairie posé sur une prairie ne se voit pas. En 2D, chaque case allumée reçoit d'abord un **assombrissement** puis sa teinte, ce qui l'enfonce d'un cran par rapport à ses voisines ; en 3D, c'est l'opacité du décalque qui joue ce rôle.

La **portée d'attaque** est l'enveloppe complète : toutes les cases que l'unité pourrait frapper ce tour-ci depuis n'importe laquelle de ses arrivées, **privées** de celles où elle peut aller — une case qui est les deux reste verte, parce qu'on la lit d'abord comme une destination. Une pièce indirecte qui ne tire pas après mouvement ne menace que depuis sa case actuelle : afficher l'enveloppe de tous ses points de chute mentirait.

Le chemin est le seul décalque **continu** : un ruban échantillonné le long de chaque segment, chaque sommet lisant sa propre altitude, ce qui le fait monter et descendre visiblement — une bonne façon de faire sentir qu'un détour par la plaine coûte moins qu'une montée. Il porte une **pointe** sur la case d'arrivée et un liseré sombre sous le corps clair, faute de quoi il disparaîtrait sur la neige.

---

## 9. Performance

### 9.1 Instanciation

- **Le décor est instancié.** Tous les arbres d'un biome sont un seul `InstancedMesh`, tous les rochers un autre. Une carte 24 × 16 avec 30 % de forêt, c'est environ 400 arbres : un draw call.
- **Les unités sont groupées par type.** Douze infanteries, un `InstancedMesh` — avec la couleur d'équipe passée en attribut d'instance, ce qui garde le masque fonctionnel sans multiplier les matériaux **[proposition]**.
- **Le terrain est un seul maillage** ; l'eau un second ; les routes un troisième.
- **Les textures sont atlassées** par famille : les quatre matières de la splat map en un atlas, les décalques de surbrillance en un autre.

### 9.2 Budget par carte

Ordres de grandeur visés pour une carte 24 × 16, à tenir dans les tests de performance **[proposition]** :

| Poste | Triangles | Draw calls |
|---|---:|---:|
| terrain + eau + routes | 45 000 | 3 |
| décor instancié | 60 000 | 4 |
| bâtiments (≈ 20) | 40 000 | 6 |
| unités (≈ 30) | 60 000 | 8 |
| décalques, particules, ciel | 5 000 | 6 |
| **total** | **≈ 210 000** | **≈ 27** |

Les budgets par asset qui rendent ce total atteignable sont dans `11-assets-spec.md` §4 et sont **vérifiés à la livraison** : un modèle hors budget est refusé (`asset_budget`) et ne remplace pas son placeholder.

### 9.3 Cibles et repli

- **60 images par seconde** sur un ordinateur portable à circuit graphique intégré.
- **30 images par seconde** sur un téléphone milieu de gamme.
- La boucle reste **paresseuse**, comme en 2D : on ne dessine que quand quelque chose bouge — une animation en cours, une particule, l'eau, une transition d'ambiance. Un plateau immobile de nuit sans météo ne consomme rien.
- **Détection de WebGL 2 et repli** : `choisirRendu()` (`render/rendu.ts`) tente un contexte `webgl2` ; s'il ne répond pas, la page monte le rendu vectoriel 2D. Le repli est aussi disponible à la demande (`?rendu=2d`), et il l'est parce que le brief l'exige : les deux peaux implémentent la même interface, donc le jeu ne sait pas laquelle il utilise.
- Réglages dégradés avant de basculer : ombres désactivées, une cascade au lieu de deux, particules divisées par quatre, niveaux de détail forcés au palier suivant. Le repli 2D est le dernier recours, pas le premier.

---

## 10. Le HUD

Le HUD est une **surcouche HTML** positionnée au-dessus du canvas (`render/hud-html.ts`), et non des pixels peints. Trois raisons, toutes décisives :

1. **Les neuf langues.** L'allemand est long, le japonais est court, le chinois n'a pas les mêmes métriques ; le CSS gère les polices de repli, la coupure, l'ellipse et les largeurs souples, alors que `measureText` demandait de tout mesurer à la main.
2. **L'accessibilité.** Un HUD en DOM est lisible par un lecteur d'écran, navigable au clavier, agrandissable par le navigateur. Un HUD en canvas n'est rien de tout cela.
3. **Le partage entre les deux peaux.** Le même HUD couvre le rendu 2D et le rendu 3D, sans une ligne de différence.

Les règles d'i18n restent celles de `09-i18n.md` : **aucun texte en dur**, tout passe par `t()`, les nombres et les dates par `Intl`. Un rendu n'appelle jamais `t()` lui-même — les rares libellés qu'il peint (l'étiquette d'un QG) lui sont **donnés déjà traduits** par la vue d'interaction.

---

## 11. L'interface `Rendu`, commune aux deux peaux

Déclarée dans `render/rendu.ts`, implémentée par `render/rendu2d.ts` et par `render3d/`. `jeu.ts` et `controleur.ts` ne connaissent qu'elle.

```ts
export interface Rendu {
  readonly cle: CleRendu;                                   // '2d' | '3d'
  readonly canvas: HTMLCanvasElement | null;

  monter(conteneur: HTMLElement): void;
  afficher(etat: EtatPartie, vue: VueInteraction): void;
  animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void>;
  versMonde(x: number, y: number): Case | null;
  versEcran(c: Case): PointVue | null;
  brancher(gestes: GestesRendu): () => void;
  cadrer(c: Case): void;
  demonter(): void;
}
```

Membre par membre :

- **`monter(conteneur)`** — crée le canvas dans l'élément fourni, ouvre le contexte, charge ce qui doit l'être, démarre la boucle. Rien avant cet appel ne touche au DOM.
- **`afficher(etat, vue)`** — pose l'état de partie et la **vue d'interaction** à peindre, puis salit la boucle. Idempotent : deux appels d'affilée donnent une image, pas deux.
- **La surbrillance passe par `afficher`**, dans `VueInteraction.surbrillances` — c'est le choix retenu à l'implémentation, plutôt qu'un `surligner()` séparé, et il est meilleur : une surbrillance qui vit dans la vue ne peut pas se désynchroniser de l'état qu'elle décrit, alors qu'un appel séparé le peut. `VueInteraction` porte aussi le chemin, le curseur, la sélection, les cases visibles (brouillard), l'ambiance, le catalogue et le drapeau « l'adversaire réfléchit ».
- **`animer(evenements, avant)`** — rejoue une file d'événements du moteur en animations, en partant de l'état d'avant ; la promesse tient jusqu'à la dernière image. C'est du rattrapage visuel : l'état logique est déjà le nouveau.
- **`versMonde(x, y)`** — un point d'écran en pixels logiques vers une **case**, ou `null` hors carte. En 3D c'est un lancer de rayon sur le maillage de terrain ; en 2D une division. Le contrôleur ne sait pas laquelle.
- **`versEcran(c)`** — l'inverse : le centre d'une case vers un point d'écran, ou `null` si la case est hors champ. Sert à ancrer les bulles du HUD sur une unité.
- **`brancher(gestes)`** — installe les écouteurs et rend la fonction de débranchement. Le rendu garde pour lui tout ce qui concerne la caméra (glisser, zoom, quarts de tour) et ne remonte que les intentions de jeu : clic sur une case, survol, annulation, touche.
- **`cadrer(c)`** — recentre sur une case, sans animation. Appelé quand l'IA joue loin du regard du joueur.
- **`demonter()`** — retire les écouteurs, arrête la boucle, libère les contextes, la mémoire graphique et les caches. Une page qui monte et démonte cent fois ne doit pas fuir.

Deux règles complètent l'interface :

- **Le rendu ne décide de rien.** Aucune méthode ne renvoie une `Action`.
- **Le rendu ne parle qu'en cases.** Ni pixels, ni mètres, ni unités de scène ne franchissent l'interface — c'est ce qui rend le contrôleur rigoureusement commun aux deux peaux, et c'est ce qui a permis d'écrire le rendu 3D sans toucher au reste du jeu.

---

## 12. Ce qui reste ouvert

1. **Le nombre de cascades d'ombres** et leur portée sont à mesurer sur matériel réel ; deux est une hypothèse **[proposition]**.
2. **L'instanciation des unités avec masque d'équipe** suppose une couleur par instance ; si le coût en shader se révèle plus élevé qu'un matériau par nation (au plus quatre par match), on prendra l'autre voie. La décision se prend au profilage, pas à l'écriture.
3. **Le seuil de 48 px par case** est ferme pour le zoom par défaut ; le seuil du zoom le plus large (24 px ?) reste à trancher — il n'a pas la même exigence, puisqu'à ce palier on lit la carte et non les unités.
4. **Le mode photo** (`12-au-dela-advance-wars.md` §5.3) demanderait une caméra libre, donc une entorse à la règle du lacet fixe. C'est une entorse acceptable **hors partie** ; jamais pendant.
5. **Le kit d'une unité spéciale.** Les vingt-quatre unités propres (la Roulante, le Shinkansen, le Téléphérique…) sont des **modèles uniques**, pas des kits : elles n'ont ni géométrie partagée ni gabarit. Le chargement par `(unite, pays)` les traite comme n'importe quelle unité — leur clé n'existe que dans un pays — mais aucune spécification n'est encore produite pour elles.
6. **Les colles saisonnières du décor** : un arbre d'automne est-il un modèle ou une texture ? Les spécifications demandent aujourd'hui quatre jeux de textures et un seul modèle ; si le feuillage d'hiver demande une géométrie différente (branches nues), il faudra un second modèle et le format devra le dire.
