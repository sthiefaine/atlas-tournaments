# 06 — Les 24 nations : relations, puis départs débloqués

*Document de contenu. Source de vérité au-dessus de lui : `BRIEF.md`. Ce document ne le contredit jamais ; tout ce qui n'est pas dans le brief est une **proposition**, signalée comme telle.*

---

## 1. Ce que ce document décide

**Tout le monde commence par la France** (`BRIEF.md`, « Le joueur et le départ », révisé le 5 septembre 2026 au soir). Le premier parcours part de France, avec son prologue écrit à la main et son tour des 18 régions, parce que c'est le seul contenu entièrement maîtrisé au lancement et que le budget de 80 h vaut pour **un** parcours. Il n'y a donc **pas d'écran de sélection parmi 24 au premier parcours**.

Les **24 fiches de ce document restent le canon**, mais leur rôle est double, et dans cet ordre :

1. **Pendant la partie, une fiche décrit une relation.** Chaque nation porte un état visible sur la carte du monde — `neutre`, `alliee`, `rivale`, `retiree` (`RelationNation`, `03-schemas.md` §15.3 bis) — qui évolue selon les choix du joueur. C'est la fiche qui dit **ce que valent** ces états pour cette nation-là : son commandant est celui qu'on recrute en co-commandant quand elle est alliée, son **unité spéciale** est celle qu'on peut produire (quantité bornée par match), sa **carte de terrain** est celle qu'elle prête, son **rival naturel** est celui qui revient avec un grief quand elle est rivale, et sa **destination** est celle qui s'éteint quand elle se retire. **Alliée, elle devient jouable** : le joueur peut l'**incarner** le temps d'un match (`Scenario.incarnation`, `03-schemas.md` §15.2 bis) — son général, son catalogue, sa spécialité, son style —, ce qui fait monter la **confiance** de ce général (0 à 3 ; à 3, co-commandant à jauge entière et départ de Nouvelle Ronde).
2. **Entre deux parties, une fiche redevient un départ.** Une nation devenue **alliée** se débloque comme pays de départ pour une **Nouvelle Ronde** (`Deblocage` de récompense `depart_nation`, `13-campagne.md` §3.5). C'est là — et seulement là — que le choix du pays de départ existe, parmi les nations débloquées.

Ce que la fiche fixe, pour l'un et l'autre usage :

- son **commandant** (archétype, pouvoir, super-pouvoir) : adversaire d'abord, co-commandant s'il est rallié, commandant d'origine s'il devient un départ ;
- son **style de jeu** (un bonus et un malus clairs, jamais deux lignes de texte flou) ;
- son **continent**, donc sa place dans les destinations proposées — et le continent de départ, le jour où elle devient un départ ;
- son **rival naturel**, qui revient plusieurs fois dans le voyage ;
- ses **flags narratifs** propres, contre lesquels la routine lore écrit, et **depuis lesquels sa relation est calculée** par le moteur ou le serveur, jamais par le rendu.

Ce document fournit les 24 fiches dans un **gabarit strictement identique**, pour que la routine lore et la routine map puissent les lire mécaniquement.

**Bornes anti-blocage, rappel du canon.** Au plus **cinq** nations retirées par partie ; **au moins deux alliées** avant l'acte III, garanties par la colonne vertébrale ; jamais de fin rendue inaccessible par un retrait — seulement une fin d'une autre couleur.

### Note de sensibilité (rappel du canon, non négociable)

Les pays sont réels ; **rien d'autre ne l'est**. On ne parle jamais de guerre réelle, de politique, de religion, de catastrophe, de dirigeant. Deux pays ne s'affrontent pas : ils **disputent un match**. Les unités sont **mises hors jeu**, jamais détruites ni tuées. Le registre autorisé est : géographie, climat, gastronomie, sport, folklore, artisanat, clichés **affectueux** — ceux qu'un habitant du pays trouverait drôles et justes. Les phénomènes naturels utilisés comme mécaniques (marée, mistral, alizé, coulée de lave, brume) sont traités en **météo de match**, jamais en drame : le volcan « s'allume pour le spectacle », l'alizé « se lève sur le terrain ».

---

## 2. Les 10 archétypes de commandant

Chaque pays reçoit un archétype pris dans cette liste fermée. L'archétype pilote l'IA du commandant adverse, le ton de ses dialogues et la famille de son pouvoir. **Le genre du nom d'archétype est celui du libellé, pas celui du commandant** : un pays « la fonceuse » peut avoir un commandant masculin, et l'inverse.

**Liste canon** (`BRIEF.md`, arbitrage n° 1 du 5 septembre 2026) : le stratège prudent, la fonceuse, le vétéran, l'ingénieur, la diplomate, le showman, la survivante, **la météorologue**, le prodige, la gardienne. « Le professeur » a été remplacé par « la météorologue », la météo étant devenue une mécanique du moteur. `01-bible.md` §6 est propriétaire de la liste et lui ajoute les colonnes de lore (tempérament, famille de pouvoir, courbe de puissance, contré par) ; ce document en donne l'emploi par pays.

Les **clés** de la colonne de gauche sont celles publiées par `01-bible.md` §6 et reprises telles quelles par le type `Archetype` de `03-schemas.md` §1 : c'est ce qui s'écrit dans `Country.archetypeCommandant`, jamais le libellé accentué.

| # | Clé | Archétype | Ce qu'il joue | Famille de pouvoir | Ton |
|---|---|---|---|---|---|
| 1 | `stratege_prudent` | **Le stratège prudent** | La position, l'économie, le tempo long | Vision, défense, revenu | Calme, poli, un peu sec |
| 2 | `fonceuse` | **La fonceuse** | Le tempo court, la première frappe | Mouvement, portée, initiative | Rieuse, impatiente |
| 3 | `veteran` | **Le vétéran** | Des unités peu nombreuses mais aguerries | Vétérance, précision, réparation | Bourru, généreux |
| 4 | `ingenieur` | **L'ingénieur** | Le terrain lui-même | Construction, terrain, ponts | Méthodique, enthousiaste |
| 5 | `diplomate` | **La diplomate** | La capture, l'économie, les alliés | Capture accélérée, revenu, ralliement | Chaleureuse, manœuvrière |
| 6 | `showman` | **Le showman** | Le moral, le public, les gros coups | Moral, dégâts en chaîne, effets voyants | Théâtral, généreux |
| 7 | `survivante` | **La survivante** | Le retard, le comeback | Soin, résistance, effets qui montent quand ça va mal | Sobre, tenace |
| 8 | `meteorologue` | **La météorologue** | Le ciel, la visibilité, le tempo des saisons | Météo, vision, révélation, prédiction | Attentive, taquine, économe de mots |
| 9 | `prodige` | **Le prodige** | La montée en puissance sur la durée | Gain d'expérience, déblocage progressif | Jeune, vif, un peu insolent |
| 10 | `gardienne` | **La gardienne** | Un point, une ligne, une zone | Zone de contrôle, fortification, riposte | Protectrice, immobile |

**Ce que le remplacement a déplacé.** Trois pays changent d'archétype, et trois seulement :

| Pays | Avant | Après | Pourquoi |
|---|---|---|---|
| **Islande** | La survivante | **La météorologue** | Hrefna regarde le ciel avant chaque décision et son pouvoir *est* la météo. C'est la fiche qui a fait naître l'archétype. |
| **Canada** | Le stratège prudent | **La météorologue** | « Le grand gel » est une saison, pas un plan : Émile joue l'hiver comme un climat qu'il connaît par cœur. |
| **Madagascar** | Le professeur | **La météorologue** | Voahangy lit une île à deux climats séparés par une arête ; son pouvoir est de la révélation et de la prédiction, la famille exacte de l'archétype. |
| **Argentine** | Le professeur | **Le stratège prudent** | Facundo explique, dessine et refuse les victoires mal jouées : c'est la position et le tempo long, pas le ciel. Il rend au stratège la place laissée par le Canada. |

**Namibie reste la survivante** : sa brume est un terrain, pas une prévision, et Tuli se définit par ce qu'elle économise et le temps qu'elle tient — la courbe du comeback. **Népal reste la survivante** pour la même raison.

---

## 3. Le choix des 24 nations

**Imposés par le brief :** France, Luxembourg, Japon, Brésil.

**Les 20 autres, proposés ici**, avec la raison d'équilibre de chacun en une phrase. La colonne se lit sur les deux registres à la fois : ce que la nation apporte **alliée** (son unité spéciale, sa carte de terrain, sa manière de jouer) et la leçon que serait son **départ** de Nouvelle Ronde. « Le départ X » ci-dessous désigne donc une Nouvelle Ronde, jamais le premier parcours — qui part toujours de France.

| Pays | Raison d'équilibre (une phrase) |
|---|---|
| Islande | Petite île volcanique isolée : le départ « une seule carte, aucun voisin », idéal pour apprendre à jouer sans pression de flanc. |
| Suisse | Le pays le plus vertical de la liste : la leçon de terrain haut et de retranchement, sans une seule case d'eau. |
| Pays-Bas | Le pays le plus plat et le seul qui modifie l'eau elle-même : la leçon de terrain mouvant. |
| Grèce | L'archipel de mer chaude morcelé en dizaines d'îlots : la leçon navale légère et de débarquement. |
| Mongolie | Steppe immense et enclavée : le départ 100 % terrestre et 100 % mobilité, à l'opposé de la Grèce. |
| Népal | Verticalité extrême sur un tout petit territoire : la carte la plus contrainte de la liste. |
| Indonésie | Archipel tropical énorme : la logistique maritime à grande échelle, contrepoint de la Grèce. |
| Inde | Sous-continent à saisons tranchées : le départ « masse et production », le plus gros volume d'unités. |
| Maroc | Montagne, dune et deux façades maritimes sur un seul territoire : la carte la plus variée d'Afrique. |
| Sénégal | Côte atlantique, fleuve et savane sèche : le départ collectif, où les unités jouent groupées. |
| Kenya | Hauts plateaux et grande vallée : l'endurance et la course à pied comme identité de jeu. |
| Namibie | Désert absolu et brume côtière : le seul terrain totalement découvert de la liste, plus une mécanique d'invisibilité. |
| Madagascar | Grande île à biomes multiples : un continent miniature, parfait pour un départ « connaissance du terrain ». |
| Argentine | Immense plaine ouverte plus une pointe australe glacée : la cavalerie de plaine et l'accès aux mers froides. |
| Pérou | Trois étages en une carte (côte sèche, altiplano, forêt) : la leçon de dénivelé et de routes à construire. |
| Mexique | Désert au nord, volcans au centre, forêt au sud : le pays du spectacle et des gros coups voyants. |
| Canada | Le plus grand territoire jouable, forêt boréale, lacs et hiver : la leçon de distance et de patience. |
| Australie | Continent-île au cœur vide : le seul départ où la distance elle-même est une défense. |
| Nouvelle-Zélande | Deux îles étroites, montagnes et brume : le départ défensif par excellence, aux antipodes de l'Islande. |
| Fidji | Micro-archipel de lagon : le plus petit budget, la plus grande liberté de mouvement sur l'eau. |

### Répartition

| Continent / zone | Pays | Total |
|---|---|---|
| Europe | France, Luxembourg, Islande, Suisse, Pays-Bas, Grèce | 6 |
| Asie | Japon, Mongolie, Népal, Indonésie, Inde | 5 |
| Afrique | Maroc, Sénégal, Kenya, Namibie, Madagascar | 5 |
| Amériques | Brésil, Argentine, Pérou, Mexique, Canada | 5 |
| Océanie | Australie, Nouvelle-Zélande, Fidji | 3 |

**Couverture des terrains** — îles (Islande, Japon, Madagascar, Nouvelle-Zélande), archipels (Grèce, Indonésie, Fidji), haute montagne (Suisse, Népal, Pérou), déserts (Namibie, Australie, Maroc), jungles (Brésil, Indonésie), steppes et plaines (Mongolie, Argentine), froid et forêt boréale (Canada, Islande), enclavés (Luxembourg, Suisse, Mongolie, Népal), plat et maritime (Pays-Bas), très grands (Canada, Brésil, Australie, Inde), très petits (Luxembourg, Fidji, Népal).

