# Laboratoire de missions — 12 septembre 2026

Le laboratoire `/admin/cartes` compose des variantes autour d'une mission existante ou d'un couple scénario/carte fourni dans un contrat JSON. Il utilise le générateur de relief, le moteur et les commandants du jeu. Il ne fait aucun appel à un modèle externe ; le prompt exporté et les endpoints permettent à l'exécuteur des routines de lui soumettre une intention structurée.

## Ce qui fonctionne

1. **Contrat strict** (`src/schemas/conception.ts`) : scénario, carte, résumé, apprentissage, forme tactique, graine, fenêtre de durée en journées, ancrages supplémentaires, interdits pédagogiques. Les résumés ne sont pas interprétés comme des commandes. Champs inconnus et demandes hors budgets refusés.
2. **Composition** : 2 à 4 variantes déterministes. Axe direct, deux axes avec détour bordé de forêt, ou position défensive avec accès de réserve. Les unités, les bâtiments, l'économie et tous les emplacements des objectifs/événements restent ceux de la source. Le littoral, les ponts et les rivières restent fixes. Le générateur ne prétend pas déplacer un QG ou inventer une règle absente du moteur.
3. **Contrôle adapté à une campagne** : ancrages, schémas, camps et interdits sont bloquants. Les seuils de valeur et de revenus d'un duel symétrique sont informatifs : une mission 1v3 ou sans usine n'est pas refusée pour ce seul motif. Un deuxième axe impossible est signalé.
4. **Simulations** : normal et difficile, joueur agressif puis pondéré, adversaires du scénario avec leurs pouvoirs. Le climat, les équipes, la limite de journées, les renforts et les stations sont réellement ceux du scénario. Chaque essai est rejoué action par action et son empreinte est comparée. Le rapport conserve les actions, issues, premières attaques, captures et annonces.
5. **Correction bornée** : si une partie échoue ou dépasse la durée demandée, une deuxième révision peut dégager les côtés des axes. Elle garde tous les ancrages et repasse les tests. Les deux révisions restent consultables ; une correction qui n'apporte rien n'est pas retenue artificiellement.
6. **Variété** : l'historique fourni refuse une grille déjà retenue et signale trois formes successives identiques. L'admin conserve au maximum 24 signatures dans ce navigateur, exportables. Ce n'est pas une mémoire partagée entre tous les administrateurs ni une mesure exhaustive de similarité topologique.
7. **Atelier** : plans comparables, erreurs, points à examiner, calendrier prévu par mode/branche, essais, export de la demande, du prompt, des brouillons et du rapport complet avec rejeux. Une recommandation exige une victoire observée pour chaque couple mode/branche et un contrôle complet. « À tester » n'est pas « homologué ».

## Choix et difficulté

La fonction `scenarioPourMode` est maintenant partagée entre le jeu et le serveur, sans changement de comportement. Les branches ont chacune `normal` et `difficile` : ce sont les scénarios **après** application du mode puis des conséquences. Le moteur ne réapplique pas les modes et n'efface donc pas un bonus narratif.

Au chargement d'un scénario dans l'admin ou via GET, les conséquences locales connues sont calculées avec `appliquerConsequences`, dans l'ordre du jeu. Au maximum deux conséquences individuelles pertinentes sont proposées. Ce lot n'est pas la couverture de toutes les combinaisons de décisions, de tous les bancs prêtés ou de tous les commandants déblocables. Le JSON avancé permet de fournir deux autres branches complètes. Les positions de leurs renforts sont aussi verrouillées pendant la génération.

## API et budgets

- GET `/api/admin/conception?scenario=opus1_tutoriel_05` : session admin requise, intention et prompt.
- POST `/api/admin/conception` : session admin, origine contrôlée, contrat JSON.
- GET/POST `/api/routines/map/conception` : même contrat sous authentification Bearer de routine. Aucun accès PostgreSQL, aucune réservation et aucune publication. La découverte `/api/routines/contrat` référence ces routes.

Corps HTTP limité à 256 Kio ; carte au plus 24 × 24, 48 unités initiales, 4 variantes, 2 branches, 32 parties et 45 secondes de calcul par appel. Un seul calcul par processus serveur ; les autres reçoivent 429. Le moteur cède la main entre les tours et accepte l'annulation. Un budget atteint produit un rapport **incomplet**, pas une certification. Aucun retry automatique.

Une partie a aussi un plafond de 404 tours de camp et de 12 000 actions. Une issue hors budget n'est pas une victoire. Le score est exploratoire : moitié victoires observées, moitié essais dans la fenêtre de durée, pénalité pour les avertissements. Ce n'est pas une estimation de la satisfaction ni du niveau d'un joueur humain.

## Pilote reproductible

```sh
node --import tsx scripts/concevoir-mission.ts
node --import tsx scripts/concevoir-mission.ts --scenario pacte_du_col --sortie apercus/conception-col
node --import tsx scripts/concevoir-mission.ts --contrat apercus/conception/intention.json --sortie apercus/conception-rejeu
```

Le pilote est une variation de **La bonne distance**, pas un remplacement du tutoriel publié. Les sorties sous `apercus/conception` contiennent les cartes/scénarios par révision, le prompt, l'intention et les actions rejouables. Le script autorise 120 secondes pour le travail local et refuse d'exporter dans `content`. Le bilan versionné `conception-pilote.json` résume une exécution ; les fichiers volumineux sont régénérables et ne sont pas dupliqués dans Git.

## Limites artistiques et narratives

Il reste nécessaire de relire les dialogues qui parlent d'un col, d'une côte ou d'une position précise : garder leurs coordonnées ne prouve pas que la nouvelle carte illustre toujours chaque phrase. Aucune révélation n'est réécrite par la génération. Les brouillons sont privés dans l'admin et les routes authentifiées.

La neutralisation d'une IEM avant une échéance précise, une défaite scénaristique réussie et l'intérêt humain d'une mission ne sont pas certifiés par un simple taux de victoire. Les événements et les rejeux fournissent les observations pour les examiner. La production des missions de campagne et leur intégration restent des étapes explicites ; l'atelier n'ajoute aucun asset ni aucune mission au parcours public.
