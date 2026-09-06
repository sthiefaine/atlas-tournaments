/**
 * Validateurs écrits à la main, un par charge utile qui traverse l'API ou entre
 * dans le moteur. Signature uniforme :
 * `validerX(valeur: unknown): { ok: true; valeur: X } | { ok: false; erreurs: … }`.
 *
 * Les validations sont **structurelles et intra-objet** : bornes, énumérations,
 * invariants de `03-schemas.md`. La résolution des références croisées
 * (`paysCode` qui existe, `carteCle` qui existe, flag présent dans `flags.json`)
 * appartient au serveur, qui a la base sous la main ; elle n'est pas ici.
 */

import {
  ARCHETYPES, AUTEURS_PROMPT, AUTEURS_TRADUCTION, AXES_FAIBLESSE, BASES_SILHOUETTE,
  BIOMES, BORNES_CONSEQUENCE, BORNES_MODIFICATEUR, BORNES_RELATIONS,
  CARACTERE_PAR_TERRAIN,
  CATEGORIES_EVENT,
  CATEGORIES_GLOSSAIRE, CIBLES_EFFET, CIBLES_REVIEW, CLES_GABARIT, CLES_PROMPT,
  CLES_TERRAIN,
  CLES_UNITE_CANON, CLIMATS, CONFIANCE_MAX, CONTINENTS, CORPS_SILHOUETTE, DOMAINES,
  EMOTIONS,
  FAMILLES_PAR_TRAIT_SPECIALITE, FAMILLES_SPECIALITE, FORMES_POSER_TERRAIN,
  HEMISPHERES, HOOKS_MECANIQUE, IMPACTS_FLAG, LOCALES_TRANSLITTEREES, METEOS, MODES,
  MODULES_SILHOUETTE, MOMENTS_CHOIX, MOTIFS_REJET, ORIGINES_CHAINE, PHASES_JOUR,
  PORTEES_FLAG, PORTEES_MEMOIRE, PORTEES_MEMOIRE_REFERENCEES, PORTEES_SPECIALITE,
  PROFONDEUR_CONDITION_MAX,
  QUOI_MODIFICATEUR, REGEX_CASE, REGEX_CLE_CHAINE, REGEX_CLE_MECANIQUE,
  RELATIONS_CONSEQUENCE, RELATIONS_NATION,
  REGEX_CODE_COMMANDANT, REGEX_CODE_LOCALE, SAISONS, SCRIPTS_LOCALE, SENS_ECRITURE,
  SOURCES_ENVELOPPE, SOURCES_MEMOIRE, STATUTS, STATUTS_LOCALE, STATUTS_PROMPT,
  STATUTS_TRADUCTION, STATUTS_UNITE, STRATEGIES_IA, SUJETS_MEMOIRE, SYMETRIES,
  TABLE_POSER_TERRAIN, TAILLES_SILHOUETTE, TERRAINS_CAPTURABLES, TRAITS,
  TRAITS_SPECIALITE, TYPES_CONDITION, TYPES_CONSEQUENCE, TYPES_DRAPEAU,
  TYPES_MOUVEMENT, TYPES_OBJECTIF_DEFAITE, TYPES_OBJECTIF_VICTOIRE, TYPES_OBJET_REF,
  TYPES_RECOMPENSE_DEBLOCAGE, TYPES_REGION,
  VALEURS_FLAG,
  type CatalogueArchetypes, type CatalogueGabarits, type CatalogueMecaniques,
  type CatalogueTerrains,
  type CatalogueUnites, type ChaineSource, type ChoixScenario,
  type CleTerrain, type CodePays, type Commander, type Condition, type Consequence,
  type Country,
  DECLENCHEURS_SCENE,
  type Deblocage, type Dialogue, type SceneDialogue,
  type EffetEvent, type EffetModificateur, type EffetPoserTerrain, type EffetPouvoir,
  type EtatClimat, type Event, type Fil, type Flag,
  type Glossaire, type Locale, type MapDef, type MemoryEntry, type MetriquesPrompt,
  type MissionDuJour, type ObjectifDefaite, type ObjectifVictoire,
  type ParametresCarte, type ParametresMode, type ProfilCampagne, type PromptVersion,
  type Region, type ReviewVerdict,
  type Sauvegarde, type Scenario, type Silhouette, type Specialite,
  type StatsSimulation, type TableDegats, type Terrain, type Traduction,
  type Trait, type UnitType, type UniteDepart,
} from './types';
import {
  booleen, caseGrille, chaine, cle, cleFlag, codePays, conclure, Contexte, couleur,
  dateIso, entier, enumeration, estObjet, nombre, objet, palette, presente, requis,
  sansDoublon, sous, tableau, type Resultat,
} from './noyau';

// ---------------------------------------------------------------------------
// Briques partagées
// ---------------------------------------------------------------------------

const CLES_ENVELOPPE = ['cle', 'version', 'statut', 'source', 'creeLe', 'majLe'] as const;

/** Lit les six champs d'`Enveloppe` communs à tout objet stocké en base. */
function enveloppe(ctx: Contexte, o: Record<string, unknown>, chemin: string): void {
  requis(ctx, o, chemin, CLES_ENVELOPPE);
  cle(ctx, o['cle'], sous(chemin, 'cle'));
  entier(ctx, o['version'], sous(chemin, 'version'), { min: 1 });
  enumeration(ctx, o['statut'], sous(chemin, 'statut'), STATUTS);
  enumeration(ctx, o['source'], sous(chemin, 'source'), SOURCES_ENVELOPPE);
  dateIso(ctx, o['creeLe'], sous(chemin, 'creeLe'));
  dateIso(ctx, o['majLe'], sous(chemin, 'majLe'));
}

/** Lit un `EffetModificateur` et vérifie la borne propre à son `quoi`. */
function effetModificateur(ctx: Contexte, v: unknown, chemin: string): EffetModificateur | undefined {
  const o = objet(ctx, v, chemin, ['cible', 'filtre', 'modificateur']);
  if (!o || !requis(ctx, o, chemin, ['cible', 'modificateur'])) return undefined;
  const cible = enumeration(ctx, o['cible'], sous(chemin, 'cible'), CIBLES_EFFET);
  if (presente(o, 'filtre')) filtreEffet(ctx, o['filtre'], sous(chemin, 'filtre'));
  const cheminMod = sous(chemin, 'modificateur');
  const m = objet(ctx, o['modificateur'], cheminMod, ['quoi', 'valeur']);
  if (!m || !requis(ctx, m, cheminMod, ['quoi', 'valeur'])) return undefined;
  const quoi = enumeration(ctx, m['quoi'], sous(cheminMod, 'quoi'), QUOI_MODIFICATEUR);
  if (quoi === undefined || cible === undefined) return undefined;
  const bornes = BORNES_MODIFICATEUR[quoi];
  const cheminValeur = sous(cheminMod, 'valeur');
  const valeur = bornes.forme === 'entier'
    ? entier(ctx, m['valeur'], cheminValeur, { min: bornes.min, max: bornes.max })
    : nombre(ctx, m['valeur'], cheminValeur, { min: bornes.min, max: bornes.max });
  if (valeur === undefined) return undefined;
  if (quoi === 'capture' && valeur < 1 && cible !== 'unites_adverses') {
    ctx.faute(cheminValeur, "un multiplicateur de capture inférieur à 1,0 ne vise que 'unites_adverses'");
  }
  const effet: EffetModificateur = { cible, modificateur: { quoi, valeur } };
  if (presente(o, 'filtre') && estObjet(o['filtre'])) effet.filtre = o['filtre'] as EffetModificateur['filtre'];
  return effet;
}

/** Lit le filtre facultatif d'un effet. */
function filtreEffet(ctx: Contexte, v: unknown, chemin: string): void {
  const o = objet(ctx, v, chemin, ['types', 'mouvement', 'surTerrain', 'rayon']);
  if (!o) return;
  if (presente(o, 'types')) {
    tableau(ctx, o['types'], sous(chemin, 'types'), { min: 1, max: 24 },
      (e, c) => cle(ctx, e, c));
  }
  if (presente(o, 'mouvement')) {
    tableau(ctx, o['mouvement'], sous(chemin, 'mouvement'), { min: 1, max: 7 },
      (e, c) => enumeration(ctx, e, c, TYPES_MOUVEMENT));
  }
  if (presente(o, 'surTerrain')) {
    tableau(ctx, o['surTerrain'], sous(chemin, 'surTerrain'), { min: 1, max: 12 },
      (e, c) => enumeration(ctx, e, c, CLES_TERRAIN));
  }
  if (presente(o, 'rayon')) {
    const cheminRayon = sous(chemin, 'rayon');
    const r = objet(ctx, o['rayon'], cheminRayon, ['centre', 'cases']);
    if (r && requis(ctx, r, cheminRayon, ['centre', 'cases'])) {
      enumeration(ctx, r['centre'], sous(cheminRayon, 'centre'), ['commandant', 'toutes'] as const);
      entier(ctx, r['cases'], sous(cheminRayon, 'cases'), { min: 1, max: 12 });
    }
  }
}

/** Lit une durée `permanent` / `ce_tour` / `tour_complet` / `{ type: 'journees', n }`. */
function duree(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  litterales: readonly string[],
): 'permanent' | 'ce_tour' | 'tour_complet' | { type: 'journees'; n: 1 | 2 | 3 } | undefined {
  if (typeof v === 'string') {
    const lu = enumeration(ctx, v, chemin, litterales);
    return lu as 'permanent' | 'ce_tour' | 'tour_complet' | undefined;
  }
  const o = objet(ctx, v, chemin, ['type', 'n']);
  if (!o || !requis(ctx, o, chemin, ['type', 'n'])) return undefined;
  enumeration(ctx, o['type'], sous(chemin, 'type'), ['journees'] as const);
  const n = entier(ctx, o['n'], sous(chemin, 'n'), { min: 1, max: 3 });
  if (n === undefined) return undefined;
  return { type: 'journees', n: n as 1 | 2 | 3 };
}

/** Lit un `EffetPoserTerrain` et vérifie la table des sept formes. */
function effetPoserTerrain(ctx: Contexte, v: unknown, chemin: string): EffetPoserTerrain | undefined {
  const o = objet(ctx, v, chemin, ['cible', 'poserTerrain']);
  if (!o || !requis(ctx, o, chemin, ['cible', 'poserTerrain'])) return undefined;
  enumeration(ctx, o['cible'], sous(chemin, 'cible'), ['terrain'] as const);
  const cheminPose = sous(chemin, 'poserTerrain');
  const p = objet(ctx, o['poserTerrain'], cheminPose,
    ['forme', 'depuis', 'vers', 'casesMax', 'contigu', 'duree']);
  if (!p || !requis(ctx, p, cheminPose, ['forme', 'depuis', 'vers', 'casesMax', 'contigu', 'duree'])) {
    return undefined;
  }
  const forme = enumeration(ctx, p['forme'], sous(cheminPose, 'forme'), FORMES_POSER_TERRAIN);
  const depuis = tableau(ctx, p['depuis'], sous(cheminPose, 'depuis'), { min: 1, max: 3 },
    (e, c) => enumeration(ctx, e, c, CLES_TERRAIN));
  const vers = enumeration(ctx, p['vers'], sous(cheminPose, 'vers'), CLES_TERRAIN);
  const casesMax = entier(ctx, p['casesMax'], sous(cheminPose, 'casesMax'), { min: 1, max: 4 });
  const contigu = booleen(ctx, p['contigu'], sous(cheminPose, 'contigu'));
  const d = duree(ctx, p['duree'], sous(cheminPose, 'duree'), ['permanent']);
  if (forme === undefined || depuis === undefined || vers === undefined
    || casesMax === undefined || contigu === undefined || d === undefined) return undefined;
  const table = TABLE_POSER_TERRAIN[forme];
  for (let i = 0; i < depuis.length; i += 1) {
    const t = depuis[i] as CleTerrain;
    if ((TERRAINS_CAPTURABLES as readonly string[]).includes(t)) {
      ctx.faute(sous(sous(cheminPose, 'depuis'), i), 'un terrain capturable ne peut jamais être une cible de pose');
    }
    if (!table.depuis.includes(t)) {
      ctx.faute(sous(sous(cheminPose, 'depuis'), i),
        `couple hors table : la forme ${forme} ne part que de ${table.depuis.join(', ')}`);
    }
  }
  if (vers !== table.vers) {
    ctx.faute(sous(cheminPose, 'vers'), `couple hors table : la forme ${forme} pose ${table.vers}`);
  }
  if (depuis.includes(vers)) {
    ctx.faute(sous(cheminPose, 'vers'), "le terrain posé ne peut pas figurer dans 'depuis'");
  }
  return {
    cible: 'terrain',
    poserTerrain: { forme, depuis: depuis as CleTerrain[], vers, casesMax, contigu, duree: d as EffetPoserTerrain['poserTerrain']['duree'] },
  };
}

/** Lit un `EffetPouvoir` : modificateur, ou pose de terrain. */
function effetPouvoir(ctx: Contexte, v: unknown, chemin: string): EffetPouvoir | undefined {
  if (estObjet(v) && presente(v, 'poserTerrain')) return effetPoserTerrain(ctx, v, chemin);
  return effetModificateur(ctx, v, chemin);
}

/** Vrai si l'effet lu est une pose de terrain. */
function estPose(effet: EffetPouvoir): effet is EffetPoserTerrain {
  return 'poserTerrain' in effet;
}

/** Lit une `Specialite`, avec ses deux variants de contenu. */
function specialite(ctx: Contexte, v: unknown, chemin: string): Specialite | undefined {
  const o = objet(ctx, v, chemin, ['cle', 'nom', 'portee', 'famille', 'contenu', 'description']);
  if (!o || !requis(ctx, o, chemin, ['cle', 'nom', 'portee', 'famille', 'contenu', 'description'])) {
    return undefined;
  }
  const c = cle(ctx, o['cle'], sous(chemin, 'cle'));
  const nom = chaine(ctx, o['nom'], sous(chemin, 'nom'), { max: 32 });
  const portee = enumeration(ctx, o['portee'], sous(chemin, 'portee'), PORTEES_SPECIALITE);
  const famille = enumeration(ctx, o['famille'], sous(chemin, 'famille'), FAMILLES_SPECIALITE);
  const description = chaine(ctx, o['description'], sous(chemin, 'description'), { max: 200 });

  const cheminContenu = sous(chemin, 'contenu');
  const brut = o['contenu'];
  let contenu: Specialite['contenu'] | undefined;
  if (estObjet(brut) && brut['variant'] === 'trait') {
    const co = objet(ctx, brut, cheminContenu, ['variant', 'trait']);
    if (co && requis(ctx, co, cheminContenu, ['variant', 'trait'])) {
      const trait = enumeration(ctx, co['trait'], sous(cheminContenu, 'trait'), TRAITS_SPECIALITE);
      if (trait !== undefined) {
        contenu = { variant: 'trait', trait };
        if (famille !== undefined && !FAMILLES_PAR_TRAIT_SPECIALITE[trait].includes(famille)) {
          ctx.faute(sous(cheminContenu, 'trait'),
            `trait incohérent avec la famille ${famille} : ${FAMILLES_PAR_TRAIT_SPECIALITE[trait].join(' ou ')} attendue`);
        }
      }
    }
  } else {
    const co = objet(ctx, brut, cheminContenu, ['variant', 'effets']);
    if (co && requis(ctx, co, cheminContenu, ['variant', 'effets'])) {
      enumeration(ctx, co['variant'], sous(cheminContenu, 'variant'), ['modificateur'] as const);
      const effets = tableau(ctx, co['effets'], sous(cheminContenu, 'effets'), { min: 1, max: 2 },
        (e, ce) => effetModificateur(ctx, e, ce));
      if (effets !== undefined) contenu = { variant: 'modificateur', effets };
    }
  }
  if (c === undefined || nom === undefined || portee === undefined || famille === undefined
    || description === undefined || contenu === undefined) return undefined;
  return { cle: c, nom, portee, famille, contenu, description };
}

// ---------------------------------------------------------------------------
// Country
// ---------------------------------------------------------------------------

const CLES_COUNTRY = [
  ...CLES_ENVELOPPE, 'code', 'nom', 'nomCourt', 'gentile', 'continent', 'climat',
  'hemisphere', 'biomes', 'specialite', 'archetypeCommandant', 'rivalNaturel',
  'voisins', 'palette', 'drapeau', 'flagsDisponibles', 'regions', 'phare',
  'accroche', 'interdits',
] as const;

/** Valide une fiche pays (`03-schemas.md` §1). */
export function validerCountry(valeur: unknown): Resultat<Country> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_COUNTRY);
  if (!o) return conclure(ctx, valeur as Country);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'nom', 'nomCourt', 'gentile', 'continent', 'climat', 'hemisphere',
    'biomes', 'specialite', 'archetypeCommandant', 'rivalNaturel', 'voisins', 'palette',
    'drapeau', 'flagsDisponibles', 'phare', 'accroche', 'interdits']);

  const code = codePays(ctx, o['code'], 'code');
  chaine(ctx, o['nom'], 'nom', { max: 64 });
  chaine(ctx, o['nomCourt'], 'nomCourt', { max: 14 });
  chaine(ctx, o['gentile'], 'gentile', { max: 32 });
  enumeration(ctx, o['continent'], 'continent', CONTINENTS);
  enumeration(ctx, o['climat'], 'climat', CLIMATS);
  enumeration(ctx, o['hemisphere'], 'hemisphere', HEMISPHERES);
  const biomes = tableau(ctx, o['biomes'], 'biomes', { min: 1, max: 4 },
    (e, c) => enumeration(ctx, e, c, BIOMES));
  if (biomes) sansDoublon(ctx, biomes, 'biomes');
  specialite(ctx, o['specialite'], 'specialite');
  if (estObjet(o['specialite']) && o['specialite']['portee'] !== 'pays') {
    ctx.faute('specialite.portee', "la spécialité d'un pays a la portée 'pays'");
  }
  enumeration(ctx, o['archetypeCommandant'], 'archetypeCommandant', ARCHETYPES);
  const rival = codePays(ctx, o['rivalNaturel'], 'rivalNaturel');
  if (rival !== undefined && code !== undefined && rival === code) {
    ctx.faute('rivalNaturel', 'un pays ne peut pas être son propre rival');
  }
  const voisins = tableau(ctx, o['voisins'], 'voisins', { max: 12 }, (e, c) => codePays(ctx, e, c));
  if (voisins) {
    sansDoublon(ctx, voisins, 'voisins');
    if (code !== undefined && voisins.includes(code)) {
      ctx.faute('voisins', 'un pays ne figure pas dans sa propre liste de voisins');
    }
  }
  palette(ctx, o['palette'], 'palette');
  const d = objet(ctx, o['drapeau'], 'drapeau', ['type', 'couleurs']);
  if (d && requis(ctx, d, 'drapeau', ['type', 'couleurs'])) {
    enumeration(ctx, d['type'], 'drapeau.type', TYPES_DRAPEAU);
    tableau(ctx, d['couleurs'], 'drapeau.couleurs', { min: 1, max: 4 }, (e, c) => couleur(ctx, e, c));
  }
  const flags = tableau(ctx, o['flagsDisponibles'], 'flagsDisponibles', { max: 64 },
    (e, c) => cleFlag(ctx, e, c));
  if (flags && code !== undefined) {
    for (let i = 0; i < flags.length; i += 1) {
      const f = flags[i] as string;
      if (f.startsWith('pays.') && !f.startsWith(`pays.${code}.`)) {
        ctx.faute(sous('flagsDisponibles', i), `un pays ne déclare que ses propres flags (pays.${code}.*) ou des flags monde.*`);
      }
      if (f.startsWith('cmd.')) {
        ctx.faute(sous('flagsDisponibles', i), 'un flag de commandant ne se déclare pas dans une fiche pays');
      }
    }
  }
  const phare = booleen(ctx, o['phare'], 'phare');
  if (presente(o, 'regions')) {
    tableau(ctx, o['regions'], 'regions', { min: 1, max: 32 }, (e, c) => cle(ctx, e, c));
    if (phare === false) ctx.faute('regions', "'regions' n'existe que si le pays est phare");
  } else if (phare === true) {
    ctx.faute('regions', 'un pays phare déclare ses régions');
  }
  chaine(ctx, o['accroche'], 'accroche', { max: 160 });
  tableau(ctx, o['interdits'], 'interdits', { max: 12 }, (e, c) => chaine(ctx, e, c, { max: 240 }));
  return conclure(ctx, o as unknown as Country);
}