---

## 4. Gabarit d'une fiche pays

Toutes les fiches qui suivent utilisent exactement ces neuf champs, dans cet ordre :

**Continent** · **Climat et biomes** · **Terrain typique des cartes** · **Spécialité de jeu** (bonus / malus) · **Archétype** · **Commandant** (nom, 3 traits, pouvoir, super-pouvoir) · **Unité spéciale** (dessin propre) · **Rival naturel** (et pourquoi) · **Flags**.

Les arbitrages du 5 septembre 2026 y ajoutent trois lignes, à leur place fixe :

- **Hémisphère** (`nord` / `sud` / `equateur`), juste après le continent — c'est `Country.hemisphere`, qui décide de la saison quand on vient jouer chez ce pays à la date réelle.
- **Recevoir chez soi**, juste après le climat — une ou deux phrases sur ce que les quatre saisons font à ses cartes, plus un `cycleJourNuit` particulier quand le pays en mérite un (défaut 4 / 2).
- **Spécialité de repli (sans paquet naval)**, juste après la spécialité de jeu, et **uniquement pour les pays maritimes** : un bonus et un malus terrestres qui tiennent tant que la mer est infranchissable sauf ponts et plages. La spécialité maritime reste écrite : quand le paquet naval arrivera, elle **s'ajoutera** à celle de repli, elle ne la remplacera pas.

### Comment lire les chiffres des fiches

Depuis l'arbitrage n° 4, les pouvoirs et les super-pouvoirs sont écrits dans le **vocabulaire du schéma** (`EffetPouvoir`, `03-schemas.md` §2) :

- **Durée** : `ce_tour`, `tour_complet`, ou `journees n = 1 | 2 | 3`.
- **Multiplicateurs** (`attaque`, `defense`, `fonds`, `carburant`) : entre **0,5 et 2,0** ; **`capture` entre 0,5 et 3,0**, une valeur sous 1,0 ne pouvant viser que `unites_adverses` (`BRIEF.md`, seconde relecture, point 4 ; `04-gameplay.md` §7.2). Un ancien « +40 % de défense » s'écrit `defense ×1,4`, un « −10 % d'attaque » `attaque ×0,9`, un « l'adversaire capture deux fois plus lentement chez moi » `capture ×0,5` sur `unites_adverses`.
- **Additifs entiers** : `mouvement` (−3 à +4), `portee` (−2 à +3), `vision` (−2 à +5), `soin` (0 à +5 PV affichés), `degats_directs` (0 à 3, et jamais en dessous de 1 PV interne).
- **`poser_terrain`** : la seule famille nouvelle, et elle a **sept formes, pas une de plus** — `pont`, `telepherique`, `cable`, `chenal`, `polder`, `ponton`, `banc_de_sable` (`BRIEF.md`, seconde relecture, point 3 ; table `depuis → vers` dans `04-gameplay.md` §7.2, qui fait foi). **Source chaude, glace et roche neuve n'en font pas partie** : ce qui tient du climat est une **saison** (`rivieres_gelees`, `neige_plaines` — `04-gameplay.md` §12.2), ce qui tient du sol d'un pays est une **mécanique régionale** (§11). Les fiches ci-dessous ont été réécrites en conséquence : un commandant ne fait pas la météo.
- **Trois effets au maximum** par pouvoir, comme le schéma l'impose.
- **Spécialité de jeu** : ce n'est plus une phrase mais une donnée du type `Specialite` (`03-schemas.md` §1, propriétaire de la forme) — `cle` (`spec_<code pays>_<nom>`), `nom`, `portee: 'pays'`, `famille` (une des neuf `FamilleSpecialite`), `description`, et un `contenu` à **deux variants** (`BRIEF.md`, seconde relecture, point 1) : soit `modificateur` (1 à 2 `EffetModificateur` **permanents**, jamais un `poser_terrain`), soit `trait`, une valeur de la liste fermée **`TraitSpecialite`** — `franchissement_riviere`, `experience_rapide`, `ravitaillement_ville`, `vision_nuit`, `pied_marin`. Ce qu'aucun chiffre ne dit passe par un trait ; ce qui n'est ni l'un ni l'autre est réécrit, jamais inventé. Les fiches ci-dessous en donnent le **bonus et le malus en clair** ; la mise en forme JSON, clé et famille comprises, est produite à partir de cette ligne au moment d'écrire `content/`.
- **Plafonds** : le joueur **possède cinq spécialités au plus** et en **équipe une seule par match** (`BRIEF.md`, seconde relecture, point 2 ; `04-gameplay.md` §7.6). Celle de son pays de départ n'a pas de statut particulier : elle occupe un emplacement comme les autres.

Ce qui a disparu des fiches, parce que `04-gameplay.md` §7.2 l'interdit : **rejouer un tour**, **échanger des positions**, **produire gratuitement**. Chaque fois, l'effet a été remplacé par un effet autorisé **du même esprit** — une relance devient du mouvement, une production gratuite devient du revenu, un échange de positions devient une perte de mouvement chez l'adversaire.

Les flags suivent le format `pays.xx.nom`, où `xx` est le code ISO à deux lettres en minuscules et `nom` un identifiant en minuscules avec tirets bas — c'est la convention de `01-bible.md` §8.1, qui fait foi sur les noms, les types et les portées. **Les huit gabarits communs du §8.2 de la bible** (`visite`, `qualifie`, `rival_respecte`, `rival_humilie`, `allie_recrute`, `dette_envers_joueur`, `terrain_altere`, `ralliement_cinquieme`) existent pour les 24 pays et **s'ajoutent** aux flags propres listés ci-dessous ; on ne les répète pas dans chaque fiche.

Le nom du commandant donne son identifiant : **Camille Aubertin** → `Commander.code = cmd_camille_aubertin` → flags `cmd.camille_aubertin.*` (`03-schemas.md` §2).

---

## 5. Les 24 fiches

