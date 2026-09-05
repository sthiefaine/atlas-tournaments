# 14 — Registre des secrets

> ## ⚠️ Ce document n'est **jamais** servi aux routines
>
> **Il est exclu de `/api/canon`, et il n'existe aucune version machine de son contenu.**
>
> - `GET /api/canon/[...chemin]` ne sert que le dossier `content/` : `doc/` lui est inaccessible **par construction**, il n'y a pas de chemin qui y mène (`src/app/api/canon/[...chemin]/route.ts` et `src/serveur/canon.ts`, vérifié).
> - Seconde barrière, explicite : la route refuse tout chemin de préfixe **`content/secrets*`** — fichier ou dossier, quelle que soit la casse — en lecture **et** en listage. Rien ne porte ce nom aujourd'hui : c'est une interdiction, pas un filtre. Test : `tests/serveur/canon-secrets.test.ts`.
> - Aucun flag `monde.secret.*` n'entre dans `content/flags.json`, donc aucun n'est servi par `GET /api/routines/bible/flags`. Une routine qui ne connaît pas un secret ne peut pas le laisser filer dans un dialogue.
> - `validerFil` refuse un flag `monde.secret.*` dans `flagsEcrits` : aucun contenu généré ne peut poser un secret.
>
> **Les easter eggs sont codés à la main, jamais générés.** Ce document est écrit pour Thief et pour les personnes qui implémentent ; il n'entre dans aucun prompt, aucun endpoint, aucune sortie JSON.

*Document 14. Canon supérieur : `BRIEF.md`, section « Campagne, modes, généraux secrets, easter eggs ». `01-bible.md` reste propriétaire du lore et de la charte de sensibilité — un easter egg n'y déroge jamais. `13-campagne.md` est propriétaire du système `Deblocage` qui sert de récompense à plusieurs d'entre eux.*

---

## 1. Les règles du registre

1. **Un secret pose un flag `monde.secret.<nom>` et rien d'autre.** Jamais un flag de pays, jamais un flag de commandant, jamais un flag de trame. Un easter egg ne fait pas avancer l'histoire.
2. **Le domaine `secret` existe dans `REGEX_FLAG`** (`src/schemas/types.ts`) pour que ces clés soient bien formées, et **nulle part ailleurs**. Il est absent de `content/flags.json` volontairement.
3. **Un secret est stocké au profil**, dans `ProfilCampagne.secretsTrouves`, par son **nom court** (`case_zero`, `quatre_traits`…). Le flag `monde.secret.<nom>` est la forme longue, celle des documents ; la forme courte est celle du code.
4. **Il se transmet d'un profil à l'autre** (`13-campagne.md` §9) : un secret trouvé reste trouvé, même dans une nouvelle campagne.
5. **Aucun secret n'est jamais indispensable.** Aucune fin, aucun fil obligatoire, aucune destination n'en dépend. Le seul fil qu'un secret peut ouvrir — `fil_quatre_traits` — a **toujours** une seconde porte (`monde.cinquieme.contact`).
6. **Un secret respecte la charte de sensibilité** (`01-bible.md` §7) comme tout le reste. Pas de blague sur un pays, pas de date réelle, pas de personne réelle, pas d'allusion à un conflit. Le registre autorisé est le même : géographie, folklore, sport, fête, artisanat, et l'auto-dérision d'Atlas.
7. **Un secret ne casse jamais le déterminisme.** Il n'ajoute aucune unité, ne modifie aucune règle, n'écrit rien dans une `Sauvegarde` de partie. Ses récompenses sont : une entrée de carnet, une bannière ou une teinte d'équipe, une carte de terrain à usage unique, ou un `Deblocage`.
8. **Treize secrets aujourd'hui.** Ajouter un secret est une décision humaine, prise ici et dans le code au même moment.

---

## 2. Le registre

### 2.1 `monde.secret.case_zero` — « Le coin du Cartographe »

- **Où.** Sur le terrain de Port-Méridien, la case (0, 0) : un angle de gazon hors du tracé, où personne n'a jamais rien à faire.
- **Comment.** Y amener une unité d'infanterie et y attendre un tour complet, pendant la finale mondiale.
- **Ce que ça débloque.** Une entrée de carnet : Osmin Talvarec a gravé ses initiales dans le béton de la bordure, à l'homologation du terrain, quand il était géomètre. C'est le seul endroit du monde où il a signé quelque chose.
- **Pourquoi c'est bien.** Le joueur y va par curiosité en pleine finale, ce qui lui coûte un tour. C'est un petit sacrifice pour une petite chose, et c'est exactement le bon rapport.

### 2.2 `monde.secret.quatre_traits` — « Le signe »

- **Où.** Écran titre.
- **Comment.** Tracer à la souris ou au doigt quatre traits verticaux puis un cinquième en travers, dans cet ordre, sans lever entre les segments d'un même trait. Au clavier : quatre fois la flèche du bas, puis la flèche de droite maintenue.
- **Ce que ça débloque.** Le titre se raye de craie une seconde, et le déblocage de **Barnab Estève** s'ouvre à moitié (l'autre moitié est `monde.atlas.credibilite ≥ 8`).
- **Attention.** Le signe est celui de la Cinquième Manche. Le jeu ne félicite pas le joueur : il ne dit rien, et c'est plus inquiétant.

