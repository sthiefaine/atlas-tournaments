# La bascule en 2D — notes de l'intégration (23 septembre 2026)

Lot J du plan `doc/refonte/plan-sprites-campagne.md` : la peau 2D (`creerRendu2d`, les images cuites) devient **la** peau de ce que voit le joueur — le jeu, l'écran-titre, l'atelier, le carnet. La 3D reste joignable par `?rendu=3d` sur la route de jeu, et seulement là, jusqu'à son retrait d'un seul commit (vague 3, lot K). Ce document dit ce qui a changé, ce qui a été mesuré, et ce qui dépend encore de `render3d/`.

## Ce qui a changé

| Où | Avant | Après |
|---|---|---|
| **Le jeu** (`/jeu/[scenario]`, `toile.tsx`) | 3D par défaut, 2D derrière `?rendu=2d` | 2D par défaut, 3D derrière `?rendu=3d` (import à la demande, seule entrée restante de `render3d/`) |
| **L'écran d'échec** | « WebGPU est indisponible » à tout échec | 2D : « WebGL 2 est indisponible » si la sonde (`moteur2dDisponible`) le dit, sinon « Le jeu n'a pas pu démarrer » avec une piste neutre ; 3D : le message d'avant |
| **L'écran de chargement** (`chargement.tsx`, `etapes-chargement.ts`) | quatre cases, dont « le moteur démarre » | trois cases vraies : modules, plateau, première image. `moteur` — que seule la 3D annonce encore — se lit comme le plateau qui se monte |
| **L'écran-titre** (`vitrine.tsx`, `attract.tsx`) | attract 3D, refusé à tout appareil tactile | attract sur la peau 2D, **monté aussi au téléphone** ; porte : WebGL 2 (`render2d/gl`, la sonde seule) ; refusé sous animations réduites (appareil, maître, ou réglage du joueur) et sous l'économiseur de données de l'appareil ; le plateau SVG n'est qu'un repli (`data-fond` = `attente`, `attract` ou `repli`) ; la toile ne prend pas le focus du clavier |
| **Le plateau SVG** (`plateau-accueil.tsx`) | couleurs recopiées de `render3d/` | couleurs importées de la peau 2D (`render2d/sol/couleurs.ts`, `render2d/surbrillances.ts`) — composant serveur, aucun octet de JS en plus |
| **Le banc** (`/atelier`, `atelier.tsx`) | peau 3D, qualité d'affichage, rotation, inclinaison | peau 2D (`data-rendu="2d"`), vue fixe, sans réglage de qualité ; un lien vers la vitrine |
| **La vitrine** (`/atelier/unites`) | la page du banc (réexportée) ; la vitrine 3D à six angles, orpheline | **la vitrine des images cuites** : une famille, une pièce, toutes ses vues et tous ses clips animés, la couleur de chaque camp (ou tous côte à côte), la gauche retournée, l'ombre du jeu, cinq échelles de 48 à 256 px par case, trois fonds (dont un damier), lecture et pause, l'état du manifeste — lu, absent, refusé et pourquoi —, le repli quand l'entrée manque |
| **La carte des assets** (`/atelier/assets`) | `render3d/scene` et `render3d/modeles` | three seul, importé à la demande — elle montre les GLB sources, pas le jeu ; les deux aides reprises (repli WebGPU retiré, attributs quantifiés réalignés) |
| **Le carnet en jeu** (`apercu-unite.tsx`) | une scène WebGPU à orbite | une **vignette cuite animée** : le repos de l'unité tournée à droite (la vue fixe d'un bâtiment), son ombre, le kit de la nation s'il est cuit, le repli sinon |
| **Le HUD** (`hud-html.ts`) | aide caméra qui promet Alt et Maj | sans `tourner`, l'aide dit « Glisser : déplacer la carte. Molette ou pincement : zoomer. Double-tap : rapprocher. » (`hud.aide_camera_2d`) |

