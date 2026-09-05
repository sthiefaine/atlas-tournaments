// Exemples valides repris des documents propriétaires : `doc/03-schemas.md` pour
// les objets de jeu, `doc/09-i18n.md` §2 pour les quatre types de traduction.
// Ils servent de référence positive aux tests de validation.

export const paysFr = {
  cle: 'pays_fr',
  version: 3,
  statut: 'en_ligne',
  source: 'humain',
  creeLe: '2026-09-04',
  majLe: '2026-09-04',
  code: 'fr',
  nom: 'France',
  nomCourt: 'France',
  gentile: 'français',
  continent: 'europe',
  climat: 'tempere',
  hemisphere: 'nord',
  biomes: ['plaine', 'foret', 'montagne', 'cotier'],
  specialite: {
    cle: 'spec_fr_polyvalence',
    nom: 'École de tous les terrains',
    portee: 'pays',
    famille: 'polyvalence',
    contenu: {
      variant: 'modificateur',
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'defense', valeur: 1.05 } }],
    },
    description: 'Aucun terrain ne la surprend : un peu plus solide partout, jamais la meilleure nulle part.',
  },
  archetypeCommandant: 'prodige',
  rivalNaturel: 'lu',
  voisins: ['be', 'lu', 'de', 'ch', 'it', 'es', 'gb'],
  palette: { main: '#3f6fe0', dark: '#1f3f8e', light: '#9dbcf7' },
  drapeau: { type: 'bandes_verticales', couleurs: ['#2b4a9b', '#ffffff', '#d0353c'] },
  flagsDisponibles: [
    'pays.fr.tour_complet',
    'pays.fr.regions_visitees',
    'pays.fr.bretagne_maree_lue',
    'pays.fr.rival_respecte',
    'pays.fr.rival_humilie',
    'monde.atlas.sponsor_meridien',
  ],
  regions: ['region_fr_bretagne', 'region_fr_normandie', 'region_fr_ile_de_france'],
  phare: true,
  accroche: "Dix-huit régions à convaincre avant d'avoir le droit de porter le maillot.",
  interdits: ['ne jamais évoquer de conflit réel impliquant la France'],
};

export const commandantCamille = {
  cle: 'cmd_camille_aubertin',
  version: 2,
  statut: 'valide',
  source: 'humain',
  creeLe: '2026-09-04',
  majLe: '2026-09-04',
  code: 'cmd_camille_aubertin',
  nom: 'Camille Aubertin',
  paysCode: 'fr',
  archetype: 'prodige',
  traits: ['curieux', 'gourmand', 'complexé'],
  passif: {
    cible: 'mes_unites',
    filtre: { surTerrain: ['ville'] },
    modificateur: { quoi: 'soin', valeur: 1 },
  },
  pouvoir: {
    nom: 'Tour de France',
    description: "Toute l'équipe avance d'une case de plus, et chaque région déjà remportée ajoute un peu de mordant.",
    barres: 3,
    effets: [
      { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } },
      { cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } },
    ],
    duree: 'ce_tour',
    replique: "On repart, et cette fois on ne s'arrête pas au ravitaillement.",
  },
  superPouvoir: {
    nom: 'Le drapeau à damier',
    description: 'Une relance générale : tout le monde repart devant, et les unités en ville se refont une santé.',
    barres: 6,
    effets: [
      { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 3 } },
      { cible: 'mes_unites', filtre: { surTerrain: ['ville'] }, modificateur: { quoi: 'soin', valeur: 2 } },
    ],
    duree: 'tour_complet',
    replique: 'Dernier tour ! Tout le monde devant !',
  },
  faiblesse: {
    axe: 'economie',
    effet: { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } },
    description: "L'école coûte cher : ses villes rapportent moins que celles des autres.",
  },
  repliques: {
    ouverture: ["J'ai dix-huit régions dans les jambes. On verra bien.", 'On joue chez moi, on joue bien.'],
    victoire: ['Voilà. Et je suis jeune, en plus.'],
    defaite: ["Bien joué. Sincèrement. Ça m'agace, mais bien joué."],
    unitePerdue: ['Rentrez au vestiaire, on vous remplace.'],
  },
  portrait: { teint: '#e8c39e', cheveux: '#3a2a22', accessoire: 'foulard' },
};

