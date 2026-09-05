/**
 * `PATCH /api/routines/map/cartes/{map_id}` — le commentaire d'aperçu, **une
 * seule itération** (`05-routines.md` §3.3).
 *
 * Le serveur régénère avec les ajustements, renvoie le nouvel aperçu et **ferme la
 * mission**. Un second `PATCH` est rejeté en `409 ITERATION_EPUISEE`. Si la routine
 * est satisfaite du premier aperçu, elle envoie `{"commentaire":"conforme",
 * "ajustements":null}` — cet appel est obligatoire, c'est la clôture explicite.
 */

import { cartes } from '@/db/requetes/index';
import { generateurCourant, graineDe } from '@/serveur/generation';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { validerParametresCarte } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  requete: Request,
  contexte: { params: Promise<{ map_id: string }> },
): Promise<Response> {
  const { map_id: mapId } = await contexte.params;
  return routeRoutine(async (req) => {
    const ligne = await cartes.carte(mapId);
    if (!ligne) return erreur('carte_inconnue', 404, 'cette carte n’existe pas');
    if (ligne.iterations >= 1) {
      return erreur('ITERATION_EPUISEE', 409, 'une seule itération d’aperçu par carte, non négociable');
    }

    const corps = await lireJson(req);
    if (!corps.ok) return corps.reponse;
    const o = corps.valeur as Record<string, unknown>;
    const commentaire = typeof o['commentaire'] === 'string' ? o['commentaire'].slice(0, 400) : '';
    if (commentaire === '') {
      return erreur('commentaire_manquant', 422, 'un commentaire d’une à trois phrases est attendu');
    }
    const ajustements = o['ajustements'];

    // Clôture sans ajustement : l'aperçu convenait.
    if (ajustements === null || ajustements === undefined) {
      await cartes.consommerIteration(mapId, { ...(ligne.apercu ?? { ascii: '', legende: {}, mesures: {} }), commentaire }, ligne.graine);
      return json({ statut: 'brouillon', map_id: mapId, apercu: ligne.apercu, mission: 'close' });
    }

    // Ajustement : le serveur régénère avec une nouvelle graine.
    const fusion = { ...ligne.parametres, ...(ajustements as Record<string, unknown>) };
    const valides = validerParametresCarte(fusion);
    if (!valides.ok) {
      return erreur('schema_invalide', 422, 'ajustements refusés',
        valides.erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`));
    }
    const graine = graineDe(`${ligne.code}:2`);
    const produit = await generateurCourant().generer(valides.valeur, graine);
    const consomme = await cartes.consommerIteration(mapId, { ...produit.apercu, commentaire }, graine);
    if (!consomme) return erreur('ITERATION_EPUISEE', 409, 'itération déjà consommée');
    return json({ statut: 'brouillon', map_id: mapId, graine, apercu: produit.apercu, mission: 'close' });
  })(requete);
}
