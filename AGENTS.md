# AGENTS.md — passation

## Laboratoire de missions — 12 septembre 2026

`/admin/cartes` compose des variantes privées avec contraintes, deux modes, branches de conséquences, corrections et rejeux. GET/POST `/api/routines/map/conception` offre le même contrat sans BDD ni publication. `src/content/difficulte.ts` est la résolution partagée ; le chemin app réexporte. Pilote et limites : `doc/refonte/conception-missions.md`. L’IEM renforcée optionnelle peut couvrir toute la carte (camp protégé obligatoire), J6 puis toutes les 6 journées, capture désactivante ; aucun tutoriel modifié.


## Mise à jour — une aventure plus claire (12 septembre 2026)

Les 12 missions du parcours local ont des dialogues et récits plus directs, avec leurs versions augmentées ; leurs règles, choix et récompenses sont conservés. T1 présente Ariane et Tomas sans répétition des morts. Gris à la victoire T6, Ost T8, Consortium/Aube après T10, nom de la Cinquième Manche après Sous les couleurs alliées. T6 annonce l’IEM avant l’action et décrit son effet réel (immobilisation air/mer et arrêt des usines, sans dégâts), puis explique la nuit avant J3.

Les motivations et croyances des 37 personnages sont simplifiées (registre version 5), leurs histoires et secrets restent identiques. Les rappels de choix donnent une cause humaine au bonus sans modifier l’état tactique ni les identifiants du journal. Le plan national est réécrit en 12 arcs distincts, toujours éditoriaux ; les 200 épisodes prévus ne sont pas 200 missions jouables. Les cinq prompts de routine passent en référence 3 avec des règles de clarté hors des verrous ; aucun service externe n’est activé. Voir `doc/refonte/aventure-lisible.md`.

Document de passation pour Codex. Il dit ce qu'est le projet, où sont les choses, ce qui est vrai aujourd'hui et ce qui ne l'est pas. Quand il contredit `BRIEF.md`, c'est `BRIEF.md` qui a raison.

## Mise à jour — caméra libre et rythme de riposte (9 septembre 2026)

La caméra accepte un bearing continu : Alt + glisser orbite à la souris, deux doigts tournés au tactile ; le tangage reste borné 30°–75°. Le picking est testé hors des quarts de tour. La riposte visuelle démarre 80 ms après le premier tir, sans attendre l’impact ; le calcul des dégâts est inchangé. Le premier tutoriel ne fait aucune annonce du brouillard ou de la nuit : découverte au sixième exercice seulement.

## Mise à jour — registre complet et activation de Premier contact (9 septembre 2026)

`/admin/personnages` présente 37 fiches et 34 commandants dotés de deux capacités. `content/commandants-capacites.json` révision 3 est partagé avec le moteur ; `Scenario.commandantsVersion` est facultatif et laisse les anciens scénarios inchangés. Les notes auteur et les jalons familiaux ne sortent pas par l’API de contexte par acte. Voir `doc/refonte/personnages-pouvoirs.md`.

Après demande explicite du propriétaire, les unités et QG de Premier contact sont activés sous `/assets/modeles` avec les données partagées ; l’inventaire suit les alias valides. Le relief conserve sa géométrie et prend les textures des cinq terrains livrés. Les premiers tutoriels sont désormais aussi en **jour permanent** : un booléen brouillard faux n’empêchait pas la nuit de l’activer. Le tutoriel 6 annonce et explique la nuit J3–J4 et le retour du jour J5. Les changements de scénarios augmentent leurs versions. Activation technique ne signifie pas approbation artistique.

## Mise à jour — dix tutoriels jouables (9 septembre 2026)

Le parcours local contient dix entraînements puis les deux matchs officiels existants (12 missions). Les quatre anciens scénarios passent en version 2, sans brouillard ; les six nouveaux `opus1_tutoriel_05` à `10` ont des cartes distinctes, des dialogues et des modes explicites. Le choix du dixième finance une nouvelle qualification ou exhibition ; sa conséquence est figée dans la graine pour préserver les reprises. Les anciennes victoires ne sont pas effacées. `doc/refonte/tutoriels-jouables.md` décrit les adaptations honnêtes du plan éditorial et les vérifications : 24 couples mission/mode gagnés avec rejeux conformes, sans mesure de difficulté humaine. Les 144 missions nationales et 18 finales restent éditoriales.

## Mise à jour — Aube, équipes et atelier de création (9 septembre 2026)

Passe de jouabilité du même jour : guides rôle/achat/limite pour les 28 unités dans les fiches et l’admin, carnet public des cinq styles de commandants, capacités spécialisées Solveig/Wren/Ost sur les scénarios catalogue7. Les anciens profils restent en révision1. Les scénarios Aube sont en version2 ; `Sauvegarde.scenarioVersion` facultatif (ancien=1) empêche une reprise silencieuse sur une mission réécrite. Le mode tactique du HUD masque les accessoires, conserve bâtiments/pavillons et montre camp+rôle sans dévoiler le brouillard ; son état persiste. La cadence normale/rapide×2/instantanée est une préférence indépendante du mode difficile, la réduction système reste prioritaire. L’IA valorise les captures avancées, protège ses indirects et ne leur prête plus déplacement+tir. Le siège autorise aussi la capture des trois QG pour éviter une fin vide ; réserves J34/J38 annoncées, difficile J18 à deux infanteries. Survie normale et victoire QG des deux modes vérifiées en simulation ; la voie de survie difficile n’a pas été démontrée par les pilotes testés. Voir `doc/refonte/ia-rythme.md`, `lisibilite.md`, `roster-commandants.md`.

Complément de livraison : catalogue **7**, 28 unités dont deux drones communs et deux prototypes exclusifs à `atl` ; six essais libres Aube et deux quêtes secondaires débloquées par les décisions. Modes normal/difficile séparés pour les sauvegardes et victoires, décisions partagées dans chaque profil. Le ravitaillement sert désormais aussi un autre camp de la même équipe, sans transfert de propriété ni partage automatique des fonds.

Les effets de combat sont communs aux silhouettes et aux GLB : rafales, missiles avec traînée, tirs en cloche, impacts colorés et poussière claire (`render3d/effets.ts`). `animations.ts` choisit le profil grâce au catalogue fourni par le contexte ; la partition place l’impact après le tir, y compris dans le chemin provisoire de l’atelier. Annulation et animations réduites libèrent les effets. Le banc ajoute « Missile de simulation » et « Tir en cloche ». Les repères de départ sont encore estimés d’après le volume ; le réglage précis des bouches des futurs modèles reste à faire sans changer leurs noms de nœuds. Aucun nouveau GLB ni validation artistique de modèle n’est inclus.

Le propriétaire a confirmé un programme de fusion fictif inspiré d’ITER, un conflit stratégique sérieux sans affrontements sanglants, et **24 nations dont 12 au premier plan, plus une faction inconnue**. Ce roster est distinct des quatre camps simultanés du moteur. `BRIEF.md`, `doc/17-aube.md`, la bible et la narration sont alignés ; les douze étapes de la trame restent une cible éditoriale, pas douze nouvelles missions livrées.

- Moteur **6** : `Scenario.equipes`, `renforts`, `fondsDepartParCamp`, revenus nuls. Vision et victoire communes, contrôle et caisses individuels. L’IA ne termine plus sur un autre camp allié. Renforts déterministes, case libre proche ou report ; J41 avant victoire de survie40. Les anciennes sauvegardes de match sont signalées périmées, la progression locale est conservée.
- Cinq essais `aube_*` dans le jeu libre, trois cartes originales et deux remappages, formats2v1/1v2/2v2/1v3/3v1. Statut brouillon explicitement visible, aucun nouveau GLB. Le siège est jouable en simulation jusqu’à J41 ; son rythme final reste à éprouver humainement.
- Choix locaux dans `src/app/campagne/consequences.ts` : deux embranchements qui donnent des fonds au seul camp0 ou des renforts dans une mission suivante. Journal par profil, décision irréversible par version ; la graine sauvegardée fige les conséquences du départ pour les rejeux. Révision des choix1, biographies2 : ce sont deux versions distinctes.
- `content/personnages.json` contient neuf biographies versionnées. Service filtré `/api/routines/bible/personnages?acte=…`, fichier brut refusé par `/api/canon`. `/admin/personnages` est une vue éditoriale avec révélations.
- Cinq prompts référencev2, découverte `/api/routines/contrat`, PUT des annotations et PATCH borné. Bootstrap destiné à la cible demandée Claude Sonnet5, sans identifiant fournisseur inventé ni activation externe. Pas de migration/seed exécuté.
- Admin : navigation groupée et active, bibliothèque par familles/base+déclinaisons, recherche textuelle et territoriale, filtres/manquants/pagination, liste des fichiers obligatoires et prompt Codex complet. Le banc de réception et le contrôle des lots restent ceux du chantier précédent.

## Mise à jour — l’équipe d’Atlas et les codes de camp (6 septembre 2026)

Une décision de lore, une conséquence dans le schéma. Le nom « la Cinquième Manche » a été rediscuté et **conservé**.

1. **La faction a une équipe sur le terrain.** `01-bible.md` §3.4 décrit désormais **la Sélection Méridienne**, dite « les Gris » : l’équipe d’exhibition et d’essai d’Atlas, financée par le Consortium Méridien, dirigée par Hadran Ost, en gris avec le badge orange du matériel à l’essai. Adversaire anodin de Dépêche à l’acte I, propriétaire du dépôt où l’on retrouve le matériel non homologué à l’acte II, **la faction sur le terrain** à l’acte III. C’est l’équivalent de Black Hole, sans rien rattacher à un pays réel : ce n’est **pas** une `Country`, et les règles dures du §3.4 tiennent. `08-narration-choix.md` §6 et le glossaire français ont le renvoi.
2. **Les codes de camp acceptent trois lettres.** `REGEX_CODE_PAYS` et la portée `pays.` de `REGEX_FLAG` passent de `[a-z]{2}` à `[a-z]{2,3}`. Les 24 nations **gardent** leur code ISO alpha-2 ; les trois lettres sont réservées aux camps sans drapeau, et `atl` est le premier — il sert aussi de code de terrain à Port-Méridien, qui n’en avait pas. Aucun contenu `atl` n’existe encore : ni style, ni commandant, ni scénario.

## Mise à jour — fusion des deux chantiers du 6 septembre (6 septembre 2026)

