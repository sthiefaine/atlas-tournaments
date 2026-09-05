# 08 — Narration et choix à conséquences

*Atlas Tournament — système de choix, flags, réputation et fins. Canon supérieur : `BRIEF.md`, puis `01-bible.md` (§ 8) qui fait foi sur les noms de flags. Tout ce qui dépasse le brief est signalé par **[Proposition]**.*

---

## 1. Ce que ce système doit produire

Trois promesses, dans cet ordre :

1. **Le joueur se souvient de ce qu'il a fait.** Le carnet de voyage le lui relit ; Célestin Vantour le lui rappelle à voix haute avant les matchs.
2. **Le monde s'en souvient aussi.** Les commandants reviennent en alliés ou en rivaux, les cartes gardent leurs cicatrices, Atlas se méfie ou s'ouvre.
3. **La fin est une addition, pas un embranchement.** Aucun choix final ne rattrape un voyage ; le dernier acte ne fait que lire ce qui a été écrit.

Contrainte technique : le moteur est déterministe et ne parle à aucun modèle pendant une partie. Toute la conséquence passe donc par un état **explicite, borné, sérialisable** : les flags.

---

## 2. Le modèle de flags

### 2.1 Anatomie

Un flag est un couple `nom → valeur` dans l'état de sauvegarde. Nom : `<portée>.<domaine>.<nom>` (voir `01-bible.md` § 8.1).

| Type | Valeurs | Comportement |
|---|---|---|
| **booléen** | `false` / `true` | Posé une fois, jamais retiré. Un fait qui a eu lieu ne cesse pas d'avoir eu lieu. |
| **compteur** | entier borné, ex. `0…10` | Monotone croissant, saturé à la borne. Sert aux seuils. |
| **relation** | entier signé `−3…+3` | Le seul type qui peut baisser. Sert aux rapports avec une personne ou une entité. |

### 2.2 Portées

| Portée | Ce qu'elle décrit | Durée de vie | Lu par |
|---|---|---|---|
| `pays.<iso2>.*` | Ce qui s'est passé dans un pays et l'état de sa délégation | Toute la partie | Générateur de cartes, scènes du pays, acte III |
| `monde.<domaine>.*` | L'état global : Atlas, la faction, la Régie, le public, le tournoi | Toute la partie | Trame de fond, conditions de fin, ton des dialogues |
| `cmd.<id>.*` **[Proposition]** | Le rapport personnel avec un commandant nommé | Toute la partie | Recrutement, rivalités, dialogues de revanche |

**Pourquoi trois portées et pas une.** Un pays survit à ses commandants (on peut être bien vu en Suisse et détesté par la commandante suisse) ; un commandant voyage (il peut réapparaître dans un autre pays) ; le monde arbitre les fins. Fusionner les trois obligerait à faire porter une réputation collective par un individu, ce qui est exactement ce que la charte de sensibilité interdit.

### 2.3 Qui écrit quoi

| Écrivain | Nature | Ce qu'il peut écrire |
|---|---|---|
| **Le moteur** | Code déterministe, en fin de match | Résultats : `pays.<xx>.qualifie`, `pays.<xx>.terrain_altere`, `monde.public.ferveur`, `monde.tournoi.serie_propre`, `cmd.<id>.respect`/`grief` issus du style de victoire |
| **Une scène de choix** | Donnée JSON validée, jouée par le moteur | Tout flag déclaré dans son bloc `ecrit` |
| **La trame de fond** | Machine d'états scriptée, entre les étapes | Flags de progression : `monde.cinquieme.*`, `monde.atlas.arbitre_alliee`, `cmd.<id>.rival_jure` |
| **Le voyage** | Carte du monde | `pays.<xx>.visite` |
| **Les routines IA** | **Rien, jamais, à l'exécution** | Elles *déclarent* dans leur JSON les flags qu'une scène lit et écrit ; le moteur applique. Une routine ne touche jamais une sauvegarde. |
| **La routine contrôle** | Gardien | N'écrit aucun flag. Rejette toute production référençant un flag inconnu de `01-bible.md` § 8. |
| **La Dépêche du jour** | Manche d'exhibition, hors campagne | **Aucun flag de campagne**, jamais : ni `pays.*`, ni `monde.*` hors `monde.depeche.*`, ni `cmd.*`. Voir §4.4. |

### 2.4 Forme JSON d'une scène **[Proposition]**

> Le **schéma normatif** est `ChoixScenario` (`03-schemas.md` §6), qui fait foi sur les noms de champs : `cle`, `question`, `moment`, `litFlags`, `options[].cle`, `options[].libelle`, `options[].ecritFlags`, `options[].effetImmediat`. Ce paragraphe en donne la lecture narrative ; il ne définit pas une seconde forme.

