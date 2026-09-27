# 08 — Narration et choix à conséquences

## Présentation de l’aventure — 12 septembre 2026

Les enjeux se découvrent par les personnes et les situations : objectifs concrets, dialogues courts, Gris puis Ost avant les structures cachées. Chaque arc national transforme une relation au lieu de répéter la collecte de preuves. Les choix montrent qui reçoit l’aide et qui attend ; leurs effets sont rappelés dans la suite. La famille adverse reste secrète jusqu’au jalon prévu. Ces règles de présentation remplacent les conseils historiques incompatibles ; elles ne modifient ni les flags ni les règles de combat. Voir [Une aventure claire, des choix qui comptent](refonte/aventure-lisible.md). Le plan éditorial reste distinct des missions jouables.

*Atlas Tournament — système de choix, flags, réputation et fins. Canon supérieur : `BRIEF.md`, puis `01-bible.md` (§ 8) qui fait foi sur les noms de flags. Tout ce qui dépasse le brief est signalé par **[Proposition]**.*

---

## 1. Ce que ce système doit produire

Trois promesses, dans cet ordre :

1. **Le joueur se souvient de ce qu'il a fait.** Le carnet de voyage le lui relit ; Célestin Vantour le lui rappelle à voix haute avant chaque engagement.
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
| `monde.<domaine>.*` | L'état global : Atlas, la faction, la Régie, le public, les engagements du joueur (le domaine de clé `tournoi` garde son nom) | Toute la partie | Trame de fond, conditions de fin, ton des dialogues |
| `cmd.<id>.*` **[Proposition]** | Le rapport personnel avec un commandant nommé | Toute la partie | Recrutement, rivalités, dialogues de revanche |

**Pourquoi trois portées et pas une.** Un pays survit à ses commandants (on peut être bien vu en Suisse et détesté par la commandante suisse) ; un commandant voyage (il peut réapparaître dans un autre pays) ; le monde arbitre les fins. Fusionner les trois obligerait à faire porter une réputation collective par un individu, ce qui est exactement ce que la charte de sensibilité interdit.

### 2.3 Qui écrit quoi

| Écrivain | Nature | Ce qu'il peut écrire |
|---|---|---|
| **Le moteur** | Code déterministe, en fin d'engagement | Résultats : `pays.<xx>.qualifie`, `pays.<xx>.terrain_altere`, `monde.public.ferveur`, `monde.tournoi.serie_propre`, `cmd.<id>.respect`/`grief` issus du style de victoire |
| **Une scène de choix** | Donnée JSON validée, jouée par le moteur | Tout flag déclaré dans son bloc `ecrit` |
| **La trame de fond** | Machine d'états scriptée, entre les étapes | Flags de progression : `monde.cinquieme.*`, `monde.atlas.arbitre_alliee`, `cmd.<id>.rival_jure` |
| **Le voyage** | Carte du monde | `pays.<xx>.visite` |
| **Les routines IA** | **Rien, jamais, à l'exécution** | Elles *déclarent* dans leur JSON les flags qu'une scène lit et écrit ; le moteur applique. Une routine ne touche jamais une sauvegarde. |
| **La routine contrôle** | Gardien | N'écrit aucun flag. Rejette toute production référençant un flag inconnu de `01-bible.md` § 8. |
| **La Dépêche du jour** | Exercice à blanc, hors campagne | **Aucun flag de campagne**, jamais : ni `pays.*`, ni `monde.*` hors `monde.depeche.*`, ni `cmd.*`. Voir §4.4. |

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

Le carnet est le **miroir lisible des flags**, et la seule interface où le joueur les voit. Il est diégétique : c'est l'Intendance d'Atlas qui le remet à chaque commandant en début de campagne, pour le rapport qu'il rendra au Registre.

**Une entrée contient :**

| Champ | Exemple |
|---|---|
| Repère temporel | *An 14, au printemps — troisième front* |
| Lieu | *Vallée du canal, Occitanie, France* |
| Décision, écrite à la première personne | *« J'ai ouvert les vannes. On a gagné en deux journées. La vallée est encore sous l'eau. »* |
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
| Après l'engagement | Refuser le protêt facile, saluer, rendre le matériel pris au-delà de la concession : `+1` | Réclamer une sanction maximale : `+1` |
| Scène de choix | Aider contre un tricheur, couvrir une erreur : `+1` à `+2` | Profiter de l'erreur, humilier en direct : `+1` à `+2` |
| Trame | Prendre son parti à l'acte III : `+2` | Le dénoncer publiquement : `+2` |

### 4.2 Ce que ça débloque

