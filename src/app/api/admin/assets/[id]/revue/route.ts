import { genererSpecs } from '@/assets/index';
import { exigerAdmin } from '@/serveur/auth';
import { enregistrerRevue } from '@/serveur/reception-assets';
import { erreur, json, lireJson } from '@/serveur/reponses';
export const runtime = 'nodejs';
export async function POST(req: Request, contexte: { params: Promise<{ id: string }> }) {
  const refus = exigerAdmin(req); if (refus) return refus;
  if (process.env.NODE_ENV === 'production') return erreur('revue_locale_seulement', 409, 'Enregistrer la revue en développement puis versionner assets/receptions.');
  const lu = await lireJson(req); if (!lu.ok) return lu.reponse;
  const { id } = await contexte.params, spec = genererSpecs().find((s) => s.id === id);
  if (!spec) return erreur('asset_inconnu', 404);
  const b = lu.valeur as { revision?: unknown; decision?: unknown; note?: unknown } | null;
  if (!b || typeof b.revision !== 'string' || typeof b.note !== 'string' || !['approuve', 'integre'].includes(String(b.decision))) return erreur('revue_invalide', 422);
  try { enregistrerRevue(spec, b.revision, b.decision as 'approuve' | 'integre', b.note); return json({ ok: true }); }
  catch (e) { return erreur('revue_refusee', 409, e instanceof Error ? e.message : String(e)); }
}
