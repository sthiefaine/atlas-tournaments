# Les supers des Gris — le matériel sans dossier (conception)

*10 septembre 2026. Deux fichiers, et rien d'autre : ce document et `doc/refonte/supers-vilains.json`. Le moteur, le contenu et `git` ne sont pas touchés. Les trois familles nouvelles (`frappe_zone`, `rayon_laser`, `iem`) sont câblées en parallèle par un ingénieur moteur ; un agent transcrira ensuite les huit supers dans `content/commandants-capacites.json`. Les huit pouvoirs normaux et les huit passifs de la révision 4 ne bougent pas : ce lot ne touche que le **super** de chaque Gris. Tout ce qui est inventé ici est marqué **[Proposition]**.*

## 1. Le principe : un super, c'est une pièce sans dossier

La bible dit deux choses qu'aucun kit n'avait encore lues ensemble. D'abord, §3.2 : le matériel a quatre statuts, et le badge orange de l'**essai** est ce que les Gris portent en permanence — « une pièce à l'essai est une pièce surveillée ; une pièce non homologuée est une pièce qui triche. La Cinquième Manche joue précisément sur la confusion entre les deux. » Ensuite, §5.3 : sur un terrain homologué, tout marque et rien ne blesse, parce que **le matériel est contrôlé** ; le matériel non homologué est donc « le scandale absolu de ce monde — et une arme narrative pour la Cinquième Manche ».

Un pouvoir national, c'est un commandant qui joue mieux. Un super de Gris, c'est **une pièce qui n'a pas le droit d'être là**. C'est la règle d'écriture de tout ce qui suit, et elle a quatre conséquences :

1. **Chaque super a une pièce.** Un nom, une silhouette dans le vocabulaire de `pieces.ts` (bases, corps, modules — jamais un modèle de plus), et ce qui lui manque : le badge orange, la plaque de série, le dossier à la Commission. Ce n'est pas une unité du catalogue : c'est ce que l'arbitre voit, et ce que Vantour commente.
2. **Chaque déclenchement est un protêt.** Nera Aldouin tient les archives des protêts, « le seul endroit où les anomalies du tournoi sont écrites noir sur blanc » (§3.3). La première fois qu'un super part, une ligne s'ajoute au dossier. Le joueur ne gagne rien sur le moment ; il gagne une **pièce à charge**, et c'est le §4 qui dit quand elle sert.
3. **Atlas ne surprend jamais un commandant.** L'IEM de station a une position, un rayon et un calendrier publics (`technologies.ts`, annonce la veille). Un super de Gris est plus rare et plus brutal, mais il obéit à la même loi : la jauge adverse est visible, la pièce est visible, et le Bulletin dit, un tour avant, ce qui peut partir. Ce que le joueur ne connaît pas, c'est **la case** — c'est là que se joue son contre-jeu.
4. **Ils touchent les siens aussi.** `frappe_zone` et `iem` frappent les deux camps dans le rayon. C'est mécaniquement ce qui rend la case choisissable (on vise où l'on n'a personne) et narrativement ce qui dit que ce matériel n'a pas de dossier : une pièce homologuée sait qui elle marque.

Le vocabulaire est celui du §7.2 de `doc/04` plus les trois familles réservées aux Gris, avec leurs bornes : `frappe_zone` (`pv` 1–3, `rayon` 0–2, case choisie), `rayon_laser` (`pv` 1–5, `nombre` 1–3, `choix` `plus_cheres | plus_avancees`, pas de case), `iem` (`rayon` 1–3, `abattre`, case choisie ; seule famille du jeu qui met hors jeu directement). Super 5 à 9 barres, `abattre` au moins 8, un seul effet « choisi sur une case » par super.

## 2. Les huit supers

Ordre des premières apparitions en adversaire principal (`opus1-tutoriels-final.json`) : Ost F01, Basile F02, Maël F03, Lise F04, Yuna F05, Relais Zéro F06, Sélène F08, Edran F10. Aucun super n'est vu avant la première apparition de son commandant, et aucune réplique n'expose la fratrie ni la paternité avant la finale 10.

### 2.1 Hadran Ost — **« Grêle »** · 8 barres · `opus1_finale_01`

