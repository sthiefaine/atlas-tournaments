# Saison 1 · LU01 et LU02 — l'ouverture du Luxembourg (27 septembre 2026)

Deux fiches de `opus1-nations.json` deviennent les deux premières missions du chapitre luxembourgeois : **Le relais de Tomas** (`opus1_lu_01`, épisode 23 du fil) et **Les trois aiguillages** (`opus1_lu_02`, épisode 24). Elles suivent FR12 au parcours, qui passe à **26 missions**. Le choix de FR12, enregistré et figé dans la graine depuis le 23 septembre, prend enfin son effet dans LU01. LU03 (« Garantie de livraison », une escorte) n'est pas faite. Les fiches font foi sur le fond ; ce document dit ce qui en a été fait, ce qui a été adapté et pourquoi, et ce que la mesure dit.

**Fichiers.** `content/cartes/carte_opus1_lu_0{1,2}.json`, `content/scenarios/opus1_lu_0{1,2}.json` (version 1), deux entrées ajoutées à la fin de `content/campagne.json` (et une phrase à la conclusion de FR12 : « Votre choix comptera dans Le relais de Tomas ») ; `src/app/campagne/consequences.ts` (l'effet du choix de FR12, et les textes de ses deux options, qui ne disent plus « mission à venir ») ; `src/content/difficulte.ts` (`OUVERTURE_LUXEMBOURG`, le difficile des deux missions) ; `src/app/campagne/paysage-campagne.tsx` (deux positions et deux décors) ; `doc/refonte/opus1-nations.json` (statut des deux fiches, une note de support) et `opus1-fil.json` régénéré ; tests dans `tests/campagne/chapitre-lu.test.ts` (nouveau, douze tests), `chapitre-fr-fin.test.ts`, `tutoriels.test.ts`, `aventure-editoriale.test.ts`. **Aucune chaîne d'interface neuve**, aucun scénario d'avant touché — FR12 garde sa version, donc aucun choix déjà fait n'est reposé et aucune partie en cours n'est invalidée. Banc d'essai, générateurs et variantes de cartes dans `apercus/lu/` (non versionné).

## Distribution

| Mission | Joueur (camp 0) | Adversaire (camp 1) | Pourquoi |
|---|---|---|---|
| LU01 | la colonne de Tomas (son kit) | Lise Varen, pondérée | La fiche est un 1 contre 1 dont Tomas est le seul personnage. Lise parce que le difficile de la fiche « protège les indirects » et que les pièces lourdes sont sa manière depuis FR11 ; parce qu'elle n'est nommée ni à LU05 (Ost) ni à LU06 (Yuna, Edran) ; et parce que les Gris suivent les batteries que FR12 envoie au Luxembourg. |
| LU02 | la colonne de Tomas | Lise Varen, pondérée | La suite immédiate : repliée au dépôt, elle tient les aiguillages. Un aiguillage est un passage, et le registre des personnages fait d'elle la « commandante de l'artillerie et des passages ». |

**« Tomas et vous ».** C'est la lecture « Ariane et vous » de la France, transposée : le kit du commandant de la fiche au camp 0, et le joueur qui commande sa colonne (« Aujourd'hui, c'est ma colonne que vous commandez : je reste à la radio »). Le joueur connaît déjà cette colonne : il l'a tenue aux Couleurs alliées. **Pas de match d'incarnation** : `BRIEF.md` le veut « toujours proposé, jamais imposé », et une mission du parcours n'est pas une variante proposée. En pratique, rien n'y perd : le camp du joueur prend déjà les couleurs du Luxembourg par le `paysCode` du scénario, et ces missions n'écrivent aucun flag. **Pas de vestiaire** (`choixCommandant`) non plus : la mission tient à ce que Tomas soit là ; à trancher si l'on veut l'ouvrir.

**Les Gris jouent propre**, comme dans tout le chapitre français : aucun `factionsParCamp`, donc la Zone rouge de Lise est refusée par le moteur et seul « Angle réservé » (ses pièces tirent une case plus loin) peut partir — c'est ce que dit la scène `lu01_angle`. Les pièces sans dossier restent aux finales.

**Le vocabulaire.** Deux mots du monde, chacun expliqué à sa première apparition, dans la phrase même : le **relais** (« c'est lui qui dit à chaque convoi de la vallée où livrer ») et l'**aiguillage** (« un poste qui envoie les convois sur la bonne voie »). Un rappel « vous vous souvenez… » par mission : Lise aux Haies (FR11) dans LU01, le relais dans LU02. Aucune réplique ne dépasse 240 caractères ni deux passages en gras (test) ; ni « délégation », ni « Intendance », ni « Ronde » ; aucun lien de famille dit ou suggéré — Lise garde son nom public, et le test cherche aussi « Lise Orven ». Aucune mort.

## Les deux missions

### LU01 — Le relais de Tomas (1 contre 1, `capture_qg`, brouillard)

Forêt, 20 × 14 : l'Oesling boisé, région de la fiche pays. Une **rivière encaissée** coupe la carte du nord au sud, entre deux lignes de montagnes. Les véhicules ne la passent qu'à trois ponts : les **deux ponts du relais**, côte à côte au nord, et le **pont du sud**, que Lise ne couvre pas au départ ; l'infanterie la traverse partout, et sans escalade au **gué du nord**, où les berges sont en plaine. Le **relais** est une station radar au joueur (vision 5, même dans le brouillard), sur la rive ouest au-dessus des deux ponts, une infanterie posée dessus. Victoire : le QG de Lise, sur les hauteurs de l'est, avant la fin de J22. Défaite : QG perdu, toutes les unités hors jeu, limite.

Joueur : deux infanteries, une méca, un char léger, une artillerie, une reconnaissance ; QG, usine, relais et une ville ; 3 000 fonds, 500 par bâtiment. Lise : deux artilleries et un lance-roquettes au-dessus des ponts, un char léger, deux infanteries et un transport — **le convoi** de la fiche ; QG, usine, trois villes ; 1 500 fonds et **aucun revenu** (« budget adverse borné » ; Tomas le dit à la première perte : « sa caisse est presque vide »). Une ville neutre au nord-ouest.

**Le convoi est réel.** Contre un pilote qui ne fait que finir son tour, Lise prend le relais à J6, la ville neutre à J8, la ville du joueur à J11, son usine à J14 et son QG à J15 ; contre le pilote heuristique, elle prend encore le relais à J5. D'où la défaite : « gardez le relais d'abord, puis passez par le côté ».

**Difficile** (fiche : « une unité de couverture supplémentaire protège les indirects ; mêmes conditions de victoire ») : un char léger rejoint les pièces de Lise au-dessus des ponts à J2, plus 1 500 fonds (la convention du chapitre français), et le Bulletin à une journée. Tomas l'annonce au briefing.

### LU02 — Les trois aiguillages (1 contre 1, `capturer` deux sur trois, brouillard)

Plaine, 22 × 14 : la plaine est l'un des trois biomes de la fiche pays, et c'est là que passent les voies. Trois routes droites — nord, centre, sud — mènent du QG du joueur au dépôt de Lise. Sur chacune, un **poste d'aiguillage** : une ville à Lise, marquée en or, gardée par un fantassin et **couverte par une seule pièce** — les roquettes au centre, une artillerie sur chaque flanc (test). Victoire : **deux postes tenus en même temps** avant la fin de J16 (fiche : « deux des trois bâtiments objectifs annoncés ») ; un poste repris par Lise ne compte plus. Défaite : QG perdu, toutes les unités hors jeu, limite.

**Le choix est celui de la fiche** : « Tomas connaît le trajet le plus rapide, mais vous laisse choisir les deux passages à reprendre. » Le centre est le plus court — 13 pas du QG contre 19, un test le vérifie pour que Tomas dise vrai — mais il est sous les roquettes, qui portent le plus loin, avec le char léger de Lise à deux cases ; les flancs sont plus longs et chacun sous une artillerie. Les pilotes ne prennent pas tous le même chemin : les IA prennent le centre puis le nord, l'heuristique le sud puis le centre.

Joueur : deux infanteries, une méca, un char léger, une artillerie, une reconnaissance ; QG et usine ; deux villes neutres de son côté ; 3 000 fonds, 500 par bâtiment. Lise : les trois postes, son QG, son usine et deux villes ; les trois pièces, un char léger, trois fantassins (un par poste) et une méca ; 1 500 fonds et **200 par bâtiment** — assez pour renvoyer un fantassin reprendre un poste, ce qui donne son sens à « en même temps » ; sans revenu, la règle ne mordait jamais.

**Difficile** (fiche : « crédit adverse de 1 500 fonds maximum ») : le crédit, et rien d'autre ; le Bulletin à une journée, annoncé par Tomas. La fiche parle d'une escorte (« l'escorte et ses seuils restent identiques ») : il n'y en a pas dans cette mission, c'est la phrase commune aux fiches de ce gabarit.

## Le choix de FR12 et sa conséquence

| Option (clé · titre) | Effet dans Le relais de Tomas | Réplique de Tomas à l'ouverture |
|---|---|---|
| `verser_reserve` · Verser une réserve à la coalition | une reconnaissance du camp du joueur à **J2**, entrée par l'ouest (0,10), à côté du QG et du dépôt ; son arrivée est reportée si les cases proches sont occupées | « Aujourd'hui, **la coalition vous rend la monnaie** » (le lore v2, mot pour mot) |
| `preparation_locale` · Financer la préparation locale | **1 500 fonds** de plus au départ ; Lise n'y gagne rien | « compter ce qu'on promet, c'est mon métier » |

Au format de FR08 et FR10 : un bloc `if (scenario.code === 'opus1_lu_01')` dans `appliquerConsequences`, une réplique ajoutée à l'ouverture et un rappel au briefing qui cite le choix. La réplique est de **Tomas** : seul commandant de la fiche, il « mémorise toutes les promesses faites en route ». Aucune autre épreuve du parcours ne lit ce choix (test). **La graine ne change pas** : FR12 y avait déjà son chiffre, le douzième (`opus1_lu_01:a1:000000000002` pour la préparation locale). Les textes des deux options disent désormais ce qui arrive, au présent, sans changer le sens annoncé au joueur qui a déjà choisi.

## La carte de campagne

`POSITIONS_PARCOURS` gagne LU01 (1015,145) et LU02 (880,150) : le chapitre repart du plateau du dernier QG vers l'ouest, le long du bord nord. Deux décors : une antenne qui émet au-dessus du relais, et un faisceau de voies qui se sépare en trois près des aiguillages. `carte-parcours.tsx` lit déjà `POSITIONS_PARCOURS`, rien à y changer. **Place** : vers l'ouest, le bord nord rejoint les premiers exercices (435,225) après deux ou trois étapes, à 90 unités d'écart au moins ; les dix suivantes du chapitre demanderont de monter vers le bord ou d'agrandir la carte.

## Mesures

Pilotes de `scripts/verifier-campagne.ts` (heuristique d'objectif, IA pondérée, IA agressive) contre l'IA du scénario ; la colonne « vérificateur » est sa graine, les autres une copie de la même boucle (`apercus/lu/banc.mts`) sur six graines, plus un pilote **passif** qui ne fait que finir son tour.

`npm run verifier:campagne` complet : **50 couples sur 52**, rejeu conforme ; les deux rouges sont FR03, rouge avant ce chantier.

| Mission / mode | Vérificateur | Heuristique, 6 graines | Pondérée | Agressive | Passif |
|---|---|---|---|---|---|
| LU01 normal | gagnée, heuristique, **J19** | 5/6, J19 à J21 | 6/6, J14 à J21 | 6/6, J14 à J18 | 0/6 — QG pris à J15 |
| LU01 difficile | gagnée, pondérée, **J19** | 1/6, J19 | 5/6, J15 à J20 | 6/6, J14 à J16 | 0/6 — QG pris à J15 |
| LU02 normal | gagnée, heuristique, **J11** | 1/6, J11 | 6/6, J10 | 6/6, J10 | 0/6 — limite |
| LU02 difficile | gagnée, heuristique, **J11** | 3/6, J11 | 6/6, J10 | 6/6, J10 | 0/6 — limite |

Les branches de FR12 dans LU01, six graines (un test joue en plus chaque couple branche × mode, sans choix compris, à la graine du vérificateur avec le pilote agressif, et le gagne) :

| Branche / mode | Heuristique | Pondérée | Agressive |
|---|---|---|---|
| verser la réserve, normal | 5/6, J15 à J21 | 6/6, J15 à J17 | 6/6, J14 à J22 |
| verser la réserve, difficile | 4/6, J17 à J19 | 5/6, J17 à J22 | 6/6, J14 à J21 |
| préparation locale, normal | 3/6, J16 à J22 | 6/6, J16 à J19 | 6/6, J14 à J15 |
| préparation locale, difficile | 1/6, J18 | 5/6, J16 à J18 | 4/6, J15 à J18 |

Lecture honnête :

- **Le joueur est nécessaire** dans les deux missions : le passif perd toujours, dans LU01 parce que le convoi prend le relais puis tout le reste, dans LU02 au chronomètre après avoir perdu son usine.
- **LU01 est la plus longue** : les pilotes finissent entre J14 et J22 sur 22. Le difficile se sent chez l'heuristique (5/6 → 1/6), pas chez l'agressive.
- **LU02 est courte et le difficile ne se sent pas chez les IA** : elles gagnent à J10 dans les deux modes, par le même chemin. La fiche ne demande que le crédit ; un humain qui perd un poste le sentira peut-être, rien ne le mesure.
- **1 500 fonds de plus ne font pas gagner les pilotes plus souvent** (préparation locale : heuristique 3/6 contre 5/6 sans choix). Ils dépensent autrement et la partie bifurque ; pour un humain, ce sont 1 500 fonds de plus, pas de moins. Le test le dit par la seule chose qu'il peut garantir : chaque branche est gagnable.

**Ce qui a été essayé et écarté**, mesuré sur les mêmes six graines :

- LU01 : un premier tracé à deux ponts à mi-hauteur, puis le gué au nord, un pont double au relais et des berges plus raides partout ailleurs (la carte retenue). Deux leviers de plus, écartés : **Lise sans fonds en normal** (l'heuristique tombe à 2/6 en normal) et **le joueur à 4 000 fonds** (heuristique 3/6 en normal, agressive 4/6 en difficile) — ni l'un ni l'autre ne rendait la mission plus sûre.
- LU02 : huit variantes. Trois routes de 20 cases de large, puis les postes rapprochés du dépôt avec le centre sous deux pièces, puis 22 de large avec les postes plus loin du joueur, puis **chaque poste sous une seule pièce** — c'est ce qui rend le choix lisible : une pièce par route, et au centre celle qui porte le plus loin. Le revenu de Lise essayé à **0** (limite 18 : en normal, elle ne reprend aucun poste dans les six parties de l'heuristique, et « en même temps » ne mord jamais), à **300** (l'agressive perd six fois sur six en difficile) et à **200**, retenu, comme FR10 : elle reprend alors un poste dans deux parties sur trois de l'heuristique. La limite est ramenée à 16, les IA finissant à J10.

## Le contrôle des cartes

`npm run controler` rejette les deux cartes, comme il rejette celles du chapitre français (FR07 : 8 victoires sur 60 au camp qui commence ; FR12 : 1 sur 60) : la routine mesure une carte **symétrique** jouée par deux IA à armes égales, sans les paramètres du scénario. Une carte de mission est asymétrique à dessein — le joueur attaque une position tenue —, et c'est le scénario qui rééquilibre par les fonds, les revenus et l'objectif.

| Carte | Verdict | Motifs | Mesure |
|---|---|---|---|
| LU01 | rejetée | `avantage_premier_joueur` (bloquant), `desequilibre_villes` | le camp du joueur gagne 12 parties sur 60 à armes égales ; propriétés 4 contre 5 |
| LU02 | rejetée | `desequilibre_fonds`, `avantage_premier_joueur` (bloquant), `desequilibre_villes` | 1 sur 60 ; valeur 17,6 % d'écart ; propriétés 2 contre 7 — Lise tient le dépôt et les trois postes |

Les vérifications **structurelles** (`verifierCarte`) ne relèvent rien d'autre que ces déséquilibres voulus (test, pour les deux cartes).

## Ce qui reste non vérifié, ou à trancher

- **Rien n'a été regardé à l'écran**, par consigne : ni les deux cartes, ni la lecture des dialogues, ni les deux étapes et leurs décors sur la carte de campagne.
- **La difficulté humaine n'est pas mesurée.** Les pilotes gagnent chaque couple mission × mode à la graine du vérificateur, mais varient d'une graine à l'autre (tableaux) ; LU02 difficile n'est pas plus dur pour eux.
- **Les couleurs des camps, hors de mes fichiers et à corriger avant de jouer ces deux missions.** `toile.tsx` pose `paysParCamp: { 0: paysJoueur, 1: paysJoueur === 'lu' ? 'fr' : 'lu' }` avec `paysJoueur = scenario.paysCode`. Dans LU01 et LU02 (`paysCode: 'lu'`), le joueur prend bien les couleurs du Luxembourg, mais **Lise, une Gris, reçoit la France** : la règle de séparation la repeint en rouge (France et Luxembourg sont trop proches, test « la France contre le Luxembourg »), et **son QG est le QG national français** (`batiment_qg_fr`, le seul bâtiment national du manifeste avec celui du Luxembourg). Le même calcul donne le QG luxembourgeois au camp 1 de tout le chapitre français, souvent un Gris (Ost à FR05, Edran à FR10). Correction proposée : prendre la nation de chaque camp de `joue.commandants` par `paysDuCommandant` (`src/app/campagne/commandants-jouables.ts`, qui rend `atl` pour les Gris ; `atl` n'a pas de style, donc la couleur par défaut du camp et le bâtiment générique), le camp 0 gardant `paysJoueur`. À vérifier dans FR04 et FR12, où Tomas est un allié.
- **Les titres des options de FR12** sont ceux de la fiche ; le lore v2 en propose d'autres (« Verser la concession à la caisse de guerre commune » / « Garder la concession pour armer le front suivant »), non repris parce que le joueur a déjà lu les premiers. Et le dialogue de FR12 promet « des éclaireurs » (pluriel) quand la fiche et le lore n'en donnent qu'un (« une unité commune de reconnaissance ») ; le corriger demanderait d'incrémenter FR12, donc de reposer le choix à qui l'a fait.
- **Le vestiaire** n'est pas offert dans ces deux missions (voir plus haut).
- **Les technologies du lore v2** (`stockage_solaire` au relais, `poste_distribution` aux aiguillages) n'existent pas dans le jeu ; rien ne les capture.
- **Hors de mes fichiers, déjà signalé au lot FR10–FR12** : `avecConsequences` (`src/app/admin/cartes/consequences.ts`) ne lit que `CHOIX_AUBE`, si bien que le laboratoire et l'admin ne montrent ni les branches françaises ni celle de FR12 dans LU01.
- **`doc/refonte/roster-heros.md`** n'est pas régénéré ici : `npm run roster:heros` rend un écart de 76 lignes qui vient tout entier de `content/personnages.json` (des motivations et des croyances réécrites, entre autres), rien de ces deux missions. À régénérer par qui tient ce registre.
- **`npm test`** : 1 871 cas, 1 839 verts, **31 rouges, exactement ceux de la référence `8f1938cd`** (comparés nom par nom), un sauté ; les quatorze cas de plus sont les douze de `chapitre-lu.test.ts` et les contrats d'objectif de LU01 et LU02 (`objectifs.test.ts`), verts. Parmi les rouges d'avant, non touchés : `difficulte.test.ts` (« deux difficultés accessibles sans victoire »), `objectifs.test.ts` pour FR06, trois tests du vestiaire ; et FR03 au vérificateur.