// ---------------------------------------------------------------------------
// Commander
// ---------------------------------------------------------------------------

const CLES_POUVOIR = ['nom', 'description', 'barres', 'effets', 'duree', 'replique'] as const;

/** Lit un `Pouvoir` et applique les bornes propres au niveau (normal ou super). */
function pouvoir(ctx: Contexte, v: unknown, chemin: string, superPouvoir: boolean): number | undefined {
  const o = objet(ctx, v, chemin, CLES_POUVOIR);
  if (!o || !requis(ctx, o, chemin, CLES_POUVOIR)) return undefined;
  chaine(ctx, o['nom'], sous(chemin, 'nom'), { max: 48 });
  chaine(ctx, o['description'], sous(chemin, 'description'), { max: 200 });
  const barres = entier(ctx, o['barres'], sous(chemin, 'barres'),
    superPouvoir ? { min: 5, max: 9 } : { min: 2, max: 4 });
  const effets = tableau(ctx, o['effets'], sous(chemin, 'effets'), { min: 1, max: 3 },
    (e, c) => effetPouvoir(ctx, e, c));
  const d = duree(ctx, o['duree'], sous(chemin, 'duree'), ['ce_tour', 'tour_complet']);
  if (d !== undefined && typeof d !== 'string' && d.n === 3 && !superPouvoir) {
    ctx.faute(sous(chemin, 'duree'), 'une durée de trois journées est réservée au super pouvoir');
  }
  if (effets) {
    for (let i = 0; i < effets.length; i += 1) {
      const e = effets[i] as EffetPouvoir;
      if (!estPose(e)) continue;
      const cheminPose = sous(sous(sous(chemin, 'effets'), i), 'poserTerrain');
      if (!superPouvoir && e.poserTerrain.casesMax > 3) {
        ctx.faute(sous(cheminPose, 'casesMax'), 'un pouvoir normal pose trois cases au plus');
      }
      if (!superPouvoir && e.poserTerrain.duree === 'permanent') {
        ctx.faute(sous(cheminPose, 'duree'), 'une pose permanente est réservée au super pouvoir');
      }
    }
  }
  chaine(ctx, o['replique'], sous(chemin, 'replique'), { max: 120 });
  return barres;
}

const CLES_COMMANDER = [
  ...CLES_ENVELOPPE, 'code', 'nom', 'paysCode', 'archetype', 'secret', 'deblocage',
  'traits', 'passif', 'pouvoir', 'superPouvoir', 'faiblesse', 'repliques', 'portrait',
] as const;

/** Valide un commandant (`03-schemas.md` §2). */
export function validerCommander(valeur: unknown): Resultat<Commander> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_COMMANDER);
  if (!o) return conclure(ctx, valeur as Commander);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'nom', 'paysCode', 'archetype', 'traits', 'pouvoir',
    'superPouvoir', 'faiblesse', 'repliques', 'portrait']);

  chaine(ctx, o['code'], 'code', { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
  chaine(ctx, o['nom'], 'nom', { max: 64 });
  codePays(ctx, o['paysCode'], 'paysCode');
  enumeration(ctx, o['archetype'], 'archetype', ARCHETYPES);
  // Général secret (`13-campagne.md` §7) : un commandant caché porte toujours la
  // clé du `Deblocage` qui l'ouvre, sinon rien ne pourrait jamais le rendre jouable.
  const estSecret = presente(o, 'secret') ? booleen(ctx, o['secret'], 'secret') : undefined;
  if (presente(o, 'deblocage')) {
    cle(ctx, o['deblocage'], 'deblocage');
    if (estSecret !== true) {
      ctx.faute('secret', "un commandant qui porte un 'deblocage' est un général secret : secret vaut true");
    }
  } else if (estSecret === true) {
    ctx.faute('deblocage', "un général secret déclare le 'deblocage' qui l'ouvre, sinon il reste injouable");
  }
  const traits = tableau(ctx, o['traits'], 'traits', { min: 3, max: 3 },
    (e, c) => chaine(ctx, e, c, { max: 24 }));
  if (traits) sansDoublon(ctx, traits, 'traits');
  if (presente(o, 'passif')) {
    if (estObjet(o['passif']) && presente(o['passif'] as Record<string, unknown>, 'poserTerrain')) {
      ctx.faute('passif', "un passif n'accepte qu'un effet modificateur, jamais une pose de terrain");
    } else {
      effetModificateur(ctx, o['passif'], 'passif');
    }
  }
  const barres = pouvoir(ctx, o['pouvoir'], 'pouvoir', false);
  const barresSuper = pouvoir(ctx, o['superPouvoir'], 'superPouvoir', true);
  if (barres !== undefined && barresSuper !== undefined && barresSuper <= barres) {
    ctx.faute('superPouvoir.barres', 'le super pouvoir coûte strictement plus cher que le pouvoir');
  }

  const f = objet(ctx, o['faiblesse'], 'faiblesse', ['axe', 'effet', 'description']);
  if (f && requis(ctx, f, 'faiblesse', ['axe', 'effet', 'description'])) {
    enumeration(ctx, f['axe'], 'faiblesse.axe', AXES_FAIBLESSE);
    chaine(ctx, f['description'], 'faiblesse.description', { max: 240 });
    if (estObjet(f['effet']) && presente(f['effet'] as Record<string, unknown>, 'poserTerrain')) {
      ctx.faute('faiblesse.effet', "une faiblesse n'accepte qu'un effet modificateur");
    } else {
      const effet = effetModificateur(ctx, f['effet'], 'faiblesse.effet');
      if (effet) {
        const { quoi, valeur: v } = effet.modificateur;
        const bornes = BORNES_MODIFICATEUR[quoi];
        const defavorable = bornes.forme === 'mult' ? v < 1 : v < 0;
        if (!defavorable) {
          ctx.faute('faiblesse.effet.modificateur.valeur',
            'une faiblesse doit être réellement défavorable (multiplicateur < 1 ou additif < 0)');
        }
      }
    }
  }

  const r = objet(ctx, o['repliques'], 'repliques', ['ouverture', 'victoire', 'defaite', 'unitePerdue']);
  if (r && requis(ctx, r, 'repliques', ['ouverture', 'victoire', 'defaite', 'unitePerdue'])) {
    for (const champ of ['ouverture', 'victoire', 'defaite', 'unitePerdue'] as const) {
      tableau(ctx, r[champ], sous('repliques', champ), { min: 1, max: 3 },
        (e, c) => chaine(ctx, e, c, { max: 240 }));
    }
  }
  const p = objet(ctx, o['portrait'], 'portrait', ['teint', 'cheveux', 'accessoire']);
  if (p && requis(ctx, p, 'portrait', ['teint', 'cheveux', 'accessoire'])) {
    couleur(ctx, p['teint'], 'portrait.teint');
    couleur(ctx, p['cheveux'], 'portrait.cheveux');
    enumeration(ctx, p['accessoire'], 'portrait.accessoire',
      ['beret', 'casque', 'lunettes', 'foulard', 'aucun'] as const);
  }
  return conclure(ctx, o as unknown as Commander);
}

/** Valide une `Specialite` isolée (`03-schemas.md` §1). */
export function validerSpecialite(valeur: unknown): Resultat<Specialite> {
  const ctx = new Contexte();
  const lue = specialite(ctx, valeur, '');
  return conclure(ctx, lue as Specialite);
}

// ---------------------------------------------------------------------------
// UnitType
// ---------------------------------------------------------------------------

/** Lit une `Silhouette` : base, corps, trois modules au plus, taille. */
function silhouette(ctx: Contexte, v: unknown, chemin: string): Silhouette | undefined {
  const o = objet(ctx, v, chemin, ['base', 'corps', 'modules', 'taille']);
  if (!o || !requis(ctx, o, chemin, ['base', 'corps', 'modules', 'taille'])) return undefined;
  const base = enumeration(ctx, o['base'], sous(chemin, 'base'), BASES_SILHOUETTE);
  const corps = enumeration(ctx, o['corps'], sous(chemin, 'corps'), CORPS_SILHOUETTE);
  const modules = tableau(ctx, o['modules'], sous(chemin, 'modules'), { max: 3 },
    (e, c) => enumeration(ctx, e, c, MODULES_SILHOUETTE));
  if (modules) sansDoublon(ctx, modules, sous(chemin, 'modules'));
  const taille = entier(ctx, o['taille'], sous(chemin, 'taille'), { min: 1, max: 3 });
  if (base === undefined || corps === undefined || modules === undefined || taille === undefined) {
    return undefined;
  }
  return { base, corps, modules, taille: taille as typeof TAILLES_SILHOUETTE[number] };
}

/** Lit une ligne ou une colonne de la table de dégâts : des entiers de 0 à 130. */
function tableDegats(ctx: Contexte, v: unknown, chemin: string): Record<string, number> | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'un objet { cleUnite: degats } est attendu');
    return undefined;
  }
  const lue: Record<string, number> = {};
  for (const [k, brut] of Object.entries(v)) {
    if (cle(ctx, k, sous(chemin, k)) === undefined) continue;
    const n = entier(ctx, brut, sous(chemin, k), { min: 0, max: 130 });
    if (n !== undefined) lue[k] = n;
  }
  return lue;
}

const CLES_UNIT_TYPE = [
  'cle', 'nom', 'nomCourt', 'statut', 'homologation', 'traits', 'silhouette', 'cout',
  'mouvement', 'typeMouvement', 'domaine', 'portee', 'vision', 'munitions', 'carburant',
  'capture', 'transport', 'degats', 'subitDegats', 'peutRiposter', 'peutTirerApresMouvement',
] as const;

/** Valide un type d'unité (`03-schemas.md` §3, `04-gameplay.md` §13). */
export function validerUnitType(valeur: unknown): Resultat<UnitType> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_UNIT_TYPE);
  if (!o) return conclure(ctx, valeur as UnitType);
  requis(ctx, o, '', ['cle', 'nom', 'nomCourt', 'statut', 'traits', 'silhouette', 'cout',
    'mouvement', 'typeMouvement', 'domaine', 'portee', 'vision', 'munitions', 'carburant',
    'capture', 'transport', 'degats', 'peutRiposter', 'peutTirerApresMouvement']);

  const c = cle(ctx, o['cle'], 'cle');
  chaine(ctx, o['nom'], 'nom', { max: 40 });
  chaine(ctx, o['nomCourt'], 'nomCourt', { max: 12 });
  const statut = enumeration(ctx, o['statut'], 'statut', STATUTS_UNITE);
  const canon = c !== undefined && (CLES_UNITE_CANON as readonly string[]).includes(c);
  if (statut === 'canon' && !canon) {
    ctx.faute('statut', "seules les dix unités de base portent le statut 'canon'");
  }
  if (canon && statut !== undefined && statut !== 'canon') {
    ctx.faute('statut', "une des dix unités de base ne peut prendre qu'un statut 'canon'");
  }
  if (presente(o, 'homologation')) {
    if (statut === 'canon') ctx.faute('homologation', "une unité 'canon' n'a pas d'homologation");
    const h = objet(ctx, o['homologation'], 'homologation', ['date', 'sourceEventCode', 'catalogue']);
    if (h && requis(ctx, h, 'homologation', ['date'])) {
      dateIso(ctx, h['date'], 'homologation.date');
      if (presente(h, 'sourceEventCode')) cle(ctx, h['sourceEventCode'], 'homologation.sourceEventCode');
      if (presente(h, 'catalogue')) entier(ctx, h['catalogue'], 'homologation.catalogue', { min: 2, max: 99 });
    }
  } else if (statut !== undefined && statut !== 'canon') {
    ctx.faute('homologation', "une unité non 'canon' déclare son homologation");
  }

  const traits = tableau(ctx, o['traits'], 'traits', { max: 2 },
    (e, cc) => enumeration(ctx, e, cc, TRAITS));
  if (traits) sansDoublon(ctx, traits, 'traits');
  silhouette(ctx, o['silhouette'], 'silhouette');
  const cout = entier(ctx, o['cout'], 'cout', { min: 1000, max: 20000, multiple: 100 });
  entier(ctx, o['mouvement'], 'mouvement', { min: 1, max: 9 });
  const typeMouvement = enumeration(ctx, o['typeMouvement'], 'typeMouvement', TYPES_MOUVEMENT);
  const domaine = enumeration(ctx, o['domaine'], 'domaine', DOMAINES);
  const portee = tableau(ctx, o['portee'], 'portee', { min: 2, max: 2 },
    (e, cc) => entier(ctx, e, cc, { min: 1, max: 9 }));
  const vision = entier(ctx, o['vision'], 'vision', { min: 0, max: 6 });
  const munitions = o['munitions'] === null ? null : entier(ctx, o['munitions'], 'munitions', { min: 1, max: 99 });
  const capture = booleen(ctx, o['capture'], 'capture');
  const peutRiposter = booleen(ctx, o['peutRiposter'], 'peutRiposter');
  const peutTirer = booleen(ctx, o['peutTirerApresMouvement'], 'peutTirerApresMouvement');

  let carburant: { max: number; parCase: number; parTour: number } | null = null;
  if (o['carburant'] !== null) {
    const cb = objet(ctx, o['carburant'], 'carburant', ['max', 'parCase', 'parTour']);
    if (cb && requis(ctx, cb, 'carburant', ['max', 'parCase', 'parTour'])) {
      const max = entier(ctx, cb['max'], 'carburant.max', { min: 30, max: 99 });
      const parCase = entier(ctx, cb['parCase'], 'carburant.parCase', { min: 1, max: 2 });
      const parTour = entier(ctx, cb['parTour'], 'carburant.parTour', { min: 0, max: 5 });
      if (max !== undefined && parCase !== undefined && parTour !== undefined) {
        carburant = { max, parCase, parTour };
      }
    }
  }
  let transport: { places: number; accepte: string[] } | null = null;
  if (o['transport'] !== null) {
    const tr = objet(ctx, o['transport'], 'transport', ['places', 'accepte']);
    if (tr && requis(ctx, tr, 'transport', ['places', 'accepte'])) {
      const places = entier(ctx, tr['places'], 'transport.places', { min: 1, max: 2 });
      const accepte = tableau(ctx, tr['accepte'], 'transport.accepte', { min: 1, max: 8 },
        (e, cc) => cle(ctx, e, cc));
      if (accepte && accepte.includes('transport')) {
        ctx.faute('transport.accepte', 'un transport ne transporte jamais un transport');
      }
      if (places !== undefined && accepte !== undefined) transport = { places, accepte };
    }
  }

  const degats = tableDegats(ctx, o['degats'], 'degats');
  if (presente(o, 'subitDegats')) {
    if (statut === 'canon') {
      ctx.faute('subitDegats', "une unité 'canon' lit sa colonne dans la table 10 × 10, elle ne la déclare pas");
    }
    tableDegats(ctx, o['subitDegats'], 'subitDegats');
  } else if (statut !== undefined && statut !== 'canon') {
    ctx.faute('subitDegats', "une unité non 'canon' fournit sa colonne de dégâts, complète");
  }

  // Invariants croisés.
  const min = portee?.[0];
  const max = portee?.[1];
  if (min !== undefined && max !== undefined) {
    if (min > max) ctx.faute('portee', 'portee[0] doit être inférieure ou égale à portee[1]');
    if (max > 1) {
      if (peutRiposter === true) ctx.faute('peutRiposter', 'une pièce indirecte ne riposte jamais');
      if (peutTirer === true) ctx.faute('peutTirerApresMouvement', 'une pièce indirecte ne tire pas après avoir bougé');
    }
  }
  if (degats && Object.values(degats).every((n) => n === 0) && munitions !== null) {
    ctx.faute('munitions', 'une unité sans arme ne porte pas de munitions (munitions: null attendu)');
  }
  if (capture === true && typeMouvement !== undefined && typeMouvement !== 'pied' && typeMouvement !== 'bottes') {
    ctx.faute('capture', "seule une unité 'pied' ou 'bottes' capture");
  }
  if (domaine === 'air' && (carburant === null || carburant.parTour < 1)) {
    ctx.faute('carburant', 'une unité aérienne consomme du carburant même immobile (parTour ≥ 1)');
  }
  if (traits) {
    const a = (t: Trait): boolean => traits.includes(t);
    if (a('capture') !== (capture === true)) {
      ctx.faute('traits', "le trait 'capture' et le champ capture doivent coïncider");
    }
    if (a('transport') !== (transport !== null)) {
      ctx.faute('traits', "le trait 'transport' et le champ transport doivent coïncider");
    }
    if (min !== undefined && a('tir_indirect') !== (min >= 2)) {
      ctx.faute('traits', "le trait 'tir_indirect' et une portée minimale ≥ 2 doivent coïncider");
    }
    if (domaine !== undefined && a('vol') !== (domaine === 'air')) {
      ctx.faute('traits', "le trait 'vol' et le domaine 'air' doivent coïncider");
    }
    if (a('vision_etendue') && (vision === undefined || vision < 5)) {
      ctx.faute('traits', "le trait 'vision_etendue' exige une vision ≥ 5");
    }
    if (a('amphibie')) {
      ctx.faute('traits', "le trait 'amphibie' est refusé tant que le paquet naval n'est pas ouvert");
    }
    if (a('ravitaillement') && degats && Object.values(degats).some((n) => n > 0)) {
      ctx.faute('traits', "le trait 'ravitaillement' exige une ligne de dégâts entièrement à 0");
    }
    if (a('vol') && a('tout_terrain')) ctx.faute('traits', "traits contradictoires : 'vol' et 'tout_terrain'");
    // Un drone est un œil volant qu'on peut brouiller ; un brouilleur n'est qu'un
    // radar sur roues : ni l'un ni l'autre ne tire (`04-gameplay.md` §10 bis).
    if (a('drone') && !a('vol')) ctx.faute('traits', "le trait 'drone' exige le trait 'vol'");
    if ((a('drone') || a('brouilleur')) && degats && Object.values(degats).some((n) => n > 0)) {
      ctx.faute('traits', "un drone ou un brouilleur ne porte pas d'arme (dégâts à 0)");
    }
    if (a('brouilleur') && a('drone')) ctx.faute('traits', "traits contradictoires : 'drone' et 'brouilleur'");
    if (a('tir_indirect') && a('capture')) ctx.faute('traits', "traits contradictoires : 'tir_indirect' et 'capture'");
  }
  const taille = estObjet(o['silhouette']) ? o['silhouette']['taille'] : undefined;
  if (cout !== undefined && typeof taille === 'number') {
    if (cout > 12000 && taille !== 3) {
      ctx.faute('silhouette.taille', 'au-dessus de 12 000 fonds, la silhouette est de taille 3');
    }
    if (cout < 5000 && taille > 2) {
      ctx.faute('silhouette.taille', 'sous 5 000 fonds, la silhouette ne dépasse pas la taille 2');
    }
  }
  return conclure(ctx, o as unknown as UnitType);
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