export const uniteCharLeger = {
  cle: 'char_leger',
  nom: 'Char léger',
  nomCourt: 'Char lég.',
  statut: 'canon',
  traits: [],
  silhouette: { base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 },
  cout: 6500,
  mouvement: 6,
  typeMouvement: 'chenilles',
  domaine: 'terre',
  portee: [1, 1],
  vision: 3,
  munitions: 9,
  carburant: { max: 70, parCase: 1, parTour: 0 },
  capture: false,
  transport: null,
  degats: {
    infanterie: 75, meca: 70, recon: 85, char_leger: 55, char_lourd: 15,
    artillerie: 70, roquettes: 85, antiair: 75, helico: 0, transport: 90,
  },
  peutRiposter: true,
  peutTirerApresMouvement: true,
};

export const terrainForet = {
  cle: 'foret',
  car: 'F',
  nom: 'Forêt',
  defense: 2,
  couts: { pied: 1, bottes: 1, roues: 3, chenilles: 2, air: 1 },
  capturable: false,
  revenus: 0,
  produit: [],
  ravitaille: false,
  soigne: 0,
  cacheEnBrouillard: true,
  palette: { main: '#2f9a48', dark: '#1e6b32', light: '#8fdc9a' },
};

export const parametresBretagne = {
  largeur: 16,
  hauteur: 12,
  camps: 2,
  biome: 'cotier',
  ratioMer: 0.22,
  ratioRelief: 0.14,
  villesParCamp: 2,
  villesNeutres: 2,
  usinesParCamp: 1,
  aeroportsParCamp: 0,
  symetrie: 'aucune',
  densiteRoutes: 0.6,
  mecanique: 'meca_marees',
};

export const carteBretagne = {
  cle: 'carte_fr_bretagne_01',
  version: 1,
  statut: 'valide',
  source: 'atlas_map',
  creeLe: '2026-09-06',
  majLe: '2026-09-06',
  code: 'carte_fr_bretagne_01',
  nom: 'Pointe du Raz',
  largeur: 16,
  hauteur: 12,
  camps: 2,
  biome: 'cotier',
  grille: [
    'WWWWPPPPPPPPWWWW',
    'WWSPPFFPPMMPPSWW',
    'WSPCRRRRRRRRRCSW',
    'WPFPRPPFPPMPRPFW',
    'PPHPRPPVVPPPRPPP',
    'PPPPRPCNNCPPRPPP',
    'PPPPRPPVVPPPRHPP',
    'WPFPRPMPPFPPRPFW',
    'WSPCRRRRRRRRRCSW',
    'WWPPUMMPPFFUPPWW',
    'WWWWPPPPPPPPWWWW',
    'WWWWWWPPPPWWWWWW',
  ],
  proprietaires: {
    '2,4': 0, '3,2': 0, '6,5': 0, '4,9': 0,
    '13,6': 1, '13,2': 1, '9,5': 1, '11,9': 1,
  },
  unitesDepart: [
    { camp: 0, type: 'infanterie', x: 3, y: 5 },
    { camp: 0, type: 'char_leger', x: 4, y: 4 },
    { camp: 1, type: 'infanterie', x: 12, y: 5 },
    { camp: 1, type: 'char_leger', x: 11, y: 6 },
  ],
  mecanique: 'meca_marees',
  generation: {
    graine: 'fr-bretagne-2026-0006',
    parametres: parametresBretagne,
    mapgenVersion: 1,
  },
  diagnostic: {
    surfaceTerre: 148,
    distanceQgQg: 22,
    distanceQgUsine: [7, 7],
    zonesIsolees: 0,
  },
};

