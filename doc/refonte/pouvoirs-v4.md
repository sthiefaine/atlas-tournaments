# Pouvoirs des commandants — révision 4 (conception)

*10 septembre 2026. Deux fichiers, et rien d'autre : ce document et `doc/refonte/pouvoirs-v4.json`. Le moteur et le contenu ne sont pas touchés ; les familles nouvelles sont câblées en parallèle, et un autre agent transcrira les kits dans `content/commandants-capacites.json` quand elles le seront.*

## 1. Le principe

Le propriétaire a raison : les 34 kits de la révision 3 sont trente-quatre variations de « ×1,15 pour mes unités ». Pas un seul ne change la façon de jouer un tour. On les lit dans un menu et on les oublie ; on ne se dit jamais « attention, c'est *elle* en face ».

Un pouvoir d'Advance Wars est bon quand il tient **en une phrase que l'adversaire connaît par cœur** — « Andy répare deux », « Eagle rejoue », « Drake fait pleuvoir et retire un PV à tout le monde », « Lash retire le terrain » — et quand l'adversaire **change son tour** à cause de cette phrase. C'est la règle qu'on a suivie, et elle a quatre conséquences.

1. **La bible §6 est enfin honorée.** Chaque archétype a une *famille de pouvoir* écrite depuis le premier jour et jamais lue : la météorologue fait la météo, le vétéran soigne, l'ingénieur pose du terrain, la diplomate capture et encaisse, la gardienne ralentit ce qui approche, le showman joue l'élan, la survivante monte quand elle est menée. Les trois météorologues (Canada, Islande, Madagascar) font trois météos différentes — neige, brouillard, pluie — et deux d'entre elles n'ont *aucun* bonus de combat. Les deux ingénieures posent des ponts et des polders ; la gardienne australienne fait payer la distance ; la fonceuse sénégalaise fait rejouer son infanterie.
2. **Le pouvoir est géographique, jamais militaire** (bible §7). Le téléphérique suisse, la digue néerlandaise, le thé versé de haut au Maroc, la batucada, la lucha libre, la tournée du public en Inde, le dernier train du Japon, le cœur vide de l'Australie, le cyclone fidjien annoncé deux jours avant, le café serré grec, les sources chaudes islandaises, le fond kényan, les trois jeux mongols (lutte, tir, course), la brume namibienne, la cordée népalaise, la fougère. Les interdits de chaque fiche pays ont été relus : pas de haka, pas de safari, pas de coffre suisse, pas de sabre, pas de cartel.
3. **Le super n'est pas « un pouvoir plus gros ».** Trente kits sur trente-quatre changent de famille entre le pouvoir et le super. Les quatre qui restent le font pour une raison dite (§5).
4. **Une vraie faiblesse, chiffrée, permanente.** Chaque kit porte un `faiblesse.effet` dans les bornes du moteur, sur l'un des huit axes du schéma. C'est ce que `Commander.faiblesse` exige et ce que l'IA `ponderee` lit pour choisir ses achats. Une faiblesse « aucun bonus sur X » n'est pas une faiblesse : toutes celles-ci **coûtent** quelque chose.

**Le vocabulaire employé**, et rien d'autre : les dix modificateurs de `BORNES_MODIFICATEUR`, `poserTerrain` avec ses sept formes et sa table `depuis → vers`, et les huit familles en cours de câblage (`soin`, `degats_directs`, `ravitailler`, `prix`, `chance`, `etoiles`, `reactiver`, `meteo`) aux bornes annoncées. Les filtres ne citent que des clés de `content/unites.json` et `content/terrains.json` ; le type de mouvement `amphibie` n'est porté par aucune unité, il n'apparaît nulle part. Un script a relu les 34 kits contre tout cela (bornes, cibles, formes, durées, coûts, interdits de vocabulaire de la bible §5.2, unicité des couples de familles, comptes par famille) : zéro erreur.

## 2. Première relecture — le joueur invétéré d'Advance Wars

*Il a lu le brouillon des 34 kits avec Andy, Max, Sami, Grit, Eagle, Drake, Olaf, Kanbei, Sonja, Sensei, Hachi, Lash, Nell, Colin, Jess, Flak, Adder et Hawke en tête. Ses objections, et ce qu'elles ont changé.*

**« Vous avez deux Eagle. »** Le brouillon donnait `mouvement +1` puis `reactiver` à Awa (Sénégal) *et* à Maël (le frère, mobilité aérienne) : même couple, même sensation. → Le pouvoir de Maël devient **Plein en vol** (`ravitailler` ses appareils + 1 de mouvement) : c'est *Jess dans le ciel* au pouvoir, *Eagle* au super, et la contrainte de carburant de ses appareils — sa faiblesse déclarée dans `opus1-adversaires.md` — devient la chose que son pouvoir efface un tour. Awa garde le couple (mouvement, reactiver) sur l'infanterie, ce qui est Sami-puis-Eagle, une combinaison qu'Advance Wars n'a jamais faite.

**« Trois Hachi. »** Tomas (Luxembourg), Devika (Inde) et Sélène avaient tous `prix` au pouvoir. → Tomas passe à **Marché du matin**, `fonds ×1,5` sur une journée : la diplomate encaisse, elle ne solde pas. Devika garde le prix bas (« le public paie la tournée ») et Sélène aussi (« la clause de stabilité ») — mais leurs supers n'ont rien à voir : les véhicules de Devika rejouent, Sélène double ses revenus deux journées.

**« Samir et Edran, c'est Jess deux fois. »** Les deux avaient `ravitailler` puis `soin`. → Le super d'Edran devient **Deuxième ligne** (`prix ×0,6` + 1 de mouvement) : son plan est littéralement « engager une deuxième ligne ravitaillée après avoir épuisé les réserves adverses », et c'est une ligne qu'il *achète*, pas qu'il répare. Samir garde le soin : c'est le vétéran, et le thé.

**« Deux météorologues qui finissent par un soin, ce sont deux Andy avec un chapeau. »** Noémie (Canada) et Elín (Islande) avaient (météo, soin). → Noémie finit par **Grand Nord**, `mouvement +2` pour tout le monde sous deux journées de neige : l'hiver ne compte pas *pour elle*. Elín garde les sources chaudes.

**« Lotte et Luz sont la même ingénieure. »** (terrain, terrain) deux fois. → Luz ouvre par **Route neuve** (`mouvement +2` sur route et pont, ce qui est exactement sa spécialité pays) et finit par **Le pont**, le seul `permanent` du jeu. Lotte garde les deux poses parce que ce ne sont pas la même : le polder *gagne* une case, la digue *coupe* un axe — c'est le seul effet défensif de la table `poserTerrain`, et il fallait qu'une commandante le porte.

