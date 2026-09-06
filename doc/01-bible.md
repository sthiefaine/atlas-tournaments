# 01 — Bible du monde

*Atlas Tournament — document canon. Source de vérité supérieure : `BRIEF.md`, qui prime en cas de contradiction. Tout ce qui dépasse le brief est signalé par **[Proposition]**. Ce document est écrit pour être lu par des humains **et** servi tel quel aux routines IA comme référence canon.*

---

## 0. Comment lire ce document

### 0.1 Pour un humain

Lisez dans l'ordre. Les sections 2 (histoire), 3 (Atlas), 4 (tournoi, dont le climat en §4.5 et le Tableau des délégations en §4.6 et la Dépêche du jour en §4.7) posent le monde ; la section 5 (ton) et la section 7 (sensibilité) sont les règles d'écriture ; la section 6 (archétypes) et la section 8 (flags) sont les boîtes à outils réutilisables.

### 0.2 Pour une routine

Ce document est votre **référence canon**. Règles dures, dans l'ordre de priorité :

1. **Vous ne contredisez jamais ce document.** Si votre production a besoin d'un fait qui n'y est pas, vous l'inventez uniquement dans les zones explicitement ouvertes (§ 7.4) et vous le signalez dans votre sortie JSON (`inventions: [...]`), sans jamais le présenter comme canon.
2. **Vous n'inventez jamais de flag.** Vous n'utilisez que les flags de la section 8, ou un flag construit sur un gabarit de la section 8.1 avec un code pays existant.
3. **Vous respectez le vocabulaire de la section 5.** Un seul mot interdit dans une production suffit à la faire rejeter par la routine contrôle.
4. **Vous respectez la charte de sensibilité de la section 7.** Ce n'est pas une préférence de style : c'est un critère de rejet automatique.
5. **En cas de doute, vous ne produisez pas.** Une mission signalée en quarantaine coûte moins cher qu'une ligne à retirer après coup.
6. **Vous n'écrivez pas de valeurs de flags dans un état de partie.** Vous *déclarez* dans votre JSON quels flags une scène lit et quels flags elle écrit ; le moteur applique. **[Proposition]**

---

## 1. Le monde en dix lignes

- Les nations ne se font plus la guerre : elles disputent des **Jeux Tactiques**, sur une grille, sur un terrain réel, devant un public.
- Chaque pays entretient une **équipe** nationale et un **commandant** qui la mène.
- Tous les quatre ans, une **Ronde** — le tournoi mondial — fait le tour de la planète. Chaque nation reçoit les autres sur son sol.
- L'organisation **Atlas** possède le règlement, les arbitres, les cartes et la diffusion. Elle est neutre par construction et le répète beaucoup.
- Le trophée s'appelle l'**Atlas d'Or**. Il ne se garde pas : on l'emprunte quatre ans.
- Le joueur est un jeune commandant qui gagne sa sélection nationale, puis fait le tour du monde.
- À l'intérieur d'Atlas, une faction, **la Cinquième Manche**, considère que le tournoi a désarmé le monde et veut lui rendre ses enjeux réels.
- Les choix du joueur décident quels pays suivent qui, le jour où ça éclate.
- Le ton est celui du sport de haut niveau : rivalités, public, commentateurs, sponsors, protêts, sanctions.
- Personne ne meurt. Jamais. C'est une règle du monde autant qu'une règle d'écriture.

---

## 2. Histoire des Jeux Tactiques

> **Contrainte absolue.** Cette histoire ne comporte **aucune date réelle, aucun événement réel, aucun conflit réel, aucun dirigeant réel, aucun traité réel**. Elle se raconte comme une fable fondatrice, volontairement imprécise sur son avant, et précise sur son après. Une routine qui a besoin d'un repère temporel utilise le calendrier interne (§ 2.5), jamais une année du calendrier réel.

### 2.1 Les Vieilles Manières

Avant, on réglait les différends « à l'ancienne ». Le monde d'Atlas n'en dit pas plus, et le jeu non plus. On appelle cela **les Vieilles Manières**, toujours au pluriel, toujours sans exemple. Les vieux commandants disent « avant » en baissant la voix ; les jeunes trouvent ça théâtral. Personne ne raconte une bataille, personne ne nomme un vainqueur, personne ne montre une image. C'est un hors-champ permanent : ce qui donne du poids au tournoi, ce n'est pas ce qu'on sait des Vieilles Manières, c'est le soin obsessionnel qu'on met à ne pas y revenir.

**Règle d'écriture :** on peut évoquer les Vieilles Manières comme une gêne, un tabou, une menace abstraite. On ne les illustre jamais, on ne les date jamais, on ne les localise jamais.

**[Proposition] Le seul qui a connu l'avant : Barnab Estève, « le Dernier Arbitre ».** Un très vieux commandant, encore en activité par dérogation permanente du Collège, et la seule personne du jeu dont on sait qu'elle se souvient. Il ne raconte rien. Il **se conduit** : il salue avant et après chaque manche, refuse les objectifs alternatifs, rend lui-même le matériel adverse au dépôt, et coupe court dès qu'un commentateur essaie de le faire parler. Son unique réplique sur le sujet est la limite absolue du monde, et elle est écrite à la main, jamais générée :

> *« On a essayé autrement. Ça ne s'est pas bien passé. »*

C'est tout. Aucune bataille, aucun vainqueur, aucune date, aucun lieu — la règle d'écriture ci-dessus n'a pas d'exception, pas même pour lui. Il est jouable comme **général secret** (`13-campagne.md` §7.2, n° 7), donc **jamais indispensable** : le plus ancien commandant du monde est une option, et c'est exactement ce qu'il faut qu'il soit.

### 2.2 L'idée du terrain

Le basculement, dans la légende officielle d'Atlas, ne vient pas des puissants mais des **cartographes**. Deux voisins se disputaient une vallée ; plutôt que de la parcourir en armes, ils la parcoururent en équipes, avec des règles, un arbitre et des jetons de marquage. Celui qui tenait le point haut à la fin de la journée obtenait la vallée pour dix ans, à charge de rejouer ensuite. Les deux camps rentrèrent entiers, ce qui n'était pas l'usage, et l'histoire se répandit parce qu'elle se racontait bien.

Le principe qui en reste tient en une phrase, gravée sur chaque terrain homologué :

> **« Le sol se gagne à la journée, et se rend au coup de sifflet. »**

### 2.3 Le Pacte du Terrain

Les nations qui adoptèrent la méthode signèrent le **Pacte du Terrain** dans un port neutre, **Port-Méridien**, une île sans population permanente qui n'appartient à personne et sert depuis de siège à Atlas. **[Proposition : Port-Méridien et son statut sont une invention de cette bible.]**

Le Pacte tient en quatre articles, connus de tous les commandants :

1. **Le terrain est prêté.** Aucun match ne transfère une population, seulement un droit, une place, un titre.
2. **Le matériel est marqué.** Rien de ce qui entre sur un terrain homologué ne peut mettre quelqu'un hors d'état de rejouer (§ 5.3).
3. **L'arbitrage est extérieur.** Ni l'hôte ni le visiteur n'arbitrent.
4. **Le refus de jouer se paie plus cher que la défaite.** Un forfait coûte davantage au classement qu'un match perdu, et beaucoup plus à la réputation.

### 2.4 Naissance d'Atlas

Atlas naît comme un service technique : il fallait quelqu'un pour homologuer les terrains, former les arbitres et tenir les registres. L'organisation grossit avec la Ronde : diffusion, calendrier, logistique de voyage, contrôle du matériel, gestion des sponsors. Aujourd'hui, Atlas est la seule institution que le monde entier reconnaît, ce qui est sa force et son problème : **on lui a confié la paix comme on confie un stade à un gardien.**

### 2.5 Le calendrier interne

Le temps se compte en **Rondes** : une Ronde = un cycle de quatre ans = un tour du monde complet du tournoi. On écrit « Ronde VII », « la troisième étape de la Ronde XI ». Le jeu se déroule pendant la **Ronde XIV**. **[Proposition : la numérotation et la Ronde en cours sont une invention de cette bible ; elles fixent l'âge de l'institution à environ cinquante ans, assez pour qu'elle soit solide, assez peu pour que des vétérans se souviennent d'avant.]**