```json
{
  "cle": "choix_fr_occitanie_barrage",
  "question": "Les vannes sont ouvrables. Le relevé homologué les mentionne.",
  "moment": "mi_partie",
  "litFlags": ["pays.fr.regions_visitees", "cmd.mireille_bousquet.respect"],
  "options": [
    { "cle": "ouvrir", "libelle": "Ouvrir les vannes.",
      "ecritFlags": [
        { "cle": "pays.fr.barrage_rompu", "valeur": true },
        { "cle": "pays.fr.terrain_altere", "valeur": 1 },
        { "cle": "cmd.mireille_bousquet.grief", "valeur": 2 },
        { "cle": "monde.regie.faveur", "valeur": 1 }
      ] },
    { "cle": "renoncer", "libelle": "Gagner à la loyale.",
      "ecritFlags": [
        { "cle": "cmd.mireille_bousquet.respect", "valeur": 2 },
        { "cle": "monde.atlas.credibilite", "valeur": 1 }
      ] }
  ]
}
```

Règles de forme : une scène déclare tout ce qu'elle lit (`litFlags`) et tout ce qu'elle écrit (`ecritFlags`) ; `valeur` est soit le littéral `true` (booléen), soit un delta signé (compteur, relation) ; aucune expression, aucun code. Le moteur borne, sature et applique. C'est ce qui rend le système vérifiable par la routine contrôle et rejouable à l'identique.

**Exception à la règle « écrit par le moteur ».** `pays.<xx>.terrain_altere` est normalement incrémenté par le moteur (§2.3). Une scène de choix peut l'écrire **uniquement** quand la décision elle-même produit la trace (ouvrir un barrage, inonder un polder) ; c'est le seul cas, et la routine contrôle le vérifie.

---

## 3. Le carnet de voyage

Le carnet est le **miroir lisible des flags**, et la seule interface où le joueur les voit. Il est diégétique : c'est l'Intendance d'Atlas qui le remet à chaque commandant en début de Ronde, pour le rapport de fin de tournoi.

**Une entrée contient :**

| Champ | Exemple |
|---|---|
| Repère temporel | *Ronde XIV — troisième étape* |
| Lieu | *Vallée du canal, Occitanie, France* |
| Décision, écrite à la première personne | *« J'ai ouvert les vannes. On a gagné en une manche. La vallée est encore sous l'eau. »* |
| Témoin | *Mireille Bousquet, éclusière et commandante de l'étape* |
| Conséquence connue | *Le barrage reste ouvert.* |

**Ce que le carnet ne fait pas :** il n'affiche pas de noms de flags, pas de chiffres, pas de barre de réputation. Le joueur lit des faits, pas des statistiques. **[Proposition]** Une seule concession : les pages où un commandant a laissé un mot en marge sont marquées d'un signet — c'est le seul indice visuel que quelque chose a été enregistré.

**[Proposition] Les pages scellées.** Le joueur peut remettre une page au Collège des arbitres comme pièce à charge (`monde.carnet.pages_scellees +1`). Cela transforme un souvenir en preuve — utile pour le dossier contre la faction, coûteux car la page devient publique et peut trahir un allié.

---

## 4. Réputation par commandant

### 4.1 Deux jauges, pas une

Chaque commandant nommé porte `cmd.<id>.respect` et `cmd.<id>.grief`, tous deux en 0–5, **indépendants**. On peut être à la fois respecté et détesté — c'est même le cas le plus intéressant : un adversaire qui vous en veut *et* vous estime revient comme rival de haut niveau, pas comme caricature de vengeance.

| Écrit par | Respect | Grief |
|---|---|---|
| Style de victoire (moteur) | Victoire serrée, ou obtenue sans exploiter une faute : `+1` | Victoire par mise hors jeu totale alors que le QG était capturable : `+1` |
| Après-match | Refuser le protêt facile, saluer, rendre le matériel : `+1` | Réclamer une sanction maximale : `+1` |
| Scène de choix | Aider contre un tricheur, couvrir une erreur : `+1` à `+2` | Profiter de l'erreur, humilier en direct : `+1` à `+2` |
| Trame | Prendre son parti à l'acte III : `+2` | Le dénoncer publiquement : `+2` |

### 4.2 Ce que ça débloque

| Seuil | Effet |
|---|---|
| `respect ≥ 3` et `grief ≤ 1` | Le commandant devient **recrutable comme co-commandant** (`cmd.<id>.co_commandant`). Ce qu'il apporte est tranché (`BRIEF.md`, arbitrage n° 2) et chiffré par `04-gameplay.md` §7.5, qui fait foi : **son passif seul, plus une barre de jauge de départ**. Un **commandant régional français** apporte en plus sa **carte de terrain à usage unique**, qui **est l'une des trois** cartes de la sacoche et jamais une quatrième (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5, `07-france-regions.md` §2.4). **Pas de demi-pouvoir** : ce document n'en propose plus. |
| `respect ≥ 2` | Il rend un service unique (`cmd.<id>.dette`) : un renseignement, un accès, un témoignage pour le dossier. |
| `grief ≥ 3` | Il devient **rival juré** (`cmd.<id>.rival_jure`) : il revient plus tard avec une équipe renforcée, un pouvoir amélioré et un objectif de match personnel contre vous. |
| `grief ≥ 4` et `respect ≤ 1` | Il est **recrutable par la Cinquième Manche** à l'acte III : son pays bascule beaucoup plus facilement. |
| `respect ≥ 4` et `grief ≥ 3` | **Rival d'estime** : il reste adversaire, mais refuse de rejoindre la faction quoi qu'il arrive. La meilleure relation du jeu. **[Proposition]** |

