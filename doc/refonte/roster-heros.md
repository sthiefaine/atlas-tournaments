# Le roster des héros — nations, Atlas, civils, faction

Généré par `node scripts/roster-heros.mjs` depuis `content/personnages.json` (révision 4) et `content/commandants-capacites.json`. **Document auteur** : il liste aussi la faction, dont la fonction et les liens ne sont jamais publics. Ne pas éditer à la main.

Personnages : **37** — 24 commandants nationaux (12 au premier plan), 8 de la faction, 2 d'Atlas, 3 civils.

## Les 24 commandants nationaux

| Nation | Prénom | Nom complet | Plan | Archétype (fiche pays) | Style | Passif | Pouvoir | Super pouvoir | Faits | Mission d'entrée |
|---|---|---|---|---|---|---|---|---|---:|---|
| France | **Ariane** | Ariane Belloc | premier plan | prodige | La course par étapes | Attaque ×1,05 pour vos unités. | **L’échappée** (3 barres) — Ce tour, toutes vos unités au sol gagnent +1 de mouvement : l’échappée part, et tout le monde y est. | **L’atelier roulant** (7 barres) — Toutes vos unités récupèrent 3 PV, repartent le plein fait et les charges au complet, et frappent ×1,15 ce tour. | 3 | `aube_batteries_2v1` |
| Luxembourg | **Tomas** | Tomas Reiner | premier plan | diplomate | Le carrefour | Défense ×1,1 pour vos unités sur un bâtiment. | **Marché du matin** (3 barres) — Vos revenus de la prochaine journée sont ×1,5. | **Toutes les routes** (6 barres) — Toutes vos unités refont le plein et les charges, et gagnent +1 de mouvement ce tour. | 4 | `aube_batteries_2v1` |
| Suisse | **Elsbeth** | Elsbeth Vonlanthen | premier plan | gardienne | L’horloge des cols | Défense ×1,1 pour vos unités sur montagne et forêt. | **Cols fermés** (3 barres) — Vos unités sur montagne et forêt se défendent ×1,4, et les captures adverses avancent deux fois moins vite jusqu’à votre prochain tour. | **Le téléphérique** (7 barres) — Jusqu’à 3 cases de montagne contiguës deviennent une route pendant 2 journées, et vos unités gagnent +1 de mouvement ce tour. | 4 | `opus1_ch_01` |
| Pays-Bas | **Lotte** | Lotte Vermeer | premier plan | ingenieur | La maîtrise de l’eau | Défense ×1,15 pour vos génies. | **Polder** (3 barres) — Jusqu’à 3 cases de mer contiguës deviennent de la plaine pendant 2 journées. | **La digue cède** (6 barres) — Jusqu’à 4 cases de plaine ou de plage contiguës deviennent une rivière pendant 2 journées, et vos unités se défendent ×1,2 jusqu’à votre prochain tour. | 4 | `opus1_nl_01` |
| Maroc | **Samir** | Samir El Hadi | premier plan | veteran | La caravane | Vos unités consomment 20 % de carburant en moins. | **Halte du thé** (3 barres) — Toutes vos unités refont le plein et les charges, tout de suite. | **Le grand souk** (6 barres) — Toutes vos unités récupèrent 2 PV, et frappent ×1,15 et se défendent ×1,15 pendant une journée. | 4 | `opus1_ma_01` |
| Sénégal | **Awa** | Awa Diagne | premier plan | fonceuse | On avance ensemble | Attaque ×1,08 pour vos infanteries et mécas. | **Teranga** (3 barres) — Toutes vos unités gagnent +1 de mouvement ce tour, et vos troupes à pied frappent ×1,15. | **Tout le delta** (7 barres) — Toutes vos unités à pied qui ont déjà agi rejouent une fois ce tour. | 4 | `opus1_sn_01` |
| Brésil | **Lívia** | Lívia Moura | premier plan | showman | Le stade fait du bruit | Attaque ×1,05 pour vos unités. | **Batucada** (2 barres) — Vos unités ont +10 % de chance dans chaque duel et frappent ×1,1 ce tour. | **Carnaval** (7 barres) — Vos unités frappent ×1,4 avec +15 % de chance ce tour, mais se défendent à 85 % : quand on danse, on ne se couvre pas. | 4 | `opus1_br_01` |
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
| Pérou | **Luz** | Luz Quispe | second plan | ingenieur | Bâtisseuse | Défense ×1,2 pour vos génies. | **Route neuve** (3 barres) — Vos unités gagnent +2 de mouvement sur route et pont ce tour, et vos génies se défendent ×1,2. | **Le pont** (7 barres) — Jusqu’à 3 cases de mer ou de rivière contiguës deviennent un pont, pour le reste du match. | 4 | `opus1_hs_pe_1` |

### Lore en trois lignes, par commandant

**Ariane Belloc** — France. Commandante française et mentore. *Motivation :* Former un commandant capable de refuser une victoire trop coûteuse. *Croyance :* Elle croit devoir rester irréprochable pour être écoutée.
- Ronde XII (acte 1) : Ancienne responsable de maintenance, elle devient commandante pour défendre les équipes dont les contrats se jouent sur le terrain.
- Ronde XII, après la finale (acte 2) : Elle signe une concession avantageuse sans voir la dépendance au transport méridien. Elle en révèle elle-même les clauses au joueur.
- Ronde XIV (acte 1) : Elle enseigne le combat, la capture et la production avant de présenter les enjeux énergétiques des Jeux.
- *Dilemme :* Remporter un contrat vite ou préserver les réserves communes.

