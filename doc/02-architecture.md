# Atlas Tournament — Architecture technique

> Document 02. Découle du canon `BRIEF.md`. Tout ce qui n'est pas dans le brief et qui apparaît ici est signalé **[proposition]** : c'est une décision d'architecte à valider, pas du canon.

---

## 1. Vue d'ensemble

Atlas Tournament est **une seule application Next.js** qui contient à la fois le site (administration, API des routines) et le client de jeu. Le jeu n'est pas un service séparé : c'est une page qui monte un canvas et importe des modules TypeScript purs.

Le principe structurant est une séparation stricte en trois anneaux :

```
                   ┌───────────────────────────────────────────────┐
                   │  ANNEAU 3 — LE CERVEAU (hors ligne, asynchrone)│
                   │  5 routines Claude · curl · Bearer CRON_SECRET │
                   │  lore · cartes · contrôle · amélioration · i18n│
                   └───────────────────┬───────────────────────────┘
                                       │ HTTP JSON strict
                   ┌───────────────────▼───────────────────────────┐
                   │  ANNEAU 2 — LE SERVEUR (Next.js 15 · PG)      │
                   │  /api/routines/*  ·  Drizzle  ·  statuts      │
                   │  valide, recalcule, refuse, versionne         │
                   └───────────────────┬───────────────────────────┘
                                       │ contenu figé (JSON validé)
   ┌───────────────────────────────────▼───────────────────────────────────────┐
   │  ANNEAU 1 — LE JEU (déterministe, zéro dépendance runtime)                │
   │                                                                            │
   │   content/ ──► engine/ ◄── ai/            mapgen/ ──► MapDef ──► engine/   │
   │                   │                                                        │
   │                   └──► render/ (canvas 2D)   ·   Node headless (tests, IA) │
   └────────────────────────────────────────────────────────────────────────────┘
```

**Règle absolue, reprise du brief :** aucun appel à un modèle pendant une partie. L'anneau 3 produit du contenu, le serveur le valide et le fige, l'anneau 1 le consomme comme il consommerait un fichier JSON écrit à la main. Une partie doit pouvoir se jouer hors ligne, avec un `content/` embarqué.

**Le sens des dépendances ne s'inverse jamais :** `render/` connaît `engine/`, `engine/` ignore l'existence de `render/`. `ai/` connaît `engine/`, `engine/` ignore `ai/`. `engine/` n'importe rien d'autre que `content/` et ses propres types. Cette règle est vérifiée mécaniquement (§8).

---

## 2. Pourquoi Canvas 2D « from scratch », sans PixiJS ni Phaser

Le brief a tranché ; voici la justification qui doit tenir dans la durée. Un tactique au tour par tour n'a besoin ni de moteur physique, ni de boucle temps réel à 60 images par seconde en continu, ni de gestion de scène complexe : l'écran est statique la plupart du temps et ne bouge que pendant de courtes animations scriptées (un déplacement le long d'un chemin, un tir, un fondu de HUD). PixiJS apporterait un renderer WebGL et un graphe de scène dont on n'utiliserait que dix pour cent, au prix de plusieurs centaines de kilo-octets de JavaScript, d'une API à apprendre et d'une dépendance qui vieillit. Phaser irait plus loin encore dans la mauvaise direction : il impose sa propre boucle, ses scènes, son système d'entrées, sa notion de « game object », c'est-à-dire une architecture concurrente de la nôtre alors que le cœur du projet est justement un **moteur de règles pur, séparé du rendu**. À l'inverse, la direction artistique est déjà, littéralement, du code Canvas 2D : la démo `doc/assets/atlas-render-vector.html` dessine les tuiles, le décor, les bâtiments et les unités avec `arcTo`, `ellipse`, `createLinearGradient` et une palette `{main, dark, light}` par nation. Le palette-swap voulu par le brief est trivial en Canvas 2D (on redessine avec d'autres couleurs) alors qu'il demanderait des filtres ou des shaders en WebGL. Zéro dépendance runtime signifie aussi : pas de build magique, un moteur qui tourne tel quel sous Node pour les simulations IA contre IA, et un contrôle total sur le déterminisme.

**Le point de vigilance est réel et il faut le budgéter comme du travail, pas comme un détail.** En refusant un framework, on s'engage à écrire nous-mêmes quatre briques que Pixi ou Phaser offriraient :

