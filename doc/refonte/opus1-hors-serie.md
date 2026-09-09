# Opus 1 — Les épisodes hors-série et les quatre disparitions

**Statut : conception.** Décision du propriétaire, 9 septembre 2026 au soir, en deux demandes : faire vivre les douze nations qui ne sont pas au premier plan dans des épisodes parallèles dont l'accès dépend des choix du joueur ; et faire mourir quatre chefs de nations alliées, hors du terrain. Le registre voisin `opus1-hors-serie.json` porte les 28 fiches d'épisode et les quatre disparitions ; ce document dit pourquoi elles sont comme elles sont. Aucune fiche n'est une carte jouable. Les 28 hors-série **ne comptent pas** dans les 172 missions de l'opus (`BRIEF.md`, Refonte Aube) : ils viennent en supplément, comme les quêtes de `quetes.md`.

Ce qui est canon ici vient de `BRIEF.md`, de `doc/17-aube.md`, de `doc/01-bible.md` (§4.6 pour le Tableau, §5 pour le ton, §7 pour la charte, §8 pour les flags), de `doc/08-narration-choix.md` §4.5 et de `doc/13-campagne.md` §5.2 (liste fermée des conséquences). Les biographies sont celles de `content/personnages.json`, révision 4 ; les noms de commandants qui figurent encore dans `doc/06-pays-de-depart.md` et dans `content/flags.json` (Hrefna, Stavros, Naran…) sont antérieurs à cette révision et **ne sont pas repris** ici (voir « Ce qui reste à trancher »). Tout ce que ce document invente hors des zones ouvertes de `01-bible.md` §7.4 est marqué **[Proposition]**.

## 1. Le principe des hors-série

Un hors-série est un **arc court par nation** — un à trois épisodes — joué en parallèle de la campagne, sur la carte du monde, comme un fil (`13-campagne.md` §5.1). Il se distingue d'un fil par trois traits :

1. **Il s'ouvre sur une décision de la trame, pas seulement sur un flag.** La condition d'ouverture de chaque premier épisode lit soit un flag canon de `01-bible.md` §8, soit **l'option retenue d'une décision nationale** (`opus1_<nation>_<n>_decision`, options `a` / `b`, de `opus1-nations.json`), soit les deux par un `ou`. C'est ce qui fait qu'on « ne croisera peut-être pas » ces nations : deux joueurs aux décisions différentes ne voient pas les mêmes arcs. Chaque première condition a **deux portes** (une décision *ou* un flag), pour qu'un arc ne dépende jamais d'un seul choix binaire. **[Proposition]** La lecture d'une décision demande un onzième type de `Condition`, `{ type: 'decision', cle, option }`, qui n'existe pas dans `13-campagne.md` §8.2 ; l'alternative est de traduire chaque décision en flag `pays.<xx>.*`. À trancher.
2. **Il est ancré.** Chaque épisode déclare après quel épisode national, quelle finale ou quel hors-série précédent il devient jouable (`ancrage`). Les arcs sont répartis sur les trois saisons nationales et les finales, jamais tous à la fin.
3. **Il rallie ou fâche, jamais ne retire.** Ses conséquences sont prises dans la liste fermée de `13-campagne.md` §5.2 et bornées comme celles d'un fil : `relation_nation` vaut `alliee` ou `rivale`, une `unite_offerte` fait une ou deux unités, une `remise_production` va de 0,80 à 0,95, une `trace_carte` reste dans le plafond de trois traces par pays. Aucun hors-série n'écrit `monde.secret.*`. Aucun ne révèle la fratrie Maël/Lise ni la paternité d'Edran Sorel avant `opus1_finale_10` ; quand Edran est cité, il est « prestataire de réserve ». **Deux joueurs aux mêmes choix de trame ont la même fin, hors-série joués ou non** : les conséquences ne touchent ni les bascules ni les conditions de fin, elles changent qui est au banc, ce que dit Vantour et ce qu'il y a dans le carnet.

**Chaque nation est justifiée par son terrain, son climat, sa fiche et le pouvoir de son commandant**, jamais par son histoire, sa politique ou sa religion (`01-bible.md` §7.3). Le champ `justificationNation` du registre le dit épisode par épisode, et reprend les `interdits` de la fiche pays concernée. Les adversaires des hors-série sont les huit de `opus1-adversaires.md` ou le commandant de la nation lui-même ; les « délégations sous mandat » qui les accompagnent ne sont jamais une nation nommée.

**Le rythme d'un arc.** Le premier épisode se joue **contre** le commandant de la nation, sur sa carte, avec sa spécialité : on apprend la nation en la combattant. Le deuxième se joue **avec** lui, contre un adversaire de la faction, et pose le **dilemme canon** du personnage (`identiteTactique.dilemme`) comme choix du joueur : c'est là que la relation se gagne. Le troisième, quand il existe, prolonge l'arc plus tard dans la Ronde. Les douze commandants ont désormais, dans `content/personnages.json`, deux faits d'historique de plus et leur premier hors-série comme `identiteTactique.mission`.

## 2. Les douze nations

### Argentine — Leandro Paz, « Le péage de la pampa » (2 épisodes)

**Pourquoi cette nation.** Une plaine immense où une seule route vaut un péage : la spécialité « La plaine » (mouvement +1 sur plaine et route) et le passif de Leandro (attaque ×1,08 sur plaine) font de la carte un problème de routes de contournement, ce qui est exactement sa motivation canon — empêcher qu'une voie logistique devienne un péage obligatoire. Le delta donne un terrain d'escorte.