const CLES_TERRAIN_OBJET = [
  'cle', 'car', 'nom', 'defense', 'couts', 'capturable', 'revenus', 'produit',
  'ravitaille', 'soigne', 'cacheEnBrouillard', 'palette',
] as const;

/** Valide un terrain (`03-schemas.md` §4, `04-gameplay.md` §4). */
export function validerTerrain(valeur: unknown): Resultat<Terrain> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_TERRAIN_OBJET);
  if (!o) return conclure(ctx, valeur as Terrain);
  requis(ctx, o, '', CLES_TERRAIN_OBJET);

  const c = enumeration(ctx, o['cle'], 'cle', CLES_TERRAIN);
  const car = chaine(ctx, o['car'], 'car', { min: 1, max: 1 });
  if (c !== undefined && car !== undefined && CARACTERE_PAR_TERRAIN[c] !== car) {
    ctx.faute('car', `caractère de grille attendu pour ${c} : ${CARACTERE_PAR_TERRAIN[c]}`);
  }
  chaine(ctx, o['nom'], 'nom', { max: 24 });
  entier(ctx, o['defense'], 'defense', { min: 0, max: 4 });

  const couts: Partial<Record<string, number>> = {};
  const co = objet(ctx, o['couts'], 'couts', TYPES_MOUVEMENT);
  if (co) {
    const entrees = Object.entries(co);
    if (entrees.length === 0) ctx.faute('couts', 'au moins un type de mouvement doit pouvoir franchir ce terrain');
    for (const [k, brut] of entrees) {
      const n = entier(ctx, brut, sous('couts', k), { min: 1, max: 4 });
      if (n !== undefined) couts[k] = n;
    }
  }
  const capturable = booleen(ctx, o['capturable'], 'capturable');
  const revenus = entier(ctx, o['revenus'], 'revenus', { min: 0, multiple: 100 });
  const produit = tableau(ctx, o['produit'], 'produit', { max: 24 }, (e, cc) => cle(ctx, e, cc));
  const ravitaille = booleen(ctx, o['ravitaille'], 'ravitaille');
  entier(ctx, o['soigne'], 'soigne', { min: 0, max: 2 });
  booleen(ctx, o['cacheEnBrouillard'], 'cacheEnBrouillard');
  palette(ctx, o['palette'], 'palette');

  if (capturable === true && revenus !== undefined && produit !== undefined
    && revenus === 0 && produit.length === 0 && c !== 'qg') {
    ctx.faute('capturable', 'un terrain capturable rapporte, produit, ou est le QG');
  }
  if (produit !== undefined && produit.length > 0) {
    if (capturable !== true) ctx.faute('produit', 'un terrain producteur est capturable');
    if (ravitaille !== true) ctx.faute('produit', 'un terrain producteur ravitaille');
  }
  if (c === 'mer' || c === 'riviere') {
    for (const interdit of ['pied', 'bottes', 'roues', 'chenilles'] as const) {
      if (interdit in couts && !(c === 'riviere' && (interdit === 'pied' || interdit === 'bottes'))) {
        ctx.faute(sous('couts', interdit), `${c} n'est pas franchissable en ${interdit}`);
      }
    }
  }
  return conclure(ctx, o as unknown as Terrain);
}

// ---------------------------------------------------------------------------
// ParametresCarte et MapDef
// ---------------------------------------------------------------------------

const CLES_PARAMETRES = [
  'largeur', 'hauteur', 'camps', 'biome', 'ratioMer', 'ratioRelief', 'villesParCamp',
  'villesNeutres', 'usinesParCamp', 'aeroportsParCamp', 'symetrie', 'densiteRoutes', 'mecanique',
] as const;

/** Lit les paramètres de génération d'une carte. */
function parametresCarte(ctx: Contexte, v: unknown, chemin: string): void {
  const o = objet(ctx, v, chemin, CLES_PARAMETRES);
  if (!o) return;
  requis(ctx, o, chemin, CLES_PARAMETRES.filter((k) => k !== 'mecanique'));
  entier(ctx, o['largeur'], sous(chemin, 'largeur'), { min: 10, max: 40 });
  entier(ctx, o['hauteur'], sous(chemin, 'hauteur'), { min: 10, max: 30 });
  entier(ctx, o['camps'], sous(chemin, 'camps'), { min: 2, max: 4 });
  enumeration(ctx, o['biome'], sous(chemin, 'biome'), BIOMES);
  nombre(ctx, o['ratioMer'], sous(chemin, 'ratioMer'), { min: 0, max: 0.6 });
  nombre(ctx, o['ratioRelief'], sous(chemin, 'ratioRelief'), { min: 0, max: 0.4 });
  entier(ctx, o['villesParCamp'], sous(chemin, 'villesParCamp'), { min: 2, max: 10 });
  entier(ctx, o['villesNeutres'], sous(chemin, 'villesNeutres'), { min: 0, max: 12 });
  entier(ctx, o['usinesParCamp'], sous(chemin, 'usinesParCamp'), { min: 1, max: 3 });
  entier(ctx, o['aeroportsParCamp'], sous(chemin, 'aeroportsParCamp'), { min: 0, max: 2 });
  enumeration(ctx, o['symetrie'], sous(chemin, 'symetrie'), SYMETRIES);
  nombre(ctx, o['densiteRoutes'], sous(chemin, 'densiteRoutes'), { min: 0, max: 1 });
  if (presente(o, 'mecanique')) {
    chaine(ctx, o['mecanique'], sous(chemin, 'mecanique'),
      { regex: REGEX_CLE_MECANIQUE, forme: 'clé de mécanique préfixée meca_' });
  }
}

/** Valide des paramètres de carte (`03-schemas.md` §5). */
export function validerParametresCarte(valeur: unknown): Resultat<ParametresCarte> {
  const ctx = new Contexte();
  parametresCarte(ctx, valeur, '');
  return conclure(ctx, valeur as ParametresCarte);
}

const CLES_MAPDEF = [
  ...CLES_ENVELOPPE, 'code', 'nom', 'largeur', 'hauteur', 'camps', 'biome', 'grille',
  'proprietaires', 'unitesDepart', 'desaffectes', 'mecanique', 'generation', 'diagnostic',
] as const;

/** Valide une définition de carte (`03-schemas.md` §5). */
export function validerMapDef(valeur: unknown): Resultat<MapDef> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_MAPDEF);
  if (!o) return conclure(ctx, valeur as MapDef);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'nom', 'largeur', 'hauteur', 'camps', 'biome', 'grille',
    'proprietaires', 'unitesDepart']);

  cle(ctx, o['code'], 'code');
  chaine(ctx, o['nom'], 'nom', { max: 64 });
  const largeur = entier(ctx, o['largeur'], 'largeur', { min: 10, max: 40 });
  const hauteur = entier(ctx, o['hauteur'], 'hauteur', { min: 10, max: 30 });
  const camps = entier(ctx, o['camps'], 'camps', { min: 2, max: 4 });
  enumeration(ctx, o['biome'], 'biome', BIOMES);

  const caracteres = Object.values(CARACTERE_PAR_TERRAIN);
  const grille = tableau(ctx, o['grille'], 'grille', { min: 10, max: 30 },
    (e, c) => chaine(ctx, e, c, { max: 40 }));
  let qgParCamp = 0;
  const capturables = new Set<string>();
  if (grille) {
    if (hauteur !== undefined && grille.length !== hauteur) {
      ctx.faute('grille', `la grille compte ${hauteur} lignes, ${grille.length} reçues`);
    }
    for (let y = 0; y < grille.length; y += 1) {
      const ligne = grille[y] as string;
      if (largeur !== undefined && ligne.length !== largeur) {
        ctx.faute(sous('grille', y), `ligne de ${largeur} caractères attendue, ${ligne.length} reçus`);
        continue;
      }
      for (let x = 0; x < ligne.length; x += 1) {
        const car = ligne[x] as string;
        if (!caracteres.includes(car)) {
          ctx.faute(sous('grille', y), `caractère de grille inconnu : '${car}' en colonne ${x}`);
          continue;
        }
        if (car === 'H') qgParCamp += 1;
        if (['C', 'U', 'A', 'H', 'T'].includes(car)) capturables.add(`${x},${y}`);
      }
    }
    if (camps !== undefined && qgParCamp !== camps) {
      ctx.faute('grille', `exactement un QG par camp est exigé : ${camps} attendus, ${qgParCamp} trouvés`);
    }
  }

  const props = objet(ctx, o['proprietaires'], 'proprietaires', Object.keys(o['proprietaires'] ?? {}));
  if (props) {
    for (const [k, brut] of Object.entries(props)) {
      const cheminProp = sous('proprietaires', k);
      if (!REGEX_CASE.test(k)) {
        ctx.faute(cheminProp, "clé de case attendue sous la forme 'x,y'");
        continue;
      }
      const [xs, ys] = k.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if ((largeur !== undefined && x >= largeur) || (hauteur !== undefined && y >= hauteur)) {
        ctx.faute(cheminProp, 'case hors des bornes de la carte');
        continue;
      }
      if (grille && !capturables.has(k)) {
        ctx.faute(cheminProp, 'un propriétaire ne se pose que sur une case capturable');
      }
      const camp = entier(ctx, brut, cheminProp, { min: 0, max: 3 });
      if (camp !== undefined && camps !== undefined && camp >= camps) {
        ctx.faute(cheminProp, `camp inconnu : ${camps} camps sur cette carte`);
      }
    }
  }

  if (presente(o, 'desaffectes')) {
    // Un bâtiment désaffecté est neutre par construction : c'est la remise en
    // service qui lui donne un propriétaire. Le QG n'est jamais désaffecté, sinon
    // le camp partirait sans base et sans condition de défaite lisible.
    const desaffectes = tableau(ctx, o['desaffectes'], 'desaffectes', { max: 12 },
      (e, c) => caseGrille(ctx, e, c));
    if (desaffectes && grille) {
      desaffectes.forEach((d, i) => {
        const k = `${d.x},${d.y}`;
        const car = grille[d.y]?.[d.x];
        if (!capturables.has(k) || car === 'H') {
          ctx.faute(sous('desaffectes', i), 'un bâtiment désaffecté est une ville, une usine ou un aéroport');
        }
        if (props && k in props) ctx.faute(sous('desaffectes', i), 'un bâtiment désaffecté n\'a pas de propriétaire');
      });
      sansDoublon(ctx, desaffectes.map((d) => `${d.x},${d.y}`), 'desaffectes');
    }
  }

  tableau(ctx, o['unitesDepart'], 'unitesDepart', { max: 40 }, (e, c) => {
    const u = objet(ctx, e, c, ['camp', 'type', 'x', 'y', 'pv']);
    if (!u || !requis(ctx, u, c, ['camp', 'type', 'x', 'y'])) return undefined;
    const camp = entier(ctx, u['camp'], sous(c, 'camp'), { min: 0, max: 3 });
    if (camp !== undefined && camps !== undefined && camp >= camps) {
      ctx.faute(sous(c, 'camp'), `camp inconnu : ${camps} camps sur cette carte`);
    }
    cle(ctx, u['type'], sous(c, 'type'));
    const x = entier(ctx, u['x'], sous(c, 'x'), { min: 0, max: (largeur ?? 40) - 1 });
    const y = entier(ctx, u['y'], sous(c, 'y'), { min: 0, max: (hauteur ?? 30) - 1 });
    if (presente(u, 'pv')) entier(ctx, u['pv'], sous(c, 'pv'), { min: 1, max: 100 });
    if (x === undefined || y === undefined) return undefined;
    return { x, y } as UniteDepart;
  });
  const positions = Array.isArray(o['unitesDepart'])
    ? (o['unitesDepart'] as unknown[]).map((u) => (estObjet(u) ? `${String(u['x'])},${String(u['y'])}` : ''))
    : [];
  sansDoublon(ctx, positions, 'unitesDepart');

  if (presente(o, 'mecanique')) {
    chaine(ctx, o['mecanique'], 'mecanique',
      { regex: REGEX_CLE_MECANIQUE, forme: 'clé de mécanique préfixée meca_' });
  }
  if (presente(o, 'generation')) {
    const g = objet(ctx, o['generation'], 'generation', ['graine', 'parametres', 'mapgenVersion']);
    if (g && requis(ctx, g, 'generation', ['graine', 'parametres', 'mapgenVersion'])) {
      chaine(ctx, g['graine'], 'generation.graine', { max: 64 });
      parametresCarte(ctx, g['parametres'], 'generation.parametres');
      entier(ctx, g['mapgenVersion'], 'generation.mapgenVersion', { min: 1 });
    }
  }
  if (presente(o, 'diagnostic')) {
    const d = objet(ctx, o['diagnostic'], 'diagnostic',
      ['surfaceTerre', 'distanceQgQg', 'distanceQgUsine', 'zonesIsolees']);
    if (d) {
      entier(ctx, d['surfaceTerre'], 'diagnostic.surfaceTerre', { min: 0 });
      entier(ctx, d['distanceQgQg'], 'diagnostic.distanceQgQg', { min: 0 });
      tableau(ctx, d['distanceQgUsine'], 'diagnostic.distanceQgUsine', { max: 4 },
        (e, c) => entier(ctx, e, c, { min: 0 }));
      entier(ctx, d['zonesIsolees'], 'diagnostic.zonesIsolees', { min: 0 });
    }
  }
  return conclure(ctx, o as unknown as MapDef);
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/** Lit un objectif de victoire. */
function objectifVictoire(ctx: Contexte, v: unknown, chemin: string): ObjectifVictoire | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'un objectif de victoire est attendu');
    return undefined;
  }
  const type = v['type'];
  switch (type) {
    case 'capture_qg':
    case 'hors_jeu_total':
      objet(ctx, v, chemin, ['type']);
      return { type } as ObjectifVictoire;
    case 'capturer': {
      const o = objet(ctx, v, chemin, ['type', 'cases', 'combien']);
      if (!o || !requis(ctx, o, chemin, ['cases', 'combien'])) return undefined;
      const cases = tableau(ctx, o['cases'], sous(chemin, 'cases'), { min: 1, max: 12 },
        (e, c) => caseGrille(ctx, e, c));
      const combien = entier(ctx, o['combien'], sous(chemin, 'combien'), { min: 1, max: 12 });
      if (cases && combien !== undefined && combien > cases.length) {
        ctx.faute(sous(chemin, 'combien'), 'on ne peut pas exiger plus de cases que le scénario n\'en désigne');
      }
      return { type: 'capturer', cases: cases ?? [], combien: combien ?? 1 };
    }
    case 'tenir': {
      const o = objet(ctx, v, chemin, ['type', 'cases', 'journees']);
      if (!o || !requis(ctx, o, chemin, ['cases', 'journees'])) return undefined;
      tableau(ctx, o['cases'], sous(chemin, 'cases'), { min: 1, max: 12 }, (e, c) => caseGrille(ctx, e, c));
      entier(ctx, o['journees'], sous(chemin, 'journees'), { min: 1, max: 60 });
      return v as ObjectifVictoire;
    }
    case 'survivre': {
      const o = objet(ctx, v, chemin, ['type', 'journees']);
      if (!o || !requis(ctx, o, chemin, ['journees'])) return undefined;
      entier(ctx, o['journees'], sous(chemin, 'journees'), { min: 1, max: 60 });
      return v as ObjectifVictoire;
    }
    case 'proteger': {
      const o = objet(ctx, v, chemin, ['type', 'uniteRef', 'destination']);
      if (!o || !requis(ctx, o, chemin, ['uniteRef'])) return undefined;
      chaine(ctx, o['uniteRef'], sous(chemin, 'uniteRef'), { max: 48 });
      if (o['destination'] !== undefined) caseGrille(ctx, o['destination'], sous(chemin, 'destination'));
      return v as ObjectifVictoire;
    }
    case 'relais': {
      const o = objet(ctx, v, chemin, ['type', 'cases']);
      if (!o || !requis(ctx, o, chemin, ['cases'])) return undefined;
      tableau(ctx, o['cases'], sous(chemin, 'cases'), { min: 2, max: 12 }, (e, c) => caseGrille(ctx, e, c));
      return v as ObjectifVictoire;
    }
    case 'points': {
      const o = objet(ctx, v, chemin, ['type', 'seuil']);
      if (!o || !requis(ctx, o, chemin, ['seuil'])) return undefined;
      entier(ctx, o['seuil'], sous(chemin, 'seuil'), { min: 1, max: 9999 });
      return v as ObjectifVictoire;
    }
    default:
      ctx.faute(sous(chemin, 'type'), 'type de condition de victoire inconnu');
      return undefined;
  }
}

/** Lit un objectif de défaite. */
function objectifDefaite(ctx: Contexte, v: unknown, chemin: string): ObjectifDefaite | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'une condition de défaite est attendue');
    return undefined;
  }
  const type = v['type'];
  switch (type) {
    case 'qg_perdu':
    case 'toutes_unites_hors_jeu':
      objet(ctx, v, chemin, ['type']);
      return { type } as ObjectifDefaite;
    case 'limite_journees': {
      const o = objet(ctx, v, chemin, ['type', 'journees']);
      if (!o || !requis(ctx, o, chemin, ['journees'])) return undefined;
      entier(ctx, o['journees'], sous(chemin, 'journees'), { min: 1, max: 60 });
      return v as ObjectifDefaite;
    }
    case 'unite_perdue': {
      const o = objet(ctx, v, chemin, ['type', 'uniteRef']);
      if (!o || !requis(ctx, o, chemin, ['uniteRef'])) return undefined;
      chaine(ctx, o['uniteRef'], sous(chemin, 'uniteRef'), { max: 48 });
      return v as ObjectifDefaite;
    }
    case 'case_perdue': {
      const o = objet(ctx, v, chemin, ['type', 'cases']);
      if (!o || !requis(ctx, o, chemin, ['cases'])) return undefined;
      tableau(ctx, o['cases'], sous(chemin, 'cases'), { min: 1, max: 12 }, (e, c) => caseGrille(ctx, e, c));
      return v as ObjectifDefaite;
    }
    default:
      ctx.faute(sous(chemin, 'type'), 'type de condition de défaite inconnu');
      return undefined;
  }
}

/** Lit une réplique de dialogue. */
function dialogue(ctx: Contexte, v: unknown, chemin: string): Dialogue | undefined {
  const o = objet(ctx, v, chemin, ['locuteur', 'texte', 'emotion']);
  if (!o || !requis(ctx, o, chemin, ['locuteur', 'texte'])) return undefined;
  cle(ctx, o['locuteur'], sous(chemin, 'locuteur'));
  chaine(ctx, o['texte'], sous(chemin, 'texte'), { max: 240 });
  if (presente(o, 'emotion')) enumeration(ctx, o['emotion'], sous(chemin, 'emotion'), EMOTIONS);
  return o as unknown as Dialogue;
}

/**
 * Lit une **scène de dialogue** jouée pendant le match.
 *
 * Le déclencheur est validé paramètre par paramètre : `journee` doit être une
 * journée plausible, `unite` une clé du catalogue, `etape` un jalon positif. Un
 * déclencheur muet — un `journee` sans journée — passerait sinon, et la scène
 * ne se jouerait jamais sans que personne ne sache pourquoi.
 */
