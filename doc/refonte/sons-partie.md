# Effets sonores de partie — 12 septembre 2026

Les parties jouables disposent de huit timbres Web Audio synthétiques : rafale, canon, missile, impact, mise hors jeu, capture, production et pouvoir. Ils ne téléchargent aucun fichier et ne consultent aucun service. Ce sont des bruitages stylisés, sans voix ni musique ; ils ne prétendent pas remplacer une séance d’écoute et de direction sonore.

La page de jeu crée une sortie optionnelle transmise au rendu. Le réalisateur déclenche chaque son au premier passage du geste visible correspondant, une seule fois. Aucun minuteur audio ne devance le rendu. La vitesse et les annulations restent celles de l’animation ; les gestes instantanés n’accumulent pas de sons. La démo d’accueil ne reçoit aucune sortie audio.

Le contexte est créé après un appui ou une touche sur la carte ; les refus du navigateur laissent le jeu silencieux. Quitter l’onglet coupe les voix et suspend le contexte, sans rattrapage au retour. Un nouveau geste le réveille. Passer une animation coupe les voix ; quitter la partie ferme le contexte et retire les écouteurs. Douze voix au maximum, les plus anciennes sont retirées en premier. Le niveau de sortie est atténué et passe par un compresseur.

Les réglages proposent « Sons en partie » et un volume de 0 à 100 %, enregistrés avec les autres préférences de l’appareil. Les anciennes préférences adoptent 45 % et le son actif, toujours derrière le premier geste. Les valeurs invalides sont normalisées. Aucun état sonore n’influence la simulation ou les sauvegardes tactiques.

Vérifications automatisées : absence de création avant geste, plafonnement des voix, annulation, pause d’onglet, absence de reprise automatique, mute, nettoyage idempotent ; déclenchement daté des gestes testé côté animations. L’équilibre sonore final reste à écouter sur haut-parleurs et casque.

## Complément — environnement, déplacements et dialogues (13 septembre 2026)

Branche `codex/sons-environnement-dialogues` : cinq timbres de locomotion suivent les gestes de déplacement, cadencés à 280 ms sans rattrapage de sons entre deux images. La position courante du trajet est vérifiée contre la visibilité. Les textes produisent une ponctuation synthétique espacée de 90 ms uniquement pendant la frappe des lettres ; compléter ou passer la réplique arrête la frappe. Il ne s’agit pas de doublage enregistré.

L’environnement sélectionne pluie/tempête, insectes nocturnes, vagues du littoral ou vent. Des nappes discrètes sont émises toutes les quatre secondes, après déverrouillage audio. Tous ces sons partagent le volume existant, le mute, la suspension d’onglet et le nettoyage de la partie. L’accueil reste silencieux. Aucun fichier audio n’est téléchargé. Les timbres sont une première réalisation synthétique ; leur qualité et leur équilibre doivent encore être écoutés humainement.
