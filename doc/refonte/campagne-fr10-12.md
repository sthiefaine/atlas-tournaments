# Saison 1 · FR10 à FR12 — la fin du chapitre français (23 septembre 2026)

Trois fiches de `opus1-nations.json` deviennent les trois dernières missions du chapitre français : **Une signature de trop** (`opus1_fr_10`), **Le contrat rendu public** (`opus1_fr_11`) et **Une victoire à partager** (`opus1_fr_12`). Elles ferment le parcours local, qui passe à **24 missions** : dix exercices, deux matchs officiels, FR01 à FR12. Les trois choix du chapitre — FR08, FR10, FR12 — ont désormais leurs options et leurs conséquences dans le code. Les fiches font foi sur le fond ; ce document dit ce qui en a été fait, ce qui a été adapté et pourquoi, et ce que la mesure dit.

**Fichiers.** `content/cartes/carte_opus1_fr_1{0,1,2}.json`, `content/scenarios/opus1_fr_1{0,1,2}.json` (version 1), trois entrées ajoutées à la fin de `content/campagne.json` ; `src/app/campagne/consequences.ts` (choix et conséquences), `src/content/difficulte.ts` (le mode difficile de FR07 à FR12), `src/app/campagne/paysage-campagne.tsx` (positions du parcours) ; `src/schemas/valider.ts` pour la seule borne de longueur d'une graine (autorisé par le coordinateur) ; tests dans `tests/campagne/`. Contrats et rapports du laboratoire dans `apercus/conception-fr1{0,1,2}/`, générateur des cartes et scénarios (`gen.mjs`), banc d'essai des pilotes (`essai.mts`) et mesures dans `apercus/fr10-12/` (non versionné). **Aucune chaîne d'interface neuve** ; `content/personnages.json` n'a pas eu besoin d'être touché.

## Distribution et fil

