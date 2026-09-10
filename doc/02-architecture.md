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
   │                   └──► render/ + render3d/   ·   Node headless (tests, IA) │
   └────────────────────────────────────────────────────────────────────────────┘
```

**Règle absolue, reprise du brief :** aucun appel à un modèle pendant une partie. L'anneau 3 produit du contenu, le serveur le valide et le fige, l'anneau 1 le consomme comme il consommerait un fichier JSON écrit à la main. Une partie doit pouvoir se jouer hors ligne, avec un `content/` embarqué.

**Le sens des dépendances ne s'inverse jamais :** `render/` connaît `engine/`, `engine/` ignore l'existence de `render/`. `ai/` connaît `engine/`, `engine/` ignore `ai/`. `engine/` n'importe rien d'autre que `content/` et ses propres types. Cette règle est vérifiée mécaniquement (§8).

---

## 2. Pourquoi un rendu écrit à la main, sans moteur de jeu

Cette section a été écrite pour justifier un rendu **Canvas 2D**. Elle a été révisée deux fois : le 5 septembre 2026 au matin, quand la direction artistique est passée à la 3D (`BRIEF.md`, direction artistique) ; puis le 5 septembre au soir, quand le rendu vectoriel a été **supprimé** au lieu de rester comme repli. Ce qui suit tient compte des deux.

Le raisonnement de fond n'a pas bougé, et c'est pour cela qu'il vaut la peine d'être relu. Un tactique au tour par tour n'a besoin ni de moteur physique, ni de boucle temps réel à 60 images par seconde en continu, ni de gestion de scène complexe : l'écran est statique la plupart du temps et ne bouge que pendant de courtes animations scriptées — un déplacement le long d'un chemin, un tir, un fondu de HUD. **Phaser** irait dans la mauvaise direction : il impose sa propre boucle, ses scènes, son système d'entrées, sa notion de « game object », c'est-à-dire une architecture concurrente de la nôtre alors que le cœur du projet est justement un **moteur de règles pur, séparé du rendu**.

Ce qui a changé, c'est la brique de dessin. **three.js** est une bibliothèque de rendu, pas un moteur de jeu : elle apporte la scène, les matériaux et le pipeline de rendu — WebGPU depuis le 7 septembre 2026, WebGL 2 en repli par le même moteur —, et rien d'autre — pas de boucle imposée, pas d'entrées, pas de notion de partie. La séparation moteur/rendu tient donc exactement comme avant, et `engine/` ignore toujours qu'il existe un écran. Le prix payé est réel — plusieurs centaines de kilo-octets de JavaScript — et il est **assumé** : le relief, l'éclairage par saison et par heure, et les matières que la direction artistique demande ne se peignent pas au pinceau à la main.

**Le point de vigilance reste entier.** En refusant un framework de jeu, on s'engage à écrire soi-même trois briques que Phaser offrirait :

1. **La boucle de rendu.** Un `requestAnimationFrame` qui ne tourne que quand il y a quelque chose à animer — une file d'animations non vide, une particule, l'eau, une transition d'ambiance — et qui s'arrête sinon. Sur mobile, une boucle qui redessine à vide une image identique vide la batterie. D'où un système de **salissure** explicite : `salir()` réveille la boucle, la boucle s'endort quand la file est vide. C'est `render/boucle.ts`, et il est resté commun aux deux peaux tant qu'il y en avait deux.
2. **Les entrées souris et tactile.** Pas de gestionnaire prêt à l'emploi : il faut convertir des coordonnées écran en cases — par lancer de rayon sur le sol en 3D —, distinguer un tap d'un glisser (seuil en pixels et en millisecondes), gérer le pincement à deux doigts, le déroulement inertiel, le clic droit et la touche Échap comme « annuler ». C'est la partie la plus fastidieuse et celle où l'on se trompe le plus souvent : `render/entrees.ts` pour les gestes bruts, `render3d/gestes.ts` pour leur traduction en cases.
3. **Le redimensionnement HiDPI.** Lire `devicePixelRatio`, dimensionner le tampon en pixels physiques, le contraindre en CSS en pixels logiques, et réagir à chaque changement d'écran — un portable branché sur un moniteur externe change de ratio à chaud. three.js en prend une partie à sa charge (`setPixelRatio`), la surveillance du conteneur reste à nous : un `ResizeObserver`, pas un `window.onresize`.

La quatrième brique de la version d'origine — **le cache de sprites vectoriels en canvas hors écran** — a disparu avec le rendu vectoriel. Son équivalent 3D est le rendu **instancié** (`10-rendu-3d.md` §9) : un seul appel de dessin pour tous les troncs, un autre pour toutes les couronnes.

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

**Mise à jour du 7 septembre 2026 — le cerveau logistique.** `ai/` compte un module de plus, `logistique.ts`, pur comme les autres et sans un nom d'unité : il lit les traits (`transport`, `ravitaillement`, `drone`, `brouilleur`), `munitions`, `carburant` et `armeSecondaire` du catalogue. `meilleureOption` (`strategies/ponderee.ts`) émet désormais **toutes** les suites du moteur qu'un joueur peut émettre — `embarquer`, `debarquer`, `ravitailler` en plus de `rien`, `capturer`, `attaquer`, `construire` — et cinq raisonnements s'ajoutent aux quatre termes historiques : l'arme secondaire (une unité à sec vise ses cibles secondaires, et la dernière munition a un prix), l'autonomie de sécurité d'une unité aérienne (`autonomieSecurite` : carburant − retour × `parCase` − `parTour` × (tours de route + réserve) ; négative, elle rentre), l'attraction d'une unité à court vers une source de ravitaillement (bâtiment ami du bon domaine, ou voisine d'un ravitailleur allié), le transport (un capteur embarque quand le transport lui fait gagner au moins un tour, tours comptés avec le débarquement qui immobilise ; le transport chargé suit l'objectif de son passager et le pose là où il agit au tour suivant, ou dès qu'il est menacé sans pouvoir fuir ; sa menace compte ce qu'il porte), et l'achat des pièces de soutien (`valeurSoutien`, `evaluation.ts`). Les pièces de soutien jouent **après** les autres (`prioriteUnite`), pour qu'un transport embarque ses passagers et roule dans le même tour. Deux garde-fous trouvés au passage : une unité qui ne capture pas ne campe plus sur un bâtiment à prendre quand un capteur ami est à trois cases — un char sur la ville bloquait sa propre infanterie, et les deux IA se figeaient l'une en face de l'autre —, et aucune attaque n'est proposée sur une case invisible, parce qu'un refus du moteur ferme le tour de l'IA. Les poids neufs sont dans `Poids` (`munitions`, `carburant`, `reserve`, `ravitaillement`, `embarquement`, `debarquement`) et chaque personnalité les règle ; le contrat `Strategie` n'a pas bougé, ni le déterminisme (aucun tirage nouveau), ni la règle des imports (`ai` → `engine`, `schemas`, `content`).

**Mise à jour du 7 septembre 2026 (soir) — l'IA face au catalogue 6 : la mer, l'air, le brouillard honnête.** Quatre changements, tous dans `ai/`, sans un nom d'unité et sans toucher au moteur ni au contrat `Strategie`.

1. **Achats.** `scoreAchat` (`evaluation.ts`) garde son terme historique — dégâts infligés et encaissés sur le mix adverse **connu** — et gagne un terme **contre** (`contreAchat`, poids `Poids.contre`, 0,1) : la part des menaces que l'armée ne couvre pas encore et que l'achat couvrirait, au prix de la menace. Une menace est couverte quand l'armée aligne, en unités qui la frappent à `COUVERTURE_MIN` (50) ou plus, de quoi la mettre hors jeu une fois par exemplaire. Les menaces sont les adversaires connus **plus ce que leurs bâtiments peuvent produire** (`mixPotentiel` : `POIDS_POTENTIEL` 0,5 par bâtiment producteur adverse, réparti entre ce qu'il produit d'armé, au prorata de ce que l'adversaire peut se payer en `TOURS_POTENTIEL` journées de revenus). C'est ce terme qui rend achetable un chasseur, un lance-missiles ou un sous-marin quand la moyenne sur le mix ne les verrait jamais — et le potentiel seul n'achète pas d'anti-air sur une plaine sans aéroport. `meilleureProduction` **épargne** : si une unité inabordable, atteignable en `TOURS_EPARGNE` (2) journées de revenus, vaut `MARGE_EPARGNE` (1,3) fois la meilleure abordable, le camp n'achète rien ce tour — sauf quand les capteurs manquent. Les pièces de soutien valent par leurs **clients réels** (`besoinTransport` : unités acceptées dont l'objectif est hors de portée à pied — une île — ou à plus de deux tours, pourvu qu'un transport neuf puisse accoster près de lui ; unités à court pour un transport qui ravitaille sa cale), moins les places déjà offertes, et chaque exemplaire déjà perdu (`pertes`, lu dans `etat.produites`) divise la valeur — drones compris.
2. **Mouvement et suites.** Une pièce à tir indirect marche vers la **couronne de tir** de ses cibles (`casesDeTir`), pas vers leur case : un cuirassé bombarde la côte depuis le large. Un transport va vers les **cases de dépose** (`casesDepose`, `logistique.ts`) : celles où il peut se tenir et dont une voisine franchissable par le passager est à un tour de son objectif — une barge accoste à côté de la ville. `debarquer` vide toute la cale en un ordre (`autres`, `passager` quand ce n'est pas le premier de la cale). Un chasseur furtif se **cache** (`furtivite`) sous brouillard quand une menace connue peut atteindre son arrivée — la menace d'une unité cachée vaut `PART_MENACE_FURTIVE` (0,25) — et que le carburant le permet, se **montre** quand rien ne le menace ; la cachette a un prix par tour (la part du plein que coûte `SURCOUT_CARBURANT_FURTIF`) et l'autonomie de sécurité lit `consommationParTour` du moteur. Un porteur allié qui ravitaille sa cale est une case de retour pour l'air (`casesRetour`, `porteursRavitaillant`) : un chasseur à court y embarque. Une pièce qui ne frappe pas l'air (`frappeLAir`) compte double la menace aérienne quand aucun allié anti-air n'est à `RAYON_ESCORTE` (2) de son arrivée.
3. **Brouillard honnête.** Les stratégies ne lisent que `adversairesConnus` — `adversesVisibles` du moteur — pour la menace, les objectifs, le mix d'achat et les frappeurs (`BROUILLARD_HONNETE`, `evaluation.ts`, un mot pour revenir en arrière). Deux conséquences dans le moteur telles qu'il est : un chemin ne traverse plus un allié sous brouillard (`porteePrudente`, `deplacement.ts`), parce qu'une interruption sur la case d'un allié serait refusée ; et un ordre refusé pour `case_occupee` sur une unité **cachée** — le moteur vérifie l'arrivée avant d'interrompre — fait attendre l'unité sur place au lieu de fermer le tour (`jouerTour`, `ResultatTour.contournes`). `verifier:campagne` reste 6/6. **Le soir même, le moteur a été corrigé** (`04-gameplay.md` §10, `tests/engine/embuscade.test.ts`) : une arrivée sur une unité cachée n'est plus refusée mais **interrompue sur la dernière case libre** ; le contournement reste écrit, pour tout refus que l'IA ne saurait prévoir, et n'a plus rien à contourner dans ce cas.
4. **Mesuré** (20 parties, graine 1) : plaine inchangée aux points près (35/65 → 40/60, `limite_journees` 5, médiane 28 → 27,5, identique en catalogues 4 et 6) ; archipel des Deux Rades 90/10 → 80/20, barges 175 → 46, transports d'assaut 200 → 53, drones 347 → 55, bombardiers 0 → 106, cuirassés 2 → 18, mais **toujours au chronomètre** (20 parties sur 20) : les deux îles saturent d'unités et personne ne débarque en force ; bras de mer 30/70 → 60/40. Ce qui manque est la coordination de groupe — un débarquement à deux unités meurt —, que cette IA gloutonne par unité n'a pas. Non fait : la chasse au sous-marin (sans mémoire de la dernière position vue, une unité cachée n'existe pas pour l'IA), `fusionner`, l'usage tactique du drone et du brouilleur.

**Mise à jour du 10 septembre 2026 (soir) — l'IA juge chaque famille de pouvoir, et lit la faiblesse adverse.** Le matin, `ai/pouvoirs.ts` ne savait valoriser qu'un soin : mesuré sur `plaine.json` (20 parties, graine 1, catalogue 6, pondérée contre pondérée), Ariane battait Tomas, Noémie, Awa et Devika de 95 à 100 %, quand ces kits entre eux se valaient. Trois changements, tous dans `ai/`, sans toucher au moteur ni au contrat `Strategie`.

1. **Une valeur par famille, une seule monnaie : le fonds** (`valeurPouvoir`, `detailPouvoir`). Rien n'est recopié des règles : le pouvoir est appliqué sur une **copie** de l'état par `appliquerPouvoir` du moteur, sans toucher à la jauge (`etatApresPouvoir`), et chaque terme est une **différence** entre l'avant et l'après — donc exactement zéro quand la famille ne change rien. `soin` et `degats_directs` : PV affichés × coût/10 ; `ravitailler` : manque comblé, ramené à la valeur de l'unité (`PART_RAVITAILLEMENT`) ; `fonds` : revenus des journées couvertes (`revenuParTour`), et rien pour `ce_tour`/`tour_complet`, qu'`ouvrirTour` expire avant de verser ; `prix` : fonds épargnés sur l'achat le plus cher que la caisse paie (`economiesAchat`) ; `vision` : part de vue gagnée ou ôtée (`visionUnite`), sous brouillard seulement ; `meteo` : la mobilité — nombre de cases atteignables par `portee` — que la météo imposée ôte à chaque camp, signée, autant de journées qu'elle dure ; `carburant` adverse : les appareils poussés sous `TOURS_PANNE` tours d'autonomie (`consommationEffective`). Tout le reste — `attaque`, `defense`, `chance`, `etoiles`, `mouvement`, `capture`, `reactiver`, et la tempête sur le tir indirect — passe par **`gainUnite`** : ce qu'une unité peut faire de mieux ce tour, rejoué par `prevoirDuel`, `portee`, `peutCapturerIci` et `pointsGagnes` sur les deux états (meilleur duel net avec prime de mise hors jeu, meilleure capture en journées de revenu, ravitaillement atteint). Une famille qui protège se juge aussi sur ce que l'adversaire connu pourra faire de mieux à son tour — lu **sans riposte** (`LectureGain.net`), sans quoi un dégât direct paraîtrait un cadeau, l'adversaire entamé ayant moins à perdre — et sur ce qui lui survivra du pouvoir (`pouvoirPourTourAdverse` : ni les `ce_tour`, ni ce qui ne change que mes unités). Le modificateur `portee` vaut zéro : le moteur ne le lit nulle part (`peutViser` lit `ta.portee`), c'est un manque du moteur, pas de l'IA.
2. **Le déclenchement** (`decisionPouvoir`) : un seuil unique par barre, `SEUIL_PAR_BARRE` (600 fonds — une barre est dix PV infligés, à peu près une infanterie). Le **normal** se juge au début du tour et part au-dessus de `600 × barres`, sinon la jauge attend. Le **super** se juge à chaque action dès qu'il est payable — c'est-à-dire jauge pleine, puisqu'elle plafonne à son coût — et part au-dessus du seuil ; sinon, la jauge ne pouvant plus monter, il part au **début du tour** s'il vaut quelque chose, ou à la **dernière occasion** (plus rien de prêt) quand sa valeur n'y vient qu'en fin de tour, comme une réactivation. Un super qui ne change rien est gardé. « Pleine depuis un tour » n'a pas de mémoire dans l'état : « pleine au début du tour » en est le témoin.
3. **L'orientation des achats** (`ai/orientation.ts`, borné, sans un nom d'unité). La **faiblesse adverse** (`doc/04` §7.3) : le moteur ne porte pas l'axe mais le chiffre — `CommandantMoteur.faiblesse` — et son filtre dit quels types adverses frappent, se défendent ou marchent moins ; `meilleureProduction` multiplie le score d'un achat par `1 + FAIBLESSE_ACHAT (0,3) × ampleur × dégâts moyens contre ces types / 100`. Une faiblesse qui ne nomme aucun type (revenus, toute l'armée, un terrain) n'oriente rien. Le **kit propre** oriente de même vers les types que ses pouvoirs nomment sur `mes_unites` (`KIT_ACHAT`, 0,3) : Ren, dont le super ne réactive que les pièces de portée, n'avait pas de super tant que son camp n'achetait pas d'artillerie. Les deux se composent, chacun plafonné.

Les mesures, les crans d'équilibrage et ce qui reste sont dans `doc/refonte/pouvoirs-v4.md` §6, « Mesures IA — 10 septembre 2026 ».

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

### 3.4 `render/` — le socle de rendu, et `render3d/` — la peau

```
render/                       le socle, sans une ligne de three.js
├─ rendu.ts        l'interface `Rendu` : tout ce que le jeu attend d'une peau
├─ jeu.ts          monte une partie : moteur, IA, peau, HUD, sauvegarde locale
├─ boucle.ts       rAF paresseux, horloge, file d'animations
├─ entrees.ts      souris, tactile, clavier ; gestes bruts
├─ controleur.ts   la machine d'interaction : sélection, visée, ordres
├─ hud-html.ts     le HUD, en DOM au-dessus du canvas
├─ ambiance.ts     paramètres dérivés de (saison, phase, meteo)
├─ surbrillance.ts le vocabulaire des cinq genres de case allumée
├─ libelles.ts     noms d'unités, de terrains, de commandants, de saisons
├─ chemin.ts       longueur d'un chemin et position le long de ce chemin
├─ dialogues.ts    les scènes de commandant déclenchées par les événements
├─ palettes.ts     palettes de nation et de camp
├─ sprites/        formes et silhouettes — la vignette d'unité du HUD, rien de plus
└─ apercu/         rastériseur PNG autonome, pour la relecture des cartes

