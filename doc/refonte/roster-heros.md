# Le roster des héros — nations, Atlas, civils, faction

Généré par `node scripts/roster-heros.mjs` depuis `content/personnages.json` (révision 6) et `content/commandants-capacites.json`. **Document auteur** : il liste aussi la faction, dont la fonction et les liens ne sont jamais publics. Ne pas éditer à la main.

Personnages : **41** — 24 commandants nationaux (12 au premier plan), 8 de la faction, 2 d'Atlas, 3 civils, 4 adjointes.

## Les 24 commandants nationaux

| Nation | Prénom | Nom complet | Plan | Archétype (fiche pays) | Style | Passif | Pouvoir | Super pouvoir | Faits | Mission d'entrée |
|---|---|---|---|---|---|---|---|---|---:|---|
| France | **Ariane** | Ariane Belloc | premier plan | prodige | La course par étapes | Attaque ×1,05 pour vos unités. | **L’échappée** (3 barres) — Ce tour, toutes vos unités au sol gagnent +1 de mouvement : l’échappée part, et tout le monde y est. | **L’atelier roulant** (7 barres) — Toutes vos unités récupèrent 3 PV, repartent le plein fait et les charges au complet, et frappent ×1,15 ce tour. | 3 | `aube_batteries_2v1` |
| Luxembourg | **Tomas** | Tomas Reiner | premier plan | diplomate | Le carrefour | Défense ×1,1 pour vos unités sur un bâtiment. | **Marché du matin** (3 barres) — Vos revenus de la prochaine journée sont ×1,5. | **Toutes les routes** (6 barres) — Toutes vos unités refont le plein et les charges, et gagnent +1 de mouvement ce tour. | 4 | `aube_batteries_2v1` |
| Suisse | **Elsbeth** | Elsbeth Vonlanthen | premier plan | gardienne | L’horloge des cols | Défense ×1,1 pour vos unités sur montagne et forêt. | **Cols fermés** (3 barres) — Vos unités sur montagne et forêt se défendent ×1,4, et les captures adverses avancent deux fois moins vite jusqu’à votre prochain tour. | **Le téléphérique** (7 barres) — Jusqu’à 3 cases de montagne contiguës deviennent une route pendant 2 journées, et vos unités gagnent +1 de mouvement ce tour. | 4 | `opus1_ch_01` |
| Pays-Bas | **Lotte** | Lotte Vermeer | premier plan | ingenieur | La maîtrise de l’eau | Défense ×1,15 pour vos génies. | **Polder** (3 barres) — Jusqu’à 3 cases de mer contiguës deviennent de la plaine pendant 2 journées. | **La digue cède** (6 barres) — Jusqu’à 4 cases de plaine ou de plage contiguës deviennent une rivière pendant 2 journées, et vos unités se défendent ×1,2 jusqu’à votre prochain tour. | 4 | `opus1_nl_01` |
| Maroc | **Samir** | Samir El Hadi | premier plan | veteran | La caravane | Vos unités consomment 20 % de carburant en moins. | **Halte du thé** (3 barres) — Toutes vos unités refont le plein et les charges, tout de suite. | **Le grand souk** (6 barres) — Toutes vos unités récupèrent 2 PV, et frappent ×1,15 et se défendent ×1,15 pendant une journée. | 4 | `opus1_ma_01` |
| Sénégal | **Awa** | Awa Diagne | premier plan | fonceuse | On avance ensemble | Attaque ×1,08 pour vos infanteries et mécas. | **Teranga** (3 barres) — Ce tour, vos troupes à pied gagnent +1 de mouvement et frappent ×1,15 : la colonne part d’un seul bloc. | **Tout le delta** (7 barres) — Toutes vos unités à pied qui ont déjà agi rejouent une fois ce tour. | 4 | `opus1_sn_01` |
| Brésil | **Lívia** | Lívia Moura | premier plan | showman | Les tambours donnent l’élan | Attaque ×1,05 pour vos unités. | **Batucada** (2 barres) — Vos unités ont +10 % de chance dans chaque duel et frappent ×1,1 ce tour. | **Carnaval** (7 barres) — Vos unités frappent ×1,4 avec +15 % de chance ce tour, mais se défendent à 85 % : quand on danse, on ne se couvre pas. | 4 | `opus1_br_01` |
| Mexique | **Inés** | Inés Valdés | premier plan | showman | La prise | Points de capture ×1,1 pour vos infanteries et mécas. | **Clé de bras** (3 barres) — Ce tour, les unités adverses perdent 2 étoiles de terrain : leur ville ou leur forêt ne les protège plus. | **Saut de la troisième corde** (7 barres) — Toutes les unités adverses au sol perdent 1 PV, toutes perdent 2 étoiles de terrain, et vos unités frappent ×1,2 ce tour. | 4 | `opus1_mx_01` |
| Inde | **Devika** | Devika Rao | premier plan | showman | Le volume | Défense ×1,05 pour vos chenilles. | **Tournée générale** (3 barres) — Ce tour, tout ce que vous achetez coûte 25 % de moins. | **Le camion peint** (7 barres) — Tous vos véhicules à roues et à chenilles qui ont déjà agi rejouent une fois ce tour. | 4 | `opus1_in_01` |
| Japon | **Ren** | Ren Mizuno | premier plan | stratege_prudent | L’horaire tenu | Vision +1 pour vos pièces de portée. | **Correspondance** (3 barres) — Vos pièces de portée tirent 1 case plus loin ce tour. | **Dernier train** (8 barres) — Vos pièces de portée qui ont déjà tiré tirent une seconde fois ce tour. | 4 | `opus1_jp_01` |
| Australie | **Hazel** | Hazel Quinn | premier plan | gardienne | La distance protège | Défense ×1,15 pour vos éclaireurs et drones. | **Longue route** (3 barres) — Pendant une journée, les unités adverses consomment deux fois plus de carburant, et vos unités voient 1 case plus loin. | **Le cœur vide** (5 barres) — Tout ce qui vole ou roule chez l’adversaire — appareils, roues, chenilles — perd 1 PV, et les captures adverses avancent deux fois moins vite jusqu’à votre prochain tour. | 4 | `opus1_au_01` |
| Indonésie | **Ayu** | Ayu Pranata | premier plan | diplomate | Gotong royong | Défense ×1,1 pour vos coques. | **De main en main** (3 barres) — Vos capteurs capturent ×1,5 ce tour, et vos unités gagnent +1 de mouvement sur route, pont et ville. | **Les îles reliées** (6 barres) — Jusqu’à 4 cases de mer ou de rivière contiguës deviennent un ponton pendant 2 journées, et vos coques gagnent +1 de mouvement ce tour. | 4 | `opus1_id_01` |
| Argentine | **Leandro** | Leandro Paz | second plan | stratege_prudent | Le tableau noir | Attaque ×1,08 pour vos unités sur plaine. | **Tableau noir** (3 barres) — Vos unités voient 2 cases plus loin et se défendent ×1,15 jusqu’à votre prochain tour. | **Toute la pampa** (6 barres) — Vos roues et chenilles gagnent +2 de mouvement ce tour, et frappent ×1,2 depuis la plaine ou la route. | 4 | `opus1_hs_ar_1` |
| Canada | **Noémie** | Noémie Leduc | second plan | meteorologue | L’hiver ne compte pas | Vision +1 pour vos unités en forêt et dans les hautes herbes. | **Bulletin de neige** (3 barres) — Il neige pendant une journée : bottes et roues paient +1 par case hors route, pied et chenilles passent. | **Grand Nord** (7 barres) — Vos unités gagnent +2 de mouvement pendant une journée, et il neige pendant 2 journées. | 4 | `opus1_hs_ca_1` |
| Fidji | **Jone** | Jone Vakalau | second plan | prodige | Neuf fois sur dix | Vos unités ont +5 % de chance dans chaque duel. | **Passe au large** (2 barres) — Vos unités ont +10 % de chance dans chaque duel ce tour, et vos coques gagnent +1 de mouvement. | **Le cyclone** (7 barres) — Tempête pendant 2 journées : les appareils avancent deux fois moins, les tirs de loin font −20 %, et vos coques gagnent +1 de mouvement. | 4 | `opus1_hs_fj_1` |
| Grèce | **Nikos** | Nikos Delis | second plan | veteran | Le cabotage | Défense ×1,15 pour vos unités sur plage et port. | **Café serré** (3 barres) — Vos unités récupèrent 1 PV tout de suite, et se défendent ×1,2 jusqu’à votre prochain tour. | **L’estran** (6 barres) — Jusqu’à 4 cases de mer contiguës deviennent une plage pendant une journée, et vos troupes à pied gagnent +1 de mouvement ce tour. | 5 | `opus1_hs_gr_1` |
| Islande | **Elín** | Elín Arnardóttir | second plan | meteorologue | La roche et la vapeur | Vision +1 pour vos unités sur montagne. | **La vapeur monte** (3 barres) — Brouillard pendant une journée : tout le monde voit à 1 case, et vos unités se défendent ×1,1. | **Source chaude** (6 barres) — Toutes vos unités récupèrent 3 PV tout de suite, et le brouillard tombe pendant 2 journées. | 4 | `opus1_hs_is_1` |
| Kenya | **Kito** | Kito Njoroge | second plan | fonceuse | Le fond | Défense ×1,08 pour vos infanteries et mécas. | **Foulée** (3 barres) — Vos troupes à pied gagnent +2 de mouvement ce tour. | **Jusqu’à la ligne** (6 barres) — Vos capteurs capturent ×2 ce tour, et vos troupes à pied gagnent +1 de mouvement. | 4 | `opus1_hs_ke_1` |
| Madagascar | **Tiana** | Tiana Ravel | second plan | meteorologue | Deux climats | Défense ×1,1 pour vos unités en forêt et dans les hautes herbes. | **Saison des pluies** (3 barres) — Il pleut pendant une journée : roues +1 par case hors route et vision −1 pour tous, mais vos unités gagnent +1 de mouvement sur forêt et route. | **Chaque espèce a un nom** (6 barres) — Pendant une journée, vos unités en forêt et dans les hautes herbes ont +2 étoiles de terrain, et toutes voient 2 cases plus loin. | 4 | `opus1_hs_mg_1` |
| Mongolie | **Saran** | Saran Bat | second plan | fonceuse | La steppe | Attaque ×1,1 pour vos recons. | **Galop** (3 barres) — Vos roues et chenilles gagnent +2 de mouvement ce tour, mais consomment 30 % de carburant en plus. | **Les trois jeux** (7 barres) — Vos roues et chenilles gagnent +3 de mouvement ce tour, vos recons et chars légers frappent ×1,2, et tout consomme 50 % de carburant en plus. | 4 | `opus1_hs_mn_1` |
| Namibie | **Amalie** | Amalie Haoses | second plan | survivante | La brume | Défense ×1,1 pour vos unités. | **La brume tombe** (2 barres) — Les unités adverses voient 2 cases de moins, et vos unités se défendent ×1,15 jusqu’à votre prochain tour. | **La dune est un abri** (8 barres) — Jusqu’à votre prochain tour, vos unités à découvert — plaine, plage, route — ont +2 étoiles de terrain, et toutes se défendent ×1,2. | 4 | `opus1_hs_na_1` |
| Népal | **Mira** | Mira Karki | second plan | survivante | La cordée | Attaque ×1,1 pour vos infanteries et mécas sur montagne. | **Encordés** (3 barres) — Vos troupes à pied se défendent ×1,3 jusqu’à votre prochain tour, et gagnent +1 de mouvement sur montagne. | **Le dernier col** (7 barres) — Jusqu’à votre prochain tour, toutes vos unités ont +2 étoiles de terrain, où qu’elles soient, et se défendent ×1,15. | 5 | `opus1_hs_np_1` |
| Nouvelle-Zélande | **Tess** | Tess Roa | second plan | gardienne | La fougère répare | Défense ×1,12 pour vos unités en forêt et dans les hautes herbes. | **Brume de vallée** (3 barres) — Vos unités en forêt, hautes herbes et montagne se défendent ×1,3, et les unités adverses voient 1 case de moins, jusqu’à votre prochain tour. | **La fougère répare** (6 barres) — Toutes vos unités récupèrent 3 PV tout de suite, et ont +1 étoile de terrain jusqu’à votre prochain tour. | 4 | `opus1_hs_nz_1` |
| Pérou | **Luz** | Luz Quispe | second plan | ingenieur | Bâtisseuse | Défense ×1,2 pour vos génies. | **Route neuve** (3 barres) — Vos unités gagnent +2 de mouvement sur route et pont ce tour, et vos génies se défendent ×1,2. | **Le pont** (7 barres) — Jusqu’à 3 cases de mer ou de rivière contiguës deviennent un pont, pour le reste de la partie. | 4 | `opus1_hs_pe_1` |