### 5.1 France 🇫🇷 *(pays phare)*

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Tempéré océanique à l'ouest, continental à l'est, méditerranéen au sud ; bocage, vignoble, forêt de plaine, haute montagne, littoral, plus cinq biomes d'outre-mer (tropical, équatorial, volcanique, lagon).
- **Recevoir chez soi** — Le pays qui change le plus de visage : l'hiver enneige les plaines de l'est et gèle les rivières (franchissables), l'automne dépouille les forêts et rend le bocage transparent, l'été met le sud en canicule pendant que l'ouest reste à la pluie. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Cartes moyennes très mixtes : un fleuve, un relief, une ville centrale et une côte. Aucun biome dominant, c'est le principe.
- **Spécialité de jeu** — **Bonus : la polyvalence.** Toutes les catégories d'unités sont disponibles dès la première journée (aucun déblocage) et les villes réparent `soin +1` par journée. **Malus : l'école coûte cher.** `fonds ×0,9` sur le revenu des villes, et aucune unité française ne reçoit de bonus de spécialité (pas de « meilleure unité »).
- **Archétype** — Le prodige.
- **Commandant** — **Camille Aubertin**, 19 ans, dit « le Bleuet ». *Traits :* curieux jusqu'à l'indiscrétion ; incapable de refuser un repas ; complexé par sa jeunesse et le cache mal. *Pouvoir — Tour de France* (`ce_tour`) *:* `mes_unites` — `mouvement +1` et `attaque ×1,0`, majoré de 0,02 par région déjà remportée dans la qualification nationale, **plafond `attaque ×1,2`**. *Super-pouvoir — Le drapeau à damier* (`tour_complet`) *:* `mes_unites` — `mouvement +3` ; filtre `surTerrain: ['ville']` — `soin +2`. La relance passe par les jambes, pas par un tour supplémentaire : rejouer un tour est interdit (`04-gameplay.md` §7.2).
- **Unité spéciale** — **La Roulante.** Camion-cantine à auvent rayé, dessin propre. Ne combat pas ; répare 3 PV par tour à deux unités adjacentes et supprime leur malus de terrain jusqu'à la fin du tour. Se capture au lieu d'être mise hors jeu (l'adversaire adore ça).
- **Rival naturel** — **Luxembourg.** Voisins de bassin, cinquante fois la taille d'écart, et Léa Wagener s'en amuse à chaque rencontre : « on est petits, mais on est en avance ». Aucune animosité, juste une taquinerie de famille et une envie féroce de gagner ce match précis.
- **Flags** — `pays.fr.regions_visitees`, `pays.fr.tour_complet`, `pays.fr.barrage_rompu`, `pays.fr.roulante_offerte`, `pays.fr.jeunesse_assumee`

---

### 5.2 Luxembourg 🇱🇺 *(pays phare)*

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Tempéré doux ; forêt de l'Œsling au nord, vallées encaissées, plateau du Gutland, vignoble de la Moselle.
- **Recevoir chez soi** — Un climat sans excès, ce qui est précisément l'intérêt de la carte : l'hiver pose un peu de neige au fond des gorges et gèle les ruisseaux, l'automne ouvre la vue sur les plateaux (les forêts perdent leur couvert), l'été ne fait rien de spécial. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — **Très petites cartes** (12×10) verticales : plateaux séparés par des gorges, ponts rares et décisifs, une seule ville importante.
- **Spécialité de jeu** — **Bonus : le carrefour.** Le trésor tourne vite : `fonds ×1,1` (au moteur, un revenu majoré plutôt qu'une remise sur les prix), et les capitaux capturés rapportent +1 par journée. **Malus : QG fragile.** Le QG luxembourgeois se capture à **10 points de capture au lieu de 20** (04 §6) et n'accorde aucun bonus de défense.
- **Archétype** — La diplomate.
- **Commandant** — **Léa Wagener**, 34 ans. *Traits :* passe d'une langue à l'autre en pleine phrase sans s'en apercevoir ; note tout dans un carnet à couverture d'acier ; ne s'énerve jamais, ce qui énerve tout le monde. *Pouvoir — Trois langues* (`ce_tour`) *:* `economie` — `fonds ×1,5` ; `mes_unites` — `capture ×2,0`. *Super-pouvoir — Place forte* (`journees n = 3`) *:* `mes_unites` avec filtre `rayon: { centre: 'commandant', cases: 2 }` — `defense ×1,6` ; `unites_adverses` dans le même rayon — **`capture ×0,5`** ; `economie` — `fonds ×1,5`. Le QG se défend très bien **et l'adversaire y capture deux fois plus lentement**, mais il ne devient jamais incapturable : c'est exactement ce que la borne de capture élargie à `[0,5 ; 3,0]` a rendu possible (`BRIEF.md`, seconde relecture, point 4 ; `04-gameplay.md` §7.2) — un ralentissement, pas un verrou, et il ne vaut que sous 1,0 contre `unites_adverses`. Le malus de QG fragile ci-dessus reste vrai le reste du temps : Place forte est un répit de trois journées, pas une correction. Les unités de ces trois journées se paient : produire gratuitement est interdit.
- **Unité spéciale** — **Le Bastion d'acier.** Bloc d'acier laminé sur chenilles, dessin propre. Se déploie une fois pour toutes et ne peut plus bouger ensuite ; tant qu'il est déployé, il donne `defense ×1,4` à l'occupant de sa case et des cases adjacentes. Ce n'est **pas** un `poser_terrain` — « forteresse » n'est pas une des sept formes (§4) : c'est une unité immobile qui modifie la défense autour d'elle, ce que le vocabulaire des modificateurs dit déjà. Un seul par partie.
- **Rival naturel** — **France.** Le grand voisin, la même vallée, la même cuisine à deux virgules près. Le Luxembourg n'a jamais gagné une finale contre la France : c'est tout le sujet de Léa, et elle en rit la première.
- **Flags** — `pays.lu.sponsor_accepte`, `pays.lu.archives_ouvertes`, `pays.lu.bastion_pose`, `pays.lu.carnet_dacier_lu`, `pays.lu.rire_du_petit`

---

### 5.3 Islande 🇮🇸

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Subpolaire océanique ; champs de lave, mousse, glaciers, sources chaudes, falaises à oiseaux, aucune forêt.
- **Recevoir chez soi** — Venir en Islande l'hiver, c'est venir jouer de nuit : les journées sont minuscules, `cycleJourNuit` **2 / 4**, la neige couvre la mousse et les rivières glaciaires gèlent, donc se franchissent partout. (`Country.climat` vaut ici **`oceanique`**, pas `polaire` : c'est un cycle jour/nuit déclaré par le scénario, et **non** l'effet `nuit_polaire` de `04-gameplay.md` §12.2, qui force `{ jour: 0, nuit: 6 }` et reste réservé au climat `polaire`.) L'été renverse tout — il fait jour presque en continu (`cycleJourNuit` 5 / 1 **[Proposition]**), les gués rouvrent, et la carte redevient une île de roche noire.
- **Terrain typique des cartes** — Une île unique en carte fermée, roche noire et neige, rivières glaciaires infranchissables sauf aux gués, sources chaudes disséminées.
- **Spécialité de jeu** — **Bonus : la roche et la vapeur.** Aucun malus de mouvement sur neige, glace et champ de lave ; toute unité terminant sa journée sur une source chaude gagne `soin +2`. **Malus : pas de lourd.** L'Islande ne peut produire aucun `char_lourd` (`04-gameplay.md` §3).
- **Archétype** — La météorologue.
- **Commandant** — **Hrefna Sigurðardóttir**, 41 ans. *Traits :* parle peu et regarde le ciel avant chaque décision ; refuse de jouer un coup qu'elle n'a pas vérifié deux fois ; connaît le prénom de chaque unité de son équipe. *Pouvoir — Météo d'Islande* (`tour_complet`) *:* `unites_adverses` — `vision −2` (plancher 1 case) ; la vision de Hrefna n'est pas touchée. *Super-pouvoir — Terre de feu* (`journees n = 2`) *:* `mes_unites` — `soin +4` et `defense ×1,2` ; `unites_adverses` — `mouvement −1` (la vapeur brouille les pistes). **Les sources chaudes ne se posent pas** : elles sont déjà sur la carte islandaise, portées par sa **mécanique régionale volcanique** (`04-gameplay.md` §11), et `poser_terrain` ne connaît que ses sept formes, dont ni la source chaude ni la glace ne font partie (`BRIEF.md`, seconde relecture, point 3). Terre de feu **réveille** celles qui sont là, elle n'en invente pas : c'est la même image, et c'est une règle de moins.
- **Unité spéciale** — **Le Super-Jeep.** 4×4 surélevé à pneus démesurés, dessin propre. Franchit les rivières glaciaires et les champs de lave à coût 1, transporte une unité d'infanterie, et voit à 4 cases.
- **Rival naturel** — **Canada.** Deux pays d'hiver qui se disputent depuis toujours le titre de « meilleure équipe du froid », avec un débat sans fin sur la question de savoir si la neige compte comme un terrain ou comme une excuse.
- **Flags** — `pays.is.source_chaude_partagee`, `pays.is.brouillard_leve`, `pays.is.silence_de_hrefna`

---

### 5.4 Suisse 🇨🇭

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Alpin et continental ; hauts sommets, alpages, lacs profonds, forêts de conifères, cols.
- **Recevoir chez soi** — L'hiver ferme la moitié du pays : neige sur les alpages (+1 de coût pour tout sauf pied et chenilles), lacs gelés donc franchissables, et les cols les plus hauts deviennent des goulets. L'été rouvre les cols et rend les trois vallées réellement connectées — la même carte s'y joue deux fois plus vite. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Verticalité extrême : trois vallées séparées par du relief infranchissable, reliées par des cols et des câbles. **Aucune case de mer.**
- **Spécialité de jeu** — **Bonus : le retranchement.** `defense ×1,4` sur relief (au lieu de ×1,2), et une unité qui ne bouge pas gagne `defense ×1,1` cumulable, **plafond ×1,3**. **Malus : pays fermé.** Aucune unité navale disponible, et la production est limitée à **une unité par journée**, tous bâtiments confondus.
- **Archétype** — La gardienne.
- **Commandant** — **Gaudenz Brunner**, 52 ans. *Traits :* d'une ponctualité qui frôle l'impolitesse ; possède un couteau à douze fonctions dont il se sert pour tout sauf couper ; hospitalier au point d'inviter ses adversaires à dîner avant la finale. *Pouvoir — L'heure exacte* (`tour_complet`) *:* `mes_unites` avec filtre `surTerrain: ['montagne', 'foret']` — `defense ×1,5` et `attaque ×1,2` (la riposte mord, elle ne devance pas l'attaque : `surAttaque` modifie des dégâts, pas un ordre de résolution). *Super-pouvoir — Le réduit* (`journees n = 2`) *:* `unites_adverses` avec filtre `surTerrain: ['montagne']` — `mouvement −3` (les cols ne se ferment pas, ils deviennent impraticables en une journée) ; `mes_unites` sur relief — `soin +3`.
- **Unité spéciale** — **Le Téléphérique.** Cabine rouge et câble, dessin propre. Se construit entre deux cases de relief distantes de 6 cases maximum ; transporte ensuite une unité par tour de l'une à l'autre, instantanément. Le câble reste sur la carte après la partie (trace de passage).
- **Rival naturel** — **Pays-Bas.** Le pays le plus vertical contre le pays le plus plat : un match qui se joue toujours sur la question « qui impose son relief à l'autre », et une amitié réelle entre Gaudenz et Wieke, qui échangent des fromages avant chaque rencontre.
- **Flags** — `pays.ch.col_scelle`, `pays.ch.diner_avant_finale`, `pays.ch.cable_tendu`

---

### 5.5 Pays-Bas 🇳🇱

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Tempéré océanique ; polders, canaux, dunes, champs de fleurs, estuaires.
- **Recevoir chez soi** — La pluie est ici la météo par défaut, et sur un pays plat elle se voit surtout au coût de mouvement des roues hors route. L'hiver gèle les canaux, ce qui les rend franchissables et retire à Wieke la moitié de son avantage — c'est la seule saison où le pays le plus plat devient un pays ordinaire. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Plat intégral, quadrillé de canaux et de digues ; une partie de la carte est **sous le niveau de l'eau** et peut basculer.
- **Spécialité de jeu** — **Bonus : la maîtrise de l'eau.** `mes_unites` — `mouvement +1` pour les unités terrestres en plaine, et `defense ×1,1` sur `polder`. Une spécialité **ne pose jamais de terrain** (`03-schemas.md` §1) : le basculement terre ↔ eau reste ce qu'il a toujours été chez Wieke, un **pouvoir** (`poser_terrain`, forme `polder`) et la **mécanique régionale d'inondation** de la carte (`04-gameplay.md` §11.4). **Malus : sous le niveau.** Si une digue adjacente à un polder est mise hors jeu, le polder s'inonde à la journée suivante : les unités qui s'y trouvent subissent `degats_directs 2` et sont repoussées d'une case.
- **Archétype** — L'ingénieur.
- **Commandant** — **Wieke van Dijk**, 29 ans. *Traits :* fait tout à vélo, y compris arriver sur le terrain ; dit exactement ce qu'elle pense, deux secondes trop tôt ; range ses unités par couleur avant de jouer. *Pouvoir — Ouvre les vannes* (`ce_tour`) *:* `terrain` — `poser_terrain`, trois cases basculent (terre ↔ eau) immédiatement. *Super-pouvoir — La grande marée* (`journees n = 2`) *:* `terrain` — `poser_terrain`, une bande entière de la carte passe sous l'eau ; `unites_adverses` dans la bande — `degats_directs 3` puis `mouvement −2`. Les unités néerlandaises n'y perdent rien.
- **Unité spéciale** — **Le Moulin-pompe.** Moulin blanc et bleu monté sur remorque, dessin propre. Statique une fois posé ; assèche ou inonde toutes les cases d'eau peu profonde dans un rayon de 2, au choix, une fois par tour.
- **Rival naturel** — **Suisse.** Voir plus haut : le plus plat contre le plus vertical. Wieke prétend chaque année qu'elle finira par aplanir les Alpes ; Gaudenz répond qu'il finira par assécher la mer du Nord.
- **Flags** — `pays.nl.digue_ouverte`, `pays.nl.velo_sur_le_terrain`, `pays.nl.pari_avec_gaudenz`

---

### 5.6 Grèce 🇬🇷

- **Continent** — Europe.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Méditerranéen ; garrigue, oliveraies, calanques, montagnes sèches, des centaines d'îlots.
- **Recevoir chez soi** — L'été grec, c'est la canicule : les unités lourdes perdent un point de mouvement hors route et les îlots sans ombre deviennent difficiles à tenir longtemps. L'hiver amène la pluie et les coups de vent, jamais la neige sauf sur les montagnes sèches du nord. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Ratio terre/mer autour de 40/60 : beaucoup de petites îles, des détroits étroits, des ports partout.
- **Spécialité de jeu** — **Bonus : la manœuvre navale.** Tous les navires ont `mouvement +1`, et un transport peut embarquer **et** débarquer dans la même journée. **Malus : îles morcelées.** Les unités blindées ont `mouvement −1` et ne peuvent pas être produites hors d'une ville portuaire.
- **Spécialité de repli (sans paquet naval)** — **Bonus : le cabotage à pied.** Les îlots sont reliés par des môles et des passerelles de bois ; toute unité qui commence sa journée sur une case de plage, de port ou de pont gagne `mouvement +1`, et le ratio de la carte est ramené provisoirement à **65/35**. **Malus : les blindés restent au port.** `mouvement −1` pour les blindés, qui ne se produisent que dans les deux villes portuaires. *Quand le paquet naval arrivera, la manœuvre navale **s'ajoutera** : le cabotage ne disparaît pas, il devient le jeu de l'infanterie pendant que les navires prennent le large.*
- **Archétype** — Le vétéran.
- **Commandant** — **Stavros Kalogeris**, 58 ans. *Traits :* raconte la même anecdote de finale depuis trente ans, avec une fin différente à chaque fois ; ne joue jamais avant d'avoir bu son café ; adopte tous les chats du port de la carte. *Pouvoir — Le vieux port* (`ce_tour`) *:* `mes_unites` avec filtre `surTerrain: ['plage', 'ville', 'pont']` (les navires quand ils existeront) — `soin +3` et `attaque ×1,2`. *Super-pouvoir — L'archipel entier* (`journees n = 2`) *:* `terrain` — `poser_terrain`, forme **`ponton`** (`mer`/`riviere` → `pont`), quatre cases qui relient les îles voisines le temps de deux journées — jamais `permanent`, un ponton se démonte ; `mes_unites` — `mouvement +2`.
- **Unité spéciale** — **Le Caïque rapide.** Barque en bois peinte, dessin propre. Transporte deux unités d'infanterie, se déplace de 7, et **accoste sur n'importe quelle case de côte**, sans avoir besoin de port ni de plage.
- **Rival naturel** — **Japon.** Deux archipels, deux gastronomies bâties sur la mer, deux écoles opposées : Stavros joue lentement et laisse venir, Mizuki joue au chronomètre. Ils s'invitent mutuellement à dîner et se plaignent l'un de l'autre avec beaucoup d'affection.
- **Flags** — `pays.gr.cafe_avant_match`, `pays.gr.chat_du_port_adopte`, `pays.gr.anecdote_corrigee`

---

### 5.7 Japon 🇯🇵 *(pays phare)*

- **Continent** — Asie.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Tempéré à subtropical ; montagnes boisées, rizières en terrasses, côtes découpées, villes denses, îles volcaniques.
- **Recevoir chez soi** — L'été japonais est humide et orageux : pluie fréquente, et les tempêtes de fin d'été clouent les unités aériennes au sol — le rail devient alors le seul réseau qui tienne, ce qui est exactement la leçon de la carte. L'hiver enneige le nord et la montagne centrale ; le printemps ne change rien au jeu mais tout au décor. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Archipel étiré, 55/45 terre/mer, montagne centrale infranchissable, tout se joue sur les plaines côtières reliées par le rail.
- **Spécialité de jeu** — **Bonus : le réseau.** Une unité par journée peut se **téléporter d'une gare amie à une autre**, quelle que soit la distance. **Malus : la place est chère.** `fonds ×0,9` (les unités reviennent plus cher), et aucune unité ne peut être produite ailleurs que dans une ville reliée au rail.
- **Spécialité de repli (sans paquet naval)** — **Bonus : les ponts de rail.** Les îles de l'archipel sont reliées par **trois ponts ferroviaires** ; la téléportation de gare à gare fonctionne d'une île à l'autre sans rien changer, et une unité qui termine sa journée sur un pont ne subit aucun malus de terrain. **Malus : la voie est unique.** Un pont mis hors service coupe l'île : aucune unité ne contourne par la mer, et celle qui devait l'emprunter perd tout son mouvement restant. Ratio ramené provisoirement à **75/25**. *Le réseau n'attend pas les navires — c'est ce qui fait du Japon le pays maritime le moins pénalisé par le report du paquet naval.*
- **Archétype** — Le stratège prudent.
- **Commandant** — **Mizuki Hazama**, 31 ans. *Traits :* règle sa montre à la seconde et s'excuse quand elle a huit secondes d'avance ; garde un carnet d'horaires plutôt qu'un carnet de stratégie ; offre un bento à chaque adversaire, y compris quand elle gagne.
  *Pouvoir — Horaire* (`ce_tour`) *:* `mes_unites` — `mouvement +1` ; deux unités supplémentaires peuvent emprunter le rail cette journée. *Super-pouvoir — Ligne à grande vitesse* (`journees n = 2`) *:* `mes_unites` — `mouvement +2` et `attaque ×1,2` ; le rail se prend sans limite de nombre pendant ces deux journées.
- **Unité spéciale** — **Le Shinkansen.** Rame blanche à nez long, dessin propre (imposé par le brief). Circule uniquement sur les cases de rail, à 12 de mouvement, transporte 3 unités, ne combat pas. Si la voie est coupée, il s'arrête net.
- **Rival naturel** — **Grèce.** Voir plus haut. Mizuki considère Stavros comme le seul commandant capable de la faire jouer en retard, ce qu'elle vit comme un défi personnel.
- **Flags** — `pays.jp.train_prete`, `pays.jp.duel_honore`, `pays.jp.horaire_tenu`, `pays.jp.bento_offert`, `pays.jp.voie_coupee`

---

### 5.8 Mongolie 🇲🇳

- **Continent** — Asie.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Continental extrême ; steppe herbeuse, désert de Gobi au sud, montagnes de l'Altaï à l'ouest, hivers rudes.
- **Recevoir chez soi** — Le climat le plus tranché de la liste. L'hiver couvre toute la steppe de neige et gèle les rivières : la carte devient un billard blanc où la cavalerie de Naran, qui ignore le coût de la neige, ne trouve plus rien pour la ralentir. L'été apporte la canicule sur le Gobi et pénalise les unités lourdes hors route. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — **Très grandes cartes ouvertes** (24×18), presque sans obstacle, quelques rivières, quelques campements. Aucune case d'eau navigable.
- **Spécialité de jeu** — **Bonus : la steppe.** Toutes les unités montées et les véhicules légers gagnent `mouvement +2` et ignorent le coût de la steppe et de la neige. **Malus : aucune unité navale**, et aucune unité ne peut embarquer sur un transport allié.
- **Archétype** — La fonceuse.
- **Commandant** — **Naran Batbayar**, 26 ans. *Traits :* incapable de rester assise plus de dix minutes ; juge un adversaire à la façon dont il monte à cheval ; a horreur des cartes petites et le dit fort. *Pouvoir — L'horizon* (`ce_tour`) *:* `mes_unites` — `mouvement +2` ; elles peuvent attaquer après s'être déplacées au maximum. *Super-pouvoir — Le grand galop* (`ce_tour`) *:* `mes_unites` — `mouvement +4` (le maximum du schéma) et `attaque ×1,3` pour toute unité ayant parcouru au moins 6 cases. On galope plus loin, on ne joue pas deux fois : un tour supplémentaire est interdit.
- **Unité spéciale** — **Le Cavalier de l'horizon.** Cavalier en deel à revers orange, arc à l'épaule, dessin propre. Mouvement 9, ne subit aucun coût de terrain en steppe, et **ne peut pas être ciblé** par une unité qui n'a pas bougé de son tour (il est trop loin quand elle vise).
- **Rival naturel** — **Namibie.** Les deux plus grands vides de la liste : la steppe et le désert. Naran soutient qu'un espace vide est fait pour être traversé le plus vite possible ; Tuli répond qu'il est fait pour y disparaître. Le match est toujours magnifique et personne ne se voit venir.
- **Flags** — `pays.mn.grand_galop_lance`, `pays.mn.carte_jugee_trop_petite`, `pays.mn.respect_du_cavalier`

---

### 5.9 Népal 🇳🇵

- **Continent** — Asie.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Du subtropical au glaciaire en 150 km ; terrasses, forêts de rhododendrons, vallées suspendues, cols, glaciers.
- **Recevoir chez soi** — La saison compte plus ici qu'ailleurs, parce qu'elle décide de l'étage jouable : l'hiver ferme les cols les plus hauts sous la neige et rabat toute la partie sur les deux étages du bas ; l'été (mousson) apporte la pluie et le brouillard dans les vallées suspendues, où la vision tombe à une case. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Petites cartes (14×14) à **fort dénivelé** : trois étages d'altitude, ponts suspendus rares, cases de haute montagne infranchissables sauf par l'infanterie.
- **Spécialité de jeu** — **Bonus : l'altitude.** L'infanterie ne subit aucun malus de pente, gagne `mouvement +1` en montagne et `vision +2` depuis un point haut. **Malus : rien de lourd ne monte.** Le Népal ne dispose **ni de `char_leger`, ni de `char_lourd`, ni d'unités navales**.
- **Archétype** — La survivante.
- **Commandant** — **Pemba Gurung**, 44 ans. *Traits :* marche toujours du même pas, quel que soit le terrain ; connaît le poids exact de tout ce qu'il porte ; sourit d'autant plus qu'il est en difficulté. *Pouvoir — Le pas régulier* (`tour_complet`) *:* `mes_unites` — `soin +2` et `mouvement +2` (le pas ne change pas, quel que soit le terrain). *Super-pouvoir — Le col ouvert* (`journees n = 2`) *:* `terrain` — `poser_terrain`, trois ponts suspendus n'importe où sur la carte ; `mes_unites` avec filtre `surTerrain: ['montagne']` — `mouvement +3`.
- **Unité spéciale** — **Le Poseur de ponts.** Équipe de trois porteurs avec touret de câble, dessin propre. Pose un pont suspendu permanent entre deux cases distantes de 4 maximum, une fois tous les deux tours. Les ponts restent après la partie.
- **Rival naturel** — **Pérou.** Les deux pays d'altitude de la liste, chacun persuadé que son col est le vrai col. Nayra Quispe et Pemba Gurung comparent des mesures d'altitude depuis des années et n'ont jamais réussi à se mettre d'accord sur la méthode.
- **Flags** — `pays.np.pont_pose`, `pays.np.mesure_contestee`, `pays.np.sourire_en_difficulte`

---

### 5.10 Indonésie 🇮🇩

- **Continent** — Asie.
- **Hémisphère** — `equateur`.
- **Climat et biomes** — Équatorial ; forêt dense, volcans, rizières en terrasses, mangroves, récifs, des milliers d'îles.
- **Recevoir chez soi** — À cheval sur l'équateur, l'Indonésie n'a pas quatre saisons mais deux régimes : la saison des pluies (l'« été » du moteur, décembre à mars) noie la carte — pluie quasi permanente, tempêtes qui clouent les aériennes — et la saison sèche rend la forêt praticable. Le jour et la nuit y sont d'égale longueur toute l'année : `cycleJourNuit` **3 / 3** **[Proposition]**.
- **Terrain typique des cartes** — Très grandes cartes maritimes (22×18), ratio terre/mer 35/65, des dizaines d'îles de toutes tailles, détroits et volcans.
- **Spécialité de jeu** — **Bonus : la logistique des îles.** Les transports maritimes reviennent moitié moins cher (`fonds ×1,5` sur leur ligne de production) et l'embarquement ne consomme aucun point de mouvement. **Malus : îles étroites.** Toutes les unités terrestres ont `mouvement −1` sur terre.
- **Spécialité de repli (sans paquet naval)** — **Bonus : gotong royong.** Sans transports, on se passe les charges de main en main : toute unité adjacente à **au moins deux** unités amies gagne `mouvement +1`, ce qui annule le malus d'îles étroites tant qu'on joue groupé. Le ratio est ramené provisoirement à **60/40**, les grandes îles étant reliées par des détroits à gué et deux ponts. **Malus : rien ne passe seul.** Une unité sans aucune unité amie adjacente garde son `mouvement −1`, et l'Indonésie ne produit pas de `char_lourd` faute de barge pour le débarquer. *Quand le paquet naval arrivera, la logistique des îles **s'ajoutera** et rendra à Ayu son vrai jeu : le gotong royong restera son plan B, et un bon.*
- **Archétype** — La diplomate.
- **Commandant** — **Ayu Prasetyo**, 37 ans. *Traits :* retient le nom de tout le monde, y compris les remplaçants adverses ; ne décide jamais seule et le revendique ; garde un jeu d'ombres portatif pour expliquer ses plans. *Pouvoir — Gotong royong* (`tour_complet`) *:* `mes_unites` adjacentes à une unité amie — `defense ×1,2` ; `mes_unites` — `capture ×2,0`. *Super-pouvoir — Mille îles* (`journees n = 2`) *:* `mes_unites` — `soin +3` et `mouvement +2` ; `economie` — `fonds ×1,5`. Chaque île contrôlée envoie du monde et de l'argent, mais rien n'est gratuit : la production offerte est interdite.
- **Unité spéciale** — **Le Ferry archipel.** Grand ferry à deux ponts, coque colorée, dessin propre. Transporte **4 unités** de n'importe quel type, se déplace de 6, et débarque sur toute case de côte. Pas d'armement.
- **Rival naturel** — **Madagascar.** Cousins de l'océan Indien, mêmes pirogues à balancier, mêmes racines linguistiques et un débat éternel sur qui a inventé quoi. Ayu et Voahangy jouent leur match en s'échangeant des recettes entre les tours.
- **Flags** — `pays.id.ile_ralliee`, `pays.id.recette_echangee`, `pays.id.plan_en_ombres`

---

### 5.11 Inde 🇮🇳

- **Continent** — Asie.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Mousson, aride au nord-ouest, tropical au sud ; plaines fluviales, plateau sec, ghats boisés, désert de sable, haute montagne au nord.
- **Recevoir chez soi** — Le pays aux saisons les plus lisibles du jeu : l'été, c'est la mousson — pluie constante, roues embourbées hors route, vision réduite — et un printemps de canicule sèche juste avant, où les unités lourdes traînent. L'hiver est la belle saison, celle où les grandes plaines se jouent à pleine vitesse. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Grandes cartes terrestres (22×16), plaines larges coupées de fleuves, beaucoup de villes, saison humide qui ralentit certains secteurs.
- **Spécialité de jeu** — **Bonus : le volume.** Le QG peut produire **deux unités par journée** au lieu d'une. **Malus : à peine entraînées.** Toute unité produite lors d'une journée à double production garde `attaque ×0,9` de façon permanente.
- **Archétype** — Le showman.
- **Commandant** — **Rohan Deshmukh**, 33 ans. *Traits :* commente ses propres coups au micro ; change de tenue entre chaque acte du tournoi ; parfaitement incapable de faire un geste discret. *Pouvoir — Plein stade* (`ce_tour`) *:* `mes_unites` — `attaque ×1,15` et `soin +1` à chaque unité adverse mise hors jeu cette journée. *Super-pouvoir — Le grand numéro* (`journees n = 2`) *:* `mes_unites` — `mouvement +1` et `attaque ×1,3` ; `economie` — `fonds ×2,0`. Le public paie la tournée : l'Inde s'offre son volume au lieu de le recevoir gratuitement (production gratuite interdite).
- **Unité spéciale** — **Le Camion peint.** Camion couvert de motifs, guirlandes et miroirs, dessin propre. Transporte 2 unités, se déplace de 7 sur route, et donne **+1 mouvement** aux unités qu'il débarque, le tour de leur débarquement.
- **Rival naturel** — **Australie.** Le match le plus attendu du calendrier, une affaire de gradins pleins et de finales serrées depuis des décennies. Rohan et Marlee se charrient dans la presse toute l'année, puis s'assoient ensemble en tribune dès qu'ils sont éliminés.
- **Flags** — `pays.in.public_conquis`, `pays.in.tenue_changee`, `pays.in.charriage_avec_marlee`

---

### 5.12 Maroc 🇲🇦

- **Continent** — Afrique.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Méditerranéen au nord, montagnard dans l'Atlas, aride au sud ; cédraies, vallées d'oasis, plateaux caillouteux, grandes dunes, deux façades maritimes.
- **Recevoir chez soi** — Trois bandes, trois météos le même jour : l'été met le sud en canicule (unités lourdes ralenties hors route) pendant que la côte reste respirable ; l'hiver enneige l'Atlas, ce qui déclenche le malus marocain sur ses propres cartes — la seule saison où recevoir chez soi coûte quelque chose à Idir. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Cartes mixtes (18×14) en trois bandes : côte, montagne, désert. Oasis et médinas comme points de capture.
- **Spécialité de jeu** — **Bonus : la caravane.** Aucune pénalité de mouvement sur sable et dunes, et `vision +1` en terrain découvert, même en tempête de sable. **Malus : mal au froid.** Toute unité marocaine subit `degats_directs 1` par journée passée sur un biome froid (neige, glace, haute montagne enneigée).
- **Archétype** — Le vétéran.
- **Commandant** — **Idir Benhaddou**, 55 ans. *Traits :* ne se déplace jamais sans son service à thé ; considère qu'un match qui dure moins de trois heures n'a pas été joué ; se souvient du terrain mieux que de son propre planning. *Pouvoir — Le thé se verse trois fois* (`ce_tour`) *:* `mes_unites` — `attaque ×1,3` ; les unités qui n'ont pas bougé — `soin +2`. *Super-pouvoir — Vent de sable* (`journees n = 2`) *:* `unites_adverses` — `vision −2` (plancher 1 case) et `mouvement −1` sur la moitié de la carte choisie ; `mes_unites` — `vision +1`, la tempête ne les gêne pas.
- **Unité spéciale** — **Le Caravanier.** Convoi bâché aux tapis rouges et bleus, dessin propre. Ravitaille (+2 PV, munitions pleines) toutes les unités dans un rayon de 2 à la fin de son tour, et traverse le désert à coût 1.
- **Rival naturel** — **Mexique.** Deux pays de soleil, d'épices et de fêtes de rue, qui se disputent depuis toujours le titre officieux de « meilleure cuisine du tournoi ». Le match est bruyant, les tribunes chantent, et Idir et Xóchitl échangent des recettes qu'ils falsifient volontairement.
- **Flags** — `pays.ma.oasis_preservee`, `pays.ma.the_verse_trois_fois`, `pays.ma.recette_falsifiee`, `pays.ma.tempete_declenchee`

---

### 5.13 Sénégal 🇸🇳

- **Continent** — Afrique.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Sahélien au nord, soudanien au sud ; savane à baobabs, delta de fleuve, mangroves, longue plage atlantique, lagunes.
- **Recevoir chez soi** — Deux saisons franches sous une étiquette de quatre : l'été est l'hivernage — pluie lourde, delta gonflé, gués fermés, roues en peine hors route — et le reste de l'année est sec, avec des poussées de canicule au printemps sur la savane du nord. La carte se joue donc large et rapide six mois, et étroite et boueuse le reste. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Cartes moyennes (18×14) avec un grand fleuve traversant, un delta au ratio terre/mer 70/30, savane ouverte parsemée de baobabs (couvert isolé).
- **Spécialité de jeu** — **Bonus : on avance ensemble.** Toute unité qui commence sa journée adjacente à au moins une unité amie gagne `mouvement +1`. **Malus : personne ne joue seul.** Toute unité sans aucune unité amie à 2 cases passe à `attaque ×0,9` et `defense ×0,9`.
- **Spécialité de repli (sans paquet naval)** — **Bonus : les trois gués.** Sans pirogue, le delta se franchit à trois gués balisés : une unité qui traverse un gué **en groupe** (au moins une unité amie adjacente) garde son `mouvement +1` au lieu de le perdre à l'eau, et le ratio passe provisoirement à **85/15**. **Malus : le fleuve trie.** Une unité qui se présente **seule** à un gué y consomme tout son mouvement restant. *La Pirogue de mer reste écrite : avec le paquet naval, elle rouvre le fleuve sur toute sa longueur et rend les gués facultatifs.*
- **Archétype** — La fonceuse.
- **Commandant** — **Aïssatou Ndiaye**, 28 ans. *Traits :* accueille ses adversaires comme des invités et les bat trente minutes plus tard ; ne supporte pas qu'une de ses unités reste isolée ; danse avant chaque match, sans exception. *Pouvoir — Teranga* (`ce_tour`) *:* `mes_unites` groupées (au moins deux voisines) — `attaque ×1,25`. *Super-pouvoir — Le tambour* (`journees n = 2`) *:* `mes_unites` groupées — `attaque ×1,4` et `mouvement +1` (on se rassemble en marchant, personne n'est téléporté) ; `unites_adverses` isolées — `mouvement −1`.
- **Unité spéciale** — **La Pirogue de mer.** Longue pirogue peinte à motifs, moteur à l'arrière, dessin propre. Mouvement 8, remonte les fleuves **et** navigue en mer, accoste sur toute plage, transporte 2 unités d'infanterie.
- **Rival naturel** — **Kenya.** Deux écoles africaines du sport que tout oppose : l'explosion et le collectif contre l'endurance et la ligne droite. Aïssatou et Amani ont fait un pari sur un match de trois heures ; personne ne sait plus qui l'a gagné.
- **Flags** — `pays.sn.invitation_acceptee`, `pays.sn.tambour_lance`, `pays.sn.pari_avec_amani`

---

### 5.14 Kenya 🇰🇪

- **Continent** — Afrique.
- **Hémisphère** — `equateur`.
- **Climat et biomes** — Équatorial d'altitude ; hauts plateaux frais, savane à acacias, grande vallée d'effondrement, lacs, une bande côtière chaude.
- **Recevoir chez soi** — À l'équateur, ce ne sont pas les saisons qui changent mais les pluies : deux passages de « grandes pluies » (le printemps et l'automne du moteur) trempent les plateaux et rendent la vallée glissante, l'été et l'hiver restent secs et frais en altitude, chauds sur la bande côtière. Jour et nuit d'égale longueur toute l'année : `cycleJourNuit` **3 / 3** **[Proposition]**.
- **Terrain typique des cartes** — Grandes cartes terrestres (22×16) : plateaux séparés par une immense vallée qui coupe la carte en deux, quelques lacs, une côte au bord de la carte.
- **Spécialité de jeu** — **Bonus : le fond.** Toute l'infanterie gagne `mouvement +2` et ne subit aucun malus en montée. **Malus : peu de mécanique.** Le Kenya ne peut pas avoir plus de **3** unités blindées en jeu en même temps, et son revenu est court (`fonds ×0,9`) : le blindé se paie ici plus cher qu'ailleurs.
- **Archétype** — La fonceuse.
- **Commandant** — **Amani Kiptoo**, 24 ans. *Traits :* règle son tempo sur sa respiration et pas sur le chronomètre ; incapable de commencer fort, imbattable après la journée 10 ; d'une politesse imperturbable même quand il perd. *Pouvoir — Le rythme* (`ce_tour`) *:* `mes_unites` avec filtre `mouvement: ['pied', 'bottes']` — `mouvement +3` ; elles peuvent attaquer au bout de leur course. *Super-pouvoir — Dernier tour de piste* (`journees n = 3`) *:* `mes_unites` — `mouvement +1` la première journée, **+2** la deuxième, **+3** la troisième (additifs entiers, plafond +3), et `soin +2` à chaque fin de journée.
- **Unité spéciale** — **Le Messager du Rift.** Coureur en maillot vert et rouge, sac léger, dessin propre. Mouvement 10, ignore tous les coûts de terrain sauf l'eau, ne combat pas mais **révèle** un rayon de 3 cases autour de lui en permanence, et transporte un ordre (déplace une unité amie de 2 cases supplémentaires).
- **Rival naturel** — **Sénégal.** Voir plus haut. Amani prétend qu'aucun match ne se gagne avant le tour 12 ; Aïssatou en gagne régulièrement au tour 8, juste pour l'embêter.
- **Flags** — `pays.ke.rythme_trouve`, `pays.ke.messager_arrive`, `pays.ke.match_de_trois_heures`

