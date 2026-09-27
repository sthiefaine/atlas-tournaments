# Le lore v2 dans le contenu du jeu

*27 septembre 2026. Le propriétaire a validé le lore v2 le 26 septembre (« va y lance plusieurs agents pour faire tout ça en autonomie »). Ce lot fait passer dans le **contenu servi au joueur** ce qui parlait encore l'ancien registre, celui du tournoi qui avait remplacé les guerres ; les documents canon (`BRIEF.md`, bible, `08`, `17`) sont repris par un autre lot.*

## Méthode

Un relevé par motifs sur les valeurs des fichiers du lot — Jeux, tournoi, match, manche, marqueur et marquage, Ronde, non sanglant, trophée, qualification, exhibition, sélection (hors Sélection Méridienne), coup d'envoi, sifflet, entraîneur, plastron, stade, gradins, vestiaire, banc —, puis une lecture de chaque texte trouvé. **Seules des valeurs changent** : aucune clé de chaîne, de flag, de scénario ni de fait. Chaque scénario retouché passe à la version suivante (`majLe` au 27 septembre), comme le veut la règle d'écriture ; chaque pays retouché aussi, et `personnages.json` passe à sa révision 6.

## Ce qui a changé

- **`content/i18n/glossaire.fr.json`** : `adversaire`, `mis hors jeu`, `match`, `manche`, `marquer` et `équipe` (« jamais armée ») ne sont plus des termes imposés. `hors jeu` le devient, pour le HUD et le Registre. Six termes du monde en guerre entrent pour les traducteurs — `an 14`, `charges à blanc`, `concession`, `Bulletin`, `protêt`, `les Gris` —, plus `les Vieilles Manières` en nom propre ; ils guident une traduction, ils n'imposent rien au joueur. Les notes d'Atlas, de Port-Méridien, de la Cinquième Manche, de la Sélection Méridienne, du Consortium, de la Commission, de la Régie, de la Cartographie, du matériel homologué et d'Aube disent le monde en guerre ; le Registre est expliqué dans la note de `concession`. Les `termesInterdits` ne bougent pas : ce sont des ancrages au monde réel et à l'horreur, pas un vocabulaire. Ni `front` ni `Registre` n'entrent comme termes : la vérification du glossaire compare des sous-chaînes, et « affronter », « frontière » ou le registre que Solveig signe à l'exercice 7 les auraient déclenchés à tort.
- **`content/i18n/interface.fr.json`** : 58 textes et 62 notes, aucune clé renommée ni retirée ; quatre clés neuves, `aube.mission_*`, portent la mission de repli des essais Aube, jusqu'ici écrite en dur dans `toile.tsx`. L'écran-titre (« Quatorze ans de guerre. / Atlas fixe les règles. »), le pitch, la frise, le lien de partie libre, la baseline ; les libellés de campagne (« Campagne » au lieu de « Qualification de la Ronde », itinéraire, surtitre, défaite, incarnation) ; la fin de mission (**Victoire**, **Défaite**, **Aucun vainqueur**, « Bilan de la mission ») ; les deux répliques de repli (« Cette bataille nous échappe, pas la guerre », « La guerre continue ») ; l'objectif d'élimination (« toutes les unités adverses ») ; le banc prêté et le vestiaire (voir plus bas) ; le titre court de l'essai « Les réserves contestées », aligné sur le nom du scénario. Le HUD garde **« mettre hors jeu »** : ses notes disent désormais pourquoi (le mot du Registre, qui compte des pièces) au lieu d'interdire « détruit ».
- **`content/commandants-capacites.json`** (révision 4, la 3 gelée ne bouge pas) et les chaînes correspondantes : les faiblesses de Jone et Tiana (« de la guerre » et non plus « du tournoi ») et de Wren (« le contrôle des armes »), les répliques d'Ariane, Lívia, Devika, Leandro, Nikos (« la traversée de l'an 9 »), Luz et Lise (« touchés »), le super de Luz (« pour le reste de la partie »), les descriptions de Lívia, Devika, Tess et Wren, le style de Lívia (« Les tambours donnent l'élan »), et les pièces de Maël, Lise, Basile et Relais Zéro, qui décrivaient encore le système de marquage.
- **Les scénarios** : `premier_contact` (« Cette fois, Tomas l'emporte »), `qg_de_la_presquile` et `opus1_tutoriel_09` (un exercice n'est pas un engagement), `opus1_tutoriel_09` encore (ce qu'une victoire prend, selon la décision du 12 septembre, au lieu du « droit d'exploiter pour une durée fixée »), `opus1_tutoriel_10`, `pacte_du_col`, `couleurs_alliees`, `demo` (« Jeu libre · Les deux ponts »), `archipel_des_deux_rades`, `bras_de_mer`, `aube_reserves_1v2` (la concession du 12 septembre, plus « un droit de quatre ans… jamais un territoire »).
- **`content/campagne.json`**, l'introduction et les entrées 1 à 12 : « le camp français d'Ariane Belloc », les dix exercices « à charges à blanc », la guerre de quatorze ans ; les entrées 9 à 12 suivent les deux titres ci-dessous.
- **`content/personnages.json`** : les vingt-deux fonctions « Commandant(e) de la délégation X » prennent **mot pour mot le rôle du lore v2** (« Commandante du Brésil, organisatrice des fronts du fleuve ») ; vingt-quatre faits publics et deux dilemmes perdent qualification, finale, rencontres, exhibition, coup d'envoi, circuit, classement, stade, manche. Les faits en confidentialité auteur ne sont pas touchés, ni l'ordre, ni la fin du registre.
- **`content/pays/*.json`** : dix accroches ou spécialités (« du tournoi », le stade du Brésil, le coup d'envoi grec, les gradins indiens). Les `interdits` ne bougent pas, même quand ils disent « match » : ce sont les bornes du monde réel.
- **`src/app`** : la description de la page (`layout.tsx`, écrite en dur comme les autres métadonnées du site), la mission de repli des essais Aube (`toile.tsx`, désormais par `t()`), deux aides du banc d'essai qui parlaient d'un « marqueur ».
- **`tests/i18n/pouvoirs-v4.test.ts`** compare désormais les chaînes des kits à `content/commandants-capacites.json`, le contenu que le moteur charge, et non plus au document de conception qui le précédait.

## Trois choix, et pourquoi

1. **Le premier engagement réel reste FR01** (« votre premier combat réel », décision commune). Le pacte du col devient donc une **épreuve officielle, sous l'œil d'Atlas et toujours à blanc**, et l'exhibition sous les couleurs alliées un **front d'essai** — mot que Tomas employait déjà en fin de pacte. « Engagement » disparaît des exercices : dans le lore v2, c'est le nom d'une vraie bataille.
2. **Le banc et le vestiaire sont des mots de stade.** À l'écran, on choisit ses **couleurs** et l'on mène un **commandement prêté** ; les commandants débloqués rejoignent l'**état-major**. Les clés (`banc.*`, `vestiaire.*`), le code et les documents gardent leurs noms ; les notes de traduction font le lien.
3. **La culture sportive des nations reste.** Le lore v2 représente les pays « par leur terrain, leur climat, leur sport, leur savoir-faire » : la Grande Boucle d'Ariane, la lutte d'Inés, les trois jeux de Saran, la course de Kito restent. Ce qui part, c'est le tournoi comme forme du monde.

## Ce qui reste, et pourquoi

- `Atlas Tournament`, le nom du jeu ; `Nouvelle Ronde`, le nom de la mécanique de second parcours ; `la Cinquième Manche`, un nom propre.
- Les clés de flags `monde.tournoi.*`, `pays.<xx>.qualifie`, `pays.lu.exhibition_gagnee` : ce sont des identifiants.
- « Arbitre », « disqualification » (Ost, Vantour), « le public » (Lívia, Inés), « clubs » (Ayu), « entraîneur des engagements longs » (Kito), « Bulletin », « Registre » : le lore v2 les garde.
- « Homologation » dans les quêtes et essais Aube qui portent une décision (`aube_archives_secondaire`) : le mot y est expliqué dans la même phrase, et retoucher le texte reposerait la décision (voir ci-dessous).

## Ce que cela coûte

- **La décision du tutoriel 10** s'enregistre sous `opus1_tutoriel_10:<version>` : un profil qui a choisi sous la version 6, puis rejoue et regagne l'exercice, verra la question reposée. Les conséquences déjà acquises restent lues par scénario, pas par version. C'est la conséquence mécanique connue de la règle d'incrément (`CLAUDE.md`, 9 septembre).
- Une partie en cours de l'un des dix scénarios retouchés ne se reprend pas : elle recommence, comme à chaque texte retouché.
- `verifier:campagne` reste à 46/48, rejeu conforme ; les deux rouges sont FR03, déjà rouge.

## Hors de ce lot, à reprendre

- `doc/refonte/pouvoirs-v4.json` et `supers-vilains.json` : les mêmes textes de kits et de pièces, sans quoi `tests/engine/commandants-v4.test.ts` — déjà rouge sur `VERSION_MOTEUR` — rougira aussi sur la transcription le jour où cette ligne sera corrigée. `pouvoirs-v4.md` et `supers-vilains.md` citent encore trois ou quatre de ces textes.
- `src/app/campagne/consequences.ts` : « voici votre premier vrai front » (banc du pacte, contredit FR01), « nous échangeons les bancs », « après le match des deux rives ».
- `content/commandants-jouables.json` : un « goût » dit « une fois par match », l'indice du secret de Basile parle des « plastrons de marquage ».
- `src/content/identites-commandants.ts` : le dilemme d'Ost, « le calendrier de l'exhibition ».
- `content/scenarios/opus1_fr_03`, `08`, `11` et l'entrée de FR06 dans `campagne.json` : « match », « manche ».
- `content/fils/`, `archetypes.json`, `gabarits-missions.json`, `mecaniques.json` : tournoi, match, manche, marquage — servis aux routines.
- Régénérer `doc/refonte/roster-heros.md` et le fil (`npm run roster:heros`, `npm run fil:opus1`) après la fusion : ils lisent `personnages.json`.