export const scenarioBretagne = {
  cle: 'scen_fr_bretagne_01',
  version: 4,
  statut: 'en_ligne',
  source: 'atlas_lore',
  creeLe: '2026-09-06',
  majLe: '2026-09-08',
  code: 'scen_fr_bretagne_01',
  nom: "Bretagne — La marée n'attend personne",
  acte: 0,
  gabarit: 'capture_qg',
  dureeVisee: 38,
  modes: {
    normal: {
      fondsDepart: 6000,
      fondsDepartIa: 6000,
      revenusParBatiment: 1000,
      revenusIaParBatiment: 1000,
      brouillard: false,
      previsionJournees: 2,
      vitesseJauge: 1,
      limiteJournees: 20,
      strategieIa: 'defensive',
      reprises: 3,
      dureeVisee: 38,
    },
    difficile: {
      fondsDepart: 6000,
      fondsDepartIa: 7500,
      revenusParBatiment: 1000,
      revenusIaParBatiment: 1400,
      brouillard: true,
      previsionJournees: 1,
      vitesseJauge: 0.8,
      limiteJournees: 17,
      strategieIa: 'agressive',
      reprises: 0,
      dureeVisee: 44,
    },
  },
  paysCode: 'fr',
  regionCle: 'region_fr_bretagne',
  carteCle: 'carte_fr_bretagne_01',
  date: '2026-09-06',
  cycleJourNuit: { jour: 4, nuit: 2 },
  catalogueVersion: 1,
  commandants: [
    { camp: 0, commandantCle: 'cmd_camille_aubertin' },
    { camp: 1, commandantCle: 'cmd_maelle_kerdraon', ia: 'defensive' },
  ],
  fondsDepart: 6000,
  revenusParBatiment: 1000,
  brouillard: false,
  limiteJournees: 20,
  victoire: [
    { type: 'capture_qg' },
    { type: 'capturer', cases: [{ x: 6, y: 5 }, { x: 9, y: 5 }], combien: 2 },
  ],
  defaite: [{ type: 'qg_perdu' }, { type: 'limite_journees', journees: 20 }],
  dialogueOuverture: [
    { locuteur: 'cmd_maelle_kerdraon', texte: "Bienvenue chez moi. Regarde bien l'eau : elle joue pour moi.", emotion: 'joie' },
    { locuteur: 'cmd_camille_aubertin', texte: 'Alors je jouerai plus vite qu\'elle.', emotion: 'triomphe' },
  ],
  dialogueVictoire: [
    { locuteur: 'cmd_maelle_kerdraon', texte: "Tu as compris la marée avant moi. C'est rare.", emotion: 'surprise' },
  ],
  dialogueDefaite: [
    { locuteur: 'cmd_maelle_kerdraon', texte: 'Reviens à marée basse. On recommencera.', emotion: 'neutre' },
  ],
  choix: [
    {
      cle: 'choix_fr_bretagne_fin',
      question: "Maëlle s'est fait piéger par sa propre marée. Tu la laisses replier ses unités ?",
      moment: 'fin',
      litFlags: ['cmd.maelle_kerdraon.respect'],
      options: [
        {
          cle: 'laisser',
          libelle: 'La laisser sauver la face.',
          ecritFlags: [
            { cle: 'pays.fr.bretagne_maelle_respectee', valeur: true },
            { cle: 'monde.tournoi.serie_propre', valeur: 1 },
          ],
        },
        {
          cle: 'achever',
          libelle: 'Finir le match proprement, sans cadeau.',
          ecritFlags: [{ cle: 'pays.fr.bretagne_maelle_humiliee', valeur: true }],
          effetImmediat: { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 1.2 } },
        },
      ],
    },
  ],
  flagsRequis: [],
  flagsInterdits: ['pays.fr.tour_complet'],
  recompenses: {
    flags: ['pays.fr.bretagne_maree_lue'],
    fonds: 2000,
    coCommandant: 'cmd_maelle_kerdraon',
    carteMonde: ['scen_fr_normandie_01', 'scen_fr_pays_de_la_loire_01'],
  },
};

export const regionBretagne = {
  cle: 'region_fr_bretagne',
  version: 2,
  statut: 'en_ligne',
  source: 'humain',
  creeLe: '2026-09-05',
  majLe: '2026-09-06',
  code: 'region_fr_bretagne',
  paysCode: 'fr',
  nom: 'Bretagne',
  type: 'metropolitaine',
  ordreConseille: 3,
  biome: 'cotier',
  climat: 'oceanique',
  specialiteLocale: {
    cle: 'spec_fr_bretagne_pied_marin',
    nom: 'Pied marin',
    portee: 'region',
    famille: 'mobilite',
    contenu: {
      variant: 'modificateur',
      effets: [
        {
          cible: 'mes_unites',
          filtre: { surTerrain: ['plage'] },
          modificateur: { quoi: 'mouvement', valeur: 1 },
        },
      ],
    },
    description: "Sur la grève, les Bretons avancent d'une case de plus.",
  },
  mecanique: {
    cle: 'meca_marees',
    parametres: { periodeJournees: 2, amplitudeCases: 1, phaseInitiale: 0, gelable: true },
    description: 'Une journée sur deux, la mer se retire : les plages deviennent praticables, puis se referment.',
  },
  commandantCle: 'cmd_maelle_kerdraon',
  scenarios: ['scen_fr_bretagne_01'],
  accroche: "Ici, l'horaire compte plus que le terrain.",
  motsCles: ['marée', 'granit', 'phare', 'crêpe', 'voile', 'vent'],
  flagsPropres: [
    'pays.fr.bretagne_maree_lue',
    'pays.fr.bretagne_maelle_respectee',
    'pays.fr.bretagne_maelle_humiliee',
  ],
};

