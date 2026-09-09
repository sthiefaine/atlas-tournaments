# Équipes, renforts et rythme de campagne

Perspective simulée de game designer homme, sans prétendre représenter un avis lié au genre. Livraison du 9 septembre 2026.

Une alliance est une règle de jeu : elle partage vision et victoire. Les fonds, les productions, les pouvoirs positifs, les transports et les ordres restent la responsabilité de chaque commandant. Un camp allié ne peut être visé, capturé, brouillé ni subir les modificateurs visant les adversaires. On peut traverser ses unités sans s'arrêter dessus. L'IA exclut ses unités et bâtiments de ses objectifs offensifs.

Le scénario porte `equipes?: CampId[][]`, partition complète des camps. Sans ce champ, les scénarios existants restent chacun pour soi. Exemples : `[[0,2],[1]]` pour 2v1, `[[0],[1,2]]` pour 1v2, `[[0],[1,2,3]]` pour 1v3, `[[0,2,3],[1]]` pour 3v1, `[[0,2],[1,3]]` pour 2v2. Les commandants conservent leur ordre de tour ; aucune fusion des budgets ne compense automatiquement le nombre de camps. Les objectifs, le terrain et les forces de départ doivent donc équilibrer chaque mission.

L'élimination d'un camp laisse son équipe poursuivre. La capture de tous les QG adverses et la mise hors jeu de toute l'équipe adverse donnent une victoire commune ; le représentant de l'équipe est son plus petit identifiant, donc 0 pour le joueur. La décision aux points additionne les scores de l'équipe. Les objectifs de capture, tenue, escorte et relais acceptent les alliés. Les objectifs narratifs de perte d'une unité précise ou d'une case restent impératifs.

`renforts?: { journee: number; unites: { camp, type, x, y, pv? }[] }[]` programme les arrivées. Déploiement au début du tour, avant la vérification de victoire. La journée représente une rotation complète des camps ; elle avance même si le premier camp a été éliminé. Une survie de 40 journées se gagne au début de J41, après le déploiement prévu à J41. Une mission peut aussi programmer des renforts plus tôt puis demander capture ou élimination.

Le point d'entrée est essayé d'abord. S'il est occupé ou infranchissable, le moteur choisit la case libre franchissable la plus proche, puis la plus petite ligne, puis colonne. Si toute la carte est indisponible, la livraison est reportée au début du prochain tour. Aucune unité existante n'est déplacée ou écrasée. Chaque unité livrée conserve un identifiant de vague sérialisé : une sauvegarde ou un rejeu ne la duplique pas. Un camp sans forces qui attend sa première arrivée n'est pas éliminé ; un camp dont le QG a été pris ne revient pas.

Les renforts invalides (type absent du catalogue, camp absent, point hors carte) sont refusés à la création de partie. Les schémas bornent les vagues et leurs effectifs. Le moteur passe à la version 6 : les matchs sauvegardés sous une version antérieure doivent être recommencés, la progression de campagne reste distincte.

Une défense de 40 journées doit rester une mission de siège exceptionnelle avec changements de fronts et décisions, pas un tutoriel ni quarante clics de fin de tour. À 3v1, le joueur dispose de trois phases adverses : le nombre de tours ne mesure donc pas seul la difficulté. La simulation automatique vérifie la jouabilité, pas le plaisir ou une durée humaine.