function sceneDialogue(ctx: Contexte, v: unknown, chemin: string): SceneDialogue | undefined {
  const o = objet(ctx, v, chemin, ['cle', 'declencheur', 'repliques']);
  if (!o || !requis(ctx, o, chemin, ['cle', 'declencheur', 'repliques'])) return undefined;
  cle(ctx, o['cle'], sous(chemin, 'cle'));
  tableau(ctx, o['repliques'], sous(chemin, 'repliques'), { min: 1, max: 6 }, (e, c) => dialogue(ctx, e, c));

  const cheminD = sous(chemin, 'declencheur');
  const d = objet(ctx, o['declencheur'], cheminD, ['type', 'journee', 'camp', 'unite', 'etape']);
  if (!d || !requis(ctx, d, cheminD, ['type'])) return undefined;
  const type = enumeration(ctx, d['type'], sous(cheminD, 'type'), DECLENCHEURS_SCENE);
  if (type === 'journee') {
    requis(ctx, d, cheminD, ['journee']);
    entier(ctx, d['journee'], sous(cheminD, 'journee'), { min: 1, max: 60 });
  }
  if (type === 'etape') {
    requis(ctx, d, cheminD, ['etape']);
    entier(ctx, d['etape'], sous(cheminD, 'etape'), { min: 1, max: 12 });
  }
  if (presente(d, 'camp')) entier(ctx, d['camp'], sous(cheminD, 'camp'), { min: 0, max: 3 });
  if (presente(d, 'unite')) cle(ctx, d['unite'], sous(cheminD, 'unite'));
  return o as unknown as SceneDialogue;
}

/** Lit une scène de choix et refuse un choix sans conséquence. */
function choixScenario(ctx: Contexte, v: unknown, chemin: string): ChoixScenario | undefined {
  const o = objet(ctx, v, chemin, ['cle', 'question', 'moment', 'declencheur', 'litFlags', 'options']);
  if (!o || !requis(ctx, o, chemin, ['cle', 'question', 'moment', 'litFlags', 'options'])) return undefined;
  cle(ctx, o['cle'], sous(chemin, 'cle'));
  chaine(ctx, o['question'], sous(chemin, 'question'), { max: 160 });
  enumeration(ctx, o['moment'], sous(chemin, 'moment'), MOMENTS_CHOIX);
  if (presente(o, 'declencheur')) {
    const d = objet(ctx, o['declencheur'], sous(chemin, 'declencheur'), ['journee', 'flagRequis']);
    if (d) {
      if (presente(d, 'journee')) entier(ctx, d['journee'], sous(sous(chemin, 'declencheur'), 'journee'), { min: 1, max: 60 });
      if (presente(d, 'flagRequis')) cleFlag(ctx, d['flagRequis'], sous(sous(chemin, 'declencheur'), 'flagRequis'));
    }
  }
  tableau(ctx, o['litFlags'], sous(chemin, 'litFlags'), { max: 4 }, (e, c) => cleFlag(ctx, e, c));

  const empreintes: string[] = [];
  tableau(ctx, o['options'], sous(chemin, 'options'), { min: 2, max: 3 }, (e, c) => {
    const op = objet(ctx, e, c, ['cle', 'libelle', 'ecritFlags', 'effetImmediat']);
    if (!op || !requis(ctx, op, c, ['cle', 'libelle', 'ecritFlags'])) return undefined;
    cle(ctx, op['cle'], sous(c, 'cle'));
    chaine(ctx, op['libelle'], sous(c, 'libelle'), { max: 90 });
    const ecrits = tableau(ctx, op['ecritFlags'], sous(c, 'ecritFlags'), { min: 1, max: 3 }, (f, cf) => {
      const fo = objet(ctx, f, cf, ['cle', 'valeur']);
      if (!fo || !requis(ctx, fo, cf, ['cle', 'valeur'])) return undefined;
      const k = cleFlag(ctx, fo['cle'], sous(cf, 'cle'));
      if (fo['valeur'] !== true && typeof fo['valeur'] !== 'number') {
        ctx.faute(sous(cf, 'valeur'), 'une écriture de flag vaut true ou un entier signé');
      }
      return k;
    });
    if (presente(op, 'effetImmediat')) {
      if (estObjet(op['effetImmediat']) && presente(op['effetImmediat'] as Record<string, unknown>, 'poserTerrain')) {
        ctx.faute(sous(c, 'effetImmediat'), "un effet immédiat de choix n'accepte qu'un modificateur");
      } else {
        effetModificateur(ctx, op['effetImmediat'], sous(c, 'effetImmediat'));
      }
    }
    empreintes.push(JSON.stringify([...(ecrits ?? [])].sort()));
    return op as unknown as ChoixScenario['options'][number];
  });
  if (new Set(empreintes).size !== empreintes.length) {
    ctx.faute(sous(chemin, 'options'), 'deux options écrivent le même ensemble de flags : le choix est décoratif');
  }
  return o as unknown as ChoixScenario;
}

/**
 * Lit un jeu de paramètres de mode (`13-campagne.md` §6). Renvoie la valeur lue :
 * la comparaison `normal` / `difficile` se fait ensuite, sur les deux jeux.
 */
function parametresMode(ctx: Contexte, v: unknown, chemin: string): ParametresMode | undefined {
  const cles = [
    'fondsDepart', 'fondsDepartIa', 'revenusParBatiment', 'revenusIaParBatiment',
    'brouillard', 'previsionJournees', 'vitesseJauge', 'limiteJournees',
    'strategieIa', 'reprises', 'dureeVisee',
  ] as const;
  const o = objet(ctx, v, chemin, cles);
  if (!o || !requis(ctx, o, chemin, cles)) return undefined;
  entier(ctx, o['fondsDepart'], sous(chemin, 'fondsDepart'), { min: 0, max: 30000, multiple: 100 });
  entier(ctx, o['fondsDepartIa'], sous(chemin, 'fondsDepartIa'), { min: 0, max: 30000, multiple: 100 });
  entier(ctx, o['revenusParBatiment'], sous(chemin, 'revenusParBatiment'), { min: 500, max: 2000, multiple: 100 });
  entier(ctx, o['revenusIaParBatiment'], sous(chemin, 'revenusIaParBatiment'), { min: 500, max: 3000, multiple: 100 });
  booleen(ctx, o['brouillard'], sous(chemin, 'brouillard'));
  entier(ctx, o['previsionJournees'], sous(chemin, 'previsionJournees'), { min: 0, max: 2 });
  nombre(ctx, o['vitesseJauge'], sous(chemin, 'vitesseJauge'), { min: 0.5, max: 1.5 });
  if (o['limiteJournees'] !== null) {
    entier(ctx, o['limiteJournees'], sous(chemin, 'limiteJournees'), { min: 5, max: 60 });
  }
  enumeration(ctx, o['strategieIa'], sous(chemin, 'strategieIa'), STRATEGIES_IA);
  entier(ctx, o['reprises'], sous(chemin, 'reprises'), { min: 0, max: 5 });
  entier(ctx, o['dureeVisee'], sous(chemin, 'dureeVisee'), { min: DUREE_VISEE_MIN, max: DUREE_VISEE_MAX });
  return o as unknown as ParametresMode;
}

/** Durées visées admissibles, en minutes (`13-campagne.md` §3). */
const DUREE_VISEE_MIN = 10;
const DUREE_VISEE_MAX = 120;

/**
 * Lit les deux jeux de paramètres d'un scénario et vérifie que `difficile` est bien
 * plus dur que `normal` sur chaque axe. Un « mode difficile » plus facile est le bug
 * silencieux le plus facile à écrire et le plus difficile à voir en jouant.
 */
function modesScenario(ctx: Contexte, v: unknown, chemin: string): void {
  const o = objet(ctx, v, chemin, ['normal', 'difficile']);
  if (!o || !requis(ctx, o, chemin, ['normal', 'difficile'])) return;
  const n = parametresMode(ctx, o['normal'], sous(chemin, 'normal'));
  const d = parametresMode(ctx, o['difficile'], sous(chemin, 'difficile'));
  if (!n || !d) return;
  const dur = sous(chemin, 'difficile');
  if (d.fondsDepartIa < n.fondsDepartIa) {
    ctx.faute(sous(dur, 'fondsDepartIa'), "en 'difficile', l'IA ne part jamais avec moins de fonds qu'en 'normal'");
  }
  if (d.revenusIaParBatiment < n.revenusIaParBatiment) {
    ctx.faute(sous(dur, 'revenusIaParBatiment'), "en 'difficile', l'IA n'encaisse jamais moins qu'en 'normal'");
  }
  if (n.brouillard && !d.brouillard) {
    ctx.faute(sous(dur, 'brouillard'), "le brouillard imposé en 'normal' reste imposé en 'difficile'");
  }
  if (d.previsionJournees > n.previsionJournees) {
    ctx.faute(sous(dur, 'previsionJournees'), "le Bulletin ne voit jamais plus loin en 'difficile' qu'en 'normal'");
  }
  if (d.vitesseJauge > n.vitesseJauge) {
    ctx.faute(sous(dur, 'vitesseJauge'), "la jauge du joueur ne monte jamais plus vite en 'difficile'");
  }
  if (d.reprises > n.reprises) {
    ctx.faute(sous(dur, 'reprises'), "on ne reprend jamais plus de journées en 'difficile' qu'en 'normal'");
  }
  if (d.reprises !== 0) {
    ctx.faute(sous(dur, 'reprises'), "le mode 'difficile' n'accorde aucune reprise de journée (BRIEF.md)");
  }
  if (n.limiteJournees !== null && d.limiteJournees !== null && d.limiteJournees > n.limiteJournees) {
    ctx.faute(sous(dur, 'limiteJournees'), "la limite de journées ne se relâche pas en 'difficile'");
  }
  if (n.limiteJournees === null && d.limiteJournees !== null) return;
  if (n.limiteJournees !== null && d.limiteJournees === null) {
    ctx.faute(sous(dur, 'limiteJournees'), "un match limité en 'normal' ne devient pas illimité en 'difficile'");
  }
}

const CLES_SCENARIO = [
  ...CLES_ENVELOPPE, 'code', 'nom', 'acte', 'gabarit', 'dureeVisee', 'modes',
  'incarnation', 'paysCode', 'regionCle', 'carteCle', 'date',
  'climatFixe', 'cycleJourNuit', 'catalogueVersion', 'commandants', 'fondsDepart',
  'revenusParBatiment', 'brouillard', 'limiteJournees', 'victoire', 'defaite',
  'dialogueOuverture', 'dialogueVictoire', 'dialogueDefaite', 'scenesDialogue',
  'choix', 'flagsRequis', 'flagsInterdits', 'recompenses',
] as const;

/** Valide un scénario (`03-schemas.md` §6). */
export function validerScenario(valeur: unknown): Resultat<Scenario> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_SCENARIO);
  if (!o) return conclure(ctx, valeur as Scenario);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'nom', 'acte', 'paysCode', 'carteCle', 'date', 'cycleJourNuit',
    'catalogueVersion', 'commandants', 'fondsDepart', 'revenusParBatiment', 'brouillard',
    'limiteJournees', 'victoire', 'defaite', 'dialogueOuverture', 'dialogueVictoire',
    'dialogueDefaite', 'choix', 'flagsRequis', 'flagsInterdits', 'recompenses']);

  const code = cle(ctx, o['code'], 'code');
  chaine(ctx, o['nom'], 'nom', { max: 80 });
  entier(ctx, o['acte'], 'acte', { min: 0, max: 3 });
  if (presente(o, 'gabarit')) enumeration(ctx, o['gabarit'], 'gabarit', CLES_GABARIT);
  const dureeVisee = presente(o, 'dureeVisee')
    ? entier(ctx, o['dureeVisee'], 'dureeVisee', { min: DUREE_VISEE_MIN, max: DUREE_VISEE_MAX })
    : undefined;
  if (presente(o, 'modes')) {
    modesScenario(ctx, o['modes'], 'modes');
    const m = estObjet(o['modes']) ? o['modes'] : undefined;
    const normal = m && estObjet(m['normal']) ? m['normal'] : undefined;
    if (dureeVisee !== undefined && normal && normal['dureeVisee'] !== dureeVisee) {
      ctx.faute('dureeVisee', "la durée visée du scénario est celle du mode 'normal'");
    }
  }
  // Match d'incarnation : le joueur joue une nation alliée, avec son général au
  // camp 0 (`BRIEF.md`, « Le joueur et le départ » ; `03-schemas.md` §15.2).
  let incarnePays: CodePays | undefined;
  let incarneCmd: string | undefined;
  if (presente(o, 'incarnation')) {
    const inc = objet(ctx, o['incarnation'], 'incarnation', ['paysCode', 'commandantCle']);
    if (inc && requis(ctx, inc, 'incarnation', ['paysCode', 'commandantCle'])) {
      incarnePays = codePays(ctx, inc['paysCode'], 'incarnation.paysCode');
      incarneCmd = chaine(ctx, inc['commandantCle'], 'incarnation.commandantCle',
        { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
    }
  }

  const paysCode = codePays(ctx, o['paysCode'], 'paysCode');
  if (presente(o, 'regionCle')) cle(ctx, o['regionCle'], 'regionCle');
  cle(ctx, o['carteCle'], 'carteCle');
  dateIso(ctx, o['date'], 'date');
  if (presente(o, 'climatFixe')) {
    const cf = objet(ctx, o['climatFixe'], 'climatFixe', ['saison', 'meteo']);
    if (cf) {
      if (presente(cf, 'saison')) enumeration(ctx, cf['saison'], 'climatFixe.saison', SAISONS);
      if (presente(cf, 'meteo')) enumeration(ctx, cf['meteo'], 'climatFixe.meteo', METEOS);
    }
  }
  const cy = objet(ctx, o['cycleJourNuit'], 'cycleJourNuit', ['jour', 'nuit']);
  if (cy && requis(ctx, cy, 'cycleJourNuit', ['jour', 'nuit'])) {
    const jour = entier(ctx, cy['jour'], 'cycleJourNuit.jour', { min: 0, max: 12 });
    const nuit = entier(ctx, cy['nuit'], 'cycleJourNuit.nuit', { min: 0, max: 12 });
    if (jour !== undefined && nuit !== undefined && (jour + nuit < 1 || jour + nuit > 12)) {
      ctx.faute('cycleJourNuit', 'la somme jour + nuit est comprise entre 1 et 12');
    }
  }
  entier(ctx, o['catalogueVersion'], 'catalogueVersion', { min: 1 });

  const camps: number[] = [];
  let joueurs = 0;
  let cmdJoueur: string | undefined;
  let cheminJoueur = 'commandants';
  tableau(ctx, o['commandants'], 'commandants', { min: 2, max: 4 }, (e, c) => {
    const cm = objet(ctx, e, c, ['camp', 'commandantCle', 'ia']);
    if (!cm || !requis(ctx, cm, c, ['camp', 'commandantCle'])) return undefined;
    const camp = entier(ctx, cm['camp'], sous(c, 'camp'), { min: 0, max: 3 });
    const k = cle(ctx, cm['commandantCle'], sous(c, 'commandantCle'));
    if (camp === 0) {
      cmdJoueur = k;
      cheminJoueur = sous(c, 'commandantCle');
    }
    if (presente(cm, 'ia')) enumeration(ctx, cm['ia'], sous(c, 'ia'), STRATEGIES_IA);
    else joueurs += 1;
    if (camp !== undefined) camps.push(camp);
    if (camp !== undefined && camp !== 0 && !presente(cm, 'ia')) {
      ctx.faute(sous(c, 'ia'), 'tout camp autre que le camp 0 est piloté par une IA');
    }
    return camp;
  });
  sansDoublon(ctx, camps, 'commandants');
  if (joueurs > 1) ctx.faute('commandants', 'un seul camp sans IA : le camp 0');
  // Le camp du joueur porte le général de la nation incarnée : c'est ce que
  // `sceneDepuis` lit, et ce qui rend l'incarnation vraie plutôt qu'annoncée.
  if (incarneCmd !== undefined && cmdJoueur !== undefined && cmdJoueur !== incarneCmd) {
    ctx.faute(cheminJoueur,
      `un match d'incarnation se joue avec le général incarné au camp 0 : ${incarneCmd} attendu`);
  }

  entier(ctx, o['fondsDepart'], 'fondsDepart', { min: 0, max: 30000, multiple: 100 });
  entier(ctx, o['revenusParBatiment'], 'revenusParBatiment', { min: 500, max: 2000, multiple: 100 });
  booleen(ctx, o['brouillard'], 'brouillard');
  const limite = o['limiteJournees'] === null
    ? null
    : entier(ctx, o['limiteJournees'], 'limiteJournees', { min: 5, max: 60 });

  const victoires = tableau(ctx, o['victoire'], 'victoire', { min: 1, max: 3 },
    (e, c) => objectifVictoire(ctx, e, c));
  tableau(ctx, o['defaite'], 'defaite', { min: 1, max: 3 }, (e, c) => objectifDefaite(ctx, e, c));
  if (victoires && limite !== null && limite !== undefined) {
    for (const v of victoires) {
      if (v.type === 'survivre' && v.journees > limite) {
        ctx.faute('limiteJournees', "la limite de journées doit couvrir l'objectif 'survivre'");
      }
    }
  }
  tableau(ctx, o['dialogueOuverture'], 'dialogueOuverture', { min: 1, max: 8 }, (e, c) => dialogue(ctx, e, c));
  tableau(ctx, o['dialogueVictoire'], 'dialogueVictoire', { min: 1, max: 6 }, (e, c) => dialogue(ctx, e, c));
  tableau(ctx, o['dialogueDefaite'], 'dialogueDefaite', { min: 1, max: 4 }, (e, c) => dialogue(ctx, e, c));
  if (presente(o, 'scenesDialogue')) {
    const scenes = tableau(ctx, o['scenesDialogue'], 'scenesDialogue', { max: 12 }, (e, c) => sceneDialogue(ctx, e, c));
    // Deux scènes de même clé ne se distingueraient plus : la seconde ne se
    // jouerait jamais, puisqu'une scène jouée l'est pour toute la partie.
    sansDoublon(ctx, (scenes ?? []).map((sc) => sc.cle), 'scenesDialogue');
  }
  // Portée des flags **écrits** — par une récompense comme par une option de choix.
  // Un scénario de pays n'écrit que `pays.<son code>.*` et `monde.*`. Un **match
  // d'incarnation** est plus serré encore : il n'écrit **aucun** flag de la trame
  // principale du joueur, donc rien en `monde.*`, et ses flags de pays sont ceux de
  // la nation incarnée. Restent `cmd.*` : la relation avec le général, qui est
  // précisément ce qu'un match d'incarnation fait bouger (`08` §4.5).
  const portee = (f: string, chemin: string): void => {
    if (incarnePays !== undefined) {
      if (f.startsWith('monde.')) {
        ctx.faute(chemin,
          "un match d'incarnation n'écrit aucun flag de la trame principale : pays.<nation incarnée>.* ou cmd.* seulement");
      } else if (f.startsWith('pays.') && !f.startsWith(`pays.${incarnePays}.`)) {
        ctx.faute(chemin, `un match d'incarnation de ${incarnePays} n'écrit que pays.${incarnePays}.* ou cmd.*`);
      }
      return;
    }
    if (paysCode !== undefined && f.startsWith('pays.') && !f.startsWith(`pays.${paysCode}.`)) {
      ctx.faute(chemin, `un scénario de ${paysCode} n'écrit que pays.${paysCode}.* ou monde.*`);
    }
  };

  const choix = tableau(ctx, o['choix'], 'choix', { max: 3 }, (e, c) => choixScenario(ctx, e, c));
  for (const [i, sc] of (choix ?? []).entries()) {
    const options = Array.isArray(sc.options) ? sc.options : [];
    for (const [j, op] of options.entries()) {
      const ecrits = Array.isArray(op?.ecritFlags) ? op.ecritFlags : [];
      for (const [k, ecrit] of ecrits.entries()) {
        const f = ecrit?.cle;
        if (typeof f === 'string') {
          const ou = sous(sous(sous(sous(sous(sous('choix', i), 'options'), j), 'ecritFlags'), k), 'cle');
          portee(f, ou);
        }
      }
    }
  }
  tableau(ctx, o['flagsRequis'], 'flagsRequis', { max: 8 }, (e, c) => cleFlag(ctx, e, c));
  tableau(ctx, o['flagsInterdits'], 'flagsInterdits', { max: 8 }, (e, c) => cleFlag(ctx, e, c));
  const rec = objet(ctx, o['recompenses'], 'recompenses', ['flags', 'fonds', 'coCommandant', 'carteMonde']);
  if (rec && requis(ctx, rec, 'recompenses', ['flags'])) {
    const flags = tableau(ctx, rec['flags'], 'recompenses.flags', { max: 8 }, (e, c) => {
      const f = cleFlag(ctx, e, c);
      if (f !== undefined) portee(f, c);
      return f;
    });
    if (flags === undefined) ctx.faute('recompenses.flags', 'un tableau de flags est attendu');
    if (presente(rec, 'fonds')) entier(ctx, rec['fonds'], 'recompenses.fonds', { min: 0, max: 30000, multiple: 100 });
    if (presente(rec, 'coCommandant')) cle(ctx, rec['coCommandant'], 'recompenses.coCommandant');
    if (presente(rec, 'carteMonde')) {
      tableau(ctx, rec['carteMonde'], 'recompenses.carteMonde', { max: 3 }, (e, c) => cle(ctx, e, c));
    }
  }
  if (code === undefined) ctx.faute('code', 'code de scénario manquant ou invalide');
  return conclure(ctx, o as unknown as Scenario);
}

// ---------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------

const CLES_REGION = [
  ...CLES_ENVELOPPE, 'code', 'paysCode', 'nom', 'type', 'ordreConseille', 'biome',
  'climat', 'specialiteLocale', 'mecanique', 'commandantCle', 'scenarios', 'accroche',
  'motsCles', 'flagsPropres',
] as const;

/** Valide une région d'un pays phare (`03-schemas.md` §7). */
export function validerRegion(valeur: unknown): Resultat<Region> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_REGION);
  if (!o) return conclure(ctx, valeur as Region);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'paysCode', 'nom', 'type', 'ordreConseille', 'biome', 'climat',
    'specialiteLocale', 'mecanique', 'commandantCle', 'scenarios', 'accroche', 'motsCles',
    'flagsPropres']);

  cle(ctx, o['code'], 'code');
  const paysCode = codePays(ctx, o['paysCode'], 'paysCode');
  chaine(ctx, o['nom'], 'nom', { max: 48 });
  const type = enumeration(ctx, o['type'], 'type', TYPES_REGION);
  const ordre = entier(ctx, o['ordreConseille'], 'ordreConseille', { min: 1, max: 40 });
  if (type === 'collectivite' && ordre !== undefined && ordre <= 18) {
    ctx.faute('ordreConseille', 'une collectivité est une étape bonus : ordre supérieur à 18');
  }
  enumeration(ctx, o['biome'], 'biome', BIOMES);
  enumeration(ctx, o['climat'], 'climat', CLIMATS);
  specialite(ctx, o['specialiteLocale'], 'specialiteLocale');
  if (estObjet(o['specialiteLocale']) && o['specialiteLocale']['portee'] !== 'region') {
    ctx.faute('specialiteLocale.portee', "la spécialité d'une région a la portée 'region'");
  }
  const m = objet(ctx, o['mecanique'], 'mecanique', ['cle', 'parametres', 'description']);
  if (m && requis(ctx, m, 'mecanique', ['cle', 'parametres', 'description'])) {
    chaine(ctx, m['cle'], 'mecanique.cle',
      { regex: REGEX_CLE_MECANIQUE, forme: 'clé de mécanique préfixée meca_' });
    const p = m['parametres'];
    if (!estObjet(p)) ctx.faute('mecanique.parametres', 'un objet de paramètres est attendu');
    else {
      for (const [k, brut] of Object.entries(p)) {
        if (typeof brut !== 'number' && typeof brut !== 'string' && typeof brut !== 'boolean') {
          ctx.faute(sous('mecanique.parametres', k), 'un paramètre est un nombre, une chaîne ou un booléen');
        }
        if (k === 'gelable' && typeof brut !== 'boolean') {
          ctx.faute(sous('mecanique.parametres', 'gelable'), "le paramètre commun 'gelable' est booléen");
        }
      }
    }
    chaine(ctx, m['description'], 'mecanique.description', { max: 240 });
  }
  cle(ctx, o['commandantCle'], 'commandantCle');
  tableau(ctx, o['scenarios'], 'scenarios', { min: 1, max: 3 }, (e, c) => cle(ctx, e, c));
  chaine(ctx, o['accroche'], 'accroche', { max: 160 });
  const mots = tableau(ctx, o['motsCles'], 'motsCles', { min: 3, max: 8 },
    (e, c) => chaine(ctx, e, c, { max: 32 }));
  if (mots) sansDoublon(ctx, mots, 'motsCles');
  tableau(ctx, o['flagsPropres'], 'flagsPropres', { max: 12 }, (e, c) => {
    const f = cleFlag(ctx, e, c);
    if (f !== undefined && paysCode !== undefined && f.startsWith('pays.') && !f.startsWith(`pays.${paysCode}.`)) {
      ctx.faute(c, `un flag régional est un flag de pays : pays.${paysCode}.<region>_<nom>`);
    }
    return f;
  });
  return conclure(ctx, o as unknown as Region);
}

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