| Seuil | Effet |
|---|---|
| `respect ≥ 3` et `grief ≤ 1` | Le commandant devient **recrutable comme co-commandant** (`cmd.<id>.co_commandant`). Ce qu'il apporte est tranché (`BRIEF.md`, arbitrage n° 2) et chiffré par `04-gameplay.md` §7.5, qui fait foi : **son passif seul, plus une barre de jauge de départ**. Un **commandant régional français** apporte en plus sa **carte de terrain à usage unique**, qui **est l'une des trois** cartes de la sacoche et jamais une quatrième (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5, `07-france-regions.md` §2.4). **Pas de demi-pouvoir** : ce document n'en propose plus. |
| `respect ≥ 2` | Il rend un service unique (`cmd.<id>.dette`) : un renseignement, un accès, un témoignage pour le dossier. |
| `grief ≥ 3` | Il devient **rival juré** (`cmd.<id>.rival_jure`) : il revient plus tard avec une armée renforcée, un pouvoir amélioré et un objectif d'engagement personnel contre vous. |
| `grief ≥ 4` et `respect ≤ 1` | Il est **recrutable par la Cinquième Manche** à l'acte III : son pays bascule beaucoup plus facilement. |
| `respect ≥ 4` et `grief ≥ 3` | **Rival d'estime** : il reste adversaire, mais refuse de rejoindre la faction quoi qu'il arrive. La meilleure relation du jeu. **[Proposition]** |

### 4.3 Nombre de co-commandants

**Trois co-commandants recrutés au maximum, un seul actif par engagement**, changeable entre les étapes (`BRIEF.md`, arbitrage n° 2). C'est la règle générale, et `07-france-regions.md` §2.4 en est une conséquence, pas une règle concurrente : le commandant régional que le joueur emmène au mondial est simplement l'un de ces trois — celui qui ajoute sa carte de terrain à usage unique, **prise sur les trois emplacements de la sacoche et non en plus** (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5). Un joueur n'arrive donc jamais au mondial avec quatre cartes. Sans plafond, la mécanique récompenserait la collection exhaustive plutôt que le choix ; avec plafond, refuser un allié devient une décision.

Diégétiquement, le plafond n'est pas arbitraire : le Bulletin d'engagement ne comporte qu'une ligne d'**assistance déclarée** (`01-bible.md` §6). On la remplit avant la première journée, et on ne la rature pas.

### 4.4 La Dépêche du jour et la narration

La **Dépêche du jour** (`01-bible.md` §4.7, `BRIEF.md`) est un exercice à blanc quotidien, hors de la guerre, inspiré d'un événement réel du registre autorisé. Elle touche à ce document par une seule règle, et cette règle est dure :

1. **Une mission du jour n'écrit aucun flag de campagne.** Ni `pays.*`, ni `monde.*` (à l'exception de `monde.depeche.*`), ni `cmd.*`. Elle ne pose pas `visite`, elle n'incrémente pas `terrain_altere`, elle ne fait monter aucun respect ni aucun grief, elle n'ouvre aucune bascule de trame et elle n'entre dans le calcul d'aucune fin (§6, §7). Une scène de Dépêche qui déclare un tel flag en écriture est rejetée d'office par la routine contrôle (`01-bible.md` §8.6, règle 7).
2. **Ses récompenses sont cosmétiques, ou une carte de terrain au plus.** Un surnom de Vantour, une bannière, une teinte d'équipe, une page d'archives à lire — ou, au maximum, **une** carte de terrain à usage unique, la même monnaie que les commandants régionaux français (§4.2). Jamais un co-commandant, jamais une trace persistante, jamais un accès à une destination.
3. **Elle peut lire, elle ne peut pas écrire.** Rien n'interdit à une Dépêche de saluer ce que le joueur a déjà fait — Vantour reconnaît un habitué —, à condition que ce soit du commentaire et pas une conséquence.
4. **Le carnet de voyage l'ignore.** Le carnet est le miroir des décisions de la campagne (§3) ; un exercice n'y entre pas. Les Dépêches ont leur propre étagère, les archives de la Régie, et un compteur qui ne vit pas dans la sauvegarde de campagne : `monde.depeche.serie`.

**Ce que ça garantit :** la campagne reste complète sans jamais jouer une seule Dépêche, et deux joueurs qui ont fait exactement les mêmes choix de voyage obtiennent exactement la même fin, qu'ils aient joué zéro ou soixante missions du jour. C'est la condition pour qu'un contenu quotidien ne devienne pas un contenu obligatoire.

**Ce que le joueur peut quand même y gagner narrativement.** **[Proposition]** Deux flags de campagne existent *autour* de la Dépêche sans être écrits par elle : `monde.atlas.essai_soutenu` et `monde.atlas.homologation_contestee` (§9.4). Ils se posent dans une **scène de campagne** — un couloir de Port-Méridien, une conférence de presse après un engagement — où le joueur prend position sur un prototype à l'essai qu'il a croisé ailleurs. C'est la campagne qui écrit, jamais l'exercice.

### 4.5 Des flags à la relation de nation : des alliances de guerre