**Règle d'écriture :** jamais « en 2019 », toujours « à la Ronde XI ». Jamais « il y a trente ans », plutôt « il y a sept Rondes ».

### 2.6 Ce que l'histoire ne dit jamais

| Interdit | Pourquoi |
|---|---|
| Nommer un pays réel comme initiateur ou victime des Vieilles Manières | Désigne un coupable réel |
| Dater le Pacte dans le calendrier réel | Accroche la fiction à l'histoire réelle |
| Décrire une bataille, même ancienne, même inventée mais située | Rouvre le registre de la guerre |
| Faire d'un pays réel un pays « non signataire » ou « exclu » | Statut politique réel déguisé |
| Expliquer la paix par une religion, une idéologie, un régime | Hors périmètre absolu |

---

## 3. L'organisation Atlas

### 3.1 Rôle et principes

Atlas ne joue pas : Atlas rend le jeu possible. Elle **homologue** les terrains, **forme** les arbitres, **tient** les registres et les classements, **organise** le voyage de la Ronde, **contrôle** le matériel et **diffuse** les matchs. Trois principes affichés partout dans ses locaux :

- **Neutralité** : le personnel d'Atlas n'a pas de nation. **[Proposition]** En entrant à Atlas, on rend son drapeau ; on est un **sans-drapeau**. C'est pourquoi les figures d'Atlas portent des noms inventés, sans origine identifiable : c'est un choix de fiction *et* un garde-fou éditorial (aucune faute d'Atlas ne peut être imputée à un pays réel).
- **Transparence** : chaque match est enregistré, chaque décision d'arbitrage est motivée par écrit.
- **Continuité** : la Ronde n'est jamais annulée. C'est la fierté d'Atlas, et le levier exact sur lequel appuie la faction dissidente.

### 3.2 Les organes

| Organe | Rôle | Ce qu'il pèse dans le jeu |
|---|---|---|
| **Le Bureau** | Direction générale, calendrier, sponsors, relations avec les fédérations nationales | Donne les autorisations, ferme les portes, fait pression |
| **Le Collège des arbitres** | Règlement, arbitrage, sanctions, protêts | Source des preuves, des disqualifications, des enquêtes |
| **La Régie** | Diffusion, commentaire, images officielles, récit public du tournoi | Fabrique la réputation du joueur auprès du public |
| **L'Intendance** | Voyage, hébergement, logistique de la Ronde | Justifie diégétiquement le carnet de voyage et le choix de destination |
| **La Cartographie** | Homologation des terrains, relevés, traces persistantes | Justifie diégétiquement l'état persistant des cartes |
| **La Commission d'homologation** | Contrôle et autorisation du **matériel** : ce qui a le droit d'entrer sur un terrain, et sous quel statut | Justifie diégétiquement l'arrivée de nouvelles unités au catalogue |

**[Proposition] La Commission d'homologation.** Ce que la Cartographie fait aux terrains, la Commission le fait au matériel. Elle siège à Port-Méridien, à huis clos, et publie quatre fois par Ronde une liste que tout le monde attend : ce qui entre au catalogue, ce qui y reste, ce qui en sort. Son vocabulaire est passé dans la langue courante des commandants, et il correspond exactement aux quatre statuts d'une pièce de matériel :

| Statut | Ce que la Commission en dit | Ce qu'on voit sur le terrain |
|---|---|---|
| `canon` | « matériel de fondation » — les dix pièces du règlement d'origine, jamais retirées | Rien de particulier : c'est le matériel que tout le monde connaît |
| `essai` | **« matériel à l'essai »** — autorisé en exhibition seulement, le temps d'une observation | Un **badge orange** peint sur la coque, visible de loin. Le public le repère avant les commentateurs, et Vantour en fait tout un plat |
| `homologuee` | « admis au catalogue » — utilisable partout, y compris en Ronde | Le badge disparaît ; la pièce entre dans les fiches d'équipe |
| `retiree` | **« retiré du catalogue »** — la pièce ne rentre plus sur un terrain homologué | Elle finit en vitrine, ou en pièce de collection dans un dépôt. On en parle au passé |

Le catalogue est **plafonné** : la Commission refuse de le laisser grossir indéfiniment, et elle retire volontiers ce qui ne sert pas. Ses décisions se contestent — un protêt d'homologation est une procédure ordinaire, parfois bruyante, et un pays qui voit son matériel retiré la veille d'une étape ne le prend jamais bien (`monde.atlas.homologation_contestee`, §8.4).

**Ce que la Commission ne change pas :** le scandale absolu de ce monde reste le **matériel non homologué** (§5.3) — celui qui n'a demandé aucun statut, qui n'a pas de badge et n'a jamais eu de dossier. Une pièce à l'essai est une pièce surveillée ; une pièce non homologuée est une pièce qui triche. La Cinquième Manche joue précisément sur la confusion entre les deux.

### 3.3 Les figures

#### Osmin Talvarec — directeur d'Atlas, dit « le Cartographe »

Un homme long, calme, qui parle par cartes. Ancien géomètre entré à Atlas par le service d'homologation, monté jusqu'au Bureau sans jamais avoir été commandant — ce qu'on lui reproche et ce dont il tire une fierté froide. Sa conviction : le tournoi est une machine fragile qui tient parce que personne ne la regarde de trop près, et son devoir est qu'on continue de ne pas la regarder. Il n'est **pas** le méchant ; il est pire, il est prudent. Face à un scandale, son premier réflexe est de protéger la Ronde, pas la vérité, et c'est exactement cette prudence que la faction exploite.

- **Ce qu'il veut :** que la Ronde XIV aille à son terme sans incident.
- **Ce qu'il craint :** un dossier public qu'il ne pourrait pas classer.
- **Rapport au joueur :** paternaliste, puis méfiant à mesure que `monde.atlas.soupcon` monte. Il peut devenir un allié tardif si `monde.atlas.credibilite` est haute.
- **Tic :** il déplie une carte pour éviter de répondre.

#### Nera Aldouin — arbitre en chef, dite « la Ligne Blanche »

Petite, sèche, sifflet en acier hérité de son maître d'arbitrage. Elle a arbitré quatre Rondes et n'a jamais reculé sur une décision. Elle applique le règlement à la lettre, y compris contre les intérêts d'Atlas, ce qui lui vaut d'être indispensable et détestée au Bureau. Elle tient les archives des protêts — le seul endroit où les anomalies du tournoi sont écrites noir sur blanc.

- **Ce qu'elle veut :** que le règlement soit plus fort que ceux qui l'écrivent.
- **Ce qu'elle craint :** avoir validé, sans le voir, un match arrangé.
- **Rapport au joueur :** distante, puis alliée décisive. Elle est la porte d'entrée du dossier contre la Cinquième Manche (`monde.atlas.arbitre_alliee`).
- **Tic :** elle ne dit jamais « je crois », elle dit « au règlement, article… ».

#### Célestin Vantour — présentateur-commentateur, dit « la Voix »

Le visage d'Atlas. Costume voyant, enthousiasme professionnel, mémoire encyclopédique des matchs. Il commente chaque rencontre de la Ronde et fabrique, phrase après phrase, la légende ou la réputation de ruine de chaque commandant. Il n'est ni corrompu ni naïf : il est en représentation, et il sait très bien qu'un tournoi qui n'a plus rien à raconter est un tournoi qui meurt — ce qui le rend dangereusement réceptif au récit que lui souffle la faction.

- **Ce qu'il veut :** la meilleure histoire de la Ronde. Et que ce soit la sienne.
- **Ce qu'il craint :** l'ennui, et le silence de l'antenne.
- **Rapport au joueur :** c'est le miroir public. Il commente les choix du joueur, et sa relation (`monde.regie.faveur`) décide si le joueur est raconté comme un champion ou comme une brute.
- **Tic :** il baptise tout le monde d'un surnom au bout de trois minutes, et ces surnoms restent.
- **Rôle système :** **[Proposition]** c'est par sa voix que le jeu rappelle au joueur les conséquences de ses choix passés, en début de match. Un narrateur diégétique, gratuit, qui rend les flags audibles.

