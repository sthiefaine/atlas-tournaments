# Interface, ambiance et duels — 14 septembre 2026

Cette passe relie trois demandes : harmoniser les menus, rendre le paysage sonore continu et utiliser les figurines du jeu dans un combat rapproché.

## Interface livrée

- Accueil, départ de campagne, carte, briefing, HUD, carnet, réglages, atelier et administration utilisent des surfaces sombres et des commandes plus sobres. Les liserés décoratifs sont retirés des surfaces concernées ; les champs et les focus gardent leurs repères. Les couleurs d'équipe et les marqueurs du terrain conservent leur fonction.
- Le départ garde les deux profils et le verrou du mode difficile. Son retour est à gauche. La carte SVG conserve son contenu et accepte le glisser à la souris en plus du défilement tactile et du clavier.
- L'atelier simple propose un retour à gauche, le sélecteur à droite et des groupes terrestre/aérien/naval. Les gestes du plateau restent disponibles.
- Les réglages ont quatre onglets : partie, audio, affichage, sauvegardes. Flèches clavier, sélection annoncée et panneaux associés. Les modifications sont enregistrées immédiatement ; les erreurs de stockage restent visibles.
- L'administration présente trois entrées de travail (modèles, missions, personnages). Les détails d'exécution des routines sont repliés. Les pictogrammes SVG sont locaux et partagés avec l'accueil.
- La bibliothèque présente des lignes de modèles avec catégorie, sous-groupe d'unité, recherche et disponibilité du lot exposé. « Lot disponible » vient du manifeste des candidats exposés, pas d'une approbation artistique. Les filtres sont conservés dans l'URL et peuvent être effacés. La gestion avancée reste accessible.

Les règles, sauvegardes et révélations de campagne n'ont pas changé. Il ne s'agit pas d'une réécriture de chaque écran métier de l'administration : ceux-ci héritent des commandes communes.

## Ambiance sonore

`src/audio/ambiance.ts` produit des nappes stéréo en boucle : vent, pluie, vagues et insectes nocturnes. Le contexte de partie existant choisit la nappe. Deux nappes se croisent pendant 1,4 seconde lors d'un changement ; la modulation lente ne redémarre plus toutes les quatre secondes. Deux buffers partagés par contexte suffisent aux ambiances.

Le moteur distingue trois bus : environnement, effets et radio des dialogues. Le volume général reste indépendant. Les valeurs sont bornées et les anciennes préférences reçoivent le mixage par défaut sans migration ni effacement. Le jeu et l'atelier lisent ce même mixage.

La radio utilise de courts bruits filtrés, limités à un départ toutes les 75 ms ; ce n'est pas une voix de synthèse. Les timbres mécaniques varient légèrement et les buffers de bruit sont réutilisés. Les tirs et la radio abaissent temporairement le fond sonore. Passer une animation arrête ses effets sans couper le paysage.

Le contexte attend toujours un geste. Un onglet masqué suspend le son ; aucun événement n'est rattrapé au retour. Le démontage arrête les sources et ferme le contexte. Aucun enregistrement, musique, service externe ou téléchargement audio ajouté : les sons restent synthétiques. Aucune qualité d'écoute n'est prétendue validée.

## Combat rapproché

Cette première version est remplacée par les [formations selon les PV et le budget mobile](mobile-formations-combat.md), à la demande du propriétaire le 14 septembre.

`src/render3d/combat-rapproche.ts` monte deux copies des figurines déjà présentes dans le calque des unités. Les GLB chargés sont utilisés ; une unité sans GLB garde sa silhouette procédurale. Le duel n'effectue aucun chargement d'asset et ne crée aucun contexte graphique supplémentaire.

Les géométries et textures sont partagées. Les matériaux et squelettes animés sont propres à la scène temporaire. Le socle de sélection du plateau ne fait pas partie de la figurine montrée. L'orientation prend en compte la conversion préalable des sources vers l'avant +X du rendu. Les matériaux standard à nœuds utilisent le clone complet du chargeur, et le brouillard du plateau n'est pas recopié.

La scène dispose de sa caméra, de son éclairage et d'un sol choisi selon le terrain. Elle est rendue hors écran puis composée dans une fenêtre transparente du HUD avec **le renderer de la partie**. Le tampon est borné à 1400 × 700 pixels ; aucune géométrie LOD supplémentaire n'est créée. Le viewport, le scissor, la cible et l'effacement du renderer sont restaurés après chaque composition.

La partition reste l'unique calendrier :

- Tir à 35 % du duel ; riposte 80 ms plus tard à cadence normale.
- Trajectoire en rafale, missile, cloche ou marqueur selon les profils existants.
- PV et impacts à l'arrivée des tirs, et non à leur départ.
- Recul, caméra légèrement rapprochée et clips `tir`, `touche`, `hors_jeu` disponibles dans le modèle. Les clips ne sont pas inventés sur les GLB qui n'en possèdent pas.
- Cadence rapide prise en compte ; en animations réduites, présentation fixe de l'issue. Clic sur le duel ou son bouton pour passer, avec arrêt et libération idempotents.
- Le jeu filtre les duels contre la visibilité avant/après l’action : une victime visible ne disparaît pas prématurément, un combat entièrement caché n’ouvre pas de fiche. Les règles de dégâts et de victoire restent celles du moteur.

Les points de départ des effets sont encore estimés d'après le volume des figurines ; ils ne garantissent pas un raccord exact à chaque bouche de chaque GLB importé. Les infanteries sans squelette ne gagnent pas automatiquement une animation de bras. Les scènes restent donc à affiner artistiquement modèle par modèle. La représentation par formations décrite dans le document lié ci-dessus remplace ce premier rendu de deux GLB animés à chaque image.

## Vérifications

`npm run typecheck` puis `NEXT_DIST_DIR=.next-build npm run build` réussis ; build final sans avertissement. `git diff --check` propre. Aucune suite de tests, simulation, capture, revue visuelle ou écoute exécutée, conformément aux consignes existantes. La compilation ne vaut pas validation du rendu ni de l'ambiance.