### Lore en trois lignes, par commandant

**Ariane Belloc** — France. Commandante française et mentore. *Motivation :* Former un commandant qui sait gagner sans sacrifier ses équipages pour un drapeau. *Croyance :* Elle croit que demander du renfort est une force ; elle a encore du mal à le faire elle-même.
- An 12 (acte 1) : Ancienne responsable de maintenance, elle devient commandante pour défendre les équipes dont les contrats se jouent sur le terrain.
- An 12, après la bataille finale (acte 2) : Elle signe une concession avantageuse sans voir la dépendance au transport méridien. Elle en révèle elle-même les clauses au joueur.
- An 14 (acte 1) : Elle enseigne le combat, la capture et la production avant de présenter les enjeux de la guerre de l’énergie.
- *Dilemme :* Remporter un contrat vite ou préserver les réserves communes.

**Tomas Reiner** — Luxembourg. Commandant luxembourgeois et organisateur de convois. *Motivation :* Faire arriver les renforts promis, même quand cela complique sa propre bataille. *Croyance :* Il croit qu’une promesse vaut plus qu’un beau discours ; il prend mal qu’on doute de sa parole.
- An 13 (acte 1) : Il partage ses transports pour maintenir une délégation dans la guerre. Son aide n’est inscrite nulle part.
- An 14 (acte 1) : Il rencontre le joueur lors des entraînements. Une coopération logistique peut préparer une relève future.
- An 14, crise des réserves (acte 3) : Il organise une relève par un itinéraire annoncé ; les engagements antérieurs déterminent les moyens disponibles.
- An 14, après la finale 11 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_finale_12`, fixe) : la route — sortie de desserte de nuit, chaussée verglacée, un seul véhicule. Depuis le repli de la finale 10, la route principale du bassin est sous autorisation méridienne, par la clause de dépendance sur les dépôts et les routes ; il refuse de la demander à ceux qui viennent de fermer le terrain et prend la desserte. Le choix de la finale 9 change qui voyage avec lui, jamais le moment ni la cause ; les passagers sont indemnes, en toutes lettres. Jamais sur un front, jamais par une arme, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Luxembourg reste engagé et `allie_acte_iii` tient, le banc repris par son adjointe aux convois.
- *Dilemme :* Garder des réserves pour la relève ou financer la route immédiate.

**Elsbeth Vonlanthen** — Suisse. Commandante de la Suisse, responsable des relais alpins. *Motivation :* Garder chaque vallée ravitaillée, même quand les voisins ferment leurs routes. *Croyance :* Elle croit que prévoir le pire protège les autres ; elle risque de refuser une aide dont elle a besoin.
- Avant l’an 14 (acte 1) : Elle a maintenu un relais de vallée pendant une interruption des livraisons en répartissant les batteries entre trois équipes.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir un col à une délégation rivale ou conserver une réserve locale. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le premier col (acte 1) : Elle accueille le joueur au pied du premier col avec un carnet d’altitude où chaque relais de vallée garde sa réserve propre, et couvre ses pièces de portée dans la montée étroite. Elle croit qu’une vallée bien verrouillée n’a besoin de personne.
- An 14, le plateau verrouillé (acte 2) : Devant la station radar que Basile Kelm verrouille sans tenir toute la carte, elle reconnaît que son propre verrou lui a coûté une fenêtre de traversée. Elle remet alors au joueur les relevés d’une équipe locale qui paie sa maintenance avec un crédit méridien.
- *Dilemme :* Ouvrir un col à une délégation rivale ou conserver une réserve locale.

**Lotte Vermeer** — Pays-Bas. Commandante des Pays-Bas, ingénieure des ouvrages de passage. *Motivation :* Garder les pompes et les digues en marche sans demander la permission à un fournisseur. *Croyance :* Elle croit qu’un système doit pouvoir être réparé par ceux qui vivent avec ses pannes.
- Avant l’an 14 (acte 1) : Elle est entrée dans la guerre après avoir révisé les horaires de franchissement de deux écluses utilisées par des délégations concurrentes.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : publier le plan des ouvrages ou conserver un avantage de passage. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, les carrés du polder (acte 1) : Elle ouvre son parcours avec un horaire de marée affiché à la minute et découpe le polder — ces champs pris à la mer et tenus au sec par des digues — en carrés que ses voies surélevées rendent lisibles. Elle croit qu’un calendrier tenu dispense de se parler.
- An 14, le terrain prêté (acte 2) : Son adversaire de la digue partagée lui offre un passage de repli sans rien demander en retour, et elle concède qu’aucun horaire n’avait prévu cela. Elle laisse au joueur la question du plan de ses ouvrages, qu’elle gardait jusque-là pour elle.
- *Dilemme :* Publier le plan des ouvrages ou conserver un avantage de passage.

**Samir El Hadi** — Maroc. Commandant du Maroc, coordinateur des étapes de convoi. *Motivation :* Empêcher qu’un convoi en retard condamne les équipes qui l’attendent. *Croyance :* Il croit devoir tenir jusqu’à la relève ; reconnaître ses propres limites lui coûte.
- Avant l’an 14 (acte 1) : Il a appris le commandement en répartissant une réserve de pièces entre plusieurs étapes éloignées, sans laisser le dernier atelier à sec.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : accepter une livraison exclusive ou ouvrir le dépôt à plusieurs équipes. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, trois stations au soleil (acte 2) : Aux trois stations du parc solaire, il compare avec le joueur les reçus des convois et trouve la même clause de retour dans des contrats qu’il croyait concurrents. Il concède qu’une réserve gardée pour un risque imaginaire a laissé une étape à découvert.
- An 14, après le Japon 12 ou la finale 13 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_au_01` en branche b, `opus1_finale_14` en branche a de `opus1_ma_08_decision`) : une maladie longue, la sienne, nommée nulle part. La clause de dépendance du contrat de transport interdit à la délégation d’employer un coordinateur hors du personnel du fournisseur ; sans garantie du crédit, personne ne peut le remplacer et il tient les étapes une saison de plus au lieu de se soigner ; avec la garantie, il se soigne une saison, qui ne le guérit pas. Le choix change le moment, jamais la cause. Jamais sur un front, jamais par une arme, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Maroc reste engagé, le banc repris par son adjointe des étapes du sud.
- *Dilemme :* Accepter une livraison exclusive ou ouvrir le dépôt à plusieurs équipes.

