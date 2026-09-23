# Plan du 23 septembre 2026 — sprites lisses, optimisation, animations, fin du chapitre français

Demande du propriétaire : « tout refaire en sprite lisse, optimiser le jeu, améliorer les animations » ; « fais un plan avec X agents, et n'oublie pas de finir le scénario de la campagne, les cartes des missions, les missions ; puis mets X agents spécialistes et pousse ». Décision datée dans `BRIEF.md` (« Sprites précalculés »). Le contrat technique est `src/render2d/contrat.ts` ; la conception du rendu, `doc/18-rendu-sprites.md`.

## Ce qui est tranché avant de lancer quiconque

1. **On photographie les modèles, on ne redessine rien.** Les 45 GLB en ligne (30 unités avec leurs clips `repos · deplacement · tir · touche · hors_jeu`, 6 bâtiments communs et 2 QG nationaux, 2 rochers, un pont) sont la source. Blender 5.1 en ligne de commande (`/Applications/Blender.app/Contents/MacOS/Blender -b`) les rend sous une caméra orthographique fixe, à 4× puis réduits : l'image est lisse par construction.
2. **Une seule projection** (`versPlan`) : tangage 50°, lacet fixe, 128 pixels par case. La cuisson et le rendu la partagent, un pixel cuit vaut un pixel de plan.
3. **Trois vues par unité** (`droite`, `bas`, `haut`), la gauche par retournement ; l'éclairage de cuisson vient de l'avant-gauche et **l'ombre d'une unité n'est pas cuite** — le rendu la pose, sous l'unité ou sous l'appareil en vol.
4. **Masque d'équipe** : zones d'équipe cuites en blanc, masque dans une page à part, `couleur × mix(1, équipe, masque)` à l'écran. Même source de couleur que la 3D (`palette.main` du style de nation).
5. **WebGL 2 maison**, sans dépendance : un lot de sprites instanciés, un nuanceur de sol, une caméra 2D. Pas de WebGPU, pas de three dans la route de jeu.
6. **La 3D est retirée sans attendre de validation** (« retire-la », le propriétaire, même jour). Elle sert de référence de comportement aux agents des deux premières vagues, puis part en un seul commit (vague 3). `render2d/` n'a pas le droit d'importer `render3d/` (`tests/frontieres.test.ts`). Les scripts de production des GLB et l'inspection d'un modèle dans l'admin gardent ce qu'il leur faut de three.js, déplacé hors de `render3d/`.
7. **Campagne** : FR07 à FR12 passent de la fiche de conception (`doc/refonte/opus1-nations.json`) à la mission jouable — carte, scénario, dialogues, choix et conséquences, entrée de parcours — et `npm run verifier:campagne` reste vert. Les 132 autres missions nationales, les 18 finales et les 28 hors-série ne sont **pas** dans ce plan.

## Vague 1 — sept agents en parallèle, fichiers disjoints

| Agent | Spécialité | Possède (seul à écrire) | Livre |
|---|---|---|---|
| **A · cuisson** | Blender, rendu hors ligne | `scripts/sprites/**`, `public/assets/sprites/**`, `tests/sprites/**`, `doc/refonte/sprites-cuisson.md` | `npm run cuire:sprites`, les 30 unités, les bâtiments, les rochers, le pont, le manifeste |
| **B · décor** | modélisation procédurale | `scripts/decor-sprites/**`, `assets/sources-sprites/decor/**`, `doc/refonte/sprites-decor.md` | les GLB sources des dix essences × saisons (`ESSENCES_DECOR`), prêts à cuire |
| **C · moteur 2D** | WebGL 2, caméra, entrées | `src/render2d/**` sauf `sol/`, `tests/render2d/**` sauf `sol/`, `e2e/rendu-2d.spec.ts`, la fabrique de `src/app/jeu/[scenario]/toile.tsx` | `creerRendu2d` qui tient toute l'interface `Rendu`, derrière `?rendu=2d` |
| **D · terrain** | nuanceurs de sol, pavage | `src/render2d/sol/**`, `tests/render2d/sol/**` | le sol, l'eau, les rives, routes, rivières et ponts, le placement du décor |
| **E · IA en arrière-plan** | Web Worker, performance | `src/app/jeu/adversaire-fond.ts`, `src/app/jeu/ia.worker.ts`, le type `Adversaire` et son appel dans `src/render/jeu.ts`, `tests/jeu/**` neufs | le tour de l'IA hors du fil principal, sans changer une action |
| **F · campagne FR07–FR09** | conception de missions | `content/cartes/carte_opus1_fr_0{7,8,9}.json`, `content/scenarios/opus1_fr_0{7,8,9}.json`, leurs entrées dans `content/campagne.json` (insérées après FR06) | trois missions jouables |
| **G · campagne FR10–FR12** | conception de missions | `…fr_1{0,1,2}.json`, leurs entrées (ajoutées en fin de `campagne.json`), `src/app/campagne/consequences.ts`, `src/content/difficulte.ts`, `src/app/campagne/paysage-campagne.tsx` | trois missions jouables, les conséquences des choix de FR08, FR10 et FR12, les six positions sur la carte |

