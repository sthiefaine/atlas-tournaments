# Opus 1 — le fil : chapitres, épisodes et hors-série

Généré par `node scripts/fil-opus1.mjs` depuis `opus1-tutoriels-final.json`, `opus1-nations.json` et `opus1-hors-serie.json`. **Ne pas éditer à la main** : corriger les registres, puis régénérer. Le numéro est la position dans la trame principale (1 à 172) ; un hors-série n'en a pas, il s'insère après l'épisode qui l'ouvre. Un ▭ (la plaque posée à plat) marque l'épisode où un chef de nation alliée disparaît (hors terrain, décision du propriétaire du 9 septembre 2026).

Trame principale : **172 épisodes** (10 exercices, 144 nationaux, 18 finales). Hors-série : **28**. Disparitions : **4**.


## Les dix exercices · Prologue

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 1 | **Premier contact**<br><small>`premier_contact`</small> | 1v1 | Déplacement, terrain, prévision et riposte. Mettre hors jeu les trois unités de Tomas. |  |  |
| 2 | **Les quatre villes**<br><small>`villes_du_bocage`</small> | 1v1 | Capture, revenus et soins. Posséder simultanément trois des quatre villes désignées. |  |  |
| 3 | **Le chantier des usines**<br><small>`chantier_des_usines`</small> | 1v1 | Production, génie et remise en service. Remettre en service et posséder les deux usines désignées. |  |  |
| 4 | **Le QG de la presqu’île**<br><small>`qg_de_la_presquile`</small> | 1v1 | Capture du QG, transport et marées. Capturer le QG adverse : quarante points. |  |  |
| 5 | **La bonne distance**<br><small>`opus1_tutoriel_05`</small> | 1v1 | Tir indirect et protection. Capturer le QG du plateau ou mettre hors jeu toute la défense. |  |  |
| 6 | **Au-delà des arbres**<br><small>`opus1_tutoriel_06`</small> | 1v1 | Brouillard, radar et drones ; aperçu du rayon annoncé d’une station IEM inactive, avant une première impulsion évitable. Capturer le radar central puis le QG adverse ; la prise du radar reste acquise dans le journal d’objectif. |  |  |
| 7 | **Le dernier kilomètre**<br><small>`opus1_tutoriel_07`</small> | 1v1 | Munitions, ravitaillement et transport ; variante maritime avec drone marin et quai de ravitaillement. Faire parvenir le transport désigné à la sortie nord en conservant au moins une unité de couverture. |  |  |
| 8 | **Une ligne commune**<br><small>`opus1_tutoriel_08`</small> | 1v1 | Équipes, vision partagée et caisses séparées. En équipe 2v1, capturer le QG adverse ou mettre hors jeu son armée. |  |  |
| 9 | **Le prix du courant**<br><small>`opus1_tutoriel_09`</small> | 1v1 | Énergie et concessions ; bulletin de pluie provoquée, capture de la station de contrôle. Capturer deux des trois postes de distribution représentés par des bâtiments existants. |  |  |
| 10 | **La première promesse**<br><small>`opus1_tutoriel_10`</small> | 1v1 | Synthèse et choix persistant. Capturer le QG adverse ou mettre hors jeu son armée ; protéger le transport est un objectif secondaire facultatif. |  |  |