**Awa Diagne** — Sénégal. Commandante du Sénégal, capitaine des équipes de l’estuaire. *Motivation :* Construire une alliance où les petites équipes sont aidées autant qu’elles aident. *Croyance :* Elle croit aux actes réciproques ; elle ne confond pas pardonner et oublier une promesse rompue.
- Avant l’an 14 (acte 1) : Elle a gagné son commandement en organisant une relève entre deux clubs qui refusaient jusque-là de partager leurs entraînements.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : maintenir une aide à une délégation défaillante ou exiger sa contribution. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la route de l’estuaire (acte 1) : Elle reçoit le joueur à sa table avant de l’affronter sur la route de l’estuaire, et fait avancer ses équipes groupées entre les bras d’eau. Elle croit qu’une promesse faite à un partenaire engage toute la coalition.
- An 14, le quai sans relève (acte 2) : Quand la relève promise à son équipe de nuit reste bloquée par un contrat de transport contesté, elle tient le quai sans elle et admet devant le joueur qu’elle a signé pour un partenaire qui n’avait rien promis en retour.
- *Dilemme :* Maintenir une aide à une délégation défaillante ou exiger sa contribution.

**Lívia Moura** — Brésil. Commandante du Brésil, organisatrice des fronts du fleuve. *Motivation :* Faire revenir aux ateliers locaux une part de ce qu’ils ont aidé à gagner. *Croyance :* Elle croit qu’une victoire n’a de sens que si ceux qui réparent peuvent continuer à travailler.
- Avant l’an 14 (acte 1) : Elle a sauvé une offensive mal préparée sur le fleuve en faisant tourner les équipements entre les clubs.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : protéger une retransmission populaire ou révéler un contrat de distribution inégal. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, les pistes jumelles (acte 1) : Elle fait entrer ses équipes sur les pistes jumelles avec les tambours derrière elle et prend le pont du milieu parce que le public l’attend là. Elle croit que le bruit du public dit ce que veut son équipe.
- An 14, le prêteur et l’équipe (acte 2) : Quand un sponsor prétend parler au nom de toute la délégation, elle le contredit devant le public. Trois carnets concordants lui montrent ensuite que la retransmission qu’elle défend paie un contrat de distribution que ses ateliers ne voient jamais.
- *Dilemme :* Protéger une retransmission populaire ou révéler un contrat de distribution inégal.

**Inés Valdés** — Mexique. Commandante du Mexique, responsable des fronts de plateau. *Motivation :* Obtenir que ceux qui tiennent le terrain aient leur mot à dire après la victoire. *Croyance :* Elle croit aux solutions trouvées sur place ; elle se méfie parfois trop vite des conseils venus d’ailleurs.
- Avant l’an 14 (acte 1) : Elle a perdu une bataille décisive après avoir pris un poste prestigieux en laissant sans couverture les deux passages qui l’alimentaient.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : rendre un poste contesté à l’arbitrage ou exploiter immédiatement ses revenus. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la route du plateau (acte 1) : Elle entre sur le plateau en musique, annonce sa prise à l’avance et la réussit sur la ville d’aiguillage. Elle croit qu’une prise assez spectaculaire fera oublier les deux passages qu’elle laisse encore sans couverture.
- An 14, le ciel du plateau (acte 2) : Sans intercepteurs, elle voit un adversaire aérien tourner au-dessus de sa ligne et paie chaque prise d’un flanc. Elle concède au joueur que le public applaudit la prise et ne voit jamais le poste perdu derrière, puis compare avec lui trois permis d’accès qui ne disent pas la même chose.
- *Dilemme :* Rendre un poste contesté à l’arbitrage ou exploiter immédiatement ses revenus.

**Devika Rao** — Inde. Commandante de l’Inde, coordinatrice des ateliers d’interconnexion. *Motivation :* Garder des ateliers capables de produire même si un grand fournisseur coupe ses livraisons. *Croyance :* Elle croit qu’il faut toujours une autre solution ; elle peut disperser ses moyens à trop en préparer.
- Avant l’an 14 (acte 1) : Elle a regroupé plusieurs petits ateliers dans une réserve commune après qu’un fournisseur eut modifié ses délais en pleine offensive.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : produire vite pour la bataille en cours ou préserver des pièces pour un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la première interconnexion (acte 1) : Elle ouvre son parcours en faisant sortir deux unités par journée de ses ateliers dispersés et couvre les carrefours d’un réseau dense en commentant elle-même chaque coup. Elle croit qu’assez de voies de production rendent tout choix inutile.
- An 14, les trois protocoles (acte 2) : Les relevés de trois protocoles montrent que plusieurs offres qu’elle avait mises en concurrence servaient le même bénéficiaire. Elle concède qu’avoir multiplié les fournisseurs n’a rien préservé, et pose au joueur, pour la première fois, la question de garder des pièces pour un partenaire plutôt que de produire.
- *Dilemme :* Produire vite pour la bataille en cours ou préserver des pièces pour un partenaire.