**« Tiana fait deux fois la météo, et Elsbeth capture comme Ayu. »** → Le super de Tiana devient **Chaque espèce a un nom** (`etoiles +2` en forêt : *Lash à l'envers*, la forêt la protège deux fois plus) ; le pouvoir d'Elsbeth est mené par la défense de relief, la moitié « captures adverses ÷2 » restant dedans parce que c'est la définition de la gardienne (`doc/04` §7.2).

**« Le soin, c'est sept commandants : c'est trop, et Amalie n'est pas Andy, c'est une survivante. »** → Amalie perd son soin pour **La dune est un abri** (`etoiles +2` à découvert), Mira perd le sien aussi. Cinq commandants gardent un soin, dans des rôles différents (mentor, vétéran, vétéran, sources chaudes, fougère).

**« Un super sans risque, c'est Max : on le déclenche dès qu'on peut, sans réfléchir. »** → **Carnaval** (Lívia) frappe ×1,4 avec +15 % de chance *et* baisse la garde à 85 % : on ne le lance pas quand on est exposé à une riposte. C'est le seul kit dont le super contient un malus à soi, et c'est voulu : le showman brésilien selon sa fiche pays — « tout part dans l'attaque, et la garde reste basse ».

**« Ost qui frappe ×1,4 au super, c'est un pouvoir plus gros. Le joueur ne verra rien. »** → **Le bloc avance** retire 1 PV à *toutes* les unités adverses (`degats_directs`), puis frappe. Sturm. Le joueur le voit sur chaque étiquette de sa carte, et il sait qui est en face dès le premier super.

**« Yuna, capture puis capture plus grosse : vous gardez ça ? »** Oui. Yuna est un adversaire, et un adversaire doit être lisible au premier tour : « elle prend les villes vite » est sa seule phrase, et son super doit être *la même phrase plus fort* — sinon le joueur apprend deux choses au lieu d'une. Objection notée, non suivie, avec sa raison.

**« Il manque Sonja-inversée : quelqu'un qui *retire* de la vision. »** Elle y est trois fois, par trois voies différentes : Amalie (brume, `vision −2` adverse pour deux barres), Relais Zéro (drones qui voient, adversaire qui ne voit pas), Basile (radar qui brouille). Le relecteur a jugé que trois, c'était assez.

**« Et Hazel ? Une gardienne qui fait de la défense, c'est Kanbei sans le prix. »** → Hazel devient la seule commandante à toucher le **carburant adverse** (`carburant ×2` sur `unites_adverses` une journée) : la distance protège, littéralement — traverser le cœur vide du continent coûte le double, et un appareil adverse qui s'y engage rentre à sec. Puis **Le cœur vide** : −1 PV à tout ce qui est sur la carte, captures adverses ÷2. C'est Drake au sec.

## 3. Seconde relecture — l'ado de quinze ans

*Il veut une phrase par pouvoir, un nom qu'on retient, un moment « oh ! » à l'écran, et que deux commandants ne se ressemblent pas.*

**« “Tempo commun”, “Front étendu”, “Veille rapprochée”, “Mesure du terrain” — c'est des noms de réunion. »** Tous les noms de la révision 3 ont été refaits. Le test : est-ce qu'on peut le crier ? *Batucada. Clé de bras. Le téléphérique. La digue cède. Dernier train. Le cyclone. Foulée. Galop. Carnaval. Le pont. Le bloc avance. Personne ne reste.* Trente-quatre pouvoirs, soixante-huit noms, aucun mot de réunion.

**« Inés, “capture sous pression”, c'est Sami. Où est la lutte ? »** → **Clé de bras** : les unités adverses perdent 2 étoiles de terrain — la ville, la forêt, la montagne ne les protègent plus, elles sont *clouées au sol*. Puis **Saut de la troisième corde** : −1 PV à tout le monde, et les étoiles retirées. Le public compte jusqu'à trois. C'est la prise de sa fiche pays (« déséquilibre une adverse plus légère et la cloue au sol ») rendue en mécanique.

**« Jone, le mec qui s'en sort neuf fois sur dix, il a juste +1 de mouvement en mer ? »** → Jone est le seul commandant dont le **passif est la chance** (`chance +1`, Nell), son pouvoir à 2 barres en ajoute, et son super est **Le cyclone** : deux journées de tempête, annoncées par le commentateur comme dans sa fiche pays (« un cyclone est une tempête annoncée deux journées à l'avance, jamais un désastre »). Les appareils adverses avancent moitié moins, les tirs de loin font −20 %, et lui n'a ni l'un ni l'autre — il joue au lagon.

**« Ren, un +1 de portée, ça se voit pas. »** → Au super, **Dernier train** : les pièces de portée qui ont déjà tiré *tirent une seconde fois*. Le moment « oh ! » est qu'une artillerie s'allume à nouveau. Reactiver filtré par type — le moteur le permet et personne ne l'avait employé.

**« Kito et Awa, c'est deux infanteries rapides, je vois pas la différence. »** → Awa fait *rejouer* (le delta se lève, tout le monde repart), Kito fait *finir* : **Jusqu'à la ligne**, capture ×2 — le fond, c'est celui qui accélère au dixième kilomètre et prend la ville en deux tours au lieu de quatre. L'une pousse, l'autre termine.

**« Où est le moment où l'écran change ? »** Il y en a maintenant de quatre sortes, et on peut les nommer : **la carte change** (polder, digue, téléphérique, pontons, estran, pont — six kits) ; **le ciel change** (neige, brouillard, pluie, tempête — cinq kits, avec l'annonce du commentateur) ; **tout le monde perd un PV d'un coup** (Ost et Basile ; Inés et Hazel ne frappent qu'une part de l'armée depuis le 10 septembre au soir) ; **les unités se rallument** (Awa, Devika, Ren, Maël). Un ado qui voit la mer devenir une plage retient le Grec.

**« Les descriptions, on comprend ? »** Chaque `description` d'effet est une phrase avec les chiffres dedans, testée sur le critère « est-ce qu'on sait ce qui va se passer *avant* d'appuyer ». Exemple : « Il neige pendant une journée : bottes et roues paient +1 par case hors route, pied et chenilles passent. » Les mots interdits de la bible (ennemi, détruire, tuer, arme, munitions, mort) ont été cherchés par script dans les huit champs de texte de chaque kit : aucun. « Munitions » devient « charges », comme le veut §5.2.

