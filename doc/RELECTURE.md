# Relecture croisée — seconde passe (5 septembre 2026)

*Relecteur en chef. Périmètre : `BRIEF.md`, `PLAN.md` et les neuf documents `doc/00` à `doc/08`, après les trois sections nouvelles du canon (« Arbitrages du 5 septembre 2026 », « Climat », « Le jeu vivant ») et la mise à jour parallèle des documents par les quatre rédacteurs.*

---

## Ce qui est derrière nous

La **première passe** avait relevé environ **180 corrections** de cohérence (noms de champs, valeurs d'énumération, renvois croisés, numéros de section) et **cinq incompatibilités de conception** que les documents ne pouvaient pas trancher seuls. Ces cinq points ont été arbitrés par Thief et inscrits au canon (`BRIEF.md`, « Arbitrages du 5 septembre 2026 ») :

1. une seule liste de **dix archétypes**, « le professeur » remplacé par « la météorologue », `01-bible.md` §6 propriétaire ;
2. **co-commandant : passif seul** plus une barre de jauge, carte de terrain pour un régional français, trois recrutés, un seul actif ;
3. **unités navales reportées**, avec une spécialité de repli terrestre par pays et région maritime ;
4. **durées de pouvoir en journées** (1 à 3) et `poser_terrain` comme seule famille d'effet nouvelle ;
5. **`ReviewVerdict.motifs` structuré**, la gravité restant au catalogue de motifs.

Ces cinq arbitrages sont correctement reportés partout : les neuf documents les citent, aucun ne les contredit. Les trois sections nouvelles du brief (climat, jeu vivant) sont elles aussi bien descendues. **Le canon n'est contredit nulle part** dans cette seconde passe — les seuls écarts trouvés sont entre documents, ou dans des chiffres devenus faux au passage.

---

## Corrections faites dans cette passe

**43 corrections mécaniques**, dans sept documents. Aucune décision de conception n'a été prise ; tout ce qui suit est un nom, une valeur, un renvoi ou un doublon.

### `03-schemas.md` — 11 corrections *(propriétaire des schémas)*

| Où | Quoi |
|---|---|
| §1 | `Archetype` devient une **union fermée des dix clés** (`stratege_prudent` … `gardienne`), reprises de `01-bible.md` §6 qui les publie désormais. |
| §3 | Ajout de **`UnitType.subitDegats`** — la **colonne** de la table de dégâts, obligatoire et complète dès que `statut !== 'canon'`, refusée sur une unité `canon`. C'est le nom proposé par `05` ; `03` le tranche et `04` §13.3 garde ses contraintes de forme. |
| §8 | Le domaine **`depeche`** entre dans la liste des domaines `monde.*` **et dans la regex de validation** — sans quoi `monde.depeche.serie` (`01` §8.4) était refusé par le schéma. |
| §12 | `MotifRejet` gagne **`injouable_sous_meteo`** et **`nuit_bloquante`**, famille « climat », proposés par `05` §4.3. |
| §12 | `ReviewVerdict.stats` accepte la forme **`{ avec, sans }`** pour `cibleType === 'unite'`, et elle seule ; la prose de validation, qui parlait d'un « double » sans forme, est alignée. |
| §12 | Note nouvelle : `champ_calcule`, `effet_hors_bornes` et `version_perimee` sont des **refus de la couche API**, pas des `MotifRejet` — les deux vocabulaires étaient mélangés. |
| §15 | Récapitulatif des propositions mis à jour (trois lignes). |

### `01-bible.md` — 2 corrections *(propriétaire du lore et des flags)*

- §6 : la table des archétypes gagne une colonne **Clé**, publiée pour les dix. C'était le chaînon manquant : `03` et `06` employaient des clés (`prodige`, `gardienne`) qu'aucun document ne définissait.
- §4.6 : « une crue spectaculaire » remplacé par « une saison remarquable » dans les exemples de Dépêche — une crue est à la frontière de la liste noire de §7.3.

### `02-architecture.md` — 9 corrections

| Où | Quoi |
|---|---|
| §3.6 | La table des routes gagne les **endpoints nouveaux de `05` §7.2** : `map/missions?priorite=depeche`, `catalogue/unites` (GET), `catalogue/unites/[cle]` (PATCH, humain seul), `cerveau/homologation`, `cerveau/unites`. La ligne `controle/simulations` précise ses deux formes (multi-climat, catalogue). |
| §3.6 | `unit_types` gagne **`essai_jusqu_au`**, que `05` §9.2 suppose (dossier de promotion à J+30). |
| §3.6 | `daily_missions.catalogue_version` documentée comme **copie dénormalisée** de celle du scénario — `03` §14 dit « trois endroits, et trois seulement ». |
| §3.6 | `reviews.motifs` passe de `text[]` à **`jsonb`** (+ `codes_motifs` indexé) : les motifs sont structurés depuis l'arbitrage n° 5 ; `stats` peut porter le couple `{avec, sans}`. |
| §4 | L'arborescence listait quatre documents sur dix dans `doc/`. |
| §6 | Le verdict passait par un `POST /api/routines/controle` inexistant : c'est `POST /api/routines/missions/[id]/soumission` (`05` §7.2 fait foi). |
| §6.1 | **Les heures de la Dépêche étaient fausses** (06:00 / 09:00 / 12:00 / 14:00) : alignées sur `05` §8.2 et §7.3, qui font foi — 07:00, 09:30, 11:00, 17:00 d'échéance, 18:00 de mise en ligne. |
| §8 | La matrice climatique de l'intégration continue (6 à 9 configurations) était en contradiction apparente avec la borne d'appel de `05` §4.2 (3 à 6 conditions) : les deux périmètres sont maintenant explicites. |

### `04-gameplay.md` — 1 correction

- §3 : « l'usine produit les **8** unités de domaine `terre` » — il y en a **9** (les dix moins l'`helico`).

