# Opus 1 — Les douze parcours nationaux

**Statut : conception.** Les 144 fiches du JSON voisin sont un registre éditorial ; aucune n’est une nouvelle carte jouable. Les 10 tutoriels et les 18 rencontres finales portent le total cible à 172. Les quêtes secondaires proposées viennent en supplément et ne gonflent pas ce compte.

## Une campagne en trois saisons nationales

Les 24 nations du monde restent présentes. Les douze parcours de premier plan reprennent la sélection de `doc/17-aube.md` : France, Luxembourg, Suisse, Pays-Bas, Maroc, Sénégal, Brésil, Mexique, Inde, Japon, Australie, Indonésie. Chaque parcours comporte douze épisodes. La grille de publication est de trois saisons de quatre parcours ; les dix-huit finales constituent ensuite leur propre ensemble, dont la saison 2 épisode 4 porte le repli imposé. Les numéros de saison des deux ensembles ne doivent jamais être affichés sans leur libellé.

- Saison nationale 1 : France → Luxembourg → Suisse → Pays-Bas. Apprendre ce qu’une victoire attribue ; repérer le fournisseur commun.
- Saison nationale 2 : Maroc → Sénégal → Brésil → Mexique. Relier production solaire, stockage et transport ; rencontrer des équipes compromises capables de changer de position.
- Saison nationale 3 : Inde → Japon → Australie → Indonésie. Établir le lien avec Aube ; préparer les garanties et les moyens de la coalition finale.

La succession indiquée est une ossature de continuité, pas une obligation de jouer douze variantes du même duel. Les cartes devront varier relief, axes, positions de producteurs, distance au QG et visibilité. Les douze emplacements gardent leurs objectifs existants, mais ne doivent plus imposer le même récit de contrat et de preuves à chaque nation. La révision du 12 septembre 2026 reporte les 144 situations de `lore-v2.json` dans le JSON voisin. Chaque parcours porte désormais une relation distincte : Ariane et la confiance, Tomas et les promesses, Elsbeth et les accès, Lotte et une ancienne rivale, Samir et la relève, Awa et les équipes qui attendent, Lívia et l’autonomie, Inés et la revanche, Devika et une recherche incertaine, Ren et la vérification, Hazel et les limites, Ayu et la coalition choisie. Voir `lore-v2.md` pour les arcs complets. Ces scènes restent éditoriales et n’ajoutent aucune unité ni conséquence moteur.

## Famille et adversaires

Huit commandants adverses sont définis dans la bible parallèle. Les identifiants techniques ne sont jamais des noms d’affichage. Le public ne connaît ni le lien frère–sœur ni le lien père–fils pendant ces missions nationales. Toute réplique, biographie publique et prompt de mission doit utiliser la projection sans révélations. Edran intervient tôt comme prestataire logistique ; son action tardive pourra ainsi être comprise sans révéler sa paternité à sa première apparition. Le repli imposé appartient à la dixième finale, pas à un chapitre national.

Les ralliements concernent des responsables et des délégations identifiés, jamais une population présentée comme mauvaise. Les huit adversaires de la faction restent distincts de ces partenaires qui peuvent rompre, revenir sous audit ou persister. Aucun ralliement automatique ne doit annuler un choix déjà enregistré.

## Victoires et conséquences

Les fiches donnent un objectif principal unique : la liste des victoires moteur est un OU. Une escorte exige `proteger` avec destination et la défaite `unite_perdue`, pas une capture alternative qui court-circuiterait le transport. L’élimination exclusive omet `capture_qg`. Les objectifs relais, capture et maintien doivent recevoir leurs vraies coordonnées à la production de la carte. Une coalition utilise au plus quatre camps ; ses objectifs QG doivent être évalués à l’échelle de l’équipe.

Les décisions des épisodes 4, 8, 10 et 12 ont chacune une cible nommée, un effet borné et un retour dans le carnet. Les fonds ou renforts existent dans le moteur ; le raccordement des nouveaux identifiants, les drapeaux de ralliement et les quêtes restent à implémenter. Les choix ne donnent pas des unités nationales nouvelles : la reconnaissance provient du catalogue partagé. Les noms et cartes des quêtes sont des propositions, sans scénario accessible tant que leur production n’est pas terminée.