## Vague 2 — après la fusion de C et D

| Agent | Spécialité | Livre |
|---|---|---|
| **H · animations** | mise en scène | les 25 gestes de la partition en 2D, effets, arrêt sur image, secousse, particules météo, sons calés |
| **I · combat** | écran de combat | `ouvrirCombat` en 2D : vue de profil, une figurine par PV, décor de la case |
| **J · bascule** | intégration, performance | la 2D seule peau du jeu, vitrine de l'accueil en 2D (téléphone compris), banc et vitrine de l'atelier en images cuites, aperçus du carnet en images cuites, specs Playwright mobile et WebKit |

La cuisson du décor (sources de B par la chaîne de A) et la régénération du fil (`npm run fil:opus1`) sont faites par le coordinateur entre les deux vagues.

## Vague 3 — le retrait de la 3D, un seul commit

Après H, I et J (qui lisent `render3d/` comme référence de comportement). Un agent **K · retrait** supprime `src/render3d/`, ses tests et la fumée 3D, retire `?rendu=3d` (`CleRendu` ne vaut plus que `'2d'`), sort de `render3d/` ce dont les scripts de production des GLB et l'inspection de l'admin ont besoin (vers `src/assets/` ou `scripts/production/`), décide du sort de la rustine de three et du préchargement de test selon ce qui importe encore `three/webgpu`, et met à jour les documents. Critère : la route de jeu et l'accueil n'embarquent plus three ; `typecheck`, `lint`, `npm test`, `build` et les scripts de production verts.

## Règles communes, recopiées dans chaque consigne

- Aucun `git checkout`, `stash`, `reset`, `restore`, `clean` ni `add -A` : d'autres agents écrivent dans le même arbre. **Aucun commit** : le coordinateur vérifie, commite par lot et pousse.
- Un fichier partagé (`content/campagne.json`, `content/personnages.json`) ne se modifie que par une insertion ciblée, jamais en le réécrivant ; `content/i18n/interface.fr.json` n'est écrit que par le coordinateur (les agents remontent leurs chaînes).
- Pas de `npm test` complet, pas de `npm run dev` sur 3400 : tests ciblés (`node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test <fichiers>`), serveur à soi sur un autre port avec `NEXT_DIST_DIR` à soi. Une erreur de `typecheck` dans le fichier d'un autre agent n'est pas la sienne.
- On ne vérifie jamais à l'œil : tests, `typecheck`, `lint`, `build`, specs Playwright ciblés (WebKit pour Safari). Ce qui ne se vérifie pas par du code est dit non vérifié.
- `doc/14-secrets.md` ne se lit pas.

## Critères de fin

- `typecheck`, `lint`, `npm test` (hors le rouge préexistant `decor.test.ts`), `build`, `verifier:campagne` verts.
- En 2D : la partie démarre sans WebGPU, sous Chromium **et** WebKit ; une unité se sélectionne et se déplace par `versEcran` ; aucune erreur de console ; la route de jeu n'embarque plus three.
- Chaque lot poussé sur `main` dès qu'il est vérifié.

## Bilan — soir du 23 septembre 2026

Fait et poussé, dans cet ordre : le contrat (`5c18d79c`), les sources du décor (`825536a5`), la peau 2D (`d2c42d28`), le sol (`d29b20d1`), le chapitre français FR07–FR12 (`cb7e7df3`), les images cuites (`579e404d`), l'IA en Web Worker et le correctif du moteur sur la cale des transports (`bf749b3a`), les animations et l'écran de combat (`a059d1fa`), la bascule en 2D et le worker branché (`21fa9d13` à `ff4996c6`), les réglages sur les vraies images (`0a7443da`), le retrait de la 3D (`afc34691`). Douze agents au total (sept, puis quatre, puis un). Critères de fin : `typecheck` à zéro, `npm test` sans aucun rouge nouveau par rapport à la référence prise sur `169da18b` (42 rouges d'avant, 34 restants), `verifier:campagne` 46/48 (FR03, déjà rouge), `build` vert, dix specs 2D verts sous Chromium et WebKit. `npm run lint` reste rouge sur des erreurs anciennes des scripts de production.
