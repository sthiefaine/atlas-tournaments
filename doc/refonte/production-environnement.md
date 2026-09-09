# Fabrication des candidats environnementaux

Le catalogue contient neuf terrains, dont la plaine déjà livrée, 246 bâtiments et 108 décors. Le lot de cette passe comprend donc **362 nouveaux candidats**. La plaine est explicitement exclue de la génération ; les autres modèles existants ne sont jamais remplacés implicitement.

`scripts/production/environnement.ts` construit les volumes, `commun.ts` exporte les modèles et textures externes puis applique le contrôleur strict. Le runner `generer-environnement.ts` écrit un rapport progressif et un manifeste par candidat, avec triangles, poids, noms des nœuds et matériaux, absence de textures embarquées. Les lots refusés ne sont pas écrits comme fichiers utilisables.

Les six fonctions de bâtiment ont des silhouettes propres : îlot à cour pour la ville, pavillon et escalier de QG, sheds et cheminée d’usine, aire circulaire et cabine d’aéroport, parabole de radar, quai et grue de port. Les matériaux décrits dans les spécifications commandent les variantes de maçonnerie, toitures et pilotis. Les fenêtres utilisent une bande UV dédiée, une carte d’émission et une liaison PBR explicite. Les zones d’équipe restent gris neutre.

Les arbres possèdent quatre touffes de cartes de feuilles orientées dans l’espace, avec découpe alpha et matériau à double face. Leur port suit la description : couronne basse de milieu sec, étages de conifères, couronne et palmes de milieu tropical. Les trois LOD diminuent le nombre de feuilles sans changer le repère du modèle. Les rochers volcaniques présentent des colonnes facettées ; les rochers désertiques des bancs superposés ; les autres des volumes fracturés.

Les terrains de surface restent des dalles à épaisseur constante. Montagne et pont font exception conformément à leurs descriptions : volume rocheux et tablier sur longerons. Les bords des textures de terrain sont compatibles sous les rotations exigées ; les PNG ne contiennent pas de lumière ni d’ombre directionnelle peinte.

Tous les lots restent **candidats techniques non approuvés artistiquement**. Aucune capture ni inspection visuelle n’est utilisée pour prétendre les approuver. Il reste à juger la qualité des matières, l’identité des paysages, les détails demandés par chaque description et leur lecture à l’échelle du jeu. Un verdict technique ne transforme pas ce travail en validation artistique.

## Résultat technique du 9 septembre 2026

Les **362 lots** de cette passe sont écrits et acceptés par le contrôle strict : **832 GLB, 5 410 PNG, 452 735 274 octets** pour ces fichiers. Toutes les cartes sont externes ; les GLB ne les embarquent pas. Les rochers désertique et volcanique ont été repris après un refus du budget LOD2 : ils utilisent désormais 60 triangles pour un plafond de 64. Le rapport progressif contient uniquement leur résultat final accepté.

Les 60 premiers candidats réalisés avec le helper précédent ont été archivés dans `/tmp/atlas-env-v1-20260909` puis régénérés avec le helper courant. Ils ne remplacent aucune livraison antérieure. La plaine existante reste en dehors de ces 362 lots.

Les pilotes arbre/ville ont vérifié les trois/deux LOD, l’alpha et l’émission. Deux tests dédiés vérifient la conservation des bords des matières de terrain et l’absence de fausses réflexions peintes dans l’albédo de l’eau ; deux autres vérifient que la mémorisation du décodage PNG n’évite jamais les contraintes du lot suivant et ne réutilise pas des octets modifiés. Ces validations restent techniques ; l’état artistique demeure à examiner.