---

### 5.15 Namibie 🇳🇦

- **Continent** — Afrique.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Désertique ; grandes dunes ocre, plaines de gravier, canyons, brume côtière permanente, quelques rivières sèches.
- **Recevoir chez soi** — Le désert le plus régulier du jeu : la brume côtière tombe presque tous les matins, quelle que soit la saison, et c'est la seule chose qui compte. L'été austral (décembre à février) ajoute la canicule à l'intérieur — les unités lourdes perdent un point de mouvement hors route et la bande de brume devient le seul endroit vivable de la carte. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Grandes cartes (22×16) **totalement découvertes** : aucun couvert sauf les canyons et la bande de brume qui longe la côte.
- **Spécialité de jeu** — **Bonus : la brume.** Dans la bande de brume côtière, l'adversaire ne voit presque rien : `unites_adverses` — `vision −2` (plancher 1 case), filtre `surTerrain: ['cotier', 'plage']`. C'est un **modificateur**, pas un trait : l'invisibilité conditionnelle n'existe pas dans `TraitSpecialite` (§4), et une vision réduite à une case dit la même chose avec un chiffre que le joueur voit. **Malus : à découvert.** Sur dune et plaine de gravier, les unités namibiennes passent à `defense ×0,8` — aucun couvert, aucun bonus de terrain.
- **Archétype** — La survivante.
- **Commandant** — **Tuli Shikongo**, 39 ans. *Traits :* parle à voix très basse, ce qui oblige tout le monde à s'approcher ; économise tout, y compris ses phrases ; sait exactement combien de journées elle peut tenir sans produire. *Pouvoir — Le silence* (`tour_complet`) *:* `unites_adverses` — `vision −2` (plancher 1 case) : on ne voit plus les Namibiennes bouger, où qu'elles soient. *Super-pouvoir — La brume avance* (`journees n = 3`) *:* `unites_adverses` sur la moitié de carte couverte — `vision −2` (plancher 1) et `mouvement −1` ; `mes_unites` — `attaque ×1,25` en sortant de la brume.
- **Unité spéciale** — **Le Rôdeur de brume.** Buggy bas à roues larges, gris pâle, dessin propre. Mouvement 8 sur sable, invisible hors brume tant qu'il n'a pas attaqué, et **révèle** la position de toutes les unités adverses dans un rayon de 4 une fois tous les trois tours.
- **Rival naturel** — **Mongolie.** Voir plus haut : le désert contre la steppe, disparaître contre traverser. Tuli et Naran ont un accord tacite — celle qui gagne offre le repas, et le repas dure toute la nuit.
- **Flags** — `pays.na.brume_etendue`, `pays.na.repas_offert`, `pays.na.silence_impose`

