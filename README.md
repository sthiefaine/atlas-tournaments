# Atlas Tournament

Un tactique au tour par tour dans l'esprit d'Advance Wars. Dans ce monde, les guerres ont été remplacées par des Jeux Tactiques : chaque pays a une équipe et un commandant, et tous les quatre ans un tournoi fait le tour de la planète. Vous êtes un jeune commandant, vous partez de France, et vos choix décident qui vous suit quand une faction d'Atlas tente de rallumer les vraies guerres : chacune des 24 nations devient alliée, rivale ou se retire de la Ronde. Celles que vous ralliez s'ouvrent comme pays de départ pour une Nouvelle Ronde.

Web, TypeScript strict, Next.js 15. **Rendu 3D three.js**, moteur de règles déterministe sans dépendance, contenu produit par cinq routines Claude (quatre de contenu, une de traduction) et validé par un serveur qui ne fait confiance à rien.

## Jouer les premiers matchs

Ouvrir **`/campagne`** : quatre entraînements guidés, puis une qualification avec le génie et un match sous les couleurs du Luxembourg. Le carnet sauvegarde la progression dans le navigateur. `/jeu` liste les parties libres (la démo et les cartes navales, depuis le 7 septembre 2026), et `/atelier` est le banc d'essai des rendus.

Quatre entraînements sur quatre cartes distinctes : se battre, prendre des villes, remettre des usines en service avec le génie, prendre le QG à marée basse. Le QG se prend en quarante points ; les bâtiments désaffectés se remettent en service ; le catalogue 3 ajoute drones, brouilleur et station radar pour le brouillard de guerre. Voir `doc/15-premiers-matchs.md` pour le périmètre exact et les versions. `npm run verifier:campagne` vérifie une solution et son rejeu pour chacune des six missions.

## Les documents

- `BRIEF.md` — le canon : toutes les décisions prises. Il a toujours raison.
- `PLAN.md` — le plan en treize étapes, avec un critère de fin par étape.
- `doc/` — les quinze documents de conception (commencer par `doc/README.md`).
- `CLAUDE.md` — la passation : arborescence, règles, commandes, état réel, prochaines actions.

## Ce qui est construit

| Domaine | État |
|---|---|
| Schémas et validateurs (`src/schemas/`) | les types de `doc/03` et leurs validateurs écrits à la main, sans dépendance |
| Moteur (`src/engine/`) | tour, mouvement, combat, capture, économie, pouvoirs, victoire, brouillard, climat, mécaniques, déblocages — pur et déterministe |
| IA (`src/ai/`) | trois stratégies (pondérée, agressive, défensive), assez bonnes pour certifier une carte |
| Générateur de cartes (`src/mapgen/`) | `ParametresCarte` + graine → `MapDef`, avec symétrie, vérifications et aperçu texte |
| Contrôle (`src/serveur/controle/`) | vérifications structurelles, campagne de simulation multi-climats, `ReviewVerdict` motivé |
| Rendu (`src/render/`, `src/render3d/`) | le socle indépendant de three.js — interface `Rendu`, contrôleur, HUD HTML — et la peau 3D, avec des placeholders composés depuis la `Silhouette` |
| Serveur et admin (`src/app/`, `src/serveur/`, `src/db/`) | les routes `/api/routines/*`, la file de validation, les prompts versionnés, la dépêche, l'i18n |
| Assets (`src/assets/`, `assets/specs/`) | le format `AssetSpec`, 972 spécifications générées depuis le canon (catalogue 6), le validateur glTF |
| Contenu (`content/`) | 24 pays, 18 régions françaises, 42 styles, 9 fils, le catalogue d'unités (24, catalogue 6) et de terrains, six missions, une démo et deux cartes navales de jeu libre |

Aucune base de données n'est encore branchée, aucun modèle 3D réel n'est livré, et aucune tâche planifiée Claude ne tourne. `CLAUDE.md` détaille l'état exact de chaque étape et ce qui manque.

## Lancer

```bash
npm install
npm run dev            # http://localhost:3400
```

L'administration est sur `/admin` (mot de passe `ADMIN_PASSWORD`), et `/jeu` ouvre une partie libre contre l'IA. Sans base, l'administration reste lisible et affiche un bandeau ; le jeu, lui, n'a besoin de rien.

Pour la base : copier `.env.example` en `.env`, y mettre la vraie `DATABASE_URL` (jamais commitée), puis `npm run migrate`.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev` | le site en développement, port 3400 |
| `npm run build` | la compilation de production — n'exige **aucune** variable d'environnement |
| `npm start` | migrations puis Next, en production (c'est ce que lance le Dockerfile) |
| `npm run typecheck` | `tsc --noEmit`, TypeScript strict |
| `npm run lint` | ESLint |
| `npm test` | les tests `tsx --test` de `tests/` (près d'un millier) |
| `npm run test:e2e` | le test de fumée Playwright, avec ses drapeaux SwiftShader |
| `npm run migrate` | applique `drizzle/*.sql` une fois chacun, avec copie de sécurité |
| `npm run simuler -- --carte tests/engine/cartes/plaine.json --parties 50 --graine 1` | N parties IA contre IA, statistiques imprimées |
| `npm run controler -- --carte tests/engine/cartes/plaine.json` | le verdict de la routine contrôle, hors ligne |
| `npm run apercu -- --params '{"largeur":16,"hauteur":12}' --graine 7 --sortie apercus/c.png` | une carte en PNG et en texte |
| `npx tsx scripts/generer-specs-assets.ts --verifier` | vérifie que `assets/specs/` n'a pas dérivé du canon |
| `npm run extraire-chaines` | extrait les chaînes d'interface vers `content/i18n/` |

## Déploiement

Coolify, image construite depuis le `Dockerfile`. `npm start` applique les migrations puis démarre Next ; `/api/health` répond `200` quand la base répond. Les variables à poser sont celles de `.env.example`. La mention de version en bas à droite de l'écran-titre est calculée **au build** (`next.config.ts`) : l'heure de la mise en ligne, à Paris, et le commit court que Coolify fournit par `SOURCE_COMMIT` (à défaut, lu dans `.git`) — elle change à chaque push, sans action GitHub.

Licence : voir `LICENSE`.