**Tomas Reiner** — Luxembourg. Commandant luxembourgeois et organisateur de convois. *Motivation :* Tenir les promesses dont dépendent les autres équipes. *Croyance :* Un accord précis protège mieux qu’une déclaration d’amitié.
- Ronde XIII (acte 1) : Il partage ses transports pour maintenir une délégation dans les Jeux. Son aide est omise du classement.
- Ronde XIV (acte 1) : Il rencontre le joueur lors des entraînements. Une coopération logistique peut préparer une relève future.
- Ronde XIV, crise des réserves (acte 3) : Il organise une relève par un itinéraire annoncé ; les engagements antérieurs déterminent les moyens disponibles.
- Ronde XIV, après la finale 11 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_finale_12`, fixe) : la route — sortie de desserte de nuit, chaussée verglacée, un seul véhicule. Depuis le repli de la finale 10, la route principale du bassin est sous autorisation méridienne, par la clause de dépendance sur les dépôts et les routes ; il refuse de la demander à ceux qui viennent de fermer le terrain et prend la desserte. Le choix de la finale 9 change qui voyage avec lui, jamais le moment ni la cause ; les passagers sont indemnes, en toutes lettres. Jamais sur un terrain homologué, jamais par du matériel de tournoi, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Luxembourg reste engagé et `allie_acte_iii` tient, le banc repris par son adjointe aux convois.
- *Dilemme :* Garder des réserves pour la relève ou financer la route immédiate.

**Elsbeth Vonlanthen** — Suisse. Commandante de la délégation suisse, responsable de relais alpins. *Motivation :* Garantir que chaque vallée conserve un accès indépendant aux réserves. *Croyance :* Elle prépare si soigneusement un verrou qu’elle tarde à quitter une position devenue inutile.
- Avant la Ronde XIV (acte 1) : Elle a maintenu un relais de vallée pendant une interruption des livraisons en répartissant les batteries entre trois équipes.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir un col à une délégation rivale ou conserver une réserve locale. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le premier col (acte 1) : Elle accueille le joueur au pied du premier col avec un carnet d’altitude où chaque relais de vallée garde sa réserve propre, et couvre ses pièces de portée dans la montée étroite. Elle croit qu’une vallée bien verrouillée n’a besoin de personne.
- Ronde XIV, le plateau verrouillé (acte 2) : Devant la station radar que Basile Kelm verrouille sans tenir toute la carte, elle reconnaît que son propre verrou lui a coûté une fenêtre de traversée. Elle remet alors au joueur les relevés d’une équipe locale qui paie sa maintenance avec un crédit méridien.
- *Dilemme :* Ouvrir un col à une délégation rivale ou conserver une réserve locale.

**Lotte Vermeer** — Pays-Bas. Commandante de la délégation néerlandaise, ingénieure des ouvrages de passage. *Motivation :* Rendre les infrastructures accessibles sans dépendre du propriétaire de leurs logiciels. *Croyance :* Elle croit qu’un calendrier exact peut remplacer une relation de confiance.
- Avant la Ronde XIV (acte 1) : Elle a rejoint les Jeux après avoir révisé les horaires de franchissement de deux écluses utilisées par des délégations concurrentes.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : publier le plan des ouvrages ou conserver un avantage de passage. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, les carrés du polder (acte 1) : Elle ouvre son parcours avec un horaire de marée affiché à la minute et découpe le polder en compartiments que ses voies surélevées rendent lisibles. Elle croit qu’un calendrier tenu dispense de se parler.
- Ronde XIV, le terrain prêté (acte 2) : Son adversaire de la digue partagée lui offre un passage de repli sans rien demander en retour, et elle concède qu’aucun horaire n’avait prévu cela. Elle laisse au joueur la question du plan de ses ouvrages, qu’elle gardait jusque-là pour elle.
- *Dilemme :* Publier le plan des ouvrages ou conserver un avantage de passage.

**Samir El Hadi** — Maroc. Commandant de la délégation marocaine, coordinateur des étapes de convoi. *Motivation :* Empêcher qu’un contrat de transport décide seul qui peut participer aux Jeux. *Croyance :* Il garde trop longtemps une réserve pour un risque qui ne se réalise pas toujours.
- Avant la Ronde XIV (acte 1) : Il a appris le commandement en répartissant une réserve de pièces entre plusieurs étapes éloignées, sans laisser le dernier atelier à sec.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : accepter une livraison exclusive ou ouvrir le dépôt à plusieurs équipes. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, trois stations au soleil (acte 2) : Aux trois stations du parc solaire, il compare avec le joueur les reçus des convois et trouve la même clause de retour dans des contrats qu’il croyait concurrents. Il concède qu’une réserve gardée pour un risque imaginaire a laissé une étape à découvert.
- Ronde XIV, après le Japon 12 ou la finale 13 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_au_01` en branche b, `opus1_finale_14` en branche a de `opus1_ma_08_decision`) : une maladie longue, la sienne, nommée nulle part. La clause de dépendance du contrat de transport interdit à la délégation d’employer un coordinateur hors du personnel du fournisseur ; sans garantie du crédit, personne ne peut le remplacer et il tient les étapes une saison de plus au lieu de se soigner ; avec la garantie, il se soigne une saison, qui ne le guérit pas. Le choix change le moment, jamais la cause. Jamais sur un terrain homologué, jamais par du matériel de tournoi, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Maroc reste engagé, le banc repris par son adjointe des étapes du sud.
- *Dilemme :* Accepter une livraison exclusive ou ouvrir le dépôt à plusieurs équipes.

**Awa Diagne** — Sénégal. Commandante de la délégation sénégalaise, capitaine des équipes du delta. *Motivation :* Prouver qu’une coalition tient par des engagements vérifiables et réciproques. *Croyance :* Elle prend parfois sur elle les engagements que ses partenaires devraient assumer.
- Avant la Ronde XIV (acte 1) : Elle a gagné sa sélection en organisant une relève entre deux clubs qui refusaient jusque-là de partager leurs entraînements.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : maintenir une aide à une délégation défaillante ou exiger sa contribution. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la route de l’estuaire (acte 1) : Elle reçoit le joueur à sa table avant de le jouer sur la route de l’estuaire, et fait avancer ses équipes groupées entre les bras d’eau. Elle croit qu’une promesse faite à un partenaire engage toute la coalition.
- Ronde XIV, le quai sans relève (acte 2) : Quand la relève promise à son équipe de nuit reste bloquée par un contrat de transport contesté, elle tient le quai sans elle et admet devant le joueur qu’elle a signé pour un partenaire qui n’avait rien promis en retour.
- *Dilemme :* Maintenir une aide à une délégation défaillante ou exiger sa contribution.

**Lívia Moura** — Brésil. Commandante de la délégation brésilienne, organisatrice de rencontres fluviales. *Motivation :* Faire bénéficier les ateliers locaux des contrats que leurs équipes remportent. *Croyance :* Elle confond parfois l’enthousiasme du public avec l’adhésion de son équipe.
- Avant la Ronde XIV (acte 1) : Elle a transformé une exhibition mal préparée en série de rencontres accessibles en faisant tourner les équipements entre les clubs.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : protéger une retransmission populaire ou révéler un contrat de distribution inégal. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, les pistes jumelles (acte 1) : Elle fait entrer ses équipes sur les pistes jumelles avec les tambours du public derrière elle et joue le pont du milieu parce que le stade l’attend là. Elle croit que le bruit des gradins dit ce que veut son équipe.
- Ronde XIV, le prêteur et l’équipe (acte 2) : Quand un sponsor prétend parler au nom de toute la délégation, elle le contredit devant le public. Trois carnets concordants lui montrent ensuite que la retransmission qu’elle défend paie un contrat de distribution que ses ateliers ne voient jamais.
- *Dilemme :* Protéger une retransmission populaire ou révéler un contrat de distribution inégal.