Deux branches avaient chacune écrit une **fiche d'unité dans le menu de production** sans se voir. `main` portait `src/render/fiche-unite.ts` (pur, testé : dégâts lus dans les deux sens, terrains, météo, avertissement du tir indirect) déplié en ligne dans la liste, plus la fiche sous le curseur et le panneau d'inspection retenu. La branche du tutoriel portait un menu **en deux colonnes** (liste à gauche, fiche à droite, clavier, première unité abordable mise en avant) avec un bilan « bonne contre / faible contre » calculé dans `hud-html.ts`. La fusion garde la **mise en page** de la seconde et le **contenu** de la première : `ficheProduction` pose l'en-tête, la grille de chiffres et les traits, puis `blocFiche(v, cle, false)` — le même bloc que sous le curseur, sans sa ligne de chiffres que la grille dit déjà. `bilanDegats` a disparu, `premiereAbordable` reste. Le conteneur de la colonne s'appelle `.panneau-fiche` : il partageait la classe `.fiche` avec le contenu, et deux jeux de règles CSS se marchaient dessus. Dans `attract.tsx`, c'est la version du tutoriel qui a été prise — cadrage de l'île après le premier `afficher()`, avec la caméra 3D refaite le même jour —, et les textes des traits sont ceux du catalogue 3.

`main` avait aussi reçu, pendant la fusion, « drapeaux, villes entières, fiche façon Advance Wars et décor qui suit la grille ». La fiche façon Advance Wars (`stat()`, glyphes, figurines) est gardée telle quelle. Pour le décor, c'est la version du tutoriel qui reste — elle portait déjà les pavillons sur tout bâtiment, le fanion de capture et la transparence, avec ses prises `drapeau()` et `chantier()` —, et **`majGrille` y a été porté** : arbres, rochers, mâts et paysage sont ressemés et rebâtis à la taille du nouveau semis, les bâtiments au prochain `majProprietaires`. Le banc garde ses gestes `capture`, `capture_en_cours`, `remise_en_service` et `fin_de_tour` au lieu de la capture en deux appuis de `main`.

## Mise à jour — un vrai tutoriel, des bâtiments désaffectés, des drones (6 septembre 2026)

Le propriétaire a joué les quatre entraînements et a dit deux choses : « les cartes sont similaires, c’est moche » et « aller sur des cases pour les allumer, c’est nul ». Les deux étaient vraies — les cartes 1 et 2 étaient identiques au caractère près, 3 et 4 quasiment, tout en plaine vide — et la question qu’il a posée (« demande à trois ados et à un joueur d’Advance Wars de trente-cinq ans ») a une réponse connue : un tutoriel d’Advance Wars apprend à se battre, puis à prendre des villes, puis à recruter, puis à prendre le QG. `doc/15-premiers-matchs.md` décrit les six missions ; ce qu’il faut retenir ici, c’est ce qui a bougé sous le contenu.

1. **Le QG se prend en quarante points**, quatre tours d’infanterie intacte (`seuilCapture`, `src/engine/regles/capture.ts`). `SEUIL_CAPTURE` reste l’unité de compte à 20 ; le QG et un bâtiment désaffecté valent le double. **L’IA ne bouche plus son QG** d’une recrue chaque journée (`RAYON_MENACE_QG`, `src/ai/strategies/ponderee.ts`) : elle ne produit dessus que sans autre producteur libre ou avec un capteur adverse à huit cases. Sans cette règle, `capture_qg` n’avait aucun sens contre l’IA — la case était occupée à chaque tour du joueur. Mesuré : le taux pondérée/agressive sur `relief.json` va de 40/50 à 39/50 ; à rayon 4 il montait à 47/50, ce qui est le signe qu’un QG ouvert se prend.
2. **Les bâtiments désaffectés** (`MapDef.desaffectes` → `EtatPartie.desaffectes`, `doc/04` §6 bis). Le propriétaire demandait des « bâtiments en ruine » ; le mot est **interdit** par la charte du glossaire, comme « détruire », « ennemi » et « conquérir » — rien n’est détruit dans les Jeux Tactiques, seulement hors service. Un bâtiment désaffecté est neutre et ne sert à rien ; le **génie** (l’unité bâtisseuse) le remet en service en deux tours, l’infanterie en quatre. C’est une capture pour le moteur (même suite, même événement), un ordre « Remettre en service » pour le joueur, et une nouvelle silhouette pour le rendu. Il n’existe toujours aucun système de destruction : un bâtiment en service ne redevient jamais désaffecté.
3. **Le moteur passe en version 3** : les sauvegardes du 2 ne sont plus reprises.
4. **Catalogue 3 : drones, brouilleur, station radar** (`doc/04` §10 bis). Le brouillard de guerre existait déjà dans le moteur (§10) mais aucune mission ne l’activait ; le propriétaire le croyait absent. Le catalogue gagne un `drone` (3 000, brouillable), un `drone_filaire` (12 000, ne se brouille pas), un `brouilleur` mobile (5 000, dix cases) et un terrain `radar` (`T`, cinquième bâtiment capturable : vision 5, brouillage à douze cases). Un drone brouillé garde un dixième de sa vision. Une unité homologuée déclare désormais sa **version d’accueil** (`homologation.catalogue`) : `chargerCatalogue(2)` ne voit pas les drones, ce qui garde les rejeux du 2 exacts. Deux traits nouveaux, `drone` et `brouilleur` — la liste « fermée » compte treize traits, et `doc/04` §13.2 les décrit. Les rayons sont ceux demandés (12 et 10) : sur une carte de douze cases, une station couvre tout ; c’est dit dans le document, pas caché. L’exhibition `couleurs_alliees` est la vitrine : brouillard, un drone au joueur, une station et un brouilleur à Ariane.
5. **`npm run verifier:campagne` essaie trois joueurs** — une heuristique d’objectif, l’IA pondérée, l’IA agressive — et retient le premier qui gagne. Un seul joueur simple ne gagnait pas les six missions, et le propre des nouvelles missions est qu’elles demandent de se battre pour un objectif occupé. Ce n’est toujours pas une mesure de difficulté humaine.
6. **Le rendu, par trois agents en parallèle** : capture qui **hisse les couleurs** sur un mât permanent (le bâtiment ne s’aplatit plus quand une unité l’occupe : il devient translucide), **voies continues** par biome et vrais ponts (`textures-voies.ts`, `geometrie.ts` : `pieceDepuisLiaisons` est pure et testée), **paysages par biome** (`paysage.ts`, 54 accessoires, ligne de rivage). `/admin/assets` montre les 681 spécifications (541 → 681 avec le radar et les trois unités) ; aucune n’est livrée, et la page le dit.

7. **Trois suites demandées dans la foulée** : la remise en service verse une **prime** (1 000 fonds, 2 000 pour le génie — `PRIME_REMISE_EN_SERVICE`, l'événement la porte et le HUD l'annonce) ; un **drone mis hors jeu au-dessus d'un bâtiment adverse** émet `production_revelee` avec tout ce que ce camp a produit (`revelerProduction`, `combat.ts` — `mettreHorsJeu` prend désormais le catalogue) ; et le **lancer de rayon interroge les tabliers de pont avant le sol** (`Plateau.ponts`, `caseSous` accepte une liste de cibles), ce qui corrige le clic sous les ponts.

