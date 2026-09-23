# Le retrait de la 3D — notes du lot K (23 septembre 2026)

Vague 3 du plan `doc/refonte/plan-sprites-campagne.md` : « retire-la », dit le propriétaire le jour même où les images cuites sont devenues la peau du jeu (`BRIEF.md`, « Sprites précalculés »). La 2D jouait déjà tout ce que la 3D jouait (lots H, I, J) ; ce lot supprime la peau temps réel, sort de `render3d/` ce dont les outils qui **fabriquent** les GLB avaient besoin, et retire ce qui ne servait qu'à elle. Rien n'a été regardé à l'écran : tout ce qui suit est vérifié par du code, et ce qui ne l'est pas est dit.

## Ce qui est supprimé

| Quoi | Pourquoi |
|---|---|
| `src/render3d/` — 34 modules, 17 710 lignes | la peau 3D : scène WebGPU, terrain, décor, unités, animations, effets, caméra, post-traitement, chargeur de modèles |
| `tests/render3d/` — 28 tests (328 cas) et 6 aides | ils ne testaient qu'elle ; trois morceaux qui testaient autre chose ont été **sortis** avant (plus bas). Le rouge historique `decor.test.ts` part avec eux |
| `e2e/fumee-3d.spec.ts`, `vitrine.spec.ts`, `vitrine-orbite.spec.ts` | la fumée WebGPU et la vitrine à six angles, disparue au lot J |
| `e2e/camera-libre.spec.ts`, `lod0-accueil.spec.ts`, `premier-contact-assets.spec.ts`, `barge-tripo.spec.ts` | ne vérifiaient que la 3D : orbite à Alt et bouton d'inclinaison, GLB demandés par le jeu, l'accueil et la vitrine. **Relancés contre ce lot : 5 cas sur 5 rouges**, pour ces raisons-là (le bouton `inclinaison` n'existe pas, aucun `.glb` n'est demandé) — ils l'étaient depuis la bascule |
| `src/app/atelier/unites/orbite.ts`, `tuiles.ts` et `tests/app/vitrine-orbite.test.ts`, `vitrine-tuiles.test.ts` | l'ancienne vitrine 3D ; plus rien ne les importait (vérifié par `grep`) |
| `tests/render/qualite.test.ts` | la qualité d'affichage et la chaîne de post-traitement de la 3D |
| `scripts/rustine-three.mjs`, le `postinstall` de `package.json`, sa copie dans le `Dockerfile` | la rustine corrigeait le système de nœuds **WebGPU** de three r170 ; plus rien n'importe `three/webgpu` ni `three/tsl` |
| `tests/aides/resoudre-three.mjs` | le crochet qui faisait désigner à `three` le fichier `three/webgpu` sous Node |
| `scripts/production/mesurer-rocher-runtime.ts` | il mesurait un rocher dans les lots instanciés de la peau 3D (`LotInstancie`), qui n'existent plus. Aucun script ni test ne l'appelait ; `assets/production/README.md` le dit |

## Ce qui est déplacé, et où

