/**
 * `POST /api/routines/traduction/soumettre` — la soumission d'un lot, acceptée ou
 * refusée **chaîne par chaîne** (`09-i18n.md` §8.3 et §8.4).
 *
 * Un lot n'est jamais accepté ou refusé en bloc : ce qui passe est enregistré, ce
 * qui ne passe pas revient dans la file du run suivant. Une traduction acceptée
 * passe `validee`, sauf si la langue est `en_preparation` et que la chaîne est
 * tirée dans l'échantillon humain — elle passe alors `brouillon` en attendant la
 * relecture. C'est le seul cas où une soumission conforme n'est pas immédiatement
 * validée.
 */

import { chaines, glossaires, localesReq, missions, traductions } from '@/db/requetes/index';
import { incrementerChainesVersion } from '@/serveur/cycle';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { BORNES_LOT, dansEchantillon, validerChaine, type RefusChaine } from '@/serveur/traduction';
import type { EntreeGlossaire, ScriptLocale } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const o = corps.valeur as Record<string, unknown>;

  const code = typeof o['locale'] === 'string' ? o['locale'].toLowerCase() : '';
  if (code === '') return erreur('locale_manquante', 422, 'le champ locale est obligatoire');
  if (code === 'fr') return erreur('locale_source', 422, 'on ne traduit jamais vers le français');

  const locale = await localesReq.locale(code);
  if (!locale) return erreur('locale_inconnue', 404, `la langue ${code} n’existe pas`);
  const glossaire = await glossaires.glossaire(code);
  if (!glossaire) return erreur('glossaire_absent', 409, `aucun glossaire pour ${code}`);

  const lot = o['traductions'];
  if (!Array.isArray(lot) || lot.length === 0) {
    return erreur('lot_vide', 422, 'traductions[] attendu');
  }
  if (lot.length > BORNES_LOT.max) {
    return erreur('lot_trop_grand', 422, `${BORNES_LOT.max} chaînes au plus par lot`);
  }

  const avant = await traductions.penurie(code);
  const accepte: { cle: string; statut: string }[] = [];
  const refuse: RefusChaine[] = [];

  const glossaireServi = {
    termesInterdits: glossaire.termesInterdits,
    entrees: glossaire.entrees as EntreeGlossaire[],
  };
  const echantillon = locale.statut === 'en_preparation' ? locale.echantillonHumain : 0;
  const runRef = typeof o['mission'] === 'string' ? (await missions.mission(o['mission']))?.runId ?? null : null;

  for (const brut of lot) {
    if (typeof brut !== 'object' || brut === null) {
      refuse.push({ cle: '(inconnue)', motif: 'source_modifiee', detail: 'entrée illisible' });
      continue;
    }
    const e = brut as Record<string, unknown>;
    const cle = typeof e['cle'] === 'string' ? e['cle'] : '';
    const source = cle === '' ? null : await chaines.chaine(cle);
    if (!source) {
      refuse.push({ cle: cle || '(inconnue)', motif: 'source_modifiee', detail: 'cette clé n’existe pas dans les chaînes source' });
      continue;
    }
    const propose = e['texte'];
    if (typeof propose !== 'string' && (typeof propose !== 'object' || propose === null)) {
      refuse.push({ cle, motif: 'pluriel_incomplet', detail: 'texte attendu : chaîne ou objet de catégories' });
      continue;
    }

    const decision = validerChaine({
      source: {
        cle: source.cle,
        texte: source.texte,
        longueurMax: source.longueurMax,
        placeholders: source.placeholders,
        pluriel: source.pluriel,
        sourceHash: source.sourceHash,
      },
      propose: propose as string | Record<string, string>,
      sourceHashRecu: typeof e['sourceHash'] === 'string' ? e['sourceHash'] : '',
      locale: code,
      script: locale.script as ScriptLocale,
      glossaire: glossaireServi,
    });

    if (!decision.ok) {
      refuse.push(decision.refus);
      continue;
    }
    const statut = dansEchantillon(cle, echantillon) ? 'brouillon' as const : 'validee' as const;
    await traductions.enregistrer({
      cle,
      locale: code,
      texte: decision.texte,
      sourceHash: source.sourceHash,
      versionChaine: source.versionChaine,
      statut,
      auteur: 'atlas_traduction',
      runRef,
    });
    accepte.push({ cle, statut });
  }

  // Une validation de traduction incrémente `chainesVersion` : c'est ce qui fige
  // les textes d'un scénario pour le rejeu (`09-i18n.md` §6).
  if (accepte.some((a) => a.statut === 'validee')) await incrementerChainesVersion();

  const apres = await traductions.penurie(code);
  return json({
    locale: code,
    accepte,
    refuse,
    couverture: { avant: avant.couverture, apres: apres.couverture },
    restant: apres.manquantes + apres.perimees,
  });
});
