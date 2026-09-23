# L'écran de combat de la peau 2D — notes (23 septembre 2026)

Le lot « écran de combat » du chantier des sprites lisses (`doc/refonte/plan-sprites-campagne.md`, `sprites-moteur.md`) : `ouvrirCombat(hote, geste)` sur la peau 2D, la vue de côté où deux formations se tirent dessus. Ce que le propriétaire avait demandé est dans `mobile-formations-combat.md` et `bataille-animation.md` ; ce document dit comment c'est fait, ce qui est vérifié, et ce qui ne l'est pas.

## Les fichiers

| Fichier | Ce qu'il fait |
|---|---|
| `src/render2d/combat.ts` | `ouvrirCombat2d` et tout ce qu'il lit : chronologie, effectifs, disposition, profil de tir, décor d'une case, clips de profil |
| `src/render2d/index.ts` | le branchement : `ouvrirCombat` de `creerRendu2d` passe à `ouvrirCombat2d` ce que la peau sait déjà (état, vue, atlas, couleurs, entrées) — vingt-quatre lignes, rien d'autre |
| `tests/render2d/combat.test.ts` | 30 tests, sans DOM ni WebGL |
| `e2e/combat-2d.spec.ts` | le spec Playwright, Chromium et WebKit |

## Comment c'est dessiné

Le HUD (`render/scenes-html.ts`) ouvre son écran de combat, pose une fenêtre transparente (`.scene3d`) et appelle `ouvrirCombat` ; une présentation rendue lui fait cacher ses plaques peintes (`data-modele="3d"`, le nom qu'il donne à toute présentation dans la toile), `null` les lui fait garder. La peau répond par des **encarts** (`Rendu2d.ouvrirEncart`) : des scènes de sprites dessinées dans la toile, au rectangle d'un élément HTML, qui partagent le lot, l'atlas et les replis de la carte.

**Le décor est fait de bandes.** Un encart ne sait peindre qu'un fond uni par rectangle. L'écran de combat pose donc dans l'hôte une grille d'éléments vides — le ciel sur toute la largeur, puis pour chaque moitié le lointain et le sol, et un filet de trois pixels entre les deux cases — et ouvre un encart au fond uni par élément, puis un dernier encart sans fond, au rectangle de l'hôte, pour les figurines. Sept encarts, les bandes d'abord. L'horizon tombe à 44 % de la hauteur (`PART_HORIZON`), la grille CSS et la disposition le savent toutes deux.

**Les couleurs d'une case** : le sol est le mélange de matières du terrain (`sol/terrains.ts`, `poidsDe`) dans les couleurs du biome et de la saison (`sol/couleurs.ts`, `couleursSol`), couvert de neige autant que la carte l'est ; la mer, la rivière, la chaussée et le pont ont les leurs ; le lointain est la mer d'une plage, la roche d'une montagne, la lisière d'une forêt, la ville derrière une cour, sinon le sol voilé par la distance. Le ciel est le bleu de la palette d'ambiance, éclairci le jour, enfoncé la nuit. Tout passe sous le voile d'ambiance (nuit, brume, pluie, tempête), comme la carte. Sur l'horizon se dressent les arbres d'une forêt (l'essence du biome), la montagne (aride au désert, volcan en terre volcanique), le bâtiment d'une case bâtie **aux couleurs de son propriétaire** (le gris neutre sans propriétaire, jamais le blanc des zones d'équipe cuites), les touffes des hautes herbes, deux buissons en plaine, un palmier ou un rocher sur la plage.

**Les formations** : dix places par côté, une figurine par PV affiché (`Geste.duel` les donne déjà de 0 à 10). La disposition (`disposerCombat`, pure) essaie quatre formations — 2 × 5, 3 × 4, 4 × 3, 5 × 2 — et garde celle qui donne les plus grandes figurines, les deux côtés à la même échelle, à égalité la plus large : deux colonnes de cinq rangs sur un téléphone en portrait, cinq colonnes de deux sur une bande basse. Une figurine ne dépasse ni 42 % de la hauteur ni 160 pixels. Les rangs sont décalés d'un quart de pas, et se remplissent **du centre vers les bords** : une formation entamée reste groupée, les pertes partent des bords. L'attaquant est à gauche et regarde à droite, la cible en miroir — comme les plaques du HUD et comme la 3D. La caméra de l'encart met le centre du plan au centre de l'hôte, une case y vaut la taille d'une figurine ; la disposition ne se refait que si la taille de l'hôte change.

**Les images** : la vue `profil` d'une entrée cuite (`atlas.entree`, `choisirAnimation`), ses clips `repos`, `tir`, `touche`, `hors_jeu` ; un clip absent retombe sur un autre clip **de profil**, jamais sur la vue de trois quarts de la carte. Une entrée sans vue de profil — aujourd'hui toutes, aucun manifeste n'est livré — se dessine en **repli**, la silhouette du HUD, qui est elle-même de profil. Les couleurs d'équipe sont celles de la carte (`couleurEquipe` : le style de la nation). Rien ne se charge ici : l'atlas rend l'image cuite qu'il a, ou son repli, et demande une page absente une fois, comme partout.

