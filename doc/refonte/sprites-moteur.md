# La peau 2D — notes du moteur (23 septembre 2026)

> **Complété par les lots suivants, même jour** : la bascule a fait de la 2D la seule peau (`sprites-bascule.md`) ; les réglages ont ajouté `aplats?` aux encarts, chargé les masques d'équipe en un canal, borné les mipmaps au niveau 2, pondéré l'émission et exposé `images` dans `mesurer()` (`sprites-reglages.md`). `?rendu=2d` n'est plus nécessaire.

Lot C du plan `doc/refonte/plan-sprites-campagne.md` : `creerRendu2d` tient toute l'interface `Rendu` derrière `?rendu=2d`. Le contrat partagé avec la cuisson et le terrain est `src/render2d/contrat.ts` ; la conception, `doc/18-rendu-sprites.md`. Ce document dit **comment le moteur est fait** et **ce que la seconde vague doit savoir** ; il ne remplace aucun des deux.

## Les fichiers

| Fichier | Ce qu'il fait | Pur ? |
|---|---|---|
| `index.ts` | `creerRendu2d`, `moteur2dDisponible`, la composition d'une image, la boucle, les mesures, les encarts | non |
| `gl.ts` | la toile, le contexte WebGL 2 (`antialias:false`, `alpha:false`), la densité plafonnée à 2, la mesure par la boîte de **mise en page**, la perte de contexte, la compilation | non |
| `camera.ts` | la caméra 2D : déplacer, agrandir, inertie, bornes, cadrages, vue retenue, conversions | oui |
| `gestes.ts` | pointeur, doigts, molette, clavier ; refus des gestes de page de Safari | non (testé sur un `EventTarget`) |
| `lot.ts` | l'ordre de peinture, le rangement des instances, l'unique programme d'images | `empaqueter`, `ordonner` : oui |
| `aplats.ts` | le second programme : triangles de couleur (fond, surbrillances, voile) | `Trace` : oui |
| `atlas.ts` | le manifeste (refus net), les pages à la demande, les replis rangés en étagères | oui, à doublures près |
| `replis.ts` | les images peintes par le code quand une image cuite manque | presque (une toile) |
| `unites.ts` | les poses des unités, l'état visuel des animations | oui |
| `batiments.ts` | les poses des bâtiments, pavillons, fanions, marques | oui |
| `surbrillances.ts` | fond, cases allumées, flèche (tirets si aveugle), curseur, anneau, voile | oui |
| `animations.ts` | l'interprète de la partition : un exécutant par genre | oui, sur une boucle à horloge injectée |

Deux programmes GL en tout (images, aplats) ; le sol a les siens. Aucun import de `three` ni de `render3d/` (`tests/render2d/frontiere.test.ts`).

## Une image

Dans l'ordre de `ORDRE_CALQUES` : le **fond** (une couleur par case lue dans la palette d'ambiance, noire sous le brouillard — le plateau reste lisible tant que le sol ne dessine rien), puis `sol.dessiner(ctx)`, puis les **surbrillances** (aplats), puis les **volumes** (bâtiments, mâts, drapeaux, décor du sol, triés par ligne puis colonne), le **voile** d'ambiance, les **ombres des unités**, les **unités** avec pastilles et marques, les effets. Toutes les images de l'image sont rangées **une fois** (`LotSprites.preparer`, un seul téléversement), puis dessinées calque par calque.

**Contrat d'état GL avec le sol.** Avant `sol.dessiner`, le moteur a posé : cadre de rendu = tout le tampon, `BLEND` en `ONE, ONE_MINUS_SRC_ALPHA` (alpha prémultiplié), ni profondeur ni ciseaux. Le sol peut changer programme, VAO, textures, mélange : le moteur reprend son état après lui. Une exception levée par le sol le met **hors service** pour la partie (une erreur en console), le jeu continue sur le fond.

