/**
 * `POST /api/admin/actions` — les décisions humaines de l'administration.
 *
 * Toutes passent par `serveur/cycle.ts` : c'est lui qui dit qui a le droit de faire
 * quoi. Une action inconnue, un acteur non autorisé ou une transition impossible
 * sont refusés ici et pas ailleurs. La réponse est une redirection : pas une ligne
 * de JavaScript client.
 */

import {
  cartes, commandants, communs, depeches, evenements, localesReq, pays, scenarios,
  traductions, unites,
} from '@/db/requetes/index';
import { sessionDe } from '@/serveur/auth';
import {
  catalogueSature, incrementerCatalogueVersion, JOURS_ESSAI, transitionAutorisee,
  transitionUniteAutorisee,
} from '@/serveur/cycle';
import { promouvoir } from '@/serveur/prompts';
import { prompts as requetesPrompts } from '@/db/requetes/index';
import { baseConfiguree } from '@/db/client';
import { CLES_PROMPT, STATUTS_UNITE, type ClePrompt, type Statut, type StatutUnite } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function retour(vers: string, message: string): Response {
  const url = `${vers}${vers.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`;
  return new Response(null, { status: 303, headers: { location: url, 'cache-control': 'no-store' } });
}

/** Statut courant d'une cible, quel que soit son type. */
async function statutDe(type: string, cle: string): Promise<Statut | null> {
  switch (type) {
    case 'carte': return (await cartes.carteParCode(cle))?.statut ?? null;
    case 'scenario': return (await scenarios.scenario(cle))?.statut ?? null;
    case 'commandant': return (await commandants.commandant(cle))?.statut ?? null;
    case 'pays': return (await pays.pays(cle))?.statut ?? null;
    case 'evenement': return (await evenements.evenement(cle))?.statut ?? null;
    case 'unite': return (await unites.unite(cle))?.statutCycle ?? null;
    default: return null;
  }
}

/** Applique un statut à une cible, quel que soit son type. */
async function poserStatut(type: string, cle: string, statut: Statut): Promise<void> {
  switch (type) {
    case 'carte': {
      const c = await cartes.carteParCode(cle);
      if (c) await cartes.changerStatut(c.id, statut);
      break;
    }
    case 'scenario': await scenarios.changerStatut(cle, statut); break;
    case 'commandant': await commandants.changerStatut(cle, statut); break;
    case 'pays': await pays.changerStatut(cle, statut); break;
    case 'evenement': await evenements.changerStatut(cle, statut, statut === 'en_ligne'); break;
    case 'unite': await unites.changerCycle(cle, statut); break;
    default: break;
  }
}

