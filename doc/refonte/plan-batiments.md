# La vague des bâtiments — plan (24 septembre 2026)

La charte des figurines (`charte-figurines.md`, §3.12 et §6) a tranché ce que
chaque bâtiment montre ; les trente unités sont refaites. Ce document fixe ce
qui doit l'être **avant** que plusieurs agents travaillent en même temps : les
identifiants, les états, ce que fait le rendu, et ce que mesure la chaîne. Il
fait foi pour la vague ; la charte fait foi sur le dessin.

## 1. Les entrées

| Identifiant | Ce que c'est | Module |
|---|---|---|
| `batiment_ville_base`, `batiment_ville_desaffecte` | la ville, en service et endormie | `batiments/ville.py` |
| `batiment_usine_base`, `batiment_usine_desaffecte` | l'usine | `batiments/usine.py` |
| `batiment_aeroport_base`, `batiment_aeroport_desaffecte` | l'aéroport | `batiments/aeroport.py` |
| `batiment_port_base`, `batiment_port_desaffecte` | le port | `batiments/port.py` |
| `batiment_radar_base`, `batiment_radar_desaffecte` | la station radar | `batiments/radar.py` |
| `batiment_qg_base`, `batiment_qg_fr`, `batiment_qg_lu` | le QG commun et ses deux variantes nationales | `batiments/qg.py` |
| `batiment_superusine_base`, `batiment_superusine_inerte` | la superusine des Gris, active et prise | `batiments/superusine.py` |
| `terrain_pont` | le pont (vues `fixe` et `travers`) | `batiments/pont.py` |

Un QG ne se désaffecte pas. Un module déclare ce qu'il sait construire :
`ETATS = ('base', 'desaffecte')` (ou `('base', 'inerte')`), `VARIANTES =
('base', 'fr', 'lu')` pour le QG ; `construire(f, etat, variante)` et
`animer(f, etat, variante)` reçoivent ce qu'on leur demande. **Le même module
fait tous les états d'un bâtiment** : le désaffecté est le même bâtiment
endormi, jamais un autre dessin.

## 2. Ce que montre chaque état

- **En service** (`base`) : le toit entier (ou ce qui en tient lieu) en couleur
  d'équipe, 30 à 45 % de l'image ; les fenêtres s'allument la nuit (émission).
  Neutre, le rendu teint l'équipe en `#b9bec7` : le bâtiment neutre est le même,
  toit gris.
- **Désaffecté** (`desaffecte`) : le même bâtiment **endormi** — une bâche claire
  (os) sur une partie du toit, des planches (bois) en croix sur les ouvertures,
  les fenêtres éteintes (aucune émission), et le **mât couché** au sol au coin
  du mât. Jamais une ruine, jamais rien de cassé ni de noirci. Le toit reste
  sous le masque : un désaffecté est neutre, donc gris.
- **Superusine active** (`base`) : une usine plus grande (jusqu'à 1,2 case),
  plaques à facettes en apprêt, bras de montage, le toit à la couleur du camp,
  et l'**œil orange** des Gris. **Prise** (`inerte`) : le même bâtiment, l'œil
  éteint (graphite), les bras repliés.
- **Le pont** : un tablier de bois ou de pierre claire, qui se détache de
  l'herbe ; il n'a pas de couleur d'équipe.

## 3. Le coin du mât

Le rendu dessine lui-même le mât et le drapeau (`src/render2d/batiments.ts`,
`PIED_MAT`), au coin **arrière droit** de la case : `x = +0,36 m`,
`z = −0,20 m` dans le repère du modèle (la vue `fixe` regarde le joueur, +Z
vers le bas de l'écran). Aucun bâtiment ne dresse de masse à cet endroit : un
cercle de 0,08 m autour du pied reste libre au-dessus de 0,05 m. Le mât couché
du désaffecté part de ce pied.

Le drapeau fait 30 × 19 px à 128 px par case, soit 11 × 7 px à 48 px : la
charte en demande au moins 6 × 4.

## 4. Ce que fait le rendu (agent du rendu)

- **Le neutre porte un mât nu** : aujourd'hui un bâtiment neutre n'a pas de mât
  du tout ; la charte veut le mât sans drapeau (« jamais de drapeau gris »). Un
  neutre qu'on capture hisse les couleurs du capteur, comme avant.
- **Le désaffecté** prend l'entrée `batiment_<clé>_desaffecte` si l'atlas l'a,
  sans teinte ni mât (son mât couché est dans l'image) ; à défaut, l'entrée de
  base ternie (`TEINTE_DESAFFECTE`) comme aujourd'hui, sans mât.
- **La superusine** : une case portée par `etat.reglages.superusines` prend
  `batiment_superusine_base` tant qu'elle est au camp de la superusine et pas
  désaffectée, `batiment_superusine_inerte` sinon ; à défaut, l'usine.
- L'écran de combat pose le même bâtiment que la carte (même choix d'entrée).
- `scripts/sprites/catalogue.ts` (`classer`) reconnaît les nouveaux
  identifiants ; `src/assets/catalogue.ts` en compose les fiches (une fiche
  par entrée, comme les QG nationaux), pour que l'installation se contrôle.

## 5. Ce que mesure la chaîne (agent du socle)

`npm run fabriquer:figurine -- --batiment <clé> [--etat <état>] [--variante <v>]`
: la même chaîne que les unités — bibliothèque, atlas de palette, lot, contrôle,
déterminisme, cuisson d'essai en vue `fixe` (ombre au sol, émission à part),
mesures, planches — et l'installation par `npm run installer:figurine -- --id
<identifiant>`. Les règles, toutes mesurées sur l'image cuite :

| Règle | Seuil |
|---|---|
| équipe | 30 à 45 % des pixels du bâtiment (ombre exclue), sur les dessus : la plus grande part éclairée |
| équipe éclairée | au moins 60 % de l'équipe reçoit 0,8 de lumière (les toits se lisent de haut) |
| emprise | tient dans la case (±0,47 de côté), superusine jusqu'à 0,6 ; hauteur au plus 0,85 case, le QG le plus haut de tous |
| coin du mât | rien au-dessus de 0,05 m dans le cercle de 0,08 m autour du pied |
| émission | en service : des fenêtres allumées (au moins 1 % des pixels) ; désaffecté et superusine prise : aucune |
| palette | la palette fermée, plus `enduit`, `pave`, `bois` (réservées aux bâtiments) ; pas d'orange hors de la superusine |
| distinct | l'ombre chinoise à 48 px contre chaque autre bâtiment installé (information, 0,80) |
| repos | un bâtiment ne bouge pas au repos, hors une pièce qui tourne (parabole, grue lente) |

Les variantes de saison de la fiche (`ete`, `hiver`) reçoivent les mêmes cartes,
comme pour les unités : une image par état, quelle que soit la saison (le
rendu ne neige pas sur un bâtiment aujourd'hui ; ce serait un chantier du rendu,
pas de l'image).

La planche montre le bâtiment dans les quatre camps, **neutre**, **désaffecté**,
de **nuit** (émission allumée), à 128 et à 48 px, et sur un plateau avec les
unités installées pour l'échelle.

## 6. L'ordre

1. Le socle des bâtiments et la ville pilote (un agent, en worktree), en même
   temps que le rendu (un agent, en worktree).
2. Un agent par bâtiment : usine, aéroport, port, radar, les trois QG,
   la superusine, le pont.
3. Le coordinateur relit chaque planche, installe, recuit, et pousse.