**La boucle** (`render/boucle.ts`) dort quand rien ne bouge. 60 images par seconde tant qu'une animation, une inertie, une transition de caméra, un encart ou `sol.enMouvement()` le demandent ; **12 par seconde** (le pas de l'ambiance, la cadence de cuisson) tant qu'un repos cuit s'anime, qu'un bâtiment cuit s'anime ou que l'anneau de sélection bat ; rien sinon.

## Ce que la seconde vague utilise

### Agent « animations » — `animations.ts`

- **`EXECUTANTS`** : `{ [genre]?: (geste, ctx) => Corps | null }`. Remplir la table suffit ; `animationsDePartition` et `animationDatee` n'ont pas à changer. Un genre absent ne joue rien et ne retient personne. Posés : `glisser`, `tirer`, `encaisser`, `sortir`, `apparaitre`, `voiler`, `devoiler`, `reveiller`, `surprise`, `hisser`, `embarquer`, `debarquer`, `fusionner`, `repousser`, `cadrer`, `pouvoir` (son seul). Vides : `batir`, `remettre`, `ravitailler`, `reparer`, `frapper`, `designer`, `sceller` ; `duel`, `chiffre` et le splash de `pouvoir` sont au HUD.
- **`Corps`** : `avancer(p)` (0 → 1), `attente()` avant le départ, `terminer()` qui pose l'**état final exact** (appelé aussi par `couper`), `son` joué au départ si la case est vue.
- **`ContexteAnimation2d`** : `visuels` (les états visuels et les unités retenues), `etats()` (courant et précédent, à lire **quand le geste part**), `catalogue()`, `cadrer(case)`, `drapeau(cleCase)` → `PriseDrapeau2d { poseDans(etat), forcer(pose), relacher() }`, `audio`, `visible(case)`, `temps()` (horloge de rendu), `salir()`.
- **`EtatVisuel2d`** (`unites.ts`) : `dx`, `dy` (décalage au sol, en cases), `dh` (hauteur), `orientation` (`droite | gauche | bas | haut`, `null` = repos par camp), `clip` + `clipDebut` (un clip qui ne boucle pas se lit depuis là), `opacite` (multiplicateur), `eclat` (0..1, vers le blanc), `echelle`, `pv` (PV retenus), `voile` (furtivité en fondu).
- **`Visuels`** : `visuel(id)` (créé neutre), `lire(id)`, `retenir(unite)` (une **copie**, dessinée même hors de l'état ou dans une cale), `retenue(id)`, `poserRetenue(id, case)`, `liberer(id)`. Le décalage d'un glissement se compte depuis la case **dessinée** — celle d'une unité retenue si elle l'est.
- **Les effets** (calque `effets`) : rien n'y est encore posé. Le plus simple est de donner au contexte une liste d'`InstanceSprite` que `collecterPoses` ajoute sous `poser('effets', …)`, avec des replis de forme (`FORMES`, `replis.ts`) tant que la cuisson n'a pas d'effets.

### Agent « écran de combat » — l'**encart**

`creerRendu2d` rend un `Rendu2d` : l'interface `Rendu` plus **`ouvrirEncart(encart) → fermer`**. Un `EncartSprites` est une petite scène dessinée **dans la toile**, au rectangle d'un élément HTML (`hote`, transparent par-dessus) : sa propre caméra (`camera: { cx, cy, zoom }`, en pixels de son plan), un fond facultatif, `poses(tempsMs)` relues à chaque image (calque, ligne, colonne, `InstanceSprite`), `enMouvement()` pour garder 60 images par seconde. Il partage le lot, l'atlas et les replis. `ouvrirCombat(hote, geste)` s'écrit donc en quelques lignes : poser un encart sur `hote`, choisir la vue `profil` des entrées (`atlas.animation(id, 'profil', clip)`), rendre `{ avancer, fermer }`.

### L'atlas, pour tous

`Atlas.resoudre(instance)` rend l'image à poser — cuite si sa page est là, sinon son **repli**, et la page est demandée une fois ; `animation(id, vue, clip)` → index ou `-1` ; `idPour(famille, cle, variante, parDefaut)` → le kit national s'il est cuit, sinon la base ; `entree(id)`. Une instance d'`animation: -1` se dessine en repli. Les replis se lisent sur l'identifiant (`identiteRepli`) : `unite_<cle>_<suffixe>`, `batiment_<cle>_<suffixe>`, `decor_<essence>_<saison>_<n>`, `decor_rocher…`, et les formes du rendu (`FORMES` : ombre, mât, drapeau, pastilles de PV, marques).

## Ce que le moteur attend des autres lots

- **Terrain** (`./sol`) : `creerSol(gl, etat, { biome, reduit, manifeste })` au premier `afficher`, **recréé une fois** quand le manifeste arrive ; `maj(etat, vue, brouillard)` à chaque `afficher` (le brouillard est toujours un `Uint8Array`, tout à 255 sans brouillard) ; `volumes()` à chaque image — un tableau **stable** tant que rien ne change évite de le réenvelopper ; les ids de `volumes()` suivent `idDecor`, et un id absent du manifeste est dessiné en repli par le moteur. Le mode tactique retire du calque les essences de végétation (`feuillu`, `conifere`, `palmier`, `tropical`, `buisson`, `touffe`, `roseau`), jamais le relief, les rochers ni les ponts. **Ajout proposé au contrat** : `CoucheSol.ambiant?(): boolean` — vrai si le sol veut l'horloge au repos (l'eau) ; le moteur lui donnerait alors le pas de l'ambiance.
- **Cuisson** : un manifeste de `VERSION_SPRITES`, `tangage` = `TANGAGE_CARTE` (sinon refus net), des pages sous `public/` sans barre initiale ; un masque en niveaux de gris opaque ; les unités dans les vues `droite`, `bas`, `haut` (la gauche est retournée par le moteur), les bâtiments en `fixe`. Un kit national porte `variante` (le code pays) ; un bâtiment national peut aussi suivre le nom `idBatiment(cle, pays)`.