| D'où | Où | Pour qui |
|---|---|---|
| `src/render3d/pieces.ts` | `src/assets/pieces.ts` | `scripts/production/unites.ts` (les candidats GLB d'une unité), `tests/assets/production-candidates.test.ts`. Pur, ne lit que les types de `schemas` : la couche `assets` le prend **sans droit nouveau**. Ses tests suivent (`tests/assets/pieces.test.ts`, 10 cas) ; seul reste en arrière celui qui mesurait les maillages de la 3D (`geometriesSilhouette`) |
| la lecture de `src/render3d/modeles.ts` | `scripts/production/lecture-glb.ts` | `tests/assets/infanterie.test.ts`, `tests/assets/activation-premier-contact.test.ts`. Seulement ce qu'ils appellent : `analyserGlb`, `lectureDepuisGltf`, le masque tenu à côté du matériau, `conformerModele`, `creerLecteurClips`, `nomsClips`, `candidatsModele`, `nomFichierModele`, `creerChargeurModeles` (lecteur **donné**, inventaire facultatif). Ses tests suivent (`tests/assets/lecture-glb.test.ts`, 19 cas) |
| le cas du chemin de `tests/render3d/camera.test.ts` | `tests/render/chemin.test.ts` | `src/render/chemin.ts` reste (la peau 2D fait glisser ses figurines dessus) et n'avait pas d'autre test |

**Pourquoi la lecture n'est pas dans `src/assets/`** : elle importe three, et `src/assets/` est importé par la peau 2D et par des pages ; un module three dans cette couche n'aurait tenu hors des paquets du jeu que par discipline. Seuls les tests et la production s'en servent : elle va à côté des scripts qui fabriquent les GLB. Pas dans `scripts/production/commun/` : `commun.ts` existe déjà, et un dossier du même nom rendrait l'import ambigu.

**Deux différences, qui ne changent aucun verdict** : three **classique** (`three`, celui des scripts de production) au lieu de `three/webgpu`, donc plus de jumeaux à nœuds ni de réalignement des attributs quantifiés — ils n'existaient que pour `WebGPURenderer` ; et plus d'I/O réseau (inventaire lu sur `/api/modeles`, adaptation des textures au téléphone), qui ne servaient qu'au jeu. Les tests de `tests/assets/` ont rendu **exactement** les mêmes verdicts avant et après, messages d'échec compris (sous-ensemble de 89 fichiers, comparé cas par cas).

## Ce qui est réécrit

- **L'inspection d'un modèle dans l'admin** (`src/app/admin/assets/[cle]/inspection.tsx`) : un visionneur GLB — three, `GLTFLoader`, `WebGLRenderer`, la pièce de studio préfiltrée sur place —, toujours chargé à la demande par `inspection-client.tsx` (`next/dynamic`, `ssr: false`). Il prenait le moteur, l'environnement et les ambiances de la 3D. Les deux ambiances d'été (« jour », « nuit ») sont **figées** à leurs valeurs du jour, relevées sur `parametresAmbiance` avant la suppression, et renommées « Été, jour / nuit » : ce ne sont plus celles du jeu. La vue « Jeu » passe de 65° au tangage de la cuisson (`TANGAGE_CARTE`, 50°) : c'est désormais sous cet angle que le jeu voit un modèle.
- **La carte des assets de l'atelier** (`src/app/atelier/assets/carte.tsx`) : `WebGLRenderer` au lieu de `WebGPURenderer`, et plus de réalignement des attributs quantifiés, que WebGL 2 lit tels quels. Message d'échec : « La carte exige WebGL 2 ».
- **L'écran-titre** : l'attract ne calcule plus ses tours sur le fil principal. `src/app/adversaire-exhibition.ts` le branche sur le Web Worker de la page de jeu (`creerAdversaireEnFond`), avec les stratégies qu'il écrivait en dur (pondérée au camp 0, agressive au camp 1). `tests/app/adversaire-exhibition.test.ts` rejoue douze tours de l'exhibition et vérifie que l'adversaire en fond rend, tour après tour, exactement la suite de l'ancienne boucle.

## Ce qui est modifié

- **`?rendu=3d` disparaît** (`src/app/jeu/[scenario]/toile.tsx`) : ni import à la demande de la 3D, ni type, ni choix de peau ; la fabrique est `creerRendu2d`, et une adresse qui porte encore `?rendu=3d` ouvre la 2D. `CleRendu` ne vaut plus que `'2d'`, `BackendRendu` que `'webgl2'` ; `moteur3dDisponible`, la méthode `Rendu.qualite` et tout le calcul de la chaîne de post-traitement (`render/qualite.ts` : calibration, cadence, seuils, décision) sont retirés, faute d'appelant. `fabriqueRendu` ne prend plus de clé.
- **Le chargement** : l'étape `moteur` (le démarrage de `WebGPURenderer`) sort d'`EtapeChargement` ; un contexte encore absent se lit comme une image à venir. `etapeAffichee` disparaît avec elle.
- **Les réglages** : « Qualité d'affichage » quitte `/reglages` et `Preferences`. Une `qualite` encore enregistrée est ignorée sans erreur et effacée à la prochaine écriture (`tests/campagne/preferences.test.ts` le vérifie).
- **three** : l'alias `three → three/webgpu` de `next.config.ts` part ; les tests (`scripts/test.mjs`) ne préchargent plus rien d'autre que tsx.
- **`tests/frontieres.test.ts`** : la couche `render3d` sort de la table, et d'`app`.
- **`tests/app/sans-moteur-au-serveur.test.ts`** : il gardait `three/webgpu` ; il garde désormais **la peau** (`render2d/index.ts`) et **three** tout entier hors des imports statiques des pages. Deux témoins : la toile atteint la peau, l'inspection atteint three.
- **`sharp`** en `devDependencies`, `^0.35.4` — la version installée, par `npm install --save-dev --package-lock-only` : rien n'a été réinstallé (aucun paquet de `node_modules` n'a changé, seul son verrou caché). npm a en passant rangé `meshoptimizer` à sa place alphabétique et ajouté au verrou les six paquets embarqués de `@tailwindcss/oxide-wasm32-wasi` : sa normalisation, relancée à l'identique.
- Commentaires : les mentions de WebGPU de `precharger.ts`, `toile-client.tsx` et de la page de la route de jeu ; les renvois vers des fichiers de `render3d/` (`chemin.ts`, `illustrations.ts`, `render/apercu/`, les 27 copies de `gltf.ts`, `figurine.ts`, les routes `/api/modeles` et `/api/admin/modeles`, `serveur/modeles.ts`, `assets/spec.ts`) ; le témoin `3d` de `e2e/rendu-2d.spec.ts`.