- **`opus1_hs_ar_1` — La route à péage.** 1v1, `capture_qg`. Une seule route entre les deux QG, un dépôt sous licence exclusive posé dessus ; Leandro montre qu'on gagne par les chemins de traverse. S'ouvre après `opus1_br_04` (le Brésil est le rival naturel de l'Argentine) si le joueur a **partagé les relevés** (`opus1_br_04_decision` = a) *ou* respecté Lívia Moura (`pays.br.rival_respecte`).
- **`opus1_hs_ar_2` — Le chenal du delta.** 2v1, `escorte`, avec Leandro contre Yuna Serrat. Un club du delta a perdu son accès aux batteries ; le transport passe par les bras d'eau. Choix : **ouvrir le chenal** (trace `pays.ar.chenal_ouvert`, ne se referme pas) ou contourner par la plaine.
- **Conséquences.** Argentine `alliee` ; trace de carte si le chenal est ouvert ; variante de dialogue à `opus1_finale_02` (Leandro reconnaît le contrat de priorité de Basile pour ce qu'il est : un péage) ; entrée de carnet.

### Canada — Noémie Leduc, « L'essai comparable » (2 épisodes)

**Pourquoi cette nation.** Les plus grandes cartes, très peu de villes, un hiver qui est la carte elle-même ; « L'hiver ne compte pas » annule le surcoût de neige et la forêt boréale soigne ; le passif de Noémie donne vision +1 en forêt. Sa motivation canon — rendre les essais comparables — la place naturellement face à la Sélection Méridienne, qui joue les essais d'homologation (`01-bible.md` §3.4).

- **`opus1_hs_ca_1` — Le grand gel.** 1v1, `capture_partielle`, contre Ost et sa pièce à badge orange. Noémie exige que l'essai se joue sous les mêmes conditions pour les deux camps et confie au joueur le banc de l'équipe témoin. S'ouvre après `opus1_ch_08` si le joueur a pris position sur l'homologation (`monde.atlas.homologation_contestee` *ou* `monde.atlas.essai_soutenu`).
- **`opus1_hs_ca_2` — Les provisions de la tempête.** 2v2, `survie` jusqu'à la fin de J10, avec Noémie contre Ost et Basile Kelm ; tempête annoncée par le Bulletin à deux journées. Choix : **partager les provisions** avec la délégation adverse bloquée (`pays.ca.provisions_partagees`, `pays.ca.rival_respecte`) ou garder la réserve.
- **Conséquences.** Canada `alliee` ; variante de dialogue à `opus1_finale_02` (les relevés de Noémie contredisent la « priorité » de Basile) ; entrée de carnet.

### Fidji — Jone Vakalau, « Le transport prêté » (2 épisodes)

**Pourquoi cette nation.** Un micro-archipel de lagon où les eaux peu profondes se traversent comme de la plaine, le plus petit budget du tournoi, et le plus jeune commandant ; le passif de Jone porte sur les coques et les amphibies. Sa motivation canon — garder les petites équipes dans une compétition dominée par les grands budgets — est une histoire de transport retenu pour une facture.

- **`opus1_hs_fj_1` — Le lagon sans transport.** 1v2, `escorte`. Jone prête son transport au joueur pour ramener l'équipement d'un club, contre Yuna Serrat et une délégation sous mandat. S'ouvre après `opus1_id_04` si le joueur a partagé les relevés (`opus1_id_04_decision` = a) *ou* respecté Tess Roa, sa rivale naturelle (`pays.nz.rival_respecte`).
- **`opus1_hs_fj_2` — La chaîne de passes.** 2v1, `relais`, avec Jone contre Relais Zéro et ses drones. Choix — son dilemme canon : **tenter le raccourci** par le récif (`pays.fj.chaine_de_passes`) ou **garantir le retour de tout l'équipement** (`pays.fj.salut_rendu`).
- **Conséquences.** Fidji `alliee` ; un transport offert ; entrée de carnet.

### Grèce — Nikos Delis, « Le café du port » (3 épisodes, disparition)

**Pourquoi cette nation.** Des centaines d'îlots reliés par des môles et des passerelles (`pied_marin`), les blindés au port, un café avant le coup d'envoi ; le passif de Nikos donne défense ×1,15 sur plage et port. Sa motivation canon est de transmettre une méthode qui survive à son départ du circuit — c'est pour cela qu'il est l'une des quatre disparitions, et celle qui dépend d'un choix.

- **`opus1_hs_gr_1` — Le café avant le coup d'envoi.** 1v1, `capture_qg`. Nikos reçoit le joueur et lui montre qu'une méthode vaut mieux qu'un nouvel outil. S'ouvre après `opus1_lu_08` si le joueur a garanti la livraison au signataire (`opus1_lu_08_decision` = a) *ou* si `monde.atlas.credibilite ≥ 3`.
- **`opus1_hs_gr_2` — La recrue au môle.** 2v1, `tenir`, avec Nikos contre Basile Kelm qui verrouille la réserve du port. Nikos consulte le joueur, ce qu'il ne fait jamais. Choix — son dilemme canon : **confier le passage des îles à la recrue** (a ; **[Proposition]** Dafni Rallis) ou **qu'il reprenne lui-même toute la préparation** (b, branche par défaut si l'épisode n'est pas joué).
- **`opus1_hs_gr_3` — Le banc du port.** 2v1, `capture_qg`, contre Basile Kelm. L'épisode s'ouvre sur l'annonce (voir §3) : la plaque de la Grèce est posée à plat. Le banc grec joue quand même — avec la recrue et la méthode de Nikos (branche a, épisode ancré après `opus1_finale_07`), ou avec un intérim de la fédération qui ne connaît pas les môles (branche b, ancré après `opus1_finale_02`).
- **Conséquences.** Grèce `alliee` (épisode 2) ; entrées de carnet ; variante de dialogue à `opus1_finale_18` : la recrue est présente à l'épilogue, ou le banc grec y est vide.

### Islande — Elín Arnardóttir, « Deux contrats, une réserve » (3 épisodes)

**Pourquoi cette nation.** Une île de roche noire où l'hiver joue de nuit (cycle jour/nuit 2/4 déclaré par le scénario), des sources chaudes qui soignent, un passif de vision sur montagne ; le volcan s'allume pour le spectacle, jamais en catastrophe. Sa motivation canon — permettre un contrôle indépendant des annonces énergétiques — et son fait d'origine (deux contrats qui vendent la même réserve à deux délégations) font d'elle le hors-série qui **sert le plus la trame** : c'est la preuve du double contrat que Sélène devra contourner à la finale 8.

- **`opus1_hs_is_1` — La même réserve vendue deux fois.** 1v1, `capture_partielle`, de nuit, contre Yuna Serrat qui gère les deux contrats. S'ouvre après `opus1_ch_04` si le joueur a partagé les relevés (`opus1_ch_04_decision` = a) *ou* si `monde.atlas.soupcon ≥ 3`.
- **`opus1_hs_is_2` — Fenêtre claire.** 1v2, `relais`, trois stations dans le brouillard, contre Relais Zéro et Basile Kelm. Ancré après `opus1_nl_04`.
- **`opus1_hs_is_3` — Le silence de la source.** 2v2, `tenir`, avec Elín contre Ost et Yuna. Ancré après `opus1_ma_08` (« Le bail trop long » : les exclusivités que le joueur vient de voir sont celles qu'Elín compare depuis un an). Choix — son dilemme canon : **signaler l'anomalie maintenant** (`monde.atlas.soupcon`, `monde.atlas.dossier_truquage`) ou **attendre la preuve recoupée** (`pays.is.source_chaude_partagee`, `monde.atlas.credibilite`).
- **Conséquences.** Islande `alliee` ; variante de dialogue à `opus1_finale_08` (Sélène propose la garantie ; Elín a le double contrat) ; entrée de carnet.

### Kenya — Kito Njoroge, « Le fond » (2 épisodes)

**Pourquoi cette nation.** Des hauts plateaux frais et une grande vallée ; « Le fond » donne mouvement +2 à l'infanterie pour un budget à 0,9 ; le passif de Kito protège l'infanterie. Sa motivation canon — prouver que la durée d'un contrat compte autant que son classement initial — se joue en durée : un match de survie, puis un relais à pied. La savane est un terrain de course, jamais un décor animalier.

- **`opus1_hs_ke_1` — Le match de trois heures.** 1v1, `survie` jusqu'à la fin de J14 : Kito ne gagne jamais avant la dixième journée, et attend que le joueur s'épuise. S'ouvre après `opus1_sn_08` (le Sénégal est son rival naturel) si le joueur a garanti la livraison (`opus1_sn_08_decision` = a) *ou* respecté Awa Diagne (`pays.sn.rival_respecte`).
- **`opus1_hs_ke_2` — Le messager.** 2v1, `relais`, avec Kito contre Yuna Serrat. Choix — son dilemme canon : **céder l'avance pour garder une relève** (`pays.ke.rythme_trouve`) ou **soutenir immédiatement le partenaire** (`pays.ke.messager_arrive`).
- **Conséquences.** Kenya `alliee` ; remise de 10 % sur l'infanterie ; entrée de carnet.

### Madagascar — Tiana Ravel, « Les pistes rouges » (2 épisodes)

**Pourquoi cette nation.** Une île à deux climats séparés par une arête, des pistes rouges qui relient tout, une commandante qui nomme chaque espèce en pleine partie ; « La connaissance des pistes » met forêt et route au même prix, le passif de Tiana protège en forêt. Sa motivation canon — faire des relevés de terrain un bien partagé — rencontre les relais de Relais Zéro. La forêt est un terrain vivant, jamais un sujet de déforestation.

- **`opus1_hs_mg_1` — L'inventaire des pistes.** 1v1, `capture_qg`, sous couvert et sous brouillard, contre Tiana. S'ouvre après `opus1_id_08` (l'Indonésie est sa rivale naturelle) si le joueur a partagé les relevés (`opus1_id_04_decision` = a) *ou* si `monde.atlas.credibilite ≥ 4`.
- **`opus1_hs_mg_2` — Les cartes ouvertes.** 2v1, `relais`, avec Tiana contre Relais Zéro et Yuna. Choix — son dilemme canon : **ouvrir ses cartes à un rival** (`pays.mg.inventaire_complete`, `pays.mg.rival_respecte`) ou **protéger le travail de son atelier**.
- **Conséquences.** Madagascar `alliee` ; variante de dialogue à `opus1_finale_06` (les cartes de Tiana montrent les couloirs des relais compromis) ; entrée de carnet.

### Mongolie — Saran Bat, « Le point de ravitaillement déplacé » (2 épisodes)

**Pourquoi cette nation.** Les plus grandes cartes du tournoi, presque sans obstacle ; « La steppe » donne mouvement +2 aux roues et aux chenilles et interdit d'embarquer sur un transport allié ; le passif de Saran favorise la reconnaissance. Sa motivation canon — préserver le droit de changer de fournisseur sans perdre l'accès au circuit — est la réponse directe aux exclusivités du parcours mexicain. Ni empire ni conquête : le cheval, le feutre et l'horizon.

- **`opus1_hs_mn_1` — Le grand galop.** 1v1, `elimination`, contre Saran, sur une carte où seule la reconnaissance décide de qui frappe le premier. S'ouvre après `opus1_mx_10` si le joueur a **refusé** une exclusivité — exigé la fin du mandat privé (`opus1_mx_10_decision` = b) *ou* refusé de garantir le crédit (`opus1_mx_08_decision` = b). C'est le seul arc qui s'ouvre sur un refus.
- **`opus1_hs_mn_2` — Le point de ravitaillement déplacé.** 2v2, `capture_partielle`, avec Saran contre Ost et Basile Kelm ; le point de ravitaillement change à mi-parcours, annoncé à tous. Choix — son dilemme canon : **poursuivre l'ouverture** (`pays.mn.grand_galop_lance`) ou **revenir couvrir la réserve commune** (`pays.mn.respect_du_cavalier`, `pays.mn.rival_respecte`).
- **Conséquences.** Mongolie `alliee` ; une unité de reconnaissance offerte ; variante de dialogue à `opus1_finale_12` ; entrée de carnet.

### Namibie — Amalie Haoses, « La brume du matin » (2 épisodes)

**Pourquoi cette nation.** Le seul terrain totalement découvert du tournoi, plus une brume côtière qui tombe tous les matins ; « La brume » aveugle l'adversaire, le passif d'Amalie protège les drones. Sa motivation canon — éviter qu'un opérateur vende une information produite ensemble — fait d'elle la réponse à Relais Zéro. Le désert se traverse ou l'on y disparaît ; aucune référence coloniale.

- **`opus1_hs_na_1` — Ce que la brume efface.** 1v1, `elimination`, contre Amalie. S'ouvre après `opus1_au_04` si le joueur a partagé les relevés (`opus1_au_04_decision` = a) *ou* respecté Saran Bat, sa rivale naturelle (`pays.mn.rival_respecte`).
- **`opus1_hs_na_2` — Le passage révélé.** 1v3, `tenir`, contre Relais Zéro, Basile Kelm et une délégation sous mandat — trois camps aux moyens bornés et fronts séparés, le format du canon. Choix, avant le coup d'envoi — son dilemme canon : **révéler le passage à tous** (`pays.na.brume_etendue`, `pays.na.rival_respecte`) ou **protéger la seule fenêtre de son équipe** (`pays.na.silence_impose`).
- **Conséquences.** Namibie `alliee` ; variante de dialogue à `opus1_finale_16` (les observateurs d'Amalie ont relevé les couloirs du réseau muet) ; entrée de carnet.

### Népal — Mira Karki, « L'altitude » (3 épisodes, disparition)

**Pourquoi cette nation.** La carte la plus verticale du tournoi, du subtropical au glacier ; « L'altitude » ôte tout malus de pente à l'infanterie et interdit les chars ; le passif de Mira frappe depuis la montagne. Sa motivation canon — donner aux sites isolés une voix dans les engagements de distribution — et sa croyance — elle accepte trop facilement une logistique réduite et demande de l'aide tard — sont le signe et la cause de sa disparition. Les fanions de balisage sont sans signe ; le sommet est une étape, jamais une conquête.

- **`opus1_hs_np_1` — Les ateliers d'altitude.** 1v1, `capture_partielle`, contre Mira. S'ouvre après `opus1_ch_10` (la Suisse est l'autre pays de relais d'altitude) si le joueur a accepté un retour sous audit (`opus1_ch_10_decision` = a) *ou* respecté Elsbeth Vonlanthen (`pays.ch.rival_respecte`).
- **`opus1_hs_np_2` — Le pont de corde.** 2v1, `escorte`, avec Mira contre Basile Kelm qui tient le col. Un atelier isolé attend des pièces que la rotation des transports ne monte plus ; Mira a demandé de l'aide tard, et le dit. Choix : **poser le pont de corde** (trace `pays.np.pont_pose`) ou passer par le col. Ce choix change ce que l'atelier a reçu et la page du carnet, jamais le moment ni la cause de la disparition.
- **`opus1_hs_np_3` — Le relais sans réponse.** 2v1, `relais`, ancré après `opus1_finale_07`. L'épisode s'ouvre sur l'annonce (§3). L'adjointe de Mira (**[Proposition]** Anju Basnet) reprend le banc et redescend avec le joueur la réserve de l'atelier isolé par trois relais, avant que Basile ne la compte comme réserve méridienne.
- **Conséquences.** Népal `alliee` (épisode 2) ; trace de carte si le pont est posé ; entrées de carnet ; variante de dialogue à `opus1_finale_12` (l'adjointe refuse la tutelle, et le dit).

### Nouvelle-Zélande — Tess Roa, « La fougère répare » (2 épisodes)

**Pourquoi cette nation.** Deux îles étroites, une montagne au milieu, de la brume de vallée, la carte la plus défensive du tournoi ; « La fougère répare » soigne dans la fougère et interdit la reconnaissance ; le passif de Tess protège en forêt. Sa motivation canon — faire compter la réparation dans le partage des moyens — se joue avec le génie et les bâtiments désaffectés. Aucune référence culturelle : la fougère est un terrain.

- **`opus1_hs_nz_1` — Le dépôt rendu.** 1v1, `capture_partielle` : remettre en service et posséder deux des trois postes désaffectés de la vallée, contre Tess. S'ouvre après `opus1_au_10` (« Le coût de la sortie » : le dépôt rendu par la rupture du contrat est celui-ci) si le joueur a accepté un retour sous audit (`opus1_au_10_decision` = a) *ou* respecté Jone Vakalau, son rival naturel (`pays.fj.rival_respecte`).
- **`opus1_hs_nz_2` — La ligne de fougère.** 1v2, `survie` jusqu'à la fin de J10 : Tess **prête son banc** au joueur (au sens de `01-bible.md` §4.6) pendant que son équipe répare, contre Ost et Yuna. Choix — son dilemme canon : **réparer pour tous** (`pays.nz.ligne_tenue`, `pays.nz.rival_respecte`) ou **réserver le matériel à la prochaine manche**.
- **Conséquences.** Nouvelle-Zélande `alliee` ; remise de 10 % sur le génie ; entrée de carnet.

### Pérou — Luz Quispe, « Bâtisseurs » (3 épisodes)

**Pourquoi cette nation.** Trois étages en une carte — côte sèche, altiplano, versant amazonien — reliés par des routes et des ponts qu'il faut construire ; « Bâtisseur » et le passif de Luz (défense ×1,2 pour le génie) en font l'arc du génie. Sa motivation canon — empêcher qu'une homologation serve à fermer un passage aux petits ateliers — répond aux clauses d'exclusivité de la saison 2. Aucun site archéologique nommé ; l'altitude est une contrainte sportive.

- **`opus1_hs_pe_1` — Le passage commun.** 1v1, `capture_qg`, contre Luz : le premier génie qui relie ses étages gagne le tempo. S'ouvre après `opus1_mx_04` si le joueur a partagé les relevés (`opus1_mx_04_decision` = a) *ou* contesté une homologation (`monde.atlas.homologation_contestee`).
- **`opus1_hs_pe_2` — Le marché d'en haut.** 2v1, `escorte`, avec Luz contre Ost : le transport monte par une route que le génie bâtit devant lui.
- **`opus1_hs_pe_3` — La querelle d'altitude.** 2v2, `capture_partielle`, avec Luz contre Basile Kelm et Yuna Serrat, ancré après `opus1_in_08` (« L'option d'exclusivité »). Choix — son dilemme canon : **consacrer la réserve au passage commun** (trace `pays.pe.reseau_relie`, `pays.pe.rival_respecte`) ou **terminer son propre équipement** (`pays.pe.querelle_daltitude`). Le Népal, rival naturel, est cité en dialogue si `pays.np.visite` est posé.
- **Conséquences.** Pérou `alliee` ; trace de carte si le passage est bâti ; **Luz recrutable comme co-commandante** ; entrée de carnet.

**Compte.** 28 épisodes : deux pour l'Argentine, le Canada, les Fidji, le Kenya, Madagascar, la Mongolie, la Namibie et la Nouvelle-Zélande ; trois pour la Grèce, l'Islande, le Népal et le Pérou. Formats : douze 1v1, huit 2v1, trois 1v2, quatre 2v2, un 1v3 ; aucun 3v1, réservé aux finales. Types : cinq `capture_qg`, six `capture_partielle`, deux `elimination`, quatre `escorte`, six `relais`, deux `tenir`, trois `survie`.

## 3. Quatre disparitions

**Décision du propriétaire, 9 septembre 2026.** Quatre chefs de nations alliées meurent au cours de l'opus. C'est une décision qui contredit la dernière ligne de `01-bible.md` §1 (« Personne ne meurt. Jamais. ») et la table de vocabulaire de §5.2 ; elle s'applique, avec la borne fixée par le coordinateur et reprise dans les amendements de `BRIEF.md`, `01-bible.md` et `08-narration-choix.md` :

> **Une mort n'a jamais lieu sur un terrain homologué, jamais par du matériel de tournoi, et n'est jamais un homicide commis par une personne identifiée.** Ce sont des morts du dehors — route, mer, montagne, maladie, âge, épuisement — et ce qui les rend lourdes est que les décisions de la Cinquième Manche y ont indirectement contribué, et parfois les choix du joueur aussi. Elles sont **quatre, écrites à la main, nommées ici** ; aucune routine ne peut en produire une, et un contenu généré qui en déclarerait une est refusé au schéma. La doctrine du marquage (§5.3) reste intacte : sur le terrain, on met hors jeu, et l'équipage va boire quelque chose.

**Comment Atlas annonce une disparition. [Proposition]** Le Tableau des délégations (`01-bible.md` §4.6) connaît trois gestes : deux plaques côte à côte, une plaque retournée, une plaque remise à l'endroit. Une disparition en ajoute un quatrième, et c'est **le seul cas où l'on décroche** : Solveig Tamm décroche la plaque et la **pose à plat sur la tablette** du Tableau, face visible, avec une ligne d'organisation — *« Grèce — engagée. Banc repris par la fédération. »* La délégation ne se retire pas ; elle change de banc. Nera Aldouin ne contresigne rien, parce qu'aucun article du Pacte ne le demande ; Osmin Talvarec descend dans le hall et reste devant, comme pour un retrait ; Célestin Vantour ouvre son Bulletin sur la météo, ne dit rien pendant tout le Bulletin, et ne prononce le nom qu'à la dernière phrase — une phrase, un fait. Au générique, la plaque est **remise à l'endroit** : c'est la seule fois où l'on remet une plaque qui n'a pas été retournée. **Le joueur ne voit jamais l'instant**, toujours l'annonce.

**Ce qu'une disparition change, et ce qu'elle ne change pas.** Le commandant n'est plus recrutable comme co-commandant à partir de l'annonce ; s'il l'était, l'emplacement se libère. La nation **reste engagée** et sa relation ne bouge pas : une disparition n'est jamais un retrait, et une conséquence `allie_acte_iii` déjà acquise tient — c'est la délégation qui reste, pas l'homme. Le banc est repris par une adjointe nommée **[Proposition]**, qui joue les couleurs et le catalogue de la nation sans en avoir le pouvoir de commandant. Il y a une entrée de carnet, des variantes de dialogue aux finales concernées, et une absence à l'épilogue. **Aucune fin ne lit une disparition** : deux joueurs aux mêmes choix de trame ont la même fin, avec ou sans ces quatre plaques posées à plat.

**Pourquoi ces quatre, et pourquoi pas Ariane.** Le propriétaire a demandé d'y penser. Ariane Belloc est la mentore du joueur de la première leçon à l'épilogue ; son arc canon (`17-aube.md` : apprendre à reconnaître une concession coûteuse, révéler elle-même ses propres clauses) se conclut à la finale 18 par sa voix, et la campagne sans elle perd la seule personne qui puisse dire au joueur ce que sa victoire vaut. Tomas Reiner est choisi **à sa place** : c'est le second mentor, celui des tutoriels et de la saison 1, l'organisateur des convois — et sa disparition tombe au moment où le joueur est au plus bas, juste après le repli imposé, quand une mort du dehors pèse le plus. Les deux disparitions en hors-série sont celles dont la biographie contient déjà le signe : Nikos parle de son départ du circuit, Mira demande de l'aide tard. Samir El Hadi est le quatrième parce que sa disparition dépend d'un contrat — la clause de dépendance qui interdit de le remplacer — et d'un choix du joueur, sans qu'aucun des deux soit jamais présenté comme la cause de sa maladie.

### 3.1 Nikos Delis — `opus1_hs_gr_3`, dépend d'un choix

**Le signe.** `opus1_hs_gr_2` : Nikos demande son avis au joueur, ce qu'il ne fait jamais, et parle de « quand il ne sera plus sur le circuit ».

**La cause.** Le cœur, à son âge, un matin d'hiver. Le contrat de priorité de Basile Kelm (`opus1_finale_02`) coupe les petites délégations ; la ligne du bac vers les îles, alimentée par la réserve du port, est suspendue pour l'hiver. Sans bac, quelqu'un prend le bateau.

**Ce que change `opus1_hs_gr_2_decision`.** Branche **b** — le joueur lui a dit de reprendre lui-même toute la préparation ; c'est la branche par défaut si le hors-série n'est pas joué — : il fait la traversée seul chaque matin et s'assoit au môle après la dernière ; disparition après la finale 2, banc repris par un intérim de la fédération, la méthode perdue. Branche **a** — la recrue tient le passage — : il reste au quai ; disparition après la finale 7, au café du port, la recrue en mer, la méthode transmise ; la recrue reprend le banc et joue `opus1_hs_gr_3` puis paraît à l'épilogue. **La disparition a lieu dans les deux branches** ; ce qui dépend du joueur est le moment, le lieu et ce qui reste.

**Ce que le joueur voit.** À l'ouverture de « Le banc du port » : la plaque posée à plat, Vantour sur la météo, le chat du port sur la tablette.

**Scène, branche b (huit répliques).**

1. **Solveig Tamm** — Elle décroche la plaque, la pose à plat, face visible. « Grèce — engagée. Banc repris par la fédération. »
2. **Célestin Vantour** — « Le Bulletin, ce matin : vent de nord sur les îles, mer courte. Le bac ne reprendra pas avant la fin du contrat de priorité. »
3. **Vantour** — « Nikos Delis faisait la traversée lui-même, chaque matin, depuis que le bac ne passe plus. Hier il est rentré au môle et il s'est assis. Il est mort là, calme, le café encore chaud. »
4. **Solveig** — « Il avait rangé les pièces sur le quai. Toutes. Il ne laissait jamais une caisse en plan. »
5. **Le joueur** — « Il m'avait demandé si la recrue pouvait tenir le passage. Je lui ai dit de garder la main. »
6. **Solveig** — « Vous lui avez dit ce qu'il voulait entendre. Ce n'est pas la même chose qu'une faute. »
7. **Vantour** — « La ligne du bac dépendait de la réserve du port, et la réserve est sous contrat de priorité. Ce n'est pas une accusation, c'est un ordre des choses, et je le dis une fois. »
8. **Solveig** — « Le banc grec joue quand même cet après-midi. Il disait qu'on ne refuse pas de jouer. Le chat du port est sur la tablette ; je le laisse. »

**Scène, branche a (six répliques).**

1. **Solveig** — Elle pose la plaque à plat. « Grèce — engagée. Banc repris par Dafni Rallis. »
2. **Vantour** — « Le Bulletin : mer belle sur les îles, le bac est rentré à l'heure. Nikos Delis n'était pas à bord ; il ne prenait plus la mer depuis l'hiver. »
3. **Vantour** — « Il est mort au café du port, ce matin, à la table du coup d'envoi. La recrue était en mer, avec la méthode. »
4. **Dafni Rallis** — « Il m'a fait refaire le passage des îles quarante fois. La quarante et unième, il n'a rien dit. C'était le compliment. »
5. **Le joueur** — « Il m'avait demandé si vous pouviez tenir. J'ai dit oui sans vous connaître. »
6. **Dafni** — « Il le savait. C'est pour ça qu'il vous a demandé à vous. On joue à quatorze heures ; il aurait pris son café d'abord. »

**Conséquences.** `cmd_nikos_delis` non recrutable dès l'annonce ; Grèce engagée, relation inchangée ; `carnet_hs_gr_nikos` ; variante `banc_grec` à `opus1_finale_18`.

### 3.2 Mira Karki — `opus1_hs_np_3`, fixe

**Le signe.** `opus1_hs_np_2` : elle a demandé le transport trop tard et le reconnaît ; « on aurait pu attendre » est sa dernière réplique de l'épisode.

**La cause.** La montagne et l'épuisement. Les réserves rendues exclusives par Basile (`opus1_finale_07`) alimentaient la rotation des transports vers les sites d'altitude ; la rotation est suspendue « jusqu'à régularisation ». Elle est montée elle-même, à pied, avec deux porteurs, vers l'atelier isolé ; la fenêtre météo s'est refermée le soir même ; ils sont redescendus quand elle s'est rouverte, trop tard pour elle. Les porteurs vont bien, et c'est dit.

**Ce que change le joueur.** Rien au moment ni à la cause. `opus1_hs_np_2_decision` change ce que l'atelier a reçu (le pont de corde tient une saison) et la page du carnet.

**Ce que le joueur voit.** À l'ouverture de « Le relais sans réponse » : la plaque posée à plat, Vantour sur la météo de montagne, l'adjointe qui attend au pied du relais.

**Scène (huit répliques).**

1. **Solveig Tamm** — Elle pose la plaque à plat. « Népal — engagé. Banc repris par l'atelier. »
2. **Célestin Vantour** — « Le Bulletin : neige au-dessus du col, fenêtre fermée pour trois journées. La rotation des transports vers les sites d'altitude reste suspendue jusqu'à régularisation des réserves. »
3. **Anju Basnet** — « Elle est montée jeudi avec deux porteurs, pour l'atelier du haut. Les pièces n'arrivaient plus ; elle a dit qu'elle en avait pour deux jours. »
4. **Anju** — « La fenêtre s'est fermée le soir même. Ils sont redescendus quand ça s'est ouvert. Les porteurs vont bien. Elle est morte dans la vallée, le lendemain. »
5. **Le joueur** — « Au pont de corde, elle m'a dit : on aurait pu attendre. »
6. **Anju** — « Elle disait toujours ça après. Jamais avant. »
7. **Vantour** — « Les réserves qui payaient la rotation sont sous contrat exclusif depuis la finale des bassins. Je le dis parce que c'est vrai, pas parce que ça console. »
8. **Anju** — « L'atelier du haut a encore sa réserve. Elle voudrait qu'on la redescende avant que quelqu'un la compte comme la sienne. On y va ? »

**Conséquences.** `cmd_mira_karki` non recrutable dès l'annonce ; Népal engagé, banc repris par Anju Basnet **[Proposition]** ; `carnet_hs_np_mira` ; variante `banc_nepalais` à `opus1_finale_12`.

### 3.3 Tomas Reiner — `opus1_finale_12`, fixe

**Le signe.** `opus1_finale_11` : Tomas organise les convois de retour des délégations extraites — c'est son troisième fait d'historique, « une relève par un itinéraire annoncé » — et dit que la route principale du bassin exige une autorisation méridienne depuis le repli ; il « prendra la desserte ».

**La cause.** La route : sortie de desserte de nuit, chaussée verglacée, un seul véhicule. Depuis le repli de la finale 10, la route principale est sous autorisation méridienne — la clause de dépendance d'Edran Sorel sur les dépôts et les routes, qui est sa doctrine canon. Tomas refuse de demander l'autorisation à ceux qui viennent de fermer le terrain.

**Ce que change le joueur.** Ni le moment ni la cause. Le choix de `opus1_finale_09` (évacuer les techniciens ou sécuriser les archives) change qui voyage avec lui : les techniciens déjà évacués, il conduit seul et de jour ; sinon il conduit le dernier car de nuit, et **tous les passagers sont indemnes**, en toutes lettres. Le repli de la finale 10 est imposé à tous ; le carnet dit « la route était fermée », jamais « vous l'avez envoyé là ».

**Ce que le joueur voit.** Au briefing de « Les lignes qui restent » : la plaque du Luxembourg posée à plat, et Ariane qui parle **avant** le Bulletin, ce qui n'arrive jamais.

**Scène (huit répliques).**

1. **Ariane Belloc** — « Je parle avant le Bulletin, une fois. Tomas Reiner est mort cette nuit sur la desserte, entre le dépôt et la vallée. Il était seul dans le car. » *(variante finale 9 : « Les techniciens sont tous descendus du car sur leurs jambes. Lui, non. »)*
2. **Solveig Tamm** — « La route principale demande une autorisation méridienne depuis le repli. Il a refusé de la demander à ceux qui venaient de fermer le terrain. »
3. **Léa Wagener** — « Il m'a laissé le registre des convois et une liste. La liste est complète. Il n'a jamais laissé une liste incomplète. »
4. **Célestin Vantour** — « Le Bulletin : verglas sur les dessertes, ciel dégagé sur le bassin. C'est tout ce que j'ai à dire ce matin. »
5. **Le joueur** — « Il avait organisé la relève après la finale des dépôts. C'était son itinéraire annoncé. »
6. **Ariane** — « Et c'est celui qu'on va tenir. Basile Kelm veut empêcher la coalition de se reformer ; Tomas aurait dit qu'un accord précis protège mieux qu'une déclaration d'amitié. »
7. **Solveig** — « La plaque du Luxembourg reste au Tableau. Léa joue leurs couleurs à partir d'aujourd'hui. »
8. **Léa** — « Je ne ferai pas mieux que lui. Je ferai la liste. »

**Conséquences.** `cmd_tomas_reiner` non recrutable dès l'annonce ; Luxembourg engagé, `allie_acte_iii` de `fil_cars_intendance` maintenu ; banc repris par Léa Wagener **[Proposition]** — dont les flags `cmd.lea_wagener.*` existent déjà dans `content/flags.json` ; Solveig reprend le registre des convois ; `carnet_tomas_desserte` ; variantes à `opus1_finale_12` (Ariane), `opus1_finale_15` (Edran répond de la route, sans être accusé d'autre chose que de l'avoir fermée) et `opus1_finale_18`.

### 3.4 Samir El Hadi — `opus1_au_01` ou `opus1_finale_14`, le moment dépend d'un choix

**Le signe.** `opus1_ma_09` « La réserve retenue » : Samir laisse coordonner l'étape à son adjointe et regarde le match depuis le dépôt ; `opus1_ma_11` : il dit qu'il « se soigne entre deux étapes ».

**La cause.** Une maladie longue, la sienne, nommée nulle part. La clause de dépendance du contrat de transport (`opus1_ma_06`, `opus1_ma_08`) interdit à la délégation d'employer un coordinateur hors du personnel du fournisseur : sans garantie extérieure, personne ne peut le remplacer aux étapes, et il tient.

**Ce que change `opus1_ma_08_decision`.** Branche **b** — le joueur a refusé de garantir le crédit du signataire — : la délégation ne peut pas payer un remplaçant, Samir tient les étapes une saison de plus au lieu de se soigner ; disparition après `opus1_jp_12`, annoncée au briefing de `opus1_au_01`. Branche **a** — la garantie libère un remplaçant — : il se soigne une saison ; disparition après `opus1_finale_13`, annoncée au briefing de `opus1_finale_14`. **La maladie est la sienne dans les deux branches** ; ce qui dépend du joueur est le moment. Vantour le dit sans accuser : « on ne remplace pas quelqu'un qu'un contrat interdit de remplacer ».

**Ce que le joueur voit.** La plaque du Maroc posée à plat au Tableau ; Vantour sur la météo de la route longue (branche b) ou des aérodromes (branche a).

**Scène, branche b (huit répliques ; en branche a, la réplique 2 devient : « Vous aviez garanti le crédit ; on a pu prendre quelqu'un, il s'est soigné une saison. Ça ne l'a pas guéri. Ça lui a donné une saison. », et Hazel Quinn est remplacée par Ariane seule).**

1. **Célestin Vantour** — « Le Bulletin : vent d'est sur la route longue, visibilité bonne. » *Un temps.* « Samir El Hadi ne coordonnera plus les étapes. Il était soigné depuis le printemps ; on le savait entre deux étapes, pas plus. »
2. **Nadia Berrada** — « Il a tenu les convois une saison de plus que prévu. Le contrat interdisait d'embaucher quelqu'un hors du personnel du fournisseur pour le remplacer. »
3. **Hazel Quinn** — « Chez nous les routes sont longues ; on sait ce qu'un coordinateur vaut. La délégation marocaine a son quai ici tant qu'elle veut. »
4. **Le joueur** — « Il gardait toujours une réserve pour un risque qui ne venait pas. »
5. **Nadia** — « Cette fois il n'en avait pas gardé pour lui. Il est mort à la maison, entre deux étapes, comme il le disait. »
6. **Ariane Belloc** — « Il m'avait appris à répartir une réserve entre des étapes éloignées sans laisser le dernier atelier à sec. Je vais le faire aujourd'hui. »
7. **Vantour** — « On ne remplace pas quelqu'un qu'un contrat interdit de remplacer. Je le note dans le Bulletin, une fois, et je passe à la météo. »
8. **Nadia** — « La caravane part à l'heure. Il aurait vérifié la liste deux fois. »

**Conséquences.** `cmd_samir_el_hadi` non recrutable dès l'annonce ; Maroc engagé, banc repris par Nadia Berrada **[Proposition]**, coordinatrice des étapes du sud ; `carnet_samir_caravane` ; variantes à `opus1_finale_17` (Ost, qui lui prêtait du matériel à conditions opaques à `opus1_ma_05`, ne prononce pas son nom) et `opus1_finale_18`.

### 3.5 Ce que cela coûte au joueur, en une table

| Disparition | Où | Ce qui est perdu | Ce qui reste |
|---|---|---|---|
| Nikos Delis (GR) | `opus1_hs_gr_3`, après F2 (b) ou F7 (a) | Le co-commandant de défense littorale ; en branche b, la méthode | La Grèce engagée ; en branche a, Dafni Rallis et la méthode |
| Mira Karki (NP) | `opus1_hs_np_3`, après F7 | Le co-commandant d'altitude | Le Népal engagé, Anju Basnet, la réserve de l'atelier isolé |
| Tomas Reiner (LU) | `opus1_finale_12` | Le second mentor, le co-commandant de protection, le registre des convois | Le Luxembourg engagé, `allie_acte_iii`, Léa Wagener, la liste complète |
| Samir El Hadi (MA) | `opus1_au_01` (b) ou `opus1_finale_14` (a) | Le co-commandant de la caravane | Le Maroc engagé, Nadia Berrada, une saison de plus en branche a |

## 4. Ce que cela demande à `content/personnages.json`

Les douze commandants hors premier plan ont reçu deux faits d'historique de plus (`<cle>_3`, acte 1, l'appel du premier hors-série ; `<cle>_4`, acte 2, le dilemme du second), de la forme des existants, avec `source: "canon_aube_v2"`, et leur premier hors-série en `identiteTactique.mission`. Nikos Delis, Mira Karki, Tomas Reiner et Samir El Hadi portent chacun un fait de disparition (`<cle>_disparition`, acte 3) en `confidentialite: "auteur"` — le champ que `src/serveur/personnages.ts` filtre pour tout acte, ce qui garantit qu'aucune route ne le sert. Rien d'autre n'a été modifié, ni renommé ; `version` reste 4.

## 5. Ce qui reste à trancher

Par ordre d'importance, honnêtement.

1. **La lecture d'une décision nationale.** Les conditions d'ouverture lisent `opus1_<nation>_<n>_decision` par un type `decision` qui n'existe pas dans `13-campagne.md` §8.2. Soit on l'ajoute (onzième type, `{ type: 'decision', cle, option }`), soit chaque décision devient un flag canon `pays.<xx>.releves_partages`, `pays.<xx>.credit_garanti`, `pays.<xx>.retour_sous_audit`, `pays.<xx>.reserve_versee` — quatre flags par nation, quarante-huit en tout, à ajouter à `01-bible.md` §8.3 par décision humaine. Le second est plus lourd et plus conforme à la règle 1 du §8.6.
2. **Retirer un co-commandant n'est dans aucune liste.** La liste fermée de `13-campagne.md` §5.2 sait rendre un commandant recrutable, pas l'inverse. Deux voies : une onzième conséquence `co_commandant_retire` bornée aux quatre clés nommées ici ; ou un calendrier des disparitions **écrit en dur** dans le code de campagne, hors de toute conséquence de contenu — ce qui est le plus sûr au regard de la règle « une routine ne peut jamais écrire une mort », puisque le schéma n'aurait alors aucun moyen d'exprimer une disparition.
3. **Quatre noms d'adjointes, et un registre à 37.** Dafni Rallis, Anju Basnet, Léa Wagener et Nadia Berrada n'existent pas dans `content/personnages.json` et n'y ont pas été ajoutées : `tests/serveur/registre-commandants.test.ts` fixe le compte à 37 et exige un profil de capacités et des chaînes traduites pour chaque `cmd_`. Une adjointe qui « joue les couleurs » sans pouvoir de commandant demande soit une entrée sans profil (rôle `civil` au banc, ce que le test tolère), soit un profil neutre. Léa Wagener est proposée parce que `cmd.lea_wagener.*` existe déjà dans `content/flags.json`.
4. **Deux distributions de commandants coexistent.** `doc/06-pays-de-depart.md` §5 et `content/flags.json` nomment Hrefna Sigurðardóttir, Stavros Kalogeris, Naran Batbayar, Pemba Gurung, Amani Kiptoo, Tuli Shikongo, Voahangy Rakotobe, Facundo Iriarte, Nayra Quispe, Émile Tremblay, Hana Whitmore, Sitiveni Naicoro ; `content/personnages.json` (révision 4, canon Aube) nomme Elín Arnardóttir, Nikos Delis, Saran Bat, Mira Karki, Kito Njoroge, Amalie Haoses, Tiana Ravel, Leandro Paz, Luz Quispe, Noémie Leduc, Tess Roa, Jone Vakalau. Ce document suit le JSON, que `BRIEF.md` déclare canon des biographies. Conséquences : aucun flag `cmd.<id>.*` n'existe pour la distribution actuelle (les hors-série n'en lisent donc aucun), et trois flags de pays portent un ancien nom dans leur libellé (`pays.is.silence_de_hrefna`, `pays.gr.anecdote_corrigee` « de Stavros », `pays.np.sourire_en_difficulte` « Pemba Gurung »). À aligner d'un côté ou de l'autre.
5. **Une disparition en hors-série, pour qui ne joue pas le hors-série.** Nikos et Mira meurent dans le monde quelle que soit la partie ; seule l'annonce est dans le hors-série. Un joueur qui n'ouvre pas l'arc grec ou népalais ne l'apprend qu'à l'épilogue, par l'absence — c'est cohérent avec « des nations qu'on ne croisera peut-être pas », mais on peut préférer une ligne de Vantour dans la trame (variante de dialogue lisant `pays.gr.visite` absent). À trancher.
6. **Le mot sur l'écran.** Les scènes ci-dessus emploient « mort » une fois chacune, dans la bouche de la personne la plus proche, et « disparition » partout ailleurs. L'amendement autorise le mot pour ces quatre-là ; il reste possible de l'interdire à l'écran et de le garder aux seuls documents auteur. Le propriétaire tranche.
7. **Le moment de Tomas.** Après la finale 11 est le choix de ce document — au plus bas, et sur la route de relève qui est son dernier fait canon. L'alternative est la fin de la saison 2 (après `opus1_mx_12`), où sa disparition changerait la couleur de toutes les finales au lieu des sept dernières. Les deux tiennent ; la première pèse plus.
8. **Samir, deux moments.** La branche b annonce sa disparition avant les finales, la branche a après la finale 13 ; dans les deux cas il est absent de l'épilogue. Si l'on juge qu'un moment variable complique trop la production des scènes, la branche a peut se limiter à une variante de dialogue (« il a eu une saison ») sans déplacer l'annonce.
9. **Le Tableau.** Le geste de la plaque posée à plat, la ligne d'organisation, la plaque remise à l'endroit au générique et le silence de Vantour sont des propositions de cette bible d'épisode ; `01-bible.md` §4.6 en est propriétaire et ne les porte pas encore.
10. **Les hors-série hors du compte.** 28 épisodes s'ajoutent aux 172 sans y entrer, comme les deux quêtes de `quetes.md`. Il faudra un manifeste général qui dise quel contenu compte, avant que quelqu'un annonce « 200 missions ».
11. **Rien n'est simulé.** Aucune carte, aucun paramètre, aucun mode ; les formats et les types sont ceux du moteur, les cases sont à produire. Un `1v3` de type `tenir` (`opus1_hs_na_2`) et un `1v2` d'`escorte` (`opus1_hs_fj_1`) sont les deux fiches dont la jouabilité est la moins certaine.
