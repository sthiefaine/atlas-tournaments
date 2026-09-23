# Le sol de la peau 2D — matières, voies, repli, limites

Lot « terrain » du chantier des sprites lisses (23 septembre 2026, `doc/refonte/plan-sprites-campagne.md`, agent D). Le contrat est `src/render2d/contrat.ts` (`CoucheSol`, `FabriqueSol`, `OptionsSol`) ; la conception du rendu, `doc/18-rendu-sprites.md`. Ce document dit ce que fait `src/render2d/sol/`, pourquoi, et ce qui n'est pas vérifié.

## 1. Les fichiers

| Fichier | Rôle |
|---|---|
| `index.ts` | `creerSol` : la couche, ses textures, ses transitions. `maj` ne touche jamais au contexte WebGL ; `dessiner` envoie ce qui a changé puis dessine. |
| `nuanceurs.ts` | Les deux sources GLSL ES 3.0. Toutes les constantes sont écrites depuis les tables TypeScript au chargement du module. |
| `terrains.ts` | Le code de chaque terrain dans la texture, et son mélange de huit matières. |
| `grille.ts` | Le raisonnement pur sur la grille : liaisons, pièces de voie et d'eau, axe des ponts, encodage de la texture de cases. |
| `lecture.ts` | La lecture de la grille logique par le moteur (`terrainLogique`), relue quand `signatureTerrain` change. |
| `details.ts` | La synthèse des onze couches de détail (256², bouclables, déterministes). |
| `couleurs.ts` | Les palettes par biome, teintées par l'ambiance ; l'apparence des voies par biome. |
| `decor.ts` | Le placement du décor (`InstanceSprite`), les identifiants, le repli, la visibilité près du brouillard. |
| `lumiere.ts` | La lumière de cuisson (`ECLAIRAGE_CUISSON`) dans les repères du sol et de l'écran. |
| `gl.ts` | Compiler, lier, envoyer une texture avec des réglages de dépaquetage neutres. |

Rien n'importe `render3d/` ni `three` : ce qui servait a été **repris** (`pieceDepuisLiaisons`, les apparences de voies, les palettes de biome, les chiffres de météo, le hachage de case). Le sol en est désormais le propriétaire.

## 2. Le nuanceur, en une passe

Un quadrilatère couvre la carte dans le plan, plus 0,4 case au-dessus de la rangée 0 (ce qui dépasse d'une frondaison ou d'un sommet du repli). Chaque fragment :

