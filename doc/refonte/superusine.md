# La Forge de la retenue — une superusine adverse (10 septembre 2026)

Demande du propriétaire : « des cartes où les ennemis ont une superusine, plutôt dans le dernier chapitre, qui produit chaque tour une unité robot combattant ; une mission vraiment complexe et dure, condition de victoire : l’élimination totale de l’armée ; genre en 2ᵉ mission du chapitre ; il faut rajouter du challenge ».

Ce document dit ce qui a été conçu (`content/scenarios/aube_superusine.json`, `content/cartes/carte_superusine.json`), pourquoi c’est dur, où se loge la mission dans l’opus, ce que le mode difficile change, ce que la simulation a mesuré, et ce qui n’a pas pu l’être. Le contrat moteur est celui de `Scenario.superusines` (`doc/04-gameplay.md` §7.7) ; le test est `tests/app/superusine.test.ts`.

## 1. Où elle vit

Le dernier chapitre est la **saison globale 6**, six finales (13 à 18). Sa deuxième mission est la **finale 14, « Le fils au premier rang »** (`doc/refonte/opus1-tutoriels-final.json`, `opus1_finale_14`, ordre global 168). Elle garde son identifiant, son ordre, son adversaire (Maël) et ses conditions : elle reçoit une note `superusine` qui renvoie au prototype, et la superusine y entrera comme une arme sans dossier de plus, posée sur l’un des deux aérodromes de Maël, le jour où la fiche deviendra jouable. Aucune fiche n’a été renumérotée.

Le prototype jouable est un **scénario d’essai**, `aube_superusine`, hors campagne (`acte: 0`, `statut: brouillon`, aucun flag), comme les cinq essais Aube. Il n’est cité par aucune épreuve de `content/campagne.json`, donc `estLibre` le refuse tant qu’il est brouillon : pour le voir sur `/jeu`, il faut l’ajouter à la liste explicite `essaisAube` de `src/app/jeu/parties-libres.ts` (fichier de l’ingénieur interface) ou le passer `en_ligne`. Il se joue dès maintenant à `/jeu/aube_superusine`.

## 2. La mission en cinq lignes

- **Carte** : `carte_superusine`, 20 × 16, biome montagne. Le joueur (Ariane) en bas à gauche ; les Gris (Basile Kelm, `factionsParCamp: { 1: 'atl' }`) en haut à droite. Une rivière coupe la carte du nord jusqu’à la douzième ligne ; les chenilles ne la passent qu’au pont du centre — ou par le sud, là où elle s’arrête.
- **La Forge** : une usine grise en (16, 5), `superusines: [{ x: 16, y: 5, camp: 1, type: 'meridien_automate', depuisJournee: 2, chaque: 1, max: 12 }]`. Dès la journée 2, **un automate par journée**, gratuit, `prete` le tour même (chenilles, mouvement 5, tir illimité, ne capture pas, 9 000 au catalogue 9, exclusif `atl`). Douze au plus.
- **Sa défense** : un radar gris en (15, 4), à deux cases — vision 5 sur le pont du centre, brouillage des drones —, un Bastion méridien posé en (16, 4), collé à la Forge, qui interdit l’hélico et le bombardier au-dessus d’elle. Plus une usine ordinaire (17, 2), le QG (18, 2), deux villes : Basile achète en plus de ce que la Forge lui donne.
- **L’économie du joueur** : QG, usine, aéroport, deux villes — 5 000 par journée, 10 000 au départ —, et quatre villes neutres à prendre (deux sur la route courte, deux sur la longue). Les Gris partent à 9 000 avec six bâtiments. Sans la Forge, ce serait un 1 contre 1 ordinaire ; avec elle, le camp gris reçoit chaque journée l’équivalent de son revenu en plus.
- **Victoire** : `hors_jeu_total` **seule**, pas de `capture_qg` (`doc/17`, « une mission exclusivement d’anéantissement n’ajoute pas une capture gagnante »). Défaite : QG perdu, plus aucune unité, limite de journées 32 (30 en difficile).

