# 07 — La France et ses 18 régions

*Premier pays entièrement détaillé. Source de vérité au-dessus de ce document : `BRIEF.md`. Fiche pays de référence : `06-pays-de-depart.md`, § 5.1. Le gabarit de région défini ici est **générique** : il servira au Japon, au Brésil et au Luxembourg.*

---

## 1. Pourquoi la France d'abord

Le brief le fixe : avant de représenter son pays au mondial, le joueur français gagne une **qualification nationale** — le tour des 18 régions. Cela remplit trois fonctions à la fois :

1. **Apprendre le jeu par le terrain.** Chaque région apporte **une mécanique de terrain et une seule**, introduite proprement, jouée une fois, puis rangée dans la poche du joueur. À la fin, il a rencontré dix-huit systèmes différents et sait les reconnaître à l'étranger.
2. **Faire monter le commandant.** Camille Aubertin est un prodige : son pouvoir « Tour de France » gagne 0,02 de multiplicateur d'attaque par région remportée, **plafond `attaque ×1,2`** (`06-pays-de-depart.md` §5.1). La qualification est littéralement sa montée en puissance.
3. **Valider le système régional.** Si dix-huit fiches tiennent dans un gabarit unique et produisent dix-huit parties différentes, le système est bon et on le duplique.

### Note de sensibilité (rappel du canon)

Aucune région n'est traitée avec condescendance. Le registre est : **paysage, gastronomie, sport, folklore, artisanat**. Les clichés utilisés sont ceux qu'un habitant revendique lui-même avec plaisir. Les phénomènes naturels (marée, mistral, grain, coulée) sont des **conditions de match**, annoncées à l'avance au HUD, spectaculaires et jamais dramatiques : le volcan « s'allume pour le spectacle », le grain « traverse et repart ». Aucune référence à un événement réel, à un dirigeant, à la politique, à la religion ou à un drame. On ne parle jamais de « guerre de région » : on parle d'**étape**, comme dans une course cycliste.

---

## 2. Structure de la qualification

### 2.1 Ordre de visite — libre par zones, finale fixe

Les 18 régions sont réparties en **5 zones** librement ordonnables, plus **une finale imposée**.

| Zone | Régions | Étapes |
|---|---|---|
| **A — L'Ouest et la Loire** | Bretagne, Normandie, Pays de la Loire, Centre-Val de Loire | 4 |
| **B — Le Nord et l'Est** | Hauts-de-France, Grand Est, Bourgogne-Franche-Comté | 3 |
| **C — Le Sud-Ouest** | Nouvelle-Aquitaine, Occitanie | 2 |
| **D — Le Sud-Est** | Auvergne-Rhône-Alpes, Provence-Alpes-Côte d'Azur, Corse | 3 |
| **E — L'Outre-mer** | Guadeloupe, Martinique, Guyane, La Réunion, Mayotte | 5 |
| **Finale** | Île-de-France | 1 |

**Règles d'ordre :**

- Le joueur choisit **librement l'ordre des zones** et, à l'intérieur d'une zone, **l'ordre des régions**.
- La zone E (outre-mer) demande un billet : elle s'ouvre après **deux zones métropolitaines complètes**. C'est une respiration au milieu du parcours, pas une fin de parcours.
- **L'Île-de-France est toujours la dernière.** Elle ne s'ouvre que quand les 17 autres sont remportées. C'est la finale nationale.
- Chaque zone terminée fait monter d'un **cran de difficulté** : +1 niveau à l'IA adverse, +10 % de budget adverse, une unité de plus dans sa composition de départ. Le joueur qui garde le Sud-Est pour la fin trouvera Fanny Chabrier nettement plus dure qu'un joueur qui commence par elle. C'est voulu et annoncé sur la carte de France.

**Chemin recommandé** (proposé au joueur, refusable en un clic) :

> Bretagne → Normandie → Pays de la Loire → Centre-Val de Loire → Hauts-de-France → Grand Est → Bourgogne-Franche-Comté → Guadeloupe → Martinique → Guyane → La Réunion → Mayotte → Nouvelle-Aquitaine → Occitanie → Auvergne-Rhône-Alpes → Provence-Alpes-Côte d'Azur → Corse → **Île-de-France**

Ce chemin va du plus lisible au plus exigeant : la marée bretonne est un métronome à deux temps, le maquis corse demande de jouer à l'aveugle, et le métro parisien demande de gérer un réseau partagé avec l'adversaire.

### 2.2 Format d'une étape

Chaque région propose :

- **Une carte principale**, obligatoire, qui met sa mécanique au centre. C'est le match de qualification. Durée visée : **20 à 30 minutes**.
- **Une carte courte optionnelle** (« le défi de la région »), 10 minutes, sur une carte réduite, avec un objectif spécial et une contrainte : elle **ne peut se gagner qu'en utilisant la mécanique régionale**. Elle rapporte un bonus de fonds et une entrée de carnet, jamais de progression obligatoire.

Le joueur peut donc traverser la qualification en 18 matchs, ou en 36 s'il veut tout.

### 2.3 Le commandant régional adverse

Chaque région est représentée par **une figure locale affectueuse**, au nom inventé, qui n'est ni un adversaire hostile ni un faire-valoir. Ce sont des gens du cru, très bons chez eux, qui adorent recevoir. Ils partagent tous trois propriétés :

- **Ils jouent leur terrain.** Leur pouvoir est une version amplifiée de la mécanique régionale. Battre Maëlle Kerdraon, c'est comprendre les marées.
- **Ils nourrissent.** Chacun sert quelque chose avant ou après le match. C'est le rituel de la qualification.
- **Ils sont recrutables.** Battus **avec respect** (`cmd.<id>.respect ≥ 3`, `08-narration-choix.md` §4.2), ils rejoignent le carnet comme **co-commandants**. Ce qu'un co-commandant apporte est tranché (`BRIEF.md`, arbitrage n° 2) : **son passif seul**, plus une barre de jauge de départ (`04-gameplay.md` §7.5, propriétaire de la règle) — et, parce qu'il est **régional**, **sa carte de terrain à usage unique**, la récompense déjà prévue au § 2.4. Pas de demi-pouvoir, pas de pouvoir régional réduit. Plafonds : **trois co-commandants recrutés**, **un seul actif par match**. Battus dans l'humiliation (adversaire réduit à zéro unité alors que la victoire était acquise), ils refusent, et posent `cmd.<id>.grief`, qui ressortira plus tard.

### 2.4 Ce que rapporte une victoire

Cinq récompenses, identiques en nature pour les 18 régions :

| Récompense | Détail |
|---|---|
| **Fonds** | +2 000 crédits de campagne (+1 000 pour la carte courte). Sert à l'équipement du mondial. |
| **Une carte de terrain** | La mécanique de la région devient un objet jouable : **une utilisation par match** au mondial (ex. « Marée » bascule les cases côtières pendant une journée). Le joueur en emporte **trois au maximum**. C'est aussi ce qu'un **commandant régional recruté apporte en plus de son passif** (arbitrage n° 2) : la carte suit son commandant — mais **elle est l'une des trois, pas une quatrième** (`BRIEF.md`, seconde relecture, point 7 ; `04-gameplay.md` §7.5). Si la sacoche est pleine, le joueur choisit laquelle il laisse. |
| **Une spécialité** | Petit bonus passif permanent, volontairement léger, modélisé par le type `Specialite` de `03-schemas.md` §1 : soit un **modificateur** écrit dans le **même vocabulaire que les pouvoirs**, soit un **trait** de la liste fermée `TraitSpecialite` — dans les deux cas **permanent** et sans durée. Le joueur en **possède cinq au maximum** et en **équipe une seule par match** (`BRIEF.md`, seconde relecture, point 2 ; `04-gameplay.md` §7.6) — même geste que pour les co-commandants, et c'est ce qui empêche dix-huit spécialités empilées de casser l'équilibre du mondial. |
| **Un co-commandant** | Le commandant régional, si le match a été propre. **Trois recrutés au maximum, un seul actif par match** (`BRIEF.md`, arbitrage n° 2) : il apporte son **passif** et sa **carte de terrain à usage unique**, jamais son pouvoir. |
| **Un flag et une entrée de carnet** | Format `pays.fr.<region>_<nom>` — il n'existe pas de portée `region.*` : un flag régional est un flag de pays préfixé par le nom de la région (`01-bible.md` §8.1 et §8.3). La routine lore écrit contre ces flags. |

### 2.5 Les cinq hooks du moteur

Une mécanique régionale **doit** se brancher sur l'un de ces cinq points, et un seul en principal. C'est la contrainte qui rend le système générique : le moteur n'apprend jamais de nouveau vocabulaire, seulement de nouvelles valeurs.

