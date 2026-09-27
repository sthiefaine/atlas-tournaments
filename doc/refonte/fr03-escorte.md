# FR03 gagnable, et un pilote qui sait escorter (27 septembre 2026)

`opus1_fr_03` « La voie de service » (saison 1, épisode 13) n'était gagnée par aucun des trois pilotes de `npm run verifier:campagne`, ni en normal ni en difficile : 0/2, le transport désigné mis hors jeu à J8 ou J9 sur 22 journées. La question posée était de savoir si le **pilote** ne savait pas escorter ou si la **mission** était injouable. La mesure dit : le pilote. La mission n'a pas été touchée ; le vérificateur a appris l'escorte, dans un module de l'IA réutilisable (`src/ai/escorte.ts`) pour `opus1_lu_03` « Garantie de livraison » et les hors-série d'escorte.

**Résultat** : FR03 **2/2**, gagnée par l'heuristique en **8 journées** dans les deux modes, rejeu conforme, le transport arrivé à **100 PV sans avoir été touché** ; sous vingt graines, **40/40**. Toute la campagne **48/48** ; les 46 autres couples rendent exactement la même ligne qu'avant.

## 1. Le diagnostic, chiffré

### La mission est jouable sur le papier

- Carte 18 × 14, départ du transport en (2,11), arrivée en (15,2) — « (16:3) » au briefing, compté à partir de 1. Pour des chenilles, **22 points de mouvement** par l'un ou l'autre des deux couloirs : la route de l'ouest puis celle du nord (le « détour ouest » de Solveig), ou la route du centre (y = 11, x = 8, y = 5, x = 15). À six par tour, **quatre ordres** : l'arrivée la plus rapide est J4. La limite est J22 : **dix-huit journées de marge** au départ.
- L'arrivée gagne sur-le-champ (`evaluerFin` après chaque action) : le dernier pas n'est jamais exposé. Ce qui est exposé, ce sont les cases où le transport **finit** ses tours avant.
- L'arrivée touche en diagonale l'usine (14,1) et le QG (16,1) de Tomas : ce qui y naît tient (15,1), (14,2) et (16,2) de sa zone de contrôle. L'approche par le nord se ferme dès qu'une unité y est posée ; (15,3), par le sud, reste ouverte.

### Ce qu'une frappe coûte au transport

Prévision médiane du moteur (`prevoirDuel`), passifs et faiblesses des commandants compris ; l'aléa ajoute au plus 5 %.

| Attaquant | route | plaine | forêt |
|---|---|---|---|
| infanterie, recon (les deux camps) | 46 | 41 | 36 |
| méca | 55 | 50 | 44 |
| char léger de Tomas / de Solveig | 53 / 59 | 47 / 53 | 42 / 47 |
| artillerie de Tomas / de Solveig | 56 / 52 | 50 / 47 | 44 / 42 |

Deux à trois frappes le mettent hors jeu. Les deux supers adverses changent la portée, pas les dégâts : Tomas **+1 mouvement** à toutes ses unités, Solveig **+2** (six barres chacun).

### Pourquoi le transport mourait

Trace de l'ancien pilote heuristique, graine 1, mode normal, relevée sur une copie du vérificateur d'avant (`git show 8f1938cd:scripts/verifier-campagne.ts`) instrumentée avec le modèle de menace de `src/ai/escorte.ts` :

| Journée | Transport | Va en | Risque selon l'ancien pilote | Pire réel (modèle neuf) | Cases sûres atteignables |
|---|---|---|---|---|---|
| J1 | (2,11) 100 | (2,5) | 0 | 0 | 48 / 48 |
| J2 | (2,5) 100 | (5,2) | 0 | 0 | 51 / 51 |
| J3 | (5,2) 100 | (7,2) | 0 | 0 | 49 / 61 |
| J4 | (7,2) 100 | (7,2) | 0 | 0 | 26 / 59 |
| J5 | (7,2) 100 | (7,0) | **0** | **30** — il en prend 29 | 13 / 49 |
| J6 | (7,0) 71 | (9,0) | 28 | 30 — il en prend 27 | **0** / 20 |
| J7 | (9,0) 44 | (6,0) | 0 | 30 — il en prend 30 | **0** / 34 |
| J8 | (6,0) 14 | (3,0) | 0 | 16 | **0** / 33 — hors jeu |

Trois fautes, et aucune n'est dans la mission :