## France — Les droits du vainqueur · Saison nationale 1

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 11 | **Premier courant**<br><small>`opus1_fr_01`</small> | 1v1 | Le bocage accueille une qualification où deux réseaux disputent le même transformateur. | Ariane Belloc |  |
| 12 | **Les villes du contrat**<br><small>`opus1_fr_02`</small> | 1v1 | Ariane découvre que les revenus promis excluent les équipes de maintenance. | Ariane Belloc |  |
| 13 | **La voie de service**<br><small>`opus1_fr_03`</small> | 1v2 | Un convoi transporte les batteries dues aux communes partenaires. | Ariane Belloc |  |
| 14 | **Deux rives, un réseau**<br><small>`opus1_fr_04`</small> | 2v1 | La fermeture sportive d’un pont sépare les réserves de leurs utilisateurs. | Ariane Belloc | Choix : Partager les relevés / Garder la réserve financière |
| 15 | **Le devis orange**<br><small>`opus1_fr_05`</small> | 1v1 | Ost prête du matériel dont les conditions de retour restent opaques. | Ariane Belloc, Hadran Ost |  |
| 16 | **La journée sans crédit**<br><small>`opus1_fr_06`</small> | 1v2 | Le financement de la délégation est suspendu au milieu de l’épreuve. | Ariane Belloc, Edran Sorel |  |
| 17 | **Les clairières témoins**<br><small>`opus1_fr_07`</small> | 1v1 | Les relevés de puissance divergent entre trois postes forestiers. | Ariane Belloc |  |
| 18 | **Ligne de partage**<br><small>`opus1_fr_08`</small> | 2v2 | Deux délégations françaises défendent des contrats incompatibles, sans représenter deux nations. | Ariane Belloc | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 19 | **La réserve commune**<br><small>`opus1_fr_09`</small> | 2v1 | Ariane demande de garantir une réserve avant la rencontre décisive. | Ariane Belloc |  |
| 20 | **Une signature de trop**<br><small>`opus1_fr_10`</small> | 1v2 | Un avenant méridien associe victoire sportive et exclusivité de transport. | Ariane Belloc | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 21 | **Le contrat rendu public**<br><small>`opus1_fr_11`</small> | 2v2 | Deux spécialistes méridiens viennent défendre la même offre de concession, chacun sous son nom public. | Ariane Belloc, Hadran Ost, Maël Orven, Lise Varen |  |
| 22 | **Une victoire à partager**<br><small>`opus1_fr_12`</small> | 3v1 | Le dernier QG contrôle l’attribution du réseau, pas le territoire ni ses habitants. | Ariane Belloc | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Luxembourg — Les courants liés · Saison nationale 1

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 23 | **Le relais de Tomas**<br><small>`opus1_lu_01`</small> | 1v1 | Tomas accueille les batteries promises à la frontière de deux réseaux. | Tomas Reiner |  |
| 24 | **Les trois aiguillages**<br><small>`opus1_lu_02`</small> | 1v1 | Trois routes logistiques offrent des accès concurrents au dépôt central. | Tomas Reiner |  |
| 25 | **Garantie de livraison**<br><small>`opus1_lu_03`</small> | 1v2 | Un transport doit traverser la vallée avant la clôture du contrat. | Tomas Reiner |  |
| 26 | **Le prix du retard**<br><small>`opus1_lu_04`</small> | 2v1 | Un adversaire finance sa défense grâce aux jours perdus par le convoi. | Tomas Reiner | Choix : Partager les relevés / Garder la réserve financière |
| 27 | **Deux équipes, deux caisses**<br><small>`opus1_lu_05`</small> | 1v1 | La coopération révèle des fonds séparés et une vision partagée. | Tomas Reiner, Hadran Ost |  |
| 28 | **La voie détournée**<br><small>`opus1_lu_06`</small> | 1v2 | Yuna change de front pour prendre les dépôts laissés sans couverture. | Tomas Reiner, Yuna Serrat, Edran Sorel |  |
| 29 | **Le registre partagé**<br><small>`opus1_lu_07`</small> | 1v1 | Les équipes comparent leurs relevés à trois stations successives. | Tomas Reiner |  |
| 30 | **Une offre de stabilité**<br><small>`opus1_lu_08`</small> | 2v2 | Une délégation partenaire accepte un crédit du Consortium pour finir sa saison. | Tomas Reiner | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **Le café avant le coup d’envoi**<br><small>`opus1_hs_gr_1`</small> | 1v1 | Nikos Delis ne joue jamais avant son café. Il reçoit le joueur sur un archipel relié par des môles, où les blindés restent au port, et lui montre qu’une méthode vaut mieux qu’un nouvel outil. | Nikos Delis | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_lu_08_decision","option":"a"},{"type":"compteur","cle":"monde.atlas.credibilite","min":3}]} |
| — | ↳ *HS* **La recrue au môle**<br><small>`opus1_hs_gr_2`</small> | 2v1 | Basile Kelm verrouille la réserve du port principal. Nikos et le joueur tiennent deux môles pendant trois journées, et Nikos doit décider s’il confie le passage des îles à sa recrue ou s’il reprend lui-même toute la préparation. | Nikos Delis, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.gr.qualifie"} |
| 31 | **Promesse sous pression**<br><small>`opus1_lu_09`</small> | 2v1 | Tomas maintient une livraison à cette délégation malgré son ralliement. | Tomas Reiner |  |
| 32 | **L’échéance de nuit**<br><small>`opus1_lu_10`</small> | 1v2 | Le remboursement arrive pendant une épreuve sous brouillard. | Tomas Reiner | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 33 | **Le garant absent**<br><small>`opus1_lu_11`</small> | 2v2 | Basile refuse d’ouvrir les réserves qu’il s’était engagé à garantir. | Tomas Reiner, Hadran Ost, Maël Orven, Lise Varen, Basile Kelm |  |
| 34 | **Le pacte des relais**<br><small>`opus1_lu_12`</small> | 3v1 | La victoire doit décider si le réseau repose sur une caisse commune ou des garanties séparées. | Tomas Reiner | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Suisse — Les réserves hautes · Saison nationale 1

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 35 | **Le premier col**<br><small>`opus1_ch_01`</small> | 1v1 | Une montée étroite oblige à couvrir les unités indirectes. | Solveig Tamm |  |
| 36 | **La retenue froide**<br><small>`opus1_ch_02`</small> | 1v1 | La réserve d’énergie alimente deux sites placés de part et d’autre du lac. | Solveig Tamm |  |
| 37 | **Le carnet d’altitude**<br><small>`opus1_ch_03`</small> | 1v2 | Une équipe de mesure transporte des relevés contestés par Méridien. | Solveig Tamm |  |
| 38 | **La route basse**<br><small>`opus1_ch_04`</small> | 2v1 | Le tracé court est exposé aux batteries de la commandante des unités indirectes. | Solveig Tamm | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **La même réserve vendue deux fois**<br><small>`opus1_hs_is_1`</small> | 1v1 | Elín Arnardóttir a comparé deux contrats qui vendent la même réserve à deux délégations. Elle invite le joueur sur la roche noire, de nuit, pour capturer deux des trois stations qui alimentent ces contrats, face à Yuna Serrat qui les gère. | Elín Arnardóttir, Yuna Serrat | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_ch_04_decision","option":"a"},{"type":"compteur","cle":"monde.atlas.soupcon","min":3}]} |
| 39 | **Le plateau verrouillé**<br><small>`opus1_ch_05`</small> | 1v1 | Basile verrouille une station radar sans occuper toute la carte. | Solveig Tamm, Hadran Ost, Basile Kelm |  |
| 40 | **Le passage sans renfort**<br><small>`opus1_ch_06`</small> | 1v2 | Une fenêtre limitée de traversée impose de préserver les unités engagées. | Solveig Tamm, Edran Sorel |  |
| 41 | **Échos dans les vallées**<br><small>`opus1_ch_07`</small> | 1v1 | Des relevés contradictoires doivent être recoupés dans trois relais. | Solveig Tamm |  |
| 42 | **L’arbitre et le fournisseur**<br><small>`opus1_ch_08`</small> | 2v2 | Une équipe locale suspend sa neutralité sportive pour payer sa maintenance. | Solveig Tamm | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **Le grand gel**<br><small>`opus1_hs_ca_1`</small> | 1v1 | Une pièce à badge orange est à l’essai, jouée par la Sélection Méridienne. Noémie Leduc exige que l’essai se joue sous les mêmes conditions pour les deux camps, et confie au joueur le banc de l’équipe témoin sur la carte gelée. | Noémie Leduc, Hadran Ost | Ouvert par : {"type":"ou","conditions":[{"type":"flag","cle":"monde.atlas.homologation_contestee"},{"type":"flag","cle":"monde.atlas.essai_soutenu"}]} |
| — | ↳ *HS* **Les provisions de la tempête**<br><small>`opus1_hs_ca_2`</small> | 2v2 | Une tempête est annoncée à deux journées. Noémie et le joueur tiennent deux ateliers d’essai contre Ost et Basile Kelm, qui veut faire compter la réserve de batteries comme une avance méridienne. | Noémie Leduc, Hadran Ost, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.ca.qualifie"} |
| 43 | **Les réserves de secours**<br><small>`opus1_ch_09`</small> | 2v1 | Les secours contractuels arrivent après une défense de position limitée. | Solveig Tamm |  |
| 44 | **La clause de restitution**<br><small>`opus1_ch_10`</small> | 1v2 | Le joueur peut proposer une sortie au partenaire dépendant. | Solveig Tamm | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| — | ↳ *HS* **Les ateliers d’altitude**<br><small>`opus1_hs_np_1`</small> | 1v1 | Rien de lourd ne monte ici. Mira Karki dispute au joueur deux des trois ateliers d’altitude, et montre ce qu’une équipe légère fait d’une pente quand elle voit loin depuis un point haut. | Mira Karki, Elsbeth Vonlanthen | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_ch_10_decision","option":"a"},{"type":"flag","cle":"pays.ch.rival_respecte"}]} |
| — | ↳ *HS* **Le pont de corde**<br><small>`opus1_hs_np_2`</small> | 2v1 | Un atelier isolé attend des pièces que la rotation des transports ne monte plus. Mira et le joueur escortent le transport contre Basile Kelm, qui tient le col et son dépôt ; Mira a demandé de l’aide tard, et le dit. Le joueur décide si l’on pose le pont de corde au-dessus de la gorge. | Mira Karki, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.np.qualifie"} |
| 45 | **Le col des deux équipes**<br><small>`opus1_ch_11`</small> | 2v2 | Deux adversaires tiennent des passages distincts et partagent leur vision. | Solveig Tamm, Hadran Ost, Maël Orven, Lise Varen |  |
| 46 | **Le droit de passage**<br><small>`opus1_ch_12`</small> | 3v1 | Le gagnant fixe les garanties d’accès à la réserve pour les saisons suivantes. | Solveig Tamm | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Pays-Bas — Le réseau des digues · Saison nationale 1

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 47 | **Les carrés du polder**<br><small>`opus1_nl_01`</small> | 1v1 | Les voies surélevées découpent la carte en compartiments lisibles. | Wren Osoko |  |
| 48 | **L’usine derrière l’eau**<br><small>`opus1_nl_02`</small> | 1v1 | Une usine centrale vaut davantage que le chemin le plus court vers le QG. | Wren Osoko |  |
| 49 | **Le convoi des pompes**<br><small>`opus1_nl_03`</small> | 1v2 | Un transport de maintenance emprunte une digue sous surveillance. | Wren Osoko |  |
| 50 | **La digue partagée**<br><small>`opus1_nl_04`</small> | 2v1 | Deux partenaires doivent couvrir chacun une extrémité du passage. | Wren Osoko | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **Fenêtre claire**<br><small>`opus1_hs_is_2`</small> | 1v2 | Trois stations de mesure dans le brouillard, dans l’ordre, pendant que Relais Zéro brouille et que Basile Kelm tient les hauteurs. Elín ne signera rien tant que chaque mesure n’est pas recoupée. | Elín Arnardóttir, Relais Zéro, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.is.qualifie"} |
| 51 | **Fenêtre de marée**<br><small>`opus1_nl_05`</small> | 1v1 | Le calendrier de marée rend une route côtière disponible par périodes. | Wren Osoko, Hadran Ost |  |
| 52 | **L’atelier encerclé**<br><small>`opus1_nl_06`</small> | 1v2 | La production est limitée tandis que l’adversaire approche des deux côtés. | Wren Osoko, Edran Sorel |  |
| 53 | **Les trois écluses**<br><small>`opus1_nl_07`</small> | 1v1 | Les relevés du réseau sont répartis entre trois postes accessibles par des routes différentes. | Wren Osoko |  |
| 54 | **La garantie privée**<br><small>`opus1_nl_08`</small> | 2v2 | Une équipe signe avec Méridien pour assurer ses prochaines dépenses. | Wren Osoko | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 55 | **Le terrain prêté**<br><small>`opus1_nl_09`</small> | 2v1 | Son adversaire d’hier lui offre un passage de repli sans exiger de ralliement. | Wren Osoko |  |
| 56 | **Les comptes de la digue**<br><small>`opus1_nl_10`</small> | 1v2 | Yuna essaie de prendre les centres de revenu pendant le regroupement. | Wren Osoko, Yuna Serrat | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 57 | **Le retour du garant**<br><small>`opus1_nl_11`</small> | 2v2 | Le signataire doit choisir publiquement entre l’accord et ses partenaires. | Wren Osoko, Hadran Ost, Maël Orven, Lise Varen |  |
| 58 | **Un réseau ouvert**<br><small>`opus1_nl_12`</small> | 3v1 | La finale décide des accès techniques communs, jamais du contrôle de la population. | Wren Osoko | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Maroc — Le prix du soleil · Saison nationale 2

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 59 | **Les ombres courtes**<br><small>`opus1_ma_01`</small> | 1v1 | Des plateaux découverts rendent coûteuse toute avance sans reconnaissance. | Ariane Belloc |  |
| 60 | **L’atelier du sud**<br><small>`opus1_ma_02`</small> | 1v1 | Deux axes relient les ateliers aux réserves du parc solaire fictif. | Ariane Belloc |  |
| 61 | **La caravane technique**<br><small>`opus1_ma_03`</small> | 1v2 | Solveig accompagne un transport de pièces jusqu’au dépôt de contrôle. | Ariane Belloc |  |
| 62 | **Le passage de roche**<br><small>`opus1_ma_04`</small> | 2v1 | Un détour abrité concurrence une traversée rapide à découvert. | Ariane Belloc | Choix : Partager les relevés / Garder la réserve financière |
| 63 | **Poussière de piste**<br><small>`opus1_ma_05`</small> | 1v1 | Le brouillard de guerre représente les relevés incomplets, sans inventer une météo non implémentée. | Ariane Belloc, Hadran Ost |  |
| 64 | **Les crédits de midi**<br><small>`opus1_ma_06`</small> | 1v2 | Une avance méridienne permet à une équipe rivale d’aligner une réserve finie. | Ariane Belloc, Edran Sorel |  |
| 65 | **Trois stations au soleil**<br><small>`opus1_ma_07`</small> | 1v1 | Les mesures de trois relais révèlent une clause commune aux contrats. | Ariane Belloc |  |
| 66 | **Le bail trop long**<br><small>`opus1_ma_08`</small> | 2v2 | Un sponsor de délégation propose une exclusivité après la victoire. | Ariane Belloc | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **Le silence de la source**<br><small>`opus1_hs_is_3`</small> | 2v2 | Les relevés sont recoupés. Elín et le joueur tiennent deux positions autour de la source chaude contre Ost et Yuna, et le joueur tranche : signaler l’anomalie maintenant, ou attendre une preuve de plus au risque de perdre le contrat. | Elín Arnardóttir, Hadran Ost, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.is.qualifie"} |
| 67 | **La réserve retenue**<br><small>`opus1_ma_09`</small> | 2v1 | Le joueur défend le dépôt en attendant une livraison annoncée. | Ariane Belloc |  |
| 68 | **Une sortie sans humiliation**<br><small>`opus1_ma_10`</small> | 1v2 | La délégation dépendante reçoit une offre de renégociation publique. | Ariane Belloc | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 69 | **Les deux créanciers**<br><small>`opus1_ma_11`</small> | 2v2 | Ost et la commandante des unités indirectes défendent chacun une moitié du contrat litigieux. | Ariane Belloc, Hadran Ost, Maël Orven, Lise Varen |  |
| 70 | **La concession limitée**<br><small>`opus1_ma_12`</small> | 3v1 | La finale fixe une durée et une garantie collective pour les concessions futures. | Ariane Belloc | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Sénégal — La traversée du soir · Saison nationale 2

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 71 | **La route de l’estuaire**<br><small>`opus1_sn_01`</small> | 1v1 | Une route étroite longe des zones d’eau qui empêchent les attaques frontales. | Tomas Reiner |  |
| 72 | **Les ateliers de rive**<br><small>`opus1_sn_02`</small> | 1v1 | Les villes latérales financent une traversée autrement trop coûteuse. | Tomas Reiner |  |
| 73 | **Dernière batterie du jour**<br><small>`opus1_sn_03`</small> | 1v2 | Un transport apporte les réserves promises à l’équipe de nuit. | Tomas Reiner |  |
| 74 | **Deux bras de fleuve**<br><small>`opus1_sn_04`</small> | 2v1 | Le joueur doit répartir ses forces sans laisser le centre découvert. | Tomas Reiner | Choix : Partager les relevés / Garder la réserve financière |
| 75 | **Le radar de rive**<br><small>`opus1_sn_05`</small> | 1v1 | Wren teste la reconnaissance face au brouillage de Relais Zéro. | Tomas Reiner, Hadran Ost, Relais Zéro |  |
| 76 | **Le quai sans relève**<br><small>`opus1_sn_06`</small> | 1v2 | Les renforts sont retardés par un contrat de transport contesté. | Tomas Reiner, Edran Sorel |  |
| 77 | **La chaîne des reçus**<br><small>`opus1_sn_07`</small> | 1v1 | Trois relais permettent de vérifier la destination effective des batteries. | Tomas Reiner |  |
| 78 | **Le partenaire impatient**<br><small>`opus1_sn_08`</small> | 2v2 | Une délégation rejoint temporairement Méridien pour recevoir son équipement. | Tomas Reiner | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **Le match de trois heures**<br><small>`opus1_hs_ke_1`</small> | 1v1 | Kito Njoroge ne gagne jamais avant la dixième journée. Sur les hauts plateaux, le joueur doit tenir quatorze journées face à une équipe qui court plus loin que la sienne et attend qu’il s’épuise. | Kito Njoroge, Awa Diagne | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_sn_08_decision","option":"a"},{"type":"flag","cle":"pays.sn.rival_respecte"}]} |
| — | ↳ *HS* **Le messager**<br><small>`opus1_hs_ke_2`</small> | 2v1 | Un messager à pied doit franchir la vallée par trois relais pendant que Yuna Serrat déplace ses petites équipes de capture. Kito demande au joueur s’il faut céder l’avance pour garder une relève, ou soutenir tout de suite le partenaire qui appelle. | Kito Njoroge, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.ke.qualifie"} |
| 79 | **La livraison maintenue**<br><small>`opus1_sn_09`</small> | 2v1 | Le joueur décide de tenir ou non la promesse faite avant ce ralliement. | Tomas Reiner |  |
| 80 | **Les témoins du quai**<br><small>`opus1_sn_10`</small> | 1v2 | Yuna tente de reprendre le centre logistique pendant l’examen des reçus. | Tomas Reiner, Yuna Serrat | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 81 | **Le match des garanties**<br><small>`opus1_sn_11`</small> | 2v2 | Les délégations mettent à l’épreuve l’accord négocié plutôt qu’une amitié abstraite. | Tomas Reiner, Hadran Ost, Maël Orven, Lise Varen |  |
| 82 | **La réserve du soir**<br><small>`opus1_sn_12`</small> | 3v1 | La finale tranche entre revenus immédiats et sécurité du stockage collectif. | Tomas Reiner | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Brésil — La forêt des contrats · Saison nationale 2

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 83 | **Les pistes jumelles**<br><small>`opus1_br_01`</small> | 1v1 | Deux routes forestières rapprochent les QG sans autoriser une ligne de tir directe. | Solveig Tamm |  |
| 84 | **L’atelier de lisière**<br><small>`opus1_br_02`</small> | 1v1 | La maîtrise des ateliers décide du rythme de production. | Solveig Tamm |  |
| 85 | **La tournée de maintenance**<br><small>`opus1_br_03`</small> | 1v2 | Un transport circule entre des couloirs forestiers tenus par l’adversaire. | Solveig Tamm |  |
| 86 | **Le pont du milieu**<br><small>`opus1_br_04`</small> | 2v1 | L’axe central paraît efficace mais expose les soutiens aux prises de flanc. | Solveig Tamm | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **La route à péage**<br><small>`opus1_hs_ar_1`</small> | 1v1 | Une seule route traverse la pampa entre les deux QG, et un fournisseur y a posé un dépôt sous licence exclusive. Leandro Paz veut montrer qu’on gagne par les chemins de traverse, et le prouve contre le joueur. | Leandro Paz, Lívia Moura | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_br_04_decision","option":"a"},{"type":"flag","cle":"pays.br.rival_respecte"}]} |
| — | ↳ *HS* **Le chenal du delta**<br><small>`opus1_hs_ar_2`</small> | 2v1 | Un club du delta a perdu son accès aux batteries quand la route unique est passée sous licence. Leandro et le joueur escortent le transport par les bras d’eau, face à Yuna Serrat qui gère la concession au nom d’un mandat provisoire. | Leandro Paz, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.ar.qualifie"} |
| 87 | **Les relevés sous couvert**<br><small>`opus1_br_05`</small> | 1v1 | Des drones observent un réseau où les unités terrestres profitent du couvert. | Solveig Tamm, Hadran Ost |  |
| 88 | **L’avance engagée**<br><small>`opus1_br_06`</small> | 1v2 | Une délégation a dépensé son crédit et doit finir le match avec une réserve limitée. | Solveig Tamm, Edran Sorel |  |
| 89 | **Trois carnets concordants**<br><small>`opus1_br_07`</small> | 1v1 | Les pièces comptables sont recoupées dans trois stations de terrain. | Solveig Tamm |  |
| 90 | **Le prêteur et l’équipe**<br><small>`opus1_br_08`</small> | 2v2 | Un sponsor cherche à parler au nom d’une nation entière ; le récit le contredit explicitement. | Solveig Tamm | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 91 | **Le dépôt sans privilège**<br><small>`opus1_br_09`</small> | 2v1 | Le joueur protège une réserve qui doit rester accessible à ses anciens rivaux. | Solveig Tamm |  |
| 92 | **L’audit contesté**<br><small>`opus1_br_10`</small> | 1v2 | la commandante des unités indirectes veut gagner la rencontre avant la publication des contrats. | Solveig Tamm | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 93 | **L’alliance de lisière**<br><small>`opus1_br_11`</small> | 2v2 | Deux équipes coopèrent sans fusionner leurs budgets ni leurs commandements. | Solveig Tamm, Hadran Ost, Maël Orven, Lise Varen |  |
| 94 | **La règle de la réserve**<br><small>`opus1_br_12`</small> | 3v1 | La finale institue ou refuse un contrôle partagé des achats futurs. | Solveig Tamm | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Mexique — Les lignes du plateau · Saison nationale 2

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 95 | **La route du plateau**<br><small>`opus1_mx_01`</small> | 1v1 | Les pentes canalisent les véhicules dans deux vallées reliées. | Wren Osoko |  |
| 96 | **La ville d’aiguillage**<br><small>`opus1_mx_02`</small> | 1v1 | Une ville centrale fait le lien entre revenus et voie de renfort. | Wren Osoko |  |
| 97 | **Le train sans rails**<br><small>`opus1_mx_03`</small> | 1v2 | Le transport routier suit un corridor ferroviaire décoratif, sans ajouter d’unité ferroviaire. | Wren Osoko |  |
| 98 | **Le verrou latéral**<br><small>`opus1_mx_04`</small> | 2v1 | Une rampe secondaire permet de contourner la ligne de Basile. | Wren Osoko, Basile Kelm | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **Le passage commun**<br><small>`opus1_hs_pe_1`</small> | 1v1 | Trois étages en une carte, et pas de route entre eux tant qu’on ne l’a pas bâtie. Luz Quispe dispute au joueur le QG de l’altiplano : le premier génie qui relie ses étages gagne le tempo. | Luz Quispe, Inés Valdés | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_mx_04_decision","option":"a"},{"type":"flag","cle":"monde.atlas.homologation_contestee"}]} |
| — | ↳ *HS* **Le marché d’en haut**<br><small>`opus1_hs_pe_2`</small> | 2v1 | Un transport de pièces doit monter au marché d’en haut par une route que le génie bâtit devant lui, pendant qu’Ost fait avancer ses chenilles sous couverture. Luz protège les bâtisseurs, le joueur protège le transport. | Luz Quispe, Hadran Ost | Ouvert par : {"type":"flag","cle":"pays.pe.qualifie"} |
| 99 | **Le ciel du plateau**<br><small>`opus1_mx_05`</small> | 1v1 | le commandant aérien montre le coût d’une défense privée d’intercepteurs. | Wren Osoko, Hadran Ost |  |
| 100 | **La réserve comptée**<br><small>`opus1_mx_06`</small> | 1v2 | La production ennemie est remplacée par une réserve finie annoncée au briefing. | Wren Osoko, Edran Sorel |  |
| 101 | **Trois permis concurrents**<br><small>`opus1_mx_07`</small> | 1v1 | Trois postes abritent des versions incompatibles d’un même permis d’accès. | Wren Osoko |  |
| 102 | **Le contrat de sécurité**<br><small>`opus1_mx_08`</small> | 2v2 | Une équipe accepte une exclusivité en échange de sa participation au tournoi. | Wren Osoko | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 103 | **Le passage accordé**<br><small>`opus1_mx_09`</small> | 2v1 | Le joueur peut préserver une voie logistique pour un futur partenaire. | Wren Osoko |  |
| 104 | **Le reçu refusé**<br><small>`opus1_mx_10`</small> | 1v2 | Le signataire découvre que son engagement ne garantit pas la livraison. | Wren Osoko | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| — | ↳ *HS* **Le grand galop**<br><small>`opus1_hs_mn_1`</small> | 1v1 | La plus grande carte de l’opus, presque sans obstacle. Saran Bat propose une course d’avant-match, puis un match où seule la reconnaissance décide de qui frappe le premier. | Saran Bat, Inés Valdés | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_mx_10_decision","option":"b"},{"type":"decision","cle":"opus1_mx_08_decision","option":"b"}]} |
| — | ↳ *HS* **Le point de ravitaillement déplacé**<br><small>`opus1_hs_mn_2`</small> | 2v2 | Saran annonce à tous ses partenaires qu’elle change de point de ravitaillement à mi-parcours. Avec le joueur, elle doit capturer deux des trois dépôts que Ost et Basile Kelm tiennent, et choisir entre poursuivre l’ouverture ou revenir couvrir la réserve commune. | Saran Bat, Hadran Ost, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.mn.qualifie"} |
| 105 | **La revanche du plateau**<br><small>`opus1_mx_11`</small> | 2v2 | Le partenaire choisit de rester fidèle au prêteur ou de demander une sortie. | Wren Osoko, Hadran Ost, Maël Orven, Lise Varen |  |
| 106 | **La limite du garant**<br><small>`opus1_mx_12`</small> | 3v1 | La finale borne les prérogatives du fournisseur sur le réseau. | Wren Osoko | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Inde — Les réseaux superposés · Saison nationale 3

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 107 | **La première interconnexion**<br><small>`opus1_in_01`</small> | 1v1 | Un réseau dense propose plusieurs axes courts et des carrefours difficiles à couvrir. | Ariane Belloc |  |
| 108 | **Les villes du relais**<br><small>`opus1_in_02`</small> | 1v1 | L’économie repose sur des bâtiments dispersés plutôt que sur un seul centre. | Ariane Belloc |  |
| 109 | **Le lot de convertisseurs**<br><small>`opus1_in_03`</small> | 1v2 | Un transport doit rejoindre l’installation qui prépare les échanges avec Aube. | Ariane Belloc |  |
| 110 | **La traversée urbaine**<br><small>`opus1_in_04`</small> | 2v1 | Les positions de tir indirect concurrencent les itinéraires de capture. | Ariane Belloc | Choix : Partager les relevés / Garder la réserve financière |
| 111 | **Le bulletin incomplet**<br><small>`opus1_in_05`</small> | 1v1 | La visibilité réduite donne un rôle décisif au drone et au radar. | Ariane Belloc, Hadran Ost |  |
| 112 | **Le réseau en attente**<br><small>`opus1_in_06`</small> | 1v2 | L’équipe doit tenir jusqu’à une remise à disposition contractuelle de renforts. | Ariane Belloc, Edran Sorel |  |
| 113 | **Les trois protocoles**<br><small>`opus1_in_07`</small> | 1v1 | Des relevés techniques relient enfin plusieurs offres au même bénéficiaire. | Ariane Belloc |  |
| 114 | **L’option d’exclusivité**<br><small>`opus1_in_08`</small> | 2v2 | Une délégation accepte une clause pour sécuriser son accès aux essais Aube. | Ariane Belloc | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **La querelle d’altitude**<br><small>`opus1_hs_pe_3`</small> | 2v2 | Basile Kelm et Yuna Serrat tiennent deux des trois postes du col, dont l’altitude réelle est contestée depuis une Ronde. Luz et le joueur les disputent, et Luz doit décider si sa réserve va au passage commun ou à son propre équipement. | Luz Quispe, Basile Kelm, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.pe.qualifie"} |
| 115 | **Le test contradictoire**<br><small>`opus1_in_09`</small> | 2v1 | Le joueur maintient un test commun auquel participe encore cette délégation. | Ariane Belloc |  |
| 116 | **Le droit de réponse**<br><small>`opus1_in_10`</small> | 1v2 | Le signataire reçoit une possibilité de retrait assortie de réparations concrètes. | Ariane Belloc | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 117 | **Les centres coordonnés**<br><small>`opus1_in_11`</small> | 2v2 | Deux équipes méridiennes tiennent des centres séparés mais se ravitaillent. | Ariane Belloc, Hadran Ost, Maël Orven, Lise Varen |  |
| 118 | **Le protocole ouvert**<br><small>`opus1_in_12`</small> | 3v1 | La finale décide de publier ou de réserver les règles d’interconnexion, sans diffuser de secrets réels. | Ariane Belloc, Sélène Veyr | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Japon — Le miroir des îles · Saison nationale 3

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 119 | **Le premier détroit**<br><small>`opus1_jp_01`</small> | 1v1 | Une carte côtière met les accès terrestres sous surveillance aérienne. | Tomas Reiner |  |
| 120 | **L’atelier des deux baies**<br><small>`opus1_jp_02`</small> | 1v1 | Les deux baies financent des approches différentes du QG. | Tomas Reiner |  |
| 121 | **Les instruments en transit**<br><small>`opus1_jp_03`</small> | 1v2 | Un transport accompagne des instruments de mesure vers une équipe indépendante. | Tomas Reiner |  |
| 122 | **Le pont de traverse**<br><small>`opus1_jp_04`</small> | 2v1 | Une route longue donne accès au dos de la ligne adverse. | Tomas Reiner | Choix : Partager les relevés / Garder la réserve financière |
| 123 | **Écran sans signal**<br><small>`opus1_jp_05`</small> | 1v1 | Relais Zéro masque sa doctrine derrière des drones brouillables. | Tomas Reiner, Hadran Ost, Relais Zéro |  |
| 124 | **Le dernier créneau**<br><small>`opus1_jp_06`</small> | 1v2 | Une fenêtre de transport bornée impose une défense rapide sans tours d’attente. | Tomas Reiner, Edran Sorel |  |
| 125 | **Les trois miroirs**<br><small>`opus1_jp_07`</small> | 1v1 | Trois relais révèlent une synchronisation des contrats méridiens. | Tomas Reiner |  |
| 126 | **Le commandement sous licence**<br><small>`opus1_jp_08`</small> | 2v2 | Une équipe conserve ses couleurs nationales tout en signant un mandat privé. | Tomas Reiner | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 127 | **La mesure commune**<br><small>`opus1_jp_09`</small> | 2v1 | Wren propose une vérification à laquelle le signataire peut encore participer. | Tomas Reiner |  |
| 128 | **L’aveu technique**<br><small>`opus1_jp_10`</small> | 1v2 | Les documents prouvent la dépendance contractuelle sans révéler l’identité de Relais Zéro. | Tomas Reiner, Relais Zéro | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 129 | **Les deux silhouettes**<br><small>`opus1_jp_11`</small> | 2v2 | Deux spécialistes méridiens coordonnent leurs appareils et leurs unités indirectes, sans révéler leur histoire privée. | Tomas Reiner, Hadran Ost, Maël Orven, Lise Varen |  |
| 130 | **Le droit de vérifier**<br><small>`opus1_jp_12`</small> | 3v1 | La finale impose ou refuse un audit indépendant des réseaux d’Aube. | Tomas Reiner, Sélène Veyr | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Australie — La distance des réserves · Saison nationale 3

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 131 | **La route longue** ▭<br><small>`opus1_au_01`</small> | 1v1 | De longues liaisons font du ravitaillement une décision visible. — *Disparition de Samir El Hadi.* | Solveig Tamm |  |
| 132 | **Les ateliers dispersés**<br><small>`opus1_au_02`</small> | 1v1 | Les centres de production sont éloignés et demandent une réserve mobile. | Solveig Tamm |  |
| 133 | **Le convoi sans détour**<br><small>`opus1_au_03`</small> | 1v2 | Un transport traverse un secteur découvert couvert par des reliefs ponctuels. | Solveig Tamm |  |
| 134 | **La piste secondaire**<br><small>`opus1_au_04`</small> | 2v1 | Un chemin moins direct permet de déborder les tirs de la commandante des unités indirectes. | Solveig Tamm | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **Ce que la brume efface**<br><small>`opus1_hs_na_1`</small> | 1v1 | Chaque matin la brume côtière tombe et efface tout. Amalie Haoses fait tourner ses observateurs au lieu de les échanger contre une attaque, et le joueur apprend qu’à découvert, sur la dune, personne n’a de couvert. | Amalie Haoses, Hazel Quinn | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_au_04_decision","option":"a"},{"type":"flag","cle":"pays.mn.rival_respecte"}]} |
| — | ↳ *HS* **Le passage révélé**<br><small>`opus1_hs_na_2`</small> | 1v3 | Les observateurs d’Amalie ont trouvé la seule fenêtre dans la brume. Le joueur décide si elle la révèle à tous ou la garde pour son équipe, puis tient deux positions pendant que Relais Zéro, Basile Kelm et une délégation sous mandat viennent la disputer. | Amalie Haoses, Relais Zéro, Basile Kelm | Ouvert par : {"type":"flag","cle":"pays.na.qualifie"} |
| 135 | **Le relais lointain**<br><small>`opus1_au_05`</small> | 1v1 | Une station radar vaut davantage qu’un investissement offensif immédiat. | Solveig Tamm, Hadran Ost |  |
| 136 | **Les réserves annoncées**<br><small>`opus1_au_06`</small> | 1v2 | Des renforts finis entrent par un axe déclaré, avec un temps de réaction suffisant. | Solveig Tamm, Edran Sorel |  |
| 137 | **Les trois délais**<br><small>`opus1_au_07`</small> | 1v1 | Les reçus montrent qu’un même prêteur a retardé plusieurs délégations. | Solveig Tamm |  |
| 138 | **L’avance conditionnelle**<br><small>`opus1_au_08`</small> | 2v2 | Un responsable d’équipe accepte une exclusivité pour payer le prochain transfert. | Solveig Tamm | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| 139 | **La promesse maintenue**<br><small>`opus1_au_09`</small> | 2v1 | Un ravitaillement commun teste la sincérité du partenaire compromis. | Solveig Tamm |  |
| 140 | **Le coût de la sortie**<br><small>`opus1_au_10`</small> | 1v2 | La rupture du contrat impose de rendre un dépôt, pas d’abandonner une population. | Solveig Tamm | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| — | ↳ *HS* **Le dépôt rendu**<br><small>`opus1_hs_nz_1`</small> | 1v1 | Un dépôt rendu à la fin d’un contrat est revenu désaffecté. Tess Roa dispute au joueur la remise en service de deux des trois postes de la vallée, dans la brume, avec le génie pour seule pièce qui compte. | Tess Roa, Hazel Quinn | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_au_10_decision","option":"a"},{"type":"flag","cle":"pays.fj.rival_respecte"}]} |
| — | ↳ *HS* **La ligne de fougère**<br><small>`opus1_hs_nz_2`</small> | 1v2 | Tess prête son terrain et sa ligne au joueur, seul face à Ost et Yuna Serrat, pendant que son équipe répare. Le joueur tranche si le dépôt réparé sert à tous ou si le matériel est réservé à la prochaine manche. | Tess Roa, Hadran Ost, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.nz.qualifie"} |
| 141 | **Le relais des alliés**<br><small>`opus1_au_11`</small> | 2v2 | Trois camps alliés attaquent une défense concentrée sans empiler leurs unités. | Solveig Tamm, Hadran Ost, Maël Orven, Lise Varen |  |
| 142 | **La réserve de coalition**<br><small>`opus1_au_12`</small> | 3v1 | La finale décide des contributions à la coalition qui accompagnera Aube. | Solveig Tamm, Sélène Veyr | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Indonésie — Les accès d’Aube · Saison nationale 3

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 143 | **L’île d’entrée**<br><small>`opus1_id_01`</small> | 1v1 | Un réseau d’îles reliées concentre les premières captures sur les accès. | Wren Osoko |  |
| 144 | **Les ateliers du détroit**<br><small>`opus1_id_02`</small> | 1v1 | Les revenus de rive déterminent quels passages peuvent être tenus. | Wren Osoko |  |
| 145 | **Le manifeste d’Aube**<br><small>`opus1_id_03`</small> | 1v2 | Un transport apporte les autorisations d’essai au dernier nœud d’interconnexion. | Wren Osoko |  |
| 146 | **Le pont des mandats**<br><small>`opus1_id_04`</small> | 2v1 | Deux équipes contestent le même créneau sans contester la souveraineté nationale. | Wren Osoko | Choix : Partager les relevés / Garder la réserve financière |
| — | ↳ *HS* **Le lagon sans transport**<br><small>`opus1_hs_fj_1`</small> | 1v2 | Le transport d’un club du lagon a été retenu par un fournisseur pour une facture contestée. Jone Vakalau prête le sien au joueur, qui doit ramener l’équipement du club à travers les eaux peu profondes, contre Yuna Serrat et une délégation sous mandat. | Jone Vakalau, Yuna Serrat | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_id_04_decision","option":"a"},{"type":"flag","cle":"pays.nz.rival_respecte"}]} |
| — | ↳ *HS* **La chaîne de passes**<br><small>`opus1_hs_fj_2`</small> | 2v1 | Trois relais d’un bout à l’autre du lagon, sous des drones que Relais Zéro fait tourner. Jone propose un raccourci par le récif ; le joueur décide s’il le tente ou s’il garantit le retour de tout l’équipement. | Jone Vakalau, Relais Zéro | Ouvert par : {"type":"flag","cle":"pays.fj.qualifie"} |
| 147 | **La fenêtre de visibilité**<br><small>`opus1_id_05`</small> | 1v1 | La reconnaissance et le brouillage dévoilent des rotations méridiennes. | Wren Osoko, Hadran Ost |  |
| 148 | **Le quai fermé**<br><small>`opus1_id_06`</small> | 1v2 | Le joueur tient une position tandis qu’un adversaire tente de reprendre l’accès. | Wren Osoko, Edran Sorel |  |
| 149 | **Les trois autorisations**<br><small>`opus1_id_07`</small> | 1v1 | Trois relais rapprochent les contrats solaires du programme de fusion fictif. | Wren Osoko |  |
| 150 | **Le mandat de trop**<br><small>`opus1_id_08`</small> | 2v2 | Un partenaire révèle qu’il a accordé à Méridien le droit de voter à sa place. | Wren Osoko | Choix : Garantir la livraison au signataire / Refuser de garantir son crédit |
| — | ↳ *HS* **L’inventaire des pistes**<br><small>`opus1_hs_mg_1`</small> | 1v1 | Tiana Ravel a cartographié chaque piste rouge de l’île et nomme les espèces en pleine partie. Elle met le joueur à l’épreuve sur une carte qu’elle connaît par cœur, sous couvert et sous brouillard. | Tiana Ravel, Ayu Pranata | Ouvert par : {"type":"ou","conditions":[{"type":"decision","cle":"opus1_id_04_decision","option":"a"},{"type":"compteur","cle":"monde.atlas.credibilite","min":4}]} |
| — | ↳ *HS* **Les cartes ouvertes**<br><small>`opus1_hs_mg_2`</small> | 2v1 | Relais Zéro a installé trois relais sur les pistes de l’atelier de Tiana, et Yuna en revendique la gestion. Tiana et le joueur les parcourent dans l’ordre ; à la fin, le joueur tranche si elle ouvre ses cartes à un rival ou protège le travail de son atelier. | Tiana Ravel, Relais Zéro, Yuna Serrat | Ouvert par : {"type":"flag","cle":"pays.mg.qualifie"} |
| 151 | **Le dernier engagement**<br><small>`opus1_id_09`</small> | 2v1 | La coalition doit honorer une livraison malgré le coût de cette révélation. | Wren Osoko |  |
| 152 | **Le vote rendu**<br><small>`opus1_id_10`</small> | 1v2 | Le partenaire peut récupérer son mandat ou maintenir son choix et devenir adversaire. | Wren Osoko | Choix : Accepter un retour sous audit / Exiger la fin préalable du mandat privé |
| 153 | **La porte de la Manche**<br><small>`opus1_id_11`</small> | 2v2 | Ost défend l’accès à la série finale et reconnaît publiquement l’enjeu Aube. | Wren Osoko, Hadran Ost, Maël Orven, Lise Varen |  |
| 154 | **La coalition au départ**<br><small>`opus1_id_12`</small> | 3v1 | La finale nationale fixe les alliés et garanties qui entrent dans les dix-huit dernières missions. | Wren Osoko, Sélène Veyr | Choix : Verser une réserve à la coalition / Financer la préparation locale |

