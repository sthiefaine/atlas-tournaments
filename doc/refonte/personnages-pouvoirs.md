# Registre des personnages et capacités — révision 4

Le registre administratif `/admin/personnages` réunit 37 personnages : les 24 commandants nationaux (12 nations au premier plan), les huit commandants de la faction adverse, Solveig et Wren pour Atlas, et les trois personnages civils Nera, Osmin et Célestin.

Chaque fiche conserve une motivation, une croyance, des liens et des faits historiques datés dans le calendrier fictif. Les commandants disposent d’un profil tactique, d’un contre-jeu, d’un pouvoir et d’un super-pouvoir chiffrés. Les civils conservent un rôle narratif sans devenir artificiellement des commandants.

## Source des capacités

`content/commandants-capacites.json` est la source des profils de révision 3. L’admin et `chargerCommandantJeu` lisent les mêmes effets. Les coûts de jauge et durées sont affichés avec la description ; les effets techniques se déplient pour vérification.

`Scenario.commandantsVersion` sélectionne explicitement une révision (1, 2 ou 3). Son absence conserve le comportement historique lié au catalogue. Les scénarios déjà livrés ne sont pas basculés silencieusement : les tutoriels et leurs sauvegardes gardent leurs règles. Toute modification ultérieure d’une mission pour adopter les nouvelles capacités doit aussi augmenter sa version.

Le catalogue repose sur les modificateurs déjà exécutés par le moteur. Une doctrine narrative autour de l’IEM ou du climat ne crée pas implicitement un nouveau pouvoir de contrôle météorologique. Les réglages sont une première base chiffrée, pas une homologation d’équilibrage humain.

## Secrets

L’admin est un espace auteur et montre les révélations avec leur statut. Le contexte des routines est composé explicitement côté serveur. Les faits `confidentialite: auteur` restent privés ; les faits à jalon ne sont jamais débloqués par un simple numéro d’acte. La parenté cachée et le pivot père-fils ne doivent pas être déduits d’un champ de fonction public. L’API actuelle par acte ne permet pas de forcer le jalon S5E4 : cette autorisation demandera la progression serveur correspondante.

Le fichier des histoires n’est pas servi par la route générique du canon. Les textes publics des capacités ne contiennent ni parentés ni notes d’auteur.
