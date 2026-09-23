# Les figurines — mode d'emploi d'un agent d'unité

Le socle commun des trente unités refaites de zéro (23 septembre 2026). Un
agent d'unité **n'écrit qu'un fichier** : `unites/<cle>.py`. Tout ce qui fait
la cohésion du lot — la palette, le masque d'équipe, le chanfrein, le lissage,
les nœuds de la fiche, les clips, l'export, le contrôle, la cuisson d'essai,
les mesures — est ici et ne se recopie pas.

Le pilote est `unites/char_leger.py` : lisez-le avant d'écrire le vôtre.

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
`f.noeud(nom, parent=..., pivot=..., tournant=...)` règle un nœud de la fiche
ou en crée un : **une pièce qui doit bouger seule a son nœud** (un canon qui
recule, un galet qui tourne, une antenne), et son pivot est le point autour
duquel elle tourne (le tourillon, l'axe). `tournant=True` : une pièce qui tourne
sans fin (rotor, parabole radar) — `rotor()` le pose lui-même. Un nœud n'a
jamais de rotation au repos : tout se modèle en place. La `racine` ne s'anime
jamais.

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
forme manque, `solide` la fait, sinon dites-le.

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
| `boule(noeud, centre, rayon, teinte, etirement=(1,1,1), nom=None)` | | têtes, boules-caméras, bérets |
| `prisme(noeud, profil, largeur, teinte, centre_x=0, chanfrein=None, nom=None, rotation=None, origine=None)` | `profil` : points (z, y) du côté, l'avant à droite ; `rotation` : liste de (axe, degrés), autour du milieu de l'emprise ; avec `origine`, le profil est donné depuis ce point et tourne autour de lui ; un profil concave (une clé fendue, une marche) est bien fermé | toute forme vue de côté ; une plaque tenue au poing |
| `extrusion(noeud, bas, haut, y0, y1, teinte, chanfrein=None, nom=None)` | deux contours (x, z) vus de dessus, de même nombre de points ; `haut` rentre (une épaule qui prend la lumière) ou vaut None ; concave permis (un U) | coques, châteaux, toits, rebords |
| `b.contour_rectangle(cx, cz, lx, lz, rayon=0, n_coin=6)` | un rectangle (x, z) aux coins arrondis, dans le sens qu'`extrusion` attend ; deux contours au même `n_coin` se répondent point à point | le bas et le haut d'une extrusion |
| `solide(noeud, anneaux, teinte, origine=None, rotation=None, chanfrein=None, fin=False, nom=None)` | des anneaux de points (x, y, z), de même nombre, reliés l'un au suivant, les deux bouts bouchés ; avec `origine`, points donnés depuis elle et rotation autour d'elle | **tout solide à section donnée** : tourelle libre, bac ouvert (dehors puis dedans), dalle, casque à arête |
| `fuseau(noeud, profil, z0, z1, teinte, sections=64, exposants=(2,2), nom='fuseau')` | `profil(z)` → (demi-largeur, ligne la plus large, hauteur dessus, hauteur dessous) ; `exposants` : le dessus puis le dessous, 2 une ellipse, 1 un V | un fuselage que `fuselage` ne sait pas dire, sans chanfrein |
| `membre(noeud, a, b, rayon, teinte, nom=None)` | une capsule d'une articulation à l'autre, bouts centrés sur elles : deux membres qui se suivent font un coude rond | bras et jambes remodelés, un fusil tenu d'une main à l'autre |
| `revolution(noeud, centre, profil, teinte, axe='y', chanfrein=None, nom=None)` | `profil` : (rayon, position le long de l'axe), du bas vers le haut | bols, dômes, casques |
| `roue(noeud, centre, rayon, largeur, teinte_pneu='caoutchouc', teinte_moyeu='os', axe='x', part_moyeu=0.5)` | pneu arrondi et moyeu qui dépasse | véhicules à roues |
| `chenille(noeud, x, longueur, hauteur, largeur, y_bas=0, z_centre=0, teinte='caoutchouc')` | un stade vu de côté, centré en `x` | trains de chenilles |
| `galets(noeuds, x, zs, y, rayon, epaisseur, teinte='graphite', teinte_moyeu=None, part_moyeu=0.45, meplat=False)` | un galet à ±x par `z` ; `noeuds` : un nom, ou un nœud par essieu (pivot posé sur l'axe) ; `part_moyeu` : le rayon du moyeu en part du galet (0,62 : les six galets du char lourd se comptent à 48 px) ; `meplat` : le moyeu en « D », qui montre que le galet roule en `deplacement` — un moyeu rond et centré ne le montre pas | galets qui tournent |
| `caisse_char(noeud, longueur, largeur, y_bas, hauteur, teinte='equipe', glacis=0.45, arriere=0.25, z_centre=0)` | glacis avant incliné, arrière fuyant | caisses de blindés |
| `tourelle(noeud, centre, largeur, longueur, hauteur, teinte='equipe', forme='ronde'\|'carree', inclinaison=0.18, chanfrein=None)` | `centre` = milieu de sa base ; `carree` : un tronc de pyramide symétrique | tourelles |
| `tourelle_profil(noeud, centre, contour, hauteur, teinte='equipe', retraits=(0,0,0), biseau=0, part_biseau=0.45, chanfrein=None)` | `contour` : la base vue de dessus, points (x, z) depuis le centre (coins coupés, masque en pointe) ; les flancs rentrent de `retraits` = (avant, arrière, côtés) en montant ; `biseau` rentre encore le haut sur `part_biseau` de la hauteur : un pan qui prend la lumière | tourelles au contour libre |
| `tube(noeud, depart, direction_tube, longueur, rayon, teinte='graphite', bouche=True, teinte_bouche='acier_clair', rayon_bouche=None, longueur_bouche=None)` | le manchon de bouche au bout ; la bouche est **jugée avec son tube** (épaisseur) : un manchon de 4 cm ne fait plus échouer la règle | canons, tubes |
| `bac_tubes(noeud, centre, colonnes, lignes, rayon_tube, longueur, direction_tubes='z', teinte_bac='equipe', teinte_tubes='os', ecart=None)` | une boîte et ses bouts de tubes | lance-roquettes, lance-missiles |
| `parabole(noeud, centre, rayon, profondeur, direction_parabole, teinte='os', epaisseur=0.02)` | un bol épais et son cornet | radars (pas le brouillage : arête de poisson) |
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
bouche d'un tube et le moyeu en « D » d'un galet le sont d'office.

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
| `equipe_eclairee` | 60 % des pixels d'équipe reçoivent au moins 0,8 de lumière : l'équipe est sur les dessus (seuil proposé, non arrêté ; information pour les fantassins). **La laque plafonne vers 0,9, pas 1,0** : mesuré sur les dix unités cuites, un dessus plat sort à 0,86–0,88 (238–241 sur 255), seules les faces tournées vers le joueur, sous le reflet de la principale, saturent. Le calcul lambertien (`clarteFace`, `scripts/sprites/reglages.ts`) donne 1,0 à un dessus plat et fait passer une pente d'équipe sous 0,8 vers 55° quand elle descend vers le côté ou l'arrière (75° vers le joueur) ; la laque en rend une part en reflet : dans l'image cuite, c'est plus tôt |
| `equipe_coherente` | la part d'équipe des identifiants et celle du masque cuit disent la même chose (vos UV tombent dans les bonnes cases) |
| `largeur` (et `hauteur` d'un fantassin), `largeur_visee` | la silhouette en vue droite, **contour compris**, en cases de 128 px : petite 0,60–0,68, moyenne 0,76–0,84, grande 0,88–0,94 ; fantassins 0,36–0,50 × 0,68–0,75 |
| `debord_lateral`, `hauteur_pivot` | dans toutes les images de carte : rien au-delà de ±0,47 case du pivot, rien au-dessus de 0,70 case (0,85 en vol) |
| `altitude`, `au_sol` | le bas du modèle au repos |
| `repos_agitation`, `repos_rotation` | au plus 3 % de pixels qui changent entre deux images du repos (15 % en vol), aucune pièce qui pivote de plus de 2° — les pièces tournantes déclarées exclues |
| `palette_*` | sur les identifiants, vue droite : la masse sombre (graphite et caoutchouc) 20–35 % et **en bas** de la silhouette — ce « en bas » ne compte pas les pièces tournantes : un rotor graphite, en haut, n'assoit pas l'unité —, os ≤ 12 %, acier clair ≤ 3 %, verre ≤ 8 %, feux ≤ 1 % ; orange 4–6 % et apprêt ≤ 25 % pour les Gris |
| `teintes`, `budget`, `materiaux`, `epaisseur` | six teintes au plus, 60 000 triangles, les matériaux de la fiche, aucune pièce sous 0,05 m (antennes, pales, flottaison : 0,03 m ; une pièce jugée avec une autre, avec elle) |
| `recouvrement` | **information** : l'ombre chinoise à 48 px — l'alpha de l'image cuite, contour compris, ramené à 48 px par case et calé sur le pivot — contre chaque unité du **même milieu** déjà dans les images du jeu (`public/assets/sprites/`, manifeste courant, l'unité elle-même exceptée) ; la valeur est l'intersection sur l'union (IoU) la plus forte des vues droite et bas, avec le nom de l'unité. Seuil de la charte : 0,80 (§3.5) |

La classe de taille est la taille de silhouette du canon (`content/unites.json`,
`silhouette.taille`) ; le genre (véhicule, fantassin, rotor, avion, drone,
navire) se déduit du canon, et `GENRE = '…'` le corrige.

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
- `lot.ts` pose les cartes (PNG voisins aux noms de la fiche, le masque en
  image que nul matériau ne lit) et les clips (échantillonnés à 60 images par
  seconde, linéaires, temps bornés), et assemble le lot.
- La cuisson d'essai est `scripts/sprites/cuire.ts --liste … --sortie …
  --temporaire … --couverture` : la même chaîne que le jeu, contour compris
  (`charte.json`, `contour`), dans ses propres brouillons.
- `mesures.ts` et `planche.ts` composent comme le nuanceur du jeu
  (`couleur × mix(1, équipe, masque)`, `src/render2d/lot.ts`), avec l'ombre
  d'unité du rendu (`OMBRE_UNITE`).