## Finales — saison 1 · Saison globale 4

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 155 | **Les portes du réseau**<br><small>`opus1_finale_01`</small> | 2v1 | Port fluvial ; deux ponts distants, ateliers centraux. — Les Gris assument leur rattachement à la Cinquième Manche. | Hadran Ost | Choix : Ouvrir le port aux délégations hésitantes ou réserver les quais à la coalition. |
| 156 | **La taxe des sommets**<br><small>`opus1_finale_02`</small> | 1v1 | Trois crêtes, chemins de traverse, radar exposé. — Basile applique un contrat de priorité qui coupe les petites délégations. | Basile Kelm | Choix : Maintenir les relais publics ou emporter les batteries mobiles. |
| — | ↳ *HS* **Le banc du port** ▭<br><small>`opus1_hs_gr_3`</small> | 2v1 | La plaque de la Grèce est posée à plat sur la tablette du Tableau. Le banc grec joue quand même sa rencontre contre Basile Kelm : avec la recrue de Nikos et sa méthode, ou avec un intérim de la fédération qui ne connaît pas les môles. — *Disparition de Nikos Delis.* | Nikos Delis, Basile Kelm, Célestin Vantour, Solveig Tamm | Ouvert par : {"type":"flag","cle":"pays.gr.qualifie"} |
| 157 | **Le ciel verrouillé**<br><small>`opus1_finale_03`</small> | 1v2 | Plaine aéroportuaire, hangars bas et haies. — Maël Orven impose son rythme aérien ; ses liens familiaux ne sont pas connus du joueur. | Maël Orven | Choix : Échanger les journaux de vol ou protéger leur source. |
| 158 | **Le contrat de Lise**<br><small>`opus1_finale_04`</small> | 2v2 | Canal industriel, deux lignes indirectes et îlots. — Lise défend la centralisation pour prévenir les coupures ; elle critique déjà les méthodes de Maël. | Lise Varen | Choix : Garantir l’accès public demandé par Lise ou exiger son retrait immédiat. |
| 159 | **Les pavillons hésitants**<br><small>`opus1_finale_05`</small> | 2v2 | Ville basse avec itinéraire civil hors plateau de combat. — Une délégation ayant choisi un contrat adverse peut combattre ici ; ce ne sont pas tous ses habitants qui ont changé de camp. | Yuna Serrat | Choix : Offrir une audition à la délégation battue ou suspendre son contrat. |
| 160 | **Le signal sans visage**<br><small>`opus1_finale_06`</small> | 1v3 | Archipel de pylônes, pontons et zones boisées. — Une voix inconnue coordonne les adversaires ; aucune identité ni parenté n’est donnée. | Relais Zéro | Choix : Publier les relais compromis ou surveiller leur trafic. |