const CLES_FLAG = [
  'cle', 'portee', 'paysCode', 'commandantCle', 'libelle', 'description', 'valeur',
  'min', 'max', 'exclusifAvec', 'impacte', 'perenne',
] as const;

/** Valide un flag narratif (`03-schemas.md` §8, `01-bible.md` §8). */
export function validerFlag(valeur: unknown): Resultat<Flag> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_FLAG);
  if (!o) return conclure(ctx, valeur as Flag);
  requis(ctx, o, '', ['cle', 'portee', 'libelle', 'description', 'valeur', 'min', 'max',
    'exclusifAvec', 'impacte', 'perenne']);

  const k = cleFlag(ctx, o['cle'], 'cle');
  const portee = enumeration(ctx, o['portee'], 'portee', PORTEES_FLAG);
  if (k !== undefined && portee !== undefined) {
    const prefixe = k.split('.')[0];
    const attendu = portee === 'commandant' ? 'cmd' : portee;
    if (prefixe !== attendu) ctx.faute('portee', `la portée ${portee} exige une clé préfixée ${attendu}.`);
  }
  if (portee === 'pays') {
    const pc = codePays(ctx, o['paysCode'], 'paysCode');
    if (pc !== undefined && k !== undefined && !k.startsWith(`pays.${pc}.`)) {
      ctx.faute('paysCode', 'le code pays doit être celui du segment de la clé');
    }
  } else if (presente(o, 'paysCode')) {
    ctx.faute('paysCode', "'paysCode' n'existe que pour un flag de portée pays");
  }
  if (portee === 'commandant') {
    const cc = cle(ctx, o['commandantCle'], 'commandantCle');
    if (cc !== undefined && k !== undefined && !k.startsWith(`cmd.${cc.replace(/^cmd_/, '')}.`)) {
      ctx.faute('commandantCle', 'le commandant doit être celui du segment de la clé');
    }
  } else if (presente(o, 'commandantCle')) {
    ctx.faute('commandantCle', "'commandantCle' n'existe que pour un flag de portée commandant");
  }
  chaine(ctx, o['libelle'], 'libelle', { max: 90 });
  chaine(ctx, o['description'], 'description', { max: 240 });
  const type = enumeration(ctx, o['valeur'], 'valeur', VALEURS_FLAG);
  const min = o['min'] === null ? null : entier(ctx, o['min'], 'min', { min: -3, max: 0 });
  const max = o['max'] === null ? null : entier(ctx, o['max'], 'max', { min: 1, max: 99 });
  if (type === 'booleen' && (min !== null || max !== null)) {
    ctx.faute('min', 'un flag booléen n\'a ni minimum ni maximum');
  }
  if (type === 'compteur' && max === null) ctx.faute('max', 'un compteur déclare son maximum (1 à 99)');
  if (type === 'relation' && (min !== -3 || max !== 3)) {
    ctx.faute('min', 'une relation va de −3 à +3');
  }
  tableau(ctx, o['exclusifAvec'], 'exclusifAvec', { max: 8 }, (e, c) => cleFlag(ctx, e, c));
  const impacte = tableau(ctx, o['impacte'], 'impacte', { min: 1, max: 5 },
    (e, c) => enumeration(ctx, e, c, IMPACTS_FLAG));
  if (impacte) sansDoublon(ctx, impacte, 'impacte');
  const perenne = booleen(ctx, o['perenne'], 'perenne');
  if (portee === 'monde' && perenne !== true) {
    ctx.faute('perenne', 'un flag de monde est toujours pérenne');
  }
  return conclure(ctx, o as unknown as Flag);
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

/** Lit l'effet d'un événement selon son type. */
function effetEvent(ctx: Contexte, v: unknown, chemin: string): EffetEvent | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, "un effet d'événement est attendu");
    return undefined;
  }
  switch (v['type']) {
    case 'bonus_pays': {
      const o = objet(ctx, v, chemin, ['type', 'paysCode', 'modificateur']);
      if (!o || !requis(ctx, o, chemin, ['paysCode', 'modificateur'])) return undefined;
      codePays(ctx, o['paysCode'], sous(chemin, 'paysCode'));
      if (estObjet(o['modificateur']) && presente(o['modificateur'] as Record<string, unknown>, 'poserTerrain')) {
        ctx.faute(sous(chemin, 'modificateur'), "un événement n'accepte qu'un modificateur");
        return undefined;
      }
      const effet = effetModificateur(ctx, o['modificateur'], sous(chemin, 'modificateur'));
      if (effet && BORNES_MODIFICATEUR[effet.modificateur.quoi].forme === 'mult') {
        const val = effet.modificateur.valeur;
        if (val < 0.9 || val > 1.15) {
          ctx.faute(sous(sous(chemin, 'modificateur'), 'modificateur.valeur'),
            'un bonus d\'événement multiplicatif reste dans [0,90 ; 1,15]');
        }
      }
      return v as EffetEvent;
    }
    case 'carte_bonus': {
      const o = objet(ctx, v, chemin, ['type', 'carteCle']);
      if (!o || !requis(ctx, o, chemin, ['carteCle'])) return undefined;
      cle(ctx, o['carteCle'], sous(chemin, 'carteCle'));
      return v as EffetEvent;
    }
    case 'dialogue_bonus': {
      const o = objet(ctx, v, chemin, ['type', 'commandantCle', 'repliques']);
      if (!o || !requis(ctx, o, chemin, ['commandantCle', 'repliques'])) return undefined;
      cle(ctx, o['commandantCle'], sous(chemin, 'commandantCle'));
      tableau(ctx, o['repliques'], sous(chemin, 'repliques'), { min: 1, max: 3 },
        (e, c) => chaine(ctx, e, c, { max: 240 }));
      return v as EffetEvent;
    }
    case 'meteo_globale': {
      const o = objet(ctx, v, chemin, ['type', 'mecaniqueCle', 'parametres']);
      if (!o || !requis(ctx, o, chemin, ['mecaniqueCle', 'parametres'])) return undefined;
      chaine(ctx, o['mecaniqueCle'], sous(chemin, 'mecaniqueCle'),
        { regex: REGEX_CLE_MECANIQUE, forme: 'clé de mécanique préfixée meca_' });
      if (!estObjet(o['parametres'])) ctx.faute(sous(chemin, 'parametres'), 'un objet de paramètres est attendu');
      return v as EffetEvent;
    }
    case 'cosmetique': {
      const o = objet(ctx, v, chemin, ['type', 'palette']);
      if (!o || !requis(ctx, o, chemin, ['palette'])) return undefined;
      palette(ctx, o['palette'], sous(chemin, 'palette'));
      return v as EffetEvent;
    }
    default:
      ctx.faute(sous(chemin, 'type'), "type d'effet d'événement inconnu");
      return undefined;
  }
}

const CLES_EVENT = [
  ...CLES_ENVELOPPE, 'code', 'titre', 'resume', 'categorie', 'sourceUrl', 'sourceNom',
  'paysConcernes', 'debut', 'fin', 'effet', 'valideParHumain', 'motifRefusHumain',
] as const;

/** Valide un événement issu de l'actualité (`03-schemas.md` §9). */
export function validerEvent(valeur: unknown): Resultat<Event> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_EVENT);
  if (!o) return conclure(ctx, valeur as Event);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'titre', 'resume', 'categorie', 'sourceUrl', 'sourceNom',
    'paysConcernes', 'debut', 'fin', 'effet', 'valideParHumain']);

  cle(ctx, o['code'], 'code');
  chaine(ctx, o['titre'], 'titre', { max: 80 });
  chaine(ctx, o['resume'], 'resume', { max: 240 });
  enumeration(ctx, o['categorie'], 'categorie', CATEGORIES_EVENT);
  const url = chaine(ctx, o['sourceUrl'], 'sourceUrl', { max: 300 });
  if (url !== undefined && !url.startsWith('https://')) {
    ctx.faute('sourceUrl', 'une source est servie en https://');
  }
  chaine(ctx, o['sourceNom'], 'sourceNom', { max: 120 });
  const pays = tableau(ctx, o['paysConcernes'], 'paysConcernes', { max: 6 }, (e, c) => codePays(ctx, e, c));
  if (pays) sansDoublon(ctx, pays, 'paysConcernes');
  const debut = dateIso(ctx, o['debut'], 'debut');
  const fin = dateIso(ctx, o['fin'], 'fin');
  if (debut !== undefined && fin !== undefined) {
    const jours = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000;
    if (jours < 0) ctx.faute('fin', 'la fin ne précède pas le début');
    else if (jours > 60) ctx.faute('fin', "un événement d'actualité dure 60 jours au plus");
  }
  effetEvent(ctx, o['effet'], 'effet');
  booleen(ctx, o['valideParHumain'], 'valideParHumain');
  if (presente(o, 'motifRefusHumain')) chaine(ctx, o['motifRefusHumain'], 'motifRefusHumain', { max: 300 });
  return conclure(ctx, o as unknown as Event);
}

// ---------------------------------------------------------------------------
// MemoryEntry
// ---------------------------------------------------------------------------

const CLES_MEMOIRE = [
  'cle', 'date', 'source', 'sourceRef', 'sujet', 'portee', 'porteeRef', 'contenu',
  'poids', 'occurrences', 'expireLe',
] as const;

/** Valide une entrée de mémoire (`03-schemas.md` §10). */
export function validerMemoryEntry(valeur: unknown): Resultat<MemoryEntry> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_MEMOIRE);
  if (!o) return conclure(ctx, valeur as MemoryEntry);
  requis(ctx, o, '', ['cle', 'date', 'source', 'sujet', 'portee', 'porteeRef', 'contenu',
    'poids', 'occurrences', 'expireLe']);

  cle(ctx, o['cle'], 'cle');
  dateIso(ctx, o['date'], 'date');
  const source = enumeration(ctx, o['source'], 'source', SOURCES_MEMOIRE);
  if (presente(o, 'sourceRef')) chaine(ctx, o['sourceRef'], 'sourceRef', { max: 300 });
  enumeration(ctx, o['sujet'], 'sujet', SUJETS_MEMOIRE);
  const portee = enumeration(ctx, o['portee'], 'portee', PORTEES_MEMOIRE);
  const referencee = portee !== undefined
    && (PORTEES_MEMOIRE_REFERENCEES as readonly string[]).includes(portee);
  if (referencee) {
    if (o['porteeRef'] === null) ctx.faute('porteeRef', `la portée ${portee} exige une référence`);
    else cle(ctx, o['porteeRef'], 'porteeRef');
  } else if (o['porteeRef'] !== null && presente(o, 'porteeRef')) {
    ctx.faute('porteeRef', `la portée ${String(portee)} n'accepte pas de référence (null attendu)`);
  }
  const contenu = chaine(ctx, o['contenu'], 'contenu', { max: 300 });
  if (contenu !== undefined) {
    if (/[\n\r]|^[-*•]|\s[-*•]\s/.test(contenu)) {
      ctx.faute('contenu', 'une entrée de mémoire est une seule affirmation, sans puce ni retour à la ligne');
    }
    const phrases = contenu.split(/[.!?](?:\s|$)/).filter((p) => p.trim().length > 0);
    if (phrases.length > 1) {
      ctx.faute('contenu', 'une entrée de mémoire porte une seule affirmation');
    }
  }
  entier(ctx, o['poids'], 'poids', { min: 1, max: 5 });
  entier(ctx, o['occurrences'], 'occurrences', { min: 1 });
  if (o['expireLe'] === null) {
    if (source !== 'humain') ctx.faute('expireLe', "seule une entrée d'origine humaine est permanente");
  } else {
    dateIso(ctx, o['expireLe'], 'expireLe');
  }
  return conclure(ctx, o as unknown as MemoryEntry);
}

// ---------------------------------------------------------------------------
// PromptVersion
// ---------------------------------------------------------------------------

/** Lit les métriques d'une version de prompt. */
function metriquesPrompt(ctx: Contexte, v: unknown, chemin: string): MetriquesPrompt | undefined {
  const o = objet(ctx, v, chemin,
    ['runs', 'objetsProduits', 'tauxRejet', 'motifsTop', 'coherenceLore', 'dureeMoyenneMs', 'fenetre']);
  if (!o || !requis(ctx, o, chemin,
    ['runs', 'objetsProduits', 'tauxRejet', 'motifsTop', 'coherenceLore', 'dureeMoyenneMs', 'fenetre'])) {
    return undefined;
  }
  entier(ctx, o['runs'], sous(chemin, 'runs'), { min: 0 });
  entier(ctx, o['objetsProduits'], sous(chemin, 'objetsProduits'), { min: 0 });
  nombre(ctx, o['tauxRejet'], sous(chemin, 'tauxRejet'), { min: 0, max: 1 });
  tableau(ctx, o['motifsTop'], sous(chemin, 'motifsTop'), { max: 5 }, (e, c) => {
    const m = objet(ctx, e, c, ['motif', 'n']);
    if (!m || !requis(ctx, m, c, ['motif', 'n'])) return undefined;
    chaine(ctx, m['motif'], sous(c, 'motif'), { max: 48 });
    entier(ctx, m['n'], sous(c, 'n'), { min: 1 });
    return m;
  });
  nombre(ctx, o['coherenceLore'], sous(chemin, 'coherenceLore'), { min: 0, max: 1 });
  nombre(ctx, o['dureeMoyenneMs'], sous(chemin, 'dureeMoyenneMs'), { min: 0 });
  const f = objet(ctx, o['fenetre'], sous(chemin, 'fenetre'), ['du', 'au']);
  if (f && requis(ctx, f, sous(chemin, 'fenetre'), ['du', 'au'])) {
    dateIso(ctx, f['du'], sous(sous(chemin, 'fenetre'), 'du'));
    dateIso(ctx, f['au'], sous(sous(chemin, 'fenetre'), 'au'));
  }
  return o as unknown as MetriquesPrompt;
}

const CLES_PROMPT_VERSION = [
  'cle', 'version', 'corps', 'auteur', 'auteurRef', 'statut', 'parentVersion',
  'justification', 'diffResume', 'metriques', 'valideParHumain', 'creeLe', 'activeLe',
] as const;

