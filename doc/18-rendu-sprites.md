# 18 — Le rendu en sprites précalculés

Décision du propriétaire du 23 septembre 2026 (`BRIEF.md`, « Sprites précalculés »). Ce document est **propriétaire du rendu 2D** ; `doc/10-rendu-3d.md` reste celui des modèles (matières, silhouettes, gabarits) et de la 3D tant qu'elle est gardée derrière `?rendu=3d`. Le contrat exécutable est `src/render2d/contrat.ts` : quand ce document et lui divergent, c'est le contrat qui a raison, et ce document qui se corrige.

## 1. Pourquoi

La 3D temps réel se battait contre le genre : bâtiments rendus translucides pour qu'on voie les unités, clic sous les ponts, surbrillances qui épousaient le relief, une dizaine de passes de performance en dix jours, WebGPU exigé sans repli, et un téléphone jamais mesuré. La grammaire d'Advance Wars — vue fixe, silhouettes nettes, rien ne cache rien — est une grammaire 2D. Les modèles, eux, sont bons à garder : ils deviennent la source d'images calculées une fois, hors du jeu, avec ce qu'un téléphone ne peut pas se payer en temps réel.

## 2. La caméra unique

Orthographique, lacet fixe, **tangage 50°** (`TANGAGE_CARTE`), **128 pixels par case** (`PIXELS_PAR_CASE`), une case valant un mètre. `versPlan(x, y, h)` envoie un point du monde dans le **plan** — l'image de la carte à l'échelle 1 — et c'est exactement la caméra de cuisson : un pixel d'image cuite vaut un pixel de plan. La caméra du jeu ne fait que déplacer et agrandir le plan.

Une case fait donc 128 × 98 pixels de plan : plus large que haute, et le visage d'un fantassin comme la façade d'une ville se voient.

## 3. La cuisson (`scripts/sprites/`, `npm run cuire:sprites`)

- Blender 5.1 en ligne de commande importe chaque GLB avec ses PNG, le met à l'échelle du jeu, et le rend au **suréchantillonnage 4** puis réduit.
- **Vues** (`VUES`, `LACET_VUE`) : une unité en `droite`, `bas`, `haut` (la gauche est `droite` retournée) et `profil` pour l'écran de combat ; un bâtiment ou un décor en `fixe`, un pont aussi en `travers`.
- **Clips** : ceux du GLB, échantillonnés à 12 images par seconde. Aucun clip n'est inventé.
- **Éclairage** (`ECLAIRAGE_CUISSON`) : principale depuis l'avant-gauche, contour depuis l'arrière, ciel. L'ombre d'un bâtiment ou d'un décor est dans son image ; celle d'une unité **ne l'est pas** (`OMBRE_UNITE`, posée par le rendu).
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