## 3. Les deux approches

**Le pont du centre, court et à découvert.** Du QG du joueur, la route monte en colonne 3, tourne à la sixième ligne, passe le pont (11, 6) et file droit sur la Forge, six cases plus loin. C’est aussi le chemin que prennent les automates : on s’y bat de front, sous le radar qui voit le pont à cinq cases, avec le Bastion qui ferme le ciel. C’est la route de qui a une artillerie, des roquettes et des chars moyens — l’automate encaisse 55 de l’artillerie, 70 des roquettes, 70 du char lourd, 35 seulement du char léger.

**Le col de l’est, long et boisé.** La route du sud (douzième ligne) contourne la rivière là où elle s’arrête, puis remonte la colonne 18 entre le bord de la carte et un massif (colonnes 15 à 17, lignes 8 à 10) que les chenilles ne franchissent pas. Deux villes neutres au passage, des forêts qui coûtent 2 aux chenilles et 1 aux fantassins, et la montagne (défense 4, +3 de vision à pied) d’où l’infanterie regarde la Forge sans qu’un automate puisse monter la chercher. C’est la route de qui veut **prendre** la Forge avec des fantassins et un méca, pendant que le pont retient les machines. Un méca (bottes) traverse aussi la rivière : c’est le troisième chemin, que personne n’annonce.

Les deux ne s’excluent pas, et c’est le sens de la mission : tenir le pont avec ce qui tire, prendre la Forge avec ce qui marche.

## 4. Pourquoi c’est dur, et ce que le difficile change

Trois raisons. La **cadence** : un automate par journée vaut 9 000 par journée, soit presque deux fois le revenu du joueur ; passé la dixième journée, la Forge a déjà rendu plus que tout ce que le joueur pourra acheter — la défaite le dit en toutes lettres. Le **verrou mécanique** : sous `hors_jeu_total`, un camp n’est éliminé que sans unité **et** sans producteur (`majEliminations`, `src/engine/regles/victoire.ts`) ; or le QG produit de l’infanterie, donc **prendre le QG de Basile reste nécessaire** — et sa perte élimine le camp, comme partout. La mission est donc « prendre la Forge pour arrêter le flux, puis remonter jusqu’au poste » ; « détruire tout ce qui roule » n’est jamais suffisant seul. Si le propriétaire veut une élimination qui ignore le QG, c’est un drapeau moteur à ajouter, pas un scénario à réécrire. Et le **Verrou** de Basile (super v4 « Réserves fermées » : −1 PV à toute l’armée adverse, vision −2), qui tombe sur une armée forcément groupée au pont.

`Scenario.modes` ne porte que les leviers de `ParametresMode` : fonds, revenus, brouillard, prévision, jauge, limite, stratégie, reprises. **La cadence et le plafond de la Forge n’y sont pas** — en difficile, `chaque` reste 1 et `max` reste 12 par construction du schéma, pas par choix. Ce que le difficile change : fonds gris 9 000 → **14 000**, revenu gris 1 000 → **1 500** par bâtiment, IA **agressive**, Bulletin à une journée au lieu de deux, jauge du joueur × 0,8, limite **30** au lieu de 32. Le brouillard est actif dans les deux modes. Un `max` plus haut en difficile demanderait d’étendre `ParametresMode` d’un champ `superusines` : à trancher avec l’ingénieur moteur.

## 5. Ce que la simulation a mesuré

IA pondérée des deux côtés, catalogue 9, `jouerPartie` puis rejeu action par action pour compter `production_automatique`. Rejeu conforme partout.