#### **[Proposition]** Le Consortium Méridien

Sponsor principal de la Ronde. Une entité commerciale apatride, sans pays, sans visage : des banderoles, des contrats, des enveloppes. Sert à porter les choix de « sponsor douteux » du brief sans impliquer une entreprise ou un pays réels. Relation suivie par `monde.atlas.sponsor_meridien`.

### 3.5 **[Proposition]** Les figures qu'on ne voit pas d'abord — les généraux secrets

Atlas emploie des gens qui ont su jouer, et quelques-uns savent encore. Dix d'entre eux sont **jouables** une fois un `Deblocage` acquis (`13-campagne.md` §7, propriétaire de la liste, des conditions et de leurs styles de pouvoir) : trois figures d'Atlas (Talvarec, Aldouin, Vantour), la présidente de la Commission d'homologation, l'intendante de la Ronde, une juge de terrain sans-drapeau qu'on n'appelle plus que par son dossard, une ancienne finaliste malheureuse entrée à Atlas après sa seconde défaite, la figure visible de la Cinquième Manche, le plus vieux commandant en activité, et un Cinquième sans grade.

Trois règles de lore, qui sont aussi des règles de conception :

1. **Ils sont des sans-drapeau, ou ils l'ont choisi.** Les figures d'Atlas ont rendu leur nationalité (§3.1) ; c'est pour cela que leurs noms sont inventés et non localisables, et c'est un garde-fou éditorial autant qu'un trait de fiction. Un général secret ne représente **jamais** un pays réel.
2. **Ils ne changent rien à l'histoire.** Aucune fin, aucun fil obligatoire, aucune destination, aucun autre déblocage ne dépend d'eux. C'est la doctrine **« jamais indispensable »** : un joueur qui n'en débloque aucun voit tout le jeu et obtient toutes les fins.
3. **Ils sont équilibrés comme les autres.** Même budget de barres, un passif, un pouvoir, un super pouvoir plus cher, et **une faiblesse déclarée et réellement défavorable** (§6). La routine contrôle les simule comme n'importe quel commandant et rejette un général secret trop fort — un secret n'achète aucune indulgence.

Diégétiquement, ils ne descendent pas sur le terrain par caprice : chacun a un motif écrit, et il faut le lui donner. C'est ce que le système de déblocage encode.

### 3.4 La faction dissidente : **la Cinquième Manche**

**Nom.** Un match de Jeux Tactiques se dispute en quatre manches. La faction tire son nom de l'idée qu'il en manque une : celle qui se jouerait **hors du terrain**, et qui seule dirait qui gagne vraiment. Ses membres se disent « les Cinquièmes ». Leur signe : quatre traits et un cinquième barré, tracés à la craie sur un mur de vestiaire.

**Mobile.** Ils ne veulent pas le chaos ; ils croient tenir une vérité désagréable. Pour eux, le Pacte du Terrain n'a pas aboli les Vieilles Manières, il les a **anesthésiées** : les nations ne se règlent plus rien, elles se distraient. Un monde où plus rien ne coûte rien ne produit plus ni courage, ni mérite, ni grandeur — seulement des champions bien coiffés et un public repu. Ils veulent « rendre les enjeux » : que le résultat d'un match engage à nouveau quelque chose de réel. Ils sont sincères, articulés, et ils ont un point : le tournoi *est* devenu une industrie, et Atlas *a* classé des affaires.

**Où ils se trouvent.** À l'intérieur d'Atlas, à tous les étages — un cadre du Bureau, des arbitres, des techniciens de la Cartographie, un ou deux commandants nationaux vieillissants. Jamais dans un pays : **la Cinquième Manche n'a pas de nationalité, et aucune routine, aucun dialogue, aucun visuel ne peut la rattacher à un pays réel, à une culture réelle, à une région du monde réelle.** C'est une règle dure, pas une préférence.

**Figure visible : Hadran Ost, dit « le Recordman ».** Ancien commandant, détenteur d'un record de matchs remportés d'affilée, cassé par une disqualification qu'il juge injuste, reconverti au service du matériel d'Atlas. Poli, chaleureux, désarmant. Il ne recrute pas en menaçant : il recrute en donnant raison. Sa phrase : *« Tu as gagné. Et alors ? Qu'est-ce que ça a changé ? »*

**Figure cachée.** **[Proposition]** Ost n'est pas la tête ; il est le visage. La tête est au Bureau, et son identité est le sujet du troisième acte (`monde.cinquieme.chef_identifie`). Deux candidats crédibles doivent rester ouverts jusque-là : un cadre du Bureau, et le Consortium Méridien lui-même — un commanditaire sans conviction, à qui un tournoi à enjeux réels rapporterait simplement davantage.

**Méthodes.** Elles restent sportives et administratives, jamais militaires : matchs arrangés, dossiers d'arbitrage égarés, terrains sabotés avant homologation, forfaits provoqués, chantage au contrat, campagnes de commentaire. La faction ne tue personne, ne fait exploser aucune ville et ne lève aucune troupe. Sa victoire, ce n'est pas une invasion : c'est **la suspension de la Ronde**, et un monde qui, pour la première fois depuis le Pacte, ne sait plus comment se départager. Le jeu s'arrête exactement là (§ `08-narration-choix.md`, fin C).

**Ce que la Cinquième Manche n'est jamais :** un pays, une armée, une religion, une idéologie réelle, un groupe ethnique, une organisation réelle transposée. Jamais.

#### **[Proposition]** L'équipe d'Atlas : la Sélection Méridienne, dite « les Gris »

Atlas aligne officiellement sa propre équipe. Elle existe pour deux raisons que personne ne conteste : les **matchs d'exhibition** — une Dépêche a besoin d'un adversaire quand aucune délégation n'est disponible — et les **essais d'homologation**, où une pièce à l'essai (§3.2) doit être jouée par quelqu'un avant d'entrer au catalogue. Elle est financée par le Consortium Méridien, dont elle porte le nom sur le maillot. Que le sponsor de la Ronde ait son nom sur l'équipe de l'organisation n'a jamais paru étrange à personne, et c'est le premier indice.

Ses commandants sont des sans-drapeau (§3.1) ; **Hadran Ost** la dirige. Ses couleurs : le gris, et le **badge orange** du matériel à l'essai, qu'elle est la seule à porter en permanence. Le public l'appelle « les Gris ». Elle n'a ni pays, ni continent, ni climat, ni rival naturel, ni région ; elle n'est jamais une destination. On ne la visite pas, elle vient à vous.

**Ce qu'elle est dans la trame** (`08-narration-choix.md` §6). À l'acte I, un adversaire anodin : on la croise en exhibition, elle joue proprement, elle perd souvent. À l'acte II, c'est dans **son** dépôt que le matériel non homologué est retrouvé, et le Bureau classe l'affaire en disant qu'un dépôt d'essai contient forcément des pièces sans badge — exactement la confusion entre essai et non-homologué que la faction exploite (§3.2). À l'acte III, elle est **la faction sur le terrain** : l'équipe qui vient disputer la manche « à enjeux réels » à Port-Méridien, avec à ses côtés les nations retirées passées à la faction. C'est la forme sportive que prend une menace institutionnelle : la faction ne lève pas de troupes, elle a une équipe, et cette équipe joue avec des pièces qui trichent.

**Ce que ça apporte, et ce que ça ne change pas.** Le joueur a un adversaire à l'acte III même s'il a bien joué et qu'aucune nation ne s'est retirée — sans elle, le dernier acte d'un bon parcours n'aurait personne à affronter. Le point culminant reste le coup de sifflet qui ne vient pas : la Sélection n'envahit rien, elle dispute un match, et le scandale est qu'elle le dispute avec du matériel non homologué. Les règles dures de ce paragraphe tiennent entièrement : l'équipe n'est pas un pays, n'a pas de culture, et ses commandants sont des sans-drapeau aux noms inventés. Elle rend le Consortium plus crédible comme tête cachée, sans trancher : un cadre du Bureau peut tout aussi bien l'avoir montée.

