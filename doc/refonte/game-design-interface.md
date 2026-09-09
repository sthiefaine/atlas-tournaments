# Menus : accès aux décisions

Perspective de game designer femme simulée, sans attribuer de préférences à un genre.

La sélection de cartes et le carnet ont déjà reçu des vignettes calculées sur les vraies cartes, un objectif prioritaire et des états de progression. Ces acquis restent. Le chantier actuel rend leurs commandes utilisables de façon cohérente au clavier et sur petit écran.

- Réglages : chaque groupe de radios constitue un seul arrêt Tab. Les flèches changent le choix et le focus, Début et Fin atteignent les extrémités. Le nom du profil et son bilan restent associés au choix ; aucune option supplémentaire ne prétend exister.
- Campagne : Tab atteint l'étape consultée. Les flèches parcourent les briefings, y compris les étapes fermées dont la condition de déblocage reste lisible. Début et Fin atteignent les extrémités. Le bouton d'entrée en mission suit dans l'ordre de navigation.
- Les anneaux de focus sont dessinés à l'intérieur des boutons : les coins découpés des panneaux ne peuvent plus les masquer. Un mode de contraste forcé garde son propre anneau système.
- Les actions de partie libre se replient quand leurs textes dépassent la largeur disponible. Sur les écrans très étroits, l'action secondaire occupe une ligne entière ; la reprise reste prioritaire.

Le récit Aube et les conséquences doivent être portés par les briefings réellement chargés, jamais par des promesses ajoutées au menu. Aucun symbole de faction, appareil ou illustration ne sont ajoutés ici.

Validation : deux tests de calcul de navigation et lint ciblé réussis. TypeScript ne signale aucun diagnostic dans ce périmètre ; la vérification globale a rencontré deux erreurs dans la navigation admin en cours de modification parallèle. Aucune capture ni appréciation visuelle, conformément à AGENTS.md. Le confort humain et l'esthétique restent non vérifiés ; cette perspective simulée ne constitue pas un test utilisateur.

## Les équipes sur le plateau

Le rendu lit `sontAllies` dans l'API du moteur. Une unité d'un autre camp allié reste inspectable, sans ordre et sans enveloppe rouge de menace. Son panneau indique son commandement autonome. Les tours d'IA alliés portent leur vrai camp et le libellé « Tour allié ». La prévision de dégâts disparaît pour une cible alliée, même si une visée périmée lui est transmise.

La victoire d'un représentant allié déclenche le bon résultat, le dialogue de victoire et la progression. Le bilan accepte trois ou quatre colonnes de camps. En 3D, une unité furtive alliée conserve le voile informatif de furtivité au lieu d'être présentée comme une adverse détectée.

Quatre tests de régression couvrent consultation sans contrôle, absence de menace, tour/victoire alliés et suppression du duel allié. La palette propre à chaque camp est préservée : relation d'équipe et propriétaire restent deux informations distinctes.

## Décisions des essais Aube

Les cinq essais Aube gardent un accès libre, distinct des six entraînements. Deux fins victorieuses proposent un choix durable pour le profil local :

- `aube_batteries_2v1` : `mutualiser_reserves` ajoute un char léger du camp 0 à la journée 20 de `aube_releve_1v3` ; `credit_immediat` ajoute 2 000 fonds au seul camp 0 de `aube_nuit_2v2`.
- `aube_nuit_2v2` : `publier_preuve` ajoute 2 000 fonds au seul camp 0 de `aube_routes_3v1` ; `securiser_routes` y ajoute un génie du camp 0 à la journée 2. Les renforts utilisent la recherche de case libre du moteur et peuvent être reportés si le point d'entrée est bloqué.

Chaque conséquence est annoncée avant le bouton. Une victoire est requise ; le choix est idempotent et ne peut être remplacé pour le même scénario, sa version et la révision 1 des choix Aube. Cette révision est indépendante de la version de la bible. Le journal est lisible dans `/campagne` et les conditions appliquées sont rappelées dans le briefing de l'essai concerné. Un refus du stockage laisse le choix non enregistré et montre une erreur.

La progression conserve son format `version: 1` et ses victoires historiques. Les champs facultatifs `canonVersion`, `decisions` et `journal` n'affectent pas le déblocage des entraînements. Les écritures utilisent le profil capturé au départ de la partie, même si un autre onglet change le profil actif entre-temps.

Une nouvelle partie encode les deux décisions dans une graine courte `scenario:a1:XY`, conservée par la sauvegarde existante. Une reprise lit ces chiffres et applique les conséquences au scénario de base une seule fois, avant de rejouer les actions ; elle ne relit pas les décisions actuelles. Une ancienne graine sans ce suffixe reste sans bonus. Aucune modification des actions sauvegardées ni dépendance PostgreSQL.

Pour que le crédit ne finance pas aussi les adversaires, le contrat gagne `fondsDepartParCamp?: Partial<Record<CampId, number>>` : des entiers de 0 à 30 000, multiples de 100, pour les seuls camps présents. Le moteur utilise le montant individuel puis le montant commun en repli. Un scénario peut désormais avoir zéro revenu par bâtiment, ce qui permet les réserves finies du siège.

Validation : 17 tests ciblés de progression/préférences/conséquences, dont un vrai rejeu moteur après une décision ultérieure ; TypeScript et lint ciblé réussis. Les bonus sont testés contre une partie témoin pour tenir compte du versement automatique du revenu de la première journée.