*Ce paragraphe est le plus important du document depuis la révision du brief du 5 septembre au soir : c'est là que les flags cessent d'être une comptabilité et deviennent une carte du monde qui change de couleur.*

**Des alliances de guerre** (registre du 26 septembre 2026). Les nations sont des belligérants avec des intérêts — qui a le soleil, qui a les barrages, qui a les ateliers, qui dépend de qui. Les états de relation ne changent ni dans le code ni dans les flags ; ils se lisent comme des alliances de guerre : `alliee`, une nation de la coalition, qui se bat à vos côtés ; `rivale`, un belligérant qui a un compte à régler ; `retiree`, une nation sortie de la guerre par une paix séparée, ou passée à la Cinquième Manche — une délégation sous contrat, jamais un peuple. Le Tableau des belligérants les annonce (`01-bible.md` §4.6).

**Tout le monde part de France.** Les vingt-trois autres nations ne se choisissent pas : elles se **gagnent ou se perdent** en route. Chacune porte un état, `RelationNation` (`03-schemas.md` §15.3 bis), rangé dans `ProfilCampagne.relations` :

| État | Comment on y arrive | Ce que ça donne au joueur |
|---|---|---|
| `neutre` | L'état par défaut. Une nation absente de `relations` est neutre : ne l'avoir jamais croisée et n'avoir rien décidé chez elle sont la même chose | Rien. Elle se bat pour elle-même, elle vous croise, elle salue |
| `alliee` | `pays.<xx>.allie_recrute`, ou `pays.<xx>.rival_respecte`, ou `pays.<xx>.dette_envers_joueur ≥ 2` — c'est-à-dire exactement la première ligne de la règle de ralliement du §6 | Son commandant recrutable en **co-commandant** ; son **catalogue commun et soutien tactique disponibles** dans les engagements du joueur, en quantité bornée par engagement ; sa **carte de terrain** ; son **soutien à l'acte III** ; et son **déblocage comme pays de départ** de la partie suivante (une Nouvelle Ronde) |
| `rivale` | Un commandant du pays à `grief ≥ 3`, ou `pays.<xx>.rival_humilie` sans respect en face | Un compte à régler : IA plus dure, dialogue de revanche, objectif d'engagement personnel — et sa destination **peut se fermer** sur la carte du monde |
| `retiree` | Le cumul, et lui seul : `pays.<xx>.rival_humilie` **et** `pays.<xx>.terrain_altere ≥ 2`, ou un commandant du pays à `grief ≥ 4` **et** `respect ≤ 1` | La nation sort de la guerre à cause du joueur — une paix séparée — ou passe à la Cinquième Manche : **destination fermée**, territoire grisé, et à l'acte III elle est **absente** ou **dans le camp de la faction** |

**Trois règles dures.**

1. **La relation est calculée, jamais écrite à la main.** Comme `monde.cinquieme.ralliements` (§6), c'est un état **dérivé** des flags, recalculé par le moteur ou le serveur à la fin de chaque étape, **jamais par le rendu**. Aucune scène ne « pose » une relation : elle pose des flags, et la relation suit.
2. **On ne se retire pas d'un seul geste.** Un retrait demande **deux** griefs qui se rencontrent — une humiliation *et* une carte abîmée, un grief maximal *et* aucun respect. C'est ce qui empêche un joueur d'éteindre la carte du monde par distraction, et ce qui rend un retrait racontable : il y a toujours eu un avertissement.
3. **Un fil peut rallier ou fâcher, jamais retirer.** La conséquence `relation_nation` d'un `Fil` est bornée à `alliee | rivale` par son type (`03-schemas.md` §15.4). Un retrait est une décision de la campagne principale ; un contenu facultatif n'a pas le droit de fermer une destination.

**Les bornes anti-blocage, et où chacune vit.**

| Borne | Valeur | Tenue par |
|---|---|---|
| Nations retirées par partie | **5 au plus** | Le **schéma** : `validerProfilCampagne` refuse un profil à six `retiree` (`BORNES_RELATIONS.retireesMax`). Au sixième retrait, la scène qui l'aurait provoqué se joue en version « il reste, mais il ne vous parle plus » — une nation `rivale` de plus, pas une de moins |
| Nations alliées avant l'acte III | **2 au moins** | Le **contenu** : la colonne vertébrale (`13-campagne.md` §3.4) place deux occasions de ralliement que le joueur ne peut pas manquer toutes les deux, parce qu'elles ne dépendent pas du même registre de choix (l'une se gagne par le fair-play, l'autre par un service rendu) |
| Fins accessibles | **les quatre, toujours** | Le **contenu** aussi : une nation retirée change la **couleur** d'une fin — qui est là à la dernière bataille, qui manque, ce que Vantour raconte —, jamais son accessibilité (§7) |