export const flagRivalRespecte = {
  cle: 'pays.fr.rival_respecte',
  portee: 'pays',
  paysCode: 'fr',
  libelle: 'Tu as laissé le Luxembourg sortir la tête haute.',
  description: "Posé quand le joueur refuse d'aggraver le score contre le rival naturel de la France.",
  valeur: 'booleen',
  min: null,
  max: null,
  exclusifAvec: ['pays.fr.rival_humilie'],
  impacte: ['recrutement', 'dialogue', 'fin'],
  perenne: true,
};

export const evenementVendee = {
  cle: 'evt_2026_09_vendee',
  version: 1,
  statut: 'valide',
  source: 'atlas_cerveau',
  creeLe: '2026-09-10',
  majLe: '2026-09-11',
  code: 'evt_2026_09_vendee',
  titre: 'Grande course au large',
  resume: 'Les commandants côtiers se prennent au jeu : cette semaine, tout ce qui longe la côte va plus vite.',
  categorie: 'competition_sportive',
  sourceUrl: 'https://www.exemple-officiel.fr/calendrier/course-au-large',
  sourceNom: 'Calendrier officiel de la compétition',
  paysConcernes: ['fr'],
  debut: '2026-11-08',
  fin: '2026-11-30',
  effet: {
    type: 'bonus_pays',
    paysCode: 'fr',
    modificateur: {
      cible: 'mes_unites',
      filtre: { surTerrain: ['plage', 'mer'] },
      modificateur: { quoi: 'mouvement', valeur: 1 },
    },
  },
  valideParHumain: true,
};

export const memoireCartesCompactes = {
  cle: 'mem_2026_09_12_cartes_compactes',
  date: '2026-09-12',
  source: 'atlas_controle',
  sourceRef: 'review_8841',
  sujet: 'motif_rejet_recurrent',
  portee: 'atlas_map',
  porteeRef: null,
  contenu: 'Les cartes de plus de 26 cases de large sont rejetées neuf fois sur dix pour zone morte au centre.',
  poids: 4,
  occurrences: 9,
  expireLe: '2026-12-11',
};

export const promptMap = {
  cle: 'atlas_map',
  version: 7,
  corps: 'Tu produis des PARAMÈTRES de carte, jamais une grille. '.repeat(8),
  auteur: 'atlas_cerveau',
  auteurRef: 'run_2026_09_12_0310',
  statut: 'propose',
  parentVersion: 6,
  justification: 'Le taux de rejet pour zone morte est passé de 12 % à 31 % sur les grandes cartes.',
  diffResume: [
    'largeur maximale abaissée de 40 à 26',
    'densiteRoutes minimale portée à 0.5',
    "ajout d'un rappel : une usine par camp au minimum",
  ],
  metriques: null,
  valideParHumain: false,
  creeLe: '2026-09-12',
  activeLe: null,
};