**Les effets** sont la forme d'ombre du rendu (`FORMES.ombre`, une ellipse douce) poussée vers le blanc par son `eclat` : éclair de bouche, projectile, traînée grise d'un missile ou d'un obus, éclat et poussière d'une figurine perdue. Le profil d'un tir se lit sur les données (`profilTir2d`, la lecture de `sonTir` prolongée) : rafale (petit traçant, éclair qui papillote), obus (en cloche), missile (léger arc, traînée), traçant de canon.

## La chronologie

Celle de la partition, et d'elle seule (`chronologieDuel`) : le HUD fait tomber ses jauges aux mêmes instants (`partCoup + trajet`, `partRiposte + trajet`), et la carte y joue ses sons.

| Instant | Cadence normale (1 900 ms) | Cadence rapide (950 ms) |
|---|---:|---:|
| départ du tir (35 %) | 665 ms | 332,5 ms |
| départ de la riposte (+ 80 ms, + 40 ms) | 745 ms | 372,5 ms |
| impact sur la cible : **ses pertes tombent là** | 925 ms | 462,5 ms |
| impact de la riposte : **celles de l'attaquant** | 1 005 ms | 502,5 ms |
| arrêt sur image, puis secousse | 60 ms, puis 200 ms | 30 ms, puis 100 ms |
| hors-jeu d'un côté tombé à zéro (fondu) | 420 ms | 210 ms |