Normal et difficile conservent les mêmes enjeux. Les changements proposés sont annoncés : réserve finie, couverture supplémentaire ou crédit borné. Chaque carte doit ensuite être simulée dans les deux modes puis essayée humainement ; aucune fiche ne prétend fournir cette validation.

## Registre des épisodes

### FR — Les droits du vainqueur

1. **Premier courant** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Le bocage accueille une qualification où deux réseaux disputent le même transformateur.
2. **Les villes du contrat** — Capturer deux des trois bâtiments objectifs annoncés. Ariane découvre que les revenus promis excluent les équipes de maintenance.
3. **La voie de service** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un convoi transporte les batteries dues aux communes partenaires.
4. **Deux rives, un réseau** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La fermeture sportive d’un pont sépare les réserves de leurs utilisateurs.
5. **Le devis orange** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Ost prête du matériel dont les conditions de retour restent opaques.
6. **La journée sans crédit** — Tenir jusqu’à la fin de la journée 8 ; arrivée de la relève au début de la journée suivante. Le financement de la délégation est suspendu au milieu de l’épreuve.
7. **Les clairières témoins** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les relevés de puissance divergent entre trois postes forestiers.
8. **Ligne de partage** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Deux délégations françaises défendent des contrats incompatibles, sans représenter deux nations.
9. **La réserve commune** — Conserver les deux positions annoncées pendant trois journées consécutives. Ariane demande de garantir une réserve avant la rencontre décisive.
10. **Une signature de trop** — Capturer deux des trois bâtiments objectifs annoncés. Un avenant méridien associe victoire sportive et exclusivité de transport.
11. **Le contrat rendu public** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Deux spécialistes méridiens viennent défendre la même offre de concession, chacun sous son nom public.
12. **Une victoire à partager** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Le dernier QG contrôle l’attribution du réseau, pas le territoire ni ses habitants.

### LU — Les courants liés

1. **Le relais de Tomas** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Tomas accueille les batteries promises à la frontière de deux réseaux.
2. **Les trois aiguillages** — Capturer deux des trois bâtiments objectifs annoncés. Trois routes logistiques offrent des accès concurrents au dépôt central.
3. **Garantie de livraison** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport doit traverser la vallée avant la clôture du contrat.
4. **Le prix du retard** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un adversaire finance sa défense grâce aux jours perdus par le convoi.
5. **Deux équipes, deux caisses** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. La coopération révèle des fonds séparés et une vision partagée.
6. **La voie détournée** — Tenir jusqu’à la fin de la journée 10 ; arrivée de la relève au début de la journée suivante. Yuna change de front pour prendre les dépôts laissés sans couverture.
7. **Le registre partagé** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les équipes comparent leurs relevés à trois stations successives.
8. **Une offre de stabilité** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une délégation partenaire accepte un crédit du Consortium pour finir sa saison.
9. **Promesse sous pression** — Conserver les deux positions annoncées pendant trois journées consécutives. Tomas maintient une livraison à cette délégation malgré son ralliement.
10. **L’échéance de nuit** — Capturer deux des trois bâtiments objectifs annoncés. Le remboursement arrive pendant une épreuve sous brouillard.
11. **Le garant absent** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Basile refuse d’ouvrir les réserves qu’il s’était engagé à garantir.
12. **Le pacte des relais** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La victoire doit décider si le réseau repose sur une caisse commune ou des garanties séparées.

### CH — Les réserves hautes

1. **Le premier col** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une montée étroite oblige à couvrir les unités indirectes.
2. **La retenue froide** — Capturer deux des trois bâtiments objectifs annoncés. La réserve d’énergie alimente deux sites placés de part et d’autre du lac.
3. **Le carnet d’altitude** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Une équipe de mesure transporte des relevés contestés par Méridien.
4. **La route basse** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Le tracé court est exposé aux batteries de la commandante des unités indirectes.
5. **Le plateau verrouillé** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Basile verrouille une station radar sans occuper toute la carte.
6. **Le passage sans renfort** — Tenir jusqu’à la fin de la journée 12 ; arrivée de la relève au début de la journée suivante. Une fenêtre limitée de traversée impose de préserver les unités engagées.
7. **Échos dans les vallées** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Des relevés contradictoires doivent être recoupés dans trois relais.
8. **L’arbitre et le fournisseur** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une équipe locale suspend sa neutralité sportive pour payer sa maintenance.
9. **Les réserves de secours** — Conserver les deux positions annoncées pendant trois journées consécutives. Les secours contractuels arrivent après une défense de position limitée.
10. **La clause de restitution** — Capturer deux des trois bâtiments objectifs annoncés. Le joueur peut proposer une sortie au partenaire dépendant.
11. **Le col des deux équipes** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Deux adversaires tiennent des passages distincts et partagent leur vision.
12. **Le droit de passage** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Le gagnant fixe les garanties d’accès à la réserve pour les saisons suivantes.

