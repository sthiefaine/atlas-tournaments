# 17 — Aube : canon énergétique et campagne à produire

Décision du propriétaire, 9 septembre 2026 ; registre de guerre du lore v2, validé le 26 septembre 2026. `BRIEF.md` reste supérieur ; `01-bible.md` possède le monde, `08-narration-choix.md` les conséquences, `content/personnages.json` les biographies structurées, `refonte/lore-v2.json` les résumés, les technologies et le sort des personnages. Ce document rassemble le parcours et distingue sa cible de sa réalisation.

## Ce qui est fixé

*Registre de guerre depuis la validation du lore v2, le 26 septembre 2026 (`BRIEF.md`, « Le lore v2 validé » ; `refonte/lore-v2.md` et `.json`).*

Le monde est en guerre depuis quatorze ans — la guerre de l’énergie — pour l’énergie sous toutes ses formes et pour l’avance technique. Atlas arbitre cette guerre par le Pacte du Terrain : fronts déclarés, armes déclarées, concessions inscrites au Registre de Port-Méridien. Une victoire prend les sites, les richesses, les savoirs et le terrain tant qu’on le tient ; entre les vingt-quatre nations, jamais les habitants. Le nécessaire civil est garanti par le Pacte ; la faction cherche à lever cette protection. La guerre tue, sans gore : un appareil abattu emporte son équipage, et l’écran ne montre ni sang ni corps. Sur le front, le Registre dit « hors jeu ».

La Cinquième Manche refuse le Pacte de l’intérieur et ne rend rien de ce qu’elle prend. Elle veut **Aube**, programme de fusion fictif, pour elle seule : c’est la prise finale de cet opus. **Sélène Veyr** dirige ce réseau ; Hadran Ost commande la Sélection Méridienne, les Gris, son armée sur le terrain. Cette identité est stable dans le canon et révélée progressivement au joueur. Aube est installé sur un plateau neutre rattaché à Port-Méridien, fictif, dans aucune nation réelle : un réacteur d’essai, un campus de coordination, des convertisseurs et une réserve de batteries de relève. Aube ne produit encore rien : gagner ne rend pas la fusion disponible, gagner décide à qui elle reviendra. La faction ne prend ni le Soleil ni un réacteur transformé en arme ; on dispute des accès, des plans, des équipes et des contrats.

Aube est inspiré de la recherche sur la fusion, notamment ITER, mais ne représente pas ITER. Aucun personnage réel, incident réel ou complot réel ne lui est attribué. L’information scientifique vérifiée se présente séparément du récit. Gagner la finale ne rend pas soudain la fusion commerciale ou illimitée.

### La course aux technologies

La guerre se joue deux fois : une fois pour le courant, une fois pour ce qu’il y a dans les hangars d’en face. Un laboratoire pris, un lot de plans saisi, une télémétrie récupérée changent les moyens du front suivant, et un savoir pris ne se rend pas. Les vingt technologies de `refonte/lore-v2.json` (`technologies[]`) sont des butins : chacune apparaît à un épisode, s’explique par une famille du moteur qui existe déjà et, quand elle se capture, change les moyens du front suivant à l’épisode où on la prend. Ce que le joueur fait de ce qu’il prend passe par les décisions existantes, jamais par une mission de plus.

| Technologies | Camp | Vues | Prises |
|---|---|---|---|
| Aube, le programme de fusion | commun | Inde 3 | finale 18 : la prise finale, aucune arme |
| Réserves de stockage solaire, postes de distribution, convertisseurs d’interconnexion, télémétrie de réseau, station radar | commun | du tutoriel 6 à l’Inde 3 | du tutoriel 6 (la station radar) au Japon 9 (la télémétrie) |
| Drones intercepteur et ravitailleur | commun | tutoriel 6 | ne se prennent pas : déclarés, donc à tout le monde — la première technologie que la Cinquième Manche n’a pas su garder |
| Station à impulsion (IEM), drone marin | Gris | tutoriels 6 et 7 | Pays-Bas 9 et Indonésie 5 : la seule station capturable en saison nationale est la station à impulsion |
| Station de forçage météo | Gris | tutoriel 9 | finale 17, la première capture d’une station météo |
| Veilleur et Bastion méridiens | Gris | Sénégal 5, Suisse 5 | ne se prennent pas : matériels exclusifs |
| Les huit armes sans dossier des supers | Gris | finales 1 à 10 | finales 7 à 18 ; la dernière, le Coupleur de Sélène, à la finale 18 |

