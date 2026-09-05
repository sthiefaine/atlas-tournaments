/**
 * `POST /api/routines/cerveau/prompts` — dépôt d'une `PromptVersion` candidate
 * (`05-routines.md` §5.4).
 *
 * C'est ici que vivent les garde-fous contre la dérive :
 *
 *   - **verrous** : toute divergence des sections `<<<VERROU:…>>>` — modification,
 *     suppression, marqueur manquant ou ajouté — provoque un `422 VERROU_ROMPU`, la
 *     candidate n'est **pas enregistrée**, et l'incident est notifié ;
 *   - **une seule candidate par clé et par semaine** ;
 *   - **jamais de candidate pour `atlas_cerveau`** : le cerveau ne se réécrit pas.
 *
 * La candidate reste au statut `propose` : seule une promotion humaine la met en
 * service.
 */

import { prompts as requetesPrompts } from '@/db/requetes/index';
import { estClePrompt, estVerrouCasse, verifierVerrous, verrousCourants } from '@/serveur/prompts';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { CLES_PROMPT, type ClePrompt } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = routeRoutine(async (requete) => {
  const cle = new URL(requete.url).searchParams.get('cle');
  if (!estClePrompt(cle)) {
    return erreur('cle_inconnue', 400, `clé attendue parmi : ${CLES_PROMPT.join(', ')}`);
  }
  const courant = await requetesPrompts.prompteCourant(cle);
  if (!courant) return erreur('prompt_absent', 404, 'aucune version courante pour cette clé');
  return json({
    key: courant.cle,
    version: courant.version,
    statut: courant.statut,
    sections: Object.keys(courant.sections),
    historique: (await requetesPrompts.historique(cle, 20))
      .map((h) => ({ version: h.version, statut: h.statut, auteur: h.auteur, creeLe: h.createdAt })),
  });
});

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const brut = (corps.valeur as Record<string, unknown>)['candidate'];
  if (typeof brut !== 'object' || brut === null) {
    return erreur('charge_invalide', 400, '{"candidate": {…}} attendu');
  }
  const c = brut as Record<string, unknown>;

  const cle = c['cle'];
  if (typeof cle !== 'string' || !(CLES_PROMPT as readonly string[]).includes(cle)) {
    return erreur('cle_inconnue', 422, `clé attendue parmi : ${CLES_PROMPT.join(', ')}`);
  }
  if (cle === 'atlas_cerveau') {
    return erreur('cle_interdite', 422, 'le cerveau ne se réécrit pas : cette clé se modifie à la main');
  }
  const corpsCandidat = c['corps'];
  const justification = c['justification'];
  if (typeof corpsCandidat !== 'string' || corpsCandidat.trim().length < 200) {
    return erreur('corps_invalide', 422, 'le corps complet du prompt est attendu, sections verrouillées incluses');
  }
  if (typeof justification !== 'string' || justification.trim() === '') {
    return erreur('justification_manquante', 422, 'une justification est obligatoire pour une candidate');
  }

  const courants = await verrousCourants(cle as ClePrompt);
  if (!courants) return erreur('prompt_absent', 409, 'aucune version courante : impossible de comparer les verrous');

  const verdict = verifierVerrous(courants, corpsCandidat);
  if (estVerrouCasse(verdict)) {
    // La candidate n'est pas enregistrée. L'incident est visible en administration.
    console.warn(`[prompts] VERROU_ROMPU sur ${cle} : ${verdict.detail}`);
    return erreur('VERROU_ROMPU', 422, verdict.detail);
  }

  // Une seule candidate par clé et par semaine.
  const semaine = new Date(Date.now() - 7 * 86_400_000);
  if (await requetesPrompts.candidatesDepuis(cle as ClePrompt, semaine) >= 1) {
    return erreur('quota_hebdomadaire', 429, 'une seule candidate par clé et par semaine');
  }

  const version = (await requetesPrompts.versionMax(cle as ClePrompt)) + 1;
  const parent = c['parentVersion'];
  const diff = Array.isArray(c['diffResume'])
    ? (c['diffResume'] as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 12)
    : [];

  await requetesPrompts.insererVersion({
    cle: cle as ClePrompt,
    version,
    corps: corpsCandidat,
    sections: verdict.empreintes,
    auteur: 'atlas_cerveau',
    statut: 'propose',
    justification: justification.slice(0, 2000),
    diffResume: diff,
    parentVersion: Number.isInteger(parent) ? (parent as number) : null,
    valideParHumain: false,
  });

  return json({ cle, version, statut: 'propose', detail: 'en attente d’une promotion humaine' }, 201);
});
