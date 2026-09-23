# L'IA en fond — le tour de l'adversaire hors du fil principal (23 septembre 2026)

Demande du propriétaire : « optimiser le jeu ». Le constat de départ, vérifié dans le code : **l'IA jouait sur le fil principal**. `tourAdversaire` (`src/render/jeu.ts`) appelait l'adversaire de la page (`adversaireIa`, `src/app/jeu/adversaire.ts`), donc `jouerTour` d'`src/ai/`, d'un bloc et de façon synchrone : pendant que l'IA réfléchissait — et elle évalue ses pouvoirs en les appliquant à des copies de l'état —, rien ne se dessinait et rien ne répondait au doigt.

Ce document dit ce qui a changé, pourquoi aucune action jouée ne change, un défaut du moteur trouvé en chemin, ce que la mesure a dit de la durée du gel, et ce qui reste non vérifié. Les tests sont dans `tests/jeu/`, la mesure dans `scripts/mesurer-ia.ts`.

## 1. Ce qui change

- **`src/app/jeu/ia.worker.ts`** est le point d'entrée d'un Web Worker. Il ne réimplémente rien : il appelle `adversaireIa`, avec les paramètres de la page, sur la copie de l'état qu'il reçoit.
- **`src/app/jeu/adversaire-fond.ts`**, `creerAdversaireEnFond(...)` — mêmes paramètres qu'`adversaireIa`, plus des options de test — rend `{ adversaire, mode, raisonRepli, fermer }`. Un seul worker par partie, lancé à la création pour qu'il charge son paquet pendant le premier tour du joueur, arrêté par `fermer()`.
- **`src/render/jeu.ts`** : le type devient `Adversaire = (etat) => Action[] | Promise<Action[]>`, et les deux appels de `tourAdversaire` l'attendent. Rien d'autre ne bouge dans l'ordonnancement — pauses, scènes de dialogue, coupure d'une partition. Un adversaire synchrone est joué **sans détour par une promesse** : le premier ordre part dans le même tour d'horloge qu'avant.
- **Le branchement dans `toile.tsx`** n'est pas fait ici (un autre chantier tient ce fichier) : c'est le remplacement du §7.

## 2. Le protocole

Quatre messages. Le worker dit `pret` dès que son code est évalué ; **la page n'envoie rien avant** — un paquet dont les morceaux se chargent encore n'a pas d'écouteur, et un message arrivé trop tôt se perdrait sans bruit. La page envoie `configurer` une fois (stratégie, version du catalogue, commandants, stratégies par camp), puis un `tour` par demande, numéroté ; le worker répond `tour` avec les actions, ou `erreur`.

**Le repli sur le fil principal**, définitif pour la partie : le worker est arrêté, les demandes en cours sont rendues par l'IA du fil principal dans l'ordre, et les suivantes y restent. Il se déclenche quand :

| Raison | Cas |
|---|---|
| `sans_worker` | pas de `Worker` dans ce navigateur (ni sous Node) ; l'IA joue alors comme avant, synchrone |
| `creation` | `new Worker(...)` lève (politique de sécurité, paquet refusé) |
| `erreur` | le worker lève (`error`) ou répond `erreur` |
| `message_illisible` | `messageerror`, ou une réponse sans tableau d'actions |
| `envoi` | l'état ne se clone pas à l'envoi |
| `demarrage` | pas de `pret` `MS_DEMARRAGE_IA` (10 s) après la **première demande** — pas après la création : un réseau lent n'est pas une panne tant que personne n'attend |
| `silence` | un tour attend et le worker se tait `MS_SILENCE_IA` (30 s) ; le chien de garde se réarme à chaque réponse, il mesure le silence et non la durée d'un tour |

**Une réponse périmée est ignorée** : celle d'une demande déjà rendue par le repli, en double, d'un numéro inconnu, ou arrivée après `fermer()` — qui rend une suite vide aux demandes en cours, arrête le worker, et est idempotent. Une partie **recommencée** pendant que l'IA réfléchit est l'affaire du chef d'orchestre : `suiteAdversaire` compare l'état demandé à l'état courant, jette une suite calculée pour un autre état et la redemande pour l'état courant tant que c'est encore à l'adversaire. Ce cas n'existait pas quand l'IA gelait la page — le bouton ne pouvait pas répondre pendant qu'elle réfléchissait.

**Le paquet.** L'expression `new Worker(new URL('./ia.worker.ts', import.meta.url), { type: 'module', name: 'atlas-ia' })` est écrite en toutes lettres : c'est elle que les empaqueteurs reconnaissent. Ce que les deux constructions ont réellement produit est au §6.

