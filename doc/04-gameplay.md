# Atlas Tournament — Règles du jeu

> Document 04. Découle du canon `BRIEF.md`, cohérent avec `02-architecture.md` et `03-schemas.md` (mêmes clés d'unités, de terrains et de champs). Les propositions hors brief sont marquées **[proposition]**.
>
> Rappel de ton, canon : ce sont des **Jeux Tactiques**. On affronte un **adversaire**, pas un ennemi. Une unité réduite à zéro est **mise hors jeu** (elle rentre au vestiaire), elle n'est jamais détruite ni tuée. Les règles ci-dessous sont des règles de **sport**.

---

## 1. Vocabulaire et unités de mesure

| Terme | Définition |
|---|---|
| **Case** | Une cellule de la grille, un caractère dans `MapDef.grille`. |
| **Tour** | Ce que joue **un camp**. |
| **Journée** | Un tour de chaque camp. La journée s'incrémente quand le camp 0 reprend la main. C'est l'unité affichée au HUD et celle des objectifs de scénario. |
| **PV affichés** | 1 à 10. C'est ce que voit le joueur. |
| **PV internes** | 1 à 100. C'est ce que manipule le moteur. `pvAffiches = ceil(pvInternes / 10)`. Une unité à 91 PV internes affiche 10 mais frappe comme 10 : les décimales cachées sont ce qui rend le combat lisible sans le rendre binaire. |
| **Fonds** | La monnaie. Multiples de 100. |
| **Barre de pouvoir** | 100 points de jauge. |
| **Mise hors jeu** | `pvInternes ≤ 0` : l'unité quitte la carte. |

---

## 2. Structure d'un tour

Un tour se déroule dans cet ordre exact. Les phases 1 à 5 sont **automatiques** et forment la transition `finTour(campPrécédent) → débutTour(camp)` ; seule la phase 6 est interactive.

### Phase 1 — Ouverture

La journée s'incrémente si le camp est le camp 0. Les hooks `debutTour` s'exécutent **avant tout le reste**, dans cet ordre fixe : **la couche climat d'abord** (§12.5 — avance du cycle jour/nuit, tirage de la météo de J+2, modificateurs de la journée), **la mécanique régionale ensuite** (§11). Si la marée monte, elle monte avant que le joueur touche à quoi que ce soit, et elle monte sous la météo du jour.

### Phase 2 — Revenus

```
fonds += Scenario.revenusParBatiment × (nombre de bâtiments capturables possédés)
```

Comptent : ville, usine, aéroport, QG. Le QG rapporte comme une ville. Valeur par défaut : **1000 fonds par bâtiment et par tour**.

### Phase 3 — Réparation, ravitaillement

Toute unité stationnée sur un **bâtiment ami dont le terrain a `ravitaille: true`** (ville, usine, aéroport, QG) et **compatible avec son domaine** :

- munitions et carburant remis au maximum, gratuitement ;
- PV rendus : `+2 PV affichés` (soit +20 PV internes), plafonné à 100 ;
- **la réparation est payante** : elle coûte `(PV affichés rendus / 10) × coût de l'unité`, prélevé sur les fonds. Si les fonds ne suffisent pas, le soin est réduit à ce que le camp peut payer, éventuellement à zéro. **[proposition]** — sans cela, une ville tenue rend n'importe quelle armée increvable.

Compatibilité de domaine : les unités **terre** se réparent sur ville, usine et QG ; les unités **air** uniquement sur aéroport et ville **[proposition]** ; une unité air sur une usine ne se répare pas et ne se ravitaille pas.

### Phase 4 — Carburant

Chaque unité dont `carburant.parTour > 0` (aujourd'hui : l'hélicoptère seul) consomme cette quantité, même immobile. **Une unité aérienne à 0 carburant est mise hors jeu à la fin de la phase.** Le HUD signale en orange toute unité aérienne à moins de 2 tours d'autonomie : la panne sèche ne doit jamais être une surprise.

### Phase 5 — Réveil

Toutes les unités du camp repassent en état `prete`. Les unités produites au tour précédent deviennent jouables (une unité produite ne joue **pas** le tour de sa production).

### Phase 6 — Ordres

Le joueur enchaîne autant d'actions qu'il veut, dans l'ordre qu'il veut. Chaque unité ne peut recevoir **qu'un seul ordre par tour**. Le moteur ne connaît que quatre actions :

```ts
export type Action =
  | { type: 'ordre'; uniteId: string; chemin: Case[]; suite: Suite }
  | { type: 'produire'; batiment: Case; unite: CleUnite }
  | { type: 'pouvoir'; niveau: 'normal' | 'super' }
  | { type: 'finTour' };

export type Suite =
  | { type: 'rien' }
  | { type: 'attaquer'; cible: Case }
  | { type: 'capturer' }
  | { type: 'embarquer'; transport: string }
  | { type: 'debarquer'; vers: Case }
  | { type: 'fusionner'; avec: string };
```

Un ordre est **atomique** : déplacement et suite forment une seule action, donc une seule entrée dans le rejeu et un seul point de tirage aléatoire. Le `chemin` est explicite (la liste des cases traversées) et non recalculé : le moteur le **vérifie** — contiguïté, coût total ≤ mouvement restant, aucune case occupée par un adversaire, aucune case infranchissable pour le `typeMouvement`. Un chemin invalide est un refus, pas une correction silencieuse.

**Mouvement.** Le coût de chaque case vient de `Terrain.couts[typeMouvement]` ; un type de mouvement absent de la table signifie **infranchissable**. Le déplacement consomme `carburant.parCase` par case traversée. La portée de déplacement affichée au joueur est calculée par un Dijkstra borné par le mouvement restant **et** par le carburant restant.

**Zone de contrôle.** Une unité qui entre sur une case **adjacente à une unité adverse visible** s'arrête immédiatement **[proposition]** — sans cette règle, on traverse une ligne défensive comme si elle n'existait pas, et l'artillerie ne protège plus rien.

**Attaque.** L'unité doit avoir des munitions (ou `munitions: null`), et la cible doit être à distance de Manhattan comprise dans `[portee[0], portee[1]]` depuis la case **d'arrivée**. Une unité indirecte (`portee[1] > 1`) ne peut **pas** attaquer si elle a bougé (`peutTirerApresMouvement: false`) et ne **riposte jamais**.

**Capture.** Voir §6.

**Embarquement / débarquement.** Un transport peut charger une unité `pied` ou `bottes` amie ; l'unité chargée ne joue plus ce tour. Le débarquement se fait sur une case adjacente franchissable ; l'unité débarquée peut agir mais pas se déplacer, et le transport ne peut plus bouger après avoir débarqué.

**Fusion.** Deux unités amies de même type sur une case adjacente fusionnent : PV additionnés, plafonnés à 100, et le camp reçoit en fonds la valeur du dépassement (`surplus/100 × coût`). Munitions et carburant prennent le maximum des deux.

### Phase 7 — Fermeture

`finTour` de la mécanique régionale, puis évaluation des conditions de victoire et de défaite (elles sont aussi évaluées **après chaque action**, pour qu'une capture de QG termine la partie sur-le-champ), puis passage au camp suivant.

---

## 3. Les dix unités de base

Valeurs conçues pour Atlas Tournament : elles suivent la logique d'Advance Wars (pierre-feuille-ciseaux entre infanterie, blindés et anti-air, artillerie fragile mais longue) sans en reprendre les chiffres.

| Clé | Nom | Coût | Mouv. | Type mouv. | Portée | Vision | Mun. | Carb. (max/case/tour) | Traits | Silhouette |
|---|---|---:|---:|---|---|---:|---:|---|---|---|
| `infanterie` | Infanterie | 1 000 | 3 | pied | 1 | 2 | ∞ | — | `capture` | pattes · capsule · — · 1 |
| `meca` | Méca | 2 800 | 2 | bottes | 1 | 2 | 6 | — | `capture`, `tout_terrain` | pattes · capsule · `lance_roquettes` · 1 |
| `recon` | Recon | 3 800 | 8 | roues | 1 | 5 | ∞ | 80 / 1 / 0 | `vision_etendue` | roues · capsule · `radar` · 1 |
| `char_leger` | Char léger | 6 500 | 6 | chenilles | 1 | 3 | 9 | 70 / 1 / 0 | — | chenilles · bloc · `tourelle` · 2 |
| `char_lourd` | Char lourd | 15 000 | 4 | chenilles | 1 | 1 | 6 | 55 / 1 / 0 | — | chenilles · bloc · `tourelle`, `canon_long` · 3 |
| `artillerie` | Artillerie | 5 500 | 5 | chenilles | 2–3 | 1 | 8 | 60 / 1 / 0 | `tir_indirect` | chenilles · plateau · `canon_long` · 2 |
| `roquettes` | Lance-roquettes | 14 000 | 5 | roues | 3–5 | 1 | 6 | 55 / 1 / 0 | `tir_indirect` | roues · plateau · `lance_roquettes` · 3 |
| `antiair` | Anti-air | 7 500 | 6 | chenilles | 1 | 2 | 9 | 60 / 1 / 0 | `anti_air` | chenilles · bloc · `tourelle`, `radar` · 2 |
| `helico` | Hélicoptère | 9 000 | 6 | air | 1 | 3 | 6 | 60 / 1 / **2** | `vol` | rotor · capsule · `nacelle` · 2 |
| `transport` | Transport | 4 500 | 6 | chenilles | — | 1 | — | 70 / 1 / 0 | `transport` | chenilles · plateau · `grue` · 2 |

Les colonnes **Traits** et **Silhouette** sont l'écriture des dix unités de base dans le vocabulaire du catalogue vivant (§13) : `capture`, `transport`, `tir_indirect`, `anti_air`, `vol`, `vision_etendue` et `tout_terrain` ne sont pas des nouveautés, ce sont les **noms** de comportements que ces unités avaient déjà. La colonne Silhouette se lit `base · corps · modules · taille` et correspond à `UnitType.silhouette` (`03-schemas.md` §3). Les colonnes Capture et Transport ont disparu du tableau parce qu'elles sont devenues des traits : `infanterie` et `meca` capturent, `transport` porte une place (`infanterie` ou `meca`), le reste ne fait ni l'un ni l'autre.

Lectures utiles :

- **L'infanterie est la seule unité qui gagne des parties.** Elle seule (avec la méca) capture ; tout le reste sert à protéger une capture ou à l'empêcher. À 1 000 fonds elle est toujours rentable.
- **La méca est lente mais grimpe.** Son coût de mouvement en montagne et en rivière est de 1 contre 2 pour l'infanterie : c'est elle qui prend les hauteurs.
- **Le recon voit et ne survit pas.** Mouvement 8 et vision 5 en font l'unité de brouillard ; face à n'importe quoi de blindé elle est perdue.
- **Le char lourd est un investissement, pas une solution.** 15 000 fonds, vision 1, mouvement 4 : seul et sans yeux, il se fait travailler à distance.
- **Les indirectes ne ripostent pas et ne tirent pas après avoir bougé.** Elles imposent un rythme : on avance, on s'arrête, on tire le tour suivant.
- **L'anti-air est un contre, pas une unité de ligne.** 120 contre l'hélicoptère, 25 contre un char léger.
- **L'hélicoptère ignore le terrain et paie en carburant.** 2 par tour, 60 au plein : 30 tours en l'air, moins s'il vole loin. Il ne peut être touché que par l'infanterie, la méca, l'anti-air et un autre hélicoptère.
- **Le transport ne porte aucune arme** : `degats` vide, `munitions: null`, aucune riposte. C'est la seule unité qui ne peut jamais attaquer.

**Production.** Chaque bâtiment producteur a sa liste (`Terrain.produit`) :

| Bâtiment | Produit |
|---|---|
| QG (`H`) | `infanterie`, `meca` |
| Usine (`U`) | les 9 unités de domaine `terre` (soit les dix, moins l'`helico`) |
| Aéroport (`A`) | `helico` |

On produit sur un bâtiment **possédé et libre**, en payant le coût comptant. L'unité apparaît à 100 PV internes, munitions et carburant au plein, en état `produite` : elle ne joue qu'au tour suivant.

**La mer viendra plus tard — et c'est tranché.** `BRIEF.md`, arbitrage n° 3 : les unités navales sont **reportées** dans un paquet séparé, ouvert après le voyage et les choix (nouvelle étape du plan de construction). Trois conséquences, qui sont des règles et pas des intentions :

1. **Jusqu'au paquet naval, la mer est infranchissable.** Aucune unité terrestre ne franchit une case `mer` ; les deux seuls passages sont le **pont** (`N`) et la **plage** (`S`), qui est une case de terre. Les types de mouvement `mer` et `amphibie` et le trait `amphibie` (§13.2) existent dans les schémas, mais **aucune unité ne les porte** et une candidate qui les porterait est refusée à l'homologation.
2. **Chaque pays ou région maritime a une spécialité de repli terrestre**, écrite dans sa fiche (`06-pays-de-depart.md`, `07-france-regions.md`) et modélisée comme n'importe quelle `Specialite` (`03-schemas.md` §1). Elle doit tenir **sans navires** : c'est ce qui empêche la routine lore de produire du contenu injouable pour la Grèce, l'Indonésie, les Fidji, le Sénégal, l'Argentine, Madagascar, le Japon, la Bretagne, la Guadeloupe ou Mayotte.
3. **Quand la mer arrivera, la spécialité maritime s'ajoutera** ; elle ne remplacera pas celle de repli. Les unités navales (transport de débarquement, croiseur, sous-marin, porte-hélicoptères) s'ajouteront comme les autres — une ligne et une colonne dans la table de dégâts (§13.3), sans toucher aux dix unités ci-dessus — et le carburant deviendra enfin une contrainte réelle pour tout le monde.

---

## 4. Les terrains

| Clé | Car. | Nom | Déf. ★ | pied | bottes | roues | chenilles | air | Capturable | Revenus | Cache |
|---|:-:|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---:|:-:|
| `plaine` | `P` | Plaine | 1 | 1 | 1 | 2 | 1 | 1 | non | 0 | non |
| `foret` | `F` | Forêt | 2 | 1 | 1 | 3 | 2 | 1 | non | 0 | **oui** |
| `montagne` | `M` | Montagne | 4 | 2 | 1 | — | — | 1 | non | 0 | **oui** |
| `route` | `R` | Route | 0 | 1 | 1 | 1 | 1 | 1 | non | 0 | non |
| `plage` | `S` | Plage | 0 | 1 | 1 | 2 | 1 | 1 | non | 0 | non |
| `riviere` | `V` | Rivière | 0 | 2 | 1 | — | — | 1 | non | 0 | non |
| `pont` | `N` | Pont | 0 | 1 | 1 | 1 | 1 | 1 | non | 0 | non |
| `mer` | `W` | Mer | 0 | — | — | — | — | 1 | non | 0 | non |
| `ville` | `C` | Ville | 3 | 1 | 1 | 1 | 1 | 1 | **oui** | 1 000 | non |
| `usine` | `U` | Usine | 3 | 1 | 1 | 1 | 1 | 1 | **oui** | 1 000 | non |
| `aeroport` | `A` | Aéroport | 3 | 1 | 1 | 1 | 1 | 1 | **oui** | 1 000 | non |
| `qg` | `H` | QG | 4 | 1 | 1 | 1 | 1 | 1 | **oui** | 1 000 | non |
| `radar` | `T` | Station radar | 3 | 1 | 1 | 1 | 1 | 1 | **oui** | 500 | non |

`—` signifie infranchissable pour ce type de mouvement (convention de `03-schemas.md` §4 : il n'existe pas de coût infini, seulement une entrée absente).

Notes de conception :

- **Le caractère de grille reprend la démo de rendu** (`W P F M R C H`) ; `U A V N S` sont ajoutés. Une grille de la démo reste une grille valide.
- **La route est un piège assumé** : 0 étoile de défense, coût 1 pour tout le monde. Elle accélère, elle expose. Les routes tracées par le générateur relient des bâtiments, donc les axes rapides passent là où l'artillerie attend.
- **La montagne inverse le rapport pied/bottes** (2 contre 1) : c'est le terrain de la méca, et sa défense 4 en fait le meilleur perchoir du jeu. Elle donne aussi **+2 de vision** à l'unité qui l'occupe en brouillard **[proposition]**.
- **Forêt et montagne cachent** : en brouillard, une unité dessus n'est vue qu'à distance 1.
- **La rivière est franchissable à pied et en bottes**, pas en roues ni en chenilles. Le pont est donc un point de passage obligé pour les blindés — et un excellent objectif de scénario.
- Le QG a 4 étoiles : le prendre coûte cher, et c'est voulu.
- **La station radar** (catalogue 3, 5 septembre 2026) ne produit rien et rapporte moitié moins qu'une ville, mais elle **voit à cinq cases** pour son propriétaire et **brouille les drones adverses à douze cases** (§10 bis). Elle se capture comme une ville.
- **Un bâtiment peut être désaffecté** (`MapDef.desaffectes`) : ville, usine, aéroport ou station, jamais le QG. Il est neutre, ne rapporte rien, ne produit rien et ne soigne pas tant qu'une unité ne l'a pas **remis en service** (§6 bis).

---

## 5. La formule de dégâts

### 5.1 Formule

```
Fterrain = 1 − 0,05 × E × (pvCible / 10)
A        = 0,95 + 0,10 × r          avec r ∈ [0,1), tiré dans rng.branche('combat')

D = base × (pvAtt / 10) × Matt × Fterrain × (1 / Mdef) × A

pvPerdus = min( pvCibleInternes , max(1, arrondi(D)) )      si base > 0
pvPerdus = 0                                                si base = 0
```

| Symbole | Sens | Bornes |
|---|---|---|
| `base` | Valeur de la table de dégâts (§8), en points internes | 0 à 130 |
| `pvAtt`, `pvCible` | PV **affichés** (1 à 10) de l'attaquant et de la cible | 1 à 10 |
| `E` | Étoiles de défense du terrain de la **cible** | 0 à 4 |
| `Matt` | Produit des multiplicateurs d'attaque de l'attaquant (passif + pouvoir + événement) | 0,5 à 2,0 |
| `Mdef` | Produit des multiplicateurs de défense de la cible | 0,5 à 2,0 |
| `A` | Aléa, **seedé** | 0,95 à 1,05 |
| `D` | Dégâts en PV **internes** | — |

Trois décisions structurantes :

- **L'aléa est faible et seedé.** ±5 % : assez pour qu'un échange ne soit jamais parfaitement prévisible, jamais assez pour qu'un plan correct échoue. Et il est tiré du flux `combat` du générateur seedé : la même partie rejouée donne exactement les mêmes jets.
- **La défense de terrain dépend des PV de la cible.** Une unité entamée profite moins de son abri. C'est ce qui empêche une infanterie à 1 PV sur une montagne d'être un mur.
- **Le minimum est 1 PV interne**, jamais 0, tant que `base > 0`. Une attaque légitime fait toujours quelque chose ; sinon le joueur ne comprend pas pourquoi son ordre était accepté.

### 5.2 Riposte

Si la cible survit (`pvInternes > 0`), qu'elle est à **distance 1** de l'attaquant, que `peutRiposter` est vrai et qu'il lui reste des munitions, elle riposte immédiatement avec la **même formule**, en utilisant ses PV **après** l'attaque. La riposte consomme 1 munition. Elle ne peut pas déclencher de contre-riposte.

Conséquence directe : attaquer une unité de valeur avec une unité entamée est mauvais, et attaquer une pièce indirecte au corps à corps est gratuit. C'est l'essentiel du jeu de placement.

### 5.2 bis Prévision du duel

Le joueur voit **avant de confirmer** ce que l'échange coûterait aux deux camps : PV de la cible après la frappe, PV de l'attaquant après la riposte. C'est `prevoirDuel(etat, cat, attaquant, cible, depuis)`, et c'est la même formule qu'au-dessus — pas une seconde table entretenue à côté, qui finirait par mentir.

Trois bornes la rendent honnête :

- elle **ne tire aucun aléa**. Un tirage avancerait le flux `combat` et casserait le déterminisme du rejeu ; une prévision qui bouge d'un survol à l'autre ne serait pas une information mais un bruit. `A` est donc pris au centre de sa fourchette, à `1,00` : le tirage réel s'écarte de ±5 %, jamais davantage ;
- elle se calcule depuis la case d'**arrivée**, pas depuis la case de départ : le vent de `surAttaque` lit la direction du tir, et la riposte n'existe qu'à distance 1 ;
- elle **ne mute rien**, ni l'état ni les unités.

Conséquence d'interface : même face à une **cible unique**, l'ordre `attaquer` passe par la phase de visée. Une attaque qui part sans que le joueur ait vu ce qu'elle coûte est un pari, pas un ordre.

### 5.3 Munitions

Une attaque ou une riposte consomme 1 munition. `munitions: null` signifie illimité (infanterie, recon). À 0 munition, l'unité ne peut ni attaquer ni riposter — le HUD l'affiche en rouge. Le ravitaillement (phase 3) remet au plein.

### 5.4 Exemple travaillé

Char léger à 10 PV, sur route, attaque une infanterie à 10 PV en forêt (E = 2). Aucun pouvoir actif, `A = 1,00`.

```
Fterrain = 1 − 0,05 × 2 × (10/10) = 0,90
D        = 75 × 1,00 × 1 × 0,90 × 1 × 1,00 = 67,5 → 68 PV internes
```

L'infanterie tombe de 100 à 32, soit **4 PV affichés**. Elle riposte :

```
Fterrain = 1 − 0,05 × 0 × (10/10) = 1,00      (le char est sur une route)
D        = 25 × (4/10) × 1 × 1,00 × 1 × 1,00 = 10 PV internes
```

Le char passe de 100 à 90, soit **9 PV affichés**. L'échange est favorable au char (6 500 fonds contre 1 000), mais deux infanteries en forêt lui coûtent déjà 20 % de sa valeur : c'est le rythme visé.

---

## 6. La capture

Un bâtiment capturable (`ville`, `usine`, `aeroport`, `radar`) se prend en accumulant **20 points de capture** ; le **QG en demande 40** (5 septembre 2026) : une infanterie intacte y passe **quatre tours**, sous le feu, et c'est voulu — on ne finit pas un match en deux actions sous le nez du propriétaire.

```
pointsCapture += pvAffiches de l'unité qui capture       (1 à 10 par tour)
```

Règles :

- Seules `infanterie` et `meca` capturent (`UnitType.capture: true`, `typeMouvement ∈ {pied, bottes}`).
- L'unité doit **finir son mouvement sur le bâtiment** et émettre la suite `{ type: 'capturer' }`. Elle est alors marquée « en capture ».
- Une unité à 10 PV met **2 tours** ; à 5 PV, **4 tours** ; à 2 PV, **10 tours**. Blesser un capteur est donc une réponse valable à une capture en cours.
- **Les points sont remis à zéro** si l'unité quitte la case, reçoit un autre ordre (attaque, embarquement), ou est mise hors jeu. Les dégâts subis **ne remettent pas à zéro** : ils ralentissent, puisqu'ils réduisent les PV affichés.
- À 20 points, le bâtiment change de propriétaire immédiatement, ses points repassent à 0, et l'unité reste dessus, capture terminée.
- Un bâtiment neutre appartient à personne : il ne rapporte rien et ne produit rien tant qu'il n'est pas capturé.
- **Le seuil de 20 points est l'unité de compte de tout le projet.** Une fiche pays ou région qui parle d'une capture « plus rapide » ou « plus lente » (Luxembourg, Centre-Val de Loire, Guyane…) exprime un **seuil en points**, jamais un nombre de tours : 10 points = deux fois plus vite, 40 points = deux fois plus lent. Un « cran de capture » n'existe pas ; on dit « point de capture ».
- **Un pouvoir ou une spécialité peut multiplier les points gagnés par tour**, dans la borne `[0,5 ; 3,0]` (§7.2) — la seule borne multiplicative du jeu qui monte au-dessus de 2,0, et la seule qui descende sous 1,0 pour viser l'adversaire.
- **Capturer un QG met fin à la partie** : le camp qui le perd est éliminé, et tous ses bâtiments deviennent neutres **[proposition]** (ce qui compte pour les parties à 3 ou 4 camps).

### 6 bis. La remise en service

Un bâtiment **désaffecté** (`MapDef.desaffectes`, jamais un QG) n'appartient à personne et ne sert à rien tant qu'il n'est pas remis en service. La remise en service est une capture à **40 points**, ouverte à deux familles d'unités :

- l'**infanterie** et la **méca**, au rythme habituel de leurs PV affichés — **quatre tours** à pleine force ;
- le **génie**, seule unité bâtisseuse, qui gagne **le double** de ses PV affichés — **deux tours** à pleine force. Le génie ne capture rien d'autre : un bâtiment en service ne se prend qu'avec un capteur.

À 40 points, le bâtiment sort de la liste des désaffectés, prend les couleurs du camp, et le moteur émet `remise_en_service` puis l'événement `capture` acquis habituel. **Atlas verse une prime de remise en service** au camp qui relance le bâtiment : `PRIME_REMISE_EN_SERVICE` = 1 000 fonds, **doublée (2 000) quand c'est le génie** — quatre tours d'infanterie immobile coûtent déjà assez cher, la prime récompense d'abord le bâtisseur. L'événement porte la `prime`. Il rapporte et produit dès la journée suivante. Un bâtiment en service ne redevient jamais désaffecté : il n'existe aucun système de destruction (`doc/15`). Dans l'interface, l'ordre s'appelle « Remettre en service », jamais « capturer » — on ne capture pas ce qui n'appartient à personne — et le mot « ruine » est banni par la charte (`content/i18n/glossaire.fr.json`) : rien n'est détruit dans les Jeux Tactiques, seulement hors service.

---

## 7. Les commandants

### 7.1 Jauge de pouvoir

Une barre vaut **100 points**. La jauge est plafonnée au coût du super pouvoir du commandant.

| Événement | Points gagnés |
|---|---|
| Une de mes unités inflige des dégâts | `+10 × PV affichés retirés à la cible` |
| Une de mes unités subit des dégâts | `+5 × PV affichés perdus` |

Le camp qui encaisse gagne donc aussi de la jauge : un camp dominé revient dans le match. Mettre hors jeu une unité pleine rapporte 100 points, soit une barre — un pouvoir à 3 barres se charge en trois bons échanges.

### 7.2 Pouvoir et super pouvoir

Un commandant a trois choses (schéma `Commander`, `03-schemas.md` §2) :

- un **passif** toujours actif, volontairement faible (typiquement un multiplicateur 1,1 sur une famille d'unités) ;
- un **pouvoir** coûtant 2 à 4 barres ;
- un **super pouvoir** coûtant 5 à 9 barres, strictement plus cher que le pouvoir.

Le déclenchement est une action (`{ type: 'pouvoir', niveau }`), gratuite en temps, possible **une seule fois par tour** et **avant ou après n'importe quel ordre**. Les effets sont des `EffetPouvoir` paramétrés : cible, filtre, modificateur.

**Le modificateur `capture` est le seul multiplicateur à sortir de [0,5 ; 2,0] : sa borne est `[0,5 ; 3,0]`** (`BRIEF.md`, seconde relecture, point 4). Une valeur **au-dessus de 1,0** accélère la capture de ses propres unités ; une valeur **en dessous de 1,0 ne peut viser que `unites_adverses`**, jamais `mes_unites` ni `toutes_unites` — on ralentit l'adversaire chez soi, on ne se ralentit pas soi-même. C'est ce qui rend à **la gardienne** (`01-bible.md` §6) la famille de pouvoir qui la définit : ralentir tout ce qui approche. Le risque de blocage est nul : les points de capture repartent de zéro au mouvement (§6), pas aux dégâts, et un multiplicateur 0,5 double au pire le temps de capture — un bâtiment finit toujours par tomber.

**Trois durées** (`BRIEF.md`, arbitrage n° 4) :

| `duree` | Portée exacte |
|---|---|
| `ce_tour` | jusqu'à la fin du tour courant |
| `tour_complet` | jusqu'au début du tour suivant du même camp — couvre donc aussi le tour de l'adversaire. Un pouvoir défensif est `tour_complet`. |
| `{ type: 'journees', n }`, `n` de 1 à 3 | jusqu'au début du (n+1)ᵉ tour du même camp, soit **n journées pleines**. Déclenché en journée 5, un `n = 2` expire au début de la journée 7. |

La durée en journées est ce qui exprime les « pendant 2 tours » et « pendant 3 tours » des fiches pays (Suisse, Canada, Namibie, Australie, Fidji, Brésil…) sans inventer de mécanique. Le HUD affiche un décompte en journées à côté de l'icône du pouvoir : une durée qu'on ne voit pas est une durée qui n'existe pas. **[proposition]** `n = 3` est réservé au super pouvoir ; un pouvoir à 2 barres qui dure trois journées est un super pouvoir déguisé.

**Une seule famille d'effet nouvelle : `poser_terrain`.** **Sept formes, et sept seulement** (`BRIEF.md`, seconde relecture, point 3), chacune avec son couple de terrains autorisé — **cette table fait foi** (`03-schemas.md` §2 la référence) :

| Forme | `depuis` (terrains cibles autorisés) | `vers` | Ce que ça fait |
|---|---|---|---|
| `pont` | `mer`, `riviere` | `pont` | ouvre un passage aux blindés là où il n'y en avait pas |
| `telepherique` | `montagne` | `route` | franchit le relief sans le contourner |
| `cable` | `foret`, `riviere` | `route` | une traversée rapide d'un obstacle mineur |
| `chenal` | `plaine`, `plage` | `riviere` | **coupe** un axe terrestre : la seule forme défensive |
| `polder` | `mer` | `plaine` | gagne de la terre sur l'eau |
| `ponton` | `mer`, `riviere` | `pont` | le passage léger : même lecture qu'un pont, mais jamais `permanent` |
| `banc_de_sable` | `mer` | `plage` | découvre un appui côtier le temps de passer |

**La table ne s'ouvre pas.** Une forme nouvelle demande un arbitrage au brief, jamais une routine ni une fiche pays. Ce qui tient du **climat n'est pas un pouvoir** : la **glace** est l'effet de saison `rivieres_gelees` (§12.2) ; une **source chaude** est un effet de `soin` sur terrain, ou une mécanique régionale volcanique (§11) ; la **roche neuve** d'un volcan est une mécanique régionale. Un pouvoir ne fait pas la météo.

Bornes, non négociables :

- **1 à 4 cases** par déclenchement (`casesMax`), **3 au plus pour un pouvoir normal** ; contiguës si `contigu` est vrai.
- **Durée** : `permanent` — réservée au **super pouvoir** — ou `{ type: 'journees', n }` avec `n` de 1 à 3, après quoi la case redevient son terrain de grille.
- **Jamais** sur une case capturable (`ville`, `usine`, `aeroport`, `qg`), **jamais** sur une case occupée par une unité (amie ou adverse), **jamais** adjacente à un QG adverse.
- La grille de `MapDef` **n'est jamais réécrite** : la pose est une vue `modifTerrain`, consignée dans `etat.mecanique.donnees`, exactement comme une mécanique régionale transformante (§11.1). Une unité qui se retrouve sur une case redevenue infranchissable à l'expiration est **repoussée** vers la case libre franchissable la plus proche, jamais mise hors jeu.

Aucun pouvoir ne peut : mettre une unité hors jeu directement, changer un propriétaire de bâtiment, donner un tour supplémentaire, **rejouer un tour**, **échanger des positions**, **produire une unité gratuitement**, ni faire tomber une unité sous 1 PV interne (`degats_directs` est plafonné et laisse toujours 1 PV). Ces interdits sont **inchangés** par l'arbitrage n° 4 : `poser_terrain` est la seule famille ajoutée, précisément parce qu'elle redessine le terrain sans casser la lisibilité du tour. Ce sont des règles du moteur, pas des conventions d'écriture — c'est ce qui garantit qu'un commandant produit par la routine lore reste jouable.

### 7.3 Faiblesse

Tout commandant a une **faiblesse obligatoire et réellement défavorable** (`Commander.faiblesse`), permanente, sur un axe déclaré. Un commandant sans faiblesse est rejeté par la routine contrôle (`commandant_sans_faiblesse`). C'est aussi ce qui donne à l'IA un angle d'attaque : la stratégie `ponderee` lit l'axe de faiblesse de son adversaire et pondère ses achats en conséquence.

### 7.4 Journée par journée

Le HUD affiche la **journée**, pas le tour. Les pouvoirs, les mécaniques régionales et les objectifs de scénario raisonnent tous en journées : « tenir trois journées », « la marée change une journée sur deux ». Un pouvoir `tour_complet` déclenché en journée 5 par le camp 0 expire au début de la journée 6 du camp 0.

### 7.5 Co-commandants

Tranché par `BRIEF.md`, arbitrage n° 2. Un commandant recruté via un flag (`cmd.<id>.co_commandant`, écrit par une récompense de scénario `recompenses.coCommandant`) est adjoint au commandant principal et apporte **deux choses, et deux seulement** :

1. **son passif** — jamais son pouvoir, jamais son super pouvoir, et **pas de demi-pouvoir** : la notion n'existe pas dans le moteur ;
2. **une barre de jauge de départ**, soit 100 points de jauge au coup d'envoi, une fois par match.

**L'incarnation renverse les rôles, sans ajouter de règle.** Dans un **match d'incarnation** (`Scenario.incarnation`, `03-schemas.md` §15.2 bis), le joueur joue entièrement une nation alliée : le camp du joueur prend **le général de cette nation** — son passif, son pouvoir, son super pouvoir, sa jauge, sa barre entière —, **son catalogue** (unité spéciale comprise), sa **spécialité** et son **style visuel**. Le **commandant d'origine du joueur reste au banc en co-commandant passif** : exactement les deux choses ci-dessus, son passif et sa barre de jauge de départ, et rien de plus. Le lien avec sa propre campagne ne se perd donc jamais, et le moteur n'apprend aucune notion nouvelle — c'est le co-commandant qui change de siège, pas la règle.

**Ce que la confiance ajoute, et son seul palier.** Incarner une nation fait monter la **confiance** de son général (`ProfilCampagne.confiance[commandantCle]`, 0 à 3). Elle n'a **qu'un** palier utile, et c'est voulu : à **3**, le général devient co-commandant **avec sa barre de jauge entière** — pas 100 points de départ mais sa jauge complète — et sa nation se débloque comme **départ de Nouvelle Ronde** (`13-campagne.md` §3.5). Aux niveaux 1 et 2, la confiance ne donne rien d'autre que des dialogues : c'est un compteur qu'on lit, pas une échelle de puissance. Le plafond de **trois co-commandants recrutés, un seul actif par match** s'applique au général incarné comme aux autres, et un général à confiance 3 **ne s'ajoute pas** aux trois : il prend une place, ou il attend.

**Un commandant régional de France** apporte en plus sa **carte de terrain à usage unique** — la récompense déjà prévue par `07-france-regions.md` §2.4, jouable une fois dans le match, **trois cartes au plus** dans la sacoche. C'est la seule chose que le régional ajoute au socle : on garde une mécanique nouvelle, pas deux.

**Sa carte est l'une des trois, pas une quatrième** (`BRIEF.md`, seconde relecture, point 7). La sacoche compte trois emplacements pour tout le voyage : la carte apportée par un co-commandant régional y prend un emplacement comme n'importe quelle autre, et si les trois sont pris, le joueur choisit laquelle il laisse. Il n'existe **aucun** chemin qui porte le total à quatre. Les plafonds — trois cartes, trois co-commandants recrutés, un actif, cinq spécialités possédées, une équipée (§7.6) — sont les seuls outils de correction de l'inflation : on mesure d'abord (taux de victoire au mondial avec 0, 1 et 3 cartes emportées, étape 7 du plan), on resserre un plafond ensuite, on n'ajoute jamais une règle nouvelle.

### 7.6 Spécialités : cinq possédées, une équipée

Même geste que les co-commandants (`BRIEF.md`, seconde relecture, point 2). Une `Specialite` (`03-schemas.md` §1) est soit un **modificateur**, soit un **trait** de la liste fermée `TraitSpecialite`. Le joueur en **possède jusqu'à cinq** — celle de son pays, plus celles gagnées en région — et en **équipe une seule par match**, choisie avant le coup d'envoi, jamais changée en cours de match. Le plafond de cumul du moteur est donc **un** : aucune multiplication de spécialités entre elles, donc aucune saturation à arbitrer, et un équilibrage qui se vérifie spécialité par spécialité.

**Plafonds** : **trois co-commandants recrutés** au total, **un seul actif par match**. Le joueur choisit lequel il emmène avant le coup d'envoi ; le changement se fait entre deux matchs, jamais pendant **[proposition]**. La limite « un seul emmené au mondial » de `07-france-regions.md` §2.4 devient une conséquence de cette règle, pas une règle concurrente ; `01-bible.md` §6 et `08-narration-choix.md` §4.2 pointent ici.

Le joueur qui collectionne les alliés gagne en **régularité et en tempo de départ**, pas en pic de puissance — c'est ce qui empêche le système de choix de devenir un système de puissance.

---

## 8. Table de dégâts complète 10 × 10

Valeurs `base` de la formule §5, en points internes. **Lignes = attaquant, colonnes = cible.** `0` signifie « ne peut pas viser cette cible ». Ces dix lignes et dix colonnes sont le **socle canon** : une homologation y ajoute une ligne et une colonne (§13.3) et n'en modifie **jamais** une valeur.

| Att. \ Cible | inf | méca | recon | char lég. | char lrd | artil. | roquet. | anti-air | hélico | transp. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **infanterie** | 55 | 45 | 70 | 25 | 5 | 60 | 65 | 55 | 25 | 70 |
| **méca** | 65 | 55 | 85 | 60 | 15 | 75 | 80 | 70 | 30 | 85 |
| **recon** | 70 | 65 | 60 | 6 | 1 | 45 | 55 | 12 | 0 | 70 |
| **char_leger** | 75 | 70 | 85 | 55 | 15 | 70 | 85 | 75 | 0 | 90 |
| **char_lourd** | 95 | 90 | 105 | 85 | 55 | 105 | 105 | 105 | 0 | 125 |
| **artillerie** | 90 | 85 | 80 | 70 | 45 | 75 | 80 | 75 | 0 | 95 |
| **roquettes** | 95 | 90 | 90 | 80 | 55 | 80 | 85 | 85 | 0 | 105 |
| **antiair** | 105 | 95 | 60 | 25 | 5 | 50 | 55 | 45 | **120** | 50 |
| **helico** | 75 | 70 | 55 | 55 | 25 | 65 | 65 | 6 | 65 | 75 |
| **transport** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Ce que la table encode :

- **Seules quatre unités peuvent viser l'air** : `infanterie` (25), `meca` (30), `antiair` (120), `helico` (65). L'hélicoptère est donc réellement dangereux — et réellement fragile devant un anti-air, qu'il ne peut presque pas toucher en retour (6).
- **L'anti-air est un couteau à un seul usage** : redoutable sur infanterie (105) et hélicoptère (120), inutile contre un char (25 et 5).
- **Les indirectes frappent fort partout mais ne ripostent jamais.** Une artillerie face à un char léger inflige 70 à distance 3 ; au corps à corps, elle en encaisse 70 sans rien rendre.
- **Le char lourd domine le sol et n'a aucune réponse en l'air** (0). Une armée de chars lourds sans anti-air perd contre trois hélicoptères.
- **Le recon est une unité de renseignement**, pas de combat : 60 contre son semblable, 6 contre un char léger.
- **Le transport ne fait jamais rien.** Sa ligne entière est à 0 et il ne riposte pas ; le protéger fait partie du jeu.
- La diagonale (une unité contre son semblable) est toujours inférieure à 100 sauf pour le char lourd (55) : deux unités identiques qui s'échangent ne se mettent jamais hors jeu en un coup, ce qui garde les fronts vivants.

---

## 9. Conditions de victoire

Un scénario déclare 1 à 3 conditions de victoire et 1 à 3 conditions de défaite (`Scenario.victoire`, `Scenario.defaite`). **Satisfaire une seule condition de victoire suffit ; subir une seule condition de défaite suffit.** Elles sont évaluées après chaque action et en fin de tour.

| Condition | Clé de schéma | Détail |
|---|---|---|
| Capture du QG | `capture_qg` / `qg_perdu` | Immédiate. C'est la victoire de référence, présente dans presque tous les scénarios. |
| Mise hors jeu totale | `hors_jeu_total` / `toutes_unites_hors_jeu` | Un camp est éliminé s'il n'a plus **aucune unité** et **aucun bâtiment producteur possédé**. Avoir 0 unité mais une usine ne suffit pas à perdre : on peut encore produire. |
| Objectif de scénario | `capturer`, `tenir`, `survivre`, `proteger`, `points` | Capturer N cases désignées, tenir N cases pendant N journées, survivre N journées, protéger une unité nommée, atteindre un score. |
| Limite de journées | `limite_journees` | Voir §9.1. |

### 9.1 Fin aux points

Quand `Scenario.limiteJournees` est atteinte sans qu'aucune condition ne se soit déclenchée, le match se décide **aux points** **[proposition]**. Un match sportif ne s'arrête pas sur un « personne n'a gagné ». C'est ce que la bible appelle la **décision aux points à l'issue des quatre manches** (`01-bible.md` §4.3) : la manche est la division sportive du match, la journée son unité mécanique, et `limiteJournees` couvre les quatre manches.

```
score = 5 × (nombre de bâtiments capturables possédés)
      + 10 × (QG possédés)
      + (valeur totale des unités en jeu, en fonds) / 1000
      + (fonds en caisse) / 2000
```

Le score le plus haut l'emporte. En cas d'égalité parfaite : match nul, qui compte comme une défaite pour la progression narrative mais laisse rejouer sans pénalité de flag.

C'est aussi cette formule que la simulation IA contre IA utilise pour classer les parties non terminées, et le champ `points` d'un objectif `{ type: 'points', seuil }` s'y réfère.

---

## 10. Le brouillard (optionnel)

Activé par `Scenario.brouillard`. Quand il est actif, chaque camp ne voit qu'un état filtré de la partie. **Il est aussi imposé, quel que soit ce champ, pendant la phase `nuit` et sous la météo `brouillard`** (§12.3 et §12.4) : les règles ci-dessous s'appliquent alors telles quelles, avec les valeurs de vision modifiées par le climat.

**Calcul de la vision.** Une case est visible pour un camp si elle est à distance de Manhattan ≤ *v* d'une source :

| Source | Portée |
|---|---|
| Une unité du camp | `UnitType.vision`, **+2** si elle est sur une montagne **[proposition]** |
| Un bâtiment capturable possédé | 2 |

**Cachettes.** Une unité adverse située sur un terrain `cacheEnBrouillard` (forêt, montagne) n'est visible que si une unité du camp est à **distance 1** exactement. Elle peut donc être révélée « au contact » : une unité qui entre dans la zone de contrôle d'une unité cachée s'arrête (règle §2) et la découvre.

**Règles de jeu associées :**

- Le terrain, lui, est **toujours visible** : le brouillard cache les unités, pas la carte. C'est un choix de lisibilité pour un jeu au ton léger **[proposition]** ; les cases hors vision sont assombries, pas noires.
- Une unité indirecte ne peut tirer que sur une case **actuellement visible** par son camp. On ne bombarde pas au jugé.
- Un ordre de déplacement peut être **interrompu** : si une unité adverse est révélée sur le chemin ou à côté, l'unité s'arrête à la case précédente et son ordre s'achève là, sans suite. Le moteur renvoie l'événement correspondant pour que le rendu joue l'arrêt.
- **L'état filtré est calculé dans le moteur**, pas dans le rendu (`engine/brouillard.ts`). Le client d'un camp ne reçoit jamais les unités qu'il ne voit pas : c'est une règle d'anti-triche, testée explicitement (`02-architecture.md` §8).

### 10 bis. Drones, brouilleur et station radar (catalogue 3)

Le brouillard a ses yeux et ses aveugles (5 septembre 2026, `src/engine/regles/vision.ts`).

| Unité ou bâtiment | Ce qu'elle fait | Coût |
|---|---|---:|
| `drone` — Drone d'observation | Vole, voit à 5, ne tire pas, ne riposte pas. Trait `drone` : **brouillable**. Produit à l'aéroport. | 3 000 |
| `drone_filaire` — Drone filaire | Vole à 3 cases par tour, voit à 5 (+1 sur montagne), ne tire pas. **Pas** de trait `drone` : sa liaison ne se brouille pas, c'est ce qu'on paie quatre fois plus cher. | 12 000 |
| `brouilleur` — Brouilleur mobile | Roule à 6, ne tire pas. Trait `brouilleur` : brouille tout drone adverse à **10 cases** de Manhattan. Produit à l'usine. | 5 000 |
| `radar` — Station radar | Bâtiment capturable : son propriétaire **voit à 5 cases** autour (2 pour un autre bâtiment) et brouille tout drone adverse à **12 cases**. | terrain |

**Brouillage.** Un drone brouillé garde **un dixième** de sa vision, arrondi, jamais moins d'une case : à cinq de vision, il ne voit plus que la case d'à côté. Le brouillage se lit à chaque calcul de vision, sans état : entrer et sortir du rayon suffit. Une station neutre ne brouille personne. Les rayons sont des constantes du moteur (`RAYON_BROUILLEUR_MOBILE`, `RAYON_STATION_RADAR`) : sur une carte de douze cases de large, une station couvre toute la carte — c'est une arme de grande carte, et la routine map devra en tenir compte avant d'en poser sur un 12 × 10.

**Le drone abattu lit la production.** Un drone (trait `drone`) mis hors jeu **au-dessus d'un bâtiment adverse** — capturé par un antiaérien, tombé en panne sèche — a eu le temps de voir ce qui en sortait : son camp reçoit `production_revelee`, avec tout ce que le propriétaire du bâtiment a produit depuis le début du match, type par type. C'est la seule consolation d'un œil perdu, et une raison de le risquer au-dessus d'une usine plutôt qu'au-dessus d'une plaine.

**Ce que cela ne fait pas.** Le brouillage n'agit que sur le trait `drone` : recon, hélicoptère, infanterie sur une montagne voient comme avant. Il ne touche ni l'attaque, ni le mouvement, ni la capture.

---

## 11. Mécaniques régionales

Chaque région d'un pays phare apporte **une** mécanique de terrain. Le système est générique : une mécanique est un greffon enregistré par clé (préfixe `meca_`), appelé par le moteur à des points de branchement fixes.

### 11.1 Contrat technique

> **Ce paragraphe fait foi sur les noms des cinq hooks.** `07-france-regions.md` §2.5 et les dix-huit fiches régionales les emploient tels quels : `debutTour`, `finTour`, `surMouvement`, `surAttaque`, `modifTerrain`. Aucune autre orthographe n'existe. Une mécanique déclare **un hook principal et au plus un hook secondaire** (règle de `07-france-regions.md` §2.5).

```ts
export interface CtxMecanique<P> {
  readonly etat: EtatPartie;       // lecture seule
  readonly parametres: P;          // validés contre schemaParametres
  readonly journee: number;
  readonly camp: CampId;
  readonly rng: Rng;               // = etat.rng.branche('meca:' + cle) — jamais un autre
}

export type EffetMecanique =
  | { type: 'changer_terrain'; case: Case; vers: CleTerrain }
  | { type: 'degats'; case: Case; pv: number }             // PV internes, laisse toujours ≥ 1
  | { type: 'repousser'; case: Case; vers: Case }
  /** [proposition] Modificateur global, écrit dans le vocabulaire des pouvoirs.
   *  Ajouté pour la couche climat (§12.5) : la nuit, la pluie et la canicule sont
   *  des modificateurs de vision et de mouvement, et aucun des quatre autres effets
   *  ne les exprimait. Disponible aussi aux mécaniques régionales. */
  | { type: 'modificateur'; effet: EffetModificateur;
      duree: 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 } }
  | { type: 'annonce'; texte: string; icone?: string };    // pour le HUD

export interface Mecanique<P = Record<string, never>> {
  cle: Cle;
  nom: string;
  schemaParametres: SchemaParametres;   // publié, sert à valider Region.mecanique.parametres
  hooks: {
    /** Après l'incrément de journée, avant les revenus. */
    debutTour?(ctx: CtxMecanique<P>): EffetMecanique[];
    /** Après le dernier ordre, avant l'évaluation de victoire. */
    finTour?(ctx: CtxMecanique<P>): EffetMecanique[];
    /** Sur chaque case traversée : autorise, refuse, ou tronque le chemin. */
    surMouvement?(ctx: CtxMecanique<P>, unite: Unite, chemin: Case[]):
      | { ok: true }
      | { ok: true; cheminTronque: Case[] }
      | { ok: false; motif: string };
    /** Appelé après le calcul de base, avant l'arrondi. Renvoie les dégâts modifiés. */
    surAttaque?(ctx: CtxMecanique<P>, att: Unite, def: Unite, degats: number): number;
    /** Vue « logique » du terrain : ce que voient mouvement, défense et rendu. */
    modifTerrain?(ctx: CtxMecanique<P>, c: Case, terrain: CleTerrain): CleTerrain;
  };
}
```

**Cinq règles, non négociables :**

1. **Pureté.** Un hook ne modifie pas l'état : il **renvoie des effets déclaratifs** que le moteur applique. Cela rend chaque mécanique testable seule, avec une entrée et une sortie JSON.
2. **Déterminisme.** Le seul aléa autorisé est `ctx.rng`, dérivé de la graine de la partie. Aucun `Math.random`, aucune date.
3. **Aucune mise hors jeu directe.** `degats` ne peut jamais descendre une unité sous 1 PV interne. Une mécanique de terrain n'élimine pas ; elle handicape. C'est aussi le ton : la mer n'est pas un adversaire.
4. **Aucun changement de propriétaire.** Une mécanique ne capture pas, ne donne pas de fonds, ne produit pas.
5. **Idempotence par journée.** Rejouer `debutTour` sur le même état et la même journée doit donner exactement les mêmes effets. C'est ce qui permet le rejeu et la simulation.

**Un paramètre commun à toutes les mécaniques : `gelable`** (booléen, défaut `true`). Il ne fait pas partie du `schemaParametres` propre à une mécanique ; le moteur le lit avant elle, et à `false` il **écarte les effets de saison qui rendraient franchissables ou neutraliseraient** les cases qu'elle régit (§12.6, règle 4). C'est une ligne de fiche, pas une exception de code.

`modifTerrain` mérite une note : il définit le terrain **logique** d'une case, celui qui sert au coût de mouvement, à la défense et au rendu. La grille de `MapDef` n'est jamais réécrite — la carte reste la carte, la mécanique la réinterprète. Une partie sauvegardée n'a donc pas besoin de stocker la grille modifiée : elle se recalcule.

**Corollaire pour les mécaniques qui « transforment » le terrain** (châteaux du Centre-Val de Loire, ponts du Grand Est, coulée de La Réunion — `07-france-regions.md` §4) : elles ne sont pas un sixième hook. Un changement durable s'écrit comme un effet `changer_terrain` **émis depuis `debutTour` ou `finTour`** et consigné dans `etat.mecanique.donnees` ; `modifTerrain` se contente ensuite d'en donner la lecture logique. C'est pourquoi le hook s'appelle `modifTerrain` et non « terrain modifié » : il décrit une **vue**, pas un événement.

### 11.2 Exemple 1 — Marées (Bretagne)

```json
{ "cle": "meca_marees", "parametres": { "periodeJournees": 2, "amplitudeCases": 1, "phaseInitiale": 0 } }
```

**Idée.** Une journée sur deux, la mer se retire : une bande de fond marin devient praticable. Puis elle revient.

**Implémentation.**

- `modifTerrain` : soit `basse = ((journee + phaseInitiale) mod (2 × periodeJournees)) < periodeJournees`. À marée basse, toute case `mer` située à ≤ `amplitudeCases` d'une case `plage` est **vue comme `plage`**. À marée haute, elle redevient `mer`. Rien n'est écrit dans la grille.
- `debutTour` : à la bascule vers la marée haute, chaque unité terrestre présente sur une case qui redevient `mer` est **repoussée** vers la case libre franchissable la plus proche (`repousser`) ; si aucune n'existe, elle subit `degats: 30` (3 PV affichés) et reste, jambes dans l'eau. Émet aussi une `annonce` (« La marée monte — deux tours pour dégager »).
- Hooks utilisés : `modifTerrain`, `debutTour`.

**Ce que ça change au jeu.** Le raccourci côtier existe une journée sur deux. Une infanterie qui part capturer par la grève doit avoir compté ses tours. La commandante locale (Maëlle Kerdraon) est bâtie dessus : sa faiblesse est `partie_longue`, elle gagne si elle fait perdre un cycle de marée à l'adversaire.

### 11.3 Exemple 2 — Mistral (Provence)

```json
{ "cle": "meca_mistral", "parametres": { "direction": "nord_sud", "forceParJournee": 2, "journeeDePointe": 4 } }
```

**Idée.** Un vent constant, plus fort certaines journées. Il pousse dans un sens et gêne dans l'autre.

**Implémentation.**

- `surMouvement` : pour les types `air` et `roues`, chaque case parcourue **contre le vent** coûte +1 (minimum 1) ; chaque case parcourue **dans le sens du vent** coûte −1 (minimum 1). Si le chemin devient trop coûteux, il est renvoyé **tronqué** (`cheminTronque`) plutôt que refusé : l'unité avance autant qu'elle peut, ce qui est plus lisible qu'un ordre rejeté.
- `surAttaque` : une unité indirecte qui tire **contre le vent** voit ses dégâts réduits de 10 % ; un hélicoptère qui attaque **dans le sens du vent** les augmente de 10 %. La portée n'est pas modifiée — modifier une portée en cours de tour rend la prévisualisation mensongère.
- `debutTour` : une `annonce` donne la force du jour ; `forceParJournee` module l'intensité, doublée à `journeeDePointe`.
- Hooks utilisés : `surMouvement`, `surAttaque`, `debutTour`.

**Ce que ça change au jeu.** Le sens de l'attaque compte. Attaquer vers le sud est rapide et cher à défendre ; remonter au nord coûte un tour de plus. La carte est symétrique, le vent ne l'est pas : c'est le générateur qui doit compenser en donnant au camp « sous le vent » une usine plus proche.

### 11.4 Exemple 3 — Inondation (Pays-Bas)

```json
{ "cle": "meca_inondation", "parametres": { "niveauMax": 3, "journeesParPalier": 3, "declencheParPouvoir": true, "refluxParJournee": 1 } }
```

**Idée.** Le niveau d'eau monte par paliers. Les terres basses passent sous l'eau, puis se découvrent. Le commandant néerlandais peut accélérer la montée avec son super pouvoir — c'est le seul cas où un pouvoir touche une mécanique, et c'est explicitement autorisé par `declencheParPouvoir`.

**Implémentation.**

- Le niveau courant est un entier 0 à `niveauMax`, dérivé de la journée (`floor(journee / journeesParPalier)`) et augmenté de 1 à chaque déclenchement du super pouvoir, puis redescendant de `refluxParJournee` par journée. Il est stocké dans `etat.mecanique.donnees` — le seul état persistant qu'une mécanique a le droit d'avoir.
- La « hauteur » d'une case est calculée une fois à l'initialisation, à partir de la carte : distance à la case `mer` ou `riviere` la plus proche, plafonnée à 4. Une case de hauteur ≤ niveau est **inondée**.
- `modifTerrain` : une case inondée de terrain `plaine`, `route`, `plage` ou `pont` est vue comme `mer`. Les bâtiments et les reliefs (`ville`, `usine`, `aeroport`, `qg`, `foret`, `montagne`) ne sont **jamais** inondés — on ne noie pas un objectif, sans quoi les conditions de victoire deviennent instables.
- `debutTour` : à chaque montée de palier, les unités terrestres sur une case nouvellement inondée subissent `degats: 30` et sont repoussées vers la case franchissable la plus proche. `annonce` avec le niveau atteint.
- `surMouvement` : les unités `roues` et `chenilles` sur une case **adjacente** à une case inondée paient +1 par case (terrain détrempé).
- Hooks utilisés : `modifTerrain`, `debutTour`, `surMouvement`.

**Ce que ça change au jeu.** La carte rétrécit. Les blindés perdent leurs axes en premier, l'infanterie et la méca gardent les hauteurs, l'hélicoptère devient très fort — ce qui donne à l'adversaire une raison claire d'acheter de l'anti-air, et boucle la boucle pierre-feuille-ciseaux. Le super pouvoir néerlandais ne met personne hors jeu : il redessine le terrain, ce qui est exactement le ton voulu.

---

## 12. Climat : saisons, jour et nuit, météo

Le climat est une **mécanique globale du moteur** (`BRIEF.md`, « Climat »). Pas de nouvelle architecture : une couche `engine/climat/` (`02-architecture.md` §3.1), un état `EtatPartie.climat` (`03-schemas.md` §13), et **le même contrat de hooks que les mécaniques régionales** (§11.1).

Trois principes, avant les tables :

- **Tout est annoncé.** Le joueur voit la saison, la phase du jour et une **prévision météo à deux journées**. La météo est tirée du RNG seedé, jamais d'une surprise.
- **Tout est déterministe.** Même graine, même `Scenario.date`, même suite de météos. Le moteur ne lit jamais l'horloge.
- **Le climat handicape, il n'élimine pas.** Comme une mécanique régionale : aucune mise hors jeu directe, aucun changement de propriétaire.

### 12.1 Calendrier réel et date du match

La Ronde se joue en temps réel : **la date du monde est la date réelle**. Un match prend la date du jour où il commence, `Scenario.date` (`03-schemas.md` §6), **figée à la création et jamais recalculée** — c'est elle qui rend le rejeu stable. La date réelle n'entre dans le système qu'au moment où le scénario est écrit ; le moteur la reçoit comme une donnée quelconque.

La saison se déduit du couple (`Scenario.date`, `Country.hemisphere`) :

```
mois = mois(Scenario.date)                          // 1 à 12
base = ['hiver','hiver','printemps','printemps','printemps','ete',
        'ete','ete','automne','automne','automne','hiver'][mois - 1]

hemisphere 'nord'      → saison = base
hemisphere 'equateur'  → saison = base
hemisphere 'sud'       → saison = oppose(base)      // printemps↔automne, ete↔hiver
```

Jouer le Brésil en janvier, c'est donc jouer **en été**. Le découpage est mensuel et non astronomique **[proposition]** : c'est lisible, ça se calcule sans table d'équinoxes, et l'écart de trois semaines avec le vrai solstice n'a aucune conséquence de jeu. Pour un pays `equateur`, la saison est calculée comme au nord mais seules deux saisons ont un effet (voir la ligne `tropical` du §12.2) : l'été est la saison des pluies, l'hiver la saison sèche, le printemps et l'automne sont des transitions neutres.

**La saison est fixe pendant un match.** Un match dure au plus 60 journées de jeu, pas six mois. Un scénario peut la forcer avec `Scenario.climatFixe.saison` — c'est ce qui permet d'écrire un prologue « en plein hiver » quel que soit le jour où on le joue.

### 12.2 Table climat × saison

Ce que fait une saison dépend du **climat du pays** (`Country.climat`, huit valeurs). Chaque case donne les effets de saison actifs ; `—` signifie que la saison ne change rien.

| Climat \ Saison | printemps | été | automne | hiver |
|---|---|---|---|---|
| `tempere` | — | — | `forets_sans_couvert` | `neige_plaines`, `rivieres_gelees` |
| `oceanique` | `sol_detrempe` | — | `forets_sans_couvert`, `sol_detrempe` | `sol_detrempe` |
| `mediterraneen` | — | `canicule_saison` | `forets_sans_couvert` | — |
| `continental` | `sol_detrempe` | — | `forets_sans_couvert` | `neige_plaines`, `rivieres_gelees` |
| `tropical` | — | `saison_des_pluies` | — | — |
| `aride` | — | `canicule_saison` | — | `nuits_froides` |
| `polaire` | `rivieres_gelees` | — | `neige_plaines` | `neige_plaines`, `rivieres_gelees`, `nuit_polaire` |
| `montagnard` | `sol_detrempe` | — | `forets_sans_couvert` | `neige_plaines`, `cols_fermes` |

Les huit effets de saison, chiffrés :

| Effet | Ce qu'il fait exactement | Hook |
|---|---|---|
| `neige_plaines` | **+1** au coût de mouvement des cases `plaine` et `route` pour `roues` et `chenilles`. `pied`, `bottes` et `air` ne sont pas concernés : la neige efface l'avantage des axes rapides, elle ne bloque pas l'infanterie. | `surMouvement` |
| `rivieres_gelees` | Une case `riviere` est **vue comme `plaine`** : franchissable par tous, défense 1. La ligne de rivière cesse d'être une ligne de défense — c'est le plus gros changement tactique de tout le chapitre. **Sauf** sur les cases d'une mécanique régionale déclarée `gelable: false` (§12.6). | `modifTerrain` |
| `forets_sans_couvert` | La forêt **ne cache plus** : une unité en forêt est visible à la vision normale (§10). Coûts et défense inchangés. | brouillard (§12.6) |
| `sol_detrempe` | **+1** au coût de mouvement pour `roues` **hors `route`**. | `surMouvement` |
| `canicule_saison` | Toute **unité lourde** — `domaine === 'terre'` et `cout ≥ 7 000` (`char_lourd`, `roquettes`, `antiair`) — perd **1 point de mouvement** hors `route`. | `debutTour` (modificateur) |
| `saison_des_pluies` | `sol_detrempe` en permanence, **et** la table de probabilités du §12.4 bascule sur la ligne tropicale d'été (55 % de pluie). | `surMouvement` + tirage |
| `nuits_froides` | Pendant la phase `nuit` uniquement : **−1 mouvement** pour toutes les unités de `domaine === 'terre'`. Le désert la nuit. | `debutTour` (modificateur) |
| `cols_fermes` | **+1** au coût de la case `montagne` pour `pied` et `bottes` (donc 3 et 2). La montagne reste un perchoir, elle devient un perchoir cher. | `surMouvement` |
| `nuit_polaire` | Force `cycleJourNuit` à `{ jour: 0, nuit: 6 }` : la partie entière se joue de nuit. Réservé au climat `polaire` en hiver. | initialisation |

**Un surcoût de mouvement ne dépasse jamais 4** (le maximum de `Terrain.couts`) et **ne descend jamais sous 1**, quels que soient les cumuls. Sans ce plafond, neige + sol détrempé + mistral immobilise une armée entière, ce qui n'est pas du jeu.

### 12.3 Jour et nuit

`PhaseJour = 'jour' | 'nuit'`. Le cycle est **compté en journées**, pas en tours, et déclaré par le scénario : `cycleJourNuit: { jour: number; nuit: number }`, **défaut 4 / 2**.

```
journeeDansCycle avance de 1 au début de chaque journée (quand le camp 0 reprend la main)
et repasse à 0 après (jour + nuit − 1)

phase = journeeDansCycle < cycleJourNuit.jour ? 'jour' : 'nuit'
```

La phase est donc **la même pour les deux camps** d'une journée : personne ne joue de nuit pendant que l'autre joue de jour. Les extrêmes sont autorisés : `{ jour: 0, nuit: 6 }` est la nuit polaire islandaise en hiver, `{ jour: 6, nuit: 0 }` le jour polaire d'été.

**Ce que fait la nuit, exactement :**

- **Le brouillard de guerre est imposé**, même si `Scenario.brouillard === false`. Il redevient ce qu'il était au lever du jour.
- **Vision −2, minimum 1**, pour toutes les unités. Un recon voit 3, une infanterie 1, un char lourd 1.
- **Les villes, usines, aéroports et QG sont éclairés** : leur vision de bâtiment (2, §10) est **inchangée**. Tenir un bâtiment, c'est tenir un phare — la nuit renforce la valeur des positions plutôt que de tout noircir.
- **L'infanterie en forêt est invisible sauf adjacence** : la règle de cachette du §10 s'applique, et elle s'applique désormais même sur une carte sans brouillard déclaré. C'est l'embuscade de nuit.
- **Le trait `furtif_nuit` ignore les malus** : l'unité qui le porte garde sa vision pleine. **[proposition]** elle n'est elle-même repérée qu'à distance 1, quel que soit son terrain.
- **Les pouvoirs ne sont pas affectés.** Ni leur coût, ni leur effet, ni leur durée. La nuit change ce qu'on voit, pas ce qu'on peut faire.

### 12.4 Météo

`Meteo = 'clair' | 'pluie' | 'neige' | 'brouillard' | 'tempete' | 'canicule'`. **Une météo par journée**, tirée du flux `rng.branche('climat')` dans la table ci-dessous, indexée par (climat du pays, saison). Le commentateur d'Atlas annonce une **prévision à deux journées** : au début de la journée J, le moteur tire la météo de J+2 et la publie dans `EtatClimat.previsions`. À l'initialisation, il tire les journées 1, 2 et 3 d'un coup, pour que la prévision soit pleine dès le premier écran.

**Table de probabilités, en pourcentage.** Chaque ligne somme à 100.

| Climat | Saison | clair | pluie | neige | brouillard | tempête | canicule |
|---|---|---:|---:|---:|---:|---:|---:|
| `tempere` | printemps | 55 | 30 | 0 | 10 | 5 | 0 |
| `tempere` | été | 70 | 15 | 0 | 5 | 5 | 5 |
| `tempere` | automne | 45 | 30 | 0 | 20 | 5 | 0 |
| `tempere` | hiver | 40 | 20 | 25 | 10 | 5 | 0 |
| `oceanique` | printemps | 40 | 40 | 0 | 15 | 5 | 0 |
| `oceanique` | été | 55 | 30 | 0 | 10 | 5 | 0 |
| `oceanique` | automne | 30 | 40 | 0 | 15 | 15 | 0 |
| `oceanique` | hiver | 25 | 40 | 10 | 15 | 10 | 0 |
| `mediterraneen` | printemps | 70 | 20 | 0 | 5 | 5 | 0 |
| `mediterraneen` | été | 75 | 5 | 0 | 0 | 5 | 15 |
| `mediterraneen` | automne | 55 | 30 | 0 | 5 | 10 | 0 |
| `mediterraneen` | hiver | 60 | 30 | 0 | 5 | 5 | 0 |
| `continental` | printemps | 55 | 30 | 0 | 10 | 5 | 0 |
| `continental` | été | 65 | 15 | 0 | 5 | 5 | 10 |
| `continental` | automne | 50 | 25 | 5 | 15 | 5 | 0 |
| `continental` | hiver | 30 | 10 | 45 | 10 | 5 | 0 |
| `tropical` | printemps | 60 | 25 | 0 | 5 | 10 | 0 |
| `tropical` | été | 20 | 55 | 0 | 5 | 15 | 5 |
| `tropical` | automne | 55 | 25 | 0 | 5 | 10 | 5 |
| `tropical` | hiver | 70 | 15 | 0 | 5 | 5 | 5 |
| `aride` | printemps | 80 | 5 | 0 | 0 | 10 | 5 |
| `aride` | été | 65 | 0 | 0 | 0 | 10 | 25 |
| `aride` | automne | 80 | 5 | 0 | 0 | 10 | 5 |
| `aride` | hiver | 80 | 10 | 0 | 5 | 5 | 0 |
| `polaire` | printemps | 45 | 10 | 30 | 10 | 5 | 0 |
| `polaire` | été | 55 | 20 | 10 | 10 | 5 | 0 |
| `polaire` | automne | 35 | 10 | 40 | 10 | 5 | 0 |
| `polaire` | hiver | 25 | 0 | 50 | 10 | 15 | 0 |
| `montagnard` | printemps | 45 | 25 | 10 | 15 | 5 | 0 |
| `montagnard` | été | 60 | 20 | 0 | 10 | 10 | 0 |
| `montagnard` | automne | 40 | 25 | 10 | 20 | 5 | 0 |
| `montagnard` | hiver | 30 | 10 | 40 | 10 | 10 | 0 |

C'est la table qui porte la vraisemblance : il ne neige jamais dans le désert parce que la ligne le dit, pas parce qu'une règle l'interdit ailleurs.

**Effets, chiffrés :**

| Météo | Effet exact |
|---|---|
| `clair` | Rien. C'est la météo la plus fréquente partout sauf en été tropical et en hiver polaire. |
| `pluie` | **+1** au coût de mouvement pour `roues` **hors `route`** ; **vision −1** pour toutes les unités (minimum 1). |
| `neige` | **+1** au coût de mouvement pour tous les types terrestres **sauf `pied` et `chenilles`** — donc `bottes` et `roues`. L'infanterie et les chenilles passent ; les roues s'enlisent. `air` n'est pas concerné. |
| `brouillard` | **Vision 1** pour toutes les unités — une valeur absolue, pas un retrait — et **brouillard de guerre imposé**. Les bâtiments gardent leur vision 2. |
| `tempete` | Unités de `domaine === 'air'` : **mouvement divisé par deux**, arrondi vers le bas, minimum 1. Toute attaque d'une unité `tir_indirect` : **dégâts −20 %**. |
| `canicule` | Toute **unité lourde** (`terre`, `cout ≥ 7 000`) perd **1 point de mouvement** hors `route` — la même règle que `canicule_saison`. |

**Pas de double compte :** `canicule` (météo) et `canicule_saison` (saison) désignent le même malus et **ne se cumulent pas**. C'est le seul recouvrement entre les deux tables, et il est résolu ici.

### 12.5 Implémentation : quel hook fait quoi

La couche climat n'invente rien. Elle est un greffon comme un autre, sur les **cinq hooks** de §11.1, et elle est appelée **avant** la mécanique régionale sur chacun d'eux — pour que le local ait le dernier mot sur le global.

| Hook | Ce que la couche climat y fait |
|---|---|
| `debutTour` | Au tour du camp 0 seulement : avance `journeeDansCycle`, recalcule `phase`, tire la météo de J+2, décale `previsions`, émet l'`annonce` du commentateur (« Nuit, brouillard imposé — demain pluie, après-demain clair »). Pour les deux camps : pose les **modificateurs globaux** de la journée via l'effet `modificateur` (vision de nuit, vision de pluie et de brouillard, mouvement de canicule et de nuits froides), en `duree: 'tour_complet'`. |
| `finTour` | Retire les modificateurs de durée `ce_tour` ; consigne `EtatClimat` dans l'état sérialisé, pour que la sauvegarde et la routine contrôle relisent exactement la journée jouée. |
| `surMouvement` | Applique les **surcoûts de case** : `neige_plaines`, `sol_detrempe`, `cols_fermes`, pluie sur roues, neige sur bottes et roues. Comme le mistral, il **tronque** le chemin (`cheminTronque`) au lieu de le refuser : l'unité avance autant qu'elle peut. |
| `surAttaque` | `tempete` : dégâts d'une unité `tir_indirect` **−20 %**. C'est le seul effet climatique sur le combat — le climat gêne le déplacement et la vue, il ne change pas la table de dégâts. |
| `modifTerrain` | `rivieres_gelees` : une case `riviere` est vue comme `plaine`. C'est aussi ce hook qui donne la lecture logique des cases posées par un effet `poser_terrain` (§7.2). |

**Un point hors des cinq hooks, assumé et marqué [proposition] :** le **brouillard** (§10) lit `EtatPartie.climat` directement, dans `engine/brouillard.ts`, pour deux règles que ni un modificateur ni `modifTerrain` n'exprime — `forets_sans_couvert` (le couvert est un booléen du terrain, `cacheEnBrouillard`, pas un chiffre) et l'imposition du brouillard de guerre la nuit. C'est une lecture, jamais une écriture, et elle reste pure et déterministe. Toute autre entorse au contrat des cinq hooks est un refus.

### 12.6 Cumul avec les mécaniques régionales

Les deux couches **se cumulent** : marées + tempête, mistral + neige, inondation + saison des pluies. **Cinq** règles de résolution :

1. **Ordre.** Climat d'abord, mécanique régionale ensuite, sur chaque hook. La mécanique voit donc un terrain déjà réinterprété par le climat, et sa vue l'emporte en cas de conflit sur la même case (`modifTerrain` : le dernier appelé gagne).
2. **Mouvement.** Les surcoûts s'**additionnent**, puis le coût de la case est plafonné à 4 et planché à 1. Une rivière gelée traversée sous la neige coûte 1 (plaine) + 1 (neige, si `roues`) = 2.
3. **Combat.** Les modificateurs se **multiplient**, et le produit reste dans [0,5 ; 2,0] comme tout multiplicateur du jeu (§5). Une tempête (−20 % indirect) et un mistral contraire (−10 %) donnent 0,8 × 0,9 = 0,72, pas 0,7.
4. **Refus de gel.** Toute mécanique régionale accepte le paramètre commun **`gelable: boolean`, défaut `true`** (`BRIEF.md`, seconde relecture, point 5 ; forme dans `03-schemas.md` §7). À `false`, les effets de saison qui **rendent franchissable ou neutralisent** les cases régies par la mécanique — au premier chef `rivieres_gelees` — ne s'y appliquent pas : les cases gardent leur terrain de grille et la mécanique garde la main. C'est un paramètre de fiche, pas une exception de code, et il vaut pour tout fleuve majeur. Le **Grand Est** est le premier à s'en servir : son grand fleuve est trop large et trop courant pour prendre, il ne gèle **jamais**, et `meca_fleuve_ponts` reste la leçon de la carte même en hiver continental (`07-france-regions.md` §4.6). Une mécanique qui déclare `gelable: false` doit le dire au joueur dans sa `description` : une règle invisible est une règle injuste.
5. **Jouabilité.** La routine contrôle simule chaque carte **sous plusieurs saisons et météos**, et une carte doit rester jouable dans **toutes** (`02-architecture.md` §8). Une carte dont l'unique passage est un pont, jouée en hiver continental avec rivières gelées, n'est plus la même carte : c'est exactement ce que la matrice climatique attrape — et `gelable: false` est la réponse quand ce changement de nature n'est pas voulu.

### 12.7 Ce que l'IA doit en savoir

L'IA lit `EtatPartie.climat` **comme le joueur, et pas plus** : la saison, la phase, la météo du jour et les deux journées de prévision. Elle ne peut pas tirer la météo de J+3 — ce serait de la triche, et le test de déterminisme le verrait (elle consommerait le flux `climat`).

Ce qu'elle en fait, dans la stratégie `ponderee` :

- **Achats.** Pas d'hélicoptère quand une `tempete` est prévue dans les deux journées ; priorité aux `chenilles` et à l'infanterie quand la `neige` est prévue ; pas d'unité lourde sous `canicule` si l'objectif est hors route.
- **Chemins.** Elle recalcule ses coûts avec les surcoûts de la journée, pas avec la table nue — sinon elle promet des mouvements qu'elle ne peut pas faire et perd des tours.
- **Rivières gelées.** Une rivière cesse d'être une frontière : la carte d'influence est recalculée à la bascule, sans quoi l'IA défend une ligne qui n'existe plus.
- **Nuit.** Elle resserre ses unités, évite de s'engager hors vision, et valorise les bâtiments (éclairés) comme postes d'observation. Une unité `furtif_nuit` est au contraire poussée en avant.
- **Prévision.** Un terme « météo prévue » entre dans sa fonction de score : attaquer aujourd'hui sous la pluie ou attendre demain sous un ciel clair est une vraie décision, et c'est celle qui rend le climat intéressant.

La stratégie `gloutonne` **ignore le climat**. C'est délibéré : c'est une partie de ce qui la rend plus faible, et cela donne à la routine contrôle un étalon (si `ponderee` ne bat pas `gloutonne` plus souvent sous météo difficile, c'est que les effets climatiques ne servent à rien).

---

## 13. Homologation : le catalogue d'unités vivant

La **Commission d'homologation d'Atlas** autorise de nouveaux matériels au fil du temps (`BRIEF.md`, « Le jeu vivant »). Une technologie civile réelle de la liste blanche — drone longue portée, avion solaire, train à hydrogène, exosquelette — peut devenir une unité. Ce chapitre dit ce qu'une unité nouvelle a le droit d'être ; `02-architecture.md` §6.1 dit comment elle arrive.

### 13.1 Tout en données, jamais en code

**Une unité nouvelle n'ajoute pas une ligne de code.** Elle se décrit entièrement par un objet `UnitType` (`03-schemas.md` §3) : type de mouvement, coût, mouvement, portée, vision, munitions, carburant, ligne et colonne de la table de dégâts, **au plus deux traits** pris dans une liste fermée, et une **silhouette** déclarative. Les dix traits sont implémentés **une seule fois** dans le moteur, et les dix unités de base les portent déjà (§3) : c'est ce qui rend la promesse tenable. Une candidate qui demanderait un comportement hors de cette liste est refusée — pas ajournée, refusée. Le catalogue s'enrichit, le moteur ne bouge pas.

### 13.2 Les treize traits, précisément

| Trait | Ce qu'il fait exactement | Ce qu'il impose au reste de la fiche | Qui le porte aujourd'hui |
|---|---|---|---|
| `capture` | L'unité peut émettre la suite `{ type: 'capturer' }` et accumule ses PV affichés en points de capture (§6). | `capture === true`, `typeMouvement ∈ {pied, bottes}` | `infanterie`, `meca` |
| `transport` | Charge une unité amie `pied` ou `bottes` et la débarque (§2). L'unité chargée ne joue plus ce tour. | `transport !== null`, `places` 1 à 2, jamais un transport dans un transport | `transport` |
| `tir_indirect` | Tire à distance, **ne riposte jamais**, **ne tire pas après avoir bougé**, et ne vise qu'une case visible par son camp (§10). | `portee[0] ≥ 2`, `peutRiposter === false`, `peutTirerApresMouvement === false` | `artillerie`, `roquettes` |
| `anti_air` | Contre dédié de l'air : dégâts ≥ 100 contre au moins une unité `vol`, et ≤ 30 contre toute unité `terre` de coût ≥ 10 000. | ligne de la table de dégâts | `antiair` |
| `vol` | `domaine === 'air'` : coût de terrain 1 partout, ignore la zone de contrôle, n'est visée que par les unités portant `anti_air` ou `vol` et par l'infanterie et la méca ; consomme du carburant même immobile. | `typeMouvement === 'air'`, `carburant !== null` avec `parTour ≥ 1` | `helico` |
| `amphibie` | Franchit `mer` et `riviere` au coût 2. **Réservé au paquet naval** (§3) : refusé tant que la mer n'est pas ouverte. | `typeMouvement === 'amphibie'` | personne |
| `furtif_nuit` | Ignore les malus de vision de la nuit (§12.3). | — | personne |
| `vision_etendue` | Voit loin, et **+1 de vision supplémentaire sur `montagne`**, cumulé avec le +2 du §10. | `vision ≥ 5` | `recon` |
| `ravitaillement` | En guise de suite d'ordre, remet munitions et carburant au plein d'**une** unité amie adjacente, une fois par tour. Ne soigne pas. | toutes les valeurs de `degats` à 0, `munitions === null` | personne |
| `tout_terrain` | Coût 1 sur `montagne` et sur `riviere`, quel que soit le `typeMouvement`. | — | `meca` |
| `genie` | Construit (pont sur rivière, route en montagne, 1 500 fonds) et **remet en service** un bâtiment désaffecté deux fois plus vite qu'un capteur (§6 bis). Ne capture rien d'autre. | — | `genie` |
| `drone` | Œil volant **brouillable** : à portée d'un `brouilleur` ou d'une station `radar` adverse, sa vision tombe à un dixième (§10 bis). | `vol`, toutes les valeurs de `degats` à 0 | `drone` |
| `brouilleur` | Brouille tout `drone` adverse à dix cases. | toutes les valeurs de `degats` à 0, jamais avec `drone` | `brouilleur` |

Trois traits ne sont portés par personne aujourd'hui — `amphibie`, `furtif_nuit`, `ravitaillement`. Ce sont des **places réservées** : ils existent pour que le paquet naval, le climat et la logistique aient un vocabulaire prêt le jour où une candidate les demande.

### 13.3 La ligne et la colonne à fournir

La table de dégâts (§8) est carrée. Une unité nouvelle en fait une table de N+1 côtés, et elle doit fournir **les deux** :

- **Sa ligne** — ce qu'elle inflige à chacune des unités actives, elle-même comprise.
- **Sa colonne** — ce que chacune des unités actives lui inflige.

Les deux sont **obligatoires et complètes**. Une case absente vaut 0, et 0 signifie « ne peut pas viser » : oublier une colonne, c'est livrer une unité invulnérable — motif de rejet `unite_dominante`. La colonne est écrite par la candidate, **jamais par les unités existantes** : une homologation ne modifie pas une seule valeur du catalogue canon, ce qui garantit qu'elle ne peut pas déséquilibrer rétroactivement une partie déjà jouée.

Quatre contraintes de forme, vérifiées par la routine contrôle :

1. **Diagonale < 100** : une unité ne se met jamais hors jeu elle-même en un coup (sauf à ne pas pouvoir se viser du tout, valeur 0).
2. **Au moins une unité `canon` lui inflige ≥ 70** : pas d'unité sans contre.
3. **Elle inflige ≤ 30 à au moins deux unités `canon`** : pas d'unité universelle.
4. **Si elle porte `vol`**, seules les unités portant `anti_air` ou `vol`, plus `infanterie` et `meca`, ont une valeur non nulle dans sa colonne — la règle des quatre viseurs du §8 reste vraie.

### 13.4 Bornes de coût, mouvement, portée

| Champ | Borne dure (schéma) | Borne de conception (routine contrôle) |
|---|---|---|
| `cout` | multiple de 100, 1 000 à 20 000 | efficacité par coût dans **[0,8 ; 1,2]** fois la médiane du catalogue ; au-dessus → `unite_dominante`, en dessous de 0,7 → `unite_inutile` |
| `mouvement` | 1 à 9 | ≤ 6 si `cout ≥ 10 000` ; ≤ 4 si `terre` **et** `portee[1] ≥ 3` — une longue portée mobile est le déséquilibre classique |
| `portee` | `portee[0] ≤ portee[1]` | `[1,1]` (direct) ou `portee[1] ≤ 5` et `portee[1] − portee[0] ≤ 3` |
| `vision` | 0 à 6 | ≥ 5 exige le trait `vision_etendue` |
| `traits` | 0 à 2, liste fermée | deux traits qui se contredisent (`vol` + `tout_terrain`, `tir_indirect` + `capture`) sont refusés |
| `degats` | 0 à 130 par case | contraintes du §13.3 |
| `silhouette` | 3 modules au plus | strictement différente de toute silhouette active (`silhouette_invalide`) |

Deux motifs de rejet portent tout le poids de l'équilibrage, et ils sont mesurés, pas jugés : **`unite_dominante`** — le taux de victoire du camp qui l'achète dépasse 60 %, ou son efficacité par coût sort par le haut ; **`unite_inutile`** — elle est achetée dans moins de 5 % des parties simulées, ou son efficacité sort par le bas. La routine contrôle simule le catalogue **avec et sans** la candidate, sur les mêmes graines.

### 13.5 La silhouette

Le dessin est **déclaratif** : `Silhouette = { base, corps, modules, taille }` (`03-schemas.md` §3). Les pièces de `render3d/pieces.ts` composent `base` (chenilles, roues, pattes, coque, rotor, ailes, rail), puis `corps` (bloc, capsule, plateau), puis les `modules` — **trois au plus** — posés à des ancres fixes du corps. Le palette swap s'applique comme aux dix unités canon : une nation, une teinte, aucun dessin propre. Une unité nouvelle n'apporte donc **ni fichier, ni image** (`02-architecture.md` §3.4). La silhouette doit rester **lisible à 64 px** : c'est la raison des trois modules, pas une contrainte de fichier.

### 13.6 Les quatre statuts

| Statut | Ce qu'il autorise |
|---|---|
| `canon` | Les **dix** unités de base. Disponibles partout, dans toute la campagne, dans toutes les missions. **Jamais retirées**, jamais modifiées par une homologation. |
| `essai` | Disponible **uniquement dans les missions du jour** (§13.7), pendant **30 jours**. Jamais en campagne, jamais dans un scénario d'acte 0 à 3. C'est la période où l'on mesure. |
| `homologuee` | Disponible partout, campagne comprise. C'est le seul statut qu'une unité d'essai peut gagner, et il se gagne sur les métriques, pas sur l'enthousiasme. |
| `retiree` | Plus produisible nulle part. Une partie en cours et un rejeu qui la contiennent **restent valides** : ils se résolvent dans leur `catalogueVersion`, où l'unité existe encore. |

Les transitions sont à sens unique — `essai → homologuee` ou `essai → retiree`, `homologuee → retiree` — sauf retour arrière humain explicite, qui crée une nouvelle version de catalogue.

### 13.7 Bornes de rythme et plafond de 24

- **Une candidate par semaine au plus.** La routine cerveau ne propose pas davantage, le serveur refuse au-delà.
- **Une homologation par mois au plus.** Passer d'`essai` à `homologuee` est un événement rare.
- **Catalogue plafonné à 24 unités actives** — `canon` + `essai` + `homologuee`. Les dix `canon` occupent dix places de façon permanente : il reste **quatorze** places. Quand le plafond est atteint, homologuer exige de **retirer une `homologuee`** — la moins jouée sur les 90 derniers jours — et **jamais une `canon`**.
- **Une unité en `essai` compte dans le plafond.** Sinon on empile les essais et on livre un jeu de trente unités par la petite porte.

**Ce que l'essai suppose : la Dépêche du jour.** Une `MissionDuJour` (`03-schemas.md` §14) est une mission courte — **10 à 15 journées** — indépendante de la campagne : elle n'écrit aucun flag, sa récompense est cosmétique ou une carte de terrain, au plus une. C'est le seul terrain de jeu d'une unité en `essai`, et c'est délibéré : une unité mal réglée y gâche une partie de quinze journées, pas une campagne de quarante heures.

---

## 14. Les deux modes

*Document propriétaire du sujet : `13-campagne.md` §6, qui donne le contexte et les chiffres de campagne. Ce paragraphe fixe ce que le mode fait — et surtout ne fait pas — aux règles.*

### 14.1 Le mode ne change aucune règle

`Mode = 'normal' | 'difficile'`. Le mode se choisit au début d'une campagne et se change à tout moment ; la campagne le mémorise, et certains déblocages exigent d'avoir **fini** en `difficile` (`13-campagne.md` §8).

Ce que le mode **ne touche jamais** :

- la table de dégâts (§8) et la formule de dégâts (§5) ;
- les coûts de terrain (§4) et les règles de mouvement (§2) ;
- les conditions de victoire et de défaite (§9) ;
- les pouvoirs, leurs effets, leurs durées et leurs bornes (§7) ;
- le climat : saisons, cycle jour/nuit, tirage de la météo (§12) ;
- les mécaniques régionales (§11) ;
- le catalogue d'unités (§13).

Autrement dit : **un scénario en `difficile` se joue avec le même moteur, la même graine et le même contenu.** Seuls changent les paramètres de `Scenario.modes` — ce qui est exactement ce qui permet à la routine contrôle de certifier les deux modes avec le même code, et à un rejeu de rester valide quand le joueur change d'avis entre deux matchs.

### 14.2 La table des paramètres

| Paramètre (`ParametresMode`) | `normal` | `difficile` | Effet en jeu |
|---|---|---|---|
| `fondsDepart` (joueur) | valeur du scénario | **identique** | On ne punit pas le joueur en l'appauvrissant |
| `fondsDepartIa` | = celui du joueur | **× 1,25** | L'IA prend une avance de tempo dès la première journée |
| `revenusParBatiment` (joueur) | 1 000 | **identique** | — |
| `revenusIaParBatiment` | 1 000 | **1 400** | L'écart se creuse avec la durée : un `siege` devient réellement plus dur |
| `brouillard` | selon le scénario | **imposé une fois sur deux**, jamais levé s'il l'était déjà | Règle existante (§10), jamais une règle nouvelle |
| `previsionJournees` (le Bulletin, §12.4) | **2** | **1** | Le climat reste annoncé, jamais subi : on voit moins loin, on voit quand même |
| `vitesseJauge` | × 1,0 | **× 0,8** | Environ un pouvoir de moins par match. Levier le plus sensible : ne pas descendre sous 0,7 |
| `limiteJournees` | valeur du scénario | **× 0,85**, arrondi au supérieur, plancher 5 | Moins de temps pour la même chose ; la fin aux points (§9.1) arrive plus tôt |
| `strategieIa` | `ponderee` | **`agressive`**, ou `ponderee` sur les cartes où l'agressivité se suicide | Une IA plus dure, jamais une IA qui triche |
| `reprises` | **3 par match** | **0** | Fixé par `BRIEF.md` |
| `dureeVisee` | référence | **+10 à +20 %**, mesurés | Une conséquence, pas un réglage |

### 14.3 Ce que `difficile` ne fait jamais

- Il ne donne **aucune unité supplémentaire** à l'IA au départ : ce serait un autre scénario, pas un autre mode.
- Il ne **cache aucune information** au-delà du brouillard, qui est une règle du jeu et non une punition.
- Il ne rend pas la **météo imprévisible** : Atlas ne surprend pas un commandant avec le temps qu'il fait, en `difficile` comme ailleurs (`01-bible.md` §4.5).
- Il ne change ni les **conditions de victoire**, ni les **plafonds** (trois co-commandants, un actif ; trois cartes de terrain ; cinq spécialités, une équipée — §7.5, §7.6).

### 14.4 Certification

La routine contrôle certifie **les deux modes** de chaque scénario : deux campagnes de simulation, deux `StatsSimulation`, deux vérifications de `dureeVisee`. Un scénario certifié en `normal` et rejeté en `difficile` **n'est pas mis en ligne** : il n'existe pas de scénario à moitié jouable.

Le schéma pose un garde-fou en amont : `validerScenario` refuse un `difficile` plus facile que le `normal` sur n'importe lequel des axes du tableau (`03-schemas.md` §15.1). Un mode difficile plus facile est le bug le plus facile à écrire et le plus difficile à voir en jouant.

---

## 15. Récapitulatif des propositions hors brief

| # | Proposition | Où |
|---|---|---|
| 1 | PV internes sur 100, PV affichés sur 10 | §1 |
| 2 | Réparation payante, proportionnelle au coût de l'unité | §2 |
| 3 | Réparation aérienne limitée aux aéroports et aux villes | §2 |
| 4 | Zone de contrôle : arrêt à côté d'une unité adverse visible | §2 |
| 5 | Fusion d'unités avec remboursement du surplus | §2 |
| 6 | Valeurs chiffrées des dix unités et de la table de dégâts | §3, §8 |
| 7 | Seules quatre unités peuvent viser l'air | §8 |
| 8 | Montagne : bottes 1 / pied 2, et +2 vision en brouillard | §4, §10 |
| 9 | Aléa de combat borné à ±5 %, tiré d'un flux seedé dédié | §5 |
| 10 | Défense de terrain proportionnelle aux PV de la cible | §5 |
| 11 | Capture remise à zéro par le mouvement, pas par les dégâts | §6 |
| 12 | Jauge : 100 points par barre, gains à l'attaque et à la défense | §7 |
| 13 | Co-commandant : choix avant le coup d'envoi, changement entre deux matchs seulement | §7 |
| 14 | Fin aux points à la limite de journées, avec formule explicite | §9 |
| 15 | Le brouillard cache les unités, jamais le terrain | §10 |
| 16 | Contrat de mécanique : effets déclaratifs, pas de mise hors jeu, terrain logique par `modifTerrain` | §11 |
| 17 | Durée en journées `n = 3` réservée au super pouvoir ; `poser_terrain` permanent réservé au super pouvoir | §7 |
| 18 | Table des sept formes de `poser_terrain` (couples `depuis → vers`) et leurs bornes de cases | §7 |
| 19 | `EffetMecanique` gagne le variant `modificateur`, sans lequel la nuit et la canicule ne s'expriment pas | §11 |
| 20 | Découpage mensuel des saisons plutôt qu'astronomique | §12 |
| 21 | Table climat × saison, ses huit effets chiffrés, et la table de probabilités météo | §12 |
| 22 | Plafond 4 / plancher 1 sur tout coût de case après cumul climat + mécanique | §12 |
| 23 | Le brouillard lit `EtatPartie.climat` hors des cinq hooks (couvert d'automne, nuit) | §12 |
| 24 | `furtif_nuit` rend aussi l'unité indétectable au-delà de la distance 1 | §12 |
| 25 | Bornes de conception d'une unité candidate (efficacité par coût, mouvement/portée croisés) | §13 |
| 26 | Contraintes de forme sur la ligne et la colonne de dégâts d'une unité nouvelle | §13 |
| 27 | Une unité en `essai` compte dans le plafond de 24 | §13 |
| 28 | Le mode ne change aucune règle, seulement les paramètres de `Scenario.modes` | §14 |
| 29 | La table des paramètres de `difficile`, et l'invariant « un `difficile` n'est jamais plus facile » | §14.2, §14.4 |