**Ren Mizuno** — Japon. Commandant du Japon, planificateur des correspondances. *Motivation :* Partager les plans utiles sans laisser un seul groupe décider qui peut les utiliser. *Croyance :* Il croit au travail précis et partagé ; il doit accepter qu’un allié puisse faire autrement.
- Avant l’an 14 (acte 1) : Il a construit ses premières tactiques sur les horaires de transfert des équipes, puis perdu une bataille quand une liaison imprévue a rompu son plan.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : partager une interface de contrôle ou garder la priorité sur son réseau. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le premier détroit (acte 1) : Il accueille le joueur avec un bento et un horaire de correspondances où chaque unité a son créneau de gare. Il croit qu’une séquence sans retard tient même sous une surveillance aérienne, et perd au premier détroit une journée à attendre une liaison qui ne vient pas.
- An 14, les trois miroirs (acte 2) : Face à un adversaire sans visage dont les drones brouillables cachent la doctrine, il réagit trop tard. Les trois relais lui montrent ensuite que les contrats méridiens sont synchronisés sur ses propres horaires, et il concède qu’un réseau ouvert à plusieurs opérateurs vaut mieux qu’une séquence parfaite tenue par lui seul.
- *Dilemme :* Partager une interface de contrôle ou garder la priorité sur son réseau.

**Hazel Quinn** — Australie. Commandante de l’Australie, responsable des réserves côtières. *Motivation :* Ne laisser aucun poste lointain attendre un ravitaillement qui ne viendra pas. *Croyance :* Elle croit qu’on doit pouvoir tenir seul ; elle apprend à compter sur des alliés aussi éloignés qu’elle.
- Avant l’an 14 (acte 1) : Elle a refusé d’engager toutes ses batteries dans une seule bataille et assuré ainsi les étapes suivantes lorsque le fournisseur commun a retardé ses livraisons.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : abandonner un dépôt secondaire ou demander à ses partenaires de l’aider à le tenir. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la route longue (acte 1) : Sur la route longue, sous la canicule, elle laisse le joueur venir à elle et fait de chaque ravitaillement une décision visible entre des ateliers très éloignés. Elle croit que la distance suffit à protéger un dépôt qu’on ne peut pas tenir.
- An 14, les trois délais (acte 2) : Les reçus de trois relais montrent qu’un même prêteur a retardé plusieurs délégations, la sienne comprise. Elle concède que son calme a repoussé d’une saison un retrait qu’elle savait nécessaire, et pose au joueur la question qu’elle évitait : rendre le dépôt secondaire, ou demander aux partenaires de le tenir.
- *Dilemme :* Abandonner un dépôt secondaire ou demander à ses partenaires de l’aider à le tenir.

**Ayu Pranata** — Indonésie. Commandante de l’Indonésie, déléguée d’un groupement de clubs des îles. *Motivation :* Faire entendre les petites îles lorsque les grandes puissances décident où vont les réserves. *Croyance :* Elle croit qu’une alliance doit écouter ceux qui ont le moins de moyens, pas seulement ceux qui parlent fort.
- Avant l’an 14 (acte 1) : Elle est devenue commandante après avoir proposé un tour de parole qui a permis à plusieurs clubs de préparer un calendrier commun de traversées.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : décider seule d’une traversée urgente ou accepter le coût d’une consultation. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, l’île d’entrée (acte 1) : Elle explique son plan de traversée au joueur avec un jeu d’ombres, île par île, et refuse de lancer la première capture tant que chaque club du collectif n’a pas pris la parole. Elle croit qu’un accord complet finit toujours par arriver avant la pluie.
- An 14, le contrat de trop (acte 2) : Lorsqu’un partenaire du collectif révèle avoir laissé à Méridien le droit de parler à sa place dans les décisions de distribution, elle concède que son tour de parole n’a pas vu passer cette signature. Elle tient le quai fermé le temps d’honorer la livraison promise, malgré le coût de cette révélation.
- *Dilemme :* Décider seule d’une traversée urgente ou accepter le coût d’une consultation.

**Leandro Paz** — Argentine. Commandant de l’Argentine, ancien chef de piste. *Motivation :* Garder une seconde route ouverte quand un ennemi bloque la première. *Croyance :* Il croit qu’on reste libre tant qu’on peut changer de chemin.
- Avant l’an 14 (acte 1) : Il a tracé des itinéraires alternatifs pour des convois sur de grandes plaines avant de gagner sa place au poste de commandement.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir un corridor commun ou concentrer les moyens sur sa propre offensive. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la route à péage (acte 1) : Sur la plaine argentine, un dépôt sous licence exclusive est posé sur l’unique route entre les deux bancs. Il reçoit le joueur pour lui montrer qu’on gagne par les chemins de traverse, et qu’un dépôt posé sur la seule route est un péage.
- An 14, le canal de l’estuaire (acte 2) : Un club de l’estuaire privé d’accès aux batteries attend un transport par les bras d’eau. Ouvrir le canal, qui ne se refermera plus, ou contourner par la plaine : sa réponse décide d’une trace sur la carte, et il nommera ensuite un péage un péage devant le contrat de priorité de Basile Kelm.
- *Dilemme :* Ouvrir un corridor commun ou concentrer les moyens sur sa propre offensive.

**Noémie Leduc** — Canada. Commandante du Canada, technicienne des essais saisonniers. *Motivation :* Permettre aux nouvelles équipes de préparer leurs machines aussi bien que les plus riches. *Croyance :* Elle croit qu’un essai honnête doit pouvoir être refait par quelqu’un d’autre.
- Avant l’an 14 (acte 1) : Elle a interrompu un essai pourtant gagnant parce que les équipements d’une équipe invitée n’avaient pas été préparés aux mêmes conditions.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : publier des relevés incomplets ou retarder une bataille aux dépens d’un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le grand gel (acte 1) : Face à la Sélection Méridienne et à sa pièce à badge orange, elle exige qu’un essai se joue sous les mêmes conditions pour les deux camps et confie au joueur le banc de l’équipe témoin.
- An 14, la tempête annoncée (acte 2) : Une tempête annoncée deux journées à l’avance par le Bulletin bloque une délégation adverse. Partager les provisions ou garder la réserve : ce qu’elle relève pendant cette bataille contredira la « priorité » de Basile Kelm aux finales.
- *Dilemme :* Publier des relevés incomplets ou retarder une bataille aux dépens d’un partenaire.

**Jone Vakalau** — Fidji. Commandant des Fidji, jeune capitaine des entraînements de lagon. *Motivation :* Donner aux petites équipes une vraie chance de tenir face aux grands budgets. *Croyance :* Il croit que connaître ses partenaires compte autant que posséder le meilleur matériel.
- Avant l’an 14 (acte 1) : Plus jeune capitaine de sa délégation, il s’est fait connaître en changeant un parcours de relais pour accueillir une équipe privée de son transport.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : tenter un raccourci pour un allié ou garantir le retour de tous les équipements. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le lagon sans transport (acte 1) : Le transport d’un club est retenu pour une facture ; il prête le sien au joueur pour ramener l’équipement, contre Yuna Serrat et une délégation sous contrat, et garde une petite équipe dans la guerre.
- An 14, la chaîne des passages (acte 2) : Avec les drones de Relais Zéro sur le récif, il doit tenter le raccourci par les passages entre les récifs ou garantir le retour de tout l’équipement ; c’est là que son improvisation apprend à laisser un plan de secours à ceux qui le suivent.
- *Dilemme :* Tenter un raccourci pour un allié ou garantir le retour de tous les équipements.

