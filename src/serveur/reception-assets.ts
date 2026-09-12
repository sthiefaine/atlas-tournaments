/** Réception technique et décisions humaines liées à une révision précise du lot. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetSpec } from '../assets/spec';
import { contratProduction, LIMITE_FICHIER, LIMITE_LOT } from '../assets/production';
import { baseRequise } from './chantier-assets';
import { controlerDepot, nomsAttendus, type FichierLivre } from './depot-modeles';

export const LIBELLES_RECEPTION = {
  a_produire: 'à produire', incomplet: 'livraison incomplète', refuse: 'correction requise',
  conforme: 'conforme techniquement', approuve: 'approuvé visuellement', integre: 'testé en jeu',
} as const;
export type EtatReception = keyof typeof LIBELLES_RECEPTION;
export interface ReceptionAsset {
  etat: EtatReception; revision: string | null; fichiers: string[]; octets: number;
  motifs: string[]; precedente: string | null; revue: { decision: 'approuve' | 'integre'; date: string; note: string } | null;
}
interface Revue { revision: string; decision: 'approuve' | 'integre'; date: string; note: string }
export const dossierModeles = () => path.resolve('public/assets/modeles');
export const dossierReceptions = () => path.resolve('assets/receptions');
const cache = new Map<string, { signature: string; resultat: ReceptionAsset }>();
export function lireLot(spec: AssetSpec, dossier = dossierModeles()): FichierLivre[] {
  return nomsAttendus(spec).filter((n) => existsSync(path.join(dossier, n))).map((nom) => ({ nom, octets: readFileSync(path.join(dossier, nom)) }));
}
export function lireBaseKit(spec: AssetSpec, dossier = dossierModeles()): FichierLivre[] {
  const id = baseRequise(spec); if (!id) return [];
  return spec.verification.lodRequis.map((lod) => `${id}_lod${lod}.glb`).filter((n) => existsSync(path.join(dossier, n))).map((nom) => ({ nom, octets: readFileSync(path.join(dossier, nom)) }));
}
export function revisionLot(spec: AssetSpec, fichiers: readonly FichierLivre[]): string {
  const h = createHash('sha256').update(JSON.stringify({ spec, production: contratProduction(spec) }));
  for (const f of [...fichiers].sort((a, b) => a.nom.localeCompare(b.nom))) h.update(f.nom).update('\0').update(createHash('sha256').update(f.octets).digest());
  return h.digest('hex');
}
function lireRevue(fichier: string): Revue | null {
  try {
    const r = JSON.parse(readFileSync(fichier, 'utf8')) as Revue;
    return /^[a-f0-9]{64}$/.test(r.revision) && ['approuve', 'integre'].includes(r.decision) && typeof r.date === 'string' && typeof r.note === 'string' ? r : null;
  } catch { return null; }
}
export function receptionAsset(spec: AssetSpec, dossier = dossierModeles(), suivi = dossierReceptions()): ReceptionAsset {
  const fichiers = nomsAttendus(spec).filter((n) => existsSync(path.join(dossier, n)));
  const revueChemin = path.join(suivi, spec.id, 'revue.json'), precedentChemin = path.join(suivi, spec.id, 'precedente.json');
  const statistiques = fichiers.map((n) => statSync(path.join(dossier, n)));
  const base = lireBaseKit(spec, dossier);
  const signature = JSON.stringify([spec, contratProduction(spec), base.map((f) => createHash('sha256').update(f.octets).digest('hex')), statistiques.map((s) => [s.size, s.mtimeMs, s.ctimeMs]),
    ...[revueChemin, precedentChemin].map((p) => existsSync(p) ? readFileSync(p, 'utf8') : '')]);
  const cle = `${dossier}:${suivi}:${spec.id}`, deja = cache.get(cle);
  if (deja?.signature === signature) return deja.resultat;
  let precedente: string | null = null;
  try { const p = JSON.parse(readFileSync(precedentChemin, 'utf8')) as { revision: string }; if (/^[a-f0-9]{64}$/.test(p.revision)) precedente = p.revision; } catch { /* Première réception. */ }
  const resultat: ReceptionAsset = { etat: 'a_produire', revision: null, fichiers, octets: statistiques.reduce((s, f) => s + f.size, 0), motifs: [], precedente, revue: null };
  if (fichiers.length) {
    if (resultat.octets > LIMITE_LOT || statistiques.some((s) => s.size > LIMITE_FICHIER)) {
      resultat.etat = 'refuse'; resultat.motifs = ['Limite de poids dépassée : 32 Mio par fichier, 96 Mio par lot.'];
    } else {
      const lot = lireLot(spec, dossier), verdict = controlerDepot(spec, lot, base);
      resultat.revision = revisionLot(spec, lot);
      const manque = verdict.lodManquants.length || verdict.motifs.some((m) => m.code === 'asset_texture_absente');
      resultat.etat = verdict.ok ? 'conforme' : manque ? 'incomplet' : 'refuse';
      resultat.motifs = verdict.motifs.map((m) => m.detail ?? m.code);
      const revue = lireRevue(revueChemin);
      if (verdict.ok && revue?.revision === resultat.revision) { resultat.etat = revue.decision; resultat.revue = revue; }
    }
  }
  cache.set(cle, { signature, resultat }); return resultat;
}
export function receptionsAssets(specs: readonly AssetSpec[], dossier = dossierModeles(), suivi = dossierReceptions()): Map<string, ReceptionAsset> {
  // Évite des milliers de stat() pour les fiches qui n'ont encore aucun fichier.
  const presents = new Set(existsSync(dossier) ? readdirSync(dossier) : []);
  return new Map(specs.map((spec) => [spec.id, nomsAttendus(spec).some((n) => presents.has(n)) ? receptionAsset(spec, dossier, suivi)
    : { etat: 'a_produire', revision: null, fichiers: [], octets: 0, motifs: [], precedente: null, revue: null }]));
}
export function enregistrerRevue(spec: AssetSpec, revision: string, decision: 'approuve' | 'integre', note: string, dossier = dossierModeles(), suivi = dossierReceptions()): void {
  const r = receptionAsset(spec, dossier, suivi);
  if (!revision || r.revision !== revision || !['conforme', 'approuve', 'integre'].includes(r.etat)) throw new Error('Le lot a changé ou ne passe pas les contrôles. Recharger sa fiche.');
  if (decision === 'integre' && !r.revue) throw new Error('Approuver visuellement cette révision avant de confirmer le test en jeu.');
  if (!note.trim() || note.length > 2000) throw new Error('Décrire la vérification effectuée (1 à 2000 caractères).');
  const d = path.join(suivi, spec.id); mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, 'revue.tmp'), JSON.stringify({ revision, decision, date: new Date().toISOString(), note: note.trim() }, null, 2) + '\n');
  renameSync(path.join(d, 'revue.tmp'), path.join(d, 'revue.json'));
}
/** Historique local borné à la dernière version, exclu de git et du trafic joueur. */
export function conserverPrecedente(spec: AssetSpec, dossier = dossierModeles(), suivi = dossierReceptions()): void {
  const lot = lireLot(spec, dossier); if (!lot.length) return;
  const revision = revisionLot(spec, lot), d = path.join(suivi, spec.id, revision);
  const parent = path.join(suivi, spec.id);
  if (existsSync(parent)) for (const nom of readdirSync(parent)) if (/^[a-f0-9]{64}$/.test(nom) && nom !== revision) rmSync(path.join(parent, nom), { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  for (const f of lot) writeFileSync(path.join(d, f.nom), f.octets);
  writeFileSync(path.join(suivi, spec.id, 'precedente.json'), JSON.stringify({ revision }) + '\n');
}