### `05-routines.md` — 13 corrections *(propriétaire des routines)*

| Où | Quoi |
|---|---|
| §1.2 | `Enveloppe.source` ne prend pas les quatre clés de routine mais **trois** : `atlas_controle` rend un verdict, elle n'écrit pas de contenu. |
| §2.2 | L'extrait de fiche pays écrivait `"specialite": "defense"` (chaîne) : remplacé par l'**objet `Specialite`** de `03` §1, et `hemisphere`, devenu obligatoire, ajouté. |
| §3.3 et §3.6 | **`climatFixe`** décrit comme « null ou une saison » : c'est l'**objet `{ saison?, meteo? }`** de `03` §6. Corrigé dans la prose et dans le prompt bootstrap. |
| §3.3 et §3.6 | Borne `cycleJourNuit` : `jour ≥ 1` était faux — c'est `jour ≥ 0`, sinon la nuit polaire `{ jour: 0, nuit: 6 }` du brief est impossible. |
| §4.2 | L'exemple de `StatsSimulation` omettait `mecaniqueDeclenchee` et `climat`, et le texte affirmait que `mecanique_declenchee` **n'appartient pas** au schéma. C'est l'inverse depuis les points mineurs du 5 septembre : les deux champs sont dans `StatsSimulation`. |
| §4.2 | « le schéma n'accepte qu'un `StatsSimulation` » précisé : vrai pour une carte, faux pour une unité. |
| §4.3 | `injouable_sous_meteo` et `nuit_bloquante` ne sont plus marqués **[proposition]** : ils existent dans `MotifRejet`. |
| §4.6 | Prompt bootstrap : le bloc `stats` d'un verdict d'unité vaut `{avec, sans}`. |
| §5.6 | La « réserve de nommage » sur `subitDegats` est levée : `03` §3 a tranché, le nom est celui-là. |
| §9.2 | Les deux réserves de schéma (`CibleReview` sans `unite`, `stats` simple) sont levées — `03` §12 porte les deux. |
| §9.4 | Renvoi ajouté : `unit_types` et `daily_missions` sont définies une seule fois, dans `02` §3.6. |