**Incarner : jouer la relation au lieu de la lire.** Une nation `alliee` ne se contente pas de prêter son banc — le joueur peut **la jouer entièrement**, le temps d'un match d'incarnation (`Scenario.incarnation`, `03-schemas.md` §15.2 bis ; le nom de la mécanique, pas un mot du monde) : ses propres engagements, les missions de son fil secondaire, et à l'acte III le choix, à chaque bataille, de la nation qu'il commande. Il joue alors avec le général de cette nation, son catalogue, sa spécialité et son style ; son commandant d'origine reste au banc en **co-commandant passif** (`04-gameplay.md` §7.5). Narrativement, c'est le seul moment où le joueur voit la guerre depuis l'autre côté du front — et c'est ce qui rend une alliée autre chose qu'une ligne de bonus.

**La confiance, c'est-à-dire la relation vue par le général.** Incarner fait monter `ProfilCampagne.confiance[commandantCle]`, de 0 à 3. Une relation appartient à une **nation**, une confiance à un **général** : les deux montent par des gestes différents — l'une par les choix qu'on fait *chez* la nation, l'autre par les engagements qu'on livre *pour* elle — et elles se lisent séparément (`Condition` `relation` et `confiance`). À **3**, le général devient co-commandant à jauge entière et sa nation s'ouvre comme départ de Nouvelle Ronde : rallier et incarner sont deux chemins vers la même porte (`13-campagne.md` §3.5).

**La borne des flags, et pourquoi elle est absolue.** *Un match d'incarnation n'écrit jamais un flag de la trame principale du joueur.* Il n'écrit que `pays.<nation incarnée>.*` et `cmd.*` — jamais `monde.*` —, en récompense comme dans une option de choix, et `validerScenario` le refuse mécaniquement. La raison est celle du §4.4 pour la Dépêche, un cran plus haut : le joueur qui prête ses mains à une autre nation ne décide pas, pendant cet engagement, de sa propre histoire. Trois conséquences directes :

1. **Aucune bascule** (§6) ni condition de fin (§7) ne peut être franchie dans un match d'incarnation — elles se lisent toutes sur des flags de monde.
2. **La nation incarnée ne peut pas se retirer pendant qu'on la joue** : un retrait demande deux griefs qui se rencontrent, et un match d'incarnation n'en écrit aucun.
3. **Incarner ne remplace jamais une étape** : c'est une variante proposée, jamais imposée — sauf à l'acte III, où le choix de la nation qu'on commande *est* le geste de l'acte, et se fait parmi les alliées.

**Le rattrapage, et son honnêteté.** Certaines relations se rattrapent, d'autres non, et **c'est écrit dans la fiche du fil** qui les rattrape, jamais découvert après coup. La règle du document : un fil de rattrapage remonte `rivale` → `alliee`, mais **aucun fil ne fait revenir une nation `retiree`**. Un retrait est le seul état sans marche arrière du jeu, et c'est précisément ce qui lui donne son poids : le joueur qui en provoque un l'apprend au moment où il le fait, par une scène qui le dit en toutes lettres, pas par un écran de fin.

### 4.6 Les fils secondaires

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

Un flag de trace modifie la carte d'un pays lors des **revisites** (un front de retour, l'acte III).

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

## 6. La trame de guerre en trois actes — canon du 9 septembre 2026, registre de guerre du 26 septembre

Les actes sont des progressions dramatiques, pas des continents obligatoires. Le voyage reste mondial, avec deux ou trois destinations proposées et des identités régionales fondées sur paysages, météo et traits. Les trois actes recouvrent les sept saisons du plan de 172 épisodes (`refonte/opus1-fil.md`, détail dans `17-aube.md`) : **acte I**, le prologue et la saison nationale 1 ; **acte II**, les saisons nationales 2 et 3 ; **acte III**, les saisons globales 4 à 6, soit les dix-huit finales. Les 28 hors-série se glissent après l’épisode qui les ouvre, hors du compte. Le plan n’est pas une campagne terminée : le parcours local joue les dix exercices, deux épreuves de sortie d’école et le chapitre français de la saison 1 ; les essais Aube servent à éprouver les configurations.

### Acte I — Les droits du vainqueur

Ariane et Tomas forment le joueur à l’école du front, à charges à blanc ; le premier engagement réel est « Premier courant » (`opus1_fr_01`). Une victoire prend des sites et des savoirs, jamais des habitants, et ce qu’elle prend s’inscrit au Registre. Les contrats méridiens semblent faciliter la guerre : transports, crédit, matériel prêté. Les premiers choix portent sur le partage des relevés et la maintenance, avec un retour concret sur une route ou un dépôt. Les Gris sont un adversaire reconnaissable, Ost un visage accessible ; Sélène apparaît comme négociatrice, sans révélation prématurée de son rôle.

### Acte II — Qui possède le lendemain ?

