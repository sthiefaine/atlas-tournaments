# Prompts Meshy — le premier vrai modèle (7 septembre 2026, nuit)

Quatre assets que le jeu utilise le plus, chacun dérivé de sa spécification dans `assets/specs/` (c'est elle qui fait foi : échelle, pivot, budget, textures, interdits — `doc/11-assets-spec.md`). Les prompts sont en anglais, Meshy y répond mieux ; ils tiennent sous les 600 caractères du champ.

**Le truc du masque d'équipe.** Meshy ne livre pas de masque. On lui demande de peindre les zones d'équipe en **magenta plat `#ff00ff`**, une couleur qui n'existe nulle part ailleurs sur le modèle ; le masque (blanc = équipe, noir = neutre) s'en déduit en une passe de seuil sur l'albédo, et l'albédo lui-même se corrige en gris neutre sur ces zones. Sans cela, un bâtiment capturé ne changerait pas de couleur.

**Réglages communs** : art style *Realistic*, PBR on (albédo, normale, rugosité, métal), symétrie *auto* pour les bâtiments et *off* pour l'infanterie, topologie triangles, polycount cible = le `budget.lod0` de la spec, puis deux *remesh* pour LOD1 et LOD2. Export **GLB**. Jamais de texte, de logo ni de drapeau : le validateur ne les voit pas, c'est une relecture à l'œil.

**Ordre conseillé** : la ville d'abord (statique, sans squelette, et 246 bâtiments dépendent du même pipeline), puis le QG, puis l'infanterie (elle exige six clips nommés), et l'herbe en dernier — pour elle, Meshy n'est pas le bon outil.

## 1. Ville d'Île-de-France — `batiment_ville_fr_ile_de_france` (LOD0 5 000, 0,85 × 0,70 × 0,85 m)

Prompt :

```
Small European town block for a top-down turn-based strategy game, on a square plot: three low buildings of two to three storeys around a paved courtyard, mansard slate roofs with dormers, blond dry-laid stone walls, shuttered windows, dark green ironwork, a café terrace canopy, planters, a bicycle rack, a small bandstand kiosk, a worn stone bench, a blank timber signboard. Awnings and one courtyard banner in flat bright magenta. Stylised realism, diorama miniature, simple readable volumes, one open flat side. No text, no logos, no flags, no people.
```

Negative prompt : `text, letters, numbers, logos, flags, emblems, people, damage, ruins, dirt, clutter, floating parts, thin spikes`

Texture prompt : `PBR materials: split slate roof #4a5058, blond ashlar stone #d8cdb4 brushed in one direction, dark green painted iron, warm wood café canopy, flat magenta #ff00ff on awnings and banner, warm emissive windows, no baked shadows, no text`

## 2. QG d'Île-de-France — `batiment_qg_fr_ile_de_france` (LOD0 6 500, 0,85 × 0,95 × 0,85 m)

```
Team headquarters pavilion for a top-down strategy game, on a square plot: a two-storey timber and glass building with a deep overhanging mansard slate roof, an open first-floor balcony, a broad entrance canopy, a tall bare flagpole with a plain unmarked pennant, blond stone base, dark green ironwork, a small bandstand kiosk and a worn stone bench beside it. Roof edge, canopy and pennant in flat bright magenta. Taller and warmer than a town house, the most distinctive building on the board. Stylised realism, diorama miniature, clean volumes. No text, no logos, no emblems, no people.
```

Negative prompt : le même que la ville. Texture prompt : le même, plus `warm glazing on the balcony, emissive interior light`.

## 3. Infanterie, géométrie de base — `unite_infanterie_base` (LOD0 4 000, 0,45 × 0,60 × 0,45 m)

```
Two stocky athlete figures walking side by side on one shared oval base, sports-tournament infantry: padded team jersey, light chest plastron, knee guards, soft field cap, a paint-marker launcher slung low across the body. Big heads, broad shoulders, short limbs, nothing thinner than two centimetres, visible friendly faces. Plastron, shoulder panels and cap band in flat bright magenta, everything else neutral grey and muted colours. Stylised realism, toy-figure look, clean simple volumes readable from above. No text, no insignia, no real weapon, no blood.
```

Negative prompt : `text, insignia, flags, realistic firearm, blood, wounds, thin straps, loose hair, floating parts, ground plane`

Après le maillage : *Animate* dans Meshy (rig humanoïde), exporter au moins une marche et une pose de repos, puis dans Blender **renommer les clips** `repos`, `deplacement`, `tir`, `touche`, `hors_jeu`, `capture` (la spec les exige tous les six, `controler:asset` refuse sans). Pour un premier regard, un GLB sans clips se dépose quand même : le chargeur le pose et joue son repli, le contrôle dit seulement `refusé`.

## 4. Hautes herbes — `terrain_herbe_haute` : pas Meshy

Le sol est peint par un mélange de **textures** tuilables (albédo, normale, rugosité, 1024 px, sans ombre cuite), pas par un maillage : `terrain.ts` ne charge aucun GLB de terrain. Un générateur de textures (ou Meshy *text-to-texture* sur un plan) est le bon outil :

```
Seamless tileable top-down texture of dense tall wild grass, muted green blades with dry blond tips, slight clumping, no flowers, no objects, no shadows baked in, PBR set: albedo, normal, roughness, 1024 px
```

## La boucle après téléchargement

```bash
npm run controler:asset -- --spec assets/specs/batiment_ville_fr_ile_de_france.json --glb ~/Downloads/batiment_ville_fr_ile_de_france_lod0.glb
```

Le verdict dit ce qui cloche (`asset_echelle`, `asset_budget`, `asset_masque`…) et avec quels chiffres : c'est la consigne du run suivant. Accepté ou pour un simple regard, le fichier se dépose dans `public/assets/modeles/<id>_lod0.glb` (`_lod1`, `_lod2` s'ils existent) ; la vitrine `/atelier/unites` et le banc `/atelier` le montrent à la place du placeholder. Un modèle qui porte un symbole réel n'est pas corrigé, il est rejeté.
