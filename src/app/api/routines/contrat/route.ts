/** Découverte du protocole sans réservation de mission ni accès à PostgreSQL. */
import { exigerRoutine } from '@/serveur/auth';
import { json } from '@/serveur/reponses';
import { CLES_PROMPT } from '@/schemas/index';
import { DEFAULT_PROMPT_VERSION } from '@/serveur/prompts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(requete: Request): Promise<Response> {
  const refus = exigerRoutine(requete);
  if (refus) return refus;
  return json({
    version: 2,
    versionPromptsReference: DEFAULT_PROMPT_VERSION,
    routines: CLES_PROMPT,
    execution: { cibleDemandee: 'Claude Sonnet 5', identifiantModele: null, configuration: 'opérateur' },
    endpoints: [
      { methode: 'GET', chemin: '/api/routines/map/conception?scenario={cle}', effet: 'lire le contrat de conception et son prompt, sans réservation' },
      { methode: 'POST', chemin: '/api/routines/map/conception', effet: 'générer, corriger et simuler des brouillons ; aucune publication' },
      { methode: 'GET', chemin: '/api/routines/bible/personnages?acte={0..3}', effet: 'lire les biographies et faits révélables à cet acte' },
      { methode: 'GET', chemin: '/api/routines/contrat', effet: 'lire les capacités sans réserver' },
      { methode: 'GET', chemin: '/api/routines/missions?routine={cle}', effet: 'réserver la file et lire le prompt du run' },
      { methode: 'GET', chemin: '/api/routines/missions/{id}', effet: 'lire le contexte' },
      { methode: 'POST', chemin: '/api/routines/missions/{id}/soumission', effet: 'soumettre le contenu au validateur' },
      { methode: 'PUT', chemin: '/api/routines/missions/{id}', effet: 'remplacer commentaire, note et confiance ; null efface' },
      { methode: 'PATCH', chemin: '/api/routines/missions/{id}', effet: 'modifier certaines annotations' },
      { methode: 'DELETE', chemin: '/api/routines/missions/{id}/reservation', effet: 'rendre une réservation' },
      { methode: 'DELETE', chemin: '/api/routines/cerveau/memoire/{cle}', effet: 'archiver une mémoire' },
    ],
    publicationAutomatique: false,
    suppressionPhysique: false,
    nouveautesNarratives: 'Seuls les champs des schémas servis peuvent être soumis ; aucune capacité moteur ne se déduit du prompt.',
  });
}