### NL — Le réseau des digues

1. **Les carrés du polder** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Les voies surélevées découpent la carte en compartiments lisibles.
2. **L’usine derrière l’eau** — Capturer deux des trois bâtiments objectifs annoncés. Une usine centrale vaut davantage que le chemin le plus court vers le QG.
3. **Le convoi des pompes** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport de maintenance emprunte une digue sous surveillance.
4. **La digue partagée** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Deux partenaires doivent couvrir chacun une extrémité du passage.
5. **Fenêtre de marée** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Le calendrier de marée rend une route côtière disponible par périodes.
6. **L’atelier encerclé** — Tenir jusqu’à la fin de la journée 8 ; arrivée de la relève au début de la journée suivante. La production est limitée tandis que l’adversaire approche des deux côtés.
7. **Les trois écluses** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les relevés du réseau sont répartis entre trois postes accessibles par des routes différentes.
8. **La garantie privée** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une équipe signe avec Méridien pour assurer ses prochaines dépenses.
9. **Le terrain prêté** — Conserver les deux positions annoncées pendant trois journées consécutives. Son adversaire d’hier lui offre un passage de repli sans exiger de ralliement.
10. **Les comptes de la digue** — Capturer deux des trois bâtiments objectifs annoncés. Yuna essaie de prendre les centres de revenu pendant le regroupement.
11. **Le retour du garant** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Le signataire doit choisir publiquement entre l’accord et ses partenaires.
12. **Un réseau ouvert** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale décide des accès techniques communs, jamais du contrôle de la population.

### MA — Le prix du soleil

1. **Les ombres courtes** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Des plateaux découverts rendent coûteuse toute avance sans reconnaissance.
2. **L’atelier du sud** — Capturer deux des trois bâtiments objectifs annoncés. Deux axes relient les ateliers aux réserves du parc solaire fictif.
3. **La caravane technique** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Solveig accompagne un transport de pièces jusqu’au dépôt de contrôle.
4. **Le passage de roche** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un détour abrité concurrence une traversée rapide à découvert.
5. **Poussière de piste** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Le brouillard de guerre représente les relevés incomplets, sans inventer une météo non implémentée.
6. **Les crédits de midi** — Tenir jusqu’à la fin de la journée 10 ; arrivée de la relève au début de la journée suivante. Une avance méridienne permet à une équipe rivale d’aligner une réserve finie.
7. **Trois stations au soleil** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les mesures de trois relais révèlent une clause commune aux contrats.
8. **Le bail trop long** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un sponsor de délégation propose une exclusivité après la victoire.
9. **La réserve retenue** — Conserver les deux positions annoncées pendant trois journées consécutives. Le joueur défend le dépôt en attendant une livraison annoncée.
10. **Une sortie sans humiliation** — Capturer deux des trois bâtiments objectifs annoncés. La délégation dépendante reçoit une offre de renégociation publique.
11. **Les deux créanciers** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Ost et la commandante des unités indirectes défendent chacun une moitié du contrat litigieux.
12. **La concession limitée** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale fixe une durée et une garantie collective pour les concessions futures.

### SN — La traversée du soir