**Nikos Delis** — Grèce. Commandant de la Grèce, vétéran des relais côtiers. *Motivation :* Transmettre ce qu’il sait à ceux qui devront continuer sans lui. *Croyance :* Il croit qu’un bon chef prépare quelqu’un à prendre sa place.
- Avant l’an 14 (acte 1) : Il a quitté un commandement prestigieux pour reformer une équipe dont les moyens avaient été dispersés après une saison sans victoire.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : confier un passage à une recrue ou reprendre lui-même toute la préparation. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le café du port (acte 1) : Il reçoit le joueur au café du port avant l’engagement et lui montre, jetée après jetée, qu’une méthode vaut mieux qu’un nouvel outil.
- An 14, la recrue sur la jetée (acte 2) : Basile Kelm verrouille la réserve du port. Pour la première fois, il demande son avis au joueur — confier le passage des îles à la recrue, ou reprendre lui-même toute la préparation — et parle de « quand il ne sera plus sur le front ».
- An 14, après la finale 2 ou la finale 7 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_hs_gr_3`, le moment dépend de `opus1_hs_gr_2_decision`) : le cœur, à son âge, un matin d’hiver — sur la jetée après sa dernière traversée si le joueur lui a dit de garder la main (branche b, défaut si le hors-série n’est pas joué, après la finale 2), au café du port si la recrue tient le passage (branche a, après la finale 7, la méthode transmise). La ligne du bac vers les îles, alimentée par la réserve du port, est suspendue par le contrat de priorité de Basile Kelm : sans bac, quelqu’un prend le bateau. Jamais sur un front, jamais par une arme, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; la Grèce reste engagée, relation inchangée.
- *Dilemme :* Confier un passage à une recrue ou reprendre lui-même toute la préparation.

**Elín Arnardóttir** — Islande. Commandante de l’Islande, observatrice des sites d’essai. *Motivation :* Vérifier les promesses des fournisseurs avant que des équipes en dépendent. *Croyance :* Elle croit davantage à une mesure refaite qu’à une annonce brillante.
- Avant l’an 14 (acte 1) : Elle a comparé les relevés de deux opérateurs et découvert que leurs contrats vendaient la même réserve à deux délégations.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : signaler une anomalie plausible ou attendre une preuve au risque de perdre le contrat. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la nuit islandaise (acte 1) : De nuit, sur la roche noire, elle se bat contre Yuna Serrat, qui gère les deux contrats vendant la même réserve à deux délégations ; elle n’accuse pas encore, elle recoupe.
- An 14, le silence de la source (acte 2) : Après un an passé à comparer les exclusivités, elle choisit entre signaler l’anomalie maintenant et attendre la preuve recoupée. Le double contrat qu’elle tient est ce qu’aucune garantie proposée aux finales ne pourra contourner.
- *Dilemme :* Signaler une anomalie plausible ou attendre une preuve au risque de perdre le contrat.

**Kito Njoroge** — Kenya. Commandant du Kenya, entraîneur des engagements longs. *Motivation :* Éviter qu’un équipement bon marché aujourd’hui devienne impossible à entretenir demain. *Croyance :* Il croit qu’on doit regarder ce qui reste après la première victoire.
- Avant l’an 14 (acte 1) : Il a bâti son équipe autour des remplacements après avoir vu une formation brillante manquer de moyens dans la dernière journée d’un engagement.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : céder une avance pour garder une relève ou soutenir immédiatement un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la bataille de trois heures (acte 1) : Sur les hauts plateaux, il ne gagne jamais avant la dixième journée : il laisse le joueur s’épuiser, et prouve que la durée compte autant que l’avance initiale.
- An 14, le messager (acte 2) : Un relais à pied contre Yuna Serrat le place devant son dilemme : céder l’avance pour garder une relève, ou soutenir immédiatement le partenaire. Sa réponse décide de ce qu’il offre à l’infanterie du joueur.
- *Dilemme :* Céder une avance pour garder une relève ou soutenir immédiatement un partenaire.

**Tiana Ravel** — Madagascar. Commandante de Madagascar, cartographe des pistes. *Motivation :* Partager les observations du terrain avec les équipes qui y risquent leurs véhicules. *Croyance :* Elle croit qu’une découverte utile ne doit pas être cachée à ceux qui en ont besoin.
- Avant l’an 14 (acte 1) : Elle consigne les espèces présentes autour des pistes et a déplacé un parcours pour préserver un site sans priver les clubs de leur entraînement.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir ses cartes à un rival ou protéger le travail de son atelier. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, l’inventaire des pistes (acte 1) : Sous couvert et sous brouillard, elle nomme chaque espèce en pleine bataille et gagne par les pistes rouges qu’elle a relevées elle-même.
- An 14, les cartes ouvertes (acte 2) : Face aux relais de Relais Zéro, elle doit ouvrir ses cartes à un rival ou protéger le travail de son atelier ; ouvertes, ses cartes montrent les couloirs des relais compromis.
- *Dilemme :* Ouvrir ses cartes à un rival ou protéger le travail de son atelier.

**Saran Bat** — Mongolie. Commandante de la Mongolie, capitaine des parcours mobiles. *Motivation :* Pouvoir changer de fournisseur sans perdre son matériel ni abandonner son équipe. *Croyance :* Elle croit qu’une aide qui interdit de partir est déjà un piège.
- Avant l’an 14 (acte 1) : Elle a gagné une offensive en changeant de point de ravitaillement à mi-parcours après avoir annoncé le déplacement à tous ses partenaires.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : poursuivre une ouverture ou revenir couvrir une réserve commune. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le grand galop (acte 1) : Elle ne reçoit que qui a refusé une exclusivité sur le parcours mexicain. Sur la steppe, seule la reconnaissance décide de qui frappe le premier, et elle le sait mieux que quiconque.
- An 14, le point de ravitaillement déplacé (acte 2) : Le point de ravitaillement change à mi-parcours, annoncé à tous, face à Ost et Basile Kelm. Poursuivre l’ouverture ou revenir couvrir la réserve commune : elle apprend à ne pas distancer ce qui rend sa mobilité possible.
- *Dilemme :* Poursuivre une ouverture ou revenir couvrir une réserve commune.

**Amalie Haoses** — Namibie. Commandante de la Namibie, responsable des relevés côtiers. *Motivation :* Rendre aux équipes les informations qu’elles ont collectées ensemble. *Croyance :* Elle croit qu’on ne devrait pas payer deux fois pour son propre travail.
- Avant l’an 14 (acte 1) : Elle a organisé une série de tests où les équipes échangeaient leurs relevés pour distinguer les erreurs de capteurs des changements de visibilité.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : révéler un passage à tous ou protéger la seule fenêtre de son équipe. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, la brume du matin (acte 1) : Sur le seul front totalement découvert de la guerre, la brume côtière tombe chaque matin et aveugle l’adversaire ; elle affronte le joueur avec ses drones, et lui laisse comprendre ce que la brume efface.
- An 14, le passage révélé (acte 2) : Avant la bataille, contre trois camps aux fronts séparés, elle doit révéler le passage à tous ou protéger la seule fenêtre de son équipe ; ses observateurs relèvent les couloirs du réseau muet.
- *Dilemme :* Révéler un passage à tous ou protéger la seule fenêtre de son équipe.

**Mira Karki** — Népal. Commandante du Népal, coordinatrice des ateliers d’altitude. *Motivation :* Faire livrer les postes isolés avant qu’il ne soit trop tard pour leurs équipes. *Croyance :* Elle croit que personne ne doit disparaître d’une carte parce qu’il vit trop loin.
- Avant l’an 14 (acte 1) : Elle a constitué une réserve commune de petites pièces lorsque les rotations de transport ne permettaient plus d’équiper chaque atelier séparément.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : concentrer les pièces dans un relais fiable ou maintenir plusieurs ateliers ouverts. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, les ateliers d’altitude (acte 1) : Du subtropical au glacier, elle affronte le joueur depuis la montagne ; ses fanions de balisage sont sans signe, et le sommet n’est qu’une étape.
- An 14, le pont de corde (acte 2) : Un atelier isolé attend des pièces que la rotation des transports ne monte plus. Elle a demandé de l’aide tard, et le dit ; poser le pont de corde ou passer par le col, sa dernière réplique est « on aurait pu attendre ».
- An 14, après la finale 7 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_hs_np_3`, fixe) : la montagne et l’épuisement. La rotation des transports vers les sites d’altitude est suspendue par les réserves rendues exclusives par Basile Kelm ; elle monte à pied avec deux porteurs vers l’atelier isolé, la fenêtre météo se referme le soir même, ils redescendent quand elle se rouvre, trop tard pour elle. Les porteurs vont bien, et c’est dit. Le choix du pont de corde change ce que l’atelier a reçu, jamais le moment ni la cause. Jamais sur un front, jamais par une arme, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Népal reste engagé, le banc repris par son adjointe.
- *Dilemme :* Concentrer les pièces dans un relais fiable ou maintenir plusieurs ateliers ouverts.

