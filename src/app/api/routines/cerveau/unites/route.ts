/**
 * `POST /api/routines/cerveau/unites` — dépôt d'une `UnitType` candidate en
 * brouillon (`05-routines.md` §5.6).
 *
 * Ce que le serveur vérifie **avant même d'enregistrer un brouillon** : statut
 * demandé `essai` uniquement, deux traits au plus pris dans la liste fermée, une
 * silhouette dans les listes fermées avec trois modules au plus, **ligne et colonne
 * de dégâts complètes** (une case manquante est un refus, pas un zéro implicite),
 * le plafond de 24 actives, le quota d'une candidate par semaine, et une
 * `catalogueVersion` à jour — sinon `409 CATALOGUE_PERIME`.
 */

import { chargerCatalogueUnites } from '@/content/index';
import { unites } from '@/db/requetes/index';
import { catalogueSature, catalogueVersion } from '@/serveur/cycle';
import { erreur, json, lireJson } from '@/serveur/reponses';
import { routeRoutine } from '@/serveur/routes';
import { validerUnitType } from '@/schemas/index';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = routeRoutine(async (requete) => {
  const corps = await lireJson(requete);
  if (!corps.ok) return corps.reponse;
  const racine = corps.valeur as Record<string, unknown>;

  const brut = racine['candidate'];
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return erreur('charge_invalide', 400, '{"candidate": {…}, "inspiration": {…}, "justification": "…"} attendu');
  }
  const inspiration = racine['inspiration'];
  const justification = racine['justification'];
  if (typeof inspiration !== 'object' || inspiration === null) {
    return erreur('inspiration_manquante', 422, 'inspiration.item_id est obligatoire');
  }
  if (typeof justification !== 'string' || justification.trim() === '' || justification.length > 500) {
    return erreur('justification_manquante', 422, 'une justification de 500 caractères au plus est obligatoire');
  }

  const c = brut as Record<string, unknown>;
  if (c['statut'] !== 'essai') {
    return erreur('statut_interdit', 422, 'une routine demande « essai », jamais « canon » ni « homologuee »');
  }

  const valide = validerUnitType(c);
  if (!valide.ok) {
    return json({
      accepte: [],
      refuse: [{ objet: 'candidate', error: 'schema_invalide', chemins: valide.erreurs.map((e) => `${e.chemin || '(racine)'} — ${e.message}`) }],
    }, 422);
  }
  const unite = valide.valeur;

  if (unite.traits.length > 2) {
    return erreur('trop_de_traits', 422, 'deux traits au plus, pris dans la liste fermée');
  }
  if (unite.silhouette.modules.length > 3) {
    return erreur('silhouette_invalide', 422, 'trois modules au plus sur une silhouette');
  }

  // Ligne ET colonne de dégâts complètes : une case manquante est un refus.
  const canon = chargerCatalogueUnites();
  const enBase = await unites.catalogue(['canon', 'essai', 'homologuee']);
  const actifs = [...new Set([...canon.unites.map((u) => u.cle), ...enBase.map((u) => u.cle)])];
  const manqueLigne = actifs.filter((cle) => typeof unite.degats[cle] !== 'number');
  const manqueColonne = actifs.filter((cle) => typeof unite.subitDegats?.[cle] !== 'number');
  if (manqueLigne.length > 0 || manqueColonne.length > 0) {
    return erreur('degats_incomplets', 422,
      'la ligne (degats) et la colonne (subitDegats) doivent couvrir toutes les unités actives',
      [...manqueLigne.map((k) => `degats.${k}`), ...manqueColonne.map((k) => `subitDegats.${k}`)]);
  }

  // Version de catalogue : la routine recopie celle qu'elle a lue.
  const version = await catalogueVersion();
  const recue = racine['catalogueVersion'] ?? (c['catalogueVersion'] as unknown);
  if (recue !== undefined && recue !== null && recue !== version) {
    return erreur('CATALOGUE_PERIME', 409, `catalogueVersion ${version} attendue, ${String(recue)} reçue`);
  }

  if (await catalogueSature()) {
    return erreur('catalogue_plein', 409, 'le catalogue est plafonné à 24 unités actives');
  }
  const semaine = new Date(Date.now() - 7 * 86_400_000);
  if (await unites.candidatesDepuis(semaine) >= 1) {
    return erreur('quota_hebdomadaire', 429, 'une candidate par semaine au plus');
  }
  if (await unites.unite(unite.cle)) {
    return erreur('cle_deja_prise', 409, 'une clé d’unité n’est jamais réutilisée');
  }

  await unites.deposerCandidate({ donnees: unite, catalogueVersion: version, sourceEventId: null });
  return json({
    accepte: ['candidate'],
    refuse: [],
    statut: 'brouillon',
    cle: unite.cle,
    catalogueVersion: version,
    detail: 'la mise en essai est une décision humaine, après certification',
  }, 201);
});