---

### 5.16 Madagascar 🇲🇬

- **Continent** — Afrique.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Tropical humide à l'est, sec à l'ouest ; forêt pluviale, hauts plateaux à rizières, forêts d'épineux, plateaux calcaires découpés, récifs.
- **Recevoir chez soi** — Une île, deux climats, et l'arête centrale qui fait la frontière : l'été austral (décembre à mars) est la saison des pluies à l'est — pluie continue, pistes rouges détrempées, tempêtes qui clouent les aériennes — pendant que l'ouest reste sec. L'hiver austral inverse la lecture : tout devient praticable, et l'avantage de Voahangy sur ses pistes est à son maximum. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Grande île en carte fermée (20×16), ratio terre/mer 70/30, une arête montagneuse centrale qui sépare deux climats, pistes rouges reliant tout.
- **Spécialité de jeu** — **Bonus : la connaissance des pistes.** Toutes les unités traversent forêt, brousse et piste à un **coût de mouvement de 1**, quel que soit leur type, et gagnent `vision +1`. **Malus : petit budget.** `fonds ×0,75` sur le budget de départ, et le revenu par ville est plafonné.
- **Spécialité de repli (sans paquet naval)** — **Bonus : l'île entière se marche.** Tout tient déjà sur la terre ferme : la carte se joue en boucle fermée sur les pistes rouges, et le ratio passe provisoirement à **90/10** (les bras de mer et les récifs deviennent une bordure décorative). **Malus : les ports ne servent à rien.** Les deux villes portuaires rapportent moitié moins (`fonds ×0,5` sur ces deux cases) tant que personne ne peut caboter, ce qui pousse Madagascar vers l'intérieur — exactement là où ses pistes valent le plus.
- **Archétype** — La météorologue.
- **Commandant** — **Voahangy Rakotobe**, 47 ans. *Traits :* nomme chaque espèce qu'elle croise sur le terrain, en pleine partie ; garde un carnet de croquis plus épais que son carnet de jeu ; s'excuse auprès du décor quand une unité l'abîme. *Pouvoir — Inventaire* (`tour_complet`) *:* `mes_unites` — `vision +4` (tout est révélé dans un large rayon) ; `unites_adverses` — `attaque ×0,9`, parce qu'on les voit venir. L'IA adverse garde ses décisions : un pouvoir ne pilote jamais l'adversaire. *Super-pouvoir — L'île entière* (`journees n = 2`) *:* `mes_unites` — `vision +5` (le brouillard de guerre tombe), `defense ×1,2` et `mouvement +2` sur piste.
- **Unité spéciale** — **Le Taxi-brousse.** Break surchargé, galerie sur le toit, autocollants partout, dessin propre. Transporte **3 unités** d'infanterie, mouvement 9 sur piste, et ne tombe jamais en panne — mais perd 1 PV chaque fois qu'il quitte une piste.
- **Rival naturel** — **Indonésie.** Voir plus haut : les cousins de l'océan Indien. Voahangy affirme que la pirogue à balancier a fait le voyage dans un sens ; Ayu affirme l'inverse. Ni l'une ni l'autre ne veut trancher, parce que le débat est trop agréable.
- **Flags** — `pays.mg.inventaire_complete`, `pays.mg.debat_pirogue`, `pays.mg.piste_quittee`

