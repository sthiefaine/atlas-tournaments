# Opus 1 — Direction artistique des personnages

**Statut : proposition, 10 septembre 2026.** Ce document est la bible visuelle qui accompagne `doc/refonte/direction-artistique-opus1.json` (37 fiches structurées, une par entrée de `content/personnages.json` révision 4). Le JSON est la **donnée** ; ce document dit pourquoi elle est comme elle est, ce qu'elle impose aux scènes, et comment on la produit. Quand les deux divergent, le JSON a raison sur une fiche, ce document sur une règle — et `BRIEF.md` sur les deux. Les propriétaires restent ce qu'ils sont : `01-bible.md` possède le monde et la charte de sensibilité, `10-rendu-3d.md` le rendu, `11-assets-spec.md` les assets, `opus1-adversaires.md` les huit adversaires, `opus1-hors-serie.md` les quatre disparitions.

Ce qui suit a été écrit **sans rien regarder à l'écran** et sans produire une image : les tailles, les contrastes et les longueurs de texte sont lus dans le code (`src/render/dialogue-html.ts`, `src/app/styles/*.css`), jamais constatés. Tout ce qui n'est pas dans le canon est marqué **[Proposition]**.

## 0. Trois décisions qui commandent le reste

1. **Le visage porte tout.** Un buste est affiché à 132 px de large dans la scène de dialogue, 150 px dans le splash de pouvoir, **52 px** sur un téléphone (`dialogue-html.ts`, `@media(max-width:620px)`). À 52 px, il ne reste qu'une silhouette, un bloc de couleur et un objet tenu à hauteur de poitrine. Chaque fiche nomme donc **ce qui fait la vignette** dans son champ `silhouette` — le col relevé, la capuche, le chapeau, la loupe, la corde —, et c'est ce signe-là qui se sculpte en premier.
2. **Aucune tenue n'est un uniforme.** La règle de `01-bible.md` §7.3 (aucun uniforme militaire réel, aucun symbole d'État, aucune marque, aucun stéréotype) est un **critère de rejet**, pas une préférence. Les délégations portent la tenue d'une **sélection sportive** — survêtement, veste de sélection, maillot de capitaine, brassard, dossard vierge — aux couleurs de `content/pays/<code>.json`. Les fiches d'Atlas et des Gris portent le même interdit sous une autre forme : ni galon, ni médaille, ni insigne de grade (« veste d'arbitre », « manteau de géomètre », « veston d'équipe à col officier » sont des vêtements de fonction, pas d'armée).
3. **Le champ `jamais` est contractuel.** Il dérive ligne à ligne des `interdits` de la fiche pays (« jamais de plaisanterie visuelle sur la petite taille » vient de `lu.json`, « jamais de référence aux cultures aborigènes » de `au.json`, « jamais le masque sur le visage » de `mx.json`) et de la règle dure d'`opus1-adversaires.md` pour la fratrie. Un portrait livré qui contredit une ligne de `jamais` est refusé, comme un GLB qui contredit sa `spec`.

## 1. Charte visuelle des personnages

### 1.1 Lisible en buste, lisible en vignette

Ce que la scène de dialogue fait d'un buste, et qui fixe les contraintes :

| Contexte | Taille | Ce qu'on y lit | Ce que la fiche doit fournir |
|---|---|---|---|
| Scène de dialogue, ordinateur | 132 px de large, cadre 160 × 190 (`viewBox`) | Le visage, l'expression, l'objet tenu, la tenue jusqu'à la taille | `visage`, `posture`, `objetFetiche` |
| Splash de pouvoir | 150 px | Le visage en `triomphe`, teinté par le camp | Un visage qui supporte le triomphe sans devenir une caricature |
| Téléphone (≤ 620 px) | **52 px** | Une silhouette et un bloc de couleur | `silhouette` : **un** signe de forme, jamais deux |
| Fenêtre basse (≤ 460 px de haut) | 96 px | Le visage seul, à peu près | La coiffure et le contour de tête suffisent à reconnaître |

Trois règles en découlent, et elles sont vérifiables sur les fiches :

- **Un signe de silhouette par personnage, et il est dans le tiers haut du cadre.** Le cadre s'arrête à la taille ; ce qui fait la vignette est à hauteur de tête ou d'épaule : capuche rabattue (Lotte), chapeau à large bord (Hazel), tuque à pompon (Noémie), loupe frontale (Wren), tresse en couronne (Elsbeth, Awa), corde en travers du torse (Mira), masque de plongée relevé (Jone). Aucune fiche ne fait reposer sa reconnaissance sur les jambes, la taille ou une arme — il n'y en a pas.
- **Les objets fétiches sont tenus, jamais posés.** À 52 px, un objet posé dans le décor disparaît ; un objet tenu contre la poitrine reste un point de couleur. La règle est appliquée sur les 36 fiches à corps (la thermos tendue, la cloche à deux mains, le casque sous le bras, le chronomètre levé, le calepin dans la main gauche) ; et **jamais sur le visage** : le masque d'Inés est à la ceinture, le casque de Luz sous le bras, le masque de Jone relevé sur le front. Le seul « objet » au visage est une paire de lunettes, et cinq personnages en portent (Tomas, Nera, Devika, Ren, Wren en loupe) — ce sont des lunettes de lecture ou de contrôle, jamais des lunettes noires.
- **Le bloc de couleur est la tenue, et il vient de la nation.** Le `palette` de chaque fiche est `[dominante, ombre, accent]`, lu dans `content/pays/<code>.json` (`main`, `dark`, puis un accent de `content/styles/<code>.json` ou le `light`). Le portrait est **livré avec les panneaux d'équipe en gris neutre** (`commandeImageSuffixe` : « team-colour panels of the garment painted neutral grey »), et c'est le jeu qui peint : c'est la règle du masque d'équipe des kits (`11-assets-spec.md` §5.2), appliquée aux bustes. Un portrait livré peint aux couleurs d'une nation est refusé — il ne pourrait jamais servir à un banc prêté, ni à un camp qui change de teinte.

### 1.2 Trois registres

**Les délégations nationales (24).** La tenue est celle d'une sélection sportive : survêtement, veste à bandes, maillot, parka, doudoune, ciré, gilet de chantier — ce que porte une équipe le jour du match, pas le jour de la parade. Elle prend la `main` du pays, une bande ou un col dans un accent, et **un écusson d'équipe vierge** (la mention revient dans onze fiches : c'est exprès, un écusson vide dit « équipe » sans dire « drapeau »). Chaque commandant porte **un objet fétiche lié à son pouvoir**, jamais à son pays au sens du folklore : la manivelle d'écluse de Lotte (« Accès de service », génie de terrain), la corde de cordée de Mira (« La cordée passe »), le chronomètre de Kito (« Dernier relais »), la pagaie d'Awa (« Pas commun », infanterie accompagnée), le carnet « promis / tenu » de Tomas (« Tenue des accès »), la lampe tempête d'Amalie (« Veille rapprochée »). La lecture se fait dans `content/commandants-capacites.json` : l'objet est la métaphore de main du pouvoir, ce qui permet au joueur de deviner un style avant d'avoir lu une fiche.

**Atlas (5 : Nera, Osmin, Célestin, Solveig, Wren).** Des **sans-drapeau** (`01-bible.md` §3.1) : aucune couleur de nation, aucun écusson, et surtout **jamais le gris des Gris ni l'orange**. Atlas est **ardoise et papier** — `#4d6a78` (le `--atlas-lisere` de l'interface), `#5b6f86`, `#132329`, `#f4edda` — c'est-à-dire exactement les jetons de `commun.css`. Un personnage d'Atlas est peint comme l'interface : c'est le personnel de la maison. Deux exceptions calculées : Vantour, dont la veste à carreaux moutarde (`#ffd162`, le `--atlas-signal`) est « le seul costume du jeu », parce que la Régie se voit ; et Wren, en gris clair d'atelier (`#b9bec7`, la palette neutre de `palettes.ts`), parce que l'homologation ne prend parti pour personne. Solveig et Wren sont `role: commandant` sans `paysCode` dans `personnages.json` : ce sont les deux généraux secrets d'Atlas de `13-campagne.md`, et leur registre reste Atlas.

**Les Gris (8 : Ost, Sélène, Maël, Lise, Edran, Yuna, Basile, Relais Zéro).** Gris moyen et **badge orange du matériel à l'essai** (`#f0761e`), comme la bible l'impose (§3.4) : « un badge orange peint sur la coque, visible de loin » — sur une personne, c'est un badge cousu, un cordon, un trait de fil. Le gris varie d'un personnage à l'autre (`#a9adb3` clair de vol pour Maël, `#6f747b` foncé de prestataire pour Edran, `#c9ccd1` gris perle pour Sélène) pour que huit bustes gris restent huit personnes. Deux règles au-dessus des autres :

- **Sélène Veyr est en direction de concessions, jamais « méchante » au premier regard.** Sa fiche l'écrit : ni noir, ni rouge, ni ombre, ni cape ; un manteau gris perle boutonné, un sourire poli, une montre plate. Son badge orange est **réduit à un fil de couture le long du revers**, qui ne se lit qu'à l'acte III, quand le joueur sait quoi chercher. C'est la transposition visuelle de « la dépendance présentée comme la stabilité » (`17-aube.md`).
- **Hadran Ost a l'air d'un champion qu'on aime.** Pas d'ombre sur le visage, pas de lunettes noires, les deux mains ouvertes. Le seul personnage des Gris dont le badge est *aussi* un cordon autour du cou : il porte l'insigne de l'équipe, parce qu'il en est le visage.

### 1.3 Âge, morphologie, diversité

- **Les âges apparents vont de 22 ans (Jone) à 63 (Osmin)**, et aucune tranche n'écrase les autres : huit personnages de moins de trente-cinq ans, quatorze entre trente-cinq et quarante-cinq, dix entre quarante-cinq et cinquante-cinq, quatre au-delà. Le monde est celui de sélectionneurs, pas de recrues ; les commandants sont des adultes qui ont une vie d'avant (mécanicienne, géomètre, manutentionnaire, patron de caïque), et leur visage le dit — la ride verticale d'Ariane, les pattes-d'oie de Samir, les rides du sourire d'Ost.
- **Aucune morphologie n'est un jugement.** Trapu, rond, massif, sec, longiligne : les fiches décrivent des corps comme des faits de silhouette, jamais comme un trait de caractère national. La règle est vérifiable sur les huit Gris, qui vont du cou de taureau de Basile aux épaules étroites de Maël sans qu'aucune carrure ne signale « le méchant ».
- **La diversité est décrite, jamais commentée.** Peau, cheveux, traits sont donnés avec précision (« peau olive chaude », « cheveux noirs crépus coupés court, raie rasée », « teint cuivré par la route », « blond très pâle ») parce qu'un générateur d'images sans consigne rend un visage moyen ; mais aucune description ne cite une origine, et le `jamais` de chaque fiche interdit le cliché qui lui est le plus proche (pas de bindi, pas de haka, pas de collier de fleurs, pas de motif de crâne, pas de sombrero, pas de trappeur). C'est la charte §7.1 lue à l'envers : un habitant du pays doit pouvoir rire *avec* nous du chapeau de brousse de Hazel, jamais *de* lui.
- **Pas de caricature du corps.** Le style est celui de la spec de buste (`aEviter` : « no exaggerated caricature »), en « stylised realism » ; le brief demande des proportions de figurine pour les unités, mais un buste est vu en grand — ossature réelle, traits dissymétriques, un âge précis (`commandant_<archetype>.json`, `description.en`).

### 1.4 Les émotions du buste

Le buste vectoriel (`dialogue-html.ts`, `VISAGES`) ne connaît que sourcils et bouche, sur **six émotions** fermées dans `schemas/types.ts` (`EMOTIONS`) et traduites dans `emotion.*` : `neutre`, `joie`, `colere`, `surprise`, `doute`, `triomphe`. L'humeur est aussi **un mot lu par le joueur**, en creux dans la bande de nom (`.nom .humeur`). Deux familles de scènes de l'opus ne se jouent pas avec ces six-là :

**Les quatre scènes de deuil** (`opus1-hors-serie.md` §3 : Solveig qui pose la plaque, Vantour qui « ne dit rien pendant tout le Bulletin », Dafni, Anju, Léa, Nadia, et Ariane qui « parle avant le Bulletin, une fois »). Aucune de ces répliques n'est de la colère, aucune n'est du doute — `doute` a une bouche de travers, un sourcil relevé : c'est une hésitation, pas un chagrin. Jouées en `neutre`, elles seraient dites par un visage qui ne sait pas ce qu'il dit. **[Proposition]** Deux émotions manquent :

- `gravite` — sourcils droits et légèrement abaissés, bouche horizontale plus courte que `neutre`. C'est le visage de qui annonce un fait sans le commenter : Solveig, Vantour au Bulletin, Nera. Libellé proposé : « Gravité ».
- `peine` — sourcils dont l'extrémité intérieure remonte, bouche légèrement tombante et fermée. C'est le visage de la personne la plus proche : Dafni, Anju, Léa, Nadia, et Ariane à la finale 12. Libellé proposé : « Peine ».

**La révélation de la finale 10** (`opus1_finale_10`, « Ce que Sorel protège » : Edran révèle être le père de Maël, rejoint son fils, et bat la coalition). Edran n'y est ni en `triomphe` — il ne gagne rien, il choisit — ni en `colere` ; Maël n'est ni en `joie` ni en `surprise` seule. **[Proposition]** Une troisième émotion :

- `resolution` — sourcils bas et parallèles, bouche fermée et droite, un peu plus longue que `gravite`. Le visage de qui a décidé et n'attend pas d'approbation : Edran à la révélation, Basile à sa reddition réglementaire, Lise si elle rompt avec le Consortium. Libellé proposé : « Résolution ». Pour Maël, `surprise` puis `doute` suffisent, et c'est voulu : la fiche interdit « un sourire de fils avant la finale 10 », et la finale ne lui en accorde pas un — un `joie` de Maël à cet instant lirait la révélation comme une bonne nouvelle.

Ce qu'ajouter une émotion demande, sans le coder ici : une entrée dans `EMOTIONS`, deux tracés dans `VISAGES`, une clé `emotion.<nom>` dans `content/i18n/interface.fr.json`, et rien d'autre — le validateur de scénarios lit `EMOTIONS`. Ce que cela interdit : `colere` dans une scène de deuil (personne n'est accusé, la bible §4.6 le dit d'un retrait et les hors-série le disent d'une disparition), et `triomphe` pour un Gris à la finale 10. Relais Zéro reste en `neutre` **toujours** (sa fiche), et la bande de nom le montre : c'est la seule « émotion » qu'un relais puisse afficher.

## 2. Les trente-sept fiches

### 2.1 Vue d'ensemble

Clé, nom, registre, la silhouette en cinq mots (ce qui fait la vignette à 52 px), l'objet fétiche et la palette `[dominante, ombre, accent]`. Les trois palettes marquées ‡ sont discutées au §5.

| Clé | Nom | Registre | Silhouette en cinq mots | Objet fétiche | Palette |
|---|---|---|---|---|---|
| `cmd_ariane_belloc` | Ariane Belloc | Délégation, premier plan (fr) | épaules carrées, col relevé, queue basse | clé plate chromée, poche poitrine | `#2f5fd0` `#1b3a86` `#c8324a` |
| `cmd_tomas_reiner` | Tomas Reiner | Délégation, premier plan (lu) — disparaît | trapu, lunettes rondes, barbe nette | carnet de convoi « promis / tenu » | `#3aa0c8` `#1d5f7c` `#d4534f` |
| `nera_aldouin` | Nera Aldouin | Atlas, arbitrage | petite, dos droit, col blanc | sifflet d'acier au cordon gris | `#4d6a78` `#132329` `#f4edda` |
| `osmin_talvarec` | Osmin Talvarec | Atlas, direction | long, épaules tombantes, tête penchée | carte pliée en accordéon | `#5b6f86` `#132329` `#f4edda` |
| `celestin_vantour` | Célestin Vantour | Atlas, Régie | rond d'épaules, veste à grands carreaux | fiche bristol, micro-cravate | `#ffd162` `#132329` `#3aa0c8` |
| `cmd_hadran_ost` | Hadran Ost | Gris, le visage | large, cheveux argent, mains ouvertes | cordon orange, passe vierge | `#8c9097` `#4b5058` `#f0761e` |
| `cmd_solveig_tamm` | Solveig Tamm | Atlas, Intendance | carrée, parka de quai, chignon bas | registre des convois sous le bras | `#4d6a78` `#132329` `#f4edda` |
| `cmd_wren_osoko` | Wren Osoko | Atlas, homologation | mince, voûtée, loupe frontale relevée | pied à coulisse en laiton | `#b9bec7` `#132329` `#f4edda` |
| `selene_veyr` | Sélène Veyr | Gris, direction (secret d'acte III) | grande, immobile, chignon lisse | porte-documents à trois languettes | `#c9ccd1` `#4b5058` `#f0761e` |
| `cmd_elsbeth_vonlanthen` | Elsbeth Vonlanthen | Délégation, premier plan (ch) | courte, solide, tresse en couronne | thermos rouge cabossée, tendue | `#c0392f` `#7d2019` `#f0d2cd` |
| `cmd_lotte_vermeer` | Lotte Vermeer | Délégation, premier plan (nl) | grande, ciré orange, capuche rabattue | manivelle d'écluse sur l'épaule | `#e07b28` `#8f4611` `#3f5fa8` |
| `cmd_samir_el_hadi` | Samir El Hadi | Délégation, premier plan (ma) — disparaît | sec, moustache grise, écharpe sable | théière de voyage en laiton | `#b0402f` `#6b2117` `#2f7d4f` |
| `cmd_awa_diagne` | Awa Diagne | Délégation, premier plan (sn) | athlétique, tresses en couronne, sourire | pagaie courte du delta | `#2f8f57` `#155c33` `#e2c341` |
| `cmd_livia_moura` | Lívia Moura | Délégation, premier plan (br) | boucles volumineuses, foulard jaune noué | tambourin de carnaval à la ceinture | `#2f9d5b` `#146336` `#e2c341` |
| `cmd_ines_valdes` | Inés Valdés | Délégation, premier plan (mx) | compacte, natte sur l'épaule, cape | masque de lutteuse à la ceinture | `#2f8f5f` `#155c39` `#c0392f` |
| `cmd_devika_rao` | Devika Rao | Délégation, premier plan (in) | ronde, lunettes dorées, mèche blanche | tableau à pinces contre la poitrine | `#e2842a` `#8f4d0d` `#2f7d4f` |
| `cmd_ren_mizuno` | Ren Mizuno | Délégation, premier plan (jp) | mince, droit, lunettes rectangulaires fines | montre de gare à gousset | `#d05a6e` `#7d2b3c` `#f7dbe1` |
| `cmd_hazel_quinn` | Hazel Quinn | Délégation, premier plan (au) | grande, sèche, chapeau à large bord | bidon de réserve cabossé | `#d4762a` `#864111` `#2c3a4a` |
| `cmd_ayu_pranata` | Ayu Pranata | Délégation, premier plan (id) | petite, mains ouvertes, peigne de bois | cloche de club en laiton | `#c8443c` `#7a221d` `#f6d3d0` |
| `cmd_leandro_paz` | Leandro Paz | Délégation (ar) | grand, voûté, nez busqué, écharpe | ardoise tournée contre lui | `#5fa8d8` `#28607f` `#e2c341` ‡ |
| `cmd_noemie_leduc` | Noémie Leduc | Délégation (ca) | emmitouflée, tuque rouge, tresses rousses | anémomètre de poche levé | `#c0392f` `#742019` `#f4d2ce` |
| `cmd_jone_vakalau` | Jone Vakalau | Délégation (fj) | massif, jeune, maillot sans manches | masque de plongée relevé | `#2fa0b8` `#12606f` `#2f8f5f` |
| `cmd_nikos_delis` | Nikos Delis | Délégation (gr) — disparaît | ventre rond, moustache blanche, casquette | tasse de café en émail ébréchée | `#2e78bf` `#17456f` `#f7f9fb` |
| `cmd_elin_arnardottir` | Elín Arnardóttir | Délégation (is) | pâle, pull épais, jumelles sur la poitrine | jumelles au cordon rouge, carnet jaune | `#5b6f86` `#2c3a4a` `#c04a52` |
| `cmd_kito_njoroge` | Kito Njoroge | Délégation (ke) | très mince, crâne rasé, dossard vierge | chronomètre à gros cadran | `#2f7d4f` `#164d2e` `#c0392f` |
| `cmd_tiana_ravel` | Tiana Ravel | Délégation (mg) | petite, vive, tube à cartes | tube à cartes, crayon à l'oreille | `#c14b2f` `#742616` `#2f7d4f` |
| `cmd_saran_bat` | Saran Bat | Délégation (mn) | veste matelassée, nattes devant, tournée | gourde de selle en cuir | `#e08a1e` `#8c4d08` `#c0392f` |
| `cmd_amalie_haoses` | Amalie Haoses | Délégation (na) | grande, droite, cheveux ras, lampe | lampe tempête embuée, tenue bas | `#c98b3f` `#7d4f14` `#2f6f8f` ‡ |
| `cmd_mira_karki` | Mira Karki | Délégation (np) — disparaît | petite, doudoune, bonnet, corde en travers | corde de cordée bleue | `#b8443f` `#6d1f1d` `#2c4a86` |
| `cmd_tess_roa` | Tess Roa | Délégation (nz) | robuste, gilet vert, lunettes relevées | trousse d'outils roulée | `#2f5f4f` `#153b30` `#2c4a86` ‡ |
| `cmd_luz_quispe` | Luz Quispe | Délégation (pe) | épaules carrées, tresses, casque sous le bras | casque de chantier rouge, sans logo | `#c0392f` `#722018` `#f2cec9` |
| `cmd_mael_orven` | Maël Orven | Gris, adversaire | élancé, penché en avant, écouteurs au cou | casque-écouteurs de vol, mousses orange | `#a9adb3` `#4b5058` `#f0761e` |
| `cmd_lise_orven` | Lise Varen | Gris, adversaire | trapue, natte plaquée, bras croisés | rapporteur de tir, pochette de plans | `#8c9097` `#4b5058` `#f0761e` |
| `cmd_edran_sorel` | Edran Sorel | Gris, adversaire | lourd, barbe grise, crâne dégarni | calepin gris à élastique | `#6f747b` `#4b5058` `#f0761e` |
| `cmd_yuna_serrat` | Yuna Serrat | Gris, adversaire | mince, carré au menton, cordons superposés | trousseau de badges en éventail | `#8c9097` `#4b5058` `#f0761e` |
| `cmd_basile_kelm` | Basile Kelm | Gris, adversaire | massif, cou de taureau, rasé ras | trousseau de clés de dépôt, poing fermé | `#7c828c` `#4b5058` `#f0761e` |
| `cmd_sans_visage` | Relais Zéro | Gris, indicatif de commandement | aucune : une plaque grise plate | la plaque et sa balise à trois traits | `#8c9097` `#4b5058` `#f0761e` |

Compte : 24 délégations (12 au premier plan), 8 Gris (Ost et Sélène comptent ici *et* au premier plan de `personnages.json`), 5 Atlas — 37, le nombre que `tests/serveur/registre-commandants.test.ts` fixe.

### 2.2 Les huit adversaires

**Hadran Ost.** Le personnage que le joueur doit *aimer* pendant deux actes, et le buste le dit avant lui : rides du sourire, mèche d'argent qui retombe quand il rit, les deux mains ouvertes vers le joueur, la tête inclinée — « il donne raison avant d'avoir parlé » (`01-bible.md` §3.4). Il remplit le cadre d'épaule à épaule, ce qui le distingue de tous les autres Gris à 52 px. Le cordon orange et son passe **vierge de tout texte** sont l'insigne d'une équipe qui n'a pas de drapeau : à l'acte I c'est un champion sympathique en veston d'équipe, à l'acte III le même homme, sans qu'un pixel ait changé — ce qui a changé est ce que le joueur sait. Interdits qui pèsent : aucune ombre portée sur le visage, aucun sourire en coin, aucune cape, aucun gant, aucun insigne de grade. Il est produit **en premier** des adversaires : il paraît dès l'épisode 15 (`opus1_fr_05`, « Le devis orange »).

**Sélène Veyr.** La direction, pas la menace : grande, très droite, épaules étroites, « la seule figure du jeu qui ne bouge jamais au buste ». Gris perle boutonné jusqu'au cou, chignon lisse sans une mèche libre, montre plate, un sourire poli « qui ne monte pas aux yeux ». Son badge orange est **un seul fil de couture** le long du revers : à l'acte I le joueur ne le voit pas, à l'acte III il ne voit plus que lui. L'objet fétiche est le contrat lui-même — un porte-documents fermé par **trois languettes de couleur**, trois signatures, trois sociétés, un même dispositif (`opus1-adversaires.md` : « les droits dépendent de signatures et de relais distincts »). Elle ne se repent pas, et le buste ne lui accorde aucune émotion de repentir : ni `peine`, ni `doute` à la finale 18. Interdits : noir, rouge, ombre, cape, badge orange plein.

**Maël Orven, Lise Varen, Edran Sorel — la règle dure.** Ils sont frère, sœur et père dans les données auteur ; le joueur n'apprend que le lien Edran–Maël, à la finale 10, et **jamais** le lien avec Lise (`BRIEF.md`, Refonte Aube ; `opus1-adversaires.md`). Une ressemblance de famille lisible sur trois bustes serait la révélation faite par le dessin avant le récit. Les trois fiches se contredisent donc **trait par trait**, et c'est la seule liste qui compte à la livraison :

| Trait | Maël Orven | Lise Varen | Edran Sorel |
|---|---|---|---|
| Cheveux | noirs, rasés sur les côtés, aplatis par le casque | blond cendré, natte plaquée du front au col | crâne dégarni, couronne grise coupée court |
| Peau | olive chaude | claire, sans taches | rougeaude, teint de contremaître |
| Yeux, sourcils | sombres, sourcils noirs droits et bas | gris très clairs, sourcils épais blond cendré | noisette fatigués, arcades ordinaires |
| Nez, mâchoire | nez fin à arête marquée, cou long | mâchoire carrée | nez large, cassé autrefois |
| Carrure | élancé, épaules étroites, penché en avant | trapue, épaules larges, plantée droite | lourd, épaules rondes et tombantes, occupe le cadre par le bas |
| Tenue | blouson de vol gris clair à col tricot | veste gris moyen à épaulettes rembourrées, gilet réfléchissant replié | veste de prestataire gris foncé à col rabattu |
| Badge orange | **manche gauche** | **poitrine droite** | **manche droite**, « le seul des Gris à le porter petit » |
| Objet | casque-écouteurs de vol au cou | rapporteur de tir, pochette de plans | calepin à élastique, crayon de charpentier |
| Objet d'oreille | oui (écouteurs) | **jamais** (ni protège-oreilles, ni casque) | aucun |
| Geste | une main sur l'écouteur | bras croisés, immobile | une main sur le calepin, l'autre pendante ; **jamais de main sur une épaule, jamais de regard attendri** avant la finale 10 |

Le tableau se lit aussi en creux : ce qui distingue Maël de Lise (cheveux, peau, nez, mâchoire, objet d'oreille, col tricot, rapporteur) est exactement la liste du champ `jamais` de chacun, et un portrait livré qui rapproche deux colonnes sur **une seule** ligne est refusé. Deux ajouts de ce document : les trois **positions de badge** sont un système (gauche-manche, droite-poitrine, droite-manche), à ne pas déplacer d'une fiche à l'autre au moment de la livraison ; et les gris de tenue vont du clair (Maël `#a9adb3`) au foncé (Edran `#6f747b`) en passant par le moyen (Lise `#8c9097`) — trois valeurs, pas une. Après la finale 10, **rien ne change au buste d'Edran** : la révélation est dite, jamais dessinée (§3.3).

**Yuna Serrat.** La négociatrice de terrain : de trois quarts « comme entre deux interlocuteurs », sourire poli et fatigué, cernes légers, un trousseau de badges d'accès **tenu en éventail** — des mandats provisoires de plusieurs délégations. Sa règle : elle représente des mandats, aucune nation ; donc jamais un maillot de délégation, jamais un tampon ni un marteau. **Un point que sa fiche laisse ouvert** : « plusieurs cordons de badge de couleurs différentes ». Si ces couleurs sont celles de `content/pays/`, le joueur lit *quelles* délégations elle a sous mandat, et le buste raconte ce que le récit garde. **[Proposition]** Les cordons prennent des couleurs qui n'appartiennent à aucune des 24 palettes (des gris teintés, un beige, un vert-de-gris), ou un seul orange à plusieurs nuances.

**Basile Kelm.** Le gardien des réserves : massif, cou de taureau, bras le long du corps, le poing fermé sur des clés de dépôt. Sa fiche impose le **neutre absolu** — ni sourire ni menace, une bouche horizontale « qui ne s'ouvre que pour dire non » — et l'interdit qui compte : ni matraque, ni casque, ni bouclier. Un gilet de surveillance à bandes réfléchissantes sur une veste d'équipe, une lampe torche à la ceinture : un gardien de réserves, pas un policier. Sa reddition réglementaire (`opus1-adversaires.md`) se jouerait en `resolution` (§1.4), jamais en `doute`.

**Relais Zéro (`cmd_sans_visage`).** Pas un buste : **une plaque d'indicatif de tournoi**, gris moyen, deux coins coupés (le vocabulaire des cartes de `/jeu` et du dossier de campagne), balise de liaison à trois traits en haut — la `.atlas-balise` du briefing radio, dont les trois barres battent déjà à 1,15 s dans `mission.css` —, un indicatif en **glyphes non lisibles** au centre, le badge orange en bas à droite « comme sur une caisse d'équipement ». Éclairée à plat, sans ombre, sans visage à contre-jour, sans masque, sans capuche : `opus1-adversaires.md` interdit la silhouette dramatique et la révélation arbitraire, et la fiche le répète. La plaque entre par la droite comme un buste adverse, sans animation d'humeur ; les trois traits battent au rythme de la frappe du texte. **C'est le seul asset des 37 qui peut être produit en SVG par le dépôt**, sans générateur, et il devrait l'être : c'est le moins cher et le plus sûr. Un détail de la fiche à corriger au moment de le dessiner : elle donne « 132 × 190 », qui mélange la largeur affichée en pixels et la hauteur du `viewBox` — le cadre est au **ratio 160 : 190**, donc 132 × 157 à l'écran (§5).

### 2.3 Ariane et Tomas

**Ariane Belloc.** La mentore de la première leçon à l'épilogue, et la fiche est construite pour un buste qu'on verra plus que tout autre : moyenne, épaules carrées d'ancienne mécanicienne, col relevé, queue basse, **une ride verticale entre les sourcils « qu'elle garde même en souriant »** — c'est le détail qui fait qu'elle n'est pas lisse, et le `jamais` le protège (« jamais irréprochable au point d'être lisse »). Survêtement bleu mat `#2f5fd0` à liseré rouge et blanc, et **le damier d'arrivée à quatre carrés** sur l'épaule gauche, qui est littéralement la seconde décalcomanie de `content/styles/fr.json` (`carres_emboites`, « un damier blanc de ligne d'arrivée, réduit à quatre carrés ») : le même signe sur ses unités et sur elle. L'objet est une clé plate chromée et usée dans la poche poitrine — sa vie d'avant (`personnages.json`, fait 1 : « ancienne responsable de maintenance »). La posture, menton baissé vers l'élève, une main sur la hanche : elle enseigne, elle ne commande pas ; jamais de galon, de casquette ni de geste martial. Elle ne meurt pas (`opus1-hors-serie.md` §3, « pourquoi pas Ariane »), et son buste doit pouvoir porter `peine` à la finale 12 sans que ce soit la première fois qu'il exprime quelque chose.

**Tomas Reiner.** Le second mentor, celui des tutoriels et de la saison 1, et l'organisateur des convois : trapu, cou court, lunettes rondes à monture d'écaille, barbe poivre et sel « qui dessine un sourire même quand il ne sourit pas ». Sa règle vient de `lu.json` : **jamais de plaisanterie visuelle sur la petite taille**, et jamais de costume-cravate — un organisateur de quai, pas un banquier (« jamais de coffres-forts »). Son objet est son pouvoir en toile bleue : le carnet de convoi à deux colonnes « promis / tenu », qu'il tient ouvert contre la poitrine en pointant une ligne — « un homme qui vérifie ». Il disparaît à `opus1_finale_12` (§2.4) ; jusque-là, il porte le brassard d'organisateur au bras gauche, et **ce brassard reste sur Léa Wagener** [Proposition] si l'adjointe reçoit un jour une fiche.

### 2.4 Les quatre qui disparaissent

Nikos Delis, Mira Karki, Tomas Reiner et Samir El Hadi meurent hors terrain (`opus1-hors-serie.md` §3, décision du propriétaire du 9 septembre 2026). La règle visuelle est la même pour les quatre et elle tient en une ligne : **le buste ne change jamais ; c'est la plaque qui change.**

- **Ce que le buste garde après** : exactement le même portrait, aux mêmes couleurs, dans la même bande de nom. Un buste passé en noir et blanc, assombri, encadré d'un bandeau noir, ou orné d'un signe quelconque serait un portrait de deuil — et ce monde n'en fait pas (bible §4.6 : « un retrait n'est jamais un drame » ; les disparitions sont « petites et calmes »). Un joueur qui ouvre son carnet doit retrouver Nikos avec sa tasse levée, pas Nikos gris.
- **Ce qui change** : la plaque au Tableau, **posée à plat**, face visible, avec une ligne d'organisation (§3.2) ; l'emplacement de co-commandant libéré ; une page de carnet ; l'absence à l'épilogue. Le nom sur la bande reste le nom.
- **Nikos Delis (gr).** Ventre rond, moustache blanche tombante, casquette de patron de caïque rejetée en arrière — une casquette de barque, jamais un uniforme de marine —, la tasse de café en émail bleu ébréchée, levée à mi-hauteur, « le café d'avant coup d'envoi ». Le hors-série le montre au café du port et au môle ; la scène de deuil dit « le café encore chaud » et « le chat du port sur la tablette » : la tasse de la fiche est l'objet que la scène cite, ce qui est la raison de la choisir. Interdits : colonne, casque antique, bouclier (`gr.json`).
- **Mira Karki (np).** Petite et dense, doudoune rouge à bandes bleu nuit, bonnet relevé, **la corde de cordée bleue enroulée en épaule, nœud visible** — « personne ne monte seul » —, une main tendue vers le bas pour tirer quelqu'un. Sa fiche tranche le partage des objets de montagne : Elsbeth a la thermos, Mira la corde, et **personne n'a de piolet** (« le sommet est une étape sportive, jamais une conquête », `np.json`). Les fanions du décor sont des balises sans signe. La scène de deuil dit que les porteurs vont bien, et la corde — l'objet de la cordée — est ce qui reste à Anju.
- **Tomas Reiner (lu).** Voir §2.3. La plaque du Luxembourg posée à plat au briefing de « Les lignes qui restent », et Ariane qui parle **avant** le Bulletin : c'est la seule des quatre scènes où la première réplique n'est pas de Solveig, et le buste d'Ariane y entre en `peine` avant qu'aucune plaque ne soit montrée.
- **Samir El Hadi (ma).** Sec et nerveux, moustache grise, écharpe de coton sable « enroulée contre la poussière » — une écharpe de route, pas un costume, et aucun motif (`ma.json` : aucune référence religieuse, jamais de médina de carte postale) —, la petite théière de voyage en laiton accrochée à la bretelle : « le service à thé qui suit partout ». Une main en visière, il compte les étapes. Sa maladie est « nommée nulle part » : le buste ne la montre **jamais**, ni à `opus1_ma_09` (il regarde le match depuis le dépôt) ni à `opus1_ma_11` (il « se soigne entre deux étapes ») — pas de pâleur, pas de fatigue ajoutée. C'est la règle pour les quatre : **le signe de la disparition est dans le texte, jamais sur le visage.**

## 3. Le langage visuel des scènes narratives

### 3.1 La boîte de dialogue existante

Elle est décrite dans `dialogue-html.ts` et c'est « le meilleur objet visuel du jeu » : deux bandes noires liserées d'ardoise, un buste qui entre par son côté — le joueur à gauche, l'adversaire à droite —, une boîte-**transmission** à trame de lignes, coin coupé de 16 px, ombre dure, bande de nom teintée par le camp avec l'humeur en creux, texte frappé à 16 ms par caractère. Rien de ce document ne la remplace. Ce qu'un portrait livré doit respecter pour y entrer :

- **Le cadre est 160 × 190**, et le fond du cadre est peint par le jeu (`pal.dark`, le sombre de la palette du camp, sous une grille discrète). Le portrait est donc livré **sur fond transparent** (PNG alpha) ou sur le gris moyen de la `commandeImage`, que le jeu remplace ; jamais avec un décor. Le buste s'arrête à la taille, coupé net par le bas du cadre.
- **Il est teinté par le camp, pas par la nation.** `buste(camp, emotion)` lit `paletteDe(camp)`, qui ne connaît que quatre palettes de camp (`bleu`, `rouge`, `vert`, `or`) et une neutre. Le `palette` de chaque fiche est celui de la **nation** ; aujourd'hui rien ne le lit. C'est un point à trancher (§5) : soit le buste livré prend la palette de nation par son masque d'équipe et la bande de nom garde la teinte de camp, soit tout suit le camp. La première lecture est la bonne pour le monde — Ariane est bleue de France même quand elle joue « rouge » sur une carte — et la seconde pour la lisibilité du plateau. **[Proposition]** Buste à la nation, bande à la teinte du camp, et le liseré du cadre (`border:2px solid var(--teinte)`) fait le lien.
- **L'adversaire est en miroir** (`scaleX(-1)` sur `.buste` à droite). Sur le SVG symétrique, c'est invisible ; sur un portrait livré, la cicatrice d'Inés change d'arcade et le badge de Maël change de manche. Comme les trois de la fratrie sont toujours adversaires, ils sont toujours retournés **ensemble**, et le système gauche-droite du §2.2 tient en relatif — les côtés des fiches se lisent « tels que livrés, comme un allié à gauche ». Mais un commandant national est adversaire au premier épisode de son hors-série et allié au second : Nikos aura sa tasse dans l'autre main d'un épisode à l'autre. **[Proposition]** Le rendu cesse de retourner un portrait livré et ne retourne que le placeholder ; le trois-quarts de la commande regarde légèrement vers la droite du spectateur pour tout le monde, ce qui laisse un adversaire à droite regarder « hors de la boîte » — c'est acceptable, un buste de trois quarts vers la caméra reste tourné vers le joueur.

### 3.2 Le Tableau des délégations, et le geste d'une plaque de disparu

Le Tableau (`01-bible.md` §4.6) est un panneau de bois clair dans le hall de l'Intendance, où les plaques des délégations engagées sont accrochées. Il connaît trois gestes — deux plaques **côte à côte** (ralliement), une plaque **retournée face bois** (retrait ; « personne ne la décroche »), une plaque **remise à l'endroit** (retour) — et `opus1-hors-serie.md` §3 en propose un quatrième pour une disparition : Solveig **décroche la plaque et la pose à plat sur la tablette**, face visible, avec une ligne d'organisation (« Grèce — engagée. Banc repris par la fédération. »). Ce document ne le change pas ; il dit à quoi la chose ressemble.

**[Proposition] La plaque dans le vocabulaire de `src/app/styles/`.** Il n'y a aucun bois dans l'interface, et il n'en faut pas : la plaque est **la plaque d'enseigne de l'écran-titre** (`.marque-plaque` dans `accueil.css` : panneau `--panneau`, liseré, coin coupé de 9 px, ombre dure 5 px, capitales espacées) en papier (`--atlas-papier`, `#f4edda`) au lieu d'encre, avec **la bande de couleur de la nation** en bas (`border-bottom:3px`, comme la `.dossier-plaque` du carnet porte le signal) et le nom de la délégation en capitales. Les états :

| État | Ce qu'on voit | Ce qu'on ne voit jamais |
|---|---|---|
| Engagée | Plaque droite, papier, nom en capitales, bande de nation | — |
| Ralliement | Deux plaques qui se touchent, sans espace entre elles | Une flèche, un trait d'union, un cœur, un serment |
| Retrait | La même plaque, **face bois** : papier sans texte, plus sombre d'un cran (`#e4d9c2`, le `--papier-2` du fil généré), bande de nation absente ; elle reste accrochée | Un trou, un cadenas, un voile, une croix, un rouge d'alerte |
| Retour | La plaque remise à l'endroit, identique à « engagée » | Une animation de fête |
| **Disparition** | La plaque **décrochée et posée à plat** : même plaque, même papier, même bande, mais **couchée** — dessinée en `skewX(-15deg)` comme la jauge de campagne, un cran plus bas, sur la ligne de la tablette ; dessous, la **ligne d'organisation** en `.atlas-etiquette` (petite capitale grise) : « Grèce — engagée. Banc repris par la fédération. » | **Du noir, une croix, un ruban, un cadre de deuil, une bougie, un signe religieux, un portrait assombri, une plaque retournée** (retournée, c'est un retrait ; la délégation ne se retire pas, elle change de banc) |

La plaque posée à plat est **remise à l'endroit au générique**, la seule fois qu'on remet une plaque qu'on n'a pas retournée — et le générique la montre droite, sans mention. Deux détails de ton : la ligne d'organisation est la seule phrase, et elle est en petites capitales grises, pas en signal ; le nom de la personne n'est **pas** sur la plaque — une plaque porte une délégation, jamais un nom (c'est ce qui rend la chose « si petite et si calme »). Le chat du port sur la tablette (`opus1_hs_gr_3`) est une réplique, pas un dessin.

**Un signe à retirer du fil.** `doc/refonte/opus1-fil.md` et `scripts/fil-opus1-html.mjs` marquent l'épisode d'une disparition d'un **✝** (U+271D, une croix latine) et le nomment « deuil ». C'est un document auteur, et il ne sort pas du dépôt ; mais c'est exactement le signe que la bible interdit à l'écran, et un jour quelqu'un copiera le glyphe dans une chaîne d'interface. **[Proposition]** Le générateur marque l'épisode par la plaque couchée — un trait long, « — », ou le mot « plaque à plat » — et remplace « deuil » par « disparition » dans ses classes et ses libellés.

### 3.3 La révélation père–fils de la finale 10

`opus1_finale_10`, « Ce que Sorel protège » : Edran révèle être le père de Maël, rejoint son fils, et bat la coalition ; « la révélation précède les ordres, pas le résultat ». Ce que la scène **ne fait pas**, parce que la fiche l'interdit : elle ne montre pas de ressemblance, elle ne place pas deux bustes côte à côte pour qu'on la cherche, elle ne fond pas un visage dans l'autre, elle ne pose pas la main d'Edran sur l'épaule de Maël. La boîte de dialogue ne connaît qu'un buste par réplique, et c'est suffisant : la révélation est **dite**, par Edran, à droite, en `resolution` (§1.4), et la réplique suivante est Maël, à droite, en `surprise` puis en `doute`. Aucun signe visuel n'est autorisé à « confirmer » ce que le texte vient de dire, et surtout pas un signe qui se prolongerait sur Lise, dont le lien reste secret pour tout l'opus.

**[Proposition]** Deux signes minuscules, et ils ne concernent pas les visages : la bande de nom d'Edran reste « Edran Sorel » (son nom professionnel, `personnages.json` ; « les clés internes ne sont jamais affichées ») ; et le badge orange d'Edran, « le seul des Gris à le porter petit », reste petit — c'est après la finale 10 que le joueur comprend pourquoi un prestataire de réserve le portait si discret, sans qu'il ait grandi d'un pixel. Après la révélation, la défaite est imposée et le joueur se replie ; l'écran de fin doit le dire (§3.4).

### 3.4 L'écran de fin et le carnet

**L'écran de fin** est un tableau de marque (`mission.css` §5, `bilan.ts`) : rang S/A/B/C sur une victoire, trois axes en jauges biseautées, les chiffres bruts en dessous — et « Rejouer » primaire sur une défaite. Deux cas de l'opus demandent une variante, sans nouveau vocabulaire :

- **La défaite imposée** (`opus1_finale_10`, et toute mission dont l'objectif bascule sur un retrait). `opus1-adversaires.md` : « la réussite jouable consiste à extraire les équipes », « le succès tactique mesure ce qui a été sauvé ». **[Proposition]** Le titre est « Repli » au lieu de « Manche perdue » (une clé `combat.repli`), le rang est absent comme sur toute défaite, et les trois axes deviennent ce qui a été sauvé — équipes extraites, réserves, archives ou matériel selon le choix de la mission —, dans les mêmes jauges. Rien de rouge, rien de plus sombre que d'habitude : ce n'est pas un échec du joueur, c'est un ordre des choses annoncé.
- **La mission qui ouvre sur une disparition.** L'écran de fin ne la mentionne pas : elle a été dite au briefing, et la plaque est au carnet. Un bilan qui compterait une disparition parmi les « pertes » serait la faute exacte que la bible interdit.

**Le carnet** (`08-narration-choix.md` §3) est le miroir lisible des flags, diégétique, remis par l'Intendance : repère, lieu, décision à la première personne, témoin, conséquence. Le fil de campagne (`campagne.css`) le rend déjà comme un itinéraire de stations en losange et un dossier-briefing. Ce que la disparition y ajoute : une page (`carnet_hs_gr_nikos`, `carnet_hs_np_mira`, `carnet_tomas_desserte`, `carnet_samir_caravane`) dont le **témoin** est l'adjointe, et dont l'illustration est **la plaque couchée** du §3.2 — pas le portrait. Si le portrait paraît (le briefing a un `.atlas-fiche-portrait`, une vignette tournée de −2° comme une photo épinglée), c'est le portrait ordinaire, en couleurs, avec la ligne d'organisation en légende à la place de la fonction. Le signet en marge des pages où un commandant a laissé un mot (`08` §3, [Proposition] de la bible) suffit à marquer ces quatre pages ; il n'y a pas de signet noir.

### 3.5 Les hors-série

Le fil généré (`opus1-fil.md`, `fil-opus1-html.mjs`) marque un hors-série d'une ligne teintée **orange** (`#d9782a`, fond `#f6e3cf`) et d'un badge « HS ». Le badge est bon : un signe court, sur la ligne, jamais un menu à part — `13-campagne.md` §5.1 le dit d'un fil, « pas d'écran à lui, pas de menu, pas de liste de quêtes ». **La teinte, non.** Dans ce monde, l'orange est **la couleur du matériel à l'essai et des Gris** (`01-bible.md` §3.2 et §3.4 ; `#f0761e` sur les huit fiches de la faction). Un épisode teinté d'orange dit au joueur « ceci est méridien » ou « ceci est à l'essai », ce qui est faux pour vingt-six des vingt-huit hors-série, et exactement ce que la fiche de Nera interdit à Atlas de porter. Une couleur qui signifie déjà quelque chose ne peut pas en signifier une seconde.

**[Proposition] Le hors-série est une station à côté de la route.** Dans l'itinéraire de `campagne.css`, la trame principale est une ligne de stations en **losange** (un carré tourné de 45°, `.station-losange`). Un hors-série est un **carré droit**, plus petit (28 px), suspendu **sous** la ligne par un trait court, à l'aplomb de l'épisode qui l'ouvre — il « s'insère après l'épisode qui l'ouvre » et n'a pas de numéro. Il prend la peinture de la **bande de nation** de sa délégation (la `main` de `content/pays/`), puisqu'un hors-série est un arc *par nation* et que c'est l'information utile ; son dossier porte le ruban « HORS-SÉRIE » en `.partie-ruban` (le ruban de coin des cartes de `/jeu`) et la petite capitale `.atlas-etiquette` « Ouvert par … » là où un dossier verrouillé porte déjà sa phrase (`.dossier-verrou`). Trois états, les mêmes peintures que les stations : fermé hachuré, ouvert cerclé de signal, remporté plein. Aucune couleur nouvelle, aucun menu, et l'orange rendu à qui il appartient. Si le badge « HS » est gardé sur le fil auteur, il prend la bande de nation, pas l'orange.

## 4. Production

### 4.1 L'ordre

Les bustes sont produits dans l'ordre où le joueur les rencontre, en pesant les scènes qui ne se jouent pas sans eux :

1. **Ariane et Tomas** — les dix exercices et la saison 1 ; Ariane est dans presque toutes les scènes de l'opus.
2. **Hadran Ost**, puis **Edran Sorel** (épisodes 15 et 16, `opus1_fr_05` et `opus1_fr_06`), **Maël et Lise** (épisode 21), **Yuna** (28), **Basile** (33) : les huit adversaires arrivent tous dans les deux premières saisons nationales. **Sélène** paraît tard mais se produit avec eux — c'est le même lot de gris, et son fil orange doit être décidé en même temps que leurs badges. **Relais Zéro** est un SVG à faire dans le dépôt, au coût d'un après-midi, avant tout le reste.
3. **Les cinq d'Atlas** — Solveig et Vantour ouvrent chacune des quatre scènes de deuil et le Bulletin ; Nera contresigne les retraits ; Osmin et Wren tiennent les archives.
4. **Les dix autres du premier plan**, dans l'ordre des saisons : Elsbeth, Lotte, Samir, Awa, Lívia, Inés, Devika, Ren, Hazel, Ayu.
5. **Les douze du second plan**, avec **Nikos et Mira d'abord** : leurs arcs portent une disparition, et une scène de deuil jouée sur un placeholder vectoriel est la scène qu'on ne veut pas voir jouée ainsi.
6. **[Proposition]** Quatre fiches qui **n'existent pas** : Dafni Rallis, Anju Basnet, Léa Wagener et Nadia Berrada, les adjointes qui reprennent un banc (`opus1-hors-serie.md` §3, §5 point 3). Elles parlent dans les quatre scènes de deuil et n'ont ni entrée dans `personnages.json` ni fiche dans ce JSON (qui en compte 37, le nombre du test). Tant qu'elles n'en ont pas, elles parlent avec le placeholder — à trancher avec la question de leur entrée au registre.

Un buste n'est **jamais livré seul** : il vient avec sa `spec`. Or `assets/specs/` connaît dix specs `commandant_<archetype>` (« l'archétype est porté par deux ou trois nations différentes, le visage reste culturellement neutre »), quand ce JSON décrit **trente-sept personnes**. Les deux modèles ne sont pas compatibles : un buste par archétype ne peut pas avoir la ride d'Ariane. **[Proposition]** Une spec par personnage (`buste_<cle>`, budget et contrat de la spec `commandant` : 14 000 triangles au LOD 0, trois matériaux `mat_peau`/`mat_tenue`/`mat_cheveux`, nœuds `racine`/`buste`/`tete`, clip `repos` de 2 800 ms), générée par `scripts/generer-specs-assets.ts` depuis `personnages.json` quand il portera `apparence`. À trancher : ce que deviennent les dix specs par archétype (probablement retirées).

### 4.2 La clé `apparence` de `content/personnages.json` — [Proposition]

Le JSON de direction artistique est un document de `doc/`, et un document ne se sert pas. Pour que la fiche visuelle suive la biographie, les mêmes champs, **avec les mêmes noms**, entrent dans `personnages.json` sous une clé `apparence` :

```json
"apparence": {
  "ageApparent": "42 ans",
  "silhouette": "…",
  "visage": "…",
  "coiffure": "…",
  "tenue": "…",
  "objetFetiche": "…",
  "palette": ["#2f5fd0", "#1b3a86", "#c8324a"],
  "posture": "…",
  "jamais": "…",
  "commandeImage": "…"
}
```

- Le `registre` du JSON n'y entre pas : il se **dérive** — `role: civil` ou aucun `paysCode` → Atlas ; `paysCode: atl` → Gris ; sinon délégation, `premierPlan` disant le plan. Une valeur qu'on peut calculer ne se stocke pas.
- Le `commandeImageSuffixe` est une constante de production, pas une donnée par personne : il vit dans le code qui compose (§4.3), comme le bloc « Style » de `commandeAsset`.
- **Confidentialité.** `apparence` est ce que le joueur voit : c'est public, **sauf trois lignes `jamais`** — celles de Maël, Lise et Edran nomment la fratrie en toutes lettres (« aucune ressemblance familiale n'est un accident », « jamais un sourire de fils avant la finale 10 »). Elles doivent porter `confidentialite: "auteur"` ou être scindées en un `jamais` public (les interdits ordinaires) et un `jamaisAuteur`. `filtrerPersonnagesPourActe` compose ses DTO **explicitement** (« aucune donnée auteur ajoutée ne fuit par propagation ») : ajouter la clé ne la fait pas fuir, et c'est ce qui rend l'ajout sûr ; mais le jour où une route publique servira `apparence`, ces trois lignes ne doivent pas y être. `commandeImage` non plus : c'est de la production.
- **Ce que le validateur devrait exiger** : `palette` de trois couleurs `#rrggbb` ; pour une délégation, `palette[0]` et `palette[1]` égales à `main` et `dark` de `content/pays/<paysCode>.json` (ce test aurait trouvé les trois écarts du §5) ; `jamais` non vide ; `commandeImage` qui se termine par le suffixe commun.

### 4.3 Ce que `commande.ts` devrait en lire

`commandeAsset(spec)` compose une commande **depuis la spec, jamais à la main**, en six blocs : ce que c'est, le style, les mesures, la géométrie nommée, les textures, les clips. Un buste suit la même règle, avec un bloc de plus. **[Proposition]** Une `commandeBuste(spec, apparence)` :

1. « What it is » prend `apparence.commandeImage` **sans son suffixe** — la description de la personne —, puis les mesures, nœuds, matériaux et le clip `repos` viennent de la spec comme aujourd'hui.
2. « Forbidden » ajoute la ligne `jamais` traduite en négations courtes, à la manière d'`interdits()` (`no rank stripes, no cap, no martial gesture…`). Le champ `jamais` est en français ; il faut soit un `jamaisEn`, soit une table de négations fermée. Le second est plus sûr : les interdits d'un buste se répètent (galon, casquette, geste martial, ombre sur le visage, lunettes noires, symbole, motif religieux, arme, cape).
3. Le masque d'équipe garde la consigne existante — panneaux peints en gris neutre — et la précise pour un buste : « veste et col » (la note de la spec `commandant`).
4. **L'image de référence** (le §1 de `tmp/PROMPT-CHATGPT.md`) est déjà écrite : c'est `commandeImage` entier, suffixe compris — éclairage plat sans ombre, fond gris moyen uni, trois quarts, panneaux d'équipe en gris, pas de texte ni de logo ni de drapeau ni d'insigne. Elle sort telle quelle, et le prompt de `tmp/` cesse d'avoir à la faire écrire par un modèle.

Une réserve, et c'est la règle de `commande.ts` retournée contre ce JSON : `commandeImage` y est **écrite à la main** par la directrice artistique, pas composée depuis `silhouette`, `visage`, `coiffure`, `tenue`, `objetFetiche`, `posture`. Elle dérivera le jour où l'un des six champs change. Deux voies : la composer par code (la prose y perdra ; les six champs sont écrits pour être lus par un humain) ou la garder comme texte d'auteur et **tester** qu'elle cite chaque objet fétiche et chaque signe de silhouette de sa fiche. La seconde garde le texte et attrape la dérive.

### 4.4 Ce qui n'a pas été vérifié

- **Rien n'a été regardé à l'écran**, ni généré. Aucune image n'existe ; le buste vectoriel est inchangé ; les 132 px et les 52 px sont lus dans la feuille de style, pas mesurés sur un téléphone.
- **La lisibilité des palettes sur `pal.dark`** : le fond du cadre est le sombre du camp, et un ciré orange (`#e07b28`) sur un cadre « rouge » ou une parka ardoise (`#4d6a78`) sur un cadre « bleu » n'ont pas été contrôlés.
- **Le contraste des gris.** Sept bustes gris sur un cadre `#1d3540` : trois valeurs de gris ont été choisies au raisonnement ; l'écart entre `#8c9097` (Lise, Yuna, Relais Zéro) et `#7c828c` (Basile) est de deux crans, il peut ne pas se lire.
- **Le miroir de l'adversaire** sur un portrait livré (§3.1) reste une hypothèse de lecture du code.
- **Les émotions proposées** ne sont que des descriptions de sourcils et de bouche ; leurs tracés SVG n'ont pas été dessinés.

## 5. Incohérences relevées dans le JSON (non modifié)

Le fichier n'a pas été touché : ce sont des choix de valeur, à confirmer par la directrice artistique ou par le propriétaire.

1. **Trois accents qui ne viennent pas de la fiche pays**, contre la note `source` du JSON (« palette tirée de `content/pays/<code>.json` ») :
   - `cmd_leandro_paz` (ar) : `#e2c341`, le jaune du Brésil et du Sénégal ; `ar.json` propose `#f7f7f5` (les « bandes blanches » de sa tenue) ou `#2c3a4a`.
   - `cmd_amalie_haoses` (na) : `#2f6f8f`, absent partout ; `na.json` propose `#8fa3ae` (le gris-bleu de son « foulard de brume ») ou `#2c3a4a`.
   - `cmd_tess_roa` (nz) : `#2c4a86`, le bleu du Népal et du Brésil ; `nz.json` propose `#2c3a4a` (le « t-shirt bleu nuit » de sa tenue) ou `#f2f0e6`.
   Les trois ressemblent à des copies d'une ligne voisine ; les remplacements proposés sont ceux que la tenue décrite appelle.
2. **Cinq accents sont le `light` du pays** et non un accent du style (`ch` `#f0d2cd`, `jp` `#f7dbe1`, `id` `#f6d3d0`, `ca` `#f4d2ce`, `pe` `#f2cec9`). C'est défendable — une teinte claire de la dominante —, mais la note `source` dit « accent », et pour Elsbeth la tenue « rouge à empiècements blancs » appellerait `#e8e8e6` (`ch.json`). À confirmer.
3. **Relais Zéro, « 132 × 190 »** : la largeur affichée en pixels et la hauteur du `viewBox`. Le cadre est au ratio 160 : 190 ; à 132 px de large la plaque fait 157 px de haut. La `commandeImage` (« portrait proportion ») est juste, le champ `silhouette` non.
4. **La clé `cmd_lise_orven`** porte « Orven », le nom qui lie Lise à Maël, pour une personne dont le nom public est Varen. Ce n'est pas une faute du JSON — la clé vient de `personnages.json`, où elle est fixée par le test du registre et par les scénarios — mais c'est une donnée auteur dans un identifiant, et la règle « les clés internes ne sont jamais affichées » (`opus1-adversaires.md`) devient la seule protection. À signaler, pas à corriger ici.
5. **Les cordons de couleur de Yuna** (§2.2) : leurs couleurs ne sont pas dites, et si elles sont des couleurs de nation, le buste révèle des mandats que le récit tait.
6. **Trois fiches revendiquent l'immobilité** (Sélène « la seule figure du jeu qui ne bouge jamais au buste », Lise « immobile », Basile « immobile comme un dépôt fermé »). Sélène a raison au sens strict — elle seule n'a **aucun** geste de mains —, mais la formule « la seule » se lit mal à côté des deux autres.

## 6. Ce que le propriétaire tranche

1. Les trois émotions (`gravite`, `peine`, `resolution`) et leurs libellés à l'écran — ou une seule, `gravite`, pour toutes les scènes de deuil.
2. Buste à la nation ou au camp (§3.1), et si un portrait livré peut être retourné en miroir.
3. Le geste de la plaque posée à plat tel que dessiné au §3.2, que `01-bible.md` §4.6 ne porte pas encore, et le retrait du ✝ du fil auteur.
4. Le hors-série comme carré suspendu sous la route, aux couleurs de sa nation, à la place de l'orange.
5. Une spec par personnage (`buste_<cle>`) à la place des dix specs par archétype.
6. La clé `apparence` dans `personnages.json`, avec le marquage auteur des trois `jamais` de la fratrie.
7. Les trois accents du §5.1, et les quatre adjointes sans fiche.
8. Un « Repli » pour la défaite imposée de la finale 10.