export const reviewCarte = {
  cle: 'review_8841',
  cibleType: 'carte',
  cibleCle: 'carte_fr_bretagne_02',
  cibleVersion: 1,
  verdict: 'rejete',
  motifs: [
    {
      code: 'zone_morte',
      detail: "Le quart nord-est n'est relié au reste que par une case de pont ; l'IA n'y va jamais.",
      mesure: { cases_isolees: 18, cases_jamais_visitees_pct: 28 },
    },
    {
      code: 'avantage_premier_joueur',
      detail: 'Le camp 0 gagne 13 fois sur 20, hors de la fourchette 40–60 %.',
      mesure: { victoires_camp_0: 13, parties: 20, taux: 0.65 },
    },
  ],
  detail: 'Carte jouable mais déséquilibrée : la liaison unique vers le nord-est concentre tout le jeu au sud.',
  stats: {
    parties: 20,
    strategie: 'ponderee',
    graines: ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10',
      's11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 's20'],
    victoiresCamp: [13, 5],
    nonTerminees: 2,
    journeesMediane: 19,
    journeesEcartType: 6.4,
    fondsMoyenParCamp: [41200, 33900],
    casesJamaisVisitees: 28,
    mecaniqueDeclenchee: 20,
    climat: { saison: 'automne', meteo: 'tiree', phase: 'cycle' },
    dureeMoyenneMs: 412,
  },
  coherenceLore: 0.91,
  suggestions: [
    'Poser une seconde liaison vers le nord-est ou supprimer la zone.',
    "Rapprocher l'usine du camp 1 de son QG d'une case.",
  ],
  routineRunId: 'run_2026_09_12_0310',
  creeLe: '2026-09-12',
};

export const climatHiver = {
  saison: 'hiver',
  phase: 'nuit',
  journeeDansCycle: 4,
  meteo: 'neige',
  previsions: ['neige', 'clair'],
};

export const missionDuJour = {
  cle: 'mdj_2026_09_12',
  date: '2026-09-12',
  eventCode: 'evt_2026_09_vendee',
  scenarioCle: 'scen_mdj_2026_09_12_fr',
  paysCode: 'fr',
  statut: 'en_ligne',
  expireLe: '2026-09-19',
};

export const sauvegarde = {
  scenarioCle: 'scen_fr_bretagne_01',
  graine: 'fr-bretagne-2026-0006',
  catalogueVersion: 1,
  engineVersion: 1,
  mapgenVersion: 1,
  contentVersion: 1,
  actions: [],
};

export const localeZh = {
  code: 'zh-hans',
  nom: '简体中文',
  script: 'han_simplifie',
  sens: 'ltr',
  statut: 'en_preparation',
  seuilCouverture: 1.0,
  facteurLongueur: 0.55,
  echantillonHumain: 20,
  ordre: 8,
};

export const chaineSourcePouvoir = {
  cle: 'cmd.cmd_elsbeth_vonlanthen.pouvoir.nom',
  texte: 'Verrou du col',
  origine: 'genere',
  contexte: {
    ecran: 'hud',
    locuteur: 'cmd_elsbeth_vonlanthen',
    note: 'Nom de pouvoir affiché sous la jauge, à côté du portrait.',
  },
  longueurMax: 24,
  placeholders: [],
  pluriel: false,
  sourceHash: '9f2c14ab73de5061',
  versionChaine: 1,
  objetRef: { type: 'Commander', cle: 'cmd_elsbeth_vonlanthen', champ: 'pouvoir.nom' },
  creeLe: '2026-09-14',
  majLe: '2026-09-14',
};

export const traductionPouvoir = {
  cleChaine: 'cmd.cmd_elsbeth_vonlanthen.pouvoir.nom',
  locale: 'de',
  texte: 'Pass-Riegel',
  statut: 'validee',
  sourceHash: '9f2c14ab73de5061',
  versionChaine: 1,
  auteur: 'atlas_traduction',
  relueParHumain: false,
  runRef: 'run_2026_09_14_0125',
  creeLe: '2026-09-14',
  majLe: '2026-09-14',
};

export const glossaireJa = {
  locale: 'ja',
  termesInterdits: ['戦争', '敵', '殺す', '死'],
  entrees: [
    { terme: 'Atlas', categorie: 'nom_propre', traduction: null, translitteration: 'アトラス' },
    { terme: 'Port-Méridien', categorie: 'nom_propre', traduction: null, translitteration: 'ポール・メリディアン' },
    { terme: 'la Cinquième Manche', categorie: 'nom_propre', traduction: null, translitteration: '第五ラウンド' },
    { terme: 'adversaire', categorie: 'terme_impose', traduction: '対戦相手', note: 'Jamais « 敵 ».' },
    { terme: 'mis hors jeu', categorie: 'terme_impose', traduction: '戦線離脱' },
    { terme: 'journée', categorie: 'terme_impose', traduction: 'デイ', note: 'Le tour de jeu, pas la journée du calendrier.' },
    { terme: 'infanterie', categorie: 'unite', traduction: '歩兵' },
  ],
  majLe: '2026-09-10',
};

