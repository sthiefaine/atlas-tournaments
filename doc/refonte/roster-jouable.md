# Le roster jouable — seize commandants, quatre secrets (12 septembre 2026)

La demande du propriétaire : « on peut faire ça mais avec **16 commandants et peut-être 4 secrets** difficiles à débloquer ». Ce qui la précède : la campagne d'Advance Wars fait tourner une douzaine de commandants, les premières missions en imposent un, puis le choix s'ouvre, et le commandant change la façon de jouer **par son passif**, avant même la jauge. Aujourd'hui le joueur commande Ariane dans 20 scénarios sur 26, et ne choisit que dans trois missions — les bancs prêtés du 10 septembre.

Ce document dit **qui est jouable, dans quel ordre ça s'ouvre, quels sont les quatre secrets et à quel prix**, et il nomme ce qui n'est pas exprimable aujourd'hui. Le canon reste `BRIEF.md` ; la doctrine des secrets est `doc/13-campagne.md` §7 (amendé le même jour, §7.4) ; le vocabulaire du prêt est `doc/01-bible.md` §4.6 ; les kits sont `content/commandants-capacites.json` révision 4, décrits en clair dans `pouvoirs-v4.md` §4 et §5.

Le contrat de sortie est `content/commandants-jouables.json`. Ce document est sa justification, pas sa copie : quand les deux divergent, **c'est le JSON qui est joué**.

## 1. La ligne qui tient tout le roster

Les kits de la révision 4 emploient **vingt familles d'effet**. Dix-sept sont ouvertes aux nations (`mouvement`, `defense`, `attaque`, `vision`, `capture`, `terrain`, `soin`, `ravitailler`, `etoiles`, `meteo`, `reactiver`, `chance`, `degats_directs`, `carburant`, `fonds`, `prix`, `portee`) ; trois sont **réservées à la faction** (`frappe_zone`, `rayon_laser`, `iem`, `doc/04` §7.2).

D'où la règle de composition, et c'est la seule qu'il faut retenir :

> **Les seize couvrent les dix-sept familles qu'une nation a le droit d'employer. Les trois familles qu'ils ne peuvent pas toucher sont celles des Gris — et c'est exactement ce que les quatre secrets achètent.**

Elle se vérifie par le tableau du §2, elle donne au joueur une raison de débloquer, et elle rend le partage lisible en une phrase : *on joue les nations et les deux fonctionnaires d'Atlas ; on débloque le gris*.

## 2. Les seize, et ce qu'ils font jouer

L'ordre est celui du fichier, c'est-à-dire l'ordre d'ouverture. La colonne de droite est le début de la ligne de goût telle qu'elle est écrite dans le JSON — verbe en tête, après la relecture du §5.

