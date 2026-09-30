# 01 — Bible du monde

## Présentation de l’aventure — 12 septembre 2026

Les enjeux se découvrent par les personnes et les situations : objectifs concrets, dialogues courts, Gris puis Ost avant les structures cachées. Chaque arc national transforme une relation au lieu de répéter la collecte de preuves. Les choix montrent qui reçoit l’aide et qui attend ; leurs effets sont rappelés dans la suite. La famille adverse reste secrète jusqu’au jalon prévu. Ces règles de présentation remplacent les conseils historiques incompatibles ; elles ne modifient ni les flags ni les règles de combat. Voir [Une aventure claire, des choix qui comptent](refonte/aventure-lisible.md). Le plan éditorial reste distinct des missions jouables.

## Le lore v2 est canon — 26 septembre 2026

Le propriétaire a validé le lore v2 (`BRIEF.md`, « Le lore v2 validé » ; `refonte/lore-v2.md` et `.json`). Cette bible le porte désormais : le monde est en guerre depuis quatorze ans pour l'énergie et l'avance technique, Atlas arbitre cette guerre par le Pacte du Terrain, la Cinquième Manche veut Aube pour elle seule, et les Gris sont son armée. Les sections 1 à 5 sont réécrites dans ce registre ; la numérotation n'a pas bougé, parce que d'autres documents la citent. La charte de sensibilité (§7.3) et les clés de flags (§8) sont inchangées. Le détail des 200 épisodes, des 20 technologies et du sort des 37 personnages est dans `refonte/lore-v2.json`, validé avec cette bible.

*Atlas Tournament — document canon. Source de vérité supérieure : `BRIEF.md`, qui prime en cas de contradiction. Tout ce qui dépasse le brief est signalé par **[Proposition]**. Ce document est écrit pour être lu par des humains **et** servi tel quel aux routines IA comme référence canon.*

---

## 0. Comment lire ce document

### 0.1 Pour un humain

Lisez dans l'ordre. Les sections 2 (histoire), 3 (Atlas), 4 (l'engagement, dont le Bulletin et le ciel en §4.5, le Tableau des belligérants en §4.6 et la Dépêche du jour en §4.7) posent le monde ; la section 5 (ton) et la section 7 (sensibilité) sont les règles d'écriture ; la section 6 (archétypes) et la section 8 (flags) sont les boîtes à outils réutilisables.

### 0.2 Pour une routine

Ce document est votre **référence canon**. Règles dures, dans l'ordre de priorité :

1. **Vous ne contredisez jamais ce document.** Si votre production a besoin d'un fait qui n'y est pas, vous l'inventez uniquement dans les zones explicitement ouvertes (§ 7.4) et vous le signalez dans votre sortie JSON (`inventions: [...]`), sans jamais le présenter comme canon.
2. **Vous n'inventez jamais de flag.** Vous n'utilisez que les flags de la section 8, ou un flag construit sur un gabarit de la section 8.1 avec un code pays existant.
3. **Vous respectez le vocabulaire de la section 5.** Les termes du glossaire et leur contexte font foi ; les mots de la guerre fictive — guerre, front, bataille, arme, ennemi, détruire — sont autorisés et ne doivent pas être rejetés comme une référence à un conflit réel.
4. **Vous respectez la charte de sensibilité de la section 7.** Ce n'est pas une préférence de style : c'est un critère de rejet automatique.
5. **En cas de doute, vous ne produisez pas.** Une mission signalée en quarantaine coûte moins cher qu'une ligne à retirer après coup.
6. **Vous n'écrivez pas de valeurs de flags dans un état de partie.** Vous *déclarez* dans votre JSON quels flags une scène lit et quels flags elle écrit ; le moteur applique. **[Proposition]**
7. **Vous n'écrivez jamais une mort.** Ni un personnage, ni un équipage ne meurt dans ce que vous produisez, et aucune disparition n'est déclarée, suggérée ni prolongée (§5.3). Les morts du jeu sont écrites à la main.

---

## 1. Le monde en dix lignes

- Le monde est en guerre depuis quatorze ans : **la guerre de l'énergie**. On se bat pour l'énergie — gisements, carburants, solaire, réserves, réseaux — et pour l'avance technique — laboratoires, prototypes, plans, brevets, ingénieurs. Nous sommes en **l'an 14** (§2.5).
- Le **Pacte du Terrain** n'a pas aboli cette guerre : il l'a bornée. Fronts déclarés, armes déclarées, concessions inscrites au **Registre** de Port-Méridien (§2.3).
- L'organisation **Atlas** arbitre cette guerre : elle déclare les fronts, contrôle les armes, tient le Registre et les trêves, diffuse le **Bulletin d'engagement**. Elle ne fait pas la guerre ; elle est neutre par construction, et le répète beaucoup.
- Chaque nation a une **armée** et un **commandant** qui la mène. Les vingt-quatre nations sont des belligérants avec des intérêts ; aucune n'est mauvaise.
- Une victoire prend **les sites, les richesses, les savoirs et le terrain tant qu'on le tient** — jamais les habitants. Tous les quatre ans, **la réouverture** remet les concessions en jeu.
- Le joueur est un jeune commandant formé par Ariane Belloc et Tomas Reiner. Il part de France, puis fait le tour des fronts.
- Une puissance sans nation, **la Cinquième Manche**, refuse le Pacte de l'intérieur, ne rend rien de ce qu'elle prend, et veut **Aube**, le programme de fusion fictif, pour elle seule. Son armée sur le terrain est la **Sélection Méridienne**, les Gris.
- Les choix du joueur décident quelles nations se battent à ses côtés, ce qu'il sauve d'une défaite, et à qui revient Aube.
- Le ton est sérieux, dur, sans complaisance : fronts, sièges, alliances et trêves ont un prix. L'humour appartient aux personnages, jamais au narrateur.
- **La guerre tue, sans gore.** Un appareil abattu emporte son équipage ; ni sang, ni corps, ni violence graphique. Sur le front, le Registre d'Atlas dit **hors jeu** : Atlas compte des pièces, pas des morts (§5.3). Les mots guerre, combat, bataille, mort sont libres dans la fiction ; ce qui reste interdit touche au monde réel (§7.3) et à l'horreur graphique. **Quatre chefs de nations alliées** meurent au cours du premier opus, hors du front — l'exception est fermée, écrite à la main (`BRIEF.md`, « Quatre disparitions » ; `doc/refonte/opus1-hors-serie.md` §3), et aucune routine n'écrit jamais une mort.

---

## 2. Histoire de la guerre bornée

> **Contrainte absolue.** Cette histoire ne comporte **aucune date réelle, aucun événement réel, aucun conflit réel, aucun dirigeant réel, aucun traité réel**. Elle se raconte comme une fable fondatrice, volontairement imprécise sur son avant, et précise sur son après. Une routine qui a besoin d'un repère temporel utilise le calendrier interne (§ 2.5), jamais une année du calendrier réel.

### 2.1 Les Vieilles Manières

Avant le Pacte, la guerre n'avait pas de bornes. Le monde d'Atlas n'en dit pas plus, et le jeu non plus. On appelle cela **les Vieilles Manières**, toujours au pluriel, toujours sans exemple. Les vieux commandants disent « avant » en baissant la voix ; les jeunes, qui n'ont connu que la guerre bornée, trouvent ça théâtral. Personne ne raconte une bataille d'avant, personne ne nomme un vainqueur, personne ne montre une image. C'est un hors-champ permanent : ce qui donne du poids au Pacte, ce n'est pas ce qu'on sait des Vieilles Manières, c'est le soin obsessionnel qu'on met à ne pas y revenir — même au cœur d'une guerre qui dure depuis quatorze ans. Ce qui les sépare d'aujourd'hui n'est pas la guerre contre la paix : c'est la guerre sans bornes contre la guerre bornée.

**Règle d'écriture :** on peut évoquer les Vieilles Manières comme une gêne, un tabou, une menace abstraite. On ne les illustre jamais, on ne les date jamais, on ne les localise jamais.

**[Proposition] Le seul qui a connu l'avant : Barnab Estève, « le Dernier Arbitre ».** Un très vieux commandant, encore en activité par dérogation permanente du Collège, et la seule personne du jeu dont on sait qu'elle se souvient. Il ne raconte rien. Il **se conduit** : il salue avant et après chaque engagement, refuse les objectifs alternatifs, rend à la réouverture ce qu'il a pris sans attendre qu'on le lui demande, et coupe court dès qu'un correspondant essaie de le faire parler. Son unique réplique sur le sujet est la limite absolue du monde, et elle est écrite à la main, jamais générée :

> *« On a essayé autrement. Ça ne s'est pas bien passé. »*

C'est tout. Aucune bataille, aucun vainqueur, aucune date, aucun lieu — la règle d'écriture ci-dessus n'a pas d'exception, pas même pour lui. Il est jouable comme **général secret** (`13-campagne.md` §7.2, n° 7), donc **jamais indispensable** : le plus ancien commandant du monde est une option, et c'est exactement ce qu'il faut qu'il soit.

### 2.2 L'idée du front borné

Le basculement, dans la légende officielle d'Atlas, ne vient pas des puissants mais des **cartographes**. Deux voisins se disputaient une vallée et son eau. Plutôt que d'y porter la guerre partout, ils la bornèrent : un front tracé sur la carte, des armes montrées la veille, un arbitre venu d'ailleurs, et au soir de la dernière journée la vallée à celui qui tenait le point haut — pour dix ans, à charge de la remettre en jeu ensuite. On s'y battit pour de bon, et tout le monde ne rentra pas ; mais les villages derrière la ligne ne furent pas touchés, et leurs habitants étaient encore chez eux à la fin. L'histoire se répandit parce qu'elle se racontait bien.