// ---------------------------------------------------------------------------
// Campagne : fil, déblocage, profil (`doc/13-campagne.md`)
// ---------------------------------------------------------------------------

export const filPlumeRegie = {
  cle: 'fil_plume_regie',
  version: 1,
  statut: 'valide',
  source: 'humain',
  creeLe: '2026-09-05',
  majLe: '2026-09-05',
  code: 'fil_plume_regie',
  titre: 'La plume de la Régie',
  accroche: 'Une journaliste de la Régie décide d’écrire votre Ronde. Elle vous suivra, que vous le vouliez ou non.',
  arc: 'Ismaë Rouvel écrit les portraits d’après-match de la Régie. Elle choisit le joueur comme sujet de la Ronde XIV et le suit sur trois étapes, en posant chaque fois la même question sous une forme différente. Le portrait sort quoi qu’il arrive, et il décide de la façon dont Vantour parlera du joueur jusqu’à la finale.',
  acteMin: 1,
  missions: [
    { ordre: 1, scenarioCle: 'scen_fil_plume_01', gabarit: 'capture_qg', dureeVisee: 32, titre: 'Elle filme depuis le banc' },
    { ordre: 2, scenarioCle: 'scen_fil_plume_02', gabarit: 'course', dureeVisee: 22, titre: 'La question d’après-match' },
    { ordre: 3, scenarioCle: 'scen_fil_plume_03', gabarit: 'tenir', dureeVisee: 28, titre: 'Une manche sans commentaire' },
    { ordre: 4, scenarioCle: 'scen_fil_plume_04', gabarit: 'revanche', dureeVisee: 40, titre: 'Le portrait sort demain' },
  ],
  deblocage: {
    type: 'et',
    conditions: [
      { type: 'compteur', cle: 'monde.public.ferveur', min: 3 },
      {
        type: 'ou',
        conditions: [
          { type: 'compteur', cle: 'monde.regie.faveur', min: 1 },
          { type: 'compteur', cle: 'monde.tournoi.serie_propre', min: 4 },
        ],
      },
    ],
  },
  consequences: [
    { type: 'variante_dialogue', scenarioCle: 'scen_meridien_finale', varianteCle: 'var_portrait_de_ronde' },
    { type: 'entree_carnet', carnetCle: 'carnet_portrait_ronde_xiv' },
  ],
  flagsEcrits: [
    'monde.regie.faveur',
    'monde.public.ferveur',
    'monde.atlas.credibilite',
    'monde.tournoi.fils_termines',
  ],
};

export const deblocageAldouin = {
  cle: 'deb_nera_aldouin',
  libelle: 'Nera Aldouin, la Ligne Blanche',
  condition: {
    type: 'et',
    conditions: [
      { type: 'flag', cle: 'monde.atlas.arbitre_alliee' },
      { type: 'compteur', cle: 'monde.carnet.pages_scellees', min: 3 },
    ],
  },
  recompense: { type: 'general_secret', ref: 'cmd_nera_aldouin' },
  cache: true,
};

export const profilCampagneFr = {
  cle: 'profil_thief_fr_01',
  paysDepart: 'fr',
  mode: 'normal',
  flags: {
    booleens: { 'pays.fr.tour_complet': true, 'monde.cinquieme.contact': true },
    compteurs: { 'monde.atlas.soupcon': 4, 'monde.regie.faveur': -1 },
    journal: [
      {
        journee: 12,
        scenarioCle: 'scen_fr_bretagne_01',
        choixCle: 'choix_fr_bretagne_fin',
        optionCle: 'laisser',
        flagsEcrits: ['pays.fr.bretagne_maelle_respectee', 'monde.tournoi.serie_propre'],
      },
    ],
  },
  deblocages: ['deb_craie'],
  filsEnCours: [{ filCle: 'fil_plume_regie', etape: 2 }],
  filsFinis: ['fil_cars_intendance'],
  scenariosFinis: ['scen_fr_bretagne_01', 'scen_fr_normandie_01'],
  secretsTrouves: ['mur_du_vestiaire'],
  paysVisites: ['fr', 'lu', 'ch'],
  modesFinis: [],
  serieDepeches: 3,
  catalogueVersion: 1,
  chainesVersion: 7,
  creeLe: '2026-09-01',
  majLe: '2026-09-05',
};