| # | Commandant | Couple pouvoir → super | Ce qui change dans la partie | Le verbe | Porte |
|---|---|---|---|---|---|
| 1 | **Ariane Belloc** (fr) | `mouvement` → `soin` | Toute l'armée au sol avance d'une case ; l'atelier rend 3 PV, le plein et les charges | Avancer, puis tout remettre debout | `debut` |
| 2 | **Tomas Reiner** (lu) | `fonds` → `ravitailler` | Une journée payée une fois et demie ; défense ×1,1 sur tout bâtiment | Compter | `opus1_tutoriel_10` |
| 3 | **Elsbeth Vonlanthen** (ch) | `defense` → `terrain` | Relief ×1,4 et captures adverses ÷2, puis un câble par-dessus la montagne | Tenir un col | `pacte_du_col` |
| 4 | **Mira Karki** (np) | `defense` → `etoiles` | +2 étoiles de terrain à **toute** l'armée, où qu'elle soit | Encaisser | `pacte_du_col` |
| 5 | **Lívia Moura** (br) | `chance` → `attaque` | Le seul super qui frappe ×1,4 en baissant sa propre garde à 0,85 | Parier | `couleurs_alliees` |
| 6 | **Inés Valdés** (mx) | `etoiles` → `degats_directs` | La ville, la forêt et la montagne ne protègent plus l'adversaire | Clouer au sol | `couleurs_alliees` |
| 7 | **Devika Rao** (in) | `prix` → `reactiver` | Un quart de remise à l'achat ; roues et chenilles rejouent | Acheter en volume | `aube_batteries_2v1` |
| 8 | **Solveig Tamm** (atl) | `defense` → `mouvement` | Transports ×1,4, puis toute l'armée avance de deux cases | Escorter | `aube_convoi_secondaire` |
| 9 | **Samir El Hadi** (ma) | `ravitailler` → `soin` | −20 % de carburant en permanence ; halte qui refait pleins et charges | Partir loin de sa base | `aube_reserves_1v2` |
| 10 | **Hazel Quinn** (au) | `carburant` → `degats_directs` | Le carburant d'en face double ; ce qui vole ou roule perd 1 PV | Étouffer | `aube_reserves_1v2` |
| 11 | **Wren Osoko** (atl) | `vision` → `chance` | Voir 3 cases plus loin, et gagner les duels serrés | Ne plus rater | `aube_archives_secondaire` |
| 12 | **Awa Diagne** (sn) | `mouvement` → `reactiver` | Toute l'infanterie rejoue son tour entier | Faire rejouer | `aube_routes_3v1` |
| 13 | **Kito Njoroge** (ke) | `mouvement` → `capture` | Fantassins +2 de mouvement, puis une ville prise en un tour | Courir aux objectifs | `aube_routes_3v1` |
| 14 | **Ren Mizuno** (jp) | `portee` → `reactiver` | Portée +1, puis les pièces tirent une seconde fois (8 barres) | Frapper sans riposte | `aube_essais_drones` |
| 15 | **Lotte Vermeer** (nl) | `terrain` → `terrain` | Gagner trois cases sur la mer ; en noyer quatre pour couper un axe | Redessiner la carte | `aube_drone_marin` |
| 16 | **Noémie Leduc** (ca) | `meteo` → `mouvement` | Il neige quand elle le décide ; au Grand Nord, elle seule avance de 2 | Imposer les conditions | `aube_essai_maritime_iem_climat` |

**Les quatre d'office et leur raison.** Ariane et Tomas sont les mentors : ils tiennent les dix exercices, l'un forme et l'autre donne la réplique. Solveig et Wren sont déjà jouables — chacune est le camp 0 d'une quête secondaire (`aube_convoi_secondaire`, `aube_archives_secondaire`) et chacune prête déjà son banc à `aube_nuit_2v2` ; les retirer laisserait deux épreuves dont le commandant ne se choisit nulle part ailleurs.

**La couverture des dix-sept familles**, une par une : `mouvement` Ariane/Awa/Kito/Solveig/Noémie · `soin` Ariane/Samir · `fonds` Tomas · `ravitailler` Tomas/Samir · `defense` Elsbeth/Mira/Solveig · `terrain` Elsbeth/Lotte · `reactiver` Awa/Devika/Ren · `chance` Lívia/Wren · `attaque` Lívia · `etoiles` Inés/Mira · `degats_directs` Inés/Hazel · `prix` Devika · `portee` Ren · `carburant` Hazel · `capture` Kito · `meteo` Noémie · `vision` Wren. Les seize couples (famille du pouvoir, famille du super) sont **distincts** — ils le sont déjà dans les 34, `pouvoirs-v4.md` §5.

**Les quatorze écartés, et pourquoi.** C'est la moitié du travail, et elle se lit :