1. **La route de l’estuaire** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une route étroite longe des zones d’eau qui empêchent les attaques frontales.
2. **Les ateliers de rive** — Capturer deux des trois bâtiments objectifs annoncés. Les villes latérales financent une traversée autrement trop coûteuse.
3. **Dernière batterie du jour** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport apporte les réserves promises à l’équipe de nuit.
4. **Deux bras de fleuve** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Le joueur doit répartir ses forces sans laisser le centre découvert.
5. **Le radar de rive** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Wren teste la reconnaissance face au brouillage de Relais Zéro.
6. **Le quai sans relève** — Tenir jusqu’à la fin de la journée 12 ; arrivée de la relève au début de la journée suivante. Les renforts sont retardés par un contrat de transport contesté.
7. **La chaîne des reçus** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Trois relais permettent de vérifier la destination effective des batteries.
8. **Le partenaire impatient** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une délégation rejoint temporairement Méridien pour recevoir son équipement.
9. **La livraison maintenue** — Conserver les deux positions annoncées pendant trois journées consécutives. Le joueur décide de tenir ou non la promesse faite avant ce ralliement.
10. **Les témoins du quai** — Capturer deux des trois bâtiments objectifs annoncés. Yuna tente de reprendre le centre logistique pendant l’examen des reçus.
11. **Le match des garanties** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Les délégations mettent à l’épreuve l’accord négocié plutôt qu’une amitié abstraite.
12. **La réserve du soir** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale tranche entre revenus immédiats et sécurité du stockage collectif.

### BR — La forêt des contrats

1. **Les pistes jumelles** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Deux routes forestières rapprochent les QG sans autoriser une ligne de tir directe.
2. **L’atelier de lisière** — Capturer deux des trois bâtiments objectifs annoncés. La maîtrise des ateliers décide du rythme de production.
3. **La tournée de maintenance** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport circule entre des couloirs forestiers tenus par l’adversaire.
4. **Le pont du milieu** — Prendre tous les QG adverses nécessaires à la victoire de coalition. L’axe central paraît efficace mais expose les soutiens aux prises de flanc.
5. **Les relevés sous couvert** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Des drones observent un réseau où les unités terrestres profitent du couvert.
6. **L’avance engagée** — Tenir jusqu’à la fin de la journée 8 ; arrivée de la relève au début de la journée suivante. Une délégation a dépensé son crédit et doit finir le match avec une réserve limitée.
7. **Trois carnets concordants** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les pièces comptables sont recoupées dans trois stations de terrain.
8. **Le prêteur et l’équipe** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un sponsor cherche à parler au nom d’une nation entière ; le récit le contredit explicitement.
9. **Le dépôt sans privilège** — Conserver les deux positions annoncées pendant trois journées consécutives. Le joueur protège une réserve qui doit rester accessible à ses anciens rivaux.
10. **L’audit contesté** — Capturer deux des trois bâtiments objectifs annoncés. la commandante des unités indirectes veut gagner la rencontre avant la publication des contrats.
11. **L’alliance de lisière** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Deux équipes coopèrent sans fusionner leurs budgets ni leurs commandements.
12. **La règle de la réserve** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale institue ou refuse un contrôle partagé des achats futurs.

### MX — Les lignes du plateau

1. **La route du plateau** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Les pentes canalisent les véhicules dans deux vallées reliées.
2. **La ville d’aiguillage** — Capturer deux des trois bâtiments objectifs annoncés. Une ville centrale fait le lien entre revenus et voie de renfort.
3. **Le train sans rails** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Le transport routier suit un corridor ferroviaire décoratif, sans ajouter d’unité ferroviaire.
4. **Le verrou latéral** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une rampe secondaire permet de contourner la ligne de Basile.
5. **Le ciel du plateau** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. le commandant aérien montre le coût d’une défense privée d’intercepteurs.
6. **La réserve comptée** — Tenir jusqu’à la fin de la journée 10 ; arrivée de la relève au début de la journée suivante. La production ennemie est remplacée par une réserve finie annoncée au briefing.
7. **Trois permis concurrents** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Trois postes abritent des versions incompatibles d’un même permis d’accès.
8. **Le contrat de sécurité** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une équipe accepte une exclusivité en échange de sa participation au tournoi.
9. **Le passage accordé** — Conserver les deux positions annoncées pendant trois journées consécutives. Le joueur peut préserver une voie logistique pour un futur partenaire.
10. **Le reçu refusé** — Capturer deux des trois bâtiments objectifs annoncés. Le signataire découvre que son engagement ne garantit pas la livraison.
11. **La revanche du plateau** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Le partenaire choisit de rester fidèle au prêteur ou de demander une sortie.
12. **La limite du garant** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale borne les prérogatives du fournisseur sur le réseau.

### IN — Les réseaux superposés