### 2.3 `monde.secret.nom_du_recordman` — « Homonyme »

- **Où.** Écran de création de profil, champ du nom de commandant.
- **Comment.** Saisir « Hadran Ost », exactement.
- **Ce que ça débloque.** Une réplique unique de Célestin Vantour au premier match — il s'arrête au milieu d'une phrase, puis reprend en professionnel — et l'ouverture anticipée de `fil_disque_raye`, dès l'acte I au lieu de l'acte II.
- **Note d'écriture.** Ost n'y fait jamais allusion. Il est le seul à ne rien dire, et c'est le meilleur moment du gag.

### 2.4 `monde.secret.premier_avril` — « Le Bulletin du premier »

- **Où.** N'importe quel match, le 1ᵉʳ avril (date réelle du serveur, condition `date`).
- **Comment.** Simplement jouer.
- **Ce que ça débloque.** Vantour annonce au Bulletin une septième météo qui n'existe pas — « averses de confettis sur la deuxième journée » —, la prévision reste par ailleurs exacte, et **absolument personne ne relève**. Récompense : une bannière « Averse de confettis ».
- **Contrainte technique.** Aucune météo réelle n'est ajoutée : c'est une chaîne d'interface, le moteur ne voit rien. Le déterminisme et le rejeu sont intacts.

### 2.5 `monde.secret.quatre_cent_quatre` — « La page qui joue »

- **Où.** La page 404 du site.
- **Comment.** Elle n'affiche pas un message d'erreur : elle affiche une carte 6 × 6, deux infanteries contre deux, trois journées, sans commandant. La gagner.
- **Ce que ça débloque.** Une carte de terrain à usage unique, et la page 404 conserve ensuite le score.
- **Pourquoi c'est bien.** C'est le seul endroit du jeu où le moteur tourne sans campagne, sans profil et sans i18n compliqué. C'est aussi un excellent test de fumée déguisé.

### 2.6 `monde.secret.manche_cachee` — « La cinquième manche »

- **Où.** Port-Méridien, après la finale mondiale, quel que soit le résultat.
- **Comment.** Ne pas quitter le terrain. Rester, et finir trois tours sans donner un seul ordre.
- **Ce que ça débloque.** Les gradins se vident, la Régie coupe, les projecteurs restent. Une manche recommence, sans public, sans arbitre, sans score affiché — elle ne peut être ni gagnée ni perdue, et elle s'arrête quand le joueur s'en va. Entrée de carnet : « J'ai joué la cinquième manche. Il n'y avait personne. »
- **Note.** C'est le secret le plus important du registre : il donne au joueur, en trois minutes silencieuses, l'argument entier de la Cinquième Manche — et le réfute.

### 2.7 `monde.secret.journal_cartographe` — « Le journal du Cartographe »

- **Où.** Le carnet de voyage, section Cartographie.
- **Comment.** Lire les dix-huit relevés régionaux français, un par région, dans l'ordre du tour. La dix-huitième page se déplie.
- **Ce que ça débloque.** Une carte du monde annotée à la main par Talvarec, avec les terrains qu'il n'a jamais réussi à faire homologuer — et une phrase par continent. Ouvre le déblocage d'**Osmin Talvarec** (l'autre porte est `fil_carnets_cartographe`).
- **Coût pour le joueur.** Aucun, sinon la curiosité de lire le carnet jusqu'au bout. C'est la récompense de qui lit.

### 2.8 `monde.secret.reconnaissance` — « On s'est déjà vus »

- **Où.** Le premier match d'une **nouvelle** campagne, quand le profil du joueur en compte déjà une terminée.
- **Comment.** Rien à faire : le commandant adverse cite une décision prise dans la campagne précédente.
- **Ce que ça débloque.** Une entrée de carnet, et une réplique différente selon la décision citée.
- **Contrainte dure.** Il lit `secretsTrouves` et `modesFinis`, jamais les flags d'un autre profil — l'étanchéité entre profils (`13-campagne.md` §9) n'est pas négociable. Ce qui est cité est donc **une décision publique** : un protêt déposé, un barrage ouvert, une finale gagnée. Jamais une confidence.

### 2.9 `monde.secret.sifflet_acier` — « Le sifflet de son maître »

- **Où.** L'écran de pause, sur l'icône du sifflet.
- **Comment.** Sept clics. Le septième produit un vrai coup de sifflet.
- **Ce que ça débloque.** Une entrée de carnet sur le sifflet en acier de Nera Aldouin, hérité de son maître d'arbitrage, et le seul objet qu'elle n'a jamais prêté à personne.
- **Note d'accessibilité.** Le son est bref et jamais fort : un easter egg ne fait pas sursauter quelqu'un.

### 2.10 `monde.secret.badge_orange` — « Fidèle à l'essai »

