# Atlas Tournament — Le format des spécifications d'assets

> Document 11. Découle du canon `BRIEF.md`, section « Direction artistique (révisée le 5 septembre 2026 : 3D) ».
> **Propriétaire** du format `AssetSpec`, des conventions de fichiers, des budgets par asset et du contrôle des livraisons.
> La direction artistique appartient à `10-rendu-3d.md`. Le ton et les interdits appartiennent à `01-bible.md` §5 et §7.
> Implémentation : `src/assets/spec.ts` (le type), `src/assets/valider.ts` (le validateur de spécification), `src/assets/catalogue.ts` (la production depuis le canon), `src/assets/valider-gltf.ts` (le contrôle des livraisons), `scripts/generer-specs-assets.ts` (l'écriture de `assets/specs/`).

---

## 1. Le problème, et pourquoi il se règle par un contrat

Le projet a besoin d'une centaine de modèles et de plusieurs centaines de textures. Personne dans l'équipe ne les sculptera. Ils sont produits par un **générateur externe** (ChatGPT 6 Astra), à qui l'on décrit ce qu'on veut. La question n'est donc pas « comment modéliser » mais **« comment commander, et comment vérifier ce qui revient »**.

Une commande en langue naturelle ne suffit pas. « Un char léger de style cartoon réaliste » revient à quarante centimètres de haut un jour, à deux mètres le lendemain, avec un pivot au centre du volume, sans masque de couleur d'équipe, en 180 000 triangles, et il faut tout recommencer. Ce qu'il faut, c'est un **contrat** : un JSON qui dit ce qui est vrai du fichier attendu, assez précis pour qu'un fichier conforme soit utilisable tel quel, et assez **mécanique** pour qu'un fichier non conforme soit refusé sans discussion.

D'où trois décisions structurantes.

**a) Les spécifications sont générées, pas écrites.** `scripts/generer-specs-assets.ts` lit `content/unites.json`, `content/terrains.json`, `content/archetypes.json`, les **24 fiches pays** (`content/pays/`), les **18 régions de France** (`content/regions/fr/`) et les **styles** (`content/styles/`), et produit `assets/specs/*.json`. Une unité nouvelle homologuée (`04-gameplay.md` §13) apparaît donc dans les commandes **le jour même**, sans qu'un humain n'écrive une ligne : sa description est composée depuis sa `Silhouette`, exactement comme le rendu compose son placeholder, et ses vingt-quatre kits nationaux sont composés depuis les styles. Les descriptions tenues à la main des dix unités canon sont un enrichissement, jamais une condition.

**b) La description est bilingue.** Le générateur lit l'anglais ; c'est l'anglais qui produit le modèle. Le français est la version qui fait foi en relecture et en cas de désaccord, parce que le canon du projet est en français (`09-i18n.md`). Les deux textes disent la même chose ; le validateur refuse deux champs identiques, ce qui attrape la copie paresseuse.

**c) Tout champ du format est vérifiable.** Rien n'entre dans `AssetSpec` qui ne puisse être contrôlé sur le fichier rendu : l'échelle se mesure sur la boîte englobante, le budget se compte, les nœuds, les matériaux, le masque d'équipe et les animations se lisent dans le document glTF. Un champ décoratif serait un champ que personne n'applique, donc un champ que le générateur apprendrait à ignorer.

**La règle qui tient tout le reste : un asset refusé ne remplace jamais le placeholder.** Le jeu tourne aujourd'hui sans un seul asset livré ; il tournera demain avec la moitié livrée. Il n'y a jamais d'état cassé.

---

## 2. La boucle

```
   canon (content/*.json)
        │
        │  scripts/generer-specs-assets.ts
        ▼
   assets/specs/<id>.json  ──► [ validerAssetSpec ]  ──► refusé : le canon est faux, on corrige le canon
        │                                                  (le générateur n'a jamais vu la commande)
        │  la spécification part au générateur externe
        ▼
   <id>_lod0.glb + textures
        │
        │  validerGlb(octets, spec)
        ▼
   { ok: true }  ──► l'asset entre dans le jeu, le placeholder disparaît
   { ok: false, motifs } ──► on renvoie les motifs au générateur, le placeholder reste
```

Deux propriétés de cette boucle valent d'être notées. D'abord, **le dépôt ne livre jamais un contrat qu'il refuserait lui-même** : le script repasse chaque spécification dans `validerAssetSpec` avant de l'écrire, et n'écrit rien si une seule échoue. Ensuite, **les motifs de refus sont exploitables** : un `asset_budget` avec `{ triangles: 41200, budget: 6000 }` est une consigne pour le run suivant, pas un reproche. C'est le même principe que les motifs structurés de la routine contrôle (`05-routines.md`).

`assets/specs/` est **versionné dans le dépôt**, pas ignoré : c'est ce qui permet de relire une commande en revue de code, de voir en diff ce qu'une modification du canon change dans les commandes, et de rejouer une livraison. Le mode `--verifier` du script échoue si le dossier a dérivé du canon ; c'est la vérification d'intégration continue.

---

## 3. Le format `AssetSpec`

```ts
interface AssetSpec {
  id: Cle;                 // toujours `<type>_<cle>`
  type: TypeAsset;         // unite | kit | terrain | batiment | decor | commandant | effet
  cle: Cle;                // la clé canon : char_leger_base, fr_char_leger, foret, veteran…
  priorite: 1 | 2 | 3;     // 1 = la France et ses premiers adversaires
  description: Bilingue;   // { en, fr }
  style: StyleAsset;
  echelle: Echelle;
  pivot: Pivot;
  budget: Budget;
  textures: TextureSpec[];
  variantes: Variantes;
  animations: AnimationSpec[];
  format: FormatAsset;
  nommage: Nommage;
  interdits: Interdit[];
  verification: Verification;
}
```

