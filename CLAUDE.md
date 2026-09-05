# CLAUDE.md — passation

Document de passation pour Claude Code. Il dit ce qu'est le projet, où sont les choses, ce qui est vrai aujourd'hui et ce qui ne l'est pas. Quand il contredit `BRIEF.md`, c'est `BRIEF.md` qui a raison.

## Le projet en cinq lignes

Atlas Tournament est un tactique au tour par tour dans l'esprit d'Advance Wars, jouable dans un navigateur. Dans ce monde, les guerres ont été remplacées par des Jeux Tactiques : chaque pays a une équipe et un commandant, et un tournoi fait le tour de la planète tous les quatre ans. Le joueur part d'un des 24 pays de départ, traverse la France et ses 18 régions, puis le monde, et ses choix décident de la fin qu'il obtient. Techniquement : une seule application Next.js 15 en TypeScript strict, un moteur de règles pur et déterministe, un rendu 3D three.js avec repli vectoriel 2D, et cinq routines Claude qui produisent le contenu sous le contrôle d'un serveur qui ne fait confiance à rien. Rien de généré ne passe en ligne sans un verdict mesuré, et souvent sans un humain.

## À lire d'abord, dans cet ordre

1. **`BRIEF.md`** — le canon. Toutes les décisions prises, y compris les arbitrages du 5 septembre 2026.
2. **`PLAN.md`** — les treize étapes (0 à 12), avec un critère de fin écrit pour chacune.
3. **`doc/README.md`** — l'ordre de lecture des quinze documents de conception, et surtout **qui est propriétaire de quoi**.

**La règle de résolution des conflits, sans exception : le brief a raison sur tous les documents ; le document propriétaire d'un sujet a raison sur tous les autres documents.** `doc/README.md` donne le tableau des propriétaires. Exemple concret : si `PLAN.md` et `doc/11-assets-spec.md` ne disent pas le même nombre de spécifications d'assets, c'est `doc/11` qui fait foi, parce qu'il est propriétaire des assets.

Un document ne se lit **jamais** comme les autres : `doc/14-secrets.md`. Il n'est jamais servi à une routine, jamais résumé dans un prompt, jamais copié dans `content/`.

## L'arborescence

