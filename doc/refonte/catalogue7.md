# Catalogue 7 — quatre rôles modernes

Extension demandée le 9 septembre 2026 : 28 types, dont 26 communs et deux exclusivement réservés à la Sélection Méridienne (`atl`). Le plafond précédent de 24 passe explicitement à 28 ; cette extension n'autorise pas une unité spéciale par nation. Aucun GLB supplémentaire n'est livré par ce chantier : les quatre silhouettes composent des bases et modules procéduraux existants, avec des combinaisons distinctes.

Le catalogue existant couvre déjà chars de trois poids, missiles sol-air et sol-sol, chasseur, bombardier, furtif, drones d'observation, transports, sous-marin et flotte. Les quatre ajouts évitent donc un nouveau char générique ou un second drone d'observation.

- **Drone intercepteur** (`drone_intercepteur`) : 8 500 fonds, mouvement 7, vision 3, cinq munitions. Petit appareil anti-air mobile, utile contre drones et transports aériens ; ne frappe aucun terrain ou véhicule terrestre. Un chasseur le domine et l'anti-air le neutralise. Traits `vol`, `drone`, `anti_air`.
- **Drone ravitailleur** (`drone_ravitailleur`) : 6 000 fonds, mouvement 5, vision 2. Ravitaille un voisin du même camp en munitions et carburant par l'ordre existant ; ne transporte personne et ne tire pas. Il traverse l'eau mais possède lui-même une autonomie limitée. Traits `vol`, `drone`, `ravitaillement`.
- **Veilleur méridien** (`meridien_veilleur`) : exclusif `atl`, 10 000 fonds, mouvement 5, vision 4. Brouilleur aérien sans arme ; portée de brouillage mobile existante de dix cases. Sa propre vision peut être brouillée, sans supprimer son émission de brouillage : c'est la règle actuelle et aucune immunité spéciale n'est promise. Traits `vol`, `drone`, `brouilleur`.
- **Bastion méridien** (`meridien_bastion`) : exclusif `atl`, 14 500 fonds, mouvement 3, vision 3, sept munitions. Anti-air terrestre lourd au contact, cher et lent ; les chars moyens/lourds, l'artillerie et les roquettes constituent ses contres. Il ne capture pas et ne remplace pas un char de ligne.

Les trois drones sont produits à l'aéroport, le Bastion à l'usine. L'appartenance est déclarée dans `Scenario.factionsParCamp`, par exemple `{ "1": "atl" }`. L'absence du champ représente une délégation ordinaire. Posséder un bâtiment capturé à Méridien ne confère aucune licence : l'exclusivité suit le camp. Une alliance avec Méridien ne transmet pas non plus ses unités.

`UnitType.factionExclusive: "atl"` est appliqué à la liste de production, au validateur d'ordre moteur, à l'IA, au menu et aux unités de départ/renfort. Sans contexte de camp, la liste de production exclut ces deux matériels par défaut. Les exclusifs restent dans le catalogue global pour pouvoir être rendus, inspectés et affrontés.

La limite de traits passe à trois pour exprimer vol + drone + fonction existante. Le drone armé est autorisé à partir du catalogue 7 seulement avec `anti_air`. Le brouilleur reste toujours sans arme. Aucune nouvelle capacité fictive n'est introduite.

Les nouvelles fiches portent lignes et colonnes de dégâts sur les 28 types ; les anciennes fiches sont complétées pour leurs interactions avec ces quatre nouveautés. Aucun chiffre d'un duel entre deux anciennes unités n'est changé. Les catalogues 1 à 6 gardent respectivement 10, 11, 13, 14, 23 et 24 unités ; aucun nouveau type ne fuit dans un ancien match. Les ressources, la géométrie partagée et les palettes nationales restent indépendantes du catalogue de combat.

Validation automatisée : disponibilité par version, cohérence des anciennes interactions, refus et autorisation de production par faction, refus des placements et renforts illicites, brouillage du drone intercepteur, ravitaillement effectif et schéma des affiliations. L'équilibrage humain et la reconnaissance artistique des silhouettes restent à évaluer en jeu.