### 4.3 Nombre de co-commandants

**Trois co-commandants recrutés au maximum, un seul actif par match**, changeable entre les étapes (`BRIEF.md`, arbitrage n° 2). C'est la règle générale, et `07-france-regions.md` §2.4 en est une conséquence, pas une règle concurrente : le commandant régional que le joueur emmène au mondial est simplement l'un de ces trois — celui qui ajoute sa carte de terrain à usage unique, **prise sur les trois emplacements de la sacoche et non en plus** (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5). Un joueur n'arrive donc jamais au mondial avec quatre cartes. Sans plafond, la mécanique récompenserait la collection exhaustive plutôt que le choix ; avec plafond, refuser un allié devient une décision.

Diégétiquement, le plafond n'est pas arbitraire : la feuille de match d'Atlas ne comporte qu'une ligne d'**assistance déclarée** (`01-bible.md` §6). On la remplit avant le coup de sifflet, et on ne la rature pas.

### 4.4 La Dépêche du jour et la narration

La **Dépêche du jour** (`01-bible.md` §4.6, `BRIEF.md`) est une manche d'exhibition quotidienne, inspirée d'un événement réel du registre autorisé. Elle touche à ce document par une seule règle, et cette règle est dure :

1. **Une mission du jour n'écrit aucun flag de campagne.** Ni `pays.*`, ni `monde.*` (à l'exception de `monde.depeche.*`), ni `cmd.*`. Elle ne pose pas `visite`, elle n'incrémente pas `terrain_altere`, elle ne fait monter aucun respect ni aucun grief, elle n'ouvre aucune bascule de trame et elle n'entre dans le calcul d'aucune fin (§6, §7). Une scène de Dépêche qui déclare un tel flag en écriture est rejetée d'office par la routine contrôle (`01-bible.md` §8.6, règle 7).
2. **Ses récompenses sont cosmétiques, ou une carte de terrain au plus.** Un surnom de Vantour, une bannière, une teinte d'équipe, une page d'archives à lire — ou, au maximum, **une** carte de terrain à usage unique, la même monnaie que les commandants régionaux français (§4.2). Jamais un co-commandant, jamais une trace persistante, jamais un accès à une destination.
3. **Elle peut lire, elle ne peut pas écrire.** Rien n'interdit à une Dépêche de saluer ce que le joueur a déjà fait — Vantour reconnaît un habitué —, à condition que ce soit du commentaire et pas une conséquence.
4. **Le carnet de voyage l'ignore.** Le carnet est le miroir des décisions de la Ronde (§3) ; une exhibition n'y entre pas. Les Dépêches ont leur propre étagère, les archives de la Régie, et un compteur qui ne vit pas dans la sauvegarde de campagne : `monde.depeche.serie`.

**Ce que ça garantit :** la campagne reste complète sans jamais jouer une seule Dépêche, et deux joueurs qui ont fait exactement les mêmes choix de voyage obtiennent exactement la même fin, qu'ils aient joué zéro ou soixante missions du jour. C'est la condition pour qu'un contenu quotidien ne devienne pas un contenu obligatoire.

**Ce que le joueur peut quand même y gagner narrativement.** **[Proposition]** Deux flags de campagne existent *autour* de la Dépêche sans être écrits par elle : `monde.atlas.essai_soutenu` et `monde.atlas.homologation_contestee` (§9.4). Ils se posent dans une **scène de campagne** — un couloir de Port-Méridien, une conférence de presse d'après-match — où le joueur prend position sur une pièce de matériel à l'essai qu'il a croisée ailleurs. C'est la campagne qui écrit, jamais l'exhibition.

### 4.5 Les fils secondaires

*Document propriétaire du sujet : `13-campagne.md` §5, qui donne le type `Fil`, les neuf fils écrits et leurs bornes. Ce paragraphe dit leur place dans la narration.*

Un **fil** est une suite ordonnée de 3 à 8 missions avec un arc propre : un rival qui cherche sa revanche, un scandale d'homologation, une journaliste qui suit le joueur, un ancien champion. Il s'ouvre sur une condition (flags, pays visités, mode, date réelle, easter egg) et se joue **sur la carte du monde**, en occupant une case de destination — pas dans un écran séparé, pas dans une liste de quêtes. Le carnet de voyage lui suffit.

**Ce qui distingue un fil d'une Dépêche, et c'est la seule chose qui compte ici :**

| | Fil | Dépêche du jour |
|---|---|---|
| Écrit des flags de campagne | **oui**, `pays.*`, `monde.*`, `cmd.*` | **non**, jamais (§4.4) |
| Entre au carnet de voyage | oui | non, elle a l'étagère de la Régie |
| Compte dans une fin | par les flags qu'il pose, comme n'importe quelle scène | jamais |
| Récompense | une à quatre `Consequence` bornées | cosmétique, ou une carte de terrain au plus |
| Obligatoire | non | non |