**« Sélène, la méchante, elle fait quoi ? »** Rien de méchant, et c'est exprès. Elle achète moins cher, encaisse le double, capture plus vite. Elle ne frappe jamais : toutes ses unités sont à 90 %. On la bat en lui prenant des bâtiments, pas en la combattant — et c'est exactement ce que le scénario veut faire comprendre : le réseau, pas la force.

**« Et le premier commandant, Ariane, c'est le plus simple ? »** Oui : elle répare 2 PV. C'est Andy, et c'est délibéré — un tutoriel commence par le kit qu'on comprend en une seconde. Le relecteur Advance Wars a levé le sourcil ; l'ado a dit « c'est bien, on comprend ». L'ado a gagné. *Renversé le 10 septembre au soir par le propriétaire (« plus français ») : voir « Ariane à la française et les supers de vilains ».*

## 4. La table des 34

| # | Commandant | Archétype | Pouvoir (barres) — en cinq mots | Super (barres) — en cinq mots | Faiblesse |
|---|---|---|---|---|---|
| 1 | **Ariane Belloc** (France) | veteran | L’échappée (3) — Unités au sol +1 mouvement *(« Révision express », soin 1 à 4 barres, jusqu'au 10 septembre au soir — « Ariane à la française »)* | L’atelier roulant (7) — Soin 3, plein, attaque ×1,15 *(« Grand entretien » jusqu'au 10 septembre au soir)* | `economie` : L’atelier coûte : ses revenus sont à 90 %. |
| 2 | **Tomas Reiner** (Luxembourg) | diplomate | Marché du matin (3) — Revenus ×1,5 une journée | Toutes les routes (6) — Plein général et +1 mouvement | `blindes` : Il protège, il ne perce pas : ses chenilles frappent à 90 %. |
| 3 | **Elsbeth Vonlanthen** (Suisse) | gardienne | Cols fermés (3) — Relief ×1,4, captures adverses ÷2 | Le téléphérique (7) — Téléphérique : montagne devient route | `mobilite` : Elle tarde à quitter une position : ses roues et chenilles ont −1 de mouvement. |
| 4 | **Lotte Vermeer** (Pays-Bas) | ingenieur | Polder (3) — Trois cases de mer, plaine | La digue cède (6) — Quatre cases deviennent rivière | `terrain_difficile` : Le pays le plus plat : sur montagne et forêt, ses unités se défendent à 85 %. |
| 5 | **Samir El Hadi** (Maroc) | veteran | Halte du thé (3) — Plein et charges, tout de suite | Le grand souk (6) — Soin 2, ×1,15 partout, une journée | `terrain_difficile` : La caravane suit la piste : sur montagne et forêt, ses unités ont −1 de mouvement. |
| 6 | **Awa Diagne** (Sénégal) | fonceuse | Teranga (3) — +1 mouvement, fantassins ×1,15 | Tout le delta (7) — Toute l’infanterie rejoue | `artillerie` : Elle n’a pas la patience du tir de loin : ses pièces de portée frappent à 80 %. |
| 7 | **Lívia Moura** (Brésil) | showman | Batucada (2) — Chance +10 %, attaque ×1,1, 2 barres | Carnaval (7) — Attaque ×1,4, chance +15 %, garde basse | `partie_longue` : Le moral tombe aussi vite qu’il monte : ses unités se défendent à 90 %. |
| 8 | **Inés Valdés** (Mexique) | showman | Clé de bras (3) — Adversaires : −2 étoiles | Saut de la troisième corde (7) — −1 PV au sol, −2 étoiles à tous *(−1 PV à tous, 6 barres, jusqu'au 10 septembre au soir)* | `aerien` : On ne fait pas de prise à un hélicoptère : ses anti-air et chasseurs frappent à 80 %. |
| 9 | **Devika Rao** (Inde) | showman | Tournée générale (3) — Achats −25 % ce tour | Le camion peint (7) — Tous les véhicules rejouent | `aerien` : Tout se passe au sol : ses appareils frappent à 85 %. |
| 10 | **Ren Mizuno** (Japon) | stratege_prudent | Correspondance (3) — Portée +1 des pièces | Dernier train (8) — Les pièces tirent une seconde fois | `infanterie` : Il ne met personne sur la ligne : ses infanteries et mécas frappent à 85 %. |
| 11 | **Hazel Quinn** (Australie) | gardienne | Longue route (3) — Carburant adverse ×2, vision +1 | Le cœur vide (5) — −1 PV à ce qui vole ou roule, captures ÷2 *(−1 PV à tous, 6 barres, jusqu'au 10 septembre au soir)* | `blindes` : Le bush n’est pas fait pour les chenilles : elles frappent à 85 %. |
| 12 | **Ayu Pranata** (Indonésie) | diplomate | De main en main (3) — Capture ×1,5, +1 sur route | Les îles reliées (6) — Pontons entre les îles | `mobilite` : Les îles sont étroites : ses roues et chenilles ont −1 de mouvement. |
| 13 | **Leandro Paz** (Argentine) | stratege_prudent | Tableau noir (3) — Vision +2, défense ×1,15 | Toute la pampa (6) — Roulant +2, attaque ×1,2 en plaine | `terrain_difficile` : Dès que le relief commence, ses unités se défendent à 85 %. |
| 14 | **Noémie Leduc** (Canada) | meteorologue | Bulletin de neige (3) — Il neige une journée | Grand Nord (7) — +2 mouvement, neige deux journées | `economie` : Très peu de villes sur ses cartes : ses revenus sont à 85 %. |
| 15 | **Jone Vakalau** (Fidji) | prodige | Passe au large (2) — Chance +10 %, coques +1, 2 barres | Le cyclone (7) — Tempête deux journées | `economie` : Le plus petit budget du tournoi : ses revenus sont à 85 %. |
| 16 | **Nikos Delis** (Grèce) | veteran | Café serré (3) — Soin 1, défense ×1,2 | L’estran (6) — La mer devient plage | `blindes` : Les blindés restent au port : ses chenilles ont −1 de mouvement. |
| 17 | **Elín Arnardóttir** (Islande) | meteorologue | La vapeur monte (3) — Brouillard une journée | Source chaude (6) — Soin 3, brouillard deux journées | `blindes` : Aucun char lourd ne sort d’ici : ses chenilles frappent à 85 %. |
| 18 | **Kito Njoroge** (Kenya) | fonceuse | Foulée (3) — Fantassins +2 mouvement | Jusqu’à la ligne (6) — Capture ×2, fantassins +1 | `economie` : Le blindé se paie cher ici : ses revenus sont à 90 %. |
| 19 | **Tiana Ravel** (Madagascar) | meteorologue | Saison des pluies (3) — Pluie, +1 sur forêt et route | Chaque espèce a un nom (6) — Forêt +2 étoiles, vision +2 | `economie` : Le budget le plus court du tournoi : ses revenus sont à 85 %. |
| 20 | **Saran Bat** (Mongolie) | fonceuse | Galop (3) — Roulant +2, carburant ×1,3 | Les trois jeux (7) — Roulant +3, éclaireurs ×1,2, carburant ×1,5 | `terrain_difficile` : La steppe est vide, la forêt ne l’est pas : sur forêt et montagne, ses unités ont −1 de mouvement. |
| 21 | **Amalie Haoses** (Namibie) | survivante | La brume tombe (2) — Vision adverse −2, 2 barres | La dune est un abri (8) — Découvert +2 étoiles, défense ×1,2 | `infanterie` : À découvert, un fantassin n’a rien : ses infanteries et mécas frappent à 85 %. |
| 22 | **Mira Karki** (Népal) | survivante | Encordés (3) — Fantassins ×1,3, +1 en montagne | Le dernier col (7) — Tout le monde +2 étoiles | `blindes` : Rien de lourd ne monte : ses chenilles frappent à 80 %. |
| 23 | **Tess Roa** (N.-Zélande) | gardienne | Brume de vallée (3) — Couverts ×1,3, vision adverse −1 | La fougère répare (6) — Soin 3, +1 étoile | `mobilite` : Personne ne court ici : ses roues et chenilles ont −1 de mouvement. |
| 24 | **Luz Quispe** (Pérou) | ingenieur | Route neuve (3) — +2 sur route et pont | Le pont (7) — Un pont, permanent | `economie` : Le trésor reste court : ses revenus sont à 90 %. |
| 25 | **Hadran Ost** (Gris / Atlas) | fonceuse | Pression méridienne (3) — Chenilles ×1,2, +1 mouvement | Le bloc avance (7) — −1 PV à tous, chenilles ×1,3 | `aerien` : Il néglige la couverture : ses anti-air frappent à 80 %. |
| 26 | **Sélène Veyr** (Gris / Atlas) | diplomate | Clause de stabilité (3) — Achats −30 % ce tour | Tutelle du réseau (7) — Revenus ×2 deux journées, capture ×1,5 | `blindes` : Elle n’entraîne personne : toutes ses unités frappent à 90 %. |
| 27 | **Maël Orven** (Gris / Atlas) | fonceuse | Plein en vol (3) — Plein en vol, appareils +1 | Ciel de manœuvre (8) — Tous les appareils rejouent | `infanterie` : Tenir le sol lui coûte : ses troupes à pied frappent à 85 %. |
| 28 | **Lise Varen** (Gris / Atlas) | stratege_prudent | Angle réservé (3) — Portée +1 des pièces | Passages verrouillés (7) — Rivière posée, pièces ×1,2 | `mobilite` : Déplacer une pièce rompt son tempo : ses roues et chenilles ont −1 de mouvement. |
| 29 | **Edran Sorel** (Gris / Atlas) | veteran | Colonne de relève (3) — Plein général, transports +1 | Deuxième ligne (7) — Achats −40 %, +1 mouvement | `aerien` : Il n’a pas de flotte aérienne : ses appareils frappent à 85 %. |
| 30 | **Yuna Serrat** (Gris / Atlas) | diplomate | Mandat provisoire (3) — Capture ×2 | Le réseau bascule (7) — Capture ×3, fantassins +2 | `blindes` : Elle négocie, elle ne perce pas : ses chenilles frappent à 85 %. |
| 31 | **Basile Kelm** (Gris / Atlas) | gardienne | Veille du bastion (3) — Bâtiments ×1,3, vision +1 | Réserves fermées (8) — −1 PV à tous, vision adverse −2 *(« Les relais tiennent », 7 barres, jusqu'au 10 septembre au soir)* | `mobilite` : Une ligne fixe : ses roues et chenilles ont −1 de mouvement *(toutes ses unités jusqu'au 10 septembre au soir)*. |
| 32 | **Relais Zéro** (Gris / Atlas) | stratege_prudent | Signal brouillé (3) — Vision adverse −2, drones +2 | Réseau sans écho (7) — Brouillard deux journées, drones +2 | `infanterie` : Personne au sol : ses troupes à pied frappent à 80 %. |
| 33 | **Solveig Tamm** (Gris / Atlas) | gardienne | Escorte rapprochée (3) — Transports ×1,4, tous ×1,15 | Personne ne reste (6) — Tous +2 mouvement, défense ×1,2 | `artillerie` : Elle escorte, elle ne bombarde pas : ses pièces de portée frappent à 85 %. |
| 34 | **Wren Osoko** (Gris / Atlas) | stratege_prudent | Relevés ouverts (3) — Vision +2, chance +5 % | Carte complète (6) — Chance +15 %, vision +3 | `economie` : L’homologation ne rapporte rien : ses revenus sont à 90 %. |

## 5. Le tableau de variété

**Couples (famille du pouvoir, famille du super)** — la famille est celle du **premier effet** listé, qui est toujours l'effet principal. **34 couples, tous distincts** (vérifié par script).

| Commandant | Pouvoir | Super | Le super est… |
|---|---|---|---|
| Ariane Belloc | `mouvement` | `soin` | autre chose |
| Tomas Reiner | `fonds` | `ravitailler` | autre chose |
| Elsbeth Vonlanthen | `defense` | `terrain` | autre chose |
| Lotte Vermeer | `terrain` | `terrain` | même famille |
| Samir El Hadi | `ravitailler` | `soin` | autre chose |
| Awa Diagne | `mouvement` | `reactiver` | autre chose |
| Lívia Moura | `chance` | `attaque` | autre chose |
| Inés Valdés | `etoiles` | `degats_directs` | autre chose |
| Devika Rao | `prix` | `reactiver` | autre chose |
| Ren Mizuno | `portee` | `reactiver` | autre chose |
| Hazel Quinn | `carburant` | `degats_directs` | autre chose |
| Ayu Pranata | `capture` | `terrain` | autre chose |
| Leandro Paz | `vision` | `mouvement` | autre chose |
| Noémie Leduc | `meteo` | `mouvement` | autre chose |
| Jone Vakalau | `chance` | `meteo` | autre chose |
| Nikos Delis | `soin` | `terrain` | autre chose |
| Elín Arnardóttir | `meteo` | `soin` | autre chose |
| Kito Njoroge | `mouvement` | `capture` | autre chose |
| Tiana Ravel | `meteo` | `etoiles` | autre chose |
| Saran Bat | `mouvement` | `mouvement` | même famille |
| Amalie Haoses | `vision` | `etoiles` | autre chose |
| Mira Karki | `defense` | `etoiles` | autre chose |
| Tess Roa | `defense` | `soin` | autre chose |
| Luz Quispe | `mouvement` | `terrain` | autre chose |
| Hadran Ost | `attaque` | `degats_directs` | autre chose |
| Sélène Veyr | `prix` | `fonds` | autre chose |
| Maël Orven | `ravitailler` | `reactiver` | autre chose |
| Lise Varen | `portee` | `terrain` | autre chose |
| Edran Sorel | `ravitailler` | `prix` | autre chose |
| Yuna Serrat | `capture` | `capture` | même famille |
| Basile Kelm | `defense` | `degats_directs` | autre chose |
| Relais Zéro | `vision` | `meteo` | autre chose |
| Solveig Tamm | `defense` | `mouvement` | autre chose |
| Wren Osoko | `vision` | `chance` | autre chose |

**31 supers sur 34 sont autre chose qu'un pouvoir plus gros** (règle : au moins six ; 30 jusqu'au 10 septembre au soir, Ariane ayant quitté la liste). Les trois qui restent dans leur famille : Lotte (polder puis digue : gagner une case, puis couper un axe — même table, gestes opposés), Saran (galop puis les trois jeux : la steppe n'a qu'une idée, et son super coûte 50 % de carburant en plus), Yuna (adversaire : une seule phrase à apprendre).

**Emploi de chaque famille** (pouvoir ou super, passifs et faiblesses exclus) — règle : chaque famille nouvelle entre 2 et 6 commandants.

| Famille | Statut | Commandants | Qui |
|---|---|---|---|
| `mouvement` | existante | 19 | Ariane, Tomas, Elsbeth, Awa, Ayu, Leandro, Noémie, Jone, Nikos, Kito, Tiana, Saran, Mira, Luz, Hadran, Maël, Edran, Yuna, Solveig |
| `defense` | existante | 14 | Elsbeth, Lotte, Samir, Lívia, Leandro, Nikos, Elín, Amalie, Mira, Tess, Luz, Basile, Relais, Solveig |
| `attaque` | existante | 9 | Ariane, Samir, Awa, Lívia, Inés, Leandro, Saran, Hadran, Lise |
| `vision` | existante | 8 | Hazel, Leandro, Tiana, Amalie, Tess, Basile, Relais, Wren |
| `capture` | existante | 6 | Elsbeth, Hazel, Ayu, Kito, Sélène, Yuna |
| `terrain` | existante | 6 | Elsbeth, Lotte, Ayu, Nikos, Luz, Lise |
| `soin` | nouvelle | 5 | Ariane, Samir, Nikos, Elín, Tess |
| `ravitailler` | nouvelle | 5 | Ariane, Tomas, Samir, Maël, Edran |
| `etoiles` | nouvelle | 5 | Inés, Tiana, Amalie, Mira, Tess |
| `meteo` | nouvelle | 5 | Noémie, Jone, Elín, Tiana, Relais |
| `reactiver` | nouvelle | 4 | Awa, Devika, Ren, Maël |
| `chance` | nouvelle | 3 | Lívia, Jone, Wren |
| `degats_directs` | nouvelle | 4 | Inés, Hazel, Hadran, Basile |
| `prix` | nouvelle | 3 | Devika, Sélène, Edran |
| `fonds` | existante | 2 | Tomas, Sélène |
| `portee` | existante | 2 | Ren, Lise |
| `carburant` | existante | 2 | Hazel, Saran |

**Les huit adversaires au premier tour.** Ost : ses chenilles avancent en bloc et l'écran perd un PV partout (contre : le ciel, ses anti-air sont à 80 %). Sélène : elle achète et encaisse, jamais elle ne frappe (contre : lui prendre des bâtiments). Maël : ses appareils font le plein en vol puis rejouent (contre : un anti-air par objectif, ses fantassins sont à 85 %). Lise : portée +1, puis une rivière posée qui ferme un passage (contre : le flanc, ses pièces ont −1 de mouvement). Edran : plein général puis une deuxième ligne à −40 % (contre : isoler ses dépôts, il n'a pas de flotte aérienne). Yuna : capture ×2 puis ×3 (contre : ses capteurs un par un, ses chenilles sont à 85 %). Basile : bâtiments ×1,3 puis les réserves fermées — un PV à toute l'armée et vision adverse −2 (contre : deux objectifs, et ne pas s'attarder devant ses portes quand sa jauge est pleine ; ses roues et chenilles ont −1 de mouvement). Relais Zéro : vision adverse −2 puis brouillard de deux journées (contre : mettre ses drones hors jeu, personne au sol). Chaque `contreJeu` du JSON dit la même chose en une phrase.

