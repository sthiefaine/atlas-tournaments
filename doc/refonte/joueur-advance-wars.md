# Relecture de joueur d’Advance Wars — campagne Aube

Perspective simulée du 9 septembre 2026. Aucun joueur humain n’a testé ces propositions. Les trois cartes livrées sont des brouillons validés structurellement, pas un équilibrage certifié. Le programme de fusion fictif s’appelle **Aube** ; les affrontements sérieux restent non sanglants.

## Ce qui donnerait envie de jouer

Le cœur fonctionne si gagner la bataille reste satisfaisant avant la révélation politique. Prendre un QG puis apprendre que le bénéficiaire du contrat n’était pas celui annoncé est intéressant ; apprendre que toute victoire était inutile retire sa valeur à la partie. Le résultat tactique doit donc toujours conserver un avantage concret : route, réserve, témoin ou position.

Je conserverais les quatre entraînements actuels : combat, villes, production, QG. Ils enseignent déjà les verbes du jeu sur des terrains distincts. Remplacer le premier par un choix contractuel ajoute une question avant que le joueur sache déplacer son char. La concession énergétique arrive après la première victoire ; le premier vrai choix après le quatrième exercice.

Les alliances doivent exister dans les règles. Deux commandants sous le contrôle du même camp ne font pas un 2 contre 1 : le partenaire doit avoir son tour, ses unités et sa caisse. Il faut annoncer qui joue avec qui, quels QG sont décisifs et si perdre un partenaire termine la mission. Un allié qui occupe le seul passage peut rendre une carte injouable : chemins de deux cases ou deux traversées séparées, vision partagée et absence de tir allié sont des exigences fonctionnelles.

Une asymétrie de camps n’est pas une multiplication de la puissance. En 1 contre 3, trois QG et trois tours de production créent déjà une pression. Les adversaires n’ont pas besoin chacun du budget du joueur. Le départ doit laisser lire les trois fronts avant qu’une artillerie puisse atteindre la base du joueur. La présence de trois camps ne justifie jamais un renfort surprise derrière une unité.

## Douze étapes, dont une branche longue facultative

Les numéros sont des étapes de conception, pas des scénarios tous livrés. Les quatre entraînements existants restent jouables. Ne pas afficher un bouton vers un chapitre sans scénario intégré.

1. **Premier contact**, entraînement existant : élimination, 1 contre 1. Apprendre déplacement, attaque et riposte. La concession est révélée après la victoire.
2. **Les quatre villes**, entraînement existant : capture de trois villes. Apprendre revenus, réparation et occupation.
3. **Le chantier des usines**, entraînement existant : remise en service des deux usines. Apprendre production, génie et tir indirect.
4. **Le QG de la presqu’île**, entraînement existant : capture du QG. Conserver les marées annoncées et le pont permanent. Premier choix contractuel après la victoire.
5. **Le détour des batteries**, 2 contre 1 : élimination adverse ou QG adverse. Première vraie coalition. Partager 2 000 fonds avec l’allié ou garder sa réserve ; contrepartie expliquée avant validation.
6. **Le lot sans défense**, 1 contre 1 : élimination ou QG. Une victoire rapide donne une position utile tout en révélant le bénéficiaire caché du stockage.
7. **Battre celui qui vous croit**, 1 contre 2 : élimination de la coalition ou tous ses QG. Des adversaires honnêtes veulent suspendre un mauvais contrat en acceptant le résultat du tournoi ; pas de nation désignée coupable.
8. **La ligne de nuit**, 2 contre 2 : élimination ou tous les QG adverses. Brouillard après un briefing qui montre les coalitions et prévient la nuit. La preuve acquise précédemment améliore le renseignement, sans unité spéciale.
9. **Le relevé manquant**, 1 contre 1 : élimination ou QG. Match court de respiration, révélation de la Cinquième Manche et de son objectif Aube ; choix de publication ou protection du témoin.
10. **La quarantième relève**, 1 contre 3 : branche longue facultative, tenir quarante journées complètes. La route principale propose une rencontre classique plus courte menant au même chapitre. La branche donne une entrée de carnet et une préparation différente, pas le droit exclusif de finir la campagne.
11. **Les routes d’Aube**, 3 contre 1 : élimination ou QG central. Retourner l’asymétrie : deux partenaires sur des fronts annoncés. Un chemin ouvert par un choix ancien doit être visible et nommé dans le briefing.
12. **La dernière concession**, 2 contre 2 : élimination ou tous les QG adverses. La victoire protège les postes de coordination extérieurs ; aucun affrontement dans un réacteur. Les preuves déterminent les garanties de l’accord final, sans annuler la victoire tactique.

Neuf des douze étapes privilégient donc l’élimination ou le QG ; les exceptions servent l’apprentissage ou un siège choisi. Les deux missions de qualification historiques peuvent rester accessibles comme exercices facultatifs, sans retirer les victoires déjà enregistrées.

## Le siège de quarante journées

