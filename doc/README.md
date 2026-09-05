# Documents de conception — Atlas Tournament

Ordre de lecture conseillé. Le canon est `../BRIEF.md` ; en cas de désaccord entre deux documents, le brief a raison, puis le document « propriétaire » du sujet.

| Document | Sujet | Propriétaire de |
|---|---|---|
| [00-vision.md](00-vision.md) | Pitch, piliers, public, boucle de jeu, ce que le jeu n'est pas | la vision |
| [01-bible.md](01-bible.md) | Le monde : les Jeux Tactiques, Atlas, le tournoi, le ton, la charte de sensibilité, les flags canon | le lore |
| [02-architecture.md](02-architecture.md) | Couches, dépôt, serveur, cycle du contenu, déterminisme, tests | la technique |
| [03-schemas.md](03-schemas.md) | Types TypeScript et exemples JSON de tout ce qui circule | les schémas |
| [04-gameplay.md](04-gameplay.md) | Règles : tour, unités, terrains, dégâts, capture, commandants, mécaniques régionales | les règles |
| [05-routines.md](05-routines.md) | Les quatre routines de contenu, leurs prompts bootstrap, endpoints, bornes, administration ; le récapitulatif des sept tâches planifiées | le cerveau |
| [06-pays-de-depart.md](06-pays-de-depart.md) | Les 24 nations, leurs commandants, leur rôle de relation puis de départ débloqué | le contenu pays |
| [07-france-regions.md](07-france-regions.md) | Le tour des 18 régions de France et leurs mécaniques | le contenu régions |
| [08-narration-choix.md](08-narration-choix.md) | Flags, carnet de voyage, réputation, trois actes, fins | la narration |
| [09-i18n.md](09-i18n.md) | Les neuf langues, les chaînes et leur glossaire, le repli d'affichage, la routine `atlas_traduction` | l'i18n |
| [10-rendu-3d.md](10-rendu-3d.md) | La 3D three.js : caméra, terrain et splat map, éclairage par saison, phase et météo, unités et masque d'équipe, surbrillances, performance, HUD HTML, interface `Rendu` — la seule peau depuis le retrait du rendu vectoriel | le rendu 3D |
| [11-assets-spec.md](11-assets-spec.md) | Le format `AssetSpec` donné au générateur externe : échelle, pivot, budgets, textures et masque d'équipe, variantes, animations, glTF 2.0 et nommage, interdits, et le contrôle des livraisons | les assets |
| [12-au-dela-advance-wars.md](12-au-dela-advance-wars.md) | Réserve de propositions classées par coût : relief jouable, rejeux et défis, multijoueur asynchrone, draft, objectifs variés, génie, éditeur de cartes certifié, accessibilité… **aucune n'est du canon** | — |
| [13-campagne.md](13-campagne.md) | Le budget d'heures chiffré et la réponse à « 80 h, réalisable ? », la structure d'un parcours, les neuf gabarits de mission, les fils secondaires et leurs conséquences bornées, les deux modes, les dix généraux secrets, le système de déblocage, la sauvegarde de campagne | la campagne |
| [14-secrets.md](14-secrets.md) | Registre des treize easter eggs : où, comment, ce que ça débloque, le flag `monde.secret.<nom>`. **Jamais servi aux routines, exclu de `/api/canon`, jamais généré** | les secrets |
| [RELECTURE.md](RELECTURE.md) | Relecture croisée : corrections faites et arbitrages restants | — |

**Un document ne se lit pas comme les autres :** `14-secrets.md` est le seul du dossier qui ne doit **jamais** être servi à une routine. `GET /api/canon` ne sert que `content/`, donc `doc/` lui est inaccessible par construction ; la route refuse en plus tout chemin `content/secrets*`, et aucun flag `monde.secret.*` n'entre dans `content/flags.json`.

`doc/assets/` contient la démo de rendu (`atlas-render-vector.html`, `render-vector.png`, `render-units.png`) qui fixe la lisibilité de référence, et `render-3d.png` qui fixe l'esprit « diorama » de la direction 3D. Ce dossier n'a rien à voir avec `../assets/`, à la racine du dépôt.

Les spécifications d'assets produites depuis le canon vivent à la racine du dépôt, dans `../assets/specs/` — 540 fichiers JSON, un par asset, versionnés, régénérés par `npx tsx scripts/generer-specs-assets.ts` et vérifiés par `--verifier`.

Le plan d'étapes est dans `../PLAN.md`, et l'état réel du dépôt — ce qui est fait, ce qui manque, par quoi continuer — dans `../CLAUDE.md`.