- **Où.** Les Dépêches du jour.
- **Comment.** Jouer une pièce de matériel en statut `essai` dans dix Dépêches différentes, et ne jamais la produire en campagne une fois homologuée.
- **Ce que ça débloque.** Une teinte d'équipe : le badge orange, peint sur toutes les unités du joueur, alors que plus aucune n'est à l'essai.
- **Pourquoi c'est bien.** C'est un secret qui récompense une fidélité inutile, ce qui est le meilleur genre de fidélité.

### 2.11 `monde.secret.mur_du_vestiaire` — « La craie fraîche »

- **Où.** L'écran de vestiaire d'avant-match, à partir de l'acte II.
- **Comment.** Cliquer trois fois le mur du fond, à gauche du banc.
- **Ce que ça débloque.** Quatre traits et un cinquième barré apparaissent, à moitié effacés — quelqu'un a essayé de les nettoyer. C'est la seconde porte d'entrée de `fil_quatre_traits` (§5.3 de `13-campagne.md`), pour un joueur que la faction n'a pas approché.
- **Note.** Le mur est différent à chaque étape, mais le signe est toujours au même endroit relatif. Il n'apparaît jamais deux fois dans le même pays.

### 2.12 `monde.secret.bulletin_de_minuit` — « Le Bulletin chuchoté »

- **Où.** N'importe quel match lancé entre 00 h 00 et 00 h 05, heure locale du joueur.
- **Comment.** Simplement jouer à cette heure-là.
- **Ce que ça débloque.** Vantour lit le Bulletin en chuchotant, pour ne réveiller personne, et s'excuse à la fin. Entrée de carnet.
- **Contrainte technique.** C'est un **habillage d'interface**, décidé côté client à partir de l'heure locale : le moteur ne lit jamais l'horloge, et le climat du match reste celui que le serveur a fixé. Un rejeu ne rejoue pas le chuchotement.

### 2.13 `monde.secret.derniere_ligne` — « Le générique entier »

- **Où.** L'écran de fin, quelle que soit la fin obtenue.
- **Comment.** Laisser le générique aller à son terme sans le passer.
- **Ce que ça débloque.** Après la dernière ligne, le carnet de voyage s'ouvre une dernière fois sur une page vierge et une seule phrase, différente selon la fin. Puis le titre revient, avec la mention de la Ronde suivante.
- **Note.** C'est le seul secret qu'on trouve en ne faisant rien, et le dernier du registre pour cette raison.

---

## 3. Table récapitulative

| # | Flag | Où | Récompense | Alimente un `Deblocage` |
|---|---|---|---|---|
| 1 | `monde.secret.case_zero` | Port-Méridien, case (0,0) | entrée de carnet | — |
| 2 | `monde.secret.quatre_traits` | écran titre | — | **Barnab Estève** (moitié) |
| 3 | `monde.secret.nom_du_recordman` | création de profil | réplique + fil anticipé | — |
| 4 | `monde.secret.premier_avril` | 1ᵉʳ avril, tout match | bannière | — |
| 5 | `monde.secret.quatre_cent_quatre` | page 404 | carte de terrain | — |
| 6 | `monde.secret.manche_cachee` | après la finale mondiale | entrée de carnet | — |
| 7 | `monde.secret.journal_cartographe` | carnet, 18 relevés | carte annotée | **Osmin Talvarec** |
| 8 | `monde.secret.reconnaissance` | nouvelle campagne | entrée de carnet | — |
| 9 | `monde.secret.sifflet_acier` | écran de pause | entrée de carnet | — |
| 10 | `monde.secret.badge_orange` | dix Dépêches | teinte d'équipe | — |
| 11 | `monde.secret.mur_du_vestiaire` | vestiaire, acte II | signe | ouvre `fil_quatre_traits` |
| 12 | `monde.secret.bulletin_de_minuit` | 00 h 00 – 00 h 05 | entrée de carnet | — |
| 13 | `monde.secret.derniere_ligne` | générique de fin | page de carnet | — |

**Six sur treize** suffisent à ouvrir « Craie » (`13-campagne.md` §7.2, général secret n° 10) : c'est le seul déblocage qui compte les secrets, et il en laisse sept de côté.

---

## 4. Ce qu'un easter egg n'est jamais

- Une **condition d'avancement**. Aucun joueur ne doit chercher un secret pour continuer.
- Un **avantage mécanique durable**. Une carte de terrain à usage unique est le maximum, et elle est prise sur les trois emplacements de la sacoche (`04-gameplay.md` §7.5), jamais en plus.
- Une **plaisanterie sur un pays réel**, une personne réelle, une marque, une date historique, une religion, un conflit. La charte de sensibilité ne connaît pas d'exception « c'est caché ».
- Un **contenu généré**. Aucune routine ne connaît ce document, aucune ne peut en produire l'équivalent, et une production qui contiendrait un flag `monde.secret.*` est refusée au schéma.
- Une **rupture de déterminisme**. Un rejeu enregistré avant un easter egg se rejoue à l'identique après.