### 3.1 `id`, `type`, `cle`

L'identifiant est **toujours** `<type>_<cle>`, et le validateur le vérifie : `unite_char_leger_base`, `kit_fr_char_leger`, `terrain_foret`, `batiment_qg_fr_bretagne`, `decor_arbre_cotier_fr_bretagne`, `commandant_veteran`. C'est lui qui nomme le fichier de spécification, tous les fichiers livrés, et la clé de chargement dans le rendu. Une seule chaîne à connaître par asset. Une `Cle` fait 48 caractères au plus : c'est pourquoi une région entre dans un identifiant par son **nom court** (`bretagne`) et non par sa clé complète (`region_fr_bretagne`), le pays étant déjà dans l'identifiant.

Les sept familles : `unite` (la **géométrie de base** partagée d'un type du catalogue), `kit` (le **kit national** d'une unité pour une nation), `terrain` (les huit terrains non capturables), `batiment` (les quatre capturables — ville, QG, usine, aéroport — **par région ou par pays**), `decor` (la végétation par territoire, les rochers par biome), `commandant` (bustes par archétype), `effet` (réservé : particules et impacts, pas encore commandés).

### 3.1 bis `priorite` — dans quel ordre on commande

Chaque spécification porte une priorité de production, parce qu'on ne commande pas 540 assets le même jour et qu'un générateur externe travaille en file :

| Priorité | Ce qu'elle contient | Pourquoi |
|:-:|---|---|
| **1** | La France (ses 18 régions, bâtiments et décor compris), son rival le Luxembourg, son voisin la Suisse, plus tout ce qui est **partagé** : les 10 géométries de base, les 8 terrains, les 10 rochers | C'est l'ordre de jeu : le joueur français fait sa qualification nationale **avant** de voir un seul adversaire étranger (`doc/07`) |
| **2** | Les autres pays phares (Japon, Brésil) et le reste de l'Europe (Islande, Pays-Bas, Grèce) | Le premier acte du voyage, et les trois prologues écrits à la main qui suivent celui de la France |
| **3** | Les seize autres nations | Au fil des routines, dans l'ordre où le voyage les rencontre |

La priorité d'un pays est celle de son style (`content/styles/<code>.json`), et tout ce qui appartient à ce pays en hérite : ses kits, ses bâtiments, son décor. Un buste de commandant prend la **meilleure** priorité des nations qui portent son archétype — le prodige part avec la France, la fonceuse attend. Le compte par priorité s'obtient avec `bilanPriorites()`.

### 3.2 `description`

Le cœur de la commande. Entre 160 et 2 400 caractères par langue, avec un plancher parce qu'en dessous le générateur invente, et un plafond parce qu'au-delà il se perd. Trois blocs, dans cet ordre :

1. **Ce que c'est**, en une image concrète — matières, pièces, posture, usure ;
2. **Le contrat de silhouette**, composé depuis la `Silhouette` du canon : base, corps, modules, encombrement, plus le rôle de jeu chiffré (coût, mouvement, portée, vision, traits) ;
3. **La contrainte de lecture** : reconnaissable à 65° au-dessus de l'horizontale, à trente pixels, sans détail plus fin que deux centimètres.

Exemple, pour `unite_artillerie` (extrait anglais) :

> A tracked flat-deck carrier with a long marker tube on an open pivot mount and two folding ground spades at the rear. It should read as a machine that must stop to work: spades down, tube raised, crew ladder folded on the side. No turret, no protection — deliberately vulnerable. […] Silhouette contract (must be recognisable from a 65-degree top-down camera): a tracked chassis with visible road wheels and a rubber-padded track run, a low flat deck with a raised front cab, a long marker tube on a travel lock, bulk class 2 of 3. Game role: 5500 funds, 5 movement on chenilles, range 2-3, vision 1, traits tir_indirect.

Le vocabulaire suit `01-bible.md` §5 dans les deux langues : *marker launcher* et non *gun*, *goes off the field* et non *dies*, *team athletes* et non *soldiers*. Le matériel est **homologué**, pas militaire.

### 3.3 `style`

Le même bloc partout, plus quelques mots-clés propres à l'asset :

```json
{
  "reference": "doc/01-bible.md §5 (guide de ton) et doc/10-rendu-3d.md §2",
  "devise": "Réaliste dans les matières, léger dans l'esprit.",
  "matieres": "Matières crédibles et travaillées — tôle peinte griffée, tissu technique mat, béton lavé…",
  "motsCles": ["stylised realism", "clean readable silhouette", "top-down tactics board", "…"],
  "aEviter": ["no readable text or numbers", "no real-world insignia or flags", "…"]
}
```

`motsCles` et `aEviter` sont **en anglais** : ils entrent dans l'invite. `matieres` et `devise` sont en français : ils sont pour nous, et pour la traduction manuelle si un jour le générateur change.

---

## 4. Échelle, pivot, budget, format

### 4.1 `echelle` — une case vaut un mètre

C'est la seule conversion du projet et elle ne bouge jamais : **une case de la grille = 1 unité de scène = 1 mètre**. Les axes sont ceux de glTF : `x` latéral, `y` vertical, `z` vers l'avant de l'objet. Chaque axe porte une **cible** et une **tolérance absolue**, en mètres.

