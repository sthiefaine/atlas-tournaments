# Chargement des assets actifs — 12 septembre 2026

La restriction `scenario === premier_contact` est supprimée du chargement de l’environnement. Le chargeur lit l’inventaire public `/api/modeles` puis sélectionne les terrains de la carte et les bâtiments correspondant aux nations réellement présentes. Le même rendu sert toutes les missions, l’atelier et l’exhibition de l’accueil.

Les unités avaient déjà leur chaîne automatique : kit national, géométrie partagée, silhouette procédurale. Les bâtiments tentent le modèle national puis la base commune ; le QG français régional déjà livré reste un alias de repli après le nom national générique. Les numéros de camp ne désignent plus une nation implicite. Un QG conserve la nation de son camp initial après capture.

Le terrain continu garde sa géométrie de relief et prend les cartes de matière livrées ; la végétation de plaine est extraite de son GLB quel que soit le biome, sur les cases de plaine uniquement. Les autres arbres et décors restent procéduraux. Charger les PNG d’un terrain n’implique pas de poser sa dalle par-dessus le relief.

Seuls les fichiers présents dans `public/assets/modeles` sont actifs. Les prototypes de `public/assets/candidats`, visibles dans l’admin, ne sont pas tous activés automatiquement. Le chargeur ne télécharge pas tout le catalogue : seules les familles utiles et disponibles sont demandées. En cas d’échec, le rendu procédural reste disponible. Les missions et l’accueil suivent cette même règle.

Tests : sélection selon carte/nations, ordre de repli, exclusion d’une nation absente, QG livré et transparence, puis chargement navigateur dans Premier contact, Villes du bocage et l’accueil. Aucun contrôle esthétique à l’œil.

## Choix artistique du 12 septembre 2026

La plaine reprend la matière d’herbe procédurale par défaut : ses PNG et ses brins GLB ne sont plus sélectionnés par le chargeur des parties et de l’accueil. Les modèles restent dans la bibliothèque. Les décors superposés (touffes, haies, cultures, bottes et arbres) conservent leur rendu et leur placement. Le relief du plateau est conservé.
