# Administration lisible — 12 septembre 2026

L’administration utilisait une encre sombre sans définir son propre fond : le thème sombre du navigateur lui transmettait le fond noir du jeu. Les textes secondaires cumulaient aussi plusieurs opacités, et certains statuts passaient en couleurs pastel prévues pour le noir alors que leur carte restait blanche.

Le périmètre `/admin`, connexion comprise, dispose maintenant de surfaces opaques claires indépendantes du thème système. Les textes secondaires gardent une couleur opaque ; statuts, boutons, champs et focus ont des couleurs explicites. Les formulaires de refus et de correction possèdent un nom accessible. Les textes de 12 px passent à 14 px dans cette interface dense. Les pages de personnages et le laboratoire héritent des mêmes surfaces, sans modifier leurs données ni leurs actions.

Sur mobile, le menu d’administration se déplie avec un bouton nommé et un état `aria-expanded`, puis se replie après le choix d’une rubrique. Sur ordinateur, la navigation reste visible. L’accueil offre un accès direct au laboratoire de missions. Le parcours de production et les améliorations de la fiche asset sont conservés.

`e2e/admin-lisibilite.spec.ts` vérifie les onze routes représentatives, les thèmes clair et sombre, les contrastes des textes/champs visibles (4,5:1 minimum), l’absence de débordement à 390 px, la navigation mobile au clavier et l’état actif sur ordinateur. Ces contrôles DOM ne constituent pas une validation visuelle. Sans Postgres, les pages de routines présentent leur état de base absente : le parcours réel de validation de propositions n’est pas exercé.
