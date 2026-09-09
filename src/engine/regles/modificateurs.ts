import { sontAllies } from '../equipes';
/**
 * Lecture des modificateurs actifs : passifs, pouvoirs, climat et mécaniques
 * parlent tous le même vocabulaire (`doc/04-gameplay.md` §7.2, `03-schemas.md` §2).
 *
 * Les multiplicateurs se **multiplient** entre eux et restent dans les bornes de
 * `BORNES_MODIFICATEUR` ; les additifs s'**additionnent**.
 */

import type { QuoiModificateur } from '../../schemas/index';
import { BORNES_MODIFICATEUR } from '../../schemas/index';
import { terrainLogique } from '../hooks';
import type { Catalogue, EtatPartie, ModificateurActif, Unite } from '../types';

/** Vrai si ce modificateur vise cette unité. */
export function viseUnite(
  etat: EtatPartie, cat: Catalogue, mod: ModificateurActif, u: Unite,
): boolean {
  const e = mod.effet;
  if (e.cible === 'terrain' || e.cible === 'economie') return false;
  if (e.cible === 'mes_unites' && u.camp !== mod.camp) return false;
  if (e.cible === 'unites_adverses' && sontAllies(etat, u.camp, mod.camp)) return false;
  const f = e.filtre;
  if (!f) return true;
  if (f.types && !f.types.includes(u.type)) return false;
  const type = cat.unites[u.type];
  if (f.mouvement && (!type || !f.mouvement.includes(type.typeMouvement))) return false;
  if (f.surTerrain) {
    const t = terrainLogique(etat, cat, u);
    if (t === null || !f.surTerrain.includes(t)) return false;
  }
  // `filtre.rayon` suppose une position de commandant, que le moteur ne pose pas :
  // il est lu comme « toutes les unités visées », jamais comme un refus.
  return true;
}

/** Produit des multiplicateurs visant cette unité, borné par le schéma. */
export function multiplicateur(
  etat: EtatPartie, cat: Catalogue, u: Unite, quoi: QuoiModificateur,
): number {
  const bornes = BORNES_MODIFICATEUR[quoi];
  let produit = 1;
  for (const mod of etat.modificateurs) {
    if (mod.effet.modificateur.quoi !== quoi) continue;
    if (!viseUnite(etat, cat, mod, u)) continue;
    produit *= mod.effet.modificateur.valeur;
  }
  return Math.min(bornes.max, Math.max(bornes.min, produit));
}

/** Somme des additifs entiers visant cette unité, bornée par le schéma. */
export function additif(
  etat: EtatPartie, cat: Catalogue, u: Unite, quoi: QuoiModificateur,
): number {
  const bornes = BORNES_MODIFICATEUR[quoi];
  let somme = 0;
  for (const mod of etat.modificateurs) {
    if (mod.effet.modificateur.quoi !== quoi) continue;
    if (!viseUnite(etat, cat, mod, u)) continue;
    somme += mod.effet.modificateur.valeur;
  }
  return Math.min(bornes.max, Math.max(bornes.min, Math.round(somme)));
}

/** Multiplicateur de fonds d'un camp (cible `economie` ou `mes_unites`). */
export function multiplicateurFonds(etat: EtatPartie, camp: number): number {
  const bornes = BORNES_MODIFICATEUR.fonds;
  let produit = 1;
  for (const mod of etat.modificateurs) {
    if (mod.effet.modificateur.quoi !== 'fonds') continue;
    if (mod.camp !== camp) continue;
    produit *= mod.effet.modificateur.valeur;
  }
  return Math.min(bornes.max, Math.max(bornes.min, produit));
}