1. **La première interconnexion** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un réseau dense propose plusieurs axes courts et des carrefours difficiles à couvrir.
2. **Les villes du relais** — Capturer deux des trois bâtiments objectifs annoncés. L’économie repose sur des bâtiments dispersés plutôt que sur un seul centre.
3. **Le lot de convertisseurs** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport doit rejoindre l’installation qui prépare les échanges avec Aube.
4. **La traversée urbaine** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Les positions de tir indirect concurrencent les itinéraires de capture.
5. **Le bulletin incomplet** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. La visibilité réduite donne un rôle décisif au drone et au radar.
6. **Le réseau en attente** — Tenir jusqu’à la fin de la journée 12 ; arrivée de la relève au début de la journée suivante. L’équipe doit tenir jusqu’à une remise à disposition contractuelle de renforts.
7. **Les trois protocoles** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Des relevés techniques relient enfin plusieurs offres au même bénéficiaire.
8. **L’option d’exclusivité** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une délégation accepte une clause pour sécuriser son accès aux essais Aube.
9. **Le test contradictoire** — Conserver les deux positions annoncées pendant trois journées consécutives. Le joueur maintient un test commun auquel participe encore cette délégation.
10. **Le droit de réponse** — Capturer deux des trois bâtiments objectifs annoncés. Le signataire reçoit une possibilité de retrait assortie de réparations concrètes.
11. **Les centres coordonnés** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Deux équipes méridiennes tiennent des centres séparés mais se ravitaillent.
12. **Le protocole ouvert** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale décide de publier ou de réserver les règles d’interconnexion, sans diffuser de secrets réels.

### JP — Le miroir des îles

1. **Le premier détroit** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une carte côtière met les accès terrestres sous surveillance aérienne.
2. **L’atelier des deux baies** — Capturer deux des trois bâtiments objectifs annoncés. Les deux baies financent des approches différentes du QG.
3. **Les instruments en transit** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport accompagne des instruments de mesure vers une équipe indépendante.
4. **Le pont de traverse** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une route longue donne accès au dos de la ligne adverse.
5. **Écran sans signal** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Relais Zéro masque sa doctrine derrière des drones brouillables.
6. **Le dernier créneau** — Tenir jusqu’à la fin de la journée 8 ; arrivée de la relève au début de la journée suivante. Une fenêtre de transport bornée impose une défense rapide sans tours d’attente.
7. **Les trois miroirs** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Trois relais révèlent une synchronisation des contrats méridiens.
8. **Le commandement sous licence** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Une équipe conserve ses couleurs nationales tout en signant un mandat privé.
9. **La mesure commune** — Conserver les deux positions annoncées pendant trois journées consécutives. Wren propose une vérification à laquelle le signataire peut encore participer.
10. **L’aveu technique** — Capturer deux des trois bâtiments objectifs annoncés. Les documents prouvent la dépendance contractuelle sans révéler l’identité de Relais Zéro.
11. **Les deux silhouettes** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Deux spécialistes méridiens coordonnent leurs appareils et leurs unités indirectes, sans révéler leur histoire privée.
12. **Le droit de vérifier** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale impose ou refuse un audit indépendant des réseaux d’Aube.

### AU — La distance des réserves

1. **La route longue** — Prendre tous les QG adverses nécessaires à la victoire de coalition. De longues liaisons font du ravitaillement une décision visible.
2. **Les ateliers dispersés** — Capturer deux des trois bâtiments objectifs annoncés. Les centres de production sont éloignés et demandent une réserve mobile.
3. **Le convoi sans détour** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport traverse un secteur découvert couvert par des reliefs ponctuels.
4. **La piste secondaire** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un chemin moins direct permet de déborder les tirs de la commandante des unités indirectes.
5. **Le relais lointain** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Une station radar vaut davantage qu’un investissement offensif immédiat.
6. **Les réserves annoncées** — Tenir jusqu’à la fin de la journée 10 ; arrivée de la relève au début de la journée suivante. Des renforts finis entrent par un axe déclaré, avec un temps de réaction suffisant.
7. **Les trois délais** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Les reçus montrent qu’un même prêteur a retardé plusieurs délégations.
8. **L’avance conditionnelle** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un responsable d’équipe accepte une exclusivité pour payer le prochain transfert.
9. **La promesse maintenue** — Conserver les deux positions annoncées pendant trois journées consécutives. Un ravitaillement commun teste la sincérité du partenaire compromis.
10. **Le coût de la sortie** — Capturer deux des trois bâtiments objectifs annoncés. La rupture du contrat impose de rendre un dépôt, pas d’abandonner une population.
11. **Le relais des alliés** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Trois camps alliés attaquent une défense concentrée sans empiler leurs unités.
12. **La réserve de coalition** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale décide des contributions à la coalition qui accompagnera Aube.