| Famille | x | y | z | Tolérance |
|---|---:|---:|---:|---:|
| infanterie (base `pattes`) | 0,45 | **0,60** | 0,45 | 0,06 |
| véhicule d'encombrement 1 | 0,50 | 0,40 | 0,70 | 0,06 |
| véhicule d'encombrement 2 (char léger) | 0,62 | **0,50** | 0,85 | 0,07 |
| véhicule d'encombrement 3 (char lourd) | 0,70 | 0,58 | 0,95 | 0,08 |
| voilure tournante (base `rotor`) | 0,90 | 0,65 | 0,90 | 0,09 |
| plaque de terrain | 1,00 | relief | 1,00 | 0,04 |
| bâtiment | 0,85–0,92 | 0,45–0,95 | 0,85–0,92 | 0,07 |
| arbre | 0,55 | 0,62 | 0,55 | 0,09 |
| rocher | 0,45 | 0,30 | 0,45 | 0,08 |
| buste de commandant | 0,55 | 0,90 | 0,45 | 0,08 |

Les deux valeurs en gras sont celles que le brief fixe : une infanterie à environ 0,6 de haut, un char à environ 0,5. Tout le reste en découle par famille. **Un véhicule ne remplit jamais sa case** : deux unités voisines ne doivent pas se toucher, sinon la grille cesse de se lire.

À la vérification, l'écart accepté sur un axe est le **plus grand** de la tolérance absolue et de la tolérance relative `verification.toleranceAabb` (8 à 15 % selon la famille). Une tolérance relative seule punirait les petits objets ; une tolérance absolue seule punirait les grands.

### 4.2 `pivot` — centre au sol, avant vers +Z

```json
{ "origine": "centre_au_sol", "avant": "+z", "haut": "+y", "poseAuSol": true }
```

L'origine du modèle est au **centre de son emprise au sol**. C'est ce qui permet au rendu de poser une unité sur l'altitude du centre de sa case sans corriger quoi que ce soit, et de la faire tourner vers sa direction de déplacement sans qu'elle glisse. L'avant regarde `+Z`, le haut `+Y` (convention glTF).

`poseAuSol` vaut `false` pour ce qui vole : l'hélicoptère est modélisé **à sa hauteur de vol**, avec son ombre projetée au sol par le rendu, et le contrôle de pivot n'exige alors pas `min.y ≈ 0`. C'est la seule exception, et elle est déclarée.

### 4.3 `budget` — des triangles, par niveau de détail

Trois paliers strictement décroissants, plus un plafond de matériaux :

| Famille | LOD0 | LOD1 | LOD2 | Matériaux |
|---|---:|---:|---:|---:|
| unité, encombrement 1 | 3 500 | 1 200 | 350 | 2–3 |
| unité, base `pattes` | 4 000 | 1 400 | 400 | 2–3 |
| unité, encombrement 2 | 6 000 | 2 000 | 600 | 3 |
| unité, encombrement 3 | 9 000 | 3 000 | 900 | 3 |
| kit national | budget de sa base **+ 16 %** | idem | idem | 3 |
| plaque de terrain | 800 | 200 | 48 | 2 |
| montagne | 2 400 | 700 | 180 | 2 |
| pont | 1 200 | 320 | 80 | 2 |
| bâtiment | 4 200–6 500 | 1 400–2 100 | 400–600 | 3 |
| arbre | 2 500 | 700 | 180 | 2 |
| rocher | 900 | 260 | 64 | 2 |
| buste de commandant | 14 000 | 4 500 | 1 300 | 3 |

Ces chiffres viennent du budget par carte de `10-rendu-3d.md` §9.2 : environ 210 000 triangles et 27 draw calls pour une carte 24 × 16. `lodRequis` dit quels paliers sont exigés à la livraison : `[0, 1, 2]` pour ce qui est instancié en masse (unités, décor), `[0, 1]` pour terrains et bâtiments, `[0]` seul pour un buste de commandant, qui n'est jamais vu de loin.

### 4.4 `format` — glTF 2.0 binaire, et des noms imposés

```json
{
  "conteneur": "glb",
  "versionGltf": "2.0",
  "axeHaut": "y",
  "unite": "metre",
  "materiaux": "pbr_metallic_roughness",
  "noeudRacine": "racine",
  "noeuds": ["racine", "corps", "base", "module_tourelle"],
  "materiauxAttendus": ["mat_corps", "mat_details"]
}
```

**Les noms de nœuds sont imposés parce que le rendu les cherche par leur nom, jamais par leur index.** Un index change quand le générateur réorganise sa scène ; un nom, non. C'est ce qui permet au rendu de faire tourner `module_tourelle` vers sa cible et `base` (le rotor) en continu, sans savoir quel modèle il manipule.

| Famille | Nœuds | Matériaux |
|---|---|---|
| unité (base) | `racine`, `corps`, `base`, `socle`, puis un `module_<nom>` par module de la silhouette | `mat_corps`, `mat_details` |
| kit | `racine`, `corps`, `base`, `socle`, puis un `ornement_<nom>` par ornement du style | `mat_kit`, `mat_ornements` |
| terrain | `racine`, `sol` | `mat_sol` |
| bâtiment | `racine`, `corps`, `toit`, `enseigne` | `mat_corps`, `mat_vitrage` |
| arbre | `racine`, `tronc`, `feuillage` | `mat_ecorce`, `mat_feuillage` |
| rocher | `racine`, `bloc` | `mat_roche` |
| commandant | `racine`, `buste`, `tete` | `mat_peau`, `mat_tenue`, `mat_cheveux` |