Quarante journées complètes signifie une conclusion à l’ouverture de la journée 41, cohérente avec la règle actuelle `journee > journees`. Les jalons 10, 20 et 30 doivent modifier une décision : replier une ligne, reprendre une ville ou intercepter une réserve finie. Un texte seul ne suffit pas. Annoncer les entrées une journée avant, ne jamais faire apparaître une unité sur une case occupée, permettre sauvegarde et reprise.

La relève doit être visible avant l’écran de résultat, ou annoncée dans la conclusion si le moteur conclut immédiatement. Ne pas vendre une contre-offensive jouable quand la condition de survie termine déjà le match. La variante courte ne doit pas demander quarante appuis sur « Fin de tour ».

Attention : le moteur actuel limite les cartes à quatre camps. Un 1 contre 3 occupe les quatre emplacements ; ajouter un cinquième camp allié à la journée 41 exige une évolution distincte. Pour cette carte, une arrivée sous le camp 0 est une relève narrative de la coalition, pas un cinquième joueur autonome. Si l’on veut réellement un nouveau partenaire autonome, commencer en 1 contre 2 avec le quatrième emplacement réservé, ou traiter la contre-offensive comme une autre mission.

## Cartes livrées et raccordement

Trois fichiers `content/cartes/carte_*.json`, statut `brouillon`, source `atlas_map`. Ils n’ajoutent aucune unité au catalogue 6 et aucun fichier graphique. Les coordonnées ci-dessous partent de zéro, x vers la droite, y vers le bas. Les coalitions sont des consignes de scénario : une carte seule ne les définit pas.

### `carte_detour_des_batteries` — côtier, 20 × 16

Camps alliés 0 et 1 contre 2. QG : 0 en (2,3), 1 en (2,12), 2 en (17,8). Usines : (3,3), (3,12), (16,8). Deux ponts en (10,4) et (10,11), raccordés à deux voies parallèles. Le blocage de l’un laisse l’autre accessible aux chenilles. Les villes centrales placent le choix économique avant le QG.

Chaque allié reçoit deux infanteries, un char léger et une artillerie. Le camp 2 reçoit la même base plus un recon et un deuxième char léger. Point de départ de réglage : fonds 0 = 4 000, 1 = 3 000, 2 = 9 000, revenus par propriété identiques. Ces nombres ne sont pas dans le JSON de carte et ne sont pas équilibrés par une simulation de victoire.

### `carte_ligne_de_nuit` — forêt, 20 × 16

0 et 1 contre 2 et 3. QG : 0 (2,3), 1 (2,12), 2 (17,12), 3 (17,3). Usines immédiatement vers le centre. Dotations identiques : deux infanteries, un char léger et un recon par camp. Deux routes traversantes y = 5 et y = 10, routes latérales x = 6 et x = 13 ; les équipes disposent de plusieurs entrées. Six villes neutres, terrain construit par symétrie centrale avant les implantations.

Réglage initial proposé : 4 000 fonds par camp, météo et brouillard identiques pour les deux coalitions. L’égalité des dotations est vérifiée ; l’égalité des chances avec des IA différentes ne l’est pas.

### `carte_quarantieme_releve` — désert, 24 × 18

0 contre 1, 2 et 3. QG : 0 (11,13), 1 (2,8), 2 (21,8), 3 (11,2). Le défenseur dispose de quatre villes, d’une usine et de sept unités, dont un char moyen et deux artilleries. Chaque assaillant dispose d’une usine et de trois unités. Entrées ouest, est, nord ; deux traversées horizontales doubles et une voie verticale double.

Zone de relève réservée au sud : x = 11 ou 12, y = 15, 16 ou 17, six cases routières libres au départ. Le scénario doit encore gérer l’occupation au moment d’un renfort. Point de départ : 6 000 fonds défenseur, 1 000 par assaillant ; éviter une production infinie de trois économies complètes pendant quarante jours. La carte ne crée ni vagues ni renforts à elle seule.

## Vérification livrée et limites

`tests/schemas/cartes-refonte.test.ts` vérifie les trois contrats MapDef, l’existence des unités, leurs terrains de départ, un QG attribué à chaque camp, les chemins entre QG à pied et en chenilles, la deuxième traversée des batteries, l’égalité de dotation de la ligne de nuit et la zone de relève. Six tests passent. La jouabilité humaine, la lisibilité artistique, les temps de partie et la victoire contre chaque IA restent à mesurer dans les scénarios intégrés.

Les budgets de triangles des unités sont suffisants pour tester ces cartes. Plus de triangles ne règle ni une silhouette ambiguë ni un temps d’attente entre quatre camps. Je demanderais d’abord une lecture claire du tube, du radar, de la chenille et du camp à l’échelle de jeu. La variété régionale doit venir des terrains, des compositions et des traits existants ; un nouveau GLB doit répondre à un nouveau rôle lisible.

## Intégration jouable du 9 septembre — essais distincts

