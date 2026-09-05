/**
 * `POST /api/routines/cerveau/evenements` — dépôt d'un `Event` en brouillon
 * (`05-routines.md` §5.2 et §5.5).
 *
 * Le serveur pose `debut` et `fin` (sept jours pour une dépêche), revérifie la
 * catégorie de l'item cité, refuse un `Event` sans `inspiration.item_id` valide,
 * refuse un second événement de dépêche pour le même jour
 * (`409 DEPECHE_DEJA_PROPOSEE`) et refuse toute soumission après l'échéance
 * (`409 ECHEANCE_DEPASSEE`). Rien n'est reporté au lendemain.
 */

import { communs, depeches, evenements } from '@/db/requetes/index';
import { catalogueVersion, chainesVersion } from '@/serveur/cycle';
import { jourLocal, passee } from '@/serveur/depeche';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { validerEvent, REGEX_DATE_ISO } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const racine = corps.valeur as Record<string, unknown>;
  const brut = racine['event'];
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return erreur('charge_invalide', 400, '{"event": {…}} attendu');
  }
  const o = brut as Record<string, unknown>;

  // L'inspiration est obligatoire, et l'item doit exister et coller en catégorie.
  const inspiration = o['inspiration'];
  if (typeof inspiration !== 'object' || inspiration === null) {
    return erreur('inspiration_manquante', 422, 'inspiration.item_id est obligatoire');
  }
  const itemId = (inspiration as Record<string, unknown>)['item_id'];
  if (typeof itemId !== 'string') {
    return erreur('inspiration_manquante', 422, 'inspiration.item_id est obligatoire');
  }

  // Volet dépêche : un jour, une échéance, un quota.
  const depeche = racine['depeche'];
  let jourDepeche: string | null = null;
  if (depeche !== undefined && depeche !== null) {
    const d = depeche as Record<string, unknown>;
    const jour = d['jour'];
    if (typeof jour !== 'string' || !REGEX_DATE_ISO.test(jour)) {
      return erreur('charge_invalide', 422, 'depeche.jour est une date ISO');
    }
    if (jour !== jourLocal()) {
      return erreur('jour_incorrect', 409, 'une dépêche se propose pour le jour courant, jamais pour un autre');
    }
    if (passee(jour, 'proposition')) {
      return erreur('ECHEANCE_DEPASSEE', 409, 'l’échéance de proposition de 07 h 00 est passée : pas de mission ce jour-là');
    }
    if (await evenements.depecheDuJour(jour)) {
      return erreur('DEPECHE_DEJA_PROPOSEE', 409, 'un seul événement de dépêche par jour réel');
    }
    jourDepeche = jour;
  }

  const items = jourDepeche
    ? await evenements.itemsDuJour(jourDepeche)
    : await evenements.itemsEntre(jourLocal(), communs.ajouterJours(jourLocal(), 42));
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return erreur('reference_inconnue', 422, `l’item ${itemId} n’est pas dans la fenêtre servie`);
  }
  if (item.categorie !== o['categorie']) {
    return erreur('categorie_hors_liste_blanche', 422,
      `la catégorie de l’Event (${String(o['categorie'])}) ne correspond pas à celle de l’item (${item.categorie})`);
  }
  if (await evenements.itemsUtilises(30).then((u) => u.includes(itemId))) {
    return erreur('item_deja_utilise', 409, 'cet item a déjà servi dans les 30 derniers jours');
  }

  // Le serveur pose les dates, l'enveloppe et le statut : la routine ne les choisit pas.
  const debut = jourDepeche ?? communs.jourIso();
  const fin = communs.ajouterJours(debut, 7);
  const jourEnvel = communs.jourIso();
  const complet = {
    ...o,
    debut,
    fin,
    valideParHumain: false,
    cle: typeof o['code'] === 'string' ? o['code'] : 'evt_inconnu',
    version: 1,
    statut: 'brouillon',
    source: 'atlas_cerveau',
    creeLe: jourEnvel,
    majLe: jourEnvel,
  };
  delete (complet as Record<string, unknown>)['inspiration'];

  const valide = validerEvent(complet);
  if (!valide.ok) {
    return json({
      accepte: [], statut: 'brouillon',
      refuse: [{ objet: 'event', error: 'schema_invalide', chemins: valide.erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`) }],
    }, 422);
  }

  const ligne = await evenements.deposer({
    donnees: valide.valeur,
    inspiration: { item_id: itemId, categorie: item.categorie },
    depecheJour: jourDepeche,
    debut,
    fin,
  });
  await evenements.marquerItemUtilise(itemId, debut);

  // Une dépêche proposée ouvre la MissionDuJour et la file prioritaire map.
  if (jourDepeche) {
    await depeches.ouvrir({
      jour: jourDepeche,
      eventId: ligne.id,
      paysCode: valide.valeur.paysConcernes[0] ?? null,
      catalogueVersion: await catalogueVersion(),
      chainesVersion: await chainesVersion(),
    });
  }

  return json({ accepte: ['event'], refuse: [], statut: 'brouillon', code: valide.valeur.code, debut, fin });
});
