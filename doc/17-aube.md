# 17 — Aube : canon énergétique et campagne à produire

Décision du propriétaire, 9 septembre 2026. `BRIEF.md` reste supérieur ; `01-bible.md` possède le monde, `08-narration-choix.md` les conséquences, `content/personnages.json` les biographies structurées. Ce document rassemble le nouveau parcours et distingue sa cible de sa réalisation.

## Ce qui est fixé

Atlas organise une guerre stratégique fictive sous forme de tournois, avec des affrontements non sanglants. Les victoires attribuent temporairement des droits d’exploitation, de stockage et de distribution de l’énergie. Le socle des services essentiels est garanti par le Pacte ; la faction cherche à lever cette protection. Une concession ne donne aucun droit sur une population.

La Cinquième Manche veut concentrer le solaire, ses réserves et les interconnexions, puis contrôler **Aube**, programme de fusion fictif. **Sélène Veyr** dirige ce réseau ; Hadran Ost en est le visage et commande la Sélection Méridienne. Cette identité est stable dans le canon et révélée progressivement au joueur. La faction ne prend ni le Soleil ni un réacteur transformé en arme. On dispute des accès, une coordination et des contrats.

Aube est inspiré de la recherche sur la fusion, notamment ITER, mais ne représente pas ITER. Aucun personnage réel, incident réel ou complot réel ne lui est attribué. L’information scientifique vérifiée se présente séparément du récit. Gagner la finale ne rend pas soudain la fusion commerciale ou illimitée.

## Vingt-quatre nations, douze au premier plan, une faction supplémentaire

Les **24 nations sont conservées**. Douze occupent le premier plan de production ; les douze autres restent dans le monde et disponibles pour les autres rencontres. La faction adverse vient **en plus**, sans devenir une vingt-cinquième nation. Le roster comprend donc 24 délégations nationales et une faction apatride. Cela ne signifie pas 25 camps dans une partie : une rencontre comporte jusqu’à **quatre camps simultanés**, répartis en deux coalitions.

Plan de production proposé parmi les fiches déjà présentes : France (`fr`), Luxembourg (`lu`), Suisse (`ch`), Pays-Bas (`nl`), Maroc (`ma`), Sénégal (`sn`), Brésil (`br`), Mexique (`mx`), Inde (`in`), Japon (`jp`), Australie (`au`) et Indonésie (`id`). Ces douze donnent montagnes, polders, désert, bocage, littoral, réseau ferroviaire et archipels sans inventer de nation supplémentaire. Ce choix éditorial ne supprime ni ne renomme les autres pays. La priorité de production n’impose pas douze visites obligatoires.

La région apporte paysages, relief, météo, bâtiments et traits tactiques, avec les géométries partagées du catalogue. Elle n’exige pas une unité spéciale. Les kits partagent le squelette, la géométrie et les UV ; les textures externes sont communes entre LOD. Un poids croissant sans rôle tactique nouveau est un motif de refus de production.

## Trois actes, douze étapes cibles

Les quatre entraînements existants précèdent le parcours. Ils continuent d’enseigner déplacement/combat, économie, portée et QG. Les étapes ci-dessous sont un **plan de campagne**, pas douze scénarios déclarés prêts.

### Acte I — Les droits du vainqueur

1. **Premier courant**, 1v1 : comprendre les concessions après une victoire classique.
2. **Le bocage partagé**, 1v1 : choisir entre fonds immédiats et maintenance durable d’un dépôt.
3. **Le pacte du col**, 2v1 : coopérer avec Tomas sur deux fronts et partager les relevés.
4. **La finale des réserves**, 1v2 : deux adversaires déclarés, un même bénéficiaire de contrat ; offre du Consortium.

### Acte II — Qui possède le lendemain ?

5. **Les archives du contrat**, 1v1 : protéger des preuves sans remplacer la bataille par une collecte de cases.
6. **Trois fronts au soleil**, 1v3 : trois camps aux moyens bornés et fronts séparés ; comprendre les concessions croisées.
7. **La ligne de nuit**, 2v2 : préserver une voie commune avec une alliée choisie selon les engagements antérieurs.
8. **Le relevé manquant**, 1v1 : rejouer la disqualification justifiée d’Ost, recouper les signatures et découvrir la cible Aube.

### Acte III — La cinquième manche

9. **Quarante journées**, survie : tenir jusqu’à la fin de J40, voir le renfort annoncé à J41 ; contre-offensive éventuelle dans une mission suivante. Les étapes 10, 20 et 30 changent les fronts avec des vagues finies.
10. **Les routes d’Aube**, 3v1 : deux alliés et le joueur contre une défense concentrée ; routes issues des décisions antérieures.
11. **Le partage du réseau**, 2v2 : agir sur deux fronts dont la logistique reflète les concessions du premier acte.
12. **La dernière concession**, coalition : capture des QG nécessaires ou élimination totale selon le contrat annoncé ; préserver l’indépendance d’Aube avant l’épilogue.

Les quatre fins cibles sont **Le réseau partagé**, **La couronne électrique**, **La coalition sous tension** et **La relève**. Les choix expliquent les garanties obtenues et le partage des concessions. La résolution complète des fins reste à implémenter ; elle ne doit pas être annoncée comme jouable parce que ses titres existent.

## Ce qui existe dans ce chantier

Cinq scénarios d’essai sont présents dans `content/scenarios/`, distincts de la campagne principale et sans écriture de ses conséquences :

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

Les effets de combat sont maintenant raccordés avant les GLB définitifs : projectiles de simulation, rafales de marqueurs, trajectoires courbes, traînées et impacts constituent une bibliothèque commune aux nations dans `src/render3d/effets.ts`. Les clips du modèle portent les mouvements mécaniques (recul, orientation, suspension, mise hors service). Les effets sont déclenchés par la présentation des événements du moteur et ne déterminent ni les dégâts ni le résultat d’un duel. L’atelier permet de rejouer les trois familles ; l’annulation et la réduction des animations ne laissent aucun effet résiduel.

Avant la production en série, un modèle représentatif par famille doit permettre d’affiner le point de départ, actuellement estimé à partir du volume. Ces repères devront respecter le contrat de nœuds exact existant, par des coordonnées locales associées à un nœud autorisé plutôt que par l’ajout improvisé de nœuds. Les autres modèles réutiliseront le même système avec leurs réglages. Les impacts restent non sanglants ; une mise hors jeu conserve son affaissement et son extinction, sans explosion du véhicule. La synchronisation de l’impact après le trajet est effective, y compris dans l’atelier.

Le soutien logistique entre camps alliés est également livré : un ravitailleur adjacent peut compléter les réserves d’une unité d’un autre camp de son équipe. Le menu propose cette action et l’IA peut la choisir. La propriété des unités et les caisses restent individuelles ; le ravitaillement d’un adversaire est refusé. Les tirs coordonnés et le partage des revenus restent des pistes distinctes.