**Inés Valdés** — Mexique. Commandante de la délégation mexicaine, responsable des qualifications de plateau. *Motivation :* Obtenir des contrats qui récompensent le travail des équipes de terrain. *Croyance :* Elle veut encore prouver qu’une prise spectaculaire peut corriger un départ difficile.
- Avant la Ronde XIV (acte 1) : Elle a perdu une finale après avoir pris un poste prestigieux en laissant sans couverture les deux passages qui l’alimentaient.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : rendre un poste contesté à l’arbitrage ou exploiter immédiatement ses revenus. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la route du plateau (acte 1) : Elle entre sur le plateau en musique, annonce sa prise à l’avance et la réussit sur la ville d’aiguillage. Elle croit qu’une prise assez spectaculaire fera oublier les deux passages qu’elle laisse encore sans couverture.
- Ronde XIV, le ciel du plateau (acte 2) : Sans intercepteurs, elle voit un adversaire aérien tourner au-dessus de sa ligne et paie chaque prise d’un flanc. Elle concède au joueur que le public applaudit la prise et ne voit jamais le poste perdu derrière, puis compare avec lui trois permis d’accès qui ne disent pas la même chose.
- *Dilemme :* Rendre un poste contesté à l’arbitrage ou exploiter immédiatement ses revenus.

**Devika Rao** — Inde. Commandante de la délégation indienne, coordinatrice d’ateliers de compétition. *Motivation :* Maintenir plusieurs voies de production lorsque les concessions se concentrent. *Croyance :* Elle multiplie les solutions au point de retarder parfois le choix indispensable.
- Avant la Ronde XIV (acte 1) : Elle a regroupé plusieurs petits ateliers dans une réserve commune après qu’un fournisseur eut modifié ses délais en pleine qualification.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : produire vite pour la manche présente ou préserver des pièces pour un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la première interconnexion (acte 1) : Elle ouvre son parcours en faisant sortir deux unités par journée de ses ateliers dispersés et couvre les carrefours d’un réseau dense en commentant elle-même chaque coup. Elle croit qu’assez de voies de production rendent tout choix inutile.
- Ronde XIV, les trois protocoles (acte 2) : Les relevés de trois protocoles montrent que plusieurs offres qu’elle avait mises en concurrence servaient le même bénéficiaire. Elle concède qu’avoir multiplié les fournisseurs n’a rien préservé, et pose au joueur, pour la première fois, la question de garder des pièces pour un partenaire plutôt que de produire.
- *Dilemme :* Produire vite pour la manche présente ou préserver des pièces pour un partenaire.

**Ren Mizuno** — Japon. Commandant de la délégation japonaise, planificateur des correspondances. *Motivation :* Garder les réseaux solaires et leurs interfaces ouverts à plusieurs opérateurs. *Croyance :* Il cherche une séquence parfaite et réagit tard aux décisions irrationnelles d’un rival.
- Avant la Ronde XIV (acte 1) : Il a construit ses premières tactiques sur les horaires de transfert des équipes, puis perdu une manche quand une liaison imprévue a rompu son plan.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : partager une interface de contrôle ou garder la priorité sur son réseau. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le premier détroit (acte 1) : Il accueille le joueur avec un bento et un horaire de correspondances où chaque unité a son créneau de gare. Il croit qu’une séquence sans retard tient même sous une surveillance aérienne, et perd au premier détroit une journée à attendre une liaison qui ne vient pas.
- Ronde XIV, les trois miroirs (acte 2) : Face à un adversaire sans visage dont les drones brouillables cachent la doctrine, il réagit trop tard. Les trois relais lui montrent ensuite que les contrats méridiens sont synchronisés sur ses propres horaires, et il concède qu’un réseau ouvert à plusieurs opérateurs vaut mieux qu’une séquence parfaite tenue par lui seul.
- *Dilemme :* Partager une interface de contrôle ou garder la priorité sur son réseau.

**Hazel Quinn** — Australie. Commandante de la délégation australienne, responsable des réserves côtières. *Motivation :* Maintenir une autonomie de réserve entre des sites très éloignés. *Croyance :* Son calme peut masquer trop longtemps une décision de retrait nécessaire.
- Avant la Ronde XIV (acte 1) : Elle a refusé d’engager toutes ses batteries dans une finale et assuré ainsi les étapes suivantes lorsque le fournisseur commun a retardé ses livraisons.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : abandonner un dépôt secondaire ou demander à ses partenaires de l’aider à le tenir. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la route longue (acte 1) : Sur la route longue, sous la canicule, elle laisse le joueur venir à elle et fait de chaque ravitaillement une décision visible entre des ateliers très éloignés. Elle croit que la distance suffit à protéger un dépôt qu’on ne peut pas tenir.
- Ronde XIV, les trois délais (acte 2) : Les reçus de trois relais montrent qu’un même prêteur a retardé plusieurs délégations, la sienne comprise. Elle concède que son calme a repoussé d’une saison un retrait qu’elle savait nécessaire, et pose au joueur la question qu’elle évitait : rendre le dépôt secondaire, ou demander aux partenaires de le tenir.
- *Dilemme :* Abandonner un dépôt secondaire ou demander à ses partenaires de l’aider à le tenir.

**Ayu Pranata** — Indonésie. Commandante de la délégation indonésienne, déléguée d’un collectif de clubs insulaires. *Motivation :* Faire entrer les petites délégations dans les décisions sur la distribution. *Croyance :* Elle recherche un accord complet même quand le délai impose un arbitrage.
- Avant la Ronde XIV (acte 1) : Elle est devenue commandante après avoir proposé un tour de parole qui a permis à plusieurs clubs de préparer un calendrier commun de traversées.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : décider seule d’une traversée urgente ou accepter le coût d’une consultation. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, l’île d’entrée (acte 1) : Elle explique son plan de traversée au joueur avec un jeu d’ombres, île par île, et refuse de lancer la première capture tant que chaque club du collectif n’a pas pris la parole. Elle croit qu’un accord complet finit toujours par arriver avant la pluie.
- Ronde XIV, le mandat de trop (acte 2) : Lorsqu’un partenaire du collectif révèle avoir laissé à Méridien le droit de parler à sa place dans les décisions de distribution, elle concède que son tour de parole n’a pas vu passer cette signature. Elle tient le quai fermé le temps d’honorer la livraison promise, malgré le coût de cette révélation.
- *Dilemme :* Décider seule d’une traversée urgente ou accepter le coût d’une consultation.