1. **La protégée n'attendait jamais.** L'ancien pilote triait ses cases par risque puis par distance et en prenait une : il pouvait rester sur place, mais rien ne l'y poussait quand toutes les cases étaient menacées, et rien ne distinguait « peu de risque » de « aucun ».
2. **Son estimation du risque mentait.** Elle calculait la portée de chaque adversaire comme si le transport restait sur sa case de départ (qui bloque et tient sa zone), tenait pour fermées les cases occupées par d'autres adversaires — qui s'écartent pendant leur tour —, ignorait les pouvoirs, et lisait **toutes** les unités adverses, cachées comprises (ce qui, sous brouillard, est de la triche : `pacte_du_col` est sous brouillard). À J5 elle prédit 0 là où il prend 29. Après, le transport est cerné : plus aucune case sûre, trois journées d'affilée.
3. **Les pilotes pondéré et agressif n'escortaient pas du tout** : `jouerTour` jouait le transport comme n'importe quelle pièce de soutien, qui va ravitailler ses clients.

Sur vingt graines et les deux modes, l'ancien vérificateur gagne **0 partie sur 40**.

Une quatrième faute est apparue en écrivant le modèle neuf, et c'est elle qui a fixé la marge de jauge : une IA déclenche son pouvoir **au milieu de son tour** dès qu'une frappe a rempli la barre qui manquait. Mesuré sur un prototype du pilote (graine 5, mode normal, J11) : au moment où le transport choisissait sa case, Tomas avait 595 points sur 600 ; une frappe de son tour a rempli la barre, il a tiré son super, et deux fantassins encore immobiles ont gagné la case de mouvement qui les amenait au contact — 80 PV d'un coup sur une case prévue sûre.

## 2. Ce qui a changé

### `src/ai/escorte.ts` (neuf, pur, sans nom d'unité)

Trois règles pour la protégée, jouée **en dernier** :

1. Elle file sur l'arrivée dès qu'elle l'atteint ce tour — au besoin grâce au pouvoir de son camp : `planEscorte` essaie le pouvoir puis le super sur une copie et ne les tire que s'ils ouvrent l'arrivée (« L'échappée » d'Ariane donne +1 mouvement à tout ce qui est au sol).
2. Sinon elle va sur la case la plus proche de l'arrivée — au coût de terrain, `coutsJusqua` : un pas de forêt en vaut deux pour des chenilles — où **le pire dégât est nul** : hors d'atteinte, ou couverte parce que ses escorteurs ferment les cases de tir. Jamais sur une voisine d'un producteur adverse libre : ce qui y naîtrait la frapperait au tour suivant. S'il n'y a pas de telle case, elle attend ou recule vers la moins exposée.
3. Quand il ne lui reste plus de journée à perdre (`marge` = journées restantes − ordres nécessaires ≤ 0), elle prend la case la plus proche où elle **survit au pire**, à défaut la plus proche.