Une seconde passe livre cinq scénarios `brouillon`, sans déplacer les six missions du carnet d’entraînement : `aube_batteries_2v1`, `aube_reserves_1v2`, `aube_nuit_2v2`, `aube_releve_1v3` et `aube_routes_3v1`. `/jeu` leur réserve une section **Essais Aube · coalitions**, avec le format réel et le statut non homologué ; les autres brouillons restent invisibles. La page existante `/jeu/[scenario]` charge leurs JSON sans nouveau service. La fiche du 2 contre 1 nomme Hadran comme adversaire, plutôt que Tomas, pourtant camp 1 et allié.

Deux variantes de carte (`carte_batteries_inversees`, `carte_routes_aube`) réemploient exactement une grille livrée en remappant les camps, propriétaires et unités : elles ne demandent aucune nouvelle géométrie. Les configurations couvrent les cinq formats demandés. Les commandants d’essai sont Ariane, Tomas, Hadran et Solveig ; leur participation à une coalition ne leur attribue pas automatiquement une appartenance clandestine.

Le siège ne verse aucun revenu périodique et part avec des budgets fixes. Trois réserves adverses sont programmées aux journées 10, 20 et 30 et annoncées la veille par des scènes de dialogue. Trois unités de relève rejoignent le camp 0 à la journée 41, avant l’évaluation de la victoire de survie. Il s’agit explicitement d’un détachement sous le contrôle du joueur, pas d’un cinquième camp. Les fonds par camp permettent d’exprimer les asymétries proposées plus haut sans modifier le prix des unités ni accorder un bonus caché à l’IA.

`tests/app/essais-aube.test.ts` couvre le chargement, les cinq coalitions, le premier cycle des camps, l’exposition limitée aux essais, le vrai adversaire du joueur et l’arrivée de la relève avant la conclusion. Le test de quarante journées ne commande aucun combat : il prouve l’horloge et le raccordement, jamais la facilité du siège.

### Simulation courte des essais

Contrôle du 9 septembre 2026, graine `aube:controle:1`, IA pondérée pour chaque camp, cinq journées complètes par scénario : les cinq parties atteignent la journée 6 sans fin prématurée et sans action refusée. Actions exécutées : batteries 148, réserves 149, nuit 170, relève 126, routes 184 — **777 actions légales**. Ce contrôle a d’abord révélé des arrivées sur une unité d’un autre camp allié ; la correction du filtre d’occupation IA a supprimé les dix refus observés au premier passage. `tests/ai/alliances.test.ts` garde une régression bornée : une infanterie ne peut pas choisir comme arrivée la ville déjà occupée par l’artillerie d’un partenaire.

Ces cinq journées vérifient les premiers combats et la circulation des coalitions. Elles ne démontrent ni une victoire à la journée 40 contre l’IA, ni la durée humaine, ni l’égalité des chances. Les cinq scénarios gardent donc leur statut d’essai.

### Essai complet du siège avant ajustement

Le même jour, quatre parties bornées à 41 journées ont été jouées, adversaires pondérés : joueur pondéré, graines `aube:siege:1` et `aube:siege:2`, défaites journée 9 (202 et 204 actions) ; joueur agressif, mêmes graines, défaites journées 18 et 20 (317 et 342 actions). Aucun ordre refusé. Les quatre défaites viennent de la perte de toutes les unités du camp 0. Avec 6 000 fonds de départ pour le défenseur, aucune démonstration automatique de survie à quarante journées n’est donc obtenue ; cet essai ne doit pas être présenté comme homologué.

### Ajustement et deux survies attestées

La hausse du budget défenseur à 18 000 seule ne suffisait pas : sur `aube:siege:1`, le joueur agressif perdait à la journée 14 (288 actions), le pondéré à la journée 10 (232 actions), toujours sans refus. Le réglage retenu conserve 18 000 fonds pour le camp 0, met les autres caisses à zéro — leurs unités de départ sont déjà présentes — et borne les réserves adverses à **une infanterie à J10, un recon à J20, une infanterie à J30**. Les annonces de la veille ont été corrigées avec les effectifs. Les trois fronts, les quarante journées, les cartes et l’absence de revenus sont conservés.

Sur ce réglage final et la graine `aube:siege:1`, le joueur agressif remporte l’objectif de survie à J41 après 479 actions ; le joueur pondéré le remporte également à J41 après 582 actions. Aucun ordre refusé dans les deux parties ; les trois unités de relève du camp 0 sont présentes avant la conclusion. Treize tests de données et raccordement ont été rejoués avec succès après l’ajustement.

C’est désormais une preuve de solution automatique complète, pas un calibrage humain. Les deux stratégies finissent par éliminer les autres équipes avant la conclusion de survie : le temps de maintien restant peut donc manquer de tension. La règle n’abrège pas silencieusement les quarante journées. Le scénario garde son étiquette d’essai ; un test humain doit encore juger le rythme et la longueur de cette branche facultative.