---

### 5.17 Brésil 🇧🇷 *(pays phare)*

- **Continent** — Amériques.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Équatorial et tropical ; forêt dense, grand fleuve et ses affluents, savane arborée, zone humide inondable, littoral à falaises et plages.
- **Recevoir chez soi** — Venir au Brésil **en janvier, c'est venir en été**, donc en saison des pluies : la pluie tombe presque tous les jours, les zones humides s'étendent et les roues souffrent hors route. Le « bon » créneau brésilien est l'hiver austral (juin à août), sec, où les grandes cartes se traversent vite. Le calendrier réel décide, pas le joueur. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Très grandes cartes (24×18), forêt à vision réduite, fleuve navigable qui traverse tout, quelques grandes villes côtières, zones inondables qui changent de statut.
- **Spécialité de jeu** — **Bonus : le moral monte.** Chaque unité adverse mise hors jeu donne 1 point d'ambiance ; à 5 points, toute l'équipe gagne `mouvement +1` et `attaque ×1,15` pendant une journée, puis le compteur retombe à 0. **Malus : le moral tombe.** Trois unités brésiliennes mises hors jeu d'affilée sans riposte réussie : `attaque ×0,9` pour toute l'équipe pendant une journée.
- **Archétype** — Le showman.
- **Commandant** — **Dandara Alves**, 27 ans. *Traits :* joue mieux quand le stade fait du bruit et le réclame ouvertement ; tente le geste compliqué même quand le simple suffit ; consolatrice hors pair après la victoire. *Pouvoir — Ginga* (`ce_tour`) *:* `mes_unites` — `mouvement +2` et `defense ×1,2` (l'esquive se paie en jambes, pas en second tour). *Super-pouvoir — Le carnaval* (`journees n = 3`) *:* le compteur d'ambiance passe au maximum ; `mes_unites` — `attaque ×1,3`, `mouvement +1` et `soin +1` à chaque fin de journée. Personne ne rejoue : c'est interdit, et l'ambiance suffit largement.
- **Unité spéciale** — **Le Trio Elétrico.** Camion-scène à haut-parleurs et guirlandes, dessin propre. Ne combat pas ; toutes les unités amies dans un rayon de 3 gagnent `mouvement +1` et `attaque ×1,1`, et le compteur d'ambiance monte de 1 par journée tant qu'il est en jeu.
- **Rival naturel** — **Argentine.** Le match du continent, celui dont on parle quatre ans à l'avance et quatre ans après. Style contre méthode, ambiance contre lecture de jeu. Dandara et Facundo se doivent mutuellement un nombre incalculable de dîners perdus au pari.
- **Flags** — `pays.br.foule_conquise`, `pays.br.ambiance_au_maximum`, `pays.br.geste_tente`, `pays.br.diner_perdu`

---

### 5.18 Argentine 🇦🇷

- **Continent** — Amériques.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Tempéré au centre, aride à l'ouest, froid et venteux au sud ; immense plaine herbeuse, steppe australe, lacs glaciaires, cordillère en bordure.
- **Recevoir chez soi** — Saisons inversées : recevoir en juillet, c'est recevoir en plein hiver austral — neige sur la steppe du sud, lacs glaciaires pris, donc franchissables, et une pointe australe qui devient enfin un terrain plutôt qu'une bordure. L'été (janvier) sèche la plaine et lui rend toute sa vitesse. `cycleJourNuit` standard 4 / 2 ; l'hiver au sud, la nuit s'allonge (`cycleJourNuit` 3 / 3 **[Proposition]**).
- **Terrain typique des cartes** — Grandes cartes (22×16) dominées par une plaine ouverte, une chaîne de montagnes sur un bord, et une pointe australe entourée d'eau froide et de glace flottante.
- **Spécialité de jeu** — **Bonus : la plaine.** En terrain plat, toutes les unités terrestres gagnent `mouvement +1` et `attaque ×1,1`. **Malus : le relief.** En montagne et en forêt dense, elles subissent `mouvement −1` et `defense ×0,9`.
- **Spécialité de repli (sans paquet naval)** — **Bonus : la piste australe.** Sans brise-glace, la pointe sud se rejoint par voie de terre : les unités argentines ignorent le coût de la neige et de la glace au sud de la carte (`mouvement +1` sur neige), et la banquise côtière compte comme terrain praticable — ratio ramené provisoirement à **90/10**. **Malus : le bout du monde.** Les villes de la pointe australe rapportent moitié moins (`fonds ×0,5` sur ces cases) tant qu'aucun chenal ne les relie au reste. *Le Brise-glace austral garde son `poser_terrain` (le chenal permanent) : il rouvrira la mer froide dès que le paquet naval arrivera.*
- **Archétype** — Le stratège prudent.
- **Commandant** — **Facundo Iriarte**, 49 ans. *Traits :* explique le jeu à tout le monde, y compris à ses adversaires en plein match ; dessine des schémas sur n'importe quelle surface disponible ; jamais content d'une victoire mal jouée. *Pouvoir — Lecture* (`tour_complet`) *:* `mes_unites` — `vision +5` (l'interface affiche les cibles probables adverses) ; `unites_adverses` — `attaque ×0,8`. *Super-pouvoir — Le tableau noir* (`journees n = 2`) *:* `unites_adverses` (trois au choix) — `mouvement −3` ; `mes_unites` — `attaque ×1,3` contre la cible qu'il désigne.
- **Unité spéciale** — **Le Brise-glace austral.** Coque orange à étrave renforcée, dessin propre. Navigue à travers la glace flottante comme sur de l'eau libre, **ouvre un chenal permanent** derrière lui (les autres navires peuvent suivre), transporte 2 unités et répare les navires amis adjacents.
- **Rival naturel** — **Brésil.** Voir plus haut. Facundo a un tableau entier consacré aux matchs contre Dandara, et il refuse catégoriquement de le montrer à qui que ce soit.
- **Flags** — `pays.ar.tableau_montre`, `pays.ar.lecon_donnee`, `pays.ar.chenal_ouvert`

---

### 5.19 Pérou 🇵🇪

- **Continent** — Amériques.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Trois étages en une carte : désert côtier, haute cordillère et altiplano, versant amazonien humide.
- **Recevoir chez soi** — Trois étages, trois météos simultanées, et une saison qui décide laquelle domine : l'été austral (décembre à mars) est la saison des pluies sur l'altiplano et le versant amazonien — routes lavées, brouillard de vallée, ponts d'autant plus précieux — tandis que le désert côtier ne reçoit jamais rien. L'hiver austral sèche l'altiplano et y pose de la neige au-dessus de 4 000 m. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Cartes moyennes-grandes (20×16) en **trois bandes parallèles** franchement séparées, reliées par des routes et des ponts à construire ; forte différence d'altitude.
- **Spécialité de jeu** — **Bonus : bâtisseur.** `mes_unites` — `vision +2` en altitude (filtre `surTerrain: ['montagne']`) et `mouvement +1` sur `route` et `pont`. Bâtir est le **pouvoir** de Nayra, pas la spécialité : une spécialité ne pose jamais de terrain (`03-schemas.md` §1). **Malus : tout se porte.** Toutes les unités ont `mouvement −1` en plaine, et le trésor est court (`fonds ×0,9`).
- **Archétype** — L'ingénieur.
- **Commandant** — **Nayra Quispe**, 35 ans. *Traits :* réfléchit en dessinant des marches ; se méfie de toute solution qui n'a pas coûté d'effort ; tricote pendant que l'adversaire joue son tour. *Pouvoir — Le chemin* (`ce_tour`) *:* `terrain` — `poser_terrain`, trois cases, formes `cable` (`foret`/`riviere` → `route`) ou `pont` ; `mes_unites` avec filtre `surTerrain: ['route', 'pont']` — `mouvement +2`. *Super-pouvoir — Le réseau des cols* (`journees n = 2`) *:* `terrain` — `poser_terrain`, quatre cases en forme `telepherique` (`montagne` → `route`) qui referment le réseau ; `mes_unites` sur route — `mouvement +4`. On traverse le réseau en deux journées de marche, pas en un clic.
- **Unité spéciale** — **La Caravane d'altitude.** File d'animaux de bât aux pompons colorés, conduite par deux porteurs, dessin propre. Ignore totalement l'altitude et la pente, transporte 2 unités, et **ravitaille** (+3 PV) une unité amie par tour. Très lente en plaine.
- **Rival naturel** — **Népal.** Voir plus haut : la querelle d'altitude la plus courtoise du tournoi. Nayra a proposé un match sur une carte à quatre étages pour trancher ; Pemba a répondu qu'il en faudrait cinq.
- **Flags** — `pays.pe.reseau_relie`, `pays.pe.querelle_daltitude`, `pays.pe.marche_dessinee`

---

### 5.20 Mexique 🇲🇽

- **Continent** — Amériques.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Désert au nord, plateau central volcanique, forêt tropicale au sud ; cactus, volcans, cénotes, deux façades maritimes, récifs.
- **Recevoir chez soi** — L'été est double : canicule sèche sur le désert du nord, saison des pluies au sud, avec des orages qui traversent le plateau central en fin d'après-midi. L'hiver est la saison confortable, sèche partout, et la seule où le nord et le sud se jouent de la même manière. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Cartes moyennes-grandes (20×16) en trois climats, volcans comme points hauts, cénotes comme passages d'eau souterraine (une case relie deux cases distantes).
- **Spécialité de jeu** — **Bonus : la prise.** Une fois par journée, une unité mexicaine adjacente à une unité adverse **plus légère** la **déséquilibre** : la cible passe à `mouvement −3` (elle ne va plus nulle part cette journée) et l'unité mexicaine attaque à `attaque ×1,2`. On ne s'échange plus de place — l'échange de positions est interdit — mais on cloue quand même l'adversaire au sol. **Malus : tout pour l'attaque.** Toutes les unités mexicaines ont `defense ×0,9`.
- **Archétype** — Le showman.
- **Commandant** — **Xóchitl Bravo**, 30 ans, dite « La Cóndor ». *Traits :* entre sur le terrain en musique, masque compris ; annonce son coup avant de le faire et le réussit quand même ; incapable de gagner discrètement. *Pouvoir — Le grand saut* (`ce_tour`) *:* `mes_unites` — `mouvement +2` (de quoi franchir un obstacle d'une case) et `attaque ×1,2` sur la première frappe. *Super-pouvoir — La prise finale* (`journees n = 2`) *:* `unites_adverses` (trois au choix) — `mouvement −3` et `defense ×0,8` ; `mes_unites` — `attaque ×1,4`. La prise immobilise, elle ne téléporte plus personne.
- **Unité spéciale** — **Le Lutteur masqué.** Infanterie en cape et masque à liserés dorés, dessin propre. Mouvement 6, ne subit aucun dégât de contre-attaque, et peut **projeter** une unité adverse adjacente de 2 cases dans la direction de son choix (une fois tous les deux tours).
- **Rival naturel** — **Maroc.** Voir plus haut : le concours permanent de la meilleure cuisine du tournoi, arbitré par personne et donc jamais tranché. Le match se joue toujours avec deux fanfares.
- **Flags** — `pays.mx.fete_partagee`, `pays.mx.entree_en_musique`, `pays.mx.coup_annonce_reussi`, `pays.mx.fanfare_doublee`

---

### 5.21 Canada 🇨🇦

- **Continent** — Amériques.
- **Hémisphère** — `nord`.
- **Climat et biomes** — Continental froid à subarctique ; forêt boréale, milliers de lacs, plaines céréalières, montagnes de l'Ouest, toundra au nord, longue côte découpée.
- **Recevoir chez soi** — **L'hiver canadien est la carte elle-même** : la neige couvre les plaines (+1 de coût pour tout sauf pied et chenilles — sauf pour les Canadiens, qui l'ignorent) et **les milliers de lacs et les rivières gèlent, donc se franchissent partout**. Les immenses distances deviennent traversables en ligne droite. Les journées sont courtes : `cycleJourNuit` **3 / 3** l'hiver. L'automne dépouille la forêt boréale et lui retire son couvert ; l'été rouvre les lacs et rallonge tout.
- **Terrain typique des cartes** — **Les plus grandes cartes du jeu** (26×20), très peu de villes, immenses distances, lacs gelés praticables l'hiver, forêt dense qui coupe la vision.
- **Spécialité de jeu** — **Bonus : l'hiver ne compte pas.** `mes_unites` — `mouvement +1` sur les cases que la saison `neige_plaines` a alourdies (le surcoût est donc annulé, jamais inversé) et `soin +1` par journée passée en forêt. Le gel des lacs n'est pas un bonus canadien : c'est l'effet de saison `rivieres_gelees`, qui vaut pour **tout le monde** (`04-gameplay.md` §12.2) ; l'avantage du Canada est de ne pas ralentir dessus. **Malus : les distances.** Chaque ville capturée ne rapporte **qu'à partir de la journée suivante** (les convois sont longs), et les renforts apparaissent avec une journée de retard.
- **Archétype** — La météorologue.
- **Commandant** — **Émile Tremblay**, 46 ans. *Traits :* d'un calme que rien n'entame, y compris un désastre en cours ; s'excuse quand c'est l'adversaire qui le bouscule ; prépare des provisions pour un match de six heures, à chaque fois. *Pouvoir — Le long hiver* (`tour_complet`) *:* `mes_unites` — `defense ×1,25` et `soin +2` ; `unites_adverses` — `mouvement −1`. *Super-pouvoir — Le grand gel* (`journees n = 3`) *:* `mes_unites` — `mouvement +2` et `defense ×1,25` ; `unites_adverses` — `mouvement −1`. **Le gel n'est pas un pouvoir** : geler les plans d'eau, c'est l'effet de saison `rivieres_gelees` que l'hiver continental canadien apporte de lui-même (`04-gameplay.md` §12.2), et `poser_terrain` ne pose ni glace ni source chaude (`BRIEF.md`, seconde relecture, point 3). Le grand gel dit donc ce qu'Émile fait vraiment : **il est le seul à savoir marcher dessus**, pendant que les autres glissent. *L'immobilisation des navires reviendra avec le paquet naval.*
- **Unité spéciale** — **L'Hydravion de brousse.** Petit avion à flotteurs, rouge et blanc, dessin propre. Se pose sur l'eau **et** sur la terre, transporte 2 unités, mouvement 9, et révèle un rayon de 5 à chaque atterrissage.
- **Rival naturel** — **Islande.** Voir plus haut : le championnat officieux du froid. Émile soutient qu'un pays sans forêt ne peut pas prétendre au titre ; Hrefna répond qu'un pays qui a besoin d'arbres pour se cacher n'est pas sérieux.
- **Flags** — `pays.ca.grand_gel_declenche`, `pays.ca.provisions_partagees`, `pays.ca.titre_du_froid_dispute`

---

### 5.22 Australie 🇦🇺

- **Continent** — Océanie.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Aride au centre, tempéré au sud-est, tropical au nord ; désert rouge, bush, eucalyptus, grande barrière de corail, longues plages.
- **Recevoir chez soi** — Saisons inversées, et un été (décembre à février) qui est **la** condition australienne : canicule sur tout le centre, unités lourdes à `mouvement −1` hors route, et une distance qui devient franchement pénible à parcourir — exactement l'effet que la spécialité du pays cherche déjà. L'hiver austral rend le désert praticable et le nord tropical à sa saison sèche. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Très grandes cartes (24×18) avec un **centre vide** et toutes les villes sur le pourtour ; le désert central est traversable mais coûteux.
- **Spécialité de jeu** — **Bonus : la distance protège.** Toute unité **adverse** qui termine sa journée à plus de 5 cases de la ville la plus proche subit `degats_directs 1`. **Malus : loin de chez soi.** Les unités australiennes passent à `attaque ×0,9` quand elles jouent hors de leur territoire national (toutes les cartes du tournoi sauf les leurs).
- **Archétype** — La gardienne.
- **Commandant** — **Marlee Kirkwood**, 38 ans. *Traits :* d'un flegme total devant n'importe quelle catastrophe tactique ; abrège tous les mots de plus de deux syllabes ; ne perd jamais son sens de l'humour, surtout quand elle perd. *Pouvoir — Le bush* (`tour_complet`) *:* `unites_adverses` loin d'une ville — `degats_directs 2` ; `mes_unites` — `mouvement +1` (le désert ne leur coûte rien). *Super-pouvoir — Le grand rien* (`journees n = 3`) *:* `unites_adverses` dans la moitié centrale — `mouvement −1` et `degats_directs 2` ; `mes_unites` — `vision +5`.
- **Unité spéciale** — **Le Road train.** Camion à trois remorques, dessin propre. Transporte **4 unités**, mouvement 10 en désert et sur route, mais lui faut un tour entier pour faire demi-tour (il ne peut pas revenir sur sa case de départ dans le même tour).
- **Rival naturel** — **Inde.** Voir plus haut : le match des tribunes pleines. Marlee prétend n'avoir jamais regardé une seule statistique du match ; elle les connaît toutes par cœur.
- **Flags** — `pays.au.centre_hostile_active`, `pays.au.statistique_avouee`, `pays.au.tribune_partagee`

---

### 5.23 Nouvelle-Zélande 🇳🇿

- **Continent** — Océanie.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Océanique frais ; fougères arborescentes, forêts humides, alpes du Sud, geysers et lacs colorés, fjords, prairies à moutons.
- **Recevoir chez soi** — Saisons inversées, et une météo qui change quatre fois par match quelle que soit la saison : la pluie est le régime par défaut, le brouillard de vallée le régime du matin. L'hiver austral (juin à août) enneige les alpes du Sud et ferme la moitié montagneuse de l'île — la carte la plus défensive du jeu le devient encore un peu plus. `cycleJourNuit` standard 4 / 2.
- **Terrain typique des cartes** — Deux îles étroites et longues (18×20, format vertical) séparées par un détroit ; montagne centrale, brume de vallée, côtes très découpées.
- **Spécialité de jeu** — **Bonus : la fougère répare.** Toute unité terminant sa journée en forêt de fougères gagne `soin +2` et devient invisible tant qu'elle n'attaque pas ; la brume de vallée donne `defense ×1,2` aux défenseurs. **Malus : personne ne court.** Tous les véhicules néo-zélandais ont `mouvement −1`, et le pays ne dispose pas de `recon` (`04-gameplay.md` §3).
- **Spécialité de repli (sans paquet naval)** — **Bonus : le pont du détroit.** Les deux îles sont reliées par un **pont-jetée central** : une unité qui le franchit reste couverte par la brume du détroit (`defense ×1,2`), ce qui en fait un goulet défendable plutôt qu'un piège. Ratio ramené provisoirement à **80/20**. **Malus : un seul passage.** Le pont est l'unique liaison, et l'unité qui l'emprunte y consomme tout son mouvement restant ; les fjords de la côte ouest restent décoratifs. *Le vrai jeu d'îles — débarquements, contournements par les fjords — arrivera avec le paquet naval.*
- **Archétype** — La gardienne.
- **Commandant** — **Hana Whitmore**, 36 ans. *Traits :* ne recule jamais d'une case, par principe et par habitude ; parle de son équipe comme d'une famille et le pense ; prépare toujours le terrain trois journées à l'avance. *Pouvoir — La ligne* (`tour_complet`) *:* `mes_unites` formant une ligne continue de trois cases ou plus — `defense ×1,4` et `attaque ×1,2` en riposte. *Super-pouvoir — Le mur de brume* (`journees n = 3`) *:* `unites_adverses` dans la bande — `vision −2` (plancher 1) et `mouvement −2` ; `mes_unites` — `defense ×1,3`.
- **Unité spéciale** — **Le Planeur de vallée.** Aile souple à voilure bicolore, dessin propre. Ne consomme aucun carburant, se déplace de 7 mais **uniquement en descendant** depuis une case plus haute ; révèle un rayon de 4 en vol et se pose n'importe où.
- **Rival naturel** — **Fidji.** Le derby du Pacifique : le grand voisin méthodique contre le petit archipel qui joue en accéléré. Hana a formé la moitié de l'équipe fidjienne, ce qui rend chaque défaite particulièrement savoureuse pour Sitiveni.
- **Flags** — `pays.nz.ligne_tenue`, `pays.nz.eleve_devenu_rival`, `pays.nz.mur_de_brume_leve`

---

### 5.24 Fidji 🇫🇯

- **Continent** — Océanie.
- **Hémisphère** — `sud`.
- **Climat et biomes** — Tropical humide ; lagons turquoise, barrières de corail, îles volcaniques boisées, plages, cocoteraies.
- **Recevoir chez soi** — L'été austral (novembre à avril) est la saison humide et la saison des tempêtes : pluie chaude, grains qui traversent, unités aériennes clouées au sol — sur une carte aussi petite, une tempête change tout le plan de la journée. L'hiver austral est sec, doux et sans surprise : c'est là que Sitiveni gagne. `cycleJourNuit` **3 / 3** (on est près de l'équateur) **[Proposition]**.
- **Terrain typique des cartes** — Petites cartes maritimes (16×14), ratio terre/mer **25/75**, une trentaine d'îlots, lagons peu profonds partout, quelques passes dans le récif.
- **Spécialité de jeu** — **Bonus : le lagon est un terrain.** Toutes les unités terrestres fidjiennes traversent les eaux peu profondes **comme de la plaine**, sans transport. **Malus : petite équipe.** `fonds ×0,7` sur le budget de départ, et aucune unité lourde : ni `char_lourd`, ni `roquettes`, ni gros navire quand le paquet naval arrivera (`04-gameplay.md` §3).
- **Spécialité de repli (sans paquet naval)** — **Bonus : on marche sur le lagon, pas l'adversaire.** C'est le pays qui perd le moins au report de la mer : le lagon reste un terrain pour les Fidjiens et pour eux seuls. La carte est ramenée provisoirement à **45/55** (plus d'îlots, plus de bancs), et l'océan hors récif est une bordure infranchissable pour tout le monde. **Malus : on ne s'abrite nulle part.** Hors du lagon et de la cocoteraie, les unités fidjiennes passent à `defense ×0,8` — sans navires, il faut aller au contact à découvert. *Le Catamaran de lagon reste écrit : il rouvrira les passes du récif avec le paquet naval.*
- **Archétype** — Le prodige.
- **Commandant** — **Sitiveni Naicoro**, 21 ans. *Traits :* le plus jeune commandant du tournoi et il en joue ; improvise tout et s'en sort neuf fois sur dix ; salue chaque adversaire avant et après, sans exception. *Pouvoir — La passe* (`ce_tour`) *:* `mes_unites` adjacentes à une unité qui vient de mettre une adverse hors jeu — `mouvement +2` et `attaque ×1,2`. La passe fait avancer le suivant, elle ne lui donne pas un tour : transmettre un tour est interdit. *Super-pouvoir — Le lagon entier* (`journees n = 3`) *:* `terrain` — `poser_terrain`, forme **`banc_de_sable`** (`mer` → `plage`), quatre cases contiguës qui ouvrent une passe d'un bout à l'autre du lagon ; `mes_unites` — `mouvement +2` et `attaque ×1,2` en sortant de l'eau.
- **Unité spéciale** — **Le Catamaran de lagon.** Coque double à voile triangulaire, dessin propre. Mouvement 10, franchit les récifs (interdits aux autres navires), transporte 2 unités, et ne peut pas être ciblé par les grosses unités navales (trop rapide et trop bas sur l'eau).
- **Rival naturel** — **Nouvelle-Zélande.** Voir plus haut. Sitiveni a été formé par Hana Whitmore et lui rappelle à chaque rencontre, avec un immense sourire, qu'il joue plus vite qu'elle ne l'a jamais fait.
- **Flags** — `pays.fj.chaine_de_passes`, `pays.fj.salut_rendu`, `pays.fj.formateur_battu`

---

## 6. Tableau récapitulatif — les 24 pays

La colonne **repli** indique les pays qui portent une **spécialité de repli terrestre** en attendant le paquet naval (arbitrage n° 3).

| Pays | Continent | Hém. | Archétype | Spécialité (5 mots) | Repli | Rival |
|---|---|---|---|---|:-:|---|
| France | Europe | nord | Le prodige | Tout dispo, revenu plus faible | — | Luxembourg |
| Luxembourg | Europe | nord | La diplomate | Trésor rapide, QG fragile | — | France |
| Islande | Europe | nord | **La météorologue** | Neige gratuite, aucun blindé lourd | — | Canada |
| Suisse | Europe | nord | La gardienne | Retranchement fort, production très lente | — | Pays-Bas |
| Pays-Bas | Europe | nord | L'ingénieur | Modifie l'eau, polders vulnérables | — | Suisse |
| Grèce | Europe | nord | Le vétéran | Navires rapides, blindés ralentis | **oui** | Japon |
| Japon | Asie | nord | Le stratège prudent | Téléportation ferroviaire, unités plus chères | **oui** | Grèce |
| Mongolie | Asie | nord | La fonceuse | Cavalerie rapide, aucun naval | — | Namibie |
| Népal | Asie | nord | La survivante | Infanterie d'altitude, aucun véhicule | — | Pérou |
| Indonésie | Asie | equateur | La diplomate | Transports bon marché, terrestres lents | **oui** | Madagascar |
| Inde | Asie | nord | Le showman | Double production, unités affaiblies | — | Australie |
| Maroc | Afrique | nord | Le vétéran | Désert gratuit, froid pénalisant | — | Mexique |
| Sénégal | Afrique | nord | La fonceuse | Groupés forts, isolés faibles | **oui** | Kenya |
| Kenya | Afrique | equateur | La fonceuse | Infanterie rapide, blindés limités | — | Sénégal |
| Namibie | Afrique | sud | La survivante | Invisible en brume, découvert fatal | — | Mongolie |
| Madagascar | Afrique | sud | **La météorologue** | Pistes gratuites, budget réduit | **oui** | Indonésie |
| Brésil | Amériques | sud | Le showman | Moral qui monte et tombe | — | Argentine |
| Argentine | Amériques | sud | **Le stratège prudent** | Plaine dominée, relief handicapant | **oui** | Brésil |
| Pérou | Amériques | sud | L'ingénieur | Construit routes, unités lentes | — | Népal |
| Mexique | Amériques | nord | Le showman | Prise qui cloue, défense faible | — | Maroc |
| Canada | Amériques | nord | **La météorologue** | Hiver gratuit, revenus retardés | — | Islande |
| Australie | Océanie | sud | La gardienne | Distance blessante, faible à l'extérieur | — | Inde |
| Nouvelle-Zélande | Océanie | sud | La gardienne | Défense en ligne, véhicules lents | **oui** | Fidji |
| Fidji | Océanie | sud | Le prodige | Marche sur lagon, petit budget | **oui** | Nouvelle-Zélande |

**Vérification d'équilibre des archétypes** — Le stratège prudent : 2 (Japon, Argentine) · La fonceuse : 3 (Mongolie, Sénégal, Kenya) · Le vétéran : 2 (Grèce, Maroc) · L'ingénieur : 2 (Pays-Bas, Pérou) · La diplomate : 2 (Luxembourg, Indonésie) · Le showman : 3 (Inde, Brésil, Mexique) · La survivante : 2 (Népal, Namibie) · La météorologue : 3 (Islande, Canada, Madagascar) · Le prodige : 2 (France, Fidji) · La gardienne : 3 (Suisse, Australie, Nouvelle-Zélande). Total : 24, entre 2 et 3 par archétype.

**Vérification des hémisphères** — `nord` : 14 · `sud` : 8 · `equateur` : 2. Une saison sur deux est donc inversée d'un pays à l'autre, ce qui est exactement l'effet recherché : la même date réelle ne produit jamais le même match partout.

**Vérification des spécialités de repli** — Huit pays en portent une : Grèce, Japon, Indonésie, Sénégal, Madagascar, Argentine, Nouvelle-Zélande, Fidji. Ce sont les seuls dont la spécialité, l'unité spéciale ou le ratio terre/mer devenait injouable avec la mer infranchissable. Les autres pays côtiers (Islande, Pays-Bas, Maroc, Mexique, Canada, Australie, Namibie, Brésil) ont été vérifiés : leur spécialité est déjà entièrement terrestre et leurs cartes restent jouables telles quelles.

**Vérification des rivalités** — Les 24 pays forment 12 paires réciproques : chaque commandant est le rival de celui qui le cite. Aucun pays n'est cité deux fois, aucun n'est orphelin. La routine lore peut donc traiter une rivalité comme une **arête unique** et non comme deux entrées à synchroniser.

---

## 7. Les pays phares

**Ce que la révision du 5 septembre au soir change ici, et rien d'autre : le calendrier.** Un prologue de pays phare n'est plus une des vingt-quatre portes d'entrée du jeu — c'est le prologue d'une **Nouvelle Ronde**, jouable le jour où cette nation a été ralliée dans une partie précédente. La France est la seule exception, et c'est sa raison d'être : elle est le premier parcours de tout le monde. Les fiches et les prologues ne changent pas ; ce qui change, c'est **quand** on les voit.

Quatre pays reçoivent un **prologue écrit à la main**, en plus de leur fiche. Les vingt autres ont un début de partie construit par la routine lore à partir de la fiche seule, le jour où ils s'ouvrent.

| Pays | Ce que le prologue apporte | Quand on le voit | État |
|---|---|---|---|
| **France** | Le plus complet : la qualification nationale des 18 régions avant le mondial (voir `07-france-regions.md`). Sert de gabarit à tous les autres. | **Au premier parcours, pour tout le monde** | Spécifié |
| **Luxembourg** | Le contrepoint : un pays minuscule, un prologue court et dense, tout entier construit sur « on est petits et on le sait ». Deux étapes seulement. | Nouvelle Ronde, si `lu` a été ralliée | À écrire |
| **Japon** | Le prologue « réseau » : une qualification qui se joue en enchaînant des étapes selon un horaire, où le joueur perd son avantage s'il traîne. | Nouvelle Ronde, si `jp` a été ralliée | À écrire |
| **Brésil** | Le prologue « ambiance » : une qualification en carnaval, où la progression se mesure au public gagné plutôt qu'aux victoires nettes. | Nouvelle Ronde, si `br` a été ralliée | À écrire |

**Règle de cohérence** — Un prologue écrit à la main ne peut jamais contredire la fiche du pays : il **la met en scène**. Si le prologue a besoin d'un élément qui n'est pas dans la fiche, c'est la fiche qu'on modifie, ici, d'abord.

**Priorité de production** — France (spécifiée) d'abord, et de loin : c'est le seul prologue dont un joueur a besoin pour jouer le jeu. Puis Luxembourg (le plus court, il valide le gabarit court), puis Japon, puis Brésil — trois prologues qui ne bloquent aucun lancement, puisqu'aucun premier parcours ne les traverse. Les vingt autres passent à la routine lore une fois ces quatre-là validés par la routine contrôle.

**Ce que la révision libère.** Les vingt-trois prologues non français ne sont plus sur le chemin critique. Ce qui l'est, à leur place, c'est le **jeu des relations** : que chaque fiche dise précisément ce qu'elle apporte alliée, ce qu'elle coûte rivale, et ce qui s'éteint quand elle se retire.

---

## 8. Ce qui reste à trancher (propositions ouvertes)

1. **Nombre de flags par pays** — Ce document propose 3 flags propres par pays (plus, pour huit pays, les flags nommément cités par `01-bible.md` §8.3), soit environ 80 flags nationaux, auxquels s'ajoutent les 8 gabarits communs × 24 pays. À confronter à `content/flags.json` avant gel.
2. **Chiffrage définitif** — Tous les pourcentages et valeurs de mouvement de ce document sont des **valeurs de départ à équilibrer** par simulation headless (routine contrôle, IA contre IA). Ils sont écrits pour être lisibles par un joueur, pas pour être exacts au premier essai.
3. **Unités spéciales et palette swap** — Les 24 unités spéciales de ce document sont les seules à avoir un dessin propre pour ces pays, conformément au brief. Cela fait 24 dessins uniques à produire, en plus du jeu d'unités communes.