**Tess Roa** — Nouvelle-Zélande. Commandante de la Nouvelle-Zélande, responsable des remises en service. *Motivation :* Obtenir du temps et des pièces pour réparer, pas seulement de l’argent pour remplacer. *Croyance :* Elle croit qu’une machine sauvée peut encore ramener quelqu’un.
- Avant l’an 14 (acte 1) : Elle a remis un terrain d’entraînement en activité avec plusieurs clubs qui avaient des méthodes incompatibles mais des pièces complémentaires.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : réparer un dépôt utile à tous ou réserver le matériel à la prochaine bataille. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le dépôt rendu (acte 1) : Le dépôt rendu par une rupture de contrat est celui de sa vallée : trois postes désaffectés, dont elle remet en service et tient deux avant le joueur, dans la brume et la fougère.
- An 14, la ligne de fougère (acte 2) : Pendant que son équipe répare, elle prête son banc au joueur contre Ost et Yuna Serrat. Réparer pour tous ou réserver le matériel à la prochaine bataille : sa réponse décide de ce qu’elle offre au génie du joueur.
- *Dilemme :* Réparer un dépôt utile à tous ou réserver le matériel à la prochaine bataille.

**Luz Quispe** — Pérou. Commandante du Pérou, conductrice des chantiers de passage. *Motivation :* Garder les passages ouverts aux petits ateliers aussi bien qu’aux grandes armées. *Croyance :* Elle croit qu’une règle doit protéger les gens, pas réserver la route aux plus riches.
- Avant l’an 14 (acte 1) : Elle a obtenu sa place de commandante en préparant un détour accessible à une équipe dont le matériel ne franchissait pas le tracé prévu.
- An 14, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : consacrer la réserve à un passage commun ou terminer son propre équipement. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- An 14, le passage commun (acte 1) : Côte sèche, altiplano, versant amazonien : le premier génie qui relie ses trois étages gagne le tempo, et c’est elle qui l’apprend au joueur en le battant.
- An 14, la querelle d’altitude (acte 2) : Avec le joueur contre Basile Kelm et Yuna Serrat, elle consacre la réserve au passage commun ou termine son propre équipement ; le passage bâti reste sur la carte, et elle peut rejoindre le banc du joueur comme co-commandante.
- *Dilemme :* Consacrer la réserve à un passage commun ou terminer son propre équipement.

## La Cinquième Manche et les Gris (8)

*Bible auteur : fonction, motivation et liens ne sont jamais sérialisés tels quels vers une interface publique.*

| Prénom | Nom complet | Fonction | Style | Pouvoir | Super pouvoir | Faits |
|---|---|---|---|---|---|---:|
| **Hadran** | Hadran Ost | Commandant des mécanisés de la Sélection Méridienne | Pression mécanisée | **Pression méridienne** (3 barres) — Vos chenilles frappent ×1,2 et gagnent +1 de mouvement ce tour. | **Grêle** (7 barres) — Il choisit une case : tout ce qui est à 2 cases ou moins perd 2 PV, ses chenilles comprises, puis ses chenilles gagnent +1 de mouvement et avancent dans le trou. | 7 |
| **Sélène** | Sélène Veyr | Directrice du Consortium Méridien | La concession | **Clause de stabilité** (3 barres) — Ce tour, tout ce que vous achetez coûte 30 % de moins. | **Délestage** (8 barres) — Pendant 2 journées, tout ce qui a un moteur dans le camp adverse brûle le double de carburant par tour, ses captures comptent moitié, et le Consortium encaisse le double. | 7 |
| **Maël** | Maël Orven | Commandant de mobilité aérienne | Fenêtre de vol | **Plein en vol** (3 barres) — Vos appareils refont le plein et les charges tout de suite, et gagnent +1 de mouvement ce tour. | **Rasante** (6 barres) — Ses appareils passent en rasante : l’unité adverse la plus chère perd 5 PV, où qu’elle soit. | 5 |
| **Lise** | Lise Varen | Commandante de l’artillerie et des passages | Angle réservé | **Angle réservé** (3 barres) — Vos pièces de portée tirent 1 case plus loin jusqu’à votre prochain tour. | **Zone rouge** (7 barres) — Elle choisit une case : les 5 cases de la croix perdent 3 PV, les siennes comprises, et ses pièces de portée tirent 1 case plus loin jusqu'à son prochain tour. | 4 |
| **Edran** | Edran Sorel | Coordinateur des réserves et de la relève | La relève | **Colonne de relève** (3 barres) — Toutes vos unités refont le plein et les charges, et vos transports gagnent +1 de mouvement ce tour. | **La relève arrive** (8 barres) — Toutes ses unités refont le plein et les charges, et ses roues et chenilles qui ont déjà agi rejouent une fois ce tour. | 5 |
| **Yuna** | Yuna Serrat | Commandante des concessions de terrain | Le mandat | **Mandat provisoire** (3 barres) — Vos capteurs capturent ×2 ce tour. | **Mise sous scellés** (7 barres) — Elle choisit une case : dans un rayon de 2, tout ce qui a un moteur — des deux camps — est scellé jusqu'à la fin de son prochain tour, ni bouger ni riposter, et ses capteurs capturent ×2 ce tour. | 3 |
| **Basile** | Basile Kelm | Commandant des dépôts et de la surveillance | Le bastion | **Veille du bastion** (3 barres) — Vos unités sur un bâtiment se défendent ×1,3, et toutes voient 1 case plus loin, jusqu’à votre prochain tour. | **Réserves fermées** (7 barres) — Toutes les unités adverses perdent 1 PV, et pendant une journée elles voient 2 cases de moins : les réserves sont fermées, ce qui est dehors y reste. | 3 |
| **Relais** | Relais Zéro | Commandement distant sous indicatif | Information asymétrique | **Signal brouillé** (3 barres) — Les unités adverses voient 2 cases de moins, et vos drones 2 de plus, jusqu’à votre prochain tour. | **Retour à zéro** (9 barres) — Il choisit une case : dans un rayon de 2, tout ce qui a un moteur — des deux camps — s’arrête jusqu'à la fin de son prochain tour, et les avions et drones adverses touchés tombent. | 3 |

**Hadran Ost** — *Motivation :* Redevenir celui que tout le monde appelle quand la bataille tourne mal. *Croyance :* Il croit que ses victoires lui donnent raison, même sur les décisions qui ont coûté cher aux autres.
- An 12 (acte 1) : Il enchaîne les victoires et reçoit les jeunes équipes avec chaleur.
- An 13 (acte 2) : Il contourne sciemment le contrôle des armes et est disqualifié. La sanction n’était pas un complot.
- Entre l’an 13 et l’an 14 (acte 2) : Le Consortium lui confie les Gris, équipe d’essai sans nation propre.
- An 14 (acte 3) : Il participe à l’accaparement des concessions, sans mesurer que ses propres équipes seront dépendantes. Un témoignage ne le dispense pas de répondre de ses actes.
- Avant l’an 14 (acte 1) : An 12 : champion accueillant. An 13 : disqualification justifiée après contournement du contrôle des armes. Entre l’an 13 et l’an 14 : le Consortium lui confie la Sélection Méridienne.
- An 14 · progression du conflit (acte 3, auteur) : Témoignage possible si les preuves et les équipes sont protégées ; responsabilité maintenue, jamais pardon automatique.
- Point de vue auteur (acte 3, auteur) : Retrouver le pouvoir perdu sans admettre sa responsabilité. Aider ses équipes à témoigner ou protéger sa réputation.

