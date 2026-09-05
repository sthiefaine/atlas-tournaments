# 00 — Vision

*Atlas Tournament — document de vision. Source canon : `BRIEF.md`. Tout ce qui dépasse le brief est signalé par **[Proposition]**.*

---

## 1. Pitch

Dans ce monde, les nations ne se font plus la guerre : elles se rencontrent sur un terrain. Tous les quatre ans, l'organisation **Atlas** emmène le tournoi mondial de **Jeux Tactiques** autour de la planète, et chaque pays reçoit les autres chez lui, sur son sol, avec ses montagnes, ses fleuves, ses digues et ses trains.

Vous êtes un jeune commandant, et vous commencez par la France : vous gagnez votre place en sélection nationale sur les dix-huit régions, puis vous partez : un continent après l'autre, une destination choisie parmi deux ou trois à chaque étape, un match par étape, et un carnet de voyage qui se remplit de tout ce que vous avez décidé en chemin. Les vingt-trois autres nations ne sont pas un menu au départ : ce sont des **relations** que vous nouez en route — alliées, rivales, ou retirées de la Ronde par votre faute. Celles que vous ralliez s'ouvrent comme pays de départ pour votre **prochaine Ronde**.

Parce qu'on ne traverse pas le monde sans rien laisser derrière soi. Le rival que vous avez écrasé revient avec une dent contre vous ; celui à qui vous avez laissé sauver la face revient s'asseoir à côté de vous comme co-commandant. Le barrage que vous avez fait sauter est encore ouvert quand vous repassez. Et pendant que vous jouez, quelque chose grince à l'intérieur d'Atlas : une faction — **la Cinquième Manche** (`01-bible.md` §3.4) — veut se servir du tournoi pour remettre en jeu ce que le tournoi avait justement retiré du jeu. Le jour où ça éclate, les pays qui vous suivent sont exactement ceux que vous avez su traiter correctement.

**Atlas Tournament, c'est Advance Wars qui part en tour du monde, avec une mémoire.**

---

## 2. Les piliers

### 2.1 Un tactique lisible avant d'être malin

Grille, terrain, unités, capture de villes, commandants à pouvoirs : la grammaire d'Advance Wars, assumée. Une partie se comprend en un coup d'œil et se gagne par la lecture du terrain, pas par la mémorisation de tables cachées. Le moteur de règles est un module déterministe et pur — mêmes entrées, même résultat — ce qui n'est pas qu'une décision technique : c'est une promesse au joueur qu'il perd toujours pour une raison qu'il peut nommer. Une partie doit tenir en vingt à quarante minutes et se raconter en trois phrases.

### 2.2 La géographie est la mécanique

Un pays n'est pas un skin : c'est une règle. La Suisse se retranche dans ses cols, les Pays-Bas ouvrent les vannes et changent la carte en cours de match, le Japon déplace ses unités par ligne à grande vitesse. Le pouvoir d'un commandant vient de son relief, de son climat, de sa cuisine ou de son folklore, jamais de son histoire militaire. Le joueur apprend un peu de monde en apprenant à jouer, et chaque étape du voyage a une saveur mécanique reconnaissable. La France, premier pays entièrement détaillé, pousse le principe jusqu'à ses dix-huit régions, chacune avec sa mécanique de terrain.

### 2.3 Les choix laissent des traces

Le voyage n'est pas un menu de niveaux : c'est une suite de décisions qui s'écrivent quelque part. Un système de **flags** — booléens, compteurs, relations — enregistre ce que le joueur a fait, à l'échelle d'un pays, d'un commandant ou du monde. Ces flags nourrissent quatre choses visibles : le **carnet de voyage** (le joueur relit ses propres décisions), la **réputation** de chaque commandant croisé (respect ou grief, alliés recrutables ou rivaux jurés), les **traces sur les cartes** (ce qui a été cassé reste cassé quand on repasse), et surtout l'**état de chaque nation sur la carte du monde** — `neutre`, `alliee`, `rivale`, `retiree`. C'est la conséquence la plus grosse et la plus lisible : une nation ralliée prête son commandant, son unité spéciale et son soutien à l'acte III ; une nation retirée éteint sa destination et laisse un trou dans la carte. Les fins multiples ne sont pas un embranchement de dernière minute : c'est l'addition de tout ce qui précède.