**Les conséquences sont une liste fermée et bornée.** C'est la condition pour qu'un fil change réellement quelque chose sans déséquilibrer la campagne principale : `variante_dialogue`, `co_commandant`, `unite_offerte` (une ou deux, jamais trois), `trace_carte` (dans le plafond de trois traces par pays, §5), `remise_production` (de 5 à 20 %, jamais davantage), `objectif_alternatif`, `allie_acte_iii`, `entree_carnet`, `deblocage`. Les bornes sont dans le schéma (`03-schemas.md` §15.4) : la routine lore ne peut pas les franchir, même en essayant, et la routine contrôle rejette ce qui sort de la liste.

**Ce que ça garantit.** Un joueur qui ne joue aucun fil obtient la même fin qu'un joueur qui les fait tous, à choix de voyage identiques — les conséquences de fil ne touchent ni les bascules (§6) ni les conditions de fin (§7). Ce qu'un fil change, c'est **comment** on y arrive : un allié de plus au banc, une variante de dialogue, un objectif alternatif, une page au carnet. C'est la même règle d'étanchéité que pour la Dépêche, appliquée un cran plus haut : le contenu facultatif enrichit la campagne, il ne la remplace pas.

**Un fil ne pose jamais un flag `monde.secret.*`** : les easter eggs sont posés par du code écrit à la main (`01-bible.md` §8.6, règle 8). L'inverse est permis — un fil peut *lire* un secret comme condition d'ouverture, et `fil_quatre_traits` le fait, avec toujours une seconde porte.

---

## 5. Traces persistantes sur les cartes

Un flag de trace modifie la carte d'un pays lors des **revisites** (finale continentale, retour d'acte III, match d'exhibition).

**Fonctionnement.** Chaque fiche pays déclare des **calques de trace** : `flag → transformation de tuiles`. La routine map lit les flags à la génération, applique les calques, et la routine contrôle revalide **la jouabilité après application** — QG accessibles, aucune zone morte, équilibre des chemins. Une trace qui casserait la carte est refusée : la conséquence narrative ne prime jamais sur la validité du terrain.

| Flag | Trace | Effet mécanique à la revisite |
|---|---|---|
| `pays.fr.barrage_rompu` | Vallée inondée | Deux tuiles de plaine deviennent eau peu profonde ; un pont neutre apparaît en amont |
| `pays.nl.digue_ouverte` | Polder noyé | Le polder reste inondé ; l'objectif spécial « écluse » est remplacé par un objectif de convoi |
| `pays.ch.col_scelle` | Col bloqué | Passage montagneux fermé ; l'itinéraire nord devient le seul axe rapide |
| `pays.jp.train_prete` | Ligne rapide ouverte | Le joueur conserve l'usage du déplacement ferroviaire sur les cartes du pays |
| `pays.<xx>.terrain_altere ≥ 2` | Pays marqué | Le public local démarre hostile ; `monde.public.ferveur` gagne plus lentement ici |

**[Proposition] Règle de plafond :** trois traces persistantes au maximum par pays, pour éviter que la carte de fin de partie ne soit un champ de ruines — ce qui contredirait le ton autant que la jouabilité.

---

## 6. La trame de la Cinquième Manche en trois actes

Un acte = un continent (brief). Une traversée en compte **trois** : le joueur visite trois des cinq continents du monde (`06-pays-de-depart.md` §3), en commençant par le sien et en finissant par un qu'il n'a pas encore vu (`01-bible.md` §4.2). C'est ce qui rend le voyage rejouable — les continents laissés de côté sont autant de flags jamais posés. La trame avance par **points de bascule** : des vérifications de flags évaluées à la fin de chaque étape. Elle n'a aucune variable cachée : tout ce qui la fait avancer est un flag listé en § 8.

### Acte I — « Le bruit de fond »

Le joueur découvre le tournoi. Trois anomalies passent au second plan : un match qui se termine trop vite, un relevé de terrain corrigé après coup, un commandant qui déclare forfait sans explication. Hadran Ost apparaît comme un vétéran sympathique du service matériel, qui vous offre un café et pose de bonnes questions.