## 3. Pourquoi aucune action ne change

- **L'état est du JSON pur** (`EtatPartie`, `engine/types.ts`) : ni `Map`, ni `Set`, ni classe, ni fonction. Le clonage structuré le rend au bit près, champs `undefined` compris — ce que `JSON.parse(JSON.stringify(...))` ne ferait pas. Un test parcourt un état réel et le vérifie.
- **Le flux d'aléa ne voyage pas en objet** : `adversaireIa` recrée l'arbre de flux depuis `etat.graine` et `etat.flux` (`restaurerRng`), exactement comme sur le fil principal.
- **Les mémoires du moteur et de l'IA** sont attachées à l'identité des objets (`WeakMap` sur l'état, sur la grille, sur le catalogue) ou à des signatures de contenu partagées par module. Dans le worker, elles partent froides. Elles ne font que mémoriser : sur **les 35 scénarios que comptait le canon ce jour-là, 40 journées chacun**, l'IA rend la même suite sur une copie que sur l'objet vivant — zéro écart (diagnostic du 23 septembre, graine `mesure:1`, chaque tour des deux façons). `scripts/mesurer-ia.ts` refait la comparaison à chaque tour qu'il chronomètre, et s'arrête au premier écart.
- **Vérifié par les tests** : `tests/jeu/ia-en-fond.test.ts` compare, tour d'IA par tour d'IA, la suite rendue par le protocole (faux worker du même processus, clonage structuré dans les deux sens, livraison différée, messages perdus tant que le module n'écoute pas) à celle de l'IA du fil principal — 60 tours sur sept parties réelles, quatre stratégies, les camps 1 à 3, 7 pouvoirs et 2 supers, 49 tours avec production, un embarquement. `tests/jeu/ia-thread.test.ts` refait la comparaison dans un **vrai thread** Node (`worker_threads`), dont les instances de modules ne partagent rien avec le test.

## 4. Un défaut du moteur trouvé en chemin — à corriger hors de ce lot

**L'IA du fil principal écrivait dans l'état de la partie.** `copierEtat` (`src/engine/etat.ts:83`) ne recopie pas le tableau `cargo` d'une unité quand il est vide — il est partagé entre l'état d'avant et celui d'après —, et l'embarquement y pousse le passager **en place** (`src/engine/actions.ts:273`, `transport.cargo.push(u.id)`). Quand `jouerTour` simulait sur l'état vivant un tour qui embarque dans un transport vide, le passager apparaissait dans la cale de l'état **courant de la page**, avant que la page ait joué l'ordre, sans que le passager ait quitté sa case. La page appliquait ensuite les actions de l'IA sur cet état corrompu.

Mesuré le 23 septembre (graine `mesure:1`, 40 journées, le joueur tenu par la pondérée sur une copie, l'IA sur l'objet vivant comme la page d'avant) :

- tours d'IA qui écrivent dans l'état qu'on leur donne, sur les 35 scénarios du canon : **6** sur `aube_superusine`, **4** sur `archipel_des_deux_rades`, **1** sur `aube_drone_marin`, et **1** et **3** sur `opus1_fr_10` et `opus1_fr_12`, que le chantier du jour est en train d'écrire ; aucun ailleurs ;
- `aube_superusine` : la partie vivante **diverge de son propre rejeu à la journée 19**, 7 ordres de l'IA refusés en jeu ;
- `archipel_des_deux_rades` : divergence **à la journée 13**, et le **vainqueur change** (camp 0 contre camp 1 quand l'IA calcule sur une copie).

C'est le premier invariant du projet qui tombait — « même graine, mêmes actions, même état » : la partie à l'écran n'était pas celle que la sauvegarde rejoue, et une reprise la faisait changer sous les yeux du joueur. **Le worker calcule sur une copie par nature, et la partie à l'écran redevient celle du rejeu** ; le repli fait de même (`copiePourIa`), pour que la partie ne dépende pas du fil qui a réfléchi. Les actions choisies, elles, ne changent pas : c'est l'état sur lequel la page les joue qui cesse d'être faux. Sur les scénarios où l'IA embarque, une partie jouée avec le worker n'est donc **pas** identique à celle d'avant — elle est identique à son rejeu, ce que celle d'avant n'était pas.

La correction de fond est dans le moteur, et tient en une ligne : `transport.cargo = [...transport.cargo, u.id]` au lieu du `push`, ou une copie systématique de `cargo` dans `copierEtat`. Elle ne change aucun rejeu (un rejeu ne calcule rien sur un état qu'il garde). Le même partage touche le joueur : quand il embarque dans un transport vide, l'état `avant` que reçoit la partition montre déjà le passager à bord. Le test `l'IA du fil principal écrit dans l'état qu'on lui donne…` documente le défaut ; il échouera le jour où le moteur sera corrigé, et devra partir avec lui.

## 5. Combien de temps l'écran gelait

`scripts/mesurer-ia.ts` rejoue des parties réelles du canon — scénario passé par `scenarioPourMode`, commandants par `resoudreCommandantsScenario`, le camp du joueur tenu par la pondérée — et chronomètre **exactement l'appel de la page d'avant**, `adversaireIa(...)(etat)` sur l'état vivant, tour d'IA par tour d'IA : c'est la durée du gel. `--passes N` rejoue la mesure dans N processus et garde, tour par tour, le minimum. Ce sont des millisecondes de Node sur un M1 **partagé** : la charge de la machine a varié de 6 à plus de 600 pendant la journée (autres chantiers, Blender), et elle change tout — elle est donnée avec chaque série.

**Au calme** — charge 17 à 28, minimum de trois passes, les 38 scénarios du canon, quarante journées au plus, 886 tours d'IA :

| Scénario | Tours | Médiane | p90 | Pire | Situation du pire |
|---|---|---|---|---|---|
| `aube_superusine` | 32 | 25 ms | 32 ms | **36 ms** | J25, camp 1, 49 unités, 34 actions, pouvoir |
| `aube_reserves_1v2` | 80 | 4,3 ms | 9,2 ms | 26 ms | J16, camp 2, 26 unités, 11 actions, pouvoir |
| `archipel_des_deux_rades` | 35 | 16 ms | 23 ms | 27 ms | J26, camp 1, 45 unités, 24 actions, pouvoir |
| `aube_drone_marin` | 30 | 10 ms | 16 ms | 21 ms | J15, camp 1, 28 unités, 19 actions, pouvoir |
| `aube_batteries_2v1` | 35 | 5,4 ms | 10 ms | 17 ms | J11, camp 2, 31 unités, 11 actions, pouvoir |
| `aube_nuit_2v2` | 103 | 4,6 ms | 7,8 ms | 16 ms | J8, camp 2, 35 unités, 10 actions, pouvoir |
| `aube_routes_3v1` | 42 | 3,0 ms | 6,5 ms | 9,3 ms | J5, camp 3, 36 unités, 18 actions, pouvoir |
| `opus1_fr_04` | 36 | 3,9 ms | 5,3 ms | 6,9 ms | J16, camp 2, 31 unités, 9 actions |
| `pacte_du_col` | 9 | 1,0 ms | 1,8 ms | 1,8 ms | J8, camp 1, 12 unités, 6 actions |

Tous : médiane **2,7 ms**, p90 9,9 ms, p99 28 ms, pire **36 ms**. 43 tours dépassent une image à 60 Hz (16,7 ms), aucun ne dépasse 50 ms. Les 124 tours où l'IA déclenche un pouvoir : médiane 9,1 ms, pire 36 ms.

**Ce que la charge fait aux chiffres** : la même série, sur la même machine chargée à 270–330, donne une médiane de 8,9 ms et un pire de **400 ms** — onze fois le pire au calme. Une série prise sur une machine occupée ne dit rien du jeu ; regarder `uptime` avant de conclure.

**Ce que ça veut dire.** Sur ce M1 au calme, l'IA gelait l'écran moins d'une image dans la grande majorité des tours, et deux images au pire — en fin de partie sur les grandes cartes, quand elle a quarante ou cinquante unités, une trentaine d'ordres et un pouvoir à évaluer. Un téléphone met plusieurs fois plus (**non mesuré ici**) : c'est là que le gel se sentait, et c'est là que le worker compte. Le fil principal ne paie plus que le clonage de l'état à l'envoi — médiane 0,3 ms, pire 0,6 ms, pour un état de 20 à 25 ko — et la réception de la suite. Dans le worker, le même calcul sur une copie aux mémoires froides prend le même temps que sur l'objet vivant (colonne « copie » du script) : les mémoires du moteur ne lui faisaient presque rien gagner.

Pour refaire la mesure : `npx tsx scripts/mesurer-ia.ts --tous --journees 40 --passes 3` (une minute et quart au calme).

## 6. Les constructions

Tant que `toile.tsx` n'importe pas `adversaire-fond.ts`, aucune page n'atteint le worker et aucun empaqueteur ne le construit. Les deux constructions ont donc été faites sur une **copie de l'arbre** du 23 septembre (clonée hors du dépôt), avec les cinq remplacements du §7 appliqués.

- **webpack** (`NEXT_DIST_DIR=.next-ia npx next build`) : passe, compilation, lint, typage et génération. Le worker sort en `static/chunks/atlas-ia.<empreinte>.js` (67,6 ko, 22,9 ko compressé) et charge trois morceaux par `importScripts` — 235 ko en tout, **64 ko compressés** ; deux de ces morceaux sont aussi ceux des pages de l'atelier. La page crée `new Worker(…, { type: void 0, name: "atlas-ia" })` : webpack réécrit `type: 'module'` parce que la sortie client de Next n'est pas un module, et c'est ce qu'il faut à un worker qui charge ses morceaux par `importScripts`. `/jeu/[scenario]` : 1,7 ko, 105 ko au premier chargement.
- **Turbopack** (`next build --turbopack`) : passe. Le worker est amorcé par une URL `blob:` qui appelle `importScripts` sur six morceaux — 314 ko, **88 ko compressés** —, et Turbopack ajoute `type: void 0` après nos options, ce qui en fait lui aussi un worker classique. Il publie en plus la source brute `static/media/ia.worker.<empreinte>.ts` (5,9 ko), qu'aucun code n'utilise : un reliquat de son analyse de `new URL(…)`, sans conséquence.
- Sur l'arbre partagé lui-même, sans le branchement, la compilation webpack passe (7,6 min, charge 300 à 450) et le typage échoue sur `src/content/difficulte.ts:84`, un fichier qu'un autre chantier écrit en ce moment ; la copie l'a contourné d'un `!` pour aller au bout. Le dossier `.next-ia`, `tsconfig.json` et `next-env.d.ts` ont été rendus dans l'état d'avant la construction.

`type: 'module'` reste écrit dans la source, comme demandé : aucun des deux empaqueteurs ne le laisse passer, et le commentaire de `workerDuNavigateur` le dit.

## 7. Le branchement dans `toile.tsx`

Cinq remplacements exacts, essayés sur une copie de l'arbre du 23 septembre (typage et construction du §6 passent avec eux) :

1. l'import `import { adversaireIa } from '../adversaire';` devient `import { creerAdversaireEnFond } from '../adversaire-fond';` ;
2. juste avant le `try {` qui monte le jeu, après `const catalogueJournal = …` :
   ```ts
   // L'IA réfléchit dans un Web Worker (`adversaire-fond.ts`) : le fil principal
   // ne gèle plus pendant son tour. Un seul worker par partie, arrêté au démontage.
   const enFond = creerAdversaireEnFond(ia, scenario.catalogueVersion, commandants, Object.fromEntries(joue.commandants.filter((c) => c.ia).map((c) => [c.camp, c.ia!])));
   ```
3. dans les options de `monterJeu`, `adversaire: adversaireIa(ia, …),` devient `adversaire: enFond.adversaire,` ;
4. dans le `catch` du montage, après `audio.detruire();` : `enFond.fermer();` ;
5. dans la fonction de nettoyage de l'effet, après `partie.demonter();` : `enFond.fermer();`.

Les paramètres sont ceux qu'`adversaireIa` recevait, au caractère près ; les dépendances de l'effet ne changent pas. `fermer()` vient **après** `demonter()` : la partie se sait morte avant que ses demandes en cours ne se résolvent en suite vide.

## 8. Audit court du fil principal hors rendu

Relevé en lisant la page de jeu, chiffré par `scripts/mesurer-ia.ts --audit` quand Node le permet — au calme (charge 17), sauf mention. Aucune correction n'est faite ici ; ce sont des pistes, dans l'ordre de ce qu'elles coûtent.

1. **Le rejeu d'une partie reprise — le plus gros bloc du fil principal, loin devant l'IA.** `monterJeu` rejoue toute la sauvegarde d'un bloc, avant la première image (`rejouer`, `render/jeu.ts`). Au calme : 8 à 106 ms pour une reprise à la quinzième journée (137 à 588 actions, HUD compris) ; à la fin d'une longue partie, **297 ms** pour la Forge (1 378 actions), 188 ms pour la nuit (1 404), 123 ms pour l'archipel (1 406) ; sur la machine chargée, jusqu'à 2,8 s. Le profil du rejeu de la Forge dit où : **la moitié du temps dans la vision** — `verifierChemin` → `adversesVisibles` → `unitesVues` → `casesVisibles`, ligne de vue comprise, recalculées pour chaque ordre de mouvement sous brouillard. Deux pistes : rejouer dans le worker, qui a déjà le moteur, et ne rendre que l'état ; et, dans le moteur, ne chercher l'embuscade que sur les cases du chemin au lieu de recalculer tout ce que voit le camp. Cette vision pèse aussi sur chaque ordre joué et sur chaque simulation de l'IA.
2. **Le premier son.** `creerAmbiance` synthétise douze secondes de bruit stéréo à la fréquence du contexte — 1,15 million d'échantillons à 48 kHz — sur le fil principal, au premier geste du joueur : **22 ms** sous Node ; chaque nouveau bruit d'effet en synthétise une seconde de plus. Un tampon de deux secondes en boucle, ou la synthèse dans un `AudioWorklet`, le rendraient invisible.
3. **La sauvegarde après chaque action.** `sauvegarder()` resérialise toute la liste des actions — 150 ko et **1 ms** à 1 400 actions —, et `stockage()` écrit et efface une sonde avant chaque écriture : trois écritures synchrones de `localStorage` par action, dont une qui grandit avec la partie et dont le coût réel, celui du navigateur, ne se mesure pas sous Node. Sonder une fois par page ; écrire à la fin d'un tour ou quand le navigateur est inactif.
4. **Ce que la page refait à chaque état.** `toile.tsx`, `surEtat` : la vision du joueur et le journal des rencontres (`enregistrerRencontres` relit, analyse et normalise le carnet dans `localStorage`, et le réécrit s'il y a du neuf) — 0,1 à 0,2 ms par état. Puis `setEtat` refait le rendu de tout `Toile`, qui appelle `chargerCatalogue()` en plein rendu pour les essais Aube (`objectifMission`) — **0,7 ms** à chaque fois —, alors que le composant garde déjà `catalogueKit` en mémoire. Le rendu React lui-même n'est pas mesurable ici.
5. **Trois rafraîchissements par action de l'IA.** `tourAdversaire` rafraîchit après `poserEtat`, après `attendre(true)` et après la partition : vue du contrôleur, vue du jeu — dont `pouvoirsDuJoueur`, deux `verifierPouvoir` et une prévision de pouvoir, jamais mémoïsés par état —, composition des onze emplacements du HUD. Côté JavaScript, 0,1 ms au plus chacun (un survol de case : 0,1 ms, 0,2 ms avec une unité sélectionnée). Côté DOM — écriture des emplacements changés, style, mise en page —, non mesurable sous Node. Les regrouper sur une image les diviserait par trois.

**Hors de la page de jeu** : l'attract de l'écran-titre (`src/app/attract.tsx`) joue `jouerTour` sur le fil principal, une IA contre elle-même derrière le menu. Ses deux stratégies — pondérée au camp 0, agressive au camp 1 — sont exactement ce que `creerAdversaireEnFond('ponderee', …, { 1: 'agressive' })` appellerait ; non essayé.

## 9. Non vérifié

- **Rien n'a tourné dans un navigateur.** Le worker a été construit par les deux empaqueteurs et son protocole exécuté sous Node, dans un faux worker et dans un vrai thread ; le chargement de ses morceaux par `importScripts`, l'événement `error` d'un paquet absent, et le temps de démarrage réel n'ont été vus nulle part. Un test de fumée qui joue un tour d'IA dans Chromium et WebKit le dirait (`e2e/`, Playwright ré-autorisé le 8 septembre).
- **Aucun téléphone n'a été mesuré.** Les chiffres du §5 sont des millisecondes de Node sur un M1 partagé ; le rapport à un téléphone est une estimation, pas une mesure.
- **Le premier tour de l'IA** paie désormais le chargement du worker s'il n'est pas encore prêt (au plus 64 ko compressés, en parallèle du premier tour du joueur), et la compilation à la volée de son code, qui n'est plus partagée avec la page. Non mesuré.
- **`MS_DEMARRAGE_IA` (10 s) et `MS_SILENCE_IA` (30 s)** sont des bornes de prudence, pas des mesures : un réseau très lent peut dépasser la première, et l'IA retombe alors sur le fil principal pour toute la partie.
- **Le branchement dans `toile.tsx`** reste à faire (§7) ; tant qu'il ne l'est pas, rien de ce document n'est en jeu.