**Et le jeu ne se referme jamais sur lui-même :** au plus cinq nations peuvent se retirer dans une partie, la trame en garantit au moins deux alliées avant l'acte III, et aucune fin ne devient inaccessible — un joueur qui joue mal obtient une fin d'une autre couleur, jamais un cul-de-sac.

### 2.4 Du sport, jamais de la guerre

C'est un garde-fou éditorial autant qu'un parti pris de ton. On ne dit pas ennemi mais adversaire, pas mort mais **mis hors jeu**, pas bataille mais **match**, pas armée mais **équipe**. Les vrais pays existent avec leur géographie, leur gastronomie, leur sport et leurs clichés affectueux ; jamais avec leur politique, leur religion, leurs conflits réels ou leurs dirigeants. Deux nations réelles ne s'affrontent jamais : elles se rencontrent. Ce vocabulaire n'est pas une pudeur, c'est le cœur de la fiction — un monde qui a rangé la guerre au vestiaire et qui tient beaucoup à ce qu'elle y reste.

### 2.5 Un jeu qui s'enrichit hors de la partie

Le contenu — lore des pays, cartes, événements — est produit en amont par un pipeline de routines IA, validé par une routine de contrôle et par un humain, puis figé. **Aucun modèle n'est appelé pendant une partie.** Le joueur joue toujours contre un moteur déterministe et du contenu validé ; le jeu grossit entre les sessions, pas pendant. C'est ce qui permet d'ambitionner vingt-quatre pays et dix-huit régions sans écrire vingt-quatre scénarios à la main, sans jamais sacrifier la fiabilité ni les garde-fous de ton.

### 2.6 Un jeu vivant, jamais un jeu à corvées

Chaque jour réel peut apporter quelque chose : une **Dépêche du jour** — une manche d'exhibition inspirée d'un événement du monde, un festival, une course, une découverte, une saison remarquable — et, plus rarement, une **unité nouvelle** homologuée par Atlas après être passée par le banc d'essai. Le monde du jeu vit à la même vitesse que le nôtre, et l'organisation qui l'anime a un organe pour ça : la Commission d'homologation (`01-bible.md` §3.2), qui admet, met à l'essai ou retire du matériel comme une fédération sportive le ferait.

**La contrepartie est la promesse centrale de ce pilier : la campagne est complète sans.** Une mission du jour n'écrit aucun flag de campagne, ne débloque aucun allié, ne modifie aucune carte et ne pèse sur aucune fin ; sa récompense est cosmétique, ou une carte de terrain au plus. Un joueur hors ligne, ou qui revient six mois plus tard, joue exactement le même jeu que celui qui se connecte tous les matins — avec les mêmes fins possibles. Le quotidien est une invitation, jamais une case à cocher, et il n'y a **aucune Dépêche** les jours où rien de convenable ne s'est passé : le vide vaut mieux qu'une erreur.

**Et le déterminisme tient quand même :** le catalogue d'unités est versionné, une partie fige la version qu'elle utilise, un rejeu reste identique quoi qu'il arrive au catalogue ensuite.

---

## 3. Public visé

- **Cœur de cible** : joueurs de tactique au tour par tour — Advance Wars, Wargroove, Into the Breach, Fire Emblem côté attachement aux personnages. Ils veulent un moteur honnête et des commandants qu'ils ont envie de collectionner.
- **Cercle élargi** : joueurs occasionnels attirés par le tour du monde, la carte, les clins d'œil culturels et le ton cartoon. Le jeu doit être compréhensible sans culture du genre : le premier match apprend les règles sans tutoriel bavard.
- **Âge** : à partir de 10-12 ans, sans violence représentée, jouable par un adulte sans avoir l'impression d'un jeu pour enfants. **[Proposition]** viser explicitement une classification tous publics et s'y tenir comme à une contrainte de design.
- **Contexte d'usage** : navigateur, sessions courtes, reprise facile. Francophones d'abord (le jeu et sa documentation sont en français), anglais ensuite.
- **[Proposition]** Public secondaire assumé : le milieu scolaire et familial, où « on apprend la géographie sans le dire ». Cela n'implique aucune concession de profondeur tactique, seulement une exigence de clarté.