Le Convoi sans manifeste d’Edran porte les batteries de relève d’Aube, sorties d’un dépôt méridien sans un papier : c’est Aube déjà volé, et le joueur le saisit à la finale 15, trois batailles avant le campus.

## Vingt-quatre nations, douze au premier plan, une faction supplémentaire

Les **24 nations sont conservées**. Douze occupent le premier plan de production ; les douze autres restent dans le monde et disponibles pour les autres rencontres. La faction adverse vient **en plus**, sans devenir une vingt-cinquième nation. Le roster comprend donc 24 délégations nationales et une faction apatride. Cela ne signifie pas 25 camps dans une partie : une rencontre comporte jusqu’à **quatre camps simultanés**, répartis en deux coalitions.

Plan de production proposé parmi les fiches déjà présentes : France (`fr`), Luxembourg (`lu`), Suisse (`ch`), Pays-Bas (`nl`), Maroc (`ma`), Sénégal (`sn`), Brésil (`br`), Mexique (`mx`), Inde (`in`), Japon (`jp`), Australie (`au`) et Indonésie (`id`). Ces douze donnent montagnes, polders, désert, bocage, littoral, réseau ferroviaire et archipels sans inventer de nation supplémentaire. Ce choix éditorial ne supprime ni ne renomme les autres pays. La priorité de production n’impose pas douze visites obligatoires.

La région apporte paysages, relief, météo, bâtiments et traits tactiques, avec les géométries partagées du catalogue. Elle n’exige pas une unité spéciale. Les kits partagent le squelette, la géométrie et les UV ; les textures externes sont communes entre LOD. Un poids croissant sans rôle tactique nouveau est un motif de refus de production.

## Trois actes, sept saisons, 172 épisodes

Le plan de campagne est celui des registres de `refonte/` : **10 tutoriels, 144 missions nationales (12 pour chacune des 12 nations au premier plan) et 18 finales**, soit 172 épisodes numérotés, plus 28 hors-série hors du compte. Le fil complet est généré par `npm run fil:opus1` (`refonte/opus1-fil.md`) ; les résumés, les décisions et le sort des personnages sont dans `refonte/lore-v2.json`. C’est un **plan**, pas 172 scénarios prêts : le parcours local joue les dix exercices, les deux épreuves de sortie d’école et les douze missions françaises de la saison nationale 1.

| Acte | Saison | Épisodes | Ce qui s’y joue |
|---|---|---|---|
| I | Prologue — l’école du front | les dix tutoriels, à charges à blanc ; le parcours local y ajoute deux épreuves de sortie d’école, le col et les couleurs alliées, à blanc aussi | apprendre à commander ; les stations montrées inactives ; le premier choix |
| I | Saison nationale 1 — les droits du vainqueur | 48 : France, Luxembourg, Suisse, Pays-Bas (+ 8 hors-série) | le premier engagement réel (`opus1_fr_01`) ; ce qu’une victoire prend ; les Gris, puis Ost, puis le Consortium qui les finance |
| II | Saison nationale 2 — qui possède le lendemain | 48 : Maroc, Sénégal, Brésil, Mexique (+ 9) | la même clause dans des contrats concurrents ; le retard comme arme ; des délégations qui signent pour continuer |
| II | Saison nationale 3 — les accès d’Aube | 48 : Inde, Japon, Australie, Indonésie (+ 9) | Aube devient un objectif matériel (Inde 3, les convertisseurs escortés) ; une coalition qui peut rester incomplète |
| III | Saison globale 4 — la Cinquième Manche à visage découvert | finales 1 à 6 (+ 1) | six armes sans dossier, six protêts classés ; Nikos meurt hors du front, après la finale 2 ou la finale 7 selon un choix |
| III | Saison globale 5 — la défaite écrite | finales 7 à 12 (+ 1) | le Coupleur et la contre-offre ; le père qui rejoint le fils à la finale 10 ; extraire le commandement ; Mira et Tomas meurent hors du front |
| III | Saison globale 6 — la dernière concession | finales 13 à 18 | Lise, Maël, Edran battu loyalement, Relais Zéro muet, Ost sans terrain, Sélène en personne au campus d’Aube — et le traité |