| Écarté | Raison |
|---|---|
| **Ayu Pranata** (id) | Son super pose des pontons `depuis: ['mer','riviere']` : **inerte** sur une carte terrestre, et l'essentiel de la campagne est terrestre. Un commandant jouable doit avoir un super qui part partout. |
| **Nikos Delis** (gr), **Jone Vakalau** (fj) | Même défaut : l'estran demande de la mer, le lagon aussi. `pouvoirs-v4.md` mesure déjà « Jone naval sans mer » comme un écart de carte, pas de kit. |
| **Luz Quispe** (pe) | Seconde ingénieure de terrain après Lotte, qui porte les **deux sens** de la table (gagner une case, couper un axe). Meilleur suppléant du roster avec Amalie : voir §5, objection 3. |
| **Leandro Paz** (ar) | Son pouvoir (`vision +2` + défense) double presque celui de Wren (`vision +2` + chance) ; au menu, on ne les distinguerait pas. |
| **Saran Bat** (mn) | `mouvement` → `mouvement`, et cinq kits donnent déjà du mouvement. |
| **Elín Arnardóttir** (is), **Tiana Ravel** (mg) | Deux météorologues de plus après Noémie, chacune finissant sur une famille déjà tenue (soin, étoiles). |
| **Tess Roa** (nz) | Troisième gardienne de couvert après Elsbeth et Mira ; le relecteur Advance Wars demande expressément de ne pas l'ajouter. |
| **Amalie Haoses** (na) | Le seul aveuglement national, et un pouvoir à **2 barres** — un rythme qu'aucun des seize n'a. Écartée par manque de siège, pas par défaut : voir §5, objection 2. |
| **Sélène Veyr** | Aucun effet offensif : toutes ses unités frappent à 90 %, elle n'a ni dégât ni frappe. On la bat en lui prenant des bâtiments, et c'est le scénario qui doit l'apprendre. Sa clé `selene_veyr` ne suit d'ailleurs pas `REGEX_CODE_COMMANDANT`. Le relecteur propose d'en faire un **cinquième** déblocage : §8. |
| **Relais Zéro** | Son super à 9 barres **abat** les appareils touchés : la seule mise hors jeu directe du jeu (décision du propriétaire, 10 septembre). Non mesuré — « rien abattu en 160 parties, aucune carte de test n'a d'aéroport ». Et son identité, « l'adversaire ne voit rien », est une identité d'adversaire. |
| **Lise Varen** | Seconde `frappe_zone` après Ost, et sa Zone rouge touche ses propres unités en croix — une signature de vilain. Surtout, **la fratrie Orven est une révélation de finale 10** (`opus1-hors-serie.md`) : la débloquer avant l'éventerait. |
| **Edran Sorel** | Le seul Gris dont le super n'appartient à aucune famille de faction **et** ne comble aucun manque des seize : `ravitailler` puis `reactiver` sont tenus par Samir d'un côté, Devika et Ren de l'autre. Les quatre secrets apportent trois familles neuves plus l'aveuglement ; lui n'apporte rien qu'on n'ait déjà. |
| **Yuna Serrat** | Écartée des seize, **retenue comme secret** : elle apporte `iem`. |

## 3. L'ordre d'ouverture

Les **dix exercices imposent leur commandant** : on y apprend le jeu, pas le roster (`choixCommandant` absent, donc `aucun`). Ensuite, chaque épreuve gagnée en ouvre un ou deux. Chaque porte a une raison, et c'est ce qui la rend mémorable :

- `opus1_tutoriel_10` → **Tomas**. Il a donné la réplique aux dix ; la formation finie, son banc est le premier qu'on vous prête, à la Qualification même.
- `pacte_du_col` → **Elsbeth**, **Mira**. L'épreuve est un col ; elles sont les deux façons de le jouer — Elsbeth le ferme, Mira emmène l'armée dedans.
- `couleurs_alliees` → **Lívia**, **Inés**. L'Exhibition est un spectacle sur un plateau de qualification : les deux `showman` du canon, l'une qui met le feu, l'autre qui enlève le décor.
- `aube_batteries_2v1` → **Devika**. L'épreuve porte sur les droits de transport et la production ; elle achète en volume.
- `aube_convoi_secondaire` → **Solveig**. Sa quête ouvre son banc.
- `aube_reserves_1v2` → **Samir**, **Hazel**. L'épreuve des réserves ouvre les deux bouts du carburant : celui qui en consomme moins, celle qui en fait brûler le double à l'adversaire.
- `aube_archives_secondaire` → **Wren**. Sa quête ouvre son banc.
- `aube_routes_3v1` → **Awa**, **Kito**. L'épreuve est une coalition : « on avance ensemble », et celui qui termine.
- `aube_essais_drones` → **Ren**. L'essai est le couple qui voit et qui frappe ; ses pièces voient +1 et tirent +1.
- `aube_drone_marin` → **Lotte**. L'essai est marin, elle est la maîtrise de l'eau.
- `aube_essai_maritime_iem_climat` → **Noémie**. L'essai porte le climat dans son nom.