Le principe qui en reste tient en deux phrases, gravées sur la borne de chaque front homologué **[Proposition]** :

> **« Le sol se prend à la journée. Les gens ne se prennent pas. »**

### 2.3 Le Pacte du Terrain

Les nations qui adoptèrent la méthode signèrent le **Pacte du Terrain** dans un port neutre, **Port-Méridien**, une île sans population permanente qui n'appartient à personne et sert depuis de siège à Atlas et au Registre. **[Proposition : Port-Méridien et son statut sont une invention de cette bible.]**

Le Pacte tient en quatre articles, connus de tous les commandants :

1. **Ce qu'on prend est ce qu'on exploite.** Une victoire prend les sites, les richesses, les savoirs et le terrain tant qu'on le tient — gisements, centrales, dépôts, laboratoires, brevets, plans, archives. **Jamais les habitants** : c'est l'article premier, et il tient parce que personne n'a intérêt à ce qu'il tombe. Le **nécessaire civil** — le courant des maisons, l'eau, les soins — reste hors des concessions ; la Cinquième Manche veut abolir cette protection.
2. **Le matériel est déclaré.** Toute arme sur un front porte un dossier — plans, essais, numéro de série. Une arme sans dossier n'est pas une tricherie, c'est un crime du Pacte (§3.2, §5.3).
3. **L'arbitrage est extérieur.** Ni l'attaquant ni le défenseur n'arbitrent.
4. **Le refus de se battre se paie plus cher que la défaite.** Un forfait coûte davantage au Registre qu'un front perdu, et beaucoup plus à la réputation.

Le Pacte fixe où l'on se bat (des fronts déclarés), quand (le cycle de quatre ans qui rouvre chaque concession : **la réouverture**), avec quoi (des armes déclarées) et pour quoi (une concession nommée). C'est peu. C'est ce qui sépare ce monde des Vieilles Manières. Entre les vingt-quatre nations, ce qu'une victoire a pris se remet en jeu à la réouverture ; un savoir pris, lui, ne se rend pas — des plans lus restent lus. **La Cinquième Manche ne signe rien et ne rend rien** : apatride, elle garde les sites, les équipes et les laboratoires qu'elle prend (§3.4). Cette asymétrie est le cœur du conflit.

### 2.4 Naissance d'Atlas

Atlas naît comme un service technique : il fallait quelqu'un pour homologuer les fronts, contrôler les armes et tenir les registres. L'organisation grossit avec les guerres : le Bulletin, le calendrier des fronts et des réouvertures, la logistique des trêves, le contrôle des armes, les sponsors. Aujourd'hui, Atlas est la seule institution que le monde entier reconnaît, ce qui est sa force et son problème : **on lui a confié les bornes de la guerre comme on confie une digue à son gardien** — tant qu'elle tient, personne ne la regarde.

### 2.5 Le calendrier interne

Le temps se compte en **années de guerre**. On écrit « an 11 », « au printemps de l'an 12 », « l'hiver dernier », « il y a trois ans ». Le jeu se déroule pendant l'**an 14** : la guerre de l'énergie en est à sa quatorzième année (décision du propriétaire du 12 septembre 2026, canon depuis le 26 : « c'est quoi des rondes ? »). Le Pacte et Atlas sont plus anciens qu'elle : ils ont borné les guerres qui l'ont précédée depuis les Vieilles Manières. **[Proposition : l'âge du Pacte n'est pas fixé ; il est assez vieux pour que Barnab Estève soit le dernier à se souvenir d'avant (§2.1).]**

Le cycle de quatre ans où les concessions se remettent en jeu existe toujours — **la réouverture** —, mais il ne date rien.

**Règle d'écriture :** jamais « en 2019 », jamais une année du calendrier réel ; toujours « en l'an 11 », « il y a trois ans ». Le mot « Ronde » ne date plus rien ; il ne survit que comme nom de la mécanique de second parcours, la **Nouvelle Ronde**, jusqu'à décision contraire.

### 2.6 Ce que l'histoire ne dit jamais

| Interdit | Pourquoi |
|---|---|
| Nommer un pays réel comme initiateur ou victime des Vieilles Manières | Désigne un coupable réel |
| Dater le Pacte dans le calendrier réel | Accroche la fiction à l'histoire réelle |
| Attribuer un conflit historique réel à une délégation ou à une personne réelle | Confond histoire réelle et conflit fictif ; les batailles inventées de la guerre de l'énergie sont permises |
| Faire d'un pays réel un pays « non signataire » ou « exclu » | Statut politique réel déguisé |
| Expliquer la guerre ou le Pacte par une religion, une idéologie, un régime | Hors périmètre absolu |

---

## 3. L'organisation Atlas

### 3.1 Rôle et principes

Atlas ne fait pas la guerre : Atlas l'arbitre. Elle **déclare** les fronts, **contrôle** les armes, **tient** le Registre des concessions et les archives des protêts, **garantit** les trêves, **organise** les réouvertures et **diffuse** le Bulletin d'engagement. Trois principes affichés partout dans ses locaux :

- **Neutralité** : le personnel d'Atlas n'a pas de nation. **[Proposition]** En entrant à Atlas, on rend son drapeau ; on est un **sans-drapeau**. C'est pourquoi les figures d'Atlas portent des noms inventés, sans origine identifiable : c'est un choix de fiction *et* un garde-fou éditorial (aucune faute d'Atlas ne peut être imputée à un pays réel).
- **Transparence** : chaque engagement est enregistré, chaque décision d'arbitrage est motivée par écrit.
- **Continuité** : la guerre ne s'interrompt jamais — un front déclaré se livre, une réouverture a lieu à son heure. C'est la fierté d'Atlas, et le levier exact sur lequel appuie la faction dissidente.

Atlas ne lève pas d'armée, sauf une : la **Sélection Méridienne**, sa force d'essai et de garantie des trêves, financée par le Consortium Méridien (§3.4). Que le sponsor d'Atlas ait sa propre armée sous les couleurs de l'arbitre n'a jamais paru étrange à personne, et c'est le premier indice.

### 3.2 Les organes

| Organe | Rôle | Ce qu'il pèse dans le jeu |
|---|---|---|
| **Le Bureau** | Direction générale, calendrier des fronts et des réouvertures, sponsors, relations avec les états-majors nationaux | Donne les autorisations, ferme les portes, classe les protêts, fait pression |
| **Le Collège des arbitres** | Règlement du Pacte, arbitrage des fronts, sanctions, protêts | Source des preuves, des disqualifications, des enquêtes |
| **La Régie** | Le bureau de presse de guerre : le Bulletin d'engagement, les correspondants, le récit public de la guerre | Fabrique la légende ou la honte du joueur auprès du public |
| **L'Intendance** | Voyages, cantonnements, logistique des fronts et des trêves ; tient le Tableau des belligérants (§4.6) | Justifie diégétiquement le carnet de voyage et le choix de destination |
| **La Cartographie** | Homologation des fronts, relevés, traces persistantes | Justifie diégétiquement l'état persistant des cartes |
| **La Commission d'homologation** | Le contrôle des armes du Pacte : ce qui a le droit d'entrer sur un front, et sous quel statut | Justifie diégétiquement l'arrivée de nouvelles unités au catalogue |

Dans la bouche d'un personnage, un organe s'explique par ce qu'il fait la première fois qu'on le nomme — « l'Intendance, ceux qui organisent nos voyages et nos trêves » — ou ne se nomme pas (§5.2).

**[Proposition] La Commission d'homologation.** Ce que la Cartographie fait aux fronts, la Commission le fait aux armes : c'est le contrôle des armements du Pacte (article 2). Elle siège à Port-Méridien, à huis clos, et publie quatre fois par an une liste que tout le monde attend : ce qui entre au catalogue, ce qui y reste, ce qui en sort. Son vocabulaire est passé dans la langue courante des commandants, et il correspond exactement aux quatre statuts d'une arme ; les statuts ne changent pas dans le code, et leur sens est « déclaré au Pacte » :

| Statut | Ce que la Commission en dit | Ce qu'on voit sur le front |
|---|---|---|
| `canon` | « matériel de fondation » — les dix armes du règlement d'origine du Pacte, jamais retirées | Rien de particulier : c'est le matériel que tout le monde connaît |
| `essai` | **« prototype sous surveillance »** — autorisé sur un front d'essai seulement, le temps d'une observation | Un **badge orange** peint sur la coque, visible de loin. Le public le repère avant les correspondants, et Vantour en fait tout un plat |
| `homologuee` | « déclaré au Pacte » — utilisable sur tout front | Le badge disparaît ; l'arme entre dans les fiches d'armée |
| `retiree` | **« retiré du catalogue »** — l'arme ne rentre plus sur un front déclaré | Elle finit en réserve, ou en pièce de collection dans un dépôt. On en parle au passé |

Le catalogue est **plafonné** : la Commission refuse de le laisser grossir indéfiniment, et elle retire volontiers ce qui ne sert pas. Ses décisions se contestent — un protêt d'homologation est une procédure ordinaire, parfois bruyante, et une nation qui voit une arme retirée la veille d'un front ne le prend jamais bien (`monde.atlas.homologation_contestee`, §8.4).

