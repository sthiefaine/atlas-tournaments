# Opus 1 — Les épisodes hors-série et les quatre disparitions

**Statut : conception.** Décision du propriétaire, 9 septembre 2026 au soir, en deux demandes : faire vivre les douze nations qui ne sont pas au premier plan dans des épisodes parallèles dont l'accès dépend des choix du joueur ; et faire mourir quatre chefs de nations alliées, hors du terrain. Le registre voisin `opus1-hors-serie.json` porte les 28 fiches d'épisode et les quatre disparitions ; ce document dit pourquoi elles sont comme elles sont. Aucune fiche n'est une carte jouable. Les 28 hors-série **ne comptent pas** dans les 172 missions de l'opus (`BRIEF.md`, Refonte Aube) : ils viennent en supplément, comme les quêtes de `quetes.md`.

Ce qui est canon ici vient de `BRIEF.md`, de `doc/17-aube.md`, de `doc/01-bible.md` (§4.6 pour le Tableau, §5 pour le ton, §7 pour la charte, §8 pour les flags), de `doc/08-narration-choix.md` §4.5 et de `doc/13-campagne.md` §5.2 (liste fermée des conséquences) et §8.2 (conditions). Les biographies sont celles de `content/personnages.json` ; les noms de l'ancienne distribution (Hrefna, Stavros, Naran…) que portaient encore `doc/06-pays-de-depart.md` et `content/flags.json` ont été alignés sur le registre le 26 septembre 2026 (§5, point 4). Tout ce que ce document invente hors des zones ouvertes de `01-bible.md` §7.4 est marqué **[Proposition]**.

**Mise à jour du 26 septembre 2026.** Le propriétaire a délégué les décisions de système du §5 (« va y lance plusieurs agents pour faire tout ça en autonomie ») : elles sont tranchées, datées et motivées au §5, et celles qui demandaient du code sont faites — le onzième type de `Condition` (`decision`), le calendrier des disparitions (`src/app/campagne/disparitions.ts`), les quatre adjointes au registre. Le registre voisin est aligné en conséquence (version 2) : **ses conditions nomment les options telles que la campagne les enregistre**, jamais par la lettre de la fiche (`opus1_br_04_decision` = `partager_releves`, et non `a`), et chaque choix de hors-série a reçu ses identifiants d'option. Le §6 dit quel contenu compte. Seul le point 11 du §5 — rien n'est simulé — reste ouvert.

## 1. Le principe des hors-série

Un hors-série est un **arc court par nation** — un à trois épisodes — joué en parallèle de la campagne, sur la carte du monde, comme un fil (`13-campagne.md` §5.1). Il se distingue d'un fil par trois traits :

1. **Il s'ouvre sur une décision de la trame, pas seulement sur un flag.** La condition d'ouverture de chaque premier épisode lit soit un flag canon de `01-bible.md` §8, soit **l'option retenue d'une décision nationale** (`opus1_<nation>_<n>_decision`, de `opus1-nations.json`), soit les deux par un `ou`. C'est ce qui fait qu'on « ne croisera peut-être pas » ces nations : deux joueurs aux décisions différentes ne voient pas les mêmes arcs. Chaque première condition a **deux portes** (une décision *ou* un flag), pour qu'un arc ne dépende jamais d'un seul choix binaire. La lecture d'une décision est le onzième type de `Condition`, `{ type: 'decision', cle, option }` (tranché le 26 septembre 2026, §5 point 1) ; `option` est l'identifiant **enregistré** — les fiches nationales disent `a` / `b`, la campagne enregistre les options de quatre familles, `partager_releves` / `garder_reserve` aux épisodes 04, `garantir_livraison` / `refuser_garantie` aux 08, `retour_sous_audit` / `fin_du_mandat` aux 10, `verser_reserve` / `preparation_locale` aux 12.
2. **Il est ancré.** Chaque épisode déclare après quel épisode national, quelle finale ou quel hors-série précédent il devient jouable (`ancrage`). Les arcs sont répartis sur les trois saisons nationales et les finales, jamais tous à la fin.
3. **Il rallie ou fâche, jamais ne retire.** Ses conséquences sont prises dans la liste fermée de `13-campagne.md` §5.2 et bornées comme celles d'un fil : `relation_nation` vaut `alliee` ou `rivale`, une `unite_offerte` fait une ou deux unités, une `remise_production` va de 0,80 à 0,95, une `trace_carte` reste dans le plafond de trois traces par pays. Aucun hors-série n'écrit `monde.secret.*`. Aucun ne révèle la fratrie Maël/Lise ni la paternité d'Edran Sorel avant `opus1_finale_10` ; quand Edran est cité, il est « prestataire de réserve ». **Deux joueurs aux mêmes choix de trame ont la même fin, hors-série joués ou non** : les conséquences ne touchent ni les bascules ni les conditions de fin, elles changent qui est au banc, ce que dit Vantour et ce qu'il y a dans le carnet.

**Chaque nation est justifiée par son terrain, son climat, sa fiche et le pouvoir de son commandant**, jamais par son histoire, sa politique ou sa religion (`01-bible.md` §7.3). Le champ `justificationNation` du registre le dit épisode par épisode, et reprend les `interdits` de la fiche pays concernée. Les adversaires des hors-série sont les huit de `opus1-adversaires.md` ou le commandant de la nation lui-même ; les « délégations sous mandat » qui les accompagnent ne sont jamais une nation nommée.

**Le rythme d'un arc.** Le premier épisode se joue **contre** le commandant de la nation, sur sa carte, avec sa spécialité : on apprend la nation en la combattant. Le deuxième se joue **avec** lui, contre un adversaire de la faction, et pose le **dilemme canon** du personnage (`identiteTactique.dilemme`) comme choix du joueur : c'est là que la relation se gagne. Le troisième, quand il existe, prolonge l'arc plus tard dans la Ronde. Les douze commandants ont désormais, dans `content/personnages.json`, deux faits d'historique de plus et leur premier hors-série comme `identiteTactique.mission`.

## 2. Les douze nations

### Argentine — Leandro Paz, « Le péage de la pampa » (2 épisodes)

**Pourquoi cette nation.** Une plaine immense où une seule route vaut un péage : la spécialité « La plaine » (mouvement +1 sur plaine et route) et le passif de Leandro (attaque ×1,08 sur plaine) font de la carte un problème de routes de contournement, ce qui est exactement sa motivation canon — empêcher qu'une voie logistique devienne un péage obligatoire. Le delta donne un terrain d'escorte.