**Leandro Paz** — Argentine. Commandant de la délégation argentine, ancien régisseur de pistes. *Motivation :* Empêcher qu’une seule voie logistique devienne un péage obligatoire. *Croyance :* Il élargit son front jusqu’à rendre sa propre réserve trop lointaine.
- Avant la Ronde XIV (acte 1) : Il a tracé des itinéraires alternatifs pour des rencontres sur de grandes plaines avant de gagner sa place au banc de commandement.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir un corridor commun ou concentrer les moyens sur sa qualification. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la route à péage (acte 1) : Sur la plaine argentine, un dépôt sous licence exclusive est posé sur l’unique route entre les deux bancs. Il reçoit le joueur pour lui montrer qu’on gagne par les chemins de traverse, et qu’un dépôt posé sur la seule route est un péage.
- Ronde XIV, le chenal du delta (acte 2) : Un club du delta privé d’accès aux batteries attend un transport par les bras d’eau. Ouvrir le chenal, qui ne se refermera plus, ou contourner par la plaine : sa réponse décide d’une trace sur la carte, et il nommera ensuite un péage un péage devant le contrat de priorité de Basile Kelm.
- *Dilemme :* Ouvrir un corridor commun ou concentrer les moyens sur sa qualification.

**Noémie Leduc** — Canada. Commandante de la délégation canadienne, technicienne des essais saisonniers. *Motivation :* Rendre les essais comparables et les préparatifs accessibles à tous les clubs. *Croyance :* Elle attend parfois une prévision plus sûre au lieu de saisir une fenêtre courte.
- Avant la Ronde XIV (acte 1) : Elle a interrompu un essai pourtant gagnant parce que les équipements d’une équipe invitée n’avaient pas été préparés aux mêmes conditions.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : publier des relevés incomplets ou différer une manche aux dépens d’un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le grand gel (acte 1) : Face à la Sélection Méridienne et à sa pièce à badge orange, elle exige qu’un essai se joue sous les mêmes conditions pour les deux camps et confie au joueur le banc de l’équipe témoin.
- Ronde XIV, la tempête annoncée (acte 2) : Une tempête annoncée deux journées à l’avance par le Bulletin bloque une délégation adverse. Partager les provisions ou garder la réserve : ce qu’elle relève pendant cette manche contredira la « priorité » de Basile Kelm aux finales.
- *Dilemme :* Publier des relevés incomplets ou différer une manche aux dépens d’un partenaire.

**Jone Vakalau** — Fidji. Commandant de la délégation fidjienne, jeune capitaine des entraînements de lagon. *Motivation :* Garder les petites équipes dans une compétition dominée par les grands budgets. *Croyance :* Son improvisation laisse rarement un plan de secours à ceux qui le suivent.
- Avant la Ronde XIV (acte 1) : Plus jeune capitaine de sa délégation, il s’est fait connaître en changeant un parcours de relais pour accueillir une équipe privée de son transport.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : tenter un raccourci pour un allié ou garantir le retour de tous les équipements. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le lagon sans transport (acte 1) : Le transport d’un club est retenu pour une facture ; il prête le sien au joueur pour ramener l’équipement, contre Yuna Serrat et une délégation sous mandat, et garde une petite équipe dans la compétition.
- Ronde XIV, la chaîne de passes (acte 2) : Avec les drones de Relais Zéro sur le récif, il doit tenter le raccourci par les passes ou garantir le retour de tout l’équipement ; c’est là que son improvisation apprend à laisser un plan de secours à ceux qui le suivent.
- *Dilemme :* Tenter un raccourci pour un allié ou garantir le retour de tous les équipements.

