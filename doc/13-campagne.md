# 13 — La campagne : budget, modes, fils, généraux secrets, déblocages

*Document 13. Canon supérieur : `BRIEF.md`, section « Campagne, modes, généraux secrets, easter eggs » du 5 septembre 2026. Propriétaire du **budget de contenu**, des **gabarits de mission**, du type `Fil`, du système `Deblocage`, des **modes** et de la **sauvegarde de campagne**. `01-bible.md` reste propriétaire du lore et des noms de flags ; `08-narration-choix.md` reste propriétaire des flags, des actes et des fins ; `04-gameplay.md` reste propriétaire des règles. Tout ce qui dépasse le brief est signalé par **[Proposition]**.*

---

## 0. La question de Thief, et la réponse en trois phrases

> **« ~80 h de campagne, c'est réalisable ? »**

**Oui, et le chiffre exact est 82 h** pour un parcours en mode `normal` : 119 missions à 37,6 minutes de moyenne mesurée, plus 10 % de temps hors-match, soit environ 93 h en `difficile`. C'est **3,9 fois un Advance Wars** en heures et **4,6 fois** en nombre de missions, avec des missions **22 % plus courtes** — ce qui est exactement la manœuvre : on n'allonge pas les matchs, on en fait davantage.

**Non, pas au lancement.** Sur ces 119 missions, **40 s'écrivent à la main** — huit semaines à un scénario par jour ouvré, et ce n'est pas compressible — et **79 se produisent par les routines contre des gabarits**, à un débit réaliste de **3 scénarios certifiés par jour**, soit **27 jours de routines**. Le mur n'est donc pas la génération : c'est la colonne vertébrale, et surtout tout ce qui doit exister avant elle (les étapes 7, 8 et 9 du plan).

**Recommandation : lancer à ≈ 33 h et grandir de 12 à 15 h par mois**, pour atteindre 82 h **six mois après le lancement**. Le détail du calcul est en §2, la comparaison en §2.3, le débit en §2.5, et la recommandation argumentée — avec sa condition non négociable — en §2.7.

---

## 1. Ce que ce document décide

1. Un **budget de contenu chiffré**, ligne par ligne, vérifiable, avec ce qui est écrit à la main et ce qui est produit.
2. La **structure d'un parcours** : prologue français → tour de France → trois continents sur cinq → acte de la Cinquième Manche → finales → retours. **Le premier parcours part toujours de France** ; les autres départs s'ouvrent en **Nouvelle Ronde** (§3.5).
3. Neuf **gabarits de mission**, contrat entre la routine lore, la routine map et la routine contrôle.
4. Le type **`Fil`** et ses conséquences bornées, avec neuf fils écrits en exemple.
5. Les deux **modes** `normal` et `difficile`, et la table exacte de leurs paramètres.
6. Dix **généraux secrets** et la doctrine « jamais indispensable ».
7. Le système **`Deblocage`** et ses conditions composables.
8. La **sauvegarde de campagne** `ProfilCampagne`.
9. Les **relations de nation** dans la structure et dans le budget (§3.4), et la **Nouvelle Ronde** qu'une nation alliée ouvre (§3.5).

Ce document ne décide **pas** : les règles du jeu (`04`), les noms de flags (`01` §8), les fins (`08` §7), les easter eggs (`14`).

---

## 2. Le budget : 82 heures, et d'où elles viennent

### 2.1 La méthode

Une heure de campagne ne se décrète pas, elle s'additionne. Chaque scénario porte une `dureeVisee` en minutes (`Scenario.dureeVisee`, `03-schemas.md` §15) ; le budget est la somme de ces durées, plus le temps passé hors match. Les durées ci-dessous sont celles du mode `normal` ; celles des fils sont **les valeurs réelles** de `content/fils/*.json`, pas des estimations.

**Comment une durée se mesure.** Une simulation IA contre IA ne joue pas au rythme d'un humain : elle donne des **journées** et des **ordres**, pas des minutes. La conversion est un modèle calibré, `minutes ≈ 1,15 × journées + 0,07 × ordres` **[Proposition]**, ajusté sur une vingtaine de sessions humaines chronométrées à l'étape 3. Un match de 20 journées à 9 ordres par journée donne ainsi 20 × 1,15 + 180 × 0,07 ≈ 36 min. Le modèle est grossier et il suffit : ce qu'on veut savoir, c'est si une mission dure 20 ou 50 minutes, pas si elle en dure 36 ou 38. La routine contrôle rejette un scénario dont la durée simulée sort de la fenêtre de son gabarit (motif `partie_trop_courte` / `partie_trop_longue`, `05-routines.md` §4.3).

### 2.2 La table

| Bloc | Missions | Durée moyenne visée en `normal` | Sous-total |
|---|---:|---:|---:|
| **Prologue national** (pays phare : sélection, premier match, présentation du rival) | 4 | 25 min | **1 h 40** |
| **Tour du pays de départ — France** : 18 régions + 3 finales de zone + finale nationale | 22 | 35 min | **12 h 50** |
| **Acte I** — premier continent : 9 étapes + 1 finale continentale | 10 | 41,5 min | **6 h 55** |
| **Acte II** — deuxième continent : 9 étapes + 1 finale continentale | 10 | 43,3 min | **7 h 13** |
| **Acte III** — troisième continent : 9 étapes + 1 finale continentale | 10 | 46 min | **7 h 40** |
| **Arc de la Cinquième Manche** (points de bascule joués sur le terrain) | 8 | 45 min | **6 h 00** |
| **Finales à Port-Méridien** (demie, finale, épilogue jouable) | 3 | 60 min | **3 h 00** |
| **Retours et revanches** (revisites, rivaux jurés, cartes marquées) | 7 | 38 min | **4 h 26** |
| **Fils secondaires** — 9 fils, chiffres réels de `content/fils/` | 45 | 33,2 min | **24 h 52** |
| **Total des matchs** | **119** | **37,6 min** | **74 h 36** |
| Hors-match : dialogues, scènes de choix, carte du monde, carnet de voyage, écrans de fin (+10 %) | — | — | **7 h 28** |
| **Total, un parcours, mode `normal`** | **119 missions** | — | **82 h 04** |
| **Le même parcours en `difficile`** (durées mesurées +15 %, voir §6.4) | 119 | 43,2 min | **≈ 93 h** |

**Les matchs d'incarnation comptent dans les heures, et voici combien.** Un match d'incarnation (`Scenario.incarnation`, `03-schemas.md` §15.2 bis) est une **mission de plus**, pas une relecture d'une mission déjà comptée : il a sa carte, ses dialogues, sa certification. Il est aussi **facultatif** — sauf à l'acte III, où il ne coûte rien de neuf. L'estimation, avec les mêmes durées moyennes que la table :

| Bloc d'incarnation | Missions | Durée moyenne | Sous-total |
|---|---:|---:|---:|
| Un match d'incarnation proposé par nation alliée (2 garanties avant l'acte III, 4 au plus dans un parcours ordinaire) | 2 à 4 | 38 min | **1 h 16 à 2 h 32** |
| Les missions du fil de la nation incarnée, jouées de son côté (un fil ancré chez une alliée) | 3 | 33 min | **1 h 39** |
| **L'acte III joué à la place d'une alliée** — le choix, à chaque bataille, de la nation qu'on commande | **0** : ce sont les 10 étapes déjà comptées, jouées autrement | — | **0**, plus une variante de dialogue par étape |
| **Total, un joueur qui incarne tout ce qu'il peut** | **5 à 7** | ≈ 36 min | **≈ 3 h 00 à 4 h 10** |

Soit **environ quatre heures**, qui portent un parcours complet à **≈ 86 h** en `normal` (≈ 98 h en `difficile`). Le budget de 82 h reste celui d'un parcours qui décline chaque proposition d'incarnation — c'est le chiffre plancher, et c'est celui qu'on tient. **[Proposition]**

**Ce que le total ne compte pas**, volontairement : les Dépêches du jour (hors campagne, `08` §4.4), les rejeux, les easter eggs, les parcours avec un autre pays de départ. Un joueur qui joue une Dépêche par jour pendant sa campagne ajoute 15 à 20 h — mais il ne les *doit* à personne, et la campagne reste complète sans en jouer une seule.

### 2.3 La comparaison avec un Advance Wars

| | Advance Wars classique | Atlas Tournament |
|---|---:|---:|
| Missions de campagne | ≈ 26 | **119** |
| Durée de campagne | ≈ 21 h | **82 h** |
| Durée moyenne d'une mission | ≈ 48 min | **37,6 min** |
| Missions écrites à la main | ≈ 26 (toutes) | **40 (34 %)** |

*(Ordres de grandeur : les campagnes de la série tiennent en 22 à 30 missions et 20 à 25 heures.)*

**Ce que la table dit vraiment.** Atlas ne fait pas quatre fois un Advance Wars en allongeant les matchs : il en fait **quatre fois et demie le nombre de missions**, chacune un peu plus courte. C'est cohérent avec le reste du projet — un tournoi se joue en beaucoup de rencontres, pas en peu de sièges — et c'est ce qui rend le volume atteignable : une mission de 35 minutes contre des gabarits est produisible ; une mission de 50 minutes écrite à la main ne l'est pas 119 fois.