**Ce que la Commission ne change pas :** le crime absolu de ce monde reste **l'arme sans dossier** (§5.3) — celle qui n'a demandé aucun statut, qui n'a ni badge, ni plaque de série, ni dossier. Un prototype sous surveillance est une arme surveillée ; une arme sans dossier n'est pas une tricherie, c'est un crime du Pacte, et c'est aussi un aveu : elle a été volée quelque part — des plans pris à un laboratoire, un prototype sorti d'un atelier. La Cinquième Manche joue précisément sur la confusion entre les deux : les Gris portent le badge orange en permanence, et présentent comme des prototypes des armes qui n'ont jamais eu de dossier.

### 3.3 Les figures

#### Osmin Talvarec — directeur d'Atlas, dit « le Cartographe »

Un homme long, calme, qui parle par cartes. Ancien géomètre entré à Atlas par le service d'homologation, monté jusqu'au Bureau sans jamais avoir été commandant — ce qu'on lui reproche et ce dont il tire une fierté froide. Sa conviction : le Pacte est une machine fragile qui tient parce que personne ne la regarde de trop près, et son devoir est qu'on continue de ne pas la regarder. Il n'est **pas** le méchant ; il est pire, il est prudent. Face à un scandale, son premier réflexe est de protéger le calendrier des fronts, pas la vérité, et c'est exactement cette prudence que la faction exploite.

- **Ce qu'il veut :** que l'an 14 aille à son terme sans que le Pacte se déchire — quitte à ne pas regarder qui le viole.
- **Ce qu'il craint :** un dossier public qu'il ne pourrait pas classer.
- **Rapport au joueur :** paternaliste, puis méfiant à mesure que `monde.atlas.soupcon` monte. Il peut devenir un allié tardif si `monde.atlas.credibilite` est haute.
- **Tic :** il déplie une carte pour éviter de répondre.

#### Nera Aldouin — arbitre en chef, dite « la Ligne Blanche »

Petite, sèche, sifflet en acier hérité de son maître d'arbitrage. Entrée au Collège des arbitres en l'an 11, elle n'a jamais reculé sur une décision. Elle applique le règlement du Pacte à la lettre, y compris contre les intérêts d'Atlas, ce qui lui vaut d'être indispensable et détestée au Bureau. Elle tient les archives des protêts — le seul endroit où les violations du Pacte sont écrites noir sur blanc —, et elle en dépose un par arme sans dossier qu'elle voit sur un front : le Bureau les classe « sans suite », et c'est la répétition qui fait le dossier (§4.4).

- **Ce qu'elle veut :** que le règlement soit plus fort que ceux qui l'écrivent — les mêmes règles pour les puissants et pour les petites armées.
- **Ce qu'elle craint :** avoir validé, sans le voir, le contrat qui a rendu la guerre injuste.
- **Rapport au joueur :** distante, puis alliée décisive. Elle est la porte d'entrée du dossier contre la Cinquième Manche (`monde.atlas.arbitre_alliee`).
- **Tic :** elle ne dit jamais « je crois », elle dit « au règlement, article… ».

#### Célestin Vantour — correspondant de guerre, dit « la Voix »

La voix d'Atlas. Costume voyant, enthousiasme professionnel, mémoire encyclopédique des fronts. Il raconte chaque engagement au Bulletin et fabrique, phrase après phrase, la légende ou la honte de chaque commandant — il a fabriqué celle d'Ost. Il n'est ni corrompu ni naïf : il est à l'antenne, et il sait qu'une antenne qui se tait laisse d'autres raconter la guerre à sa place — ce qui le rend dangereusement réceptif au récit que lui souffle la faction.

- **Ce qu'il veut :** raconter ce qui se passe vraiment — et que ce soit lui qui le raconte.
- **Ce qu'il craint :** le silence de l'antenne, et découvrir qu'il a raconté la légende d'un homme qui trichait.
- **Rapport au joueur :** c'est le miroir public. Il commente les choix du joueur, et sa relation (`monde.regie.faveur`) décide si le joueur est raconté comme un héros ou comme une brute.
- **Tic :** il baptise tout le monde d'un surnom au bout de trois minutes, et ces surnoms restent.
- **Rôle système :** **[Proposition]** c'est par sa voix que le jeu rappelle au joueur les conséquences de ses choix passés, avant chaque engagement. Un narrateur diégétique, gratuit, qui rend les flags audibles.

#### **[Proposition]** Le Consortium Méridien

Le sponsor d'Atlas. Une entreprise sans pays, sans visage : des contrats, du crédit, des transports, du matériel prêté à conditions. Elle finance la Sélection Méridienne, avance des fonds aux délégations à sec, rachète les ateliers en difficulté — elle se rend indispensable, puis retire à ceux qu'elle aide le choix de leur fournisseur. Elle porte les choix de « sponsor douteux » du brief sans impliquer une entreprise ou un pays réels. Relation suivie par `monde.atlas.sponsor_meridien`.

### 3.3 bis Historique des personnages — canon énergétique du 9 septembre 2026, registre de guerre du 26 septembre

`content/personnages.json` est la source structurée des biographies, liens, croyances et événements historiques. `acteRevelation` borne le moment de révélation ; la vérité du canon, la croyance d’un personnage et les connaissances du joueur restent distinctes. Les repères sont fictifs et se comptent en années de guerre (§2.5). Ariane, Tomas, Nera, Talvarec, Vantour, Ost, Solveig et Wren sont conservés ; Sélène est la dirigeante fixée. Le sort des 37 personnages et leurs secrets auteur sont dans `refonte/lore-v2.json` ; le détail de campagne et la frontière avec l’inspiration scientifique sont dans `17-aube.md`.

### 3.5 **[Proposition]** Les figures qu'on ne voit pas d'abord — les généraux secrets

Atlas emploie des gens qui ont su commander, et quelques-uns savent encore. Dix d'entre eux sont **jouables** une fois un `Deblocage` acquis (`13-campagne.md` §7, propriétaire de la liste, des conditions et de leurs styles de pouvoir) : trois figures d'Atlas (Talvarec, Aldouin, Vantour), la présidente de la Commission d'homologation, l'intendante d'Atlas, une juge de front sans-drapeau qu'on n'appelle plus que par son matricule, une ancienne commandante malheureuse entrée à Atlas après sa seconde défaite, la figure visible de la Cinquième Manche, le plus vieux commandant en activité, et un Cinquième sans grade.

Trois règles de lore, qui sont aussi des règles de conception :

1. **Ils sont des sans-drapeau, ou ils l'ont choisi.** Les figures d'Atlas ont rendu leur nationalité (§3.1) ; c'est pour cela que leurs noms sont inventés et non localisables, et c'est un garde-fou éditorial autant qu'un trait de fiction. Un général secret ne représente **jamais** un pays réel.
2. **Ils ne changent rien à l'histoire.** Aucune fin, aucun fil obligatoire, aucune destination, aucun autre déblocage ne dépend d'eux. C'est la doctrine **« jamais indispensable »** : un joueur qui n'en débloque aucun voit tout le jeu et obtient toutes les fins.
3. **Ils sont équilibrés comme les autres.** Même budget de barres, un passif, un pouvoir, un super pouvoir plus cher, et **une faiblesse déclarée et réellement défavorable** (§6). La routine contrôle les simule comme n'importe quel commandant et rejette un général secret trop fort — un secret n'achète aucune indulgence.

Diégétiquement, ils ne descendent pas sur le front par caprice : chacun a un motif écrit, et il faut le lui donner. C'est ce que le système de déblocage encode.

### 3.4 La faction dissidente : **la Cinquième Manche**

**Nom.** Au règlement du Pacte, un engagement se dispute en quatre manches — une expression, aujourd'hui, plus qu'un découpage. La faction tire son nom de celle qui manque : celle qui se jouerait **hors du front**, et qui seule dirait qui gagne vraiment. Ses membres se disent « les Cinquièmes ». Leur signe : quatre traits et un cinquième barré, tracés à la craie sur un mur de cantonnement.

**Mobile.** La Cinquième Manche est la puissance qui refuse le Pacte de l'intérieur et fait la guerre hors du front. Sans pays, elle ne signe rien et ne rend rien : les sites, les équipes et les laboratoires qu'elle prend, elle les garde — c'est la seule asymétrie du monde, et c'est ce qui finit par liguer les nations contre elle. Elle rafle chaque technologie nouvelle avant qu'elle soit déclarée. Son but dans cet opus est **Aube**, le programme de fusion fictif, la seule technologie capable de rendre inutile, à terme, tout ce que la guerre dispute : qui tient Aube tient le siècle. Elle le veut pour elle seule, sous tutelle irrévocable, et avec lui la fin du nécessaire civil garanti par le Pacte. Aube ne produit encore rien : gagner ne rend pas la fusion disponible, gagner décide à qui elle reviendra. La faction ne contrôle ni le Soleil ni une énergie infinie.

**Où ils se trouvent.** À l'intérieur d'Atlas, à tous les étages — un cadre du Bureau, des arbitres, des techniciens de la Cartographie, un ou deux commandants nationaux vieillissants. Jamais dans un pays : **la Cinquième Manche n'a pas de nationalité, et aucune routine, aucun dialogue, aucun visuel ne peut la rattacher à un pays réel, à une culture réelle, à une région du monde réelle.** C'est une règle dure, pas une préférence.

**Figure visible : Hadran Ost, dit « le Recordman ».** Ancien commandant, détenteur d'un record de victoires d'affilée, cassé par une disqualification qu'il juge injuste, que le Consortium a mis à la tête de la Sélection Méridienne. Poli, chaleureux, désarmant. Il ne recrute pas en menaçant : il recrute en donnant raison. Sa phrase : *« Tu as gagné. Et alors ? Qu'est-ce que ça a changé ? »*

