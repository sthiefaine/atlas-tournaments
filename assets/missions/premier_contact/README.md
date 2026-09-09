# Premier contact — GLB et textures autonomes

Ce lot rassemble les modèles existants utiles au premier entraînement, **infanterie comprise**. Il contient les cinq bases possibles, leurs kits France/Luxembourg, les cinq terrains présents, deux choix de QG et trois décors optionnels. Les unités initiales sont infanterie, char léger et reconnaissance ; meca et génie couvrent les recrutements possibles au QG.

Décompresser toute l’archive en conservant les sous-dossiers. Chaque GLB référence les PNG voisins par des chemins relatifs. Les niveaux de détail et variantes de texture présents dans les lots sources sont inclus. Un lecteur glTF doit charger ces voisins ; ouvrir le GLB isolé sans ses PNG ne suffit pas.

Les candidats restent **non approuvés artistiquement**. Rien n’est installé dans le jeu par cette archive. Le QG français d’Île-de-France est un choix régional explicite ; les trois décors sont optionnels et ne prétendent pas reproduire exactement le semis procédural de la carte.

Le manifeste donne les identifiants, provenances, empreintes SHA-256 et références de tous les GLB. Le script vérifie également ces références dans le ZIP final. La plaine existante est réutilisée sans modification.

Reproduire depuis la racine du dépôt : `python3 scripts/missions/packager-premier-contact.py`.