Les quatre fins sont **Le réseau partagé**, **La couronne électrique**, **La coalition sous tension** et **La relève** ; leurs conditions se lisent sur les décisions seules (`08-narration-choix.md` §7). Leur résolution complète reste à implémenter ; elle ne doit pas être annoncée comme jouable parce que ses titres existent.

**Les douze étapes cibles du 9 septembre sont retirées.** Elles décrivaient une campagne de douze missions en trois actes, écrite avant que la cible de 172 épisodes (`BRIEF.md`, « Refonte Aube » ; `refonte/opus1-*.json`) ne la remplace ; les garder faisait coexister deux plans. Sept d’entre elles ont un héritier, jouable ou à l’essai : « Premier courant » est `opus1_fr_01`, le premier engagement réel ; « Le pacte du col » est l’épreuve `pacte_du_col` ; « La finale des réserves », « La ligne de nuit », « Quarante journées » et « Les routes d’Aube » sont les essais `aube_reserves_1v2`, `aube_nuit_2v2`, `aube_releve_1v3` et `aube_routes_3v1` ; « La dernière concession » est `opus1_finale_18`. Les cinq autres — le bocage partagé, les archives du contrat, trois fronts au soleil, le relevé manquant, le partage du réseau — n’étaient que des thèmes : les arcs nationaux et les finales les portent.

## Ce qui existe dans ce chantier

Depuis le 23 septembre 2026, le parcours local joue les dix exercices, les deux épreuves de sortie d’école et le chapitre français de la saison nationale 1 (`opus1_fr_01` à `opus1_fr_12`). Les essais ci-dessous restent à part. Cinq scénarios d’essai sont présents dans `content/scenarios/`, distincts de la campagne principale et sans écriture de ses conséquences :

- `aube_batteries_2v1` — Le détour des batteries, coopération 2v1.
- `aube_reserves_1v2` — conflit sur deux réserves, 1v2.
- `aube_releve_1v3` — survie quarante journées, vagues déclarées et renfort à J41.
- `aube_routes_3v1` — attaque de coalition, 3v1.
- `aube_nuit_2v2` — deux fronts nocturnes, 2v2.

Ils portent le statut **brouillon** : présents pour les essais locaux ne signifie ni publiés en production ni campagne terminée. Les quatre entraînements restent conservés. Les biographies et prompts v2 fondent la production suivante ; ils ne remplacent pas les scènes, cartes et tests manquants. Le compte exact et les verdicts de contrôle doivent être lus dans les données et rapports du chantier.

## Historique et révélations

Chaque personnage de `content/personnages.json` possède un identifiant stable, une fonction, une motivation, une croyance, des liens et un historique sourcé avec `acteRevelation`. Ce dernier borne la révélation au joueur, pas la date à laquelle l’événement s’est produit. Les routines distinguent les faits, les croyances et le carnet de cette partie.

Ariane apprend à reconnaître une concession coûteuse ; Tomas juge les engagements tenus ; Nera confronte légalité et justice ; Talvarec assume une délégation de pouvoir imprudente ; Vantour corrige son propre récit ; Ost doit répondre de ses choix ; Solveig et Wren recoupent logistique et homologation. Sélène construit une dépendance qu’elle présente comme stabilité. Les détails doivent être lus dans le JSON, sans seconde chronologie concurrente dans chaque prompt.

Les scènes n’inventent pas un passé pour combler un manque. Les profils reçus par une mission filtrent les révélations permises. Une biographie manquante appelle une proposition de canon, pas une écriture dans une mémoire temporaire.

## Contrat de conséquence et de victoire

Chaque choix publié possède une source, une cible future et un effet borné supporté par le moteur. Le carnet nomme le choix avant son retour : « vous avez partagé les relevés » explique la route disponible aujourd’hui. Les scénarios d’essai ne prétendent pas appliquer ce système complet.

