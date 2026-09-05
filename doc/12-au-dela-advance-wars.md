# Atlas Tournament — Au-delà d'Advance Wars

> Document 12. **Aucune de ces idées n'est du canon.** Ce document est une réserve de propositions, classées par coût et par ce qu'elles apportent, pour alimenter les arbitrages qui viendront après l'étape 3.
> Chaque idée dit : ce qu'elle apporte, **ce qu'elle demande au moteur** (déjà là, ou pas), et **un risque**.
> Le brief a toujours raison. Une idée qui contredirait `01-bible.md` §5 (le ton), `04-gameplay.md` §7.2 (les interdits de pouvoir) ou les garde-fous de `PLAN.md` est écartée, pas discutée.

---

## 1. D'où l'on part

Advance Wars est un excellent jeu de 2001. Le copier serait déjà un travail honorable ; le dépasser demande de savoir **ce qu'on a déjà et qu'il n'avait pas**. La liste est plus longue qu'on ne croit :

| Ce qu'Atlas Tournament a déjà | Ce que ça ouvre |
|---|---|
| **Climat complet** — quatre saisons par hémisphère, cycle jour/nuit en journées, six météos tirées d'un RNG seedé et **annoncées deux journées à l'avance** | la première ressource stratégique que le joueur peut *anticiper* |
| **Un moteur pur, déterministe, sérialisable** — `(état, action) → état`, `JSON.parse(JSON.stringify(etat))` est l'identité | une partie = une graine + une liste d'actions. Rejeu, envoi, vérification, tout devient gratuit |
| **Une routine de contrôle** qui simule IA contre IA sous plusieurs climats et rend un verdict structuré | on peut **certifier** du contenu produit par n'importe qui, y compris par un joueur |
| **L'homologation** — le catalogue d'unités est vivant, versionné, plafonné à 24 | le jeu change dans le temps sans qu'un rejeu bouge |
| **La Dépêche du jour** — une mission quotidienne, sept jours de vie, puis les archives | un rendez-vous, sans abonnement ni serveur temps réel |
| **Des choix à conséquences** — flags, carnet de voyage, réputation par commandant, quatre fins | une campagne qui se raconte, ce qu'Advance Wars ne fait presque pas |
| **Le tour du monde, 24 départs, 18 régions françaises** | une profondeur de contenu que la structure sait produire |
| **Cinq routines de contenu** | le jeu peut grossir sans que l'équipe grossisse |
| **La 3D avec relief** (depuis le 5 septembre) | ce qui rend le relief **jouable** enfin lisible |

Ce document propose ce qui manque encore, et le classe.

---

## 2. Comment on classe

**Le coût** est estimé en semaines-personne, tout compris (moteur, rendu, contenu, tests, administration) :

- **faible** : moins d'une semaine ;
- **moyen** : une à trois semaines ;
- **élevé** : plus de trois semaines, ou une nouvelle dépendance d'infrastructure.

**Ce que ça apporte** est dit en une phrase, et il y a trois familles : **profondeur** (le jeu devient plus intéressant à jouer), **durée de vie** (on y revient), **accès** (plus de gens peuvent y jouer).

Le multiplicateur caché : une idée qui **réutilise** le déterminisme, les cinq hooks ou la routine contrôle coûte trois fois moins qu'une idée qui demande une brique nouvelle. Les recommandations du §7 en tiennent compte.

---

## 3. Coût faible

### 3.1 Les motifs pour les daltoniens — *accès*

Les camps se distinguent aujourd'hui par la couleur d'équipe. Environ un homme sur douze ne distingue pas le rouge du vert, et deux des palettes de nation les plus évidentes sont précisément rouge et verte. La proposition : **ajouter un motif à la couleur**, pas à la place — bandes obliques, damier, pointillé, uni — appliqué à la même surface que le masque d'équipe, avec un réglage à trois positions (aucun motif, motif discret, motif franc). Le liseré du décalque de surbrillance porte le même motif.

*Moteur* : rien du tout, c'est du rendu pur. En 3D, un canal de plus dans le shader du masque (le motif est une texture répétée modulant l'albédo dans les zones blanches du masque) ; en 2D, une trame de remplissage. *Risque* : un motif franc abîme la direction artistique si on le laisse par défaut — d'où les trois positions, et le défaut « discret ». C'est un risque esthétique, pas technique.

### 3.2 Le mode photo — *durée de vie*