## Ce qui reste de three, et pourquoi

`three` 0.170, `@types/three` et `meshoptimizer` restent des dépendances : les scripts qui fabriquent les GLB (`scripts/production/**`, `scripts/infanterie/**`, `scripts/generer-*.ts`, `scripts/plaine/**`), la lecture des tests de livraison (`scripts/production/lecture-glb.ts`), l'inspection de l'admin et la carte des assets s'en servent. Tous prennent `three` classique ; **plus rien n'importe `three/webgpu` ni `three/tsl`** (vérifié par `grep` sur `src`, `scripts`, `tests`, `e2e`).

`tests/aides/webgpu-en-node.mjs` **reste, vide et documenté** : la commande de test ciblé `node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test <fichiers>` est écrite dans `CLAUDE.md` et dans une dizaine de notes ; la retirer la casserait partout. `npm test` ne la précharge plus.

La route `GET /api/modeles` **reste** : la peau 3D la lisait, mais `scripts/production/verifier-publication.ts` y vérifie, après un déploiement, qu'un lot est publié.

## Les poids

`next build` (webpack), avant — `HEAD` `876c4f55`, instantané par `git archive` — et après :

| Route | Avant : taille · premier chargement | Après |
|---|---|---|
| `/` | 3,1 ko · 112 ko | 4,44 ko · 111 ko |
| `/jeu/[scenario]` | 1,7 ko · 105 ko | 1,69 ko · 105 ko |
| `/atelier` | 145 ko · 256 ko | 145 ko · 254 ko |
| `/atelier/assets` | 3,45 ko · 110 ko | 3,19 ko · 110 ko |
| `/atelier/unites` | 1,32 ko · 105 ko | 1,31 ko · 105 ko |
| `/admin/assets/[cle]` | 5,42 ko · 112 ko | 5,42 ko · 112 ko |
| `/reglages` | 3,24 ko · 122 ko | 3,14 ko · 121 ko |
| `/campagne` | 5,94 ko · 124 ko | 5,93 ko · 124 ko |

L'accueil gagne 1,3 ko de page mais perd 1 ko au premier chargement : un morceau partagé a été refondu dans la page (366,1 → 365,1 ko bruts, morceaux du premier chargement additionnés).

Ce que le tableau ne compte pas, parce que chargé à la demande : **three**. Avant, un morceau de 822 ko (219 ko compressés) — le moteur WebGPU —, plus 199 ko (65 ko) de peau 3D et 34 ko (13 ko) de sonde, tirés par `?rendu=3d`, l'inspection et la carte des assets. Après, un morceau de 673 ko (168 ko compressés), three classique, tiré par l'inspection et la carte seulement ; plus aucun morceau de peau 3D.

## Ce qui est vérifié