---

## 4. Ce que le jeu n'est pas

| Le jeu n'est pas… | Ce qu'on fait à la place |
|---|---|
| **Un jeu de guerre.** Aucune guerre réelle, passée ou possible, n'est évoquée, rejouée ou suggérée. | Un tournoi sportif. Les affrontements sont des matchs arbitrés, avec un règlement, des sanctions et un public. |
| **Un commentaire politique.** Pas de régimes, d'élections, de partis, de dirigeants réels, de frontières contestées, de religion. | De la géographie, du climat, de la cuisine, du sport, du folklore et de l'auto-dérision. |
| **Un jeu où l'on meurt.** Pas de mort, pas de blessés, pas de civils, pas de sang. | La doctrine du marquage : une unité touchée est *marquée*, escortée hors du terrain par les arbitres, et revient au match suivant. |
| **Un jeu qui désigne un coupable.** La Cinquième Manche n'est jamais rattachée à un vrai pays, ni à une vraie culture. | Une faction interne à Atlas, apatride par construction, avec ses propres figures inventées (Hadran Ost et la tête cachée au Bureau, `01-bible.md` §3.4). |
| **Une simulation.** Pas de gestion économique fine, pas de logistique réaliste, pas de brouillard de guerre punitif par défaut. | Des règles peu nombreuses, lisibles, profondes par combinaison. |
| **Du pixel art.** | Des formes composées par le code, lisses, recolorables, sans perte à l'échelle. |
| **Un jeu qui écrit son texte en direct.** | Un pipeline de contenu en amont, validé, figé, jouable hors ligne. |
| **Un jeu qui fait une mission d'un drame réel.** Jamais de Dépêche du jour sur une catastrophe, un accident, un fait divers, une crise, un conflit, une élection — ni sur la souffrance de qui que ce soit. | Une liste blanche fermée (sport, festival, culture, découverte, exploit, saison remarquable), une validation humaine avant mise en ligne, et **aucune Dépêche du jour** les jours où rien de convenable ne s'est passé. Le vide vaut mieux qu'une erreur. |
| **[Proposition] Un jeu quotidien à corvées.** Pas de série à ne pas casser, pas de récompense qu'on rate en dormant, pas de contenu de campagne enfermé dans une mission du jour. | Le quotidien est un bonus étanche : cosmétique, ou une carte de terrain au plus, et aucun flag de campagne (`08-narration-choix.md` §4.4). |
| **[Proposition] Un jeu à monétisation agressive.** Pas de gacha, pas de commandants payants qui gagnent des matchs. | Le contenu se débloque en jouant et en voyageant. |
| **[Proposition] Un jeu compétitif en ligne au lancement.** | Solo et contre l'IA d'abord ; le moteur déterministe rend le multijoueur possible plus tard sans réécriture. |

---

## 5. La boucle de jeu

La boucle tient en quatre temps, et chaque temps alimente le suivant. Elle se répète à l'échelle d'une étape (quelques dizaines de minutes) et se referme à l'échelle du tournoi (un continent = un acte ; une traversée en compte trois, `08-narration-choix.md` §6).

### 5.1 Les quatre temps

