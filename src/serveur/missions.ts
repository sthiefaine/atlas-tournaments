/**
 * La file de missions (`05-routines.md` §1.5, §1.9, §1.10, §8.2).
 *
 * Une routine ne devine jamais sa mission : elle la demande, et le serveur la lui
 * sert **déjà triée**. Trois choses vivent ici :
 *
 *   1. le tri — la Dépêche passe devant tout, quelle que soit l'ancienneté du reste ;
 *   2. la reprise — une mission ouverte non soumise depuis moins de 30 minutes est
 *      rendue telle quelle, avec le même identifiant ; au-delà elle retourne en file ;
 *   3. `apprise` — les reproches mesurés des 30 derniers jours, huit au plus.
 *
 * Les fonctions de décision sont pures : elles se testent sans base.
 */

import { missions as requetesMissions, reviews as requetesReviews } from '../db/requetes/index';
import type { CibleReview, ClePrompt } from '../schemas/index';

/** Fenêtre de reprise d'une mission ouverte, en minutes. */
export const FENETRE_REPRISE_MIN = 30;

/** Priorités de file : plus petit passe devant. */
export const PRIORITE = {
  /** La Dépêche du jour : elle porte une heure limite, elle passe devant tout. */
  depeche: 0,
  /** Le contrôle d'un objet fraîchement produit : le goulot du pipeline. */
  controle: 10,
  /** Les pays phares et la France : la priorité de file du canon. */
  phare: 20,
  /** Le fond de file de campagne. */
  fond: 100,
} as const;

/** Bornes de missions par run, routine par routine (`05-routines.md` §7.1). */
export const BORNES_MISSIONS: Record<ClePrompt, number> = {
  atlas_lore: 6,
  atlas_map: 8,
  atlas_controle: 12,
  atlas_cerveau: 4,
  atlas_traduction: 1,
};

/** Une mission candidate, avant qu'elle n'existe en base. */
export interface CandidatMission {
  kind: string;
  cibleType: string;
  cibleCle: string;
  priorite: number;
  echeance?: Date | null;
  contexte?: Record<string, unknown>;
}

/** Une mission telle qu'elle part dans l'enveloppe `GET /missions`. */
export interface MissionServie {
  id: string;
  kind: string;
  cible: { type: string; cle: string };
  ouverte_depuis: string;
  echeance?: string;
  promptUrl: string;
  submitUrl: string;
  apprise: string[];
}

/** L'enveloppe commune à toutes les routines. Une routine n'a qu'un format à connaître. */
export interface EnveloppeMissions {
  key: ClePrompt;
  version: number;
  body: string;
  count: number;
  missions: MissionServie[];
}

// ---------------------------------------------------------------------------
// Tri et reprise — pur
// ---------------------------------------------------------------------------

/** Ce qu'il faut savoir d'une mission ouverte pour décider de son sort. */
export interface MissionOuverte {
  id: string;
  priorite: number;
  ouverteDepuis: Date;
  echeance: Date | null;
}

/**
 * Le tri de la file : priorité d'abord, ancienneté ensuite. Une mission à
 * échéance passe devant une mission de même priorité sans échéance.
 */
export function trierFile<T extends MissionOuverte>(missions: readonly T[]): T[] {
  return [...missions].sort((a, b) => {
    if (a.priorite !== b.priorite) return a.priorite - b.priorite;
    if (a.echeance && b.echeance) return a.echeance.getTime() - b.echeance.getTime();
    if (a.echeance) return -1;
    if (b.echeance) return 1;
    return a.ouverteDepuis.getTime() - b.ouverteDepuis.getTime();
  });
}

/**
 * Une mission ouverte depuis moins de 30 minutes est reprise telle quelle : un
 * run coupé au milieu ne perd rien et ne duplique rien.
 */
export function reprisePossible(mission: MissionOuverte, maintenant = new Date()): boolean {
  const age = maintenant.getTime() - mission.ouverteDepuis.getTime();
  return age < FENETRE_REPRISE_MIN * 60_000;
}

/**
 * Une mission à échéance dépassée ne se traite pas : elle se rend, et le jour
 * reste blanc. Aucun report, aucun rattrapage.
 */
export function echeanceDepassee(mission: MissionOuverte, maintenant = new Date()): boolean {
  return mission.echeance !== null && mission.echeance.getTime() <= maintenant.getTime();
}

/** Un motif de rejet agrégé, tel qu'il sort de `reviews`. */
export interface MotifAgrege {
  code: string;
  n: number;
  mesure: Record<string, number> | null;
}

/**
 * Construit le champ `apprise` : huit phrases au plus, triées par fréquence
 * décroissante, chacune adossée à un code de motif et, quand elle existe, à la
 * mesure qui l'a déclenchée — « avantage_premier_joueur ×3 (0,62) » plutôt qu'un
 * reproche sans chiffre.
 */