/** Valide une version de prompt métier (`03-schemas.md` §11). */
export function validerPromptVersion(valeur: unknown): Resultat<PromptVersion> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_PROMPT_VERSION);
  if (!o) return conclure(ctx, valeur as PromptVersion);
  requis(ctx, o, '', ['cle', 'version', 'corps', 'auteur', 'statut', 'parentVersion',
    'justification', 'diffResume', 'metriques', 'valideParHumain', 'creeLe', 'activeLe']);

  enumeration(ctx, o['cle'], 'cle', CLES_PROMPT);
  entier(ctx, o['version'], 'version', { min: 1 });
  chaine(ctx, o['corps'], 'corps', { min: 200, max: 20000 });
  const auteur = enumeration(ctx, o['auteur'], 'auteur', AUTEURS_PROMPT);
  if (presente(o, 'auteurRef')) chaine(ctx, o['auteurRef'], 'auteurRef', { max: 120 });
  const statut = enumeration(ctx, o['statut'], 'statut', STATUTS_PROMPT);
  if (auteur === 'atlas_cerveau' && statut !== 'propose') {
    ctx.faute('statut', "une routine ne peut proposer qu'un prompt 'propose'");
  }
  if (o['parentVersion'] !== null) entier(ctx, o['parentVersion'], 'parentVersion', { min: 1 });
  chaine(ctx, o['justification'], 'justification', { max: 500 });
  tableau(ctx, o['diffResume'], 'diffResume', { min: 1, max: 8 }, (e, c) => chaine(ctx, e, c, { max: 240 }));
  if (o['metriques'] !== null) metriquesPrompt(ctx, o['metriques'], 'metriques');
  const valide = booleen(ctx, o['valideParHumain'], 'valideParHumain');
  dateIso(ctx, o['creeLe'], 'creeLe');
  if (o['activeLe'] === null) {
    if (statut === 'courant') ctx.faute('activeLe', "une version courante porte sa date d'activation");
  } else {
    dateIso(ctx, o['activeLe'], 'activeLe');
  }
  if (statut === 'courant' && valide !== true) {
    ctx.faute('valideParHumain', "un prompt ne devient courant qu'après validation humaine");
  }
  return conclure(ctx, o as unknown as PromptVersion);
}

// ---------------------------------------------------------------------------
// ReviewVerdict
// ---------------------------------------------------------------------------

const CLES_STATS = [
  'parties', 'strategie', 'graines', 'victoiresCamp', 'nonTerminees', 'journeesMediane',
  'journeesEcartType', 'fondsMoyenParCamp', 'casesJamaisVisitees', 'mecaniqueDeclenchee',
  'climat', 'dureeMoyenneMs',
] as const;

/** Lit un bloc de statistiques de simulation. */
function statsSimulation(ctx: Contexte, v: unknown, chemin: string): StatsSimulation | undefined {
  const o = objet(ctx, v, chemin, CLES_STATS);
  if (!o || !requis(ctx, o, chemin, CLES_STATS)) return undefined;
  const parties = entier(ctx, o['parties'], sous(chemin, 'parties'), { min: 10 });
  chaine(ctx, o['strategie'], sous(chemin, 'strategie'), { max: 24 });
  const graines = tableau(ctx, o['graines'], sous(chemin, 'graines'), { min: 1 },
    (e, c) => chaine(ctx, e, c, { max: 64 }));
  if (graines) {
    sansDoublon(ctx, graines, sous(chemin, 'graines'));
    if (parties !== undefined && graines.length !== parties) {
      ctx.faute(sous(chemin, 'graines'), `autant de graines que de parties : ${parties} attendues`);
    }
  }
  const victoires = tableau(ctx, o['victoiresCamp'], sous(chemin, 'victoiresCamp'), { min: 2, max: 4 },
    (e, c) => entier(ctx, e, c, { min: 0 }));
  if (victoires && parties !== undefined) {
    const somme = victoires.reduce((a, b) => a + b, 0);
    if (somme > parties) ctx.faute(sous(chemin, 'victoiresCamp'), 'la somme des victoires dépasse le nombre de parties');
  }
  entier(ctx, o['nonTerminees'], sous(chemin, 'nonTerminees'), { min: 0 });
  nombre(ctx, o['journeesMediane'], sous(chemin, 'journeesMediane'), { min: 0 });
  nombre(ctx, o['journeesEcartType'], sous(chemin, 'journeesEcartType'), { min: 0 });
  tableau(ctx, o['fondsMoyenParCamp'], sous(chemin, 'fondsMoyenParCamp'), { min: 2, max: 4 },
    (e, c) => nombre(ctx, e, c, { min: 0 }));
  nombre(ctx, o['casesJamaisVisitees'], sous(chemin, 'casesJamaisVisitees'), { min: 0, max: 100 });
  if (o['mecaniqueDeclenchee'] !== null) {
    entier(ctx, o['mecaniqueDeclenchee'], sous(chemin, 'mecaniqueDeclenchee'), { min: 0 });
  }
  const cl = objet(ctx, o['climat'], sous(chemin, 'climat'), ['saison', 'meteo', 'phase']);
  if (cl && requis(ctx, cl, sous(chemin, 'climat'), ['saison', 'meteo', 'phase'])) {
    enumeration(ctx, cl['saison'], sous(sous(chemin, 'climat'), 'saison'), SAISONS);
    enumeration(ctx, cl['meteo'], sous(sous(chemin, 'climat'), 'meteo'), [...METEOS, 'tiree'] as const);
    enumeration(ctx, cl['phase'], sous(sous(chemin, 'climat'), 'phase'), [...PHASES_JOUR, 'cycle'] as const);
  }
  nombre(ctx, o['dureeMoyenneMs'], sous(chemin, 'dureeMoyenneMs'), { min: 0 });
  return o as unknown as StatsSimulation;
}

const CLES_REVIEW = [
  'cle', 'cibleType', 'cibleCle', 'cibleVersion', 'verdict', 'motifs', 'detail',
  'stats', 'coherenceLore', 'suggestions', 'routineRunId', 'creeLe',
] as const;

/** Valide un verdict de la routine contrôle (`03-schemas.md` §12). */
export function validerReviewVerdict(valeur: unknown): Resultat<ReviewVerdict> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_REVIEW);
  if (!o) return conclure(ctx, valeur as ReviewVerdict);
  requis(ctx, o, '', ['cle', 'cibleType', 'cibleCle', 'cibleVersion', 'verdict', 'motifs',
    'stats', 'coherenceLore', 'suggestions', 'routineRunId', 'creeLe']);

  cle(ctx, o['cle'], 'cle');
  const cibleType = enumeration(ctx, o['cibleType'], 'cibleType', CIBLES_REVIEW);
  cle(ctx, o['cibleCle'], 'cibleCle');
  entier(ctx, o['cibleVersion'], 'cibleVersion', { min: 1 });
  const verdict = enumeration(ctx, o['verdict'], 'verdict', ['valide', 'rejete'] as const);
  const motifs = tableau(ctx, o['motifs'], 'motifs', { max: 6 }, (e, c) => {
    const m = objet(ctx, e, c, ['code', 'detail', 'mesure']);
    if (!m || !requis(ctx, m, c, ['code'])) return undefined;
    const code = enumeration(ctx, m['code'], sous(c, 'code'), MOTIFS_REJET);
    if (presente(m, 'detail')) chaine(ctx, m['detail'], sous(c, 'detail'), { max: 240 });
    if (presente(m, 'mesure')) {
      const mes = m['mesure'];
      if (!estObjet(mes)) ctx.faute(sous(c, 'mesure'), 'un objet de mesures chiffrées est attendu');
      else {
        for (const [k, brut] of Object.entries(mes)) {
          nombre(ctx, brut, sous(sous(c, 'mesure'), k));
        }
      }
    }
    return code;
  });
  if (motifs) {
    sansDoublon(ctx, motifs, 'motifs');
    if (verdict === 'rejete' && motifs.length === 0) {
      ctx.faute('motifs', 'un rejet énonce au moins un motif');
    }
    if (verdict === 'valide' && motifs.length > 0) {
      ctx.faute('motifs', 'un verdict validé ne porte aucun motif');
    }
  }
  if (presente(o, 'detail')) chaine(ctx, o['detail'], 'detail', { max: 500 });

  const stats = o['stats'];
  if (stats === null) {
    if (cibleType === 'carte' || cibleType === 'scenario' || cibleType === 'unite') {
      ctx.faute('stats', `une cible ${cibleType} exige des statistiques de simulation`);
    }
  } else if (estObjet(stats) && (presente(stats, 'avec') || presente(stats, 'sans'))) {
    if (cibleType !== 'unite') {
      ctx.faute('stats', "la forme { avec, sans } est réservée à une cible 'unite'");
    }
    const paire = objet(ctx, stats, 'stats', ['avec', 'sans']);
    if (paire && requis(ctx, paire, 'stats', ['avec', 'sans'])) {
      statsSimulation(ctx, paire['avec'], 'stats.avec');
      statsSimulation(ctx, paire['sans'], 'stats.sans');
    }
  } else {
    if (cibleType === 'unite') {
      ctx.faute('stats', "une cible 'unite' exige la forme { avec, sans }");
    }
    statsSimulation(ctx, stats, 'stats');
  }
  nombre(ctx, o['coherenceLore'], 'coherenceLore', { min: 0, max: 1 });
  tableau(ctx, o['suggestions'], 'suggestions', { max: 3 }, (e, c) => chaine(ctx, e, c, { max: 240 }));
  chaine(ctx, o['routineRunId'], 'routineRunId', { max: 64 });
  dateIso(ctx, o['creeLe'], 'creeLe');
  return conclure(ctx, o as unknown as ReviewVerdict);
}

// ---------------------------------------------------------------------------
// EtatClimat, MissionDuJour, Sauvegarde
// ---------------------------------------------------------------------------

/** Valide un bloc climatique d'état de partie (`03-schemas.md` §13). */
export function validerEtatClimat(valeur: unknown): Resultat<EtatClimat> {
  const ctx = new Contexte();
  const cles = ['saison', 'phase', 'journeeDansCycle', 'meteo', 'previsions'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as EtatClimat);
  requis(ctx, o, '', cles);
  enumeration(ctx, o['saison'], 'saison', SAISONS);
  enumeration(ctx, o['phase'], 'phase', PHASES_JOUR);
  entier(ctx, o['journeeDansCycle'], 'journeeDansCycle', { min: 0, max: 11 });
  enumeration(ctx, o['meteo'], 'meteo', METEOS);
  tableau(ctx, o['previsions'], 'previsions', { min: 2, max: 2 },
    (e, c) => enumeration(ctx, e, c, METEOS));
  return conclure(ctx, o as unknown as EtatClimat);
}

/** Valide une Dépêche du jour (`03-schemas.md` §14). */
export function validerMissionDuJour(valeur: unknown): Resultat<MissionDuJour> {
  const ctx = new Contexte();
  const cles = ['cle', 'date', 'eventCode', 'scenarioCle', 'paysCode', 'statut', 'expireLe'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as MissionDuJour);
  requis(ctx, o, '', cles);
  cle(ctx, o['cle'], 'cle');
  const date = dateIso(ctx, o['date'], 'date');
  cle(ctx, o['eventCode'], 'eventCode');
  cle(ctx, o['scenarioCle'], 'scenarioCle');
  codePays(ctx, o['paysCode'], 'paysCode');
  enumeration(ctx, o['statut'], 'statut', STATUTS);
  const expire = dateIso(ctx, o['expireLe'], 'expireLe');
  if (date !== undefined && expire !== undefined) {
    const attendu = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    if (expire !== attendu) ctx.faute('expireLe', `une mission expire sept jours après sa date : ${attendu} attendu`);
  }
  return conclure(ctx, o as unknown as MissionDuJour);
}

/** Valide une sauvegarde (`03-schemas.md` §14). */
export function validerSauvegarde(valeur: unknown): Resultat<Sauvegarde> {
  const ctx = new Contexte();
  const cles = ['scenarioCle', 'graine', 'catalogueVersion', 'engineVersion', 'mapgenVersion',
    'contentVersion', 'actions'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as Sauvegarde);
  requis(ctx, o, '', cles);
  cle(ctx, o['scenarioCle'], 'scenarioCle');
  chaine(ctx, o['graine'], 'graine', { max: 64 });
  for (const champ of ['catalogueVersion', 'engineVersion', 'mapgenVersion', 'contentVersion'] as const) {
    entier(ctx, o[champ], champ, { min: 1 });
  }
  if (!Array.isArray(o['actions'])) ctx.faute('actions', "un journal d'actions est attendu");
  return conclure(ctx, o as unknown as Sauvegarde);
}

// ---------------------------------------------------------------------------
// Internationalisation (`09-i18n.md` §2)
// ---------------------------------------------------------------------------

/** Valide une langue du jeu (`09-i18n.md` §2.1). */
export function validerLocale(valeur: unknown): Resultat<Locale> {
  const ctx = new Contexte();
  const cles = ['code', 'nom', 'script', 'sens', 'statut', 'seuilCouverture',
    'facteurLongueur', 'echantillonHumain', 'ordre'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as Locale);
  requis(ctx, o, '', cles);
  const code = chaine(ctx, o['code'], 'code',
    { regex: REGEX_CODE_LOCALE, forme: "étiquette BCP 47 en minuscules ('fr', 'pt-br')" });
  chaine(ctx, o['nom'], 'nom', { max: 40 });
  enumeration(ctx, o['script'], 'script', SCRIPTS_LOCALE);
  enumeration(ctx, o['sens'], 'sens', SENS_ECRITURE);
  const statut = enumeration(ctx, o['statut'], 'statut', STATUTS_LOCALE);
  if (code === 'fr' && statut !== 'active') {
    ctx.faute('statut', "le français est la langue source : il reste 'active'");
  }
  nombre(ctx, o['seuilCouverture'], 'seuilCouverture', { min: 0, max: 1 });
  nombre(ctx, o['facteurLongueur'], 'facteurLongueur', { min: 0.5, max: 1.5 });
  entier(ctx, o['echantillonHumain'], 'echantillonHumain', { min: 0, max: 100 });
  entier(ctx, o['ordre'], 'ordre', { min: 1, max: 99 });
  return conclure(ctx, o as unknown as Locale);
}

/** Valide une chaîne source (`09-i18n.md` §2.2). */
export function validerChaineSource(valeur: unknown): Resultat<ChaineSource> {
  const ctx = new Contexte();
  const cles = ['cle', 'texte', 'origine', 'contexte', 'longueurMax', 'placeholders',
    'pluriel', 'sourceHash', 'versionChaine', 'objetRef', 'creeLe', 'majLe'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as ChaineSource);
  requis(ctx, o, '', ['cle', 'texte', 'origine', 'contexte', 'longueurMax', 'placeholders',
    'pluriel', 'sourceHash', 'versionChaine', 'creeLe', 'majLe']);

  chaine(ctx, o['cle'], 'cle',
    { max: 120, regex: REGEX_CLE_CHAINE, forme: 'clé pointée de 2 à 6 segments' });
  const texte = chaine(ctx, o['texte'], 'texte', { max: 2000 });
  enumeration(ctx, o['origine'], 'origine', ORIGINES_CHAINE);
  const c = objet(ctx, o['contexte'], 'contexte', ['ecran', 'locuteur', 'note']);
  if (c) {
    if (presente(c, 'ecran')) chaine(ctx, c['ecran'], 'contexte.ecran', { max: 40 });
    if (presente(c, 'locuteur')) cle(ctx, c['locuteur'], 'contexte.locuteur');
    if (presente(c, 'note')) chaine(ctx, c['note'], 'contexte.note', { max: 200 });
  }
  const longueurMax = o['longueurMax'] === null
    ? null
    : entier(ctx, o['longueurMax'], 'longueurMax', { min: 1, max: 2000 });
  if (texte !== undefined && typeof longueurMax === 'number' && texte.length > longueurMax) {
    ctx.faute('texte', `le texte source dépasse sa propre borne de ${longueurMax} caractères`);
  }
  const placeholders = tableau(ctx, o['placeholders'], 'placeholders', { max: 12 },
    (e, ch) => chaine(ctx, e, ch, { max: 40 }));
  if (placeholders && texte !== undefined) {
    for (let i = 0; i < placeholders.length; i += 1) {
      const p = placeholders[i] as string;
      if (!texte.includes(p)) {
        ctx.faute(sous('placeholders', i), `marqueur absent du texte source : ${p}`);
      }
    }
  }
  booleen(ctx, o['pluriel'], 'pluriel');
  chaine(ctx, o['sourceHash'], 'sourceHash',
    { min: 16, max: 16, regex: /^[0-9a-f]{16}$/, forme: 'SHA-256 tronqué à 16 caractères hexadécimaux' });
  entier(ctx, o['versionChaine'], 'versionChaine', { min: 1 });
  if (presente(o, 'objetRef')) {
    const r = objet(ctx, o['objetRef'], 'objetRef', ['type', 'cle', 'champ']);
    if (r && requis(ctx, r, 'objetRef', ['type', 'cle', 'champ'])) {
      enumeration(ctx, r['type'], 'objetRef.type', TYPES_OBJET_REF);
      cle(ctx, r['cle'], 'objetRef.cle');
      chaine(ctx, r['champ'], 'objetRef.champ', { max: 64 });
    }
  }
  dateIso(ctx, o['creeLe'], 'creeLe');
  dateIso(ctx, o['majLe'], 'majLe');
  return conclure(ctx, o as unknown as ChaineSource);
}

/** Valide une traduction (`09-i18n.md` §2.3). */
export function validerTraduction(valeur: unknown): Resultat<Traduction> {
  const ctx = new Contexte();
  const cles = ['cleChaine', 'locale', 'texte', 'statut', 'sourceHash', 'versionChaine',
    'auteur', 'relueParHumain', 'runRef', 'creeLe', 'majLe'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as Traduction);
  requis(ctx, o, '', cles);
  chaine(ctx, o['cleChaine'], 'cleChaine',
    { max: 120, regex: REGEX_CLE_CHAINE, forme: 'clé pointée de 2 à 6 segments' });
  const locale = chaine(ctx, o['locale'], 'locale',
    { regex: REGEX_CODE_LOCALE, forme: 'étiquette BCP 47 en minuscules' });
  if (locale === 'fr') ctx.faute('locale', "le français est la source : il n'a pas de traduction");
  const statut = enumeration(ctx, o['statut'], 'statut', STATUTS_TRADUCTION);
  if (o['texte'] === null) {
    if (statut !== undefined && statut !== 'manquante') {
      ctx.faute('texte', "seule une traduction 'manquante' est sans texte");
    }
  } else {
    chaine(ctx, o['texte'], 'texte', { max: 2000 });
    if (statut === 'manquante') ctx.faute('statut', "une traduction avec texte n'est pas 'manquante'");
  }
  chaine(ctx, o['sourceHash'], 'sourceHash',
    { min: 16, max: 16, regex: /^[0-9a-f]{16}$/, forme: 'SHA-256 tronqué à 16 caractères hexadécimaux' });
  entier(ctx, o['versionChaine'], 'versionChaine', { min: 1 });
  enumeration(ctx, o['auteur'], 'auteur', AUTEURS_TRADUCTION);
  booleen(ctx, o['relueParHumain'], 'relueParHumain');
  if (o['runRef'] !== null) chaine(ctx, o['runRef'], 'runRef', { max: 64 });
  dateIso(ctx, o['creeLe'], 'creeLe');
  dateIso(ctx, o['majLe'], 'majLe');
  return conclure(ctx, o as unknown as Traduction);
}