**[Proposition]** Remplace « Le bloc avance » (−1 PV à toute l'armée adverse, chenilles ×1,3 et +1). Pourquoi : le propriétaire veut des supers qui ne soient pas « −1 PV à toute l'armée », et le visage des Gris doit porter le super qu'on retient — celui de la première finale. Avec « Grêle », Ost devient le Sturm de la table, et le −1 à tout le monde reste la signature d'un seul Gris, Basile, ce qui sépare enfin les deux.

**Phrase.** Il choisit une case ; tout ce qui est à 2 cases ou moins perd 2 PV, ses chenilles comprises — c'est pourquoi il tire devant le bloc, jamais dedans —, puis ses chenilles gagnent +1 de mouvement et avancent dans le trou.

```json
{ "nom": "Grêle", "barres": 8, "duree": "ce_tour",
  "effets": [
    { "cible": "terrain", "frappe": { "pv": 2, "rayon": 2 } },
    { "cible": "mes_unites", "filtre": { "mouvement": ["chenilles"] }, "modificateur": { "quoi": "mouvement", "valeur": 1 } }
  ] }
```

**La pièce.** **[Proposition]** *La Batterie sans plaque* — un bloc à chenilles de taille 3 portant un rail de douze tubes gris, sans badge orange, sans plaque de série, sans dossier : Ost la présente comme « une pièce à l'essai dont le dossier est en cours » depuis deux Rondes (`chenilles · bloc · [lance_roquettes, antenne] · 3`).

**Télégraphie.** La jauge d'Ost est visible sous son portrait ; quand elle atteint 8 barres à la fin de son tour, le Bulletin écrit « Batterie sans plaque en charge — Grêle possible au prochain tour » et le portrait prend le badge orange **barré**. Survoler la ligne montre le gabarit du rayon 2 (13 cases) sur la carte. La case reste son choix.

**Contre-jeu.** Disperser : treize cases, c'est deux unités espacées d'une case chacune, pas une colonne ; et garder une unité au contact des siennes — il ne tire pas où il a du monde.

**Réplique.** « La Sélection Méridienne n'a pas besoin de contourner. Il grêle, et le bloc avance. »

**Vantour.** « Douze tubes, aucune plaque — je cherche le badge orange, et je ne le trouve pas, mesdames et messieurs. »

### 2.2 Sélène Veyr — **« Délestage »** · 8 barres · `opus1_finale_08`

**[Proposition]** Remplace « Tutelle du réseau » (revenus ×2, capteurs ×1,5). Pourquoi : la tutelle ne faisait peur qu'à qui lit le trésor. Le délestage — le mot exact d'un réseau qui coupe ses clients pour se protéger — est ce que la Cinquième Manche fait au monde, et c'est un super sans missile, sans laser, sans impulsion, qui fait peur en une phrase.

**Phrase.** Pendant 2 journées, tout ce qui a un moteur dans le camp adverse brûle le double de carburant par tour, ses captures comptent moitié, et le Consortium encaisse le double.

```json
{ "nom": "Délestage", "barres": 8, "duree": { "type": "journees", "n": 2 },
  "effets": [
    { "cible": "unites_adverses", "filtre": { "mouvement": ["roues", "chenilles", "air", "mer"] }, "modificateur": { "quoi": "carburant", "valeur": 2 } },
    { "cible": "unites_adverses", "modificateur": { "quoi": "capture", "valeur": 0.5 } },
    { "cible": "economie", "modificateur": { "quoi": "fonds", "valeur": 2 } }
  ] }
```

Ce que le chiffre veut dire : un chasseur à 5 par tour passe à 10, un furtif à 8 passe à 16 ; un appareil qui était à deux tours de la panne sèche n'en a plus qu'un, et la panne sèche met hors jeu. Ce n'est pas un dégât, c'est une échéance.

**La pièce.** **[Proposition]** *Le Coupleur* — une armoire grise vissée sur le poste de distribution du terrain, absente du relevé de la Cartographie, qui permet au Consortium de compter le courant des deux camps et de le couper d'un côté (`roues · bloc · [antenne, panneaux_solaires] · 2`, posée au pied de son QG comme un décor : on la voit dès la première journée, et elle ne se capture pas).

**Télégraphie.** Le Coupleur est sur la carte dès J1, et le briefing le nomme. Jauge visible ; à 8 barres, Bulletin : « Coupleur armé — Délestage possible au prochain tour ». Une fois déclenché, les deux colonnes suivantes du Bulletin portent l'icône du délestage, comme une météo imposée.

**Contre-jeu.** Poser les appareils sur un aéroport ou un porte-avions avant son tour, ne pas entamer une capture longue quand sa jauge est pleine, et lui prendre des bâtiments : c'est le seul super qui ne retire rien, il ne fait que rendre son adversaire dépendant.

**Réplique.** « Le réseau se protège : délestage sur votre secteur. Vous serez rétablis quand nous aurons fini de compter. »

**Vantour.** « Pas un tir, pas un nuage, et regardez les jauges de carburant tomber — c'est la première fois que je commente une facture. »

### 2.3 Maël Orven — **« Rasante »** · 7 barres · `opus1_finale_03`

**[Proposition]** Remplace « Ciel de manœuvre » (les appareils rejouent). Pourquoi : Eagle est un super de champion, pas de vilain ; et « rejouer » existe déjà chez Awa, Devika et Ren. Le pilote des Gris ne fait pas un second passage : il pique sur la tête de colonne.

**Phrase.** Ses deux appareils passent en rasante : les 2 unités adverses les plus avancées perdent 3 PV chacune, où qu'elles soient.

```json
{ "nom": "Rasante", "barres": 7, "duree": "ce_tour",
  "effets": [
    { "cible": "unites_adverses", "laser": { "pv": 3, "nombre": 2, "choix": "plus_avancees" } }
  ] }
```

**La pièce.** **[Proposition]** *Le Rapace* — une aile delta sans dérive portant sous le ventre un marqueur à faisceau, dont le badge orange a été **peint puis gratté** : c'est pire qu'un badge absent, c'est une pièce qui a eu un dossier et l'a quitté (`ailes · plateau · [antenne] · 3`). Le faisceau marque sans charge, hors de portée de riposte : le règlement n'a pas de mot pour ça, donc pas d'article.

**Télégraphie.** Le choix est déterministe et sans case : quand la jauge de Maël est pleine, **les deux unités qu'il frapperait maintenant portent un chevron orange** au-dessus de leur étiquette (« désignées »), recalculé à chaque mouvement du joueur. Le Bulletin l'écrit. C'est la télégraphie la plus honnête de la table : on sait exactement qui, on ne sait pas quand.

**Contre-jeu.** Ne pas mettre en tête ce qu'on ne veut pas perdre : la pointe, c'est deux infanteries à 1 000, pas le char lourd ; et une unité désignée qui recule d'une case passe le chevron à la suivante.

**Réplique.** « Rasante sur la tête de colonne. On ne se pose pas, on n'a pas le temps. »

**Vantour.** « Un passage, deux marques, aucune charge tirée — on vient de voir une pièce faire quelque chose que le règlement ne sait pas nommer. »

### 2.4 Lise Varen — **« Zone rouge »** · 7 barres · `opus1_finale_04`

**[Proposition]** Remplace « Passages verrouillés » (chenal de 3 cases + pièces ×1,2). Pourquoi : un super qui pose du terrain est laissé au joueur par l'IA (`doc/04` §7.2, « l'IA ne sait pas choisir des cases ») — Lise ne le déclenchait donc jamais. Et l'organisatrice de parcours qui « concevait des zones de sécurité pour les marqueurs lourds » a un super tout écrit : la zone où l'on n'entre pas.

