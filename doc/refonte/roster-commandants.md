# Rôles et commandants — 9 septembre 2026

Le roster reste à 28 unités. Le guide public `src/content/roles-unites.ts` donne pour chacune un rôle, une situation d'achat et une limite pratique. La fiche d'inspection et de production le reçoit par `ficheUnite.guide`. Le catalogue admin présente les mêmes conseils et les trois contre-unités calculées depuis la matrice du moteur, dans les deux sens. Il n'existe aucune copie chiffrée d'une table de dégâts.

## Audit des décisions d'achat

Les trois chars distinguent initiative, ligne polyvalente et ancrage coûteux. Artillerie, roquettes et missiles sol distinguent distance de couverture et zone morte : des positions différentes à protéger, sans inventer de nouvelles armes. Infanterie, méca et génie distinguent capture économique, progression antiblindé sur relief et remise en service. Les transports sont séparés par leur milieu et leurs passagers ; le porte-avions assure la base aérienne embarquée.

Les quatre rôles liés aux drones sont observation économique, interception aérienne légère, ravitaillement aérien sans passagers et brouillage aérien méridien. Le brouilleur terrestre reste le déni de renseignement derrière une ligne, le Bastion un ancrage antiaérien lent. Les prototypes n'ajoutent aucun kit national. L'audit conserve les stats et les catalogues historiques ; il explicite les choix au lieu de conclure qu'une différence de prix suffit à prouver l'équilibre. Le test humain devra surtout comparer char moyen/lourd, missiles sol/roquettes et intercepteur/chasseur sur leurs coûts d'opportunité.

## Identités jouables

Ariane conserve son offensive polyvalente ; Reiner conserve exactement sa défense permanente et ses deux pouvoirs. Les nouveaux scénarios Aube emploient la révision 2 des capacités :

- Solveig protège les transports. Son pouvoir sans convoi exposé offre peu de valeur ; son super permet un repositionnement de la logistique et une couverture générale.
- Wren accroît la vision puis le mouvement. Sans exploitation des informations, aucun gain de dégâts ou de résistance ne vient sauver une mauvaise attaque.
- Ost concentre les bonus offensifs sur les chenilles. Une composition aérienne ou légère ne reçoit pas ce soutien.

Les capacités de la révision 1 sont inchangées. `resoudreCommandantsScenario` sélectionne la révision 2 à partir du catalogue 7. Les versions des scénarios Aube augmentent ; les tutoriels et démos anciens ne changent pas. Les faiblesses annoncées décrivent les bénéficiaires et les avantages absents, pas des malus secrets ajoutés au moteur.

Le carnet de campagne expose les cinq profils publics sans importer les biographies secrètes. Les dilemmes de Reiner, Solveig et Wren renvoient aux décisions de batteries, convoi et archives déjà connectées aux conséquences. Celui d'Ost est un ressort de personnage, pas un choix de joueur prétendument livré. Les biographies passent en révision 3 ; leur champ éditorial `identiteTactique` n'est fourni aux routines qu'à l'acte III. Les faits historiques gardent leurs sources originales v2.

## Validation

Couverture exhaustive des 28 rôles et de leur accès par la fiche ; drones non armés et intercepteur aérien vérifiés depuis les dégâts réels ; révision historique des commandants conservée ; bénéficiaires filtrés de Solveig et Ost et vision de Wren vérifiés. Les contrats de quêtes utilisent le catalogue courant du scénario. Aucun GLB ni nouveau type d'unité.

## Révision 4 — 10 septembre 2026

Les 34 kits de `doc/refonte/pouvoirs-v4.md` sont en jeu (`content/commandants-capacites.json`, révision 3 gelée dans `-v3.json`) sur vingt et un scénarios en `commandantsVersion: 4`, les quatre premiers tutoriels restant en révision 1 ; la faiblesse est un modificateur permanent posé par le moteur (source `faiblesse`), `VERSION_MOTEUR` 7. Campagne 24/24 sans ajustement ; en simulation, tout kit sans `soin` perd 95 à 100 % contre un kit à soin parce que l’IA ne joue que le soin — détail dans `personnages-pouvoirs.md`.

## Les supers des Gris — 10 septembre 2026

Les huit supers de `doc/refonte/supers-vilains.json` sont en jeu (`content/commandants-capacites.json`, `pouvoirs-v4.json`, `familles` recomptées) : Grêle 7, Délestage 8, Rasante 6 (5 PV sur la plus chère, une seule — 12 septembre 2026), Zone rouge 7, La relève arrive 8, Mise sous scellés 7, Réserves fermées 7, Retour à zéro 9 — quatre crans posés à la mesure (Ost 8→7, Basile 8→7, Maël 7→5 et 3→4 PV, puis 5→6 barres et le rayon sur la pièce la plus chère), chaque Gris portant sa `piece` sans dossier ; passif, pouvoir normal, faiblesse et contre-jeu de kit inchangés.
Mesuré sur `plaine.json` dans les deux protocoles et les deux ordres (`pouvoirs-v4.md`, « Les supers des Gris en jeu ») : Ost, Maël, Lise, Yuna, Sélène et Basile tiennent entre 20 et 80 % ; Relais Zéro (0–10 %) et Edran (5–35 %) restent sous la cible sur une plaine sans aéroport ni brouillard, où `abattre` n'a rien à abattre ; `verifier:campagne` 24/24, les essais Aube ne déclarant pas la faction, Grêle n'y part pas.