render3d/                     la seule peau (`10-rendu-3d.md`)
```

**Révision du 5 septembre 2026, nuit.** Ce dossier s'appelait « le canvas » et portait un rendu vectoriel complet — `scene.ts`, `camera.ts`, un cache de sprites, un HUD dessiné au canvas. Celui-ci a été **supprimé** ; il n'en reste que ce qui ne dépendait pas de la façon de peindre. Le nom de la couche s'entend donc désormais comme « ce que le jeu sait du rendu », par opposition à `render3d/`, qui sait comment on rend. La règle d'import n'a pas changé et c'est elle qui découpe : `render3d/` peut importer `render/`, **jamais l'inverse** (§5).

Le rendu **consomme** un `EtatPartie` et une file d'`EvenementJeu` renvoyés par le moteur. Il n'a aucune autorité : quand le joueur clique, le contrôleur construit une `Action`, la passe à `appliquer`, reçoit un nouvel état et une liste d'événements, puis joue les animations correspondantes. Pendant qu'une animation joue, l'état logique est **déjà** le nouveau ; l'animation n'est qu'un rattrapage visuel, et si on la coupe la partie reste juste. Cela évite toute la classe de bugs « l'état dépend de l'animation ».

Corollaire appris à l'usage : **le rendu ne reconstruit jamais ce que le moteur sait**. L'événement `deplacement` a porté longtemps le seul couple départ/arrivée, et chaque peau s'inventait un trajet — en L d'un côté, en ligne droite de l'autre —, qui traversait allègrement les montagnes et les unités adverses. Il porte désormais le **chemin validé** (`03-schemas.md`, `EvenementJeu`).

**L'ambiance.** `ambiance = f(saison, phase, meteo)` : une fonction **pure**, qui ne lit rien d'autre que `EtatPartie.climat` (`03-schemas.md` §13). Elle vit dans `render/` parce qu'elle ne dépend pas de la peau : c'est un jeu de paramètres — température de lumière, densité de particules, teinte du sol, écume — que `render3d/eclairage.ts` traduit en soleil, en brouillard de scène et en variantes de matières (`10-rendu-3d.md` §5). **L'ambiance est purement cosmétique** : aucune règle n'en dépend, et une partie jouée sans elle est exactement la même partie.

**Les silhouettes.** Une unité nouvelle (`03-schemas.md` §3) n'apporte **aucun dessin** : elle apporte une `Silhouette` déclarative, et `render3d/pieces.ts` la **compose** — `base` (chenilles, roues, pattes, coque, rotor, ailes, rail), puis `corps` (bloc, capsule, plateau), puis les `modules` (trois au plus) posés à des **ancres fixes** du corps, à l'échelle donnée par `taille`. Les unités canon sont elles-mêmes définies comme des silhouettes (`04-gameplay.md` §3), ce qui garantit que le composeur est exercé par le contenu existant et pas seulement par les nouveautés. Une unité homologuée est donc jouable le jour même, bien avant qu'un modèle ne soit livré.

Le même composeur sert de **placeholder** tant qu'aucun `.glb` n'est arrivé, et le remplacement est un changement de fichier, jamais de code (`11-assets-spec.md`). Trois bases — `coque`, `ailes`, `rail` — sont écrites et **qu'aucune unité du canon ne porte** : elles ne se voient que depuis le banc d'essai de l'atelier.

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
| `countries` | `id`, `code` (ISO 3166-1 alpha-2), `donnees` jsonb (`Country`), `statut`, `version`, `source` | Les 24 nations y sont, même celles écrites à la main (copie miroir du `content/` pour que les routines lisent une seule source). |
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
│  ├─ render/                     # §3.4 — le socle : interface `Rendu`, boucle, entrées, contrôleur, HUD HTML, ambiance, libellés, rastérisation PNG d'aperçu
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
├─ e2e/                           # le test de fumée Playwright 3D, sur le port 3400
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

**4. Test de fumée Playwright** (`e2e/fumee-3d.spec.ts`). Un seul scénario, court, qui doit toujours passer : charger une mission, attendre que le plateau soit peint, sélectionner une unité, la déplacer, finir le tour, vérifier que le HUD a suivi. Il porte ses **propres drapeaux SwiftShader** — une machine d'intégration n'a pas de carte graphique, et sans eux WebGL 2 ne répond pas. Complété par un contrôle d'absence d'erreur console. Il y en avait deux jusqu'au 5 septembre au soir ; celui du rendu vectoriel est parti avec lui.

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
