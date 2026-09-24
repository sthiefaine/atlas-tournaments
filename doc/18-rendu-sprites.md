# 18 — Le rendu en sprites précalculés

Décision du propriétaire du 23 septembre 2026 (`BRIEF.md`, « Sprites précalculés »). Ce document est **propriétaire du rendu du jeu** ; `doc/10-rendu-3d.md` n'est plus que celui des modèles (matières, silhouettes, gabarits), source des images — la 3D temps réel a été retirée le même jour (`afc34691`), et `?rendu=3d` n'est plus lu. Le contrat exécutable est `src/render2d/contrat.ts` : quand ce document et lui divergent, c'est le contrat qui a raison, et ce document qui se corrige.

## 1. Pourquoi

La 3D temps réel se battait contre le genre : bâtiments rendus translucides pour qu'on voie les unités, clic sous les ponts, surbrillances qui épousaient le relief, une dizaine de passes de performance en dix jours, WebGPU exigé sans repli, et un téléphone jamais mesuré. La grammaire d'Advance Wars — vue fixe, silhouettes nettes, rien ne cache rien — est une grammaire 2D. Les modèles, eux, sont bons à garder : ils deviennent la source d'images calculées une fois, hors du jeu, avec ce qu'un téléphone ne peut pas se payer en temps réel.

## 2. La caméra unique

Orthographique, lacet fixe, **tangage 50°** (`TANGAGE_CARTE`), **128 pixels par case** (`PIXELS_PAR_CASE`), une case valant un mètre. `versPlan(x, y, h)` envoie un point du monde dans le **plan** — l'image de la carte à l'échelle 1 — et c'est exactement la caméra de cuisson : un pixel d'image cuite vaut un pixel de plan. La caméra du jeu ne fait que déplacer et agrandir le plan.

Une case fait donc 128 × 98 pixels de plan : plus large que haute, et le visage d'un fantassin comme la façade d'une ville se voient.

## 3. La cuisson (`scripts/sprites/`, `npm run cuire:sprites`)

- Blender 5.1 en ligne de commande importe chaque GLB avec ses PNG, le met à l'échelle du jeu, et le rend au **suréchantillonnage 4** puis réduit.
- **Vues** (`VUES`, `LACET_VUE`) : une unité en `droite`, `bas`, `haut` (la gauche est `droite` retournée) et `profil` pour l'écran de combat ; un bâtiment ou un décor en `fixe`, un pont aussi en `travers`.
- **Clips** : ceux du GLB, échantillonnés à 12 images par seconde. Aucun clip n'est inventé.
- **Éclairage** (`ECLAIRAGE_CUISSON`) : principale **de face** (azimut 0, élévation 60°), contour depuis l'arrière, ciel — symétrique depuis la charte des figurines (23 septembre au soir, `doc/refonte/charte-figurines.md` §3.10) : la vue `gauche` est la `droite` retournée, et une lumière venue d'un côté y serait passée de l'autre. L'ombre d'un bâtiment ou d'un décor est dans son image ; celle d'une unité **ne l'est pas** (`OMBRE_UNITE`, posée par le rendu).
- **Contour** : un trait `#15181d` cuit autour de la couverture du modèle (12 px à l'échelle 4), par famille (`CONTOUR_PAR_FAMILLE`, lu dans `scripts/production/figurines/charte.json`).
- **Chaque image dans une scène neuve** (`VERSION_CUISSON` 4, 24 septembre 2026) : avec les données persistantes de Cycles, la première image immobile après un mouvement sortait parfois 6 à 12 % plus sombre selon l'historique des rendus ; la règle « image isolée plus sombre » de `scripts/sprites/anomalies.ts` la guette depuis.
- **Les modèles des unités** sortent de la chaîne des figurines (`scripts/production/figurines/`, un module Blender par unité, mesuré contre la charte) ; ceux des bâtiments suivent (`doc/refonte/plan-batiments.md`).
- **Masque d'équipe** : zones d'équipe cuites en blanc, masque dans une page à part ; à l'écran, `couleur × mix(1, équipe, masque)`.
- Sortie : des pages d'atlas sous `public/assets/sprites/`, et `manifeste.json` (`ManifesteSprites`) qui porte, pour chaque entrée, l'empreinte de sa source. Une source qui change se recuit.

## 4. Le rendu (`src/render2d/`)

WebGL 2, sans dépendance. Les calques se peignent dans l'ordre de `ORDRE_CALQUES` : sol (un nuanceur, `render2d/sol/`), voies, surbrillances, volumes (bâtiments et décor, triés par ligne), ombres des unités, unités (toujours au-dessus des volumes : une unité n'est jamais cachée), effets, météo, étalonnage. Tout ce qui est une image passe par **un seul lot de sprites instanciés** (`InstanceSprite`).

- Le **brouillard** reste noir (décision du 7 septembre) : une valeur par case (`niveauxBrouillard`), lue par le sol et portée par chaque instance.
- Les **saisons, phases et météos** passent par l'`Ambiance` de `render/ambiance.ts` : palette, voile, particules, villes éclairées (la page d'émission s'ajoute la nuit).
- Les **animations** jouent la partition (`render/partition.ts`), sans rien changer au réalisateur.
- La **vue fixe** retire la rotation et l'inclinaison : `tourner` et `incliner` sont absents de la peau 2D.

## 5. Ce qui n'est pas vérifié par ce document

Tout ce qui relève du goût : la lisibilité d'une unité à 48 pixels CSS par case, l'harmonie des sources de modèles une fois photographiées, la force de l'étalonnage de nuit. Le propriétaire regarde ; le code ne vérifie que ce qui se mesure.

## 6. État au soir du 23 septembre 2026

Tout ce qui précède est en place et poussé : cuisson (101 entrées, 17,9 Mo), peau 2D seule peau du jeu, de l'écran-titre, de l'atelier et du carnet, 23 gestes animés, écran de combat, météo, réglages sur les vraies images. Le détail par lot est dans `doc/refonte/sprites-*.md` (cuisson, décor, moteur, terrain, animations, combat, bascule, réglages) et `doc/refonte/retrait-3d.md`. Mesuré : `/jeu` télécharge 415 ko de JavaScript (gzip) au lieu de 713, sans three ; `premier_contact` charge 16 entrées d'images sur 101 (1,7 Mo) et coûte 0,2 à 1 ms de processeur par image. Deux chantiers ouverts : sortir la vue `profil` des pages de carte (l'écran-titre télécharge 2,2 Mo d'images) et regrouper le décor sur des pages communes.