| Temps | Ce que fait le joueur | Ce que le jeu enregistre | Ce que ça change |
|---|---|---|---|
| **1. La partie** | Un match tactique sur une carte du pays hôte : capture du QG adverse, mise hors jeu de l'équipe, ou objectif spécial propre au terrain. **On joue sous le ciel du pays et à la date du jour** : la saison dépend de l'hémisphère de l'hôte, la nuit tombe sans interrompre le match, et le Bulletin de Célestin Vantour annonce la météo des deux journées à venir — annoncée, donc jouable, jamais une surprise. | Résultat, style de victoire (nette, serrée, propre), état final de la carte. | Qualification pour l'étape suivante, humeur du public, réputation sportive. |
| **2. Le voyage** | Choisir la prochaine destination parmi 2 ou 3, sur la carte du monde — où chaque nation porte sa couleur de relation. | Pays visités, itinéraire, pays laissés de côté. | Quels commandants on rencontre, quels rivaux on évite, quels flags de pays resteront vierges. Une nation rivale peut fermer sa destination ; une nation retirée l'a déjà éteinte. |
| **3. Le choix** | Une scène courte à l'arrivée ou après le match : écraser ou laisser sauver la face, dénoncer un tricheur ou en profiter, accepter un sponsor douteux, prêter main-forte à un adversaire. | Écriture de flags (pays, commandant, monde), le recalcul de la **relation** de la nation concernée, et une entrée dans le carnet de voyage. | Alliés recrutables, unités spéciales produisibles, rivaux jurés, nations retirées, soupçon envers Atlas, traces persistantes sur la carte. |
| **4. La partie suivante** | Rejouer, avec ce qu'on a récolté : co-commandant, unité spéciale d'une nation alliée, terrain modifié, adversaire remonté, public acquis ou hostile. | — | La boucle recommence, mais la carte et les gens ne sont plus les mêmes. |

### 5.2 La boucle longue

Un **continent** est un acte, et une traversée en compte trois (`08-narration-choix.md` §6). On y dispute trois à cinq étapes, on y rencontre un noyau de commandants, et on en sort avec un bilan : des flags de pays posés, une réputation, un état d'avancement de la trame de fond. La Cinquième Manche progresse d'un acte à l'autre selon ce que le joueur a laissé faire ou empêché ; au dernier continent, elle réclame son dû, et les pays choisissent leur camp en lisant, littéralement, les flags que le joueur a écrits chez eux. La fin obtenue est le résultat de cette addition, pas d'un choix final isolé.

### 5.3 Pourquoi la boucle tient

- **La partie récompense la maîtrise**, le voyage récompense la curiosité, le choix récompense l'attention aux gens. Trois plaisirs différents qui se relaient toutes les vingt minutes.
- **Rien n'est jetable** : un match gagné laisse une carte marquée, un choix laisse une page de carnet, un adversaire laisse une relation — et une nation entière change de couleur sur la carte du monde. Le joueur accumule un monde, pas un score.
- **La rejouabilité est structurelle** : on part de France, on rallie des nations, et **chaque nation ralliée devient un départ possible pour la Ronde suivante** — jusqu'à 24 à force de jouer. À cela s'ajoutent un itinéraire différent à chaque partie et des flags qui ne peuvent pas tous être posés en une seule traversée. Le même terrain ne se joue d'ailleurs pas pareil en février et en août : la saison et la météo rejouent les cartes déjà connues.
- **La Dépêche du jour est à côté de la boucle, pas dedans** (§2.6) : elle donne une raison de revenir sans jamais devenir une étape obligatoire du voyage.

---

## 6. Propositions de ce document au-delà du brief

1. Classification tous publics traitée comme une contrainte de design, pas comme un objectif marketing.
2. Public secondaire scolaire/familial assumé, sans concession sur la profondeur tactique.
3. **Doctrine du marquage** : rendre concret le « jamais de mort » par une règle diégétique (unité marquée, escortée hors du terrain, revient au match suivant). Détaillée dans `01-bible.md`.
4. Cible de durée : 20 à 40 minutes par match, 3 à 5 étapes par continent.
5. Pas de monétisation agressive ; pas de multijoueur compétitif au lancement.
6. Le jeu vivant traité comme un **bonus étanche** et jamais comme une routine quotidienne à entretenir : pas de série à ne pas casser, pas de récompense qu'on rate en dormant. La campagne se termine complète sans avoir joué une seule Dépêche du jour.