1. **La boucle de rendu.** Un `requestAnimationFrame` qui ne tourne que quand il y a quelque chose à animer (une file d'animations non vide, un survol qui a changé), et qui s'arrête sinon — sur mobile, une boucle qui tourne à vide pour redessiner une image identique vide la batterie. Il faut donc un système de « salissure » explicite : `scene.salir()` réveille la boucle, la boucle s'endort quand la file est vide.
2. **Le cache des sprites vectoriels en canvas hors écran.** Redessiner trois arbres et une montagne à la main pour chacune des 192 tuiles à chaque image est un gaspillage. Chaque combinaison (type de sprite × nation × biome × échelle du zoom) est rendue **une fois** dans un `OffscreenCanvas`, puis blittée avec `drawImage`. Le cache est indexé par une clé textuelle — pour une unité, **par sa silhouette et non par sa clé** (`silhouette:chenilles-bloc-tourelle:2:bleu:2x`, §3.4), pour un terrain par son ambiance climatique (`terrain:foret:tempere:automne:2x`) — et purgé quand le zoom change de palier ou que l'ambiance change. C'est la seule optimisation vraiment nécessaire, et elle est simple.
3. **Les entrées souris et tactile.** Pas de gestionnaire d'événements prêt à l'emploi : il faut convertir des coordonnées écran en coordonnées monde en tenant compte de la caméra et du ratio de pixels, distinguer un tap d'un glisser (seuil en pixels et en millisecondes), gérer le pincement à deux doigts pour le zoom, le déroulement inertiel, le clic droit et la touche Échap comme « annuler ». C'est la partie la plus fastidieuse et celle où l'on se trompe le plus souvent.
4. **Le redimensionnement HiDPI.** La démo triche avec un `scale(2,2)` en dur. En production il faut lire `devicePixelRatio`, dimensionner le canvas en pixels physiques, le contraindre en CSS en pixels logiques, réappliquer la transformation à chaque `resize` et à chaque changement d'écran (un portable branché sur un écran externe change de ratio à chaud), et vider le cache de sprites au passage. Un `ResizeObserver` sur le conteneur, pas un `window.onresize`.

Ces quatre briques représentent, à l'estimation, **quelques centaines de lignes chacune**, écrites une fois et stables ensuite. C'est un coût acceptable ; il devient inacceptable si on les découvre en cours de route. Elles sont donc des tâches identifiées de l'étape 3 du plan de construction, pas des imprévus.

---

## 3. Les couches

### 3.1 `engine/` — le moteur de règles

Le cœur. Un module TypeScript pur, **sans un seul accès à `window`, `document`, `fetch`, `Date.now()` ou `Math.random()`**. Son contrat tient en une signature :

```ts
export function appliquer(etat: EtatPartie, action: Action): Resultat;

export type Resultat =
  | { ok: true;  etat: EtatPartie; evenements: EvenementJeu[] }
  | { ok: false; motif: MotifRefus; detail?: string };
```

Propriétés obligatoires :

- **Pur et immuable.** `appliquer` ne modifie jamais `etat` : il renvoie un nouvel objet. En pratique on utilise une copie structurée ciblée (on ne clone que les branches touchées) pour rester rapide, mais du point de vue de l'appelant l'état d'entrée est intact — c'est ce qui permet à l'IA d'explorer des coups sans annuler.
- **Total.** Une action illégale ne lève pas d'exception : elle renvoie `{ ok: false, motif }`. Le rendu grise un bouton, l'IA élague une branche, la routine contrôle compte un motif. Les exceptions sont réservées aux invariants brisés (état corrompu), et un état corrompu est un bug.
- **Sérialisable.** `EtatPartie` est du JSON pur : pas de `Map`, pas de `Set`, pas de classe, pas de fonction, pas de référence circulaire. `JSON.parse(JSON.stringify(etat))` est l'identité. C'est ce qui rend possibles la sauvegarde, le rejeu, l'envoi d'une partie à la routine contrôle et le test par instantané.
- **Déterministe.** Voir §7.

Découpage interne :

```
engine/
├─ types.ts          EtatPartie, Unite, Batiment, Action, Resultat, MotifRefus
├─ index.ts          appliquer(), nouvellePartie(), rejouer()
├─ rng.ts            générateur seedé, flux dérivés
├─ tour.ts           séquence de tour : revenus, ravitaillement, réveil, hooks
├─ mouvement.ts      Dijkstra sur coûts de terrain, portées de déplacement
├─ combat.ts         formule de dégâts, riposte, dégâts de zone
├─ capture.ts        points de capture, changement de propriétaire
├─ production.ts     usines, aéroports, contrôle de solde
├─ pouvoirs.ts       jauge, pouvoir normal, super pouvoir, effets paramétrés
├─ brouillard.ts     calcul de vision, filtrage d'état par camp
├─ victoire.ts       évaluation des conditions de victoire et de défaite
├─ climat/           saison, jour/nuit, météo — mêmes hooks que mecaniques/
└─ mecaniques/       hooks régionaux (marées, mistral, inondation…)
```

`mecaniques/` mérite une note : ce sont des greffons enregistrés par identifiant (préfixe `meca_`), appelés par le moteur à cinq points de branchement fixes — `debutTour`, `finTour`, `surMouvement`, `surAttaque`, `modifTerrain`. Le contrat, qui fait foi, est détaillé dans `04-gameplay.md` §11 ; l'emploi région par région est dans `07-france-regions.md` §2.5. L'important ici : **une mécanique régionale n'a pas le droit d'échapper au déterminisme** — elle reçoit le flux de nombres aléatoires du moteur, pas le sien.

`climat/` est la **deuxième couche à hooks**, et la seule qui soit globale : elle n'est pas déclarée par une région mais par le scénario, et vit dans `EtatPartie.climat` (`03-schemas.md` §13). Elle utilise **exactement le même contrat** que `mecaniques/` — les cinq mêmes noms, la même pureté, le même flux d'aléa (`rng.branche('climat')`) — et le moteur l'appelle **avant** la mécanique régionale sur chaque hook, pour que le local ait le dernier mot sur le global. Aucune architecture nouvelle : le détail des effets et la répartition hook par hook sont dans `04-gameplay.md` §12, qui fait foi.

```
engine/climat/
├─ index.ts      la couche et ses cinq hooks
├─ saison.ts     (Scenario.date, Country.hemisphere) → Saison ; table climat × saison
├─ cycle.ts      journeeDansCycle → PhaseJour, d'après Scenario.cycleJourNuit
└─ meteo.ts      table de probabilités, tirage seedé, prévisions à deux journées
```

**La date réelle n'entre dans le système qu'à un seul endroit : la création du scénario.** C'est le serveur — ou l'humain qui écrit un scénario canon — qui pose `Scenario.date` ; le moteur la lit ensuite comme une donnée quelconque, au même titre que `fondsDepart`. `Date.now()`, `new Date()` et `performance.now()` restent **interdits dans `engine/`**, couche `climat/` comprise, et le test d'interdits du §7 le vérifie. Sans cette règle, une partie sauvegardée en janvier et rejouée en juillet changerait de saison, donc de terrain, donc de résultat.

### 3.2 `ai/` — l'IA de jeu

Une seule IA sert deux usages : l'adversaire du joueur solo, et le pilote des deux camps dans les simulations headless de la routine contrôle. C'est volontaire : la routine contrôle ne certifie une carte que si **l'IA que le joueur va vraiment affronter** sait y jouer.

```ts
export interface Strategie {
  readonly id: string;                       // 'gloutonne' | 'ponderee' | 'agressive'…
  choisirAction(etat: EtatPartie, camp: CampId, rng: Rng): Action;
}
```

L'IA est elle aussi déterministe : elle ne tire ses aléas que du `Rng` qu'on lui passe. Deux graines identiques et la même stratégie produisent la même partie, coup pour coup — sans quoi la routine contrôle ne pourrait pas reproduire un rapport de rejet.

Trois niveaux **[proposition]**, du plus simple au plus coûteux, avec le même contrat :

| Niveau | Méthode | Usage |
|---|---|---|
| `gloutonne` | score par unité sur un seul coup (menace, valeur de la cible, progression vers l'objectif) | tutoriels, simulations de masse (rapide) |
| `ponderee` | glouton + carte d'influence et de menace, coordination de groupe, valorisation de la capture | adversaire par défaut |
| `agressive` / `defensive` | mêmes calculs, poids différents | personnalité de commandant |

L'IA est un **consommateur** du moteur, jamais un cas particulier dedans : elle ne peut faire que ce qu'un joueur humain peut faire, en passant par `appliquer`.

### 3.3 `mapgen/` — le générateur de cartes

Fonction pure `(ParametresCarte, seed) → MapDef`. Le modèle (routine carte) fournit **l'intention** — taille, biome, ratio terre/mer, symétrie, nombre de villes, mécanique régionale, style d'objectif — et le code fournit **la validité**.

```ts
export function genererCarte(p: ParametresCarte, graine: string): ResultatGeneration;

export type ResultatGeneration =
  | { ok: true; carte: MapDef; diagnostic: Diagnostic }
  | { ok: false; motifs: MotifGeneration[] };  // 'symetrie_impossible', 'trop_peu_de_villes'…
```

Pipeline en cinq passes, chacune testable seule :

1. **Relief** — bruit de valeur seedé, seuillé en mer / plage / terre, puis lissage des côtes (une case de terre isolée en mer est comblée ou supprimée). Le style « côtes arrondies » de la démo est un effet de rendu, mais la topologie doit être propre en amont.
2. **Reliefs et forêts** — montagnes sur les hautes valeurs, forêts par amas.
3. **Hydrographie** — rivières descendant du relief vers la mer, ponts posés là où une rivière coupe un futur axe.
4. **Réseau et bâtiments** — placement des QG (à distance équivalente du centre), des usines, des villes ; puis tracé des routes par plus court chemin entre bâtiments, ce qui donne des axes qui *servent* à quelque chose au lieu d'un damier décoratif.
5. **Symétrisation et vérification** — miroir (axial, point, ou rotation) pour l'équité, puis un lot d'assertions : chaque QG est atteignable à pied depuis chaque autre QG, aucune zone de terre isolée de plus de N cases, ratio de villes par camp identique, pas d'unité de départ hors de son terrain de mouvement.

Le générateur **refuse plutôt que de rendre une carte douteuse**. Un refus est une information exploitable : il remonte en clair à la routine carte, qui corrige ses paramètres au run suivant.

### 3.4 `render/` — le canvas

```
render/
├─ boucle.ts       rAF paresseux, horloge, file d'animations
├─ camera.ts       position, zoom, conversions écran ↔ monde, limites
├─ scene.ts        ordre de dessin en couches, culling par rectangle visible
├─ atlas.ts        cache de sprites vectoriels en OffscreenCanvas
├─ ambiance.ts     palette, calques et particules dérivés de (saison, phase, meteo)
├─ sprites/        terrain.ts, batiments.ts, unites.ts, silhouettes.ts, effets.ts
├─ hud.ts          panneau d'unité, fonds, jauge de pouvoir, fin de tour
├─ entrees.ts      souris, tactile, clavier ; gestes ; sélection
├─ animations.ts   déplacement le long d'un chemin, tir, capture, mise hors jeu
└─ palettes.ts     palettes de nation et de biome
```

Le rendu **consomme** un `EtatPartie` et une file d'`EvenementJeu` renvoyés par le moteur. Il n'a aucune autorité : quand le joueur clique, `entrees.ts` construit une `Action`, la passe à `appliquer`, reçoit un nouvel état et une liste d'événements, puis joue les animations correspondantes. Pendant qu'une animation joue, l'état logique est **déjà** le nouveau ; l'animation n'est qu'un rattrapage visuel. Cela évite toute la classe de bugs « l'état dépend de l'animation ».

Conventions reprises telles quelles de la démo :

- Tuile de **64 px** en unités monde, `ROWS × COLS` de tuiles, origine en haut à gauche.
- Palette de nation `{ main, dark, light }`, plus une palette `neutre` grise pour les bâtiments sans propriétaire.
- Ordre de dessin : eau et vaguelettes → halo de sable → herbe → texture → routes → grille discrète → surbrillances de déplacement et d'attaque → décor (arbres, montagnes, bâtiments) → unités → curseur → étiquettes de PV → HUD.
- Le décor est **dessiné par des fonctions vectorielles** (`arbre`, `montagne`, `batiment`, `dessinerUnite`), pas par des images. Ces fonctions sont reprises presque telles quelles ; on leur ajoute une signature de cache.
- Ombres douces via `shadowColor`/`shadowBlur`/`shadowOffsetY`, activées et désactivées explicitement autour des groupes concernés.

**L'ambiance.** `ambiance = f(saison, phase, meteo)` : une fonction **pure**, qui ne lit rien d'autre que `EtatPartie.climat` (`03-schemas.md` §13) et renvoie trois choses **[proposition de découpage]** —

1. une **palette** de substitution appliquée par-dessus celle du biome : feuillage roux en automne, blanc cassé et ombres bleues sous la neige, teinte nuit avec halos jaunes sur les villes, usines, aéroports et QG **éclairés** (les mêmes bâtiments qui gardent leur vision la nuit, `04-gameplay.md` §12.3) ;
2. des **calques** dessinés au-dessus du terrain et sous les unités : voile de nuit, nappe de brume, flaques et reflets sous la pluie, halo de chaleur sous la canicule ;
3. des **particules** : gouttes, flocons, poussière, dont la densité vient de la météo et la direction du vent régional s'il y en a un (le mistral reste une mécanique régionale, pas une météo).

Le style vectoriel rend cela trivial : ce sont des couleurs et des calques, pas des images. **L'ambiance est purement cosmétique** — aucune règle n'en dépend, et une partie jouée calques désactivés est exactement la même partie. Conséquence pour le cache de sprites (§2, point 2) : sa clé inclut l'**ambiance courante** en plus du palier de zoom (`terrain:foret:tempere:automne:2x`), et il est purgé au changement de saison, de phase ou de météo — soit quelques fois par partie, ce qui est acceptable.

**Les silhouettes.** Une unité nouvelle (`03-schemas.md` §3) n'apporte **aucun dessin** : elle apporte une `Silhouette` déclarative, et `sprites/silhouettes.ts` la **compose** — `base` (chenilles, roues, pattes, coque, rotor, ailes, rail), puis `corps` (bloc, capsule, plateau), puis les `modules` (trois au plus) posés à des **ancres fixes** du corps, à l'échelle donnée par `taille`. Ce sont les fonctions vectorielles de la démo, décomposées : les dix unités canon sont elles-mêmes redéfinies comme des silhouettes (`04-gameplay.md` §3), ce qui garantit que le composeur est exercé par le contenu existant et pas seulement par les nouveautés. Le palette swap s'applique comme aux autres.

**Le cache de sprites indexe par silhouette, pas par clé d'unité** : deux unités de silhouette identique partagent le même canvas hors écran, et une unité homologuée n'ajoute ni fichier, ni image, ni entrée de cache si sa silhouette existe déjà. Clé : `silhouette:chenilles-bloc-tourelle:2:bleu:2x`.

Deux corrections par rapport à la démo **[proposition]** : le `seed` de la texture d'herbe et des vaguelettes doit venir de la graine de la **carte** (sinon la texture bouge d'une image à l'autre au redimensionnement), et les jonctions de routes doivent être calculées sur les quatre voisins, pas seulement est et sud, sinon les extrémités de route restent des moignons.

### 3.5 `content/` — le canon versionné

Le contenu écrit à la main vit dans le dépôt, en JSON, relu en revue de code comme du code :

```
content/
├─ bible.json            ton, interdits, liste blanche/noire, conventions de flags
├─ flags.json            catalogue des flags narratifs (voir 03-schemas §8)
├─ unites.json           catalogueVersion + les 10 UnitType canon + table de dégâts
├─ terrains.json         les 12 Terrain
├─ pays/                 fr.json, lu.json, jp.json, br.json, … (24)
├─ regions/fr/           bretagne.json, normandie.json, … (18)
├─ commandants/          un fichier par commandant canon
├─ cartes/               cartes écrites à la main (tutoriels, prologue France)
└─ i18n/                 glossaires par langue + chaînes d'interface source
   ├─ ui.fr.json         toutes les chaînes d'interface en français : clé, texte,
   │                     contexte, longueurMax — produit par le script d'extraction
   ├─ glossaire.en.json  noms propres, termes imposés, unités, terrains, termes
   ├─ glossaire.de.json  interdits ; translittérations obligatoires pour ru,
   └─ …                  zh-hans et ja (09-i18n.md §2.4)
```

Ces fichiers sont **chargés en dur** dans le bundle du jeu (import statique), pas récupérés par HTTP : une partie ne doit pas dépendre du réseau. Ils sont aussi **servis aux routines** par `GET /api/canon/*`, en lecture seule, pour que la routine lore écrive contre la même vérité que le jeu.

Le contenu **généré** (cartes, scénarios, lore de pays secondaires, événements, missions du jour) vit en base et suit le cycle de vie du §6.

**Le catalogue d'unités est versionné, et le jeu le lit par version.** `content/unites.json` n'est plus une simple liste : il porte un **`catalogueVersion` entier**, incrémenté à *chaque* changement du catalogue — homologation, passage en `essai`, retrait. Les dix unités `canon` y vivent en dur ; les unités homologuées après la mise en production vivent en base (`unit_types`, §3.6) et sont **fusionnées au chargement** avec le canon embarqué, jamais à sa place. Une partie hors ligne joue donc au moins les dix.

La lecture se fait **toujours par version, jamais « la dernière »** :

- un `Scenario` fige `catalogueVersion` à sa création, une `Sauvegarde` la recopie au coup d'envoi (`03-schemas.md` §14) ;
- le chargeur résout chaque `CleUnite` dans **cette** version, y compris pour une unité passée `retiree` depuis ;
- une version n'est jamais réécrite ni supprimée, et une clé d'unité n'est jamais réutilisée.

C'est le quatrième numéro de version du projet, à côté de `engineVersion`, `mapgenVersion` et `contentVersion` (§7) — et c'est ce qui permet au catalogue d'être vivant sans qu'un seul rejeu enregistré devienne faux.

**Le chargement des bundles de traduction par le client.** Le client ne lit **jamais** les tables `chaines_source` et `traductions` : il consomme un **bundle** par langue, un objet plat `{ cleChaine: texte }` produit par le serveur, replis déjà appliqués (langue → `en` → `fr`, `09-i18n.md` §4) et versionné par `chainesVersion`. Le rendu n'a donc jamais qu'un seul dictionnaire en mémoire et ne rencontre aucun trou. Trois règles **[proposition]** :

- **`fr` et `en` sont embarqués dans le build**, importés statiquement comme le reste de `content/` : une partie doit pouvoir se jouer hors ligne (§1), et le repli doit être disponible sans réseau. Les sept autres langues sont servies par `GET /api/i18n/<locale>.json?v=<chainesVersion>`, immuables et donc cachables indéfiniment.
- **Le chargement est asynchrone et non bloquant.** La page monte avec le bundle embarqué, remplace le dictionnaire quand celui de la langue choisie arrive, et **salit la scène** (`scene.salir()`, §2) pour un seul repaint. Si la requête échoue, le joueur reste en anglais ou en français : une langue absente n'empêche jamais de jouer.
- **Un scénario charge la version qu'il a figée.** Le bundle demandé est celui du `chainesVersion` du scénario, pas le dernier : une dépêche rejouée au septième jour affiche les textes du premier (`09-i18n.md` §6). C'est le même principe que `catalogueVersion`, appliqué au texte, et c'est pour cela que ni l'un ni l'autre n'obsolète un rejeu.

Le moteur, lui, ignore tout de ce dispositif : `engine/` ne manipule que des clés d'objets, jamais un texte affichable, et deux parties de même graine sont identiques quelle que soit la langue (§7).

### 3.6 Le serveur

Socle repris de Flecho, sans invention : Next.js 15 App Router, PostgreSQL, Drizzle ORM, migrations SQL versionnées dans `drizzle/`, `scripts/migrate.mjs` au démarrage, déploiement Coolify, `CRON_SECRET` partagé avec les routines.

**Routes des routines.** Toutes sous `Authorization: Bearer $CRON_SECRET`, toutes en JSON strict, toutes idempotentes autant que possible. **La liste normative est celle de `05-routines.md` §7.2**, qui fait foi ; le tableau ci-dessous en donne la lecture d'architecte.

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/routines/missions?routine=<cle>` | `GET` | Liste ordonnée des missions du run (`{key, version, body, count, missions[]}`), avec `promptUrl` et `submitUrl` par mission. Le point d'entrée unique : **une routine ne devine jamais sa mission**. |
| `/api/routines/missions/[id]` | `GET`, `PATCH` | Contexte de travail de la mission (`apprise`, bornes, extraits de canon) ; `PATCH` pour un complément non structurant. |
| `/api/routines/missions/[id]/soumission` | `POST` | **Seul point d'écriture de contenu**, toutes routines confondues : lore, paramètres de carte, `ReviewVerdict`. |
| `/api/routines/missions/[id]/quarantaine` | `POST` | Signalement d'un objet non interprétable. |
| `/api/routines/missions/[id]/reservation` | `DELETE` | Rend une mission sans la mettre en quarantaine. |
| `/api/routines/bible/flags` · `/api/routines/map/mecaniques` | `GET` | Catalogues en lecture seule (flags, mécaniques régionales). |
| `/api/routines/map/missions?priorite=depeche&limite=<n>` | `GET` | **File prioritaire quotidienne** de la Dépêche du jour : même enveloppe que `/missions`, plus une `echeance` (§6.1). |
| `/api/routines/map/cartes/[map_id]` | `PATCH` | Commentaire d'aperçu de carte, une itération, puis clôture. Le **serveur** exécute `mapgen` : la routine ne soumet jamais une grille. |
| `/api/routines/controle/simulations` | `POST` | Campagne de simulation headless — carte **multi-climat** (`conditions[]`) ou **catalogue** (`catalogueCandidat`) ; renvoie les `StatsSimulation` de `03-schemas.md` §12. |
| `/api/routines/catalogue/unites` | `GET` | Catalogue d'unités actif et `catalogueVersion` courante (lecture seule : map, contrôle). |
| `/api/routines/catalogue/unites/[cle]` | `PATCH` | Changement de statut d'homologation, **réservé à une session d'administration humaine** : le `CRON_SECRET` ne l'ouvre pas. Incrémente `catalogue_version`. |
| `/api/routines/cerveau/{actualite,evenements,memoire,metriques,prompts}` | `GET`, `POST`, `DELETE` | Les trois volets historiques du cerveau. |
| `/api/routines/cerveau/homologation` · `/api/routines/cerveau/unites` | `GET`, `POST` | Le volet homologation : contexte de proposition (catalogue, plafond, quotas, candidates rejetées) et dépôt d'une `UnitType` candidate en `brouillon`. |
| `/api/routines/traduction/{missions,lot,soumettre}` | `GET`, `POST` | La cinquième routine : file des langues **triée par pénurie**, lot de chaînes (clé, source, contexte, glossaire, registre) et soumission par lot, acceptée ou refusée **chaîne par chaîne**. Contrat complet : `09-i18n.md` §8. |
| `/api/i18n/[locale]` | `GET` public | Bundle de traduction d'une langue, replis appliqués, immuable par `chainesVersion` (§3.5). |
| `/api/canon/[...chemin]` | `GET` | Lecture seule du `content/` versionné (§3.5). |
| `/api/health/routines` | `GET` public | Sonde « homme mort » : répond 500 si plus rien n'arrive depuis trop longtemps. |

Le prompt métier n'a pas de route propre : il est livré **dans la réponse `GET /missions`** (champ `body`), une fois pour tout le run, et les versions candidates passent par `/api/routines/cerveau/prompts`.

**Principes serveur, repris de Flecho et non négociables :**

- Le serveur **recalcule et refuse** ce qu'il n'a pas lui-même produit. Une routine qui envoie une grille de carte toute faite est refusée ; elle envoie des paramètres, le serveur génère.
- Chaque `POST` répond avec ce qui a été accepté **et pourquoi le reste a été refusé**. Pas de second `POST` sur le même volet : on corrige au passage suivant.
- Une mission ouverte non soumise depuis moins de 30 minutes est reprise telle quelle (reprise après run coupé) ; `&neuf=1` force une mission neuve.
- Un champ `apprise` porte les reproches de la routine contrôle sur les 30 derniers jours : c'est une section de prompt en plus, apprise par retour d'expérience.
- Quarantaine : ce que la routine ne reconnaît pas, elle le signale au lieu de l'inventer.

**Tables.** Les noms de tables sont en anglais (convention du brief), les valeurs de contenu en français.

| Table | Colonnes principales | Notes |
|---|---|---|
| `ai_prompts` | `id`, `cle` (`atlas_lore` \| `atlas_map` \| `atlas_controle` \| `atlas_cerveau` \| `atlas_traduction`), `version`, `corps`, `sections` jsonb (empreintes SHA-256 des sections verrouillées, `05-routines.md` §5.4), `auteur` (`humain` \| `atlas_cerveau`), `justification`, `statut` (`propose` \| `courant` \| `retire`), `metriques` jsonb, `parent_version`, `created_at`, `active_le` | Une seule ligne `courant` par `cle` (index unique partiel). Historique complet, retour arrière = repasser une ancienne version en `courant`. Schéma détaillé : `PromptVersion`, `03-schemas.md` §11. |
| `countries` | `id`, `code` (ISO 3166-1 alpha-2), `donnees` jsonb (`Country`), `statut`, `version`, `source` | Les 24 pays de départ y sont, même ceux écrits à la main (copie miroir du `content/` pour que les routines lisent une seule source). |
| `commanders` | `id`, `code`, `pays_code`, `donnees` jsonb (`Commander`), `statut`, `version` | |
| `maps` | `id`, `code`, `donnees` jsonb (`MapDef`), `graine`, `parametres` jsonb, `statut`, `diagnostic` jsonb | `graine` + `parametres` suffisent à reconstruire `donnees` : c'est vérifié à chaque écriture. |
| `scenarios` | `id`, `code`, `map_id`, `donnees` jsonb (`Scenario`), `statut`, `acte`, `pays_code`, `date` date, `catalogue_version` int | `date` et `catalogue_version` sont **colonnes** en plus d'être dans `donnees` : c'est ce qu'on interroge pour bâtir la Dépêche et pour savoir quels scénarios une version de catalogue retirée concerne. |
| `unit_types` | `id`, `cle` (unique), `donnees` jsonb (`UnitType`), `statut` (`canon` \| `essai` \| `homologuee` \| `retiree`), `catalogue_version` int, `traits` text[], `silhouette` jsonb, `essai_jusqu_au` date, `homologuee_le` date, `source_event_id`, `version`, `created_at` | La table du catalogue vivant. `essai_jusqu_au` = mise en essai + 30 jours (`05-routines.md` §9.2) : c'est ce que le serveur relit pour présenter le dossier de promotion. Les dix `canon` y sont en copie miroir de `content/unites.json`. **Contrainte : au plus 24 lignes de statut `canon`, `essai` ou `homologuee`** (`04-gameplay.md` §13.7), et une ligne `canon` ne change jamais de statut. `traits` et `silhouette` sont extraits en colonnes pour que la routine contrôle interroge le catalogue sans désérialiser 24 jsonb. Une ligne n'est jamais supprimée : `retiree` reste résolvable par les anciennes `catalogue_version`. |
| `daily_missions` | `id`, `date` date **unique**, `event_id`, `scenario_id`, `pays_code`, `statut`, `expire_le` date, `catalogue_version` int, `created_at` | La Dépêche du jour (`MissionDuJour`, `03-schemas.md` §14). L'unicité sur `date` est la garantie structurelle du « au plus une mission par jour réel » : elle est en base, pas dans le code de la routine. `expire_le = date + 7 jours`, calculé par le serveur. `catalogue_version` est une **copie dénormalisée** de celle du scénario cité (`03-schemas.md` §14 : la mission fige sa version comme n'importe quel scénario) — c'est ce qui permet d'interroger les archives sans joindre `scenarios`, jamais une seconde source de vérité. Aucune ligne n'est supprimée à l'expiration : elle passe en `retire` et alimente les archives. |
| `reviews` | `id`, `cible_type`, `cible_id`, `verdict` (`valide` \| `rejete`), `motifs` jsonb, `codes_motifs` text[], `stats` jsonb, `routine_run_id`, `created_at` | Journal d'audit : on ne supprime jamais une review. `motifs` est **structuré** depuis l'arbitrage n° 5 (`{code, detail?, mesure?}[]`, `03-schemas.md` §12) ; `codes_motifs` en extrait les seuls codes, indexé, pour trier une file de rejets sans désérialiser. `stats` porte un `StatsSimulation`, ou le couple `{avec, sans}` pour une cible `unite`. |
| `events` | `id`, `source_url`, `categorie`, `donnees` jsonb (`Event`), `debut`, `fin`, `statut`, `valide_par_humain` bool | Aucun passage en ligne sans `valide_par_humain = true`. |
| `memory` | `id`, `date`, `source`, `sujet`, `contenu` jsonb, `portee`, `expire_le`, `poids` | Entrées structurées et datées, jamais un texte qui grossit. Purge automatique sur `expire_le`. |
| `routine_runs` | `id`, `routine`, `demarre_le`, `fini_le`, `statut`, `bilan` text, `appels` int, `erreurs` jsonb | Alimente les métriques de `ai_prompts` et la sonde de santé. |
| `locales` | `id`, `code` (unique, BCP 47 minuscule : `fr`, `pt-br`, `zh-hans`), `nom`, `script`, `sens` (`ltr` \| `rtl`), `statut` (`en_preparation` \| `active`), `seuil_couverture` numeric, `facteur_longueur` numeric, `echantillon_humain` int, `ordre` int | **Ajouter une langue est une ligne ici, et rien d'autre** (`BRIEF.md`, « Langues » ; `09-i18n.md` §5.1). `fr` (langue source) et `en` (premier repli) ne sont ni retirables ni rétrogradables. `sens` existe déjà bien qu'aucune langue de droite à gauche ne soit prévue au lancement. |
| `chaines_source` | `id`, `cle` (unique, pointée : `hud.fin_de_tour`), `texte` (le **français**), `origine` (`interface` \| `canon` \| `genere`), `contexte` jsonb, `longueur_max` int null, `placeholders` text[], `pluriel` bool, `source_hash` char(16), `version_chaine` int, `objet_ref` jsonb, `cree_le`, `maj_le` | La table des originaux. `source_hash` et `placeholders` sont **calculés** par le serveur (`09-i18n.md` §2.2). Une ligne naît de trois façons : extraction du dépôt, extraction de `content/`, ou passage d'un objet généré en `valide`. Une clé n'est jamais réutilisée pour un autre texte. |
| `traductions` | `id`, `cle_chaine`, `locale`, `texte` null, `statut` (`manquante` \| `brouillon` \| `validee` \| `perimee`), `source_hash` char(16), `version_chaine` int, `auteur` (`atlas_traduction` \| `humain`), `relue_par_humain` bool, `run_ref`, `cree_le`, `maj_le` | Clé primaire logique : (`cle_chaine`, `locale`), jamais de locale `fr`. **Le passage `validee → perimee` est fait en base** dès que `source_hash` diverge de celui de `chaines_source` — c'est ce qui garantit qu'une correction du français atteint les huit autres langues. Index sur (`locale`, `statut`) : c'est lui qui produit le tri par pénurie de `09-i18n.md` §8.2. |
| `glossaires` | `id`, `locale`, `entrees` jsonb (`{terme, categorie, traduction, translitteration?, note?}[]`), `termes_interdits` text[], `maj_le` | **Propriété du canon** : copie miroir de `content/i18n/glossaire.<locale>.json`, écrite par migration ou par déploiement, **jamais par une routine**. Sans glossaire, le serveur ne sert aucun lot pour la langue. |

---

## 4. Arborescence du dépôt

Ce qui suit est l'arborescence **réelle** au 5 septembre 2026, pas une cible. Une phrase par dossier ; le détail des couches est au §3, les règles d'import au §5.

```
atlas-tournaments/
├─ src/
│  ├─ app/                        # Next.js 15 App Router — la seule couche qui a le droit de tout importer
│  │  ├─ layout.tsx  page.tsx  globals.css
│  │  ├─ jeu/[scenario]/          # la page de jeu ('use client') et sa toile ; adversaire.ts branche l'IA
│  │  ├─ admin/                   # panel : accueil, login, file, prompts, catalogue, dépêche, traductions
│  │  └─ api/                     # health, canon, i18n, admin, et les routes /api/routines/*
│  ├─ engine/                     # §3.1 — le moteur pur : état, actions, RNG, rejeu, règles, climat, mécaniques, déblocages
│  ├─ ai/                         # §3.2 — l'IA de jeu : évaluation et trois stratégies (pondérée, agressive, défensive)
│  ├─ mapgen/                     # §3.3 — le générateur de cartes : grille, relief, bâtiments, symétrie, vérification, aperçu texte
│  ├─ render/                     # §3.4 — le socle de rendu commun : interface `Rendu`, boucle, caméra, entrées, HUD HTML, peau 2D vectorielle, rastérisation PNG d'aperçu
│  ├─ render3d/                   # la peau 3D three.js : scène, terrain, éclairage, unités, décor, surbrillances, animations, textures
│  ├─ assets/                     # le format `AssetSpec`, le catalogue de specs, les styles nationaux et les validateurs (spec + glTF)
│  ├─ content/                    # §3.5 — chargeurs typés du canon JSON de `content/`
│  ├─ schemas/                    # types partagés (`types.ts`) et validateurs écrits à la main, sans dépendance (`valider.ts`, `noyau.ts`)
│  ├─ i18n/                       # `t()`, l'ordre de repli des langues, et la table des chaînes d'interface source
│  ├─ db/                         # Drizzle : `schema.ts`, client, et un fichier de requêtes typées par table
│  └─ serveur/                    # la logique serveur testable en Node : auth, cycle, missions, contrôle, simulation, dépêche, traduction, canon, prompts
├─ content/                       # le canon JSON, servi en lecture seule par /api/canon
│  ├─ unites.json terrains.json degats.json mecaniques.json archetypes.json flags.json gabarits-missions.json
│  ├─ pays/                       # les 24 fiches `Country` des pays de départ (06)
│  ├─ regions/fr/                 # les 18 fiches de région française (07)
│  ├─ styles/                     # les styles visuels nationaux (24) et régionaux (`styles/regions/fr/`)
│  ├─ fils/                       # les neuf fils secondaires de campagne (13)
│  ├─ cartes/                     # les `MapDef` versionnées dans le dépôt
│  ├─ scenarios/                  # les scénarios jouables (`demo.json` aujourd'hui)
│  └─ i18n/                       # les chaînes d'interface françaises extraites et le glossaire de la langue source
├─ assets/specs/                  # les 540 `AssetSpec` générées depuis le canon, versionnées (11)
├─ scripts/                       # les outils en ligne de commande : migrate, simuler, controler-carte, apercu-carte, generer-specs-assets, extraire-chaines
├─ drizzle/                       # les migrations SQL numérotées, jamais modifiées après application
├─ tests/                         # `tsx --test` : un dossier par couche, plus `frontieres.test.ts` qui fait respecter le §5
├─ e2e/                           # les deux tests de fumée Playwright (2D et 3D), sur le port 3400
├─ doc/                           # les documents de conception 00 à 14 (`doc/README.md` donne l'ordre), plus `doc/assets/` (démos de rendu)
├─ apercus/                       # les PNG produits par `scripts/apercu-carte.ts` — ignoré par git
├─ public/                        # les fichiers servis tels quels par Next (vide aujourd'hui)
├─ .github/workflows/ci.yml       # types, tests, migrations rejouables, build
├─ Dockerfile                     # image de production Coolify ; `npm start` = migrations puis Next
├─ .env.example                   # les variables attendues ; la vraie `.env` n'est jamais commitée
└─ BRIEF.md  PLAN.md  README.md  CLAUDE.md  LICENSE
```

Deux absences volontaires : il n'y a **pas** de dossier `app/` à la racine (tout est sous `src/app/`), et `doc/` n'est jamais servi par `/api/canon`, qui ne connaît que `content/`.

---

## 5. Frontières et règles d'import

Trois règles, vérifiées par `tests/frontieres.test.ts`, qui lit les imports de chaque fichier de `src/` et échoue sur la moindre violation :

1. `src/engine/**`, `src/mapgen/**`, `src/ai/**` n'importent **jamais** `src/render/**`, `src/render3d/**`, `src/db/**`, `src/app/**`, ni aucune API navigateur. Le test refuse en plus `window`, `document`, `fetch(`, `Date.now(` et `Math.random(` dans les cinq couches pures (`engine`, `ai`, `mapgen`, `schemas`, `content`) : c'est le déterminisme, écrit une fois.
2. `src/render/**` n'importe jamais `src/db/**` ni `src/app/**` ; `src/render3d/**` a le droit d'importer `src/render/**` et `src/assets/**`, jamais l'inverse. La table complète des couches autorisées est dans le test lui-même, qui fait foi.
3. Le jeu n'a **qu'une seule dépendance npm runtime**, `three`, et elle n'est utilisée que par `src/render3d/` : `engine`, `ai`, `mapgen`, `schemas`, `content` et le socle `render/` restent sans aucune. Le `package.json` sépare `dependencies` (next, react, drizzle, pg, three) de `devDependencies` (typescript, tsx, playwright, eslint, tailwind) ; toute nouvelle ligne dans `dependencies` est une décision consciente.

---

## 6. Cycle de vie du contenu généré

```
                    ┌──────────────┐
   routine produit  │  brouillon   │
   ────────────────►│              │
                    └──────┬───────┘
                           │  routine contrôle : ReviewVerdict
              ┌────────────┴─────────────┐
              │                          │
        verdict validé            verdict rejeté
              │                          │
              ▼                          ▼
      ┌───────────────┐          ┌───────────────┐
      │    validé     │          │    rejeté     │
      │ (jouable en   │          │ + motifs[]    │
      │  préproduction│          └───────┬───────┘
      └───────┬───────┘                  │
              │ mise en ligne            │ les motifs alimentent
              │ (humain pour lore,       │ le champ `apprise` et
              │  événements, prompts)    │ les métriques de prompt
              ▼                          ▼
      ┌───────────────┐          reprise au run suivant
      │   en_ligne    │          (ou abandon après 3 rejets)
      └───────┬───────┘
              │ remplacé par une version plus récente
              ▼
        ┌───────────┐
        │  retiré   │   (conservé, jamais supprimé)
        └───────────┘
```

**Valeurs stockées, sans accent, pour rester des identifiants stables** **[proposition]** : `brouillon`, `en_controle`, `valide`, `rejete`, `en_ligne`, `quarantaine`, `retire` — c'est l'énumération `Statut` de `03-schemas.md` §0. `en_controle` (une mission de contrôle est ouverte sur l'objet) et `quarantaine` (anomalie non interprétable, attente d'un humain) viennent de `05-routines.md` §1.4 et §1.6 ; ils ne figurent pas dans le schéma ci-dessus, qui n'en montre que le chemin principal. Les libellés affichés portent les accents (« validé », « en ligne »).

Règles :

- **Seule la routine contrôle** peut écrire `brouillon → valide` ou `brouillon → rejete`. C'est un `POST /api/routines/missions/[id]/soumission` portant un `ReviewVerdict` complet — le point d'écriture est le même pour toutes les routines (`05-routines.md` §7.2, qui fait foi) ; un verdict sur une cible `carte`, `scenario` ou `unite` sans statistiques de simulation est refusé par le serveur.
- **Seul un humain** peut écrire `valide → en_ligne` pour le lore, les événements d'actualité et les prompts. Pour les cartes purement mécaniques, le passage peut être automatique une fois la confiance établie **[proposition]** — mais pas au début.
- Un `rejete` porte toujours des **motifs codés** pris dans l'énumération fermée `MotifRejet` de `03-schemas.md` §12 (`qg_inaccessible`, `desequilibre_fonds`, `zone_morte`, `ton_hors_bible`, `flag_inconnu`…), jamais du texte libre seul. Le texte libre est un complément facultatif.
- **Trois rejets sur le même objet** l'archivent et remontent une alerte : ce n'est plus un problème de contenu mais de prompt ou de générateur.
- Rien n'est jamais supprimé. `retire` remplace la suppression, pour que l'historique reste auditable et qu'un retour arrière soit toujours possible.

### 6.1 Le flux quotidien de la Dépêche

La **Dépêche du jour** est le même cycle de vie que ci-dessus, mais **contraint par une horloge**. Au plus une mission par jour réel (`daily_missions.date` est unique), courte, tirée d'un `Event` de la liste blanche, indépendante de la campagne.

**Le fuseau est `Europe/Paris`, et c'est le seul du projet.** Toutes les heures ci-dessous s'y lisent. Le moteur, lui, ne connaît ni heure ni fuseau : il ne voit que `Scenario.date` (§3.1).

**Les quatre échéances sont celles de `05-routines.md` §8.2 et §7.3, qui font foi** ; le tableau ci-dessous en donne la lecture d'architecte. Les heures de routine dépendent du fuseau et de la durée d'un run ; les échéances, jamais.

| Heure | Ce qui se passe |
|---|---|
| ~05:35 | La routine cerveau propose au plus **un** `Event` du jour, en `brouillon`, avec sa source et sa catégorie. |
| **07:00 — échéance de proposition** | Sans `Event` à cette heure, la journée est blanche. Le serveur ouvre sinon la `MissionDuJour` et la file prioritaire map. |
| ~08:05 | La routine map produit le scénario correspondant — **file prioritaire**, 10 à 15 journées. |
| **09:30 — échéance de scénario** | Un scénario arrivé après est refusé (`409 ECHEANCE_DEPASSEE`), jamais reporté au lendemain. |
| 09:42 · 10:12 · 10:42 | La routine contrôle certifie — trois occasions : simulation multi-climat (§8 de ce document) et vérification du ton au seuil renforcé. |
| **11:00 — échéance de certification** | Tout ce qui n'est pas `valide` à cette heure **ne sortira pas aujourd'hui**. |
| 11:00 → 17:00 | Validation humaine. Sans elle, rien ne passe `en_ligne` — la règle du §6 ne connaît pas d'exception pour l'actualité. |
| **17:00 — échéance de validation humaine** | Personne n'a tranché : la journée est blanche, et ce n'est pas un incident. |
| **18:00 — mise en ligne** | Heure fixe. Le serveur exécute la décision armée ; la mission apparaît dans la Dépêche. |

**Pas d'événement validé, pas de mission ce jour-là.** C'est une décision, pas une panne : le vide vaut mieux qu'une erreur, et l'interface affiche la dernière Dépêche encore valide au lieu d'inventer.

**La file prioritaire.** `GET /api/routines/missions` ordonne les missions ; celles de la Dépêche portent un drapeau `prioritaire` et une `heureLimite`, et passent **devant tout le reste**, quelle que soit l'ancienneté des autres. Deux règles qui vont avec **[proposition]** :

- une routine qui reçoit une mission prioritaire **après** son heure limite la **rend** (`DELETE /api/routines/missions/[id]/reservation`) au lieu de la traiter : une mission du jour livrée demain n'a plus d'objet ;
- une mission prioritaire non soumise à son heure limite bascule en `retire` avec le motif `evenement_perime`, et le compteur alimente les métriques de prompt comme n'importe quel rejet.

**Sept jours, puis l'archive.** `expire_le = date + 7 jours`. Passée cette date, la mission quitte la Dépêche et passe en `retire`, mais **reste jouable depuis les archives** : rien n'est supprimé, et un joueur qui revient après trois semaines retrouve les trois semaines. Une mission archivée garde sa `catalogue_version`, donc les unités en `essai` qu'elle utilisait — c'est le seul endroit du jeu où une unité retirée reste jouable, et c'est voulu.

**L'homologation suit le même cycle, à un rythme plus lent** (`04-gameplay.md` §13.7) : une `UnitType` candidate par semaine au plus, certifiée par simulation de catalogue, validée par un humain, puis `essai` pendant 30 jours — **dans les missions du jour seulement** — avant `homologuee` ou `retiree`. Chaque transition incrémente `catalogue_version` (§3.5).

---

## 7. Déterminisme

Le déterminisme n'est pas un confort : c'est ce qui rend la routine contrôle possible, les bugs reproductibles et les sauvegardes légères.

**Le générateur d'aléas.** Un seul, dans `engine/rng.ts`, seedé par une chaîne. Algorithme `xoshiro128**` amorcé par `splitmix32` sur le hachage FNV-1a de la graine **[proposition]** — rapide, sans dépendance, à l'état sérialisable en quatre entiers 32 bits.

```ts
export interface Rng {
  readonly etat: [number, number, number, number];  // sérialisable
  suivant(): number;             // flottant dans [0, 1)
  entier(borne: number): number; // entier dans [0, borne)
  branche(nom: string): Rng;     // flux dérivé, indépendant
}
```

Les **flux dérivés** sont essentiels : le combat, la génération de carte et l'IA tirent chacun dans leur propre flux (`rng.branche('combat')`, `rng.branche('mapgen')`, `rng.branche('ia:rouge')`). Sans cela, ajouter un tirage dans l'IA décalerait tous les jets de combat et casserait chaque rejeu enregistré.

**Ce qui est interdit dans `engine/`, `mapgen/`, `ai/` :** `Math.random`, `Date` (`Date.now()` et `new Date()` compris — la couche `climat/` ne fait pas exception, elle reçoit la date par `Scenario.date`), `performance.now`, l'itération sur un objet sans tri explicite des clés, `Array.prototype.sort` sans comparateur total (le tri n'est stable qu'à comparateur égal), les `Set`/`Map` dans l'état sérialisé, et toute dépendance à l'ordre d'insertion. Ces interdits sont vérifiés par un test de lecture de source **[proposition]**.

**Même graine = même carte.** `genererCarte(parametres, graine)` est une fonction pure. La table `maps` stocke `graine` et `parametres` en plus de la grille ; un test rejoue la génération et compare — si la grille stockée diffère, c'est que le générateur a changé de version et il faut incrémenter `mapgenVersion` dans la `MapDef`.

**Même graine = même partie.** Une partie se résume à `{ scenarioCle, graine, catalogueVersion, actions[] }`. Le rejeu applique les actions dans l'ordre et doit retomber exactement sur le même état final. C'est le format de sauvegarde **[proposition]** (`Sauvegarde`, `03-schemas.md` §14) : quelques kilo-octets au lieu d'un état complet, et un outil de débogage gratuit (« rejoue jusqu'au coup 47 »). Le climat n'y ajoute rien : la saison vient de `Scenario.date`, la météo du flux `rng.branche('climat')`, tout se recalcule.

**Versionner ce qui casse le rejeu.** **Quatre** numéros dans l'état : `engineVersion`, `mapgenVersion`, `contentVersion` et **`catalogueVersion`** (§3.5). Un rejeu enregistré sous d'anciennes versions n'est pas rejoué silencieusement : il est marqué obsolète — sauf `catalogueVersion`, qui n'obsolète rien, précisément parce que les anciennes versions de catalogue restent résolvables.

---

## 8. Stratégie de tests

Quatre niveaux, du plus rapide au plus lent. Les trois premiers tournent sous Node, sans navigateur.

**1. Tests unitaires du moteur** (`tests/engine/`). Pour chaque règle, un cas nominal, un cas limite, un cas de refus. Priorités : la formule de dégâts (valeurs de référence figées à la main dans une table de vérité), la portée de déplacement sur terrains mixtes, la riposte, la capture interrompue, le transport, la production quand les fonds manquent, les conditions de victoire, le filtrage par brouillard (un état filtré ne doit jamais contenir une unité invisible — c'est une faille de triche si on l'oublie). Objectif chiffré **[proposition]** : couverture de branches supérieure à 90 % sur `engine/`, seuil vérifié en intégration continue.

**2. Tests de propriétés sur le générateur** (`tests/mapgen/`). Pas d'assertions sur une carte particulière, mais sur **toutes** les cartes. Un générateur de graines pseudo-aléatoires produit 500 cartes par jeu de paramètres, et chacune doit satisfaire :

- déterminisme : `genererCarte(p, g)` deux fois donne un JSON identique ;
- accessibilité : tout QG est joignable depuis tout autre QG par une unité à pied ;
- pas de zone morte : aucune composante connexe de terre de plus de 3 cases sans bâtiment ni accès ;
- équité : chaque camp a le même nombre de villes et d'usines, et la distance QG → usine la plus proche varie de moins d'une case entre camps ;
- symétrie déclarée respectée à la case près ;
- toutes les cases sont des caractères de terrain connus, la grille est rectangulaire, chaque camp a exactement un QG ;
- toute unité de départ est sur un terrain qu'elle peut occuper.

Un contre-exemple est **automatiquement réduit** (on rétrécit les paramètres jusqu'à la plus petite carte qui échoue encore) et sa graine est ajoutée à une liste de non-régression.

**3. Simulation IA contre IA** (`scripts/simuler.ts` et `tests/ai/`). C'est le test d'équilibrage et l'outil de la routine contrôle. Une carte est jouée N fois (N = 20 par défaut en intégration continue, **40 pour une campagne demandée par la routine contrôle**, voir `05-routines.md` §4.4 ; borne serveur 100), en alternant qui commence, et on mesure :

| Statistique | Seuil d'alerte |
|---|---|
| Taux de victoire du camp qui commence | hors de 40–60 % |
| Durée médiane en journées | < 8 ou > 45 |
| Parties non terminées à la limite de tours | > 20 % |
| Écart-type de la durée | > 40 % de la médiane (carte trop aléatoire) |
| Cases jamais visitées | > 25 % de la surface de terre |
| Fonds cumulés, écart entre camps | > 15 % |
| Parties où la mécanique régionale s'est déclenchée | 0, quand la carte en déclare une (`mecanique_inutilisee`) |

Ces statistiques sont exactement le champ `stats` du `ReviewVerdict` (voir `03-schemas.md` §12), `mecaniqueDeclenchee` compris.

**Simulation multi-climat.** Une carte n'est **pas** certifiée sous une seule météo : le climat change les coûts de terrain, les lignes de défense (une rivière gelée n'en est plus une) et la vision, donc il change la carte. La routine contrôle rejoue le **même lot de graines** sur une matrice climatique :

- les **quatre saisons**, chacune avec les effets de la table climat × saison du climat du pays (`04-gameplay.md` §12.2) ;
- pour chaque saison, **trois météos** — `clair`, la plus probable de la ligne, et la plus pénalisante de la ligne ;
- plus **une passe de nuit complète** (`cycleJourNuit: { jour: 0, nuit: 6 }`), qui est le pire cas de vision.

La matrice est réduite aux configurations **atteignables** par le climat de la carte — une carte `aride` ne voit jamais `neige`, la ligne de probabilité l'interdit — soit typiquement **6 à 9 configurations** au lieu de 13. C'est la matrice de l'**intégration continue**, hors ligne ; une campagne demandée par la routine contrôle via l'API est bornée plus court, à **3 à 6 conditions** (`05-routines.md` §4.2 et §4.4, qui font foi sur les bornes d'appel), et le serveur écarte lui-même les conditions impossibles pour le climat du pays. Le nombre de parties par configuration est divisé d'autant pour rester sous la borne serveur de 100 : c'est le même budget de calcul, réparti autrement. **Une carte doit rester jouable dans toutes les cases de la matrice** : les seuils du tableau ci-dessus s'appliquent à chacune, et un seul dépassement suffit à rejeter. Chaque configuration produit sa propre ligne de `StatsSimulation`, identifiée par son champ `climat`.

**Simulation de catalogue.** Même principe pour une `UnitType` candidate (`04-gameplay.md` §13.4) : le même lot de graines est joué **avec et sans** la candidate disponible à l'achat, et l'on compare le taux de victoire du camp qui peut l'acheter, sa fréquence d'achat et son efficacité par coût. Les motifs `unite_dominante` et `unite_inutile` sortent de cette comparaison, recalculés côté serveur.

En intégration continue, la même simulation tourne sur les cartes canon avec une graine fixe et une **configuration climatique fixe** : une variation du résultat signale une régression d'équilibrage.

**4. Test de fumée Playwright** (`e2e/fumee.spec.ts`). Un seul scénario, court, qui doit toujours passer : charger `/jeu/tutoriel-fr`, attendre que le canvas soit peint (comparaison de quelques pixels, pas d'instantané complet — la texture d'herbe est seedée mais le rendu de police varie d'une machine à l'autre), sélectionner une infanterie, la déplacer, capturer une ville, finir le tour, vérifier que le HUD affiche la journée 2. Complété par un contrôle d'absence d'erreur console et un contrôle de HiDPI (`devicePixelRatio` simulé à 2, le canvas doit avoir deux fois plus de pixels physiques que logiques).

**Test de frontières** (§5) et **test d'interdits de déterminisme** (§7) : deux tests qui lisent le code source et échouent sur un import ou un appel interdit. Grossier, mais c'est ce qui empêche l'architecture de se dissoudre en six mois.

---

## 9. Outillage

| Choix | Détail |
|---|---|
| Langage | TypeScript en mode **strict** complet : `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`. `noUncheckedIndexedAccess` est pénible sur une grille indexée — c'est justement là qu'il rattrape les bugs hors bornes. |
| Tests | `tsx --test` (le lanceur `node:test` avec le chargeur TypeScript de `tsx`), comme sur Flecho. Zéro framework de test, zéro configuration, des assertions `node:assert/strict`. |
| Bout en bout | Playwright, un seul projet Chromium, lancé sur le build de production. |
| Base | PostgreSQL + Drizzle ORM, migrations SQL versionnées dans `drizzle/`, `scripts/migrate.mjs` au démarrage. |
| Déploiement | Coolify, `CRON_SECRET` en variable d'environnement, partagé avec les tâches planifiées Claude. |
| Format / qualité | Formatage automatique et un jeu de règles court **[proposition]** — l'essentiel de la discipline est porté par `strict` et par les tests de frontières, pas par des centaines de règles. |
| Intégration continue | Sur chaque poussée : types, tests unitaires, propriétés (100 cartes en rapide), frontières, déterminisme. La nuit : propriétés à 500 cartes, simulations complètes, Playwright. |

---

## 10. Récapitulatif des propositions hors brief

| # | Proposition | Risque si refusée |
|---|---|---|
| 1 | Identifiants en français dans le code du jeu, tables SQL en anglais | Incohérence, mais sans gravité |
| 2 | Statuts sans accent en base (`valide`, `en_ligne`) | Encodage et comparaisons fragiles |
| 3 | Une seule action = un ordre complet (chemin + suite) | Rejeu plus verbeux, coups intermédiaires ambigus |
| 4 | Sauvegarde = `{scenarioId, graine, actions[]}` plutôt qu'un état complet | Sauvegardes lourdes, pas de rejeu de débogage |
| 5 | `xoshiro128**` + flux dérivés par domaine | Ajouter un tirage casserait tous les rejeux |
| 6 | Trois niveaux d'IA derrière un même contrat | L'IA de test différerait de l'IA jouée |
| 7 | Tests de frontières et d'interdits par lecture de source | Dérive lente de l'architecture |
| 8 | Passage automatique en ligne des cartes une fois la confiance établie | Goulot d'étranglement humain |
| 9 | Trois rejets → archivage et alerte | Boucles de rejet infinies |
| 10 | `engineVersion` / `mapgenVersion` / `contentVersion` / `catalogueVersion` dans l'état | Rejeux silencieusement faux après une évolution de règle ou du catalogue |
| 11 | `ambiance = f(saison, phase, meteo)` isolée dans `render/ambiance.ts`, purement cosmétique | Des règles finiraient dans le rendu, et le climat deviendrait intestable |
| 12 | Cache de sprites indexé par silhouette et par ambiance | Une unité homologuée ajouterait une entrée de cache par nation et par zoom |
| 13 | Horaires de la Dépêche (limite 14:00, mise en ligne 18:00 Europe/Paris) | Sans heure limite, une mission « du jour » sort le lendemain |
| 14 | File prioritaire : une mission du jour périmée est rendue, pas traitée | Les routines travailleraient sur du contenu déjà mort |
| 15 | Colonnes `traits`, `silhouette`, `catalogue_version` extraites de `unit_types.donnees` | La routine contrôle désérialiserait 24 jsonb à chaque simulation de catalogue |
| 16 | Matrice climatique réduite aux configurations atteignables | Soit un coût de simulation multiplié par treize, soit des cartes certifiées sous une seule météo |
| 17 | Bundles de traduction servis par langue, `fr` et `en` embarqués, chargement non bloquant (§3.5) | Une partie hors ligne perdrait ses textes, et le rendu porterait la logique de repli |