**Nikos Delis** — Grèce. Commandant de la délégation grecque, vétéran des relais côtiers. *Motivation :* Transmettre une méthode qui survive à son départ du circuit. *Croyance :* Il privilégie les itinéraires éprouvés et peut sous-estimer un nouvel outil.
- Avant la Ronde XIV (acte 1) : Il a quitté un banc prestigieux pour reformer une équipe dont les moyens avaient été dispersés après une saison sans finale.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : confier un passage à une recrue ou reprendre lui-même toute la préparation. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le café du port (acte 1) : Il reçoit le joueur au café du port avant le coup d’envoi et lui montre, môle après môle, qu’une méthode vaut mieux qu’un nouvel outil.
- Ronde XIV, la recrue au môle (acte 2) : Basile Kelm verrouille la réserve du port. Pour la première fois, il demande son avis au joueur — confier le passage des îles à la recrue, ou reprendre lui-même toute la préparation — et parle de « quand il ne sera plus sur le circuit ».
- Ronde XIV, après la finale 2 ou la finale 7 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_hs_gr_3`, le moment dépend de `opus1_hs_gr_2_decision`) : le cœur, à son âge, un matin d’hiver — au môle après sa dernière traversée si le joueur lui a dit de garder la main (branche b, défaut si le hors-série n’est pas joué, après la finale 2), au café du port si la recrue tient le passage (branche a, après la finale 7, la méthode transmise). La ligne du bac vers les îles, alimentée par la réserve du port, est suspendue par le contrat de priorité de Basile Kelm : sans bac, quelqu’un prend le bateau. Jamais sur un terrain homologué, jamais par du matériel de tournoi, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; la Grèce reste engagée, relation inchangée.
- *Dilemme :* Confier un passage à une recrue ou reprendre lui-même toute la préparation.

**Elín Arnardóttir** — Islande. Commandante de la délégation islandaise, observatrice des sites d’essai. *Motivation :* Permettre un contrôle indépendant des annonces énergétiques. *Croyance :* Elle retarde ses accusations tant que chaque mesure n’est pas recoupée.
- Avant la Ronde XIV (acte 1) : Elle a comparé les relevés de deux opérateurs et découvert que leurs contrats vendaient la même réserve à deux délégations.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : signaler une anomalie plausible ou attendre une preuve au risque de perdre le contrat. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la nuit islandaise (acte 1) : De nuit, sur la roche noire, elle joue contre Yuna Serrat, qui gère les deux contrats vendant la même réserve à deux délégations ; elle n’accuse pas encore, elle recoupe.
- Ronde XIV, le silence de la source (acte 2) : Après un an passé à comparer les exclusivités, elle choisit entre signaler l’anomalie maintenant et attendre la preuve recoupée. Le double contrat qu’elle tient est ce qu’aucune garantie proposée aux finales ne pourra contourner.
- *Dilemme :* Signaler une anomalie plausible ou attendre une preuve au risque de perdre le contrat.

**Kito Njoroge** — Kenya. Commandant de la délégation kényane, entraîneur des rencontres longues. *Motivation :* Prouver que la durée d’un contrat compte autant que son classement initial. *Croyance :* Il laisse parfois trop d’initiative au début en attendant l’épuisement adverse.
- Avant la Ronde XIV (acte 1) : Il a bâti son équipe autour des remplacements après avoir vu une formation brillante manquer de moyens dans la dernière journée d’un tournoi.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : céder une avance pour garder une relève ou soutenir immédiatement un partenaire. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le match de trois heures (acte 1) : Sur les hauts plateaux, il ne gagne jamais avant la dixième journée : il laisse le joueur s’épuiser, et prouve que la durée compte autant que le classement initial.
- Ronde XIV, le messager (acte 2) : Un relais à pied contre Yuna Serrat le place devant son dilemme : céder l’avance pour garder une relève, ou soutenir immédiatement le partenaire. Sa réponse décide de ce qu’il offre à l’infanterie du joueur.
- *Dilemme :* Céder une avance pour garder une relève ou soutenir immédiatement un partenaire.

**Tiana Ravel** — Madagascar. Commandante de la délégation malgache, cartographe des pistes d’entraînement. *Motivation :* Faire des relevés de terrain un bien partagé plutôt qu’une dépendance commerciale. *Croyance :* Elle perfectionne la reconnaissance alors qu’un objectif simple exige déjà d’agir.
- Avant la Ronde XIV (acte 1) : Elle consigne les espèces présentes autour des pistes et a déplacé un parcours pour préserver un site sans priver les clubs de leur entraînement.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : ouvrir ses cartes à un rival ou protéger le travail de son atelier. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, l’inventaire des pistes (acte 1) : Sous couvert et sous brouillard, elle nomme chaque espèce en pleine partie et gagne par les pistes rouges qu’elle a relevées elle-même.
- Ronde XIV, les cartes ouvertes (acte 2) : Face aux relais de Relais Zéro, elle doit ouvrir ses cartes à un rival ou protéger le travail de son atelier ; ouvertes, ses cartes montrent les couloirs des relais compromis.
- *Dilemme :* Ouvrir ses cartes à un rival ou protéger le travail de son atelier.

**Saran Bat** — Mongolie. Commandante de la délégation mongole, capitaine des parcours mobiles. *Motivation :* Préserver le droit de changer de fournisseur sans perdre l’accès au circuit. *Croyance :* Elle peut distancer les soutiens qui rendent sa mobilité possible.
- Avant la Ronde XIV (acte 1) : Elle a gagné une qualification en changeant de point de ravitaillement à mi-parcours après avoir annoncé le déplacement à tous ses partenaires.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : poursuivre une ouverture ou revenir couvrir une réserve commune. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le grand galop (acte 1) : Elle ne reçoit que qui a refusé une exclusivité sur le parcours mexicain. Sur la steppe, seule la reconnaissance décide de qui frappe le premier, et elle le sait mieux que quiconque.
- Ronde XIV, le point de ravitaillement déplacé (acte 2) : Le point de ravitaillement change à mi-parcours, annoncé à tous, face à Ost et Basile Kelm. Poursuivre l’ouverture ou revenir couvrir la réserve commune : elle apprend à ne pas distancer ce qui rend sa mobilité possible.
- *Dilemme :* Poursuivre une ouverture ou revenir couvrir une réserve commune.

**Amalie Haoses** — Namibie. Commandante de la délégation namibienne, responsable des relevés côtiers. *Motivation :* Éviter qu’un opérateur vende une information que les participants ont produite ensemble. *Croyance :* Elle supporte l’incertitude au point de garder trop longtemps un objectif mal connu.
- Avant la Ronde XIV (acte 1) : Elle a organisé une série de tests où les équipes échangeaient leurs relevés pour distinguer les erreurs de capteurs des changements de visibilité.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : révéler un passage à tous ou protéger la seule fenêtre de son équipe. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, la brume du matin (acte 1) : Sur le seul terrain totalement découvert du tournoi, la brume côtière tombe chaque matin et aveugle l’adversaire ; elle joue contre le joueur avec ses drones, et lui laisse comprendre ce que la brume efface.
- Ronde XIV, le passage révélé (acte 2) : Avant le coup d’envoi, contre trois camps aux fronts séparés, elle doit révéler le passage à tous ou protéger la seule fenêtre de son équipe ; ses observateurs relèvent les couloirs du réseau muet.
- *Dilemme :* Révéler un passage à tous ou protéger la seule fenêtre de son équipe.

**Mira Karki** — Népal. Commandante de la délégation népalaise, coordinatrice des ateliers d’altitude. *Motivation :* Donner aux sites isolés une voix dans les engagements de distribution. *Croyance :* Elle accepte trop facilement une logistique réduite et demande de l’aide tard.
- Avant la Ronde XIV (acte 1) : Elle a constitué une réserve commune de petites pièces lorsque les rotations de transport ne permettaient plus d’équiper chaque atelier séparément.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : concentrer les pièces dans un relais fiable ou maintenir plusieurs ateliers ouverts. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, les ateliers d’altitude (acte 1) : Du subtropical au glacier, elle joue depuis la montagne contre le joueur ; ses fanions de balisage sont sans signe, et le sommet n’est qu’une étape.
- Ronde XIV, le pont de corde (acte 2) : Un atelier isolé attend des pièces que la rotation des transports ne monte plus. Elle a demandé de l’aide tard, et le dit ; poser le pont de corde ou passer par le col, sa dernière réplique est « on aurait pu attendre ».
- Ronde XIV, après la finale 7 (acte 3, auteur) : Disparition — au sens de l’amendement du 9 septembre 2026 (`BRIEF.md`, « Quatre disparitions ») — écrite à la main, hors du terrain (`opus1_hs_np_3`, fixe) : la montagne et l’épuisement. La rotation des transports vers les sites d’altitude est suspendue par les réserves rendues exclusives par Basile Kelm ; elle monte à pied avec deux porteurs vers l’atelier isolé, la fenêtre météo se referme le soir même, ils redescendent quand elle se rouvre, trop tard pour elle. Les porteurs vont bien, et c’est dit. Le choix du pont de corde change ce que l’atelier a reçu, jamais le moment ni la cause. Jamais sur un terrain homologué, jamais par du matériel de tournoi, aucune personne identifiée n’en est l’auteur. Non recrutable dès l’annonce ; le Népal reste engagé, le banc repris par son adjointe.
- *Dilemme :* Concentrer les pièces dans un relais fiable ou maintenir plusieurs ateliers ouverts.

**Tess Roa** — Nouvelle-Zélande. Commandante de la délégation néo-zélandaise, responsable des remises en service. *Motivation :* Faire compter la réparation et l’entretien dans le partage des moyens. *Croyance :* Elle s’attache à remettre chaque poste en service même quand il faut changer d’axe.
- Avant la Ronde XIV (acte 1) : Elle a remis un terrain d’entraînement en activité avec plusieurs clubs qui avaient des méthodes incompatibles mais des pièces complémentaires.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : réparer un dépôt utile à tous ou réserver le matériel à la prochaine manche. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le dépôt rendu (acte 1) : Le dépôt rendu par une rupture de contrat est celui de sa vallée : trois postes désaffectés, dont elle remet en service et tient deux avant le joueur, dans la brume et la fougère.
- Ronde XIV, la ligne de fougère (acte 2) : Pendant que son équipe répare, elle prête son banc au joueur contre Ost et Yuna Serrat. Réparer pour tous ou réserver le matériel à la prochaine manche : sa réponse décide de ce qu’elle offre au génie du joueur.
- *Dilemme :* Réparer un dépôt utile à tous ou réserver le matériel à la prochaine manche.

**Luz Quispe** — Pérou. Commandante de la délégation péruvienne, conductrice des chantiers de parcours. *Motivation :* Empêcher qu’une homologation serve à fermer un passage aux petits ateliers. *Croyance :* Elle croit parfois qu’un nouvel aménagement peut résoudre un désaccord contractuel.
- Avant la Ronde XIV (acte 1) : Elle a obtenu sa place de commandante en préparant un détour accessible à une équipe dont le matériel ne franchissait pas le tracé prévu.
- Ronde XIV, examen des concessions (acte 2) : La révision des accès aux réserves confronte cette délégation à une décision : consacrer la réserve à un passage commun ou terminer son propre équipement. La réponse dépend des engagements pris sur le parcours ; aucun ralliement n’est fixé par la nationalité.
- Ronde XIV, le passage commun (acte 1) : Côte sèche, altiplano, versant amazonien : le premier génie qui relie ses trois étages gagne le tempo, et c’est elle qui l’apprend au joueur en le battant.
- Ronde XIV, la querelle d’altitude (acte 2) : Avec le joueur contre Basile Kelm et Yuna Serrat, elle consacre la réserve au passage commun ou termine son propre équipement ; le passage bâti reste sur la carte, et elle peut rejoindre le banc du joueur comme co-commandante.
- *Dilemme :* Consacrer la réserve à un passage commun ou terminer son propre équipement.

## La Cinquième Manche et les Gris (8)

*Bible auteur : fonction, motivation et liens ne sont jamais sérialisés tels quels vers une interface publique.*

| Prénom | Nom complet | Fonction | Style | Pouvoir | Super pouvoir | Faits |
|---|---|---|---|---|---|---:|
| **Hadran** | Hadran Ost | Commandant des mécanisés de la Sélection Méridienne | Pression mécanisée | **Pression méridienne** (3 barres) — Vos chenilles frappent ×1,2 et gagnent +1 de mouvement ce tour. | **Le bloc avance** (7 barres) — Toutes les unités adverses perdent 1 PV, et vos chenilles frappent ×1,3 avec +1 de mouvement ce tour. | 7 |
| **Sélène** | Sélène Veyr | Directrice du Consortium Méridien | La concession | **Clause de stabilité** (3 barres) — Ce tour, tout ce que vous achetez coûte 30 % de moins. | **Tutelle du réseau** (7 barres) — Pendant 2 journées, vos revenus sont ×2 et vos capteurs capturent ×1,5. | 7 |
| **Maël** | Maël Orven | Commandant de mobilité aérienne | Fenêtre de vol | **Plein en vol** (3 barres) — Vos appareils refont le plein et les charges tout de suite, et gagnent +1 de mouvement ce tour. | **Ciel de manœuvre** (8 barres) — Tous vos appareils qui ont déjà agi rejouent une fois ce tour. | 5 |
| **Lise** | Lise Varen | Commandante des marqueurs indirects | Angle réservé | **Angle réservé** (3 barres) — Vos pièces de portée tirent 1 case plus loin jusqu’à votre prochain tour. | **Passages verrouillés** (7 barres) — Jusqu’à 3 cases de plaine ou de plage contiguës deviennent une rivière pendant 2 journées, et vos pièces de portée frappent ×1,2 jusqu’à votre prochain tour. | 4 |
| **Edran** | Edran Sorel | Coordinateur des réserves et de la relève | La relève | **Colonne de relève** (3 barres) — Toutes vos unités refont le plein et les charges, et vos transports gagnent +1 de mouvement ce tour. | **Deuxième ligne** (7 barres) — Ce tour, tout ce que vous achetez coûte 40 % de moins, et vos unités gagnent +1 de mouvement. | 5 |
| **Yuna** | Yuna Serrat | Commandante des concessions de terrain | Le mandat | **Mandat provisoire** (3 barres) — Vos capteurs capturent ×2 ce tour. | **Le réseau bascule** (7 barres) — Vos capteurs capturent ×3 ce tour, et vos troupes à pied gagnent +2 de mouvement. | 3 |
| **Basile** | Basile Kelm | Commandant des dépôts et de la surveillance | Le bastion | **Veille du bastion** (3 barres) — Vos unités sur un bâtiment se défendent ×1,3, et toutes voient 1 case plus loin, jusqu’à votre prochain tour. | **Réserves fermées** (8 barres) — Toutes les unités adverses perdent 1 PV, et pendant une journée elles voient 2 cases de moins : les réserves sont fermées, ce qui est dehors y reste. | 3 |
| **Relais** | Relais Zéro | Commandement distant sous identifiant de tournoi | Information asymétrique | **Signal brouillé** (3 barres) — Les unités adverses voient 2 cases de moins, et vos drones 2 de plus, jusqu’à votre prochain tour. | **Réseau sans écho** (7 barres) — Brouillard pendant 2 journées, et vos drones voient 2 cases plus loin et se défendent ×1,2. | 3 |

**Hadran Ost** — *Motivation :* Retrouver le pouvoir perdu sans admettre sa responsabilité. *Croyance :* Il confond encore reconnaissance du public et droit de décider seul.
- Ronde XII (acte 1) : Il enchaîne les victoires et reçoit les jeunes équipes avec chaleur.
- Ronde XIII (acte 2) : Il contourne sciemment une homologation et est disqualifié. La sanction n’était pas un complot.
- Entre les Rondes XIII et XIV (acte 2) : Le Consortium lui confie les Gris, équipe d’essai sans nation propre.
- Ronde XIV (acte 3) : Il participe à l’accaparement des concessions, sans mesurer que ses propres équipes seront dépendantes. Un témoignage ne le dispense pas de répondre de ses actes.
- Avant la Ronde XIV (acte 1) : Ronde XII : champion accueillant. Ronde XIII : disqualification justifiée après contournement d’une homologation. Entre XIII et XIV : le Consortium lui confie la Sélection Méridienne.
- Ronde XIV · progression du conflit (acte 3, auteur) : Témoignage possible si les preuves et les équipes sont protégées ; responsabilité maintenue, jamais pardon automatique.
- Point de vue auteur (acte 3, auteur) : Retrouver le pouvoir perdu sans admettre sa responsabilité. Aider ses équipes à témoigner ou protéger sa réputation.

**Sélène Veyr** — *Motivation :* Imposer seule les conditions du réseau, en présentant la dépendance comme la stabilité. *Croyance :* Elle croit que le réseau ne reste stable que sous une autorité unique.
- Ronde XI (acte 1) : Elle rejoint la coordination des réserves ; son travail facilite réellement les déplacements.
- Ronde XII (acte 2) : Elle rédige les contrats qui relient exploitation solaire, stockage et distribution.
- Ronde XIV (acte 3) : Elle dirige la Cinquième Manche. Trois signatures indépendantes relient ses sociétés aux mêmes concessions ; son identité ne change jamais entre deux parties.
- Ronde XIV, programme Aube (acte 3) : Elle cherche une tutelle irrévocable sur la coopération de fusion, ses accès et ses futurs droits. Aube est expérimental : aucune énergie illimitée n’est disponible à gagner.
- Avant la Ronde XIV (acte 3) : Ronde XI : coordination utile des réserves. Ronde XII : contrats liant solaire, stockage et distribution. Ronde XIV : direction fixe de la Cinquième Manche, tentative de tutelle irrévocable sur Aube.
- Ronde XIV · progression du conflit (acte 3, auteur) : Ne se repent pas ; renonce ou perd ses concessions selon le dossier et les objectifs remportés.
- Point de vue auteur (acte 3, auteur) : Imposer seule les conditions du réseau, en présentant la dépendance comme la stabilité. Accepter un accès partagé ou perdre le contrôle exclusif auquel elle tient.

**Maël Orven** — *Motivation :* Ne plus dépendre de décisions prises loin du terrain. *Croyance :* Il croit qu’une équipe mobile peut choisir ses propres dépendances.
- Avant la Ronde XIV (acte 1) : Avant XIV : pilote de reconnaissance de circuits sportifs, il doit abandonner un programme indépendant faute d’accès aux batteries. XIV : accepte les moyens méridiens et transforme cette dépendance en loyauté choisie.
- Ronde XIV · progression du conflit (acte 3, auteur) : Accepte la relève paternelle au pivot ; après la défaite imposée au joueur, peut négocier un désengagement si sa sœur et ses équipes ont été traitées équitablement.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Fils d’Edran : révélation publique au final10. Frère de Lise Varen : information auteur, jamais exposée dans cet opus par défaut.
- Saison 5 · épisode 4 · finale 10 (acte 3, jalon) : Edran Sorel est le père de Maël Orven. Il rejoint son fils avec ses réserves ; la coalition doit perdre cette confrontation et se replier. Ce lien ne révèle aucune autre parenté.
- Point de vue auteur (acte 3, auteur) : Ne plus dépendre de décisions prises loin du terrain. Refuser la tutelle de son père ou accepter ses réserves pour gagner.

**Lise Varen** — *Motivation :* Protéger son équipe sans accepter que cette protection achète son silence. *Croyance :* Elle croit qu’un engagement écrit protège mieux ses techniciens que la confiance.
- Avant la Ronde XIV (acte 1) : Ancienne organisatrice de parcours, Lise conçoit des zones de sécurité pour les marqueurs lourds. Elle rejoint les Gris avec une clause protégeant ses techniciens, puis découvre que leur approvisionnement dépend d’un fournisseur unique.
- Ronde XIV · progression du conflit (acte 3, auteur) : Peut rompre avec le Consortium ; si on refuse une issue vérifiable à ses techniciens, elle reste adverse. Elle ne change pas de camp sur un simple compliment.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Sœur de Maël et fille d’Edran, informations strictement auteur non révélées dans cet opus. Les scènes publiques traitent Maël comme un collègue.
- Point de vue auteur (acte 3, auteur) : Protéger son équipe sans accepter que cette protection achète son silence. Transmettre des plans de tir utiles au retrait ou maintenir son engagement auprès des Gris.

**Edran Sorel** — *Motivation :* Préserver les équipes menacées d’épuisement en contrôlant les routes et les réserves. *Croyance :* Il croit pouvoir utiliser le Consortium sans finir par servir ses objectifs.
- Avant la Ronde XIV (acte 1) : Ancien responsable d’une coopérative de maintenance, Edran travaille sous son nom professionnel Sorel. Il apparaît comme prestataire de réserve et sait maintenir une deuxième ligne quand un front a épuisé ses stocks.
- Ronde XIV · progression du conflit (acte 3, auteur) : Rejoint Maël au final10 dans toutes les branches. Peut ensuite contribuer à restituer les réserves ; aucune aide tardive n’efface la responsabilité du repli imposé.
- Coulisses auteur · non publiable dans cet opus (acte 3, auteur) : Père de Maël et Lise en coulisses. Seul le lien père-fils est dit avant sa relève au final10/S5E4. Le lien avec Lise reste caché ; aucune parenté avec le joueur.
- Saison 5 · épisode 4 · finale 10 (acte 3, jalon) : Edran Sorel est le père de Maël Orven. Il rejoint son fils avec ses réserves ; la coalition doit perdre cette confrontation et se replier. Ce lien ne révèle aucune autre parenté.
- Point de vue auteur (acte 3, auteur) : Sauver son fils d’une nouvelle défaite, quitte à renforcer le réseau qu’il prétend seulement utiliser. Aider son fils ou refuser le détournement des réserves communes.

**Yuna Serrat** — *Motivation :* Ne plus être la personne que l’on consulte seulement après la signature. *Croyance :* Elle croit que la personne qui organise un compromis mérite de le contrôler.
- Avant la Ronde XIV (acte 1) : XII : assure la médiation entre équipes privées d’accès à une piste. XIII : reçoit un mandat limité de gestion de concessions. XIV : étend ces délégations provisoires au bénéfice du Consortium, tout en se disant intermédiaire neutre.
- Ronde XIV · progression du conflit (acte 3, auteur) : Peut témoigner contre les contrats si les délégations ont conservé un pouvoir de contrôle ; sinon reste gestionnaire adverse.
- Point de vue auteur (acte 3, auteur) : Ne plus être la personne que l’on consulte seulement après la signature. Restituer les mandats temporaires ou prétendre qu’ils autorisent tout.

**Basile Kelm** — *Motivation :* Éviter toute interruption, même au prix d’un système injuste. *Croyance :* Il croit qu’une réserve fermée vaut mieux qu’un partage susceptible de tomber en panne.
- Avant la Ronde XIV (acte 1) : XI : organise la sécurité d’installations de tournoi après une panne sans victimes. XIII : crée des réserves redondantes. XIV : accepte leur contrôle exclusif au nom de la continuité et finit par exclure les équipes qui en ont besoin.
- Ronde XIV · progression du conflit (acte 3, auteur) : Reste loyal au dispositif de Sélène ; une reddition réglementaire est possible, une conversion soudaine ne l’est pas.
- Point de vue auteur (acte 3, auteur) : Éviter toute interruption, même au prix d’un système injuste. Faire fonctionner un réseau partagé imparfait ou conserver une réserve inaccessible.

**Relais Zéro** — *Motivation :* Motivation personnelle inconnue ; objectif observable : maintenir l’avantage informationnel de la Cinquième Manche. *Croyance :* Aucune croyance personnelle vérifiée ; ses décisions privilégient la continuité des observations.
- Avant la Ronde XIV (acte 2) : Avant XIV : aucune biographie civile vérifiée. XIV : un identifiant de compétition récurrent signe des ordres dont les effets et la responsabilité sont consignés. Les archives attestent une continuité de commandement, sans révéler d’identité civile.
- Ronde XIV · progression du conflit (acte 3, auteur) : Identité civile toujours inconnue à la fin de l’opus1. Le relais local est neutralisé et ses mandats révoqués ; cela ne transforme pas une victoire en faux dénouement.
- Point de vue auteur (acte 3, auteur) : Motivation personnelle inconnue ; objectif observable : maintenir l’avantage informationnel de la Cinquième Manche. Couper un relais et perdre ses observations ou maintenir une liaison susceptible de laisser des traces.

## Atlas (2)


| Prénom | Nom complet | Fonction | Style | Pouvoir | Super pouvoir | Faits |
|---|---|---|---|---|---|---:|
| **Solveig** | Solveig Tamm | Intendante des transports | L’escorte | **Escorte rapprochée** (3 barres) — Vos transports se défendent ×1,4 et toutes vos unités ×1,15, jusqu’à votre prochain tour. | **Personne ne reste** (6 barres) — Toutes vos unités gagnent +2 de mouvement et se défendent ×1,2 ce tour. | 2 |
| **Wren** | Wren Osoko | Responsable de l’homologation | Les archives | **Relevés ouverts** (3 barres) — Vos unités voient 2 cases plus loin et ont +5 % de chance dans chaque duel, jusqu’à votre prochain tour. | **Carte complète** (6 barres) — Jusqu’à votre prochain tour, vos unités ont +15 % de chance dans chaque duel et voient 3 cases plus loin. | 2 |

**Solveig Tamm** — *Motivation :* Faire arriver les équipes et les réserves promises. *Croyance :* Les trajets révèlent ce que les noms de sociétés cachent.
- Ronde XII (acte 1) : Elle commence un registre des convois et des pièces prêtées.
- Ronde XIV (acte 2) : Elle observe que des concessions apparemment concurrentes utilisent les mêmes réserves et les mêmes camions.

**Wren Osoko** — *Motivation :* Séparer les outils utiles des droits abusifs qui les accompagnent. *Croyance :* Une technologie n’est pas coupable des contrats conclus autour d’elle.
- Avant la Ronde XIV (acte 1) : Elle homologue un système de télémétrie sportif.
- Ronde XIV (acte 2) : Elle découvre que ses droits d’accès ont changé et documente ce transfert sans inventer une panne ou un accident.

## Les civils (3)

**Nera Aldouin** — Arbitre en chef. *Motivation :* Préserver un arbitrage opposable aux plus puissants. *Croyance :* Elle confond parfois légalité d’une clause et justice de son effet.
- Ronde XI (acte 1) : Elle entre au Collège des arbitres et constitue des archives des concessions.
- Ronde XIII (acte 2) : Elle homologue un contrat légal qui concentre les réserves chez un intermédiaire unique.
- Ronde XIV (acte 2) : Elle recoupe les signatures plutôt que les rumeurs pour contester les clauses de dépendance.

**Osmin Talvarec** — Coordinateur d’Atlas, ancien géomètre. *Motivation :* Maintenir un cadre commun lorsque les délégations se divisent. *Croyance :* Il croit qu’avouer les défaillances d’Atlas détruirait le seul arbitre disponible.
- Avant la Ronde XI (acte 1) : Il cartographie les interconnexions ; il n’a jamais été commandant.
- Ronde XII (acte 2) : Il délègue au Consortium la gestion de plusieurs voies logistiques pour tenir le calendrier.
- Ronde XIV (acte 3) : Il connaît une partie des anomalies mais n’est pas le chef de la Cinquième Manche. Transmettre les cartes complètes engage sa responsabilité.

**Célestin Vantour** — Commentateur et mémoire des Jeux. *Motivation :* Raconter des victoires auxquelles le public puisse croire. *Croyance :* Un récit clair lui paraît parfois plus utile qu’un dossier incomplet.
- Ronde XII (acte 1) : Il transforme la série de victoires d’Ost en légende.
- Ronde XIII (acte 2) : Il minimise sa disqualification sans avoir étudié toutes les pièces.
- Ronde XIV (acte 3) : Il peut publier une preuve qui contredit ses propres commentaires ; il demeure témoin, pas expert de la fusion.

## Ce que le code constate comme manque

Aucun : chaque commandant national a une capacité, au moins trois faits et une mission d'entrée.