### 4.5 `nommage`

Deux gabarits et des exemples écrits en toutes lettres, parce qu'un gabarit se lit mal et qu'un exemple ne se discute pas :

```json
{
  "modele": "{id}_lod{lod}.glb",
  "texture": "{id}_{canal}_{variante}.{ext}",
  "exemples": [
    "unite_char_leger_lod0.glb",
    "unite_char_leger_lod1.glb",
    "unite_char_leger_albedo.png",
    "unite_char_leger_albedo_hiver.png"
  ]
}
```

Le segment `_{variante}` disparaît pour la variante de base. Les fonctions `nomModele()` et `nomTexture()` (`src/assets/spec.ts`) appliquent les gabarits, pour que le rendu et le validateur composent les mêmes noms que le générateur.

---

## 5. Textures, variantes, animations

### 5.1 `textures`

Sept canaux possibles : `albedo`, `normale`, `rugosite`, `metal`, `emission`, `occlusion`, `masque_equipe`. Chacun porte sa **résolution** (256, 512, 1024 ou 2048 — jamais plus, budget mémoire mobile), son **format** (`png` pour la relecture, `ktx2` pour la livraison compressée), s'il est **obligatoire**, et une note en français qui dit à quoi il sert.

L'albédo est obligatoire partout. Le reste dépend de la famille :

| Famille | Cartes demandées |
|---|---|
| unité | albédo 1024, normales 1024, rugosité 512, métal 512 *(facultatif)*, **masque_equipe 512**, émission 512 si radar ou nacelle |
| terrain | albédo 1024, normales 1024, rugosité **1024**, occlusion 512 *(facultatif)* |
| bâtiment | albédo 1024, normales 1024, rugosité 512, **émission 512**, **masque_equipe 512** |
| décor | albédo 1024, normales 512, rugosité 512 |
| commandant | albédo **2048**, normales 1024, rugosité 512, **masque_equipe 512** |

Deux points méritent d'être justifiés. La **rugosité du terrain est en 1024** parce que c'est elle, et elle seule, qui montre le sol mouillé sous la pluie (`10-rendu-3d.md` §6.4) : sans contraste dans cette carte, la pluie ne se voit pas. L'**émission des bâtiments est obligatoire** parce que les villes éclairées la nuit sont une règle du jeu rendue visible (`04-gameplay.md` §12.3).

### 5.2 Le masque de couleur d'équipe, **réduit au liseré de socle**

Une texture à un canal : blanc = cette surface prend la couleur de l'équipe, noir = elle garde son albédo.

**Ce champ a changé de rôle le 5 septembre 2026 au soir.** Il portait la nation : un modèle gris, une teinte par pays, sept cents fichiers économisés. Le brief a tranché autrement — *« Pas un simple masque de couleur : un style par nation »* — parce qu'un masque teinté donne vingt-quatre équipes de la même armée, et que la promesse du jeu est l'inverse. La nation passe désormais par un **kit** (§5.5) : des textures complètes, peintes pour elle.

Ce qui reste du masque, et qui reste **obligatoire** :

- sur une **géométrie de base** (`unite`), le masque couvre le corps entier : c'est le **repli du placeholder**, ce qui s'affiche tant qu'aucun kit n'est livré, et c'est aussi ce qui fait tourner le jeu aujourd'hui ;
- sur un **kit** (`kit`), le masque est **réduit au liseré du socle** — un anneau étroit, 256 pixels suffisent — pour que deux joueurs de la **même nation** restent distinguables dans un match miroir ;
- sur un **bâtiment**, le masque garde son rôle plein : un bâtiment change de propriétaire en cours de match, et c'est la couleur d'équipe, pas la nation, qui doit se lire d'en haut.

La règle du brief, écrite en toutes lettres : la couleur d'équipe subsiste **uniquement** comme repli du placeholder et pour la lisibilité — un liseré sur le socle — et **jamais comme la seule différence** entre deux unités.

Consignes données au générateur : masque **net**, sans dégradé sale ni antialiasing gris sur les bords ; zones larges et lisibles d'en haut ; jamais sur une surface qui doit rester métallique, vitrée ou en caoutchouc.

### 5.2 bis Les kits nationaux

Une unité de base, c'est désormais **une géométrie partagée + un gabarit + un kit national** :

| Pièce | Identifiant | Ce que c'est | Combien |
|---|---|---|---:|
| Géométrie de base | `unite_<cle>_base` | Un maillage nu, sans livrée ni ornement, livré en **trois gabarits de forme** partageant un squelette, un dépliage UV et des noms de nœuds | 10 |
| Kit national | `kit_<pays>_<unite>` | Le jeu de textures complet d'une nation pour cette unité, plus ses ornements en nœuds nommés, monté sur le gabarit qu'elle retient | **240** |

Les trois gabarits sont une liste fermée, décrite dans chaque spécification de base :

| Gabarit | Ce qu'il change |
|:-:|---|
| `a` | court et ramassé : volumes trapus, angles francs, rien qui dépasse |
| `b` | équilibré : la proportion de référence, ni longue ni courte |
| `c` | allongé et haut : châssis étiré, superstructure dégagée, de la place pour la charge |