Par défaut, victoire par capture des QG adverses nécessaires ou élimination de leurs unités. Une mission exclusivement d’anéantissement n’ajoute pas une capture gagnante. Une coalition et un camp sont deux objets différents ; la disparition d’un camp ne termine pas une rencontre si ses alliés restent actifs. La survie, l’ordre fin J40 / début J41, les renforts, les cases occupées et les transitions doivent être vérifiés par le code. Un dialogue ne prouve jamais qu’un renfort existe.

Le contrôle des asymétries recherche la viabilité de l’objectif, les fenêtres de contre-jeu et les ressources nécessaires, pas un taux artificiel de 50 % dans un siège 1v3. Difficulté humaine et qualité dramatique restent à éprouver auprès de joueurs.

## État de livraison locale — 9 septembre 2026

Les six points de vue demandés ont contribué : scénariste, scénariste novateur, joueur d’Advance Wars simulé, deux perspectives de game design et spécialiste des routines. Leurs notes restent dans `doc/refonte/` ; cette synthèse et le brief priment sur leurs propositions non retenues.

Implémenté : équipes et renforts, cinq essais accessibles, deux décisions persistantes à deux branches avec effets futurs, journal par profil, biographies filtrées par acte, prompts v2 et protocole HTTP, navigation admin et exploration des assets. Les quatre entraînements sont conservés. Les douze étapes de la trame sont un plan narratif ; les cinq essais ne sont pas présentés comme une campagne complète de douze missions.

Validation finale : **1 331 tests réussis, zéro échec, un test de migration PostgreSQL non exécuté** ; typage et compilation Next de production réussis ; cinq tests navigateur DOM/réseau réussis (quatre réception/admin, un ouverture réelle du plateau Aube). Aucune capture ni approbation artistique automatique. La vérification du plateau utilise Chrome et WebGPU natif, comme la fumée 3D du projet.

Les cinq essais ont franchi leurs cinq premières journées avec 777 actions légales sans refus. Après réglage du siège, deux simulations atteignent J41, avec 479 et 582 actions sans refus. Cela vérifie un chemin de victoire, pas la difficulté humaine : les adversaires peuvent être neutralisés avant l’échéance, ce qui laisse une fin moins tendue. Les scénarios restent explicitement des essais.

Aucun déploiement, migration de base, activation fournisseur ou publication de contenu n’a été effectué. Les prompts personnalisés déjà en version2 ou supérieure en base restent prioritaires : la référence locale ne les écrase pas. Les budgets de triangles n’ont pas été augmentés globalement ; aucune nouvelle collection d’unités régionales ni de GLB n’a été générée pour cette refonte.

## Extension — choix croisés, deux difficultés et catalogue 7

À la demande du propriétaire, la campagne conserve les mêmes choix dans les modes **normal** et **difficile**. Le mode se règle par profil, avec sauvegardes et victoires séparées. Les budgets, l’IA, le brouillard et les renforts appliqués sont annoncés au briefing ; les règles de dégâts restent les mêmes. Le champ historique « reprises de journée » ne correspond à aucun bouton livré et n’est pas présenté comme une fonctionnalité.

`/campagne` présente maintenant l’arc Aube et ses quêtes. Après le choix des Batteries, le convoi de Solveig devient accessible ; après celui de la Ligne de nuit, les archives de Wren s’ouvrent. Mutualiser les réserves apporte une reconnaissance au convoi ; sécuriser les routes donne une infanterie aux archives. En retour, les quêtes permettent de consacrer leur récompense à des renforts ou à des fonds sur la trame principale. Le choix s’enregistre une seule fois, et les quatre décisions sont figées dans la graine de chaque nouvelle partie. Les anciennes graines à deux décisions restent lisibles. Les quêtes ne sont pas obligatoires pour poursuivre les missions principales.

Le catalogue **7** compte **28 unités** : deux drones communs (intercepteur et ravitailleur) et deux exclusives à `atl` (veilleur et bastion méridiens). La restriction vaut pour la production, les placements et les renforts ; une délégation ordinaire ne peut les recevoir en détournant un scénario. `aube_essais_drones` permet de les essayer avec leurs contres. Le banc technique utilise le catalogue 7 et donne explicitement les permissions des prototypes à ses deux camps. Les catalogues1–6 restent chargés pour les contenus antérieurs.

Les deux unités exclusives n’ont **aucun kit national**. Le lot ajoute quatre spécifications de géométrie et les 48 kits des deux unités communes, sans produire ni copier de GLB. Les modèles définitifs restent à créer ; les volumes procéduraux existants rendent les unités jouables. Les budgets de triangles restent ceux de leurs familles.