Les fronts convergent : des concessions concurrentes ont le même bénéficiaire. Les archives de Nera, les convois de Solveig et les contrôles de Wren permettent de recouper les contrats. La Cinquième Manche devient identifiable, et son but est Aube, programme de fusion entièrement fictif, qui devient un objectif matériel à la troisième mission de l’Inde, avec l’escorte de ses convertisseurs. Sélène Veyr en est toujours la dirigeante ; seuls le moment et la solidité de sa découverte varient. Le fil d’Ost montre une disqualification justifiée, pas une excuse annulant ses choix. Des délégations signent avec le Consortium pour pouvoir continuer à se battre ; aucune nation n’est mauvaise pour autant.

### Acte III — La cinquième manche

La Cinquième Manche se bat à visage découvert. Six armes sans dossier changent les batailles des premières finales ; Nera dépose un protêt par arme, le Bureau les classe, et le dossier suit les victoires sans les remplacer. Sélène propose la sécurité énergétique contre le pouvoir de décider. À la finale 10, Edran rejoint Maël en révélant sa paternité : la perte du front est imposée, et la réussite jouable est d’extraire le commandement — ce qu’on sauve est un choix. La coalition revient avec ses pertes et ses désaccords jusqu’au campus d’Aube, sur son plateau neutre rattaché à Port-Méridien, où Sélène commande en personne (finale 18).

La coalition protège les accès d’Aube et les garanties du réseau. Une mission de survie annonce précisément ses journées et ses renforts ; le canon cible distingue tenir jusqu’à la fin de J40 et l’arrivée au début de J41. Les essais actuellement livrés doivent être lus selon leur briefing et leurs événements réels : aucun dialogue n’est une preuve de renfort moteur.

La conclusion est une vraie bataille. Par défaut, capture du QG ou mise hors jeu totale ; une mission d’anéantissement exclusif ne donne pas une victoire alternative par QG. Chaque coalition et chaque camp sont explicites. Une armée éliminée n’implique pas automatiquement la défaite de ses alliées.

### Relations et conséquences

Les relations continuent d’être calculées depuis les flags autorisés (§4.5), jamais inventées par le rendu ni posées par une routine. Les garanties de parcours tiennent : au moins deux alliées disponibles avant le dernier acte, au plus cinq retraits, aucune fin rendue impossible par une destination fermée. Un rival d’estime peut combattre à vos côtés sans devenir un ami. Aucun camp ne rejoint automatiquement une faction parce que le joueur ne l’a pas visité.

Une conséquence doit nommer son choix source, sa destination et son effet borné : dialogue, fonds, déploiement, route, contingent ou condition d’objectif déjà supportée. Le carnet l’annonce avant la mission concernée. Les nouveaux flags passent par le registre canon ; les routines n’en créent pas à la volée. Les anciennes formules de ralliement continental et le « bonus de deux pays » caché sont retirés.

### Les quatre disparitions — décision du 9 septembre 2026

Quatre chefs de nations alliées meurent au cours de l’opus, hors du front, jamais par une arme, sans qu’une personne identifiée en soit l’auteur : Nikos Delis (`opus1_hs_gr_3`), Mira Karki (`opus1_hs_np_3`), Tomas Reiner (`opus1_finale_12`) et Samir El Hadi (`opus1_au_01` ou `opus1_finale_14`). La borne et la règle dure — aucune routine ne peut jamais écrire une mort — sont dans `BRIEF.md` (« Quatre disparitions ») ; les scènes, les causes et ce que les décisions de la Cinquième Manche y ont indirectement apporté sont dans `doc/refonte/opus1-hors-serie.md` §3, qui en est la seule source. Le joueur ne voit jamais l’instant, toujours l’annonce, et une disparition ne se joue **pas** comme une paix séparée : au Tableau des belligérants, la plaque est posée à plat et la nation reste engagée (`01-bible.md` §4.6).

Ce qu’elles écrivent est borné, dans le vocabulaire de ce document. **Un co-commandant est perdu** : le commandant n’est plus recrutable à partir de l’annonce, et s’il l’était, l’emplacement se libère — retirer un co-commandant n’est dans aucune liste de `13-campagne.md` §5.2, et c’est volontaire (voir `opus1-hors-serie.md` §5, point 2). **La nation reste engagée** et sa relation ne bouge pas ; une conséquence `allie_acte_iii` déjà acquise tient, parce que c’est la délégation qui reste, pas l’homme ; le banc est repris par une adjointe **[Proposition]** qui joue les couleurs et le catalogue sans pouvoir de commandant. **Une entrée de carnet** (`carnet_hs_gr_nikos`, `carnet_hs_np_mira`, `carnet_tomas_desserte`, `carnet_samir_caravane`) et **des variantes de dialogue** aux finales concernées (18 pour les quatre ; 12 pour Mira et Tomas ; 15 pour Tomas ; 17 pour Samir), plus une absence à l’épilogue. Ce que le joueur change est le **moment** et ce qui reste (Nikos par `opus1_hs_gr_2_decision`, Samir par `opus1_ma_08_decision`), qui voyage avec lui (Tomas, par le choix de `opus1_finale_09`, les passagers indemnes) ou la page du carnet (Mira) — jamais le fait, jamais la cause, et le carnet ne dit jamais « vous l’avez envoyé là ». **Aucune fin ne lit une disparition** : deux joueurs aux mêmes choix de trame ont la même fin.

