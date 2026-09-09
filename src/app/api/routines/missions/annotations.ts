/** Les annotations de travail n'ont aucun droit sur le contenu d'une mission. */
export const CLES_ANNOTATIONS = ['commentaire', 'note', 'confiance'] as const;
export type AnnotationsMission = {
  commentaire?: string | null;
  note?: string | null;
  confiance?: number | null;
};

export function validerAnnotations(valeur: unknown, remplacement: boolean):
  | { ok: true; valeur: AnnotationsMission }
  | { ok: false; chemins: string[] } {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    return { ok: false, chemins: ['(racine) : objet attendu'] };
  }
  const objet = valeur as Record<string, unknown>;
  const chemins = Object.keys(objet)
    .filter((cle) => !(CLES_ANNOTATIONS as readonly string[]).includes(cle))
    .map((cle) => `${cle} : champ interdit`);
  if (Object.keys(objet).length === 0) chemins.push('(racine) : annotation attendue');
  for (const cle of CLES_ANNOTATIONS) {
    if (!Object.hasOwn(objet, cle)) {
      if (remplacement) chemins.push(`${cle} : requis pour PUT (null pour effacer)`);
      continue;
    }
    const v = objet[cle];
    if (v === null) continue;
    if (cle === 'confiance') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
        chemins.push('confiance : nombre fini entre 0 et 1 attendu');
      }
    } else if (typeof v !== 'string' || v.length > 2000) {
      chemins.push(`${cle} : texte de 2000 caractères au plus attendu`);
    }
  }
  return chemins.length > 0 ? { ok: false, chemins } : { ok: true, valeur: objet as AnnotationsMission };
}