Douze portes pour quinze ouvertures, Ariane étant au départ. **Trois épreuves n'ouvrent personne** — `aube_nuit_2v2`, `aube_superusine`, `aube_releve_1v3` — et c'est délibéré : ce sont les portes des secrets.

## 4. Les quatre secrets

La doctrine de `doc/13` §7.1 est tenue : **jamais indispensable** (aucun fil, aucune fin, aucune destination n'en dépend ; un joueur qui n'en débloque aucun voit tout le jeu), **équilibré comme les autres** (même budget de barres, une faiblesse chiffrée et réellement défavorable), **invisible avant** — on ne montre qu'un nom d'énigme et un indice qui dit qu'il y a quelque chose sans dire quoi. Les quatre noms d'énigme désignent une **pièce**, jamais un commandant ni un pouvoir : « Le mandat provisoire » aurait recopié le nom du pouvoir de Yuna, « Le banc du Recordman » aurait employé le mot *banc*, qui veut déjà dire autre chose au briefing.

« Difficile » veut dire un accomplissement, pas une corvée. Aucune des quatre conditions ne demande de refaire une mission déjà gagnée.

| Secret | Ce qu'il apporte que les seize n'ont pas | Faiblesse réelle | Condition, en clair |
|---|---|---|---|
| **Hadran Ost** — *Le reçu manquant* | `frappe_zone` : 2 PV sur treize cases, **les siennes comprises** — et il faut **viser**, ce qu'aucun des seize ne demande | `aerien` — ses anti-air frappent à 80 % | Gagner **les routes d'Aube** (sa coalition, 3 contre 1) **et tenir le siège de quarante journées** (`aube_releve_1v3`). Ses deux épreuves les plus dures, dans les deux sens : le battre chez lui, puis lui survivre. |
| **Maël Orven** — *Le badge gratté* | `rayon_laser` : 4 PV aux deux adverses les plus avancées — le seul super **désigné** | `infanterie` — ses troupes à pied frappent à 85 % | Gagner **la ligne de nuit** (`aube_nuit_2v2`, là où le Rapace vole) **et trois matchs sans perdre une seule unité**. La Rasante punit qui pousse seul : on gagne son banc en prouvant qu'on ne laisse jamais personne devant. |
| **Yuna Serrat** — *Les trois signatures* | `iem` sans abattre : tout ce qui a un moteur est scellé, les usines touchées ne produisent pas ce tour (`usinesIem`) — et il faut viser | `blindes` — ses chenilles frappent à 85 % | **La Forge**, **le convoi de Solveig** et **les archives de Wren** — un mandat se signe à trois signatures. La seule condition qui demande d'être allé chercher les deux quêtes secondaires. |
| **Basile Kelm** — *Le Verrou* | `degats_directs` à **toute** l'armée adverse, sans filtre — la signature des Gris — **et** `vision −2`, le seul aveuglement du roster | `mobilite` — ses roues et chenilles ont −1 de mouvement | **Finir une campagne en `difficile`** et **prendre la Forge**. La plus dure des quatre, et c'est voulu : le Verrou est la pièce qui parle à tous les plastrons du terrain. |

**La justification diégétique** est déjà écrite, et elle est meilleure qu'une invention : `lore-v2.json` déclare les huit pièces des Gris **capturables**, chacune à un épisode nommé (`capturePar`) — la Batterie sans plaque à `opus1_finale_17`, le Verrou à `_07`, le Rapace à `_14`, la Borne de scellés à `_11`. Un secret n'est donc pas « un CO bonus » : c'est **une pièce sans dossier qu'on a saisie au protêt, et le banc d'essai qui va avec**. Les conditions ci-dessus sont l'expression de cette saisie sur le contenu **qui existe aujourd'hui** ; le jour où les finales seront écrites, la porte canonique est celle du `capturePar`, et ce document devra être repris.

## 5. Les deux relectures