- `npm run typecheck` : zéro erreur.
- `npm run lint` : aucun problème dans les 79 fichiers touchés (`--max-warnings 0`). Le projet entier en compte 100 erreurs et 17 avertissements, tous antérieurs et hors de ce lot : 11 erreurs et 15 avertissements dans des fichiers suivis, tous dans `scripts/production/modeles/*/generer.ts` (`prefer-const`, variables inutilisées) ; le reste dans des brouillons non suivis sous `tmp/` et `apercus/`, que la configuration d'ESLint n'ignore pas.
- `npm test` complet : **1 741 cas, 1 706 verts, 34 rouges, 1 sauté**. Aucun rouge qui ne soit dans la référence d'avant le chantier (42 rouges sur 1 676) ; huit de la référence ont disparu — quatre avec les tests de la 3D (« QG livré », « assets actifs sélectionnés », « le décor de couleurs_alliees », « modèle national prioritaire »), quatre qui passent désormais sans lien avec ce lot (les frontières, deux tests de campagne, les cinquante parties IA contre IA).
- `npm run verifier:campagne` : 46/48, rejeu conforme ; les deux rouges sont FR03 normal et difficile, comme avant.
- `npx tsx scripts/generer-specs-assets.ts --verifier` : 941 spécifications, à jour.
- `npm run controler:asset` sur l'infanterie, la ville et le char léger livrés, et sur un couple croisé (spécification de l'infanterie, GLB de la ville) : **les mêmes verdicts octet pour octet** avant et après — trois acceptés, un refus à neuf motifs.
- `NEXT_DIST_DIR=.next-retrait npx next build` : vert.
- Playwright contre mon serveur (`next dev`, port 3417) — `rendu-2d`, `animations-2d`, `combat-2d`, `mobile`, `safari`, `accueil-2d`, `sans-webgl2`, `atelier-vitrine` : **Chromium 24 verts, 1 sauté ; WebKit 23 verts, 2 sautés** (les sautés sont les cas CDP, Chromium seul, et Safari hors WebKit). Le cas neuf d'`accueil-2d` — l'exhibition réfléchit dans le worker `atlas-ia` et ses tours en reviennent — **tombe avec l'attract d'avant** (témoin : aucun worker en deux minutes).
- `/jeu/premier_contact?rendu=3d`, sous Chromium et WebKit : toile `data-rendu="2d"`, dos `webgl2`, aucun morceau de three ni de `render3d`, aucune erreur.
- Le visionneur de l'admin, piloté par un script Playwright sur `unite_antiair_base` (session signée) : contexte WebGL, les trois vues, cartes, masque, couleur témoin, clip, deux éclairages, comparaison à deux panneaux — chaque réglage rend un panneau prêt, sans erreur de page ni de console, sous Chromium et sous WebKit. La carte des assets : contexte WebGL 2, GLB chargés, aucune erreur, sur les deux moteurs.
- Relancés avant et après, **mêmes rouges pour les mêmes raisons** (l'interface a changé depuis qu'ils ont été écrits, pas la peau) : `audio`, `aube-navigation`, `menus-refonte`, `tutoriels` (le carnet), `lecture-tactique`, `effets-combat` — 8 rouges, 7 verts de part et d'autre ; `assets-reception` et `antiair-candidat` — 4 rouges, 1 vert de part et d'autre (le banc est désormais dans un `<details>` replié de la fiche).

## Ce qui n'est pas vérifié

Rien n'a été regardé à l'écran. Ne sont pas mesurés : le rendu du visionneur de l'admin sous WebGL comparé à celui d'avant sous WebGPU (mêmes lumières, autre moteur) ; la carte des assets sur un vrai catalogue parcouru ; le coût réseau du worker de l'IA sur l'écran-titre (son paquet se télécharge désormais aussi depuis l'accueil) et sa cadence sur un téléphone ; l'image Docker (le `Dockerfile` n'a pas été construit).

## Ce qui reste à d'autres

- **Chaînes à retirer** de `content/i18n/interface.fr.json`, plus lues nulle part : `chargement.moteur`, `campagne.sans_webgl`, `reglages.qualite`, `reglages.qualite_note`, `reglages.qualite_auto`, `reglages.qualite_basse`. `npm run extraire-chaines` à blanc ne l'exige pas.
- **`src/render2d/index.ts`** : le transtypage `'webgl2' as unknown as BackendRendu` (`DOS_2D`) et son commentaire deviennent inutiles, `BackendRendu` valant `'webgl2'`.
- **L'interface `Rendu` et le HUD** : `tourner`, `incliner`, `inclinaisonSuivante`, `retenirVue`, `revenirVue` n'ont plus d'implémentation (la vue 2D est fixe) mais `hud-html.ts` et `render/jeu.ts` les appellent encore ; la chaîne `hud.aide_camera` (l'aide à Alt et Maj) n'est plus dite que par une peau qui sait tourner. Le nom `data-modele="3d"` et la classe `.scene3d` de l'écran de combat (`scenes-html.ts`) désignent la présentation que la 2D remplit ; `e2e/combat-2d.spec.ts` s'y appuie.
- **Les documents** : `CLAUDE.md`, `BRIEF.md`, `doc/10-rendu-3d.md`, `doc/18-rendu-sprites.md` (qui parle encore de la 3D « gardée derrière `?rendu=3d` »), `AGENTS.md` (qui cite `mesurer-rocher-runtime.ts`), et le prompt de production de l'admin (`src/app/admin/assets/prompt-production.ts`), qui cite encore la décision du 14 septembre « conserver Three.js et WebGPU ».
- Les specs `audio`, `aube-navigation`, `effets-combat`, `lecture-tactique`, `tutoriels`, `antiair-candidat` et `assets-reception` demandent encore `--enable-unsafe-webgpu` (et `channel: 'chrome'` pour cinq d'entre eux) : sans effet sur la 2D, et rouges pour d'autres raisons.