| Variante | Graine | Issue | Journée | Automates | Unités J/G à la fin | Pertes J/G |
|---|---|---|---|---|---|---|
| base (max 12, dès J2) | 1 | limite, Gris aux points | 33 | 12 | 24 / 23 | 19 / 54 |
| base | 2 | **élimination du joueur-IA** | 17 | 12 | 0 / 31 | 10 / 17 |
| base | 3 | limite, Gris aux points | 33 | 12 | 28 / 25 | 16 / 46 |
| base, joueur agressif | 1 | limite, Gris aux points | 33 | 12 | 19 / 34 | 21 / 49 |
| max 10 | 1 · 2 · 3 | limite · élimination J17 · limite | — | 10 | — | — |
| max 8 | 1 · 2 · 3 | élimination J18 · limite · limite | — | 8 | — | — |
| dès J4, max 10 | 1 | limite | 33 | 10 | 13 / 26 | — |
| une machine toutes les deux journées | 1 | limite | 33 | 12 | 10 / 42 | — |
| difficile (14 000, agressive) | 1 · 2 · 3 | limite, Gris aux points | 31 | 12 | 4 / 59 · 3 / 57 · 10 / 54 | — |
| **sans Forge** | 1 | limite, Gris aux points | 33 | 0 | **29 / 1** | — |

Trois lectures. **La Forge tient sa parole** : douze automates sur douze, à chaque graine, et elle n’est jamais prise — ni par le joueur-IA, ni par personne. **L’IA pondérée ne gagne pas cette mission**, et ce n’est pas la Forge qui l’en empêche : sans Forge, elle finit à 29 unités contre 1 et ne prend toujours pas le QG — c’est la limite connue de l’IA (« elle va aux points », `CLAUDE.md`, manque n° 6), pas celle de la carte. Réduire `max` ou retarder `depuisJournee` ne la rend donc pas gagnable par l’IA ; **les paramètres n’ont pas été réglés sur une graine**, et les issues avant la limite (graine 2 en base, graine 1 à max 8) sont des divergences de rejeu, pas un signal monotone. **Le difficile mord** : 4 à 10 unités restantes contre 54 à 59, sur les trois graines.

Le test garde la graine de référence `aube:superusine:1` (limite, douze automates, Forge grise, Gris devant) et la graine 2 comme témoin qu’une partie se décide avant la limite dans un sens (élimination à J17). « Dure » reste à mesurer **à la main** : rien ici ne dit si un joueur humain prend la Forge avant la dixième journée, ni par quelle route.

## 6. Les dialogues

Cinq répliques d’ouverture, quatre d’Ariane et une de Basile : la Forge en une phrase (« chaque journée, une machine de plus en sort »), les deux façons d’en finir et le poste qui tombe en dernier, les deux routes, un rappel de la station à impulsion du bocage et de la Grêle d’Ost vue aux essais qui amène le Verrou. Six scènes : Basile à la première production (`production` sur `meridien_automate`), Ariane à la journée 3 sur la fiche de l’automate — doublon volontaire, parce que `render/dialogues.ts` n’écoute que l’événement `production` et pas `production_automatique` : tant que le déclencheur n’est pas étendu, la scène de Basile ne se joue pas et celle d’Ariane porte l’information —, Basile à la première perte grise, les deux au Verrou (`pouvoir`, camp 1), les deux à la journée 10, Ariane à la première capture du joueur. Le gras (`**…**`, deux par réplique au plus) est rendu par l’interface.

## 7. Non fait, non vérifié

- **Rien n’a été joué à la main** : la lisibilité des deux routes, le temps qu’un humain met à prendre la Forge, la tenue du brouillard sur une carte de 20 × 16 avec un radar à 5.
- **`production` vs `production_automatique`** dans `render/dialogues.ts` : à étendre par l’ingénieur interface ; sinon la scène `forge_premiere_machine` ne se joue jamais.
- **La liste `essaisAube`** de `parties-libres.ts` ne connaît pas `aube_superusine` : le scénario n’apparaît pas sur `/jeu`.
- **L’élimination sans QG** : si le propriétaire veut qu’une armée entièrement détruite suffise alors que le QG produit encore, c’est une règle moteur (un drapeau de scénario, ou une exception quand `victoire` ne porte que `hors_jeu_total`).
- **Le difficile ne touche pas la Forge** : `chaque` et `max` sont hors de `ParametresMode`.
- Le nom « La Forge de la retenue » est un titre de travail ; le propriétaire a dit « La Forge, ou mieux ».