**Sélène Veyr** — *Motivation :* Contrôler seule l’énergie et Aube, pour que personne ne puisse plus agir sans elle. *Croyance :* Elle croit qu’une seule autorité peut arrêter le chaos ; elle appelle protection ce que les autres vivent comme une dépendance.
- An 11 (acte 1) : Elle rejoint la coordination des réserves ; son travail facilite réellement les déplacements.
- An 12 (acte 2) : Elle rédige les contrats qui relient exploitation solaire, stockage et distribution.
- An 14 (acte 3) : Elle dirige la Cinquième Manche. Trois signatures indépendantes relient ses sociétés aux mêmes concessions ; son identité ne change jamais entre deux parties.
- An 14, programme Aube (acte 3) : Elle cherche une prise en main définitive sur la coopération de fusion, ses accès et ses futurs droits. Aube est expérimental : aucune énergie illimitée n’est disponible à gagner.
- Avant l’an 14 (acte 3) : An 11 : coordination utile des réserves. An 12 : contrats liant solaire, stockage et distribution. An 14 : direction fixe de la Cinquième Manche, tentative de prise en main définitive d’Aube.
- An 14 · progression du conflit (acte 3, auteur) : Ne se repent pas ; renonce ou perd ses concessions selon le dossier et les objectifs remportés.
- Point de vue auteur (acte 3, auteur) : Imposer seule les conditions du réseau, en présentant la dépendance comme la stabilité. Accepter un accès partagé ou perdre le contrôle exclusif auquel elle tient.

**Maël Orven** — *Motivation :* Choisir ses missions et ne plus attendre que quelqu’un décide à sa place. *Croyance :* Il croit être libre parce qu’il choisit ses batailles ; il voit mal le prix du matériel qui les rend possibles.
- Avant l’an 14 (acte 1) : Avant l’an 14 : pilote de reconnaissance indépendant, il doit abandonner son programme faute d’accès aux batteries. An 14 : accepte les moyens méridiens et transforme cette dépendance en loyauté choisie.
- An 14 · progression du conflit (acte 3, auteur) : Accepte la relève paternelle au pivot ; après la défaite imposée au joueur, peut négocier un désengagement si sa sœur et ses équipes ont été traitées équitablement.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Fils d’Edran : révélation publique au final10. Frère de Lise Varen : information auteur, jamais exposée dans cet opus par défaut.
- Saison 5 · épisode 4 · finale 10 (acte 3, jalon) : Edran Sorel est le père de Maël Orven. Il rejoint son fils avec ses réserves ; la coalition doit perdre cette confrontation et se replier. Ce lien ne révèle aucune autre parenté.
- Point de vue auteur (acte 3, auteur) : Ne plus dépendre de décisions prises loin du terrain. Refuser la mainmise de son père ou accepter ses réserves pour gagner.

**Lise Varen** — *Motivation :* Protéger ses techniciens sans devoir se taire quand leurs chefs les mettent en danger. *Croyance :* Elle croit aux garanties concrètes ; elle ne quitte pas un camp sur une simple promesse.
- Avant l’an 14 (acte 1) : Ancienne ingénieure des champs de tir, Lise conçoit des zones de sécurité pour les pièces d’artillerie lourdes. Elle rejoint les Gris avec une clause protégeant ses techniciens, puis découvre que leur approvisionnement dépend d’un fournisseur unique.
- An 14 · progression du conflit (acte 3, auteur) : Peut rompre avec le Consortium ; si on refuse une issue vérifiable à ses techniciens, elle reste adverse. Elle ne change pas de camp sur un simple compliment.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Sœur de Maël et fille d’Edran, informations strictement auteur non révélées dans cet opus. Les scènes publiques traitent Maël comme un collègue.
- Point de vue auteur (acte 3, auteur) : Protéger son équipe sans accepter que cette protection achète son silence. Transmettre des plans de tir utiles au retrait ou maintenir son engagement auprès des Gris.

**Edran Sorel** — *Motivation :* Garder des réserves pour les équipes que les chefs oublient lorsqu’elles sont épuisées. *Croyance :* Il croit pouvoir se servir du Consortium sans devenir son serviteur.
- Avant l’an 14 (acte 1) : Ancien responsable d’une coopérative de maintenance, Edran travaille sous son nom professionnel Sorel. Il apparaît comme prestataire de réserve et sait maintenir une deuxième ligne quand un front a épuisé ses stocks.
- An 14 · progression du conflit (acte 3, auteur) : Rejoint Maël au final10 dans toutes les branches. Peut ensuite contribuer à restituer les réserves ; aucune aide tardive n’efface la responsabilité du repli imposé.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Père de Maël et Lise en coulisses. Seul le lien père-fils est dit avant sa relève au final10/S5E4. Le lien avec Lise reste caché ; aucune parenté avec le joueur.
- Saison 5 · épisode 4 · finale 10 (acte 3, jalon) : Edran Sorel est le père de Maël Orven. Il rejoint son fils avec ses réserves ; la coalition doit perdre cette confrontation et se replier. Ce lien ne révèle aucune autre parenté.
- Point de vue auteur (acte 3, auteur) : Sauver son fils d’une nouvelle défaite, quitte à renforcer le réseau qu’il prétend seulement utiliser. Aider son fils ou refuser le détournement des réserves communes.

**Yuna Serrat** — *Motivation :* Être celle qui décide de l’accord, plutôt que celle qui répare ses conséquences. *Croyance :* Elle croit qu’il vaut mieux tenir la dette des autres que dépendre de leur gratitude.
- Avant l’an 14 (acte 1) : An 12 : assure la médiation entre équipes privées d’accès à une piste. An 13 : reçoit un droit limité de gérer des concessions. An 14 : étend ces délégations provisoires au bénéfice du Consortium, tout en se disant intermédiaire neutre.
- An 14 · progression du conflit (acte 3, auteur) : Peut témoigner contre les contrats si les délégations ont conservé un pouvoir de contrôle ; sinon reste gestionnaire adverse.
- Point de vue auteur (acte 3, auteur) : Ne plus être la personne que l’on consulte seulement après la signature. Rendre les contrats provisoires ou prétendre qu’ils autorisent tout.

**Basile Kelm** — *Motivation :* Éviter les pannes et les interruptions, même en laissant les moins puissants attendre. *Croyance :* Il croit qu’un système qui continue de tourner est forcément un système qui fonctionne.
- Avant l’an 14 (acte 1) : An 11 : organise la sécurité d’installations d’énergie après une panne sans victimes. An 13 : crée des réserves redondantes. An 14 : accepte leur contrôle exclusif au nom de la continuité et finit par exclure les équipes qui en ont besoin.
- An 14 · progression du conflit (acte 3, auteur) : Reste loyal au dispositif de Sélène ; une reddition réglementaire est possible, une conversion soudaine ne l’est pas.
- Point de vue auteur (acte 3, auteur) : Éviter toute interruption, même au prix d’un système injuste. Faire fonctionner un réseau partagé imparfait ou conserver une réserve inaccessible.

