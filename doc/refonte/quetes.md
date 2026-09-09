# Deux quêtes secondaires pour Aube

Livraison du 9 septembre 2026. Ces deux rencontres sont des scénarios d’essai (`brouillon`), au catalogue 6, avec des cartes originales. Elles prolongent l’idée d’étapes facultatives qui préparent un match futur ; elles ne reproduisent ni une carte, ni un dialogue, ni un personnage d’Advance Wars. Les modes normal et difficile et la persistance des récompenses sont raccordés par le chantier de campagne, séparément de ces JSON.

## Le convoi de Solveig

Clé scénario : `aube_convoi_secondaire`. Carte : `carte_convoi_secondaire`, 12 × 10, côtier. Commandants : Solveig Tamm au camp 0, Hadran Ost au camp 1. Solveig défend un droit de passage pour son convoi logistique ; la rencontre n’ajoute pas de faction ni de véhicule exclusif.

Le joueur prend le QG du nord-est en préservant le transport du sud-ouest, identifiant `u1`, qui porte les relevés. Quinze journées maximum, objectif de conception de huit à quinze tours. La perte du transport fait échouer la tentative même si le QG tombe dans la même séquence. Les deux ponts, en (3,4) et (8,4), donnent deux approches ; le convoi doit rester en jeu, il n’est pas un simple déclencheur posé sur une case.

QG du joueur (1,8), usine (2,8), transport (2,7). QG adverse (10,1), usine (9,1). Dotation initiale de six unités du catalogue courant pour Solveig, trois pour Hadran. Budget fixe 6 000 pour le joueur, zéro pour l’adversaire, aucun revenu périodique. Les adversaires sont déjà équipés au départ ; aucune vague cachée n’est nécessaire.

Récompense proposée au raccordement : état `convoi_securise`, éventuellement enregistré sous `monde.atlas.convoi_securise` si le registre des flags l’accueille. Effet utile suggéré : transport et infanterie de soutien au début de J2 dans une mission ultérieure, sous le camp du joueur. Aucun cumul en rejouant. La récompense ne figure pas comme un effet moteur imaginaire dans le JSON : le raccordement doit choisir et appliquer son effet exact, puis l’annoncer.

## Les archives de Wren

Clé scénario : `aube_archives_secondaire`. Carte : `carte_archives_secondaire`, 10 × 12, forêt. Commandants : Wren Osoko au camp 0, Hadran au camp 1. Wren conserve un double qui permettra de comparer les signatures et les engagements attribués à Aube. Aucun portrait nouveau n’est livré par cette quête.

Le joueur prend le QG adverse en préservant l’infanterie porteuse du double, `u1`, initialement en (2,9). Quinze journées maximum, huit à quinze tours visés. Le brouillard impose une reconnaissance ; le drone du catalogue 6 donne cette possibilité sans équipement exclusif. Deux passages traversent le relief central, aux lignes 3 et 8 : l’unité qui porte le document peut être tenue à couvert tandis qu’un autre capteur prend le QG.

QG du joueur (1,10), usine (2,10). QG adverse (8,1), usine (7,1). Six unités au joueur, trois à l’adversaire ; budgets fixes identiques à la quête du convoi. La victoire dépend d’un vrai assaut sur un QG ; tenir la preuve ne remplace pas la bataille.

Récompense proposée : état `archives_certifiees`, clé de registre éventuelle `monde.atlas.archives_certifiees`, ouvrant une conclusion documentée et une préparation chiffrée à définir dans le parcours. Suggestion : +2 000 fonds du joueur sur les Routes d’Aube. La preuve améliore les garanties de l’accord final ; elle n’est pas obligatoire pour accéder à la finale et ne doit pas transformer une victoire principale en défaite narrative.

## Contrat de branche

Les deux quêtes restent facultatives. Échouer ne ferme jamais la route principale ; gagner ne dispense pas de la mission suivante. Le menu doit afficher l’effet exact avant de lancer une quête et indiquer une quête déjà récompensée. Les choix persistants ne doivent pas appliquer la récompense à une sauvegarde commencée antérieurement : elle vaut lors d’une nouvelle préparation de mission.

Les JSON ne portent aucun flag non enregistré et n’inventent pas de récompense que le chargeur ignorerait. Le chantier de progression reçoit les deux clés de scénario ci-dessus pour raccorder victoire, carnet et conséquences. Il ne faut pas simplement ranger ces quêtes derrière un filtre de scénarios en ligne, puisque leur statut d’essai est explicite.

## Vérifications

Les quatre JSON passent `validerScenario` et `validerMapDef`. `tests/app/quetes-aube.test.ts` vérifie les dimensions compactes, le catalogue, la limite, la victoire classique, l’identité du porteur et la priorité de sa perte sur la capture d’un QG. Le rythme humain et la lecture artistique n’ont pas été testés.

### Solutions automatiques attestées

Avec la graine `aube:quete:1`, IA pondérée aux deux camps et les dotations de base des JSON : le convoi est remporté par capture du QG à la journée 10, après 114 actions légales ; les archives sont remportées par capture du QG à la journée 12, après 142 actions légales. Aucun ordre refusé et les deux porteurs protégés sont toujours présents à la conclusion. Les deux tests dédiés passent. Ces résultats démontrent deux solutions et restent dans la fenêtre de conception de huit à quinze journées ; ils ne mesurent pas la difficulté humaine ni celle de variantes normal/difficile appliquées ultérieurement.
