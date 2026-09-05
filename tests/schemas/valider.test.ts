// Chaque validateur accepte l'exemple canon de `doc/03-schemas.md` (ou `09-i18n.md`
// §2) et refuse au moins trois altérations, avec le bon chemin d'erreur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validerChaineSource, validerCommander, validerCountry, validerDeblocage,
  validerEtatClimat, validerEvent, validerFil,
  validerFlag, validerGlossaire, validerLocale, validerMapDef, validerMemoryEntry,
  validerMissionDuJour, validerParametresCarte, validerProfilCampagne,
  validerPromptVersion, validerRegion,
  validerReviewVerdict, validerSauvegarde, validerScenario, validerSpecialite,
  validerTerrain, validerTraduction, validerUnitType, type Resultat,
} from '../../src/schemas/index';
import {
  carteBretagne, chaineSourcePouvoir, climatHiver, commandantCamille, deblocageAldouin,
  evenementVendee, filPlumeRegie,
  flagRivalRespecte, glossaireJa, localeZh, memoireCartesCompactes, missionDuJour,
  parametresBretagne, paysFr, profilCampagneFr, promptMap, regionBretagne, reviewCarte,
  sauvegarde,
  scenarioBretagne, terrainForet, traductionPouvoir, uniteCharLeger,
} from './exemples';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Objet = Record<string, any>;

interface Cas {
  titre: string;
  muter: (o: Objet) => void;
  chemin: string;
}

interface Suite {
  nom: string;
  valider: (v: unknown) => Resultat<unknown>;
  valide: Objet;
  invalides: Cas[];
}

function copie(o: Objet): Objet {
  return JSON.parse(JSON.stringify(o)) as Objet;
}