**Dans les données.** Ce n'est pas une `Country` : une fiche pays porte un continent, un climat, un rival naturel et des voisins, et aucun n'a de sens ici. C'est un **code de camp à trois lettres**, `atl` — les nations gardent leur code ISO à deux lettres ; les trois lettres sont réservées aux camps sans drapeau —, un style de camp (`content/styles/atl.json`, gris et orange), des commandants dont Ost, et des scénarios qui lui donnent le catalogue à l'essai puis, à l'acte III, des pièces non homologuées. Le même code sert de **code de terrain à Port-Méridien**, qui n'appartient à aucune nation et n'en avait pas : la finale mondiale est un scénario `paysCode: 'atl'`, et ce qui s'y passe s'écrit sous `pays.atl.*`.

---

## 4. Le format du tournoi

### 4.1 La qualification nationale

Avant la Ronde, chaque nation désigne son commandant. Le joueur y passe : c'est le prologue de sa partie. La sélection prend la forme d'un tour du pays hôte, en **régions**, chaque région apportant une mécanique de terrain propre. La France, premier pays entièrement détaillé, se qualifie sur **18 régions** (13 métropolitaines + Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), la Nouvelle-Calédonie et la Polynésie française pouvant constituer des étapes bonus en tant que collectivités. Le système de régions est générique et se réapplique à tout pays phare.

Les pays qui ne sont pas « phares » ont une qualification résumée en une scène, construite depuis leur fiche.

### 4.2 Les phases continentales

La Ronde progresse par continents ; **un continent = un acte** de la narration, et une traversée en compte **trois** (`08-narration-choix.md` §6). À chaque étape, le joueur choisit sa prochaine destination parmi deux ou trois pays hôtes. Un continent comporte trois à cinq étapes, se conclut par une **finale continentale**, et la Ronde se termine par la **finale mondiale** et la remise de l'Atlas d'Or.

**[Proposition]** Ordre des actes indexé sur le pays de départ : on commence par son propre continent, on finit toujours par un continent qu'on n'a pas encore visité. La finale mondiale se dispute à Port-Méridien, terrain neutre — le seul terrain qui n'appartient à aucune nation, ce qui donne à l'acte III un décor propre.

### 4.3 Le match

Un match oppose deux équipes sur une carte du pays hôte, en **quatre manches**. Une manche est la division *sportive* du match — l'équivalent d'un quart-temps —, pas l'unité de temps du moteur : celle-ci est la **journée** (un tour de chaque camp, `04-gameplay.md` §1). Un match homologué dure `Scenario.limiteJournees` journées, découpées en quatre manches d'égale longueur ; c'est ce découpage qui donne son nom à la Cinquième Manche (§3.4). Conditions de victoire homologuées :

| Condition | Description | Usage |
|---|---|---|
| **Capture du QG** | Tenir le quartier général adverse pendant un tour complet | Condition par défaut, présente sur presque toutes les cartes |
| **Mise hors jeu de l'équipe** | Toutes les unités adverses marquées et sorties du terrain | Toujours valide, rarement la voie la plus rapide |
| **Objectif spécial** | Objectif propre au terrain hôte : tenir trois cols, ouvrir une écluse, escorter un convoi de matériel, occuper le point haut au coup de sifflet | Signature mécanique du pays, définie dans sa fiche |
| **Décision aux points** | Si les quatre manches s'achèvent sans conclusion (`limiteJournees` atteinte) : villes tenues, unités restantes, objectifs partiels. Formule exacte : `04-gameplay.md` §9.1 | Évite les parties infinies **[Proposition]** |
| **Forfait** | Une équipe refuse de jouer ou est disqualifiée | Coûte plus cher qu'une défaite (Pacte, art. 4) |

**Ce qu'un match n'est jamais :** une conquête, une invasion, une occupation, une libération. Un match gagné donne un droit sportif — une place, un titre, un point de classement — jamais un territoire, jamais une population, jamais une autorité sur un pays.

### 4.4 Arbitrage, sanctions, tricherie

