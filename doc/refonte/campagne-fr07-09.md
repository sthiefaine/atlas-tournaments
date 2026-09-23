# Saison 1 · FR07 à FR09 — des fiches aux missions jouables (23 septembre 2026)

Trois fiches de `opus1-nations.json` deviennent trois missions du parcours local : **Les clairières témoins** (`opus1_fr_07`), **Ligne de partage** (`opus1_fr_08`) et **La réserve commune** (`opus1_fr_09`). Elles suivent FR06 dans `content/campagne.json` ; le parcours passe à 21 missions, 24 quand FR10–FR12 (autre lot) y seront. Les fiches font foi sur le fond ; ce document dit ce qui en a été fait, ce qui a été adapté, et ce que la mesure dit.

Fichiers : `content/cartes/carte_opus1_fr_0{7,8,9}.json`, `content/scenarios/opus1_fr_0{7,8,9}.json` (version 1), trois entrées dans `content/campagne.json`. Brouillons, journaux de simulation et outils dans `apercus/fr07-09/` (non versionné). Aucun code, aucune chaîne d'interface.

## Distribution et fil

| Mission | Joueur (camp 0) | Allié | Adversaires | Pourquoi eux |
|---|---|---|---|---|
| FR07 | Ariane (son kit, comme FR01–FR06) | — | Ost | Les Gris gardent « les dépôts et les accès du Consortium » (lore v2) ; le bois où la patrouille s'est vidée en est un. Ost est déjà connu : pas de nouvelle rencontre. |
| FR08 | Ariane | Tomas (camp 1) | Edran (camp 2), Solveig (camp 3) | Edran est le « prestataire de réserve » vu à FR06 : il coordonne les réserves de l'équipe de l'Est, qui a signé avec Méridien. Solveig livre « le premier contrat inscrit » et le dit ; elle remarque que ses camions roulent pour deux contrats (son fait d'acte 2, amorcé sans être révélé). |
| FR09 | Ariane | Solveig (camp 2) | Edran (camp 1) | Solveig a livré la réserve à l'équipe commune après FR08 et la protège. Edran vient la reprendre : son dilemme de fiche est précisément « préserver les réserves communes ». |

**« Deux délégations françaises » sans commandant français de plus.** Le registre ne compte qu'une commandante française jouable (Ariane) et les généraux régionaux n'ont pas de kit ; `chargerCommandantJeu` lève sur un commandant absent du catalogue tactique, et `personnages.json` est fixé à 37 par test. Les deux équipes françaises sont donc **la nôtre** et **l'équipe de l'Est**, dont le banc est tenu par Edran au titre du contrat — ce qui montre la dépendance au lieu de la raconter. Ariane le dit dès la deuxième réplique : « En face, ce ne sont pas des Gris. »

**Ordre de la liste `commandants` de FR08.** Le carnet nomme l'adversaire par le premier camp piloté par l'IA (`campagne/page.tsx`) : Edran est donc placé avant Tomas dans le tableau, Tomas restant le camp 1 (couleurs du Luxembourg). Le moteur indexe par numéro de camp, rien d'autre ne lit l'ordre. FR10–FR12 font de même pour FR12.

**Le fil que les missions suivantes peuvent reprendre** (pour FR10–FR12) : l'équipe de l'Est est « l'équipe dépendante » ; elle a signé avec Méridien pour finir son année, Edran tient ses réserves, et elle signera l'accord commun si sa livraison est garantie (choix de FR08). Solveig a livré la réserve à l'équipe commune et garde une copie des deux contrats. Edran a tenté de reprendre les deux dépôts à FR09 et prévient : « quelqu'un d'autre viendra les réclamer ». Aucun lien familial n'est évoqué ; aucune mort.

## Les trois missions

### FR07 — Les clairières témoins (1v1, `relais`)

Forêt 24 × 16, automne. Trois relais de mesure, **cases de plaine à côté de chaque poste** (la ville) — c'est la lecture du lore : « les relais de mesure qui accompagnent les postes » ; ils ne se capturent pas, une unité s'y arrête et peut repartir. Ordre : clairière du sud-ouest (6,11), clairière du nord (10,3), clairière de l'est derrière le ruisseau (19,12). Le ruisseau coupe la carte en deux ; **les véhicules ne le passent qu'au pont du nord**, chez Ost, l'infanterie partout (coût 2), la méca à coût 1 : la dernière étape se fait surtout à pied. Brouillard de guerre (la reconnaissance compte) ; en septembre la forêt « sans couvert » ne cache personne (`forets_sans_couvert`, climat tempéré), ce que les dialogues disent, et seules les hautes herbes cachent encore les fantassins. L'**équipe épuisée** de la fiche est mécanique : la patrouille (deux infanteries, une reconnaissance) part à 6 et 7 PV.

Ost : char moyen, char léger, deux artilleries — l'une couvre la clairière du nord, l'autre celle de l'est —, deux infanteries qui prennent les postes voisins. Budget borné (1 500, 500 par bâtiment). Limite J18 (gabarit `relais` : 12–18). Victoire : les trois relais dans l'ordre. Défaite : QG, plus d'unités, limite.

### FR08 — Ligne de partage (2v2, `capture_qg`, choix)

Volcanique 18 × 14. La « ligne de partage » est une crête nord-sud : franchissable à pied partout (coût 2), par trois cols pour les véhicules. Au nord, Tomas contre le QG de l'équipe de l'Est ; au sud, le joueur contre le dépôt de Solveig (son QG), puis les deux colonnes convergent. Victoire : **les deux QG adverses** à la coalition, avant la fin de J26 ; un QG pris par Tomas compte.

**Les équipes adverses n'ont aucun revenu** (elles sont « à sec ») : c'est ce qui a rendu la mission décidable. Avec un revenu, même à 300 par bâtiment, l'IA bouche son QG d'une recrue chaque journée dès qu'un capteur approche (`RAYON_MENACE_QG`) et les parties finissaient au chronomètre ; mesuré sur cinq cartes successives, voir plus bas. Le difficile est alors exactement la fiche : **Méridien avance 1 500 fonds** à chaque équipe adverse (« crédit adverse de 1 500 fonds »).

**Le choix** (fiche : clé `opus1_fr_08_decision`) est posé par le dialogue de victoire, au format de FR04 (`choix: []` dans le scénario, les options dans `CHOIX_FRANCE` de `consequences.ts`, que ce lot ne touche pas) : Edran pose la condition de l'équipe de l'Est, Ariane présente les deux options et leur coût, Tomas dit qu'il ne jugera pas. **Garantir la livraison** : une reconnaissance commune à J2 dans FR10 ; **Refuser de garantir son crédit** : 1 500 fonds dans FR10. La conclusion du carnet renvoie à « Une signature de trop ».

### FR09 — La réserve commune (2v1, `tenir`)

Marais 18 × 14. Un canal nord-sud, trois ponts. Deux dépôts (villes) : celui du nord tenu par Solveig, celui du sud par une infanterie du joueur ; la colonne d'Ariane attend au carrefour. **« Ariane vous demande où placer sa colonne »** est pris au mot de la fiche — « le changement tient en une phrase à la radio » : la colonne est celle du joueur (le kit d'Ariane au camp 0, comme depuis FR01), et Ariane, pour la première fois, ne donne pas la consigne ; elle la demande, puis se tait (scène de J2 : « je la tiendrai où vous l'avez mise »).

Victoire : les deux dépôts à la coalition **à la fin de J10** ; un dépôt perdu se reprend jusqu'à la fin de J14. Un dépôt tenu par Solveig compte.

**Adaptation assumée de la fiche** : « conserver les deux positions pendant trois journées consécutives » ne s'exprime pas dans le moteur. `tenir` vérifie la possession à l'échéance, pas une série ; la seule façon d'imposer une tenue continue est d'ajouter `case_perdue`, et alors **aucun des trois pilotes du vérificateur ne gagne** (Edran prend le dépôt du nord vers J5, les pilotes ne défendent pas) — la mission ne serait pas démontrable. Les « trois journées » restent dans le récit : la scène de J8 compte les trois dernières (« la huitième, la neuvième, la dixième »), et le gabarit `tenir` (10–16 journées) fixe l'échéance à J10.

## Mesures

Pilotes de `scripts/verifier-campagne.ts` (heuristique, IA pondérée, IA agressive), carte et scénario du canon. Colonne « vérificateur » : la graine du vérificateur ; les autres colonnes, deux graines de plus, par une copie locale de la même boucle. Le vérificateur complet rend **40 couples sur 42** : les six de ce lot passent, les deux rouges sont FR03, rouge avant ce lot.

| Mission / mode | Vérificateur (`npm run verifier:campagne`) | Heuristique, 3 graines | Pondérée | Agressive |
|---|---|---|---|---|
| FR07 normal | gagnée, heuristique, **J11**, rejeu conforme | 3/3, J11 | 0/3 | 0/3 |
| FR07 difficile | gagnée, heuristique, **J11**, rejeu conforme | 3/3, J11 | 0/3 | 0/3 |
| FR08 normal | gagnée, heuristique, **J22**, rejeu conforme | 3/3, J22·17·17 | 3/3, J20·17·18 | 3/3, J23·17·21 |
| FR08 difficile | gagnée, heuristique, **J17**, rejeu conforme | 3/3, J17 | 2/3, J26·18 | 3/3, J17·16·18 |
| FR09 normal | gagnée, heuristique, **J13**, rejeu conforme | 2/3, J13·13 | 3/3, J11 | 3/3, J11 |
| FR09 difficile | gagnée, heuristique, **J11**, rejeu conforme | 3/3, J11 | 3/3, J11 | 3/3, J14·11·11 |

Lecture honnête :

- **FR07** : l'heuristique gagne en fonçant d'un relais à l'autre sans tirer (sept pertes, aucune chez Ost) ; les deux IA ne visent pas les relais (ce n'est pas leur objectif) et ne gagnent pas, ce qui ne dit rien de la mission. Premier relais J1, deuxième J5, troisième J11 par une infanterie qui a passé le ruisseau à gué. Premier contact J3 : la fenêtre de reconnaissance de la fiche existe.
- **FR08** : toutes les parties se décident (aucune au chronomètre sur 18), entre J16 et J26 ; le premier QG tombe vers J11–J16. C'est la mission la plus longue des trois, dans la fenêtre du gabarit `capture_qg` (14–22) à la graine du vérificateur, au bord (J22).
- **FR09** : J11 est le minimum possible (échéance J10). Dans les parties de l'heuristique, Edran prend les deux dépôts vers J6–J7 et la coalition les reprend : la pression existe.
- Ce ne sont pas des mesures de difficulté humaine. L'intérêt, la lisibilité des relais en or sous brouillard, la tenue des dialogues à l'écran : **non vérifiés**.