---

## 7. Les quatre fins — destinations narratives, implémentation à terminer

Les quatre destinations remplacent la conclusion ancienne limitée à une suspension de tournoi. Elles nécessitent une victoire tactique à la finale 18 et une lecture traçable des choix. **Leur résolution complète n’est pas déclarée livrée.** Aucun seuil numérique nouveau n’est inventé ici pour simuler un moteur de fins absent.

**Les conditions reposent sur les décisions seules** (décision du 26 septembre 2026, `BRIEF.md`, « Le lore v2 validé », question 7). Le dossier des protêts — le compteur proposé `monde.atlas.dossier_pieces` (`refonte/supers-vilains.md` §4.3), pas encore au registre des flags — **colore une fin, il ne la conditionne jamais** : ce que le Bureau juge à l’épilogue, qui témoigne, ce que Vantour lit à l’antenne. C’est la doctrine « jamais indispensable » : à décisions égales, un joueur qui n’a vu partir aucun super des Gris obtient la même fin qu’un autre. Le texte de référence des quatre fins est `refonte/lore-v2.json` (`fins[]`) :

- **Le réseau partagé** — signer le réseau partagé à la finale 18, avec l’accès partagé de la finale 17, l’offre de Sélène rendue publique (finale 8), la déposition d’Edran acceptée (finale 15) et au moins deux nations alliées présentes au campus. Aube passe sous un collège des nations de la coalition, les plans des huit armes deviennent publics, et l’arbitre retrouve ses dents.
- **La couronne électrique** — gagner la finale 18 en refusant un traité insuffisant, ou en signant sans les garanties d’aucune autre fin. Aube échappe à la prise méridienne parce que vos colonnes tiennent le campus ; la dépendance du monde n’est pas résolue, et c’est vous, maintenant, que l’on regarde tenir le courant.
- **La coalition sous tension** — signer un accord de transition à la finale 18, ou signer le réseau partagé après avoir exigé un contrôle de coalition temporaire à la finale 17 ; concessions majoritairement versées à la caisse commune aux finales nationales. La faction perd, ce qu’elle tenait se concentre chez quelques alliés, et le carnet explique les choix qui ont créé ces tensions.
- **La relève** — signer le réseau partagé à la finale 18 en ayant isolé le dernier relais (finale 16), refusé la participation opérationnelle d’Edran (finale 15) et garanti les équipes qui refusent la prise méridienne (finale 12). Le joueur gagne et ne garde rien : l’enregistrement de la victoire est confié à un collège indépendant présidé par Nera, et l’avance technique cesse d’être un butin de guerre.

**Ce qui reste à fixer avec le moteur de fins.** Lues ainsi, deux conditions peuvent être remplies à la fois — la relève et la coalition sous tension, par un réseau partagé signé après un contrôle de coalition exigé à la finale 17 —, et la clause des concessions versées n’est pas encore une mesure. L’ordre de lecture sera fixé quand le moteur de fins existera ; il lira les décisions, jamais le dossier.

L’épilogue cite des événements du carnet et des biographies versionnées, pas un commentaire improvisé par un modèle. Une défaite tactique appelle une reprise ou un repli explicitement scénarisé ; elle ne se transforme pas artificiellement en victoire. L’accès à une fin ne dépend ni du nombre d’unités régionales possédées, ni du nombre de protêts au dossier.

---

## 8. Exemples concrets de choix

*Repris le 26 septembre 2026 dans le registre de la guerre : les décisions et les flags n'ont pas bougé. Quand une décision touche un lieu habité, le front est évacué ou désert : le nécessaire civil n'est jamais frappé en jeu (`01-bible.md` §2.3).*

### 8.1 France — la vallée du barrage

*Front de France, Occitanie — le canal et les cols (`07-france-regions.md` §4.9).* L'engagement se livre dans une vallée dominée par un barrage. Ouvrir les vannes met hors jeu la moitié de l'armée adverse en deux journées. C'est légal : le barrage figure sur le relevé homologué, et la vallée n'est plus habitée depuis longtemps. C'est aussi la vallée d'entraînement de l'éclusière Mireille Bousquet, la commandante régionale, qui vous a hébergé la veille.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Ouvrir les vannes** | `pays.fr.barrage_rompu`, `pays.fr.terrain_altere +1`, `cmd.mireille_bousquet.grief +2`, `monde.regie.faveur +1` | La vallée est encore sous l'eau quand vous revenez sur ce front ; Bousquet revient comme rivale jurée ; Vantour adore et vous surnomme « l'Écluse ». |
| **Gagner à la loyale** | `cmd.mireille_bousquet.respect +2`, `monde.atlas.credibilite +1` | Bousquet devient recrutable ; elle témoignera pour vous à l'acte II. |
| **Prévenir l'adversaire du piège** | `cmd.mireille_bousquet.respect +2`, `cmd.mireille_bousquet.dette`, `monde.regie.faveur −1` | Vantour vous trouve mou ; Bousquet vous ouvre un accès à l'acte II. |