**Et ce qu'elle cache.** Un Advance Wars écrit ses 26 missions à la main, une par une, et chacune enseigne quelque chose. Atlas en écrit 40 à la main — plus que la campagne entière d'un Advance Wars — et compte sur les gabarits pour les 79 autres. **La qualité moyenne d'une mission d'Atlas sera donc inférieure à celle d'une mission d'Advance Wars.** Ce n'est pas un défaut à corriger, c'est le prix du format : on échange de la densité contre du volume et de la variété. Le rôle des gabarits (§4) et de la certification par simulation est de garantir que la mission générée est *bonne*, pas qu'elle est *mémorable* ; les missions mémorables sont les 40 écrites à la main, et elles sont placées là où on s'en souvient — prologues, bascules, finales.

### 2.4 Ce qui s'écrit à la main : la colonne vertébrale

| Ce qui est écrit à la main | Missions |
|---|---:|
| Prologues des quatre pays phares (France d'abord ; Luxembourg, Japon et Brésil ne s'ouvrent qu'en Nouvelle Ronde, §3.5) | 4 |
| Régions françaises de signature — celles dont la mécanique *est* la leçon | 6 |
| Trois finales de zone françaises + la finale nationale | 4 |
| Les six points de bascule de la trame (I.a, I.b, II.a, II.b, II.c, III — `08` §6) | 6 |
| Les trois finales continentales | 3 |
| L'arc de la Cinquième Manche | 8 |
| Les trois matchs de Port-Méridien | 3 |
| La première mission de six des neuf fils — celle qui donne le ton | 6 |
| **Total** | **40** |

Le reste — **79 missions** — est produit par la routine lore contre un gabarit (§4), sa carte par la routine map, et certifié par la routine contrôle **dans les deux modes**, avec relecture humaine par échantillon (une sur cinq).

**Les deux ralliements garantis (§3.4) sont dans ce total, pas en plus** : ce sont les bascules I.a et II.a, déjà comptées à la quatrième ligne. Écrire à la main les points de bascule, c'est exactement ce qui permet de garantir qu'un joueur arrive à l'acte III avec au moins deux nations alliées — une garantie de contenu ne tient que si le contenu qui la porte est écrit, pas généré.

**Et les trois prologues non français ne bloquent plus le lancement.** Ils restent dans les 40 parce qu'ils s'écrivent à la main, mais aucun premier parcours ne les traverse : ils partent dans les 12 à 15 h par mois de §2.7 (§3.5).

### 2.5 Le débit réel des routines

`atlas_lore` tourne deux fois par jour, traite six missions par run et poste douze objets au plus (`05-routines.md` §2.4) : **plafond théorique de 12 scénarios par jour**. Le débit réel est très inférieur, et pour de bonnes raisons :

| Frein | Effet |
|---|---|
| Taux de rejet du contrôle | 35 à 45 % au démarrage, 20 à 25 % en régime |
| Une mission ≠ un scénario | il lui faut aussi une `MapDef` produite par `atlas_map` et certifiée |
| Deux modes à certifier | `normal` **et** `difficile`, deux campagnes de simulation |
| `dureeVisee` à mesurer | la durée simulée doit tomber dans la fenêtre du gabarit |
| Échantillon humain | une production sur cinq relue par un humain avant mise en ligne |

**Débit réaliste : 2 à 4 scénarios certifiés par jour, disons 3.** Les 79 missions générées demandent donc **27 jours de routines**, soit **cinq à six semaines calendaires** en comptant les runs coupés, les reprises et les jours où la file est vide.

**Le coût de calcul n'est pas un mur.** L'étape 1 du plan exige 1 000 parties IA contre IA en moins d'une minute, soit **60 ms par partie**. Certifier une `dureeVisee` demande 200 parties par mode : 119 scénarios × 2 modes × 200 parties = **47 600 parties ≈ 48 minutes de calcul**. Étendue à la matrice climatique (douze combinaisons saison × météo × phase échantillonnées), la certification complète du catalogue tient en **une nuit**. On peut donc re-certifier *tout* après chaque changement d'équilibrage — et c'est ce qui rend le budget d'heures vérifiable au lieu d'être déclaratif.

### 2.6 Le vrai mur : le calendrier humain

| Poste | Coût |
|---|---|
| 40 scénarios écrits à la main (dialogues, choix, flags, équilibrage, deux modes) | **8 semaines**, à un par jour ouvré |
| 79 scénarios générés | 5 à 6 semaines de routines, **en parallèle** |
| Relecture humaine par échantillon (16 relectures × 25 min) | ≈ 7 h, négligeable |
| Neuf langues : ≈ 3 600 chaînes source × 8 langues cibles | le vrai coût de fin de projet, il vit à l'étape 12 (`09-i18n.md`) |
| **Tout ce qui doit exister avant** : étapes 7 (18 régions), 8 (24 nations), 9 (voyage, relations et fins) | **plusieurs mois**, et c'est la dépendance dure |

Autrement dit : le budget de 82 h n'est pas un problème de production de contenu, c'est un problème de **rang dans le plan**. Il ne devient atteignable qu'une fois l'étape 9 finie, parce qu'avant elle il n'y a ni carte du monde, ni actes, ni fins auxquels accrocher les 119 missions.

### 2.7 Recommandation : lancer à 33 h, grandir de 12 à 15 h par mois

| Option | Ce qu'on livre | Quand | Ce qu'on risque |
|---|---|---|---|
| **A — attendre 82 h** | tout | 6 à 8 mois après l'étape 9 | 119 missions équilibrées sans qu'un joueur y ait touché ; si le rythme de la campagne est mauvais, on l'apprend trop tard pour le corriger |
| **B — lancer à ≈ 33 h** | prologue + tour de France + acte I complet + arc court + finale + 2 fils | à la fin de l'étape 9 | un joueur assidu finit en trois semaines et attend ; il faut ensuite **tenir un rythme de sortie** |
| **C — lancer à ≈ 50 h** | B + acte II + 3 fils | 2 à 3 mois après l'étape 9 | compromis raisonnable, mais le plus dur (acte III, finales) reste inédit au lancement, donc non testé |

**Recommandation : B.** Le lot de lancement, chiffré :

| Bloc du lot de lancement | Missions | Sous-total |
|---|---:|---:|
| Prologue national | 4 | 1 h 40 |
| Tour de France (18 régions + 4) | 22 | 12 h 50 |
| Acte I complet (9 + finale continentale) | 10 | 6 h 55 |
| Arc court de la Cinquième Manche (4 bascules jouées) | 4 | 3 h 00 |
| Port-Méridien : demie + finale | 2 | 2 h 00 |
| Deux fils (« Les cars de l'Intendance », « La plume de la Régie ») | 7 | 3 h 22 |
| Hors-match (+10 %) | — | 2 h 59 |
| **Total au lancement** | **49 missions** | **≈ 33 h** |

**La condition non négociable de l'option B : le lot de lancement doit avoir une fin.** Une campagne qui s'arrête au milieu de l'acte II est pire qu'une campagne courte qui se termine. Les 33 heures ci-dessus rendent **deux fins atteignables** (fin B « L'Atlas d'Or » et fin C « Terrains fermés », `08` §7) ; les fins A et D arrivent avec l'acte III. Un joueur qui finit le lot de lancement voit un générique, lit son carnet de voyage, et sait que la Ronde continue — il n'est pas laissé sur un « à suivre ».

Ensuite : 82 − 33 = **49 heures à ajouter**. Le débit de mise en ligne n'est pas le débit des routines mais celui de la relecture et de la traduction, plus la règle du dépôt « une seule nouveauté visible à la fois » : **20 à 25 scénarios mis en ligne par mois, soit 12 à 15 heures de campagne**. Donc **3 à 4 mois de production**, **6 mois calendaires** en comptant les neuf langues et les relectures.

**Trois raisons de préférer B, et une objection honnête.**

1. La longueur n'est pas ce qui manque à un jeu qui n'est pas sorti.
2. Les 79 missions générées ne s'améliorent que par les métriques du contrôle et par les retours de joueurs. Écrites avant le lancement, elles sont produites par des routines qui n'ont jamais vu personne jouer — et le volet « prompts » du cerveau (étape 10) n'a alors rien à mesurer.
3. Le dépôt a déjà tranché ce type d'arbitrage deux fois : « le vide vaut mieux qu'une erreur » et « une seule nouveauté visible à la fois ». Livrer 82 h en un bloc contredit les deux.

**L'objection :** un jeu qui grandit après sa sortie demande qu'on tienne le rythme, mois après mois, pendant six mois. Si le rythme casse au troisième mois, le jeu reste à 55 h avec un acte III inachevé et une promesse publique non tenue — ce qui est plus coûteux qu'un lancement tardif. C'est donc un engagement de production, pas seulement une décision de contenu, et il faut le prendre comme tel.

---

## 3. La structure d'un parcours

### 3.1 La colonne

```
Prologue national  →  Tour du pays de départ  →  Acte I   →  Acte II  →  Acte III
   (4 missions)      (France : 22 ; Nouvelle Ronde : 4 à 6) (continent) (continent) (continent)
                                                     ↘  Arc de la Cinquième Manche  ↙
                                                              ↓
                                          Finales à Port-Méridien  →  Retours et revanches
                                                              ↓
                                   Nouvelle Ronde, au départ d'une nation ralliée (§3.5)
```

| Étape | Ce qui s'y joue | Ce qui s'y écrit |
|---|---|---|
| **Prologue national** | La sélection : un match d'entrée, la présentation du rival naturel, la première scène de choix. **Au premier parcours, c'est le prologue français** | `pays.fr.visite`, la première relation `cmd.<id>.*` |
| **Tour du pays de départ** | La qualification. La France se qualifie sur ses 18 régions (`07-france-regions.md`) ; en Nouvelle Ronde, les autres pays sur 4 à 6 étapes construites depuis leur fiche | `pays.fr.regions_visitees`, `pays.<xx>.qualifie` |
| **Actes I à III** | Trois continents sur cinq, choisis par le joueur sur la carte du monde. Un continent = un acte (`08` §6) | `pays.<xx>.*`, `monde.atlas.*`, `monde.cinquieme.*`, et le recalcul de `relations` à chaque fin d'étape |
| **Arc de la Cinquième Manche** | Les six points de bascule, joués sur le terrain plutôt que lus | `monde.cinquieme.contact`, `.infiltre`, `.demasquee`, `.chef_identifie` |
| **Finales à Port-Méridien** | Demie, finale mondiale, et l'épilogue jouable de la fin obtenue. **Qui est là, et qui manque, se lit dans `relations`** | `monde.cinquieme.ralliements` (dérivé), la fin |
| **Retours et revanches** | Revisites des pays marqués, rivaux jurés, cartes qui gardent leurs traces | `pays.<xx>.terrain_altere`, `cmd.<id>.rival_jure` |
| **Matchs d'incarnation** | Une nation alliée prête son banc : le joueur la joue entièrement, avec son général et son catalogue (§3.4 bis). Proposés à partir de l'acte I, **obligatoirement choisis à l'acte III** — parmi les alliées | `pays.<nation incarnée>.*` et `cmd.<id>.*`, **jamais `monde.*`** ; la `confiance` du général monte |
| **Nouvelle Ronde** | Un second parcours, au départ d'une nation ralliée pendant le premier (§3.5) | Un nouveau `ProfilCampagne` ; seuls `deblocages`, `secretsTrouves`, `modesFinis` et `serieDepeches` se transmettent (§9) |

### 3.2 Ce que change le pays de départ

**Au premier parcours, rien : c'est la France, pour tout le monde** (`BRIEF.md`, « Le joueur et le départ », révisé le 5 septembre 2026 au soir). Ce paragraphe décrit donc ce que change un départ de **Nouvelle Ronde**, une fois qu'une nation a été ralliée (§3.5).

Le brief est net : **le pays de départ change le prologue et l'ordre, pas la longueur**. Concrètement :

| Ce qui change | Ce qui ne change pas |
|---|---|
| Le prologue (écrit à la main pour les quatre pays phares, construit depuis la fiche pour les vingt autres) | Le nombre total de missions du parcours |
| La longueur du tour national : 22 missions pour la France, 4 à 6 pour les autres | Le budget total : un tour national court est compensé par une étape continentale de plus |
| Le continent de l'acte I — on commence toujours par le sien (`01-bible.md` §4.2) | La règle « trois continents sur cinq, et le dernier jamais visité » |
| Les deux ou trois premières destinations proposées | Les six points de bascule et les quatre fins |
| Le rival naturel, donc quel commandant revient | Les gabarits, les modes, les plafonds |
| Les fils accessibles tôt (un fil ancré en `fr` s'ouvre plus tôt pour un joueur français) | La liste des fils : aucun n'est réservé à un pays de départ |

**Conséquence de production :** un tour national court coûte **une étape continentale de plus**, soit 4 à 5 missions supplémentaires à l'acte I. C'est ce qui égalise les parcours sans écrire 24 campagnes.

### 3.3 La carte du monde et les deux ou trois destinations

À la fin de chaque étape, l'Intendance d'Atlas propose **deux ou trois pays hôtes** pour la suivante. La règle de proposition **[Proposition]** :

1. **Toujours au moins une destination du continent courant**, tant que l'acte n'est pas fini (3 à 5 étapes par continent, `01-bible.md` §4.2).
2. **Toujours au moins une destination que le joueur n'a jamais visitée.**
3. **Jamais un pays dont un flag rend la carte injouable** — un pays dont `terrain_altere ≥ 3` ne réapparaît qu'en revisite scénarisée, jamais en étape ordinaire (`08` §5, plafond de trois traces).
4. **La troisième destination, quand elle existe, est celle d'un fil en cours.** C'est ainsi qu'un fil se joue sans écran séparé : il occupe une case de la carte du monde.
5. Le choix pose `pays.<xx>.visite` et **rien d'autre** : c'est le voyage qui écrit ce flag, pas une scène (`08` §2.3).

Le continent laissé de côté n'est pas perdu : ses pays « suivent la majorité de leur continent » au ralliement de l'acte III (`08` §6), et c'est ce qui rend un second parcours différent du premier.

**Ce que la relation ajoute aux cinq règles.** Une nation `retiree` n'est **jamais proposée** : sa destination est éteinte, comme un pays dont `terrain_altere ≥ 3` (règle 3). Une nation `rivale` peut l'être aussi, si son grief a fermé sa porte — mais elle revient toujours par une revanche scénarisée, jamais par une case ordinaire. Une nation `alliee`, elle, propose **plus** : sa destination porte une scène de retrouvailles et l'accès à son unité spéciale. Conséquence de production à ne pas manquer : le générateur de destinations doit toujours pouvoir remplir deux cases, retirées comprises — c'est vérifié par simulation, comme le reste.

### 3.4 Les relations dans la structure, et dans le budget

Les vingt-quatre nations ne sont pas un menu de départ : ce sont des **relations** (`RelationNation`, `03-schemas.md` §15.3 bis ; les seuils et le calcul sont dans `08-narration-choix.md` §4.5). Ce paragraphe dit ce que cela **coûte** et ce que cela **place** dans la colonne.

**Ce que la colonne vertébrale doit garantir, et qui ne se génère pas.**

| Garantie | Où elle est placée | Coût en missions écrites à la main |
|---|---|---|
| **Au moins deux alliées avant l'acte III** | Deux occasions de ralliement plantées dans la colonne, une par acte (I et II), qui **ne dépendent pas du même registre de choix** — l'une se gagne par le fair-play en fin de match, l'autre par un service rendu hors match. Un joueur ne peut pas rater les deux sans le vouloir | **2** (déjà comptées dans les 40 de §2.4 : ce sont deux points de bascule, pas des missions neuves) |
| **Au plus cinq retirées** | Rien à écrire : le schéma refuse la sixième (`BORNES_RELATIONS.retireesMax`), et la scène qui l'aurait provoquée se joue en version « il reste, mais il ne vous parle plus » | **0**, plus **1 variante de dialogue** par scène de retrait |
| **Jamais de fin inaccessible** | Chaque fin (`08` §7) est évaluée sur des flags de monde, jamais sur la présence d'une nation donnée. Une retirée change **qui est dans la salle**, jamais **quelle salle s'ouvre** | **0**, vérifié par simulation |
| **Une scène de retrait qui prévient** | Un retrait demande un double grief (`08` §4.5) ; la scène qui pose le second dit en toutes lettres ce qu'elle va coûter | **≤ 5 scènes**, une par retrait possible dans un parcours |

**Ce que ça change au budget de §2.2 : rien, et c'est le point.** Les relations ne sont pas un bloc de missions supplémentaire — elles sont une **relecture** de missions déjà comptées. Les deux ralliements garantis sont des points de bascule de l'arc de la Cinquième Manche (8 missions déjà budgétées), les scènes de retrait sont du hors-match (les +10 %), et les variantes de dialogue sont ce que les fils produisent déjà. Le seul poste réellement nouveau est la **production d'unités spéciales alliées** : 24 unités spéciales qui doivent être équilibrées comme jouables par le joueur et plus seulement contre lui, ce qui est un coût de **simulation** (routine contrôle) et non d'écriture.

**Le plafond par match.** Une nation alliée rend son unité spéciale **produisible en quantité bornée par match** — la borne exacte est une règle de jeu et appartient à `04-gameplay.md`. Ce document n'en retient qu'une conséquence de budget : la routine contrôle simule chaque scénario **avec et sans** les unités spéciales que le joueur peut légitimement avoir à ce point du parcours, exactement comme elle simule `normal` et `difficile`. Un scénario qui devient trivial parce que le joueur a rallié trois nations n'est pas mis en ligne. **[Proposition]**

### 3.4 bis Les matchs d'incarnation

**Une alliée ne se contente pas d'aider : on peut la jouer.** Un **match d'incarnation** (`Scenario.incarnation`, `03-schemas.md` §15.2 bis) donne au joueur le général de la nation, son catalogue — unité spéciale comprise —, sa spécialité et son style ; son propre commandant reste au banc en co-commandant passif (`04-gameplay.md` §7.5). C'est la même campagne, vue depuis l'autre banc.

**Où ils se placent dans la colonne.**

| Où | Ce qui est proposé | Imposé ? |
|---|---|---|
| **Actes I et II**, après un ralliement | Un match d'incarnation de la nation ralliée : sa propre étape de la Ronde, jouée par le joueur | **Non.** Une variante offerte de l'étape, jamais l'unique chemin |
| **Fils secondaires ancrés chez une alliée** | Les missions du fil, jouées du côté de la nation | **Non.** Un fil est déjà facultatif |
| **Acte III** | À **chaque bataille**, le choix de la nation qu'on commande, **parmi ses alliées** | **Le choix** est imposé, pas une nation en particulier : décliner, c'est jouer sa propre nation, ce qui reste une option de la liste |

**Ce que ça coûte, et ce que ça ne coûte pas.** Cinq à sept missions neuves dans un parcours qui incarne tout, soit ≈ 4 h (§2.2). L'acte III ne coûte **aucune mission neuve** : ses dix étapes sont déjà budgétées, elles se jouent seulement avec un autre banc — le coût y est une **variante de dialogue** par étape et une **certification de plus** par nation jouable, la routine contrôle simulant l'étape avec le catalogue de chaque alliée possible comme elle la simule en `normal` et en `difficile`.

**Les trois bornes, et où chacune est tenue.**

| Borne | Tenue par |
|---|---|
| **Aucun flag de la trame principale.** Un match d'incarnation n'écrit que `pays.<nation incarnée>.*` et `cmd.*` | Le **schéma** : `validerScenario` refuse tout `monde.*` et tout `pays.*` étranger, en récompense comme dans une option de choix (`08` §4.5) |
| **La nation incarnée ne se retire pas pendant qu'on la joue** | Conséquence de la borne précédente : un retrait demande deux griefs qui se rencontrent, et un match d'incarnation n'écrit aucun des flags qui les comptent. Rien à écrire de plus, rien à vérifier à la main |
| **Toujours proposé, jamais imposé** — sauf le choix de l'acte III | Le **contenu** : la colonne vertébrale place un match d'incarnation en **variante** d'une étape, jamais en remplacement. Une colonne qui l'imposerait rendrait le parcours dépendant d'un ralliement, ce que §3.4 interdit |

**La confiance, et son unique palier.** Incarner fait monter `ProfilCampagne.confiance[commandantCle]`, de 0 à 3 (`03-schemas.md` §15.9). À **3**, le général devient co-commandant à **jauge entière** et sa nation s'ouvre comme **départ de Nouvelle Ronde** (§3.5). Aux niveaux 1 et 2, elle ne donne que des dialogues : c'est délibéré, une échelle de puissance à quatre crans serait une seconde monnaie à équilibrer. **[Proposition]**

**Le banc prêté au briefing — 10 septembre 2026.** Une étape ordinaire peut proposer, **avant le montage**, de se jouer sous les couleurs d'une autre délégation : `Scenario.bancs` (`BancPrete { commandantCle, paysCode, libelle }`) liste les bancs offerts, et le briefing les présente à côté du commandant du scénario, qui reste le défaut — « Jouer sous les couleurs du Luxembourg, avec Tomas Reiner », avec le style et le kit joué (pouvoir et super) et la suite annoncée. C'est la mécanique d'incarnation **choisie** plutôt qu'écrite : le choix retenu devient l'`incarnation` du scénario effectif, le général prêté prend le camp 0 et `sceneDepuis` ne change pas d'une ligne. Le vocabulaire est celui de `01-bible.md` §4.6 — un **échange d'entraîneurs** : si le général prêté jouait déjà sur le terrain, il y laisse le commandant du joueur (au Pacte du col, Ariane tient le banc de Tomas) ; s'il vient de l'extérieur, le commandant du joueur quitte le terrain et ses consignes de banc passent au général prêté. Trois différences avec un match d'incarnation, et elles tiennent aux trois bornes ci-dessus : un banc est **toujours proposé, jamais imposé** (décliner est la première option de la liste) ; l'étape garde ses flags, c'est une variante et non une mission de plus ; et la conséquence est une **mini-branche bornée** à l'épreuve suivante, annoncée au moment du choix, par le mécanisme des décisions locales (`src/app/campagne/consequences.ts`, source `<scenario>:banc`, figée dans la graine, rejouable). Le choix se refait à chaque nouvelle partie de l'épreuve ; le carnet le montre comme les autres décisions. Trois épreuves en portent aujourd'hui : le Pacte du col (Tomas → un transport à J2 aux Couleurs alliées et une réplique d'Ariane), le Détour des batteries (Tomas → 1 500 fonds à la Ligne de nuit) et la Ligne de nuit (Solveig ou Wren, deux bancs de l'Intendance → deux répliques aux Routes d'Aube). `doc/refonte/banc-prete.md` dit comment en ajouter un.

### 3.5 La Nouvelle Ronde

**Une nation alliée se débloque comme pays de départ.** C'est la seule porte : on ne choisit pas son départ dans un menu de vingt-quatre, on le **gagne** en ralliant la nation dans une partie précédente.

Mécaniquement, c'est un `Deblocage` ordinaire, sans mécanisme nouveau (§8) :

```json
{
  "cle": "deb_depart_jp",
  "libelle": "Le Japon comme pays de départ",
  "condition": { "type": "relation", "pays": ["jp"], "relation": "alliee", "combien": 1 },
  "recompense": { "type": "depart_nation", "ref": "jp" },
  "cache": false
}
```

**Ou une confiance de trois, ce qui est la même porte.** Un joueur qui a **incarné** une nation jusqu'à la confiance 3 de son général ouvre son départ, même si la nation n'est pas passée `alliee` — c'est un `ou` dans la même condition, pas un second mécanisme :

```json
{
  "condition": {
    "type": "ou",
    "conditions": [
      { "type": "relation", "pays": ["ch"], "relation": "alliee", "combien": 1 },
      { "type": "confiance", "commandantCle": "cmd_elsbeth_vonlanthen", "min": 3 }
    ]
  },
  "recompense": { "type": "depart_nation", "ref": "ch" }
}
```

Rallier une nation et gagner la confiance de son général sont deux gestes différents — l'un se fait par les choix qu'on prend chez elle, l'autre par les matchs qu'on joue pour elle — et ils ouvrent la même porte. **[Proposition]**

- **`cache: false`**, toujours : le joueur doit voir qu'une nation ralliée ouvre un départ, sinon la mécanique n'existe pas pour lui. La carte du monde le dit pendant la partie, l'écran de fin le récapitule.
- **Une Nouvelle Ronde est un nouveau parcours, pas une suite** : un nouveau `ProfilCampagne`, de nouveaux flags, un nouvel itinéraire. Ce qui se transmet est exactement ce que dit §9 — les déblocages acquis, les secrets, les modes finis, la série de Dépêches. **Les relations, elles, ne se transmettent pas** : on repart neutre partout, sauf que le départ, lui, a changé.
- **Le budget ne bouge pas** : un tour national court (4 à 6 étapes) est compensé par une étape continentale de plus (§3.2). Une Nouvelle Ronde dure ce que dure un parcours.
- **Ce que ça règle pour la production**, et c'est la vraie raison de la révision : les vingt-trois prologues non français quittent le chemin critique du lancement. Aucun joueur ne peut les rencontrer avant d'avoir fini une Ronde, donc ils s'écrivent **après** le lancement, dans les 12 à 15 h par mois de §2.7 — au lieu d'être vingt-trois portes d'entrée à ouvrir toutes ensemble.

---

## 4. Les gabarits de mission

Un **gabarit** est la forme qu'une mission générée doit prendre. C'est le contrat commun aux trois routines : la routine lore choisit un gabarit et l'habille, la routine map produit une carte qui rentre dans ses bornes, la routine contrôle vérifie que la partie simulée tombe dans la fenêtre de durée — **dans les deux modes**.

Liste fermée de neuf, propriétaire de ce document, publiée en `content/gabarits-missions.json` et typée par `GabaritMission` (`03-schemas.md` §15).

| Clé | Structure | Durée visée | Journées | Côté de carte | Hooks narratifs | Ce qu'il interdit |
|---|---|---:|---:|---:|---|---|
| `capture_qg` | Deux QG, symétrie de valeur, montée en puissance classique | 28–45 | 14–22 | 14–24 | présenter un adversaire, installer une rivalité, faire découvrir une mécanique | aucun objectif spécial en plus |
| `tenir` | Tenir 2 à 4 points désignés N journées contre une IA qui produit plus | 22–36 | 10–16 | 12–20 | un renfort annoncé, un allié qui demande du temps, une décision d'arbitrage suspendue | gagner par capture du QG adverse |
| `escorte` | Une unité nommée traverse la carte ; elle est lente, fragile, et tout le monde sait où elle va | 30–48 | 12–20 | 16–28 | un convoi d'homologation, une archive à sortir, un adversaire qu'on raccompagne | que l'unité escortée attaque ou ait un pouvoir |
| `relais` | Capturer des points dans un ordre imposé : chaque capture ouvre la suivante | 26–42 | 12–18 | 16–26 | un tour de région, un relevé à refaire, une épreuve d'orientation locale | plus de cinq points de relais |
| `course` | Deux camps courent au même objectif ; se battre coûte le temps qu'on n'a pas | 18–30 | 8–14 | 12–22 | un pari du vestiaire, une rivalité pure, un public déjà acquis | la victoire par mise hors jeu totale |
| `survie` | Survivre N journées avec des fonds nuls ou la production coupée | 22–34 | 10–16 | 12–20 | une nuit longue, une tempête annoncée, une équipe privée de matériel | tout renfort produit par le joueur |
| `siege` | L'adversaire tient une position fortifiée, le joueur a l'avantage économique | 40–65 | 18–28 | 18–30 | une finale continentale, un point de bascule, un adversaire sans rien à perdre | deux sièges d'affilée dans une même étape |
| `revanche` | Retour contre un commandant nommé : équipe renforcée, pouvoir amélioré, objectif personnel | 35–55 | 16–24 | 14–24 | un rival juré, un rival d'estime, une dette réclamée ou payée | un adversaire jamais rencontré |
| `exhibition` | Manche courte hors classement, roster réduit, une seule mécanique en avant | 12–22 | 6–15 | 8–16 | une fête locale, une pièce à l'essai, un exploit du jour | **écrire un flag de campagne** |

**Trois règles dures sur les gabarits.**

1. `exhibition` est **le gabarit de la Dépêche du jour**, et lui seul. Une mission de fil ou de campagne ne peut pas l'employer : `validerFil` le refuse, et la règle 7 des flags (`01-bible.md` §8.6) fait le reste.
2. Un gabarit **borne**, il ne décide pas. Deux missions `capture_qg` peuvent n'avoir aucun point commun visible — c'est le travail de la routine lore.
3. La `dureeVisee` d'une mission doit tomber **dans la fenêtre de son gabarit**. C'est vérifié par un test de dépôt sur `content/fils/`, et par la routine contrôle sur tout ce qui est produit.

---

## 5. Les fils secondaires

### 5.1 Ce qu'est un fil

Un `Fil` est **une suite ordonnée de 3 à 8 missions avec un arc propre**, une condition d'ouverture composable, et des conséquences bornées sur la campagne principale. Contrairement à la Dépêche du jour, **un fil écrit des flags de campagne** — c'est sa différence de nature, et elle est vérifiée : `validerFil` refuse tout flag `monde.depeche.*` et tout flag `monde.secret.*` dans `flagsEcrits`.

Un fil se joue **sur la carte du monde**, en occupant une case de destination (§3.3). Il n'a pas d'écran à lui, pas de menu, pas de liste de quêtes : le carnet de voyage lui suffit.

### 5.2 La liste fermée des conséquences

Le brief fixe **dix** conséquences possibles. Elles sont petites — c'est délibéré : un fil ne doit jamais rendre la campagne principale plus facile au point qu'on le joue pour ça.

| Conséquence | Paramètres et bornes | Ce que ça fait concrètement |
|---|---|---|
| `variante_dialogue` | `scenarioCle`, `varianteCle` | Une scène de la campagne principale se joue autrement : Vantour ou un commandant reconnaît ce qui s'est passé dans le fil |
| `co_commandant` | `commandantCle` (`cmd_…`) | Un commandant devient recrutable — dans les trois emplacements, jamais un quatrième (`04` §7.5) |
| `unite_offerte` | `uniteCle`, `combien` ∈ **[1 ; 2]** | Une ou deux unités présentes au départ du prochain match principal |
| `trace_carte` | `paysCode`, `flagTrace` (doit être `pays.<paysCode>.*`) | Une trace persistante s'installe, dans le plafond de trois traces par pays (`08` §5) |
| `remise_production` | `uniteCle`, `remise` ∈ **[0,80 ; 0,95]** | Une unité coûte 5 à 20 % moins cher pour le reste du parcours |
| `objectif_alternatif` | `scenarioCle`, `objectif` (un `ObjectifVictoire` valide) | Un match principal gagne une seconde façon d'être gagné |
| `allie_acte_iii` | `paysCode` | Ce pays reste avec le joueur au ralliement de l'acte III, quoi qu'il arrive |
| `entree_carnet` | `carnetCle` | Une page de plus au carnet de voyage, lisible au générique |
| `deblocage` | `deblocageCle` | Un `Deblocage` s'ouvre — c'est par là que les fils débloquent des généraux secrets |
| `relation_nation` | `paysCode`, `relation` ∈ **{`alliee`, `rivale`}** | La nation change d'état sur la carte du monde (`08` §4.5) : ralliée, elle prête son commandant, son unité spéciale et son soutien à l'acte III, et **ouvre son départ de Nouvelle Ronde** (§3.5) ; fâchée, elle revient avec un grief |

**Le brief fixait neuf conséquences ; la révision du 5 septembre au soir en ajoute une dixième**, `relation_nation`, et elle est la plus lourde de la liste — c'est pourquoi elle est la plus étroitement bornée. Deux valeurs seulement, `alliee` et `rivale` : **un fil ne retire jamais une nation de la Ronde** (un retrait vient d'un double grief de la campagne principale, `08` §4.5) et ne remet jamais une relation à `neutre`, ce qui serait une conséquence qui ne change rien. La borne est dans le type (`RELATIONS_CONSEQUENCE`), pas dans une consigne de prompt : la routine lore ne peut pas la franchir.

**Bornes, et pourquoi elles sont là.** Deux unités et non trois, une remise de 20 % et non de 50 % : au-delà, un joueur qui fait tous les fils arrive à Port-Méridien avec une campagne différente de celle qu'on a équilibrée, et le mode `difficile` devient plus facile que le mode `normal`. Les bornes sont dans le schéma (`BORNES_CONSEQUENCE`), donc la routine lore ne peut pas les franchir, même en essayant.

**Un à quatre conséquences par fil**, sans doublon. Un fil sans conséquence est refusé : ce serait une suite de matchs, pas un fil.

### 5.3 Les neuf fils écrits en exemple

Tous sont dans `content/fils/`, tous passent `validerFil`, et toutes leurs durées tiennent dans les fenêtres de leurs gabarits.

#### 1. `fil_maree_revanche` — « La marée revient » (5 missions, 2 h 44)

**Arc.** Battue sur son propre estran pendant la qualification française, Maëlle Kerdraon refuse le protêt, refuse l'interview, et s'inscrit à toutes les étapes où le joueur est engagé. Elle ne cherche pas à nuire : elle cherche à comprendre comment on a lu sa marée avant elle. Quatre rencontres plus tard, elle a appris à jouer à contre-temps du terrain, et la cinquième se dispute sur une carte qu'elle a choisie exprès pour n'avantager personne.

**Missions.** `course` (22) → `tenir` (28) → `capture_qg` (34) → `escorte` (36) → `revanche` (44).
**Déblocage.** `cmd.maelle_kerdraon.grief ≥ 3` **et** `pays.fr.tour_complet`.
**Conséquences.** Maëlle recrutable comme co-commandante ; variante de dialogue à la finale d'Europe ; une entrée de carnet.
**Ce que ça change.** Une des trois lignes d'assistance déclarée est pourvue par quelqu'un que le joueur avait humilié — et la finale continentale se joue avec elle au banc plutôt qu'en face.

#### 2. `fil_badge_orange` — « Le badge orange » (6 missions, 3 h 12)

**Arc.** Une pièce de matériel en statut d'essai fait gagner trois équipes de suite. La Commission d'homologation la retire du catalogue la veille d'une étape, sans motiver par écrit — ce qui n'arrive jamais. Le fil remonte jusqu'à la séance à huis clos de Port-Méridien et découvre que le retrait n'était ni technique ni corrompu : quelqu'un avait besoin qu'on parle d'autre chose cette semaine-là.

**Missions.** `capture_qg` (30) → `course` (20) → `escorte` (38) → `tenir` (26) → `relais` (32) → `siege` (46).
**Déblocage.** `monde.atlas.essai_soutenu` **ou** `monde.atlas.homologation_contestee`.
**Conséquences.** Remise de 10 % sur l'unité de reconnaissance ; entrée de carnet ; **déblocage de Wren Osoko** (général secret n° 8).
**Ce que ça change.** C'est la première fois que le joueur voit la Cinquième Manche se servir d'une procédure ordinaire comme d'un écran — et le dossier de l'acte II s'ouvre avec une preuve de plus.

#### 3. `fil_plume_regie` — « La plume de la Régie » (4 missions, 2 h 02)

**Arc.** Ismaë Rouvel écrit les portraits d'après-match de la Régie. Elle choisit le joueur comme sujet de la Ronde XIV et le suit sur trois étapes, caméra à l'épaule, en posant chaque fois la même question sous une forme différente. Le portrait sort quoi qu'il arrive.

**Missions.** `capture_qg` (32) → `course` (22) → `tenir` (28) → `revanche` (40).
**Déblocage.** `monde.public.ferveur ≥ 3` **et** (`monde.regie.faveur ≥ 1` **ou** `monde.tournoi.serie_propre ≥ 4`).
**Conséquences.** Variante de dialogue à la finale de Port-Méridien ; une entrée de carnet.
**Ce que ça change.** Il décide de la façon dont Vantour raconte le joueur jusqu'à la finale : le tacticien, la brute, ou celui dont on ne sait pas quoi dire. C'est le fil le moins mécanique du jeu, et c'est voulu — tous ne doivent pas donner un objet.

#### 4. `fil_disque_raye` — « Le disque rayé » (6 missions, 3 h 38)

**Arc.** Hadran Ost détenait le record de matchs remportés d'affilée jusqu'à une disqualification qu'il juge encore injuste. Sur six rencontres, il fait rejouer au joueur les cartes de ses propres records, une par une, et raconte chaque fois ce qu'il aurait fallu faire. Il ne recrute pas : il donne raison. Le fil se termine sur le terrain où il a été disqualifié, relevé d'époque sous les yeux — et le joueur découvre que la disqualification était **juste**, ce qui rend la suite pire et non meilleure.

**Missions.** `capture_qg` (30) → `siege` (48) → `survie` (26) → `relais` (34) → `tenir` (30) → `revanche` (50).
**Déblocage.** `monde.cinquieme.contact` **ou** `cmd.hadran_ost.respect ≥ 2`.
**Conséquences.** Un objectif alternatif au match d'acte III de Port-Méridien ; entrée de carnet ; **déblocage de Hadran Ost** (général secret n° 4).
**Ce que ça change.** L'acte III gagne une seconde façon d'être joué — survivre douze journées plutôt que gagner —, ce qui compte beaucoup pour un joueur qui a laissé la faction prendre de l'avance.

#### 5. `fil_carnets_cartographe` — « Les carnets du Cartographe » (5 missions, 2 h 50)

**Arc.** Osmin Talvarec n'a jamais cessé de relever les terrains à la main. Il en confie cinq au joueur, avec pour consigne de rejouer chaque carte telle qu'elle est aujourd'hui et de noter ce qui a bougé. Trois écarts sont des erreurs de relevé, un est un affaissement de terrain, et le cinquième est une modification qui n'a jamais été déclarée. Talvarec choisit de classer l'affaire pour protéger la Ronde ; le joueur choisit de le suivre ou de sceller la page.

**Missions.** `relais` (30) → `capture_qg` (32) → `escorte` (36) → `survie` (28) → `siege` (44).
**Déblocage.** `monde.atlas.credibilite ≥ 4` **et** trois pays visités parmi six.
**Conséquences.** Une trace de carte en France ; entrée de carnet ; **déblocage d'Osmin Talvarec** (général secret n° 3).
**Ce que ça change.** C'est le fil qui explique pourquoi les traces persistantes existent, et pourquoi Atlas y tient. Il donne aussi une preuve de plus au dossier de l'acte II — ou pas, si le joueur suit le directeur.

#### 6. `fil_cars_intendance` — « Les cars de l'Intendance » (3 missions, 1 h 20)

**Arc.** L'Intendance déplace quatorze délégations avec un budget que le Bureau réduit chaque Ronde. Solveig Tamm demande au joueur de jouer trois manches à la place d'équipes qui n'arriveront pas à temps, pour que personne ne soit déclaré forfait — un forfait coûte plus cher qu'une défaite (Pacte, article 4). C'est le fil le plus court du jeu et le seul qui ne cache rien : pas de complot, seulement une organisation à bout de souffle.

**Missions.** `course` (20) → `tenir` (26) → `escorte` (34).
**Déblocage.** Deux pays visités parmi huit — c'est le fil qui s'ouvre presque toujours en premier.
**Conséquences.** Un transport offert ; le Luxembourg reste allié à l'acte III ; entrée de carnet.
**Ce que ça change.** Il apprend au joueur ce qu'est un fil avant qu'un fil ne lui demande quoi que ce soit. C'est pour ça qu'il est dans le lot de lancement.

#### 7. `fil_clause_douze` — « La clause douze » (5 missions, 3 h 00)

**Arc.** Le contrat du Consortium Méridien tient en onze clauses lisibles et une douzième qui ne l'est pas : le sponsor désigne deux adversaires par acte, sans avoir à motiver son choix. Le joueur, signataire ou non, croise cinq équipes que quelqu'un a choisies pour lui, et finit par comprendre la logique : ce ne sont jamais les plus fortes, ce sont celles dont une défaite arrange le calendrier.

**Missions.** `capture_qg` (32) → `siege` (46) → `relais` (32) → `tenir` (28) → `revanche` (42).
**Déblocage.** (`pays.lu.sponsor_accepte` **ou** `pays.lu.archives_ouvertes`) **et** `monde.atlas.soupcon ≥ 3`.
**Conséquences.** Un objectif alternatif à la deuxième finale continentale ; une variante de dialogue à l'acte III ; entrée de carnet.
**Ce que ça change.** Il ne dénonce personne. Il montre qu'un commanditaire sans conviction et une faction qui veut des enjeux réels peuvent vouloir exactement la même chose pour des raisons différentes — ce qui est le cœur du doute de l'acte III sur l'identité de la tête.

#### 8. `fil_quatre_traits` — « Quatre traits à la craie » (6 missions, 3 h 00)

**Arc.** Quatre traits et un cinquième barré, à la craie, sur un mur de vestiaire. Le signe apparaît toujours une étape **avant** que le joueur n'arrive, jamais après. Remonter la ligne mène à quelqu'un que personne ne regarde et qui entre partout. La conversation finale est décevante au meilleur sens du terme : il n'a aucun plan, il trouve seulement que le monde est devenu poli.

**Missions.** `course` (20) → `survie` (28) → `capture_qg` (34) → `relais` (32) → `escorte` (36) → `tenir` (30).
**Déblocage.** `monde.atlas.soupcon ≥ 4` **et** (`monde.cinquieme.contact` **ou** l'easter egg `mur_du_vestiaire`).
**Conséquences.** Variante de dialogue à l'acte III ; entrée de carnet ; **déblocage de « Craie »** (général secret n° 10).
**Ce que ça change.** Rien de mécanique, et c'est le propos : le fil ne démasque personne et n'avance la trame d'aucun acte. Il donne un visage à ce que la Cinquième Manche a de plus contagieux. C'est aussi le seul fil dont le déblocage passe par un easter egg — la porte alternative, pour qui n'a pas eu le contact.

#### 9. `fil_seconde_ilva` — « La Seconde » (5 missions, 3 h 06)

**Arc.** Ilva Marecq a disputé deux finales mondiales et n'en a gagné aucune. Après la seconde, elle est entrée à Atlas et a rendu son drapeau, ce qui se fait mais ne se raconte pas. Elle forme les juges de terrain, et accepte de préparer le joueur à la finale — en le faisant perdre quatre fois de suite dans quatre conditions différentes. Chaque défaite est une leçon nommée ; la cinquième rencontre se joue sans qu'elle dise un mot.

**Missions.** `capture_qg` (30) → `survie` (26) → `siege` (48) → `escorte` (36) → `revanche` (46).
**Déblocage.** `monde.tournoi.fils_termines ≥ 2` **ou** une campagne déjà finie en `normal`.
**Conséquences.** Ilva recrutable ; remise de 15 % sur l'artillerie ; entrée de carnet ; **déblocage d'Ilva Marecq** (général secret n° 6).
**Ce que ça change.** C'est le fil « école » : il arrive tard, il apprend au joueur ce que le mode `difficile` va lui demander, et il est la meilleure porte d'entrée vers une seconde campagne.

### 5.4 Ce que la routine lore a le droit de produire

Un fil produit par `atlas_lore` **[Proposition]** :

- choisit un gabarit par mission dans la liste fermée, jamais `exhibition` ;
- déclare 1 à 4 conséquences prises dans l'union fermée, avec des paramètres dans les bornes ;
- n'écrit que des flags connus de `01-bible.md` §8 (aucun flag `monde.secret.*`, aucun flag `monde.depeche.*`) ;
- déclare sa condition de déblocage avec les huit types de `Condition`, sur trois niveaux d'imbrication au plus ;
- fournit pour chaque mission une `dureeVisee` que la routine contrôle **vérifiera par simulation**, dans les deux modes.

La routine contrôle rejette un fil dont une conséquence sort de la liste ou des bornes, dont une durée sort de la fenêtre du gabarit, ou dont un flag est inconnu.

---

## 6. Les deux modes

### 6.1 Le principe

Le mode se choisit au début d'une campagne et **se change à tout moment** ; la campagne le mémorise (`ProfilCampagne.mode`), et certains déblocages exigent d'avoir **fini** en `difficile` (`ProfilCampagne.modesFinis`).

**Le mode ne change aucune règle.** Pas la table de dégâts, pas les coûts de terrain, pas les conditions de victoire, pas les pouvoirs, pas le climat. Il change des **paramètres**, et rien d'autre. C'est ce qui permet à la routine contrôle de certifier les deux modes avec le même moteur et à un rejeu de rester valide quand le joueur change d'avis.

### 6.2 La table des paramètres

`Scenario.modes.normal` et `Scenario.modes.difficile`, type `ParametresMode` (`03-schemas.md` §15).

| Paramètre | `normal` | `difficile` | Pourquoi |
|---|---|---|---|
| `fondsDepart` (joueur) | valeur du scénario | **identique** | On ne punit pas le joueur en l'appauvrissant : on renforce l'adversaire, c'est plus lisible |
| `fondsDepartIa` | = celui du joueur | **× 1,25** | L'IA a une avance de tempo, pas un avantage caché |
| `revenusParBatiment` (joueur) | 1 000 | **identique** | idem |
| `revenusIaParBatiment` | 1 000 | **1 400** | L'écart se creuse avec la durée du match : un `siege` devient réellement plus dur |
| `brouillard` | selon le scénario | **imposé une fois sur deux** (jamais levé s'il l'était déjà) | Le brouillard est une règle existante, pas une règle nouvelle |
| `previsionJournees` (le Bulletin) | **2** | **1** | Le climat reste annoncé, jamais subi (`01-bible.md` §4.5) — on voit moins loin, on voit quand même |
| `vitesseJauge` | × 1,0 | **× 0,8** | Un pouvoir de moins par match, environ. Le levier le plus sensible : ne pas descendre sous 0,7 |
| `limiteJournees` | valeur du scénario | **× 0,85**, arrondi au supérieur, plancher 5 | Moins de temps pour la même chose |
| `strategieIa` | `ponderee` (ou celle du scénario) | **`agressive`**, ou `ponderee` sur les cartes où l'agressivité se suicide | Une IA plus dure, pas une IA qui triche |
| `reprises` (reprendre une journée) | **3 par match** | **0** | Fixé par le brief |
| `dureeVisee` | référence | **+10 à +20 %** (mesuré, pas décrété) | Conséquence des lignes ci-dessus, pas un réglage |

**Ce que le validateur impose.** `validerScenario` refuse un mode `difficile` plus facile que le `normal` sur n'importe lequel de ces axes : IA plus pauvre, Bulletin plus long, jauge plus rapide, brouillard levé, limite relâchée, ou la moindre reprise accordée. Un « mode difficile » plus facile est le bug le plus facile à écrire et le plus difficile à voir en jouant ; il est donc attrapé au schéma.

### 6.3 Ce que `difficile` ne fait jamais

- Il ne donne pas d'unité supplémentaire à l'IA au départ (ce serait un autre scénario, pas un autre mode).
- Il ne modifie pas la table de dégâts ni les coûts de terrain.
- Il ne cache pas d'information au-delà du brouillard, qui est une règle du jeu.
- Il ne change pas les conditions de victoire ni de défaite.
- Il ne rend pas la météo imprévisible : Atlas ne surprend pas un commandant avec le temps qu'il fait, en `difficile` comme ailleurs.

### 6.4 Certification

La routine contrôle certifie **les deux modes** pour chaque scénario : deux campagnes de simulation, deux `StatsSimulation`, deux vérifications de `dureeVisee`. Un scénario certifié en `normal` et rejeté en `difficile` **n'est pas mis en ligne** : il n'existe pas de scénario à moitié jouable (`05-routines.md` §4).

---

## 7. Les généraux secrets

### 7.1 La doctrine

Un général secret est un `Commander` avec `secret: true` et la clé du `Deblocage` qui l'ouvre. Trois règles, dans cet ordre :

1. **Jamais indispensable.** Aucun fil, aucune fin, aucune destination, aucun autre déblocage ne dépend d'un général secret. Un joueur qui n'en débloque aucun voit tout le jeu.
2. **Équilibré comme les autres.** Même budget de barres, un passif, un pouvoir, un super pouvoir plus cher que le pouvoir, **une faiblesse déclarée et réellement défavorable**. La routine contrôle les simule comme les autres, et un général secret trop fort est rejeté avec le motif `pouvoir_trop_fort`.
3. **Invisible avant.** Il n'apparaît pas dans l'écran de sélection, et son entrée de déblocage est `cache: true` quand son existence même est une surprise.

### 7.2 Les dix

Les noms sont inventés et non localisables : les figures d'Atlas sont des **sans-drapeau** (`01-bible.md` §3.1), et c'est un garde-fou éditorial autant qu'un trait de fiction.

| # | Qui | Style de pouvoir | Condition de déblocage | Où il vit dans le lore |
|---|---|---|---|---|
| 1 | **Nera Aldouin**, arbitre en chef, « la Ligne Blanche » | `gardienne` — le règlement : annule un modificateur adverse actif, ferme une production adverse une journée | `monde.atlas.arbitre_alliee` **et** `monde.carnet.pages_scellees ≥ 3` | `01-bible.md` §3.3 — elle tient les archives des protêts |
| 2 | **Célestin Vantour**, commentateur, « la Voix » | `showman` — l'élan : la jauge monte avec le public et les actions spectaculaires | `serieDepeches ≥ 10` au profil | `01-bible.md` §3.3 — il commente tout, il a fini par vouloir jouer |
| 3 | **Osmin Talvarec**, directeur d'Atlas, « le Cartographe » | `stratege_prudent` — la carte : pose de terrain, révélation d'une zone, prévisualisation d'une intention | finir `fil_carnets_cartographe` **ou** l'easter egg `journal_cartographe` | `01-bible.md` §3.3 — géomètre monté au Bureau, jamais commandant |
| 4 | **Hadran Ost**, « le Recordman » | `veteran` — la vétérance : une unité mise hors jeu revient une fois par match, à un PV | obtenir la fin C ou la fin D, **ou** finir `fil_disque_raye` | `01-bible.md` §3.4 — figure visible de la Cinquième Manche |
| 5 | **Numéro Six**, juge de terrain sans-drapeau | `survivante` — la résilience : les effets montent à mesure que l'équipe est menée | finir une campagne en `difficile` | Elle n'a plus de nom parce qu'elle a rendu son drapeau ; on l'appelle par son dossard |
| 6 | **Ilva Marecq**, « la Seconde » | `stratege_prudent` — la position : bonus de terrain fortifié et prévisualisation, courbe très lente | finir `fil_seconde_ilva` | Deux finales mondiales, aucun titre, puis Atlas |
| 7 | **Barnab Estève**, « le Dernier Arbitre » | `veteran` — la vétérance dure : unités promues qui gardent leurs bonus, moral d'équipe | l'easter egg `quatre_traits` **et** `monde.atlas.credibilite ≥ 8` | Le seul commandant en activité qui a connu l'avant, et qui ne le raconte à personne (§2.1 de la bible : les **Vieilles Manières**) |
| 8 | **Wren Osoko**, « l'Inspectrice », Commission d'homologation | `ingenieur` — le terrain construit : ponts temporaires, remblais, blocage d'un passage | finir `fil_badge_orange` | `01-bible.md` §3.2 — elle préside les séances à huis clos |
| 9 | **Solveig Tamm**, « les Clés », Intendance | `diplomate` — l'économie : capture accélérée, revenu majoré, ravitaillement à distance | avoir visité 12 pays différents, tous parcours confondus | `01-bible.md` §3.2 — elle déplace la Ronde entière depuis un bureau |
| 10 | **« Craie »**, un Cinquième sans grade | `fonceuse` — l'initiative : mouvement supplémentaire, charge qui ignore un malus de terrain | 6 easter eggs sur 13, **ou** finir `fil_quatre_traits` | Celui qui trace quatre traits et un cinquième barré sur les murs de vestiaire |

### 7.3 Sur Barnab Estève et les Vieilles Manières

Le seul général secret qui touche au tabou fondateur, et il faut dire précisément comment. Barnab Estève **n'illustre jamais** les Vieilles Manières : il ne raconte aucune bataille, ne nomme aucun vainqueur, ne date rien, ne localise rien (`01-bible.md` §2.1, règle d'écriture). Ce qu'il apporte, c'est un **comportement** : il salue avant et après chaque manche, il refuse les objectifs alternatifs, il rend le matériel adverse lui-même, et il coupe court dès qu'un commentateur essaie de le faire parler d'avant. Son unique réplique sur le sujet — « On a essayé autrement. Ça ne s'est pas bien passé. » — est la limite absolue, et elle est écrite à la main, jamais générée.

C'est aussi lui qui donne à la doctrine « jamais indispensable » son sens narratif : le plus ancien commandant du monde est une option, pas une clé.

---

## 8. Le système de déblocage

### 8.1 La forme

```ts
interface Deblocage {
  cle: Cle;
  libelle: string;
  condition: Condition;
  recompense: { type: TypeRecompenseDeblocage; ref: Cle };
  cache: boolean;
}
```

Un système unique pour tout ce qui s'ouvre : `general_secret`, `carte`, `carte_terrain`, `skin_style`, `fil`, `mode`, `entree_carnet`, **`depart_nation`**. Un seul mécanisme, donc un seul endroit à tester, un seul endroit à équilibrer, et aucune tentation d'en inventer un second — la **Nouvelle Ronde** (§3.5) passe par là comme le reste, et sa `ref` est un `CodePays` au lieu d'une `Cle`.

### 8.2 Les dix conditions

| Type | Forme | Ce que ça lit dans le profil |
|---|---|---|
| `flag` | `{ cle }` | Un booléen posé |
| `compteur` | `{ cle, min }` | Un compteur ≥ `min` ; un compteur absent vaut zéro |
| `mode_fini` | `{ mode }` | `modesFinis` — avoir **fini**, pas avoir joué |
| `date` | `{ du?, au? }` | La date du jour, **fournie par l'appelant** ; au moins une borne, bornes incluses |
| `pays_visite` | `{ pays[], combien }` | Au moins `combien` des pays listés dans `paysVisites` |
| `secret` | `{ cle }` | `secretsTrouves` — un easter egg de `doc/14-secrets.md` |
| `relation` | `{ pays[], relation, combien }` | Au moins `combien` des nations listées sont dans cet état dans `relations` ; une nation absente est `neutre` |
| `confiance` | `{ commandantCle, min }` | `confiance[commandantCle] ≥ min`, de 1 à 3 ; un général jamais incarné est à zéro |
| `et` | `{ conditions[] }` | 2 à 4 sous-conditions, toutes vraies |
| `ou` | `{ conditions[] }` | 2 à 4 sous-conditions, au moins une vraie |

**Trois niveaux d'imbrication au plus** (`PROFONDEUR_CONDITION_MAX`). Au-delà, personne ne sait plus lire la condition, et surtout personne ne sait plus dire au joueur ce qu'il lui manque.

### 8.3 Qui évalue

`src/engine/deblocages.ts` : `evaluerCondition(condition, profil, contexte)` et `deblocagesAcquis(profil, deblocages, contexte)`. C'est du code **pur**, qui n'importe que `schemas/`, et qui tourne indifféremment dans le moteur ou dans le serveur.

Trois invariants, testés :

1. **Le rendu n'a aucune autorité.** Un déblocage n'est jamais décidé par une couche d'affichage.
2. **Le moteur ne lit jamais l'horloge.** La date d'une condition `date` vient de `ContexteDeblocage.aujourdhui`, fournie par le serveur — le seul à savoir quel jour on est (`PLAN.md`, étape 5).
3. **Total, jamais d'exception.** Une condition d'un type inconnu est *fausse*. Un profil ouvert par une version plus récente ne casse pas une version plus ancienne, il ouvre simplement moins de choses.

`deblocagesNouveaux` retranche ce que le profil connaît déjà : c'est ce que le serveur annonce au joueur, et ce qu'il ajoute à `ProfilCampagne.deblocages`.

### 8.4 Le cas `monde.depeche.serie`

Le compteur de Dépêches enchaînées **vit au profil, hors des flags de campagne** (`08` §4.4) : aucune bascule de trame ne le lit, aucune fin ne le teste. Il est lisible par **un seul mécanisme** : un `Deblocage` (c'est ainsi que Célestin Vantour s'ouvre). C'est pourquoi il est un champ propre de `ProfilCampagne` (`serieDepeches`) et non une entrée de `flags.compteurs` : l'étanchéité de la Dépêche est protégée par le type, pas par la discipline.

---

## 9. La sauvegarde de campagne

```ts
interface ProfilCampagne {
  cle; paysDepart; mode;
  flags: EtatFlags;              // booléens, compteurs, journal des décisions
  deblocages: Cle[];             // clés de Deblocage acquises
  filsEnCours: { filCle; etape }[];
  filsFinis: Cle[];
  scenariosFinis: Cle[];
  secretsTrouves: Cle[];         // easter eggs, noms courts
  paysVisites: CodePays[];
  modesFinis: Mode[];
  relations: Record<CodePays, RelationNation>;  // absent = neutre ; ≤ 5 `retiree`
  confiance: Record<Cle, NiveauConfiance>;      // par général incarné, 0 à 3 ; absent = 0
  serieDepeches: number;
  catalogueVersion; chainesVersion;
  creeLe; majLe;
}
```

**Ce que la sauvegarde garantit.**

| Garantie | Comment |
|---|---|
| Un rejeu reste identique quoi qu'il arrive au catalogue | `catalogueVersion` et `chainesVersion` sont figées à la création du profil et suivent la campagne (`BRIEF.md`, déterminisme) |
| Un booléen ne se retire jamais | `validerProfilCampagne` refuse un booléen à `false` (`08` §2.1) |
| Un fil n'est jamais à la fois en cours et fini | vérifié au schéma |
| La Dépêche n'entre pas dans la campagne | `serieDepeches` est un champ à part, hors de `flags` |
| Le carnet est le miroir des flags | `flags.journal` porte les décisions, pas l'interface |
| Aucune fin ne devient inaccessible | `validerProfilCampagne` refuse un profil à plus de cinq nations `retiree` (`BORNES_RELATIONS.retireesMax`) |
| Le joueur n'est pas sa propre relation | `relations` ne contient jamais `paysDepart` : c'est sa nation, pas un rapport avec elle |
| La confiance reste bornée | `validerProfilCampagne` refuse une valeur hors de 0…3 et une clé qui n'est pas un code de commandant : la confiance se gagne auprès d'un général, pas d'une nation |

**Ce qu'elle ne porte pas :** l'état d'une partie en cours. Une partie est ses actions plus les versions qu'elle a figées (`Sauvegarde`, `03-schemas.md` §14) ; le profil de campagne est ce qui reste entre deux matchs. Les deux ne se mélangent jamais : c'est ce qui permet d'abandonner un match sans perdre une campagne, et de rejouer un match sans réécrire un flag.

**Plusieurs profils par joueur.** Un profil = un parcours = un pays de départ, et **le premier profil de tout le monde a `paysDepart: 'fr'`**. Ce qui vit **au-dessus** des profils, et qui est donc dupliqué à leur création : `secretsTrouves`, `modesFinis`, `serieDepeches` et les `deblocages` déjà acquis — un général secret gagné dans une campagne reste jouable dans la suivante, et **c'est aussi par là qu'un départ de Nouvelle Ronde traverse** (§3.5 : le déblocage `depart_nation` est acquis, donc il suit). Ce qui ne se transmet **jamais** : les flags, les fils, les scénarios finis, les pays visités, les `relations` **et la `confiance`** du parcours en cours — un général qui vous connaissait ne vous connaît plus, mais le départ qu'il a ouvert reste ouvert, parce que c'est un `deblocage`. On repart neutre partout : ce qu'on garde d'une Ronde, c'est le droit d'en commencer une ailleurs, pas les amitiés qu'on y avait nouées. **[Proposition]**

---

## 10. Ce qui reste ouvert

1. **Le modèle de conversion journées → minutes** (§2.1) doit être calibré sur de vraies sessions à l'étape 3. Tant qu'il ne l'est pas, toutes les durées de ce document sont des estimations cohérentes entre elles, pas des mesures.
2. **Le débit de 3 scénarios certifiés par jour** est une hypothèse tirée des bornes de `05-routines.md`, pas une observation. L'étape 6 (« la réserve se remplit seule ») produira le vrai chiffre, et le budget devra être refait avec.
3. **Le rythme de sortie post-lancement** (12 à 15 h par mois) est un engagement de production. Si on ne veut pas le prendre, l'option C de §2.7 est la bonne, pas l'option B.
4. **Le mode `difficile` sur les fils** : faut-il que les fils aient leurs deux jeux de paramètres comme les scénarios principaux ? Oui par cohérence, mais ce sont 45 certifications de plus. Proposition : oui, et c'est déjà compté dans les 48 minutes de simulation de §2.5.

---

## 11. Récapitulatif des propositions de ce document

1. Le **budget chiffré** de 82 h / 119 missions et sa décomposition (§2.2), la comparaison avec un Advance Wars (§2.3), et l'aveu que la qualité moyenne d'une mission sera inférieure à celle d'un Advance Wars.
2. Le **modèle de conversion** `minutes ≈ 1,15 × journées + 0,07 × ordres`, à calibrer.
3. Le **débit réaliste de 3 scénarios certifiés par jour** et le coût de simulation (48 min pour tout re-certifier).
4. La **recommandation B** — lancer à 33 h, grandir de 12 à 15 h par mois — et sa condition non négociable : **le lot de lancement doit avoir une fin**.
5. Les **cinq règles de proposition de destination** sur la carte du monde (§3.3).
6. Les **neuf gabarits de mission** et leurs bornes.
7. Les **neuf fils** de `content/fils/`, leurs arcs, leurs déblocages et leurs conséquences.
8. La **table des paramètres de mode** (§6.2) et les invariants de validation qui interdisent un `difficile` plus facile.
9. Les **dix généraux secrets**, et le traitement de Barnab Estève qui touche aux Vieilles Manières sans jamais les illustrer.
10. Le système **`Deblocage`** à dix conditions — `confiance` comprise depuis l'incarnation —, sa profondeur bornée à trois, et l'évaluation pure sans horloge.
11. `ProfilCampagne`, et la règle de ce qui se transmet d'un profil à l'autre (§9).
12. Les **relations dans le budget** (§3.4) : deux ralliements garantis placés sur des registres de choix différents, cinq scènes de retrait qui préviennent, et le constat que les relations ne coûtent aucune mission neuve mais une passe de simulation de plus (unités spéciales alliées).
13. Les **matchs d'incarnation** (§3.4 bis) : leurs trois places dans la colonne, leurs trois bornes — aucun flag de trame principale, pas de retrait pendant qu'on joue la nation, jamais imposés hors acte III —, la confiance à un seul palier, et leur coût de ≈ 4 h ajouté au budget (§2.2).
14. La **Nouvelle Ronde** (§3.5) : un `Deblocage` de récompense `depart_nation`, `cache: false` toujours, les relations qui ne se transmettent pas d'un profil à l'autre, et les vingt-trois prologues non français sortis du chemin critique du lancement.
