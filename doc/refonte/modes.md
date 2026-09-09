# Modes normal et difficile

Les deux modes sont accessibles immédiatement dans `/reglages`, pour le profil actif. Le réglage de difficulté appartient au profil ; dialogues et qualité graphique restent communs à l'appareil. Les compteurs de missions remportées sont affichés séparément.

Le mode normal conserve les paramètres du scénario. Le difficile applique les paramètres déclarés dans `Scenario.modes.difficile` lorsqu'ils existent. Budgets et revenus sont ventilés entre le joueur et les camps IA ; brouillard, limite de journées, stratégie de chaque IA, vitesse de jauge du joueur et profondeur du Bulletin sont effectivement transmis au moteur et au rendu. Les IA ne partagent plus arbitrairement la stratégie du premier commandant IA. Les dégâts de base ne reçoivent aucun multiplicateur de difficulté.

## Essais Aube

Les réglages explicites vivent dans `src/app/jeu/difficulte.ts`, sans recopier les scénarios ni les cartes :

- Batteries : 2 000 fonds supplémentaires à chaque camp adverse.
- Réserves : 1 500 fonds supplémentaires à chaque camp adverse.
- Nuit : 2 000 fonds supplémentaires à chaque camp adverse, brouillard conservé.
- Routes : 3 000 fonds supplémentaires au camp adverse.
- Relève : une infanterie supplémentaire par camp adverse à la journée 18, depuis ses entrées. Le siège sans revenu ni usine adverse ne reçoit pas un bonus monétaire sans effet.

Sans configuration propre, le difficile apporte 1 500 fonds supplémentaires à chaque camp adverse. Les alliés conservent leurs paramètres. La difficulté monétaire n'ajoute aucun recrutement si la mission ne possède aucun bâtiment producteur ; les entraînements gardent ainsi leurs situations pédagogiques. Dans le difficile non personnalisé, le Bulletin montre la journée présente et une seule prévision, au lieu de deux. Ces leviers définissent des variantes ; leur difficulté humaine n'est pas certifiée par les tests techniques.

Le briefing présente les paramètres réellement appliqués, après les conséquences narratives : fonds initiaux par camp, revenus, stratégie IA, brouillard, horizon du Bulletin et vitesse de jauge. Le revenu de la première journée est indiqué comme distinct des réserves initiales. Le renfort supplémentaire du siège est annoncé explicitement.

## Sauvegardes et récit

Le normal garde les clés historiques `atlas:partie:<scenario>` (avec le segment de profil B habituel). Le difficile utilise la clé indépendante `<clé historique>:difficile:v1`. Changer le réglage ne réécrit aucune partie. Revenir au mode précédent retrouve sa sauvegarde. Une future révision incompatible des paramètres difficiles devra changer ce suffixe de version.

`Progression.version` reste 1. `victoiresParMode.normal` et `.difficile` enregistrent les missions distinctes remportées ; `victoires` reste l'union qui ouvre le parcours commun. Les victoires historiques sont classées en normal lors de la première nouvelle écriture. Les choix narratifs restent communs au profil : changer de difficulté ne les efface pas et ne les rend pas renouvelables. La graine Aube continue de figer les conséquences du départ dans chaque sauvegarde de difficulté.

Les quêtes secondaires vérifient leur déblocage local avant de monter le moteur, même par accès direct à leur URL. Leur briefing lit leurs vrais objectifs et annonce la perte du porteur désigné comme condition de défaite.

## Validation et limite précise

Tests de persistance par profil et par mode, variantes des cinq essais, paramètres explicitement déclarés appliqués au moteur, revenu et jauge différenciés, porteur à préserver et Bulletin limité ; TypeScript et lint ciblé. Pas de capture d'écran ni appréciation visuelle.

Les champs historiques `ParametresMode.reprises` et `dureeVisee` restent des métadonnées de conception : il n'existe pas de commande de retour à une journée précédente, dans aucun mode, et aucune durée mesurée n'est inventée. Le choix de mode ne présente pas ces fonctionnalités comme disponibles.