### ID — Les accès d’Aube

1. **L’île d’entrée** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un réseau d’îles reliées concentre les premières captures sur les accès.
2. **Les ateliers du détroit** — Capturer deux des trois bâtiments objectifs annoncés. Les revenus de rive déterminent quels passages peuvent être tenus.
3. **Le manifeste d’Aube** — Amener le transport désigné à la destination ; sa mise hors jeu fait perdre la mission. Un transport apporte les autorisations d’essai au dernier nœud d’interconnexion.
4. **Le pont des mandats** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Deux équipes contestent le même créneau sans contester la souveraineté nationale.
5. **La fenêtre de visibilité** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. La reconnaissance et le brouillage dévoilent des rotations méridiennes.
6. **Le quai fermé** — Tenir jusqu’à la fin de la journée 12 ; arrivée de la relève au début de la journée suivante. Le joueur tient une position tandis qu’un adversaire tente de reprendre l’accès.
7. **Les trois autorisations** — Faire passer une unité admissible sur les trois relais dans l’ordre indiqué. Trois relais rapprochent les contrats solaires du programme de fusion fictif.
8. **Le mandat de trop** — Prendre tous les QG adverses nécessaires à la victoire de coalition. Un partenaire révèle qu’il a accordé à Méridien le droit de voter à sa place.
9. **Le dernier engagement** — Conserver les deux positions annoncées pendant trois journées consécutives. La coalition doit honorer une livraison malgré le coût de cette révélation.
10. **Le vote rendu** — Capturer deux des trois bâtiments objectifs annoncés. Le partenaire peut récupérer son mandat ou maintenir son choix et devenir adversaire.
11. **La porte de la Manche** — Mettre hors jeu toutes les unités adverses ; aucune victoire alternative par capture du QG. Ost défend l’accès à la série finale et reconnaît publiquement l’enjeu Aube.
12. **La coalition au départ** — Prendre tous les QG adverses nécessaires à la victoire de coalition. La finale nationale fixe les alliés et garanties qui entrent dans les dix-huit dernières missions.


## Extension — technologie méridienne annoncée

Le drone marin, les stations IEM et la météo de simulation enrichissent les missions existantes sans changer les **172 missions ni les huit adversaires**. Les fichiers JSON identifient précisément les fiches concernées. Ces ajouts restent des intentions éditoriales tant que leurs cartes et paramètres ne sont pas validés.

La supériorité adverse vient du matériel et du placement. Les stations ont une position, une portée et un calendrier consultables avant engagement. Le joueur peut capturer la source, rejoindre un refuge ou se replier sur une route moins pénalisée. Le mode difficile renforce la défense et les patrouilles, jamais une portée ou activation cachée. Les nations adaptent leurs paysages et leurs stratégies sans immunités nationales implicites. Le forçage météo concerne le terrain de tournoi, pas le climat de populations réelles.

Aucune scène publique nouvelle ne révèle la fratrie ; les doctrines techniques ne fournissent aucun indice familial imposé. La révélation père-fils reste au pivot prévu, sans révéler le lien avec Lise.

Limite du premier essai : la capture interrompt la menace IEM adverse. La météo reste programmée ; sa commande par station capturable est une proposition ultérieure. Toute adaptation de camp est explicite dans le scénario et le briefing, jamais déduite secrètement du pays.

## Lecture des révélations et rappels

Les Gris sont nommés après le tutoriel 6, Ost au tutoriel 8, Consortium et Aube après le tutoriel 10, puis Cinquième Manche après Couleurs alliées. Les parcours nationaux donnent un sens vécu à ces noms ; ils ne les présentent pas comme quatre factions nouvelles. Les résumés et notes auteur ne deviennent jamais automatiquement des textes publics.

Un rappel de choix nomme la personne aidée et l’effet déjà déclaré. Il ne crée pas de renfort, fonds ou ralliement supplémentaire. Les situations réécrites restent alignées sur les 144 identifiants et les mêmes objectifs, variantes, options et conditions ; les nouvelles cartes restent à produire. Le parcours local compte toujours douze missions jouables.