**Phrase.** Elle choisit une case ; les 5 cases de la croix perdent 3 PV — les siennes comprises —, et ses pièces de portée tirent 1 case plus loin jusqu'à son prochain tour.

```json
{ "nom": "Zone rouge", "barres": 7, "duree": "tour_complet",
  "effets": [
    { "cible": "terrain", "frappe": { "pv": 3, "rayon": 1 } },
    { "cible": "mes_unites", "filtre": { "types": ["artillerie", "roquettes", "missiles_sol", "missiles_air", "cuirasse"] }, "modificateur": { "quoi": "portee", "valeur": 1 } }
  ] }
```

Contre Ost, c'est l'inverse : étroit et profond (5 cases, −3) là où Grêle est large et plate (13 cases, −2). Le joueur apprend deux gestes différents : on se disperse contre Ost, on ne s'empile pas contre Lise.

**La pièce.** **[Proposition]** *Le Repère* — un marqueur lourd sur roues dont le tube fait deux fois la longueur du catalogue, calé sur les béquilles de sécurité qu'elle dessinait autrefois pour les autres ; badge orange en règle sur le châssis, **aucun** sur le tube, qui n'est pas celui du dossier (`roues · bloc · [canon_long, lance_roquettes] · 3`).

**Télégraphie.** Jauge visible ; à 7 barres, Bulletin « Repère calé — Zone rouge possible au prochain tour », gabarit de la croix au survol. Pendant son tour, quand la pièce tire, la case visée est balisée en rouge **avant** la chute (le geste de partition `chiffre` existe ; un geste `baliser` est à écrire dans la peau 3D).

**Contre-jeu.** Jamais trois unités en croix ; approcher par le flanc, vite, avec de la reconnaissance — sa faiblesse tient toujours : ce qu'elle déplace ne tire pas.

**Réplique.** « La zone est rouge. Vous y êtes entrés, c'est votre choix, pas le mien. »

**Vantour.** « Un tube qui n'est pas celui du dossier, et une zone qu'elle appelle de sécurité — je n'ai jamais vu une case aussi peu sûre. »

### 2.5 Edran Sorel — **« La relève arrive »** · 8 barres · `opus1_finale_10`

**[Proposition]** Remplace « Deuxième ligne » (prix ×0,6 et +1 de mouvement). Pourquoi : son plan est « engager une deuxième ligne ravitaillée après avoir épuisé les réserves adverses » ; à moitié prix, c'était Hachi. La relève, c'est que ce qui roule **rejoue** — un Eagle au sol, ce que la table n'avait pas — et qu'il n'a besoin ni de missile ni de laser pour être le plus dur des huit : c'est un logisticien.

**Phrase.** Toutes ses unités refont le plein et les charges, et ses roues et chenilles qui ont déjà agi rejouent une fois ce tour.

```json
{ "nom": "La relève arrive", "barres": 8, "duree": "ce_tour",
  "effets": [
    { "cible": "mes_unites", "ravitailler": { "carburant": true, "munitions": true } },
    { "cible": "mes_unites", "filtre": { "mouvement": ["roues", "chenilles"] }, "reactiver": true }
  ] }
```

**La pièce.** **[Proposition]** *Le Convoi sans manifeste* — trois transports dont la cale porte des batteries de relève qui ne figurent sur aucun manifeste d'entrée de terrain : une chenille à sec repart au plein en un tour, ce qu'aucune pièce homologuée ne fait sur place (`roues · bloc · [grue] · 2`). C'est le matériel le plus discret des huit, et le plus grave : ce sont **les batteries d'Aube**, celles dont Maël a manqué avant la Ronde XIV, sorties d'un dépôt méridien sans bordereau.

**Pourquoi F10 et pas F15.** F10 exige que la fermeture stratégique soit « annoncée par le trafic des réserves et une route visible », sans « bonus de dégâts caché ». La relève ne fait aucun dégât, elle se voit venir (des transports sur une route), et elle est précisément ce qui ferme la nappe : le joueur comprend qu'il ne pourra pas tenir parce que la deuxième ligne rejoue. Le super sert la défaite écrite sans la truquer. La jauge d'Edran à son entrée en J3 est **à trancher** (§6).