1. **Lit ses neuf voisines** (`texelFetch`, un texel par case). Il en tire des champs : les poids des huit matières par un **noyau lisse** autour des centres (`1 − smoothstep(0,2 ; 0,8 ; d)`) — des lisières rondes, pas les losanges d'un filtrage bilinéaire —, la part de mer, la distance au chenal d'une rivière, la distance à la plus proche case cachée. La position est d'abord **déformée** par du bruit (±0,14 case) : les lisières ondulent.
2. **Mélange les matières par leur relief** : `e = poids + relief × 0,45`, profondeur 0,12. Là où deux matières se partagent une lisière, la plus haute perce — l'herbe entre les galets, le sable dans les creux.
3. **Neige** (couvre d'abord les creux), **pluie** (assombrit), **quai** (un mur sombre là où le port touche la mer).
4. **L'eau** : la mer par son étendue (le champ de mer, ramené à une distance par sa pente à la rive), la rivière par son chenal (capsules du centre vers le milieu des bords liés), fondues l'une dans l'autre à l'estuaire. Grève de sable au bord de la mer, sable mouillé, hauts-fonds qui laissent voir le fond, rides et reflets animés par `tempsMs`, écume au bord et en bandes. **Immobile sous animations réduites.**
5. **Les voies** : chaque bras va du centre au milieu d'un bord lié ; deux cases voisines se raccordent donc exactement, à largeur constante, à tout zoom. Motif par biome (tirets, ornières, pavés, planches, fissures), accotements, neige et pluie. **Le pont** : tablier de madriers, chaussée continue, garde-corps, ombre portée sur l'eau du côté opposé à la lumière ; il s'efface quand l'image cuite du pont existe dans ses deux vues.
6. **La grille**, un trait d'un pixel à 10 %.
7. **Le décor de repli** (§5), s'il le faut.
8. **Le brouillard** : une case cachée est **noire d'un bord à l'autre** ; la transition d'une demi-case est prise **du côté vu** — rien d'une case cachée ne transparaît.
9. **Ce qui dépasse de la case d'en dessous** (frondaisons, sommets, brins du repli) se peint par-dessus, avec la visibilité de *sa* case : une montagne vue dépasse sur le noir, une montagne cachée ne dépasse nulle part.

Les dérivées d'écran sont prises une fois en tête de `main`, hors de tout branchement, et toutes les lectures de texture passent par `textureGrad` : une lecture ordinaire dans une branche qui dépend du fragment n'a pas de niveau de détail défini et scintille aux lisières. Un test lit la source et refuse tout `texture(`.

## 3. Les données

- **La texture de cases** (RGBA8, sans filtrage) : R le code du terrain (`terrains.ts`, les bâtiments en fin de liste pour que `code >= CODE_VILLE` dise « bâti »), G les bras de voie + l'axe d'un pont + « porte une voie », B les bras d'eau, A le brouillard (255 vu, 0 caché). Ligne 0 de la carte = ligne 0 de la texture.
- **La texture d'avant**, même format : l'état d'avant une marée, le temps du fondu.
- **Le tableau de détail** (`TEXTURE_2D_ARRAY`, 11 couches de 256², niveaux de détail, filtrage anisotrope ×4 s'il existe) : R la clarté du grain **lumière de cuisson comprise**, G le relief, B un accent (fleurs, feuilles, cailloux, joints moussus). La couleur n'est jamais dans la texture : une averse ne repeint aucun pixel. Couches refaites seulement au changement de saison (et de biome, qui est fixe pour une couche).

## 4. Les couleurs

Une palette par biome et par matière (herbe, terre, roche, sable : celles de la 3D ; galets, pavé, sous-bois, herbe haute, neige : neuves), **multipliée par un rapport** : la couleur de l'ambiance du moment divisée par celle du printemps clair. L'automne qui roussit l'herbe de l'ambiance roussit ainsi l'herbe du désert comme celle de la plaine, chacune depuis la sienne. L'accent de ce qui pousse change avec la saison : fleurs pâles, herbe sèche, feuilles tombées, givre.

**La nuit n'est pas dans le sol.** Il lit la palette de *jour* de la même saison et de la même météo ; la nuit est l'étalonnage du moteur 2D, posé d'un seul geste sur le sol et sur les images cuites en plein jour. Un sol qui s'assombrirait lui-même le serait deux fois.

Neige au sol : `max(météo neige 1, hiver 0,55, biome neige 0,78)`, les chiffres de la 3D. Humidité, agitation et écume : ceux de `render3d/eclairage.ts`.

## 5. Le décor

**Placement** (`decor.ts`, pur, testé) : forêt, trois à cinq arbres — deux au fond, deux sur les flancs avant, un cinquième au fond au milieu ; **le devant du centre reste dégagé**, c'est là que se tient une unité. Hautes herbes, deux à quatre touffes en couronne. Montagne, une seule, au centre. Plaine et hautes herbes, buissons épars (18 % des cases en plaine, 30 % en jungle, 6 % au désert…). Roseaux au bord de l'eau (70 % au marais, 20 % ailleurs, jamais au désert, sous la neige ni au volcan). Rochers de côte rares en `cotier` et `archipel` (sur la grève ou dans l'eau du bord). Pont, une instance au centre.

**Essences par biome** : feuillus et conifères mêlés en plaine et forêt, conifères en montagne et sous la neige (et sept sur dix sur la côte), palmiers au désert, forêt tropicale en jungle, palmiers et tropical en archipel, feuillus au marais. Montagne : `montagne_aride` au désert, `montagne_volcan` en volcanique, `montagne` ailleurs ; si la propre manque, la commune.

**Identifiants** : `idDecor(essence, saison, n)`, puis `idDecor(essence, 'toutes', n)` ; `n` tiré parmi les variantes **présentes** (de 1 à 16, trous tolérés). L'animation posée est le clip `repos` de la vue `fixe`, sinon le premier clip de la vue ; `cadre` 0. Rochers : `decor_rocher_cotier`, `decor_rocher_archipel`. Pont : `terrain_pont`, vue `fixe` pour un pont nord-sud, `travers` pour un pont est-ouest (le GLB circule le long de son +Z) ; jamais dans la mauvaise vue.

**Hasard** : positions, tailles (±10 à 15 %) et variantes viennent d'un hachage de case (celui de la 3D). Aucun miroir : l'ombre est cuite dans l'image, la retourner la ferait tomber du mauvais côté.

**Brouillard** : une case cachée ne rend **aucune** image. C'est un écart assumé au mot du contrat (« le décor porte `vue` = 0 ») : une montagne cuite dépasse vers le haut sur la case du dessus, et sa silhouette, même noire, y dessinerait le relief caché. Près du noir, une image s'assombrit comme le sol (`vue` continue, même formule que le nuanceur).

**Repli** : sans image pour la forêt, la montagne ou les hautes herbes du biome, `volumes()` n'en rend pas et le nuanceur les dessine — frondaisons bosselées éclairées comme les images cuites, ombres portées, troncs ; une montagne à deux versants, calotte de neige selon le biome et la météo, liseré de crête ; des touffes de trois brins. Les essences d'arbre présentes en partie sont plantées seules.

## 6. Les transitions

Deux, de 1,4 s, instantanées sous animations réduites (option ou `ctx.reduit`) : la **marée** (ou un chantier du génie) mêle les champs de l'ancien sol et du nouveau — la rive glisse, l'écume enfle au passage —, et l'**ambiance** (météo, saison) fait glisser les couleurs. Le départ est pris à la première image qui les dessine. `enMouvement()` est vrai tant que l'une d'elles joue. La signature du moteur change chaque jour ; un jour qui ne change aucune case ne rejoue rien (comparaison case à case).

## 7. Deux règles de voie qui s'écartent de la 3D

- **Hors carte, une voie ne se raccorde que si elle arrive de face.** La 3D prolongeait le bord : une route qui longe la rangée 0 lançait un moignon vers l'extérieur à chaque case. Une route qui descend vers le bord continue au-delà, comme avant.
- **Une route ne se raccorde à un pont que par son axe** : sur le flanc, elle buterait contre le garde-corps.

## 8. Ce que le moteur 2D doit faire

- `creerSol(gl, etat, { biome, reduit, manifeste })` au premier `afficher`, puis **une seconde fois** quand le manifeste arrive — c'est ce que fait `src/render2d/index.ts` : le manifeste est lu à la naissance. Les couches de détail sont mémorisées par biome et saison, la seconde naissance ne les resynthétise pas ; seul le programme se recompile.
- À chaque `afficher` : `maj(etat, vue, niveauxBrouillard(largeur, hauteur, vue.visibles))` ; vrai → une image. `maj` ne touche jamais au contexte.
- À chaque image, **en premier** : `dessiner(ctx)` peint `sol` et `voies`. État laissé : le programme du sol, ses textures sur les unités 0 à 2, `BLEND` actif en alpha prémultiplié (`ONE, ONE_MINUS_SRC_ALPHA`), `DEPTH_TEST` et `CULL_FACE` éteints, aucun tableau de sommets lié. Le fond hors carte est au moteur.
- `volumes()` rend le même tableau tant que rien n'a bougé ; triées par ligne, à mêler aux bâtiments.
- **`ambiant()`** (ajout du contrat du 23 septembre) : vrai tant qu'une case de mer, de rivière ou de pont est vue et que les animations ne sont pas réduites (option ou dernier `ctx.reduit`). Le moteur redessine alors au pas d'ambiance ; l'eau ondule avec `tempsMs`. `enMouvement()`, lui, ne couvre que les transitions.
- **`tactique(actif)`**, hors contrat (proposé) : le mode tactique retire la végétation ; le moteur filtre les images cuites, mais le repli du nuanceur (arbres, hautes herbes) ne peut l'apprendre que par là. La montagne du repli reste — le relief ne part jamais. Ajout proposé : `CoucheSol.tactique?(actif: boolean): void`, appelé par `modeTactique` **et** après chaque `monterSol`, pour que le mode survive à la seconde naissance. `creerSolTerrain` rend ce type complet sans conversion.
- **L'étalonnage de nuit** doit s'appliquer au sol comme aux images cuites.

## 9. Ce que la cuisson doit produire

- Décor : `decor_<essence>_<saison|toutes>_<n>`, `n` à partir de 1, famille `decor`, une animation en vue `fixe` (clip `repos` de préférence) avec au moins un cadre ; le pivot au pied, au centre de l'emprise.
- Rochers : `decor_rocher_cotier`, `decor_rocher_archipel`, vue `fixe`.
- Pont : `terrain_pont`, vues `fixe` **et** `travers` (les deux effacent le tablier du nuanceur ; une seule laisse le tablier et pose l'image là où la vue existe).

## 10. Vérifications, et ce qui ne l'est pas

- `tests/render2d/sol/*.test.ts` (60 tests) : codes et mélanges, seize liaisons pour six pièces, raccords route–bâtiment–pont, chenal sous le pont, bords de carte, texture de cases et brouillard, marées réelles du moteur (`meca_marees`) et poses du génie, couches bouclables et déterministes, placement et densités par biome, identifiants et repli, rien sous le noir, couleurs par saison et météo, source GLSL (constantes, uniformes, aucune dérivée implicite), couche montée sur un contexte de papier (maj sans GL, envois à l'image, transitions, `ambiant`, mode tactique, libération). Les 95 tests du moteur 2D (`tests/render2d/*.test.ts`) passent avec ce sol.
- `e2e/sol-2d.spec.ts`, **sans serveur** (`E2E_BASE_URL=http://127.0.0.1:9 npx playwright test e2e/sol-2d.spec.ts [--browser=webkit] --output=<dossier à soi>`) : compilation et lien réels sous Chromium **et** WebKit, tous les uniformes actifs ; puis une image dessinée : case cachée `[0,0,0,255]` jusqu'à 0,08 de son bord, mer bleue, plaine verte, roche grise, chaussée grise sans un pixel d'herbe à travers deux frontières de case, eau de la rivière de part et d'autre du tablier, marée vue, jouée et finie, aucune erreur GL ni de console.
- **Mesure de la synthèse** (onze couches de 256²) : environ 75 ms de processeur une fois le code chaud, 350 à 400 ms au premier appel — **mesurées avec une charge moyenne de 290 à 490 sur 8 cœurs**, où le compilateur de V8 travaille en arrière-plan à la portion congrue. Le budget de 100 ms n'est **pas vérifié** sur une machine calme.
- **Non vérifié** : tout le visuel (consigne) — la lisibilité du repli, la force de la grille, la grève, l'écume ; le coût du nuanceur sur un téléphone (jusqu'à une vingtaine de lectures de texture par fragment, typiquement douze) ; le comportement réel avec des images de décor cuites, qui n'existent pas encore.