| Mission | Joueur (camp 0) | Alliés | Adversaires | Pourquoi eux |
|---|---|---|---|---|
| FR10 | Ariane (son kit, comme de FR01 à FR09) | — | Edran Sorel (camp 1), Yuna Serrat (camp 2) | « Le fournisseur » de FR08 et FR10 est Méridien ; Edran, qui tient les réserves de l'équipe de l'Est depuis FR08, en est la face : il garde le quai et le centre de tri. Yuna, « commandante des concessions de terrain » au registre des personnages, qui étend les contrats provisoires au profit du Consortium, tient **le mandat privé** de la fiche : elle signe pour l'équipe de l'Est et garde le relais du nord. C'est sa première apparition, sans son super (voir plus bas). |
| FR11 | Ariane | — | Hadran Ost (1), Maël Orven (2), Lise Varen (3) | La fiche et la trame : « Ost revient avec Maël et Lise, chacun présenté par son rôle de combat » ; le lore v2 : « trois colonnes méridiennes », « la Sélection n'est pas une équipe d'essai, c'est une armée ». |
| FR12 | Ariane | Tomas (1, porte nord), Solveig (2, porte sud) | Edran (3) | Trois colonnes : la vôtre, celle de Tomas, qui ramène les batteries au Luxembourg et ouvre l'arc suivant, et l'escorte de Solveig, déjà alliée à FR09, dont les camions reprennent la route que Méridien fermait. Edran tient le dernier QG : il ferme la boucle ouverte à FR06 (son aide coûteuse), FR08 (les réserves de l'Est) et FR09 (les dépôts). |

**« Ariane et vous ».** Le kit d'Ariane reste au camp 0, comme dans toutes les missions françaises, et « la colonne d'Ariane » est celle que commande le joueur : c'est la lecture de FR04 (« Tomas tient le nord, nous le sud ») et celle que le lot FR07–FR09 a prise pour FR09 (« Ariane vous demande où placer sa colonne »). Un second camp « Ariane » aurait doublé son nom au bilan et sur le splash de pouvoir de l'allié.

**Le vocabulaire.** « L'équipe de l'Est » pour l'équipe française qui a signé avec Méridien, comme dans FR08 ; « délégation » et « Intendance », retirés le 12 septembre, n'apparaissent nulle part. Deux mots du monde sont expliqués à leur premier emploi : le **mandat** (Yuna : « c'est moi qui signe pour elle ») et les **comptes vérifiés** (Ariane : « Atlas vérifie ses comptes ») ; le **Registre** l'a été par FR07. Un rappel « vous vous souvenez… » par mission : la journée sans crédit (FR10), le devis orange (FR11), les deux rives (FR12). Aucune réplique ne dépasse 182 caractères ni deux passages en gras. Aucun lien de famille n'est dit ni suggéré : Maël et Lise ne se parlent pas, Lise garde son nom public, Edran et Maël ne se croisent dans aucune des trois missions. Aucune mort.

## Les trois missions

### FR10 — Une signature de trop (1 contre 2, `capturer`, brouillard, choix)

Côte, 22 × 14. Une rivière nord-sud que les véhicules ne passent qu'à trois ponts ; l'infanterie la traverse partout. Trois **centres du fournisseur**, en or : le **relais du nord** (station radar sur une colline, tenu par Yuna), le **quai du sud** (port) et le **centre de tri de l'est** (ville), tenus par Edran. Victoire : **deux des trois en même temps** avant la fin de J22 (fiche : « deux des trois bâtiments objectifs annoncés ») ; un centre repris par l'adversaire ne compte plus. Défaite : QG perdu, limite.

Joueur : deux infanteries, une méca, un char léger, une artillerie ; 3 000 fonds, 500 par bâtiment. Edran : deux chars légers, une artillerie, une infanterie, un transport, une reconnaissance ; Yuna : deux infanteries, une méca, une reconnaissance, une artillerie. « Budget adverse borné » : 2 000 fonds et **200 par bâtiment**. Au-delà, l'adversaire achète une infanterie par journée et par camp, et la mission devient une mêlée autour du QG du joueur ; en dessous, la course est décidée avant J8.

Le ressort est une course : Edran et Yuna défendent, mais **leurs équipes de capture visent aussi le QG du joueur** — Yuna double sa capture avec son pouvoir. Le briefing le dit trois fois (Ariane à l'ouverture, Yuna à J5, le conseil du carnet). Un pilote qui ne garde pas son QG le perd vers J9 ; c'est ce qui fait perdre le joueur passif.

**Difficile** (fiche : « une unité de couverture supplémentaire protège les indirects ») : une infanterie rejoint l'artillerie d'Edran au sud à J2, plus les 1 500 fonds par camp adverse de la convention FR03–FR06, et le Bulletin à une journée. Annoncé au briefing.

**Le choix** `opus1_fr_10_decision`, présenté par Yuna et Ariane au dialogue de victoire : **Accepter son retour, comptes vérifiés** (`retour_sous_audit`) ou **Exiger d'abord la fin de son mandat** (`fin_du_mandat`).

### FR11 — Le contrat rendu public (1 contre 3, `hors_jeu_total`)

Plaine des Haies, 20 × 15 — les Haies du transformateur pris à FR01. Des haies en lignes de forêt, des hautes herbes, trois fermes neutres au centre. Ost arrive par la route de l'est avec **les chenilles** (char moyen, deux chars légers), Maël par le nord avec **le ciel** (deux hélicoptères), Lise par le sud avec **les pièces lourdes** (artillerie, lance-roquettes). Chacun se présente par ce rôle, et c'est aussi ce qu'il amène sur le terrain. Victoire : **toutes leurs unités hors jeu** avant la fin de J24.

**Pourquoi 1 contre 3 et non 2 contre 2.** Le moteur accepte quatre camps, et une réplique ne peut être dite que par un commandant du scénario (`contenu.test.ts`). La fiche demande à la fois « Ariane et vous » et trois commandants des Gris qui parlent : cinq camps. Deux contre deux faisait taire Maël ou Lise le jour même de leur première apparition, et effaçait la révélation de la fiche (« trois commandants des Gris défendent la même offre »). « Ariane et vous » tient au camp 0, comme à FR04 et FR09 ; « se couvrir sans tout diriger ensemble » devient une consigne tactique (« ne marchez pas en bloc : une colonne couvre l'autre »).

**Une vraie mise hors jeu totale.** Un QG est un producteur, et un camp qui garde un producteur n'est jamais éliminé : avec un QG, les Gris ne sortiraient du jeu que par la capture de leur QG — l'« alternative » que la fiche refuse. Ils n'ont donc **ni QG, ni usine, ni fonds, ni revenu**, et **aucune unité capable de capturer** : ils cassent, ils ne prennent pas. La carte de quatre camps doit pourtant porter quatre QG : les trois autres sont **les postes de relève du joueur**, derrière lui. Deux essais écartés, et pourquoi : des postes neutres près des Gris devenaient leur objectif, et ils y campaient (défense 4) ; des postes neutres hors d'atteinte, sur des îlots, attiraient le dernier hélicoptère, qui s'y posait hors de portée de tout sauf l'artillerie. Les fermes neutres du centre donnent à l'infanterie du joueur quelque chose à prendre (300 par bâtiment) et fixent le combat au milieu.

Les Gris jouent **propre** : aucun `factionsParCamp`, donc la Grêle d'Ost, la Rasante de Maël et la Zone rouge de Lise sont refusées par le moteur ; leurs pouvoirs normaux jouent. C'est la règle de FR05 et FR06, et `supers-vilains.md` garde les pièces sans dossier pour les finales. Sans piste, les appareils de Maël ne se ravitaillent que par son pouvoir.

**Difficile** (fiche : « crédit adverse de 1 500 fonds maximum ») : sans producteur, un crédit n'achèterait rien. Il devient une **réserve annoncée** : un char léger rejoint Ost à J3 par la route de l'est, rappelé la veille. La stratégie agressive a été essayée comme levier : elle rendait la mission plus facile, les colonnes venant mourir une à une.

### FR12 — Une victoire à partager (3 contre 1, `capture_qg`, brouillard, choix)

Montagne, 22 × 15. Le dernier QG de Méridien est sur un plateau fermé par une couronne de montagnes, avec **trois portes** : ouest (le joueur), nord (Tomas), sud (Solveig). Les véhicules n'entrent que par les portes, l'infanterie passe la montagne. Victoire : le QG d'Edran à la coalition avant la fin de J22 ; pris par Tomas ou Solveig, il compte.

Edran n'a **plus de revenu** — la coalition a coupé ses routes à FR10 et FR11 — mais un QG et une usine, 3 000 fonds, et une garnison de six unités (char moyen, deux chars légers, artillerie, anti-air, infanterie). Tomas (ponderée) et Solveig (défensive) ont 1 000 fonds et 300 par bâtiment. **Le joueur est nécessaire** : seules, les deux colonnes alliées ne prennent pas le plateau (le pilote passif perd dans les six mesures du normal et du difficile, voir plus bas).

**Les alliés gardent leurs moyens.** Les paramètres de mode ne connaissent qu'un « budget IA » et une stratégie : appliqués tels quels, ils donnaient à Tomas et Solveig le budget d'Edran, et le difficile les enrichissait. `FIN_CHAPITRE_FR[…].alliesPropres` rend à chaque allié ses fonds, ses revenus et sa stratégie, dans les deux modes. FR04 garde sa ligne à part, inchangée.

**Difficile** (fiche : « réserve adverse décalée sur un axe secondaire annoncé dès le briefing ») : sa réserve — un char léger et une infanterie — entre par la **porte sud** à J4, annoncée au briefing et rappelée à J3 ; 1 500 fonds de plus ; et Edran **tient ses portes** (stratégie défensive). Écart assumé à `doc/13` §6.2, qui propose l'agressive : ici un siège, et la mesure le montre, une garnison défensive est plus dure à ouvrir qu'une garnison qui sort — en pondérée, ses sorties contre les alliés affaiblissaient le plateau au point que le pilote passif gagnait deux fois sur quatre.

**La fin du chapitre.** Ariane ne fait pas de discours : « les équipages attendent votre voix, pas la mienne » ; le carnet dit que le joueur annonce lui-même la victoire. Tomas repart avec les batteries (« je vérifierai la dernière caisse moi-même ») : c'est l'ouverture du Luxembourg. Solveig inscrit la concession française au nom du joueur, d'où le choix `opus1_fr_12_decision` : **Verser une réserve à la coalition** (`verser_reserve`) ou **Financer la préparation locale** (`preparation_locale`).

## Les choix et leurs conséquences

Au format de FR04 : `choix: []` dans le scénario, les options dans `CHOIX_FRANCE` (`consequences.ts`), présentées au dialogue de victoire et proposées par l'écran de fin (`optionsDecision`). Chaque choix n'agit que sur l'épreuve qu'il annonce, avec l'effet de sa fiche, jamais les deux :

| Source | Option (clé · titre) | Cible | Effet codé |
|---|---|---|---|
| FR08 | `garantir_livraison` · Garantir la livraison au signataire | FR10 | une reconnaissance du camp du joueur à **J2**, entrée par l'ouest (2,10) ; réplique d'Ariane : « son éclaireur nous rejoint » |
| FR08 | `refuser_garantie` · Refuser de garantir son crédit | FR10 | **1 500 fonds** de plus au départ ; « elle finit l'année sans courant » |
| FR10 | `retour_sous_audit` · Accepter son retour, comptes vérifiés | FR12 | une reconnaissance à **J2**, entrée par l'ouest (2,5) |
| FR10 | `fin_du_mandat` · Exiger d'abord la fin de son mandat | FR12 | **1 500 fonds** de plus ; « ses équipages attendront la fin de la vérification » |
| FR12 | `verser_reserve` · Verser une réserve à la coalition | Le relais de Tomas | enregistré, figé dans la graine, **effet à coder avec la mission** |
| FR12 | `preparation_locale` · Financer la préparation locale | Le relais de Tomas | idem |

Chaque branche ajoute une réplique d'Ariane à l'ouverture et un rappel au briefing qui cite le choix (« retour narratif » de la fiche) ; la reconnaissance arrive « sous vos ordres », au camp du joueur, et le moteur reporte son arrivée si la case est prise. Le choix de FR08 est écrit par le lot FR07–FR09 dans le dialogue ; ses deux titres sont ceux que ce lot a proposés.

**L'effet attendu sur Le relais de Tomas** (`opus1_lu_01`, à écrire) : dans `appliquerConsequences`, un bloc `if (scenario.code === 'opus1_lu_01')` sur le modèle de FR10 et FR12. `verser_reserve` : une reconnaissance du camp du joueur à J2 près de son entrée (« la coalition vous rend la monnaie », lore v2), réplique de **Tomas** — seul commandant de la fiche, il « mémorise toutes les promesses faites en route » ; `preparation_locale` : 1 500 fonds de plus au départ, réplique de Tomas. Les textes des options disent déjà « mission à venir ».

**La graine.** Un chiffre par source de décision, toujours ajouté après les anciens : FR08, FR10 et FR12 prennent les places 10 à 12, après FR04. Une graine du 14 septembre (neuf chiffres) se relit toujours — `LONGUEUR_FR04_SEUL` rejoint les longueurs connues, et un test le prouve sur une graine écrite à la main. Douze chiffres faisaient dépasser à certaines graines les **64 caractères** de `validerSauvegarde` (`aube_essai_maritime_iem_climat:a1:000000000000:@elsbeth_vonlanthen`, 66) : la borne devient `LONGUEUR_MAX_GRAINE = 256`, raison écrite au code — code du scénario (48 au plus), `:a1:`, un chiffre par source (soixante-dix-neuf décisions au plan de l'opus, plus les bancs), la marque du commandant. Une graine plus courte reste acceptée telle quelle ; aucune ne change de sens.

## Le mode difficile de FR07 à FR12

`FIN_CHAPITRE_FR` (`src/content/difficulte.ts`) porte, par épreuve, l'annonce au briefing, les renforts et le rappel de la veille, et `alliesPropres`. Les entrées de FR07, FR08 et FR09 sont celles que leur lot a proposées (`apercus/fr07-09/propositions-hors-lot.ts.txt`), reprises au texte près et remesurées ici (tableau plus bas). Un point à trancher : FR07 pose son char léger à **J1**, donc au départ, ce que `doc/13` §6.3 exclut (« il ne donne pas d'unité supplémentaire à l'IA au départ ») ; FR10 à FR12 posent les leurs à J2 au plus tôt.

## La carte de campagne

`POSITIONS_PARCOURS` (`paysage-campagne.tsx`) : les dix-huit positions d'avant, recopiées à l'identique, puis FR07 (455,560), FR08 (660,590), FR09 (880,740), FR10 (1130,730), FR11 (1150,440), FR12 (1130,200). L'itinéraire repart de la journée sans crédit, à l'ouest, traverse le sud du dessin puis remonte le bord est jusqu'au nord-est, du côté où l'on part pour le Luxembourg ; aucune ne descend sous la plus basse d'avant, la carte garde sa hauteur ; deux étapes sont toujours à 90 unités au moins l'une de l'autre (test). Le dessin gagne des haies autour des Haies et trois sommets autour du plateau du dernier QG.

**À brancher, hors de mes fichiers** : les positions vivent aujourd'hui dans `carte-parcours.tsx` (`const POSITIONS`, dix-huit entrées) ; sans changement, FR07 à FR12 tombent sur la rangée de secours (y = 800) et agrandissent la carte. Le changement tient en deux lignes : `import { PaysageCampagne, POSITIONS_PARCOURS as POSITIONS } from './paysage-campagne';` et la suppression de la constante locale.

## Mesures

Pilotes de `scripts/verifier-campagne.ts` (heuristique d'objectif, IA pondérée, IA agressive) contre l'IA du scénario ; la colonne « vérificateur » est sa graine, les autres une copie locale de la même boucle sur trois graines, plus un pilote **passif** (il ne fait que finir son tour) qui mesure si l'adversaire est une menace et si le joueur est nécessaire.

`npm run verifier:campagne` complet : **46 couples sur 48**, rejeu conforme ; les deux rouges sont FR03, rouge avant ce chantier. Les six couples de ce lot et les six de FR07–FR09 (avec leur difficile repris ici) passent.

| Mission / mode | Vérificateur | Heuristique, 3 graines | Pondérée | Agressive | Passif |
|---|---|---|---|---|---|
| FR10 normal | gagnée, heuristique, **J10** | 3/3, J10 | 2/3, J10·9 | 2/3, J9·8 | 0/3 — QG pris J9 (×2) |
| FR10 difficile | gagnée, heuristique, **J10** | 3/3, J10 | 3/3, J10·11·9 | 3/3, J10·9·8 | 0/3 — QG pris J9 |
| FR11 normal | gagnée, pondérée, **J14** | 2/3, J20·21 | 3/3, J14·14·16 | 1/3, J17 | 0/3 |
| FR11 difficile | gagnée, pondérée, **J22** | 0/3 | 2/3, J22·17 | 2/3, J17·21 | 0/3 |
| FR12 normal | gagnée, pondérée, **J12** | 2/3, J9·9 | 3/3, J12·15·12 | 3/3, J12·12·13 | 0/3 |
| FR12 difficile | gagnée, pondérée, **J18** | 0/3 | 3/3, J18·19·18 | 3/3, J15 | 0/3 |

Les branches, trois graines dans les deux modes (six parties par pilote) :

| Branche | Heuristique | Pondérée | Agressive |
|---|---|---|---|
| FR10 + garantir la livraison (reconnaissance à J2) | 0/6 — QG pris à J10 | 6/6, J7 à J9 | 4/6, J8 à J16 |
| FR10 + refuser la garantie (1 500 fonds) | 0/6 — QG pris à J10 ou J14 | 5/6, J9 à J11 | 6/6, J9 à J10 |
| FR12 + retour, comptes vérifiés (reconnaissance à J2) | 6/6, J9 ; J14 à J15 | 6/6, J15 à J21 | 5/6, J12 à J17 |
| FR12 + fin du mandat d'abord (1 500 fonds) | 5/6, J9 ; J16 | 6/6, J12 à J21 | 6/6, J12 à J19 |

Lecture honnête :

- **FR10** se joue en course, entre J8 et J11. L'heuristique gagne la carte du canon sur le fil — son deuxième centre tombe à J10, la journée où les équipes de Yuna arriveraient sur son QG — et perd les branches pour la même raison, une journée plus tard. Les IA, qui défendent leur QG, gagnent les branches. Un joueur qui laisse une unité chez lui, comme le briefing le demande trois fois, n'est pas dans ce cas.
- **FR11** est la plus longue et la plus serrée : les pilotes finissent entre J14 et J22, et perdent quand la dernière pièce des Gris se poste sur une ferme pendant que leurs propres fantassins, sans rien à prendre, bouchent l'usine. Le passif ne perd pas son QG (les Gris ne capturent pas) mais finit au chronomètre avec une seule unité debout : les Gris sont une vraie menace.
- **FR12** : le joueur est nécessaire (passif 0/6), et les colonnes alliées pèsent — l'assaut se décide autour de J12 en normal, J15 à J19 en difficile.

Le laboratoire (`concevoir-mission.ts`, contrats avec les branches de choix : le script du dépôt ne lit que `CHOIX_AUBE`) compose des variantes de carte et les simule ; ses chiffres portent sur ces variantes, pas sur les cartes du canon. FR11 et FR12 ont une variante recommandée (victoire du joueur dans chaque couple branche × mode) ; FR10 n'en a pas — ses variantes régénèrent le relief autour des centres et perdent la rivière et ses ponts, qui portent la mission. Rapports complets dans `apercus/conception-fr1{0,1,2}/rapport.json`.

## Ce qui reste non vérifié, ou à trancher

- **Rien n'a été regardé à l'écran**, par consigne : ni les trois cartes, ni la lecture des dialogues, ni les positions de la carte de campagne et ses nouveaux décors.
- **La difficulté humaine n'est pas mesurée.** Les pilotes gagnent chaque couple mission × mode à la graine du vérificateur, mais leurs résultats varient d'une graine à l'autre (tableau) ; FR11 difficile se gagne à J22 sur 24 à la graine du vérificateur.
- **Le format de FR11** (1 contre 3 au lieu de 2 contre 2) : la fiche de `opus1-nations.json` et le fil sont à mettre d'accord, ou la mission à revoir.
- **Yuna Serrat apparaît à FR10**, avant sa « mission d'entrée » du registre (`national_nl_03`) ; Solveig est alliée à FR12, comme à FR09.
- **La conséquence de FR12** attend Le relais de Tomas.
- **Hors de mes fichiers** : `carte-parcours.tsx` doit importer `POSITIONS_PARCOURS` ; `avecConsequences` (`src/app/admin/cartes/consequences.ts`) ne lit que `CHOIX_AUBE`, si bien que le laboratoire et l'admin ne montrent pas les branches françaises (une ligne : parcourir aussi `CHOIX_FRANCE`) ; le commentaire de `bancs.ts` parle encore de « 64 caractères » ; la conclusion de FR06 dans `campagne.json` dit encore que l'enquête « reste à préparer ».
- **Rouges d'avant, non touchés** : `tests/campagne/difficulte.test.ts` (« deux difficultés accessibles sans victoire », le verrou du difficile sur la finale 18), `tests/engine/objectifs.test.ts` pour FR06 (le test enchaîne huit fins de tour comme si une mission avait deux camps), FR03 au vérificateur. Les deux tests qui comptaient douze missions (`tutoriels.test.ts`, `aventure-editoriale.test.ts`) décrivent désormais le parcours de 24.
- **Constat en passant** : FR05 est une « mise hors jeu totale » contre un Ost qui garde son QG et son usine ; tuer toutes ses unités ne termine pas la mission, seule la prise du QG le fait. Le carnet dit l'inverse.