8. **Six demandes d'interface, par cinq agents en parallèle, puis l'atelier par trois** (6 septembre 2026, `doc/15` « Interface et rendu mobile ») : carte de démonstration de l'écran-titre refaite (île, ponts jumeaux, routes ; contrôle 29-31) et plateau SVG de repli qui dessine la vraie carte ; `/reglages` confirme l'effacement avec les chiffres et porte **deux profils** locaux (`src/app/preferences.ts` est la source de vérité des clés : A garde `atlas:qualification:v1` et `atlas:partie:*`, B prend `atlas:p2:*`, le profil actif est `atlas:profil:v1` ; le rendu reçoit une clé de sauvegarde déjà composée) ; **menu de production** en deux colonnes avec fiche (`bilanDegats` pure, `fiche.*`, `trait.*`, `mouvement.*` en i18n) ; **inspection** d'une unité adverse par double-clic ou appui long (`Controleur.inspecter`, `GestesRendu.surInspecter`, déplacements en `danger`, tir en `attaque`) ; unités **ayant joué** ternies, tassées, cadenas sur l'étiquette (`Materiaux.terni()`, restitution à l'identique) ; **caméra** : cadrage portrait sur la largeur et l'action, inertie avec butée, double-tap, zoom continu ×1,25 (`doc/10` §3.3 révisé) ; **`/atelier`** : dock repliable sur PC, feuille à onglets sur mobile, presets par biome, aides des gestes, vue dans l'URL (`encoderVue`/`decoderVue`), gestes brouillage et drone abattu. Le bouton rond « N » en bas à gauche des captures est l'indicateur de développement de Next, pas une boussole du jeu.

**Ce qui reste faux ou fragile** : `decor.ts` et `paysage.ts` lisent toujours la grille capturée au montage (le gel connu) ; les nouvelles unités n’ont qu’une silhouette procédurale et aucune ligne dans `content/degats.json` (elles portent leurs colonnes elles-mêmes, comme le génie) ; l’IA ne sait pas se servir d’un drone ni d’un brouilleur, elle les traite comme des transports.

## Mise à jour — cinq axes et entraînement (5 septembre 2026)

L’état historique ci-dessous doit être lu avec `doc/15-premiers-matchs.md` : six missions sont désormais jouables via `/campagne`, dont quatre tutoriels avant les matchs officiels. Objectifs escorte/relais/survie, génie, dix profils de biomes, styles de l’alliance Luxembourg et HUD adaptatif sont implémentés. Moteur 2, catalogue 2 (compatibilité catalogue 1), générateur 2. Les marées et le raccordement mapgen existaient déjà ; les passages ci-dessous disant le contraire sont obsolètes. La progression est locale au navigateur ; les routines Codex et le parcours Postgres ne sont pas mis en service par cette livraison.

## Mise à jour — grammaire Advance Wars (5 septembre 2026, soir)

Quatre changements d’interface, tous derrière l’interface `Rendu` commune, donc valables en 2D comme en 3D.

1. **Les commandants parlent sur la carte.** `Scenario.scenesDialogue` (`doc/03` §6) déclare des scènes déclenchées par les **événements** du moteur — première attaque, capture, perte, production d’un type d’unité, pouvoir, jalon de relais, journée. Les déclencheurs sont dans `src/render/dialogues.ts` (pur, testé), la boîte de dialogue dans `src/render/dialogue-html.ts` (buste vectoriel, frappe lettre à lettre, letterbox). `dialogueOuverture` se joue désormais **sur la carte une fois cadrée**, plus dans une modale ; la fiche de mission ne porte plus que le titre, l’objectif et le tutoriel. Le tour d’IA **attend** qu’une scène soit refermée. Option `dialogues` de `monterJeu`, **fausse par défaut** : la démo et les tests de fumée ne sont pas concernés.
2. **Vert, j’y vais ; rouge, j’y tire** (`doc/10` §8). Le déplacement passe au vert émeraude, et le rouge devient l’**enveloppe de tir complète** — toutes les cases frappables depuis n’importe quelle arrivée, privées des cases atteignables. L’or reste aux objectifs, le bleu aux chantiers du génie.
3. **Le chemin est une flèche**, coudée, avec pointe et liseré sombre, en 2D comme en 3D où elle épouse le relief.
4. **La prévision de duel** (`doc/04` §5.2 bis) : `prevoirDuel()` rejoue la formule de combat sans tirer d’aléa et sans rien muter ; le HUD montre les deux camps avant confirmation. Conséquence : même face à une cible unique, l’ordre `attaquer` passe par la phase de visée.

Au passage, `tests/schemas/contenu.test.ts` valide enfin `content/scenarios/` — rien ne le faisait —, et `e2e/fumee-3d.spec.ts` ouvre le Bulletin avant d’en lire les prévisions (il était devenu repliable, le test ne le savait pas).

## Mise à jour — drapeaux, villes entières et grille vivante (6 septembre 2026)

Trois retours dans la foulée de la fiche, et un gel qui a fini par mordre.

1. **La fiche parle comme Advance Wars.** Plus de mots là où un signe suffit : une botte, un œil, une cible, une balle pour les quatre statistiques (`iconeOrdre` a gagné cinq glyphes). La table de dégâts est une **rangée de figurines** — les vignettes du HUD, aux couleurs de l’adversaire —, le pourcentage sous chacune, vert quand c’est nous qui frappons, rouge quand c’est nous qui encaissons. Cadre à biseau, titres en rubans coupés en biais. Une seule feuille de règles, deux jeux de variables selon la surface.
2. **Les villes ne s’écrasent plus.** `majProprietaires` ramenait un bâtiment occupé à douze pour cent de sa hauteur pour laisser voir la figurine — une maquette qui ne se lisait plus comme une ville, et signalée comme telle. Le bâtiment devient **translucide** (`OPACITE_OCCUPE`, un clone de matériau par matériau, jamais par bâtiment ni par image ; chaque mesh fusionné garde `userData.matOrigine` pour le rendre ensuite) et cesse de porter ombre, sans quoi sa masse trahit sa transparence. La règle du brouillard tient : une unité cachée ne révèle rien.
3. **Le drapeau.** Le QG portait un mât et un pavillon ; ville, usine et aéroport n’avaient qu’un liseré au ras du sol, et après une capture le joueur cherchait **son drapeau** sans le trouver. Tout bâtiment possédé porte désormais le pavillon de son camp au coin du socle ; un bâtiment neutre n’en a pas, et c’est précisément ce qui le dit neutre. Pendant la capture, un groupe `chantiers` rebâti à chaque mise à jour pose un mât et un **fanion hissé à hauteur des points** (`pointsCapture / SEUIL_CAPTURE`) — la capture se regarde se faire, ce qui n’existait pas. Le geste « Capturer » du banc se joue en **deux temps** pour la montrer : l’unité monte sur la ville avec ses points à mi-chemin, puis l’emporte.
4. **Le décor repart de la grille courante.** Le gel noté plus haut — `construireBatiments` lisant la grille capturée au montage — a fini par mordre : sur le banc, un seul bâtiment sur onze, et l’infanterie montait sur de l’herbe nue. Arbres et rochers avaient le même défaut, avec en plus des maillages instanciés à capacité fixe. `Decor.majGrille(grille)` ressème les arbres et les pierres, **rebâtit** leurs maillages à la taille du nouveau semis, efface la signature des bâtiments pour qu’ils se rebâtissent au prochain `majProprietaires`, et repose le tout. `render3d/index.ts` l’appelle là où il appelait `majRelief` sur changement de terrain ; `majRelief` reste pour les images d’une mutation. Deuxième cause, dans l’atelier : `etatCourant` était mis à jour dans un effet qui court **après** celui du montage, lequel posait donc la scène avec l’état du monde précédent. Les références sont tenues à jour au rendu.

**Reste à surveiller** : `majGrille` recrée trois `InstancedMesh` d’arbres et trois de pierres à chaque changement de terrain, donc à chaque marée. C’est correct et c’est rare, mais sur une carte de soixante cases de côté cela vaudra une mesure.

## Mise à jour — la fiche d’unité (6 septembre 2026)

Le menu de production ne montrait qu’une silhouette, un nom et un prix. Acheter un char sans savoir ce qu’il chasse ni ce qui le chasse, c’est jouer à pile ou face — et tout ce qu’il fallait pour le dire était déjà dans le canon et dans le moteur, simplement affiché nulle part.

`src/render/fiche-unite.ts` (pur, testé) compose une **fiche** : ce qu’elle démolit et ce qui la démolit — la table de dégâts lue dans les deux sens, trois lignes de chaque côté —, les terrains qu’elle traverse au coût minimal, ceux qu’elle ne franchit pas, les météos qui la gênent, sa portée, sa vue, ses munitions, et un avertissement quand elle **tire de loin sans riposter au contact**, qui est la lecture qui change le plus une partie.

**Rien n’y est recopié**, et c’est la seule chose à préserver : les dégâts viennent de `degatsBase`, les coûts de `coutBase` — donc les traits `vol` et `tout_terrain` s’appliquent sans que la fiche les connaisse —, les malus de météo de `surcoutMeteo` et `facteurMouvementMeteo`. Ces deux dernières sont **nouvelles** : la moitié « météo » de `surcoutClimat` a été isolée en fonction pure pour qu’on puisse poser la question à l’avance — « cette unité avance-t-elle mal sous la pluie ? » — sans fabriquer un état de partie. Une règle d’équilibrage qui change au moteur change dans la fiche le jour même.

Dans le menu, un premier appui **déplie** la fiche et l’appel à l’action passe de « Production » à « Produire » ; le second achète. On informe sans coûter un geste à qui sait déjà ce qu’il veut. Au passage, un prix qu’on ne peut pas payer affiche « Fonds insuffisants » au lieu d’un nombre grisé — un bouton qui ne répond pas doit dire pourquoi —, et une unité trop chère reste **consultable** : on veut savoir pour quoi on économise.

**La mise en page de la fiche : titres pleine largeur, valeurs en pastilles.** La première version posait chaque titre en colonne de 106 px à gauche de ses valeurs. Sur un panneau de 390 px, « REDOUTABLE CONTRE » passait sur deux lignes et, dès que les valeurs débordaient, elles retombaient **sous le titre** au lieu de rester alignées — illisible, et signalé comme tel. Un bloc pose désormais son titre sur toute la largeur puis ses valeurs en pastilles, qui reviennent à la ligne sans rien casser ; les deux listes de terrain sont côte à côte parce qu’elles sont courtes ; et le chiffre d’un duel prend la couleur de ce qu’il signifie — vert quand c’est nous qui frappons, rouge quand c’est nous qui encaissons. Une seule feuille de règles de mise en page, deux jeux de variables de couleur selon la surface.

**Le panneau d’inspection ne suit plus le seul curseur.** Il l’ignorait complètement, ce qui rendait la fiche presque inatteignable : le bouton vit dans le panneau, en bas à gauche, donc pour l’atteindre la souris quitte l’unité et traverse des cases vides — et le bouton disparaissait avant qu’on l’ait touché. Trois sources, dans cet ordre : **l’unité sous le curseur** (inspecter l’adversaire qu’on s’apprête à frapper doit rester possible), puis **l’unité sélectionnée** (cliquer une unité doit afficher son détail, et c’est le seul chemin au doigt, où le survol n’existe pas), puis **la dernière montrée**, tant qu’on lit sa fiche, que le pointeur est sur un panneau du HUD, ou pendant un **sursis de 1,5 s** — le temps du trajet. Hors de ces cas le panneau suit le curseur comme avant : une case vide doit pouvoir montrer son terrain et sa défense.

Deux pièges rencontrés en chemin, à ne pas réintroduire. L’écoute du pointeur est posée sur le **conteneur**, pas sur la racine du HUD : celle-ci couvre tout l’écran, son `pointerleave` ne part jamais et le drapeau resterait vrai pour toujours. Et le HUD **remplace tout son DOM** à chaque rafraîchissement, ce qui rend `boundingBox()` de Playwright inutilisable sur ses boutons — un pilotage doit mesurer et cliquer depuis la page.

**La même fiche est sous le curseur.** Le panneau d’inspection porte un bouton qui la déplie ; `blocFiche` est partagé entre les deux endroits, parce que ce sont les mêmes questions et qu’il serait absurde qu’elles reçoivent deux réponses. Seules les couleurs changent, par le CSS : papier dans la modale de production, encre sous le curseur. Deux différences de comportement, et elles sont voulues. Le bouton **n’apparaît que sur une unité** — un terrain n’a pas de fiche, et une case vide ne doit pas offrir une commande qui ne ferait rien. Et la fiche **reste ouverte quand on change de case** : c’est une façon de jouer, pas un choix par unité. Qui apprend la laisse dépliée, qui connaît la referme une fois.

## Mise à jour — l’accueil ne clignote plus, et les documents sont alignés (6 septembre 2026)

Trois choses, dont deux visibles.

1. **Le fond de l’écran-titre ne change plus de nature en cours de route.** `vitrine.tsx` montrait le plateau SVG, puis l’attract mode par-dessus, en fondu. Un dessin à plat qui cède la place à un plateau en relief, ce sont deux jeux en une seconde et demie. Le choix se fait désormais **avant le premier pixel de fond** : animation réduite, réglage du joueur, WebGL 2 — les trois questions se posent au montage, et l’un **ou** l’autre s’affiche, jamais les deux. L’écran-titre reste lisible pendant ce temps, puisque le titre et le menu viennent du serveur.
2. **L’attract ne cadre plus lui-même.** Il appelait `recentrer` puis trois ou quatre crans de `zoomer(-1)` — des paliers réglés pour la caméra 2D, qui n’avait pas les mêmes. Or `creerRendu3d` appelle déjà `vue3d.cadrerCarte()` au montage, qui prend la **distance exacte** faisant tenir la carte. D’où le va-et-vient d’échelle. Le cadrage est rendu à la peau, et la caméra ne bouge plus **du tout** pendant l’exhibition : elle suivait chaque unité, ce qui donne le mal de mer sur une page qu’on ne fait que regarder.
3. **`next.config.ts` accepte `NEXT_DIST_DIR`.** `next build` et `next dev` écrivent tous les deux dans `.next` et se marchent dessus : construire pendant qu’un serveur de développement tourne le fait échouer, et oblige à couper le serveur qu’on est en train d’utiliser. `NEXT_DIST_DIR=.next-build npm run build` construit à côté. La valeur par défaut reste `.next` ; le `Dockerfile` et la production ne changent pas. `.next-build` est ignoré par git **et par eslint** — sans quoi le lint inspecte le bundle et rend dix mille avertissements.

**Les documents de conception ont été repris** dans la foulée, et le retard était de deux générations, pas d’une : `02-architecture.md` §2 justifiait encore le choix du Canvas 2D contre PixiJS, et §3.4 décrivait un dossier `render/` avec un cache de sprites et un `atlas.ts` qui n’existaient plus depuis le passage à la 3D. Même chose pour `09-i18n.md` §7.2 et §7.3, qui mesuraient les textes du HUD au `measureText`. Corrigés, avec la mention datée de ce qui a changé plutôt qu’une réécriture qui effacerait l’histoire : `BRIEF.md`, `PLAN.md`, `README.md`, `doc/README.md`, `00-vision`, `02-architecture`, `03-schemas`, `04-gameplay`, `05-routines`, `09-i18n`, `10-rendu-3d`.

## Mise à jour — une seule peau, et un banc d’essai (5 septembre 2026, nuit)

**Le rendu 2D vectoriel est supprimé.** `BRIEF.md` a été modifié en conséquence : le repli qu’il promettait n’existe plus, et un appareil sans WebGL 2 voit un écran qui le dit. Ont disparu : `rendu2d.ts`, `scene.ts`, `camera.ts`, `hidpi.ts`, `hud.ts` (le HUD dessiné au canvas), quatre des six fichiers de `sprites/`, deux fichiers de tests et `e2e/fumee.spec.ts`. Trois choses en sont sorties plutôt que d’être perdues :

- `src/render/surbrillance.ts` — le **vocabulaire** des cinq genres (`deplacement`, `attaque`, `capture`, `production`, `danger`). Le contrôleur, les objectifs et la peau 3D en avaient besoin, mais aucun d’eux n’a à savoir comment on les peint.
- `src/render/libelles.ts` — les noms d’unités, de terrains, de commandants, de saisons et de météos. C’est tout ce que le HUD HTML utilisait de l’ancien HUD canvas.
- `src/render/sprites/` — réduit à `formes.ts` et `silhouettes.ts`, gardés pour la **vignette d’unité** du HUD. Ce n’est plus du rendu de carte, c’est de l’iconographie d’interface.

L’interface `Rendu` **subsiste** : c’est elle qui empêche `render/` d’importer `render3d/` (`02-architecture.md` §5). `monterJeu` ne choisit plus, il exige une `fabriqueRendu` et **lève** si elle manque ou refuse de se monter. `?rendu=`, `choisirRendu`, `preferenceDe`, `PreferenceRendu` et le réglage « Affichage » ont disparu avec elle ; `CleRendu` ne vaut plus que `'3d'`. L’attract mode de l’accueil passe en 3D et ne se monte pas sans WebGL 2 — **il télécharge 384 ko de JS au lieu de 230**, à surveiller.

**L’atelier est devenu un banc d’essai** (`src/app/atelier/banc.ts`, pur et testé). Il montrait trois cartes de mission en 3D, sans surbrillances ni animations : les défauts qu’on y cherche étaient précisément ceux qu’il ne pouvait pas montrer. Il porte désormais une **carte-catalogue** — les douze terrains côte à côte, les quatre bâtiments pris par chaque camp et neutres, les onze unités dans les deux camps, et les cas qui ont réellement cassé (un bâtiment encastré entre deux montagnes, une plage entre mer et plaine) —, les cinq surbrillances, la flèche, le brouillard, le pays de chaque camp parmi les vingt-quatre, six gestes rejouables (déplacer, tirer, capturer, mettre hors jeu, marée haute et basse) et un bouton qui fait apparaître les silhouettes **`coque`, `ailes` et `rail`**, écrites dans `pieces.ts` depuis le début et jamais vues à l’écran.

Le banc a trouvé deux défauts dans l’heure qui a suivi, et c’est son intérêt :

1. **`majTerrain` débordait sur un changement de taille de carte.** `(splat.image.data).set(donnees)` levait un `RangeError` qui blanchissait la page dès qu’on passait d’une carte 16×12 à une 20×12. Le commentaire disait « les dimensions ne changent jamais en cours de partie » — c’est vrai d’une partie, faux d’un plateau qui survit à un changement de carte. La texture est maintenant **remplacée** quand la taille change, au lieu d’être remplie.
2. **Le banc perdait le génie en silence.** Le scénario de démonstration est en **catalogue 1**, qui ne compte que dix unités. Le banc force désormais le catalogue 2, et un test échoue si la version choisie ne porte pas toutes les unités qu’il pose.

**Reste à faire, trouvé au passage** : `construireBatiments` (`render3d/decor.ts`) lit la grille **capturée au montage**, pas celle de l’état courant. Une marée qui noierait une ville laisserait la ville flotter. C’est la même faute que le terrain gelé au premier jour, au même endroit du raisonnement — toute donnée dérivée de la grille et calculée au montage est un gel en puissance.

## Mise à jour — l’écran-titre et les réglages (5 septembre 2026, nuit)

`src/app/page.tsx` n’est plus une page de présentation : c’est un **écran-titre de jeu, pensé en portrait d’abord**. La version précédente mesurée sur 390 px plaçait son seul bouton à 711 px du haut et le plateau — la seule chose qui montre le jeu — à 805 px : deux écrans plus bas. Quatre décisions le tiennent, et elles valent pour la suite du site.

1. **Le jeu est le fond, en plein cadre.** L’attract mode (`attract.tsx`) et son repli SVG (`plateau-accueil.tsx`) passent en `position:fixed;inset:0` derrière tout, cadrés en `slice` pour que le fondu entre les deux ne fasse pas sauter l’échelle. Le cadre de la vitrine disparaît au profit d’une **nappe en dégradé** plus d’une vignette : on n’encadre pas une capture de son propre jeu sur son écran-titre. L’attract est désaturé (`saturate(.86) brightness(.82)`) pour que le vert et le rouge du jeu ne disputent pas au signal le rôle de « couleur qui appelle ». Le coût reste cantonné : l’accueil pèse **2,57 ko / 109 ko**, l’attract n’entre jamais dans le rendu initial.
2. **Quatre boutons, ancrés en bas** — Campagne, Jeu libre, Atelier des mondes, Réglages. Au-delà de 560 px du bord inférieur, un pouce n’atteint plus rien : le titre y va, le menu jamais. Mesuré, le bouton Campagne est à 281 px du bas en 844 comme en 667. L’ancrage se fait par `margin-top:auto`, **jamais `position:fixed`** — la rétraction de la barre d’adresse iOS fait sauter un élément fixe. Cinq registres distinguent les boutons et aucun n’est le texte : peinture, hauteur, biseau, ombre, glyphe.
3. **Campagne porte l’état, et le geste unique survit.** Le bouton mène droit à la prochaine épreuve non remportée et affiche sur lui-même la jauge de six segments et le titre de l’épreuve ; la carte de progression entière est absorbée dedans. Une seconde cible, « Carnet », mène au choix libre — sans elle, rejouer une mission depuis l’accueil devient impossible. Le serveur rend l’état neutre (jauge vide, aucun chiffre, destination `/campagne`, vraie dans tous les cas), le client l’enrichit : afficher « 0 sur 6 » deux cents millisecondes à quelqu’un qui a tout gagné serait une affirmation fausse.
4. **Un écran, pas de défilement** — vérifié à 390 × 844, 375 × 667 et 1280 × 800. Ce qui ne tenait pas a été **supprimé**, pas repoussé : le bandeau de marque, le pitch de 190 caractères, les trois liens soulignés, le pied et la frise des vingt-quatre nations. Mais `overflow:hidden` a disparu de `.atlas-accueil`, et `100dvh` est devenu `100svh` : la page ne défile pas parce qu’elle ne dépasse pas, jamais parce qu’on le lui interdit — à 200 % de zoom texte, l’interdit coupait le bas sans recours.

**`/reglages` existe** (`src/app/reglages/`, plus `src/app/preferences.ts`), et ne porte que les réglages qui existent réellement dans le code : les dialogues des commandants et la réduction des animations. Il portait aussi le choix de la peau ; celui-ci a disparu avec le rendu 2D, quelques heures plus tard. Pas d’interrupteur inerte : il n’y a pas d’audio dans le jeu, il n’y a donc pas de réglage de son. Le réglage système reste **maître** sur les animations — l’interrupteur ne peut qu’ajouter la réduction. « Effacer ma progression » emporte `atlas:qualification:v1` **et** tous les `atlas:partie:*` — n’effacer que le premier laisserait des parties fantômes reprenant au milieu d’une épreuve qu’on croit n’avoir jamais commencée. `preferences.ts` **recopie** `PREFIXE_SAUVEGARDE` plutôt que d’importer `render/jeu.ts`, qui ferait entrer le moteur et le rendu dans la page ; `tests/campagne/preferences.test.ts` échoue si les deux divergent, et c’est ce qui rend la copie acceptable — la page pèse 1,2 ko.

L’attract mode a été repris au passage : cadrage serré au lieu de la carte entière, rythme accéléré (330 ms d’intention, 190 ms entre deux actions), caméra qui **suit l’action** par `cadrer()` — qui ne recentre que si la case sort du champ —, et une graine tirée parmi cinq à chaque visite. Chaque partie reste déterministe, c’est le moteur ; mais un écran-titre qui repasse le même match coup pour coup se remarque dès la deuxième ouverture.


## Mise à jour — le terrain qui bouge (5 septembre 2026, nuit)

Les deux rendus **gelaient le terrain au premier jour**. En 3D, la grille était capturée dans une fermeture au montage de `batir()` ; en 2D, la couche de fond était mise en cache sous une clé qui ignorait la journée. Or une mécanique régionale — les marées — **réinterprète** la grille sans jamais l’écrire (`modifTerrain` est une lecture) : la marée changeait dans le moteur et jamais à l’écran. Le génie, qui pose et retire du terrain, souffrait du même gel.

Trois corrections, et une leçon.

1. `Plateau.majTerrain(grille)` remet en place altitudes, splat et routes **sans reconstruire** le plateau : rebâtir coûterait la repeinture des cinq jeux de matières et un recadrage de caméra à chaque journée.
2. La clé du cache 2D et le témoin 3D utilisent `signatureTerrain` — la fonction **du moteur** (`src/engine/hooks.ts`), qui porte déjà journée, climat, terrains posés et état de la mécanique. Une signature réinventée côté rendu serait forcément plus pauvre.
3. **Ce qui repose sur le sol doit se reposer avec lui.** Les unités relisent l’altitude à chaque `maj`, mais le décor était posé une fois pour toutes : `Decor.majRelief()` replace arbres et rochers après une mutation. Les unités s’**orientent** en plus sur la pente (bornée à 13°, suivie à 55 % — suivre le relief au degré près fait culbuter un char sur une berge) et ne descendent jamais sous le plan d’eau : une pièce reprise par la marée patauge, elle ne se noie pas.

4. **Le centre de chaque case est enfin plat.** `10-rendu-3d.md` §4.2 l’exige depuis le début — « sinon une unité posée sur une pente penche et le décalque de surbrillance se déforme » — mais `hauteurEn` était une interpolation bilinéaire pure : la pente traversait le centre de la case. Une maison posée sur une montagne s’enfonçait d’un côté et flottait de l’autre. Une rampe plate sur ±0,28 case reporte le dénivelé **sur la jonction** entre cases ; le plateau y gagne des gradins de jeu plutôt qu’une dune. **Fait depuis** : le second garde-fou de la même règle, « les cases de bâtiment sont plates, elles et leur couronne immédiate ». `REPLI_CENTRE` valait 0,28 pour toutes les cases, or le socle d’un bâtiment fait 0,83 de côté et son liseré de camp va jusqu’à ±0,46 : il débordait du disque plat et se faisait couper par le relief voisin — « la maison est dans la montagne ». Une case bâtie a désormais un repli de **0,5**, donc plate d’un bord à l’autre, et `rampeEntre(t, repliA, repliB)` accepte **deux replis différents** : un bâtiment impose son plateau jusqu’à sa propre frontière sans écraser le relief de sa voisine, qui garde toute sa hauteur dès son côté de la jonction. Aplanir la voisine aurait effacé un relief qui coûte du mouvement et donne de la défense, donc menti sur les règles. Le maillage ayant trois subdivisions par case, la marche tient exactement dans un quad.

7. **Les pierres cessent d’être des dés.** C’était un `DodecahedronGeometry` unique, gris uni, tourné sur trois axes au hasard et **relevé** de 0,06 au-dessus du sol : une caillasse de dés flottant chacun sur une facette d’appui. Trois silhouettes désormais — un bloc, des éclats, une dalle —, chacune érodée par un bruit tiré de la **position arrondie** de ses sommets, faute de quoi les facettes se décousent (la géométrie d’un icosaèdre n’est pas indexée). Elles tournent librement autour de la verticale, s’inclinent à peine, **s’enfoncent** au lieu de se poser, portent une teinte par instance, et se sèment en couronne pour laisser le centre de la case à l’unité qui s’y pose. Un appel de dessin par silhouette, et le placement reste dérivé de l’aléa de case.
5. Une mutation de terrain est devenue un **événement** de 1,4 s : fondu du mélange de matières, glissement des altitudes, écume qui enfle puis retombe. Les normales ne sont recalculées qu’à la fin — les rafraîchir à chaque image coûterait plus que tout le reste pour un gain invisible.

6. **Le rendu n’invente plus le trajet d’un déplacement.** L’événement `deplacement` ne portait que `de` et `vers` : la peau 3D reconstruisait un chemin **en L** et la 2D glissait en **ligne droite**. Les deux traversaient montagnes et unités adverses. L’événement porte désormais `chemin`, celui que `verifierChemin` a validé, tronqué à la case d’arrêt en cas d’interruption sous brouillard. `cheminEnL`, `longueurChemin` et `surChemin` ont quitté `render3d/` pour `src/render/chemin.ts` : les deux peaux en avaient besoin, et `render/` n’a pas le droit d’importer `render3d/` (`02-architecture.md` §5).

**La leçon, pour la suite** : toute donnée dérivée de la grille et calculée au montage est un gel en puissance. Le décor, l’éclairage et les surbrillances lisent `plateau.hauteurEn`, qui est désormais une fermeture **vivante** ; ne pas la remplacer par une valeur.

**Le bandeau de tour attend la fin d’une scène.** Un « à vous de jouer » et une réplique de commandant lancés au même instant se disputent la même seconde ; `annoncerTour` efface le tour déjà annoncé quand une scène est ouverte, de sorte que l’annonce se rejoue juste après la dernière réplique. Les deux arrivent, l’un après l’autre.

**L’entrée en mission est directe** (`src/app/jeu/[scenario]/toile.tsx`) : plus de fiche à valider avant de jouer. Le plateau se monte tout de suite, une partie en cours se reprend d’elle-même, et l’ouverture se joue en dialogue sur la carte. L’objectif est affiché en permanence dans le rappel de mission, en haut à gauche ; le tutoriel, le conseil et « nouvelle partie » sont derrière ce rappel.

Seule `src/app/convocation.tsx` est cliente, parce qu’elle lit `localStorage` ; la page lui passe des **libellés déjà traduits**, comme on le fait pour les rendus. Le sens de l’hydratation est à sens unique : le serveur rend l’état neutre, le client l’enrichit — jamais l’inverse, une bascule « reprendre » → « entrer » se lirait comme une progression perdue.

## Le projet en cinq lignes

Atlas Tournament est un tactique au tour par tour dans l'esprit d'Advance Wars, jouable dans un navigateur. Dans ce monde, les guerres ont été remplacées par des Jeux Tactiques : chaque pays a une équipe et un commandant, et un tournoi fait le tour de la planète tous les quatre ans. Le joueur part de France — tout le monde part de France —, traverse ses 18 régions puis le monde, et ses choix décident de la fin qu'il obtient et de l'état des 24 nations : alliée, rivale, retirée. Une nation alliée peut être **incarnée** — jouée entièrement, avec son général et son catalogue, le temps d'un match — et s'ouvre comme départ pour une Nouvelle Ronde. Techniquement : une seule application Next.js 15 en TypeScript strict, un moteur de règles pur et déterministe, un rendu 3D three.js, et cinq routines Codex qui produisent le contenu sous le contrôle d'un serveur qui ne fait confiance à rien. Rien de généré ne passe en ligne sans un verdict mesuré, et souvent sans un humain.

## À lire d'abord, dans cet ordre

1. **`BRIEF.md`** — le canon. Toutes les décisions prises, y compris les arbitrages du 5 septembre 2026.
2. **`PLAN.md`** — les treize étapes (0 à 12), avec un critère de fin écrit pour chacune.
3. **`doc/README.md`** — l'ordre de lecture des quinze documents de conception, et surtout **qui est propriétaire de quoi**.

**La règle de résolution des conflits, sans exception : le brief a raison sur tous les documents ; le document propriétaire d'un sujet a raison sur tous les autres documents.** `doc/README.md` donne le tableau des propriétaires. Exemple concret : si `PLAN.md` et `doc/11-assets-spec.md` ne disent pas le même nombre de spécifications d'assets, c'est `doc/11` qui fait foi, parce qu'il est propriétaire des assets.

Un document ne se lit **jamais** comme les autres : `doc/14-secrets.md`. Il n'est jamais servi à une routine, jamais résumé dans un prompt, jamais copié dans `content/`.

## L'arborescence

```
src/app/          Next.js App Router. La seule couche qui a le droit de tout importer.
                  Pages : `/` (accueil provisoire), `/jeu/[scenario]`, `/admin/*`.
                  API : /api/health, /api/canon, /api/i18n, /api/admin, /api/routines/*.
src/engine/       Le moteur, pur et déterministe : (état, action) → état. Règles, RNG seedé,
                  rejeu, climat, mécaniques régionales par hooks, déblocages. Zéro dépendance.
src/ai/           L'IA de jeu : une fonction d'évaluation et trois stratégies (pondérée,
                  agressive, défensive). C'est elle qui certifie les cartes.
src/mapgen/       Le générateur : ParametresCarte + graine → MapDef, symétrie, vérifications,
                  aperçu texte. Deux appels avec la même graine donnent la même carte.
src/render/       Le socle de rendu, sans une ligne de three.js : interface `Rendu`, boucle
                  paresseuse, entrées, HUD HTML, ambiance, libellés, surbrillances, sauvegarde.
src/render3d/     La peau 3D three.js : scène, terrain, éclairage par saison/phase/météo, unités
                  et décor instanciés, surbrillances, animations, textures.
src/assets/       Le format `AssetSpec`, le catalogue qui le compose depuis le canon, les styles
                  nationaux, et les validateurs (spec et glTF binaire, sans dépendance).
src/content/      Les chargeurs typés du canon JSON.
src/schemas/      Les types partagés et les validateurs écrits à la main, sans dépendance.
src/i18n/         `t()`, l'ordre de repli des langues, et la table des chaînes d'interface source.
src/db/           Drizzle : le schéma, le client, et un fichier de requêtes typées par table.
src/serveur/      La logique serveur testable en Node : auth, cycle de contenu, file de missions,
                  contrôle, simulation, dépêche, traduction, canon, prompts, sonde.

content/          Le canon JSON, servi en lecture seule par /api/canon.
                  unites, terrains, degats, mecaniques, archetypes, flags, gabarits-missions ;
                  pays/ (24), regions/fr/ (18), styles/ (24 + regions/fr/ 18), fils/ (9),
                  cartes/, scenarios/, i18n/ (chaînes et glossaire français).
assets/specs/     681 AssetSpec générées depuis le canon, versionnées.
scripts/          migrate.mjs, simuler.ts, controler-carte.ts, apercu-carte.ts,
                  generer-specs-assets.ts, extraire-chaines.ts.
drizzle/          Les migrations SQL numérotées. Un fichier appliqué ne se modifie jamais.
tests/            tsx --test, un dossier par couche, plus frontieres.test.ts.
e2e/              Deux tests de fumée Playwright (2D et 3D), sur le port 3400.
doc/              Les quinze documents de conception, plus doc/assets/ (démos de rendu).
apercus/          Les PNG de relecture produits par apercu-carte.ts. Ignoré par git.
```

## Les règles d'import

`tests/frontieres.test.ts` les fait respecter mécaniquement : il lit les imports de chaque fichier de `src/` et échoue sur la moindre violation. La table des couches autorisées est **dans le test**, et c'est elle qui fait foi.

- `engine`, `ai`, `mapgen` ne connaissent que `schemas` et `content`. Jamais `render`, jamais `db`, jamais `app`.
- `render` peut importer `engine`, `schemas`, `content`, `i18n`. `render3d` ajoute `render` et `assets` — jamais l'inverse. C'est cette règle, et elle seule, qui justifie que l'interface `Rendu` survive à la disparition de la seconde peau.
- `serveur` peut importer le jeu et `db` ; `app` peut tout importer ; `schemas` n'importe rien.

**Les interdits dans les couches pures** (`engine`, `ai`, `mapgen`, `schemas`, `content`) sont vérifiés par le même test, par simple recherche de motif : `window`, `document`, `fetch(`, `Date.now(`, `Math.random(`. Le moteur ne lit jamais l'horloge — pas même pour évaluer un déblocage : la date lui est **donnée** par l'appelant, et c'est le serveur qui la fixe. Le hasard passe exclusivement par le RNG seedé de `src/engine/rng.ts` et ses flux dérivés. `render/` et `render3d/` ont le droit d'appeler `Date.now()`, et seulement pour cadencer une animation.

## Les conventions

- **Tout est en français** : le code, les commentaires, les noms de fichiers, les identifiants. Un commentaire dit *pourquoi*, pas *quoi*.
- **Les clés sont en minuscules sans accent**, avec des tirets bas : `carte_plaine_symetrique`, `pays.fr.qualifie`, `hud.fin_de_tour`. Les regex qui les valident sont dans `src/schemas/types.ts` et testées par `tests/schemas/regex.test.ts`.
- **Le moteur ne connaît aucune unité par son nom.** Les dix unités sont des données (`content/unites.json`) avec leurs traits et leur `Silhouette` ; une unité homologuée demain doit fonctionner sans une ligne de code moteur.
- **Aucun texte en dur dans le rendu.** Tout libellé passe par une clé et `t()`. Un rendu n'appelle même pas `t()` : on lui donne les rares libellés déjà traduits. `npm run extraire-chaines` reconstruit `content/i18n/` et un test échoue sur tout littéral affichable trouvé hors d'un appel à `t()`.
- **Tout contenu est validé par `src/schemas/valider.ts`**, à l'entrée du serveur comme au chargement du canon. Ces validateurs sont écrits à la main, sans aucune dépendance, et ils sont la seule porte : le serveur recalcule et refuse ce qu'il n'a pas lui-même soumis.
- **Déterminisme** : même graine + mêmes actions = même état, au bit près. C'est ce qui permet à la routine contrôle de certifier une carte, et c'est le premier invariant à ne pas casser.
- **On ne vérifie jamais à l'œil, seulement par du code.** Consigne du propriétaire (6 septembre 2026) : pas de capture d'écran, pas de relecture visuelle d'une page ou d'un rendu pour se convaincre qu'une chose marche. Une vérification passe par un test unitaire (`tests/`, `tsx --test`), un test de fumée écrit (`e2e/`), `npm run typecheck`, `npm run lint` ou `npm run build`. Ce qui ne se vérifie pas par du code se décrit comme non vérifié.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev` | le site en développement, **port 3400** |
| `npm run build` | `next build` — n'exige **aucune** variable d'environnement |
| `npm start` | migrations puis Next (c'est ce que lance le Dockerfile) |
| `npm run typecheck` | `tsc --noEmit`, TypeScript strict |
| `npm run lint` | ESLint |
| `npm test` | les tests `tsx --test`, un dossier par couche |
| `npm run test:e2e` | le spec Playwright 3D, avec ses propres drapeaux SwiftShader |
| `npm run migrate` | applique `drizzle/*.sql` une fois chacun, copie de sécurité `pg_dump` avant |
| `npm run simuler -- --carte tests/engine/cartes/plaine.json --parties 50 --graine 1` | N parties IA contre IA |
| `npm run controler -- --carte <fichier>` | le verdict exact de la routine contrôle, hors ligne |
| `npm run apercu -- --params '{"largeur":16,"hauteur":12}' --graine 7 --sortie apercus/c.png` | une carte en PNG et en texte |
| `npx tsx scripts/generer-specs-assets.ts --verifier` | vérifie que `assets/specs/` n'a pas dérivé du canon |
| `npm run extraire-chaines` | extrait les chaînes ; marche à blanc sans `DATABASE_URL` |

## L'état réel, étape par étape

| Étape | État | Ce qui est là, ce qui manque |
|---|---|---|
| 0 — Socle | **fait** | Next 15, TS strict, `tsx --test`, Playwright, Drizzle, `migrate.mjs`, `.env.example`, CI. La CI ne lance **ni `lint` ni Playwright**. |
| 1 — Moteur | **fait** | Règles, RNG, rejeu, climat, hooks de mécaniques, IA à trois stratégies, `simuler.ts`. |
| 2 — Générateur + contrôle | **fait** | `mapgen/`, vérifications, campagne multi-climats, `ReviewVerdict` motivé, `controler-carte.ts`, `apercu-carte.ts`. La campagne des 200 cartes aléatoires du critère de fin n'a pas été relue à l'œil. |
| 3 — Rendu | **fait** | Interface `Rendu`, peau 3D, HUD HTML, un spec de fumée. La peau 2D et le repli WebGL ont été **retirés** (voir ci-dessus). Le seuil de 48 px par case n'est pas exercé sur tous les couples (carte × écran). |
| 4 — Assets 3D | **partiel** | 681 specs générées et valides, validateur glTF écrit. **Aucun `.glb` réel n'existe** : tout est placeholder. La boucle avec le générateur externe n'a jamais été parcourue. |
| 5 — Serveur et admin | **partiel** | Toutes les routes, le cycle, les prompts versionnés, la file, l'admin, la sonde — **écrits et testés hors base**. Aucune base n'a jamais été branchée. |
| 6 — Routines en ligne + i18n | **à faire** | Aucune tâche planifiée Codex n'existe. Côté i18n, seul `fr` a un bundle ; `en` est déclaré en base par la migration mais **aucun bundle `en` n'existe**. |
| 7 — France, 18 régions | **partiel** | Les 18 fiches sont dans `content/regions/fr/` et leurs styles aussi. **Aucune mécanique régionale n'est implémentée dans le moteur** : il n'y a que le contrat de hooks et une mécanique de test. |
| 8 — Lore et 24 nations | **partiel** | Les 24 fiches `Country` sont dans `content/pays/`. Pas de prologue, pas de routine lore, rien en base. Pas d'écran de choix du pays, et il n'en faut pas au premier parcours : tout le monde part de France (`BRIEF.md`, révision du 5 septembre au soir) ; les 24 fiches sont des **relations**, puis des départs débloqués en Nouvelle Ronde. |
| 9 — Voyage et campagne | **partiel** | `deblocages.ts` (dix conditions, `confiance` comprise), `content/fils/` (9 fils), `content/gabarits-missions.json`, le type `ProfilCampagne` et son validateur. Les **matchs d'incarnation** existent au schéma (`Scenario.incarnation`) et dans le moteur (`sceneDepuis` place le général incarné au camp du joueur) ; le **co-commandant passif** et la **montée de la confiance** ne sont pas implémentés — c'est le serveur qui devra recalculer `confiance` comme il recalcule `relations`. Pas de carte du monde, pas de carnet, pas de persistance de profil, aucune mission écrite. |
| 10 — Cerveau et jeu vivant | **partiel** | Les routes et la logique de dépêche, d'homologation, de mémoire et de prompts existent. Rien n'a tourné. **La mise en ligne à 18 h n'est pas câblée** (voir ci-dessous). |
| 11 — Paquet naval | **à faire** | Rien. Huit pays portent une spécialité de repli terrestre en attendant. |
| 12 — Finition | **à faire** | Rien. Huit des neuf langues restent `en_preparation`. |

## Les manques connus, nommément

Ils sont listés ici parce qu'ils se voient mal dans le code, pas parce qu'ils sont graves.

1. **Aucune base n'est branchée ni testée en réel.** Tout `src/db/` et une bonne partie de `src/serveur/` n'ont jamais parlé à un Postgres. Le test `tests/serveur/migrations.test.ts` est **sauté** faute de `DATABASE_URL` (c'est le seul des 629 qui l'est). `npm run migrate` sans base va proprement jusqu'à `ECONNREFUSED` et rend 1.
2. **`scripts/migrate.mjs` ne lit pas `.env`.** Il attend `DATABASE_URL` dans l'environnement, ce qui est juste en production (Coolify l'injecte) mais surprend en local : `npm run migrate` répondra `DATABASE_URL manquante` même avec un `.env` rempli. Lancer `node --env-file=.env scripts/migrate.mjs`, ou ajouter le drapeau au script — c'est une décision à prendre, pas un oubli à corriger en silence.
3. **La mise en ligne de la Dépêche à 18 h n'est pas câblée.** `armer()` passe la dépêche en `valide` sur décision humaine, et la requête `enLigne()` ne sert que le statut `en_ligne` : **rien ne fait la transition à l'heure dite**. Il manque le déclencheur (huitième tâche planifiée, ou évaluation paresseuse à la lecture — à trancher).
4. **Aucun bundle `en`.** `src/i18n/` ne connaît que `SOURCE_FR`. Les huit autres langues sont des lignes en base, sans glossaire ni traduction. Le repli `langue → en → fr` fonctionne, mais il tombe toujours sur `fr`.
5. **Aucun modèle 3D réel.** Les unités, terrains, bâtiments et décors sont des placeholders composés depuis la `Silhouette`. Les silhouettes **`rail`, `ailes` et `coque`** sont écrites dans `src/render3d/pieces.ts` mais **aucune unité du catalogue ne les utilise** : elles n'ont jamais été vues à l'écran.
6. **L'IA va souvent aux points.** Sur 50 parties de `plaine.json`, 28 finissent par `limite_journees`, donc par une décision aux points, contre 22 par élimination. C'est jouable et déterministe, mais ce n'est pas une IA qui cherche à gagner : elle capture et échange, et laisse le chronomètre trancher.
7. **« Parties non terminées » n'a pas la même définition à deux endroits.** `src/serveur/controle/verdict.ts` dit — et c'est la définition canonique — qu'une partie non terminée est une partie **sans vainqueur**. `scripts/simuler.ts` compte en plus toutes celles qui ont atteint `limite_journees`, même décidées aux points. D'où l'écart déroutant entre `simuler` (28 non terminées, 0 nul) et `controler` (0 sans résultat). Aligner le script sur le serveur, ou renommer sa ligne.
8. **Le moteur ignore trois mécaniques promises par les documents** : les **cartes de terrain** (`doc/04` §7.5), les **co-commandants** (passif seul + barre de jauge, y compris le commandant d'origine du joueur pendant un **match d'incarnation**, et la jauge entière d'un général à confiance 3) et les **spécialités**. Elles existent dans `src/schemas/` — types et validateurs —, pas dans `src/engine/`. De l'incarnation, le moteur ne tient aujourd'hui qu'une chose, et c'est la bonne : le camp du joueur prend le général incarné, et le catalogue joué est celui que l'appelant lui passe.
9. **Les 24 unités spéciales n'ont aucune spécification.** Ce sont des modèles uniques, pas des kits ; il faut d'abord qu'elles entrent au catalogue d'unités (`doc/11` §10.3).
10. **Le validateur glTF ne vérifie pas les textures livrées** : il voit qu'une carte obligatoire est présente, pas sa résolution ni le caractère binaire du masque d'équipe (`doc/11` §10.4).
11. **Les assets de type `effet`** (impacts, poussière, halo de pouvoir) existent comme type, sans aucune spécification produite.
12. **Le générateur de cartes n'est pas branché sur le serveur** : `src/serveur/generation.ts` et la partie catalogue de `src/serveur/simulation.ts` lèvent une erreur « pas encore branché ».
13. **L'accueil ne mène pas encore au monde.** L'écran-titre est fait (ci-dessus), mais il n'y a toujours ni choix du pays, ni carte du monde — le carnet, lui, existe. Et « Atelier des mondes » promet un éditeur alors que c'est un **visualiseur** de biomes, saisons et météo : sa sous-ligne le dit, le nom continue de mentir.

## Les prochaines actions, dans l'ordre

1. **Brancher la base Coolify.** `cp .env.example .env`, y mettre la vraie `DATABASE_URL` — elle n'est **jamais** commitée, `.env` est dans `.gitignore` —, plus `ADMIN_PASSWORD`, `AUTH_SECRET` (`openssl rand -hex 32`), `CRON_SECRET` et `SITE_URL`.
2. **Premier `npm run migrate`**, puis un second immédiatement : la migration doit être rejouable sans rien faire. Vérifier `/api/health` en `200`, et que `tests/serveur/migrations.test.ts` cesse d'être sauté.
3. **Créer les tâches planifiées Codex** avec les prompts bootstrap prêts à coller : `doc/05-routines.md` §2.6 (contrôle), §3.6 (map), §4.6 (lore), §5.9 (cerveau), et `doc/09-i18n.md` §8.7 (traduction). Le récapitulatif des sept tâches et de leurs crons UTC est en `doc/05` §7.1. Commencer par `atlas_map` et `atlas_controle` seuls, une semaine, et regarder le taux de rejet par motif avant d'ouvrir les autres.
4. **Semer les 24 pays en base** depuis `content/pays/*.json`, avec les 18 régions et les styles. Il n'existe aucun script pour cela : c'est un `scripts/semer.ts` à écrire, qui valide chaque fiche par `src/schemas/valider.ts` avant l'insertion, et qui est **rejouable**.
5. **Ouvrir `en`** : écrire `content/i18n/glossaire.en.json` (sans lui, le serveur ne sert aucun lot), lancer `npm run extraire-chaines` avec la base, laisser `atlas_traduction` remplir la file, relire l'échantillon humain.
6. **Câbler la mise en ligne de 18 h** (manque n° 3) et faire le test qui fait rater une échéance : le vide vaut mieux qu'une erreur.
7. **Passer le rendu 3D sur de vraies textures.** Envoyer au générateur externe les **premières specs par priorité 1** — les 165 qui suffisent à jouer la qualification française : terrains d'abord (ils couvrent l'écran), puis bâtiments, puis décor, puis unités, puis bustes. Un asset refusé ne remplace **jamais** son placeholder. Après chaque famille livrée, une passe de performance contre le budget de `doc/10` §9.2.
8. **Ensuite seulement**, les mécaniques régionales françaises (étape 7), qui sont le premier gros morceau de code moteur restant.

## Le déploiement

Coolify, image construite depuis le `Dockerfile` à la racine (Node 22 Alpine, trois étages, `postgresql18-client` installé pour le `pg_dump` d'avant migration — un client de majeure inférieure au serveur refuserait de tourner, et `migrate.mjs` le signale sans bloquer).

- `npm start` = `node scripts/migrate.mjs && next start -p ${PORT:-3000}`. Les migrations passent **avant** que Next n'écoute.
- `HEALTHCHECK` sur `/api/health` : `200` quand la base répond, `503` sinon (`non_configuree` ou `muette`). Aucune requête n'est faite à l'import d'un module — c'est ce qui garantit que `next build` n'a besoin d'aucune variable d'environnement.
- `/api/health/routines` est la sonde « homme mort » : `500` dès qu'une routine dépasse trois fois sa cadence nominale. Une routine qui n'a jamais tourné n'est pas en panne. À brancher sur la supervision externe.
- Variables à poser dans Coolify : `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `SITE_URL`, et si l'on veut s'écarter des valeurs par défaut `DEPECHE_TZ` (`Europe/Paris`), `DEPECHE_HEURE` (`18:00`), `BACKUP_DIR` (`.backups`, à monter sur un volume en production, sinon la copie de sécurité meurt avec le conteneur).
- Le conteneur embarque `content/` et `drizzle/`, lus au démarrage. Une modification du canon est donc un déploiement, pas une écriture en base.


## Herbe en volume — 12 septembre 2026

À la demande du propriétaire, `terrain_plaine` contient maintenant une dalle plate de 2 cm et des brins courbés jusqu’à 6 cm au total. Deux matériaux (`mat_sol`, `mat_herbe`), mêmes nœuds `racine`/`sol`, budgets conservés : 798/174 triangles. Les PNG restent externes, sans éclairage cuit. Premier contact extrait la végétation du GLB et la pose sur son relief continu ; les grandes cartes utilisent le LOD1, et le mode tactique la masque. Cette révision remplace la consigne historique interdisant tout brin dans le GLB, sans donner le relief du paysage à la dalle. Validation artistique par le propriétaire encore attendue. Voir `assets/livraisons/terrain_plaine/README.md`.


### Deuxième passe herbe — hauteur et détail, 12 septembre 2026

Après essai, le propriétaire demande plus de hauteur et autorise un budget supérieur. La plaine porte désormais 360 brins à trois segments de 6–12 cm (72 au LOD1), 12/4 trèfles, pour 1 914/402 triangles sur des budgets de 2 400/600. Hauteur totale de la dalle GLB : 14 cm. Le rendu passe au LOD1 au-delà de 200 000 triangles de végétation détaillée par carte. Les autres terrains et les PNG restent inchangés dans cette seconde passe. Validation esthétique encore à faire.

## Bocage harmonisé — 12 septembre 2026

Les décors procéduraux de plaine sont repris pour accompagner l’herbe GLB : haies feuillues, bottes liées et striées, parcelles à rosettes et marguerites, grandes touffes courbées. Buissons et fougères rejoignent le semis de plaine ; bottes/parcelles sont moins fréquentes et les points de placement des accessoires s’espacent de 18 cm (hors gazon et jumeaux). Aucun nouveau GLB/PNG de décor : c’est le rendu en jeu qui change. Voir `doc/refonte/decors-plaine.md` ; contrôle esthétique encore à faire par le propriétaire.

## Forêts et feuillage — 12 septembre 2026

Après rejet des buissons/haies sphériques, `vegetation-boisee.ts` fournit des feuilles pliées en rameaux pour haies, buissons et feuillus, des branches étagées pour les conifères et des troncs ramifiés. Les placements des arbres restent inchangés. Saisons, brouillard, instanciation et mode tactique sont conservés. Ce sont les formes procédurales en jeu qui changent, pas les GLB de bibliothèque ; aucun PNG ajouté. Voir `doc/refonte/forets-feuillage.md`. Validation esthétique par le propriétaire encore nécessaire.

## Assets actifs dans toutes les parties — 12 septembre 2026

L’environnement n’est plus limité à Premier contact. Le chargeur sélectionne les assets de `public/assets/modeles` selon les terrains et nations présents ; l’accueil suit la même chaîne. Les QG ne sont plus associés aux numéros0=FR/1=LU. Les unités avaient déjà leur repli kit/base/procédural. Les candidats de l’admin restent distincts des modèles actifs ; le relief reste continu et les arbres procéduraux. Voir `doc/refonte/assets-partout.md`.

## Mise à jour — sons synchronisés et assets communs (12 septembre 2026)

Les parties et l'accueil sélectionnent désormais l'environnement actif selon la grille et les nations, sans exception réservée à Premier contact. Les candidats de l'admin restent distincts des modèles activés. Voir `doc/refonte/assets-partout.md`.

La branche `codex/audio-vfx` ajoute huit bruitages synthétiques, les réglages son/volume persistants et leur déclenchement depuis la partition visuelle. Web Audio attend un geste en partie ; l'accueil reste silencieux. Les sons locaux respectent la visibilité, les annulations et la destruction du rendu. La riposte visuelle commence 80 ms après le tir, également dans le duel ; le calcul des dégâts reste inchangé. Voir `doc/refonte/sons-partie.md` et `doc/refonte/bataille-animation.md`. La vue de combat rapprochée en 3D et les animations Blender supplémentaires restent des suites proposées, pas des fonctionnalités livrées.

## Mise à jour — atelier Gemini et Tripo (12 septembre 2026)

`/admin/assets/creation` guide vers les catégories et variantes. Chaque fiche possède des prompts concept/multivue et un dépôt de source GLB autonome (150 Mio), distinct du lot final et du modèle actif. Les sources sont versionnées par empreinte et privées. `ATLAS_UPLOAD_URL` + `ATLAS_UPLOAD_TOKEN` raccordent le service voisin next-upload ; une route dédiée y exige `ATLAS_SOURCES_DIR` sur un volume persistant. Alternative locale : `ATLAS_ASSET_SOURCES_DIR`. Aucune clé n’est transmise au client. Configuration réelle du service distant et persistance à confirmer avant activation en ligne. Voir `doc/refonte/atelier-gemini-tripo.md`. Pas de conversion Blender automatique ni d’approbation artistique implicite.

## Mise à jour — barge Tripo (12 septembre 2026)

Le modèle fourni « tugboat » devient `unite_barge_base`, activé comme base partagée. LOD 49 956 / 11 956 / 2 956 triangles, budget propre 50 000 / 12 000 / 3 000 propagé à ses 24 kits. Quatre clips rigides, PBR externe partagé et panneaux d’équipe ; source HD gardée hors git. Grue fixe, rampe non articulée : aucune animation de débarquement nouvelle. Les anciens kits candidats de barge doivent être régénérés sur cette géométrie et ses UV avant activation. Voir `assets/livraisons/unite_barge_base/README.md`. Activation technique ne vaut pas validation artistique de la réduction.

## Mise à jour — vitrine orientable (12 septembre 2026)

`/atelier/unites` ouvre une grande vue libre par défaut. Glisser tourne et incline la caméra, molette et pincement zooment ; flèches, +/−, Début et boutons fournissent des alternatives. Bearing continu, inclinaison −80° à 85°, zoom ×0,4 à ×3. Les six vues techniques restent accessibles, la dernière étant orbitale. Gestes via Pointer Events et capture, annulation/nettoyage au démontage, redessin des gestes regroupé par frame. Build, test de bornes et deux E2E DOM/réseau passent (dont le chargement de la barge) ; aucun contrôle visuel automatisé.

## Mise à jour — barge HD et vitrine unique (12 septembre 2026)

Sur demande du propriétaire, la barge utilise uniquement le LOD0 : 934 594 triangles, dont 934 558 conservés de la source Tripo, textures albedo/normale 4096². `scripts/barge/preparer-source.py` remplace la décimation Blender ; normales quantifiées 16 bits, géométrie non simplifiée. Les deux anciens LOD sont retirés. Les autres unités gardent leurs budgets. La vitrine `/atelier/unites` ne présente plus les six vues techniques ni le sélecteur LOD : vue libre interactive au LOD0, rotation et zoom conservés. Validation artistique encore à effectuer par le propriétaire.

## Décision en vigueur — LOD0 uniquement (12 septembre 2026)

Tous les assets du site utilisent désormais un seul modèle `*_lod0.glb` : unités, kits nationaux, bâtiments, terrains, décors et commandants. Les autres LOD sont supprimés des fichiers livrés et publics, des spécifications, des générateurs et des sélecteurs de l’administration. Les chargeurs du jeu, de l’accueil et des ateliers ne demandent que le LOD0, sans baisse de détail au zoom. Les PNG restent externes. Les budgets LOD0 existants sont conservés ; cette décision ne relève pas automatiquement leur nombre de triangles. Cette règle remplace les anciens passages prescrivant plusieurs LOD dans ce document.

La barge HD révélait une incompatibilité WebGPU de Three r170 : les normales VEC3 int16 normalisées ont un pas de 6 octets, refusé par le GPU. `convertirMateriaux` adapte maintenant les attributs normalisés compacts en float32 à la lecture, en partageant les conversions. Aucun triangle ni fichier GLB n’est réduit. Les E2E de la barge contrôlent aussi les avertissements de validation GPU ; le simple badge « Modèle livré » ne prouve pas que le GPU a dessiné.

Le GLB barge est également réexporté avec normales float32, sans extension de quantification, pour corriger le fichier lui-même. La limite de réception passe à 32 Mio par fichier (lot inchangé à 96 Mio). La géométrie, les UV et les textures sont conservés.

## Catalogue unique — nouvelle base 0 (12 septembre 2026)

Décision du propriétaire : le catalogue courant complet de 30 unités devient la version 0. Les anciens filtres par version et le sélecteur de la vitrine sont supprimés. Tous les scénarios embarqués et les homologations pointent vers 0. Les prix, traits et exclusivités sont conservés. Les révisions des capacités de commandants restent indépendantes et leurs choix implicites sont figés dans les scénarios avant conversion. Les sauvegardes antérieures restent périmées plutôt que rejouées sous des règles différentes ; la progression n’est pas effacée. La migration `0001_catalogue_zero.sql` aligne les données et le compteur de production à ce nouveau point de départ. Les compteurs techniques pourront à nouveau évoluer lors de futures modifications, sans restaurer les anciens catalogues.

## Interface commune — 13 septembre 2026

Refonte des boutons et cartes : surfaces bleu nuit, accent menthe, angles arrondis, ombres discrètes, focus clavier conservé. Les cinq CSS publics, l'administration, les fiches assets, les ateliers et les panneaux du HUD suivent cette direction. /jeu distingue l'entrée campagne (dix entraînements), les parties libres et les essais ; les numéros de catalogue n'y sont plus exposés. Les sauvegardes, objectifs et règles ne changent pas. Trois agents ont apporté des perspectives simulées (adolescent, joueuse adulte, designer novateur), pas des tests utilisateurs humains. Contrôles DOM et styles calculés uniquement selon la consigne de vérification ; validation esthétique laissée au propriétaire.

## Anti-air de base — candidat du 13 septembre 2026

`assets/livraisons/unite_antiair_base` contient le candidat LOD0 à 4 040 triangles (6 000 autorisés), 569 911 octets pour les sept fichiers. Six PNG préservés à l’octet près ; courbes subdivisées et normales lisses, positions des attaches et animations inchangées. `scripts/antiair/integrer.ts` expose uniquement ce lot dans l’inspecteur via `/assets/candidats`, après contrôle complet. Le modèle actif et les kits ne sont pas remplacés. Les repères projetés figurent dans `reperes.json` ; ni ces mesures ni les tests DOM ne valent approbation artistique. La revue visuelle humaine reste à faire.


## Sources GLB détaillées — décision du propriétaire, 13 septembre 2026

Pour chaque source GLB uploadée, appliquer systématiquement le traitement de la barge : conserver la géométrie détaillée, les normales, les UV et la résolution des textures. Aucune décimation, aucun remeshing ni réduction automatique des textures. Cette règle remplace les anciens budgets lorsqu’ils imposeraient une perte de détail : après mesure de la source, adapter le catalogue générateur et les spécifications versionnées de la base et de ses kits, avec une marge pour les attaches nécessaires. Cette adaptation est autorisée sans nouvelle confirmation. Les budgets des assets sans source mesurée ne sont pas augmentés arbitrairement.

Conserver un seul LOD0, les PNG externes, la provenance SHA-256, et documenter les triangles et octets avant/après. Orientation, dimensions, pivots, matériaux, masque d’équipe et animations restent à préparer et contrôler. Une limite technique dépassée se traite par une optimisation sans perte ou un blocage expliqué, jamais par une simplification silencieuse. L’acceptation technique reste distincte de la validation artistique humaine ; cette règle n’active pas automatiquement un candidat.

## Candidats GLB uploadés — 13 septembre 2026

Les trois candidats anti-air, artillerie et infanterie proviennent désormais des sources Tripo déposées, identifiées par SHA-256 dans chaque `source.json`. Géométrie source conservée : 950 800, 941 718 et 985 194 triangles ; un témoin de 12 triangles est ajouté à l’anti-air. Les cartes PBR source restent en 4K, les PNG externes. Les budgets mesurés sont adaptés dans le générateur et les specs de base/kits, sans produire de kit supplémentaire. Les scripts `scripts/{antiair,artillerie,infanterie}/preparer-source.py` préparent les attaches rigides et `scripts/production/integrer-source.ts` expose uniquement les candidats contrôlés. Orientation, découpe des pièces mobiles et zones d’équipe restent à revoir humainement ; l’infanterie n’a pas de marche squelettique individuelle. Aucun modèle actif n’est remplacé par cette livraison.

## Char léger source HD — 13 septembre 2026

Le candidat `unite_char_leger_base` reprend la source uploadée SHA-256 `82f0857a3f0074cbd2aca688ec81c2227f53fa1a1dcbba66d6579f399a513f99` : 957 200 triangles conservés, témoin de 12 triangles ajouté, PBR 4K externe. Lot 53 130 822 octets, contrôle `ok`, cinq clips rigides. Les anciennes textures hiver du candidat sont retirées car leurs UV ne correspondent plus ; aucun modèle actif ni kit produit. La revue humaine des articulations, de l’orientation et du masque reste nécessaire. Un essai séparé de compression sans perte de la géométrie anti-air donne 13 775 552 octets Meshopt et 11 617 283 avec gzip, contre 28 173 224 initialement ; reconstruction exacte vérifiée. Les chargeurs du jeu ne sont pas encore raccordés à cette compression et les PNG restent non convertis en KTX2.

## Compression du char léger — 13 septembre 2026

`EXT_meshopt_compression` sans quantification ni suppression de triangles sur le candidat char léger : GLB 28 998 012 → 14 209 732 octets, lot 53 130 822 → 38 342 542. Les PNG sont inchangés. Trois chargeurs raccordés au décodeur WASM ; contrôle binaire et empreinte des kits décompressent les données avec bornes d’allocation. `scripts/production/compresser-source.ts` produit la version compressée depuis le lot préparé. Le propriétaire a demandé de ne pas lancer les tests : le contrôle de typage déjà en cours avait signalé une variable facultative, corrigée, puis aucun test/build/contrôle final n’a été relancé. `validation-lot.json` ne réutilise pas le verdict `ok` de l’ancien GLB. Candidat à inspecter, modèle actif inchangé.

## Bibliothèque nationale, début de saison 1 et sons — 13 septembre 2026

Les variantes régionales sont suspendues (126 fiches et lots retirés, 10 fiches françaises nationales ajoutées, 935 spécifications). `/atelier/assets` parcourt les fichiers actifs/candidats/manquants sur une carte avec chargement de proximité. `/jeu` redirige vers la campagne ; le menu Jeu libre est retiré. La branche sons est fusionnée et le banc reçoit aussi la sortie audio. Le réalisateur de combat reste actif sur la carte, sans nouvelle arène latérale GLB. Deux missions de saison 1, `opus1_fr_01` et `opus1_fr_02`, portent le parcours à 14 missions dont 10 tutoriels ; accessibles mais non simulées. Le propriétaire demande de ne pas lancer de tests : aucun contrôle final ni approbation visuelle revendiqué. Voir `doc/refonte/livraison-saison1-assets-sons.md`.