/** Valide un glossaire de langue (`09-i18n.md` §2.4). */
export function validerGlossaire(valeur: unknown): Resultat<Glossaire> {
  const ctx = new Contexte();
  const cles = ['locale', 'termesInterdits', 'entrees', 'majLe'] as const;
  const o = objet(ctx, valeur, '', cles);
  if (!o) return conclure(ctx, valeur as Glossaire);
  requis(ctx, o, '', cles);
  const locale = chaine(ctx, o['locale'], 'locale',
    { regex: REGEX_CODE_LOCALE, forme: 'étiquette BCP 47 en minuscules' });
  const interdits = tableau(ctx, o['termesInterdits'], 'termesInterdits', { max: 64 },
    (e, c) => chaine(ctx, e, c, { max: 64 }));
  if (interdits) sansDoublon(ctx, interdits, 'termesInterdits');
  const translittere = locale !== undefined
    && (LOCALES_TRANSLITTEREES as readonly string[]).includes(locale);
  const termes = tableau(ctx, o['entrees'], 'entrees', { min: 1, max: 500 }, (e, c) => {
    const en = objet(ctx, e, c, ['terme', 'categorie', 'traduction', 'translitteration', 'note']);
    if (!en || !requis(ctx, en, c, ['terme', 'categorie', 'traduction'])) return undefined;
    const terme = chaine(ctx, en['terme'], sous(c, 'terme'), { max: 64 });
    const categorie = enumeration(ctx, en['categorie'], sous(c, 'categorie'), CATEGORIES_GLOSSAIRE);
    if (en['traduction'] !== null) chaine(ctx, en['traduction'], sous(c, 'traduction'), { max: 120 });
    else if (categorie !== undefined && categorie !== 'nom_propre') {
      ctx.faute(sous(c, 'traduction'), 'seul un nom propre peut ne pas se traduire');
    }
    if (presente(en, 'translitteration')) chaine(ctx, en['translitteration'], sous(c, 'translitteration'), { max: 120 });
    else if (translittere && categorie === 'nom_propre') {
      ctx.faute(sous(c, 'translitteration'), `la langue ${String(locale)} exige la translittération des noms propres`);
    }
    if (presente(en, 'note')) chaine(ctx, en['note'], sous(c, 'note'), { max: 200 });
    return terme;
  });
  if (termes) sansDoublon(ctx, termes, 'entrees');
  dateIso(ctx, o['majLe'], 'majLe');
  return conclure(ctx, o as unknown as Glossaire);
}

// ---------------------------------------------------------------------------
// Fichiers de contenu canon
// ---------------------------------------------------------------------------

/** Valide le catalogue d'unités embarqué : version, unités, unicité des silhouettes. */
export function validerCatalogueUnites(valeur: unknown): Resultat<CatalogueUnites> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['catalogueVersion', 'unites']);
  if (!o || !requis(ctx, o, '', ['catalogueVersion', 'unites'])) {
    return conclure(ctx, valeur as CatalogueUnites);
  }
  entier(ctx, o['catalogueVersion'], 'catalogueVersion', { min: 1 });
  const brutes = Array.isArray(o['unites']) ? (o['unites'] as unknown[]) : [];
  if (!Array.isArray(o['unites'])) ctx.faute('unites', 'un tableau de types d\'unité est attendu');
  if (brutes.length > 24) ctx.faute('unites', 'le catalogue actif est plafonné à 24 unités');
  const cles: string[] = [];
  const silhouettes: string[] = [];
  for (let i = 0; i < brutes.length; i += 1) {
    const chemin = sous('unites', i);
    const r = validerUnitType(brutes[i]);
    if (!r.ok) {
      for (const e of r.erreurs) ctx.faute(e.chemin === '' ? chemin : `${chemin}.${e.chemin}`, e.message);
      continue;
    }
    cles.push(r.valeur.cle);
    silhouettes.push(JSON.stringify(r.valeur.silhouette));
  }
  sansDoublon(ctx, cles, 'unites');
  sansDoublon(ctx, silhouettes, 'unites');
  for (const canon of CLES_UNITE_CANON) {
    if (!cles.includes(canon)) ctx.faute('unites', `unité canon absente du catalogue : ${canon}`);
  }
  return conclure(ctx, o as unknown as CatalogueUnites);
}

/** Valide le catalogue de terrains embarqué : les douze terrains, caractères uniques. */
export function validerCatalogueTerrains(valeur: unknown): Resultat<CatalogueTerrains> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['terrains']);
  if (!o || !requis(ctx, o, '', ['terrains'])) return conclure(ctx, valeur as CatalogueTerrains);
  const brutes = Array.isArray(o['terrains']) ? (o['terrains'] as unknown[]) : [];
  if (!Array.isArray(o['terrains'])) ctx.faute('terrains', 'un tableau de terrains est attendu');
  const cles: string[] = [];
  const cars: string[] = [];
  for (let i = 0; i < brutes.length; i += 1) {
    const chemin = sous('terrains', i);
    const r = validerTerrain(brutes[i]);
    if (!r.ok) {
      for (const e of r.erreurs) ctx.faute(e.chemin === '' ? chemin : `${chemin}.${e.chemin}`, e.message);
      continue;
    }
    cles.push(r.valeur.cle);
    cars.push(r.valeur.car);
  }
  sansDoublon(ctx, cles, 'terrains');
  sansDoublon(ctx, cars, 'terrains');
  for (const attendu of CLES_TERRAIN) {
    if (!cles.includes(attendu)) ctx.faute('terrains', `terrain canon absent : ${attendu}`);
  }
  return conclure(ctx, o as unknown as CatalogueTerrains);
}

/** Valide la table de dégâts : carrée, bornée, ordonnée comme la liste d'unités. */
export function validerTableDegats(valeur: unknown): Resultat<TableDegats> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['unites', 'matrice']);
  if (!o || !requis(ctx, o, '', ['unites', 'matrice'])) return conclure(ctx, valeur as TableDegats);
  const unites = tableau(ctx, o['unites'], 'unites', { min: 1, max: 24 }, (e, c) => cle(ctx, e, c));
  if (unites) sansDoublon(ctx, unites, 'unites');
  const cote = unites?.length ?? 0;
  const lignes = tableau(ctx, o['matrice'], 'matrice', { min: cote, max: cote }, (e, c) =>
    tableau(ctx, e, c, { min: cote, max: cote }, (n, cn) => entier(ctx, n, cn, { min: 0, max: 130 })));
  if (lignes) {
    for (let i = 0; i < lignes.length; i += 1) {
      const ligne = lignes[i] as number[];
      const diagonale = ligne[i];
      if (diagonale !== undefined && diagonale >= 100) {
        ctx.faute(sous(sous('matrice', i), i),
          'la diagonale reste sous 100 : une unité ne se met jamais hors jeu en un coup');
      }
    }
  }
  return conclure(ctx, o as unknown as TableDegats);
}

/** Valide le catalogue des dix archétypes (`01-bible.md` §6). */
export function validerCatalogueArchetypes(valeur: unknown): Resultat<CatalogueArchetypes> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['archetypes']);
  if (!o || !requis(ctx, o, '', ['archetypes'])) return conclure(ctx, valeur as CatalogueArchetypes);
  const cles = tableau(ctx, o['archetypes'], 'archetypes', { min: 10, max: 10 }, (e, c) => {
    const a = objet(ctx, e, c, ['cle', 'libelle', 'temperament', 'famillePouvoir', 'courbe', 'contrePar']);
    if (!a || !requis(ctx, a, c, ['cle', 'libelle', 'temperament', 'famillePouvoir', 'courbe', 'contrePar'])) {
      return undefined;
    }
    const k = enumeration(ctx, a['cle'], sous(c, 'cle'), ARCHETYPES);
    chaine(ctx, a['libelle'], sous(c, 'libelle'), { max: 40 });
    chaine(ctx, a['temperament'], sous(c, 'temperament'), { max: 160 });
    chaine(ctx, a['famillePouvoir'], sous(c, 'famillePouvoir'), { max: 240 });
    chaine(ctx, a['courbe'], sous(c, 'courbe'), { max: 120 });
    const contre = tableau(ctx, a['contrePar'], sous(c, 'contrePar'), { min: 1, max: 3 },
      (e2, c2) => enumeration(ctx, e2, c2, ARCHETYPES));
    if (contre && k !== undefined && contre.includes(k)) {
      ctx.faute(sous(c, 'contrePar'), 'un archétype ne se contre pas lui-même');
    }
    return k;
  });
  if (cles) {
    sansDoublon(ctx, cles, 'archetypes');
    for (const attendu of ARCHETYPES) {
      if (!cles.includes(attendu)) ctx.faute('archetypes', `archétype canon absent : ${attendu}`);
    }
  }
  return conclure(ctx, o as unknown as CatalogueArchetypes);
}

/** Valide le registre des mécaniques régionales : clés et hooks, sans implémentation. */
export function validerCatalogueMecaniques(valeur: unknown): Resultat<CatalogueMecaniques> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['mecaniques']);
  if (!o || !requis(ctx, o, '', ['mecaniques'])) return conclure(ctx, valeur as CatalogueMecaniques);
  const cles = tableau(ctx, o['mecaniques'], 'mecaniques', { min: 1, max: 64 }, (e, c) => {
    const m = objet(ctx, e, c,
      ['cle', 'nom', 'paysCode', 'regionCle', 'hookPrincipal', 'hookSecondaire', 'description']);
    if (!m || !requis(ctx, m, c,
      ['cle', 'nom', 'paysCode', 'regionCle', 'hookPrincipal', 'hookSecondaire', 'description'])) {
      return undefined;
    }
    const k = chaine(ctx, m['cle'], sous(c, 'cle'),
      { regex: REGEX_CLE_MECANIQUE, forme: 'clé de mécanique préfixée meca_' });
    chaine(ctx, m['nom'], sous(c, 'nom'), { max: 48 });
    codePays(ctx, m['paysCode'], sous(c, 'paysCode'));
    cle(ctx, m['regionCle'], sous(c, 'regionCle'));
    const principal = enumeration(ctx, m['hookPrincipal'], sous(c, 'hookPrincipal'), HOOKS_MECANIQUE);
    if (m['hookSecondaire'] !== null) {
      const secondaire = enumeration(ctx, m['hookSecondaire'], sous(c, 'hookSecondaire'), HOOKS_MECANIQUE);
      if (secondaire !== undefined && secondaire === principal) {
        ctx.faute(sous(c, 'hookSecondaire'), 'le hook secondaire diffère du hook principal');
      }
    }
    chaine(ctx, m['description'], sous(c, 'description'), { max: 240 });
    return k;
  });
  if (cles) sansDoublon(ctx, cles, 'mecaniques');
  return conclure(ctx, o as unknown as CatalogueMecaniques);
}

// ---------------------------------------------------------------------------
// Campagne : gabarits, conditions, conséquences, déblocages, fils, profil
// (`doc/13-campagne.md`, propriétaire)
// ---------------------------------------------------------------------------

const CLES_GABARIT_MISSION = [
  'cle', 'nom', 'intention', 'victoire', 'defaite', 'dureeVisee', 'journees',
  'cote', 'brouillardConseille', 'hooksNarratifs', 'interdit',
] as const;

/** Lit une fenêtre `{ min, max }` bornée, et refuse un intervalle vide. */
function fenetre(
  ctx: Contexte,
  v: unknown,
  chemin: string,
  bornes: { min: number; max: number },
): { min: number; max: number } | undefined {
  const o = objet(ctx, v, chemin, ['min', 'max']);
  if (!o || !requis(ctx, o, chemin, ['min', 'max'])) return undefined;
  const min = entier(ctx, o['min'], sous(chemin, 'min'), bornes);
  const max = entier(ctx, o['max'], sous(chemin, 'max'), bornes);
  if (min === undefined || max === undefined) return undefined;
  if (min > max) {
    ctx.faute(chemin, `intervalle vide : min ${min} au-dessus de max ${max}`);
    return undefined;
  }
  return { min, max };
}

/** Valide le catalogue des gabarits de mission (`content/gabarits-missions.json`). */
export function validerCatalogueGabarits(valeur: unknown): Resultat<CatalogueGabarits> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', ['gabarits']);
  if (!o || !requis(ctx, o, '', ['gabarits'])) return conclure(ctx, valeur as CatalogueGabarits);
  const cles = tableau(ctx, o['gabarits'], 'gabarits', { min: 1, max: CLES_GABARIT.length }, (e, c) => {
    const g = objet(ctx, e, c, CLES_GABARIT_MISSION);
    if (!g || !requis(ctx, g, c, CLES_GABARIT_MISSION)) return undefined;
    const k = enumeration(ctx, g['cle'], sous(c, 'cle'), CLES_GABARIT);
    chaine(ctx, g['nom'], sous(c, 'nom'), { max: 48 });
    chaine(ctx, g['intention'], sous(c, 'intention'), { max: 240 });
    chaine(ctx, g['interdit'], sous(c, 'interdit'), { max: 240 });
    const victoires = tableau(ctx, g['victoire'], sous(c, 'victoire'), { min: 1, max: 4 },
      (t, ct) => enumeration(ctx, t, ct, TYPES_OBJECTIF_VICTOIRE));
    if (victoires) sansDoublon(ctx, victoires, sous(c, 'victoire'));
    const defaites = tableau(ctx, g['defaite'], sous(c, 'defaite'), { min: 1, max: 4 },
      (t, ct) => enumeration(ctx, t, ct, TYPES_OBJECTIF_DEFAITE));
    if (defaites) sansDoublon(ctx, defaites, sous(c, 'defaite'));
    fenetre(ctx, g['dureeVisee'], sous(c, 'dureeVisee'), { min: DUREE_VISEE_MIN, max: DUREE_VISEE_MAX });
    const journees = fenetre(ctx, g['journees'], sous(c, 'journees'), { min: 5, max: 60 });
    fenetre(ctx, g['cote'], sous(c, 'cote'), { min: 6, max: 40 });
    booleen(ctx, g['brouillardConseille'], sous(c, 'brouillardConseille'));
    tableau(ctx, g['hooksNarratifs'], sous(c, 'hooksNarratifs'), { min: 2, max: 6 },
      (h, ch) => chaine(ctx, h, ch, { max: 120 }));
    // Un gabarit `survie` sans objectif `survivre` ne serait plus un gabarit `survie`.
    if (k === 'survie' && victoires && !victoires.includes('survivre')) {
      ctx.faute(sous(c, 'victoire'), "le gabarit 'survie' porte l'objectif 'survivre'");
    }
    if (k === 'escorte' && victoires && !victoires.includes('proteger')) {
      ctx.faute(sous(c, 'victoire'), "le gabarit 'escorte' porte l'objectif 'proteger'");
    }
    if (journees && k === 'exhibition' && journees.max > 15) {
      ctx.faute(sous(c, 'journees'), "une exhibition tient en quinze journées au plus (01-bible.md §4.7)");
    }
    return k;
  });
  if (cles) sansDoublon(ctx, cles, 'gabarits');
  return conclure(ctx, o as unknown as CatalogueGabarits);
}

/**
 * Lit une `Condition` composable, en bornant la profondeur d'imbrication.
 * Une condition est une **donnée** : aucune expression, aucun code, rien qui
 * demande à être interprété autrement que par `engine/deblocages.ts`.
 */