### `06-pays-de-depart.md` — 3 corrections

- §2 : table des archétypes alignée sur les **clés** de `01` §6.
- §4 : ajout d'une ligne « Comment lire les chiffres » disant que **la spécialité de jeu est un objet `Specialite`** de `03` §1 (clé, portée, famille, effets, description), les fiches n'en donnant que le bonus et le malus en clair.
- §5.3 : le `cycleJourNuit` **2 / 4** d'Islande était appelé « nuit polaire », ce qui le confondait avec l'effet `nuit_polaire` de `04` §12.2, qui force `{ jour: 0, nuit: 6 }` et ne vaut que pour le climat `polaire`. Précisé : `Country.climat = 'oceanique'`, c'est un cycle de scénario.

### `07-france-regions.md` — 3 corrections

- §2.5 : ajout de ce qu'un hook **renvoie** — la liste fermée `EffetMecanique` de `04` §11.1, **variant `modificateur` compris**. C'est lui qui porte tous les effets chiffrés des fiches (brume des Hauts-de-France, surplomb bourguignon, défense du bocage, circuit ligérien) ; le document l'employait sans le nommer.
- §2.6 : `03` §1 désigné propriétaire de la forme de `Specialite`. *(L'encadré qui signalait les deux points ouverts a depuis été retiré : ils sont tranchés — voir « Tranchés le 5 septembre 2026 », points 1 et 2.)*
- §4.17 : la fiche Mayotte avait ses « points d'intérêt » orphelins, recollés à la fin du paragraphe « Sans paquet naval ». Remis à leur place. *(Ce paragraphe est depuis devenu la table des deux `MapDef` — voir « Tranchés », point 6.)*

### `PLAN.md` — vérifié, rien à corriger

Les six renvois numérotés du plan sont justes : `02` §3.6 et §4, `04` §12 (climat) et §13 (homologation), `05` §8 et §9. Les bornes citées (une candidate par semaine, une homologation par mois, 24 actives, sept jours, 10 à 15 journées, cycle 4/2) sont conformes au brief.

---

## Tranchés le 5 septembre 2026 (seconde relecture)

Sept des huit points ouverts par cette passe ont été arbitrés par Thief et inscrits au canon (`BRIEF.md`, « Points ouverts par la seconde relecture, tranchés aussi »). Ils sont **appliqués** dans les documents ci-dessous, chez le propriétaire d'abord, puis partout où un document y renvoie.

### 1. `Specialite` gagne un variant « trait »

**Décision.** Une spécialité est soit un **modificateur** (même vocabulaire que les pouvoirs), soit un **trait** pris dans une liste fermée courte propre aux spécialités : `TraitSpecialite = 'franchissement_riviere' | 'experience_rapide' | 'ravitaillement_ville' | 'vision_nuit' | 'pied_marin'`. `03` §1 est propriétaire ; la liste grandit par arbitrage, **jamais** par une routine.

**Documents modifiés.**

- `03-schemas.md` §1 — type `TraitSpecialite` (liste fermée, chaque valeur documentée), type `ContenuSpecialite` à deux variants, et `Specialite.effets` remplacé par **`Specialite.contenu`** ; validations (un seul variant, cohérence trait × `famille`, valeur hors liste = `schema_invalide`) ; exemples JSON France et Bretagne mis à jour. §2 : la liste des endroits qui n'acceptent que le variant modificateur cite désormais `Specialite.contenu`. §15 : proposition n° 20 (cohérence trait × famille).
- `07-france-regions.md` §2.4 et §2.6 — les deux variants décrits, l'encadré « deux points ouverts » supprimé. Neuf fiches réécrites : **Grand Est** « Génie » → `franchissement_riviere` ; **Bourgogne-Franche-Comté** « Millésime » → `experience_rapide` ; **Occitanie** « Écluse » → `pied_marin` ; **Mayotte** « Gué » → `franchissement_riviere` ; **Île-de-France** « Réseau » → `ravitaillement_ville`. Quatre traits inventés hors liste sont **repassés en modificateurs**, parce qu'ils s'écrivent très bien en chiffres : **Nouvelle-Aquitaine** (`ligne_droite` → `mouvement +2` sur `route`), **Corse** (`discretion_foret` → `unites_adverses` `vision −2` en forêt), **Martinique** (`coupe_ligne_de_tir` → `unites_adverses` `portee −1` sur le tir indirect), **La Réunion** (`sans_malus_pente` retiré, le `mouvement +1` disait déjà tout).
- `06-pays-de-depart.md` §4 — « Comment lire les chiffres » décrit les deux variants et la liste fermée. **Namibie** : l'invisibilité de la brume, qui n'était ni un modificateur ni un trait de la liste, devient `unites_adverses` `vision −2` en zone côtière. **Pays-Bas** et **Pérou** : leur spécialité posait du terrain, ce que `03` §1 interdit — le geste est rendu à leur pouvoir et à la mécanique régionale.
- `05-routines.md` §2.2 — l'extrait de fiche pays (Suisse) passe à `contenu: { variant: 'modificateur', effets: [...] }`.

### 2. Cinq spécialités possédées, une seule équipée par match

**Décision.** Même geste que les co-commandants (trois recrutés, un actif). Le **plafond de cumul de `03` est donc un** ; le **plafond de collection de `07` reste cinq**. Les deux règles ne portaient pas sur le même objet, c'est ce qui les faisait diverger.

**Documents modifiés.**

- `03-schemas.md` §1 — « au plus deux spécialités actives » devient « une seule spécialité active », la saturation des multiplicateurs entre spécialités disparaît (il n'y a plus rien à saturer), l'équilibrage se vérifie spécialité par spécialité. §7 : la validation de `specialiteLocale` renvoie au nouveau plafond.
- `04-gameplay.md` §7.6 — section nouvelle, « Spécialités : cinq possédées, une équipée », qui pose la règle côté moteur à côté de celle des co-commandants (§7.5).
- `07-france-regions.md` §2.4, §2.6, §7 et §8 — le « cinq » est explicitement un plafond de **collection**, l'équipement est de **un**.
- `06-pays-de-depart.md` §4 — les deux plafonds rappelés ; la spécialité du pays de départ n'a pas de statut particulier, elle occupe un emplacement comme les autres.

### 3. `poser_terrain` : sept formes, et sept seulement

**Décision.** `pont`, `telepherique`, `cable`, `chenal`, `polder`, **`ponton`**, **`banc_de_sable`**. Sources chaudes, glace et tout ce qui tient du climat relèvent des **saisons** ou des **mécaniques régionales**, pas des pouvoirs.

**Documents modifiés.**

- `04-gameplay.md` §7.2 *(propriétaire de la table)* — deux lignes ajoutées à la table `depuis → vers` (`ponton` : `mer`/`riviere` → `pont`, jamais permanent ; `banc_de_sable` : `mer` → `plage`), et un paragraphe « la table ne s'ouvre pas » qui renvoie la glace vers `rivieres_gelees`, la source chaude vers un `soin` sur terrain ou une mécanique volcanique, la roche neuve vers une mécanique régionale. §14 : la proposition n° 18 parle de sept formes.
- `03-schemas.md` §2 — `EffetPoserTerrain.forme` gagne les deux valeurs ; la validation dit que la table est fermée et qu'une forme nouvelle demande un arbitrage.
- `06-pays-de-depart.md` — §4 réécrit (les cinq « autres terrains » ne relèvent plus de la famille). **Islande** : « Terre de feu » ne pose plus de sources chaudes permanentes, elle **réveille** celles que porte la mécanique régionale volcanique. **Canada** : « Le grand gel » ne gèle plus les plans d'eau — c'est l'effet de saison `rivieres_gelees`, qui vaut pour tout le monde ; le pouvoir dit ce qu'Émile fait vraiment, il marche dessus mieux que les autres. **Luxembourg** : le Bastion d'acier ne pose plus une « forteresse » (forme inexistante), il modifie la défense autour de lui. **Grèce** (forme `ponton`), **Fidji** (forme `banc_de_sable`) et **Pérou** (formes `cable` et `telepherique`) nomment désormais leur forme.
- `07-france-regions.md` §4.17 — le pouvoir d'Anli Soilihi nomme la forme `banc_de_sable`.

### 4. Multiplicateur de capture : `[0,5 ; 3,0]`

**Décision.** La borne passe à `[0,5 ; 3,0]`, et une valeur **inférieure à 1,0 ne peut viser que `unites_adverses`**. La gardienne retrouve sa famille de pouvoir.

**Documents modifiés.**

- `03-schemas.md` §2 — commentaire de la borne, et validation : `capture` est la seule exception à `[0,5 ; 2,0]`, toute cible autre que `unites_adverses` sous 1,0 est un `effet_hors_bornes`.
- `04-gameplay.md` §7.2 — la règle et son garde-fou (aucun blocage possible : les points repartent de zéro au mouvement, un ×0,5 double au pire le temps de capture) ; §6, un point de rappel dans les règles de capture.
- `06-pays-de-depart.md` §4 et §5.2 — la borne dans « Comment lire les chiffres », et le super-pouvoir **« Place forte »** du **Luxembourg** retrouve son idée : `unites_adverses` — `capture ×0,5` dans le rayon du commandant. Le QG se défend et se capture lentement, sans jamais devenir incapturable, et le malus de QG fragile reste vrai le reste du temps.
- `01-bible.md` §6 — la ligne `gardienne` cite `capture ×0,5` sur `unites_adverses` dans sa famille de pouvoir.

### 5. `gelable: false` sur les mécaniques régionales

**Décision.** Une mécanique régionale peut déclarer `gelable: false` (défaut `true`) ; le **Grand Est** le fait, son fleuve ne gèle jamais.

**Documents modifiés.**

- `03-schemas.md` §7 — `gelable` documenté comme **paramètre commun** offert à toute mécanique, en plus du `schemaParametres` qu'elle publie ; §15, proposition n° 21.
- `04-gameplay.md` §11.1 — le paramètre commun, lu par le moteur avant la mécanique. §12.2 — la ligne `rivieres_gelees` porte l'exception. §12.6 — une **cinquième** règle de résolution, « Refus de gel », avec l'obligation de l'annoncer au joueur dans la description de la mécanique.
- `07-france-regions.md` §4.6 — `meca_fleuve_ponts` déclare `gelable: false` ; la ligne « Saisons et météo » du Grand Est est réécrite : les ruisseaux gèlent, le fleuve non, la carte garde sa nature et la routine contrôle certifie **une** carte au lieu de deux.

### 6. Mayotte : deux `MapDef` distinctes

**Décision.** `carte_fr_mayotte_repli_01` (60/40, sans paquet naval) et `carte_fr_mayotte_01` (35/65, avec), pas une carte à ratio variable. Même règle pour toute région dans ce cas.

**Documents modifiés.**

- `07-france-regions.md` §4.17 — la ligne « Sans paquet naval » devient une table des deux cartes, avec leurs clés, leurs ratios et leurs statuts (`en_ligne` / `brouillon`) ; §2.7 — la règle générale, deux clés et deux certifications dès que l'écart de ratio change la nature de la carte ; §5 — la Nouvelle-Calédonie suit la même découpe ; §8 point 3 — le cas Mayotte passe de « à trancher » à « tranché », ce qui reste ouvert étant les ratios de repli des cinq autres régions maritimes.
- `03-schemas.md` §7 — une région **peut porter plusieurs `MapDef`** : c'est dit explicitement dans les validations de `Region`, avec le cas Mayotte en exemple et la règle « une carte certifiée ne change jamais de ratio après coup ».

### 7. La carte du commandant régional est l'une des trois

**Décision.** Elle n'est **pas** une quatrième carte. L'inflation se mesure à l'étape 7 du plan et se corrige par les plafonds, jamais par de nouvelles règles.

**Documents modifiés.**

- `04-gameplay.md` §7.5 — l'exclusion écrite noir sur blanc, avec la liste des plafonds (trois cartes, trois co-commandants, un actif, cinq spécialités, une équipée) et la méthode : mesurer, resserrer un plafond, ne jamais ajouter de règle.
- `07-france-regions.md` §2.4, §7 et §8 point 2 — la carte du co-commandant régional prend un emplacement de la sacoche ; si les trois sont pris, le joueur choisit laquelle il laisse.
- `01-bible.md` §6 et §11 — la règle du co-commandant précise « l'une des trois, pas une quatrième » et liste les plafonds.
- `08-narration-choix.md` §4.2 et §4.3 — même précision : un joueur n'arrive jamais au mondial avec quatre cartes.

---

## Ce qui reste à trancher — pour Thief

Un seul point, le huitième de la liste initiale : il est technique, il n'oppose aucun document à un autre, et rien ne le rend urgent avant l'écriture du moteur.

### 1. `CleUnite` est un type ouvert

`03` §3 pose `type CleUnite = Cle`, borné seulement par le plafond de 24 et le versionnage. Le moteur, le rendu et la table de dégâts manipulent donc des chaînes non vérifiées à la compilation.

> **Recommandation :** garder le type ouvert (le catalogue est vivant, c'est le principe), mais **générer** depuis `content/unites.json` un type `CleUniteActive` à la compilation, et l'employer partout où le code parle du catalogue courant. Le déterminisme reste porté par `catalogueVersion` ; la sécurité de typage revient sans fermer l'énumération.

### 2. `vision_nuit` n'est déclaré par aucune fiche *(découvert en appliquant le point 1)*

Quatre des cinq valeurs de `TraitSpecialite` sont employées après réécriture ; **`vision_nuit` ne l'est par aucune**. Ce n'est pas une incohérence — un trait de la liste peut attendre son emploi — mais c'est une valeur que rien ne teste. Les deux candidates naturelles sont l'**Islande**, dont l'hiver se joue en `cycleJourNuit` 2 / 4, et la **Guyane** et sa canopée. À décider en écrivant les fiches, pas ici : leurs spécialités actuelles sont l'une et l'autre parfaitement exprimables en modificateurs, et les remplacer serait un choix de conception, pas une correction.

---

## Deux points mineurs, pour mémoire

- **`Country.climat` n'est écrit pour aucun des 24 pays.** Les fiches de `06` donnent le climat en prose (« subpolaire océanique », « tempéré doux »), jamais la valeur d'énumération, alors que c'est elle qui indexe la table climat × saison et la table de probabilités météo de `04` §12. Il manque une colonne `climat` au tableau récapitulatif de `06` §6. Sans elle, la routine map ne peut pas servir son bloc `climat`.
- **`monde.depeche.serie` et « pas de série à ne pas casser ».** `00` §4 et §6 promettent qu'il n'y a pas de série à entretenir ; `01` §8.4 et `08` §9.4 créent un compteur de dépêches enchaînées. `08` §4.4 résout la tension (il vit hors sauvegarde, aucune fin ne le lit) ; il suffit que `00` le mentionne pour qu'un lecteur ne croie pas à une contradiction.

> **Note du coordinateur (5 septembre 2026)** : les deux derniers points ci-dessus sont tranchés dans `BRIEF.md` (« Points ouverts par la seconde relecture », n° 8 et 9) : `CleUnite` reste ouvert, `vision_nuit` reste dans la liste fermée. Il ne reste aucun arbitrage ouvert.