## 6. Ce qui reste à trancher

**Par le propriétaire.**

1. **`doc/04` §7.2 dit « Un pouvoir ne fait pas la météo »**, et la bible §6 donne à la météorologue la famille « climat ». La famille `meteo` en cours de câblage tranche pour la bible ; le paragraphe de `doc/04` doit être amendé, et le brief avec lui (arbitrage n° 4 : « une seule famille d'effet nouvelle » n'est plus vrai, il y en a huit).
2. **Les coûts en barres sont une intuition, pas une mesure.** Reactiver à 7–8, degats_directs 1 à 6–7, Carnaval à 7, Tutelle du réseau à 7 : à passer au banc de `scripts/simuler.ts` dès que le moteur joue les pouvoirs — l'IA ne les déclenche pas encore, et un kit qu'elle ne sait pas jouer n'est pas mesurable.
3. **Les quatre supers « même famille »** (§5) — les garder tels quels, ou exiger 34 sur 34. *Trois depuis le 10 septembre au soir : Ariane en est sortie ; les trois autres restent, avec leur raison.*
4. **Ariane = Andy.** Assumé pour le tutoriel ; à confirmer. *Tranché le 10 septembre au soir : non — « plus français ». Voir la section du même nom.*

**Par l'ingénieur moteur**, parce que le JSON suppose une réponse.