Une nation choisit **un gabarit par unité de base**, dans `content/styles/<code>.json`. L'Australie prend `c` partout — la distance y est une défense, son unité propre est un camion à trois remorques ; le Népal prend `a` partout — tout se porte et doit passer un col. Une unité homologuée demain sans gabarit déclaré prend `a` : `gabaritDe()` ne fait jamais échouer une commande.

Un kit est **entièrement dérivé du style** (`StyleNation`, §5.6) : sa ligne directrice ouvre la description, sa palette donne les quatre couleurs, ses matières et ses finitions donnent la consigne de surface, ses ornements deviennent des nœuds `ornement_<nom>`, ses décalcomanies et son motif daltonien deviennent les seuls motifs autorisés. Rien n'y est écrit à la main : changer une matière dans un JSON de style change les dix commandes de la nation.

**Livraison d'un kit.** Un kit se livre **monté sur la géométrie de base** — le maillage habillé — pour qu'il se contrôle tel qu'il apparaîtra en jeu : même boîte englobante, même pivot, budget majoré d'un sixième pour les ornements. Ses textures peuvent être **référencées par le GLB** ou **livrées à côté** sous le nom du gabarit (`kit_fr_char_leger_albedo.png`) : les deux sont acceptés, l'un des deux est exigé (§7.2).

### 5.2 ter Bâtiments et décor : par région, ou par pays

Le style régional s'applique aux **bâtiments, au décor et au terrain**, jamais aux unités. Les commandes suivent :

| Famille | France | Les 23 autres pays |
|---|---|---|
| Bâtiment | `batiment_<type>_fr_<region>` — 4 × 18 = **72** | `batiment_<type>_<pays>` — 4 × 23 = **92** |
| Végétation | `decor_arbre_<biome>_fr_<region>` — **18** | `decor_arbre_<biome>_<pays>` — un par biome déclaré, **80** |
| Roche | `decor_rocher_<biome>` — **10**, partagés | idem : la roche est géologique, pas culturelle |

Il n'existe **aucun bâtiment français générique** : la France est régionale sans exception, parce que c'est le pays que le joueur traverse région par région avant tout le reste. Le Luxembourg, le Japon et le Brésil basculeront automatiquement le jour où `content/regions/<pays>/` existera — le catalogue lit `chargerRegions()`, il ne connaît aucun pays par son nom.

### 5.3 `variantes`

```json
{ "saisons": ["printemps", "ete", "automne", "hiver"], "biomes": ["foret"], "nations": [] }
```

Une variante est un **jeu de textures supplémentaire**, jamais un second modèle (le jour où le feuillage d'hiver exigerait des branches nues, le format devra le dire — c'est une question ouverte de `10-rendu-3d.md` §12).

- **Unités** : `hiver` seule — un voile de neige et de sel sur les surfaces horizontales.
- **Terrains et arbres** : les quatre saisons.
- **Bâtiments et rochers** : `ete` et `hiver`.
- **Biomes** : la liste des biomes où l'asset apparaît. Un terrain `plage` ne se décline qu'en `cotier`, `archipel`, `jungle`, `marais` ; il n'y a pas de plage en montagne.
- **Nations** : la liste des nations concernées. Vide pour ce qui est partagé (géométrie de base, terrain, rocher) ; **un seul code** pour un kit, un bâtiment régional ou un décor de territoire — c'est ce qui permet de filtrer les commandes d'une nation d'une seule requête.

### 5.6 `StyleNation` et `StyleRegion` — d'où viennent les kits

Les kits ne sont pas écrits, ils sont **dérivés**. Deux fichiers de canon les alimentent, tous deux validés au chargement (`src/assets/valider.ts`, `src/assets/styles.ts`) :

`content/styles/<code>.json` — le **style national**, un par pays de départ :

| Champ | Contenu | Borne |
|---|---|---|
| `ligneDirectrice` | La phrase qui tient tout le style, en français et en anglais | 24 à 240 signes |
| `palette` | Les trois couleurs de `Country.palette`, reprises telles quelles, plus 1 à 3 **accents** | — |
| `matieres` | Liste fermée de 30 valeurs : `peinture_mate`, `acier_brosse`, `bois`, `toile`, `cuir`, `bambou`, `ceramique`, `beton`, `laiton`… | 3 à 6 |
| `finitions` | Liste fermée de 16 : `mate`, `brossee`, `patinee`, `poudree_de_sel`, `delavee`… | 1 à 3 |
| `ornements` | Liste fermée de 30 : `antenne`, `sacoche`, `filet`, `banniere`, `lanterne`, `toit_toile`, `panneau`, `jerrican`, `roue_de_secours`, `pare_soleil`, `fanion`, `chaines`… | **2 à 4** |
| `gabarits` | Par unité de base, la variante de forme retenue | `a` \| `b` \| `c` |
| `decalcomanies` | Motifs **abstraits** : un motif géométrique, un placement, une couleur, une note | 1 à 3 |
| `motifDaltonien` | Le motif géométrique de lisibilité sans couleur, **unique dans le jeu** | 1 |
| `justification` | Pourquoi ce style, adossé à la fiche du pays | 40 à 400 signes |

`content/styles/regions/<pays>/<region>.json` — le **style régional** : `toits` (forme, matière, couleur), `murs` (matière, couleur, finition), `vegetation` (dominante, secondaire, couleur) et 2 à 4 `elementsDecor` pris dans une liste fermée. Il ne vit pas dans `Region` parce que `Region` (`03-schemas.md` §7) est un contrat de jeu, fermé, servi aux routines : une routine lore n'a rien à faire dans la couleur d'une tuile.