```
src/app/          Next.js App Router. La seule couche qui a le droit de tout importer.
                  Pages : `/` (accueil provisoire), `/jeu/[scenario]`, `/admin/*`.
                  API : /api/health, /api/canon, /api/i18n, /api/admin, /api/routines/*.
src/engine/       Le moteur, pur et déterministe : (état, action) → état. Règles, RNG seedé,
                  rejeu, climat, mécaniques régionales par hooks, déblocages. Zéro dépendance.
src/ai/           L'IA de jeu : une fonction d'évaluation et trois stratégies (pondérée,
                  agressive, défensive). C'est elle qui certifie les cartes.
src/mapgen/       Le générateur : ParametresCarte + graine → MapDef, symétrie, vérifications,
                  aperçu texte. Deux appels avec la même graine donnent la même carte.
src/render/       Le socle de rendu commun aux deux peaux : interface `Rendu`, boucle paresseuse,
                  caméra, entrées, HUD HTML, ambiance, sauvegarde locale, et la peau 2D vectorielle.
src/render3d/     La peau 3D three.js : scène, terrain, éclairage par saison/phase/météo, unités
                  et décor instanciés, surbrillances, animations, textures.
src/assets/       Le format `AssetSpec`, le catalogue qui le compose depuis le canon, les styles
                  nationaux, et les validateurs (spec et glTF binaire, sans dépendance).
src/content/      Les chargeurs typés du canon JSON.
src/schemas/      Les types partagés et les validateurs écrits à la main, sans dépendance.
src/i18n/         `t()`, l'ordre de repli des langues, et la table des chaînes d'interface source.
src/db/           Drizzle : le schéma, le client, et un fichier de requêtes typées par table.
src/serveur/      La logique serveur testable en Node : auth, cycle de contenu, file de missions,
                  contrôle, simulation, dépêche, traduction, canon, prompts, sonde.

content/          Le canon JSON, servi en lecture seule par /api/canon.
                  unites, terrains, degats, mecaniques, archetypes, flags, gabarits-missions ;
                  pays/ (24), regions/fr/ (18), styles/ (24 + regions/fr/ 18), fils/ (9),
                  cartes/, scenarios/, i18n/ (chaînes et glossaire français).
assets/specs/     540 AssetSpec générées depuis le canon, versionnées.
scripts/          migrate.mjs, simuler.ts, controler-carte.ts, apercu-carte.ts,
                  generer-specs-assets.ts, extraire-chaines.ts.
drizzle/          Les migrations SQL numérotées. Un fichier appliqué ne se modifie jamais.
tests/            tsx --test, un dossier par couche, plus frontieres.test.ts.
e2e/              Deux tests de fumée Playwright (2D et 3D), sur le port 3400.
doc/              Les quinze documents de conception, plus doc/assets/ (démos de rendu).
apercus/          Les PNG de relecture produits par apercu-carte.ts. Ignoré par git.
```

## Les règles d'import

`tests/frontieres.test.ts` les fait respecter mécaniquement : il lit les imports de chaque fichier de `src/` et échoue sur la moindre violation. La table des couches autorisées est **dans le test**, et c'est elle qui fait foi.

- `engine`, `ai`, `mapgen` ne connaissent que `schemas` et `content`. Jamais `render`, jamais `db`, jamais `app`.
- `render` peut importer `engine`, `schemas`, `content`, `i18n`. `render3d` ajoute `render` et `assets` — jamais l'inverse.
- `serveur` peut importer le jeu et `db` ; `app` peut tout importer ; `schemas` n'importe rien.

**Les interdits dans les couches pures** (`engine`, `ai`, `mapgen`, `schemas`, `content`) sont vérifiés par le même test, par simple recherche de motif : `window`, `document`, `fetch(`, `Date.now(`, `Math.random(`. Le moteur ne lit jamais l'horloge — pas même pour évaluer un déblocage : la date lui est **donnée** par l'appelant, et c'est le serveur qui la fixe. Le hasard passe exclusivement par le RNG seedé de `src/engine/rng.ts` et ses flux dérivés. `render/` et `render3d/` ont le droit d'appeler `Date.now()`, et seulement pour cadencer une animation.

## Les conventions

- **Tout est en français** : le code, les commentaires, les noms de fichiers, les identifiants. Un commentaire dit *pourquoi*, pas *quoi*.
- **Les clés sont en minuscules sans accent**, avec des tirets bas : `carte_plaine_symetrique`, `pays.fr.qualifie`, `hud.fin_de_tour`. Les regex qui les valident sont dans `src/schemas/types.ts` et testées par `tests/schemas/regex.test.ts`.
- **Le moteur ne connaît aucune unité par son nom.** Les dix unités sont des données (`content/unites.json`) avec leurs traits et leur `Silhouette` ; une unité homologuée demain doit fonctionner sans une ligne de code moteur.
- **Aucun texte en dur dans le rendu.** Tout libellé passe par une clé et `t()`. Un rendu n'appelle même pas `t()` : on lui donne les rares libellés déjà traduits. `npm run extraire-chaines` reconstruit `content/i18n/` et un test échoue sur tout littéral affichable trouvé hors d'un appel à `t()`.
- **Tout contenu est validé par `src/schemas/valider.ts`**, à l'entrée du serveur comme au chargement du canon. Ces validateurs sont écrits à la main, sans aucune dépendance, et ils sont la seule porte : le serveur recalcule et refuse ce qu'il n'a pas lui-même soumis.
- **Déterminisme** : même graine + mêmes actions = même état, au bit près. C'est ce qui permet à la routine contrôle de certifier une carte, et c'est le premier invariant à ne pas casser.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev` | le site en développement, **port 3400** |
| `npm run build` | `next build` — n'exige **aucune** variable d'environnement |
| `npm start` | migrations puis Next (c'est ce que lance le Dockerfile) |
| `npm run typecheck` | `tsc --noEmit`, TypeScript strict |
| `npm run lint` | ESLint |
| `npm test` | 514 tests `tsx --test` |
| `npm run test:e2e` | les deux specs Playwright ; le spec 3D porte ses propres drapeaux SwiftShader |
| `npm run migrate` | applique `drizzle/*.sql` une fois chacun, copie de sécurité `pg_dump` avant |
| `npm run simuler -- --carte tests/engine/cartes/plaine.json --parties 50 --graine 1` | N parties IA contre IA |
| `npm run controler -- --carte <fichier>` | le verdict exact de la routine contrôle, hors ligne |
| `npm run apercu -- --params '{"largeur":16,"hauteur":12}' --graine 7 --sortie apercus/c.png` | une carte en PNG et en texte |
| `npx tsx scripts/generer-specs-assets.ts --verifier` | vérifie que `assets/specs/` n'a pas dérivé du canon |
| `npm run extraire-chaines` | extrait les chaînes ; marche à blanc sans `DATABASE_URL` |

## L'état réel, étape par étape

| Étape | État | Ce qui est là, ce qui manque |
|---|---|---|
| 0 — Socle | **fait** | Next 15, TS strict, `tsx --test`, Playwright, Drizzle, `migrate.mjs`, `.env.example`, CI. La CI ne lance **ni `lint` ni Playwright**. |
| 1 — Moteur | **fait** | Règles, RNG, rejeu, climat, hooks de mécaniques, IA à trois stratégies, `simuler.ts`. |
| 2 — Générateur + contrôle | **fait** | `mapgen/`, vérifications, campagne multi-climats, `ReviewVerdict` motivé, `controler-carte.ts`, `apercu-carte.ts`. La campagne des 200 cartes aléatoires du critère de fin n'a pas été relue à l'œil. |
| 3 — Rendu | **fait** | Interface `Rendu` commune, peau 2D, peau 3D, HUD HTML, repli WebGL, `?rendu=2d`, deux specs de fumée. Le seuil de 48 px par case n'est pas exercé sur tous les couples (carte × écran). |
| 4 — Assets 3D | **partiel** | 540 specs générées et valides, validateur glTF écrit. **Aucun `.glb` réel n'existe** : tout est placeholder. La boucle avec le générateur externe n'a jamais été parcourue. |
| 5 — Serveur et admin | **partiel** | Toutes les routes, le cycle, les prompts versionnés, la file, l'admin, la sonde — **écrits et testés hors base**. Aucune base n'a jamais été branchée. |
| 6 — Routines en ligne + i18n | **à faire** | Aucune tâche planifiée Claude n'existe. Côté i18n, seul `fr` a un bundle ; `en` est déclaré en base par la migration mais **aucun bundle `en` n'existe**. |
| 7 — France, 18 régions | **partiel** | Les 18 fiches sont dans `content/regions/fr/` et leurs styles aussi. **Aucune mécanique régionale n'est implémentée dans le moteur** : il n'y a que le contrat de hooks et une mécanique de test. |
| 8 — Lore et 24 départs | **partiel** | Les 24 fiches `Country` sont dans `content/pays/`. Pas d'écran de choix du pays, pas de prologue, pas de routine lore, rien en base. |
| 9 — Voyage et campagne | **partiel** | `deblocages.ts`, `content/fils/` (9 fils), `content/gabarits-missions.json`, le type `ProfilCampagne` et son validateur. Pas de carte du monde, pas de carnet, pas de persistance de profil, aucune mission écrite. |
| 10 — Cerveau et jeu vivant | **partiel** | Les routes et la logique de dépêche, d'homologation, de mémoire et de prompts existent. Rien n'a tourné. **La mise en ligne à 18 h n'est pas câblée** (voir ci-dessous). |
| 11 — Paquet naval | **à faire** | Rien. Huit pays portent une spécialité de repli terrestre en attendant. |
| 12 — Finition | **à faire** | Rien. Huit des neuf langues restent `en_preparation`. |

## Les manques connus, nommément

Ils sont listés ici parce qu'ils se voient mal dans le code, pas parce qu'ils sont graves.

1. **Aucune base n'est branchée ni testée en réel.** Tout `src/db/` et une bonne partie de `src/serveur/` n'ont jamais parlé à un Postgres. Le test `tests/serveur/migrations.test.ts` est **sauté** faute de `DATABASE_URL` (c'est le seul des 514 qui l'est). `npm run migrate` sans base va proprement jusqu'à `ECONNREFUSED` et rend 1.
2. **`scripts/migrate.mjs` ne lit pas `.env`.** Il attend `DATABASE_URL` dans l'environnement, ce qui est juste en production (Coolify l'injecte) mais surprend en local : `npm run migrate` répondra `DATABASE_URL manquante` même avec un `.env` rempli. Lancer `node --env-file=.env scripts/migrate.mjs`, ou ajouter le drapeau au script — c'est une décision à prendre, pas un oubli à corriger en silence.
3. **La mise en ligne de la Dépêche à 18 h n'est pas câblée.** `armer()` passe la dépêche en `valide` sur décision humaine, et la requête `enLigne()` ne sert que le statut `en_ligne` : **rien ne fait la transition à l'heure dite**. Il manque le déclencheur (huitième tâche planifiée, ou évaluation paresseuse à la lecture — à trancher).
4. **Aucun bundle `en`.** `src/i18n/` ne connaît que `SOURCE_FR`. Les huit autres langues sont des lignes en base, sans glossaire ni traduction. Le repli `langue → en → fr` fonctionne, mais il tombe toujours sur `fr`.
5. **Aucun modèle 3D réel.** Les unités, terrains, bâtiments et décors sont des placeholders composés depuis la `Silhouette`. Les silhouettes **`rail`, `ailes` et `coque`** sont écrites dans `src/render3d/pieces.ts` mais **aucune unité du catalogue ne les utilise** : elles n'ont jamais été vues à l'écran.
6. **L'IA va souvent aux points.** Sur 50 parties de `plaine.json`, 28 finissent par `limite_journees`, donc par une décision aux points, contre 22 par élimination. C'est jouable et déterministe, mais ce n'est pas une IA qui cherche à gagner : elle capture et échange, et laisse le chronomètre trancher.
7. **« Parties non terminées » n'a pas la même définition à deux endroits.** `src/serveur/controle/verdict.ts` dit — et c'est la définition canonique — qu'une partie non terminée est une partie **sans vainqueur**. `scripts/simuler.ts` compte en plus toutes celles qui ont atteint `limite_journees`, même décidées aux points. D'où l'écart déroutant entre `simuler` (28 non terminées, 0 nul) et `controler` (0 sans résultat). Aligner le script sur le serveur, ou renommer sa ligne.
8. **Le moteur ignore trois mécaniques promises par les documents** : les **cartes de terrain** (`doc/04` §7.5), les **co-commandants** (passif seul + barre de jauge) et les **spécialités**. Elles existent dans `src/schemas/` — types et validateurs —, pas dans `src/engine/`.
9. **Les 24 unités spéciales n'ont aucune spécification.** Ce sont des modèles uniques, pas des kits ; il faut d'abord qu'elles entrent au catalogue d'unités (`doc/11` §10.3).
10. **Le validateur glTF ne vérifie pas les textures livrées** : il voit qu'une carte obligatoire est présente, pas sa résolution ni le caractère binaire du masque d'équipe (`doc/11` §10.4).
11. **Les assets de type `effet`** (impacts, poussière, halo de pouvoir) existent comme type, sans aucune spécification produite.
12. **Le générateur de cartes n'est pas branché sur le serveur** : `src/serveur/generation.ts` et la partie catalogue de `src/serveur/simulation.ts` lèvent une erreur « pas encore branché ».
13. **L'accueil est provisoire.** `src/app/page.tsx` est une page d'attente avec deux liens. Ni choix du pays, ni carte du monde, ni carnet.

## Les prochaines actions, dans l'ordre

1. **Brancher la base Coolify.** `cp .env.example .env`, y mettre la vraie `DATABASE_URL` — elle n'est **jamais** commitée, `.env` est dans `.gitignore` —, plus `ADMIN_PASSWORD`, `AUTH_SECRET` (`openssl rand -hex 32`), `CRON_SECRET` et `SITE_URL`.
2. **Premier `npm run migrate`**, puis un second immédiatement : la migration doit être rejouable sans rien faire. Vérifier `/api/health` en `200`, et que `tests/serveur/migrations.test.ts` cesse d'être sauté.
3. **Créer les tâches planifiées Claude** avec les prompts bootstrap prêts à coller : `doc/05-routines.md` §2.6 (contrôle), §3.6 (map), §4.6 (lore), §5.9 (cerveau), et `doc/09-i18n.md` §8.7 (traduction). Le récapitulatif des sept tâches et de leurs crons UTC est en `doc/05` §7.1. Commencer par `atlas_map` et `atlas_controle` seuls, une semaine, et regarder le taux de rejet par motif avant d'ouvrir les autres.
4. **Semer les 24 pays en base** depuis `content/pays/*.json`, avec les 18 régions et les styles. Il n'existe aucun script pour cela : c'est un `scripts/semer.ts` à écrire, qui valide chaque fiche par `src/schemas/valider.ts` avant l'insertion, et qui est **rejouable**.
5. **Ouvrir `en`** : écrire `content/i18n/glossaire.en.json` (sans lui, le serveur ne sert aucun lot), lancer `npm run extraire-chaines` avec la base, laisser `atlas_traduction` remplir la file, relire l'échantillon humain.
6. **Câbler la mise en ligne de 18 h** (manque n° 3) et faire le test qui fait rater une échéance : le vide vaut mieux qu'une erreur.
7. **Passer le rendu 3D sur de vraies textures.** Envoyer au générateur externe les **premières specs par priorité 1** — les 165 qui suffisent à jouer la qualification française : terrains d'abord (ils couvrent l'écran), puis bâtiments, puis décor, puis unités, puis bustes. Un asset refusé ne remplace **jamais** son placeholder. Après chaque famille livrée, une passe de performance contre le budget de `doc/10` §9.2.
8. **Ensuite seulement**, les mécaniques régionales françaises (étape 7), qui sont le premier gros morceau de code moteur restant.

## Le déploiement

Coolify, image construite depuis le `Dockerfile` à la racine (Node 22 Alpine, trois étages, `postgresql18-client` installé pour le `pg_dump` d'avant migration — un client de majeure inférieure au serveur refuserait de tourner, et `migrate.mjs` le signale sans bloquer).

- `npm start` = `node scripts/migrate.mjs && next start -p ${PORT:-3000}`. Les migrations passent **avant** que Next n'écoute.
- `HEALTHCHECK` sur `/api/health` : `200` quand la base répond, `503` sinon (`non_configuree` ou `muette`). Aucune requête n'est faite à l'import d'un module — c'est ce qui garantit que `next build` n'a besoin d'aucune variable d'environnement.
- `/api/health/routines` est la sonde « homme mort » : `500` dès qu'une routine dépasse trois fois sa cadence nominale. Une routine qui n'a jamais tourné n'est pas en panne. À brancher sur la supervision externe.
- Variables à poser dans Coolify : `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `SITE_URL`, et si l'on veut s'écarter des valeurs par défaut `DEPECHE_TZ` (`Europe/Paris`), `DEPECHE_HEURE` (`18:00`), `BACKUP_DIR` (`.backups`, à monter sur un volume en production, sinon la copie de sécurité meurt avec le conteneur).
- Le conteneur embarque `content/` et `drizzle/`, lus au démarrage. Une modification du canon est donc un déploiement, pas une écriture en base.
