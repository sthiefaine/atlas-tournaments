# Les figurines — mode d'emploi d'un agent d'unité ou de bâtiment

Le socle commun des trente unités refaites de zéro (23 septembre 2026), et des
bâtiments depuis le 24 septembre. Un agent d'unité **n'écrit qu'un fichier** :
`unites/<cle>.py` ; un agent de bâtiment, `batiments/<cle>.py` (voir « Les
bâtiments », plus bas). Tout ce qui fait la cohésion du lot — la palette, le
masque d'équipe, le chanfrein, le lissage, les nœuds de la fiche, les clips,
l'export, le contrôle, la cuisson d'essai, les mesures — est ici et ne se
recopie pas.

Le pilote est `unites/char_leger.py` : lisez-le avant d'écrire le vôtre. Celui
des bâtiments est `batiments/ville.py`.

## La commande

```
npm run fabriquer:figurine -- --cle <cle>
```

Blender construit votre module, le lot est assemblé et contrôlé comme le dépôt
le contrôle, l'unité est cuite par la vraie chaîne de cuisson, puis mesurée et
mise en planche. Tout sort dans `tmp/figurines/<cle>/` ; **rien n'est écrit
sous `public/`**, c'est le coordinateur qui installe.

| Option | Effet |
|---|---|
| `--sans-cuisson` | Blender, lot, contrôle, et un **aperçu** de la palette et de la silhouette tiré des images d'identifiants : 5 secondes. Pour régler les proportions. |
| `--echantillons 8` | cuisson rapide (24 par défaut) : pour regarder une planche en une minute et demie. La dernière cuisson se fait sans cette option. |
| `--fiche mesuree` (défaut) | contrôle contre une copie de la fiche aux dimensions **mesurées** de votre modèle et au budget de la charte (`tmp/figurines/<cle>/fiche.json`) : le coordinateur reportera ces dimensions au catalogue. |
| `--fiche officielle` | contrôle contre `assets/specs/unite_<cle>_base.json` tel quel (ses gabarits datent d'avant la charte : l'échelle y sera refusée). |
| `--module <fichier.py>` | essayer une variante sans toucher `unites/<cle>.py`. |
| `--sortie <dossier>` | écrire ailleurs que `tmp/figurines/<cle>/`. |
| `--determinisme` / `--sans-determinisme` | Blender construit le module **une seconde fois** : le GLB brut et celui du lot doivent être identiques à l'octet, sinon c'est un échec, et l'écart est nommé maille par maille. Fait d'office avec la cuisson (quelques secondes), pas avec `--sans-cuisson`. Une figurine qui ne se refabrique pas à l'identique se recuit à chaque installation. |

**Vos essais vont dans `tmp/figurines/<cle>/essais/`, jamais ailleurs** : une
variante en `--module tmp/figurines/<cle>/essais/<nom>.py`, sa sortie en
`--sortie tmp/figurines/<cle>/essais/<nom>`, vos scripts de mesure à côté. Le
bloc-notes des agents est partagé : un essai posé ailleurs finit écrasé par
celui d'un autre.

Quand la fiche a un **contrat d'assemblage** (`src/assets/production.ts`,
`contratProduction` : l'anti-air et l'artillerie aujourd'hui), la commande
l'imprime avant de construire, déjà traduit en appels :
`f.noeud('module_canon_long', parent='corps', pivot=(0, 0.315, -0.13))`. Le
contrôle y refuse un nœud dont le parent ou le **pivot local** (sa translation
dans son parent, au millimètre) diffère ; `f.noeud` prend un pivot **absolu**,
d'où la somme déjà faite. Si l'articulation dessinée n'est pas au pivot imposé
(des tourillons ailleurs), faites tourner le geste autour d'un `centre` (voir
les clips) au lieu de déplacer le nœud.

Code de sortie : 0 si le contrôle passe et qu'aucune règle n'échoue, 1 sinon,
2 si la fabrication elle-même a échoué (le message de Blender est imprimé).

Ce qui sort :

- `lot/` : `unite_<cle>_base_lod0.glb` et ses PNG (albédo, normale, rugosité —
  rugosité en G, métal en B —, métal, masque d'équipe, émission si l'unité en
  porte, et les variantes de saison de la fiche). Le verdict de référence :
  `npm run controler:asset -- --spec tmp/figurines/<cle>/fiche.json --lot tmp/figurines/<cle>/lot` ;
- `sprites/` : la cuisson d'essai (manifeste, pages, pages de couverture) ;
- `planche.png` : l'unité sur l'herbe, dans les quatre vues et la gauche en
  miroir, en bleu, rouge, Islande et Nouvelle-Zélande, à 128 et à 48 pixels par
  case (vraie taille, puis agrandie trois fois), un plateau de six cases où
  les camps se touchent, et les images du repos ;
- `planche-clips.png` : chaque clip, image par image ;
- `rapport.json` : les mesures et le verdict de chaque règle ; la console
  imprime le même tableau.

**Regardez vos planches** (l'outil Read les ouvre). C'est une production
artistique : les mesures disent si l'unité est dans la charte, pas si elle est
réussie. La question à se poser à 48 pixels, agrandi trois fois : sait-on ce
que c'est, et à qui c'est ?

## Ce que vous écrivez

```python
"""Ce que l'unité dit à 48 pixels, en trois lignes."""
import bibliotheque as b

LARGEUR_VISEE = (0.76, 0.79)   # facultatif : plus étroit que votre classe
GENRE = None                   # facultatif : corrige le genre deviné du canon

def construire(f):
    ...   # nœuds et pièces

def animer(f):
    ...   # un geste au moins dans chaque clip obligatoire de la fiche
```

### Le repère

Celui de la fiche et du glTF, en mètres (**une case vaut un mètre**), origine
au centre de l'emprise, au sol :

- `x` : latéral, **positif à gauche du modèle** ;
- `y` : en haut ;
- `z` : **vers l'avant** (le nez, l'étrave, la bouche du canon).

La vue `droite` (la principale : 60° de lacet) montre **l'avant et le flanc
droit** (les `x` négatifs) ; la gauche du jeu est cette image retournée. `bas`
montre l'avant, `haut` l'arrière. Un modèle ne s'écrit jamais en axes de
Blender : la bibliothèque convertit.

L'emprise doit être **centrée** sur l'origine en `x` et en `z` (à la tolérance
de la fiche, environ 7 cm) : un canon très long pousse la boîte en avant,
reculez la caisse d'autant. Ce qui roule ou marche touche le sol (`y` = 0) ;
ce qui vole est modélisé **à sa hauteur de vol** (bas de la silhouette au
repos : rotors 0,20 m, avions 0,30 m, drones 0,25 m).