**Télégraphie.** Le convoi est trois unités visibles sur une route visible ; le Bulletin les nomme dès leur entrée (« convoi sans manifeste sur la route est »). Jauge visible ; à 8 barres, « La relève arrive possible au prochain tour ». Après déclenchement, les unités réactivées portent l'étiquette `reactivation` déjà prévue par le moteur.

**Contre-jeu.** Isoler ses routes et frapper les transports : sans convoi, la relève est un `ravitailler` à 8 barres ; et ne jamais échanger à égalité à la fin de son tour — ce qui a tiré retirera.

**Réplique.** « La colonne est arrivée ce matin, et elle n'a pas fini. Deuxième passage : la relève est là. »

**Vantour.** « Trois transports, pas un manifeste, et une ligne qui rejoue — je ne sais pas ce qu'il y a dans ces caisses, et je crois que personne à Atlas ne le sait non plus. »

### 2.6 Yuna Serrat — **« Mise sous scellés »** · 7 barres · `opus1_finale_05`

**[Proposition]** Remplace « Le réseau bascule » (capture ×3, pied +2). Pourquoi : la relecture de `pouvoirs-v4.md` gardait « capture puis capture plus grosse » pour la lisibilité — et c'est resté vrai au pouvoir. Au super, la négociatrice de mandats a mieux : un mandat qui **scelle** le matériel adverse, pendant que ses petites équipes à pied passent. L'IEM n'immobilise que ce qui a un moteur : c'est exactement le super d'une commandante dont les capteurs marchent.

**Phrase.** Elle choisit une case ; dans un rayon de 2, tout ce qui a un moteur — des deux camps — est scellé jusqu'à la fin de son prochain tour (ni bouger, ni riposter), et ses capteurs capturent ×2 ce tour.

```json
{ "nom": "Mise sous scellés", "barres": 7, "duree": "ce_tour",
  "effets": [
    { "cible": "terrain", "iem": { "rayon": 2, "abattre": false } },
    { "cible": "mes_unites", "filtre": { "types": ["infanterie", "meca", "genie"] }, "modificateur": { "quoi": "capture", "valeur": 2 } }
  ] }
```

**La pièce.** **[Proposition]** *La Borne de scellés* — une borne d'émission grise montée sur un camion léger, peinte aux couleurs d'un scellé de concession, avec le numéro de mandat au pochoir à la place du badge orange : un numéro de mandat n'est pas un numéro d'homologation, et Nera est la première à le dire (`roues · bloc · [antenne, radar] · 2`).

**Télégraphie.** Jauge visible ; à 7 barres, Bulletin « Borne en charge — Mise sous scellés possible au prochain tour », gabarit du rayon 2 au survol. Une unité scellée porte l'icône de l'IEM de station déjà prévue (`iemJusquaJournee`, icône `radar`).

**Contre-jeu.** Tenir les bâtiments avec des fantassins, pas des chars — le scellé ne touche pas ce qui marche — et frapper ses capteurs pendant son tour : ses propres roues sont scellées aussi, elle ne peut pas les couvrir.

**Réplique.** « Mandat provisoire, scellés définitifs. Vous serez consultés à la levée des scellés, comme tout le monde. »

**Vantour.** « Un mandat au pochoir sur une borne sans badge : elle vient de mettre sous scellés du matériel homologué avec du matériel qui ne l'est pas. »

### 2.7 Basile Kelm — **« Réserves fermées »** · 8 barres · `opus1_finale_02` — **conservé**