Le **pire** (`menaceEscorte`, `degatsAuPire`) est une borne : chaque adversaire **que le camp voit** (`adversesVisibles`) frappe depuis la meilleure case qu'il atteint à son prochain tour, nos unités bloquant leur case et tenant leur zone de contrôle, les siennes pouvant s'écarter ; deux attaquants directs ne partagent jamais une voisine (affectation exacte jusqu'à douze attaquants, bornée par excès au-delà) ; l'aléa au plus haut ; chaque camp adverse avec ou sans chacun des pouvoirs que sa jauge paierait **à une barre près** (`MARGE_JAUGE_ESCORTE`), modificateurs durables posés sur une copie, dégâts directs, frappe de zone, laser et impulsion qui abat comptés en plus, un super qui réactive comptant double. Les fonds adverses, cachés sous brouillard, ne sont pas lus.

`jouerTourEscorte` fait jouer une stratégie existante **telle quelle** en ne lui retirant que la protégée : la stratégie décide sur un état où la protégée a déjà joué, donc joue toute l'armée avant elle ; quand il ne lui reste qu'à produire ou à finir, la protégée joue son plan. Aucune stratégie de `src/ai/strategies/` n'a changé, et `src/ai/index.ts` non plus : le vérificateur importe le module directement.

### `scripts/verifier-campagne.ts`

- Sur une mission d'escorte (objectif `proteger` avec destination), **les trois pilotes** jouent la protégée par `planEscorte` ; les pilotes pondéré et agressif passent par `jouerTourEscorte`. L'ancienne prévision de `progresserVers`, qui lisait toutes les unités adverses, est retirée.
- L'heuristique **dégage l'arrivée** : les producteurs adverses à un mouvement de la protégée de la destination s'ajoutent à ses cibles de capture — ses capteurs y marchent, ses autres unités frappent ce qui les occupe et n'y stationnent pas —, et l'arrivée elle-même devient une case que nos unités frappent quand un adversaire la tient et ne tiennent jamais.
- `GRAINE_CAMPAGNE=<n>` rejoue sous la graine `<code>:<n>` : un outil de mesure de robustesse, la démonstration restant celle de la graine 1.

### La mission

**Inchangée** : ni `content/scenarios/opus1_fr_03.json`, ni sa carte, ni `src/content/difficulte.ts`. Rien dans la mesure ne la montre injuste ou impossible — une solution légale et simple arrive à J8 sans une égratignure dans les deux modes —, et un incrément de `version` aurait fait reposer les questions liées au scénario sans raison. La difficulté humaine, elle, n'est pas mesurée (§4).

## 3. Mesures

**La démonstration** (graine 1) : la protégée ne s'arrête que sur des cases au pire nul, recule une fois (J4, de (7,2) à (4,2)), et arrive à J8. Les deux fantassins de départ, envoyés sur l'usine et le QG de Tomas, remontent le bord nord devant elle et ferment ses approches ; les deux armées adverses descendent vers notre base.

| Journée | Normal | Difficile |
|---|---|---|
| J1 → J4 | (2,11) → (2,5) → (5,2) → (7,2) → (4,2) | idem |
| J5 → J7 | (8,0) → (10,0) → (13,0) | (8,0) → (10,0) → (15,0) |
| J8 | (15,2), arrivée | (15,2), arrivée |

**Ce que chaque ingrédient apporte** — FR03, graines 1 à 20, deux modes, 40 parties, premier pilote gagnant retenu comme dans le vérificateur :

| Pilote | Gagnées | Détail |
|---|---|---|
| ancien vérificateur | **0 / 40** | |
| ancien + dégagement de l'arrivée seul | **0 / 40** | dégager ne sert à rien si la protégée court au-devant du feu |
| escorte neuve sans dégagement | **36 / 40** | heuristique 19 (J11–J20), pondérée 15 (J12–J21), agressive 2 (J19, J21) ; 4 perdues |
| **escorte neuve + dégagement** (livré) | **40 / 40** | toutes par l'heuristique, toutes à J8 |

**Les pilotes de secours seuls**, avec `jouerTourEscorte` (mêmes 40 parties) : pondérée **30 / 40**, agressive **12 / 40** — ils ne jouent que si l'heuristique échoue.

**Toute la campagne** : **48/48**, rejeu conforme ; les 46 couples qui passaient rendent la même ligne, pilote et journée compris. Les deux autres missions d'escorte ont changé de trace sans changer d'issue : `opus1_tutoriel_07` et `pacte_du_col` sont gagnées par l'heuristique en 3 journées comme avant, mais le QG adverse, proche de leur arrivée, est devenu une cible de capture, et la protégée attend une journée sur une case sûre là où elle avançait ; sous vingt graines, les deux restent à 40/40, toutes en 3 journées, avant comme après. Durée : 11,1 s contre 11,6 s avant (FR03 ne joue plus trois défaites).

**Les tests** (`tests/ai/escorte.test.ts`, dix cas sur des situations construites à la main) : l'arrivée prise dès qu'elle est à portée ; l'arrêt sur la première case hors d'atteinte ; la case gagnée derrière un escorteur dans un couloir ; le pouvoir adverse compté à une barre près ; la règle d'échéance ; aucune attente à côté d'une usine adverse ; sous brouillard, un plan identique avec et sans l'adversaire caché ; la protégée jouée après l'armée par `jouerTourEscorte`, sans que la stratégie la voie jamais prête ; les producteurs retenus ; la lecture de l'objectif et du coût de terrain. **Témoins faits** : chacune des huit règles cassée à tour de rôle fait tomber son test.

## 4. Ce qui n'est pas vérifié

- **La difficulté humaine.** La démonstration passe par le bord nord pendant que les deux IA descendent sur notre base : un joueur peut le faire, mais rien ne dit qu'il le fera, ni que la mission est trop facile ou trop dure pour lui. L'IA adverse ne chasse pas le convoi en priorité ; elle frappe ce qu'elle rapporte le mieux.
- **Les angles morts du modèle de menace**, tous du côté de la prudence sauf le premier : une unité d'escorte mise hors jeu par le premier camp adverse **rouvre** un passage au second — le modèle suppose que nos bloqueurs tiennent tout le passage adverse ; une impulsion qui immobilise la protégée, une météo imposée et une pose de terrain ne sont pas comptées ; la zone de contrôle de la protégée elle-même est ignorée, ce qui ne fait qu'élargir la menace.
- **`opus1_lu_03` et les hors-série d'escorte** n'existent pas encore : le module n'a été exercé que sur trois missions (FR03, `opus1_tutoriel_07`, `pacte_du_col`). Une protégée embarquée, ou dont la destination est hors de portée de son type de mouvement, n'a pas de plan : le pilote la laisse à ses règles ordinaires.
- **Le reste de l'heuristique lit encore tout `etat.unites`** pour ses propres règles (`degager`, la distance aux adversaires) : ce n'est pas l'escorte, et le corriger aurait pu changer l'issue d'autres missions sous brouillard ; c'est signalé, pas fait.