### Les nœuds

Les nœuds de la fiche (`racine`, `corps`, `base`, `socle`, `module_*`…) existent
d'office, sous `racine` (les `module_*` sous `corps`) ; un nœud peut rester vide.
`f.noeud(nom, parent=..., pivot=..., tournant=..., mobile=...)` règle un nœud
de la fiche ou en crée un : **une pièce qui doit bouger seule a son nœud** (un
canon qui recule, un galet qui tourne, une antenne), et son pivot est le point
autour duquel elle tourne (le tourillon, l'axe). Un nœud n'a jamais de
rotation au repos : tout se modèle en place. La `racine` ne s'anime jamais.

Deux déclarations pour ce qui bouge **au repos**, à ne pas confondre :

| | `mobile=True` | `tournant=True` |
|---|---|---|
| Pour | une pièce qui a le droit de bouger au repos : une boule-caméra qui balaie, une parabole qui tourne lentement | une pièce qui tourne **sans fin** : un rotor (`rotor()` le pose lui-même) |
| Limite de rotation du repos (2°) | exemptée | exemptée |
| Agitation du repos | exclue, sur tout ce qu'elle balaie pendant le repos | exclue, sur un tour entier autour de son axe |
| Cuisson | comme le reste, flou de bouge compris | **nette**, sans flou de bouge |
| Palette (masse sombre en bas) | comptée | ôtée |
| Vérifiée | — | le pas d'une image cuite à l'autre (`rotor`) |

Un nœud tournant est mobile. Ne déclarez pas `tournant` pour passer la limite
de rotation d'une pièce qui balaie : elle perdrait son flou de bouge.

### La palette

Chaque pièce a **une teinte** de `charte.json` : `equipe` (blanc cuit, le jeu
le teint du camp ; laque), `graphite` (châssis, dessous, armes, tubes, rotors,
patins), `caoutchouc` (chenilles, pneus), `os` (moyeux, caisses, bidons,
missiles, bâches, bande de flottaison), `acier_clair` (bouches, rails,
charnières), `verre` (avec sa bande de reflet peinte sur le tiers haut de la
pièce), `feux`, une peau par fantassin (`peau_infanterie`, `peau_meca`,
`peau_genie`), et pour les Gris seuls `appret` et `orange` (émissif). Une
teinte réservée à d'autres, ou de bâtiment, est **refusée à la construction**.
Au plus six teintes par unité, équipe comprise. Aucun détail peint : pas de
texte, de chiffre, d'insigne, de camouflage, de salissure.

### Les primitives

Toutes prennent un `noeud` (où la pièce s'accroche), des positions et des
tailles dans le repère du modèle, une `teinte`, et rendent la pièce (ou la
liste des pièces). Toutes sont chanfreinées (au moins 0,015 m et 3 % de leur
plus grande dimension ; `chanfrein=` en demande plus) et lissées. Un cercle a
assez de côtés pour ne jamais se voir en polygone. **Aucun module n'appelle
une fonction privée** (`_piece`, `_solide_anneaux`, `_placement`…) : si une
forme manque, `solide` la fait, sinon dites-le. Pour une pièce qu'aucune
primitive ne fait à l'identique, quatre noms publics font ce que faisaient les
fonctions privées qu'appelaient cinq modules de la première vague :
`b.anneaux_en_solide(bm, anneaux)` remplit un `bmesh` (points en repère
Blender, `b.vb`), `f.piece_sur_mesure(bm, noeud, teinte, placement, dims, …)`
le pose comme une pièce (teinte vérifiée, chanfrein calculé sur `dims`,
`arrondir=False` pour une pale ou une vitre), `f.placement(centre, rotation)`
et `f.rotation_modele(rotations)` en font la matrice, `f.verifier_teinte`
refuse une teinte réservée.

Toutes prennent aussi `uv` : `'hauteur'` range la pièce du haut vers le bas de
la case de sa teinte, ce qui pose le reflet peint du **verre** sur son tiers
haut — c'est le défaut de toute teinte à reflet, rien à demander : une
`boite`, une `boule`, une `capsule` en `'verre'` ont leur reflet en haut.
`'boite'` (projection en boîte) est le défaut des autres teintes.

| Primitive | Paramètres | Pour |
|---|---|---|
| `boite(noeud, centre, taille, teinte, chanfrein=None, rotation=None, fin=False, nom=None)` | `taille` = (x, y, z) ; `rotation` = liste de (axe, degrés) | caisses, cabines, plaques |
| `cylindre(noeud, centre, rayon, longueur, teinte, axe='y', rayon2=None, chanfrein=None, ellipse=1.0, fin=False, nom=None)` | tronc de cône si `rayon2` ; `ellipse` étire la section | fûts, anneaux, moyeux |
| `capsule(noeud, centre, rayon, longueur, teinte, axe='z', nom=None)` | longueur totale, bouts ronds | membres, patins, missiles |
| `boule(noeud, centre, rayon, teinte, etirement=(1,1,1), nom=None, rotation=None)` | `rotation` : liste de (axe, degrés) autour du centre, après l'étirement : un ellipsoïde incliné | têtes, boules-caméras, bérets, verrières |
| `prisme(noeud, profil, largeur, teinte, centre_x=0, chanfrein=None, nom=None, rotation=None, origine=None)` | `profil` : points (z, y) du côté, l'avant à droite ; `rotation` : liste de (axe, degrés), autour du milieu de l'emprise ; avec `origine`, le profil est donné depuis ce point et tourne autour de lui ; un profil concave (une clé fendue, une marche) est bien fermé | toute forme vue de côté ; une plaque tenue au poing |
| `extrusion(noeud, bas, haut, y0, y1, teinte, chanfrein=None, nom=None)` | deux contours (x, z) vus de dessus, de même nombre de points ; `haut` rentre (une épaule qui prend la lumière) ou vaut None ; concave permis (un U) | coques, châteaux, toits, rebords |
| `b.contour_rectangle(cx, cz, lx, lz, rayon=0, n_coin=6)` | un rectangle (x, z) aux coins arrondis, dans le sens qu'`extrusion` attend ; deux contours au même `n_coin` se répondent point à point | le bas et le haut d'une extrusion |
| `solide(noeud, anneaux, teinte, origine=None, rotation=None, chanfrein=None, fin=False, nom=None)` | des anneaux de points (x, y, z), de même nombre, reliés l'un au suivant, les deux bouts bouchés ; avec `origine`, points donnés depuis elle et rotation autour d'elle | **tout solide à section donnée** : tourelle libre, bac ouvert (dehors puis dedans), dalle, casque à arête |
| `fuseau(noeud, profil, z0, z1, teinte, sections=64, exposants=(2,2), nom='fuseau', resserrement=0)` | `profil(z)` → (demi-largeur, ligne la plus large, hauteur dessus, hauteur dessous) ; `exposants` : le dessus puis le dessous, 2 une ellipse, 1 un V ; `resserrement` de 0 (pas régulier) à 1 (pas en cosinus) serre les sections vers les deux bouts : un bout arrondi ne montre plus ses facettes | un fuselage que `fuselage` ne sait pas dire, une caisse aux bouts ronds, sans chanfrein |
| `membre(noeud, a, b, rayon, teinte, nom=None)` | une capsule d'une articulation à l'autre, bouts centrés sur elles : deux membres qui se suivent font un coude rond | bras et jambes remodelés, un fusil tenu d'une main à l'autre |
| `revolution(noeud, centre, profil, teinte, axe='y', chanfrein=None, nom=None)` | `profil` : (rayon, position le long de l'axe), du bas vers le haut | bols, dômes, casques |
| `roue(noeud, centre, rayon, largeur, teinte_pneu='caoutchouc', teinte_moyeu='os', axe='x', part_moyeu=0.5, meplat=False)` | pneu arrondi et moyeu qui dépasse ; `meplat` : le moyeu en « D », comme les galets | véhicules à roues |
| `chenille(noeud, x, longueur, hauteur, largeur, y_bas=0, z_centre=0, teinte='caoutchouc')` | un stade vu de côté, centré en `x` | trains de chenilles |
| `galets(noeuds, x, zs, y, rayon, epaisseur, teinte='graphite', teinte_moyeu=None, part_moyeu=0.45, meplat=False)` | un galet à ±x par `z` ; `noeuds` : un nom, ou un nœud par essieu (pivot posé sur l'axe) ; `part_moyeu` : le rayon du moyeu en part du galet (0,62 : les six galets du char lourd se comptent à 48 px) ; `meplat` : le moyeu en « D », qui montre que le galet roule en `deplacement` — un moyeu rond et centré ne le montre pas. `True` coupe la corde à 0,62 rayon du centre (`Figurine.MEPLAT`) : le moyeu reste rond au repos, là où 0,4 fait une demi-lune ; un nombre règle la corde | galets qui tournent |
| `caisse_char(noeud, longueur, largeur, y_bas, hauteur, teinte='equipe', glacis=0.45, arriere=0.25, z_centre=0)` | glacis avant incliné, arrière fuyant | caisses de blindés |
| `tourelle(noeud, centre, largeur, longueur, hauteur, teinte='equipe', forme='ronde'\|'carree', inclinaison=0.18, chanfrein=None)` | `centre` = milieu de sa base ; `carree` : un tronc de pyramide symétrique | tourelles |
| `tourelle_profil(noeud, centre, contour, hauteur, teinte='equipe', retraits=(0,0,0), biseau=0, part_biseau=0.45, chanfrein=None)` | `contour` : la base vue de dessus, points (x, z) depuis le centre (coins coupés, masque en pointe) ; les flancs rentrent de `retraits` = (avant, arrière, côtés) en montant ; `biseau` rentre encore le haut sur `part_biseau` de la hauteur : un pan qui prend la lumière | tourelles au contour libre |
| `tube(noeud, depart, direction_tube, longueur, rayon, teinte='graphite', bouche=True, teinte_bouche='acier_clair', rayon_bouche=None, longueur_bouche=None)` | le manchon de bouche au bout ; la bouche est **jugée avec son tube** (épaisseur) : un manchon de 4 cm ne fait plus échouer la règle | canons, tubes |
| `bac_tubes(noeud, centre, colonnes, lignes, rayon_tube, longueur, direction_tubes='z', teinte_bac='equipe', teinte_tubes='os', ecart=None)` | une boîte et ses bouts de tubes | lance-roquettes, lance-missiles |
| `parabole(noeud, centre, rayon, profondeur, direction_parabole, teinte='os', epaisseur=0.02)` | un bol épais et son cornet ; le cornet (4,4 cm) est jugé avec son bol, mais le bol, lui, doit faire 5 cm de `profondeur + epaisseur` | radars (pas le brouillage : arête de poisson) |
| `antenne(noeud, base, hauteur, rayon=0.015, teinte='graphite', inclinaison=None, boule=True)` | la seule pièce admise à 0,03 m | antennes, mâts |
| `rotor(noeud, centre, rayon, pales=2, largeur_pale=0.07, epaisseur=0.03, teinte='graphite', axe='y', angle=0)` | 2 à 4 pales opaques ; marque le nœud tournant, retient son axe et son nombre de pales ; `angle` : les pales au repos, tournées dans le sens de `tourner` (à 0, la première pale d'un rotor d'axe y pointe vers l'arrière ; une barre à deux pales est horizontale à l'écran à 30° en vue droite) ; **cuit net**, voir les clips | hélicoptères, drones |
| `fuselage(noeud, longueur, largeur, hauteur, teinte, y_centre, z_centre=0, nez=0.35, queue=0.45, queue_haute=0.3, nez_forme='rond', nez_y=None, exposants=(2,2), dessous=0.5)` | section ovale, queue effilée qui remonte ; `nez_forme='pointu'` : une ogive (chasseur, missile) ; `nez_y` : la pointe plus bas que l'axe (un museau qui tombe) ; `exposants` : le dos puis la carène (1 : un V, 3 : un dos plat) ; `dessous` : la part de la hauteur sous la ligne la plus large | avions, hélicoptères |
| `aile(noeud, emplanture, envergure, corde, epaisseur, teinte, fleche=25, effilement=0.55, diedre=0, symetrique=True)` | plan en trapèze depuis le bord d'attaque à l'emplanture | ailes, empennages |
| `coque(noeud, longueur, largeur, hauteur, teinte_coque='graphite', teinte_pont='equipe', teinte_flottaison='os', flottaison=0.04, proue=0.3, poupe=0.12, pont=0.03)` | posée sur l'eau (`y` = 0) : bande de flottaison, coque, pont d'équipe en retrait | navires |
| `fantassin(hauteur=0.8, peau=None, tenue='equipe', bas='graphite', couvre_chef='casque', teinte_couvre_chef='equipe', noeud_corps='corps', noeud_jambes='base', tetes=4.25, carrure=1.9, pantalon=None, pose_bras_g=None, pose_bras_d=None, recul_couvre_chef=0, tourne_couvre_chef=0, bottes=1)` | crée `tete`, `bras_g`, `bras_d`, `jambe_g`, `jambe_d` ; visage nu vers l'avant ; `casque`, `beret`, `casquette` ou None ; pas de socle. Rend les nœuds, et sous `points` les articulations posées (`epaule_g`, `coude_g`, `main_g`… `tete`, `cou`, `hanche_g`…) où accrocher une arme. Voir ci-dessous | fantassins |

`fin=True` (automatique sur `antenne`, les pales de `rotor` et la bande de
flottaison) est la seule exception à l'épaisseur minimale de 0,05 m : elle
descend alors à 0,03 m. Une pièce qui fait corps avec une autre se **juge avec
elle** : `p.avec = hote.nom` (sur la pièce que rend une primitive), et son
épaisseur est celle des deux ensemble, mesurée dans le repère de l'hôte — la
bouche d'un tube, le cornet d'une parabole et le moyeu en « D » d'un galet ou
d'une roue le sont d'office.

**Le fantassin.** Ce que les trois premiers agents ont remodelé à la main se
règle désormais par ses paramètres (tous facultatifs, le défaut rend la
figurine d'avant à l'identique) :

- `pantalon` : la teinte des jambes (par défaut celle de la tenue) ;
- `pose_bras_g`, `pose_bras_d` : `(flexion, écart, coude)` en degrés — 0 pend,
  90 tendu devant, 180 dressé ; l'écart éloigne du corps (négatif : vers lui) ;
  le coude plie l'avant-bras vers l'avant — ou `{'main': (x, y, z)}`, la main
  sur un point du modèle, le coude placé par la longueur du bras vers
  l'extérieur et le bas (`'coude'` le pose aussi). Un bras posé est deux
  `membre` et une main ;
- `recul_couvre_chef`, `tourne_couvre_chef` : le couvre-chef basculé vers la
  nuque puis tourné vers la gauche du soldat, autour du centre de la tête — le
  visage sort dessous et regarde le joueur (les trois fantassins : 30 à 36° de
  recul, 45° de tour) ;
- `bottes` : la taille des bottes, de 0,6 à 1,2. Mesuré sur une figurine nue
  (vue droite, identifiants) : la masse sombre, bottes et ceinturon, passe de
  17,1 % à 1 à **11,0 % à 0,7** — les bottes lourdes en prenaient 13 à 15 %, la
  moitié du plafond sombre. La jambe descend toujours de 2 cm dans la botte.

Et deux gestes de modelage, pour ce qui reste : `f.retirer(noeud, *noms)` ôte
des pièces déjà posées, `f.decaler(noeud, dx, dy, dz)` déplace un nœud et ses
pièces, pivot compris (une jambe qui avance d'un demi-pas, droite).

### Les clips

`f.clip(nom)` rend le clip de la fiche : sa durée et sa boucle sont celles de
la fiche, pas les vôtres. Un geste est une fonction du temps ; la bibliothèque
en fournit :

| Geste | Pour |
|---|---|
| `b.balancer(clip, noeud, axe, degres, periodes=1, phase=0, centre=None)` | un balancement sinusoïdal (entier de périodes : il boucle) |
| `b.osciller(clip, noeud, direction, metres, periodes=1, phase=0)` | une oscillation en translation (suspension, tangage) |
| `b.tourner(clip, noeud, axe, tours=1)` | une rotation continue (rotor, galet, parabole), entière |
| `b.recul(clip, noeud, direction, metres, debut=0, attaque=0.06, retour=0.4)` | le recul d'un tube |
| `b.a_coup(clip, noeud, axe, degres, debut=0, attaque=0.08, retour=0.4, centre=None)` | un basculement bref et son retour |
| `b.secousse(clip, noeud, axe, degres, debut=0, duree=None, oscillations=2.5, centre=None)` | une secousse amortie (un coup reçu) |
| `b.sursaut(clip, noeud, direction, metres, debut=0, duree=None)` | un petit aller-retour amorti |
| `b.affaisser(clip, noeud, descente=(0,0,0), rotation=None, debut=0, duree=None, centre=None)` | une pose qui s'installe et reste (`hors_jeu`) |
| `b.respirer(clip, noeud, amplitude=0.012, periodes=1)` | la respiration d'une figurine |
| `b.fixe(clip, noeud)` | un clip qui existe sans rien bouger |

Plus bas niveau : `clip.translation(noeud, f)`, `clip.rotation(noeud, f,
centre=None)`, `clip.echelle(noeud, f)` avec `f(t)` → écart au repos. Les
gestes d'un même nœud se composent, dans l'ordre où on les pose. Un clip qui
boucle doit revenir à sa première pose : la bibliothèque refuse l'export sinon.

**Tourner autour d'un point qui n'est pas le pivot** : les quatre gestes qui
tournent (`balancer`, `a_coup`, `secousse`, `affaisser`) et `clip.rotation`
prennent `centre`, un point du modèle au repos — des tourillons quand le
contrat impose le pivot ailleurs, une caisse qui bascule sur son arête, un
appareil qui se pose sur sa queue. Le nœud tourne toujours autour de son pivot ;
ce qui l'en écarte passe dans sa translation, calculée pour que le `centre`
reste immobile (vérifié : 6° de bascule, le centre bouge de moins d'un
dix-millième de millimètre).

`b.instants_cuisson(clip)` rend les instants que la cuisson photographie : pour
caler une pose sur une image cuite (un éclair sur l'image du coup).

**Une échelle nulle ou quasi nulle est permise** (`clip.echelle`, une pièce qui
disparaît : un missile tiré) : le lot du chasseur à l'échelle 0,02, cuit sept
fois par quatre variantes de la cuisson, et une démonstration à l'échelle 0,
sortent entiers. La vue de profil noire qu'on lui prêtait venait de la cuisson
du 24 septembre entre 1 h 01 et 1 h 22 (voir plus bas).

**Les pièces qui tournent sans fin sont cuites nettes.** Un nœud `tournant`
(`rotor()`, `f.noeud(…, tournant=True)`) et tout ce qui y est accroché sont
marqués dans le GLB (`extras.flouDeBouge: false`) et la cuisson leur ôte le
flou de bouge : chaque image montre des pales nettes, au lieu de l'éventail
qu'un obturateur ouvert sur la moitié du pas faisait d'une rotation continue —
mesuré sur une démonstration à deux rotors, 288 pixels à demi transparents par
image au lieu de 699. `b.tourner` suffit donc, sans rien recopier de la
cuisson ; c'est le **pas** d'une image cuite à l'autre qui dit que le rotor
tourne. Il doit aller dans le sens de la rotation, au-dessus du dixième et
sous les deux cinquièmes de l'écart entre deux pales : à 12 images par boucle,
`tours=1` fait 30°, bien pour 2, 3 ou 4 pales ; `tours=4` sur trois pales fait
120°, un rotor figé. `rapport()` (donc la console) **avertit** d'un rotor
dont le pas sort de cette plage.

**Le repos est calme** : aucun tremblement du corps entier, un seul petit signe
de vie (une antenne qui se balance de moins de 2°, un radar ou un rotor qui
tourne, une respiration). `deplacement` reste sur place (le jeu déplace
l'unité) ; `hors_jeu` tient sa dernière pose.

## Les règles mesurées

Chaque ligne du tableau est une règle de `charte.json`, sa valeur et son
verdict (`ok`, `ÉCHEC`, `info`) :

| Règle | Ce qu'elle mesure |
|---|---|
| `controle_fiche` | le lot passe `controlerDepot` (noms, matériaux, clips, échelle, textures) |
| `equipe_droite`, `equipe_bas`, `equipe_haut` | part des pixels **du modèle** (contour exclu, grâce aux pages de couverture) sous le masque d'équipe : 45–60 % en vue droite (fantassins 40–55), 40 % au moins en bas et en haut |
| `equipe_connexe` | à 48 px, la plus grande zone d'équipe d'un seul tenant porte 60 % de l'équipe au moins |
| `equipe_eclairee` | 60 % des pixels d'équipe reçoivent au moins 0,8 de lumière : l'équipe est sur les dessus (seuil proposé, non arrêté ; information pour les fantassins). Le calcul lambertien (`clarteFace`, `scripts/sprites/reglages.ts`) donne 1,0 à un dessus plat et fait passer une pente d'équipe sous 0,8 vers 55° quand elle descend vers le côté ou l'arrière (75° vers le joueur). La note d'avant — « la laque plafonne vers 0,9, un dessus plat sort à 0,86–0,88 » — avait été mesurée le 23 septembre sous la lumière d'avant la charte ; sous la lumière de la charte, l'agent de l'automate a mesuré 1,00 sur une sphère d'équipe cuite, et le seuil de 0,8 sur une facette couchée à 50° de la verticale (40° quand elle regarde la caméra) — non repris par un test |
| `equipe_coherente` | la part d'équipe des identifiants et celle du masque cuit disent la même chose (vos UV tombent dans les bonnes cases) |
| `largeur` (et `hauteur` d'un fantassin), `largeur_visee` | la silhouette en vue droite, **contour compris**, en cases de 128 px : petite 0,60–0,68, moyenne 0,76–0,84, grande 0,88–0,94 ; fantassins 0,36–0,50 × 0,68–0,75 |
| `debord_lateral`, `hauteur_pivot` | dans toutes les images de carte : rien au-delà de ±0,47 case du pivot, rien au-dessus de 0,70 case (0,85 en vol) |
| `altitude`, `au_sol` | le bas du modèle au repos |
| `repos_agitation`, `repos_rotation` | au plus 3 % de pixels qui changent entre deux images du repos (15 % en vol), aucune pièce qui pivote de plus de 2° — les pièces tournantes déclarées exclues |
| `palette_*` | sur les identifiants, vue droite : la masse sombre (graphite et caoutchouc) 20–35 % et **en bas** de la silhouette — ce « en bas » ne compte pas les pièces tournantes : un rotor graphite, en haut, n'assoit pas l'unité —, os ≤ 12 %, acier clair ≤ 3 %, verre ≤ 8 %, feux ≤ 1 % ; orange 4–6 % et apprêt ≤ 25 % pour les Gris |
| `teintes`, `budget`, `materiaux`, `epaisseur` | six teintes au plus, 60 000 triangles, les matériaux de la fiche, aucune pièce sous 0,05 m (antennes, pales, flottaison : 0,03 m ; une pièce jugée avec une autre, avec elle) |
| `cuisson_entiere` | aucune image cuite n'a perdu de faces (`scripts/sprites/anomalies.ts`) : dans chaque animation, aucune image sous 80 % de la silhouette opaque médiane, ni sous 60 % de la part de masque médiane (quand elle dépasse 0,2) ; entre animations, aucune dont la part de masque médiane tombe sous le quart de la plus haute, ni dont la clarté médiane tombe sous 60 % de la médiane de l'entrée. Le même contrôle tient les unités installées (`tests/sprites/anomalies.test.ts`) |
| `recouvrement` | **information** : l'ombre chinoise à 48 px — l'alpha de l'image cuite, contour compris, ramené à 48 px par case et calé sur le pivot — contre chaque unité du **même milieu** déjà dans les images du jeu (`public/assets/sprites/`, manifeste courant, l'unité elle-même exceptée) ; la valeur est l'intersection sur l'union (IoU) la plus forte des vues droite et bas, avec le nom de l'unité. Seuil de la charte : 0,80 (§3.5) |

La classe de taille est la taille de silhouette du canon (`content/unites.json`,
`silhouette.taille`) ; le genre (véhicule, fantassin, rotor, avion, drone,
navire) se déduit du canon — les pattes, le milieu, et le **trait** `drone`,
jamais le nom de la clé —, et `GENRE = '…'` le corrige.

### Des gabarits qui tiennent les classes

En vue droite, la silhouette d'un volume de largeur `W` (x) et de longueur `L`
(z) vaut à peu près `0,5 W + 0,866 L − 0,73 r + 0,047` cases (`r` : l'arrondi
des coins, 0,047 : le contour) : **la longueur pèse presque deux fois plus que
la largeur**. Mesuré (23 septembre 2026, `--sans-cuisson`, volumes types de la
bibliothèque : chenilles et caisse, fuselage et ailes, coque et château), en
largeur de silhouette contour compris, débord entre parenthèses :

| Genre | petite (0,60–0,68) | moyenne (0,76–0,84) | grande (0,88–0,94) |
|---|---|---|---|
| véhicule | L 0,48 × W 0,40 → 0,641 (0,320) | L 0,58 × W 0,50 → 0,781 (0,391) ; le pilote : 0,781 | L 0,70 × W 0,56 → 0,906 (0,453) |
| avion, flèche 38° | L 0,66 × E 0,56 → 0,648 (0,336) | L 0,82 × E 0,70 → 0,805 (0,422) | L 0,88 × E 0,84 → 0,906 mais **débord 0,500** : refusé |
| avion, flèche 12–15° | | | L 0,97 × E 0,86 → 0,898 (0,453) ; L 0,95 × E 0,88 → 0,883 (0,445) |
| navire | L 0,62 × W 0,22 → 0,625 (0,328) | L 0,80 × W 0,26 → 0,789 (0,414) | L 0,92 × W 0,30 → 0,891 (0,469, à la limite) |
| fantassin | hauteur 0,80 m → 0,73 case de haut ; largeur 0,39 (bras le long du corps) à 0,44 (carrure 2,2, fusil de 0,5 m en travers) : la charte a été ramenée à **0,36–0,50** pour une figurine debout | | |

Le débord (±0,47 case) borne un grand avion et un grand navire avant la
largeur : une aile très en flèche jette son saumon à gauche du pivot, une poupe
carrée aussi. Un fantassin gagne de la largeur par la profondeur (un fusil tenu
en avant, un sac) plus que par la carrure : `z` compte 0,866, `x` 0,5.

## Ce que vous ne touchez pas

Votre seul fichier est `unites/<cle>.py` (et vos essais dans
`tmp/figurines/<cle>/essais/`, jamais ailleurs). Ne modifiez ni
`bibliotheque.py`, ni `charte.json`, ni `fabriquer.*`, `lot.ts`, `mesures.ts`,
`planche.ts`, `lecture.ts`, `charte.ts`, ni `scripts/sprites/`, `public/`,
`src/`, `assets/specs/`, `content/`. Aucune opération git. N'appelez aucune
fonction privée de la bibliothèque (celles qui commencent par `_`). Si une
primitive manque ou qu'une règle vous paraît fausse, dites-le dans votre
rapport au lieu de la contourner. Ne laissez pas de `.ts` dans `tmp/` :
`npm run typecheck` les lirait.

## Les bâtiments

La vague des bâtiments (24 septembre 2026) : le plan
`doc/refonte/plan-batiments.md` **fait foi** (identifiants, états, coin du mât,
règles) ; la charte (`doc/refonte/charte-figurines.md` §3.12 et §6) dit ce que
chaque bâtiment montre. La même chaîne que les unités — bibliothèque, atlas,
lot, contrôle, déterminisme, cuisson d'essai, mesures, planches —, avec ce qui
change pour un bâtiment : une seule vue, `fixe` (il regarde le joueur et ne se
retourne pas), son ombre cuite au sol, ses fenêtres dans une page d'émission,
et ses propres règles. Le pilote est `batiments/ville.py` : lisez-le avant
d'écrire le vôtre.

### La commande

```
npm run fabriquer:figurine -- --batiment <cle> [--etat <état>] [--variante <v>]
```

Sans `--etat` ni `--variante`, **tous** les états et variantes que le module
déclare sont fabriqués, chacun dans `tmp/figurines/batiments/<cle>/<id>/`
(`lot/`, `fiche.json`, `sprites/`, `rapport.json`, `planche-clips.png`), puis
la planche du bâtiment entier : `tmp/figurines/batiments/<cle>/planche.png`.
`--etat desaffecte` ne refait que lui ; la planche reprend les autres entrées
cuites la fois d'avant. Les options des unités valent aussi : `--sans-cuisson`
(Blender, lot, contrôle, coin du mât et aperçu de la palette en deux
secondes), `--echantillons 8`, `--module`, `--sortie` (elle remplace
`tmp/figurines/batiments/<cle>/`), `--fiche`, `--determinisme`.

| Module | Entrées (plan §1) |
|---|---|
| `batiments/ville.py`, `usine.py`, `aeroport.py`, `port.py`, `radar.py` | `batiment_<cle>_base`, `batiment_<cle>_desaffecte` |
| `batiments/qg.py` | `batiment_qg_base`, `batiment_qg_fr`, `batiment_qg_lu` (un QG ne se désaffecte pas) |
| `batiments/superusine.py` | `batiment_superusine_base`, `batiment_superusine_inerte` |
| `batiments/pont.py` | `terrain_pont` : un **terrain**, cuit en vues `fixe` et `travers`, sans couleur d'équipe, sans mât |

Une entrée dont le catalogue n'a pas encore la fiche (les désaffectés, la
superusine : `src/assets/catalogue.ts`, que l'agent du catalogue complète) se
contrôle contre celle de son **type de base** sous son identifiant
(`batiment_<cle>_base` ; l'usine pour la superusine), écrite dans
`<id>/fiche-officielle.json` : la console le dit (« dérivée de … »).

L'installation est celle du coordinateur :
`npm run installer:figurine -- --id <identifiant>` (le lot par défaut est
celui que la fabrication laisse) ; elle exige la fiche **officielle** du
catalogue, et la recuisson (`npm run cuire:sprites -- --id <identifiant>`)
un identifiant que `scripts/sprites/catalogue.ts` (`classer`) reconnaît.

### Ce que vous écrivez

```python
"""Ce que le bâtiment dit à 48 pixels, en trois lignes."""
import bibliotheque as b

ETATS = ('base', 'desaffecte')     # ('base', 'inerte') pour la superusine ; ('base',) pour le QG et le pont
VARIANTES = ('base',)              # le QG : ('base', 'fr', 'lu')

def construire(f, etat, variante):
    ...   # le même bâtiment pour tous les états : le désaffecté est endormi, jamais un autre dessin

def animer(f, etat, variante):
    b.fixe(f.clip('repos'), 'corps')   # un bâtiment ne bouge pas au repos
    ...                                # `capture` est obligatoire ; `touche` facultatif ; le pont n'a aucun clip
```

`ETATS` et `VARIANTES` s'écrivent en tuple de chaînes, **sur une ligne** :
`fabriquer.ts` les lit dans la source pour savoir quoi fabriquer, et Blender
revérifie l'état demandé contre le module chargé.

- **Les nœuds de la fiche** : `racine`, `corps`, `toit`, `enseigne` (le pont :
  `racine`, `sol`), tous sous la racine au départ ; `f.noeud('toit',
  parent='corps', pivot=…)` les range. Un nœud peut rester vide (l'enseigne de
  la ville : aucune enseigne lisible).
- **Les matériaux** `mat_corps` et `mat_vitrage` : le verre et la fenêtre vont
  d'eux-mêmes au vitrage, tout le reste au corps. Un désaffecté sans vitre
  livre quand même le matériau (le lot l'ajoute).
- **La palette** : celle des unités, plus quatre teintes que seuls les
  bâtiments (et le pont) portent — `enduit` (murs), `pave` (socles, quais,
  cheminées), `bois` (portes, planches, pont) et `fenetre`, une vitre qui
  **s'allume la nuit** : le verre le jour (reflet compris), la lumière des feux
  dans sa page d'émission. Six teintes au plus. L'orange et l'apprêt des Gris
  sont réservés à `batiment_superusine` (et aux trois prototypes) : refusés à
  la construction partout ailleurs, et mesurés (`palette_orange`). Aucune
  peau.
- **Le sol** : le rendu peint la case d'un bâtiment (du pavé, `render2d/sol/`)
  et la planche aussi. Ne modélisez ni cour ni dalle au sol : c'est déjà là,
  et une dalle plus mince que 5 cm échoue à l'épaisseur.
- **L'échelle** : les unités installées sont posées sur le plateau de la
  planche ; un fantassin fait 0,8 m. Le bâtiment tient dans ±0,47 m (x et z),
  la superusine ±0,6.

Les primitives des bâtiments (en plus de celles des unités) :

| Primitive | Paramètres | Pour |
|---|---|---|
| `toit(noeud, centre, largeur, longueur, hauteur, teinte='equipe', faitage='x', debord=0.03, epaisseur=0.045, forme='deux_pans', haut='-z')` | `centre` : le milieu du dessus des murs (l'égout) ; `largeur` × `longueur` : l'emprise des murs (x × z) ; `hauteur` de l'égout au faîtage ; un seul solide épais de `epaisseur` qui déborde de `debord` ; `faitage='z'` : pignon sur rue (les pans regardent les côtés) ; `forme='appentis'` : un seul pan, haut du côté `haut` (`'-z'`, `'z'`, `'-x'`, `'x'`) — des appentis côte à côte font des dents de scie | tous les toits |
| `pignon(noeud, centre, largeur, longueur, hauteur, teinte='enduit', faitage='x', forme='deux_pans', haut='-z')` | les mêmes mesures que le `toit` qu'il porte | le mur sous un toit : sans lui, le toit flotte |
| `plaque(noeud, centre, largeur, hauteur, teinte='fenetre', face='z', saillie=0.012, profondeur=0.04, hote=None)` | `centre` : un point du plan de la façade ; `face` : sa normale (`'z'` vers le joueur, `'-z'`, `'x'`, `'-x'`) ; `hote` : le mur qui la porte (même nœud), avec lequel elle est jugée | fenêtres, portes, volets |
| `croix(noeud, centre, largeur, hauteur, teinte='bois', face='z', section=0.034, saillie=0.04, hote=None)` | deux planches en croix sur une ouverture | le désaffecté |
| `mat_couche(noeud, vers=(0, 1), longueur=0.5, rayon=0.018)` | le mât couché au sol, depuis le pied du mât vers `vers` (dx, dz), une boule os au bout | le désaffecté |
| `f.pied_mat()` | (x, z) du pied du mât | tout ce qui doit l'éviter |

### Le coin du mât

Le rendu plante lui-même le mât et le drapeau (`render2d/batiments.ts`,
`PIED_MAT`) au coin **arrière droit** de la case : `x = +0,36 m`,
`z = −0,20 m` dans le repère du modèle — à droite de l'écran, un peu derrière
le centre. Deux contraintes, et la seconde n'est pas mesurée :

1. **Rien au-dessus de 5 cm dans le cercle de 8 cm autour du pied**, dans la
   pose de repos et dans chaque image que la cuisson photographie. C'est
   mesuré sur la géométrie, triangle par triangle (`fabriquer.py`,
   `coin_mat`), et la console le dit dès `--sans-cuisson` (« coin du mât :
   libre » ou le nœud fautif et sa hauteur). Un toit qui déborde compte.
2. **Le rendu dessine le mât par-dessus tout.** Ce qui est *devant* lui
   (`z > −0,20`), dans sa colonne (`x` autour de 0,36), et qui monte à l'écran
   au-dessus de son pied, se retrouverait derrière le mât : gardez-y une
   hauteur sous `h ≤ (0,766 z + 0,153) / 0,643` (0,24 m à `z = 0`, 0,48 m à
   `z = 0,2`). La ville y met sa plus petite maison.

Le désaffecté n'a pas de mât dessiné : le sien est couché dans l'image
(`mat_couche`), et de biais à l'écran il se lit posé au sol (tout droit, il
passe pour une étagère).

### Les règles des bâtiments

Mesurées sur la cuisson d'essai, vue `fixe`, première image du repos (le
modèle seul : la page de couverture exclut l'ombre cuite et le contour), sauf
ce qui l'est sur le modèle. Les seuils sont dans `charte.json`, `batiments`.

| Règle | Seuil |
|---|---|
| `equipe` | 30 à 45 % des pixels du bâtiment sous le masque : le toit entier |
| `equipe_eclairee` | 60 % de l'équipe reçoit au moins 0,8 de lumière (un pan tourné sur le côté passe jusqu'à 50° de pente, vers le joueur jusqu'à 70°) |
| `equipe_coherente` | identifiants et masque cuit, à 5 points |
| `debord_lateral` | ±0,47 case depuis le pivot, contour compris, toutes les images (superusine 0,6) |
| `emprise_sol` | le modèle au repos tient dans ±0,47 m en x et en z (superusine 0,6) |
| `hauteur_pivot` | 0,85 case au plus au-dessus du pivot, contour compris |
| `hauteur_qg` | le QG plus haut que tout bâtiment figurine installé, les autres plus bas que le QG (information tant qu'il n'y a rien à comparer) |
| `coin_mat` | libre |
| `emission` | en service : 1 % des pixels ou plus à 128 sur 255 ; désaffecté et superusine prise : aucun pixel au-dessus de 16 |
| `palette_orange` | 0 hors de la superusine ; présent en service, absent prise |
| `au_sol`, `teintes` (6), `budget`, `materiaux`, `epaisseur`, `cuisson_entiere`, `controle_fiche` | comme les unités |
| `repos_immobile`, `repos_agitation` | aucun nœud ne bouge au repos hors d'un nœud `mobile` ou `tournant` (une parabole, une grue lente) ; au plus 1 % des pixels change d'une image à l'autre |
| `recouvrement` | information : l'ombre chinoise à 48 px (alpha au-dessus de 204, sous lequel reste l'ombre cuite) contre chaque bâtiment installé d'une autre clé |

Le pont n'a que `equipe_absente` (0), `au_sol`, le repos, la palette et ce qui
est commun : il n'a ni mât ni fenêtre, et il touche les cases voisines.

### Ce que la planche montre

La première rangée : le bâtiment en service dans les quatre camps, **neutre**
(le gris des bâtiments sans maître, `COULEUR_NEUTRE`, et le **mât nu** que le
rendu doit poser, plan §4), et de nuit (le voile de la nuit du rendu et
l'émission pleine) en bleu et en neutre ; puis une rangée par variante ; le
désaffecté neutre, sans mât dessiné, de jour et de nuit. Le mât et le drapeau
sont dessinés comme le rendu les dessine (`replis.ts`). Puis les mêmes à
48 px, vraie taille et agrandies trois fois ; un plateau de cases où le
bâtiment côtoie des unités installées (infanterie, char léger, char moyen) ;
et les règles qui échouent, entrée par entrée.

### Ce que la ville a appris

- **L'équipe se gagne par les pignons.** Un pan tourné sur le côté se voit
  exactement comme son emprise au sol (0,77 de sa surface), quelle que soit sa
  pente ; un pan tourné vers le joueur, plus (0,77 + 0,64 × la pente) ; un mur
  qui regarde le joueur, 0,64 de sa surface. La première ville, quatre
  maisons aux toits tournés vers le joueur, était à 72 % d'équipe : pignons
  sur rue, murs plus hauts, maisons moins profondes, elle est tombée à 42 %
  sans rapetisser ses toits. `--sans-cuisson` donne la part des identifiants
  en deux secondes.
- **Deux fenêtres seules côte à côte sous un pignon font un visage**, et la
  nuit deux yeux qui s'allument. Trois, ou deux rangées.
- **Le repos immobile se cuit quand même en douze images**, que la cuisson ne
  fusionne pas : Cycles ne rend pas deux fois le même bruit. C'est le poids
  d'une page, pas une faute du bâtiment ; à régler dans la cuisson s'il le faut.

### Ce que vous ne touchez pas

Votre seul fichier est `batiments/<cle>.py`, et vos essais vont dans
`tmp/figurines/batiments/<cle>/essais/` (`--module …/essais/<nom>.py
--sortie …/essais/<nom>`). Tout le reste est comme pour une unité : ni
`bibliotheque.py`, ni `charte.json`, ni `fabriquer.*`, `batiments.ts`,
`lot.ts`, `mesures*.ts`, `planche*.ts`, `lecture.ts`, `charte.ts`, ni
`scripts/sprites/`, `public/`, `src/`, `assets/specs/`, `content/` ; aucune
opération git ; aucune fonction privée de la bibliothèque. Une primitive qui
manque, une règle qui vous paraît fausse : dites-le dans votre rapport.

## Comment c'est fait, en bref

- `charte.json` : la source unique des valeurs. `charte.ts` peint l'atlas
  (chaque teinte a sa case, dans l'ordre de la liste : une teinte s'ajoute
  **en fin de liste**, jamais au milieu) ; `bibliotheque.py` pose les UV de
  chaque pièce dans la case de sa teinte, à la même règle.
- `fabriquer.py` (Blender 5.1) construit, exporte le GLB brut et rend les
  images d'identifiants (Workbench, à plat, sans anticrénelage, sous la caméra
  exacte de la cuisson : R = 10 × (indice de teinte + 1), G = 255 sur une
  pièce tournante) ; le balayage des pièces tournantes est rendu à part. La
  cadence et l'obturateur de la cuisson (`IMAGES_PAR_SECONDE`,
  `IMAGES_MAX_PAR_CLIP`, `FLOU_DE_BOUGE`) sont lus à leur source par
  `fabriquer.ts` et posés sur la bibliothèque ; elle n'en garde qu'un repli,
  qu'un test tient égal à la source.
- **Le même module rend le même GLB, à l'octet.** `create_uvsphere` soudait ses
  pôles par une table indexée sur des adresses mémoire : l'ordre des triangles
  d'une boule (têtes, mains, boules d'antenne) changeait d'un lancement à
  l'autre, et la cuisson recuisait pour rien. La boule est construite sommet
  par sommet (mêmes sommets, mêmes diagonales qu'avant) ; les dix unités de la
  vague, construites deux fois, rendent deux GLB identiques.
- Un couvercle **concave** (un U, une marche, une clé fendue) est triangulé à
  la construction, par la méthode « beauté » de Blender : laissé en polygone,
  sa triangulation paresseuse peut jeter un triangle en travers du creux. Un
  couvercle convexe reste un polygone ; trois points alignés ne font pas un
  creux (les sommets de Blender sont en simple précision : le seuil est un
  sinus de 10⁻⁴).
- **La cuisson rend chaque image dans une scène neuve** (`cuire_entree.py`,
  `use_persistent_data = False` ; `VERSION_CUISSON` 4, 24 septembre 2026,
  nuit). Avec les données persistantes et le flou de bouge, Cycles gardait
  d'une image à l'autre un état d'objet périmé : la première image immobile
  après un mouvement — l'image 8 du `tir` (0,622 s) ou du `hors_jeu` —
  sortait ombrée comme si ses normales avaient tourné, même silhouette au
  pixel près, 6 à 12 % plus sombre. Le défaut dépend de l'histoire : la même
  image rendue la première sort juste. Deux parades ont échoué avant
  celle-ci : reprendre la transformation de chaque objet avant chaque image
  (version 3 ; le chasseur, cuit ainsi, avait encore son image 8 sombre, et le
  porte-avions l'a reproduite), et reprendre aussi la géométrie (`'DATA'`),
  qui rendait par intermittence des faces noires sans couverture ni masque à
  partir d'une image — très probablement le drone intercepteur, le drone
  ravitailleur et le chasseur, cuits entre 1 h 01 et 1 h 22 le 24 septembre.
  Sans persistance, le char léger se cuit en 126 s au lieu de 99, sans une
  image isolée plus sombre. Un EXR illisible (vu deux fois sous une charge de
  90) est rendu une seconde fois avant d'échouer.
- `lot.ts` pose les cartes (PNG voisins aux noms de la fiche, le masque en
  image que nul matériau ne lit) et les clips (échantillonnés à 60 images par
  seconde, linéaires, temps bornés), et assemble le lot.
- La cuisson d'essai est `scripts/sprites/cuire.ts --liste … --sortie …
  --temporaire … --couverture` : la même chaîne que le jeu, contour compris
  (`charte.json`, `contour`), dans ses propres brouillons.
- `mesures.ts` et `planche.ts` composent comme le nuanceur du jeu
  (`couleur × mix(1, équipe, masque)`, `src/render2d/lot.ts`), avec l'ombre
  d'unité du rendu (`OMBRE_UNITE`).