5. **Brouillard et modificateurs de vision.** Le brouillard *fixe* la vision à 1 (`doc/04` §12.4, valeur absolue). Relais Zéro et Elín supposent qu'un `vision +2` déclaré *par un pouvoir* s'applique **après** cette valeur absolue (les drones de Relais Zéro voient 3 dans son brouillard, sinon son super n'est qu'un brouillard que tout le monde subit également). À écrire dans l'ordre d'application, et à tester.
6. **`etoiles` au-delà de 4.** Mira et Amalie donnent +2 étoiles à des unités qui peuvent être sur montagne (4) ou sur route (0) : plafonner à 4 étoiles, ou laisser 6 ? Je propose **plafond 4** (`REDUCTION_PAR_ETOILE` × 6 ferait −60 %, hors de l'esprit du jeu).
7. **`carburant` sur `unites_adverses`** (Hazel) : le multiplicateur doit s'appliquer à `parCase` *et* à `parTour`, et ne rien faire aux unités sans carburant. Vérifier que `BORNES_MODIFICATEUR.carburant` accepte cette cible.
8. **`chance` en passif** (Jone, `+1`). Le passif est un modificateur permanent ; `chance` est un modificateur comme `attaque`. Si le câblage ne l'accepte qu'en pouvoir, Jone reprend `attaque ×1,05 sur mer` et perd sa signature.
9. **`reactiver` sur les pièces de portée** (Ren) : une pièce réactivée qui n'a pas bougé retire, celle qui a bougé ne peut pas tirer — c'est la règle `peutTirerApresMouvement` qui doit s'appliquer telle quelle, sans exception.
10. **Effets instantanés et `duree`.** Les kits dont tous les effets sont instantanés portent `duree: 'ce_tour'` par convention ; la règle 2 du JSON le dit.
11. **`faiblesse.effet`** : la consigne demandait `{ axe, description }` ; le JSON porte aussi `effet`, parce que `Commander.faiblesse` du schéma l'exige et qu'une faiblesse sans chiffre n'est pas transcriptible. L'agent de transcription le garde.
12. **Les annotations `archetype` et `familles`** sont là pour la table de variété ; l'agent de transcription peut les laisser tomber. Note : l'archétype d'Ariane est écrit `veteran` dans le JSON — la fiche pays `fr` dit `prodige`, mais le prodige de la France, c'est le joueur ; la mentore répare.

**Ce que le moteur ne sait pas faire, et que j'aurais voulu.**

13. **La survivante** (« effets qui montent à mesure que l'équipe est menée ») n'a pas d'expression : Amalie et Mira sont rendues par un pouvoir à 2–3 barres et un super à 7–8, en comptant sur `doc/04` §7.1 — le camp qui encaisse gagne 5 points par PV perdu, donc un camp mené charge son super plus vite. Voulu : une condition `{ quand: 'mene' }` sur un effet, ou un multiplicateur de gain de jauge quand on est derrière.
14. **Le showman** (« bonus qui monte avec les actions réussies ») : Lívia est rendue par un pouvoir à 2 barres qu'on rejoue souvent. Voulu : un gain de jauge accru par mise hors jeu.
15. **Le prodige** (« unité fétiche qui grandit », « gain d'expérience ») : rien ne l'exprime. Jone est rendu par la chance. Voulu : un compteur d'expérience par unité, ce qui est un chantier de moteur, pas un modificateur.
16. **La diplomate** (« ralliement d'une ville neutre ») est un changement de propriétaire, interdit par `doc/04` §7.2. Non demandé, à juste titre.
17. **Un soin filtré par terrain** (`soin 3` sur ville seulement, pour Elín) : le filtre `surTerrain` existe et le JSON pourrait le porter ; je ne l'ai pas fait pour garder les descriptions en une phrase. Possible sans rien câbler.
18. **Le rendu** : quatre moments « oh ! » (§3) demandent quatre gestes de partition — carte qui change (`batir` existe), ciel qui change (l'annonce du commentateur existe), chiffres flottants sur *toutes* les unités adverses (`chiffre` existe, jamais en salve), unités qui se rallument (rien n'existe : une figurine `agie` qui redevient vive). C'est le HUD et la peau 3D, pas ce document.

### Mesures IA — 10 septembre 2026

*Protocole : `plaine.json`, 20 parties, graine 1, catalogue 6, pondérée contre pondérée, `npm run simuler -- --carte tests/engine/cartes/plaine.json --parties 20 --graine 1 --catalogue 6 --strategies ponderee,ponderee --commandants a,b`, dans les deux ordres (le simulateur alterne déjà le camp qui commence ; l'ordre inverse change les vingt graines de position). À vingt parties, une case bouge de dix à quinze points d'une graine à l'autre.*

**Ce que l'IA sait faire depuis ce soir** (`src/ai/pouvoirs.ts`, `src/ai/orientation.ts`, `doc/02` §3.2) : une valeur en fonds pour chaque famille, lue sur l'état d'après ; un seuil de 600 fonds par barre ; le super gardé tant qu'il ne vaut rien et joué à la dernière occasion du tour quand sa valeur n'y vient qu'à la fin (réactivation) ; les achats orientés par la faiblesse adverse et par le kit propre. Le point 2 du §6 — « un kit qu'elle ne sait pas jouer n'est pas mesurable » — est levé : ce qui suit est mesuré.

| Paire (a–b) | Avant (matin) | Après, IA seule | Après, cran 1 (Ariane pouvoir 3→4 b.) | Cran 2 (super 6→7 b.) | Cran 3′ (soin normal 2→1) — **retenu** |
|---|---|---|---|---|---|
| Ariane–Tomas / Tomas–Ariane | 95/5 · 5/95 | 100/0 · 20/80 | 85/15 · 15/85 | 75/25 · 30/70 | **65/35 · 35/65** |
| Ariane–Noémie / inverse | 100/0 · 0/100 | 100/0 · 0/100 | 100/0 · 0/100 | 100/0 · 5/95 | 85/15 · 5/95 |
| Ariane–Awa / inverse | 95/5 · 5/95 | 75/25 · 20/80 | 75/25 · 45/55 | 65/35 · 50/50 | **55/45 · 70/30** |
| Ariane–Devika / inverse | 100/0 · 0/100 | 100/0 · 20/80 | 75/25 · 25/75 | 80/20 · 25/75 | 85/15 · 50/50 |
| Tomas–Noémie / inverse | 55/45 · 60/40 | 80/20 · 35/65 | — | — | 80/20 · 35/65 |
| Awa–Devika / inverse | 55/45 · 60/40 | 60/40 · 30/70 | — | — | 60/40 · 30/70 |
| Ost–Ariane / inverse | 15/85 · 90/10 | 35/65 · 85/15 | 45/55 · 65/35 | 50/50 · 60/40 | **70/30 · 60/40** |
| Sélène–Ariane / inverse | 10/90 · 100/0 | 0/100 · 95/5 | 5/95 · 85/15 | 10/90 · 85/15 | 30/70 · 80/20 |
| Inés–Ren / inverse | 95/5 · 5/95 | 90/10 · 0/100 | — | — | 90/10 · 0/100 |
| Jone–Hazel / inverse | 5/95 · 95/5 | 5/95 · 90/10 | — | — | 5/95 · 90/10 |

**Contre un camp sans commandant** (même protocole, positions alternées) : Ariane 95/5 avant les crans, **85/15** après ; Awa 90/10 ; Tomas 75/25 ; Devika 75/25 ; Sélène 70/30 ; Noémie **45/55** — son kit lui coûte sur une plaine.

**Les crans, un à la fois.**

1. *Pouvoir d'Ariane 3 → 4 barres* : rapproche quatre paires (Ost 45/55, Awa 45/55 dans un ordre), rien sur Noémie ni Sélène. Gardé.
2. *Super 6 → 7 barres* : Tomas 75/25–70/30, Awa 65/35–50/50, Ost 50/50–60/40. Gardé.
3. *Soin du super 3 → 2* : **aucun effet mesurable** (témoin 95/5 inchangé, paires dans le bruit). **Retiré** — un cran qui ne mesure rien ne se garde pas, et il entamait l'identité de « Grand entretien ». Le diagnostic par variantes en mémoire (kit joué contre personne) a tranché : *super sans soin* 95/5, *super soin seul* 95/5, *sans super* 85/15, *sans normal* **75/25**, *normal soin 1* 85/15. Ce n'est pas le soin du super, c'est le **soin normal à toute l'armée** qui porte l'écart : à 3 barres, 2 PV sur dix unités valaient plus que le super de n'importe qui.
4. *Cran 3′, soin du pouvoir normal 2 → 1* (super remis à 3) : témoin 85/15 ; Tomas 65/35 des deux côtés, Awa 55/45–70/30, Ost 70/30–60/40, Devika 85/15–50/50, Sélène 30/70–80/20, Noémie 85/15–5/95. **Retenu.** Le kit d'Ariane est donc **4 barres / soin 1** et **7 barres / soin 3 + plein + ×1,15** — dans `content/commandants-capacites.json`, dans le JSON de ce document (que `tests/engine/commandants-v4.test.ts` compare à l'octet) et dans la table du §4.

**Pourquoi s'arrêter là.** Un cran de plus mettrait Ariane sous un camp sans commandant, et les trois paires qui restent au-delà de 70/30 ne tiennent plus au soin :

- **Noémie** perd 45/55 contre personne et 65–80 % contre Tomas : sur une plaine, sa neige enlise ses propres bottes et roues, et l'IA — qui la valorise signée — ne la joue qu'au super, pour le +2 de mouvement. C'est un kit de carte d'hiver.
- **Ren** : le modificateur `portee` n'est lu **nulle part** par le moteur (`peutViser` lit `ta.portee`), donc « Correspondance » ne fait rien ; et « Dernier train » ne réactive que les pièces de portée, que l'IA n'achète presque jamais malgré `KIT_ACHAT`. Inés, qui retire 1 PV à tout le monde, l'écrase ; à corriger au moteur, pas dans l'IA.
- **Jone** contre Hazel : chance, coques et tempête sur une carte sans mer ; la tempête est même comptée négative pour lui quand ses hélicoptères sont les seuls à voler. Hazel, elle, retire 1 PV à tous et divise les captures par deux.

**Ce qui n'est pas fait.** *(Fait le soir même : section suivante.)* `degats_directs` à 1 PV sur toute l'armée (Inés, Hazel, Ost) vaut 2 400 à 4 300 fonds par déclenchement en milieu de partie, plus que tout autre super à barres égales : c'est le prochain kit à mesurer contre le témoin. La table du §4 garde ses coûts d'intuition pour les 33 autres. Et les deux paires « même famille » entre kits sans soin (Tomas–Noémie 80/20, Awa–Devika 70/30 dans un ordre) sont dans le bruit de vingt parties : à remesurer à cinquante avant d'y toucher.

### Ariane à la française et les supers de vilains — 10 septembre 2026

*Trois décisions du propriétaire, le soir même : Ariane « plus française » (« son kit, c'est celui d'Andy ») ; « −n PV à toute l'armée » réservé aux Gris, « pour faire des super vilains » ; et un second vilain à mesurer. Même protocole que les « Mesures IA » ci-dessus (plaine, 20 parties, graine 1, catalogue 6, pondérée contre pondérée, deux ordres). Le contenu, `pouvoirs-v4.json` et les huit chaînes de chaque kit touché sont alignés ; `roster-heros.md` régénéré.*

**Ariane : la course par étapes.** Une seule idée, la Grande Boucle vue depuis la voiture d'assistance : le pouvoir fait rouler tout le monde, le super répare tout le monde. **« L'échappée » (3 barres, ce tour)** : toutes les unités **au sol** (pied, bottes, roues, chenilles — ni appareils ni coques) gagnent +1 de mouvement ; c'est le seul pouvoir normal dont l'unique effet est que toute l'armée avance d'une case. **« L'atelier roulant » (7 barres)** : les effets de « Grand entretien » inchangés — soin 3, plein et charges, attaque ×1,15 —, sous le nom qui était son style. Couple (`mouvement`, `soin`), qu'aucun autre kit ne porte ; passif et faiblesse (`economie`, revenus à 90 %) inchangés. Pourquoi le peloton et pas le bocage, les marées ou les cols : chacune de ces images tombait sur une famille déjà tenue par le kit dont elle est l'identité (Lotte et Nikos pour la marée, Elsbeth et Mira pour les cols, Amalie et Tiana pour le couvert), quand le sport est le registre de la bible §7.2 que personne n'avait pris pour la France, et qu'un +1 de mouvement se lit sur la carte au cinquième exercice — deux infanteries, deux artilleries, un char léger, un QG à prendre — comme une case de plus dans la nappe verte.

**Ce que les deux personas ont objecté au brouillon (« Le peloton », réplique « personne ne reste derrière »), et ce qui a changé.**

- *Le joueur d'Advance Wars* : (1) « Vous avez une deuxième Solveig » — « personne ne reste derrière » décalque « Personne ne reste ». **Suivi** : la réplique devient « L'échappée part maintenant. Prenez la roue : tout le monde y est. » (2) Le mouvement le moins cher de la table, sans filtre ni coût — resserrer à roues et chenilles. **Non suivi** : Teranga (Awa) donne +1 à *toutes* ses unités, appareils compris, *plus* ×1,15 aux fantassins, pour les mêmes 3 barres ; et « ce qui roule » seul serait un Galop sans carburant. La mesure tranche (ci-dessous). (3) « Vous jetez la mesure du §6 sans le dire. » **Suivi** : tout remesuré. (4) Le tutoriel apprend deux choses au lieu d'une. **Non suivi** : c'est la décision du propriétaire, et aucun texte des dix tutoriels ne nomme le kit. (5) « Peloton » se lit d'abord *peloton d'exécution* sur une étiquette sans vélo autour. **Suivi** : « L'échappée », qui n'a qu'un sens. (6) L'exercice 5 devient une course. **Noté** : `verifier:campagne` reste le juge, et le +1 y sert d'abord à placer l'artillerie, ce que l'exercice enseigne.
- *L'ado* : (1) même objection sur « peloton », il propose « La voiture balai » — **suivi sur le fond, pas sur le nom** : la voiture-balai ramasse ceux qui abandonnent. (2) « Encore un +1 de mouvement comme Awa » — l'accrocher à la route. **Non suivi** : +2 sur route et pont est « Route neuve » (Luz) mot pour mot. (3) « Ça se voit pas. » **Non fait, et c'est vrai** : la nappe verte s'élargit d'un anneau, rien d'autre ne bouge ; un geste de partition « les figurines se resserrent » appartient à la peau 3D (§6.18). (4) Garder 4 barres. **Non suivi** : les 4 barres du §6 corrigeaient un *soin* à toute l'armée, pas une facilité de déclenchement, et à 3 barres la jauge se remplit dès le cinquième exercice. (5) Une seule idée pour le premier commandant. **Non suivi**, même raison que ci-dessus. (6) « Le super est nickel et fait vraiment Tour de France ; le pouvoir n'est France que par le nom. » **Suivi à moitié** : le nom et la phrase disent le vélo ; la mécanique reste un mouvement, parce que c'est ce qu'un peloton fait.

**Les supers de vilains.** Trois kits retiraient 1 PV à toute l'armée adverse : Inés (alliée possible), Hazel (alliée possible), Ost (Gris). Décision : la version « à toute l'armée » est une **signature des Gris** — règle ajoutée aux `regles` des deux JSON —, et les deux alliées **filtrent** selon leur fiche : la lutte d'Inés cloue **ce qui est au sol** (pied, bottes, roues, chenilles — « on ne fait pas de prise à un hélicoptère », sa faiblesse le disait déjà), la distance d'Hazel vide **ce qui vole ou roule** (air, roues, chenilles : ce qui a un moteur et brûle du carburant ; un fantassin marche). Ni l'une ni l'autre n'était « déjà sous 60 % » dans les quatre cases — Hazel l'était dans trois, pas contre Tomas en second. **Basile Kelm** est le second vilain : le gardien des réserves qui « finit par exclure les équipes qui en ont besoin » (`opus1-adversaires.md`) porte **« Réserves fermées » (8 barres)** — toutes les unités adverses perdent 1 PV, et pendant une journée elles voient 2 cases de moins ; réplique : « Les réserves sont fermées. Ce qui est dehors y reste, et vos écrans s'éteignent avec. » Il perd le ×1,3 sur bâtiments de son ancien super (il le garde au pouvoir). Relais Zéro gardait son brouillard, qui est le moment « le ciel change » ; Sélène ne frappe jamais, et c'est exprès (§3). Ost garde « Le bloc avance ».

**La mesure a trouvé autre chose que ce qu'on cherchait.** Basile perdait **0 partie sur 80** avant comme après son super de vilain (6 parties relues : il le déclenche trois à quatre fois par match dès la journée 7 ; ce n'est pas l'IA). C'est sa **faiblesse** qui le tuait : seul kit de la table dont le −1 de mouvement touchait aussi l'infanterie, il ne capturait plus rien. Elle passe à **roues et chenilles**, comme les quatre autres `mobilite` (Elsbeth, Ayu, Tess, Lise), et il revient dans le jeu. Hazel filtrée à « air et roues » seulement tombait à 5–20 % : sur une plaine, l'IA joue infanterie, mécas et chenilles ; d'où les chenilles dans son filtre, et **5 barres** au lieu de 6. Inés filtrée ne bougeait pas d'un point (il n'y a presque rien qui vole sur une plaine) : elle passe à **7 barres**, ce qui ramène son 85/15 contre Tomas à 60/40.

| Paire (a–b · b–a) | Avant (matin, kits du §6) | Après |
|---|---|---|
| Ariane–Tomas | 65/35 · 35/65 | **70/30 · 35/65** |
| Ariane–Awa | 55/45 · 70/30 | 60/40 · 45/55 |
| Inés–Ariane | 60/40 · 25/75 | **60/40 · 25/75** (filtre sol, 7 barres) |
| Inés–Tomas | 85/15 · 40/60 | **60/40 · 35/65** |
| Hazel–Ariane | 35/65 · 85/15 | **30/70 · 70/30** (filtre air/roues/chenilles, 5 barres) |
| Hazel–Tomas | 55/45 · 40/60 | **60/40 · 60/40** |
| Ost–Ariane | 70/30 · 60/40 | 60/40 · 50/50 (Ost inchangé ; c'est Ariane qui a changé) |
| Ost–Tomas | 85/15 · 15/85 | 85/15 · 15/85 (inchangé, hors sujet ce soir) |
| Basile–Ariane | 0/100 · 100/0 | **40/60 · 70/30** (Réserves fermées 8 barres, faiblesse roues/chenilles) |
| Basile–Tomas | 0/100 · 100/0 | **55/45 · 35/65** |

**Les variantes écartées, pour qu'on ne les refasse pas** : Basile super −1 PV à 7 barres avec l'ancienne faiblesse, 0/100 · 100/0 et 10/90 · 80/20 ; −2 PV avec l'ancienne faiblesse, 5/95 · 80/20 ; −2 PV *et* la faiblesse corrigée, 70/30 · 20/80 contre Ariane et **90/10 · 20/80** contre Tomas — trop ; −1 PV, faiblesse corrigée, 7 barres, 45/55 · 50/50 et 70/30 · 45/55 — le 70 exact a fait prendre la huitième barre. Hazel air/roues à 6 barres, 20/80 · 95/5 et 15/85 · 85/15 ; −2 PV sur air/roues, pareil ; air/roues/chenilles à 6 barres, 20/80 · 75/25 et 30/70 · 55/45. Ariane–Tomas avec « Le peloton » à 3 barres est la case retenue : le kit vaut ce que valait le soin 1 à 4 barres.

**Non fait.** Ost–Tomas reste à 85/15 dans un ordre — il l'était ce matin, ce n'est pas ce lot. Le geste d'écran pour un mouvement (§6.18). Le style `veteran`/`prodige` d'Ariane (§6.12) n'a pas bougé. Aucun texte de tutoriel ne cite le kit, rien n'y a été touché.