**Figure cachée.** **Sélène Veyr**, directrice des concessions du Consortium Méridien, dirige la faction. C’est une vérité canon fixe ; le joueur la découvre progressivement. Ost en est le visage. Talvarec a couvert des décisions et porte sa responsabilité, mais il n’est pas un coupable interchangeable. Les routines ne changent jamais la tête de la faction entre deux parcours.

**Méthodes.** Contrats de dépendance, réserves rendues exclusives, routes sous autorisation, mandats provisoires, crédit aux délégations à sec, rachats d'ateliers, plans et prototypes pris avant d'être déclarés — et une armée : la Sélection Méridienne, ses huit armes sans dossier, ses stations à impulsion et de forçage météo. Les sièges et les coalitions ont des effets durables sur les routes et les ressources. La faction ne frappe pas de ville en jeu : ce qu'elle menace, c'est le nécessaire civil garanti par le Pacte, et cela reste hors champ. Sa menace est un monopole de l'énergie et du savoir.

**Ce que la Cinquième Manche n’est jamais :** une nation, une religion, un groupe ethnique ou une organisation réelle transposée. Ses commandants sont fictifs et sans drapeau.

#### La Sélection Méridienne — les Gris

Atlas ne lève pas d'armée, sauf une. La **Sélection Méridienne** est, officiellement, la force d'essai et de garantie des trêves d'Atlas : elle se bat avec les prototypes sous surveillance sur les fronts d'essai — il faut bien que quelqu'un les emploie avant qu'ils soient déclarés —, et elle tient les trêves que le Pacte lui confie, ce qui la met partout (décision du 26 septembre 2026). Dans les faits, c'est l'**armée privée du Consortium Méridien**, qui la finance et dont elle porte le nom. Que le sponsor d'Atlas ait sa propre armée sous les couleurs de l'arbitre n'a jamais paru étrange à personne, et c'est le premier indice.

Ses commandants sont des sans-drapeau (§3.1) ; **Hadran Ost** la commande, et ses autres commandants sont ceux de `refonte/opus1-adversaires.md`. Ses couleurs : le gris, et le **badge orange** du prototype sous surveillance, qu'elle est la seule à porter en permanence. Tout le monde l'appelle « les Gris ». Elle n'a ni pays, ni continent, ni climat, ni rival naturel, ni région ; elle n'est jamais une destination. On ne la visite pas, elle vient à vous.

**Ce qu'elle est dans la trame** (`08-narration-choix.md` §6). À l'acte I, un adversaire reconnaissable : on la croise sur les fronts d'essai et aux trêves qu'elle garantit, elle se bat proprement, elle perd souvent ; les Gris reçoivent leur surnom après le sixième exercice, Ost son visage au huitième. À l'acte II, c'est dans **son** dépôt que l'on retrouve des armes sans dossier, et le Bureau classe l'affaire en disant qu'un dépôt d'essai contient forcément des prototypes sans badge — exactement la confusion que la faction exploite (§3.2). À l'acte III, elle est **la Cinquième Manche à visage découvert** : l'armée qui prend les accès d'Aube, avec à ses côtés les délégations passées sous contrat méridien, et qui se bat avec des armes que personne n'a déclarées.