### 8.2 Luxembourg — le contrat

*Front européen.* Le Consortium Méridien vous propose un contrat : matériel neuf, transports payés, et une clause qui vous oblige à livrer les engagements qu'on vous désigne. Dans le même bâtiment dorment des archives de protêts plus anciennes que la guerre.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Signer** | `pays.lu.sponsor_accepte`, `monde.atlas.sponsor_meridien +2`, `monde.atlas.credibilite −1` | Bonus de matériel toute la partie ; à l'acte II, un front vous est imposé, et Aldouin refuse de vous parler. |
| **Refuser poliment** | `monde.atlas.sponsor_meridien −1`, `cmd.<local>.respect +1` | Voyage plus rude (moins de fonds), réputation d'incorruptible ; ouvre la bascule II.a. |
| **Refuser et demander les archives** | `pays.lu.archives_ouvertes`, `monde.atlas.dossier_truquage +1`, `monde.atlas.sponsor_meridien −2` | Une preuve au dossier ; le Consortium bloque une destination à l'acte II. |

### 8.3 Japon — le duel d'honneur

*Front asiatique.* Vous gagnez. La coutume locale veut qu'on propose au vaincu un duel d'honneur, à charges à blanc et sans enjeu de concession — un rituel de respect entre deux armées qui viennent de se battre pour de bon, très suivi à l'antenne. Le commandant local vient de perdre chez lui, devant les siens.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Accepter le duel et le jouer sérieusement** | `pays.jp.duel_honore`, `cmd.<local>.respect +2`, `monde.public.ferveur +1` | La ligne rapide vous est prêtée à la revisite (`pays.jp.train_prete`) ; co-commandant recrutable. |
| **Accepter et laisser gagner** | `cmd.<local>.respect +1`, `cmd.<local>.grief +1`, `monde.regie.faveur −1` | Il comprend. Il vous respecte moins qu'il ne vous en veut d'avoir été gentil. Rival d'estime possible. |
| **Refuser, le calendrier est serré** | `cmd.<local>.grief +2`, `monde.public.ferveur −1` | Public asiatique hostile ; à l'acte III, le pays bascule facilement. |

### 8.4 Brésil — l'engagement arrangé

*Front sud-américain.* Avant l'engagement, un technicien de la Cartographie vous montre un relevé modifié : le front a été retouché en faveur de l'armée locale. Tout le pays suit l'engagement à l'antenne depuis trois jours, et un protêt ferait tout reprendre à zéro.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Déposer le protêt** | `monde.atlas.dossier_truquage +1`, `monde.atlas.credibilite +1`, `monde.public.ferveur −2` | Une preuve solide ; un pays entier vous en veut ; le Bureau vous surveille. |
| **Se battre quand même, et gagner sur le front truqué** | `pays.br.foule_conquise`, `monde.public.ferveur +2`, `monde.atlas.soupcon +1`, `cmd.<local>.respect +2` | La foule est à vous partout dans le monde ; vous savez, et vous n'avez rien dit — Ost s'en souviendra et vous approchera. |
| **Prévenir le commandant local en privé** | `cmd.<local>.dette`, `pays.br.dette_envers_joueur +2`, `monde.atlas.dossier_truquage +1` | Il fait retirer le trucage lui-même ; à l'acte III, le pays reste avec vous quoi qu'il arrive. |

### 8.5 Pays-Bas — les vannes

*Front européen, finale nationale.* Le front est un polder sous le niveau de la mer, évacué pour l'engagement. Votre pouvoir peut l'inonder ; l'écluse est l'objectif spécial de la carte. Inonder gagne l'engagement tout de suite, mais le polder ne se vide pas avant des années.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Inonder** | `pays.nl.digue_ouverte`, `pays.nl.terrain_altere +2`, `monde.regie.faveur +1`, `cmd.<local>.grief +2` | Le polder reste noyé à toutes les revisites ; l'objectif « écluse » disparaît des cartes du pays. |
| **Tenir l'écluse sans l'ouvrir** | `cmd.<local>.respect +2`, `monde.tournoi.serie_propre +1` | Victoire à l'objectif spécial ; l'ingénieure locale devient co-commandante recrutable. |
| **Rendre l'écluse après la victoire** | `cmd.<local>.respect +1`, `pays.nl.dette_envers_joueur +1`, `monde.atlas.credibilite +1` | Le pays vous reçoit en ami à l'acte III. |

### 8.6 Maroc — le point d'eau