### Inspirations retenues

- [Campaign — Wars Wiki](https://warswiki.org/wiki/Campaign) : embranchements et missions facultatives ayant un effet sur le parcours. Atlas rend ces conséquences explicites et persistantes dans le carnet.
- [War Room — Wars Wiki](https://warswiki.org/wiki/War_Room) : défis indépendants contre l’IA. Le siège et l’essai des drones peuvent être rejoués ; aucun nouveau mode classé en ligne n’est annoncé.
- [Dual Strike — Wars Wiki](https://warswiki.org/wiki/Advance_Wars:_Dual_Strike) : rôles variés et appui entre fronts. Atlas utilise ses propres personnages, cartes et règles de soutien.
- [Advance Wars — Wars Wiki](https://warswiki.org/wiki/Advance_Wars) : campagne avancée plus exigeante. Ici les deux modes sont accessibles dès le départ, sans achat ni déblocage artificiel.

Les liens ont été consultés le 9 septembre 2026. La page distincte « Advanced Campaign » n’a pas été accessible ; les informations retenues sur la difficulté proviennent des pages Advance Wars et Campaign, sans prétendre avoir lu la page indisponible.

Validation de jouabilité : les deux quêtes ont été remportées en simulation à J10 et J12, et l’essai des drones à J10. Les huit scénarios difficiles ont parcouru trois journées avec 571 actions sans refus ; le siège difficile atteint J41 avec deux stratégies, 587 et 510 actions sans refus. Cela ne remplace pas le réglage de difficulté par des joueurs.

### Référence complémentaire et effets de combat — 9 septembre 2026

Réception technique de cette extension : 1 348 tests réussis, un test Postgres ignoré, compilation et vérifications TypeScript/lint réussies, sept parcours navigateur réussis (assets, biographies, difficulté et déblocage des quêtes). Aucun déploiement effectué.

La [fiche officielle de Tiny Metal 2](https://store.steampowered.com/app/3003430/TINY_METAL_2/?l=french), consultée ce jour, annonce le soutien entre alliés (ravitaillement, tirs coordonnés, revenus partagés) et des histoires secondaires de commandants. Le jeu est annoncé sans date de sortie : ces propositions inspirent la conception, sans constituer une validation de leur équilibre. Pour Atlas, le soutien logistique et les histoires de personnages sont les pistes prioritaires. Le partage des revenus et les tirs coordonnés restent des pistes, **pas des fonctionnalités livrées**.

Les effets de combat sont maintenant raccordés avant les GLB définitifs : projectiles, rafales, trajectoires courbes, traînées et impacts constituent une bibliothèque commune aux nations dans `src/render3d/effets.ts` (historique : `src/render3d/` est retiré depuis le 23 septembre 2026, les effets vivent dans `src/render2d/`). Les clips du modèle portent les mouvements mécaniques (recul, orientation, suspension, mise hors service). Les effets sont déclenchés par la présentation des événements du moteur et ne déterminent ni les dégâts ni le résultat d’un duel. L’atelier permet de rejouer les trois familles ; l’annulation et la réduction des animations ne laissent aucun effet résiduel.

Avant la production en série, un modèle représentatif par famille doit permettre d’affiner le point de départ, actuellement estimé à partir du volume. Ces repères devront respecter le contrat de nœuds exact existant, par des coordonnées locales associées à un nœud autorisé plutôt que par l’ajout improvisé de nœuds. Les autres modèles réutiliseront le même système avec leurs réglages. Les impacts restent sans gore ; une mise hors jeu conserve son affaissement et son extinction (le rendu 2D y ajoute depuis une explosion à fumée grise), jamais de sang ni de corps. La synchronisation de l’impact après le trajet est effective, y compris dans l’atelier.

Le soutien logistique entre camps alliés est également livré : un ravitailleur adjacent peut compléter les réserves d’une unité d’un autre camp de son équipe. Le menu propose cette action et l’IA peut la choisir. La propriété des unités et les caisses restent individuelles ; le ravitaillement d’un adversaire est refusé. Les tirs coordonnés et le partage des revenus restent des pistes distinctes.
