# Atlas Tournament — Plan d'étapes

Tactique au tour par tour dans l'esprit d'Advance Wars, où un jeune commandant fait le tour du monde pour disputer le Tournoi Atlas. Web, TypeScript, **rendu 3D three.js**, contenu produit par cinq routines Claude — quatre de contenu, une de traduction — et validé par un serveur qui ne fait confiance à rien.

Le canon est dans `BRIEF.md`. Les documents de conception sont dans `doc/` (lire `doc/README.md` pour l'ordre de lecture). Ce plan dit **dans quel ordre on construit, ce que chaque étape livre, et comment on sait qu'elle est finie**.

Fil conducteur : **le moteur et le contrôle avant le contenu, le contenu avant le cerveau.** Si une carte générée ne peut pas être jouée et vérifiée sans humain, rien de ce qui suit ne tient.

## Vue d'ensemble

| Étape | Nom | Livrable visible | Dépend de |
|---|---|---|---|
| 0 | Arbitrages et socle | Décisions prises, dépôt qui compile, CI verte | — |
| 1 | Moteur de règles | Une partie jouable en ligne de commande, IA contre IA, 100 % déterministe | 0 |
| 2 | Générateur de cartes + contrôle | Des cartes générées depuis des paramètres, certifiées jouables par simulation | 1 |
| 3 | Rendu et jouabilité | Une partie complète au clavier et à la souris contre l'IA, en 3D dans le navigateur | 1 |
| 4 | **Assets 3D** | Les specs partent au générateur externe, les modèles validés remplacent les placeholders un à un | 3 |
| 5 | Serveur et administration | Base, API des routines, file de validation, prompts versionnés | 0 |
| 6 | Routine map + routine contrôle en ligne | Les deux routines tournent en tâches planifiées et remplissent une réserve de cartes | 2, 5 |
| 7 | La France : 18 régions | Le tour de France jouable de bout en bout, avec ses mécaniques régionales | 3, 6 |
| 8 | Routine lore + 24 nations | Le départ français a son prologue ; les 24 fiches ont un commandant, un rival, des flags, et de quoi tenir leur rôle de relation | 7 |
| 9 | Voyage, choix et **campagne** | Carte du monde, carnet, conséquences, trois actes, fins, **modes, fils, déblocages, et un budget d'heures mesuré** | 8 |
| 10 | Le cerveau et le jeu vivant | Routine amélioration / mémoire / prompts, la Dépêche du jour, l'Homologation | 6, 8 |
| 11 | Paquet naval | Unités et terrains de mer, spécialités maritimes des pays et régions | 7, 10 |
| 12 | Finition et lancement | Son, animations, tactile, accessibilité, performance, sauvegarde | 9, 10 |

> **Renumérotation du 5 septembre 2026.** Le pivot vers la 3D a inséré l'étape 4 (« Assets 3D ») ; toutes les étapes suivantes ont pris un rang. Correspondance pour les documents qui citent l'ancien plan : `4 → 5`, `5 → 6`, **`6 → 7`** (la France, citée par `04-gameplay.md` §7.5, `07-france-regions.md` §8 et `RELECTURE.md`), `7 → 8`, `8 → 9`, `9 → 10`, **`10 → 11`** (le paquet naval, cité par `07-france-regions.md` §4.17), `11 → 12`. Les étapes 0 à 3 n'ont pas bougé.
>
> **Tous les renvois périmés ont été corrigés** le 5 septembre au soir : `04-gameplay.md` §7.5, `07-france-regions.md` §4.17 et §8, `doc/RELECTURE.md`, `BRIEF.md` et `12-au-dela-advance-wars.md` citent désormais la numérotation ci-dessus.
>
> **La campagne n'ajoute pas d'étape.** Ce qu'ajoute la section « Campagne, modes, généraux secrets, easter eggs » du brief est **fusionné dans l'étape 9**, précisément pour ne pas renuméroter une seconde fois : une campagne sans carte du monde, sans actes et sans fins n'aurait de toute façon rien à quoi s'accrocher. `doc/13-campagne.md` et `doc/14-secrets.md` font foi.

Les étapes 3 et 5 peuvent avancer en parallèle de la 2 ; l'étape 4 **avance en parallèle de tout le reste** à partir du moment où l'étape 3 tourne, parce qu'un asset livré est un remplacement de fichier et ne bloque personne. Les étapes 7 et 8 sont les plus longues. Le climat (saisons, jour et nuit, météo) n'est pas une étape à part : il entre dans le moteur à l'étape 1, dans le rendu à l'étape 3, dans le contrôle à l'étape 2, parce qu'il est construit sur le même contrat de hooks que les mécaniques régionales.

**Les neuf langues ne sont pas une étape non plus, et surtout pas une étape finale.** L'i18n entre à l'étape 3 par les clés de chaînes (aucun texte en dur dans le rendu, jamais), à l'étape 6 par la table des chaînes et la cinquième routine `atlas_traduction` — avec `en` comme première langue cible, pour valider le pipeline sur une langue qu'on sait relire —, et se solde à l'étape 12 par les neuf langues `active`. Rattraper des textes en dur après coup coûte dix fois le prix de les éviter : `doc/09-i18n.md` fait foi.

## Étape 0 — Arbitrages et socle

Les cinq incompatibilités relevées par la première relecture croisée sont tranchées (`BRIEF.md`, « Arbitrages du 5 septembre 2026 ») et reportées dans les documents propriétaires. Il reste à lire `doc/RELECTURE.md` pour les points mineurs ouverts par la seconde passe, et à les trancher de la même façon avant le premier commit de code.

Puis poser le socle : dépôt Next.js 15 App Router en TypeScript strict, arborescence de `doc/02-architecture.md` §4, `tsx --test` pour les tests, Playwright pour la fumée, PostgreSQL + Drizzle avec `scripts/migrate.mjs` au démarrage (repris de Flecho), `.env.example`, CI qui vérifie types, tests, build et migrations rejouables sur base vierge. Un test qui lit les imports et refuse qu'`engine/` importe autre chose que `content/` et ses types.

Fini quand : les points mineurs de `doc/RELECTURE.md` sont tranchés dans le brief, `npm test` et `npm run build` passent sur un dépôt vide de logique, la CI est verte.

## Étape 1 — Moteur de règles

Le cœur, entièrement en Node, sans une ligne de rendu. Implémenter `doc/04-gameplay.md` sur les types de `doc/03-schemas.md` : état de partie sérialisable, `(état, action) → état`, RNG seedé avec flux dérivés, les dix unités terrestres et aériennes, les douze terrains, la formule de dégâts, la capture, les revenus et la production, les commandants avec jauge, pouvoir et super pouvoir (durées en journées, `poser_terrain`), les co-commandants (passif seul), les conditions de victoire, le brouillard, le contrat des mécaniques régionales avec ses cinq hooks (sans encore aucune mécanique concrète, sauf une de test), et **le climat** sur ce même contrat : saison fixée par le scénario, cycle jour / nuit, météo tirée du RNG seedé avec prévision à deux journées, effets chiffrés de `doc/04-gameplay.md` §12. Les dix unités de base sont décrites en données avec leurs traits et leur silhouette (`doc/04-gameplay.md` §13), même si l'homologation n'arrive qu'à l'étape 10 : le moteur ne doit jamais connaître une unité par son nom.

Une IA de jeu minimale mais réelle dans `ai/` (stratégie pondérée : capture, valeur d'échange, sécurité), parce que c'est elle qui servira à certifier les cartes à l'étape 2. Un script `scripts/simuler.ts` qui joue N parties IA contre IA sur une carte écrite à la main et imprime les statistiques.

Tests : unitaires sur chaque règle, propriétés (même seed et mêmes actions donnent toujours le même état ; aucune action ne laisse l'état invalide), et un rejeu enregistré qui doit rester identique d'une version à l'autre.

Fini quand : 1 000 parties IA contre IA sur trois cartes manuelles se jouent sans exception, en moins d'une minute, avec un rejeu identique au bit près, et les mêmes cartes se jouent sous les quatre saisons, de nuit et sous chaque météo sans qu'une partie reste bloquée.

## Étape 2 — Générateur de cartes et routine contrôle (hors ligne)

`mapgen/` : à partir de `ParametresCarte` et d'une graine, produire une `MapDef` (grille de caractères, propriétaires, unités de départ, mécanique régionale). Symétrie de valeur, pas de zone morte, QG accessibles, biomes. Un script `scripts/apercu-carte.ts` qui rend une carte en PNG avec le code de `doc/assets/atlas-render-vector.html`, pour la relire à l'œil.

La logique de contrôle, côté serveur mais testable en Node : vérifications structurelles, simulation IA contre IA **sous plusieurs conditions de climat** (saison × météo × phase), seuils d'équilibre (taux de victoire par camp, durée), verdict `ReviewVerdict` avec les motifs structurés de `doc/03-schemas.md`. La simulation de catalogue (une unité candidate ajoutée au roster) est prévue dans l'interface dès maintenant, même si elle ne sert qu'à l'étape 10. C'est le même code que la routine contrôle déclenchera plus tard par l'API.

Fini quand : sur 200 cartes générées depuis des paramètres aléatoires, le contrôle en accepte une majorité et chaque rejet porte un motif juste (vérifié à l'œil sur un échantillon) ; deux appels avec la même graine donnent la même carte.

## Étape 3 — Rendu et jouabilité

**Le rendu de production est la 3D, et c'est le seul** (`BRIEF.md`, direction artistique ; `doc/10-rendu-3d.md` fait foi). Le rendu vectoriel 2D, terminé puis **supprimé** le 5 septembre, devait rester comme repli : maintenir deux peaux revenait à prendre deux fois chaque décision d'affichage et à découvrir chaque défaut deux fois. L'interface `Rendu` subsiste (`render/rendu.ts` : `monter`, `afficher`, `animer`, `versMonde`/`versEcran`, `brancher`, `cadrer`, `demonter`), parce que c'est elle qui interdit à `render/` d'importer `render3d/` : le contrôleur d'interaction et le HUD ne savent toujours pas ce qui tourne sous eux, et restent testables sans WebGL.

`render/` — le socle commun, déjà écrit : boucle paresseuse, cache de sprites vectoriels en canvas hors écran, entrées souris, tactile et clavier, HiDPI, ambiance `f(saison, phase, météo)`, contrôleur, sauvegarde locale `{scénario, graine, actions}`.

`render3d/` — la peau 3D avec three.js (une seule dépendance runtime, assumée) : caméra perspective (tangage 60–75°, lacet fixe avec quarts de tour, zoom par paliers, cadrage automatique et **une case ≥ 48 px au zoom par défaut**), maillage de terrain à relief léger avec jonctions adoucies et texturage par splat map à quatre canaux, eau à normales animées, routes en bandes décalées, décor et unités en `InstancedMesh`, surbrillances en décalques au sol qui ne cachent jamais une unité, éclairage complet (soleil directionnel avec ombres, hémisphère, température par saison, trajectoire sur le cycle jour/nuit, villes émissives la nuit, six météos), et les **placeholders d'unité composés depuis la `Silhouette`** — le jeu est jouable de bout en bout sans un seul asset livré.

**HUD en HTML par-dessus le canvas**, indépendant de la peau : c'est ce qui règle les polices des neuf langues, les largeurs souples et l'accessibilité (`render/hud-html.ts`), et c'est ce qui a permis de retirer le rendu vectoriel sans y toucher.

**Sans WebGL 2, il n'y a plus de repli** : `webgl2Disponible()` décide si l'on monte le plateau ou l'écran qui explique qu'on ne peut pas, et `monterJeu` lève plutôt que d'afficher un plateau vide. Cibles de performance : 60 ips sur portable à circuit graphique intégré, 30 ips sur téléphone milieu de gamme, avec des réglages dégradés (ombres, cascades, particules, LOD) avant de basculer.

Une page `jeu/[scenario]` qui charge un scénario et joue contre l'IA.

**Tout texte affiché passe par une clé de chaîne dès maintenant** (`doc/09-i18n.md` §3.1 et §7) : `render/`, `render3d/` et `app/` n'écrivent **jamais** un libellé en dur, ils appellent `t('hud.fin_de_tour')`. Un rendu n'appelle même pas `t()` : les rares libellés qu'il peint lui sont donnés déjà traduits. Le fichier `content/i18n/ui.fr.json` est produit par le script d'extraction, un test d'intégration continue échoue sur tout littéral affichable trouvé hors d'un appel à `t()`. Une seule langue existe à ce stade — le français — mais elle passe déjà par le même chemin que les huit autres.

Fini quand : une personne qui n'a jamais vu le projet gagne ou perd une partie complète contre l'IA sans explication orale, sur ordinateur et sur téléphone ; le test de fumée Playwright la rejoue ; l'écran affiché en l'absence de WebGL 2 est testé ; le test d'extraction ne trouve aucun texte en dur ; et le test de lisibilité ne trouve aucune combinaison (taille de carte × écran de référence) sous 48 px par case au zoom par défaut.

## Étape 4 — Assets 3D

La 3D tourne dès l'étape 3 avec des placeholders. Cette étape les remplace, un fichier à la fois, sans jamais toucher au code. `doc/11-assets-spec.md` fait foi. **Le plan d'exécution, jalon par jalon, est `doc/16-realisme.md`** (6 septembre 2026) : il précède cette étape d'un lot « moteur » (environnement, ombres, occlusion) et d'un préalable de chargeur (orientation, gabarit, LOD, mixer d'animation, commande de contrôle) que la boucle des assets suppose et que le code n'a pas encore.

**Les spécifications.** `src/assets/` porte le format `AssetSpec` (le contrat JSON donné au générateur externe : description bilingue, style, échelle en mètres — une case = 1 m —, pivot, budget de triangles par LOD, cartes de textures dont le **masque de couleur d'équipe**, variantes par saison et par biome, clips d'animation nommés, format glTF 2.0 binaire avec noms de nœuds imposés, conventions de nommage, interdits de la charte de sensibilité, et la liste des contrôles) et son validateur. `scripts/generer-specs-assets.ts` produit `assets/specs/*.json` **depuis le canon** — `content/unites.json`, `content/terrains.json`, les quatre bâtiments, le décor par biome, les dix archétypes de commandant, les 24 fiches pays, les 18 régions et les styles —, soit **540 spécifications** aujourd'hui (`doc/11-assets-spec.md` §8 fait foi : 10 unités, 240 kits nationaux, 8 terrains, 164 bâtiments, 108 décors, 10 bustes). Le dossier est **versionné** ; le mode `--verifier` échoue en intégration continue s'il a dérivé du canon. Rien ne part au générateur qui n'ait passé `validerAssetSpec` : le dépôt ne livre jamais un contrat qu'il refuserait lui-même.

**La boucle avec le générateur externe.** Une spécification part, un `.glb` et ses textures reviennent, `src/assets/valider-gltf.ts` les contrôle — lecteur GLB sans dépendance : en-tête, chunk JSON, chunk BIN — et rend un verdict `{ ok, motifs[] }` de la même forme que `ReviewVerdict`, avec ses codes (`asset_format`, `asset_echelle`, `asset_budget`, `asset_masque_absent`, `asset_animation_absente`), son détail et ses mesures. Les motifs sont renvoyables tels quels au générateur : un `asset_echelle` qui dit `{ mesure: 1.24, cible: 0.50, marge: 0.07 }` se corrige du premier coup. Une relecture humaine **à l'œil**, une fois par livraison, complète le contrôle mécanique : le validateur ne sait voir ni un drapeau réel, ni un texte lisible, ni une faute de ton.

**Le remplacement progressif.** Un asset accepté entre dans le dépôt et le placeholder correspondant disparaît. Un asset refusé ne remplace **jamais** son placeholder : il n'existe pas d'état à moitié cassé, et pas de « on le prendra quand même, on corrigera plus tard ». L'ordre de priorité suit ce qu'on voit le plus : terrains et bâtiments d'abord (ils couvrent l'écran), puis le décor (il le remplit), puis les unités (elles sont regardées de près), puis les bustes de commandants. Chaque famille livrée est l'occasion d'une passe de performance contre le budget par carte de `doc/10-rendu-3d.md` §9.2.

Fini quand : les 540 spécifications sont produites et valides — les 165 de priorité 1 suffisent à jouer la qualification française —, la boucle a été parcourue de bout en bout au moins une fois par famille (une unité, un terrain, un bâtiment, un décor, un buste), un asset refusé a bien été refusé avec le bon code sans que le jeu cesse d'être jouable, les douze terrains et les quatre bâtiments sont livrés et acceptés, et une carte 24 × 16 entièrement assettée tient le budget de triangles et de draw calls à 60 ips sur la machine de référence.

## Étape 5 — Serveur et administration

Tables de `doc/02-architecture.md` §3.6, migrations, `ai_prompts` avec versions et sections verrouillées, cycle `brouillon → validé → en_ligne` avec `rejeté` et motifs, `routine_runs`, sonde « homme mort », `unit_types` avec statut et `catalogueVersion`, `daily_missions`. C'est le serveur, et lui seul, qui fixe la date d'un scénario à partir de la date réelle : le moteur ne lit jamais l'horloge. Les routes `/api/routines/*` de `doc/05-routines.md` avec validation stricte contre `src/schemas/valider.ts`, `Bearer CRON_SECRET`, et le principe Flecho : le serveur recalcule et refuse ce qu'il n'a pas lui-même soumis.

Administration minimale : connexion, file de validation (brouillons, diff, accepter/rejeter), historique et diff des prompts avec retour arrière, métriques par routine, aperçu PNG d'une carte.

Fini quand : chaque endpoint a un test qui envoie une charge valide, une invalide et une hors périmètre ; une carte et un scénario peuvent être poussés par `curl`, validés dans l'admin, et servis au jeu.

## Étape 6 — Routines map et contrôle en ligne

Créer les deux tâches planifiées Claude avec les prompts bootstrap de `doc/05-routines.md`, brancher les prompts métier versionnés, laisser tourner une semaine sur une réserve de cartes. Observer : taux de rejet par motif, temps par run, reprise après run coupé, sonde.

**L'i18n prend sa place ici**, sur le même socle et au même moment, parce que le pipeline de traduction se valide comme celui des cartes : les tables `locales`, `chaines_source`, `traductions` et `glossaires` (`doc/02-architecture.md` §3.6), l'extraction des chaînes d'interface et de `content/`, la création d'une chaîne source à chaque passage en `valide`, puis la cinquième tâche planifiée `atlas_traduction` avec son prompt bootstrap (`doc/09-i18n.md` §8.7). **`en` est la première et la seule langue cible de cette étape** : une langue qu'on sait relire, un glossaire court, une boucle complète — pénurie, lot, soumission, refus chaîne par chaîne, échantillon humain. Les sept autres langues n'arrivent qu'une fois le pipeline stable, et chacune ne coûte alors qu'une ligne dans `locales` et un glossaire.

Fini quand : la réserve se remplit seule, le taux de rejet est stable, aucun run n'a franchi ses bornes, un humain n'a eu à intervenir que sur la file de validation, et `en` a franchi son seuil de couverture d'interface sans qu'aucune clé brute n'apparaisse à l'écran.

## Étape 7 — La France et ses 18 régions

Implémenter les mécaniques régionales de `doc/07-france-regions.md` sur les cinq hooks du moteur (marées, bocage, mistral, volcans, métro, Rhin, maquis, cyclones, satellite de Kourou...), leurs biomes de rendu, les commandants régionaux, la structure du tour (zones, finale en Île-de-France, récompenses plafonnées). Les cartes régionales passent par le générateur avec la mécanique en paramètre, puis par le contrôle, puis par une relecture humaine, parce que ce sont les premières cartes que tout le monde verra.

Fini quand : le tour de France se joue de bout en bout, chaque mécanique régionale a un test unitaire et un test de simulation, et le contrôle certifie les 18 cartes principales.

## Étape 8 — Routine lore et les 24 nations

Les fiches `Country` des 24 pays de `doc/06-pays-de-depart.md` en JSON dans `content/`. La routine lore en tâche planifiée : commandant, prologue, rival, dialogues, flags, écrits contre la bible et validés par le contrôle (ton, sensibilité, cohérence). Les quatre pays phares (France, Luxembourg, Japon, Brésil) reçoivent un prologue écrit à la main.

**Il n'y a pas d'écran de choix du pays de départ à cette étape** (`BRIEF.md`, « Le joueur et le départ », révisé le 5 septembre 2026 au soir) : **tout le monde part de France**. Les 24 fiches servent d'abord de **relations** pendant la campagne (étape 9), puis de départs débloqués en Nouvelle Ronde. La priorité de cette étape est donc la France, puis ce que chaque fiche doit dire pour tenir son rôle de relation : ce qu'elle apporte alliée (commandant, unité spéciale, carte de terrain), ce qu'elle coûte rivale, ce qui s'éteint quand elle se retire.

Fini quand : le départ français se joue avec son prologue écrit à la main, les 24 fiches passent leur validateur et portent ce qu'il faut pour être des relations jouables, et aucun texte généré n'a franchi la charte de sensibilité sans être bloqué.

## Étape 9 — Voyage, choix et campagne

Carte du monde avec choix de la prochaine destination parmi deux ou trois, actes par continent, système de flags et carnet de voyage de `doc/08-narration-choix.md`, réputation par commandant, co-commandants, traces persistantes sur les cartes, la trame de la faction dissidente en trois actes, les fins.

**Le voyage porte les relations de nation, et c'est le gros morceau nouveau de l'étape.** Tout le monde part de France ; les 24 nations sont des **relations** (`RelationNation = 'neutre' | 'alliee' | 'rivale' | 'retiree'`, `doc/03-schemas.md` §15.3 bis) calculées depuis les flags par le moteur ou le serveur, **jamais par le rendu**, et affichées sur la carte du monde. Une nation alliée prête son commandant en co-commandant, rend son unité spéciale produisible (quantité bornée par match), donne sa carte de terrain et son soutien à l'acte III ; une rivale revient avec un grief et peut fermer sa destination ; une retirée éteint la sienne et manque à l'acte III. Bornes tenues : **au plus cinq retirées** (refusé par `validerProfilCampagne`), **au moins deux alliées** avant l'acte III (garanti par la colonne vertébrale), **jamais de fin inaccessible**. Et une nation ralliée ouvre son départ de **Nouvelle Ronde** par un `Deblocage` de récompense `depart_nation` — c'est là, et seulement là, qu'un écran de choix du pays de départ a un sens.

**La campagne est fusionnée dans cette étape, elle n'en est pas une de plus.** C'est délibéré : une campagne sans carte du monde, sans actes et sans fins n'a rien à quoi s'accrocher, et un voyage sans budget d'heures ne se mesure pas. `doc/13-campagne.md` fait foi. Ce que l'étape ajoute au voyage :

- **Les deux modes**, `normal` et `difficile` (`doc/04-gameplay.md` §14) : `Scenario.modes` porté par chaque scénario, et la routine contrôle qui certifie **les deux** — un scénario certifié en `normal` et rejeté en `difficile` n'est pas mis en ligne.
- **Les neuf gabarits de mission** (`content/gabarits-missions.json`) : le contrat contre lequel la routine lore produit les 79 missions qu'on n'écrit pas à la main, et contre lequel la routine contrôle mesure leur durée.
- **Les fils secondaires** (`content/fils/`, type `Fil`) : 3 à 8 missions, une condition d'ouverture composable, des conséquences prises dans une liste **fermée et bornée**. Neuf fils sont écrits ; ils se jouent sur la carte du monde, en occupant une case de destination.
- **Le système de déblocage** (`src/engine/deblocages.ts`) : conditions composables évaluées par le moteur ou le serveur, **jamais par le rendu**, et sans jamais lire l'horloge — la date vient de l'appelant. Il ouvre les généraux secrets, les cartes, les skins, les fils et les modes.
- **Dix généraux secrets**, équilibrés comme les autres et **jamais indispensables** : aucune fin, aucun fil, aucune destination n'en dépend.
- **Les easter eggs** (`doc/14-secrets.md`), codés à la main, jamais générés, jamais servis aux routines.
- **La sauvegarde de campagne** `ProfilCampagne` : pays de départ, mode, flags, déblocages, fils en cours, scénarios finis, **`relations`**, `catalogueVersion` et `chainesVersion` figées.

**Le budget d'heures est un critère de fin, pas une intention.** Chaque scénario porte une `dureeVisee` en minutes ; la routine contrôle la confronte à la simulation ; l'addition de ces durées est le budget. La cible de campagne complète est **82 h en `normal`** sur 119 missions (`doc/13-campagne.md` §2.2), et la recommandation est de **lancer à ≈ 33 h** — 49 missions, **deux fins atteignables** — puis de croître de 12 à 15 h par mois. C'est cette recommandation, et pas les 82 h, qui est le critère de fin de l'étape.

Fini quand : deux parties menées avec des choix opposés aboutissent à deux fins différentes et le carnet explique pourquoi ; une partie jouée au pire finit avec cinq nations retirées, deux alliées et **une fin quand même** ; une nation ralliée ouvre bien son départ de Nouvelle Ronde ; le lot de lancement **totalise au moins 30 h mesurées** en `normal`, **toutes ses missions certifiées dans les deux modes** ; un joueur qui n'a débloqué aucun général secret et joué aucun fil atteint la même fin qu'un joueur qui les a tous faits, à choix de voyage identiques ; et aucune production de routine n'a posé un flag `monde.secret.*` ni franchi une borne de `Consequence`.

## Étape 10 — Le cerveau et le jeu vivant

La quatrième routine : volet actualité sur liste blanche depuis un endpoint interne (jamais le web), volet mémoire structurée avec expiration, volet prompts candidats à partir des métriques du contrôle, sections verrouillées, promotion humaine, retour arrière. Une première boucle complète : le contrôle rejette, le cerveau propose, l'humain promeut, le taux de rejet baisse.

Puis les deux flux quotidiens de `doc/05-routines.md` §8 et §9. **La Dépêche du jour** : proposition le matin, scénario, certification, validation humaine, mise en ligne à heure fixe, expiration à sept jours, et la règle « le vide vaut mieux qu'une erreur » vérifiée par un test qui fait rater une échéance. **L'Homologation** : une unité candidate décrite en données depuis une technologie civile de la liste blanche, simulée dans le catalogue, validée par un humain, trente jours à l'essai dans les missions du jour, puis homologuée ou retirée ; bornes (une candidate par semaine, une homologation par mois, vingt-quatre unités actives) tenues par le serveur, `catalogueVersion` incrémentée, rejeu des anciennes parties inchangé.

Fini quand : un prompt candidat a été promu par un humain et a mesurablement amélioré une métrique sans toucher aux sections verrouillées ; sept missions du jour consécutives sont sorties (ou ont été sautées proprement) sans intervention hors validation ; une unité a fait le tour complet `essai → homologuee` et une autre `essai → retiree`, et une partie sauvegardée avant leur arrivée se rejoue à l'identique.

## Étape 11 — Paquet naval

Les unités de mer (transport, patrouilleur, croiseur, sous-marin au minimum), les terrains de mer (port, récif, haute mer) et leur place dans la table de dégâts, les mécaniques régionales qui les attendaient (marées, lagon, cyclones), puis les spécialités maritimes des pays et régions, qui **s'ajoutent** aux spécialités de repli sans les remplacer. Chaque carte maritime existante est revalidée par le contrôle dans ses deux versions.

Fini quand : les huit pays maritimes et les six régions concernées jouent leur spécialité complète, et aucune carte certifiée avant le paquet n'a changé de verdict.

## Étape 12 — Finition et lancement

Son et musique, animations de pouvoirs, second passage tactile, accessibilité (clavier complet, contrastes, taille de texte), performance sur téléphone d'entrée de gamme, sauvegarde robuste, pages publiques, SEO, sauvegardes de base et restauration testée une fois.

**Les neuf langues.** Les huit langues cibles sont ouvertes une à une dans `locales`, chacune avec son glossaire écrit à la main (translittérations obligatoires pour `ru`, `zh-hans` et `ja`), et `atlas_traduction` remplit la file par ordre de pénurie. Relecture par échantillon humain tant qu'une langue est `en_preparation`, passage `active` sur seuil de couverture, et une passe visuelle de HUD en allemand (le plus long), en français (la référence) et en japonais (le plus court, autre script). `doc/09-i18n.md` fait foi sur les seuils et les métriques.

Fini quand : les **neuf langues sont `active`** — interface et tronc commun de campagne à 100 %, taux de correction humaine sous 10 % —, aucune clé brute n'a été journalisée, et le sélecteur de langue change de langue sans recharger ni interrompre une partie en cours.

## Garde-fous permanents

Aucun appel à un modèle pendant une partie. Rien ne passe en ligne sans le contrôle, et rien issu de l'actualité sans un humain : pas de mission du jour plutôt qu'une mauvaise, pas d'unité plutôt qu'une unité dominante. Vrais pays, jamais de vrais conflits, jamais de dépêche sur un drame. Le climat est annoncé, jamais subi. Le moteur ne lit jamais l'horloge — pas même pour évaluer un déblocage — et ne connaît aucune unité par son nom. **Un mode difficile n'est jamais plus facile, un scénario certifié dans un seul mode n'existe pas, un général secret n'est jamais indispensable, et un easter egg n'est jamais servi aux routines ni généré par elles.** **Le rendu n'a aucune autorité, et il en existe deux : ce qui n'est pas jouable dans les deux ne se fait pas. Un asset refusé ne remplace jamais son placeholder, et l'arrivée d'un modèle est un remplacement de fichier, jamais un changement de code.** Le brief a toujours raison sur les documents, le document propriétaire a toujours raison sur les autres. Une seule nouveauté visible à la fois.

## Méthode de travail

Un coordinateur (Claude Fable 5.1) tient le plan, le brief et les arbitrages ; des agents (Claude Opus) prennent chacun un périmètre borné avec un critère de fin écrit ; chaque livraison passe par une relecture croisée par un agent qui n'a pas écrit le code. Les documents sont écrits pour être lus par des humains et servis aux routines.
