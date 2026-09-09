# Lecture tactique — 9 septembre 2026

Le bouton « Mode tactique » se trouve parmi les commandes de caméra ; sur mobile, dans les outils de vue. Il expose son état avec `aria-pressed`. Le choix passe par l’interface `Rendu`, sans import de Three dans le contrôleur.

En mode tactique, les arbres, pierres et accessoires de paysage sont retirés de la vue. Le terrain, les bâtiments et leurs pavillons restent visibles : les objectifs et la nature des cases restent lisibles. La sortie restaure la visibilité antérieure, y compris celle d’une couche déjà éteinte. Les lots ressemés après changement de grille reçoivent aussi le réglage.

Chaque unité visible reçoit un badge contrasté : numéro du camp (1 à 4), liseré de couleur et signe de rôle. Les signes viennent des traits du catalogue : capture ⚑, anti-air ⊕, tir indirect ⌒, ravitaillement +, brouillage ≈, observation par drone ◇, aérien ↑, transport ▱, contact ■. Une légende pliable explique les signes. Le signe décrit la fonction dominante : le drone intercepteur affiche l’anti-air, le ravitailleur le soutien. Le liseré d’équipe existant autour du socle reste présent.

Le badge est enfant de l’unité rendue : il suit ses transformations, disparaît avec elle dans le brouillard et ne crée aucun repère sur une unité embarquée. Il est identique pour un GLB et une silhouette procédurale. Les matières sont partagées par camp et fonction, puis libérées au démontage ; aucune texture d’asset ni géométrie livrée n’est modifiée.

Les fiches d’inspection et de production affichent également le rôle, la situation d’achat et la limite éditoriale de l’unité lorsqu’un guide existe. Les contre-unités chiffrées restent calculées au moteur.

Validation : 30 tests ciblés `unites.test.ts` et `tactique.test.ts` réussis, dont réversibilité, couches initialement cachées, nouveaux lots, rôles spécialisés, partage des matières et disparition des badges hors vision. Aucune validation artistique ou capture d’écran effectuée.
