# Campagne, bibliothèque et sons — 13 septembre 2026

Les variantes régionales de bâtiments et d’arbres sont suspendues à la demande du propriétaire. Le catalogue conserve les bases, les kits nationaux, les terrains et les décors par biome. Il génère un territoire par nation : 126 anciennes fiches régionales retirées, 10 fiches françaises nationales ajoutées, 935 spécifications au total. Les lots régionaux, leurs alias candidats/actifs et leurs blobs devenus sans référence sont retirés du déploiement. Les sources privées déposées sur next-upload ne sont pas supprimées. Le QG régional français retiré revient au rendu procédural tant qu’aucun QG national ou de base n’est activé. L’historique Git n’est pas réécrit.

La branche `codex/sons-environnement-dialogues` est fusionnée. Les sons de pas, chenilles, moteurs, rotors et sillages, les ponctuations de dialogue et les ambiances météo sont raccordés au jeu. Le banc `/atelier` reçoit maintenant aussi la sortie audio et les préférences du joueur. Le premier geste déverrouille Web Audio ; les sons sont synthétiques, pas des voix enregistrées.

Le réalisateur de combat était déjà en service : événements moteur → partition → gestes Three.js et HUD, avec rafales, projectiles, impacts, clips des GLB et riposte à 80 ms. Le panneau de duel Canvas reste optionnel dans les réglages. Aucune nouvelle arène latérale de combat GLB n’est livrée ici ; les animations se jouent sur la carte. Leur présence ne vaut ni contrôle visuel ni calibration artistique des bouches de tir.

`/jeu` redirige vers `/campagne` et l’entrée Jeu libre disparaît de l’accueil. Les adresses de missions existantes restent compatibles avec les sauvegardes et les essais de l’atelier.

La saison 1 commence par deux missions nationales ajoutées après les douze épreuves existantes :

- `opus1_fr_01`, **Premier courant** : carte 16 × 12, rivière et deux ponts ; capture du QG avant la fin de J24, sans victoire par élimination.
- `opus1_fr_02`, **Les villes du contrat** : carte 16 × 12, deux routes autour d’un bois central ; tenir simultanément deux des trois villes désignées avant la fin de J24, sans substitution par capture du QG.

Les deux ont leurs briefings, scènes, conclusions et modes explicites. Normal : 3 000 fonds adverses ; difficile : 6 000. Même IA pondérée, mêmes revenus, dégâts, objectifs et limite de temps. Les formations, revenus et cartes ne sont pas tirés au hasard. Les autres missions restent éditoriales ; aucun nouveau choix ni effet futur fictivement implémenté. La suite annoncée est la voie de service. Le parcours compte maintenant 14 missions, dont 10 tutoriels. Ces deux nouvelles missions sont accessibles mais non simulées et non homologuées en difficulté.

`/atelier/assets` présente les 935 emplacements de bibliothèque sur une carte orbitale, filtrable et recherchable. Une case verte indique un GLB actif, ocre un candidat, grise un fichier manquant. Le candidat est préféré lorsqu’il existe afin d’inspecter la version en préparation. Chaque case ouvre la fiche admin. Huit modèles au plus sont retenus près du point regardé, deux téléchargements simultanés ; les modèles éloignés sont libérés. Un sélecteur permet de se déplacer directement à un identifiant. Les dimensions sont normalisées pour cette bibliothèque ; le banc existant `/atelier?monde=3` reste la présentation à l’échelle du jeu. Un modèle manquant n’est pas remplacé par un faux GLB livré.

La ville française dispose de sa fiche nationale `batiment_ville_fr`, d’un prompt Gemini dans l’admin et de `scripts/texture/ville-gemini.md`. Gemini produit la référence, Tripo le GLB ; ni génération externe ni achat n’a été déclenché. La préparation et l’approbation du futur modèle restent à faire.

À la demande du propriétaire : aucun test, simulation, contrôle d’asset, typecheck, lint, build ou contrôle visuel exécuté pour cette passe. Les fichiers de tests de la branche sons sont fusionnés sans les exécuter. Les anciens bilans ne valent pas validation de la livraison actuelle.