## Ce qui est vérifié, et ce qui ne l'est pas

Rien n'a été regardé à l'écran (consigne). Par du code :

- 96 tests unitaires (`tests/render2d/*.test.ts` hors `sol/`, plus `tests/frontieres.test.ts`) : caméra, lot, atlas et manifeste, replis, poses des unités et des bâtiments, surbrillances, gestes, interprète de la partition, frontière three.
- `e2e/rendu-2d.spec.ts`, **vert sous Chromium et sous WebKit** (Playwright 1.63, macOS) sur `/jeu/premier_contact?rendu=2d` : `data-rendu="2d"`, image non uniforme, un char sélectionné puis déplacé de quatre cases par des clics placés avec `versEcran`, `positionUnite` qui passe par des points intermédiaires, aucune erreur de console (seul le 404 du manifeste absent est toléré, et seulement s'il manque sur le disque). **Témoins** : sans `?rendu=2d` (`E2E_TEMOIN=3d`) le spec tombe sur `data-rendu` ; sous animations réduites (`E2E_TEMOIN=mouvement`) il tombe sur le glissement — les échantillons sautent de 2,5 à 6,5.
- Chromium passe par `--use-angle=metal` sur macOS : le rasteriseur logiciel par défaut, sur une machine à 300–600 de charge, mettait **885 ms** d'une image à l'autre (contre **16,6** avec Metal) et le spec ne mesurait plus que la machine. La peau elle-même coûte 0,3 à 0,8 ms de processeur par image.
- La route 2D ne télécharge **aucun** morceau de three ni de `render3d/` (relevé réseau sous le serveur de développement : aucun nom de morceau ne les porte ; la 3D en tire cinq).

Ne sont **pas** mesurés : la lisibilité des replis, la justesse du pivot des images cuites (aucune n'existait au moment d'écrire, ni `createImageBitmap` sur une vraie page), la cadence réelle sur téléphone, la perte et la restauration de contexte, l'encart.