**L'outil partagé** : `src/render2d/vignette.ts` peint une image d'une entrée du manifeste sur un canevas 2D, sans WebGL. Il reproduit la formule du nuanceur du lot (`couleur × mix(1, équipe, masque)`, sur les mêmes octets), le pivot et le miroir d'`empaqueter`, l'image du moment (`cadreAuTemps`, et un rejeu avec pause pour un clip qui ne boucle pas), le kit (`idPour`, la règle d'`Atlas.idPour`), la couleur d'équipe (`couleurEquipe`, la règle de `creerRendu2d`), l'ombre d'unité (`OMBRE_UNITE`) et le repli (`replis.ts`). La réserve lit chaque page **une fois**, en extrait les images utiles, la relâche, et borne ce qu'elle garde (quatre millions de pixels par défaut, douze dans la vitrine). Le lecteur fait tourner **une** boucle pour toutes les toiles d'une page, ne repeint une toile que si son image change, et sa pause fige l'image du moment.

**Chaînes neuves** (`content/i18n/interface.fr.json`) : `campagne.sans_webgl2`, `campagne.echec_demarrage`, `campagne.echec_demarrage_aide`, `hud.aide_camera_2d`. Aucune clé existante modifiée ; `chargement.moteur` n'est plus lue (la 3D la rend encore possible, le lot K peut la retirer). `npm run extraire-chaines` à blanc : propre.

## Les poids, mesurés

Deux builds de production (`next build --no-lint`) : avant — `HEAD` `d29b20d1`, instantané par `git archive` sous `.claude/worktrees/` — et après, le code de ce lot dans l'arbre du jour. Chacun servi par `next start`, chaque page ouverte dans Chromium (1280 × 800, Metal) jusqu'à son plateau, puis quatre secondes. Les morceaux de JavaScript téléchargés sont relevés sur le réseau, relus dans le build et classés par marques : **three** (`isWebGPURenderer`, `isNodeMaterial`, `isMeshStandardMaterial`), **compléments** (chaînes du chargeur glTF), **render3d** (les messages de `choisirBackend`).

| Page | Avant : morceaux · brut · gzip | three / render3d | Après : morceaux · brut · gzip | three / render3d |
|---|---|---|---|---|
| `/` | 28 · 2 486 ko · 678 ko | oui / oui | 18 · 1 526 ko · 420 ko | **aucun** |
| `/jeu/demo` | 26 · 2 583 ko · 713 ko | oui / oui | 16 · 1 519 ko · 415 ko | **aucun** |
| `/jeu/demo?rendu=3d` (témoin) | 26 · 2 583 ko · 713 ko | oui / oui | 22 · 2 661 ko · 738 ko | oui / oui |
| `/campagne` | 10 · 406 ko · 123 ko | aucun | 10 · 410 ko · 125 ko | aucun |
| `/atelier` | 24 · 2 201 ko · 590 ko | oui / oui | 15 · 1 252 ko · 337 ko | **aucun** |
| `/atelier/unites` | 24 · 2 201 ko · 590 ko | oui / oui | 15 · 1 100 ko · 284 ko | **aucun** |

Le témoin prouve que la mesure voit la 3D quand elle est là : `?rendu=3d` tire deux morceaux de three, un de compléments et un de `render3d/`. Le « premier chargement » que `next build` imprime ne compte pas les morceaux chargés à la demande (la toile, l'attract, la vitrine) :

| Page | Avant (taille · premier chargement) | Après |
|---|---|---|
| `/` | 1,98 ko · 111 ko | 3,09 ko · 112 ko — la sonde WebGL 2 (`render2d/gl.ts`) et la garde des données remplacent la sonde WebGPU |
| `/jeu/[scenario]` | 1,69 ko · 105 ko | 1,7 ko · 105 ko |
| `/campagne` | 5,79 ko · 123 ko | 5,93 ko · 124 ko — pas ce lot (conséquences de campagne) |
| `/atelier` | 142 o · 246 ko | 136 ko · 248 ko — le banc ne partage plus son morceau avec `/atelier/unites` |
| `/atelier/unites` | 142 o · 246 ko | 1,31 ko · 105 ko |

**Les images, depuis que le manifeste est sur le disque** (101 entrées, relevé de la même mesure) : l'écran-titre tire **33 images, 2 235 ko** ; `/jeu/demo` **31 images, 1 950 ko** ; le banc **95 images, 17 Mo** (sa carte pose tout le catalogue) ; la vitrine, une unité à la fois (**344 ko** pour l'infanterie). C'est le vrai coût de l'attract au téléphone, bien plus que son JavaScript : une page d'unité porte **toutes** ses vues et tous ses clips (288 à 433 ko pour l'infanterie, le char léger et l'artillerie), quand l'attract n'en montre que le repos et la marche. D'où la garde de l'économiseur de données, et une proposition à la cuisson plus bas.

**Le coût processeur de l'attract** : le tour de l'IA d'exhibition coûte **5,1 ms** en médiane et **18,5 ms** au plus sur trente tours (Node, M1), une fois par tour et jamais par image ; la peau dort entre deux gestes. Il tourne sur le fil principal. Aucun téléphone n'a été mesuré.

## Ce qui est vérifié

- **Tests unitaires** : `tests/render2d/vignette.test.ts` (19 : teinte, cadrage, rejeu, kit, couleur d'équipe, réserve à doublures — page lue une fois et relâchée, repli qui tient la place, page introuvable non redemandée, plafond —, pivot et miroir, ombre), `tests/render/hud-aide-camera.test.ts` (3 : l'aide 2D sans rotation, l'aide 3D avec), `tests/app/chargement-libelles.test.ts` (trois étapes ; `moteur` lu comme le plateau). Autour, verts : `tests/render2d/frontiere.test.ts`, `tests/frontieres.test.ts`, `tests/app/sans-moteur-au-serveur.test.ts`, `tests/atelier/banc.test.ts`, `tests/render/chargement.test.ts`, `tests/app/vitrine-*.test.ts`. Les deux rouges de `tests/render/hud-html.test.ts` (écran de combat, cinq boutons de caméra) sont les mêmes sur `HEAD`, relancés sur l'instantané.
- **Specs Playwright**, contre un serveur à soi (`NEXT_DIST_DIR=.next-bascule npx next dev --turbopack -p 3414`) — dernière passe : **Chromium (Metal) 20 verts et 1 sauté, WebKit 19 verts et 2 sautés** :
  - `e2e/mobile.spec.ts` (390 × 844, tactile) : la route monte la 2D sans `?rendu=`, dessine sur WebGL 2 et ne télécharge ni three ni `render3d/` ; la balise viewport et `touch-action` ; un tap sélectionne ; deux doigts zooment la carte et pas la page (CDP, Chromium seul) ; le fil principal respire au repos (CDP, Chromium seul) ; le budget de place du HUD ; la première mission à 390 et 320 px, l'aide caméra 2D comprise. Au passage, le fanion de l'objectif est visé parmi les deux fanions (le carnet a le sien) : le spec échouait sur une violation de sélecteur strict, sans rapport avec la 2D.
  - `e2e/safari.spec.ts` (WebKit) : la 2D démarre à l'adresse nue, dessine sur WebGL 2, sans voile d'erreur ni conteneur inerte, sans morceau de three.
  - `e2e/accueil-2d.spec.ts` (neuf) : l'attract se monte en 2D et dessine, sur ordinateur et au téléphone, sans que le plateau SVG paraisse, sans three, sa toile hors du focus ; sous animations réduites (appareil, puis réglage du joueur) et sous l'économiseur de données, le SVG et aucune partie.
  - `e2e/atelier-vitrine.spec.ts` (neuf) : la vitrine lit le manifeste ; une unité cuite montre une toile par animation, toutes cuites, qui bougent, dont les pixels changent avec le camp, cinq toiles par animation en « tous les camps », aucune toile WebGL ; sans manifeste, le repli ; un manifeste refusé, le motif ; le banc en 2D sur WebGL 2 ; l'aperçu du carnet en jeu cuit et sans WebGL, les scènes de dialogue passées une à une. Si le manifeste manque sur le disque, le spec le compose depuis les fichiers d'entrée déjà cuits.
  - `e2e/sans-webgl2.spec.ts` (neuf) : `getContext('webgl2')` refusé avant tout script — le jeu dit « WebGL 2 est indisponible » et jamais « WebGPU » ; l'écran-titre montre son plateau à plat.
- **Témoins**, contre l'instantané d'avant la bascule servi par `next dev` : `mobile.spec.ts` tombe en entier sous Chromium (8 sur 8) et sous WebKit (7, et 2 sautés) — pas de toile 2D, l'aide caméra qui parle d'Alt ; `safari.spec.ts` tombe ; `accueil-2d.spec.ts` tombe (pas d'attract au téléphone, pas de `data-fond`) ; `atelier-vitrine.spec.ts` tombe en entier (pas de `[data-vitrine]`, pas de toile 2D au banc ni au carnet) ; `sans-webgl2.spec.ts` tombe sur le message d'avant, « WebGPU est indisponible ». La garde des données a son propre témoin : la retirer fait tomber son test.
- `npm run typecheck` : zéro erreur sur tout le projet ; `eslint` propre sur les fichiers de ce lot ; `next build` vert.

## Ce qui dépend encore de `render3d/`, et pourquoi

- `src/app/jeu/[scenario]/toile.tsx` : l'import **à la demande** de `@/render3d/index` derrière `?rendu=3d`, et un import de **type** (`OptionsRendu3d`). C'est voulu : la 3D reste joignable pour comparer jusqu'au lot K. Le témoin de `tests/app/sans-moteur-au-serveur.test.ts` (« la toile atteint three/webgpu par ses imports statiques ») ne tient plus que par cet import de type : quand le lot K le retirera, ce témoin devra viser un autre fichier (l'inspection de l'admin, par exemple).
- `src/app/admin/assets/[cle]/inspection.tsx` et les scripts de production des GLB : hors de ce lot, par consigne.
- `src/app/atelier/assets/carte.tsx` garde **three** (pas `render3d/`) : elle montre les GLB sources.
- Morceaux orphelins laissés en place : `src/app/atelier/unites/orbite.ts` et `tuiles.ts` (l'ancienne vitrine 3D), tenus par `tests/app/vitrine-orbite.test.ts` et `vitrine-tuiles.test.ts` ; `e2e/vitrine.spec.ts` et `e2e/vitrine-orbite.spec.ts` visent la vitrine 3D disparue. Le lot K peut retirer les six ensemble.

## Ce qui n'est pas vérifié

Rien n'a été regardé à l'écran (consigne). Ne sont pas mesurés : la lisibilité des vignettes du carnet et de la vitrine ; le passage des replis aux images cuites quand les pages arrivent — le jeu et l'écran-titre dessinent leur première image en replis, puis les images cuites les remplacent, un saut visible et non mesuré ; la cadence et le coût réseau de l'attract sur un vrai téléphone ; la vitrine sur un petit écran ; la carte des assets après le retrait de ses deux aides de `render3d/` (elle n'a pas de spec) ; l'écran « le jeu n'a pas pu démarrer » quand WebGL 2 existe mais que le montage échoue (aucun spec ne sait le provoquer).

## Ce que ce lot attend des autres

- **Cuisson** (`scripts/sprites/`) : ranger les pages d'une unité par usage — les vues de carte (`droite`, `bas`, `haut`) d'un côté, le `profil` de l'écran de combat de l'autre — pour que l'écran-titre et le jeu ne téléchargent pas les images d'un écran de combat qu'ils n'ouvrent pas encore ; c'est la plus grosse part des 2 Mo de l'accueil.
- **Moteur 2D** (`render2d/index.ts`, `atlas.ts`, `unites.ts`) : réutiliser `couleurEquipe` et `idPour` de `vignette.ts` au lieu de leurs doubles (`couleurEquipe` interne à `creerRendu2d`, `Atlas.idPour`) ; exporter `OMBRE_VOL` de `unites.ts`, que `vignette.ts` recopie ; dire dans `mesurer()` combien de pages sont en vol (`Atlas.chargements`), pour que l'écran de chargement et l'attract puissent attendre les images cuites au lieu de montrer leurs replis d'abord.
- **`render2d/gl.ts`** : la sonde `moteur2dDisponible` dans un module à elle ferait gagner l'essentiel du kilo-octet que l'écran-titre a pris.
- **IA en arrière-plan** (lot E) : l'attract de l'accueil joue ses tours sur le fil principal ; il pourra passer par le même Web Worker.
- **Moteur 2D, son spec** : `e2e/rendu-2d.spec.ts` passe la scène d'ouverture par un `isVisible` qui ne l'attend pas ; sur une machine calme, la scène s'ouvre juste après et le clic de sélection tombe dessus (`data-dialogue="ouvert"`). `e2e/atelier-vitrine.spec.ts` montre une façon de les passer toutes.
- **Réglages** (`/reglages`) : « Qualité d'affichage » ne pilote plus rien en 2D.
- **Retrait** (lot K) : `?rendu=3d` et l'import de type de `toile.tsx`, la clé `chargement.moteur`, l'étape `moteur` d'`EtapeChargement` (`render/jeu.ts`) et sa lecture dans `etapeAffichee`, les orphelins ci-dessus, les commentaires qui parlent encore de WebGPU dans `src/app/jeu/precharger.ts`, `toile-client.tsx` et `page.tsx` de la route de jeu.