export async function POST(requete: Request): Promise<Response> {
  if (!sessionDe(requete)) return retour('/admin/login', 'Session expirée.');
  if (!baseConfiguree()) return retour('/admin', 'Base de données injoignable.');

  const f = await requete.formData();
  const action = String(f.get('action') ?? '');
  const retourVers = String(f.get('retour') ?? '/admin');

  try {
    switch (action) {
      case 'mettre_en_ligne':
      case 'renvoyer':
      case 'ecarter':
      case 'annuler_rejet': {
        const type = String(f.get('type') ?? '');
        const cle = String(f.get('cle') ?? '');
        const courant = await statutDe(type, cle);
        if (courant === null) return retour(retourVers, 'Objet introuvable.');
        const vers: Statut = action === 'mettre_en_ligne' ? 'en_ligne'
          : action === 'ecarter' ? 'retire'
            : 'brouillon';
        const decision = transitionAutorisee(courant, vers, 'humain');
        if (!decision.ok) return retour(retourVers, `Refusé : ${decision.detail}`);
        await poserStatut(type, cle, vers);
        return retour(retourVers, `${cle} → ${vers}.`);
      }

      case 'promouvoir_prompt': {
        const cle = String(f.get('cle') ?? '');
        const version = Number(f.get('version'));
        if (!(CLES_PROMPT as readonly string[]).includes(cle) || !Number.isInteger(version)) {
          return retour(retourVers, 'Clé ou version invalide.');
        }
        const ok = await promouvoir(cle as ClePrompt, version);
        return retour(retourVers, ok ? `${cle} v${version} est courant.` : 'Version introuvable.');
      }

      case 'rejeter_prompt': {
        const cle = String(f.get('cle') ?? '');
        const version = Number(f.get('version'));
        const motif = String(f.get('motif') ?? '').slice(0, 200);
        if (!(CLES_PROMPT as readonly string[]).includes(cle) || !Number.isInteger(version) || motif === '') {
          return retour(retourVers, 'Clé, version ou motif manquant.');
        }
        const ok = await requetesPrompts.rejeterCandidate(cle as ClePrompt, version, motif);
        return retour(retourVers, ok ? 'Candidate écartée.' : 'Candidate introuvable.');
      }

      case 'statut_unite': {
        const cle = String(f.get('cle') ?? '');
        const brut = String(f.get('statut') ?? '');
        if (!(STATUTS_UNITE as readonly string[]).includes(brut)) return retour(retourVers, 'Statut inconnu.');
        const ligne = await unites.unite(cle);
        if (!ligne) return retour(retourVers, 'Unité introuvable.');
        const decision = transitionUniteAutorisee(ligne.statut, brut as StatutUnite, ligne.statutCycle, 'humain');
        if (!decision.ok) return retour(retourVers, `Refusé : ${decision.detail}`);
        if (brut === 'essai' && await catalogueSature()) {
          return retour(retourVers, 'Catalogue plein : 24 unités actives au plus.');
        }
        const version = await incrementerCatalogueVersion();
        const jour = communs.jourIso();
        await unites.changerStatutCatalogue({
          cle,
          statut: brut as StatutUnite,
          catalogueVersion: version,
          ...(brut === 'essai'
            ? { essaiJusquAu: communs.ajouterJours(jour, JOURS_ESSAI), statutCycle: 'en_ligne' as const }
            : {}),
          ...(brut === 'homologuee' ? { homologueeLe: jour } : {}),
        });
        return retour(retourVers, `${cle} → ${brut} (catalogueVersion ${version}).`);
      }

      case 'valider_depeche': {
        const jour = String(f.get('jour') ?? '');
        const d = await depeches.depeche(jour);
        if (!d) return retour(retourVers, 'Aucune dépêche ce jour-là.');
        const decision = transitionAutorisee(d.statut, 'valide', 'humain');
        if (!decision.ok && d.statut !== 'valide') return retour(retourVers, `Refusé : ${decision.ok ? '' : decision.detail}`);
        await depeches.armer(jour, 'admin');
        return retour(retourVers, `Dépêche du ${jour} armée pour 18 h 00.`);
      }

      case 'refuser_depeche': {
        const jour = String(f.get('jour') ?? '');
        const motif = String(f.get('motif') ?? '').slice(0, 200);
        if (motif === '') return retour(retourVers, 'Un refus porte toujours un motif.');
        const ok = await depeches.refuser(jour, 'admin', motif);
        return retour(retourVers, ok ? `Dépêche du ${jour} refusée.` : 'Aucune dépêche ce jour-là.');
      }

      case 'activer_langue': {
        const code = String(f.get('code') ?? '');
        const penurie = await traductions.penurie(code);
        const locale = await localesReq.locale(code);
        if (!locale) return retour(retourVers, 'Langue inconnue.');
        if (penurie.couverture < Number(locale.seuilCouverture)) {
          return retour(retourVers, `Couverture insuffisante : ${(penurie.couverture * 100).toFixed(1)} %.`);
        }
        await localesReq.activer(code);
        return retour(retourVers, `${code} est active.`);
      }

      case 'relire_traduction': {
        const cle = String(f.get('cle') ?? '');
        const locale = String(f.get('locale') ?? '');
        const corrige = String(f.get('texte') ?? '').trim();
        const ok = await traductions.relire(cle, locale, corrige === '' ? null : corrige);
        return retour(retourVers, ok ? 'Relecture enregistrée.' : 'Ligne introuvable.');
      }

      default:
        return retour(retourVers, 'Action inconnue.');
    }
  } catch (e) {
    return retour(retourVers, `Erreur : ${e instanceof Error ? e.message : String(e)}`);
  }
}