Deux invariants tenus par les tests (`tests/assets/styles.test.ts`) : **aucun motif daltonien n'est employé deux fois** — c'est ce qui permet de distinguer deux équipes sans couleur —, et **chaque nation déclare un gabarit pour les dix unités canon**.

### 5.4 `animations`

Six clips, noms fermés : `repos`, `deplacement`, `tir`, `touche`, `hors_jeu`, `capture`. Chacun porte sa durée en millisecondes, s'il boucle, et s'il est obligatoire.

| Clip | Durée type | Boucle | Qui l'a |
|---|---:|:-:|---|
| `repos` | 2 400 ms | oui | tout ce qui est animé |
| `deplacement` | 1 000 ms | oui | toute unité |
| `tir` | 700 ms | non | toute unité qui a une ligne de dégâts non nulle — donc pas le transport |
| `touche` | 500 ms | non | toute unité ; facultatif sur un bâtiment |
| `hors_jeu` | 900 ms | non | toute unité |
| `capture` | 1 300 ms | non | toute unité qui porte le trait `capture` ; obligatoire sur un bâtiment |

Les clips sont **dérivés des données de l'unité**, pas d'une liste écrite à la main : le transport ne demande pas de `tir` parce que sa table de dégâts est vide, l'infanterie demande `capture` parce qu'elle porte le trait. Une unité homologuée demain reçoit exactement les clips que ses données justifient.

`hors_jeu` ne boucle jamais (le validateur le refuse), `repos` boucle toujours. Le vocabulaire suit le ton : `hors_jeu` est un affaissement et une extinction, pas une explosion.

---

## 6. `interdits`

Sept valeurs, recopiées **en entier dans chaque spécification** — le générateur doit les lire à chaque asset, pas une fois pour toutes :

| Valeur | Ce qu'elle interdit |
|---|---|
| `symboles_reels` | tout emblème, blason, cocarde ou insigne d'une organisation réelle |
| `drapeaux_reels` | tout drapeau national ; les banderoles et fanions du jeu sont **unis** |
| `texte_lisible` | aucune lettre, aucun chiffre lisible nulle part, pas même sur une plaque |
| `sang` | aucune trace organique, aucune blessure, aucun débris |
| `marques_deposees` | aucune marque commerciale, aucun logo, aucune forme protégée |
| `personnes_reelles` | aucun visage reconnaissable de personne réelle |
| `violence_explicite` | aucun impact gore, aucune ruine fumante, aucune arme au sens propre |

Les quatre premiers sont **obligatoires** : le validateur refuse une spécification qui n'en porterait pas un. Les trois autres sont là parce qu'on préfère les dire.

Ce ne sont pas des précautions décoratives. Le brief est explicite : vrais pays, jamais de vrais conflits ; aucun symbole réel, aucun dirigeant, aucun drapeau. Un modèle qui porte un drapeau national fait entrer dans le jeu la seule chose que la bible entière s'emploie à en garder dehors. Le générateur, lui, a naturellement tendance à en mettre : c'est ce que montrent ses données d'entraînement d'un « véhicule d'équipe nationale ». D'où la répétition, à chaque asset.

Corollaire opérationnel : **un asset qui porte un symbole réel n'est pas corrigé, il est rejeté.** Le validateur automatique ne sait pas voir un drapeau ; c'est donc une **relecture humaine à l'œil**, une fois, sur chaque livraison, avant l'entrée dans le dépôt. C'est le seul contrôle du pipeline qui ne soit pas mécanique, et c'est assumé.

---

## 7. `verification` — ce que le validateur contrôle

```json
{
  "controles": ["format", "noeuds", "materiaux", "echelle", "budget", "masque_equipe", "animations"],
  "toleranceAabb": 0.12,
  "lodRequis": [0, 1, 2]
}
```

Un contrôle absent de la liste n'est pas exécuté : c'est ce qui permet à un terrain de ne pas se voir reprocher l'absence d'animations. `format` est toujours exigé.

### 7.1 Le lecteur GLB

`src/assets/valider-gltf.ts` lit un `.glb` **sans aucune dépendance**. Un GLB est un conteneur trivial :

```
octets 0..3    magie 'glTF'
octets 4..7    version du conteneur (2)
octets 8..11   longueur totale du fichier
puis, par morceau :
  4 octets     longueur
  4 octets     type ('JSON' ou 'BIN\0')
  n octets     données, complétées à un multiple de quatre
```

Tout ce dont on a besoin est dans le morceau JSON : le nombre d'éléments des accesseurs (donc les triangles), leurs `min`/`max` (donc la boîte englobante), les noms des nœuds, des matériaux, des images et des animations. Charger un `GLTFLoader` pour cela reviendrait à démarrer un moteur de rendu dans un test, et la couche `assets/` n'a de toute façon pas le droit d'importer `render3d/` (`02-architecture.md` §5).