- Chaque figurine debout **tire en décalé** : 24 ms d'écart (moins pour une salve de dix, qui part toute avant la moitié du vol) ; chaque projectile arrive **à l'impact**, ensemble. La riposte part avant l'impact qui la décime : elle tire avec tous les siens, et les projectiles se croisent.
- À l'impact, les figurines perdues quittent la formation, un éclat et une poussière à leur place ; les survivantes blanchissent le temps d'un **arrêt sur image** (leur image tient), puis jouent `touche`, secouées trois fois, sobrement. Un côté qui tombe à **zéro** joue son `hors_jeu` en s'effaçant.
- Pas de riposte quand le moteur n'en a pas : la cible ne tire pas, l'attaquant ne perd rien.
- **Les sons ne sont pas joués par l'écran** : les gestes `tirer` et `encaisser` de la carte, que le réalisateur écrit sous l'écran de combat aux mêmes instants (`ecrirePartition`), les jouent déjà — la 3D fait de même. Les jouer ici les ferait entendre deux fois.
- **Animations réduites** (le réglage du joueur ou celui de l'appareil) ou partition sans durée (« instantanée ») : l'issue paraît d'emblée, sans un projectile. **Passer** (`Combat2d.passer`) saute à l'issue ; le clic du HUD, lui, coupe toute la partition et ferme l'écran. **Fermer** rend les sept encarts et retire les bandes de l'hôte, deux fois sans dommage.
- Aucune allocation par image : les poses (une centaine) sont créées à l'ouverture et réécrites en place, une pose inutile passe à l'opacité 0 ; la caméra est un seul objet ; les effectifs ne s'écrivent sur la racine (`data-effectifs`) que quand ils changent.

## Ce qui est vérifié, par du code

- `tests/render2d/combat.test.ts`, **30 tests verts** : la chronologie (normale, rapide, sans riposte) ; le nombre de figurines égal aux PV affichés de chaque côté avant, juste avant l'impact, à l'impact, avant et à la riposte, à la fin, en cadence normale et rapide ; le feu qui part à 35 % et pas avant, la riposte 80 ms plus tard, tous les projectiles arrivés à l'impact ; aucune riposte ni perte de l'attaquant sans riposte du moteur ; les clips de profil (repos, tir en décalé, arrêt sur image blanc, coup reçu, repos) ; le hors-jeu qui s'efface ; éclat et poussière des pertes ; l'issue d'emblée sous animations réduites et sans durée ; passer ; la fermeture idempotente ; l'ordre des encarts et les couleurs des bandes ; les mêmes poses et la même caméra d'une image à l'autre ; la caméra qui suit une nouvelle taille d'hôte ; la disposition dans le rectangle et dans sa moitié pour neuf tailles (de 240 × 160 à 1 200 × 370) et seize couples de gabarits, appareils compris ; le décor (arbres, montagne aride, bâtiment aux couleurs du propriétaire, gris neutre, mer bleue, herbe verte, neige de l'hiver, nuit, repli de saison) ; le profil de tir ; les clips de profil.
- `e2e/combat-2d.spec.ts`, **vert sous Chromium (10,7 s) et WebKit (19,6 s)** contre un serveur à soi, sur `/jeu/premier_contact?rendu=2d` : le char roule au bout du pont et attaque l'infanterie ; l'écran s'ouvre avec la présentation de la peau (`data-modele="3d"`, `[data-combat2d]` dans l'hôte) ; dans une capture, le pixel au milieu de l'hôte est **exactement le filet** (11, 20, 26) et le ciel est uni d'un bord à l'autre (151, 206, 242 des deux côtés) ; les effectifs lus à chaque image vont de **10:10 à 10:6** ; l'écran se ferme seul ; pendant le tour de l'adversaire, le bouton « Toucher pour passer » ferme son duel **5 ms (Chromium) et 19 ms (WebKit)** après le clic, 82 et 90 ms après l'ouverture ; aucune erreur de console. **Témoin** : sans `ouvrirCombat` dans la peau (méthode renommée le temps d'un passage), le spec tombe sur `data-modele`, le HUD ayant gardé ses plaques. `e2e/rendu-2d.spec.ts` reste vert avec le branchement.
- `npm run typecheck` : aucune erreur dans ces fichiers (les deux seules sont dans `src/content/difficulte.ts`, d'un autre lot en cours) ; `eslint` propre sur les quatre fichiers.

## Ce qui n'est pas vérifié

Rien n'a été regardé à l'écran (consigne). En particulier : la lisibilité des formations et des replis à la taille d'une vignette de téléphone, le goût des couleurs du décor et des bandes, la lecture des effets (des taches blanches et grises, pas des images d'effet), la force de la secousse et de l'arrêt sur image, l'aspect d'une image cuite de profil (**aucune n'existe** : pas de manifeste livré au moment d'écrire, tout est en repli), la cadence réelle sur téléphone, la bascule d'un repli vers l'image cuite si la page de profil arrive en plein duel.

## Ce que l'écran attend de la cuisson (vue `profil`)

- La vue `profil` pour chaque unité, au tangage `TANGAGE_PROFIL` (12°), **tournée vers la droite** (le rendu retourne la cible), pivot au point de contact au sol, à la densité de la carte (128 pixels par case) : l'écran l'agrandit ou la réduit par sa caméra.
- Les clips `repos` (en boucle), `tir`, `touche`, `hors_jeu` (sans boucle, la dernière pose de `hors_jeu` gardée) ; un clip absent retombe sur le repos de profil. `capture` n'y sert pas.
- Les appareils cuits **à leur hauteur de vol** : l'écran ne les lève que peints en repli.
- La vue de profil sur les **mêmes pages** que la vue de carte quand c'est possible : une page de profil qui n'est pas encore là se dessine en repli et se demande une fois, et son arrivée en plein duel fait passer une figurine du repli à l'image cuite.
- Rien d'autre : ni fond, ni sol, ni effet — le décor est peint par l'écran, les effets par la peau.

## Ce qui dépend d'autres lots (décrit, pas fait)

1. **Des aplats dans un encart** (`index.ts`, `EncartSprites`) : un champ facultatif `aplats?(trace)` peint sous les poses permettrait un vrai dégradé de ciel, des collines, une chaussée — et un seul encart au lieu de sept. Aujourd'hui, chaque encart coûte à chaque image deux `getBoundingClientRect`, un `Float32Array(9)` et une copie de ses poses (`dessinerEncart`) : les réutiliser d'une image à l'autre retirerait les seules allocations par image qui restent pendant un duel.
2. **Les images d'effet** (`effets.ts`, en cours dans le lot des animations : `effet_eclair`, `effet_trait_k`, `effet_missile_k`, `effet_etoile`, `effet_poussiere`, `effet_fumee_n`, teintables) : une fois reconnues par le résolveur de la peau, l'écran de combat remplacera ses taches d'ombre par elles — traçant orienté, missile, étoile d'impact, fumée —, sans rien changer à sa chronologie.
3. **L'essence d'arbre d'un biome** : `sol/decor.ts` n'exporte pas `ARBRES` ; `combat.ts` en garde une copie de la première essence par biome, à retirer le jour où le placement l'exporte.
4. **Le HUD** (`scenes-html.ts`) : `data-modele="3d"` nomme toute présentation dans la toile, 2D comprise — `toile` serait plus juste. Ses plaques prennent la couleur de `paletteDe(camp)`, les figurines celle de la nation (`couleurEquipe`) : les deux peuvent différer, non vérifié à l'œil.
5. **Trouvé en écrivant le spec** : à 1 280 × 800, la prévision de duel (`.duel-camp`) couvre le centre de la case visée ; un clic au centre de la cible tombe sur elle et **ne confirme pas l'attaque** (Entrée confirme). Le spec confirme au clavier ; le défaut est à regarder côté HUD.

## Chaînes d'interface

Aucune : l'écran de combat de la peau ne dessine pas de texte, les libellés sont ceux du HUD.