- **`opus1_hs_ar_1` — La route à péage.** 1v1, `capture_qg`. Une seule route entre les deux QG, un dépôt sous licence exclusive posé dessus ; Leandro montre qu'on gagne par les chemins de traverse. S'ouvre après `opus1_br_04` (le Brésil est le rival naturel de l'Argentine) si le joueur a **partagé les relevés** (`opus1_br_04_decision` = `partager_releves`) *ou* respecté Lívia Moura (`pays.br.rival_respecte`).
- **`opus1_hs_ar_2` — Le chenal du delta.** 2v1, `escorte`, avec Leandro contre Yuna Serrat. Un club du delta a perdu son accès aux batteries ; le transport passe par les bras d'eau. Choix : **ouvrir le chenal** (`ouvrir_chenal` ; trace `pays.ar.chenal_ouvert`, ne se referme pas) ou contourner par la plaine (`contourner_plaine`).
- **Conséquences.** Argentine `alliee` ; trace de carte si le chenal est ouvert ; variante de dialogue à `opus1_finale_02` (Leandro reconnaît le contrat de priorité de Basile pour ce qu'il est : un péage) ; entrée de carnet.

### Canada — Noémie Leduc, « L'essai comparable » (2 épisodes)

**Pourquoi cette nation.** Les plus grandes cartes, très peu de villes, un hiver qui est la carte elle-même ; « L'hiver ne compte pas » annule le surcoût de neige et la forêt boréale soigne ; le passif de Noémie donne vision +1 en forêt. Sa motivation canon — rendre les essais comparables — la place naturellement face à la Sélection Méridienne, qui joue les essais d'homologation (`01-bible.md` §3.4).

- **`opus1_hs_ca_1` — Le grand gel.** 1v1, `capture_partielle`, contre Ost et sa pièce à badge orange. Noémie exige que l'essai se joue sous les mêmes conditions pour les deux camps et confie au joueur le banc de l'équipe témoin. S'ouvre après `opus1_ch_08` si le joueur a pris position sur l'homologation (`monde.atlas.homologation_contestee` *ou* `monde.atlas.essai_soutenu`).
- **`opus1_hs_ca_2` — Les provisions de la tempête.** 2v2, `survie` jusqu'à la fin de J10, avec Noémie contre Ost et Basile Kelm ; tempête annoncée par le Bulletin à deux journées. Choix : **partager les provisions** avec la délégation adverse bloquée (`partager_provisions` : `pays.ca.provisions_partagees`, `pays.ca.rival_respecte`) ou garder la réserve (`garder_provisions`).
- **Conséquences.** Canada `alliee` ; variante de dialogue à `opus1_finale_02` (les relevés de Noémie contredisent la « priorité » de Basile) ; entrée de carnet.

### Fidji — Jone Vakalau, « Le transport prêté » (2 épisodes)

**Pourquoi cette nation.** Un micro-archipel de lagon où les eaux peu profondes se traversent comme de la plaine, le plus petit budget du tournoi, et le plus jeune commandant ; le passif de Jone porte sur les coques et les amphibies. Sa motivation canon — garder les petites équipes dans une compétition dominée par les grands budgets — est une histoire de transport retenu pour une facture.

- **`opus1_hs_fj_1` — Le lagon sans transport.** 1v2, `escorte`. Jone prête son transport au joueur pour ramener l'équipement d'un club, contre Yuna Serrat et une délégation sous mandat. S'ouvre après `opus1_id_04` si le joueur a partagé les relevés (`opus1_id_04_decision` = `partager_releves`) *ou* respecté Tess Roa, sa rivale naturelle (`pays.nz.rival_respecte`).
- **`opus1_hs_fj_2` — La chaîne de passes.** 2v1, `relais`, avec Jone contre Relais Zéro et ses drones. Choix — son dilemme canon : **tenter le raccourci** par le récif (`tenter_raccourci` : `pays.fj.chaine_de_passes`) ou **garantir le retour de tout l'équipement** (`retour_complet` : `pays.fj.salut_rendu`).
- **Conséquences.** Fidji `alliee` ; un transport offert ; entrée de carnet.

### Grèce — Nikos Delis, « Le café du port » (3 épisodes, disparition)

**Pourquoi cette nation.** Des centaines d'îlots reliés par des môles et des passerelles (`pied_marin`), les blindés au port, un café avant le coup d'envoi ; le passif de Nikos donne défense ×1,15 sur plage et port. Sa motivation canon est de transmettre une méthode qui survive à son départ du circuit — c'est pour cela qu'il est l'une des quatre disparitions, et celle qui dépend d'un choix.

- **`opus1_hs_gr_1` — Le café avant le coup d'envoi.** 1v1, `capture_qg`. Nikos reçoit le joueur et lui montre qu'une méthode vaut mieux qu'un nouvel outil. S'ouvre après `opus1_lu_08` si le joueur a garanti la livraison au signataire (`opus1_lu_08_decision` = `garantir_livraison`) *ou* si `monde.atlas.credibilite ≥ 3`.
- **`opus1_hs_gr_2` — La recrue au môle.** 2v1, `tenir`, avec Nikos contre Basile Kelm qui verrouille la réserve du port. Nikos consulte le joueur, ce qu'il ne fait jamais. Choix — son dilemme canon : **confier le passage des îles à la recrue** (`confier_recrue` ; la recrue est Dafni Rallis, au registre depuis le 26 septembre 2026) ou **qu'il reprenne lui-même toute la préparation** (`garder_la_main`, branche par défaut si l'épisode n'est pas joué).
- **`opus1_hs_gr_3` — Le banc du port.** 2v1, `capture_qg`, contre Basile Kelm. L'épisode s'ouvre sur l'annonce (voir §3) : la plaque de la Grèce est posée à plat. Le banc grec joue quand même — avec la recrue et la méthode de Nikos (branche `confier_recrue`, épisode ancré après `opus1_finale_07`), ou avec un intérim de la fédération qui ne connaît pas les môles (branche `garder_la_main`, ancré après `opus1_finale_02`).
- **Conséquences.** Grèce `alliee` (épisode 2) ; entrées de carnet ; variante de dialogue à `opus1_finale_18` : la recrue est présente à l'épilogue, ou le banc grec y est vide.

### Islande — Elín Arnardóttir, « Deux contrats, une réserve » (3 épisodes)

**Pourquoi cette nation.** Une île de roche noire où l'hiver joue de nuit (cycle jour/nuit 2/4 déclaré par le scénario), des sources chaudes qui soignent, un passif de vision sur montagne ; le volcan s'allume pour le spectacle, jamais en catastrophe. Sa motivation canon — permettre un contrôle indépendant des annonces énergétiques — et son fait d'origine (deux contrats qui vendent la même réserve à deux délégations) font d'elle le hors-série qui **sert le plus la trame** : c'est la preuve du double contrat que Sélène devra contourner à la finale 8.

- **`opus1_hs_is_1` — La même réserve vendue deux fois.** 1v1, `capture_partielle`, de nuit, contre Yuna Serrat qui gère les deux contrats. S'ouvre après `opus1_ch_04` si le joueur a partagé les relevés (`opus1_ch_04_decision` = `partager_releves`) *ou* si `monde.atlas.soupcon ≥ 3`.
- **`opus1_hs_is_2` — Fenêtre claire.** 1v2, `relais`, trois stations dans le brouillard, contre Relais Zéro et Basile Kelm. Ancré après `opus1_nl_04`.
- **`opus1_hs_is_3` — Le silence de la source.** 2v2, `tenir`, avec Elín contre Ost et Yuna. Ancré après `opus1_ma_08` (« Le bail trop long » : les exclusivités que le joueur vient de voir sont celles qu'Elín compare depuis un an). Choix — son dilemme canon : **signaler l'anomalie maintenant** (`signaler_maintenant` : `monde.atlas.soupcon`, `monde.atlas.dossier_truquage`) ou **attendre la preuve recoupée** (`attendre_preuve` : `pays.is.source_chaude_partagee`, `monde.atlas.credibilite`).
- **Conséquences.** Islande `alliee` ; variante de dialogue à `opus1_finale_08` (Sélène propose la garantie ; Elín a le double contrat) ; entrée de carnet.

### Kenya — Kito Njoroge, « Le fond » (2 épisodes)

**Pourquoi cette nation.** Des hauts plateaux frais et une grande vallée ; « Le fond » donne mouvement +2 à l'infanterie pour un budget à 0,9 ; le passif de Kito protège l'infanterie. Sa motivation canon — prouver que la durée d'un contrat compte autant que son classement initial — se joue en durée : un match de survie, puis un relais à pied. La savane est un terrain de course, jamais un décor animalier.

- **`opus1_hs_ke_1` — Le match de trois heures.** 1v1, `survie` jusqu'à la fin de J14 : Kito ne gagne jamais avant la dixième journée, et attend que le joueur s'épuise. S'ouvre après `opus1_sn_08` (le Sénégal est son rival naturel) si le joueur a garanti la livraison (`opus1_sn_08_decision` = `garantir_livraison`) *ou* respecté Awa Diagne (`pays.sn.rival_respecte`).
- **`opus1_hs_ke_2` — Le messager.** 2v1, `relais`, avec Kito contre Yuna Serrat. Choix — son dilemme canon : **céder l'avance pour garder une relève** (`garder_releve` : `pays.ke.rythme_trouve`) ou **soutenir immédiatement le partenaire** (`soutenir_partenaire` : `pays.ke.messager_arrive`).
- **Conséquences.** Kenya `alliee` ; remise de 10 % sur l'infanterie ; entrée de carnet.

### Madagascar — Tiana Ravel, « Les pistes rouges » (2 épisodes)

**Pourquoi cette nation.** Une île à deux climats séparés par une arête, des pistes rouges qui relient tout, une commandante qui nomme chaque espèce en pleine partie ; « La connaissance des pistes » met forêt et route au même prix, le passif de Tiana protège en forêt. Sa motivation canon — faire des relevés de terrain un bien partagé — rencontre les relais de Relais Zéro. La forêt est un terrain vivant, jamais un sujet de déforestation.

- **`opus1_hs_mg_1` — L'inventaire des pistes.** 1v1, `capture_qg`, sous couvert et sous brouillard, contre Tiana. S'ouvre après `opus1_id_08` (l'Indonésie est sa rivale naturelle) si le joueur a partagé les relevés (`opus1_id_04_decision` = `partager_releves`) *ou* si `monde.atlas.credibilite ≥ 4`.
- **`opus1_hs_mg_2` — Les cartes ouvertes.** 2v1, `relais`, avec Tiana contre Relais Zéro et Yuna. Choix — son dilemme canon : **ouvrir ses cartes à un rival** (`ouvrir_cartes` : `pays.mg.inventaire_complete`, `pays.mg.rival_respecte`) ou **protéger le travail de son atelier** (`proteger_atelier`).
- **Conséquences.** Madagascar `alliee` ; variante de dialogue à `opus1_finale_06` (les cartes de Tiana montrent les couloirs des relais compromis) ; entrée de carnet.

### Mongolie — Saran Bat, « Le point de ravitaillement déplacé » (2 épisodes)

**Pourquoi cette nation.** Les plus grandes cartes du tournoi, presque sans obstacle ; « La steppe » donne mouvement +2 aux roues et aux chenilles et interdit d'embarquer sur un transport allié ; le passif de Saran favorise la reconnaissance. Sa motivation canon — préserver le droit de changer de fournisseur sans perdre l'accès au circuit — est la réponse directe aux exclusivités du parcours mexicain. Ni empire ni conquête : le cheval, le feutre et l'horizon.

- **`opus1_hs_mn_1` — Le grand galop.** 1v1, `elimination`, contre Saran, sur une carte où seule la reconnaissance décide de qui frappe le premier. S'ouvre après `opus1_mx_10` si le joueur a **refusé** une exclusivité — exigé la fin du mandat privé (`opus1_mx_10_decision` = `fin_du_mandat`) *ou* refusé de garantir le crédit (`opus1_mx_08_decision` = `refuser_garantie`). C'est le seul arc qui s'ouvre sur un refus.
- **`opus1_hs_mn_2` — Le point de ravitaillement déplacé.** 2v2, `capture_partielle`, avec Saran contre Ost et Basile Kelm ; le point de ravitaillement change à mi-parcours, annoncé à tous. Choix — son dilemme canon : **poursuivre l'ouverture** (`poursuivre_ouverture` : `pays.mn.grand_galop_lance`) ou **revenir couvrir la réserve commune** (`couvrir_reserve` : `pays.mn.respect_du_cavalier`, `pays.mn.rival_respecte`).
- **Conséquences.** Mongolie `alliee` ; une unité de reconnaissance offerte ; variante de dialogue à `opus1_finale_12` ; entrée de carnet.

### Namibie — Amalie Haoses, « La brume du matin » (2 épisodes)

**Pourquoi cette nation.** Le seul terrain totalement découvert du tournoi, plus une brume côtière qui tombe tous les matins ; « La brume » aveugle l'adversaire, le passif d'Amalie protège les drones. Sa motivation canon — éviter qu'un opérateur vende une information produite ensemble — fait d'elle la réponse à Relais Zéro. Le désert se traverse ou l'on y disparaît ; aucune référence coloniale.

- **`opus1_hs_na_1` — Ce que la brume efface.** 1v1, `elimination`, contre Amalie. S'ouvre après `opus1_au_04` si le joueur a partagé les relevés (`opus1_au_04_decision` = `partager_releves`) *ou* respecté Saran Bat, sa rivale naturelle (`pays.mn.rival_respecte`).
- **`opus1_hs_na_2` — Le passage révélé.** 1v3, `tenir`, contre Relais Zéro, Basile Kelm et une délégation sous mandat — trois camps aux moyens bornés et fronts séparés, le format du canon. Choix, avant le coup d'envoi — son dilemme canon : **révéler le passage à tous** (`reveler_passage` : `pays.na.brume_etendue`, `pays.na.rival_respecte`) ou **protéger la seule fenêtre de son équipe** (`proteger_fenetre` : `pays.na.silence_impose`).
- **Conséquences.** Namibie `alliee` ; variante de dialogue à `opus1_finale_16` (les observateurs d'Amalie ont relevé les couloirs du réseau muet) ; entrée de carnet.

### Népal — Mira Karki, « L'altitude » (3 épisodes, disparition)

**Pourquoi cette nation.** La carte la plus verticale du tournoi, du subtropical au glacier ; « L'altitude » ôte tout malus de pente à l'infanterie et interdit les chars ; le passif de Mira frappe depuis la montagne. Sa motivation canon — donner aux sites isolés une voix dans les engagements de distribution — et sa croyance — elle accepte trop facilement une logistique réduite et demande de l'aide tard — sont le signe et la cause de sa disparition. Les fanions de balisage sont sans signe ; le sommet est une étape, jamais une conquête.

- **`opus1_hs_np_1` — Les ateliers d'altitude.** 1v1, `capture_partielle`, contre Mira. S'ouvre après `opus1_ch_10` (la Suisse est l'autre pays de relais d'altitude) si le joueur a accepté un retour sous audit (`opus1_ch_10_decision` = `retour_sous_audit`) *ou* respecté Elsbeth Vonlanthen (`pays.ch.rival_respecte`).
- **`opus1_hs_np_2` — Le pont de corde.** 2v1, `escorte`, avec Mira contre Basile Kelm qui tient le col. Un atelier isolé attend des pièces que la rotation des transports ne monte plus ; Mira a demandé de l'aide tard, et le dit. Choix : **poser le pont de corde** (`poser_pont` ; trace `pays.np.pont_pose`) ou passer par le col (`passer_col`). Ce choix change ce que l'atelier a reçu et la page du carnet, jamais le moment ni la cause de la disparition.
- **`opus1_hs_np_3` — Le relais sans réponse.** 2v1, `relais`, ancré après `opus1_finale_07`. L'épisode s'ouvre sur l'annonce (§3). L'adjointe de Mira (Anju Basnet, au registre depuis le 26 septembre 2026) reprend le banc et redescend avec le joueur la réserve de l'atelier isolé par trois relais, avant que Basile ne la compte comme réserve méridienne.
- **Conséquences.** Népal `alliee` (épisode 2) ; trace de carte si le pont est posé ; entrées de carnet ; variante de dialogue à `opus1_finale_12` (l'adjointe refuse la tutelle, et le dit).

### Nouvelle-Zélande — Tess Roa, « La fougère répare » (2 épisodes)

**Pourquoi cette nation.** Deux îles étroites, une montagne au milieu, de la brume de vallée, la carte la plus défensive du tournoi ; « La fougère répare » soigne dans la fougère et interdit la reconnaissance ; le passif de Tess protège en forêt. Sa motivation canon — faire compter la réparation dans le partage des moyens — se joue avec le génie et les bâtiments désaffectés. Aucune référence culturelle : la fougère est un terrain.

- **`opus1_hs_nz_1` — Le dépôt rendu.** 1v1, `capture_partielle` : remettre en service et posséder deux des trois postes désaffectés de la vallée, contre Tess. S'ouvre après `opus1_au_10` (« Le coût de la sortie » : le dépôt rendu par la rupture du contrat est celui-ci) si le joueur a accepté un retour sous audit (`opus1_au_10_decision` = `retour_sous_audit`) *ou* respecté Jone Vakalau, son rival naturel (`pays.fj.rival_respecte`).
- **`opus1_hs_nz_2` — La ligne de fougère.** 1v2, `survie` jusqu'à la fin de J10 : Tess **prête son banc** au joueur (au sens de `01-bible.md` §4.6) pendant que son équipe répare, contre Ost et Yuna. Choix — son dilemme canon : **réparer pour tous** (`reparer_pour_tous` : `pays.nz.ligne_tenue`, `pays.nz.rival_respecte`) ou **réserver le matériel à la prochaine manche** (`reserver_materiel`).
- **Conséquences.** Nouvelle-Zélande `alliee` ; remise de 10 % sur le génie ; entrée de carnet.

### Pérou — Luz Quispe, « Bâtisseurs » (3 épisodes)

**Pourquoi cette nation.** Trois étages en une carte — côte sèche, altiplano, versant amazonien — reliés par des routes et des ponts qu'il faut construire ; « Bâtisseur » et le passif de Luz (défense ×1,2 pour le génie) en font l'arc du génie. Sa motivation canon — empêcher qu'une homologation serve à fermer un passage aux petits ateliers — répond aux clauses d'exclusivité de la saison 2. Aucun site archéologique nommé ; l'altitude est une contrainte sportive.

- **`opus1_hs_pe_1` — Le passage commun.** 1v1, `capture_qg`, contre Luz : le premier génie qui relie ses étages gagne le tempo. S'ouvre après `opus1_mx_04` si le joueur a partagé les relevés (`opus1_mx_04_decision` = `partager_releves`) *ou* contesté une homologation (`monde.atlas.homologation_contestee`).
- **`opus1_hs_pe_2` — Le marché d'en haut.** 2v1, `escorte`, avec Luz contre Ost : le transport monte par une route que le génie bâtit devant lui.
- **`opus1_hs_pe_3` — La querelle d'altitude.** 2v2, `capture_partielle`, avec Luz contre Basile Kelm et Yuna Serrat, ancré après `opus1_in_08` (« L'option d'exclusivité »). Choix — son dilemme canon : **consacrer la réserve au passage commun** (`passage_commun` ; trace `pays.pe.reseau_relie`, `pays.pe.rival_respecte`) ou **terminer son propre équipement** (`propre_equipement` : `pays.pe.querelle_daltitude`). Le Népal, rival naturel, est cité en dialogue si `pays.np.visite` est posé.
- **Conséquences.** Pérou `alliee` ; trace de carte si le passage est bâti ; **Luz recrutable comme co-commandante** ; entrée de carnet.

**Compte.** 28 épisodes : deux pour l'Argentine, le Canada, les Fidji, le Kenya, Madagascar, la Mongolie, la Namibie et la Nouvelle-Zélande ; trois pour la Grèce, l'Islande, le Népal et le Pérou. Formats : douze 1v1, huit 2v1, trois 1v2, quatre 2v2, un 1v3 ; aucun 3v1, réservé aux finales. Types : cinq `capture_qg`, six `capture_partielle`, deux `elimination`, quatre `escorte`, six `relais`, deux `tenir`, trois `survie`.

## 3. Quatre disparitions

**Décision du propriétaire, 9 septembre 2026.** Quatre chefs de nations alliées meurent au cours de l'opus. C'est une décision qui contredit la dernière ligne de `01-bible.md` §1 (« Personne ne meurt. Jamais. ») et la table de vocabulaire de §5.2 ; elle s'applique, avec la borne fixée par le coordinateur et reprise dans les amendements de `BRIEF.md`, `01-bible.md` et `08-narration-choix.md` :

> **Une mort n'a jamais lieu sur un terrain homologué, jamais par du matériel de tournoi, et n'est jamais un homicide commis par une personne identifiée.** Ce sont des morts du dehors — route, mer, montagne, maladie, âge, épuisement — et ce qui les rend lourdes est que les décisions de la Cinquième Manche y ont indirectement contribué, et parfois les choix du joueur aussi. Elles sont **quatre, écrites à la main, nommées ici** ; aucune routine ne peut en produire une, et un contenu généré qui en déclarerait une est refusé au schéma. La doctrine du marquage (§5.3) reste intacte : sur le terrain, on met hors jeu, et l'équipage va boire quelque chose.

**Comment Atlas annonce une disparition.** *(Retenu le 26 septembre 2026, §5 point 9 : le geste entre dans `01-bible.md` §4.6, propriétaire du Tableau, par le lot de validation du lore dans les documents canon ; dès qu'il y est, c'est la bible qui fait foi.)* Le Tableau des délégations (`01-bible.md` §4.6) connaît trois gestes : deux plaques côte à côte, une plaque retournée, une plaque remise à l'endroit. Une disparition en ajoute un quatrième, et c'est **le seul cas où l'on décroche** : Solveig Tamm décroche la plaque et la **pose à plat sur la tablette** du Tableau, face visible, avec une ligne d'organisation — *« Grèce — engagée. Banc repris par la fédération. »* La délégation ne se retire pas ; elle change de banc. Nera Aldouin ne contresigne rien, parce qu'aucun article du Pacte ne le demande ; Osmin Talvarec descend dans le hall et reste devant, comme pour un retrait ; Célestin Vantour ouvre son Bulletin sur la météo, ne dit rien pendant tout le Bulletin, et ne prononce le nom qu'à la dernière phrase — une phrase, un fait. Au générique, la plaque est **remise à l'endroit** : c'est la seule fois où l'on remet une plaque qui n'a pas été retournée. **Le joueur ne voit jamais l'instant**, toujours l'annonce.

**Ce qu'une disparition change, et ce qu'elle ne change pas.** Le commandant n'est plus recrutable comme co-commandant à partir de l'annonce ; s'il l'était, l'emplacement se libère. La nation **reste engagée** et sa relation ne bouge pas : une disparition n'est jamais un retrait, et une conséquence `allie_acte_iii` déjà acquise tient — c'est la délégation qui reste, pas l'homme. Le banc est repris par une adjointe du registre (`content/personnages.json`, rôle `adjointe` : Dafni Rallis, Anju Basnet, Léa Wagener, Nadia Berrada — un intérim sans nom pour Nikos en branche `garder_la_main`), qui joue les couleurs et le catalogue de la nation sans en avoir le pouvoir de commandant. Il y a une entrée de carnet, des variantes de dialogue aux finales concernées, et une absence à l'épilogue. Qui disparaît, après quel épisode, où c'est annoncé et qui reprend le banc est **écrit en dur dans le code de campagne** (`src/app/campagne/disparitions.ts`), jamais dans un contenu : aucun schéma ne sait dire une disparition (§5 point 2). **Aucune fin ne lit une disparition** : deux joueurs aux mêmes choix de trame ont la même fin, avec ou sans ces quatre plaques posées à plat.

**Pourquoi ces quatre, et pourquoi pas Ariane.** Le propriétaire a demandé d'y penser. Ariane Belloc est la mentore du joueur de la première leçon à l'épilogue ; son arc canon (`17-aube.md` : apprendre à reconnaître une concession coûteuse, révéler elle-même ses propres clauses) se conclut à la finale 18 par sa voix, et la campagne sans elle perd la seule personne qui puisse dire au joueur ce que sa victoire vaut. Tomas Reiner est choisi **à sa place** : c'est le second mentor, celui des tutoriels et de la saison 1, l'organisateur des convois — et sa disparition tombe au moment où le joueur est au plus bas, juste après le repli imposé, quand une mort du dehors pèse le plus. Les deux disparitions en hors-série sont celles dont la biographie contient déjà le signe : Nikos parle de son départ du circuit, Mira demande de l'aide tard. Samir El Hadi est le quatrième parce que sa disparition dépend d'un contrat — la clause de dépendance qui interdit de le remplacer — et d'un choix du joueur, sans qu'aucun des deux soit jamais présenté comme la cause de sa maladie.

### 3.1 Nikos Delis — `opus1_hs_gr_3`, dépend d'un choix

**Le signe.** `opus1_hs_gr_2` : Nikos demande son avis au joueur, ce qu'il ne fait jamais, et parle de « quand il ne sera plus sur le circuit ».

**La cause.** Le cœur, à son âge, un matin d'hiver. Le contrat de priorité de Basile Kelm (`opus1_finale_02`) coupe les petites délégations ; la ligne du bac vers les îles, alimentée par la réserve du port, est suspendue pour l'hiver. Sans bac, quelqu'un prend le bateau.

**Ce que change `opus1_hs_gr_2_decision`.** Branche **b** (`garder_la_main`) — le joueur lui a dit de reprendre lui-même toute la préparation ; c'est la branche par défaut si le hors-série n'est pas joué — : il fait la traversée seul chaque matin et s'assoit au môle après la dernière ; disparition après la finale 2, banc repris par un intérim de la fédération, la méthode perdue. Branche **a** (`confier_recrue`) — la recrue tient le passage — : il reste au quai ; disparition après la finale 7, au café du port, la recrue en mer, la méthode transmise ; la recrue reprend le banc et joue `opus1_hs_gr_3` puis paraît à l'épilogue. **La disparition a lieu dans les deux branches** ; ce qui dépend du joueur est le moment, le lieu et ce qui reste.

**Ce que le joueur voit.** À l'ouverture de « Le banc du port » : la plaque posée à plat, Vantour sur la météo, le chat du port sur la tablette.

**Scène, branche b (huit répliques).**

1. **Solveig Tamm** — Elle décroche la plaque, la pose à plat, face visible. « Grèce — engagée. Banc repris par la fédération. »
2. **Célestin Vantour** — « Le Bulletin, ce matin : vent de nord sur les îles, mer courte. Le bac ne reprendra pas avant la fin du contrat de priorité. »
3. **Vantour** — « Nikos Delis faisait la traversée lui-même, chaque matin, depuis que le bac ne passe plus. Hier il est rentré au môle et il s'est assis. »
4. **Solveig** — « Il est mort là, calme, le café encore chaud. Il avait rangé les pièces sur le quai. Toutes. Il ne laissait jamais une caisse en plan. »
5. **Le joueur** — « Il m'avait demandé si la recrue pouvait tenir le passage. Je lui ai dit de garder la main. »
6. **Solveig** — « Vous lui avez dit ce qu'il voulait entendre. Ce n'est pas la même chose qu'une faute. »
7. **Vantour** — « La ligne du bac dépendait de la réserve du port, et la réserve est sous contrat de priorité. Ce n'est pas une accusation, c'est un ordre des choses, et je le dis une fois. »
8. **Solveig** — « Le banc grec joue quand même cet après-midi. Il disait qu'on ne refuse pas de jouer. Le chat du port est sur la tablette ; je le laisse. »

**Scène, branche a (six répliques).**

1. **Solveig** — Elle pose la plaque à plat. « Grèce — engagée. Banc repris par Dafni Rallis. »
2. **Vantour** — « Le Bulletin : mer belle sur les îles, le bac est rentré à l'heure. Nikos Delis n'était pas à bord ; il ne prenait plus la mer depuis l'hiver. »
3. **Vantour** — « Il était au café du port, ce matin, à la table du coup d'envoi. La recrue était en mer, avec la méthode. »
4. **Dafni Rallis** — « Il est mort à sa table, avant son café. Il m'a fait refaire le passage des îles quarante fois. La quarante et unième, il n'a rien dit. C'était le compliment. »
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

**Conséquences.** `cmd_mira_karki` non recrutable dès l'annonce ; Népal engagé, banc repris par Anju Basnet (`anju_basnet`) ; `carnet_hs_np_mira` ; variante `banc_nepalais` à `opus1_finale_12`.

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

**Conséquences.** `cmd_tomas_reiner` non recrutable dès l'annonce ; Luxembourg engagé, `allie_acte_iii` de `fil_cars_intendance` maintenu ; banc repris par Léa Wagener (`lea_wagener`), son adjointe aux convois — les flags `cmd.lea_wagener.*` de l'ancienne distribution portent désormais le nom de Tomas, une adjointe sans pouvoir n'étant ni recrutable ni rivale jurée ; Solveig reprend le registre des convois ; `carnet_tomas_desserte` ; variantes à `opus1_finale_12` (Ariane), `opus1_finale_15` (Edran répond de la route, sans être accusé d'autre chose que de l'avoir fermée) et `opus1_finale_18`.

### 3.4 Samir El Hadi — `opus1_au_01` ou `opus1_finale_14`, le moment dépend d'un choix

**Le signe.** `opus1_ma_09` « La réserve retenue » : Samir laisse coordonner l'étape à son adjointe et regarde le match depuis le dépôt ; `opus1_ma_11` : il dit qu'il « se soigne entre deux étapes ».

**La cause.** Une maladie longue, la sienne, nommée nulle part. La clause de dépendance du contrat de transport (`opus1_ma_06`, `opus1_ma_08`) interdit à la délégation d'employer un coordinateur hors du personnel du fournisseur : sans garantie extérieure, personne ne peut le remplacer aux étapes, et il tient.

**Ce que change `opus1_ma_08_decision`.** Branche **b** (`refuser_garantie`, et la branche retenue si aucune garantie n'a été donnée) — le joueur a refusé de garantir le crédit du signataire — : la délégation ne peut pas payer un remplaçant, Samir tient les étapes une saison de plus au lieu de se soigner ; disparition après `opus1_jp_12`, annoncée au briefing de `opus1_au_01`. Branche **a** (`garantir_livraison`) — la garantie libère un remplaçant — : il se soigne une saison ; disparition après `opus1_finale_13`, annoncée au briefing de `opus1_finale_14`. **La maladie est la sienne dans les deux branches** ; ce qui dépend du joueur est le moment. Vantour le dit sans accuser : « on ne remplace pas quelqu'un qu'un contrat interdit de remplacer ».

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

**Conséquences.** `cmd_samir_el_hadi` non recrutable dès l'annonce ; Maroc engagé, banc repris par Nadia Berrada (`nadia_berrada`), coordinatrice des étapes du sud ; `carnet_samir_caravane` ; variantes à `opus1_finale_17` (Ost, qui lui prêtait du matériel à conditions opaques à `opus1_ma_05`, ne prononce pas son nom) et `opus1_finale_18`.

### 3.5 Ce que cela coûte au joueur, en une table

| Disparition | Où | Ce qui est perdu | Ce qui reste |
|---|---|---|---|
| Nikos Delis (GR) | `opus1_hs_gr_3`, après F2 (b) ou F7 (a) | Le co-commandant de défense littorale ; en branche b, la méthode | La Grèce engagée ; en branche a, Dafni Rallis et la méthode |
| Mira Karki (NP) | `opus1_hs_np_3`, après F7 | Le co-commandant d'altitude | Le Népal engagé, Anju Basnet, la réserve de l'atelier isolé |
| Tomas Reiner (LU) | `opus1_finale_12` | Le second mentor, le co-commandant de protection, le registre des convois | Le Luxembourg engagé, `allie_acte_iii`, Léa Wagener, la liste complète |
| Samir El Hadi (MA) | `opus1_au_01` (b) ou `opus1_finale_14` (a) | Le co-commandant de la caravane | Le Maroc engagé, Nadia Berrada, une saison de plus en branche a |

## 4. Ce que cela demande à `content/personnages.json`

Les douze commandants hors premier plan ont reçu deux faits d'historique de plus (`<cle>_3`, acte 1, l'appel du premier hors-série ; `<cle>_4`, acte 2, le dilemme du second), de la forme des existants, avec `source: "canon_aube_v2"`, et leur premier hors-série en `identiteTactique.mission`. Nikos Delis, Mira Karki, Tomas Reiner et Samir El Hadi portent chacun un fait de disparition (`<cle>_disparition`, acte 3) en `confidentialite: "auteur"` — le champ que `src/serveur/personnages.ts` filtre pour tout acte, ce qui garantit qu'aucune route ne le sert. Rien d'autre n'a été modifié, ni renommé.

**Les quatre adjointes — 26 septembre 2026.** Dafni Rallis (`dafni_rallis`, Grèce), Anju Basnet (`anju_basnet`, Népal), Léa Wagener (`lea_wagener`, Luxembourg) et Nadia Berrada (`nadia_berrada`, Maroc) entrent **à la fin** du registre, sans qu'une entrée existante bouge : rôle `adjointe`, une nation, un lien vers le général dont elles reprendront le banc, deux faits publics chacune (actes 1 et 2, `source: "canon_aube_v2"`), et **rien qui annonce une disparition** — une mort ne s'écrit qu'en note auteur, chez le disparu. Leurs clés n'ont pas le préfixe `cmd_` : ce ne sont pas des commandants, elles n'ont ni profil de capacités ni chaînes de pouvoir, et le vestiaire comme la confiance, qui exigent `cmd_…`, ne peuvent pas les prendre. Léa Wagener garde ce que le canon disait déjà d'elle — le carnet à couverture d'acier (`pays.lu.carnet_dacier_lu`, le motif de `content/styles/lu.json`) et le rire du petit (`pays.lu.rire_du_petit`) — : c'était le nom de l'ancienne commandante luxembourgeoise, et c'est désormais celui de l'adjointe aux convois de Tomas. Le registre compte **41** personnages ; `tests/serveur/registre-commandants.test.ts` les compte et exige qu'une adjointe n'ait pas de profil.

## 5. Les décisions de système — tranchées le 26 septembre 2026, par délégation du propriétaire

Le 9 septembre, ce document listait onze questions « par ordre d'importance, honnêtement ». Le propriétaire a délégué leur arbitrage le 26 septembre (« va y lance plusieurs agents pour faire tout ça en autonomie »). Chaque point garde sa question en une phrase, puis dit ce qui est tranché, pourquoi, et ce qui est fait. Seul le point 11 reste ouvert.

1. **La lecture d'une décision nationale.** *La question : un onzième type de `Condition`, ou quarante-huit flags de pays qui traduiraient chaque décision.* **Tranché : le onzième type, `{ type: 'decision', cle, option }`** (`13-campagne.md` §8.2, qui en porte la règle complète). Trois raisons. Le journal des décisions existe déjà et c'est lui que lit le carnet ; quarante-huit flags le recopieraient, et deux sources pour un même fait finissent par diverger. Une décision est enregistrée par la campagne au moment où le joueur la prend, un flag par un auteur qui peut l'oublier. Et la liste canon des flags reste un vocabulaire du monde, pas le miroir d'un écran. La règle 1 de `01-bible.md` §8.6 (aucun flag inventé) n'est pas touchée : on n'ajoute aucun flag. **Fait** : le type au schéma et au validateur ; l'évaluation dans `engine/deblocages.ts`, pure — le journal lui est donné dans le profil, et c'est sa **dernière** entrée pour une décision qui compte ; le nom d'une décision au journal et la correspondance des lettres de fiche aux options enregistrées, écrits une fois dans `src/app/campagne/decisions.ts` ; le journal de la progression locale (`journalDeProgression`), branché dans `profilDepuisProgression`, là où la campagne évalue ses ouvertures. **Le registre est aligné** : ses douze lectures de décision nationale nomment l'option enregistrée (`partager_releves`, jamais `a` — le validateur refuse d'ailleurs une option d'une lettre), et les douze choix de hors-série ont reçu leurs identifiants (`ouvrir_chenal`, `confier_recrue`…), qui seront ceux que la campagne enregistrera. `tests/campagne/hors-serie.test.ts` valide les vingt-huit conditions, vérifie que chaque décision lue existe avec l'option lue, et que chaque porte, seule, ouvre son épisode — l'autre option, non.

2. **Retirer un co-commandant n'est dans aucune liste.** *La question : une onzième conséquence `co_commandant_retire` bornée aux quatre clés, ou un calendrier écrit en dur dans le code de campagne.* **Tranché : le calendrier en dur, `src/app/campagne/disparitions.ts`**, et la liste fermée des conséquences reste à dix (`13-campagne.md` §5.2). C'est la seule voie qui garantisse qu'**aucune routine ne peut jamais écrire une mort** : aucun schéma de contenu n'a de mot pour la dire, et une borne « aux quatre clés » aurait vécu dans une liste de valeurs qu'un jour quelqu'un allonge. Le calendrier nomme les quatre, l'épisode après lequel chacun disparaît, l'épisode qui l'annonce, la décision qui choisit la branche (Nikos : `opus1_hs_gr_2_decision` = `confier_recrue` ; Samir : `opus1_ma_08_decision` = `garantir_livraison`), la branche par défaut quand le joueur n'a pas fait le geste, et l'adjointe qui reprend le banc. **Branché** là où un général est proposé : le vestiaire (`vestiaire`, donc `optionsCommandant` et la grille du briefing) et les bancs prêtés (`bancsProposes` ; `optionsBanc` n'est pas filtré, pour que la graine relise ce qui a été joué). **Inerte** tant qu'aucun épisode d'ancrage n'existe — aucune finale, ni `opus1_jp_12` — et tenu par `tests/campagne/disparitions.test.ts` sur des progressions fictives. Deux règles pour la suite, écrites dans le module : **une disparition ne se défait jamais**, donc la future ouverture des hors-série écartera tout épisode qui fait jouer un général disparu, hors l'épisode de son annonce — c'est ce qui ferme `opus1_hs_gr_2` quand la finale 2 annonce la disparition de Nikos par défaut, et empêche une décision tardive de déplacer une mort déjà annoncée ; et le jour où une ancre entre au canon, la grille du vestiaire doit montrer la plaque posée à plat plutôt qu'une case « verrouillée » — un test tombe ce jour-là pour le rappeler.

3. **Quatre noms d'adjointes, et un registre à 37.** *La question : une entrée sans profil, ou un profil neutre.* **Tranché : quatre entrées sans profil, rôle `adjointe`**, ajoutées à la fin de `content/personnages.json` (§4) ; clés sans `cmd_`, deux faits publics, rien qui annonce une disparition. Pas un profil neutre : un profil de capacités ferait d'elles des commandantes prenables au vestiaire et recrutables en co-commandant, ce qu'elles ne sont pas. `tests/serveur/registre-commandants.test.ts` compte 41 personnages, n'exige un profil qu'aux commandants, et vérifie que chaque banc du calendrier est une adjointe de la bonne nation, liée à son général. `doc/refonte/roster-heros.md`, régénéré, a une section des adjointes. **Reste**, pour la première mission qui fera jouer un banc d'adjointe (`opus1_hs_gr_3`, `opus1_hs_np_3`, `opus1_finale_12` et la suite du Luxembourg) : le moteur donne à chaque camp un commandant avec son kit ; il faudra soit un profil sans pouvoir au catalogue des capacités, soit un camp sans commandant — à trancher avec cette mission, pas avant. Les fiches de direction artistique des quatre (`direction-artistique-opus1.json`) restent à écrire.

4. **Deux distributions de commandants coexistent.** *La question : aligner `doc/06-pays-de-depart.md` §5 et `content/flags.json` sur `content/personnages.json`, ou l'inverse.* **Tranché : sur `content/personnages.json`**, canon des biographies. Dans `content/flags.json`, les **cent vingt** flags `cmd.<ancien>.*` sont **renommés** vers les vingt-quatre commandants actuels (`cmd.hrefna_sigurdardottir.*` → `cmd.elin_arnardottir.*`, `cmd.lea_wagener.*` → `cmd.tomas_reiner.*`…), parce que rien ne les lisait — ni contenu, ni scénario, ni code, ni test — et qu'un catalogue qui nomme des absents ment ; libellés et descriptions sont accordés. Les flags de pays qui citaient un ancien prénom n'étaient pas trois mais **vingt-trois** : vingt et un sont corrigés, et les deux de Léa Wagener (`pays.lu.carnet_dacier_lu`, `pays.lu.rire_du_petit`) disent vrai à nouveau, puisqu'elle revient comme adjointe. **Les clés de pays ne changent pas**, même celles qui portent un ancien prénom (`pays.is.silence_de_hrefna`, `pays.nl.pari_avec_gaudenz`, `pays.in.charriage_avec_marlee`, `pays.sn.pari_avec_amani`) : les fiches de `content/pays/` les déclarent, une clé est un identifiant, c'est le libellé qui dit le nom (« Le silence d'Elín »). Le compte annoncé du fichier (430) suit enfin sa liste (431). `tests/schemas/flags-canon.test.ts` valide les 431 flags, leur registre d'auteurs, et interdit qu'un nom de l'ancienne distribution y revienne. Dans `doc/06-pays-de-depart.md`, chaque fiche du §5 nomme le commandant actuel et renvoie son kit au catalogue ; la table de correspondance y est gardée. Hors de ce lot, et signalés : `content/styles/*.json` (dix-neuf fiches de style citent encore un ancien prénom dans leur justification), `doc/03-schemas.md` et les exemples de `tests/schemas/exemples.ts` (Camille Aubertin, un exemple de forme), `doc/07-france-regions.md` §1.

5. **Une disparition en hors-série, pour qui ne joue pas le hors-série.** *La question : l'apprendre à l'épilogue par l'absence, ou par une ligne de la trame.* **Tranché : une ligne de Vantour dans la trame**, au premier épisode de la trame qui suit la disparition — la finale 3 pour Nikos en branche `garder_la_main`, la finale 8 pour Nikos en branche `confier_recrue` et pour Mira —, jouée seulement si l'épisode d'annonce du hors-série (`opus1_hs_gr_3`, `opus1_hs_np_3`) n'a pas été joué. Une phrase, au Bulletin, le nom à la fin, comme pour les autres ; sans le mot « mort » (point 6). Apprendre une mort par une chaise vide à l'épilogue ferait d'une personne qu'on a pu croiser un détail de mise en scène. Elle s'écrit **avec les finales** ; elle est notée au registre (`rappelTrame` de chaque disparition) et au calendrier (`rappelTrame` de chaque branche).

6. **Le mot sur l'écran.** *La question : permettre « mort » à l'écran pour ces quatre-là, ou le garder aux documents auteur.* **Tranché : permis à l'écran, une fois pour chacun, dans la bouche de la personne la plus proche** — le vocabulaire de la fiction est libre depuis le 10 septembre 2026, et un euphémisme à cet endroit sonnerait faux. « Disparition » partout ailleurs, Vantour compris. Appliqué aux scènes du §3 : Solveig pour Nikos en branche `garder_la_main` (elle tenait ses caisses), Dafni Rallis en branche `confier_recrue`, Anju Basnet pour Mira, Ariane pour Tomas, Nadia Berrada pour Samir. Les deux scènes de Nikos ont été retouchées pour cela : le mot y était dans la bouche de Vantour.

7. **Le moment de Tomas.** *La question : après la finale 11, ou à la fin de la saison 2.* **Tranché : après la finale 11, gardé** — au plus bas, juste après le repli imposé, sur la route de relève qui est son dernier fait canon. Le calendrier le porte (`opus1_finale_11`, annonce `opus1_finale_12`).

8. **Samir, deux moments.** *La question : garder un moment variable, ou le fixer.* **Tranché : gardé** — le poids du choix du Maroc 8 est précisément de décider du moment, jamais de la maladie. Le calendrier porte les deux branches ; sans garantie donnée, c'est la branche `refuser_garantie` qui est retenue, parce que celle qui déplace le moment demande un geste du joueur. Le coût de production est de deux briefings avec variante (`opus1_au_01`, `opus1_finale_14`), accepté.

9. **Le Tableau.** *La question : qui porte le geste de la plaque posée à plat.* **Tranché : le geste est retenu**, et il entre dans `01-bible.md` §4.6, propriétaire du Tableau, par le lot de validation du lore dans les documents canon (même jour, autre lot). Dès qu'il y est, c'est la bible qui fait foi ; ce document n'en garde que l'usage.

10. **Les hors-série hors du compte.** *La question : qui dit quel contenu compte.* **Tranché : le manifeste du §6**, qui fixe ce qu'on annonce comme « les missions de l'opus 1 » et range tout le reste à part.

11. **Rien n'est simulé.** *Reste ouvert, hors du lot du 26 septembre.* Aucune carte, aucun paramètre, aucun mode ; les formats et les types sont ceux du moteur, les cases sont à produire. Un `1v3` de type `tenir` (`opus1_hs_na_2`) et un `1v2` d'`escorte` (`opus1_hs_fj_1`) sont les deux fiches dont la jouabilité est la moins certaine.

**Une remarque trouvée en validant les conditions, non tranchée.** `opus1_hs_is_3` écrit trois compteurs de monde (`monde.atlas.soupcon`, `monde.atlas.dossier_truquage`, `monde.atlas.credibilite`), comme le font les neuf fils de `content/fils/`. La règle dure « deux joueurs aux mêmes choix de trame ont la même fin » tient tant qu'aucune bascule ni condition de fin ne lit ces compteurs : c'est à vérifier le jour où les fins seront écrites, pour les fils comme pour les hors-série.

## 6. Ce qui compte — le manifeste du contenu de l'opus 1

Établi le 26 septembre 2026 (§5, point 10), pour qu'on n'annonce jamais « 200 missions ». **L'opus 1 compte 172 épisodes, et c'est le seul nombre qu'on annonce comme ses missions** ; tout le reste s'additionne à part et s'annonce par son nom.

| Contenu | Nombre | Compte dans les 172 | Où il vit |
|---|---:|:-:|---|
| La trame principale : exercices | 10 | oui | `opus1-tutoriels-final.json` |
| La trame principale : épisodes nationaux (douze nations, douze chacune) | 144 | oui | `opus1-nations.json` |
| La trame principale : finales | 18 | oui | `opus1-tutoriels-final.json` |
| **L'opus 1** | **172** | — | numérotés de 1 à 172 dans `opus1-fil.md` |
| Les deux matchs du parcours local (`pacte_du_col`, `couleurs_alliees`) | 2 | non | `content/campagne.json` |
| Les hors-série | 28 | non | ce document et son registre |
| Les quêtes d'Aube (`aube_convoi_secondaire`, `aube_archives_secondaire`) | 2 | non | `quetes.md` |
| Les essais d'Aube (les cinq étapes, les drones, le drone marin, l'essai maritime, la Forge) | 9 | non | `content/scenarios/aube_*` |
| Les fils secondaires | 9 fils, 45 missions | non | `content/fils/`, `13-campagne.md` §5.3 |
| Les parties libres (`demo`, `archipel_des_deux_rades`, `bras_de_mer`) | 3 | non | `/jeu` |
| La Dépêche du jour | une par jour | jamais | `08-narration-choix.md` §4.4 |

Trois règles. **On annonce 172, et 28 hors-série à part** : « 200 » additionnerait deux choses de nature différente — une trame que tout le monde joue et des arcs que les choix ouvrent ou ferment. **Un contenu neuf dit dans quelle ligne il entre avant d'être annoncé** ; s'il n'entre dans aucune, on complète ce tableau d'abord. **Ce qui est jouable aujourd'hui n'est pas ce qui compte** : le parcours local compte 24 étapes (les dix exercices, les deux matchs, les douze épisodes de France) ; c'est un état de production, pas une promesse.