Le roster a été relu par les deux personas du dépôt (`pouvoirs-v4.md` §2 et §3), sur les données, sans rien regarder à l'écran.

### 5.1 L'ado de quinze ans — « est-ce que je comprends en un coup d'œil qui prendre ? »

Verdict : **six lignes sur seize** comprises du premier coup. Il a trouvé trois **fautes**, pas des maladresses, et elles sont corrigées :

1. **La ligne de Tomas disait l'inverse de son super.** Elle finissait par « une ligne qui ne bouge pas de ses bâtiments » — c'est le passif ; son super fait le plein général et donne +1 de mouvement. Corrigé.
2. **Ariane et Awa avaient la même première phrase** (« tout le monde avance d'une case ») : au menu, il choisissait au hasard. Awa mène désormais par ce qu'elle est la seule à faire — *toute son infanterie rejoue son tour entier*.
3. **La ligne de Noémie mentait un peu** : la neige tombe sur les deux camps, et son pouvoir seul ne lui donne rien. La ligne dit maintenant que c'est **au Grand Nord** qu'elle est la seule à avancer dedans.

Trois autres corrections de lisibilité : le super de Samir avait disparu de sa ligne ; « le cœur vide fait le reste » (Hazel) et « tout le monde sort en même temps » (Solveig, qu'il lisait comme un débarquement) ne voulaient rien dire ; « au dernier train » (Ren) et « ×1,4 » (Lívia) sont du jargon d'initié. Et surtout : **onze lignes sur seize commençaient par « Celui qui aime »** — « je lis quatre mots identiques et je passe à la suivante ». Les seize commencent maintenant par un **verbe distinct** : *Avancer, Compter, Tenir un col, Encaisser, Parier, Clouer au sol, Acheter en volume, Escorter, Partir loin de sa base, Étouffer, Ne plus rater, Faire rejouer, Courir aux objectifs, Frapper sans riposte, Redessiner la carte, Imposer les conditions.*

Sur les secrets : « quatre cases grises, je vois qu'il y a un truc à trouver ». *Le badge gratté* est celui qui lui donne le plus envie (« aucun équipage manquant me dit comment sans me dire quoi »). Deux noms d'énigme sont refaits sur son objection — voir §4.

**Non suivi, avec sa raison** : il demande un deuxième commandant vers l'exercice 5, « juste pour que le menu existe avant la campagne ». Les dix exercices imposent leur commandant par décision de conception ; mais le menu existe bien avant la campagne, sous sa forme écrite — `pacte_du_col` propose le banc de Tomas dès la Qualification.

### 5.2 Le joueur d'Advance Wars — « seize façons de jouer, ou trois familles répétées ? »

Verdict : « neuf façons de jouer et sept quasi-copies ». Il confirme que **les trois `reactiver` ne sont pas un doublon** (filtres disjoints — pied, roues-chenilles, pièces de portée — et moitiés de pouvoir sans rapport), et que **Elsbeth et Mira sont une variation légitime**, sauvée par leurs supers, à condition de ne pas ajouter Tess en troisième. Sur les secrets : « oui, et *le battre puis le jouer* est la bonne récompense — c'est Hawke, Lash, Sturm » ; **Ost et Yuna passent haut la main** parce que viser une case est un geste qu'aucun des seize ne demande.

Quatre objections, dont **une seule porte sur le roster** :

1. **Ariane est un sous-ensemble strict d'Awa, au même prix.** Teranga (3 barres) = L'échappée (3 barres) + les appareils + ×1,15 aux fantassins. Vérifié dans le JSON, c'est exact. **Ce n'est pas un défaut de roster mais un défaut de kit**, et Ariane est verrouillée (tutoriel, mesurée trois fois) : c'est Teranga qu'il faut resserrer — le mouvement **ou** le ×1,15, pas les deux à 3 barres. Porté au §8, hors de mes fichiers.
2. **Sortir Solveig pour Amalie.** Son argument : le pouvoir de Solveig est « défense ×1,15 pour mes unités », exactement ce que la révision 4 voulait supprimer, et son super à 6 barres écrase celui de Tomas au même coût ; Amalie apporte un rythme à **2 barres** qu'aucun des seize n'a et le seul aveuglement national. **Objection notée, non suivie** : Solveig est le camp 0 d'une quête et prête déjà son banc ; la retirer laisserait une épreuve dont on ne peut choisir le commandant nulle part ailleurs, et le roster perdrait l'une de ses deux places Atlas — la ligne du §1 tombe avec. Amalie est nommée premier suppléant.
3. **Sortir Wren pour Luz.** Il a fait le calcul dans `combat.ts` : `A = 0,95 + (0,10 + 0,05 × chance) × r`, donc `chance +1` vaut **+2,5 % de dégâts moyens** et son super +7,5 % ; et `vision +2` ne fait rien sans brouillard, que les premières épreuves n'ont pas — sept des neuf épreuves où l'on choisit ont `brouillard: false`. Son super est ses deux familles en plus gros. **Objection notée, non suivie**, même raison que Solveig ; Luz est nommé second suppléant. Le calcul de la chance, lui, est un chiffre à porter au propriétaire.
4. **Maël à 5 barres est un bouton, pas une récompense** : 8 PV garantis, aucun choix de cible, le super le moins cher de la table, qu'un humain appuiera toutes les cinq barres. Il propose 7 barres, ou laisser le joueur désigner les deux cibles. **Suivi en recommandation** : c'est un chiffre de `commandants-capacites.json`, hors de mes fichiers, et c'est la correction la plus urgente des quatre.

Deux remarques de fond qu'il faut garder : **Basile est le plus faible des quatre secrets** (son `degats_directs` est déjà fait par Inés et Hazel *dans les seize*, et sa moitié « vision −2 » est près d'inerte sur sept épreuves sur neuf) — il propose de l'échanger contre Relais Zéro *si et seulement si* la campagne gagne une carte à aéroport, ce qu'elle n'a pas. Et **écarter Sélène est juste, mais pas pour la raison donnée** : « ne jamais frapper » est Colin poussé au bout et c'est le kit le plus intéressant de la table ; le vrai motif est qu'une récompense qui coûte 90 % d'attaque à vie se mérite deux fois, d'où sa proposition d'un cinquième déblocage.

**Et une trouvaille, qui vaut le reste** : voir §7, point 3. Elle est vérifiée.

## 6. Comment le jeu présente le choix

Deux phrases, et elles ne contredisent rien de `lore-v2` :

> **Avant l'épreuve, l'Intendance ouvre le Tableau des délégations : une délégation engagée à vos côtés vous prête son banc, son général dirige depuis les gradins, vous jouez son matériel et ses consignes — et l'on rend le banc au coup de sifflet final. Les bancs gris, eux, ne se prêtent pas : une pièce sans dossier se saisit au protêt, et le banc d'essai qui va avec ne s'ouvre qu'à qui l'a battue sur le terrain.**

C'est le vocabulaire exact de `01-bible.md` §4.6 : un **échange d'entraîneurs**, jamais un changement de camp. Ce qui suit en découle sans qu'on écrive une règle de plus : le choix réutilise `appliquerBanc` et donc `Incarnation` (« ce camp joue ces couleurs »), le général choisi prend le camp 0, et si le général choisi jouait déjà sur le terrain, le commandant d'origine prend sa place. Un banc **écrit** dans `Scenario.bancs` garde sa conséquence annoncée dans l'épreuve suivante ; un commandant simplement débloqué n'en a aucune — c'est pour cela que le schéma rend les deux champs exclusifs.

## 7. Les scénarios passés en `choixCommandant`

`Scenario.choixCommandant?: 'aucun' | 'debloques'` ; absent vaut `aucun`, le comportement actuel. Neuf scénarios passent en `'debloques'`, avec `version` incrémentée et `majLe` au 12 septembre :

`aube_reserves_1v2`, `aube_routes_3v1`, `aube_releve_1v3`, `aube_superusine`, `aube_essais_drones`, `aube_drone_marin`, `aube_essai_maritime_iem_climat` (les essais d'Aube), `archipel_des_deux_rades` et `bras_de_mer` (les deux parties libres).

**Restés en `aucun`, chacun avec sa raison :**

- **Les dix exercices** — on y apprend le jeu, pas le roster.
- **`pacte_du_col`, `aube_batteries_2v1`, `aube_nuit_2v2`** — ils portent déjà des `bancs` **nommés**, et `validerScenario` refuse les deux champs ensemble (« un scénario propose ses bancs nommés ou le roster débloqué, jamais les deux »). Le choix y existe, sous sa forme écrite, avec sa conséquence. Conséquence à connaître : **le vestiaire libre ne s'ouvre qu'à partir de `aube_reserves_1v2`** ; les commandants gagnés à la Qualification et à l'Exhibition attendent une épreuve avant d'être jouables.
- **`couleurs_alliees`** — c'est un **match d'incarnation** (`incarnation: { lu, cmd_tomas_reiner }`) : on y joue Tomas sous les couleurs du Luxembourg, le commandant *est* le sujet de l'épreuve. Écart assumé avec la consigne « les deux matchs officiels » : le schéma interdit déjà `bancs` sur un scénario qui a `incarnation`, et la même raison vaut ici.
- **`aube_convoi_secondaire`, `aube_archives_secondaire`** — le convoi de Solveig et les archives de Wren : le commandant est le sujet.
- **`demo`** — c'est la carte de l'attract de l'écran-titre, qui monte le jeu **sans passer par la fenêtre de mission**. Y poser un choix ferait porter un risque sur l'accueil pour rien.

Note de méthode, déjà connue : une décision locale s'enregistre sous `scenario:version`. Incrémenter la `version` de ces neuf scénarios **reposera la question** à un profil qui avait déjà décidé sous la version d'avant. C'est la conséquence mécanique de la règle d'incrément, pas un défaut.

## 8. Ce qui n'est pas exprimable dans le schéma, et ce qu'il faut poser

**Ce qui est exprimable et l'a été.** Les quatre conditions n'emploient que `et`, `flag`, `compteur` et `mode_fini`, à deux niveaux d'imbrication sur les trois permis. `validerCondition` les accepte les quatre (vérifié).

**Ce qui manque, et c'est le vrai reste.**

1. **Six flags et un compteur n'existent pas encore.** Les conditions les nomment ; personne ne les écrit. Ils suivent tous `REGEX_FLAG` et le précédent `monde.tournoi.pacte_du_col`, qui est déjà écrit par `recompenses.flags` :

   | Clé | Qui doit l'écrire |
   |---|---|
   | `monde.tournoi.aube_routes_3v1` | `recompenses.flags` du scénario, à la victoire |
   | `monde.tournoi.aube_releve_1v3` | idem |
   | `monde.tournoi.aube_nuit_2v2` | idem |
   | `monde.tournoi.aube_superusine` | idem |
   | `monde.tournoi.aube_convoi_secondaire` | idem |
   | `monde.tournoi.aube_archives_secondaire` | idem |
   | `monde.tournoi.matchs_sans_perte` | **compteur**, incrémenté à la fin d'un match gagné sans perte — la donnée existe déjà, `bilan.ts` la calcule pour le rang S/A/B/C sans lire le journal |

   Ils doivent aussi entrer dans `content/flags.json`, dont la note est formelle : « un flag absent de cette liste n'existe pas ». C'est une décision humaine, à prendre dans la bible §8 et là en même temps. *Ces sept lignes sont hors de mes fichiers : `recompenses` n'est pas `choixCommandant`.*

2. **« Gagner une mission sans perdre une unité » n'est pas exprimable comme une condition.** `Condition` ne sait pas lire un exploit ; `Scenario.recompenses.flags` se pose sur **toute** victoire. Deux voies, et la seconde est la moins chère : soit un champ `recompenses.exploits` conditionné (nouveau schéma), soit **un compteur écrit par le bilan de fin de match** — ce que je propose, parce que `bilan.ts` compte déjà les pertes en parts et rend un rang. C'est le seul point où j'ai eu besoin d'un mécanisme qui n'existe pas, et je ne l'ai pas contourné en inventant un type de `Condition`.

3. **Le drapeau qui ouvre le pouvoir ouvre aussi le matériel. Vérifié dans le code.** `estCampFaction` (`engine/regles/pouvoirs.ts`) et `uniteAutorisee` (`engine/catalogue.ts:100`) lisent **le même** `reglages.factionsParCamp`. Déclarer `factionsParCamp[campDuJoueur] = 'atl'` pour qu'Ost puisse tirer Grêle met donc, du même coup, `meridien_veilleur` (aéroport) et `meridien_bastion` (usine) dans le menu de production du joueur — et `meridien_automate` sur `aube_superusine`. Les chiffres exacts : les sept essais d'Aube sont en catalogue 7 à 9, donc tous concernés ; les deux parties libres sont en catalogue 6, où aucune des trois n'existe encore, donc rien n'y fuit. **Trois des quatre secrets sont concernés** — Ost, Maël, Yuna ; **Basile est le seul qui n'a besoin de rien**, son super étant `degats_directs` + `vision`. Deux issues, et c'est une décision, pas un correctif : séparer les deux lectures (une source pour les unités, une pour les pouvoirs), ou assumer que jouer un Gris ouvre son catalogue — ce que la fiction soutient très bien, puisqu'on a saisi sa pièce. Tant que ce n'est pas tranché, **ne pas croire un secret jouable parce qu'il apparaît au menu** : son super ne partira pas.

4. **`mode_fini` suppose un profil persisté.** `ProfilCampagne.modesFinis` n'est écrit par personne aujourd'hui (`banc-prete.md` le note déjà pour `confiance`). La condition de Basile est donc juste et inerte.

5. **Les dix généraux secrets de `doc/13` §7.2 ne sont pas ceux-ci**, et sept d'entre eux — Nera Aldouin, Célestin Vantour, Osmin Talvarec, Numéro Six, Ilva Marecq, Barnab Estève, « Craie » — **n'ont aucun kit** dans `commandants-capacites.json`. Voir `doc/13` §7.4 pour le statut de cette table.

## 9. Ce qui reste à trancher par le propriétaire

1. **Teranga contre L'échappée.** Le pouvoir d'Awa contient celui d'Ariane plus deux effets, au même prix (§5.2, objection 1). À resserrer dans `commandants-capacites.json`.
2. **Maël à 5 barres.** Le super le moins cher de la table, 8 PV garantis, aucun choix de cible. 7 barres, ou une désignation par le joueur.
3. **Le drapeau `atl`** (§8, point 3) : séparer les deux lectures, ou assumer que jouer un Gris ouvre son catalogue.
4. **Le vestiaire ouvre tard.** La première épreuve où l'on choisit librement est `aube_reserves_1v2`. Faut-il retirer les bancs nommés du `pacte_du_col`, ou accepter que la Qualification et l'Exhibition restent des bancs **écrits** ?
5. **Un dix-septième siège pour Amalie Haoses, ou un dix-huitième pour Luz Quispe** — les deux suppléants nommés par le relecteur.
6. **Un cinquième secret, Sélène Veyr**, en mode difficile, avant Basile. Le propriétaire a demandé quatre.
7. **Basile ou Relais Zéro** comme quatrième secret : la réponse dépend d'une carte à aéroport, que la campagne n'a pas.

## 10. Vérifié par du code

- `content/commandants-jouables.json` passe `validerRosterJouables` par son chargeur (`src/content/commandants-jouables.ts`) : 16 jouables, 4 secrets, 20 clés, toutes présentes dans `commandants-capacites.json`, aucune en double.
- Les quatre conditions passent `validerCondition`.
- Les quinze `ouvertPar` autres que `debut` nomment un scénario qui existe dans `content/scenarios/`.
- `tests/schemas/contenu.test.ts` : verts, les neuf scénarios modifiés compris.
- Le point 3 du §8 est vérifié en lisant `catalogue.ts`, `pouvoirs.ts`, `content/unites.json` et les `catalogueVersion` des neuf scénarios, pas déduit.

**Rien n'a été regardé à l'écran**, par consigne : ni la liste du briefing à seize entrées, ni la mise en page des indices de secret.
