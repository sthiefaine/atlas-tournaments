/** Conseils éditoriaux publics ; les contre-unités chiffrées viennent de ficheUnite. */
export interface GuideUnite { role: string; achat: string; limite: string }
export const ROLES_UNITES: Readonly<Record<string, GuideUnite>> = {
  "drone_marin": {
    "role": "Reconnaissance maritime",
    "achat": "Pour observer les chenaux et couvrir une traversée à moindre coût naval.",
    "limite": "Sans arme, limité aux eaux navigables et brouillable ; ne remplace pas une escorte."
  },
  "infanterie": {
    "role": "Prendre et tenir",
    "achat": "Pour capturer les bâtiments et occuper les abris à petit prix.",
    "limite": "Ne remplace pas un blindé dans un duel frontal."
  },
  "meca": {
    "role": "Capture antiblindé",
    "achat": "Pour avancer avec les capteurs sur un relief difficile.",
    "limite": "Sa lenteur exige un itinéraire court ou un transport."
  },
  "recon": {
    "role": "Reconnaissance terrestre",
    "achat": "Pour ouvrir la vision et repousser les unités légères.",
    "limite": "Éviter les blindés et les corridors couverts par le tir indirect."
  },
  "char_leger": {
    "role": "Initiative mobile",
    "achat": "Pour exploiter une ouverture avant que les appuis adverses arrivent.",
    "limite": "Sa résistance ne permet pas de tenir seul une ligne lourde."
  },
  "char_lourd": {
    "role": "Ancrage blindé",
    "achat": "Pour tenir un passage sous pression avec des soutiens derrière lui.",
    "limite": "Son investissement réduit le nombre de captures disponibles ailleurs."
  },
  "artillerie": {
    "role": "Appui de proximité",
    "achat": "Pour couvrir les capteurs derrière une première ligne.",
    "limite": "Ne tire pas au contact ; protéger sa zone morte."
  },
  "roquettes": {
    "role": "Interdiction lointaine",
    "achat": "Pour couvrir plusieurs accès depuis une position préparée.",
    "limite": "Un adversaire qui entre sous sa portée minimale impose un repli."
  },
  "antiair": {
    "role": "Écran antiaérien mobile",
    "achat": "Pour accompagner les blindés face aux aéronefs.",
    "limite": "Doit atteindre le contact ; ne protège pas toute une carte."
  },
  "helico": {
    "role": "Pression par les airs",
    "achat": "Pour contourner les routes et appuyer une percée terrestre.",
    "limite": "Repérer les défenses antiaériennes avant de s’engager."
  },
  "transport": {
    "role": "Logistique terrestre",
    "achat": "Pour déplacer des passagers et ravitailler une ligne alliée.",
    "limite": "Besoin d’une escorte : son rôle ne consiste pas à gagner les duels."
  },
  "genie": {
    "role": "Remise en service",
    "achat": "Pour exploiter les bâtiments désaffectés et aménager les passages.",
    "limite": "Immobiliser des fonds dans le chantier laisse moins de force immédiate."
  },
  "drone": {
    "role": "Observation économique",
    "achat": "Pour reconnaître une approche sans engager un aéronef coûteux.",
    "limite": "Le brouillage réduit sa vision et il ne remplace pas une unité de combat."
  },
  "brouilleur": {
    "role": "Déni de renseignement",
    "achat": "Pour aveugler les drones autour d’une ligne ou d’un objectif.",
    "limite": "Le brouillage ne protège pas des observateurs terrestres."
  },
  "char_moyen": {
    "role": "Ligne polyvalente",
    "achat": "Pour renforcer une ligne que les chars légers ne suffisent plus à tenir.",
    "limite": "Moins spécialisé que le char lourd en résistance et le léger en initiative."
  },
  "missiles_air": {
    "role": "Bulle antiaérienne",
    "achat": "Pour couvrir à distance une zone de production ou une artillerie.",
    "limite": "Sa portée minimale laisse un angle mort et ses cibles sont aériennes."
  },
  "missiles_sol": {
    "role": "Siège terrestre",
    "achat": "Pour menacer des positions terrestres depuis l’arrière.",
    "limite": "Une forte portée ne remplace pas une escorte ni la vision sur la cible."
  },
  "chasseur": {
    "role": "Supériorité aérienne",
    "achat": "Pour intercepter les aéronefs et ouvrir le ciel aux transports.",
    "limite": "Ne constitue pas une réponse aux objectifs terrestres."
  },
  "bombardier": {
    "role": "Appui aérien lourd",
    "achat": "Pour frapper une position terrestre après couverture du ciel.",
    "limite": "Coûteux et vulnérable aux intercepteurs et à l’antiaérien."
  },
  "transport_air": {
    "role": "Projection aérienne",
    "achat": "Pour déposer des passagers au-delà des accès terrestres.",
    "limite": "Le trajet et le débarquement doivent être protégés."
  },
  "barge": {
    "role": "Traversée maritime",
    "achat": "Pour porter la force terrestre entre deux rives.",
    "limite": "Préparer une rive de débarquement et une couverture maritime."
  },
  "porte_avions": {
    "role": "Base aérienne embarquée",
    "achat": "Pour transporter et soutenir des aéronefs loin des aéroports.",
    "limite": "Investissement naval important qui exige sa propre protection."
  },
  "cuirasse": {
    "role": "Appui depuis la mer",
    "achat": "Pour couvrir une côte à longue portée.",
    "limite": "Sa présence dépend de voies maritimes et il craint les approches proches."
  },
  "sous_marin": {
    "role": "Menace navale discrète",
    "achat": "Pour contester les routes maritimes en utilisant la plongée.",
    "limite": "Surveiller son carburant et les moyens de détection adverses."
  },
  "furtif": {
    "role": "Approche aérienne discrète",
    "achat": "Pour ménager une approche grâce au mode furtif.",
    "limite": "La discrétion consomme davantage de carburant et ne garantit pas l’impunité."
  },
  "drone_intercepteur": {
    "role": "Interception légère",
    "achat": "Pour ajouter une réponse aérienne mobile sans acheter un chasseur.",
    "limite": "Cibles aériennes uniquement ; le brouillage reste une menace."
  },
  "drone_ravitailleur": {
    "role": "Soutien aérien léger",
    "achat": "Pour ravitailler des alliés au-delà des routes.",
    "limite": "Ne transporte pas de passager et n’a pas d’arme."
  },
  "meridien_veilleur": {
    "role": "Brouillage aérien méridien",
    "achat": "Pour déplacer le déni de vision avec la ligne de prototypes.",
    "limite": "Fragile : le brouillage des drones ne neutralise pas l’antiaérien."
  },
  "meridien_bastion": {
    "role": "Ancrage antiaérien méridien",
    "achat": "Pour verrouiller un passage face à la pression aérienne.",
    "limite": "Lent, coûteux et exposé au tir indirect terrestre."
  },
  "meridien_automate": {
    "role": "Ligne automatisée méridienne",
    "achat": "Pour tenir le terrain sans munitions à compter, en nombre, sortie des superusines.",
    "limite": "Aveugle au ciel et encaissé comme un char moyen : le tir indirect et les chars lourds l’usent."
  }
};