## Finales — saison 2 · Saison globale 5

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 161 | **Les réserves verrouillées**<br><small>`opus1_finale_07`</small> | 3v1 | Trois entrées vers un bassin de stockage. — Les réserves servent à imposer la tutelle sur Aube. | Basile Kelm | Choix : Répartir les réserves ou équiper la colonne de tête. |
| — | ↳ *HS* **Le relais sans réponse** ▭<br><small>`opus1_hs_np_3`</small> | 2v1 | La plaque du Népal est posée à plat sur la tablette du Tableau. L’adjointe de Mira reprend le banc et demande au joueur de l’aider à redescendre la réserve de l’atelier isolé par trois relais, avant que Basile Kelm ne la fasse compter comme réserve méridienne. — *Disparition de Mira Karki.* | Mira Karki, Basile Kelm, Célestin Vantour, Solveig Tamm | Ouvert par : {"type":"flag","cle":"pays.np.qualifie"} |
| 162 | **La contre-offre**<br><small>`opus1_finale_08`</small> | 1v2 | Deux boucles routières et un poste central contesté. — Sélène propose de garantir l’énergie en échange de l’exclusivité des décisions. | Sélène Veyr | Choix : Rendre l’offre publique ou négocier un délai transparent sous contrôle de la coalition. |
| 163 | **Le dépôt de relève**<br><small>`opus1_finale_09`</small> | 2v1 | Vallée resserrée, dépôt de relève au fond. — Edran Sorel apparaît comme un logisticien influent ; la relation paternelle reste non confirmée. | Maël Orven | Choix : Évacuer les techniciens du dépôt ou sécuriser les archives logistiques. |
| 164 | **Ce que Sorel protège**<br><small>`opus1_finale_10`</small> | 1v2 | Bassin du dépôt ; trois sorties secondaires pour les colonnes sauvées. — Edran révèle être le père de Maël, rejoint son fils et bat notre coalition. La révélation précède les ordres, pas le résultat. | Edran Sorel | Choix : Sauver les réserves, les archives ou le matériel d’une délégation isolée ; objectifs secondaires incompatibles faute de temps. |
| 165 | **Les comptes du repli**<br><small>`opus1_finale_11`</small> | 2v1 | Ravines et route de desserte, poursuite bornée. — Les délégations débattent de la défaite ; les fautes du commandement ne sont pas effacées. | Yuna Serrat | Choix : Admettre publiquement l’échec ou demander une enquête contradictoire avant publication. |
| 166 | **Les lignes qui restent** ▭<br><small>`opus1_finale_12`</small> | 2v2 | Deux lignes de retenue, barrage et second gué. — Basile veut empêcher la reconstitution de la coalition. — *Disparition de Tomas Reiner.* | Basile Kelm | Choix : Garantir les équipes qui refusent la tutelle ou concentrer la défense sur le dépôt. |