Trois arbitres par match : un arbitre central, deux juges de terrain. Les sanctions vont du **rappel** (avertissement) au **carton** (unité retirée de la manche), puis à la **mise hors jeu du commandant** (l'équipe finit sans pouvoir), puis à la **disqualification**. Un commandant peut déposer un **protêt** après le match : le Collège des arbitres tranche, et sa décision est archivée — ces archives sont la matière première du dossier contre la Cinquième Manche.

La tricherie existe et fait partie du sujet : matériel non homologué, terrain modifié avant relevé, match arrangé. C'est le terrain de jeu moral du joueur, et la porte d'entrée de la trame de fond.

### 4.5 Le ciel fait partie du terrain

Atlas ne joue pas en salle. Un match se dispute dehors, à la date à laquelle il est disputé, sous le ciel du pays hôte — et le ciel compte autant que le relief. Les règles chiffrées sont dans `04-gameplay.md` ; voici ce que le monde en dit.

**Le Bulletin.** Vingt minutes avant le coup de sifflet, la Régie diffuse le **Bulletin** : Célestin Vantour annonce la saison, la phase du jour et la **prévision météo des deux prochaines journées**. C'est un rituel autant qu'une information — il l'ouvre toujours de la même façon, il se trompe une fois par Ronde et on le lui rappelle pendant quatre ans. Le Bulletin est **exact** : Atlas ne surprend pas un commandant avec le temps qu'il fait. Un joueur qui perd sous la pluie a été prévenu deux journées à l'avance, et c'est précisément ce qui rend la météo jouable au lieu d'être injuste.

**Les saisons.** La Ronde suit les vraies saisons : un match prend la date du jour où il se dispute, et la saison est celle de l'hémisphère du pays hôte. Recevoir en hiver ou recevoir en été **fait partie du terrain d'un pays**, au même titre que ses montagnes : la Suisse ne reçoit pas la même chose en janvier et en juillet, et jouer le Brésil en janvier, c'est jouer en été. Les délégations le savent, les calendriers se négocient là-dessus, et un hôte qui obtient sa saison favorable n'a rien volé — il a bien lu l'Intendance. La saison ne change pas pendant un match.

**La nuit.** Un match ne s'arrête pas à la tombée du jour : c'est une règle sportive, pas un décor. Les manches se poursuivent, la lumière baisse, on voit moins loin, les villes et les quartiers généraux restent éclairés, et certaines équipes sont réputées meilleures à la nuit tombée. Un commandant qui demande l'interruption pour cause d'obscurité est renvoyé à l'article 4 du Pacte : le refus de jouer se paie plus cher que la défaite.

**Vocabulaire imposé.** Trois mots, trois listes fermées, valables pour tous les documents et toutes les routines :

| Terme | Valeurs | Ce qu'on dit dans le monde |
|---|---|---|
| `Saison` | `printemps`, `ete`, `automne`, `hiver` | « la saison de l'hôte », jamais un mois réel |
| `PhaseJour` | `jour`, `nuit` | « la nuit tombe sur la troisième manche » |
| `Meteo` | `clair`, `pluie`, `neige`, `brouillard`, `tempete`, `canicule` | « le Bulletin annonce brouillard sur la deuxième journée » |

**Règle d'écriture.** Le temps qu'il fait est un **fait de match**, jamais un drame : une tempête cloue les appareils au sol et fait un beau commentaire, elle ne dévaste rien, ne blesse personne et ne détruit aucune ville. Une canicule gêne le matériel lourd, elle ne fait pas souffrir un public. Aucun phénomène météorologique réel, daté ou localisé, n'est jamais évoqué (§7.3). Le vent nommé — le mistral, l'alizé — reste une **mécanique régionale** du pays hôte, pas une météo.

### 4.6 Le Tableau des délégations : comment Atlas annonce un ralliement, un grief, un retrait

**[Proposition : la mise en fiction est une invention de cette bible ; le dispositif — quatre états de relation, cinq retraits au plus — est fixé par `BRIEF.md`.]**

Dans le hall de l'Intendance, à Port-Méridien, il y a un panneau de bois clair où sont accrochées les plaques des délégations engagées dans la Ronde en cours. C'est le **Tableau des délégations**, et c'est là que le monde apprend qui joue avec qui. On le regarde beaucoup, on n'en parle pas fort.

**Un ralliement s'annonce par une ligne dans le programme.** Quand une délégation décide d'accompagner un commandant sur la fin de sa Ronde — de lui prêter son matériel, un assistant déclaré, un terrain d'entraînement —, l'Intendance le note comme elle note un changement d'horaire : *« Suisse — engagée aux côtés de la délégation française à partir de la quatrième étape. »* Pas de communiqué, pas de cérémonie. Solveig Tamm accroche les deux plaques côte à côte, et ceux qui passent dans le hall le remarquent avant que Vantour n'en fasse un mot à l'antenne. Le ton du monde tient dans ce détail : un ralliement est une **ligne d'organisation**, pas un serment.

**La délégation prête son banc.** Quand un engagement va plus loin qu'une ligne au programme, la délégation qui accompagne un commandant lui **prête son banc** pour une rencontre : son général dirige depuis les gradins, l'invité s'assoit à sa place, joue son matériel et ses consignes, et la plaque reste la même au Tableau. L'Intendance appelle cela un banc prêté ; les commentateurs disent « il joue leurs couleurs ce soir », et personne n'y voit un changement de camp — c'est un échange d'entraîneurs, à la manière d'une fédération, et l'on rend le banc au coup de sifflet final.

**Un grief s'annonce par un silence poli.** Une délégation fâchée ne dénonce personne : elle demande simplement à ne plus être programmée en même temps, et elle joue plus dur quand le calendrier la remet en face. Vantour, qui sait tout, dit *« retrouvailles »* avec une virgule un peu longue avant le mot.

**Un retrait s'annonce en trois phrases, et c'est le seul moment où la Régie ne commente pas.** Une délégation qui se retire de la Ronde le fait par une note affichée au Tableau, toujours de la même longueur : ce qu'elle retire (son équipe), à partir de quand (la prochaine étape), et une formule de politesse. Sa plaque est retournée, face bois. Personne ne la décroche — retourner suffit, et c'est plus dur à regarder qu'un trou. Nera Aldouin contresigne, parce que le Pacte l'exige ; Osmin Talvarec descend dans le hall et reste devant un moment ; Vantour ouvre son Bulletin suivant sur la météo, comme d'habitude, et ne dit rien du tout. **Un retrait n'est jamais un drame, jamais une rupture diplomatique, jamais une menace** : c'est une équipe qui rentre chez elle, et un sport qui compte une équipe de moins ce mois-ci. On ne montre pas de foule en colère, on ne cite pas de gouvernement, personne ne claque de porte. Ce qui rend la chose lourde, c'est précisément qu'elle soit si petite et si calme.

**Ce qu'Atlas ne dit jamais, et ce que les routines n'écrivent donc jamais** : qu'un retrait est une rupture entre deux peuples, qu'une nation « quitte le camp du joueur », qu'un ralliement est une alliance militaire. Le vocabulaire est celui d'une fédération sportive et d'une organisation logistique : on **s'engage aux côtés de**, on **demande à ne plus être programmé avec**, on **retire son équipe**. Et quand une délégation revient — cela arrive, un grief se répare —, elle revient comme on revient : sa plaque est remise à l'endroit, sans commentaire.

### 4.7 La Dépêche du jour

**[Proposition : la mise en fiction de la mission du jour est une invention de cette bible ; le dispositif lui-même est fixé par `BRIEF.md`.]**

Entre deux étapes de la Ronde, la Régie diffuse la **Dépêche du jour** : une **manche d'exhibition**, une seule par jour, disputée quelque part dans le monde en écho à ce qui s'y passe ce jour-là. Un festival, une course, une première ascension, une saison remarquable, un anniversaire de fédération, une découverte : Atlas y voit une occasion de faire jouer un terrain et Vantour une occasion de commenter. La Dépêche est annoncée le matin, jouable une semaine, puis rangée aux archives de la Régie.

**Ce qu'elle est dans le monde :** une exhibition, hors classement, sans conséquence sur la Ronde. Personne ne se qualifie par une Dépêche, personne n'y perd sa place. Les commandants y viennent pour le plaisir, pour tester du matériel à l'essai (§3.2) ou parce que Vantour les a appelés la veille.

**Ce qu'elle n'est jamais :** une dépêche sur un drame. Atlas ne commente pas une catastrophe, un accident, un fait divers, une crise, un conflit, une élection. La règle de ton est simple et sans exception : **on ne fait pas jouer un match par-dessus le malheur de quelqu'un.** Un événement du monde n'entre dans la Dépêche que s'il appartient au registre autorisé (§7.2) — sport, fête, culture, exploit, découverte, science, saison remarquable. Dans le doute, il n'y a pas de Dépêche ce jour-là : le vide vaut mieux qu'une faute.

**Conséquence de règle :** une Dépêche n'écrit **aucun** flag de campagne. Elle ne peut rien changer au voyage, aux rivalités ni à la trame ; sa récompense est cosmétique, ou une carte de terrain au plus (`08-narration-choix.md` §4.4).

---

## 5. Guide de ton

### 5.1 Registre

Sport de haut niveau, chaleureux, un peu cabot. Le modèle n'est pas le film de guerre, c'est la retransmission d'un grand tournoi : vestiaires, superstitions, entraîneurs, public, banderoles, interviews d'après-match. L'humour est **affectueux**, jamais moqueur envers une culture ; l'ironie se dirige vers Atlas, les sponsors, les commentateurs et les commandants eux-mêmes, jamais vers un peuple.

**Longueur.** Une réplique tient en une à trois phrases. Une scène de choix tient en six à dix répliques. On ne fait jamais lire un paragraphe au joueur entre deux matchs.

### 5.2 Vocabulaire

| Interdit | Imposé |
|---|---|
| ennemi | **adversaire**, concurrent, hôte, visiteur |
| guerre, conflit, front | **match**, rencontre, manche, tournoi, Ronde |
| bataille, combat (comme événement) | **match**, échange, duel (sportif) |
| armée, troupes, soldats | **équipe**, sélection, effectif, joueurs |
| tuer, mourir, mort, blessé, victime | **mettre hors jeu**, marquer, sortir du terrain |
| détruire une unité | **mettre hors jeu**, retirer du terrain |
| envahir, invasion, occuper, conquérir | **prendre le terrain**, tenir, capturer (un point), avancer |
| libérer, annexer, coloniser | *(aucun équivalent : ces notions n'existent pas dans ce monde)* |
| arme, armement, munitions | **matériel**, équipement homologué, marqueurs, charges de marquage |
| sang, cadavre, ruines, civils, réfugiés | *(aucun équivalent : hors périmètre)* |
| régime, gouvernement, président, ministre, parti, élection | **fédération nationale**, sélectionneur, délégation |
| frontière (au sens de dispute) | **ligne de terrain**, limite de carte |
| religion, foi, culte, dieu | *(hors périmètre)* |
| ennemi juré | **rival**, rivalité |
| massacre, anéantir, écraser (un pays) | on peut « écraser » un adversaire **au score**, jamais un pays |

**Zone grise assumée.** Les unités gardent leurs silhouettes de blindés, d'artillerie, d'hélicoptères : c'est la grammaire lisible du genre. On les nomme **matériel homologué** dans le texte officiel, et on les désigne par leur usage (blindé de percée, pièce de portée, appareil de reconnaissance) plutôt que par un lexique militaire. On ne les fait jamais « tirer sur » quelqu'un : elles **marquent**.

### 5.3 **[Proposition]** La doctrine du marquage

Pour que « personne ne meurt » soit une règle du monde et pas une pudeur d'écriture : tout matériel homologué embarque des **charges de marquage**. Une unité touchée est *marquée* ; au-delà d'un seuil, les juges de terrain la déclarent **hors jeu** et l'escortent au dépôt, où l'équipage retire son plastron et va boire quelque chose. Une unité hors jeu revient au match suivant. C'est pourquoi l'article 2 du Pacte existe, pourquoi le contrôle du matériel est un enjeu, et pourquoi du **matériel non homologué** est le scandale absolu de ce monde — et une arme narrative pour la Cinquième Manche.

### 5.4 Réglage de la trame de fond

La menace est **institutionnelle**, jamais militaire. Un moment de tension se joue en salle des archives, en couloir de Bureau, en conférence de presse, sur un terrain saboté avant homologation — pas dans une explosion. Le point culminant de l'acte III n'est pas une bataille : c'est un **coup de sifflet qui ne vient pas**.

---

## 6. Archétypes de commandants

Dix archétypes réutilisables. Chaque fiche pays choisit un archétype (et éventuellement un second, en teinte). L'archétype fixe le **tempérament**, la **famille de pouvoir** et la **courbe** ; la fiche pays fournit l'habillage culturel et géographique.

> **Liste canon, propriétaire.** Cette table est **la** liste des archétypes du projet (`BRIEF.md`, arbitrage n° 1 du 5 septembre 2026). Ce sont les dix de `06-pays-de-depart.md` §2 — déjà affectées aux 24 pays, à raison de deux à trois pays par archétype —, augmentées des colonnes d'équilibrage de cette bible. Un seul remplacement par rapport à `06` : **« le professeur » devient « la météorologue »**, parce que le climat entre dans le jeu (§4.5) et qu'un archétype qui lit le ciel vaut mieux qu'un doublon du stratège. Les pays qui portaient « le professeur » sont réaffectés dans `06`. **Aucune routine ne choisit un archétype hors de cette table.** Le genre du libellé n'impose pas celui du commandant : un pays « la fonceuse » peut avoir un commandant masculin, et l'inverse.

La colonne **Clé** est celle que les données emploient : c'est la valeur de `Country.archetypeCommandant` et de `Commander.archetype` (`03-schemas.md` §1 et §2, où le type `Archetype` reprend cette union fermée), et c'est elle, jamais le libellé accentué, qui circule en JSON.

| # | Clé | Archétype | Tempérament | Famille de pouvoir | Courbe | Contré par |
|---|---|---|---|---|---|---|
| 1 | `stratege_prudent` | **Le stratège prudent** | Posé, avare de mots, joue trois coups plus loin | Défense et prévoyance : bonus en terrain fortifié, réduction des dégâts subis, prévisualisation d'une intention adverse | Lente, très forte en fin de match | La fonceuse, le showman |
| 2 | `fonceuse` | **La fonceuse** | Impatiente, franche, allergique à l'attente | Mouvement et initiative : mouvement supplémentaire, seconde action, charge qui ignore un malus de terrain | Explosive tôt, s'essouffle | La gardienne, la survivante |
| 3 | `veteran` | **Le vétéran** | Bourru, protecteur, plein d'anecdotes de Rondes passées | Vétérance : unités promues qui gardent leurs bonus, remise en état d'une unité marquée, moral d'équipe | Régulière, cumule sur la durée | La météorologue, le prodige |
| 4 | `ingenieur` | **L'ingénieur** | Méthodique, bricoleur, parle de la carte comme d'un chantier | Terrain construit : ponts temporaires, remblais, réparation de villes, blocage d'un passage | Moyenne, dépend de la carte | La fonceuse, la météorologue |
| 5 | `diplomate` | **La diplomate** | Chaleureuse, manœuvrière, connaît tout le monde dans le stade | Capture et économie : capture accélérée, revenu majoré, ralliement d'une ville neutre, ravitaillement à distance | Très lente, écrasante si le match dure | La fonceuse, le showman |
| 6 | `showman` | **Le showman** | Théâtral, généreux, joue pour le public | Élan : bonus qui monte avec les actions réussies et le public acquis, relance après une action spectaculaire, effets voyants | En dents de scie, dépend du momentum | Le stratège prudent, la gardienne |
| 7 | `survivante` | **La survivante** | Sobre, tenace, ne commente jamais le score | Résilience : remise en état, résistance, effets qui montent à mesure que l'équipe est menée | Inverse : discrète en tête, redoutable menée | Le prodige, la diplomate |
| 8 | `meteorologue` | **La météorologue** | Rêveuse, fataliste, toujours un œil sur le ciel | Climat : brume qui tombe, pluie qui ralentit, gel qui fige une rivière, vent qui modifie les portées | Irrégulière, très forte sur grandes cartes | Le stratège prudent, la diplomate |
| 9 | `prodige` | **Le prodige** | Jeune, vif, un peu insolent, apprend en jouant | Montée en puissance : gain d'expérience accéléré, déblocage progressif d'un second effet, unité fétiche qui grandit | Nulle au début, la plus haute à la fin | La fonceuse, le showman |
| 10 | `gardienne` | **La gardienne** | Immobile, patiente, presque ennuyeuse | Résistance : zone de contrôle, fortification, riposte automatique, ralentissement de tout ce qui approche — **y compris la capture adverse**, `capture ×0,5` sur `unites_adverses` (`04-gameplay.md` §7.2) | Plate et haute, faible en attaque | L'ingénieur, la météorologue |

**[Proposition]** Les colonnes des trois archétypes que l'ancienne liste de cette bible ne connaissait pas — **la diplomate**, **la survivante**, **le prodige** — et les « contré par » réajustés à cette liste (le Renard et l'Artilleuse n'existent plus) sont des propositions : le brief fixe les dix libellés et l'existence des quatre colonnes, pas leur contenu ligne à ligne.

**Règles d'emploi (pour les routines) :**

- Un archétype **ne dicte pas la personnalité complète** : il donne un axe. Deux commandants du même archétype doivent différer par leur rapport au joueur, leur tic, leur rival et leur objet fétiche.
- Le pouvoir doit se justifier par la **géographie, le climat, la gastronomie, le sport ou le folklore** du pays — jamais par son histoire militaire, sa politique ou sa religion.
- Un archétype **contré par** ne veut pas dire « perd contre » : cela oriente les rivalités naturelles entre commandants, donc les rencontres intéressantes.
- Un co-commandant recruté apporte un **appoint mécanique** — c'est ce qui donne une valeur mécanique, et pas seulement narrative, au fait de traiter correctement ses adversaires. La règle est tranchée (`BRIEF.md`, arbitrage n° 2 du 5 septembre 2026) et sa formulation chiffrée appartient à `04-gameplay.md` §7.5 : un co-commandant apporte **son passif seul, plus une barre de jauge de départ**. Un **commandant régional français** apporte en plus sa **carte de terrain à usage unique** — et cette carte **est l'une des trois** de la sacoche, jamais une quatrième (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5, `07-france-regions.md` §2.4). Plafonds : **trois co-commandants recrutés, un seul actif par match** (`08-narration-choix.md` §4.3), **trois cartes de terrain**, **cinq spécialités possédées et une seule équipée par match**. C'est par ces plafonds qu'on corrige l'inflation de puissance, jamais par une règle nouvelle. **Il n'existe pas de demi-pouvoir** : un archétype ne se joue jamais à moitié, et aucune routine ne doit en produire un.

  Diégétiquement : un co-commandant n'entre pas sur le terrain à votre place. Il est sur le banc, il vous prête sa manière — ce que le règlement d'Atlas appelle une **assistance déclarée**, inscrite à la feuille de match avant le coup de sifflet. On en déclare une, pas trois.

---

## 7. Charte de sensibilité pour les vrais pays

### 7.1 Principe

Un pays réel est représenté **comme on représente une équipe qu'on aime** : par son terrain, sa table, ses fêtes, ses histoires et ses manies. Le test à appliquer à toute production : *un habitant de ce pays pourrait-il rire de ça avec nous, à notre table ?* Si la réponse hésite, on retire.

### 7.2 Ce qu'on peut utiliser

| Registre | Exemples d'usage |
|---|---|
| **Géographie et relief** | Montagnes, fleuves, deltas, îles, déserts, forêts, côtes, altitude, insularité |
| **Climat et saisons** | Mousson, sécheresse, nuit polaire, brouillard, canicule, gel |
| **Gastronomie** | Produits, plats, boissons, marchés, rituels de table, superstitions d'avant-match |
| **Sport et jeu** | Sports populaires, ferveur des supporters, chants, rivalités sportives régionales |
| **Folklore, contes, fêtes** | Créatures de légende, carnavals, festivals, costumes, musiques, danses |
| **Savoir-faire et paysage construit** | Ingénierie (digues, tunnels, trains), artisanat, architecture, agriculture |
| **Clichés affectueux et auto-dérision** | Le cliché qu'un habitant assume en riant : ponctualité, sieste, pluie, café, bavardage, fierté locale |

### 7.3 Ce qu'on n'utilise jamais

- Guerres, batailles, occupations, colonisations, indépendances, traités, quelle que soit l'époque.
- Politique : régimes, dirigeants, partis, élections, lois, mouvements sociaux, symboles politiques.
- Religion : croyances, pratiques, lieux de culte, symboles religieux, calendrier religieux.
- Conflits, tensions ou contentieux réels entre pays, y compris sous forme de plaisanterie ou d'allusion.
- Frontières contestées, territoires disputés, revendications, statut politique d'un territoire.
- Catastrophes, épidémies, famines, attentats, faits divers, crises économiques.
- Stéréotypes portant sur l'origine ethnique, la couleur de peau, la caste, la classe, l'orientation, le handicap, l'intelligence ou l'honnêteté d'un peuple.
- Pauvreté, corruption, criminalité, insécurité présentées comme un trait national.
- Personnes réelles, vivantes ou mortes, y compris sportifs et artistes ; noms de marques réelles.
- Hymnes, devises nationales et symboles d'État. Les couleurs et emblèmes servent uniquement au palette swap et à l'identité visuelle d'équipe.

### 7.4 Zones ouvertes à l'invention

Les routines peuvent inventer librement : les **commandants** et leur entourage, les **noms de terrains** et de stades, les **surnoms d'équipes**, les **rituels d'avant-match**, les **objets fétiches**, les **anecdotes de Ronde passée**, les **figures d'Atlas secondaires** et tout ce qui touche à la **Cinquième Manche**. Toute invention est signalée dans la sortie JSON.

### 7.5 Procédure en cas de doute

1. **Reformuler** dans un registre autorisé (§ 7.2). Un pouvoir « issu d'une tradition militaire » devient un pouvoir « issu d'une tradition de montagne ».
2. Si la reformulation ne tient pas, **retirer l'élément** et produire sans lui.
3. Si la production entière dépend de l'élément douteux, **ne pas produire** et signaler la mission en quarantaine avec le motif exact.

Le doute n'est jamais tranché par la routine dans le sens de la production. La routine contrôle rejette d'office toute production contenant un mot de la liste § 5.2 (colonne interdite) ou un thème de la liste § 7.3.

---

## 8. Liste canonique des flags narratifs

> Cette liste est **la même** que celle de `08-narration-choix.md`, qui en explique le fonctionnement, les conséquences et le système de choix. La bible fait foi sur les **noms**, les **types** et les **portées** ; le document narration fait foi sur les **usages**.

### 8.1 Convention de nommage

`<portée>.<domaine>.<nom>` — minuscules, sans accent, séparateurs `.` entre segments et `_` dans un nom composé.

| Portée | Forme | Domaine | Exemple |
|---|---|---|---|
| Pays | `pays.<code>.<nom>` | code ISO 3166-1 alpha-2 en minuscules, ou trois lettres pour un camp sans drapeau (`atl`, §3.4) | `pays.fr.rival_respecte` |
| Monde | `monde.<domaine>.<nom>` | `atlas`, `cinquieme`, `regie`, `public`, `tournoi`, `carnet`, `depeche`, `secret` **[Proposition]** | `monde.atlas.soupcon` |
| Commandant **[Proposition]** | `cmd.<id>.<nom>` | `<id>` = le `Commander.code` de sa fiche, privé de son préfixe `cmd_` (`03-schemas.md` §2) | `cmd.mireille_bousquet.respect` |

Types : **booléen** (posé une fois, jamais retiré), **compteur** (entier borné, monotone croissant sauf mention), **relation** (entier signé, de −3 à +3).

### 8.2 Gabarits par pays (valables pour les 24 pays)

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `pays.<xx>.visite` | booléen | voyage | Le joueur a fait étape dans ce pays |
| `pays.<xx>.qualifie` | booléen | moteur | Le joueur a remporté l'étape de ce pays |
| `pays.<xx>.rival_respecte` | booléen | choix | Le rival local a été battu sans être humilié, ou aidé |
| `pays.<xx>.rival_humilie` | booléen | choix | Le rival local a été écrasé publiquement |
| `pays.<xx>.allie_recrute` | booléen | choix | Un commandant de ce pays est devenu co-commandant |
| `pays.<xx>.dette_envers_joueur` | compteur 0–3 | choix | Services rendus à la délégation locale |
| `pays.<xx>.terrain_altere` | compteur 0–5 | moteur | Nombre de traces persistantes laissées sur les cartes du pays |
| `pays.<xx>.ralliement_cinquieme` | booléen | trame | Ce pays a rejoint la Cinquième Manche à l'acte III |

### 8.3 Flags de pays spécifiques (exemples canon)

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `pays.fr.regions_visitees` | compteur 0–18 | moteur | Régions parcourues pendant la qualification française |
| `pays.fr.tour_complet` | booléen | moteur | Les 18 régions ont été jouées |
| `pays.fr.barrage_rompu` | booléen | choix | Un barrage a été ouvert pendant un match ; la vallée reste inondée |
| `pays.lu.sponsor_accepte` | booléen | choix | Le contrat du Consortium Méridien a été signé |
| `pays.lu.archives_ouvertes` | booléen | choix | Accès obtenu aux archives de protêts conservées sur place |
| `pays.jp.train_prete` | booléen | choix | La ligne rapide reste utilisable par le joueur lors des revisites |
| `pays.jp.duel_honore` | booléen | choix | Le duel de fin de match a été accepté selon la forme locale |
| `pays.br.foule_conquise` | booléen | choix | Le public local soutient le joueur, ici et ailleurs |
| `pays.nl.digue_ouverte` | booléen | choix | Un polder est inondé de façon permanente |
| `pays.ch.col_scelle` | booléen | choix | Un col a été bloqué et le reste |
| `pays.ma.oasis_preservee` | booléen | choix | Le point d'eau n'a pas été utilisé comme levier tactique |
| `pays.mx.fete_partagee` | booléen | choix | Le joueur a joué le jeu de la fête locale d'avant-match |

**Régions d'un pays phare.** Il n'existe **pas** de portée `region.*`. Un flag régional est un flag de pays préfixé par le nom de la région : `pays.fr.bretagne_maree_lue`, `pays.fr.ile_de_france_finale_gagnee`. La liste des dix-huit est dans `07-france-regions.md` §4 (champ « Récompense et flag »).

*(La liste des 24 pays et leurs trois flags propres sont fixés par `06-pays-de-depart.md` §5, qui est propriétaire des fiches pays ; les codes ci-dessus en sont des **exemples canon**. Les gabarits du §8.2 s'ajoutent aux flags propres de chaque pays. Ajouter un flag spécifique reste une décision humaine, jamais une décision de routine.)*

### 8.4 Flags de monde

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `monde.atlas.soupcon` | compteur 0–10 | choix, trame | Ce que le joueur soupçonne et a vu de travers chez Atlas |
| `monde.atlas.credibilite` | compteur 0–10 | choix, moteur | Crédit du joueur auprès du Bureau et du Collège |
| `monde.atlas.arbitre_alliee` | booléen | trame | Nera Aldouin partage ses archives avec le joueur |
| `monde.atlas.dossier_truquage` | compteur 0–5 | choix | Preuves réunies de matchs arrangés |
| `monde.atlas.reforme_deposee` | booléen | choix | Le joueur a déposé une demande de réforme du règlement |
| `monde.atlas.sponsor_meridien` | relation −3…+3 | choix | Rapport au Consortium Méridien |
| `monde.regie.faveur` | relation −3…+3 | choix, moteur | Comment Célestin Vantour raconte le joueur |
| `monde.public.ferveur` | compteur 0–10 | moteur | Ferveur du public mondial |
| `monde.cinquieme.contact` | booléen | trame | La faction a approché le joueur |
| `monde.cinquieme.infiltre` | booléen | choix | Le joueur a feint d'accepter et joue double jeu |
| `monde.cinquieme.demasquee` | booléen | trame | La faction est publiquement nommée |
| `monde.cinquieme.chef_identifie` | booléen | trame | La tête au Bureau est identifiée |
| `monde.cinquieme.ralliements` | compteur 0–24 | trame | Nombre de pays passés à la faction (dérivé) |
| `monde.tournoi.serie_propre` | compteur | moteur | Matchs gagnés sans exploiter une faute adverse |
| `monde.carnet.pages_scellees` | compteur 0–10 | choix | Pages du carnet remises officiellement au Collège |
| `monde.atlas.homologation_contestee` | booléen **[Proposition]** | choix | Le joueur a déposé ou soutenu un protêt contre une décision de la Commission d'homologation (§3.2) |
| `monde.atlas.essai_soutenu` | booléen **[Proposition]** | choix | Le joueur a défendu publiquement une pièce de matériel à l'essai, badge orange compris |
| `monde.depeche.serie` | compteur **[Proposition]** | moteur | Dépêches du jour enchaînées. **Vit au profil du joueur, hors sauvegarde de campagne** : aucune bascule de trame ne le lit, aucune fin ne le teste (§4.7). Un seul mécanisme a le droit de le lire : un `Deblocage` (`13-campagne.md` §8.4) |
| `monde.tournoi.fils_termines` | compteur 0–12 **[Proposition]** | moteur (dérivé) | Fils secondaires menés à leur dernière mission. Recalculé depuis `ProfilCampagne.filsFinis`, **jamais écrit à la main** |

**Le domaine `monde.secret.*`** existe pour les easter eggs (`doc/14-secrets.md`) et n'apparaît dans **aucune** table de cette bible, volontairement. Ces flags ne sont ni listés ici, ni présents dans `content/flags.json`, ni servis par `GET /api/routines/bible/flags`. Une routine ne les connaît pas, donc ne peut pas les employer ; `validerFil` les refuse en écriture ; et `doc/14-secrets.md` n'est jamais servi. Voir la règle 8 du §8.6.

### 8.5 Flags de commandant **[Proposition]**

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `cmd.<id>.respect` | compteur 0–5 | choix, moteur | Estime accumulée par ce commandant envers le joueur |
| `cmd.<id>.grief` | compteur 0–5 | choix, moteur | Rancune accumulée |
| `cmd.<id>.co_commandant` | booléen | choix | Recruté comme co-commandant |
| `cmd.<id>.rival_jure` | booléen | trame | Revient comme adversaire renforcé |
| `cmd.<id>.dette` | booléen | choix | Doit un service au joueur, exigible une fois |

### 8.6 Règles dures sur les flags

1. **Aucune routine n'invente un nom de flag.** Un flag absent de cette section ne peut pas être utilisé ; il doit d'abord être ajouté ici.
2. **Un booléen ne se retire jamais.** On ne « défait » pas une décision ; on en pose une autre à côté.
3. **Un compteur ne décroît pas**, sauf `monde.regie.faveur` et les relations, qui sont signées.
4. **`pays.<xx>.rival_respecte` et `pays.<xx>.rival_humilie` sont exclusifs** : poser l'un interdit l'autre pour le même pays.
5. **Les flags dérivés ne s'écrivent pas directement** : `monde.cinquieme.ralliements` est recalculé par le moteur à partir des `pays.<xx>.ralliement_cinquieme`.
6. **Toute scène déclare ses flags** en lecture et en écriture dans son JSON ; la routine contrôle rejette une scène qui référence un flag inconnu.
7. **La Dépêche du jour n'écrit aucun flag de campagne** (§4.7). Une scène rattachée à une mission du jour qui déclare un flag `pays.*`, `monde.*` (hors `monde.depeche.*`) ou `cmd.*` en écriture est rejetée d'office par la routine contrôle. **[Proposition]**
8. **Aucun contenu ne pose un flag `monde.secret.*`.** Ces flags sont posés par du code écrit à la main (`doc/14-secrets.md`), jamais par un scénario, un choix ou un fil. Une production qui en déclare un en écriture est refusée au schéma, pas à la relecture. **[Proposition]**
9. **Un fil écrit des flags de campagne, contrairement à une Dépêche.** C'est sa différence de nature : un fil compte, une exhibition non (`13-campagne.md` §5.1, `08-narration-choix.md` §4.6). Ses flags restent pris dans cette liste, comme partout ailleurs. **[Proposition]**

---

## 9. Récapitulatif des propositions de ce document

1. **Port-Méridien**, île neutre, siège d'Atlas et terrain de la finale mondiale.
2. Le **calendrier en Rondes** (Ronde XIV en cours) et l'interdiction des dates réelles qui en découle.
3. Les **sans-drapeau** : le personnel d'Atlas renonce à sa nationalité, d'où des noms inventés et non localisables — garde-fou éditorial autant que trait de fiction.
4. Les organes d'Atlas : Bureau, Collège des arbitres, Régie, Intendance, Cartographie, et la **Commission d'homologation** (matériel de fondation, matériel à l'essai et son badge orange, admission au catalogue, retrait du catalogue).
5. Les trois figures : **Osmin Talvarec**, **Nera Aldouin**, **Célestin Vantour** — et Vantour comme narrateur diégétique des conséquences.
6. Le **Consortium Méridien**, sponsor apatride, porteur des choix de « sponsor douteux ».
7. La faction **la Cinquième Manche**, son mobile, son signe, sa figure visible **Hadran Ost**, sa tête cachée au Bureau, et sa victoire définie comme *suspension de la Ronde* et non comme guerre.
8. La **doctrine du marquage** (charges de marquage, unité marquée, escortée, revenant au match suivant) et le matériel non homologué comme scandale absolu du monde.
9. Le **Pacte du Terrain** en quatre articles, dont « le refus de jouer se paie plus cher que la défaite ».
10. Le format en **quatre manches**, la **décision aux points**, l'échelle de sanctions (rappel, carton, mise hors jeu du commandant, disqualification) et le **protêt** comme source de preuves.
11. Les colonnes d'équilibrage des **dix archétypes canon** (tempérament, famille de pouvoir, courbe, contré par), dont les trois entrées nouvelles — la diplomate, la survivante, le prodige — et les contres réajustés. La règle du co-commandant, elle, n'est plus une proposition : **passif seul plus une barre de jauge**, carte de terrain pour un commandant régional français — **l'une des trois, pas une quatrième** —, trois recrutés et un seul actif par match.
12. Le **Bulletin** de Célestin Vantour comme rituel d'avant-match, la Ronde au rythme des vraies saisons, la nuit qui n'interrompt pas un match, et la règle « le temps qu'il fait est un fait de match, jamais un drame ».
13. La **Dépêche du jour** : exhibition quotidienne hors classement, tirée du registre autorisé, jamais d'un drame, sans effet sur la campagne.
14. La portée de flags **`cmd.<id>.*`**, le domaine `monde.depeche.*`, les trois flags `monde.atlas.homologation_contestee`, `monde.atlas.essai_soutenu`, `monde.depeche.serie`, et les neuf règles dures sur les flags.
15. **Barnab Estève**, le seul commandant en activité qui a connu les Vieilles Manières, et sa réplique unique — la limite absolue du hors-champ (§2.1).
16. Les **généraux secrets** comme figures d'Atlas jouables (§3.5), leur statut de sans-drapeau, et la doctrine **« jamais indispensable »**.
17. Le domaine `monde.secret.*` **absent de cette bible et de `content/flags.json` par construction**, le flag dérivé `monde.tournoi.fils_termines`, et les règles 8 et 9 du §8.6.
18. **La Sélection Méridienne**, dite « les Gris » (§3.4) : l'équipe d'exhibition et d'essai d'Atlas, financée par le Consortium, dirigée par Ost, qui devient à l'acte III la faction sur le terrain — un adversaire sans être un pays. Son code de camp à trois lettres, `atl`, sert aussi de code de terrain à Port-Méridien.