Deux limites assumées et documentées : la **rotation des nœuds est ignorée** dans le calcul de la boîte englobante (seules l'échelle et la translation sont appliquées), parce que le format impose l'avant vers `+Z` — un asset qui aurait une rotation à la racine doit être refusé par le contrôle d'échelle plutôt que rattrapé ; et les **primitives non triangulaires** ne comptent pas dans le budget, parce qu'elles n'ont rien à y faire.

### 7.2 Les six codes de refus

| Code | Ce qui le déclenche |
|---|---|
| `asset_format` | conteneur illisible, mauvaise magie, conteneur non-2, longueur incohérente, JSON absent ou illisible, `asset.version` autre que `2.0`, **nœud imposé absent**, **matériau imposé absent**, plus de matériaux que le budget |
| `asset_echelle` | une dimension de la boîte englobante hors tolérance, pivot qui ne repose pas au sol quand `poseAuSol` est vrai, emprise non centrée en `x` ou en `z` |
| `asset_budget` | triangles au-dessus du budget du palier relu, ou aucun triangle du tout |
| `asset_masque_absent` | aucune image nommée `masque_equipe` (ou `team_mask`), **ni dans le GLB ni parmi les fichiers livrés** |
| `asset_animation_absente` | un clip déclaré obligatoire absent des animations du document |
| `asset_texture_absente` | une carte **obligatoire** absente des deux côtés : ni référencée par le GLB, ni livrée à côté sous son nom de gabarit |

**La règle des textures d'un kit**, contrôle `textures`, exécuté seulement quand la spécification le demande. Pour chaque carte `obligatoire`, la carte est **présente** si :

1. le GLB référence une image dont le `name` ou l'`uri` contient le nom du canal (`…_albedo`, `…_masque_equipe`) — cas d'un GLB auto-porteur ; **ou**
2. les fichiers livrés à côté (`OptionsGlb.fichiersLivres`) contiennent le nom exact que `nomTexture()` produit, variante saisonnière comprise et extension libre (`png` relu ou `ktx2` compressé) — cas d'un kit livré en textures séparées.

Sinon, `asset_texture_absente`, avec le canal et le nom attendu dans le détail. Le validateur est délibérément permissif sur la **forme** de livraison et strict sur le **nom** : un kit dont l'albédo s'appelle `final_v3.png` est un kit qu'on ne saura pas charger.

Le verdict a exactement la forme de `ReviewVerdict.motifs` (`03-schemas.md`) : `{ code, detail?, mesure? }`. Le `detail` nomme la pièce manquante (`nœud attendu absent : module_tourelle`), la `mesure` porte les chiffres (`{ triangles: 41200, budget: 6000, lod: 0 }`). C'est ce qui rend un refus renvoyable tel quel au générateur.

**Les motifs s'accumulent** : on ne s'arrête pas au premier. Un aller-retour qui corrige un défaut et en découvre trois autres est trois fois trop lent. Seule exception : si le conteneur lui-même est cassé, on s'arrête — les contrôles suivants n'auraient rien à lire.

### 7.3 Ce que le validateur ne sait pas faire

Il faut l'écrire pour que personne ne s'y trompe. Le validateur ne juge **ni la beauté, ni la ressemblance, ni le respect du ton, ni les interdits**. Il vérifie qu'un fichier est *utilisable* : bonne taille, bon pivot, bons noms, budget tenu, masque présent, clips présents. Le reste est une relecture humaine, une fois par livraison, à l'œil, sur un rendu de trois quarts et un rendu à 68° de tangage.

### 7.4 La commande de contrôle, hors ligne (6 septembre 2026)

Le même verdict, sans passer par l'API — c'est ce qu'on renvoie au générateur, tel quel :

```
npm run controler:asset -- --spec assets/specs/unite_char_leger_base.json --glb livraison/unite_char_leger_base_lod0.glb
npm run controler:asset -- --spec … --glb … --fichiers livraison/    # les textures livrées à côté (§7.2)
npm run controler:asset -- --spec … --glb … --lod 1                  # sinon déduit du suffixe _lodN du fichier
npm run controler:asset -- --spec … --glb … --json                   # le verdict { ok, motifs } brut
```

`scripts/controler-asset.ts` lit et valide la spécification (`validerAssetSpec`), lit le fichier, appelle `validerGlb` et imprime le verdict — asset, fichier, niveau de détail, motifs avec leurs mesures. Code de sortie **1** si le fichier est refusé ou illisible (spécification comprise), **2** si la commande est mal appelée. Le niveau de détail contrôlé se lit dans le nom du fichier (`…_lod2.glb` relit le budget du lod2), `--lod` l'emporte. Un fichier dont le nom n'est pas celui du gabarit §4.5 est **accepté mais prévenu** : le validateur ne juge pas les noms de modèle, mais le rendu ne charge que `nomModele()` — un fichier bien contrôlé sous un mauvais nom resterait invisible. La fonction `executer(argv)` est exportée et testée (`tests/assets/controler-asset.test.ts`) contre un GLB fabriqué en mémoire et la vraie spécification du char léger : un cas accepté, un cas refusé, un kit avec ses textures à côté.

---

## 8. Le générateur de spécifications

```
npx tsx scripts/generer-specs-assets.ts               # écrit assets/specs/
npx tsx scripts/generer-specs-assets.ts --verifier    # échoue si le dossier a dérivé du canon
npx tsx scripts/generer-specs-assets.ts --type kit    # ne produit qu'une famille
npx tsx scripts/generer-specs-assets.ts --priorite 1 --sortie /tmp/lot1   # la file de la semaine
```

`--priorite` se combine avec `--sortie` : filtrer sans changer de dossier ferait échouer `--verifier`, qui compare le dossier **entier** au canon.

Il produit aujourd'hui **540 spécifications** :

| Famille | Nombre | Source | Priorité 1 |
|---|---:|---|---:|
| `unite` | 10 | `content/unites.json` — les géométries de base | 10 |
| `kit` | **240** | 24 styles × 10 unités | 30 |
| `terrain` | 8 | `content/terrains.json`, les non capturables | 8 |
| `batiment` | 164 | 4 capturables × (18 régions de France + 23 pays) | 80 |
| `decor` | 108 | 18 végétations régionales + 80 nationales + 10 rochers de biome | 27 |
| `commandant` | 10 | `content/archetypes.json` | 3 |
| **Total** | **540** | | **165** |

**Mise à jour du 6 septembre 2026.** Le tableau ci-dessus est celui du canon d'origine : dix unités, quatre bâtiments capturables. Avec la station `radar`, le `genie`, le `drone`, le `brouilleur` et le `char_moyen` (catalogue 4 ; le `drone_filaire` a été retiré le même jour et ses 25 fichiers avec lui), le générateur produit **681 spécifications** : 14 `unite`, **336 kits** (24 × 14), 8 terrains, **205 bâtiments** (5 capturables × 41 territoires), 108 décors, 10 commandants — **201** en priorité 1, 118 en 2, 362 en 3. `--verifier` fait foi sur ces chiffres, pas ce tableau, gardé pour l'histoire.

**Le budget en clair.** Le brief l'annonce : 24 nations × 10 unités = 240 kits de textures, géométrie partagée. À cela s'ajoutent les 164 bâtiments et les 98 décors de territoire, qui sont le prix du style régional. C'est beaucoup, et c'est précisément pourquoi la priorité existe : **165 spécifications** suffisent à jouer toute la qualification française et ses premiers adversaires, soit moins d'un tiers du total. Le reste se commande au fil des routines. Côté dépôt, `assets/specs/` pèse environ 4 Mo de JSON versionné — le prix d'une commande relisible en revue de code, assumé.

La génération est **pure et triée par identifiant** : deux appels donnent le même tableau, donc `assets/specs/` est reproductible et relisible en diff. Le script repart d'un dossier propre à chaque écriture, pour qu'un asset retiré du canon disparaisse aussi des commandes.

Ce que le catalogue ajoute au canon, famille par famille : pour une géométrie de base, un texte tenu à la main pour les dix unités canon, une composition depuis la `Silhouette` pour toute autre, et la description des trois gabarits ; pour un kit, la ligne directrice, la palette, les matières, les finitions, les ornements et les motifs de la nation, traduits une fois pour toutes dans les tables de `catalogue.ts` ; pour un terrain, une plaque raccordable d'un mètre avec son relief et ses biomes ; pour un bâtiment, ses dimensions, son émission de nuit, son masque d'équipe et **le style de sa région ou de son pays** (toits, murs, végétation, éléments de décor) ; pour le décor, l'essence du biome telle qu'elle pousse dans ce territoire ; pour un commandant, la posture et la tenue de son archétype, avec son tempérament repris mot pour mot du canon.

---

## 9. Trois règles de travail avec le générateur

1. **Une spécification, un asset, un aller-retour.** On ne demande jamais « les dix unités » en un coup : le générateur moyenne, et on perd la spécificité qui est tout l'intérêt du format.
2. **Un refus se renvoie en entier.** Les motifs structurés, avec leurs mesures, valent mieux que « c'est trop gros ». Un `asset_echelle` avec `{ mesure: 1.24, cible: 0.50, marge: 0.07 }` se corrige du premier coup.
3. **Le placeholder est le filet.** Tant qu'un asset n'est pas accepté, il n'entre pas. Il n'y a pas de « on le prendra quand même, on corrigera plus tard » : c'est ainsi qu'un dépôt se remplit de modèles à deux mètres de haut qu'on n'ose plus retirer.

---

## 10. Ce qui reste ouvert

1. **KTX2.** Le format est déclaré possible dans `FormatTexture`, mais toutes les spécifications demandent aujourd'hui du PNG, parce que c'est ce qui se relit. La compression est une étape de build (`scripts/`) à écrire, pas une demande à faire au générateur.
2. **Les assets de type `effet`.** Impacts, poussière, gerbe d'eau, halo de pouvoir : le type existe, aucune spécification n'est produite. Ils viendront quand le rendu 3D aura ses animations de combat.
3. **Les 24 unités spéciales.** Chaque pays a une unité au dessin propre (`doc/06` §8, point 3) : la Roulante, le Shinkansen, le Téléphérique, le Taxi-brousse… Ce sont des modèles uniques, pas des kits, et aucune spécification n'est produite pour elles aujourd'hui — il faut d'abord qu'elles entrent au catalogue d'unités.
4. **La vérification des textures livrées.** Le validateur vérifie qu'une carte obligatoire est **présente** (§7.2) ; il ne vérifie pas encore qu'un PNG livré à côté a la bonne **résolution**, ni que le masque est vraiment **binaire**. C'est un contrôle simple à ajouter (en-tête PNG, histogramme), et il manque.
5. **Le seuil de relecture humaine.** Une relecture par livraison est la règle aujourd'hui. Si le volume monte, il faudra un échantillonnage — le même raisonnement que l'échantillon humain des traductions (`09-i18n.md`), et probablement le même taux.
6. **Le poids d'`assets/specs/`.** 540 fichiers, 4 Mo. Tant que le dossier se relit en diff, cela va ; si le catalogue d'unités double avec l'homologation, il faudra soit ne versionner que les priorités 1 et 2, soit compresser. La décision se prendra sur un chiffre, pas sur une impression.