**Ce qui a été essayé et rejeté** (journaux dans `apercus/fr07-09/mesures/`, outils de dessin et de simulation dans `apercus/fr07-09/outils/` ; `apercus/` n'est pas versionné) : FR07 avec le dernier relais au nord-est, près de l'usine d'Ost — l'heuristique s'y fait détruire, 0/3 ; avec un pont au sud — J6, trop court ; relais posés sur les villes plutôt qu'à côté — les pilotes calent au deuxième. FR08 en 24 × 16, puis 20 × 14 à revenu adverse de 500 et de 300, puis quatre « pièces » séparées par deux ruisseaux, puis un convoi de Solveig sans usine : de 1/3 à 0/3 selon les graines, décisions à J20–J27, souvent au chronomètre ; seul le revenu adverse nul a rendu toutes les parties décidables. Trois retouches de la version retenue (une infanterie de plus au joueur, le convoi sans transport, des fonds adverses à 500) n'ont rien amélioré de mesurable.

## Contrôle des cartes (`npm run controler`) et laboratoire

Les cartes de campagne sont asymétriques : les seuils de duel (avantage du premier joueur, écart de valeur, villes par camp) sont informatifs. **Aucune ne porte de motif structurel** (schéma, QG sans chemin, zone morte, départ bloqué, ports) ; chaque camp possède un QG.

- FR07 : `avantage_premier_joueur` seul — en duel libre, le camp d'Ost gagne 52 parties sur 60. Sans objet pour une mission de relais, mais c'est une indication : **un joueur qui cherche l'affrontement direct perd** ; la mission se gagne en contournant.
- FR08 : `desequilibre_fonds` (5,9 %) et `desequilibre_villes` (3, 2, 3, 1) ; 60 parties en chacun pour soi, 0 sans résultat.
- FR09 : `desequilibre_fonds` (16,3 %), `avantage_premier_joueur`, `desequilibre_villes` ; en chacun pour soi, le camp d'Edran gagne 56 parties sur 60 — la mission, elle, se joue à deux contre un et sans capture de QG.

Le laboratoire (`scripts/concevoir-mission.ts`) compose des **variantes** autour du scénario et les fait jouer par l'IA agressive et l'IA pondérée : ses chiffres portent sur ces variantes, pas sur la carte du canon.

- FR07 (`apercus/conception-fr07`) : 16 parties, aucune victoire, toutes à la limite — ces deux pilotes ne visent pas les relais. Seule l'heuristique du vérificateur démontre la mission.
- FR08 (`apercus/conception-fr08`) : variante recommandée, victoires à J21–J22 en normal, une victoire et une défaite au chronomètre en difficile ; la seconde variante n'a pas pu être construite (« second axe »).
- FR09 : les formes `deux_axes` et `position_defensive` ne se construisent pas sur ce marais (« second axe ») ; en `avance_directe` (`apercus/conception-fr09-directe`), 8 parties, 8 victoires à J11 dans les deux modes. **FR09 est la plus facile des trois pour les IA** ; c'est la première mission `tenir` du parcours.

## Ce que ce lot n'a pas pu écrire, et ce qu'il propose

1. **Le choix de FR08 dans `CHOIX_FRANCE`** (`src/app/campagne/consequences.ts`) : écrit par le lot FR10–FR12 avec les clés de ce lot, `garantir_livraison` (« Garantir la livraison au signataire ») et `refuser_garantie` (« Refuser de garantir son crédit »), l'ancienne longueur de graine gardée dans `LONGUEURS_GRAINE`. Un seul écart de mots : ses répliques de FR10 disent « la délégation qui a signé », ce lot dit « l'équipe de l'Est » — le mot « délégation » fait partie de ceux que le propriétaire a retirés le 12 septembre.
2. **`FIN_CHAPITRE_FR`** (`src/content/difficulte.ts`, hors de ce lot) : trois entrées proposées pour que le difficile soit celui des fiches et que les alliés n'en profitent pas — FR07 un char léger de couverture à J1 près de l'artillerie de l'est ; FR08 `alliesPropres` (Tomas ne reçoit pas le crédit méridien) ; FR09 `alliesPropres` et la relève d'Edran au sud-est à J5, annoncée au briefing et rappelée à J4. Mesurées avec une copie de la même logique : FR07 difficile 3/3 à J11 pour l'heuristique ; FR08 inchangé en normal, difficile 3/3 (J16–J19) ; FR09 difficile 3/3 (J11–J12). Sans ces entrées, les missions restent valides et gagnables : le difficile n'est alors que le budget adverse et le Bulletin à une journée, et à FR08–FR09 l'allié reçoit le même budget que l'adversaire.
3. **Écart de texte à surveiller** : les lignes « Mode difficile » du tutoriel restent vraies avec ou sans ces entrées ; l'annonce détaillée du difficile ne paraît qu'avec elles.

## Tests connus rouges, étrangers à ce lot

`tests/campagne/aventure-editoriale.test.ts` et `tests/campagne/tutoriels.test.ts` attendent 12 missions au parcours (18 avant ce lot, 21 après) ; `tests/campagne/difficulte.test.ts` (préférences) ; `tests/engine/objectifs.test.ts` sur FR06 (la boucle de huit fins de tour ne fait pas huit journées à trois camps) ; `tests/engine/commandants-v4.test.ts` (`VERSION_MOTEUR` 9 contre 8 attendu) ; `tests/app/vestiaire.test.ts` (chaînes) ; `tests/app/parties-libres.test.ts` tant que FR10–FR12 ne sont pas au parcours. `verifier:campagne` échouait déjà sur FR03 avant ce lot.