- **Écrit :** `monde.atlas.soupcon`, `monde.atlas.dossier_truquage`, `cmd.hadran_ost.respect`.
- **Bascule I.a — le contact.** À la fin de l'acte, si `monde.atlas.soupcon ≥ 2` **ou** `cmd.hadran_ost.respect ≥ 2` : Ost parle à visage découvert et propose au joueur de « rendre au tournoi ce qu'il a perdu ». → `monde.cinquieme.contact = true`.
- **Bascule I.b — l'infiltration.** Si le joueur accepte tout en ayant `monde.atlas.credibilite ≥ 3` : il joue double jeu. → `monde.cinquieme.infiltre = true`. S'il accepte sans crédibilité, il accepte pour de bon (pas de flag d'infiltration : ses ralliements compteront pour la faction).
- **Si aucune bascule :** l'acte II démarre en mode « aveugle » — le joueur découvrira tout plus tard et plus brutalement.

### Acte II — « Le carton »

La faction agit. Un terrain est saboté avant homologation, une commandante est disqualifiée sur un dossier fabriqué, du matériel non homologué est retrouvé dans un dépôt — le scandale absolu de ce monde. Nera Aldouin enquête seule et se fait retirer l'affaire par le Bureau ; Talvarec choisit de protéger la Ronde. Vantour, lui, sent la meilleure histoire de sa carrière.

- **Écrit :** `monde.atlas.dossier_truquage`, `monde.atlas.arbitre_alliee`, `monde.regie.faveur`, `monde.atlas.sponsor_meridien`, `pays.<xx>.dette_envers_joueur`.
- **Bascule II.a — l'alliance.** Si `monde.atlas.credibilite ≥ 4` **et** le joueur a défendu un commandant injustement sanctionné : Aldouin ouvre ses archives. → `monde.atlas.arbitre_alliee = true`.
- **Bascule II.b — le démasquage.** Fin de l'acte, si `monde.atlas.dossier_truquage ≥ 3` **ou** (`monde.atlas.arbitre_alliee` **et** `monde.carnet.pages_scellees ≥ 1`) : la faction est nommée publiquement. → `monde.cinquieme.demasquee = true`. Le monde entre dans l'acte III en le sachant.
- **Bascule II.c — la tête.** Si `monde.cinquieme.infiltre` **et** `monde.cinquieme.demasquee` : le joueur remonte jusqu'au Bureau. → `monde.cinquieme.chef_identifie = true`.
- **Si aucune bascule :** la faction agit sans être inquiétée ; l'acte III s'ouvre sur un fait accompli et `monde.cinquieme.ralliements` démarre avec un bonus de deux pays.

### Acte III — « La cinquième manche »

La finale mondiale doit se disputer à Port-Méridien. La faction pose son ultimatum : elle exige la suspension de la Ronde et l'ouverture d'une manche « à enjeux réels ». Chaque nation choisit son camp — et ce choix est **calculé, pas écrit** : pour chaque pays visité, le moteur lit les flags posés chez lui.

**Règle de ralliement (par pays) :**

| Condition | Résultat |
|---|---|
| `pays.<xx>.allie_recrute` **ou** `pays.<xx>.rival_respecte` **ou** `pays.<xx>.dette_envers_joueur ≥ 2` | Reste avec le joueur |
| `pays.<xx>.rival_humilie` **et** `pays.<xx>.terrain_altere ≥ 1` | `pays.<xx>.ralliement_cinquieme = true` |
| Un commandant du pays a `grief ≥ 4` et `respect ≤ 1` | `pays.<xx>.ralliement_cinquieme = true` |
| Pays non visité | Suit la majorité de son continent |

`monde.cinquieme.ralliements` est la somme des `pays.<xx>.ralliement_cinquieme` — un flag **dérivé**, jamais écrit à la main.

- **Bascule III — le coup de sifflet.** La finale mondiale a lieu, ou n'a pas lieu. C'est ce qui détermine la fin. Le climax n'est pas une bataille : c'est une salle pleine, deux équipes sur le terrain, et l'attente d'un sifflet.

---

## 7. Les fins

Quatre fins. Aucune ne montre, n'annonce ni ne suggère une guerre réelle : la victoire de la faction est une **suspension**, un silence, des terrains fermés — jamais un conflit.

| Fin | Titre | Conditions | Ce qu'on voit |
|---|---|---|---|
| **A** | **La Ronde continue** | `monde.cinquieme.demasquee` **et** `monde.atlas.dossier_truquage ≥ 3` **et** `monde.cinquieme.ralliements ≤ 4` **et** `monde.atlas.credibilite ≥ 6` | La faction est dissoute par le Collège, le règlement est réécrit, la finale se joue avec quatre ans de retard sur le calendrier et un article de plus au Pacte. Talvarec démissionne ; Aldouin le remplace à contrecœur. |
| **B** | **L'Atlas d'Or** | Le joueur remporte la finale mondiale, sans satisfaire les conditions de A ni de C. | La fin « champion » : trophée, tour d'honneur, Vantour au sommet de son art. Le dernier plan montre un mur de vestiaire avec quatre traits et un cinquième barré, effacé à moitié. Rien n'est réglé. |
| **C** | **Terrains fermés** | `monde.cinquieme.ralliements ≥ 10` **ou** (`monde.cinquieme.demasquee = false` **et** `monde.atlas.soupcon ≤ 2`) | La Ronde XIV est suspendue. Pas d'image de guerre : des stades vides, des banderoles décrochées, l'Intendance qui range les cars, et la Régie qui coupe l'antenne au milieu d'une phrase de Vantour. Écran noir sur un sifflet qui ne vient pas. |
| **D** | **La manche que personne n'a jouée** *(fin secrète)* | `monde.cinquieme.infiltre` **et** `monde.cinquieme.chef_identifie` **et** `monde.atlas.arbitre_alliee` **et** au moins **6** commandants avec `co_commandant` ou `rival_jure` **et** `respect ≥ 4` | Le joueur démonte la faction de l'intérieur, en public, pendant la cérémonie. Puis refuse l'Atlas d'Or et demande que la finale soit rejouée sans lui. Le trophée reste dans sa vitrine ; c'est la seule fin où le joueur n'est pas champion, et la seule où plus personne n'a envie d'une cinquième manche. |

**Ordre d'évaluation :** D, puis A, puis C, puis B par défaut. **[Proposition]** Le carnet de voyage est présenté au générique, page par page, avec les décisions qui ont compté — c'est l'écran de fin qui explique la fin.

---

## 8. Exemples concrets de choix

### 8.1 France — la vallée du barrage

*Étape de qualification française, Occitanie — le canal et les cols (`07-france-regions.md` §4.9).* Le match se joue dans une vallée dominée par un barrage. Ouvrir les vannes met hors jeu la moitié de l'équipe adverse en une manche. C'est légal : le barrage figure sur le relevé homologué. C'est aussi la vallée d'entraînement de l'éclusière Mireille Bousquet, la commandante régionale, qui vous a hébergé la veille.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Ouvrir les vannes** | `pays.fr.barrage_rompu`, `pays.fr.terrain_altere +1`, `cmd.mireille_bousquet.grief +2`, `monde.regie.faveur +1` | La vallée est encore sous l'eau à la finale continentale ; Bousquet revient comme rivale jurée ; Vantour adore et vous surnomme « l'Écluse ». |
| **Gagner à la loyale** | `cmd.mireille_bousquet.respect +2`, `monde.atlas.credibilite +1` | Bousquet devient recrutable ; elle témoignera pour vous à l'acte II. |
| **Prévenir l'adversaire du piège** | `cmd.mireille_bousquet.respect +2`, `cmd.mireille_bousquet.dette`, `monde.regie.faveur −1` | Vantour vous trouve mou ; Bousquet vous ouvre un accès à l'acte II. |

### 8.2 Luxembourg — le contrat

*Étape européenne.* Le Consortium Méridien vous propose un contrat de sponsoring : matériel neuf, logistique payée, et une clause qui vous oblige à jouer les matchs qu'on vous désigne. Dans le même bâtiment dorment les archives de protêts de six Rondes.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Signer** | `pays.lu.sponsor_accepte`, `monde.atlas.sponsor_meridien +2`, `monde.atlas.credibilite −1` | Bonus de matériel toute la partie ; à l'acte II, une étape vous est imposée, et Aldouin refuse de vous parler. |
| **Refuser poliment** | `monde.atlas.sponsor_meridien −1`, `cmd.<local>.respect +1` | Voyage plus rude (moins de fonds), réputation d'incorruptible ; ouvre la bascule II.a. |
| **Refuser et demander les archives** | `pays.lu.archives_ouvertes`, `monde.atlas.dossier_truquage +1`, `monde.atlas.sponsor_meridien −2` | Une preuve au dossier ; le Consortium bloque une destination à l'acte II. |

### 8.3 Japon — le duel de fin de match

*Étape asiatique.* Vous gagnez. La forme locale veut qu'on propose au perdant un duel d'honneur d'une manche, sans enjeu de classement — un rituel de respect, très suivi par le public. Le commandant local vient de perdre chez lui, devant les siens.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Accepter le duel et le jouer sérieusement** | `pays.jp.duel_honore`, `cmd.<local>.respect +2`, `monde.public.ferveur +1` | La ligne rapide vous est prêtée à la revisite (`pays.jp.train_prete`) ; co-commandant recrutable. |
| **Accepter et laisser gagner** | `cmd.<local>.respect +1`, `cmd.<local>.grief +1`, `monde.regie.faveur −1` | Il comprend. Il vous respecte moins qu'il ne vous en veut d'avoir été gentil. Rival d'estime possible. |
| **Refuser, le calendrier est serré** | `cmd.<local>.grief +2`, `monde.public.ferveur −1` | Public asiatique hostile ; à l'acte III, le pays bascule facilement. |

### 8.4 Brésil — le match arrangé

*Étape sud-américaine.* Avant le match, un technicien de la Cartographie vous montre un relevé modifié : le terrain a été retouché en faveur de l'équipe locale. Le public est immense, la fête a commencé depuis trois jours, et un protêt annulerait tout.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Déposer le protêt** | `monde.atlas.dossier_truquage +1`, `monde.atlas.credibilite +1`, `monde.public.ferveur −2` | Une preuve solide ; un pays entier vous en veut ; le Bureau vous surveille. |
| **Jouer quand même, et gagner sur le terrain truqué** | `pays.br.foule_conquise`, `monde.public.ferveur +2`, `monde.atlas.soupcon +1`, `cmd.<local>.respect +2` | La foule est à vous partout dans le monde ; vous savez, et vous n'avez rien dit — Ost s'en souviendra et vous approchera. |
| **Prévenir le commandant local en privé** | `cmd.<local>.dette`, `pays.br.dette_envers_joueur +2`, `monde.atlas.dossier_truquage +1` | Il fait retirer le trucage lui-même ; à l'acte III, le pays reste avec vous quoi qu'il arrive. |

### 8.5 Pays-Bas — les vannes

*Étape européenne, finale continentale.* Le terrain est un polder sous le niveau de la mer. Votre pouvoir peut l'inonder ; l'écluse est l'objectif spécial de la carte. Inonder gagne le match tout de suite, mais le polder ne se vide pas entre deux Rondes.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Inonder** | `pays.nl.digue_ouverte`, `pays.nl.terrain_altere +2`, `monde.regie.faveur +1`, `cmd.<local>.grief +2` | Le polder reste noyé à toutes les revisites ; l'objectif « écluse » disparaît des cartes du pays. |
| **Tenir l'écluse sans l'ouvrir** | `cmd.<local>.respect +2`, `monde.tournoi.serie_propre +1` | Victoire à l'objectif spécial ; l'ingénieure locale devient co-commandante recrutable. |
| **Rendre l'écluse après la victoire** | `cmd.<local>.respect +1`, `pays.nl.dette_envers_joueur +1`, `monde.atlas.credibilite +1` | Le pays vous reçoit en ami à l'acte III. |

### 8.6 Maroc — le point d'eau

*Étape africaine.* La carte comporte une oasis : la seule source de ravitaillement des deux équipes. La bloquer gagne le match par épuisement en trois manches. Le village qui accueille le match s'y approvisionne aussi ; il n'y a aucune règle qui l'interdit.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Bloquer le point d'eau** | `pays.ma.terrain_altere +1`, `cmd.<local>.grief +2`, `monde.atlas.credibilite −1` | Victoire nette, arrière-goût ; l'hôte refuse de vous recevoir à la finale continentale. |
| **Préserver l'oasis et jouer plus long** | `pays.ma.oasis_preservee`, `cmd.<local>.respect +2`, `monde.public.ferveur +1` | Une des scènes de recrutement les plus faciles du jeu ; l'hôte témoigne pour vous à l'acte II. |
| **Proposer une trêve d'eau à l'adversaire** | `pays.ma.oasis_preservee`, `cmd.<local>.respect +1`, `monde.atlas.reforme_deposee` | Votre accord informel devient un article proposé au règlement — un pas concret vers la fin A. |

---

## 9. Liste initiale des flags

> **Identique à `01-bible.md` § 8.** La bible fait foi sur les noms, les types et les portées.

### 9.1 Convention de nommage

`<portée>.<domaine>.<nom>` — minuscules, sans accent, `.` entre segments, `_` dans un nom composé.
Exemples : `pays.fr.rival_respecte`, `monde.atlas.soupcon`, `cmd.mireille_bousquet.respect`.

### 9.2 Gabarits par pays (8, applicables aux 24 pays)

| Flag | Type | Écrit par |
|---|---|---|
| `pays.<xx>.visite` | booléen | voyage |
| `pays.<xx>.qualifie` | booléen | moteur |
| `pays.<xx>.rival_respecte` | booléen | choix |
| `pays.<xx>.rival_humilie` | booléen | choix |
| `pays.<xx>.allie_recrute` | booléen | choix |
| `pays.<xx>.dette_envers_joueur` | compteur 0–3 | choix |
| `pays.<xx>.terrain_altere` | compteur 0–5 | moteur |
| `pays.<xx>.ralliement_cinquieme` | booléen | trame (dérivé) |

### 9.3 Flags de pays spécifiques (12)

| Flag | Type | Écrit par |
|---|---|---|
| `pays.fr.regions_visitees` | compteur 0–18 | moteur |
| `pays.fr.tour_complet` | booléen | moteur |
| `pays.fr.barrage_rompu` | booléen | choix |
| `pays.lu.sponsor_accepte` | booléen | choix |
| `pays.lu.archives_ouvertes` | booléen | choix |
| `pays.jp.train_prete` | booléen | choix |
| `pays.jp.duel_honore` | booléen | choix |
| `pays.br.foule_conquise` | booléen | choix |
| `pays.nl.digue_ouverte` | booléen | choix |
| `pays.ch.col_scelle` | booléen | choix |
| `pays.ma.oasis_preservee` | booléen | choix |
| `pays.mx.fete_partagee` | booléen | choix |

### 9.4 Flags de monde (18)

| Flag | Type | Écrit par |
|---|---|---|
| `monde.atlas.soupcon` | compteur 0–10 | choix, trame |
| `monde.atlas.credibilite` | compteur 0–10 | choix, moteur |
| `monde.atlas.arbitre_alliee` | booléen | trame |
| `monde.atlas.dossier_truquage` | compteur 0–5 | choix |
| `monde.atlas.reforme_deposee` | booléen | choix |
| `monde.atlas.sponsor_meridien` | relation −3…+3 | choix |
| `monde.regie.faveur` | relation −3…+3 | choix, moteur |
| `monde.public.ferveur` | compteur 0–10 | moteur |
| `monde.cinquieme.contact` | booléen | trame |
| `monde.cinquieme.infiltre` | booléen | choix |
| `monde.cinquieme.demasquee` | booléen | trame |
| `monde.cinquieme.chef_identifie` | booléen | trame |
| `monde.cinquieme.ralliements` | compteur 0–24 | trame (dérivé) |
| `monde.tournoi.serie_propre` | compteur | moteur |
| `monde.carnet.pages_scellees` | compteur 0–10 | choix |
| `monde.atlas.homologation_contestee` **[Proposition]** | booléen | choix |
| `monde.atlas.essai_soutenu` **[Proposition]** | booléen | choix |
| `monde.depeche.serie` **[Proposition]** | compteur | moteur, **hors sauvegarde de campagne** (§4.4) ; lisible par un `Deblocage` et par rien d'autre |
| `monde.tournoi.fils_termines` **[Proposition]** | compteur 0–12 | moteur (dérivé de `ProfilCampagne.filsFinis`) |

**Le domaine `monde.secret.*`** (easter eggs, `doc/14-secrets.md`) n'est **pas** listé ici, et ne le sera jamais : il n'entre ni dans cette liste, ni dans `content/flags.json`, ni dans ce qui est servi aux routines. Aucun contenu — scène, scénario, fil — ne peut le poser.

### 9.5 Flags de commandant (5, gabarits) **[Proposition]**

| Flag | Type | Écrit par |
|---|---|---|
| `cmd.<id>.respect` | compteur 0–5 | choix, moteur |
| `cmd.<id>.grief` | compteur 0–5 | choix, moteur |
| `cmd.<id>.co_commandant` | booléen | choix |
| `cmd.<id>.rival_jure` | booléen | trame |
| `cmd.<id>.dette` | booléen | choix |

### 9.6 Règles dures

1. Aucune routine n'invente un nom de flag ; un flag absent de cette liste ne peut pas être utilisé.
2. Un booléen ne se retire jamais.
3. Un compteur ne décroît pas ; seules les relations sont signées.
4. `rival_respecte` et `rival_humilie` sont exclusifs pour un même pays.
5. Les flags dérivés (`monde.cinquieme.ralliements`, `pays.<xx>.ralliement_cinquieme`) sont recalculés par le moteur, jamais écrits à la main.
6. Toute scène déclare ses flags en lecture et en écriture ; la routine contrôle rejette une scène référençant un flag inconnu.
7. Une scène de **Dépêche du jour** n'écrit aucun flag de campagne (§4.4) ; seule `monde.depeche.*` lui est ouverte.
8. Aucun contenu ne pose un flag `monde.secret.*` : les easter eggs sont codés à la main, et le schéma refuse une production qui en déclare un en écriture.
9. Un **fil** écrit des flags de campagne (§4.5), et ses conséquences sont prises dans une liste fermée et bornée. C'est ce qui le distingue d'une exhibition.

---

## 10. Récapitulatif des propositions de ce document

1. **Format JSON des scènes de choix** (`lit` / `options[].ecrit`, littéraux et deltas, aucune expression) — condition pour que la routine contrôle puisse vérifier les conséquences.
2. **Trois portées de flags** dont la portée commandant `cmd.<id>.*`, avec deux jauges indépendantes respect / grief.
3. **Rival d'estime** (`respect ≥ 4` et `grief ≥ 3`) : reste adversaire, ne rejoint jamais la faction.
4. *(Le plafond de trois co-commandants recrutés et d'un seul actif par match n'est plus une proposition : `BRIEF.md`, arbitrage n° 2. Reste une proposition de ce document : la **ligne d'assistance déclarée** sur la feuille de match, qui lui donne sa justification diégétique.)*
5. **Pages scellées du carnet** : transformer un souvenir en preuve, avec un coût.
6. **Calques de trace** déclarés par fiche pays, revalidés par la routine contrôle après application ; plafond de trois traces persistantes par pays.
7. **Ralliement calculé** à l'acte III depuis les flags de pays, plutôt qu'écrit à la main.
8. **Quatre fins** (A Ronde continue, B Atlas d'Or, C Terrains fermés, D La manche que personne n'a jouée) avec ordre d'évaluation D → A → C → B, et la règle que la fin C ne montre aucune guerre, seulement des terrains fermés.
9. **Carnet de voyage au générique** comme écran d'explication de la fin.
10. **Étanchéité de la Dépêche du jour** (§4.4) : le carnet l'ignore, `monde.depeche.serie` vit hors de la sauvegarde de campagne, et les deux flags `monde.atlas.essai_soutenu` / `monde.atlas.homologation_contestee` se posent en scène de campagne, jamais en exhibition.
11. **Les fils secondaires** (§4.5) : ils écrivent des flags de campagne — c'est ce qui les distingue d'une exhibition —, leurs conséquences sont une liste fermée et bornée, et ils ne touchent ni les bascules ni les conditions de fin. À choix de voyage identiques, deux joueurs obtiennent la même fin, qu'ils aient joué zéro ou neuf fils.
12. **Aucun contenu ne pose un flag `monde.secret.*`** (§9.4, §9.6 règle 8) : un fil peut lire un easter egg comme condition d'ouverture, jamais en poser un.