Hors partie (à la fin d'un match, ou depuis un rejeu mis en pause), une caméra libre : tangage et lacet quelconques, champ de vision réglable, profondeur de champ, heure du jour et météo forcées, HUD masquable, cadrage 16/9 ou carré, export PNG. C'est le genre de fonction qu'on croit gadget jusqu'à ce qu'on voie ce qu'elle fait au partage.

*Moteur* : rien. *Rendu* : une entorse assumée à la règle du lacet fixe (`10-rendu-3d.md` §3.2), acceptable **hors partie** et jamais pendant. *Risque* : une caméra libre montre ce que la caméra de jeu cache — le dos non texturé d'un bâtiment, un placeholder d'unité, une jonction de terrain ratée. Le mode photo est donc aussi un révélateur de défauts, ce qui est plutôt une bonne nouvelle mais coûte des retouches d'assets.

### 3.3 La feuille de match — *profondeur*

À la fin d'un match, une page qui dit ce qui s'est passé : fonds gagnés et dépensés, unités produites et perdues, valeur des échanges, journées passées en tête, journée du basculement, meilleure et pire décision au sens du différentiel de valeur. Tout est déjà dans la file d'`EvenementJeu` ; il n'y a rien à mesurer, seulement à lire.

*Moteur* : rien, la file d'événements suffit. *Risque* : dire à un joueur que son meilleur coup était le hasard et son pire coup celui dont il était fier est désagréable. Le ton doit être celui de Vantour — « la journée 7 vous a coûté cher, et vous le saviez » — pas celui d'un tableur.

### 3.4 Le dossier d'adversaire — *profondeur*

Une fiche par commandant rencontré, qui se remplit toute seule : archétype, pouvoir vu, unités préférées, comportement (agressif tôt, économe, joue les hauteurs), et le score des rencontres passées. C'est le carnet de voyage appliqué aux adversaires, et cela rend la deuxième rencontre avec un rival différente de la première **sans changer une règle**.

*Moteur* : rien ; les statistiques se dérivent des rejeux stockés. *Risque* : la fiche ne doit jamais révéler ce que le joueur n'a pas vu (le brouillard s'applique aussi à la mémoire). Sinon c'est de la triche déguisée.

---

## 4. Coût moyen

### 4.1 Les objectifs variés — *profondeur*

Advance Wars a deux objectifs : prendre le QG, ou tout mettre hors jeu. C'est peu pour un tournoi qui prétend avoir des disciplines. Cinq formats proposés, tous exprimables comme des conditions de victoire de scénario :

- **Escorte** — amener une unité désignée d'un bord à l'autre, elle ne peut pas être remplacée ;
- **Relais de l'Atlas d'Or** — un objet porté par une unité, qui change de porteur au contact, à ramener chez soi ; celui qui le porte est visible de tous, même en brouillard ;
- **Tenir N journées** — défendre un point jusqu'à la journée N, l'adversaire ayant l'avantage matériel ;
- **Course** — deux camps, un même objectif neutre, le premier arrivé gagne ; on ne peut pas se toucher (terrains séparés, une seule jonction) ;
- **Points de contrôle** — marquer en tenant des cases à la fin de chaque journée, comme un score qui monte.

*Moteur* : `victoire.ts` évalue déjà des conditions ; il faut les **paramétrer par scénario** au lieu de les câbler, et ajouter la notion d'unité désignée et d'objet porté. Une à deux semaines. La routine map doit apprendre à produire des cartes adaptées à chaque format, et la routine contrôle à les certifier — c'est là qu'est le vrai travail. *Risque* : chaque format nouveau est un format que l'IA doit savoir jouer, faute de quoi le contrôle le certifiera « équilibré » alors qu'il est simplement injouable pour la machine. Il faut une fonction de score par format, pas une seule.

### 4.2 Le draft avant match — *profondeur*

Avant un match, chaque camp choisit **six unités** parmi le catalogue disponible et **en bannit une** chez l'adversaire ; seules les unités draftées sont productibles. Un match cesse d'être « je produis ce qui me plaît » pour devenir une composition, et deux matchs sur la même carte cessent de se ressembler.