export function construireApprise(motifs: readonly MotifAgrege[], jours = 30): string[] {
  return [...motifs]
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    .map((m) => {
      const chiffres = m.mesure
        ? Object.entries(m.mesure)
          .map(([nom, valeur]) => `${nom} ${String(valeur).replace('.', ',')}`)
          .join(', ')
        : '';
      return chiffres
        ? `${m.code} ×${m.n} (${jours} j, ${chiffres})`
        : `${m.code} ×${m.n} (${jours} j)`;
    });
}

/** Les cibles de review qui alimentent l'`apprise` de chaque routine. */
export const CIBLES_PAR_ROUTINE: Record<ClePrompt, CibleReview[]> = {
  atlas_lore: ['commandant', 'pays', 'region', 'scenario'],
  atlas_map: ['carte', 'scenario'],
  atlas_controle: [],
  atlas_cerveau: ['evenement', 'unite'],
  atlas_traduction: [],
};

// ---------------------------------------------------------------------------
// Construction de la file — avec base
// ---------------------------------------------------------------------------

/** Options de `fileDeMissions`. */
export interface OptionsFile {
  /** `&neuf=1` : force des missions neuves, réservé au débogage manuel. */
  neuf?: boolean;
  /** Borne du nombre de missions rendues. */
  limite?: number;
  /** Ne rendre que la file prioritaire de la Dépêche. */
  prioriteDepeche?: boolean;
  /** Base de construction des URL absolues. */
  base: string;
}

/** Habille une mission de base en mission servie. */
export function habiller(
  ligne: { id: string; kind: string; cibleType: string; cibleCle: string; ouverteDepuis: Date; echeance: Date | null },
  apprise: string[],
  base: string,
): MissionServie {
  const url = `${base}/api/routines/missions/${ligne.id}`;
  return {
    id: ligne.id,
    kind: ligne.kind,
    cible: { type: ligne.cibleType, cle: ligne.cibleCle },
    ouverte_depuis: ligne.ouverteDepuis.toISOString(),
    ...(ligne.echeance ? { echeance: ligne.echeance.toISOString() } : {}),
    promptUrl: url,
    submitUrl: `${url}/soumission`,
    apprise,
  };
}

/**
 * Ouvre les missions candidates qui n'existent pas encore. L'index unique sur
 * (routine, cible) en statut `ouverte` fait le reste : une cible déjà réservée
 * ne produit pas de doublon, même en cas de course entre deux runs.
 */
export async function ouvrirCandidats(
  routine: ClePrompt,
  candidats: readonly CandidatMission[],
  runId: string | null,
): Promise<number> {
  let ouvertes = 0;
  for (const c of candidats) {
    const ligne = await requetesMissions.ouvrirMission({
      routine,
      kind: c.kind,
      cibleType: c.cibleType,
      cibleCle: c.cibleCle,
      priorite: c.priorite,
      echeance: c.echeance ?? null,
      contexte: c.contexte ?? {},
      runId,
    });
    if (ligne) ouvertes += 1;
  }
  return ouvertes;
}

/**
 * Construit la file d'une routine : expire ce qui doit l'être, ouvre les
 * candidats, trie, habille et borne.
 */
export async function fileDeMissions(
  routine: ClePrompt,
  candidats: readonly CandidatMission[],
  options: OptionsFile,
  runId: string | null,
): Promise<MissionServie[]> {
  // 1. Les réservations trop vieilles retournent dans la file ; les échéances
  //    dépassées ferment la mission sans rien reporter.
  await requetesMissions.expirerReservations(FENETRE_REPRISE_MIN);
  await requetesMissions.expirerEcheances();

  // 2. `&neuf=1` rend les missions encore ouvertes avant d'en attribuer de neuves.
  if (options.neuf) {
    const ouvertes = await requetesMissions.missionsOuvertes(routine, 50);
    for (const m of ouvertes) await requetesMissions.clore(m.id, 'rendue');
  }

  await ouvrirCandidats(routine, candidats, runId);

  const limite = options.limite ?? BORNES_MISSIONS[routine];
  const lignes = await requetesMissions.missionsOuvertes(routine, limite * 3);
  const retenues = trierFile(lignes.map((l) => ({
    ...l,
    ouverteDepuis: l.ouverteDepuis,
    echeance: l.echeance,
  })))
    .filter((l) => (options.prioriteDepeche ? l.priorite === PRIORITE.depeche : true))
    .slice(0, limite);

  const cibles = CIBLES_PAR_ROUTINE[routine];
  const apprise = cibles.length > 0
    ? construireApprise(await requetesReviews.motifsRecents(cibles, 30))
    : [];

  return retenues.map((l) => habiller(l, apprise, options.base));
}

/** L'URL de base du site, en préférant `SITE_URL` à ce que dit la requête. */
export function baseDuSite(requete: Request): string {
  const configuree = process.env['SITE_URL'];
  if (configuree) return configuree.replace(/\/+$/, '');
  const url = new URL(requete.url);
  return `${url.protocol}//${url.host}`;
}