## Finales — saison 3 · Saison globale 6

| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |
|---:|---|---|---|---|---|
| 167 | **Le contrat de Varen**<br><small>`opus1_finale_13`</small> | 1v1 | Terrasses, contre-pentes et deux couloirs d’artillerie. — Lise confronte les garanties proposées aux actes des dernières saisons ; son engagement personnel ne dépend pas d’une parenté révélée. | Lise Varen | Choix : Proposer une reddition contractuelle contrôlée ou imposer sa suspension après victoire. |
| 168 | **Le fils au premier rang**<br><small>`opus1_finale_14`</small> | 1v2 | Double aérodrome, axe rapide vulnérable au brouillage. — Maël refuse de réduire son ambition au projet de son père. | Maël Orven | Choix : Préserver un accès aux équipes dissidentes ou saisir leurs réserves. |
| 169 | **La dette de Sorel**<br><small>`opus1_finale_15`</small> | 2v1 | Dépôts en escalier et circulation à sens contraint. — Edran justifie son ralliement sans nier sa responsabilité ; le joueur peut le battre loyalement cette fois. | Edran Sorel | Choix : Accepter sa déposition sous contrôle ou refuser toute participation opérationnelle. |
| 170 | **Le réseau muet**<br><small>`opus1_finale_16`</small> | 1v3 | Trois îles techniques ; relais visibles, drones en réserve. — L’inconnu perd ses relais mais son identité demeure inconnue à la fin de l’opus. | Relais Zéro | Choix : Conserver une trace sous surveillance ou isoler immédiatement le dernier relais. |
| 171 | **Les droits d’Aube**<br><small>`opus1_finale_17`</small> | 3v1 | Plateau expérimental fictif ; trois accès, aucun réacteur à détruire. — Ost perd la maîtrise du terrain ; les alliés présents dépendent des engagements et médiations. | Hadran Ost | Choix : Privilégier l’accès partagé ou exiger un contrôle de coalition temporaire. |
| 172 | **La dernière concession**<br><small>`opus1_finale_18`</small> | 2v2 | Campus de coordination, jardins techniques et deux axes de capture. — La direction de Sélène est confirmée et contestée publiquement ; son identité n’était pas le mystère familial. | Sélène Veyr | Choix : Signer le réseau partagé, un mandat de transition ou refuser un traité insuffisant selon les engagements accumulés. |

## Lecture par saison

| Saison | Chapitres | Épisodes | Hors-série ancrés | Disparitions |
|---|---|---:|---:|---|
| Prologue | Les dix exercices | 10 | 0 | — |
| Nationale 1 | France, Luxembourg, Suisse, Pays-Bas | 48 | 8 | — |
| Nationale 2 | Maroc, Sénégal, Brésil, Mexique | 48 | 9 | — |
| Nationale 3 | Inde, Japon, Australie, Indonésie | 48 | 9 | Samir El Hadi |
| Globale 4 | Finales | 6 | 1 | Nikos Delis |
| Globale 5 | Finales | 6 | 1 | Mira Karki, Tomas Reiner |
| Globale 6 | Finales | 6 | 0 | — |

