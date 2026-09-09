# IA et rythme du siège — 9 septembre 2026

## Décisions effectivement modifiées

La stratégie pondérée, et les personnalités qui en dérivent, comptent désormais les points déjà accumulés lors d’une capture immobile. Finir une prise engagée pèse davantage que repartir vers une autre ville ; un déplacement ne conserve pas ces points fictivement.

La menace d’une pièce indirecte respecte sa portée minimale et ne lui attribue plus un déplacement suivi d’un tir interdit. Nos propres pièces indirectes pénalisent davantage les cases exposées et le contact où elles ne peuvent riposter. Cela reste une estimation tactique, pas une recherche exhaustive des coups futurs. Les adversaires cachés restent exclus de la lecture.

Un ravitailleur cherche les unités à court d’un autre camp de son équipe. Le transport de passagers reste cantonné à son propre camp, conformément au moteur. Ni fonds supplémentaires, ni dégâts supplémentaires, ni renseignement caché ne servent ces décisions.

## Deux chemins pour le siège

`aube_releve_1v3` passe en version 2 et catalogue 7. Le joueur peut tenir les quarante journées (relève au début de J41) **ou prendre les trois QG adverses pour gagner plus tôt**. Cette seconde voie supprime la longue attente qui suivait l’élimination de tous les camps adverses : leurs renforts sont normalement annulés quand leur QG est pris.

En difficile, la réserve spécifique J18 compte deux infanteries (accès ouest et est), avec un ajout au briefing et une annonce J17. Elle comptait auparavant trois infanteries.

Pour une défense prolongée, les réserves finies J10/J20/J30 sont complétées par une infanterie à l’ouest J34 et une infanterie à l’est J38. Chaque arrivée est annoncée la veille et le briefing donne le calendrier. Aucune unité n’apparaît continuellement. La carte conserve ses quatre QG. L’arrivée alliée J41 reste identique.

## Mesures reproductibles

Graine `rythme:9`, catalogue 7, commandants résolus avec `resoudreCommandantsScenario`, actions appliquées par `jouerTour` :

- Pondérée dans tous les camps : victoire joueur par capture des QG J11, 233 actions, aucun refus, en normal comme en difficile. Le joueur termine avant la vague spécifique difficile J18 : les deux résultats peuvent donc être identiques.
- Même pondérée, mais le joueur remplace volontairement les captures par une attente : normal gagné par survie J41, 886 actions, aucun refus. Combats aux journées 32, 34, 35, 36, 37, 38 et 40 ; la fin du siège reste active.
- Cette politique volontairement privée de capture perd en difficile à J37, 833 actions, aucun refus. Le difficile conserve une voie de victoire prouvée par capture ; ces mesures ne prétendent pas prouver sa victoire défensive ni mesurer la difficulté humaine.

Tests dédiés : progression d’une capture, ravitaillement d’un autre camp allié, distance des indirects et contrat des annonces/victoire du siège. Les simulations sont des contrôles de légalité et de rythme ; une séance humaine reste nécessaire pour juger plaisir, fatigue et niveau de défi.

Contrôle supplémentaire : stratégies agressive et défensive privées de capture perdent respectivement J11 et J16, avant les réserves spécifiques au difficile. Elles ne prouvent donc rien sur la seule vague finale.

Après cet ajustement, les graines `rythme:10`, `rythme:11`, `rythme:12` avec pondérée privée de toute capture perdent en difficile à J37/J14/J14 (833/354/354 actions, aucun refus). Autoriser les captures de villes mais pas de QG fait perdre ce pilote J23 dans les deux modes. Ces résultats montrent les limites d’un pilote offensif artificiellement empêché de capturer ; la voie défensive difficile n’est pas déclarée gagnable sur la seule foi de ces essais.

Validation technique : 47 tests IA existants réussis, quatre nouveaux tests tactiques réussis, quatre tests de difficulté réussis ; `npm run typecheck` réussi.
