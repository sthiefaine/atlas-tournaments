/**
 * Les échéances de la Dépêche du jour (`05-routines.md` §7.3 et §8.2).
 *
 * **Le fuseau est `Europe/Paris`, et c'est le seul du projet.** Les crons sont en
 * UTC, les échéances en heure locale : c'est la seule façon d'être juste, et le
 * changement d'heure est absorbé ici, une fois, plutôt que dans chaque route.
 *
 * Règle qui décide de tout le reste : **si une étape manque son heure, il n'y a pas
 * de mission ce jour-là.** Le serveur ne repousse jamais, ne rattrape jamais.
 */

/** Le fuseau des échéances. Le moteur, lui, ne connaît ni heure ni fuseau. */
export const FUSEAU = process.env['DEPECHE_TZ'] ?? 'Europe/Paris';

/** Les quatre échéances et l'heure de publication, en heure locale. */
export const HEURES = {
  proposition: '07:00',
  scenario: '09:30',
  certification: '11:00',
  validation: '17:00',
  miseEnLigne: process.env['DEPECHE_HEURE'] ?? '18:00',
} as const;

/** Nom d'une échéance de la journée. */
export type NomEcheance = keyof typeof HEURES;

/** Décalage du fuseau, en minutes, à un instant donné. */
function decalageMinutes(instant: Date, fuseau: string): number {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parties: Record<string, string> = {};
  for (const p of format.formatToParts(instant)) {
    if (p.type !== 'literal') parties[p.type] = p.value;
  }
  const heure = parties['hour'] === '24' ? '00' : parties['hour'];
  const local = Date.UTC(
    Number(parties['year']), Number(parties['month']) - 1, Number(parties['day']),
    Number(heure), Number(parties['minute']), Number(parties['second']),
  );
  return (local - instant.getTime()) / 60_000;
}

/**
 * L'instant UTC correspondant à une heure murale d'un jour donné dans le fuseau.
 * Deux passes suffisent : la première donne le décalage approché, la seconde le
 * corrige quand on tombe pile sur un changement d'heure.
 */
export function instantLocal(jour: string, heureLocale: string, fuseau = FUSEAU): Date {
  const naif = Date.parse(`${jour}T${heureLocale}:00Z`);
  if (Number.isNaN(naif)) throw new Error(`heure invalide : ${jour} ${heureLocale}`);
  let instant = new Date(naif - decalageMinutes(new Date(naif), fuseau) * 60_000);
  instant = new Date(naif - decalageMinutes(instant, fuseau) * 60_000);
  return instant;
}

/** L'instant d'une échéance nommée, pour un jour donné. */
export function echeance(jour: string, nom: NomEcheance, fuseau = FUSEAU): Date {
  return instantLocal(jour, HEURES[nom], fuseau);
}

/** Vrai si l'échéance est passée. C'est le seul test qui décide d'une journée blanche. */
export function passee(jour: string, nom: NomEcheance, maintenant = new Date(), fuseau = FUSEAU): boolean {
  return maintenant.getTime() >= echeance(jour, nom, fuseau).getTime();
}

/** Le jour courant dans le fuseau des échéances, en ISO. */
export function jourLocal(maintenant = new Date(), fuseau = FUSEAU): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return f.format(maintenant);
}

/** Les étapes de la journée, dans l'ordre, pour l'affichage de l'administration. */
export const ETAPES: readonly { nom: NomEcheance; libelle: string; acteur: string }[] = [
  { nom: 'proposition', libelle: 'Proposition de l’événement', acteur: 'atlas_cerveau' },
  { nom: 'scenario', libelle: 'Scénario', acteur: 'atlas_map' },
  { nom: 'certification', libelle: 'Certification', acteur: 'atlas_controle' },
  { nom: 'validation', libelle: 'Validation humaine', acteur: 'humain' },
  { nom: 'miseEnLigne', libelle: 'Mise en ligne', acteur: 'serveur' },
];

/** Temps restant avant une échéance, en minutes ; négatif si elle est passée. */
export function minutesRestantes(jour: string, nom: NomEcheance, maintenant = new Date()): number {
  return Math.round((echeance(jour, nom).getTime() - maintenant.getTime()) / 60_000);
}
