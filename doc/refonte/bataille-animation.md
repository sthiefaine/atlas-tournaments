# Animation de bataille et son — 12 septembre 2026

Le cerveau de présentation existe : `ecrirePartition` transforme les événements validés du moteur en gestes datés, puis `animationsDePartition` les interprète sur les figurines et GLB de la carte. Le calcul des dégâts reste dans le moteur ; couper une animation ne change jamais son résultat.

Cette passe raccorde les sons à **la première image visible de chaque geste**, avec le profil de tir issu du catalogue courant. Les rafales, canons et missiles ont des signaux distincts, puis viennent impact et mise hors jeu ; capture acquise, production et pouvoir ont leurs propres départs. Il n'y a pas de seconde horloge sonore qui dériverait de la scène. Une animation sautée, annulée avant son départ ou de durée nulle ne déclenche aucun son tardif. Les voix déjà lancées sont arrêtées par le cycle de vie du rendu.

La riposte visuelle commence 80 ms après le premier tir en cadence normale et 40 ms en cadence rapide. Les projectiles se croisent avant les impacts. Le réalisateur principal, le chemin provisoire du banc et les repères du panneau de duel sont alignés. Les règles de dégâts et les PV calculés ne changent pas. L'écran de duel actuel montre encore des illustrations sur deux panneaux Canvas ; ce n'est pas une scène de combat GLB rapprochée.

## Suite proposée, pas encore livrée

Conserver la bataille sur la carte comme présentation rapide : elle garde le terrain et la position des alliés visibles. Pour une vue spectaculaire facultative, réutiliser la même partition dans une petite scène Three.js rapprochée, avec caméra latérale, terrain local, unités GLB et leurs points de départ de tir. Cette scène doit utiliser les mêmes profils, sons, horaires et actions de passage. Elle n'a besoin ni d'un moteur de combat supplémentaire ni de vidéos précalculées. Les points de bouche encore estimés devront être calibrés par modèle avant d'obtenir des gros plans précis.

Des sprites ou séquences d'images restent adaptés aux petites fumées et éclats ; ils ne remplacent pas l'animation des unités. Une arène indépendante doit aussi limiter ses textures et géométries, respecter les réglages de mouvement réduit et restituer la carte sans charger un second exemplaire de tous les assets.

## Vérification

Tests de partition : tirs, impacts, riposte avant le premier impact, panneau de duel, cadence rapide, durées nulles et fins de séquence. Tests de l'interprète : signal unique au départ prévu, aucun signal dans l'attente, après annulation ou saut direct à la fin. Les tests existants couvrent la libération des effets et la restauration des figurines. Aucune appréciation visuelle ou écoute artistique n'est revendiquée par ces contrôles.