**Conservé tel quel** (−1 PV à toute l'armée adverse, vision −2 pendant une journée). Pourquoi : il a été mesuré le 10 septembre au soir (40/60 · 70/30 contre Ariane, 55/45 · 35/65 contre Tomas), sa faiblesse a été corrigée pour lui, et « −n PV à toute l'armée » est la signature déclarée des Gris — il faut qu'un Gris la porte, et avec Ost passé à la grêle, c'est lui seul. Ce que ce lot lui **ajoute**, c'est la pièce et le dossier : un super qui n'en avait pas.

**Phrase.** Toutes les unités adverses perdent 1 PV, et pendant une journée elles voient 2 cases de moins.

```json
{ "nom": "Réserves fermées", "barres": 8, "duree": { "type": "journees", "n": 1 },
  "effets": [
    { "cible": "unites_adverses", "modificateur": { "quoi": "degats_directs", "valeur": 1 } },
    { "cible": "unites_adverses", "modificateur": { "quoi": "vision", "valeur": -2 } }
  ] }
```

**La pièce.** **[Proposition]** *Le Verrou* — le coffret de commande des dépôts du terrain, gris, sans badge, qui parle à **tous les plastrons de marquage** présents sur la carte et leur fait enregistrer une marque à distance. C'est la pièce la plus scandaleuse des huit et la moins spectaculaire : elle ne tire rien, elle détourne le système de marquage d'Atlas lui-même — l'article 2 du Pacte, pris à l'envers (`chenilles · bloc · [radar, antenne] · 3`, posé au QG).

**Télégraphie.** Jauge visible ; à 8 barres, Bulletin « Verrou armé — Réserves fermées possible au prochain tour ». Après déclenchement, la colonne suivante du Bulletin porte l'icône de vision réduite, comme une brume.

**Contre-jeu.** Ne pas s'attarder devant ses portes quand sa jauge est pleine, et garder un drone ou un bâtiment pour voir : un bâtiment possédé garde sa vision, le −2 ne touche que les unités.

**Réplique.** « Les réserves sont fermées. Ce qui est dehors y reste, et vos écrans s'éteignent avec. » *(inchangée)*

**Vantour.** « Tous les plastrons du terrain viennent de sonner en même temps — ce n'est pas une pièce, ça, c'est une clé, et elle n'est pas censée exister. »

### 2.8 Relais Zéro — **« Retour à zéro »** · 9 barres · `opus1_finale_06`

**[Proposition]** Remplace « Réseau sans écho » (brouillard 2 journées, drones vision +2 et défense ×1,2). Pourquoi : le brouillard était le moment « le ciel change », et il reste au **pouvoir** de Relais Zéro par la vision. Le commandant sans visage porte la seule famille qui met hors jeu directement, parce que c'est le seul des huit qui n'a rien à perdre à être vu faire : il n'a pas de nom.

**Phrase.** Il choisit une case ; dans un rayon de 2, tout ce qui a un moteur — des deux camps — s'arrête jusqu'à la fin de son prochain tour, et les avions et drones adverses touchés **tombent**.

```json
{ "nom": "Retour à zéro", "barres": 9, "duree": "ce_tour",
  "effets": [
    { "cible": "terrain", "iem": { "rayon": 2, "abattre": true } }
  ] }
```

**La pièce.** **[Proposition]** *Le Relais sans numéro* — un Veilleur dont l'antenne fait trois fois la taille du catalogue et dont le champ « identifiant de compétition » est vide sur la fiche d'entrée de terrain : la Commission homologue des pièces, pas des silences (`rotor · capsule · [antenne, antenne] · 2`). C'est l'impulsion de station de `technologies.ts` sortie de sa station.

**Télégraphie.** Jauge visible ; à 9 barres, Bulletin « Relais sans numéro en charge — Retour à zéro possible au prochain tour », gabarit du rayon 2 au survol, et **chaque appareil et drone du joueur porte un point d'exclamation orange** : ce qui peut tomber le sait. Le super est le plus cher de la table : neuf barres, il part une fois par match.

**Contre-jeu.** Espacer les appareils de plus de deux cases les uns des autres — il ne peut abattre qu'une zone de treize cases —, poser ce qui peut se poser, et mettre ses Veilleurs hors jeu un par un : ses drones sont fragiles, c'était déjà sa faiblesse.

**Réplique.** « Retour à zéro sur le secteur. Ce qui volait est au sol ; ce qui roulait attend. »

**Vantour.** « Un appareil qui tombe sur un terrain homologué — je n'ai pas de mot pour ça, et j'ai commenté quatre Rondes. »

## 3. Le tableau de variété

| Gris | Super | Famille | Le moment à l'écran | Ce que le joueur change |
|---|---|---|---|---|
| Ost | Grêle · 8 | `frappe_zone` 2 / rayon 2 + mouvement | treize cases perdent 2 PV, le bloc avance | se disperser, rester au contact |
| Sélène | Délestage · 8 | `carburant` ×2, `capture` ×0,5 adverses, `fonds` ×2 | les jauges de carburant tombent, les captures s'enlisent | poser les appareils, ne pas entamer une capture longue |
| Maël | Rasante · 7 | `rayon_laser` 3 × 2 plus avancées | deux unités désignées perdent 3 PV | mettre du pas cher en tête |
| Lise | Zone rouge · 7 | `frappe_zone` 3 / rayon 1 + portée | une croix de cinq cases perd 3 PV | ne jamais s'empiler |
| Edran | La relève arrive · 8 | `ravitailler` + `reactiver` roues/chenilles | sa ligne se rallume | frapper les transports, ne pas échanger à égalité |
| Yuna | Mise sous scellés · 7 | `iem` rayon 2 sans abattre + capture ×2 | tout ce qui roule se fige, ses fantassins passent | tenir avec des fantassins |
| Basile | Réserves fermées · 8 | `degats_directs` 1 + `vision` −2 | toutes les étiquettes baissent d'un cran, la carte s'assombrit | garder un bâtiment pour voir |
| Relais Zéro | Retour à zéro · 9 | `iem` rayon 2 abattre | des appareils tombent | espacer, poser, chasser les Veilleurs |

Huit familles ou couples distincts, aucun doublon ; deux `frappe_zone` de formes opposées ; deux `iem` dont un seul abat ; un seul −1 à tout le monde ; un seul super sans aucun dégât (Sélène) ; un seul qui met hors jeu (Relais Zéro). Coût moyen 7,75 barres contre 7,25 pour la révision 4 : les Gris paient plus cher pour faire plus mal, ce qui est le contrat de la signature.

## 4. Le dossier : comment huit pièces entrent dans la trame

Rien de ce qui suit n'ajoute une mission ni un choix aux 172 de `opus1-tutoriels-final.md`. Le dossier s'accroche aux choix **existants**, et il ne fait qu'une chose : donner à ces choix une pièce à charge de plus.

### 4.1 Les trois organes, et ce que chacun peut dire

- **Nera Aldouin, le protêt.** À chaque **première** utilisation d'un super de Gris contre le joueur, le carnet reçoit une entrée de protêt **[Proposition]** : « Protêt n° … — matériel sans dossier, pièce observée : *la Batterie sans plaque*, finale 1, journée 6. Au règlement, article 2 du Pacte : le matériel est contrôlé. Réponse du Bureau : *pièce à l'essai, dossier en cours*. Classé sans suite. » Huit protêts possibles, huit fois « classé sans suite », et c'est la répétition qui fait le dossier. Nera ne dit jamais « je crois » ; elle numérote.
- **Wren Osoko, l'homologation.** Responsable de l'homologation, elle « documente sans inventer une panne ou un accident » (`personnages.json`). Son rôle dans ce lot est **négatif** et c'est sa force : elle atteste qu'**aucune** des huit pièces n'a de dossier — ni à l'essai, ni homologuée, ni retirée. Le Bureau répond que le dépôt d'essai contient forcément des pièces sans badge (bible §3.4, acte II) : c'est la confusion exacte que la faction exploite, et le joueur la voit s'exercer sous ses yeux.
- **Célestin Vantour, la voix.** Il commente chaque super en direct (une phrase par pièce, §2), et il ne comprend pas tout de suite ce qu'il commente : il cherche le badge, il n'a « pas de mot ». Sa mémoire encyclopédique est ce qui rend la répétition audible — « c'est la troisième fois que je ne trouve pas de plaque » — et son histoire (`celestin_vantour_3`) dit qu'il peut publier une preuve qui contredit ses propres commentaires. Les huit phrases de Vantour sont cette preuve en devenir.

### 4.2 Ce que le badge orange qui n'est pas là raconte

Les Gris sont « la seule équipe à porter le badge orange en permanence » (§3.4). Les huit pièces jouent sur trois absences différentes, et l'ordre est voulu :

1. **Pas de plaque** (Ost, Lise, Basile, Relais Zéro) : la pièce n'a jamais eu de dossier. Le mensonge du Bureau — « à l'essai » — est le plus facile à démonter, c'est donc le premier qu'on voit (F01).
2. **Pas de manifeste** (Edran, Sélène) : la pièce n'est pas une arme, c'est de la logistique et du courant — les batteries d'Aube, le coupleur du réseau. C'est ce que la Cinquième Manche veut vraiment, et on ne le voit qu'à la saison 5 (F08, F10).
3. **Un badge gratté** (Maël) et **un mandat à la place du badge** (Yuna) : la pièce a eu un statut, ou en porte un faux. C'est là que la confusion essai / non homologué devient une **intention**, et non une négligence.

### 4.3 Ce qu'un joueur peut prouver, et à quelle finale

| Pièce | Vue pour la première fois | Le choix existant qui la transforme en preuve | Où la preuve sert |
|---|---|---|---|
| Batterie sans plaque (Ost) | F01 | aucun : c'est le protêt fondateur de Nera, posé quoi qu'il arrive | F17 (Ost « perd la maîtrise du terrain ») et F18 |
| Verrou (Basile) | F02 | F02 « maintenir les relais publics » : les relais enregistrent le signal du Verrou | F07 (révélation : « les réserves servent à imposer la tutelle ») |
| Rapace (Maël) | F03 | F03 « échanger les journaux de vol » : le badge gratté est dans les journaux | F09 (« position d'un renfort révélée ») — la conséquence existante s'enrichit du Rapace |
| Repère (Lise) | F04 | F04 « garantir l'accès public demandé par Lise » : elle laisse voir le tube | F13 (médiation) — elle ne change pas de camp sur un compliment, mais sur une pièce |
| Borne de scellés (Yuna) | F05 | F05 « offrir une audition à la délégation battue » : la délégation a vu le numéro de mandat | F11 (renfort conditionnel) et F18 (mandats révoqués) |
| Relais sans numéro (Relais Zéro) | F06 | F06 « publier les relais compromis » | F16 (« brouillage adverse réduit ») — la conséquence existante |
| Coupleur (Sélène) | F08 | F08 « rendre l'offre publique » : le Coupleur est dans l'offre | F17–F18 (« confiance des alliés », épilogue calculé sur les preuves) |
| Convoi sans manifeste (Edran) | F10 | F09 « sécuriser les archives logistiques » (le manifeste absent y est) puis F15 « accepter sa déposition » | F13 (preuve à la médiation), F18 (épilogue) |

Aucune ligne ne change une conséquence écrite : elle lui donne un objet. **[Proposition]** Un seul compteur de monde, `monde.atlas.dossier_pieces` (0–8), incrémenté par les protêts de Nera — c'est une décision humaine au sens de la bible §8.6, jamais une routine ; il se lit à l'épilogue comme une preuve parmi les autres, et **aucune fin n'en dépend seule** (doctrine « jamais indispensable »).

### 4.4 Ce que la trame ne fait pas

Aucune scène de super n'expose la fratrie ni la paternité : la réplique de Maël en F03 parle de colonne, celle de Lise de zone, celle d'Edran de relève. Le Convoi porte les batteries d'Aube, pas le nom d'Orven. Vantour ne commente que ce qu'il voit — une pièce —, jamais qui la conduit. Et personne ne meurt d'un super : voir §6.

## 5. Deux relectures

### 5.1 Le joueur invétéré d'Advance Wars

*Il a lu les huit fiches avec Sturm, Hawke, Eagle, Lash et le météore en tête. Sa question : « est-ce que ça change ma façon de jouer ? »*

**« Ost, c'est Sturm au chiffre près. »** Oui : −2 sur treize cases, et ses unités qui avancent. C'est le premier vilain de la campagne, à la première finale, et le joueur qui connaît Advance Wars doit se dire « ah, c'est *lui* » en une image. **Non suivi**, avec la raison : l'archétype est la lecture. Ce qui n'est pas Sturm : ça touche les siens, et l'IA vise où elle n'a personne — c'est-à-dire que le bloc d'Ost **dit** où la grêle ne tombera pas.

**« Lise, c'est Sturm en petit. Deux frappes de zone, vous vous répétez. »** → **Suivi à moitié.** Les deux formes sont opposées (large/plate contre étroite/profonde) et demandent deux gestes contraires — disperser contre Ost, ne pas s'empiler contre Lise. Mais il avait raison sur un point : au brouillon, Lise avait aussi ×1,2 d'attaque, et « frappe puis frappe plus fort » était bien Sturm en petit. Le ×1,2 est parti ; elle garde la portée +1, qui est *sa* phrase.

**« Edran : reactiver sur ce qui roule, c'est Eagle au sol. Eagle est le super le plus fort du jeu, et vous le mettez à 8 avec un plein gratuit dessus. »** → **Suivi en partie.** Le plein reste (c'est la relève, elle vient ravitaillée) ; le `reactiver` est filtré à roues et chenilles — ses fantassins et ses transports ne rejouent pas, donc pas de double capture ni de convoi qui repart. La neuvième barre est laissée à la **mesure** (§6) : Relais Zéro est à 9 parce que la borne l'impose, Edran y passera si vingt parties le disent.

**« Yuna, IEM plus capture ×2 : c'est Lash qui devient Sami. Deux idées. »** → **Non suivi**, avec la raison de `pouvoirs-v4.md` déjà donnée pour elle : un adversaire doit être lisible, et « ses fantassins passent pendant que vos chars sont scellés » est **une** phrase, pas deux — le scellé sans la capture serait un pouvoir d'immobilisation sans but, et la capture sans le scellé, l'ancien super.

**« Relais Zéro à F06, un 1 contre 3, et il abat mes avions ? C'est la finale où je vais perdre mon hélico de tutoriel sans comprendre. »** → **Suivi.** Deux corrections : le point d'exclamation orange sur chaque appareil dès que sa jauge est pleine (§2.8, télégraphie) ; et une note pour l'auteur de F06 — le scénario, pas encore écrit, donne au joueur **au plus une unité aérienne** en dotation initiale, pour que la leçon coûte une pièce et pas une partie. Ce n'est pas un changement de mission : F06 n'existe pas encore en scènes.

**« Sélène : du carburant ×2 et des captures ÷2, c'est Hazel plus la gardienne. Est-ce que ça change mon tour ? »** → Oui, et c'est le seul super de la table qui change le tour **d'avant** : quand sa jauge approche de 8, on pose ses appareils et on ne lance pas une capture de QG à quatre tours. Il a concédé : « d'accord, c'est le seul super qui me fait jouer *moins*. »

**« Basile inchangé, très bien — mais alors la signature “−n à tout le monde”, c'est un seul Gris. »** → C'est voulu, et c'est écrit au §2.7. Un −1 partout qu'on voit deux fois n'est plus une signature, c'est un bruit.

**« Vous n'avez pas mesuré. »** → Vrai, et dit au §6 : ce document propose, la mesure du protocole de `pouvoirs-v4.md` (plaine, 20 parties, graine 1, pondérée contre pondérée, deux ordres) tranche — et deux familles ne sont pas encore mesurables, l'IA de `frappe_zone` et d'`iem` étant en cours de câblage.

### 5.2 L'ado de quinze ans

*Il veut une phrase, un nom qu'on peut crier, un moment « oh ! », et que ça fasse peur.*

**Le test du nom, crié.** *Grêle. Délestage. Rasante. Zone rouge. La relève arrive. Mise sous scellés. Réserves fermées. Retour à zéro.* Il a hésité sur deux. **« Délestage, c'est un mot de facture. »** — puis : « mais c'est justement ça qui fait peur, c'est le mot qu'on lit quand on n'a plus de courant. » **Gardé.** **« “La relève”, ça fait pas peur, ça fait pompiers. »** → **Suivi** : le brouillon s'appelait « La relève » ; la phrase entière — « La relève arrive » — est ce qu'on crie, et c'est ce qu'Edran dit en F10.

**« Est-ce que ça fait peur en une phrase ? »** Il a noté chaque description. Grêle : « oui, treize cases ». Rasante : « oui, parce que c'est *mes* deux unités de devant, et il me les montre avant » — le chevron orange est ce qu'il a préféré de toute la table. Zone rouge : « oui, −3 c'est beaucoup ». Mise sous scellés : « oui, elle me confisque mes chars, c'est un mot de police ». Retour à zéro : « le mieux, les avions tombent ». Réserves fermées : « moyen, −1 c'est petit, mais l'écran qui s'assombrit ça marche ». Délestage : « ça fait pas peur tout de suite, ça fait peur au tour d'après » — ce qui est la définition du super de Sélène.

**« Où est le moment où l'écran change ? »** Cinq sortes, et il les a comptées : **des chiffres tombent sur une zone** (Ost, Lise), **des unités sont désignées puis touchées** (Maël), **tout ce qui roule se fige** (Yuna, Relais Zéro — et pour lui, des appareils tombent), **la ligne adverse se rallume** (Edran), **les jauges baissent sans qu'on tire** (Sélène, Basile). « Y a pas deux fois le même écran. »

**« Sélène, la méchante, elle fait toujours rien ? »** → Elle fait quelque chose, maintenant : elle coupe le courant. Il a validé : « c'est le truc le plus méchant, en fait, parce qu'elle tire pas. »

**« Le badge gratté de Maël, c'est le meilleur détail. Mettez-le à l'écran. »** → **Noté pour la peau 3D**, non fait ici : une variante de texture du kit gris avec le badge gratté est un asset, pas une conception de pouvoir.

**« Les répliques, on comprend tout ? »** Les huit champs de texte de chaque super ont été relus contre la table du §5.2 de la bible : aucun « ennemi » ni « armée » ; « munitions » devient « charges » ; « tomber », « abattre » et « perdu » sont libres depuis le 10 septembre pour la fiction, et le règlement dit toujours « hors jeu » à l'écran (§6, dernier point).

## 6. Ce qui reste à trancher

1. **Mode normal et mode difficile.** Les finales disent « aucun coefficient de dégâts secret », donc tout écart doit être **annoncé au briefing**. **[Proposition]** Normal : pour `frappe_zone` et `iem`, l'IA **retient sa case à la fin du tour où sa jauge devient pleine** et la balise sur la carte ; elle tire dessus au tour suivant — le joueur a un tour entier pour quitter la zone. Difficile : la case est choisie au déclenchement, seuls le rayon et la jauge sont montrés. Même super, même chiffres, une information de moins. L'alternative (chiffres réduits en normal) est écartée : un super qui fait −1 en normal et −2 en difficile n'a plus de phrase.
2. **La jauge d'Edran à F10.** Il entre en J3 dans une mission de huit journées : à jauge nulle, « La relève arrive » ne part probablement jamais avant la sortie du joueur. Deux options : une jauge initiale annoncée au briefing (« il arrive ravitaillé et chargé »), ou accepter que le super soit une **menace** en F10 et un **fait** en F15. Ce document penche pour la seconde : F10 doit être perdu par la fermeture, pas par un super.
3. **`abattre` et un appareil posé.** La famille dit « unités aériennes et drones adverses touchés ». Un appareil posé sur un aéroport ou un porte-avions ami est-il abattu ? **[Proposition]** Non : « poser ce qui peut se poser » est le contre-jeu écrit, et l'IEM de station de `technologies.ts` ignore déjà ce qui est dans un transport. C'est une ligne dans la famille, à écrire par l'ingénieur.
4. **Sélène et le `carburant` des unités sans consommation par tour.** Le filtre `roues, chenilles, air, mer` couvre ce qui a un moteur ; le ×2 ne fait rien à une unité dont `parTour` vaut 0 (ce qui roule), et tout à ce qui vole ou navigue. C'est voulu — le délestage vide le ciel —, mais la phrase dit « tout ce qui a un moteur » ; si la mesure montre que le sol ne sent rien, resserrer le filtre à `air, mer` et la phrase avec.
5. **Le neuvième barreau d'Edran** et, plus largement, **la mesure** : les quatre supers sur des familles nouvelles (Ost, Lise, Yuna, Relais Zéro) ne se mesurent qu'une fois l'IA de ciblage câblée. Protocole de `pouvoirs-v4.md` §6, quatre paires (contre Ariane et Tomas, deux ordres), et la règle du soir du 10 septembre : on ne garde pas un 85/15.
6. **Les gestes de partition.** `baliser` (la case visée en rouge avant la chute), `designer` (le chevron orange de Maël), `sceller` (l'icône sur une unité figée) et `tomber` (un appareil abattu) n'existent pas ; `chiffre`, `encaisser` et `sortir` existent. Le contrat de `partition.ts` « ne fait que s'étendre » : quatre genres à ajouter, aucun à renommer.
7. **`abattre` et le ton.** Le brief dit « affrontements non sanglants », et la bible §5.3 que l'équipage « va boire quelque chose ». Un appareil abattu par une impulsion non homologuée ne change pas cette règle ; il en montre le prix. **[Proposition de ligne de bible, §5.3]** : *« Sous une impulsion sans dossier, un appareil tombe en panne en vol : l'équipage saute et rentre au dépôt boire quelque chose ; l'appareil, lui, ne revient pas au match suivant. C'est la première fois qu'une pièce de matériel est perdue sur un terrain homologué, et c'est exactement pour cela que c'est un scandale. »* Sur l'écran, le règlement continue de dire **hors jeu** ; « tombe » et « abattu » sont des mots de dialogue et de Vantour, pas du HUD.
8. **Une page du carnet par protêt**, ou une seule page qui se remplit ? Ce document propose une seule page — « Dossier des pièces sans plaque » — avec huit lignes qui s'écrivent l'une après l'autre, parce que c'est la répétition qui accuse. À trancher avec l'auteur du carnet.

## 7. Note pour la transcription

Le JSON joint porte, par super : `cle`, `nom`, `description`, `barres`, `duree`, `effets` (dans le vocabulaire exact des familles), `piece`, `telegraphie`, `contreJeu`, `replique`, `vantour`, `premiereFinale`, plus `remplace` (le super de la révision 4 qu'il remplace, ou `null` pour Basile) et `familles` (annotation, à laisser tomber). Le champ `superPouvoir` de chaque Gris dans `commandants-capacites.json` est à remplacer par `{ nom, barres, duree, description, effets }` ; `replique.super` par `replique` ; `passif`, `pouvoir`, `faiblesse`, `replique.pouvoir` et `contreJeu` de kit ne bougent pas. Les chaînes à ajouter à `content/i18n/interface.fr.json` (annonces du Bulletin, étiquettes des gestes) restent à une seule main, comme le veut le dépôt.