const suites: Suite[] = [
  {
    nom: 'Country',
    valider: validerCountry,
    valide: paysFr,
    invalides: [
      { titre: 'nom court trop long pour le HUD', muter: (o) => { o['nomCourt'] = 'République française'; }, chemin: 'nomCourt' },
      { titre: 'un pays rival de lui-même', muter: (o) => { o['rivalNaturel'] = 'fr'; }, chemin: 'rivalNaturel' },
      { titre: 'champ inconnu rival_secondaire', muter: (o) => { o['rival_secondaire'] = 'be'; }, chemin: 'rival_secondaire' },
      { titre: 'cinq biomes', muter: (o) => { o['biomes'] = ['plaine', 'foret', 'montagne', 'cotier', 'marais']; }, chemin: 'biomes' },
      { titre: 'flag de pays étranger', muter: (o) => { o['flagsDisponibles'][0] = 'pays.lu.tour_complet'; }, chemin: 'flagsDisponibles[0]' },
    ],
  },
  {
    nom: 'Commander',
    valider: validerCommander,
    valide: commandantCamille,
    invalides: [
      { titre: 'super pouvoir moins cher que le pouvoir', muter: (o) => { o['superPouvoir']['barres'] = 3; }, chemin: 'superPouvoir.barres' },
      { titre: 'faiblesse favorable', muter: (o) => { o['faiblesse']['effet']['modificateur']['valeur'] = 1.2; }, chemin: 'faiblesse.effet.modificateur.valeur' },
      { titre: 'deux traits au lieu de trois', muter: (o) => { o['traits'] = ['curieux', 'gourmand']; }, chemin: 'traits' },
      { titre: 'multiplicateur hors bornes', muter: (o) => { o['pouvoir']['effets'][1]['modificateur']['valeur'] = 2.5; }, chemin: 'pouvoir.effets[1].modificateur.valeur' },
      { titre: 'capture sous 1,0 sur ses propres unités', muter: (o) => { o['pouvoir']['effets'][1]['modificateur'] = { quoi: 'capture', valeur: 0.8 }; }, chemin: 'pouvoir.effets[1].modificateur.valeur' },
      { titre: 'un général secret sans déblocage, donc injouable à jamais', muter: (o) => { o['secret'] = true; }, chemin: 'deblocage' },
      { titre: 'un déblocage porté par un commandant non secret', muter: (o) => { o['deblocage'] = 'deb_camille'; }, chemin: 'secret' },
    ],
  },
  {
    nom: 'UnitType',
    valider: validerUnitType,
    valide: uniteCharLeger,
    invalides: [
      { titre: 'coût hors du pas de 100', muter: (o) => { o['cout'] = 6510; }, chemin: 'cout' },
      { titre: 'pièce indirecte qui riposte', muter: (o) => { o['portee'] = [2, 3]; }, chemin: 'peutRiposter' },
      { titre: 'trait capture sans champ capture', muter: (o) => { o['traits'] = ['capture']; }, chemin: 'traits' },
      { titre: 'colonne de dégâts sur une unité canon', muter: (o) => { o['subitDegats'] = { infanterie: 10 }; }, chemin: 'subitDegats' },
      { titre: 'silhouette de taille incohérente avec le coût', muter: (o) => { o['cout'] = 15000; }, chemin: 'silhouette.taille' },
    ],
  },
  {
    nom: 'Terrain',
    valider: validerTerrain,
    valide: terrainForet,
    invalides: [
      { titre: 'défense hors bornes', muter: (o) => { o['defense'] = 5; }, chemin: 'defense' },
      { titre: 'caractère de grille inattendu', muter: (o) => { o['car'] = 'X'; }, chemin: 'car' },
      { titre: 'coût de mouvement hors bornes', muter: (o) => { o['couts']['roues'] = 6; }, chemin: 'couts.roues' },
      { titre: 'terrain producteur non capturable', muter: (o) => { o['produit'] = ['infanterie']; }, chemin: 'produit' },
    ],
  },
  {
    nom: 'ParametresCarte',
    valider: validerParametresCarte,
    valide: parametresBretagne,
    invalides: [
      { titre: 'carte trop étroite', muter: (o) => { o['largeur'] = 4; }, chemin: 'largeur' },
      { titre: 'ratio de mer hors bornes', muter: (o) => { o['ratioMer'] = 0.9; }, chemin: 'ratioMer' },
      { titre: 'une seule ville par camp', muter: (o) => { o['villesParCamp'] = 1; }, chemin: 'villesParCamp' },
      { titre: 'mécanique sans préfixe', muter: (o) => { o['mecanique'] = 'marees'; }, chemin: 'mecanique' },
    ],
  },
  {
    nom: 'MapDef',
    valider: validerMapDef,
    valide: carteBretagne,
    invalides: [
      { titre: 'ligne de grille trop courte', muter: (o) => { o['grille'][0] = 'WWWW'; }, chemin: 'grille[0]' },
      { titre: 'caractère de grille inconnu', muter: (o) => { o['grille'][0] = 'ZWWWPPPPPPPPWWWW'; }, chemin: 'grille[0]' },
      { titre: 'propriétaire sur une case non capturable', muter: (o) => { o['proprietaires']['0,4'] = 0; }, chemin: 'proprietaires.0,4' },
      { titre: 'nombre de QG différent du nombre de camps', muter: (o) => { o['camps'] = 3; }, chemin: 'grille' },
      { titre: 'deux unités sur la même case', muter: (o) => { o['unitesDepart'][1] = { camp: 0, type: 'char_leger', x: 3, y: 5 }; }, chemin: 'unitesDepart[1]' },
    ],
  },
  {
    nom: 'Scenario',
    valider: validerScenario,
    valide: scenarioBretagne,
    invalides: [
      { titre: 'second camp sans IA', muter: (o) => { delete o['commandants'][1]['ia']; }, chemin: 'commandants[1].ia' },
      { titre: 'aucune condition de défaite', muter: (o) => { o['defaite'] = []; }, chemin: 'defaite' },
      { titre: 'deux options qui écrivent les mêmes flags', muter: (o) => { o['choix'][0]['options'][1]['ecritFlags'] = o['choix'][0]['options'][0]['ecritFlags']; }, chemin: 'choix[0].options' },
      { titre: 'fonds de départ hors du pas de 100', muter: (o) => { o['fondsDepart'] = 6050; }, chemin: 'fondsDepart' },
      { titre: 'récompense qui écrit un flag étranger', muter: (o) => { o['recompenses']['flags'] = ['pays.lu.sponsor_accepte']; }, chemin: 'recompenses.flags[0]' },
      { titre: 'un gabarit de mission inconnu', muter: (o) => { o['gabarit'] = 'blitz'; }, chemin: 'gabarit' },
      { titre: 'une durée visée de deux minutes', muter: (o) => { o['dureeVisee'] = 2; o['modes']['normal']['dureeVisee'] = 2; }, chemin: 'dureeVisee' },
      { titre: 'une durée visée qui contredit celle du mode normal', muter: (o) => { o['dureeVisee'] = 41; }, chemin: 'dureeVisee' },
      { titre: 'un mode difficile plus riche pour le joueur que pour l’IA', muter: (o) => { o['modes']['difficile']['fondsDepartIa'] = 4000; }, chemin: 'modes.difficile.fondsDepartIa' },
      { titre: 'un Bulletin qui voit plus loin en difficile', muter: (o) => { o['modes']['difficile']['previsionJournees'] = 2; o['modes']['normal']['previsionJournees'] = 1; }, chemin: 'modes.difficile.previsionJournees' },
      { titre: 'une jauge plus rapide en difficile', muter: (o) => { o['modes']['difficile']['vitesseJauge'] = 1.2; }, chemin: 'modes.difficile.vitesseJauge' },
      { titre: 'une reprise de journée accordée en difficile', muter: (o) => { o['modes']['difficile']['reprises'] = 1; }, chemin: 'modes.difficile.reprises' },
      { titre: 'un brouillard levé en difficile', muter: (o) => { o['modes']['normal']['brouillard'] = true; o['modes']['difficile']['brouillard'] = false; }, chemin: 'modes.difficile.brouillard' },
      { titre: 'une limite de journées relâchée en difficile', muter: (o) => { o['modes']['difficile']['limiteJournees'] = 30; }, chemin: 'modes.difficile.limiteJournees' },
      { titre: 'un mode difficile absent', muter: (o) => { delete o['modes']['difficile']; }, chemin: 'modes.difficile' },
    ],
  },
  {
    nom: 'Region',
    valider: validerRegion,
    valide: regionBretagne,
    invalides: [
      { titre: 'spécialité de portée pays', muter: (o) => { o['specialiteLocale']['portee'] = 'pays'; }, chemin: 'specialiteLocale.portee' },
      { titre: 'mécanique sans préfixe meca_', muter: (o) => { o['mecanique']['cle'] = 'marees'; }, chemin: 'mecanique.cle' },
      { titre: 'deux mots-clés seulement', muter: (o) => { o['motsCles'] = ['marée', 'granit']; }, chemin: 'motsCles' },
      { titre: 'collectivité placée dans les dix-huit', muter: (o) => { o['type'] = 'collectivite'; }, chemin: 'ordreConseille' },
      { titre: 'paramètre gelable non booléen', muter: (o) => { o['mecanique']['parametres']['gelable'] = 'oui'; }, chemin: 'mecanique.parametres.gelable' },
    ],
  },
  {
    nom: 'Specialite',
    valider: validerSpecialite,
    valide: regionBretagne.specialiteLocale,
    invalides: [
      { titre: 'nom trop long', muter: (o) => { o['nom'] = 'Un pied marin qui ne rentre pas dans le HUD du tout'; }, chemin: 'nom' },
      { titre: 'trait incohérent avec la famille', muter: (o) => { o['contenu'] = { variant: 'trait', trait: 'ravitaillement_ville' }; }, chemin: 'contenu.trait' },
      { titre: 'trait hors de la liste fermée', muter: (o) => { o['contenu'] = { variant: 'trait', trait: 'vol_de_nuit' }; }, chemin: 'contenu.trait' },
      { titre: 'trois effets au lieu de deux', muter: (o) => { const e = o['contenu']['effets'][0]; o['contenu']['effets'] = [e, e, e]; }, chemin: 'contenu.effets' },
    ],
  },
  {
    nom: 'Event',
    valider: validerEvent,
    valide: evenementVendee,
    invalides: [
      { titre: 'source hors https', muter: (o) => { o['sourceUrl'] = 'http://exemple.fr/x'; }, chemin: 'sourceUrl' },
      { titre: 'catégorie hors liste blanche', muter: (o) => { o['categorie'] = 'politique'; }, chemin: 'categorie' },
      { titre: 'événement de plus de soixante jours', muter: (o) => { o['fin'] = '2027-11-30'; }, chemin: 'fin' },
      { titre: 'bonus multiplicatif trop fort', muter: (o) => { o['effet']['modificateur']['modificateur'] = { quoi: 'fonds', valeur: 1.5 }; }, chemin: 'effet.modificateur.modificateur.valeur' },
    ],
  },
  {
    nom: 'MemoryEntry',
    valider: validerMemoryEntry,
    valide: memoireCartesCompactes,
    invalides: [
      { titre: 'poids hors bornes', muter: (o) => { o['poids'] = 6; }, chemin: 'poids' },
      { titre: 'entrée de routine sans expiration', muter: (o) => { o['expireLe'] = null; }, chemin: 'expireLe' },
      { titre: 'deux affirmations dans une entrée', muter: (o) => { o['contenu'] = 'Les cartes larges sont rejetées. Il faut les resserrer.'; }, chemin: 'contenu' },
      { titre: 'portée référencée sans référence', muter: (o) => { o['portee'] = 'pays'; }, chemin: 'porteeRef' },
    ],
  },
  {
    nom: 'PromptVersion',
    valider: validerPromptVersion,
    valide: promptMap,
    invalides: [
      { titre: 'corps trop court', muter: (o) => { o['corps'] = 'Fais des cartes.'; }, chemin: 'corps' },
      { titre: 'routine qui active son propre prompt', muter: (o) => { o['statut'] = 'courant'; }, chemin: 'statut' },
      { titre: 'version courante sans date d\'activation', muter: (o) => { o['auteur'] = 'humain'; o['statut'] = 'courant'; o['valideParHumain'] = true; }, chemin: 'activeLe' },
      { titre: 'version nulle', muter: (o) => { o['version'] = 0; }, chemin: 'version' },
    ],
  },
  {
    nom: 'ReviewVerdict',
    valider: validerReviewVerdict,
    valide: reviewCarte,
    invalides: [
      { titre: 'rejet sans motif', muter: (o) => { o['motifs'] = []; }, chemin: 'motifs' },
      { titre: 'carte sans statistiques', muter: (o) => { o['stats'] = null; }, chemin: 'stats' },
      { titre: 'moins de graines que de parties', muter: (o) => { o['stats']['graines'] = ['s01', 's02']; }, chemin: 'stats.graines' },
      { titre: 'forme { avec, sans } sur une carte', muter: (o) => { o['stats'] = { avec: copie(reviewCarte)['stats'], sans: copie(reviewCarte)['stats'] }; }, chemin: 'stats' },
      { titre: 'motif hors catalogue', muter: (o) => { o['motifs'][0]['code'] = 'carte_moche'; }, chemin: 'motifs[0].code' },
    ],
  },
  {
    nom: 'EtatClimat',
    valider: validerEtatClimat,
    valide: climatHiver,
    invalides: [
      { titre: 'une seule prévision', muter: (o) => { o['previsions'] = ['neige']; }, chemin: 'previsions' },
      { titre: 'météo inconnue', muter: (o) => { o['meteo'] = 'verglas'; }, chemin: 'meteo' },
      { titre: 'journée hors du cycle', muter: (o) => { o['journeeDansCycle'] = 12; }, chemin: 'journeeDansCycle' },
    ],
  },
  {
    nom: 'MissionDuJour',
    valider: validerMissionDuJour,
    valide: missionDuJour,
    invalides: [
      { titre: 'expiration ailleurs qu\'à sept jours', muter: (o) => { o['expireLe'] = '2026-09-30'; }, chemin: 'expireLe' },
      { titre: 'date inexistante', muter: (o) => { o['date'] = '2026-02-31'; }, chemin: 'date' },
      { titre: 'champ inconnu', muter: (o) => { o['recompense'] = 'badge'; }, chemin: 'recompense' },
    ],
  },
  {
    nom: 'Sauvegarde',
    valider: validerSauvegarde,
    valide: sauvegarde,
    invalides: [
      { titre: 'version de catalogue nulle', muter: (o) => { o['catalogueVersion'] = 0; }, chemin: 'catalogueVersion' },
      { titre: 'journal d\'actions absent', muter: (o) => { o['actions'] = null; }, chemin: 'actions' },
      { titre: 'graine manquante', muter: (o) => { delete o['graine']; }, chemin: 'graine' },
    ],
  },
  {
    nom: 'Flag',
    valider: validerFlag,
    valide: flagRivalRespecte,
    invalides: [
      { titre: 'clé hors convention', muter: (o) => { o['cle'] = 'region.bretagne.maree_lue'; }, chemin: 'cle' },
      { titre: 'flag sans impact', muter: (o) => { o['impacte'] = []; }, chemin: 'impacte' },
      { titre: 'code pays incohérent avec la clé', muter: (o) => { o['paysCode'] = 'lu'; }, chemin: 'paysCode' },
      { titre: 'relation mal bornée', muter: (o) => { o['valeur'] = 'relation'; o['min'] = null; o['max'] = null; }, chemin: 'min' },
    ],
  },
  {
    nom: 'Locale',
    valider: validerLocale,
    valide: localeZh,
    invalides: [
      { titre: 'code en majuscules', muter: (o) => { o['code'] = 'ZH-Hans'; }, chemin: 'code' },
      { titre: 'facteur de longueur hors bornes', muter: (o) => { o['facteurLongueur'] = 2.4; }, chemin: 'facteurLongueur' },
      { titre: 'français rétrogradé', muter: (o) => { o['code'] = 'fr'; }, chemin: 'statut' },
    ],
  },
  {
    nom: 'ChaineSource',
    valider: validerChaineSource,
    valide: chaineSourcePouvoir,
    invalides: [
      { titre: 'clé sans segment', muter: (o) => { o['cle'] = 'hud'; }, chemin: 'cle' },
      { titre: 'empreinte tronquée', muter: (o) => { o['sourceHash'] = '9f2c14ab'; }, chemin: 'sourceHash' },
      { titre: 'marqueur absent du texte', muter: (o) => { o['placeholders'] = ['{unite}']; }, chemin: 'placeholders[0]' },
      { titre: 'texte plus long que sa borne', muter: (o) => { o['longueurMax'] = 4; }, chemin: 'texte' },
    ],
  },
  {
    nom: 'Traduction',
    valider: validerTraduction,
    valide: traductionPouvoir,
    invalides: [
      { titre: 'traduction en français', muter: (o) => { o['locale'] = 'fr'; }, chemin: 'locale' },
      { titre: 'texte nul mais statut validé', muter: (o) => { o['texte'] = null; }, chemin: 'texte' },
      { titre: 'statut hors énumération', muter: (o) => { o['statut'] = 'relue'; }, chemin: 'statut' },
    ],
  },
  {
    nom: 'Glossaire',
    valider: validerGlossaire,
    valide: glossaireJa,
    invalides: [
      { titre: 'nom propre sans translittération en japonais', muter: (o) => { delete o['entrees'][0]['translitteration']; }, chemin: 'entrees[0].translitteration' },
      { titre: 'terme imposé sans traduction', muter: (o) => { o['entrees'][3]['traduction'] = null; }, chemin: 'entrees[3].traduction' },
      { titre: 'date de mise à jour invalide', muter: (o) => { o['majLe'] = '10/09/2026'; }, chemin: 'majLe' },
      { titre: 'catégorie inconnue', muter: (o) => { o['entrees'][6]['categorie'] = 'jargon'; }, chemin: 'entrees[6].categorie' },
    ],
  },
  {
    nom: 'Fil',
    valider: validerFil,
    valide: filPlumeRegie,
    invalides: [
      { titre: 'deux missions seulement', muter: (o) => { o['missions'] = o['missions'].slice(0, 2); }, chemin: 'missions' },
      { titre: 'une étape qui saute un numéro', muter: (o) => { o['missions'][2]['ordre'] = 4; }, chemin: 'missions[2].ordre' },
      { titre: 'un gabarit inconnu', muter: (o) => { o['missions'][0]['gabarit'] = 'siege_eclair'; }, chemin: 'missions[0].gabarit' },
      { titre: 'le gabarit exhibition, réservé à la Dépêche', muter: (o) => { o['missions'][1]['gabarit'] = 'exhibition'; }, chemin: 'missions[1].gabarit' },
      { titre: 'une conséquence hors de la liste fermée', muter: (o) => { o['consequences'][0] = { type: 'nouvelle_regle', ref: 'x' }; }, chemin: 'consequences[0].type' },
      { titre: 'une remise à la production hors bornes', muter: (o) => { o['consequences'][0] = { type: 'remise_production', uniteCle: 'char_leger', remise: 0.4 }; }, chemin: 'consequences[0].remise' },
      { titre: 'trois unités offertes', muter: (o) => { o['consequences'][0] = { type: 'unite_offerte', uniteCle: 'char_lourd', combien: 3 }; }, chemin: 'consequences[0].combien' },
      { titre: 'un fil qui écrit un flag de Dépêche', muter: (o) => { o['flagsEcrits'][0] = 'monde.depeche.serie'; }, chemin: 'flagsEcrits[0]' },
      { titre: 'un fil qui pose un flag de secret', muter: (o) => { o['flagsEcrits'][0] = 'monde.secret.mur_du_vestiaire'; }, chemin: 'flagsEcrits[0]' },
      { titre: 'une condition trop imbriquée', muter: (o) => {
        o['deblocage'] = { type: 'et', conditions: [
          { type: 'flag', cle: 'monde.cinquieme.contact' },
          { type: 'ou', conditions: [
            { type: 'flag', cle: 'monde.cinquieme.demasquee' },
            { type: 'et', conditions: [
              { type: 'flag', cle: 'monde.atlas.arbitre_alliee' },
              { type: 'flag', cle: 'monde.atlas.reforme_deposee' },
            ] },
          ] },
        ] };
      }, chemin: 'deblocage.conditions[1].conditions[1]' },
      { titre: 'un fil sans conséquence', muter: (o) => { o['consequences'] = []; }, chemin: 'consequences' },
      { titre: 'deux missions sur le même scénario', muter: (o) => { o['missions'][1]['scenarioCle'] = 'scen_fil_plume_01'; }, chemin: 'missions[1]' },
    ],
  },
  {
    nom: 'Deblocage',
    valider: validerDeblocage,
    valide: deblocageAldouin,
    invalides: [
      { titre: 'un type de condition inconnu', muter: (o) => { o['condition'] = { type: 'horoscope', signe: 'balance' }; }, chemin: 'condition.type' },
      { titre: 'une fenêtre de dates vide', muter: (o) => { o['condition'] = { type: 'date', du: '2026-12-01', au: '2026-01-01' }; }, chemin: 'condition' },
      { titre: 'une condition de date sans borne', muter: (o) => { o['condition'] = { type: 'date' }; }, chemin: 'condition' },
      { titre: 'plus de pays exigés que listés', muter: (o) => { o['condition'] = { type: 'pays_visite', pays: ['fr', 'lu'], combien: 3 }; }, chemin: 'condition.combien' },
      { titre: 'un mode inconnu', muter: (o) => { o['condition'] = { type: 'mode_fini', mode: 'cauchemar' }; }, chemin: 'condition.mode' },
      { titre: 'un général secret référencé sans code de commandant', muter: (o) => { o['recompense']['ref'] = 'nera'; }, chemin: 'recompense.ref' },
      { titre: 'un type de récompense inconnu', muter: (o) => { o['recompense']['type'] = 'trophee'; }, chemin: 'recompense.type' },
      { titre: 'un `ou` à une seule branche', muter: (o) => { o['condition'] = { type: 'ou', conditions: [{ type: 'flag', cle: 'monde.cinquieme.contact' }] }; }, chemin: 'condition.conditions' },
    ],
  },
  {
    nom: 'ProfilCampagne',
    valider: validerProfilCampagne,
    valide: profilCampagneFr,
    invalides: [
      { titre: 'un mode inconnu', muter: (o) => { o['mode'] = 'cauchemar'; }, chemin: 'mode' },
      { titre: 'un flag booléen posé à false', muter: (o) => { o['flags']['booleens']['pays.fr.tour_complet'] = false; }, chemin: 'flags.booleens.pays.fr.tour_complet' },
      { titre: 'une clé de flag mal formée', muter: (o) => { o['flags']['compteurs']['Monde.Atlas.Soupcon'] = 2; }, chemin: 'flags.compteurs.Monde.Atlas.Soupcon' },
      { titre: 'un fil à la fois en cours et fini', muter: (o) => { o['filsFinis'].push('fil_plume_regie'); }, chemin: 'filsEnCours' },
      { titre: 'une étape de fil au-delà de huit', muter: (o) => { o['filsEnCours'][0]['etape'] = 9; }, chemin: 'filsEnCours[0].etape' },
      { titre: 'un pays visité deux fois', muter: (o) => { o['paysVisites'].push('fr'); }, chemin: 'paysVisites[3]' },
      { titre: 'une version de chaînes absente', muter: (o) => { delete o['chainesVersion']; }, chemin: 'chainesVersion' },
      { titre: 'un champ inconnu dans la sauvegarde', muter: (o) => { o['heuresJouees'] = 80; }, chemin: 'heuresJouees' },
    ],
  },
];

for (const suite of suites) {
  test(`${suite.nom} : l'exemple canon est accepté`, () => {
    const r = suite.valider(suite.valide);
    assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs, null, 2));
  });

  for (const cas of suite.invalides) {
    test(`${suite.nom} refuse : ${cas.titre}`, () => {
      const sujet = copie(suite.valide);
      cas.muter(sujet);
      const r = suite.valider(sujet);
      assert.equal(r.ok, false, 'la validation aurait dû échouer');
      if (r.ok) return;
      const chemins = r.erreurs.map((e) => e.chemin);
      assert.ok(
        chemins.includes(cas.chemin),
        `chemin attendu ${cas.chemin}, obtenus : ${chemins.join(', ')}`,
      );
      for (const e of r.erreurs) assert.ok(e.message.length > 0, 'message vide');
    });
  }
}

test('un validateur refuse une valeur qui n\'est même pas un objet', () => {
  for (const valider of [validerCountry, validerUnitType, validerTerrain, validerScenario]) {
    const r = valider(42);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erreurs[0]?.chemin, '');
  }
});