*Moteur* : une contrainte de production, donc presque rien — `production.ts` filtre déjà sur `Terrain.produit`, il filtrera sur une liste de scénario en plus. Le travail est dans l'interface (un écran de draft lisible) et dans l'IA (qui doit drafter, ce qui demande une évaluation de la valeur d'une unité *sur cette carte*, avec ce climat). *Risque* : c'est la porte d'entrée du déséquilibre. Une unité dominante en draft l'est bien plus qu'en jeu libre, parce qu'on peut la prendre à tous les coups ; l'homologation devra simuler avec **et** sans draft, ce qui double le coût de certification d'une unité candidate.

### 4.3 Le génie et les ponts destructibles — *profondeur*

Une unité **génie** : mouvement modeste, pas de marquage, capable de poser un `pont` sur une rivière et une `route` sur une plaine, et de réparer un pont rompu. Symétriquement, un pont devient **destructible** : une unité de tir indirect peut le rompre, la case redevient `riviere`, et le génie peut le refaire en deux journées.

C'est peut-être la meilleure idée du document, parce que la carte cesse d'être un décor. Un défenseur qui rompt le pont derrière lui achète trois journées ; un attaquant qui prévoit un génie ne les paie pas.

*Moteur* : **déjà là**. L'effet `poser_terrain` existe, ses formes sont bornées (`pont`, `telepherique`, `cable`, `chenal`, `polder`, `ponton`, `banc_de_sable`) et `TABLE_POSER_TERRAIN` dit quelle case peut devenir quoi (`03-schemas.md`). Il faut : une unité qui porte l'effet comme action (et non comme pouvoir de commandant), l'action inverse, une durée de chantier, et le comptage dans la table de dégâts. *Risque* : le blocage. Un joueur qui rompt tous les ponts et se retranche peut rendre un match interminable ; il faut un plafond de reconstructions, ou une fin aux points qui tranche (elle existe déjà, `04-gameplay.md` §9.1). À vérifier en simulation avant, pas après.

### 4.4 Le commentaire en direct de Célestin Vantour — *durée de vie*

Vantour existe déjà : il ouvre le Bulletin d'avant-match, il annonce la météo, il a un surnom pour le joueur et une faveur qui monte et descend (`monde.regie.faveur`). La proposition : **qu'il commente pendant le match**, en réaction aux événements du moteur.

Le mécanisme est un **catalogue de gabarits de phrases**, indexé par type d'événement et par condition, avec des variables typées : `{unite}`, `{terrain}`, `{camp}`, `{journee}`, `{ecart}`. Un événement « unité mise hors jeu, valeur > 10 000, écart de score qui s'inverse » tire une phrase parmi cinq, en évitant les trois dernières dites. Les gabarits sont écrits par la routine lore, validés par le contrôle, traduits par `atlas_traduction` comme n'importe quelle chaîne.

**Jamais un modèle en direct.** C'est la règle absolue du projet (« aucun appel à un modèle pendant une partie ») et ce n'est pas une contrainte subie : un modèle en direct serait lent, coûteux, non déterministe — donc impossible à rejouer à l'identique — et capable de dire n'importe quoi sur un vrai pays. Des gabarits écrits à l'avance et validés sont plus sûrs, plus rapides et plus drôles, parce qu'on peut les travailler.

*Moteur* : rien ; le commentateur **lit** la file d'événements. Le travail est du contenu (deux à trois cents gabarits pour que ça ne tourne pas en rond) et de l'i18n (chaque gabarit est une chaîne dans neuf langues, avec des pluriels et des accords — le point dur). *Risque* : la répétition. Un commentateur qui redit la même chose au troisième match devient insupportable, et le remède n'est pas technique, il est quantitatif. Second risque : le ton. Vantour peut se moquer d'un commandant, jamais d'un pays (`01-bible.md` §5.1) ; le contrôle doit relire les gabarits comme il relit le lore.

### 4.5 Les rejeux et les défis partageables — *durée de vie*

Le déterminisme rend cela presque gratuit. Une partie **est déjà** `{ scenarioCle, graine, catalogueVersion, actions }` — c'est le format de la sauvegarde locale (`03-schemas.md` §14). Trois usages en découlent :

1. **Le rejeu** : revoir une partie, en avance rapide, avec le commentaire de Vantour (§4.4) qui prend enfin tout son sens.
2. **Le défi « bats mon score »** : un lien qui porte le scénario, la graine et le score de celui qui l'a posé. L'autre joue la **même** carte, le même climat, le même catalogue, et se compare. Aucun serveur de partie n'est nécessaire : un lien et un scénario suffisent.
3. **Le rejeu commenté** : un joueur ajoute des annotations à des journées de son rejeu. C'est le format de tutoriel le moins cher du monde, et il est produit par les joueurs.

*Moteur* : `rejouer()` existe. Il faut : un encodage compact et versionné du couple graine + actions (base64url d'un binaire, pas du JSON brut), la vérification à l'ouverture que le `catalogueVersion` et le `chainesVersion` correspondent — sinon on rejoue avec le catalogue figé, ce qui est précisément prévu —, et une page publique de lecture. *Risque* : le lien pourri. Une action injectée dans un rejeu doit être **refusée par le moteur** (elle le sera : `appliquer` est total et refuse une action illégale), et le score annoncé doit être **recalculé** à l'ouverture, jamais lu dans le lien. Le principe de Flecho s'applique : le serveur ne fait confiance à rien de ce qu'il n'a pas lui-même produit.

### 4.6 Le fantôme du rival — *profondeur*

Dérivé direct du précédent, et étonnamment fort : quand on rejoue une étape déjà gagnée, l'adversaire ne joue pas « comme l'IA », il **rejoue le tracé exact** de la partie précédente, tant que les états divergent peu. C'est le fantôme du contre-la-montre appliqué au tactique. On voit alors, coup pour coup, ce qu'on a fait mieux.

*Moteur* : rien de neuf — un adversaire qui lit une liste d'actions au lieu de la calculer, et bascule sur l'IA dès que l'état s'écarte trop (une divergence se mesure : une action illégale, ou une unité absente). *Risque* : la divergence arrive vite, et un fantôme qui s'évapore à la journée 3 est une promesse trahie. Il faut annoncer honnêtement « le fantôme vous a suivi jusqu'à la journée N ».

### 4.7 L'entraînement ciblé — *profondeur*

La routine contrôle simule des milliers de parties IA contre IA pour certifier les cartes. Ces parties contiennent, gratuitement, des **positions intéressantes** : un état où un seul coup gagne, un état où une erreur coûte 6 000 fonds. Il suffit de les repérer (une recherche à un coup sur l'état, avec un écart de valeur au-dessus d'un seuil) et de les servir comme puzzles : « au trait, une action pour renverser la journée ».

*Moteur* : rien ; c'est de l'analyse hors ligne sur des états déjà produits. *Risque* : un puzzle avec deux solutions n'en est pas un ; il faut vérifier l'unicité, ce qui coûte une recherche exhaustive sur les actions légales — faisable, mais c'est ce qui fait passer l'idée de « faible » à « moyen ».

### 4.8 Le classement mondial des nations — *durée de vie*

Chaque partie terminée remonte un résultat anonyme : nation jouée, nation adverse, format, issue, durée. Le serveur agrège et publie un **tableau de la Ronde** : quelle nation gagne le plus, quelle nation résiste le mieux à quelle autre, quel commandant est le plus joué. C'est le classement d'un tournoi mondial dans un jeu qui parle d'un tournoi mondial : la fiction et la métrique disent la même chose.

*Moteur* : rien. *Serveur* : une table, un endpoint, une page — et surtout une **agrégation** (jamais les parties individuelles). *Risque* : c'est une donnée personnelle si on n'y prend pas garde, et c'est un aimant à triche si le classement compte. La réponse : agrégation seule, aucun identifiant, aucun classement de joueur — on classe les **nations**, pas les gens. Cela retire l'intérêt de tricher et la moitié du risque juridique d'un coup.

---

## 5. Coût élevé

### 5.1 Le relief jouable — *profondeur*

**Trois ou quatre niveaux d'altitude par case (0 à 3), avec des conséquences de règle** :

- **Ligne de vue** : une case de niveau supérieur voit par-dessus une case de niveau inférieur ; un relief plus haut coupe la vue. Le brouillard cesse d'être une question de distance et devient une question de position.
- **Portée depuis les hauteurs** : une unité `tir_indirect` gagne **+1** de portée maximale par niveau au-dessus de sa cible (plafonné à +1, sinon les roquettes deviennent ingérables) **[proposition]**.
- **Coût de montée** : monter d'un niveau coûte +1 de mouvement, descendre est gratuit. La montagne devient chère à prendre et payante à tenir.
- **Défense** : un défenseur plus haut que son attaquant gagne un cran de défense.

C'est l'idée la plus profonde du document, et c'est celle que la 3D rend enfin lisible : en 2D, un niveau d'altitude se dessine par une teinte et se lit mal ; en 3D, on le **voit**.

*Moteur* : c'est le chantier. `mouvement.ts` (Dijkstra avec un coût dépendant du dénivelé), `brouillard.ts` (ligne de vue au lieu d'une distance — un algorithme de visibilité, avec toutes ses questions de symétrie), `combat.ts` (le cran de défense), `MapDef` (un plan d'altitudes en plus du plan de terrains), `mapgen/` (produire des reliefs jouables et non des labyrinthes), l'IA (une carte d'influence qui tient compte de la hauteur), et la routine contrôle (certifier qu'aucune position n'est imprenable). Trois à cinq semaines, et c'est optimiste. *Risque* : la ligne de vue est le piège classique du genre. Si `A` voit `B` mais que `B` ne voit pas `A`, le joueur crie à l'injustice ; si on force la symétrie, on perd l'intérêt des hauteurs. Il faut trancher tôt (symétrique **[proposition]** : plus lisible, moins réaliste, et la lisibilité gagne dans ce projet), et il faut que le rendu **montre** la ligne de vue, sinon la règle est invisible donc injuste — ce que la charte du climat interdit déjà (`04-gameplay.md` §12).

### 5.2 Le multijoueur asynchrone — *durée de vie*

Pas de temps réel, pas de serveur de partie, pas de lobby : **un échange d'actions**. Chaque joueur joue son tour hors ligne, envoie sa liste d'actions, l'autre la rejoue et joue le sien. Le serveur ne fait que **transporter et arbitrer** : il rejoue lui-même le tour reçu avec le moteur headless (le même code, exactement) et refuse ce qui ne s'applique pas.

Le déterminisme rend le tout possible : la partie n'est jamais transmise, seulement les actions ; l'état est recalculé de part et d'autre et doit être identique au bit près. Le brouillard demande une précaution : le serveur envoie l'état **filtré par camp** (`brouillard.ts` sait déjà le faire), sinon un client curieux voit tout.

*Moteur* : **déjà là**, c'est l'usage pour lequel il a été écrit. *Serveur* : des tables de parties, des notifications, une reprise après abandon, un délai de forfait. *Risque* : le rythme. Un match de 40 journées à un tour par jour dure trois semaines, et la plupart des parties seront abandonnées à la journée 6. La réponse n'est pas technique : ce sont des **formats courts** (les objectifs du §4.1, 10 à 15 journées) et une horloge généreuse mais réelle. Second risque : la triche par manipulation du client. Elle est contrée par le rejeu côté serveur, à condition que ce soit une **règle** et pas une option — le serveur recalcule toujours.

### 5.3 L'éditeur de cartes avec certification — *durée de vie*

Un éditeur dans le navigateur : poser des terrains, des bâtiments, des unités de départ, choisir un biome, un climat, une mécanique régionale. Puis — et c'est là que le projet a une longueur d'avance sur à peu près tout le genre — **la carte passe par la routine contrôle** : vérifications structurelles (QG accessibles, pas de zone morte, symétrie de valeur), simulation IA contre IA sous plusieurs saisons et météos, verdict structuré. Une carte certifiée est publiable ; une carte rejetée revient avec ses motifs, en clair.

C'est le seul moyen honnête de publier des cartes de joueurs : pas de vote, pas de modération à la main, une **certification mécanique** qui dit « cette carte se joue » et laisse le goût aux joueurs.

*Moteur* : rien. *mapgen* : les vérifications existent, il faut les exposer. *Serveur* : stockage, statuts (`brouillon → en_controle → valide → en_ligne`, déjà définis), file de certification, quotas par compte. *Rendu* : un éditeur est une interface entière, et c'est là qu'est le coût. *Risque* : le contenu inapproprié. Une carte est une grille, elle ne peut pas dire grand-chose — mais un **titre** et une **description** le peuvent, et deux cases bien placées peuvent dessiner un symbole. Il faut donc modérer les textes (liste noire + relecture par échantillon) et accepter que la modération graphique soit imparfaite. Second risque : les quotas. Sans plafond par compte, la file de certification devient un déni de service à l'échelle du CPU.

### 5.4 Le mode spectateur et la Ligue de la Dépêche — *durée de vie*

Combinaison des §4.5 et §4.8 : les meilleurs rejeux de la Dépêche du jour sont publiés, rejouables avec le commentaire de Vantour, et un classement hebdomadaire distingue les meilleurs scores sur la mission du jour. Le rendez-vous quotidien devient un rendez-vous **partagé**, sans jamais faire jouer deux personnes en même temps.

*Moteur* : rien. *Serveur* : le classement du §4.8, plus un stockage de rejeux et une sélection (les cinq meilleurs scores, plus trois rejeux au hasard parmi les parties gagnées — pour ne pas ne montrer que des experts). *Risque* : la Dépêche est déjà le maillon le plus tendu du projet (une échéance quotidienne, une validation humaine, la règle « le vide vaut mieux qu'une erreur »). Y accrocher un classement, c'est y accrocher une attente : un jour sans Dépêche devient un jour où le classement s'arrête. À ne faire qu'une fois la Dépêche stable pendant un mois.

### 5.5 Le banc de touche — *profondeur*

La bible le dit déjà, et personne ne l'a encore joué : « une unité hors jeu revient au match suivant ». Et si c'était vrai **mécaniquement** ? Le joueur garde un effectif entre les étapes d'une qualification : les unités survivantes reviennent avec leur expérience, les unités mises hors jeu reviennent au match d'après mais **fatiguées** (une journée d'indisponibilité), et le budget d'une étape sert à compléter, pas à tout racheter.

Cela transformerait le tour de France de dix-huit matchs indépendants en **une saison**. C'est aussi ce qui rend une victoire coûteuse différente d'une victoire propre, ce que le jeu raconte déjà dans son lore sans le simuler.

*Moteur* : un état de campagne persistant entre matchs, une notion de vétérance des unités, et un budget d'étape. Ce n'est pas énorme en soi ; le coût est en **équilibrage**, parce que l'effectif conservé se cumule d'étape en étape et qu'une avance devient exponentielle. *Risque* : la spirale. Un joueur qui perd une étape perd des unités, donc perd la suivante plus facilement. Il faut un plancher (un effectif minimal garanti) et probablement un plafond (on ne conserve que N unités), ce qui est exactement le genre de règle qui s'ajuste par simulation — et la routine contrôle sait faire ça.

---

## 6. Tableau récapitulatif

| # | Idée | Coût | Apporte | Moteur | Risque principal |
|---|---|---|---|---|---|
| 3.1 | Motifs pour les daltoniens | faible | accès | rien | esthétique |
| 3.2 | Mode photo | faible | durée de vie | rien | révèle les défauts d'assets |
| 3.3 | Feuille de match | faible | profondeur | rien | ton |
| 3.4 | Dossier d'adversaire | faible | profondeur | rien | révéler ce qu'on n'a pas vu |
| 4.1 | Objectifs variés | moyen | profondeur | victoire paramétrée | l'IA doit savoir jouer chaque format |
| 4.2 | Draft avant match | moyen | profondeur | filtre de production | déséquilibre amplifié |
| 4.3 | Génie, ponts destructibles | moyen | profondeur | `poser_terrain` **déjà là** | blocage de partie |
| 4.4 | Commentaire de Vantour | moyen | durée de vie | rien (lit les événements) | répétition, ton |
| 4.5 | Rejeux et défis partageables | moyen | durée de vie | `rejouer()` **déjà là** | lien falsifié |
| 4.6 | Fantôme du rival | moyen | profondeur | adversaire scripté | divergence rapide |
| 4.7 | Entraînement ciblé | moyen | profondeur | rien (hors ligne) | unicité de la solution |
| 4.8 | Classement mondial des nations | moyen | durée de vie | rien | données personnelles, triche |
| 5.1 | Relief jouable | élevé | profondeur | mouvement, vision, combat, mapgen, IA | ligne de vue asymétrique |
| 5.2 | Multijoueur asynchrone | élevé | durée de vie | **déjà là** ; le coût est serveur | abandon, rythme |
| 5.3 | Éditeur de cartes certifié | élevé | durée de vie | mapgen à exposer | modération des textes, quotas |
| 5.4 | Spectateur, Ligue de la Dépêche | élevé | durée de vie | rien | fragilise la Dépêche |
| 5.5 | Banc de touche | élevé | profondeur | état de campagne | spirale de défaite |

---

## 7. Recommandation : les trois à faire en premier

### Premier — **les rejeux et les défis partageables** (§4.5)

Parce que **c'est déjà payé**. Le déterminisme, le format `{graine, actions}`, `rejouer()` et la sauvegarde locale existent et sont testés ; il ne reste qu'un encodage compact, une page de lecture et une vérification côté serveur. Aucune règle nouvelle, aucun équilibrage, aucun risque sur le cœur du jeu.

Et parce que c'est **la fondation des autres** : le fantôme du rival (§4.6), le mode spectateur (§5.4), l'entraînement ciblé (§4.7) et une bonne moitié de la valeur du commentaire de Vantour (§4.4) reposent tous dessus. Le multijoueur asynchrone (§5.2) en est la version avec un serveur. Faire les rejeux d'abord, c'est acheter cinq idées au prix d'une.

Enfin, parce que c'est **la première chose du projet qui sorte du navigateur d'un seul joueur**. Un jeu qui produit des liens qu'on a envie d'envoyer se fait connaître ; un jeu qui n'en produit pas attend d'être trouvé.

### Deuxième — **le génie et les ponts destructibles** (§4.3)

Parce que **le moteur l'attend**. `poser_terrain` a été arbitré le 5 septembre, ses formes sont bornées, `TABLE_POSER_TERRAIN` existe, et il n'est aujourd'hui utilisé que par des pouvoirs de commandant — c'est-à-dire deux fois par match, dans les mains d'un seul camp. En donner l'usage à une **unité** en fait un outil tactique permanent pour les deux camps, ce qui est un bien meilleur rendement pour du code déjà écrit.

Parce que c'est la manière la moins chère de rendre la **carte** intéressante. Advance Wars a des cartes fixes ; une carte qu'on modifie en jouant est un genre de profondeur que le relief jouable (§5.1) apporterait aussi, mais pour cinq fois le prix. Le pont rompu derrière soi est une décision, avec un coût, une durée et un contre — c'est la définition d'une bonne règle.

Et parce que le risque est **mesurable avant de coder**. Le blocage de partie se teste en simulation IA contre IA, la routine contrôle est faite pour ça, et si le taux de parties interminables monte, on ajuste un plafond de reconstructions. On sait donc à l'avance comment on saura qu'on s'est trompé.

### Troisième — **les motifs pour les daltoniens** (§3.1)

Parce que c'est le seul point de cette liste où le jeu est aujourd'hui **cassé pour quelqu'un**. Tout le reste rend le jeu meilleur ; celui-ci le rend jouable. Deux nations aux palettes rouge et verte, un daltonien, et la partie est illisible — pas moins agréable : illisible.

Parce que c'est **moins d'une semaine** et que le coût monte avec le temps. Ajouter un motif au masque d'équipe aujourd'hui, avant que les assets ne soient livrés, c'est une ligne dans le shader et une consigne dans `11-assets-spec.md` ; l'ajouter après cinquante modèles livrés, c'est cinquante masques à revoir.

Et parce que c'est cohérent avec ce que le projet dit de lui-même. `PLAN.md` met l'accessibilité à l'étape 12, avec le son et le tactile ; c'est le bon endroit pour le clavier complet et les tailles de texte, mais pas pour ce qui touche à la **direction artistique**. Une contrainte d'accessibilité qui change les assets doit arriver avant les assets. C'est la même leçon que l'i18n : rattraper coûte dix fois le prix d'éviter.

---

## 8. Ce qu'on ne fera pas, et pourquoi

Pour que la réserve serve, il faut aussi qu'elle dise non.

- **Le temps réel, sous toutes ses formes.** Ni tours simultanés, ni horloge d'échecs, ni escarmouche en direct. Le moteur est un `(état, action) → état` déterministe ; le temps réel demanderait une architecture concurrente, et le brief a tranché l'inverse.
- **Un modèle de langage pendant une partie.** Ni commentateur génératif, ni adversaire piloté par un modèle, ni dialogue improvisé. C'est le premier garde-fou permanent du plan.
- **Le hasard non annoncé.** Pas de coup critique, pas de tirage caché, pas de météo surprise. Le climat est annoncé deux journées à l'avance et c'est ce qui le rend jouable ; une autre source d'aléa non annoncée trahirait le contrat.
- **Les micro-transactions et les monnaies.** Le classement porte sur les **nations**, jamais sur les joueurs ; il n'y a rien à acheter, donc rien à truquer.
- **Un pays de plus.** Vingt-quatre départs, dix-huit régions : le contenu n'est pas ce qui manque. Ajouter un pays est le réflexe le moins cher et le moins utile de ce document.