> **Le contrat technique fait foi dans `04-gameplay.md` §11.1** : signatures, pureté (un hook renvoie des effets déclaratifs, il ne modifie pas l'état), déterminisme (`ctx.rng` seul), interdiction de mettre une unité hors jeu ou de changer un propriétaire, idempotence par journée. Les noms ci-dessous sont **exactement** ceux du moteur.

| Identifiant | Moment d'appel | Ce qu'il permet |
|---|---|---|
| `debutTour` | Après l'incrément de journée, avant les revenus | Météo, brouillard, révélation, dégâts périodiques, cycles annoncés |
| `finTour` | Après le dernier ordre, avant l'évaluation de victoire | Déplacement forcé, bascule de terrain, soin, marée |
| `surMouvement` | Sur les cases traversées : autorise, refuse ou tronque le chemin | Coût de terrain, invisibilité, téléportation, transport, blocage |
| `surAttaque` | Après le calcul de base des dégâts, avant l'arrondi | Modificateurs d'attaque, de défense, de riposte |
| `modifTerrain` | Vue « logique » du terrain, à chaque lecture d'une case | Terrain reinterprété : construction, mise hors service, coulée, inondation |

Une mécanique peut utiliser un **hook secondaire**, jamais plus d'un. Les fiches ci-dessous l'indiquent quand c'est le cas.

**Ce qu'un hook renvoie.** Un hook ne modifie rien : il renvoie des `EffetMecanique` déclaratifs, dont la liste fermée est fixée par `04-gameplay.md` §11.1 — `changer_terrain`, `degats`, `repousser`, `annonce`, et **`modificateur`**, ajouté le 5 septembre 2026. C'est ce dernier variant qui porte tous les effets chiffrés des fiches ci-dessous qui ne sont ni un changement de terrain ni un déplacement : la vision réduite de la brume des Hauts-de-France, le bonus d'attaque en surplomb de Bourgogne-Franche-Comté, la défense du bocage normand, le mouvement du circuit ligérien. Il s'écrit dans le **vocabulaire des pouvoirs** (`EffetModificateur`, `03-schemas.md` §2), avec une durée `ce_tour`, `tour_complet` ou `journees n = 1…3` — donc dans les mêmes bornes : multiplicateurs entre 0,5 et 2,0, additifs entiers. Un pourcentage de fiche (« +40 % de défense ») se lit `defense ×1,4`.

**Deux précisions qui évitent les contresens :**

- `modifTerrain` n'est **pas** un événement « une case vient de changer ». C'est une vue : la grille de `MapDef` n'est jamais réécrite. Un changement durable (château pris, pont coupé, coulée de lave) s'inscrit dans `etat.mecanique.donnees` via un effet `changer_terrain` émis par `debutTour` ou `finTour`, et `modifTerrain` se contente d'en donner la lecture. Voir `04-gameplay.md` §11.1.
- `surAttaque` ne modifie **pas** une portée en cours de tour (la prévisualisation deviendrait mensongère) : il modifie des dégâts.

**Unité de temps.** Les cycles des mécaniques se comptent en **journées** — une journée = un tour de chaque camp (`04-gameplay.md` §1 et §7.4). « Une journée sur deux » et non « un tour sur deux ».

### 2.6 Les 18 spécialités sont des effets déclaratifs

Depuis les arbitrages du 5 septembre 2026, une spécialité régionale n'est plus une phrase : c'est une donnée du type `Specialite` (`03-schemas.md` §1), avec deux différences par rapport à un pouvoir :

- elle est **permanente** (aucune durée : ni `ce_tour`, ni `tour_complet`, ni `journees`) ;
- elle est donc **volontairement faible**, et **une seule est active à la fois**.

`03-schemas.md` §1 est **propriétaire de la forme** : `cle`, `nom`, `portee: 'region'`, `famille`, `contenu` et `description`. Le `contenu` a **deux variants, et deux seulement** (`BRIEF.md`, seconde relecture, point 1) :

- **`modificateur`** — 1 à 2 `EffetModificateur` permanents, écrits dans le vocabulaire des pouvoirs (`cible`, `filtre`, `modificateur`) et dans les mêmes bornes : multiplicateurs `attaque` / `defense` / `fonds` entre **0,5 et 2,0**, `capture` entre **0,5 et 3,0** (sous 1,0, cible `unites_adverses` obligatoire), additifs entiers pour `mouvement`, `portee`, `vision`, `soin` ;
- **`trait`** — exactement une valeur de la liste fermée **`TraitSpecialite`** : `franchissement_riviere`, `experience_rapide`, `ravitaillement_ville`, `vision_nuit`, `pied_marin`. C'est ce qui exprime ce qu'aucun chiffre ne dit — un gué, une montée en grade, une ville qui ravitaille, des yeux dans le noir, des pieds sûrs sur l'estran. Le moteur implémente chaque trait **une seule fois** ; une fiche ne fait que le déclarer, et **aucune routine ne peut inventer une valeur** : la liste ne grandit que par arbitrage au brief.

Les 18 fiches ci-dessous donnent chacune **une ligne d'effet**, et une seule.

**Plafonds** (`BRIEF.md`, seconde relecture, point 2) : **cinq spécialités possédées, une seule équipée par match**, choisie avant le coup d'envoi. Le plafond de cumul du moteur est donc **un** (`03-schemas.md` §1) ; le « cinq » de ce document est un plafond de **collection**, pas de cumul. Les deux règles ne se contredisent plus : elles portent sur deux objets différents.

### 2.7 La mer est infranchissable (et ce qui change quand elle ne le sera plus)

Le paquet naval est reporté (`BRIEF.md`, arbitrage n° 3) : d'ici là, **la mer ne se franchit que par les ponts et les plages**. Six régions très maritimes portent donc, dans leur fiche, une ligne **« Sans paquet naval »** qui dit trois choses : comment la carte se joue aujourd'hui, quel **ratio terre/mer provisoire** elle utilise, et ce qui **s'ajoutera** quand la mer arrivera. Rien n'est supprimé : la version maritime de chaque carte reste écrite et redeviendra la version de référence.

**Quand l'écart de ratio change la nature de la carte, ce sont deux `MapDef`, pas une** (`BRIEF.md`, seconde relecture, point 6) : deux clés, deux certifications par la routine contrôle, chacune sous sa propre matrice climatique, la version maritime restant en `brouillon` jusqu'au paquet naval. Une région peut porter plusieurs cartes — `03-schemas.md` §7 le dit explicitement. Mayotte est le cas modèle (§4.17) ; la règle vaut pour les cinq autres régions maritimes et pour la Nouvelle-Calédonie (§5). Ce qu'on y gagne : **aucune carte certifiée ne change de verdict le jour du paquet naval**.

### 2.8 Climat : les saisons se cumulent avec les mécaniques

La date du monde est la **date réelle** (`BRIEF.md`, « Climat ») : le joueur ne choisit pas la saison de son étape, il joue celle du jour. La France entière est en hémisphère `nord`, y compris pour la lecture des saisons ; **La Réunion et Mayotte sont en hémisphère `sud`** et jouent donc à contretemps de la métropole, ce qui est un vrai dépaysement de milieu de parcours.

Chaque fiche porte une ligne **« Saisons et météo »** : ce que les quatre saisons font à cette carte, et la météo la plus fréquente d'après son climat. Deux règles simples :

- **Les mécaniques régionales et la météo se cumulent** — elles tournent sur le même contrat de hooks, elles ne se remplacent jamais. Une marée pendant une tempête, ce sont bien les deux.
- **Une carte doit rester jouable dans toutes les saisons et toutes les météos.** C'est la routine contrôle qui le vérifie, en simulant chaque carte sous plusieurs climats. Une mécanique qui ne survit pas à la neige est une mécanique à revoir, pas une saison à interdire.

Les cumuls les plus intéressants sont cités dans les fiches ; ce sont ceux que le commentateur d'Atlas annonce deux journées à l'avance.

---

## 3. Gabarit d'une fiche région (générique)

Six champs, dans cet ordre, identiques pour les 18 régions et réutilisables pour tout autre pays phare :

**Ambiance et paysages** · **Mécanique de terrain** (nom, hook, effet chiffré) · **Commandant régional** (nom, trait, pouvoir) · **Carte principale** (taille, biome, ratio terre/mer, points d'intérêt) · **Clin d'œil culturel** · **Récompense et flag**.

Deux lignes s'y ajoutent depuis les arbitrages du 5 septembre 2026 :

- **Saisons et météo**, après la mécanique de terrain — deux lignes sur ce que les saisons font à cette carte, la météo dominante de son climat, et le cumul qui vaut le coup d'œil (§ 2.8).
- **Sans paquet naval**, juste après la carte principale, et **uniquement pour les six régions très maritimes** — comment la carte se joue tant que la mer est infranchissable (§ 2.7).

---

## 4. Les 18 fiches

### 4.1 Bretagne — *zone A*

- **Ambiance et paysages** — Granit, ajoncs, embruns. Une côte qui change de forme deux fois par jour, des ports minuscules, des phares qui prennent des paquets de mer et un ciel qui décide de tout. Le terrain sent le sel et la crêpe.
- **Mécanique de terrain — Les marées.** *Hook : `finTour`.* Toutes les cases marquées **estran** basculent **terre ↔ mer une journée sur deux** (cycle de 2 journées, annoncé au HUD deux journées à l'avance). Une unité terrestre surprise par la marée montante perd **3 PV** et est repoussée sur la case de terre ferme la plus proche ; un navire échoué par la marée descendante est **immobilisé une journée**. Environ 15 % des cases de la carte sont des estrans, toutes regroupées le long de la côte : la marée ne bouleverse pas la carte, elle en redessine le bord.
- **Commandant régional** — **Maëlle Kerdraon**, patronne de port. *Trait :* ne regarde jamais l'horloge, seulement le ciel, et se trompe rarement. *Pouvoir — Grande marée :* déclenche une bascule immédiate hors cycle, ce qui prend l'adversaire à contretemps et lui coûte en moyenne deux unités mal placées.
- **Saisons et météo** — L'automne et l'hiver bretons donnent des marées plus fortes et une carte plus étroite ; le printemps et l'été rendent l'estran plus stable et le bord de carte plus large. **Météo dominante : la pluie**, presque toutes saisons confondues (vision −1, roues ralenties hors route) ; la tempête arrive en hiver. **Le cumul à voir : marée montante + tempête** — l'estran bascule pendant que les unités aériennes sont clouées au sol, et la seule issue est de marcher. Le commentateur l'annonce deux journées à l'avance ; personne n'a d'excuse.
- **Carte principale** — 18×14, biome littoral atlantique, terre/mer **55/45** (variable de ±8 % selon la marée). *Points d'intérêt :* un phare stylisé sur un caillou isolé (point haut, vision 7), un port de pêche aux coques colorées, un alignement de pierres levées qui sert de couvert en ligne, une crêperie sur le quai qui répare 2 PV par journée.
- **Sans paquet naval** — La marée reste **entièrement jouable** : elle ouvre et ferme des chemins **à pied**, ce qui est son vrai sujet. Les cases d'estran basculent en `plage` (praticable par tous) plutôt qu'en `mer`, deux **ponts de pierre** relient le port aux îlots, et le ratio passe provisoirement à **70/30**. Le navire échoué par la marée descendante est le seul effet mis en attente. *Avec le paquet naval s'ajouteront le mouillage, l'échouage et le débarquement sur l'estran découvert — la région n'a rien à réécrire, seulement à rouvrir.*
- **Clin d'œil culturel** — La galette-saucisse d'avant-match, mangée debout. Le fest-noz d'après-match, où l'on danse en ligne, gagnants et perdants mélangés. Le kouign-amann que Maëlle offre **quand elle perd**, parce qu'elle trouve que ça console mieux.
- **Récompense et flag** — Carte de terrain **« Marée »** ; spécialité **« Pied marin »** — `mes_unites`, filtre `surTerrain: ['plage', 'pont']`, `mouvement +1` (permanent) ; co-commandante Maëlle Kerdraon. Flag : `pays.fr.bretagne_maree_lue`.

---

### 4.2 Normandie — *zone A*

- **Ambiance et paysages** — Des haies vives partout, des pommiers en rang, des vaches qui regardent passer les unités sans s'émouvoir, et au bout une falaise blanche qui tombe dans la Manche. C'est vert, c'est bas, et on n'y voit rien à dix mètres.
- **Mécanique de terrain — Le bocage.** *Hook : `surMouvement`* (secondaire : `surAttaque`). Les haies réduisent la **portée de vision à 1 case** pour toute unité située dans le bocage **et** bloquent la vision au travers : une unité qui entre dans le bocage **disparaît de la carte adverse**. L'infanterie y gagne **+40 % de défense** et s'y déplace à **1 point** par case ; les véhicules paient **2 points** et n'y reçoivent aucun bonus. Environ 45 % de la carte est en bocage, en réseau connecté : ce sont des couloirs, pas des taches.
- **Commandant régional** — **Colin Lefebvre**, éleveur. *Trait :* connaît chaque haie par son prénom et les présente une par une, ce qui prend un certain temps. *Pouvoir — Le chemin creux :* trois unités amies traversent le bocage sans coût de mouvement et **arrivent invisibles** de l'autre côté.
- **Saisons et météo** — L'automne est la saison qui change le plus la carte : **les haies perdent leur couvert**, le bocage cesse d'être un labyrinthe et Colin perd la moitié de son avantage. L'hiver ajoute la boue (roues ralenties), le printemps et l'été rendent au bocage toute son opacité. **Météo dominante : la pluie**, avec du brouillard de fond de vallée au petit matin. **Le cumul à voir : bocage + brouillard** — vision 1 partout, y compris pour celui qui connaît les haies par leur prénom.
- **Carte principale** — 20×14, biome bocage et falaises littorales, terre/mer **80/20**. *Points d'intérêt :* la falaise blanche (point haut de 6 de vision, mais aucun couvert), une pommeraie en damier, un unique pont de pierre qui devient l'enjeu de tout le milieu de partie, un marché au beurre qui donne +1 revenu.
- **Clin d'œil culturel** — Le camembert de la mi-temps, sorti trop tôt pour être bon et mangé quand même. Le « trou normand » entre deux tours, devenu une plaisanterie récurrente de commentateur. Le cidre servi en bolée, sur lequel Colin a des exigences fermes.
- **Récompense et flag** — Carte de terrain **« Bocage »** (pose cinq haies) ; spécialité **« Couvert »** — `mes_unites`, filtre `mouvement: ['pied']` et `surTerrain: ['foret']`, `defense ×1,1` (permanent) ; co-commandant Colin Lefebvre. Flag : `pays.fr.normandie_haie_franchie`.

---

### 4.3 Pays de la Loire — *zone A*

- **Ambiance et paysages** — Un estuaire large, des marais salants qui font des miroirs blancs, du bocage vendéen, et au milieu de tout ça un circuit automobile qui tourne jour et nuit une fois par an. Le bruit des moteurs porte à des kilomètres.
- **Mécanique de terrain — Le circuit.** *Hook : `surMouvement`* (secondaire : `finTour`). Une **boucle de route fermée** de 40 cases traverse la carte. Tout **véhicule** qui reste **sur** le circuit gagne **+3 mouvement** ; en sortir consomme **tout le mouvement restant**. Quatre cases de **stand** ponctuent la boucle : un véhicule qui y termine son tour regagne **3 PV** et refait le plein de munitions. L'infanterie ne tire aucun profit du circuit — c'est une carte de véhicules.
- **Commandant régional** — **Solène Rialland**, chef d'équipe. *Trait :* chronomètre absolument tout, y compris les repas, et annonce les temps à voix haute. *Pouvoir — Double relais :* deux véhicules amis repassent au stand sans s'arrêter — `soin +3`, munitions pleines et `mouvement +4` sur le circuit pour la journée. (L'ancienne formulation les faisait **échanger leur position** : `04-gameplay.md` §7.2 l'interdit, et un relais se court, il ne se téléporte pas.)
- **Saisons et météo** — Le circuit ne dort jamais, mais il ne se prend pas de la même façon selon la saison : l'hiver gèle la boucle par plaques (les véhicules y perdent leur bonus une journée sur deux) et gèle l'estuaire, l'été sèche les marais salants et les rend franchissables à coût 1. **Météo dominante : la pluie océanique**, et c'est elle qui décide du match — piste mouillée, roues à +1 hors route. **Le cumul à voir : circuit + pluie** — les stands deviennent obligatoires, exactement comme dans la vraie course de vingt-quatre heures.
- **Carte principale** — 20×14, biome bocage, marais salants et estuaire, terre/mer **75/25**. *Points d'intérêt :* le circuit en boucle stylisé, les marais salants en damier blanc (coût de mouvement 2, aucun couvert, très beaux), l'estuaire franchissable par un seul pont levant, une tribune pleine qui donne +5 % d'attaque aux unités adjacentes.
- **Clin d'œil culturel** — La course de vingt-quatre heures et son petit-déjeuner d'après-course, mythique et redouté. La brioche vendéenne servie en tranches épaisses. Le sachet de sel de Guérande que Solène offre à tout adversaire, gagnant ou perdant, avec une notice d'utilisation.
- **Récompense et flag** — Carte de terrain **« Circuit »** (trace une route rapide de 8 cases) ; spécialité **« Mécanique »** — `mes_unites`, filtre `mouvement: ['roues', 'chenilles']` et `surTerrain: ['ville', 'usine']`, `soin +1` (permanent) ; co-commandante Solène Rialland. Flag : `pays.fr.pays_de_la_loire_boucle_bouclee`.

---

### 4.4 Centre-Val de Loire — *zone A*

- **Ambiance et paysages** — Un fleuve large et sablonneux qui refuse d'être canalisé, des bancs de sable qui bougent d'une saison à l'autre, des forêts de chasse, et sur les hauteurs des châteaux qui ont l'air posés là pour la photo.
- **Mécanique de terrain — Les châteaux.** *Hook : `modifTerrain`.* La carte porte **quatre châteaux neutres**. Les capturer demande **60 points de capture** au lieu de 20 (`04-gameplay.md` §6) ; une fois pris, la case devient une **forteresse** : **+35 % de défense** pour l'occupant, **+2 PV de réparation par tour**, **vision 5**. Un château peut être repris par l'adversaire, mais **garde ses dégâts** : chaque changement de main lui retire **10 %** de son bonus de défense, définitivement. Sur une partie longue, les quatre châteaux finissent par valoir moins que des villes — c'est la leçon de la région : on ne se bat pas indéfiniment pour la même pierre.
- **Commandant régional** — **Aubin Loiseau**, guide et jardinier. *Trait :* refuse de jouer un coup qu'il trouve laid, même s'il gagne, ce qui lui coûte régulièrement des matchs. *Pouvoir — Rénovation :* un château ami repasse à **100 %** de son bonus et répare **toutes** les unités adjacentes de 3 PV.
- **Saisons et météo** — Le fleuve fait la saison : les crues d'hiver et de printemps **noient les bancs de sable** et suppriment les gués mobiles, l'été les fait ressortir et ouvre deux passages de plus. L'automne dépouille la forêt de chasse, qui cesse de cacher. **Météo dominante : la pluie douce**, avec du brouillard de vallée au-dessus du fleuve à l'aube. **Le cumul à voir : gué découvert + brouillard** — un passage s'ouvre au moment précis où plus personne ne le voit.
- **Carte principale** — 22×14, biome vallée fluviale, forêt et vignoble, terre/mer **85/15** (le fleuve compte comme eau peu profonde, franchissable aux **gués**). *Points d'intérêt :* quatre châteaux stylisés aux quatre coins d'un losange, des bancs de sable qui servent de gués mobiles, une forêt de chasse dense, une cave troglodyte creusée dans le coteau (cachette d'une unité).
- **Clin d'œil culturel** — Les rillettes et le fromage de chèvre cendré du buffet, servis avec un sérieux d'expert. Les montgolfières qui décollent à l'aube au-dessus du fleuve et survolent le terrain avant le coup d'envoi. Le vouvray du podium, dont Aubin explique le millésime que personne n'a demandé.
- **Récompense et flag** — Carte de terrain **« Château »** (transforme une ville en forteresse pour 3 tours) ; spécialité **« Bâtisseur »** — `mes_unites`, `capture ×1,1` (permanent, soit environ +2 points de capture par journée sur les 20 du seuil) ; co-commandant Aubin Loiseau. Flag : `pays.fr.centre_val_de_loire_chateau_intact`.

---

### 4.5 Hauts-de-France — *zone B*

- **Ambiance et paysages** — Une plaine immense, un ciel bas qui traîne, des collines noires laissées par l'industrie et devenues des belvédères, des beffrois qui dépassent de tout, et une plage à marée basse tellement large qu'on ne voit pas la mer.
- **Mécanique de terrain — La brume et les terrils.** *Hook : `debutTour`.* À chaque début de journée, une **bande de brume de 6 colonnes** se déplace selon un ordre déterministe annoncé au HUD. À l'intérieur : **portée de vision −2** pour **tout le monde**, y compris le joueur qui la déclenche. Les **six terrils** de la carte sont les seules cases qui la percent : une unité au sommet voit à **6 cases en permanence** et gagne **+15 % d'attaque à distance**. Les beffrois des deux villes font la même chose en zone urbaine. La région enseigne une chose : **la hauteur vaut plus que la vitesse quand on n'y voit rien.**
- **Commandant régional** — **Sylvie Delcourt**, cheffe d'estaminet. *Trait :* ouvre sa porte avant même qu'on ait frappé, et n'a jamais laissé personne repartir en ayant faim. *Pouvoir — Le beffroi sonne :* toute la brume se lève pendant un tour ; vision totale sur la carte pour son camp seulement.
- **Saisons et météo** — La bande de brume de la mécanique est là toute l'année ; les saisons décident si elle est seule. L'hiver ajoute la neige sur la plaine (+1 de coût pour tout sauf pied et chenilles) et raccourcit les journées ; l'automne pose du **brouillard** par-dessus la brume, et l'été dégage enfin la vue depuis les terrils. **Météo dominante : le brouillard**, la plus caractéristique du Nord. **Le cumul à voir : bande de brume + brouillard** — vision 1 sur toute la carte, sauf au sommet des six terrils et des beffrois, qui deviennent littéralement les seuls yeux de la partie. C'est la leçon de la région, portée à son extrême.
- **Carte principale** — 20×14, biome plaine du Nord, terrils, dunes et plage immense, terre/mer **80/20**. *Points d'intérêt :* deux terrils jumeaux au centre, un beffroi qui domine la ville principale, un estaminet aux carreaux rouges (répare et donne +1 revenu), une plage démesurée à marée basse où rien ne se cache.
- **Clin d'œil culturel** — La frite du stand de mi-temps, servie dans un cornet, avec un débat ferme sur la sauce. Le maroilles que personne n'ose refuser et que tout le monde finit. Les géants de carnaval installés en tribune, qui dépassent de trois têtes.
- **Récompense et flag** — Carte de terrain **« Brume »** ; spécialité **« Vigie »** — `mes_unites`, filtre `surTerrain: ['montagne']`, `vision +1` (permanent) ; co-commandante Sylvie Delcourt. Flag : `pays.fr.hauts_de_france_terril_gravi`.

---

### 4.6 Grand Est — *zone B*

- **Ambiance et paysages** — Un grand fleuve qui coupe le paysage en deux, des sapins sombres sur les crêtes, des coteaux de vigne en rangs serrés, des maisons à colombages et des cigognes qui traversent le ciel au ralenti.
- **Mécanique de terrain — Le fleuve et ses ponts.** *Hook : `modifTerrain`.* Un grand fleuve coupe la carte du haut vers le bas. Il est **infranchissable** — sauf par **trois ponts**. Un pont peut être **mis hors service** en **2 attaques** et **remis en service** par une unité de génie en **2 tours**. Franchir un pont consomme **tout le mouvement restant** (on ne traverse pas en courant). Tant qu'un camp contrôle **les trois ponts**, il gagne **+10 % de revenu** : les échanges passent, et c'est le vrai enjeu de la carte. *Paramètre :* **`gelable: false`** (`BRIEF.md`, seconde relecture, point 5) — le grand fleuve est trop large et trop courant pour prendre, **il ne gèle jamais**. C'est une ligne de paramètre commune à toutes les mécaniques (`03-schemas.md` §7, `04-gameplay.md` §11.1 et §12.6, règle 4), pas une exception écrite dans le code, et elle resservira à tout fleuve majeur. Le joueur le lit dans la description de la mécanique : une règle invisible serait une règle injuste.
- **Commandant régional** — **Théo Ruhlmann**, maître de chai. *Trait :* annonce son coup **deux tours à l'avance**, à voix haute, et le réussit quand même — ce qui est plus vexant qu'une feinte.  *Pouvoir — Pont de bateaux :* pose un **quatrième pont temporaire** (3 tours) où il veut sur le fleuve.
- **Saisons et météo** — Le climat continental tranche : l'hiver enneige la plaine et les coteaux, et l'effet de saison `rivieres_gelees` prend toutes les eaux de la carte — **sauf le grand fleuve**, qui déclare `gelable: false` et garde ses trois ponts pour seuls passages, en janvier comme en juillet. La leçon de l'étape et son bonus de revenu tiennent donc les quatre saisons, et la routine contrôle certifie **une** carte, pas deux (`04-gameplay.md` §12.6, règle 4). Les ruisseaux et les bras morts gèlent, eux, ce qui ouvre des raccourcis de flanc sans jamais ouvrir le fleuve : l'hiver change le détail, pas la nature. L'été et l'automne rendent au paysage sa lenteur. **Météo dominante : la neige en hiver, la pluie le reste de l'année.**
- **Carte principale** — 22×14, biome plaine fluviale, forêt de sapins et vignoble en coteaux, terre/mer **88/12**. *Points d'intérêt :* les trois ponts, très différents (un de pierre, un de fer, un de bois), une silhouette de cathédrale en fond de carte qui sert de repère de vision, un marché de bois et de lumières installé sur la place, des cigognes qui passent au-dessus du terrain entre deux tours.
- **Clin d'œil culturel** — La choucroute et la tarte flambée du buffet, servies dans cet ordre et jamais l'inverse. Le bretzel accroché au poteau de but par une tradition dont personne ne connaît l'origine. Le vin blanc servi trop frais, dont Théo se plaint à chaque match sans jamais rien changer.
- **Récompense et flag** — Carte de terrain **« Pont »** (pose un pont temporaire) ; spécialité **« Génie »** — *trait* **`franchissement_riviere`** (`03-schemas.md` §1) : les unités à pied et à bottes traversent une case `riviere` au coût de 2, **sans pont**. C'est le geste du génie du Grand Est, et c'est exactement ce qu'aucun modificateur ne sait dire — un franchissement n'est pas un chiffre ; co-commandant Théo Ruhlmann. Flag : `pays.fr.grand_est_trois_ponts_tenus`.

---

### 4.7 Bourgogne-Franche-Comté — *zone B*

- **Ambiance et paysages** — Des coteaux en escalier, des parcelles de vigne bordées de murets, des plateaux de forêt froide au-dessus, des sources qui sortent de la roche, et sous terre des kilomètres de caves voûtées.
- **Mécanique de terrain — Les coteaux.** *Hook : `surMouvement`.* La carte est construite en **courbes de niveau** (4 niveaux). **Monter** d'un niveau coûte **+1 mouvement** ; **descendre** en coûte **−1** (minimum 1 par case). Une unité qui attaque **depuis un niveau supérieur** gagne **+20 % d'attaque** ; depuis un niveau inférieur, elle subit **−15 %**. Quatre **caves** permettent à une unité de disparaître totalement pendant **un tour** (invisible et non ciblable), avec **sortie obligatoire** au tour suivant sur une case adjacente au choix.
- **Commandant régional** — **Gaspard Millot**, vigneron. *Trait :* goûte le terrain avant de jouer, littéralement, et en tire des conclusions tactiques que personne ne conteste plus. *Pouvoir — Le millésime :* une unité amie gagne **un rang de vétérance permanent** (`attaque ×1,15` et `defense ×1,15` pour le reste de la campagne).
- **Saisons et météo** — Les quatre niveaux ne se montent pas pareil selon la saison : l'hiver enneige les plateaux du haut et rend la montée coûteuse pour tout sauf l'infanterie et les chenilles, l'automne dégarnit les murets et la forêt froide, l'été rend les caves particulièrement précieuses. **Météo dominante : le brouillard de fond de vallée** l'automne et l'hiver, la pluie le reste du temps. **Le cumul à voir : niveau supérieur + brouillard** — le bonus d'attaque en surplomb reste, mais on ne voit plus ce qu'on domine, et Gaspard adore ça.
- **Carte principale** — 20×14, biome coteaux viticoles et forêt de moyenne montagne, terre/mer **92/8** (rivières et un lac). *Points d'intérêt :* les clos de vigne en damier séparés par des murets (couvert linéaire), une cave voûtée à trois entrées, une fruitière à fromage qui répare, la source d'un fleuve qui jaillit d'une falaise.
- **Clin d'œil culturel** — Le comté servi en trois tranches d'âges différents, avec obligation de dire laquelle on préfère. Les œufs en meurette du buffet, dont Gaspard prétend qu'ils se mangent avant le match. La course d'escargots organisée en lever de rideau, sur une piste de deux mètres, et suivie avec un sérieux total.
- **Récompense et flag** — Carte de terrain **« Coteau »** (surélève six cases d'un niveau) ; spécialité **« Millésime »** — *trait* **`experience_rapide`** (`03-schemas.md` §1) : une unité gagne son rang au bout d'une mise hors jeu de moins que la normale. L'expérience n'est pas un modificateur, c'est un trait ; co-commandant Gaspard Millot. Flag : `pays.fr.bourgogne_franche_comte_cave_utilisee`.

---

### 4.8 Nouvelle-Aquitaine — *zone C*

- **Ambiance et paysages** — La plus grande forêt plantée d'Europe, des pins alignés au cordeau à perte de vue, une dune de sable géante au bord de l'océan, des cabanes sur pilotis dans un bassin, et au nord des rangs de vigne aussi réguliers que les pins.
- **Mécanique de terrain — Les allées.** *Hook : `surMouvement`.* La moitié sud de la carte est une **pinède plantée en damier**, parcourue d'allées rectilignes. Se déplacer **le long d'une allée**, en ligne droite non interrompue, coûte **0,5 point par case** — deux fois plus vite qu'une route. Se déplacer **en travers** coûte **3 points par case**. Il en résulte des autoroutes invisibles et des murs invisibles : la carte se lit comme une grille, pas comme un terrain. Au nord, le **vignoble en terrasses** donne **+15 % de défense** et limite la vision à 2 cases.
- **Commandant régional** — **Peyo Etchandy**, ostréiculteur et joueur de pelote. *Trait :* chante en jouant sans s'en apercevoir, et change de chanson quand il change de plan — ce qui constitue une fuite d'information que personne n'a encore exploitée. *Pouvoir — Ligne droite :* trois unités amies traversent la pinède **d'un bout à l'autre de la carte** en un seul tour.
- **Saisons et météo** — La grille de pins ne change pas de forme, mais l'été change tout autour : **canicule** sur la pinède et la dune, unités lourdes à −1 hors route, et un vignoble du nord qui devient le seul endroit où l'on tient longtemps. L'hiver amène les tempêtes atlantiques (aériennes clouées) et l'automne dégarnit les rangs de vigne, qui perdent leur couvert. **Météo dominante : la canicule l'été, la pluie et la tempête l'hiver.** **Le cumul à voir : allée rapide + tempête** — on va deux fois plus vite au sol pendant que personne ne peut voler.
- **Carte principale** — 24×14, biome pinède, vignoble, dune littorale et bassin, terre/mer **78/22**. *Points d'intérêt :* la grande dune (point haut de 7 de vision, coût de montée 3), les rangs de pins qui structurent toute la moitié sud, les cabanes ostréicoles sur pilotis (cases d'eau peu profonde praticables), un pont de fer sur l'estuaire.
- **Clin d'œil culturel** — Les huîtres du bassin ouvertes au bord du terrain, servies avec du pain de seigle. Le canelé, adopté comme jeton de score officiel de l'étape. La pelote contre le fronton du village avant le match, et la finale de rugby projetée en tribune, que tout le monde regarde au lieu du match.
- **Récompense et flag** — Carte de terrain **« Allée »** (trace deux allées rapides de 10 cases) ; spécialité **« Ligne droite »** — `mes_unites`, filtre `surTerrain: ['route']`, `mouvement +2` (permanent). La condition « chemin en ligne droite » a été **abandonnée** : `TraitSpecialite` est une liste fermée de cinq valeurs (`03-schemas.md` §1) et ne connaît pas `ligne_droite` ; la grande allée landaise se dit très bien avec un filtre de terrain, et le joueur la lit du premier coup d'œil ; co-commandant Peyo Etchandy. Flag : `pays.fr.nouvelle_aquitaine_allee_empruntee`.

---

### 4.9 Occitanie — *zone C*

- **Ambiance et paysages** — Une garrigue sèche et parfumée, un canal bordé de platanes qui traverse tout le pays en pente douce, des causses caillouteux, et au sud une barrière de haute montagne qui ferme l'horizon avec trois trous dedans.
- **Mécanique de terrain — Le canal et les cols.** *Hook : `surMouvement`* (secondaire : `debutTour`). Un **canal** traverse la carte d'est en ouest, ponctué de **six écluses capturables**. Une unité terrestre embarquée sur une **péniche** avance de **6 cases par tour sans dépenser son propre mouvement**, mais ne peut monter ou descendre qu'**aux écluses**. Contrôler une écluse permet de **fermer le canal** à l'adversaire. Au sud, la haute montagne est franchissable par **trois cols** seulement ; au début de chaque journée impaire, le brouillard d'altitude en **ferme un**, tiré dans un ordre annoncé.
- **Commandant régional** — **Mireille Bousquet**, éclusière. *Trait :* parle avec les mains, ce qui lui fait gagner un temps considérable et en fait perdre autant à ses adversaires. *Pouvoir — Écluse ouverte :* toutes les péniches amies doublent leur vitesse pendant deux tours et une écluse adverse s'ouvre d'office.
- **Saisons et météo** — L'Occitanie a deux visages saisonniers très nets : l'été met la garrigue et les causses en **canicule** (unités lourdes à −1 hors route, aucune ombre sur le causse) tandis que le canal reste le seul axe frais et rapide ; l'hiver enneige la barrière du sud et **ferme deux cols sur trois** au lieu d'un. **Météo dominante : la canicule l'été, la pluie d'orage à l'automne.** **Le cumul à voir : col fermé par le brouillard + canicule** — le sud est bouché et le plat est éprouvant, il ne reste que la péniche, ce qui fait rire Mireille pendant toute la partie.
- **Carte principale** — 24×16, biome garrigue, canal aux platanes, causses et haute montagne, terre/mer **88/12**. *Points d'intérêt :* une cité fortifiée sur sa colline (forteresse naturelle), un escalier d'écluses en cinq bassins, un moulin à vent sur le causse (point haut), un viaduc élancé qui enjambe une vallée et sert de pont piéton.
- **Clin d'œil culturel** — Le cassoulet servi en portions déraisonnables, avec un débat sans fin sur ce qu'on met dedans. Le rugby à XIII autant qu'à XV, et un public qui connaît les règles des deux. Le pastis coupé à l'eau du canal, dont Mireille jure que c'est ce qui fait la différence.
- **Récompense et flag** — Carte de terrain **« Canal »** (creuse un canal navigable de 8 cases) ; spécialité **« Écluse »** — *trait* **`pied_marin`** (`03-schemas.md` §1) : les unités ignorent le malus de mouvement des terrains `cotier` et `plage`, et un débarquement ne coûte pas la fin du tour. Sur le canal, c'est l'aisance des mariniers : on monte et on descend de la péniche sans y perdre sa journée. `embarquement_libre` n'existe pas — la liste des traits est fermée ; co-commandante Mireille Bousquet. Flag : `pays.fr.occitanie_ecluse_tenue`.

---

### 4.10 Auvergne-Rhône-Alpes — *zone D*

- **Ambiance et paysages** — Une file de cônes réguliers posés sur un plateau, comme si quelqu'un les avait dessinés ; des lacs ronds au fond de cratères ; de la brume qui stagne dans les vallées jusqu'à midi ; et à l'est, la vraie haute montagne, qui ferme tout.
- **Mécanique de terrain — Les puys.** *Hook : `surAttaque`* (secondaire : `debutTour`). Une chaîne de **volcans éteints** traverse la carte en cônes réguliers. Une unité **au sommet** d'un puy gagne **+25 % d'attaque**, **+2 de portée de vision** et **+1 de portée de tir**. Y monter coûte **3 points de mouvement** et l'unité **ne peut pas attaquer le tour où elle arrive** : le sommet se paie d'un tour d'exposition. En bas, au début de chaque journée **paire**, la **brume de vallée** réduit la vision à **2 cases** pour toutes les unités qui ne sont pas sur un point haut. À l'est, la haute montagne alpine est infranchissable sauf aux cols.
- **Commandant régional** — **Fanny Chabrier**, guide de haute montagne. *Trait :* escalade tout ce qui dépasse, y compris pendant une conversation, et continue de parler normalement. *Pouvoir — Le sommet :* deux unités amies sont **téléportées au sommet du puy le plus proche** et peuvent attaquer immédiatement, sans le tour d'attente.
- **Saisons et météo** — C'est la région où l'hiver se voit le plus : **neige** sur toute la chaîne de puys et sur l'est alpin (+1 de coût pour tout sauf pied et chenilles), lacs de cratère gelés donc franchissables, et sommets qui se paient encore plus cher. L'automne dégarnit les pentes boisées, l'été rend les cols alpins praticables et les puys faciles à enchaîner. **Météo dominante : la neige en hiver, le brouillard de vallée le reste de l'année.** **Le cumul à voir : brume de vallée + neige** — en bas on n'y voit rien et on avance mal, en haut on voit tout : la carte force à grimper, ce qui est exactement son propos.
- **Carte principale** — 22×16, biome volcanique et alpin, terre/mer **90/10** (lacs de cratère et un grand lac). *Points d'intérêt :* la chaîne de puys en enfilade sur toute la diagonale, un lac de cratère turquoise (eau profonde encaissée), une station de téléphérique qui relie deux sommets, une ancienne usine reconvertie en tribune couverte.
- **Clin d'œil culturel** — La fondue de fromages d'alpage, servie à des heures indéfendables. La truffade et l'aligot filant, présentés comme deux plats différents par des gens très sûrs d'eux. Le maillot à pois du meilleur grimpeur, remis en fin d'étape à qui a tenu le plus de sommets.
- **Récompense et flag** — Carte de terrain **« Puy »** (surélève une case en point haut permanent) ; spécialité **« Grimpeur »** — `mes_unites`, filtre `surTerrain: ['montagne']`, `mouvement +1` (permanent — une montée qui coûte un point de moins) ; co-commandante Fanny Chabrier. Flag : `pays.fr.auvergne_rhone_alpes_sommet_tenu`.

---

### 4.11 Provence-Alpes-Côte d'Azur — *zone D*

- **Ambiance et paysages** — Du calcaire blanc qui plonge dans une eau très bleue, des bandes de lavande alignées comme des rayures, des villages accrochés en haut de leur rocher, et un vent qui arrive du nord et qui ne demande la permission à personne.
- **Mécanique de terrain — Le mistral.** *Hook : `finTour`* (secondaire : `modifTerrain`). À la fin de chaque tour, le mistral souffle du nord vers le sud et **pousse toutes les unités aériennes d'une case vers le sud**, amies comme adverses, sans exception. Une unité aérienne poussée sur une case interdite (relief, bord de carte) perd **2 PV** et se pose de force. **Une journée sur trois**, le vent **double** : deux cases, annoncé une journée à l'avance au HUD. Au sol, la **garrigue sèche** est inflammable : une attaque explosive sur garrigue transforme **3 cases** en terrain nu pour le reste de la partie — plus de couvert, plus de bonus, définitivement.
- **Commandant régional** — **Marius Ferrand**, patron de club de pétanque. *Trait :* exagère absolument tout, sauf quand il annonce la force du vent, où il est d'une précision de météorologue. *Pouvoir — Coup de mistral :* toutes les unités aériennes adverses sont poussées de **3 cases** ; les siennes ne bougent pas.
- **Saisons et météo** — Le mistral est une **mécanique régionale**, pas une météo : il souffle en toute saison et se cumule avec elle. L'été ajoute la **canicule** sur la garrigue, ce qui rend le terrain nu encore plus pénible et les incendies de garrigue encore plus décisifs ; l'hiver renforce le vent et enneige les alpes du sud. **Météo dominante : le grand beau (clair), la canicule l'été, la tempête l'hiver.** **Le cumul à voir : mistral doublé + tempête** — les unités aériennes sont clouées au sol *et* poussées de deux cases quand elles se posent : c'est la seule configuration du jeu où mieux vaut n'avoir aucun avion.
- **Carte principale** — 20×16, biome méditerranéen, calanques, garrigue et alpes du sud, terre/mer **70/30**. *Points d'intérêt :*
- **Sans paquet naval** — Les calanques restent un décor de bord de carte : elles piègent les navires, donc pour l'instant elles ne piègent personne. La bande côtière se joue par **deux plages** et un **sentier de corniche** qui relie le village perché au port, et le ratio passe provisoirement à **85/15**. *Avec le paquet naval, les calanques redeviennent ce qu'elles sont — des fjords miniatures où un navire entre facilement et ressort difficilement.* les calanques en dents de scie (fjords miniatures qui piègent les navires), un champ de lavande en bandes violettes (couvert bas, vision 3), un terrain de pétanque en case neutre au milieu de la carte où personne n'ose s'installer, un village perché en forteresse naturelle.
- **Clin d'œil culturel** — La bouillabaisse, dont chaque personne présente possède la seule vraie recette. La partie de pétanque de la mi-temps, plus disputée et plus commentée que le match lui-même. La tarte tropézienne du podium, découpée en parts trop petites pour tout le monde.
- **Récompense et flag** — Carte de terrain **« Mistral »** ; spécialité **« Vent arrière »** — `mes_unites`, filtre `mouvement: ['air']`, `mouvement +1` (permanent) ; co-commandant Marius Ferrand. Flag : `pays.fr.provence_vent_dompte`.

---

### 4.12 Corse — *zone D*

- **Ambiance et paysages** — Une montagne posée dans la mer, sans transition : on passe du port au col en quelques kilomètres. Partout, un tapis d'arbustes odorants, dense, épineux, où l'on entre et où l'on cesse d'exister. Des tours rondes sur les caps, des criques inaccessibles.
- **Mécanique de terrain — Le maquis.** *Hook : `surMouvement`.* Le **maquis** — la végétation basse et dense qui couvre l'île — recouvre **40 %** de la carte. Une unité qui y entre devient **totalement invisible** pour l'adversaire : elle disparaît de son affichage, même à une case de distance. Elle réapparaît si elle **attaque**, si elle **sort** du maquis, ou si une unité adverse tente de terminer son tour sur sa case (celle-ci est alors repoussée d'une case et l'unité cachée est révélée). Traverser le maquis coûte **2 points par case** à l'infanterie et est **interdit aux véhicules**. Le relief est brutal : la montagne tombe directement dans la mer, il n'y a presque pas de plaine.
- **Commandant régional** — **Petru Santucci**, berger et coureur de montagne. *Trait :* ne dit jamais où il est, même quand on le lui demande très gentiment, et trouve la question amusante. *Pouvoir — Le sentier :* toutes les unités amies présentes dans le maquis se déplacent de **4 cases sans jamais être révélées**, même en traversant une zone dégagée.
- **Saisons et météo** — Le maquis ne perd jamais ses feuilles : c'est la seule végétation de la qualification que l'automne ne dégarnit pas, et c'est ce qui rend la région constante d'une saison à l'autre. L'été met les crêtes en **canicule** et rend le maquis inflammable ; l'hiver enneige le sentier de crête et rabat tout le monde sur le littoral. **Météo dominante : le clair, avec des orages violents et brefs en fin d'été.** **Le cumul à voir : maquis + nuit** — l'invisibilité du maquis plus la vision de nuit réduite, et Petru devient introuvable, ce qui l'amuse beaucoup.
- **Carte principale** — 16×18 (**format vertical**, unique dans la qualification), biome maquis et montagne côtière, terre/mer **65/35**. *Points d'intérêt :*
- **Sans paquet naval** — La montagne tombe dans la mer, donc tout se joue déjà sur une bande de terre : la carte reste jouable telle quelle, avec le **sentier de crête** comme axe nord-sud et **deux plages** comme seuls accès bas. Le port encaissé devient un simple objectif de capture, et le ratio passe provisoirement à **80/20**. *Avec le paquet naval s'ajouteront le contournement par mer et les débarquements dans les criques inaccessibles — qui rendront le sentier de crête beaucoup moins confortable.* des tours de guet rondes sur chaque cap (vision 6), un sentier de crête qui traverse toute la carte du nord au sud, un port de pêche encaissé entre deux falaises, une bergerie en pierre sèche qui répare.
- **Clin d'œil culturel** — Le fromage de brebis et la charcuterie de montagne, servis sans qu'on les ait demandés et refusables sous aucun prétexte. Les chants polyphoniques à trois voix dans le vestiaire avant le match, que l'équipe adverse est invitée à écouter. La course en montagne dont Petru détient le record et qu'il mentionne exactement une fois par match.
- **Récompense et flag** — Carte de terrain **« Maquis »** (couvre 10 cases de maquis) ; spécialité **« Discrétion »** — `unites_adverses`, filtre `surTerrain: ['foret']`, `vision −2` (permanent, plancher 1 case). `discretion_foret` n'entre pas dans la liste fermée `TraitSpecialite` (`03-schemas.md` §1), et il n'en a pas besoin : « on ne vous voit qu'à une case dans le maquis » est un chiffre, et un chiffre que le HUD sait montrer ; co-commandant Petru Santucci. Flag : `pays.fr.corse_maquis_traverse`.

---

### 4.13 Guadeloupe — *zone E*

- **Ambiance et paysages** — Deux ailes de terre séparées par un bras de mer étroit : d'un côté du plat et du sucre, de l'autre du relief et de la forêt humide. Des mangroves aux racines emmêlées, du sable noir d'un côté, blond de l'autre, et un vent d'est qui ne s'arrête jamais tout à fait.
- **Mécanique de terrain — L'alizé et le grain.** *Hook : `debutTour`* (secondaire : `surMouvement`). Le vent suit un **cycle de 3 journées**, affiché au HUD : **journée 1, brise** (aucun effet) ; **journée 2, alizé** (unités aériennes **−2 mouvement**, navires **+1 mouvement** vers l'ouest) ; **journée 3, grain** (unités aériennes **clouées au sol**, toutes les unités **−1 mouvement**, **vision −2**, aucune attaque à distance au-delà de 2 cases). Le grain est spectaculaire et bref : il traverse et il repart. Les **mangroves** ne sont franchissables que par l'infanterie, à 2 points par case, et masquent totalement la vue.
- **Commandant régional** — **Ludmilla Sainte-Rose**, cheffe de marché. *Trait :* rit plus fort que le grain, ce qui est une performance mesurable. *Pouvoir — Grand vent :* déclenche un **grain immédiat** sur la moitié de la carte de son choix, hors cycle.
- **Saisons et météo** — Hémisphère `nord`, mais climat tropical : ici l'« été » du moteur est **l'hivernage**, chaud et humide, avec la **saison cyclonique** de juillet à octobre — c'est la période où la météo `tempete` est la plus probable du jeu. Le carême (décembre à avril) est sec et l'alizé y est régulier. **Météo dominante : la pluie chaude toute l'année, la tempête en saison cyclonique.** **Le cumul à voir : journée de grain + tempête** — la mécanique cloue les aériennes et la météo aussi, la vision tombe à 1, et la partie se joue entièrement au sol pendant une journée. C'est spectaculaire, c'est annoncé deux journées à l'avance, et ça ne dure pas : le grain traverse et il repart.
- **Carte principale** — 18×16, biome tropical humide et sec, terre/mer **50/50** — la plus équilibrée de la qualification. *Points d'intérêt :*
- **Sans paquet naval** — La carte tient sur son enjeu central, qui est déjà terrestre : **les deux ponts sur le bras de mer**. Ils deviennent le seul lien entre l'aile plate et l'aile montagneuse, ce qui concentre toute la partie dessus — la mécanique de l'alizé et du grain, elle, fonctionne sans rien changer. Le ratio passe provisoirement à **75/25**, les mangroves servant de bordure. **Malus assumé** : sans navires, le camp qui perd les deux ponts n'a aucun plan B. *Avec le paquet naval s'ajouteront le contournement par la mer et le débarquement sur les deux plages, qui rendront la perte d'un pont survivable.* le bras de mer central franchi par deux ponts (l'enjeu de toute la partie), une plage de sable noir et une de sable blond aux deux extrémités, un champ de canne en bandes régulières, un marché aux épices qui donne +1 revenu et répare.
- **Clin d'œil culturel** — Le colombo et les accras du stand de mi-temps, dont la file d'attente dépasse celle de la billetterie. Le gwoka joué en tribune, dont le tempo s'accélère à mesure que le match se tend. Le match de football sur la plage d'après-tournoi, qui dure plus longtemps que la compétition officielle.
- **Récompense et flag** — Carte de terrain **« Grain »** ; spécialité **« Marin d'alizé »** — `mes_unites`, filtre `surTerrain: ['plage', 'pont']`, `mouvement +1` (permanent). *Tant que la mer est infranchissable, l'alizé pousse sur le sable ; quand le paquet naval arrivera, le filtre s'élargira aux navires, comme son nom l'indique* ; co-commandante Ludmilla Sainte-Rose. Flag : `pays.fr.guadeloupe_grain_traverse`.

---

### 4.14 Martinique — *zone E*

- **Ambiance et paysages** — Des collines rondes et serrées les unes contre les autres, si nombreuses qu'on ne voit jamais loin ; des jardins en terrasses ; une baie où mouillent des barques à voile carrée d'une taille disproportionnée ; et des distilleries à roue au bord des rivières.
- **Mécanique de terrain — Les mornes.** *Hook : `surMouvement`* (secondaire : `surAttaque`). La carte est faite de **mornes** — des collines rondes très rapprochées. Chaque case de morne coûte **2 points de mouvement**, donne **+20 % de défense** et **+1 de vision**, mais surtout **bloque la ligne de tir** : une attaque à distance ne passe pas au-dessus d'un morne plus haut que la case du tireur. Résultat, la carte est un labyrinthe d'angles morts. La **mangrove** côtière est franchissable par l'infanterie seule, à 2 points par case, et bloque totalement la vision depuis l'extérieur.
- **Commandant régional** — **Wilfried Dorival**, patron de chantier naval. *Trait :* débat de tout avec une passion réelle et n'en garde jamais la moindre rancune, ce qui déstabilise beaucoup d'adversaires. *Pouvoir — Le morne :* **trois cases se surélèvent immédiatement**, coupant net les lignes de tir adverses en cours de préparation.
- **Saisons et météo** — Même calendrier tropical que la Guadeloupe : hivernage chaud et humide de juin à novembre, **saison cyclonique** au milieu, carême sec de décembre à avril. La pluie transforme les mornes en pentes glissantes (roues à +1) et la brume s'accroche entre les collines. **Météo dominante : la pluie, et la tempête en saison cyclonique.** **Le cumul à voir : angles morts des mornes + brouillard** — les lignes de tir sont déjà coupées par le relief, la vision tombe à 1, et la carte devient un jeu de coins de rue. C'est le terrain le plus « on ne sait jamais qui est derrière » de la qualification.
- **Carte principale** — 18×14, biome tropical humide, mornes et forêt, terre/mer **70/30**. *Points d'intérêt :*
- **Sans paquet naval** — La carte est déjà à 70 % terrestre et sa mécanique est entièrement de relief : elle se joue **sans aucune adaptation**. La baie aux yoles devient un décor de bord de carte et un objectif de capture sur son quai ; le ratio passe provisoirement à **85/15**. *Avec le paquet naval s'ajouteront la baie comme vraie zone de manœuvre et un débarquement possible dans le dos des mornes — la seule façon de contourner un labyrinthe d'angles morts.* une montagne en fond de carte qui domine tout, un jardin de balisiers en terrasses (couvert coloré), une distillerie à roue au bord de la rivière (répare), la baie où mouillent les yoles à voile carrée.
- **Clin d'œil culturel** — Le boudin créole d'avant-match, servi brûlant. La course de yoles rondes en ouverture du tournoi : des voiles carrées immenses, des équipiers en équilibre sur des bois dressés hors de la coque, et un public qui suit en bateau. Le sorbet coco du podium, tourné à la main sur le bord du terrain.
- **Récompense et flag** — Carte de terrain **« Morne »** ; spécialité **« Défilé »** — `unites_adverses`, filtre `types` = les unités de tir indirect, `portee −1` (permanent). `coupe_ligne_de_tir` n'entre pas dans la liste fermée `TraitSpecialite` (`03-schemas.md` §1) : le relief martiniquais raccourcit les trajectoires plutôt qu'il ne les bloque, ce qui donne la même sensation sans ajouter de règle de trajectoire au moteur ; co-commandant Wilfried Dorival. Flag : `pays.fr.martinique_angle_mort_exploite`.

---

### 4.15 Guyane — *zone E*

- **Ambiance et paysages** — Une forêt qui commence au bord de la piste et ne s'arrête plus, des fleuves larges et bruns qui sont les seules routes, une côte de vase où la mer est marron, et au milieu de tout ça une tour blanche d'où partent des fusées.
- **Mécanique de terrain — La canopée et le satellite.** *Hook : `debutTour`.* Deux effets liés. **La canopée** couvre **60 %** de la carte : **vision 1 case**, coût de mouvement **3** pour tout sauf l'infanterie, et **aucune attaque à distance au-delà de 2 cases**. C'est le terrain le plus aveugle de la qualification. **La base spatiale** est une case unique, capturable pour **80 points de capture** au lieu de 20 : celui qui la tient déclenche, **une fois tous les 5 tours**, un **passage satellite** — la **carte entière est révélée pendant un tour**, canopée comprise, et toutes ses unités gagnent **+1 de portée de tir** ce tour-là. C'est le pouvoir le plus fort de toute la qualification, et il tient sur une seule case : toute la partie se joue autour d'elle.
- **Commandant régional** — **Yannick Abraham**, ancien technicien du pas de tir. *Trait :* fait un compte à rebours à voix haute avant chaque décision, par déformation professionnelle, et ne s'en rend plus compte. *Pouvoir — Fenêtre de tir :* révèle la carte entière pendant un tour **sans posséder la base** — sa manière de rappeler qu'il connaît le terrain mieux que quiconque.
- **Saisons et météo** — Climat équatorial : pas quatre saisons mais deux, la saison des pluies (l'« hiver » et le « printemps » du moteur, décembre à juillet) et la saison sèche. Sous la canopée, la pluie ne change presque rien à la vision — elle est déjà à 1 — mais elle ralentit tout ce qui roule. Jour et nuit d'égale longueur toute l'année : `cycleJourNuit` **3 / 3** **[Proposition]**. **Météo dominante : la pluie, très largement.** **Le cumul à voir : canopée + nuit** — la carte la plus aveugle du jeu devient totalement noire, et le passage satellite depuis la base spatiale vaut alors littéralement la partie.
- **Carte principale** — 22×16, biome forêt équatoriale, fleuves larges, littoral de vase, terre/mer **80/20**. *Points d'intérêt :* le pas de tir et sa tour blanche (la case la plus disputée du jeu), un fleuve navigable qui traverse toute la carte et sert d'unique voie rapide, un carbet sur pilotis qui répare, une ancienne piste d'orpaillage devenue chemin praticable.
- **Clin d'œil culturel** — Le bouillon d'awara, qu'il faut avoir goûté une fois dans sa vie et qui prend deux jours à préparer. Le carnaval qui dure des semaines, mené par les touloulous entièrement masqués qui invitent qui elles veulent. Le jus de maracudja pressé à la buvette, servi avec beaucoup trop de glace.
- **Récompense et flag** — Carte de terrain **« Satellite »** (révèle la carte pendant un tour) ; spécialité **« Vue d'en haut »** — `mes_unites`, `vision +1` (permanent, sans filtre : la plus simple et la plus utile des dix-huit) ; co-commandant Yannick Abraham. Flag : `pays.fr.guyane_base_tenue`.

---

### 4.16 La Réunion — *zone E*

- **Ambiance et paysages** — Une île qui monte tout de suite : du lagon à trois mille mètres en une heure de route. Trois cuvettes profondes entourées de remparts verticaux, accessibles par un sentier chacune. Des cascades en voile, des champs de canne en escalier, et un cratère qui fume dans un désert de roche noire.
- **Mécanique de terrain — Le volcan et les cirques.** *Hook : `modifTerrain`* (secondaire : `finTour`). Le volcan occupe un coin de la carte. **Toutes les 4 journées**, il « s'allume pour le spectacle » : une **coulée avance de 2 cases** le long d'une pente prédéterminée, **annoncée au HUD dès la première journée** — c'est un compte à rebours, jamais un piège. Les cases traversées deviennent **définitivement de la roche neuve** : infranchissables pendant 2 journées, puis terrain nu à **+0 % de défense** et coût de mouvement 1. Une unité rattrapée perd **3 PV** et est repoussée d'une case. Autour, **trois cirques** : des cuvettes fermées par des remparts infranchissables, chacune accessible par **un seul sentier** — trois forteresses naturelles à prendre ou à tenir.
- **Commandant régional** — **Marlène Payet**, traileuse et cheffe de chantier. *Trait :* décide vite, marche encore plus vite, et arrive toujours en haut la première, y compris quand elle est partie la dernière. *Pouvoir — La coulée :* fait avancer la coulée de **3 cases immédiatement**, dans la direction de son choix, hors calendrier.
- **Saisons et météo** — **Hémisphère `sud`** : venir à La Réunion en janvier, c'est venir en plein été austral, donc en **saison des pluies et des cyclones** — la météo `tempete` y est la plus probable de la qualification, avec la Guadeloupe. L'hiver austral (juin à septembre) est sec, frais en altitude, et c'est la belle saison des cirques. La montagne prend même de la neige au-dessus de 2 500 m. **Météo dominante : la pluie, la tempête de janvier à mars.** **Le cumul à voir : coulée annoncée + tempête** — la coulée avance comme prévu pendant que les aériennes sont au sol : il faut évacuer à pied, et c'est la plus belle image du parcours.
- **Carte principale** — 20×18, biome volcanique et tropical d'altitude, terre/mer **78/22**. *Points d'intérêt :* le cratère fumant et son plateau de roche noire, les trois cirques disposés en trèfle, une cascade en voile qui coupe une falaise en deux, un champ de canne en escalier, un lagon au sud-ouest protégé par un récif.
- **Clin d'œil culturel** — Le carry servi avec du riz, des grains et **trois** rougails à choisir, ce qui déclenche une discussion à chaque repas. Le grand raid de montagne dont l'île parle toute l'année, avant comme après. Le maloya joué au bord du terrain quand le volcan s'allume, parce que c'est l'occasion et qu'on ne la laisse pas passer.
- **Récompense et flag** — Carte de terrain **« Coulée »** (crée un mur de roche de 4 cases) ; spécialité **« Pied sûr »** — `mes_unites`, filtre `surTerrain: ['montagne']`, `mouvement +1` (permanent). Le trait `sans_malus_pente` a été **retiré** : il n'entre pas dans la liste fermée `TraitSpecialite` (`03-schemas.md` §1), et le `+1` disait déjà tout ce qu'il disait — un `contenu` a un seul variant, on ne mélange pas un modificateur et un trait ; co-commandante Marlène Payet. Flag : `pays.fr.reunion_cirque_tenu`.

---

### 4.17 Mayotte — *zone E*

- **Ambiance et paysages** — Un lagon immense fermé par un anneau de corail, si vaste qu'il fait presque toute la carte. De l'eau claire jusqu'à l'horizon, des îlots, de la mangrove épaisse, des bancs de sable qui apparaissent et disparaissent, et au large des baleines qui passent en saison.
- **Mécanique de terrain — Le lagon et le récif.** *Hook : `surMouvement`* (secondaire : `finTour`). La carte est **un lagon fermé par une barrière de corail**. Le lagon est de l'**eau peu profonde** : tous les navires y passent, **et l'infanterie le traverse à pied** pour **2 points par case**. La **barrière** est infranchissable sauf par **trois passes** — les seuls points d'entrée depuis l'océan, et donc les seules cases qui comptent vraiment. Hors de la barrière, l'océan est profond : réservé aux gros navires. **Une journée sur trois**, à marée basse, **deux bancs de sable émergent** et relient temporairement des îlots, avant de disparaître à la journée suivante.
- **Commandant régional** — **Anli Soilihi**, patronne du marché aux poissons. *Trait :* accueille tout le monde et ne laisse jamais repartir personne sans un plat, y compris les arbitres. *Pouvoir — Marée basse :* fait émerger **quatre bancs de sable pendant 2 journées** (`journees n = 2`, effet `poser_terrain`, forme **`banc_de_sable`** : `mer` → `plage` — l'une des sept formes, `BRIEF.md`, seconde relecture, point 3), où elle veut, ouvrant des routes terrestres là où l'adversaire comptait sur l'eau.
- **Saisons et météo** — **Hémisphère `sud`**, climat tropical : l'été austral (novembre à avril) est la saison des pluies et des tempêtes, l'hiver austral est sec, doux et c'est la saison où l'on voit les baleines passer au large. Les grandes marées de la mécanique sont plus amples aux équinoxes. **Météo dominante : la pluie chaude, la tempête de janvier à mars.** **Le cumul à voir : bancs de sable émergés + tempête** — une route s'ouvre à pied au moment exact où plus rien ne vole. Anli appelle ça « la journée où tout le monde marche ».
- **Carte principale** — 16×16, biome lagon tropical, mangrove et îlots, terre/mer **35/65** — la carte la plus maritime de la qualification. *Points d'intérêt :* l'îlot central au milieu du lagon (objectif naturel), la passe principale dans la barrière, une mangrove dense sur la côte est, un marché aux poissons sur pilotis qui répare et donne +1 revenu.
- **Sans paquet naval — deux cartes, pas une carte à ratio variable.** Mayotte est la seule région à porter **deux `MapDef` distinctes** (`BRIEF.md`, seconde relecture, point 6 ; `03-schemas.md` §7) :

  | Clé | Ratio | Statut | Ce qu'elle est |
  |---|---|---|---|
  | `carte_fr_mayotte_repli_01` | **60/40** | `en_ligne` | La carte jouée aujourd'hui. Le lagon est ouvert à **toutes** les unités terrestres, pas seulement à l'infanterie (les véhicules y paient 3 points) ; **deux passerelles de bois** relient l'îlot central à la côte ; l'océan hors barrière est une bordure infranchissable pour tout le monde. Les **trois passes** restent les cases décisives — elles ne s'ouvrent simplement sur rien pour l'instant. |
  | `carte_fr_mayotte_01` | **35/65** | `brouillon` jusqu'au paquet naval | La carte de référence, la plus maritime de la qualification. Les passes redeviennent des portes d'entrée depuis l'océan profond, et Mayotte redevient ce qu'elle doit être : la carte où l'on gagne en tenant trois cases d'eau. |

  Ce n'est pas un ajustement, c'est une autre carte : 35/65 et 60/40 ne se jouent pas de la même façon, et une carte certifiée ne doit **jamais** changer de verdict le jour du paquet naval. La routine contrôle en certifie donc **deux**, chacune sous sa propre matrice climatique, et la seconde attend en `brouillon`. **Même règle pour toute région dans ce cas** — les cinq autres régions très maritimes et la Nouvelle-Calédonie (§5) : deux clés, deux certifications, aucune carte à ratio variable. C'est aussi ce qui rend possible le critère de fin de l'étape 11 du plan.
- **Clin d'œil culturel** — Le mataba et les brochettes de poisson du marché, préparés pendant que le match se joue. Les baleines qui passent au large et interrompent la rencontre pendant dix minutes, toutes équipes confondues, sans que personne ne songe à protester. Le débarcadère où l'on attend le bateau en discutant, et qui sert de vrai vestiaire.
- **Récompense et flag** — Carte de terrain **« Banc de sable »** ; spécialité **« Gué »** — *trait* **`franchissement_riviere`** (`03-schemas.md` §1) : les unités à pied et à bottes traversent une case `riviere` au coût de 2, sans pont — les passes du lagon se lisent comme des rivières. Un franchissement autorisé est un trait, jamais un modificateur ; c'est le même trait que le Génie du Grand Est, et c'est voulu : un trait s'implémente **une seule fois** dans le moteur et se déclare autant de fois qu'on veut ; co-commandante Anli Soilihi. Flag : `pays.fr.mayotte_passe_franchie`.

---

### 4.18 Île-de-France — *finale nationale*

- **Ambiance et paysages** — Une ville dense qui ne laisse pas de place, coupée par un fleuve en méandre, ceinturée de grandes forêts, et sous les pieds un réseau souterrain qui relie tout en quelques minutes. Le seul endroit de la qualification où le terrain le plus important est celui qu'on ne voit pas.
- **Mécanique de terrain — Le métro.** *Hook : `surMouvement`.* **Huit stations** réparties sur la carte, reliées par un réseau souterrain. Une unité qui **termine son tour** sur une station peut, au tour suivant, **ressortir à n'importe quelle autre station ouverte** en dépensant **tout son mouvement**. Une station tenue par l'adversaire est **fermée** à ce camp. Une station peut être **fermée pour travaux** en 2 attaques, pour 3 tours. Le point clé : **le réseau est partagé**. Les deux camps l'utilisent, ce qui transforme le contrôle des stations en partie d'échecs parallèle au match. En surface, le tissu urbain dense donne **+25 % de défense** et coûte **2 points par case** aux véhicules.
- **Commandant régional** — **Nadia Belhadj**, conductrice de rame. *Trait :* connaît le réseau par cœur et le dit sans se vanter, ce qui est nettement plus impressionnant que si elle se vantait. *Pouvoir — Correspondance :* **quatre unités amies changent de station instantanément**, sans dépenser de mouvement — le pouvoir le plus brutal en tempo de toute la qualification.
- **Saisons et météo** — La finale se joue à la date réelle, donc la saison est une surprise pour tout le monde sauf le calendrier : l'hiver enneige la couronne de forêts et gèle les bras du fleuve, l'automne dégarnit la forêt royale (le seul endroit où l'on se cache), l'été met la ville en **canicule** — le tissu urbain devient éprouvant pour les unités lourdes, et le métro, souterrain et frais, devient encore plus attractif. **Météo dominante : la pluie fine et le brouillard d'automne.** **Le cumul à voir : réseau du métro + brouillard** — les deux camps se téléportent à l'aveugle dans le même réseau, et la finale se joue au bruit. C'est une bonne dernière image de la qualification.
- **Carte principale** — 22×16, biome urbain dense et couronne de forêts, terre/mer **92/8** (un fleuve en méandre franchissable par de nombreux ponts). *Points d'intérêt :* une tour de fer stylisée (point haut, **vision 8**, la meilleure de la qualification), un arc au bout d'une avenue parfaitement rectiligne qui crée un couloir de tir, une forêt royale au sud pour se cacher, et le stade en couronne où se joue la finale.
- **Clin d'œil culturel** — Le sandwich jambon-beurre acheté à la station avant le match, mangé dans la rame. Le stade qui chante avant le coup d'envoi, debout. La file d'attente devant la buvette, plus longue que la mi-temps, et sur laquelle tout le monde a un avis.
- **Récompense et flag** — **La qualification elle-même** : le joueur devient le représentant de la France au Tournoi Atlas. Carte de terrain **« Métro »** (deux téléportations par match) ; spécialité **« Réseau »** — *trait* **`ravitaillement_ville`** (`03-schemas.md` §1) : une `ville` amie ravitaille et répare **même sans usine**. C'est ce que le réseau francilien fait vraiment — tout est desservi, on refait le plein partout — et cela tient dans la liste fermée des traits, ce que `correspondance` (une téléportation déguisée) ne faisait pas. La téléportation reste où elle doit être : dans la **carte de terrain « Métro »**, deux fois par match, et nulle part ailleurs ; co-commandante Nadia Belhadj. Flags : `pays.fr.ile_de_france_finale_gagnee`, `pays.fr.ile_de_france_reseau_compris`.

---

## 5. Étapes bonus — Nouvelle-Calédonie et Polynésie

Ce sont des **collectivités, pas des régions** : elles ne comptent pas dans les 18 et ne sont jamais obligatoires. Ce sont des étapes bonus, débloquées par la performance et non par la progression, et elles ne rapportent **ni carte de terrain ni spécialité** — uniquement des fonds, un co-commandant et une entrée de carnet. C'est délibéré : le contenu bonus ne doit pas rendre le joueur plus fort que celui qui l'a ignoré.

| Étape | Déblocage | Mécanique | Hook | Carte |
|---|---|---|---|---|
| **Nouvelle-Calédonie** | Gagner les 5 étapes d'outre-mer **sans aucune défaite** | **Le récif et la latérite** — un lagon immense ceinturé du plus long récif du jeu (une seule passe), et une terre rouge de latérite où les véhicules dérapent : **−1 mouvement** hors piste, **+1** sur piste | `surMouvement` | 20×16, terre/mer 45/55 |
| **Polynésie** | Terminer la qualification avec au moins **12 victoires sans perte de QG** | **Les distances du Pacifique** — la plus grande étendue d'eau du jeu, des atolls minuscules très éloignés ; au début de chaque journée, la **navigation aux étoiles** révèle une route optimale de 10 cases entre deux îles, différente à chaque journée | `debutTour` | 24×20, terre/mer **10/90** |

**Sans paquet naval**, ces deux étapes sont les plus contraintes de tout le document et sont donc **livrées après les 18 régions** : la Nouvelle-Calédonie se joue provisoirement à **70/30**, le lagon étant traité comme terrain praticable et la passe unique comme un simple goulet côtier — la latérite, elle, fonctionne sans rien changer. Comme Mayotte (§4.17), l'écart avec sa version maritime en fait **deux `MapDef` distinctes**, pas une carte à ratio variable : deux clés, deux certifications, la maritime en `brouillon`. La Polynésie, à **10/90**, ne se joue pas du tout tant que la mer est infranchissable : sa mécanique de navigation aux étoiles est **intégralement navale**, et il vaut mieux l'attendre que la dénaturer. C'est une étape bonus : le vide vaut mieux qu'une carte fausse.

Les deux commandants bonus sont recrutables au même titre que les autres, dans les mêmes plafonds : **trois co-commandants recrutés, un seul actif par match** (`BRIEF.md`, arbitrage n° 2).

---

## 6. Tableau récapitulatif — les 18 régions

| # | Région | Mécanique | Clé moteur | Hook moteur | Taille de carte | Météo dominante |
|---|---|---|---|---|---|---|
| 1 | Bretagne | Les marées | `meca_marees` | `finTour` | 18×14 | `pluie` (tempête l'hiver) |
| 2 | Normandie | Le bocage | `meca_bocage` | `surMouvement` | 20×14 | `pluie`, `brouillard` au matin |
| 3 | Pays de la Loire | Le circuit | `meca_circuit` | `surMouvement` | 20×14 | `pluie` |
| 4 | Centre-Val de Loire | Les châteaux | `meca_chateaux` | `modifTerrain` | 22×14 | `pluie`, `brouillard` de vallée |
| 5 | Hauts-de-France | La brume et les terrils | `meca_brume_terrils` | `debutTour` | 20×14 | **`brouillard`** |
| 6 | Grand Est | Le fleuve et ses ponts | `meca_fleuve_ponts` | `modifTerrain` | 22×14 | **`neige`** l'hiver, `pluie` sinon |
| 7 | Bourgogne-Franche-Comté | Les coteaux | `meca_coteaux` | `surMouvement` | 20×14 | `brouillard`, `neige` en altitude |
| 8 | Nouvelle-Aquitaine | Les allées | `meca_allees` | `surMouvement` | 24×14 | `canicule` l'été, `tempete` l'hiver |
| 9 | Occitanie | Le canal et les cols | `meca_canal_cols` | `surMouvement` | 24×16 | **`canicule`** l'été |
| 10 | Auvergne-Rhône-Alpes | Les puys | `meca_puys` | `surAttaque` | 22×16 | **`neige`** l'hiver, `brouillard` sinon |
| 11 | Provence-Alpes-Côte d'Azur | Le mistral | `meca_mistral` | `finTour` | 20×16 | `clair`, `canicule` l'été |
| 12 | Corse | Le maquis | `meca_maquis` | `surMouvement` | 16×18 | `clair`, orages de fin d'été |
| 13 | Guadeloupe | L'alizé et le grain | `meca_alize_grain` | `debutTour` | 18×16 | `pluie`, **`tempete`** en saison cyclonique |
| 14 | Martinique | Les mornes | `meca_mornes` | `surMouvement` | 18×14 | `pluie`, `tempete` en saison cyclonique |
| 15 | Guyane | La canopée et le satellite | `meca_canopee_satellite` | `debutTour` | 22×16 | **`pluie`** (saison des pluies longue) |
| 16 | La Réunion | Le volcan et les cirques | `meca_volcan_cirques` | `modifTerrain` | 20×18 | `pluie`, **`tempete`** de janvier à mars |
| 17 | Mayotte | Le lagon et le récif | `meca_lagon_recif` | `surMouvement` | 16×16 | `pluie`, `tempete` de janvier à mars |
| 18 | Île-de-France | Le métro | `meca_metro` | `surMouvement` | 22×16 | `pluie`, `brouillard` l'automne |

**Hémisphères** — Seize régions sont en hémisphère `nord`. **La Réunion et Mayotte sont en `sud`** : elles jouent à contretemps du reste de la qualification, et leur saison des tempêtes tombe quand la métropole est en hiver. C'est le seul endroit du parcours où la date réelle produit deux calendriers opposés dans le même pays.

**Répartition des météos** — `pluie` domine dix régions, `brouillard` deux, `neige` deux, `canicule` deux, `clair` deux, avec des pointes de `tempete` dans les quatre régions tropicales. Aucune région n'a une météo unique : ce sont des dominantes tirées du RNG seedé, annoncées deux journées à l'avance par le commentateur d'Atlas.

Les clés `meca_*` sont celles du registre du moteur : c'est ce que `Region.mecanique.cle` référence (`03-schemas.md` §7) et ce que la routine map reçoit dans son catalogue (`05-routines.md` §3.2).

**Répartition par hook** — `surMouvement` : 8 · `debutTour` : 3 · `modifTerrain` : 3 · `finTour` : 2 · `surAttaque` : 2.

`surMouvement` est volontairement majoritaire : c'est le hook le plus lisible pour un joueur (le coût d'un déplacement se comprend immédiatement) et le moins risqué pour l'équilibrage. Les hooks `surAttaque` et `finTour`, plus difficiles à anticiper, sont réservés à quatre régions et placés tard dans le chemin recommandé.

---

## 7. Le gabarit est générique

Ce document définit un système, pas seulement un contenu. Ce qui est réutilisable tel quel pour tout autre pays phare :

1. **Le découpage en zones librement ordonnables plus une finale imposée.** Le nombre de zones s'adapte au nombre de subdivisions ; la finale est toujours la capitale ou le lieu emblématique du pays.
2. **Les six champs de la fiche région** (§ 3), sans exception ni ajout.
3. **La règle d'un seul hook principal et d'un hook secondaire au maximum** (§ 2.5). C'est la contrainte qui garantit qu'aucune région ne demande de nouveau code moteur.
4. **Les cinq récompenses** (§ 2.4), avec leurs plafonds : **trois cartes de terrain** (celle d'un co-commandant régional comprise, jamais en plus), **cinq spécialités possédées et une seule équipée par match**, **trois co-commandants recrutés et un seul actif par match**.
5. **Le commandant régional recrutable ou vexé**, selon la manière dont le match a été gagné. C'est ce qui relie la qualification nationale au système de flags et aux fins multiples.

**Applications prévues :**

| Pays phare | Découpage proposé | Étapes | Finale |
|---|---|---|---|
| **Japon** | 8 régions regroupant les préfectures | 8 | Kantō |
| **Brésil** | 5 grandes régions | 5 | Sud-Est |
| **Luxembourg** | 3 cantons regroupés en 2 étapes | 2 | La ville haute |

Le Luxembourg est le test le plus utile : si le gabarit tient sur **deux étapes** sans paraître vide, il tient partout.

---

## 8. Ce qui reste à trancher (propositions ouvertes)

1. **Valeurs chiffrées.** Tous les pourcentages, coûts de mouvement et durées de cycle de ce document sont des **valeurs de départ**, écrites pour être lisibles par un joueur. Elles doivent être passées à la simulation headless (routine contrôle, IA contre IA, plusieurs centaines de parties) avant d'être gelées.
2. **Plafonds de récompenses.** Trois cartes de terrain, **cinq spécialités possédées dont une seule équipée par match**, trois co-commandants recrutés dont un seul actif par match : les plafonds sont tranchés (`BRIEF.md`, arbitrage n° 2 et seconde relecture, points 2 et 7), et le risque d'inflation est fermé sur ses deux fuites — la carte du commandant régional **est l'une des trois**, jamais une quatrième (§2.4, `04-gameplay.md` §7.5), et les spécialités ne se cumulent plus. Ce qui reste ouvert est une **valeur**, pas une règle : les trois plafonds seront confirmés par le chiffre que l'étape 7 du plan doit produire (taux de victoire au mondial avec 0, 1 et 3 cartes emportées). On corrige par un plafond, jamais par une règle nouvelle.
3. **Ratios provisoires des cartes maritimes.** Les ratios terre/mer réécrits pour la mer infranchissable (§ 2.7) sont des **valeurs de transition**. Le cas Mayotte est **tranché** : ce sont deux `MapDef` distinctes, `carte_fr_mayotte_repli_01` (60/40, en ligne) et `carte_fr_mayotte_01` (35/65, en brouillon), certifiées séparément — §4.17, `BRIEF.md`, seconde relecture, point 6. Ce qui reste ouvert : appliquer la même découpe aux **cinq autres régions maritimes** et à la Nouvelle-Calédonie, et fixer leurs ratios de repli un par un.
4. **Cartes courtes optionnelles.** Ce document en pose le principe (§ 2.2) mais ne les spécifie pas. Elles peuvent être **entièrement produites par la routine map** à partir de la mécanique régionale, ce qui en fait un bon premier vrai test de cette routine.
5. **Flags de grief.** Les flags `pays.fr.<region>_<nom>` ci-dessus couvrent les victoires. Le grief, lui, est déjà porté par la portée commandant de la bible (`cmd.<id>.grief`, `01-bible.md` §8.5) : il reste à décider si l'on double cela d'un flag de région (`pays.fr.<region>_commandant_vexe`) pour que le générateur de cartes puisse le lire sans passer par l'identifiant du commandant. À arbitrer dans la bible, pas ici.