*Front africain.* La carte comporte une oasis : la seule source de ravitaillement des deux armées. La bloquer gagne l'engagement par épuisement en trois journées. Le village voisin s'y approvisionne aussi : le Pacte protège le nécessaire civil, mais aucun article ne dit si une oasis de front en fait partie — c'est la zone grise où l'on juge un commandant.

| Option | Écrit | Retour de conséquence |
|---|---|---|
| **Bloquer le point d'eau** | `pays.ma.terrain_altere +1`, `cmd.<local>.grief +2`, `monde.atlas.credibilite −1` | Victoire nette, arrière-goût ; vos hôtes refusent de vous recevoir à la finale nationale. |
| **Préserver l'oasis et jouer plus long** | `pays.ma.oasis_preservee`, `cmd.<local>.respect +2`, `monde.public.ferveur +1` | Une des scènes de recrutement les plus faciles du jeu ; l'hôte témoigne pour vous à l'acte II. |
| **Proposer une trêve d'eau à l'adversaire** | `pays.ma.oasis_preservee`, `cmd.<local>.respect +1`, `monde.atlas.reforme_deposee` | Votre accord informel devient un article proposé au règlement du Pacte — une pièce de plus pour l'épilogue. |

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
9. Un **fil** écrit des flags de campagne (§4.6), et ses conséquences sont prises dans une liste fermée et bornée. C'est ce qui le distingue d'un exercice de la Dépêche.
10. La **relation d'une nation** (`neutre`, `alliee`, `rivale`, `retiree`) est **dérivée** des flags par le moteur ou le serveur, jamais posée par une scène ni calculée par le rendu (§4.5). Un fil peut la faire monter à `alliee` ou `rivale`, jamais à `retiree` : le retrait appartient à la campagne principale.

---

## 10. Récapitulatif des propositions de ce document

1. **Format JSON des scènes de choix** (`lit` / `options[].ecrit`, littéraux et deltas, aucune expression) — condition pour que la routine contrôle puisse vérifier les conséquences.
2. **Trois portées de flags** dont la portée commandant `cmd.<id>.*`, avec deux jauges indépendantes respect / grief.
3. **Rival d'estime** (`respect ≥ 4` et `grief ≥ 3`) : reste adversaire, ne rejoint jamais la faction.
4. *(Le plafond de trois co-commandants recrutés et d'un seul actif par engagement n'est plus une proposition : `BRIEF.md`, arbitrage n° 2. Reste une proposition de ce document : la **ligne d'assistance déclarée** sur la feuille de match, qui lui donne sa justification diégétique.)*
5. **Pages scellées du carnet** : transformer un souvenir en preuve, avec un coût.
6. **Calques de trace** déclarés par fiche pays, revalidés par la routine contrôle après application ; plafond de trois traces persistantes par pays.
7. **Ralliement calculé** à l'acte III depuis les flags de pays, plutôt qu'écrit à la main.
8. **Quatre fins** (§7), lues sur les décisions seules — le dossier des protêts les colore, il ne les conditionne pas ; leurs conditions complètes doivent être implémentées et testées avant publication. L’ancien ordre D → A → C → B est retiré.
9. **Carnet de voyage au générique** comme écran d'explication de la fin.
10. **Étanchéité de la Dépêche du jour** (§4.4) : le carnet l'ignore, `monde.depeche.serie` vit hors de la sauvegarde de campagne, et les deux flags `monde.atlas.essai_soutenu` / `monde.atlas.homologation_contestee` se posent en scène de campagne, jamais en exhibition.
11. **Les fils secondaires** (§4.6) : ils écrivent des flags de campagne — c'est ce qui les distingue d'un exercice de la Dépêche —, leurs conséquences sont une liste fermée et bornée, et ils ne touchent ni les bascules ni les conditions de fin. À choix de voyage identiques, deux joueurs obtiennent la même fin, qu'ils aient joué zéro ou neuf fils.
12. **Aucun contenu ne pose un flag `monde.secret.*`** (§9.4, §9.6 règle 8) : un fil peut lire un easter egg comme condition d'ouverture, jamais en poser un.
13. **L'incarnation** (§4.5) : une alliée se joue au lieu de se lire, la **confiance** d'un général monte séparément de la relation de sa nation, et un match d'incarnation n'écrit **jamais** un flag de la trame principale — d'où l'impossibilité d'y franchir une bascule ou d'y provoquer un retrait.
14. **La relation de nation** (§4.5) : les seuils exacts qui font passer une nation de `neutre` à `alliee`, `rivale` ou `retiree` ; la règle du **double grief** pour un retrait (jamais un seul geste) ; le partage des deux bornes — cinq retirées tenues par le schéma, deux alliées tenues par la colonne vertébrale ; et la règle de rattrapage : un fil remonte `rivale` → `alliee`, **aucun fil ne fait revenir une `retiree`**.