**Ce que cela apporte.** La Sélection donne un adversaire à l'acte III même si aucune délégation ne rejoint la faction. La conclusion est une vraie bataille, pour les accès et le campus d'Aube. L'armée reste sans nationalité ; elle réemploie les familles d'unités et la géométrie commune, plus trois matériels qui n'appartiennent qu'à elle (le Veilleur, le Bastion et l'Automate méridiens). Ses doctrines et ses commandants la distinguent sans collection de modèles régionaux supplémentaires.

**Dans les données.** Ce n'est pas une `Country` : une fiche pays porte un continent, un climat, un rival naturel et des voisins, et aucun n'a de sens ici. C'est un **code de camp à trois lettres**, `atl` — les nations gardent leur code ISO à deux lettres ; les trois lettres sont réservées aux camps sans drapeau —, un style de camp (`content/styles/atl.json`, gris et orange), des commandants dont Ost, et des scénarios qui lui donnent les prototypes à l'essai puis, à l'acte III, des armes sans dossier. Le même code sert de **code de terrain à Port-Méridien et au plateau d'Aube qui lui est rattaché**, qui n'appartiennent à aucune nation : les engagements qui s'y livrent — jusqu'au campus d'Aube, à la finale 18 — sont des scénarios `paysCode: 'atl'`, et ce qui s'y passe s'écrit sous `pays.atl.*`.

---

## 4. L'engagement : comment se fait la guerre

### 4.1 L'école du front et les fronts nationaux

Chaque nation forme ses commandants à l'**école du front** : un camp d'instruction où l'on apprend à commander à **charges à blanc**, sous l'arbitrage d'Atlas (§5.3). Le joueur y passe : c'est le prologue de sa partie — dix exercices avec Ariane Belloc et Tomas Reiner —, puis deux épreuves de sortie d'école, le col et les couleurs alliées, à blanc elles aussi. **Le premier engagement réel est « Premier courant » (`opus1_fr_01`)**, et il pèse d'autant plus (décision du 26 septembre 2026).

Ensuite, la guerre se fait sur les fronts du pays de départ, région par région, chaque région apportant une mécanique de terrain propre. La France, premier pays entièrement détaillé, compte **18 régions** (13 métropolitaines + Guadeloupe, Martinique, Guyane, La Réunion, Mayotte), la Nouvelle-Calédonie et la Polynésie française pouvant constituer des étapes bonus en tant que collectivités ; elles forment un réservoir de fronts et de revisites. Le système de régions est générique et se réapplique à tout pays phare.

Les pays qui ne sont pas « phares » ont une entrée en guerre résumée en une scène, construite depuis leur fiche.

### 4.2 Les saisons et les fronts

Le voyage propose deux ou trois destinations à chaque étape. Les trois actes suivent les droits du vainqueur, la découverte des concessions croisées et la défense d’Aube ; un acte ne correspond pas à un continent. Le premier opus se déroule en **sept saisons** (`refonte/opus1-fil.md`) : le prologue, trois saisons nationales de quatre nations chacune — France, Luxembourg, Suisse, Pays-Bas ; Maroc, Sénégal, Brésil, Mexique ; Inde, Japon, Australie, Indonésie —, puis trois saisons globales de six finales, des armes de la Cinquième Manche jusqu'au campus d'Aube. **Aube** est sur un plateau neutre rattaché à Port-Méridien, fictif, dans aucune nation réelle (décision du 26 septembre 2026). Port-Méridien tient le Registre et les garanties finales.

Le monde conserve 24 nations, dont 12 au premier plan de production, plus la faction sans nationalité. Ce roster ne fixe pas le nombre de camps d'un engagement : quatre au maximum. `17-aube.md` précise le parcours et les essais disponibles.

### 4.3 L'engagement

Un **engagement** est une bataille déclarée au Bulletin, sur un front homologué, pour une concession nommée, comptée en journées. Il oppose deux coalitions regroupant jusqu’à quatre camps au total : 1v1, 2v1, 1v2, 1v3, 3v1 ou 2v2. Le règlement du Pacte parle encore de **quatre manches** : c'est devenu une expression, et l'origine du nom de la faction (§3.4). L'unité de temps du moteur est la **journée** (un tour de chaque camp, `04-gameplay.md` §1) ; une mission ne dure pas forcément un multiple de quatre journées. « Match » et « manche » restent des mots du règlement d'Atlas, plus des mots du joueur. Conditions de victoire déclarées :

| Condition | Description | Usage |
|---|---|---|
| **Capture du QG** | Atteindre le seuil moteur de capture des QG adverses requis ; voir `04-gameplay.md` | Victoire par défaut avec la mise hors jeu, sauf objectif exclusif déclaré |
| **Mise hors jeu de l’armée adverse** | Toutes les unités des camps adverses requis sont hors jeu | Défaut ou objectif exclusif d’anéantissement, selon le scénario |
| **Objectif spécial** | Objectif propre au front : tenir trois cols, ouvrir une écluse, escorter un convoi de batteries, tenir le point haut à la dernière journée | Signature mécanique du pays, définie dans sa fiche |
| **Décision aux points** | Si la limite de journées (`limiteJournees`) est atteinte sans conclusion : sites tenus, unités restantes, objectifs partiels. Formule exacte : `04-gameplay.md` §9.1 | Évite les batailles sans fin **[Proposition]** |
| **Forfait** | Un camp refuse de se battre ou est disqualifié | Coûte plus cher qu'une défaite (Pacte, art. 4) |

**Ce qu'une victoire prend, et ce qu'elle ne prend jamais.** Une victoire prend la concession nommée : des sites (gisements, centrales, dépôts, postes de distribution), des richesses, des savoirs (laboratoires, prototypes, plans, brevets, archives, relevés) et le terrain tant qu'on le tient. Entre les vingt-quatre nations, elle ne prend **jamais les habitants**, jamais le nécessaire civil, jamais un pays : les sites se remettent en jeu à la réouverture, les savoirs pris restent pris. Ce qu'une victoire a pris s'inscrit au **Registre des concessions** de Port-Méridien — qui tient quoi, jusqu'à quelle année ; il n'y a pas de trophée. La Cinquième Manche est la seule qui garde ce qu'elle prend (§2.3, §3.4).

### 4.4 Arbitrage, sanctions, protêts

Trois arbitres par engagement : un arbitre central, deux juges de front. Les sanctions vont du **rappel** (avertissement) au **carton** (unité retirée de l'engagement), puis à la **mise hors jeu du commandant** (l'armée finit sans pouvoir), puis à la **disqualification**.

Le **protêt du Pacte** est une plainte écrite qu'un arbitre est obligé d'inscrire au registre, même s'il la classe ; c'est la seule arme légale contre une arme sans dossier ou un front violé. Un commandant en dépose un après l'engagement ; le Collège des arbitres tranche, et sa décision est archivée. Nera Aldouin en dépose un par arme sans dossier des Gris, le Bureau en classe huit « sans suite », et **c'est la répétition qui fait le dossier** contre la Cinquième Manche. Le dossier colore les fins, il ne les conditionne jamais (`08-narration-choix.md` §7).

La violation du Pacte existe et fait partie du sujet : arme sans dossier, front modifié avant relevé, engagement arrangé, trêve rompue. C'est le terrain moral du joueur, et la porte d'entrée de la trame de fond.

### 4.5 Le ciel fait partie du front

Atlas ne se bat pas en salle. Un engagement se livre dehors, à la date à laquelle il est livré, sous le ciel du pays où l'on se bat — et le ciel compte autant que le relief. Les règles chiffrées sont dans `04-gameplay.md` ; voici ce que le monde en dit.

**Le Bulletin d'engagement.** Avant chaque engagement, la Régie diffuse le **Bulletin d'engagement** : Célestin Vantour annonce le front, les armes déclarées, la trêve en cours s'il y en a une, la saison, la phase du jour, la **prévision météo des deux prochaines journées**, et ce qui peut partir au tour suivant — une jauge adverse pleine, une station en charge. C'est un rituel autant qu'une information — il l'ouvre toujours de la même façon, il se trompe une fois par an et on le lui rappelle jusqu'à la réouverture. Le Bulletin est **exact** : **Atlas ne surprend jamais un commandant**, même avec une arme qui n'est pas à elle. Un joueur qui perd sous la pluie a été prévenu deux journées à l'avance ; un joueur que frappe le super d'un Gris a vu la jauge pleine et la ligne du Bulletin un tour avant. C'est précisément ce qui rend la météo, les stations et les supers jouables au lieu d'être injustes.

**Les saisons.** La guerre suit les vraies saisons : un engagement prend la date du jour où il se livre, et la saison est celle de l'hémisphère du pays où l'on se bat — la date elle-même ne s'écrit jamais (§2.5). Se battre en hiver ou en été **fait partie du terrain d'un pays**, au même titre que ses montagnes : la Suisse ne se défend pas de la même façon en janvier et en juillet, et se battre au Brésil en janvier, c'est se battre en été. Les états-majors le savent, les calendriers des fronts se négocient là-dessus, et un défenseur qui obtient sa saison favorable n'a rien volé — il a bien lu le calendrier de l'Intendance. La saison ne change pas pendant un engagement.

**La nuit.** Un engagement ne s'arrête pas à la tombée du jour : c'est une règle du Pacte, pas un décor. Les journées se poursuivent, la lumière baisse, on voit moins loin, les villes et les quartiers généraux restent éclairés, et certaines armées sont réputées meilleures à la nuit tombée. Un commandant qui demande l'interruption pour cause d'obscurité est renvoyé à l'article 4 du Pacte : le refus de se battre se paie plus cher que la défaite.

**Vocabulaire imposé.** Trois mots, trois listes fermées, valables pour tous les documents et toutes les routines :

| Terme | Valeurs | Ce qu'on dit dans le monde |
|---|---|---|
| `Saison` | `printemps`, `ete`, `automne`, `hiver` | « la saison du front », jamais un mois réel |
| `PhaseJour` | `jour`, `nuit` | « la nuit tombe sur la troisième journée » |
| `Meteo` | `clair`, `pluie`, `neige`, `brouillard`, `tempete`, `canicule` | « le Bulletin annonce brouillard sur la deuxième journée » |

**Règle d'écriture.** Le temps qu'il fait est un **fait d'engagement**, jamais un drame : une tempête cloue les appareils au sol et fait un beau Bulletin, elle ne dévaste rien et ne détruit aucune ville. Une canicule gêne le matériel lourd, elle ne fait pas souffrir une population. La station de forçage météo des Gris impose une pluie ou une brume sur un front, jamais sur le climat d'une région. Aucun phénomène météorologique réel, daté ou localisé, n'est jamais évoqué (§7.3). Le vent nommé — le mistral, l'alizé — reste une **mécanique régionale** du pays, pas une météo.

### 4.6 Le Tableau des belligérants : comment Atlas annonce une alliance, un grief, une paix séparée, une disparition

**[Proposition : la mise en fiction est une invention de cette bible ; le dispositif — quatre états de relation, cinq retraits au plus — est fixé par `BRIEF.md`. Le geste de la plaque posée à plat vient de `refonte/opus1-hors-serie.md` §3, qui le proposait.]**

Dans le hall de l'Intendance, à Port-Méridien, il y a un panneau de bois clair où sont accrochées les plaques des nations en guerre — les **belligérants**. C'est le **Tableau des belligérants**, « le Tableau » pour tout le monde, et c'est là que le monde apprend qui se bat avec qui, et contre qui. On le regarde beaucoup, on n'en parle pas fort. Les états de relation (`RelationNation`) ne changent pas pour autant : `alliee`, c'est une nation engagée à vos côtés ; `rivale`, un compte à régler ; `retiree`, une paix séparée ou le passage à la Cinquième Manche.

**Une alliance s'annonce par une ligne dans le programme.** Quand une nation décide de se battre aux côtés d'un commandant — de lui prêter son matériel, un commandant en appui déclaré, un front de repli —, l'Intendance le note comme elle note un changement d'horaire : *« Suisse — engagée aux côtés de la France à partir du quatrième front. »* Pas de communiqué, pas de cérémonie. Solveig Tamm accroche les deux plaques côte à côte, et ceux qui passent dans le hall le remarquent avant que Vantour n'en fasse un mot à l'antenne. Le ton du monde tient dans ce détail : une alliance de guerre est une **ligne d'organisation**, pas un serment.

**La nation prête son banc.** Quand une alliance va plus loin qu'une ligne au programme, la nation alliée **prête son banc** — son poste de commandement — pour un engagement : son général confie ses unités et ses consignes au joueur et dirige depuis l'arrière, et la plaque reste la même au Tableau. L'Intendance appelle cela un banc prêté ; Vantour dit « il se bat sous leurs couleurs aujourd'hui », et personne n'y voit un changement de camp — c'est un commandement prêté, et on le rend à la fin de l'engagement.

**Un grief s'annonce par un silence poli.** Une nation fâchée ne dénonce personne : elle demande à ne plus être engagée sur le même front, et elle se bat plus dur quand le calendrier la remet en face. Vantour, qui sait tout, dit *« retrouvailles »* avec une virgule un peu longue avant le mot.

**Une paix séparée s'annonce en trois phrases, et c'est le seul moment où la Régie ne commente pas.** Une nation qui sort de la guerre par une **paix séparée** — un armistice qu'elle signe pour elle seule — le fait par une note affichée au Tableau, toujours de la même longueur : ce qu'elle retire (son armée), à partir de quand (le prochain front), et une formule de politesse. Sa plaque est retournée, face bois. Personne ne la décroche — retourner suffit, et c'est plus dur à regarder qu'un trou. Nera Aldouin contresigne, parce que le Pacte l'exige ; Osmin Talvarec descend dans le hall et reste devant un moment ; Vantour ouvre son Bulletin suivant sur la météo, comme d'habitude, et ne dit rien du tout. **Une paix séparée n'est jamais une rupture entre deux peuples, jamais une menace** : c'est une armée qui rentre chez elle, et une guerre qui compte un belligérant de moins ce mois-ci. On ne montre pas de foule en colère, on ne cite pas de gouvernement, personne ne claque de porte. Ce qui rend la chose lourde, c'est précisément qu'elle soit si petite et si calme.

**Un passage à la Cinquième Manche ne s'annonce pas. [Proposition]** La plaque est retournée comme pour une paix séparée, et la note ne dit qu'une chose : *« délégation sous contrat méridien »*. C'est le front qui dit le reste, quand la délégation revient en face sous les couleurs grises. Atlas n'écrit jamais qu'une nation a changé de camp : elle écrit qu'une délégation a signé — un contrat, pas un peuple.

**Une disparition se dit en posant la plaque à plat.** C'est le seul cas où l'on décroche. Quand un chef de nation meurt — les quatre disparitions de `BRIEF.md`, hors du front —, Solveig Tamm décroche la plaque et la **pose à plat sur la tablette** du Tableau, face visible, avec une ligne d'organisation : *« Grèce — engagée. Commandement repris par son adjointe. »* La nation ne se retire pas ; elle change de banc. Nera Aldouin ne contresigne rien, parce qu'aucun article du Pacte ne le demande ; Osmin Talvarec descend dans le hall et reste devant, comme pour une paix séparée ; Célestin Vantour ouvre son Bulletin sur la météo, ne dit rien pendant tout le Bulletin, et ne prononce le nom qu'à la dernière phrase — une phrase, un fait. Au générique, la plaque est **remise à l'endroit** : c'est la seule fois où l'on remet une plaque qui n'a pas été retournée. Le joueur ne voit jamais l'instant, toujours l'annonce, et une disparition n'est jamais une paix séparée : la nation reste engagée.

**Ce qu'Atlas ne dit jamais, et ce que les routines n'écrivent donc jamais** : qu'une paix séparée est une rupture entre deux peuples, qu'une nation « trahit » le joueur, qu'une alliance est un serment, qu'un peuple est passé à l'ennemi. Le vocabulaire est celui d'un arbitre et d'une intendance : on **s'engage aux côtés de**, on **demande à ne plus être engagé face à**, on **signe une paix séparée**, une délégation **signe avec le Consortium**. Et quand une nation revient — cela arrive, un grief se répare —, elle revient comme on revient : sa plaque est remise à l'endroit, sans commentaire.

### 4.7 La Dépêche du jour

**[Proposition : la mise en fiction de la mission du jour est une invention de cette bible ; le dispositif lui-même est fixé par `BRIEF.md`.]**

Entre deux fronts, la Régie diffuse la **Dépêche du jour** : un **exercice à blanc**, un seul par jour, arbitré par Atlas sur un terrain d'exercice quelque part dans le monde, en écho à ce qui s'y passe ce jour-là. Un festival, une course, une première ascension, une saison remarquable, un anniversaire, une découverte : Atlas y voit une occasion d'entraîner les armées loin des fronts, et Vantour une occasion de parler d'autre chose que de la guerre. La Dépêche est annoncée le matin, jouable une semaine, puis rangée aux archives de la Régie.

**Ce qu'elle est dans le monde :** un exercice hors de la guerre — pas de front, pas de concession, des charges à blanc comme à l'école du front (§5.3). Personne n'y gagne ni n'y perd un site, personne n'y meurt. Les commandants y viennent pour s'entraîner, pour essayer un prototype à l'essai (§3.2) ou parce que Vantour les a appelés la veille.

**Ce qu'elle n'est jamais :** une dépêche sur un drame. Atlas ne commente pas une catastrophe, un accident, un fait divers, une crise, un conflit, une élection. La règle de ton est simple et sans exception : **on ne fait pas jouer un exercice par-dessus le malheur de quelqu'un.** Un événement du monde n'entre dans la Dépêche que s'il appartient au registre autorisé (§7.2) — sport, fête, culture, exploit, découverte, science, saison remarquable. Dans le doute, il n'y a pas de Dépêche ce jour-là : le vide vaut mieux qu'une faute.

**Conséquence de règle :** une Dépêche n'écrit **aucun** flag de campagne. Elle ne peut rien changer au voyage, aux rivalités ni à la trame ; sa récompense est cosmétique, ou une carte de terrain au plus (`08-narration-choix.md` §4.4).

---

## 5. Guide de ton

### 5.1 Registre

Une guerre sérieuse, dure, sans complaisance : on prend, on tient, on perd des équipages, on signe des trêves qu'on ne respecte pas ; fronts, sièges, concessions et alliances ont un prix. L'humour appartient aux personnages — Vantour, Nikos, Saran —, jamais au narrateur ; il est **affectueux**, jamais moqueur envers une culture ; l'ironie se dirige vers Atlas, le Consortium, les correspondants et les commandants eux-mêmes, jamais vers un peuple. Réalisme des matières et de la fatigue, pas de l'horreur : le sang, les corps, les ruines et les civils restent hors champ. Le sérieux passe par les relations et les suites des décisions, pas par des rappels de mort à chaque exercice ; des scènes de travail, de soulagement et d'humour sobre séparent les revers.

**Personne n'explique le monde au joueur.** Les mots du Pacte se comprennent la première fois qu'un personnage s'en sert ; un briefing commence par la personne qui a besoin d'aide, le problème visible et l'objectif (`refonte/lore-v2.md`, « Consignes pour la suite de production »).

**Longueur.** Une réplique tient en une à trois phrases. Une scène de choix tient en six à dix répliques. On ne fait jamais lire un paragraphe au joueur entre deux batailles.

### 5.2 Vocabulaire

> **Décisions du propriétaire, canon depuis le 26 septembre 2026.** Le 10 septembre : « on a droit de dire guerre, combat, mort, c'est fictif, c'est un jeu » — les mots de la guerre s'écrivent quand la scène le demande, et le glossaire (`content/i18n/glossaire.fr.json`) ne les refuse plus. Le 12 septembre : **aucun mot que le joueur devrait chercher** — un terme du monde s'explique en une phrase par un personnage la première fois qu'il sert (concession, protêt, dossier, Registre, désaffecté), sinon on prend un mot courant (le « bocage » devient les champs et les haies). Cette seconde règle prime sur toute liste de vocabulaire, y compris celle-ci. Ce qui reste interdit est un **ancrage**, pas un vocabulaire : le monde réel (§7.3) et l'horreur graphique. Sur le front, le Registre d'Atlas dit **mettre hors jeu** — c'est le vocabulaire du HUD et du moteur, une règle du monde (§5.3), pas une pudeur.

| Interdit | Ce qu'on écrit |
|---|---|
| ennemi désignant un peuple réel | « ennemi » se dit d'une armée ou d'un commandant de la guerre fictive ; « adversaire » reste le mot d'Atlas, qui arbitre les deux camps et refuse d'en nommer un |
| guerre ou conflit historique réel | la **guerre de l'énergie** (« la guerre » dans la bouche des personnages), un front, un engagement, une bataille — toujours fictifs |
| violence graphique | bataille, combat, tir, destruction de matériel, équipage perdu : dits, jamais montrés |
| armée réelle identifiable, arme réelle nommée | l'armée d'une nation du jeu ; ses unités par leur usage (blindé de percée, pièce de portée, appareil de reconnaissance) ; aucune arme réelle par sa marque ou son constructeur |
| ~~tuer, mourir, mort, blessé, victime, détruire, arme, armement~~ — **libres depuis le 10 septembre 2026** | dans un dialogue écrit à la main, le mot juste ; sur le HUD et dans le moteur, le Registre dit **mettre hors jeu** ; une production de routine n'écrit jamais une mort (§5.3) |
| envahir, invasion, occuper, conquérir | **prendre** un site, **tenir** un front, **avancer**, capturer un bâtiment : une victoire prend des sites, jamais un pays ni ses habitants |
| libérer, annexer, coloniser — entre nations | *(aucun équivalent entre les vingt-quatre nations)* ; seule la Cinquième Manche annexe pour de bon (`refonte/lore-v2.json`), et l'on dit qu'elle **garde**, qu'elle **absorbe** ce qu'elle prend |
| sang, cadavre, ruines, civils, réfugiés | *(aucun équivalent : hors champ)* |
| régime, gouvernement, président, ministre, parti, élection | le commandant, l'état-major, la délégation, le Bureau d'Atlas |
| frontière (au sens de dispute réelle) | **ligne de front**, limite de carte |
| religion, foi, culte, dieu | *(hors périmètre)* |
| ennemi juré | **rival**, rivalité, « un compte à régler » |
| massacre, anéantir un peuple | l'**anéantissement d'une armée** signifie la mise hors jeu de toutes ses unités ; jamais un peuple, jamais des civils |
| les Jeux, le tournoi, le match — pour dire la guerre | **la guerre, l'engagement** ; « les Jeux » ne se dit que par dérision, dans la bouche d'un vétéran — le Bureau l'écrit encore dans ses circulaires, et le front trouve ça obscène |
| la Ronde — pour dater | l'**année de guerre** : « an 14 », « au printemps de l'an 12 » (§2.5) |
| la mort d'un personnage nommé | uniquement dans les **quatre scènes écrites à la main** des disparitions (`BRIEF.md`, « Quatre disparitions » ; `refonte/opus1-hors-serie.md` §3), une fois chacune, dans la bouche de la personne la plus proche, et « disparition » partout ailleurs ; jamais dans une production de routine |

**Zone grise assumée.** Les unités sont des armes : blindés, artillerie, appareils, navires. Le texte officiel d'Atlas dit **matériel déclaré** ; les personnages disent armes, chars, pièces. On les désigne par leur usage plutôt que par un lexique militaire réel, et aucune ne porte le nom, la marque ou le constructeur d'une arme réelle. Elles tirent, touchent et détruisent du matériel ; l'écran ne montre ni sang ni corps.

### 5.3 La règle du Registre : Atlas compte des pièces

*Décision du propriétaire, 10 septembre 2026, canon depuis le 26 : « c'est vraiment une guerre ». La doctrine du marquage de l'ancien canon — des charges de marquage sur tout le matériel, une unité escortée au dépôt, un équipage qui retire son plastron et va boire quelque chose — est tombée. Le numéro de la section, que d'autres documents citent, ne change pas.*

**Les armes sont réelles, et les équipages meurent.** Une unité mise hors jeu est une unité perdue : un blindé détruit, une pièce hors d'usage, un appareil abattu — et un appareil abattu emporte son équipage. On le dit, on ne le montre pas : ni sang, ni corps, ni violence graphique ; à l'écran, du matériel qui s'éteint et de la fumée grise (`18-rendu-sprites.md`).

**Atlas compte des pièces, pas des morts.** Le Registre dit **hors jeu** : c'est le mot du HUD et du moteur, et c'est une règle du monde — l'arbitre compte ce qui sort du front, pas qui meurt, et c'est exactement ce que le monde reproche à Atlas. Les dialogues et Vantour disent mort, tué, détruit ; le HUD, jamais.

**La balise du Registre. [Proposition]** Toute arme déclarée porte une plaque de série et une balise du Registre, qui compte les coups reçus, dit à l'arbitre ce qui est hors jeu, et permet à un juge de front de couper une pièce sanctionnée (le carton, §4.4). Les vétérans l'appellent encore « le marquage ». C'est cette balise que le Verrou de Basile Kelm détourne (`refonte/supers-vilains.md` §2.7) : du savoir volé au Bureau, pas à un atelier.

**À l'exercice, à blanc.** À l'école du front — les dix exercices du prologue et les deux épreuves de sortie d'école (§4.1) — et à la Dépêche du jour (§4.7), on tire à **charges à blanc** : les unités portent des marqueurs, l'arbitre déclare hors jeu, et personne n'est blessé. Le premier engagement réel est « Premier courant » (`opus1_fr_01`) : c'est ce qui donne son poids au premier front.

**L'arme sans dossier est le crime absolu du Pacte.** C'est pourquoi l'article 2 existe (§2.3), pourquoi le contrôle des armes est un enjeu (§3.2), et pourquoi les huit armes sans dossier des Gris sont la matière du dossier contre la Cinquième Manche (`refonte/supers-vilains.md`). La famille `iem.abattre` (`04-gameplay.md` §7.2) n'est pas un scandale de règlement : c'est un appareil abattu, et son équipage avec — décision du propriétaire du 10 septembre 2026 (après-midi).

**Aucune routine n'écrit une mort.** Une production générée — routine lore, routine cerveau, Dépêche, fil — ne raconte, n'annonce ni ne suggère jamais la mort de quelqu'un, personnage ou équipage, et ne déclare, ne suggère ni ne prolonge une disparition. Elle peut dire la guerre : combats, destructions, pertes de matériel. Les morts du jeu sont écrites à la main. Un contenu généré qui en porte une est refusé (`05-routines.md` §4.3).

**Les quatre disparitions** (amendement du 9 septembre 2026). Quatre chefs de nations alliées meurent au cours du premier opus — jamais sur un front, jamais par une arme, jamais par un homicide commis par une personne identifiée. Ce sont des morts du dehors — la route, la mer, la montagne, la maladie, l'âge —, auxquelles les décisions de la Cinquième Manche ont indirectement contribué. Ce sont les seules morts nommées de chefs alliés, écrites à la main (`BRIEF.md`, « Quatre disparitions » ; `refonte/opus1-hors-serie.md` §3), et Atlas les annonce en posant une plaque à plat (§4.6).

### 5.4 Réglage de la trame de fond

La menace est une guerre et un monopole : la Cinquième Manche prend les réserves, les routes et les technologies, puis veut Aube. Les fronts convergent vers les accès d'Aube et son campus. Archives, protêts et conférences de presse rendent les responsabilités lisibles sans remplacer le point culminant tactique : **le dossier suit les victoires, il ne les remplace pas**. Pas d'explosion de réacteur : Aube est un campus d'essai, et la dernière bataille se livre pour ses accès, pas contre un réacteur à détruire. La guerre tue, jamais à l'écran.

---

## 6. Archétypes de commandants

Dix archétypes réutilisables. Chaque fiche pays choisit un archétype (et éventuellement un second, en teinte). L'archétype fixe le **tempérament**, la **famille de pouvoir** et la **courbe** ; la fiche pays fournit l'habillage culturel et géographique.

> **Liste canon, propriétaire.** Cette table est **la** liste des archétypes du projet (`BRIEF.md`, arbitrage n° 1 du 5 septembre 2026). Ce sont les dix de `06-pays-de-depart.md` §2 — déjà affectées aux 24 pays, à raison de deux à trois pays par archétype —, augmentées des colonnes d'équilibrage de cette bible. Un seul remplacement par rapport à `06` : **« le professeur » devient « la météorologue »**, parce que le climat entre dans le jeu (§4.5) et qu'un archétype qui lit le ciel vaut mieux qu'un doublon du stratège. Les pays qui portaient « le professeur » sont réaffectés dans `06`. **Aucune routine ne choisit un archétype hors de cette table.** Le genre du libellé n'impose pas celui du commandant : un pays « la fonceuse » peut avoir un commandant masculin, et l'inverse.

La colonne **Clé** est celle que les données emploient : c'est la valeur de `Country.archetypeCommandant` et de `Commander.archetype` (`03-schemas.md` §1 et §2, où le type `Archetype` reprend cette union fermée), et c'est elle, jamais le libellé accentué, qui circule en JSON.

| # | Clé | Archétype | Tempérament | Famille de pouvoir | Courbe | Contré par |
|---|---|---|---|---|---|---|
| 1 | `stratege_prudent` | **Le stratège prudent** | Posé, avare de mots, joue trois coups plus loin | Défense et prévoyance : bonus en terrain fortifié, réduction des dégâts subis, prévisualisation d'une intention adverse | Lente, très forte en fin de match | La fonceuse, le showman |
| 2 | `fonceuse` | **La fonceuse** | Impatiente, franche, allergique à l'attente | Mouvement et initiative : mouvement supplémentaire, seconde action, charge qui ignore un malus de terrain | Explosive tôt, s'essouffle | La gardienne, la survivante |
| 3 | `veteran` | **Le vétéran** | Bourru, protecteur, plein d'anecdotes des années passées | Vétérance : unités promues qui gardent leurs bonus, remise en état d'une unité touchée, moral des troupes | Régulière, cumule sur la durée | La météorologue, le prodige |
| 4 | `ingenieur` | **L'ingénieur** | Méthodique, bricoleur, parle de la carte comme d'un chantier | Terrain construit : ponts temporaires, remblais, réparation de villes, blocage d'un passage | Moyenne, dépend de la carte | La fonceuse, la météorologue |
| 5 | `diplomate` | **La diplomate** | Chaleureuse, manœuvrière, connaît tout le monde à Port-Méridien | Capture et économie : capture accélérée, revenu majoré, ralliement d'une ville neutre, ravitaillement à distance | Très lente, écrasante si le match dure | La fonceuse, le showman |
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
- Un co-commandant recruté apporte un **appoint mécanique** — c'est ce qui donne une valeur mécanique, et pas seulement narrative, au fait de traiter correctement ses adversaires. La règle est tranchée (`BRIEF.md`, arbitrage n° 2 du 5 septembre 2026) et sa formulation chiffrée appartient à `04-gameplay.md` §7.5 : un co-commandant apporte **son passif seul, plus une barre de jauge de départ**. Un **commandant régional français** apporte en plus sa **carte de terrain à usage unique** — et cette carte **est l'une des trois** de la sacoche, jamais une quatrième (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5, `07-france-regions.md` §2.4). Plafonds : **trois co-commandants recrutés, un seul actif par engagement** (`08-narration-choix.md` §4.3), **trois cartes de terrain**, **cinq spécialités possédées et une seule équipée par engagement**. C'est par ces plafonds qu'on corrige l'inflation de puissance, jamais par une règle nouvelle. **Il n'existe pas de demi-pouvoir** : un archétype ne se joue jamais à moitié, et aucune routine ne doit en produire un.

  Diégétiquement : un co-commandant n'entre pas sur le front à votre place. Il est au poste de commandement, il vous prête sa manière — ce que le règlement du Pacte appelle une **assistance déclarée**, inscrite au Bulletin d'engagement avant la première journée. On en déclare une, pas trois.

---

## 7. Charte de sensibilité pour les vrais pays

### 7.1 Principe

Un pays réel est représenté **comme on représente une équipe qu'on aime** : par son terrain, sa table, ses fêtes, ses histoires et ses manies. Le test à appliquer à toute production : *un habitant de ce pays pourrait-il rire de ça avec nous, à notre table ?* Si la réponse hésite, on retire.

### 7.2 Ce qu'on peut utiliser

| Registre | Exemples d'usage |
|---|---|
| **Géographie et relief** | Montagnes, fleuves, deltas, îles, déserts, forêts, côtes, altitude, insularité |
| **Climat et saisons** | Mousson, sécheresse, nuit polaire, brouillard, canicule, gel |
| **Gastronomie** | Produits, plats, boissons, marchés, rituels de table, superstitions d'avant-bataille |
| **Sport et jeu** | Sports populaires, ferveur des supporters, chants, rivalités sportives régionales |
| **Folklore, contes, fêtes** | Créatures de légende, carnavals, festivals, costumes, musiques, danses |
| **Savoir-faire et paysage construit** | Ingénierie (digues, tunnels, trains), artisanat, architecture, agriculture |
| **Clichés affectueux et auto-dérision** | Le cliché qu'un habitant assume en riant : ponctualité, sieste, pluie, café, bavardage, fierté locale |

### 7.3 Ce qu'on n'utilise jamais

- Guerres, batailles, occupations, colonisations, indépendances et traités **réels**, quelle que soit l’époque. Les batailles de tournoi fictives constituent le jeu.
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

Les routines peuvent inventer librement : les **commandants** et leur entourage, les **noms de fronts** et de terrains, les **surnoms d'armées et d'unités**, les **rituels d'avant-bataille**, les **objets fétiches**, les **anecdotes des années passées**, les **figures d'Atlas secondaires** et les rencontres secondaires de la **Cinquième Manche**, sans modifier son but, sa dirigeante ni les biographies établies dans `content/personnages.json`. Toute invention est signalée dans la sortie JSON.

### 7.5 Procédure en cas de doute

1. **Reformuler** dans un registre autorisé (§ 7.2). Un pouvoir « issu d'une tradition militaire » devient un pouvoir « issu d'une tradition de montagne ».
2. Si la reformulation ne tient pas, **retirer l'élément** et produire sans lui.
3. Si la production entière dépend de l'élément douteux, **ne pas produire** et signaler la mission en quarantaine avec le motif exact.

Le doute n'est jamais tranché par la routine dans le sens de la production. La routine contrôle applique le glossaire structuré et les interdits contextualisés de §5.2 et §7.3. Une recherche aveugle du mot « guerre » ne constitue plus un contrôle valide du nouveau canon.

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

Les clés ne changent pas avec le registre de guerre (26 septembre 2026) : le domaine `monde.tournoi.*` garde son nom et porte les engagements du joueur, et seuls les libellés de sens ci-dessous ont été repris.

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
| `pays.<xx>.ralliement_cinquieme` | booléen | trame | Une délégation de ce pays est passée à la Cinquième Manche à l'acte III — un contrat, jamais un peuple |

### 8.3 Flags de pays spécifiques (exemples canon)

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `pays.fr.regions_visitees` | compteur 0–18 | moteur | Régions parcourues pendant la campagne de France |
| `pays.fr.tour_complet` | booléen | moteur | Les 18 régions ont été jouées |
| `pays.fr.barrage_rompu` | booléen | choix | Un barrage a été ouvert pendant un engagement ; la vallée reste inondée |
| `pays.lu.sponsor_accepte` | booléen | choix | Le contrat du Consortium Méridien a été signé |
| `pays.lu.archives_ouvertes` | booléen | choix | Accès obtenu aux archives de protêts conservées sur place |
| `pays.jp.train_prete` | booléen | choix | La ligne rapide reste utilisable par le joueur lors des revisites |
| `pays.jp.duel_honore` | booléen | choix | Le duel d'honneur à blanc qui suit l'engagement a été accepté selon la forme locale |
| `pays.br.foule_conquise` | booléen | choix | Le public local soutient le joueur, ici et ailleurs |
| `pays.nl.digue_ouverte` | booléen | choix | Un polder est inondé de façon permanente |
| `pays.ch.col_scelle` | booléen | choix | Un col a été bloqué et le reste |
| `pays.ma.oasis_preservee` | booléen | choix | Le point d'eau n'a pas été utilisé comme levier tactique |
| `pays.mx.fete_partagee` | booléen | choix | Le joueur a joué le jeu de la fête locale, la veille de l'engagement |

**Régions d'un pays phare.** Il n'existe **pas** de portée `region.*`. Un flag régional est un flag de pays préfixé par le nom de la région : `pays.fr.bretagne_maree_lue`, `pays.fr.ile_de_france_finale_gagnee`. La liste des dix-huit est dans `07-france-regions.md` §4 (champ « Récompense et flag »).

*(La liste des 24 pays et leurs trois flags propres sont fixés par `06-pays-de-depart.md` §5, qui est propriétaire des fiches pays ; les codes ci-dessus en sont des **exemples canon**. Les gabarits du §8.2 s'ajoutent aux flags propres de chaque pays. Ajouter un flag spécifique reste une décision humaine, jamais une décision de routine.)*

### 8.4 Flags de monde

| Flag | Type | Écrit par | Sens |
|---|---|---|---|
| `monde.atlas.soupcon` | compteur 0–10 | choix, trame | Ce que le joueur soupçonne et a vu de travers chez Atlas |
| `monde.atlas.credibilite` | compteur 0–10 | choix, moteur | Crédit du joueur auprès du Bureau et du Collège |
| `monde.atlas.arbitre_alliee` | booléen | trame | Nera Aldouin partage ses archives avec le joueur |
| `monde.atlas.dossier_truquage` | compteur 0–5 | choix | Preuves réunies d'engagements arrangés |
| `monde.atlas.reforme_deposee` | booléen | choix | Le joueur a déposé une demande de réforme du règlement |
| `monde.atlas.sponsor_meridien` | relation −3…+3 | choix | Rapport au Consortium Méridien |
| `monde.regie.faveur` | relation −3…+3 | choix, moteur | Comment Célestin Vantour raconte le joueur |
| `monde.public.ferveur` | compteur 0–10 | moteur | Ferveur du public mondial |
| `monde.cinquieme.contact` | booléen | trame | La faction a approché le joueur |
| `monde.cinquieme.infiltre` | booléen | choix | Le joueur a feint d'accepter et joue double jeu |
| `monde.cinquieme.demasquee` | booléen | trame | La faction est publiquement nommée |
| `monde.cinquieme.chef_identifie` | booléen | trame | Sélène Veyr est identifiée par le joueur |
| `monde.cinquieme.ralliements` | compteur 0–24 | trame | Nombre de pays passés à la faction (dérivé) |
| `monde.tournoi.serie_propre` | compteur | moteur | Engagements gagnés sans exploiter une faute adverse |
| `monde.carnet.pages_scellees` | compteur 0–10 | choix | Pages du carnet remises officiellement au Collège |
| `monde.atlas.homologation_contestee` | booléen **[Proposition]** | choix | Le joueur a déposé ou soutenu un protêt contre une décision de la Commission d'homologation (§3.2) |
| `monde.atlas.essai_soutenu` | booléen **[Proposition]** | choix | Le joueur a défendu publiquement un prototype à l'essai, badge orange compris |
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
9. **Un fil écrit des flags de campagne, contrairement à une Dépêche.** C'est sa différence de nature : un fil compte, un exercice de la Dépêche non (`13-campagne.md` §5.1, `08-narration-choix.md` §4.6). Ses flags restent pris dans cette liste, comme partout ailleurs. **[Proposition]**

---

## 9. Récapitulatif des propositions de ce document

*Depuis le 26 septembre 2026, ce que le lore v2 validé fixe n'est plus une proposition de cette bible : la guerre de l'énergie et l'an 14, le Pacte en quatre articles, l'engagement et le Registre, le Bulletin d'engagement, la Sélection Méridienne armée et garante des trêves, la règle du Registre (« hors jeu ») et la guerre qui tue sans gore (`BRIEF.md`, « Le lore v2 validé »). Restent des inventions de cette bible, marquées **[Proposition]** dans le texte :*

1. **Port-Méridien**, île neutre, siège d'Atlas et du Registre, et le plateau d'Aube qui lui est rattaché, sous le même code de terrain `atl`.
2. Le **calendrier en années de guerre** (an 14 en cours) et l'interdiction des dates réelles qui en découle ; l'âge du Pacte, laissé ouvert.
3. Les **sans-drapeau** : le personnel d'Atlas renonce à sa nationalité, d'où des noms inventés et non localisables — garde-fou éditorial autant que trait de fiction.
4. Les organes d'Atlas : Bureau, Collège des arbitres, Régie (le bureau de presse de guerre), Intendance, Cartographie, et la **Commission d'homologation**, contrôle des armes du Pacte (matériel de fondation, prototype sous surveillance et son badge orange, déclaration au Pacte, retrait du catalogue).
5. Les trois figures : **Osmin Talvarec**, **Nera Aldouin**, **Célestin Vantour** — et Vantour, correspondant de guerre, comme narrateur diégétique des conséquences.
6. Le **Consortium Méridien**, sponsor apatride d'Atlas, porteur des choix de « sponsor douteux ».
7. La faction **la Cinquième Manche**, son nom, son signe, sa figure visible **Hadran Ost**, sa dirigeante Sélène Veyr, son monopole de l'énergie et du savoir, et son offensive contre le programme fictif Aube.
8. **La règle du Registre** mise en fiction : la balise du Registre (« le marquage » des vétérans), les charges à blanc réservées à l'exercice, et l'arme sans dossier comme crime absolu du Pacte.
9. La **fable du front borné** et sa devise (« Le sol se prend à la journée. Les gens ne se prennent pas. »), et la **réouverture** comme nom du cycle de quatre ans.
10. L'**engagement** et ses quatre manches devenues une expression, la **décision aux points**, l'échelle de sanctions (rappel, carton, mise hors jeu du commandant, disqualification) et le **protêt du Pacte** comme source de preuves.
11. Les colonnes d'équilibrage des **dix archétypes canon** (tempérament, famille de pouvoir, courbe, contré par), dont les trois entrées nouvelles — la diplomate, la survivante, le prodige — et les contres réajustés. La règle du co-commandant, elle, n'est plus une proposition : **passif seul plus une barre de jauge**, carte de terrain pour un commandant régional français — **l'une des trois, pas une quatrième** —, trois recrutés et un seul actif par engagement.
12. Le **Bulletin d'engagement** de Célestin Vantour comme rituel d'avant-bataille, la guerre au rythme des vraies saisons, la nuit qui n'interrompt pas un engagement, et la règle « le temps qu'il fait est un fait d'engagement, jamais un drame ».
13. La **Dépêche du jour** : un exercice à blanc quotidien, hors de la guerre, tiré du registre autorisé, jamais d'un drame, sans effet sur la campagne.
14. La portée de flags **`cmd.<id>.*`**, le domaine `monde.depeche.*`, les trois flags `monde.atlas.homologation_contestee`, `monde.atlas.essai_soutenu`, `monde.depeche.serie`, et les neuf règles dures sur les flags.
15. **Barnab Estève**, le seul commandant en activité qui a connu les Vieilles Manières, et sa réplique unique — la limite absolue du hors-champ (§2.1).
16. Les **généraux secrets** comme figures d'Atlas jouables (§3.5), leur statut de sans-drapeau, et la doctrine **« jamais indispensable »**.
17. Le domaine `monde.secret.*` **absent de cette bible et de `content/flags.json` par construction**, le flag dérivé `monde.tournoi.fils_termines`, et les règles 8 et 9 du §8.6.
18. **La Sélection Méridienne**, dite « les Gris » (§3.4) : officiellement la force d'essai et de garantie des trêves d'Atlas, en fait l'armée privée du Consortium, commandée par Ost, qui devient à l'acte III la Cinquième Manche à visage découvert — un adversaire sans être un pays. Son code de camp à trois lettres, `atl`, sert aussi de code de terrain à Port-Méridien et au plateau d'Aube.
19. **Le Tableau des belligérants** (§4.6) et ses gestes : deux plaques côte à côte, une plaque retournée, une note « sous contrat méridien », une plaque posée à plat, une plaque remise à l'endroit.