**Relais Zéro** — *Motivation :* But observable : voir les mouvements adverses avant d’être repéré. Son identité et ses raisons personnelles restent inconnues. *Croyance :* Aucune croyance personnelle vérifiée. Ses ordres protègent d’abord ses moyens d’observation.
- Avant l’an 14 (acte 2) : Avant l’an 14 : aucune biographie civile vérifiée. An 14 : un même indicatif, revenant d’un front à l’autre, signe des ordres dont les effets et la responsabilité sont consignés. Les archives attestent une continuité de commandement, sans révéler d’identité civile.
- An 14 · progression du conflit (acte 3, auteur) : Identité civile toujours inconnue à la fin de l’opus1. Le relais local est neutralisé et ses contrats annulés ; cela ne transforme pas une victoire en faux dénouement.
- Point de vue auteur (acte 3, auteur) : Motivation personnelle inconnue ; objectif observable : maintenir l’avantage informationnel de la Cinquième Manche. Couper un relais et perdre ses observations ou maintenir une liaison susceptible de laisser des traces.

## Atlas (2)


| Prénom | Nom complet | Fonction | Style | Pouvoir | Super pouvoir | Faits |
|---|---|---|---|---|---|---:|
| **Solveig** | Solveig Tamm | Intendante des transports | L’escorte | **Escorte rapprochée** (3 barres) — Vos transports se défendent ×1,4 et toutes vos unités ×1,15, jusqu’à votre prochain tour. | **Personne ne reste** (6 barres) — Toutes vos unités gagnent +2 de mouvement et se défendent ×1,2 ce tour. | 2 |
| **Wren** | Wren Osoko | Responsable du contrôle des armes | Les archives | **Relevés ouverts** (3 barres) — Vos unités voient 2 cases plus loin et ont +5 % de chance dans chaque duel, jusqu’à votre prochain tour. | **Carte complète** (6 barres) — Jusqu’à votre prochain tour, vos unités ont +15 % de chance dans chaque duel et voient 3 cases plus loin. | 2 |

**Solveig Tamm** — *Motivation :* Faire rentrer les équipes et livrer les réserves qu’elles attendent. *Croyance :* Elle croit aux horaires et aux préparatifs ; elle supporte mal les héros qui improvisent avec les moyens des autres.
- An 12 (acte 1) : Elle commence un registre des convois et des pièces prêtées.
- An 14 (acte 2) : Elle observe que des concessions apparemment concurrentes utilisent les mêmes réserves et les mêmes camions.

**Wren Osoko** — *Motivation :* Donner aux équipes des machines qu’elles comprennent et peuvent réparer elles-mêmes. *Croyance :* Elle croit qu’on peut partager un outil sans livrer le pouvoir à son fabricant.
- Avant l’an 14 (acte 1) : Elle valide un système de mesure à distance du réseau.
- An 14 (acte 2) : Elle découvre que ses droits d’accès ont changé et documente ce transfert sans inventer une panne ou un accident.

## Les civils (3)

**Nera Aldouin** — Arbitre en chef. *Motivation :* Faire appliquer les mêmes règles aux puissants et aux petites équipes. *Croyance :* Elle croit qu’une preuve peut arrêter un abus ; elle doit apprendre à agir quand personne ne veut la lire.
- An 11 (acte 1) : Elle entre au Collège des arbitres et constitue des archives des concessions.
- An 13 (acte 2) : Elle valide un contrat parfaitement légal qui concentre les réserves chez un intermédiaire unique.
- An 14 (acte 2) : Elle recoupe les signatures plutôt que les rumeurs pour contester les clauses de dépendance.

**Osmin Talvarec** — Coordinateur d’Atlas, ancien géomètre. *Motivation :* Empêcher que les nations abandonnent les dernières règles communes. *Croyance :* Il croit qu’un compromis évite le pire ; il tarde parfois à reconnaître celui qui ne veut aucun compromis.
- Avant l’an 11 (acte 1) : Il cartographie les interconnexions ; il n’a jamais été commandant.
- An 12 (acte 2) : Il délègue au Consortium la gestion de plusieurs voies logistiques pour tenir le calendrier.
- An 14 (acte 3) : Il connaît une partie des anomalies mais n’est pas le chef de la Cinquième Manche. Transmettre les cartes complètes engage sa responsabilité.

**Célestin Vantour** — Correspondant de guerre et mémoire du front. *Motivation :* Raconter ce qui se passe vraiment, même quand cela contredit le héros qu’il a présenté au public. *Croyance :* Il croit qu’une histoire peut réunir les gens ; il redoute de découvrir qu’il en a raconté une fausse.
- An 12 (acte 1) : Il transforme la série de victoires d’Ost en légende.
- An 13 (acte 2) : Il minimise sa disqualification sans avoir étudié toutes les pièces.
- An 14 (acte 3) : Il peut publier une preuve qui contredit ses propres commentaires ; il demeure témoin, pas expert de la fusion.

## Les adjointes (4)

*Sans pouvoir de commandant : elles reprennent le banc de leur délégation et en jouent les couleurs et le catalogue (`doc/refonte/opus1-hors-serie.md` §3, `src/app/campagne/disparitions.ts`).*

**Dafni Rallis** — Grèce. Recrue de la délégation grecque, pilote du passage des îles. *Motivation :* Tenir le passage des îles aussi sûrement que celui qui le lui a appris. *Croyance :* Elle croit qu’une méthode se prouve en la refaisant ; elle doute encore d’avoir le droit de la changer. *Liée à :* Nikos Delis.
- Avant l’an 14 (acte 1) : Elle entre à la délégation grecque pour les passages entre les îlots, et apprend auprès de Nikos Delis à tenir une jetée sans attendre un nouvel outil.
- An 14, la recrue sur la jetée (acte 2) : Nikos Delis lui fait refaire le passage des îles jusqu’à n’avoir plus rien à corriger ; c’est d’elle qu’il parle quand il demande au joueur si la recrue peut tenir le passage.

**Anju Basnet** — Népal. Adjointe de la délégation népalaise, coordinatrice de l’atelier isolé. *Motivation :* Que l’atelier du haut garde sa réserve et sa voix, même quand les transports ne montent plus. *Croyance :* Elle croit qu’un site isolé se défend en restant relié, relais après relais ; elle compte mal ce que coûte la marche à ceux qui la font. *Liée à :* Mira Karki.
- Avant l’an 14 (acte 1) : Elle tient l’atelier d’altitude le plus isolé de la délégation népalaise et le relie à la vallée par trois relais tenus à pied.
- An 14, le pont de corde (acte 2) : Quand la rotation des transports ne monte plus, c’est elle qui compte les pièces qui manquent à l’atelier du haut et qui en donne la liste à Mira Karki.

**Léa Wagener** — Luxembourg. Adjointe aux convois de la délégation luxembourgeoise. *Motivation :* Qu’aucun convoi ne parte sur une liste incomplète. *Croyance :* Elle croit qu’une liste exacte protège mieux qu’une promesse ; elle hésite encore à en faire elle-même. *Liée à :* Tomas Reiner, Solveig Tamm.
- An 13 (acte 1) : Elle tient pour Tomas Reiner les listes des convois de la délégation, dans un carnet à couverture d’acier, et vérifie chaque départ avant qu’il le signe.
- An 14, le pacte des relais (acte 2) : Elle inscrit les promesses faites en route et garde, à côté de chacune, une colonne pour noter plus tard comment elle a été tenue.

**Nadia Berrada** — Maroc. Adjointe de la délégation marocaine, coordinatrice des étapes du sud. *Motivation :* Que la caravane parte à l’heure, avec une liste vérifiée deux fois. *Croyance :* Elle croit qu’une étape se prépare la veille ; elle supporte mal qu’on garde une réserve sans dire pour quoi. *Liée à :* Samir El Hadi.
- Avant l’an 14 (acte 1) : Elle coordonne les étapes du sud de la délégation marocaine et tient les listes de chargement que Samir El Hadi relit deux fois.
- An 14, trois stations au soleil (acte 2) : Aux trois stations du parc solaire, elle recoupe les reçus des convois avec ceux de Samir El Hadi et retrouve, ligne pour ligne, la même clause de retour.

## Ce que le code constate comme manque

Aucun : chaque commandant national a une capacité, au moins trois faits et une mission d'entrée.