function condition(ctx: Contexte, v: unknown, chemin: string, profondeur = 1): Condition | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'un objet condition est attendu');
    return undefined;
  }
  const type = enumeration(ctx, v['type'], sous(chemin, 'type'), TYPES_CONDITION);
  if (type === undefined) return undefined;
  switch (type) {
    case 'flag': {
      const o = objet(ctx, v, chemin, ['type', 'cle']);
      if (!o || !requis(ctx, o, chemin, ['cle'])) return undefined;
      cleFlag(ctx, o['cle'], sous(chemin, 'cle'));
      return o as unknown as Condition;
    }
    case 'compteur': {
      const o = objet(ctx, v, chemin, ['type', 'cle', 'min']);
      if (!o || !requis(ctx, o, chemin, ['cle', 'min'])) return undefined;
      cleFlag(ctx, o['cle'], sous(chemin, 'cle'));
      entier(ctx, o['min'], sous(chemin, 'min'), { min: 1, max: 100 });
      return o as unknown as Condition;
    }
    case 'mode_fini': {
      const o = objet(ctx, v, chemin, ['type', 'mode']);
      if (!o || !requis(ctx, o, chemin, ['mode'])) return undefined;
      enumeration(ctx, o['mode'], sous(chemin, 'mode'), MODES);
      return o as unknown as Condition;
    }
    case 'date': {
      const o = objet(ctx, v, chemin, ['type', 'du', 'au']);
      if (!o) return undefined;
      if (!presente(o, 'du') && !presente(o, 'au')) {
        ctx.faute(chemin, "une condition 'date' porte au moins une borne, 'du' ou 'au'");
        return undefined;
      }
      const du = presente(o, 'du') ? dateIso(ctx, o['du'], sous(chemin, 'du')) : undefined;
      const au = presente(o, 'au') ? dateIso(ctx, o['au'], sous(chemin, 'au')) : undefined;
      if (du !== undefined && au !== undefined && du > au) {
        ctx.faute(chemin, 'fenêtre de dates vide : `du` est postérieure à `au`');
      }
      return o as unknown as Condition;
    }
    case 'pays_visite': {
      const o = objet(ctx, v, chemin, ['type', 'pays', 'combien']);
      if (!o || !requis(ctx, o, chemin, ['pays', 'combien'])) return undefined;
      const pays = tableau(ctx, o['pays'], sous(chemin, 'pays'), { min: 1, max: 24 },
        (p, cp) => codePays(ctx, p, cp));
      if (pays) sansDoublon(ctx, pays, sous(chemin, 'pays'));
      const combien = entier(ctx, o['combien'], sous(chemin, 'combien'), { min: 1, max: 24 });
      if (pays && combien !== undefined && combien > pays.length) {
        ctx.faute(sous(chemin, 'combien'), 'condition inatteignable : plus de pays exigés que listés');
      }
      return o as unknown as Condition;
    }
    case 'secret': {
      const o = objet(ctx, v, chemin, ['type', 'cle']);
      if (!o || !requis(ctx, o, chemin, ['cle'])) return undefined;
      cle(ctx, o['cle'], sous(chemin, 'cle'));
      return o as unknown as Condition;
    }
    case 'relation': {
      // Même forme que `pays_visite`, parce qu'elle répond à la même famille de
      // questions : « au moins deux alliées », « le Japon est-il allié ». C'est par
      // là qu'un départ de Nouvelle Ronde s'ouvre (`13-campagne.md` §3.5).
      const o = objet(ctx, v, chemin, ['type', 'pays', 'relation', 'combien']);
      if (!o || !requis(ctx, o, chemin, ['pays', 'relation', 'combien'])) return undefined;
      const pays = tableau(ctx, o['pays'], sous(chemin, 'pays'), { min: 1, max: 24 },
        (p, cp) => codePays(ctx, p, cp));
      if (pays) sansDoublon(ctx, pays, sous(chemin, 'pays'));
      enumeration(ctx, o['relation'], sous(chemin, 'relation'), RELATIONS_NATION);
      const combien = entier(ctx, o['combien'], sous(chemin, 'combien'), { min: 1, max: 24 });
      if (pays && combien !== undefined && combien > pays.length) {
        ctx.faute(sous(chemin, 'combien'), 'condition inatteignable : plus de pays exigés que listés');
      }
      return o as unknown as Condition;
    }
    case 'confiance': {
      // La confiance d'un général, montée en incarnant sa nation (`BRIEF.md`). Même
      // forme que `compteur`, bornes comprises : elle vaut 0 à `CONFIANCE_MAX`, et un
      // général absent du profil est à 0. À `CONFIANCE_MAX`, il devient co-commandant
      // à jauge entière et sa nation s'ouvre en départ de Nouvelle Ronde.
      const o = objet(ctx, v, chemin, ['type', 'commandantCle', 'min']);
      if (!o || !requis(ctx, o, chemin, ['commandantCle', 'min'])) return undefined;
      chaine(ctx, o['commandantCle'], sous(chemin, 'commandantCle'),
        { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
      entier(ctx, o['min'], sous(chemin, 'min'), { min: 1, max: CONFIANCE_MAX });
      return o as unknown as Condition;
    }
    case 'et':
    case 'ou': {
      const o = objet(ctx, v, chemin, ['type', 'conditions']);
      if (!o || !requis(ctx, o, chemin, ['conditions'])) return undefined;
      if (profondeur >= PROFONDEUR_CONDITION_MAX) {
        ctx.faute(chemin, `condition trop imbriquée : ${PROFONDEUR_CONDITION_MAX} niveaux au plus`);
        return undefined;
      }
      tableau(ctx, o['conditions'], sous(chemin, 'conditions'), { min: 2, max: 4 },
        (e, c) => condition(ctx, e, c, profondeur + 1));
      return o as unknown as Condition;
    }
  }
}

/** Valide une `Condition` isolée (`13-campagne.md` §8). */
export function validerCondition(valeur: unknown): Resultat<Condition> {
  const ctx = new Contexte();
  const lue = condition(ctx, valeur, '');
  return conclure(ctx, lue as Condition);
}

/** Lit une `Consequence` de la liste fermée du brief, avec ses paramètres bornés. */
function consequence(ctx: Contexte, v: unknown, chemin: string): Consequence | undefined {
  if (!estObjet(v)) {
    ctx.faute(chemin, 'un objet conséquence est attendu');
    return undefined;
  }
  const type = enumeration(ctx, v['type'], sous(chemin, 'type'), TYPES_CONSEQUENCE);
  if (type === undefined) return undefined;
  switch (type) {
    case 'variante_dialogue': {
      const o = objet(ctx, v, chemin, ['type', 'scenarioCle', 'varianteCle']);
      if (!o || !requis(ctx, o, chemin, ['scenarioCle', 'varianteCle'])) return undefined;
      cle(ctx, o['scenarioCle'], sous(chemin, 'scenarioCle'));
      cle(ctx, o['varianteCle'], sous(chemin, 'varianteCle'));
      return o as unknown as Consequence;
    }
    case 'co_commandant': {
      const o = objet(ctx, v, chemin, ['type', 'commandantCle']);
      if (!o || !requis(ctx, o, chemin, ['commandantCle'])) return undefined;
      chaine(ctx, o['commandantCle'], sous(chemin, 'commandantCle'),
        { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
      return o as unknown as Consequence;
    }
    case 'unite_offerte': {
      const o = objet(ctx, v, chemin, ['type', 'uniteCle', 'combien']);
      if (!o || !requis(ctx, o, chemin, ['uniteCle', 'combien'])) return undefined;
      cle(ctx, o['uniteCle'], sous(chemin, 'uniteCle'));
      entier(ctx, o['combien'], sous(chemin, 'combien'), BORNES_CONSEQUENCE.uniteOfferte);
      return o as unknown as Consequence;
    }
    case 'trace_carte': {
      const o = objet(ctx, v, chemin, ['type', 'paysCode', 'flagTrace']);
      if (!o || !requis(ctx, o, chemin, ['paysCode', 'flagTrace'])) return undefined;
      const pays = codePays(ctx, o['paysCode'], sous(chemin, 'paysCode'));
      const flag = cleFlag(ctx, o['flagTrace'], sous(chemin, 'flagTrace'));
      if (pays !== undefined && flag !== undefined && !flag.startsWith(`pays.${pays}.`)) {
        ctx.faute(sous(chemin, 'flagTrace'), `une trace de ${pays} porte un flag pays.${pays}.*`);
      }
      return o as unknown as Consequence;
    }
    case 'remise_production': {
      const o = objet(ctx, v, chemin, ['type', 'uniteCle', 'remise']);
      if (!o || !requis(ctx, o, chemin, ['uniteCle', 'remise'])) return undefined;
      cle(ctx, o['uniteCle'], sous(chemin, 'uniteCle'));
      nombre(ctx, o['remise'], sous(chemin, 'remise'), BORNES_CONSEQUENCE.remiseProduction);
      return o as unknown as Consequence;
    }
    case 'objectif_alternatif': {
      const o = objet(ctx, v, chemin, ['type', 'scenarioCle', 'objectif']);
      if (!o || !requis(ctx, o, chemin, ['scenarioCle', 'objectif'])) return undefined;
      cle(ctx, o['scenarioCle'], sous(chemin, 'scenarioCle'));
      objectifVictoire(ctx, o['objectif'], sous(chemin, 'objectif'));
      return o as unknown as Consequence;
    }
    case 'allie_acte_iii': {
      const o = objet(ctx, v, chemin, ['type', 'paysCode']);
      if (!o || !requis(ctx, o, chemin, ['paysCode'])) return undefined;
      codePays(ctx, o['paysCode'], sous(chemin, 'paysCode'));
      return o as unknown as Consequence;
    }
    case 'entree_carnet': {
      const o = objet(ctx, v, chemin, ['type', 'carnetCle']);
      if (!o || !requis(ctx, o, chemin, ['carnetCle'])) return undefined;
      cle(ctx, o['carnetCle'], sous(chemin, 'carnetCle'));
      return o as unknown as Consequence;
    }
    case 'deblocage': {
      const o = objet(ctx, v, chemin, ['type', 'deblocageCle']);
      if (!o || !requis(ctx, o, chemin, ['deblocageCle'])) return undefined;
      cle(ctx, o['deblocageCle'], sous(chemin, 'deblocageCle'));
      return o as unknown as Consequence;
    }
    case 'relation_nation': {
      // Bornée : un fil rallie ou fâche une nation, il ne la retire jamais de la
      // Ronde (le retrait vient de la campagne principale) et ne la remet jamais à
      // `neutre`. `RELATIONS_CONSEQUENCE` fait foi, et le refus est mécanique.
      const o = objet(ctx, v, chemin, ['type', 'paysCode', 'relation']);
      if (!o || !requis(ctx, o, chemin, ['paysCode', 'relation'])) return undefined;
      codePays(ctx, o['paysCode'], sous(chemin, 'paysCode'));
      enumeration(ctx, o['relation'], sous(chemin, 'relation'), RELATIONS_CONSEQUENCE);
      return o as unknown as Consequence;
    }
  }
}

/** Valide une `Consequence` isolée (`13-campagne.md` §5). */
export function validerConsequence(valeur: unknown): Resultat<Consequence> {
  const ctx = new Contexte();
  const lue = consequence(ctx, valeur, '');
  return conclure(ctx, lue as Consequence);
}

const CLES_DEBLOCAGE = ['cle', 'libelle', 'condition', 'recompense', 'cache'] as const;

/** Valide un `Deblocage` (`13-campagne.md` §8). */
export function validerDeblocage(valeur: unknown): Resultat<Deblocage> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_DEBLOCAGE);
  if (!o || !requis(ctx, o, '', CLES_DEBLOCAGE)) return conclure(ctx, valeur as Deblocage);
  cle(ctx, o['cle'], 'cle');
  chaine(ctx, o['libelle'], 'libelle', { max: 80 });
  condition(ctx, o['condition'], 'condition');
  booleen(ctx, o['cache'], 'cache');
  const r = objet(ctx, o['recompense'], 'recompense', ['type', 'ref']);
  if (r && requis(ctx, r, 'recompense', ['type', 'ref'])) {
    const type = enumeration(ctx, r['type'], 'recompense.type', TYPES_RECOMPENSE_DEBLOCAGE);
    if (type === 'general_secret') {
      chaine(ctx, r['ref'], 'recompense.ref',
        { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
    } else if (type === 'mode') {
      enumeration(ctx, r['ref'], 'recompense.ref', MODES);
    } else if (type === 'depart_nation') {
      // La Nouvelle Ronde s'ouvre sur une nation, pas sur une clé de contenu.
      codePays(ctx, r['ref'], 'recompense.ref');
    } else {
      cle(ctx, r['ref'], 'recompense.ref');
    }
  }
  return conclure(ctx, o as unknown as Deblocage);
}

const CLES_FIL = [
  ...CLES_ENVELOPPE, 'code', 'titre', 'arc', 'accroche', 'paysCode', 'acteMin',
  'missions', 'deblocage', 'consequences', 'flagsEcrits',
] as const;

/** Valide un `Fil` : 3 à 8 missions ordonnées, des conséquences bornées. */
export function validerFil(valeur: unknown): Resultat<Fil> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_FIL);
  if (!o) return conclure(ctx, valeur as Fil);
  enveloppe(ctx, o, '');
  requis(ctx, o, '', ['code', 'titre', 'arc', 'accroche', 'acteMin', 'missions',
    'deblocage', 'consequences', 'flagsEcrits']);

  cle(ctx, o['code'], 'code');
  chaine(ctx, o['titre'], 'titre', { max: 64 });
  chaine(ctx, o['arc'], 'arc', { min: 80, max: 900 });
  chaine(ctx, o['accroche'], 'accroche', { max: 160 });
  const paysCode = presente(o, 'paysCode') ? codePays(ctx, o['paysCode'], 'paysCode') : undefined;
  entier(ctx, o['acteMin'], 'acteMin', { min: 0, max: 3 });

  let precedent = 0;
  const scenarios: string[] = [];
  const etapes = tableau(ctx, o['missions'], 'missions', { min: 3, max: 8 }, (e, c) => {
    const m = objet(ctx, e, c, ['ordre', 'scenarioCle', 'gabarit', 'dureeVisee', 'titre']);
    if (!m || !requis(ctx, m, c, ['ordre', 'scenarioCle', 'gabarit', 'dureeVisee', 'titre'])) return undefined;
    const ordre = entier(ctx, m['ordre'], sous(c, 'ordre'), { min: 1, max: 8 });
    const scenarioCle = cle(ctx, m['scenarioCle'], sous(c, 'scenarioCle'));
    const gabarit = enumeration(ctx, m['gabarit'], sous(c, 'gabarit'), CLES_GABARIT);
    entier(ctx, m['dureeVisee'], sous(c, 'dureeVisee'), { min: DUREE_VISEE_MIN, max: DUREE_VISEE_MAX });
    chaine(ctx, m['titre'], sous(c, 'titre'), { max: 80 });
    if (ordre !== undefined) {
      if (ordre !== precedent + 1) {
        ctx.faute(sous(c, 'ordre'), `les étapes d'un fil se suivent sans trou : ${precedent + 1} attendu`);
      }
      precedent = ordre;
    }
    if (gabarit === 'exhibition') {
      ctx.faute(sous(c, 'gabarit'), "le gabarit 'exhibition' est celui de la Dépêche : un fil écrit des flags, une exhibition non");
    }
    if (scenarioCle !== undefined) scenarios.push(scenarioCle);
    return scenarioCle;
  });
  if (etapes) sansDoublon(ctx, scenarios, 'missions');

  condition(ctx, o['deblocage'], 'deblocage');
  const consequences = tableau(ctx, o['consequences'], 'consequences', { min: 1, max: 4 },
    (e, c) => consequence(ctx, e, c));
  if (consequences) sansDoublon(ctx, consequences, 'consequences');
  tableau(ctx, o['flagsEcrits'], 'flagsEcrits', { min: 1, max: 8 }, (e, c) => {
    const f = cleFlag(ctx, e, c);
    if (f === undefined) return undefined;
    if (f.startsWith('monde.depeche.')) {
      ctx.faute(c, "un fil n'écrit pas dans le domaine de la Dépêche (08-narration-choix.md §4.4)");
    }
    if (f.startsWith('monde.secret.')) {
      ctx.faute(c, 'un flag de secret est posé par un easter egg codé à la main, jamais par un fil');
    }
    if (paysCode !== undefined && f.startsWith('pays.') && !f.startsWith(`pays.${paysCode}.`)) {
      ctx.faute(c, `un fil ancré en ${paysCode} n'écrit que pays.${paysCode}.* ou monde.* ou cmd.*`);
    }
    return f;
  });
  return conclure(ctx, o as unknown as Fil);
}

/** Valide le catalogue des gabarits **et** la couverture des neuf clés canon. */
export function validerCatalogueGabaritsComplet(valeur: unknown): Resultat<CatalogueGabarits> {
  const resultat = validerCatalogueGabarits(valeur);
  if (!resultat.ok) return resultat;
  const ctx = new Contexte();
  const presents = new Set(resultat.valeur.gabarits.map((g) => g.cle));
  for (const k of CLES_GABARIT) {
    if (!presents.has(k)) ctx.faute('gabarits', `gabarit canon absent du catalogue : ${k}`);
  }
  return conclure(ctx, resultat.valeur);
}

const CLES_PROFIL = [
  'cle', 'paysDepart', 'mode', 'flags', 'deblocages', 'filsEnCours', 'filsFinis',
  'scenariosFinis', 'secretsTrouves', 'paysVisites', 'modesFinis', 'relations',
  'confiance', 'serieDepeches', 'catalogueVersion', 'chainesVersion', 'creeLe', 'majLe',
] as const;

/** Valide une sauvegarde de campagne (`13-campagne.md` §9). */
export function validerProfilCampagne(valeur: unknown): Resultat<ProfilCampagne> {
  const ctx = new Contexte();
  const o = objet(ctx, valeur, '', CLES_PROFIL);
  if (!o || !requis(ctx, o, '', CLES_PROFIL)) return conclure(ctx, valeur as ProfilCampagne);
  cle(ctx, o['cle'], 'cle');
  codePays(ctx, o['paysDepart'], 'paysDepart');
  enumeration(ctx, o['mode'], 'mode', MODES);

  const f = objet(ctx, o['flags'], 'flags', ['booleens', 'compteurs', 'journal']);
  if (f && requis(ctx, f, 'flags', ['booleens', 'compteurs', 'journal'])) {
    if (estObjet(f['booleens'])) {
      for (const [k, v] of Object.entries(f['booleens'])) {
        cleFlag(ctx, k, sous('flags.booleens', k));
        if (v !== true) ctx.faute(sous('flags.booleens', k), 'un flag booléen posé vaut true, et ne se retire jamais');
      }
    } else ctx.faute('flags.booleens', 'un objet est attendu');
    if (estObjet(f['compteurs'])) {
      for (const [k, v] of Object.entries(f['compteurs'])) {
        cleFlag(ctx, k, sous('flags.compteurs', k));
        entier(ctx, v, sous('flags.compteurs', k), { min: -3, max: 100 });
      }
    } else ctx.faute('flags.compteurs', 'un objet est attendu');
    tableau(ctx, f['journal'], 'flags.journal', { max: 400 }, (e, c) => {
      const j = objet(ctx, e, c, ['journee', 'scenarioCle', 'choixCle', 'optionCle', 'flagsEcrits']);
      if (!j || !requis(ctx, j, c, ['journee', 'scenarioCle', 'choixCle', 'optionCle', 'flagsEcrits'])) {
        return undefined;
      }
      entier(ctx, j['journee'], sous(c, 'journee'), { min: 0, max: 60 });
      cle(ctx, j['scenarioCle'], sous(c, 'scenarioCle'));
      cle(ctx, j['choixCle'], sous(c, 'choixCle'));
      cle(ctx, j['optionCle'], sous(c, 'optionCle'));
      tableau(ctx, j['flagsEcrits'], sous(c, 'flagsEcrits'), { max: 8 }, (g, cg) => cleFlag(ctx, g, cg));
      return true;
    });
  }

  for (const champ of ['deblocages', 'filsFinis', 'scenariosFinis', 'secretsTrouves'] as const) {
    const lues = tableau(ctx, o[champ], champ, { max: 400 }, (e, c) => cle(ctx, e, c));
    if (lues) sansDoublon(ctx, lues, champ);
  }
  const pays = tableau(ctx, o['paysVisites'], 'paysVisites', { max: 24 }, (e, c) => codePays(ctx, e, c));
  if (pays) sansDoublon(ctx, pays, 'paysVisites');
  const modes = tableau(ctx, o['modesFinis'], 'modesFinis', { max: MODES.length },
    (e, c) => enumeration(ctx, e, c, MODES));
  if (modes) sansDoublon(ctx, modes, 'modesFinis');

  // Les relations : un état par nation, et les deux bornes anti-blocage du brief.
  // Une nation absente est `neutre` ; le pays du joueur n'est pas une relation.
  const depart = typeof o['paysDepart'] === 'string' ? o['paysDepart'] : undefined;
  if (estObjet(o['relations'])) {
    const entrees = Object.entries(o['relations']);
    if (entrees.length > 24) {
      ctx.faute('relations', 'au plus vingt-quatre nations : la liste des relations est celle du canon');
    }
    let retirees = 0;
    for (const [k, v] of entrees) {
      const chemin = sous('relations', k);
      codePays(ctx, k, chemin);
      if (enumeration(ctx, v, chemin, RELATIONS_NATION) === 'retiree') retirees += 1;
      if (depart !== undefined && k === depart) {
        ctx.faute(chemin, "le pays de départ du joueur n'est pas une relation : c'est sa nation");
      }
    }
    if (retirees > BORNES_RELATIONS.retireesMax) {
      ctx.faute('relations',
        `au plus ${BORNES_RELATIONS.retireesMax} nations retirées par partie : au-delà, une fin devient inaccessible`);
    }
  } else ctx.faute('relations', 'un objet est attendu');

  // La confiance des généraux : 0 à trois, une entrée par général incarné. Un
  // général absent est à 0 (`BRIEF.md`, « Le joueur et le départ »).
  if (estObjet(o['confiance'])) {
    for (const [k, v] of Object.entries(o['confiance'])) {
      const chemin = sous('confiance', k);
      chaine(ctx, k, chemin, { regex: REGEX_CODE_COMMANDANT, forme: 'cmd_<prenom>_<nom>' });
      entier(ctx, v, chemin, { min: 0, max: CONFIANCE_MAX });
    }
  } else ctx.faute('confiance', 'un objet est attendu');

  const enCours = tableau(ctx, o['filsEnCours'], 'filsEnCours', { max: 8 }, (e, c) => {
    const fc = objet(ctx, e, c, ['filCle', 'etape']);
    if (!fc || !requis(ctx, fc, c, ['filCle', 'etape'])) return undefined;
    const k = cle(ctx, fc['filCle'], sous(c, 'filCle'));
    entier(ctx, fc['etape'], sous(c, 'etape'), { min: 1, max: 8 });
    return k;
  });
  if (enCours) sansDoublon(ctx, enCours, 'filsEnCours');
  const finis = Array.isArray(o['filsFinis']) ? o['filsFinis'] : [];
  if (enCours) {
    for (const k of enCours) {
      if (finis.includes(k)) ctx.faute('filsEnCours', `le fil ${k} est à la fois en cours et fini`);
    }
  }

  entier(ctx, o['serieDepeches'], 'serieDepeches', { min: 0, max: 4000 });
  entier(ctx, o['catalogueVersion'], 'catalogueVersion', { min: 1 });
  entier(ctx, o['chainesVersion'], 'chainesVersion', { min: 1 });
  dateIso(ctx, o['creeLe'], 'creeLe');
  dateIso(ctx, o['majLe'], 'majLe');
  return conclure(ctx, o as unknown as ProfilCampagne);
}
