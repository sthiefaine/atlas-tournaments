/**
 * L'orientation des achats par les commandants (10 septembre 2026).
 *
 * Deux lectures, toutes deux **bornées** et sans un nom d'unité — ce sont les
 * filtres des effets et la table de dégâts qui parlent.
 *
 * **La faiblesse adverse** (`doc/04-gameplay.md` §7.3 : « la stratégie
 * `ponderee` lit l'axe de faiblesse de son adversaire et pondère ses achats en
 * conséquence »). Le moteur ne porte pas l'axe, il porte le **chiffre** —
 * l'effet posé à la création de la partie (`CommandantMoteur.faiblesse`). Son
 * filtre dit quels types adverses frappent moins, se défendent moins ou
 * marchent moins ; ce sont eux qu'on va chercher, un achat qui les bat gagne
 * ses échanges. Une faiblesse qui ne nomme aucun type — les revenus, toute
 * l'armée, un terrain — n'oriente rien : tous les achats la subissent pareil.
 *
 * **Le kit propre.** Un commandant dont le super ne réactive que les pièces de
 * portée n'a pas de super tant que son camp n'en achète pas ; un pouvoir qui
 * ne pousse que les chenilles vaut par les chenilles qu'on aligne. Les types
 * que le pouvoir et le super nomment sur `mes_unites` reçoivent un bonus
 * d'achat, à la mesure de l'effet.
 */

import type { Catalogue, Commandants, CommandantMoteur, EtatPartie } from '../engine/index';
import { degatsBase } from '../engine/catalogue';
import { sontAllies } from '../engine/equipes';
import type { CampId, CleUnite, EffetModificateur, EffetPouvoir, FiltreEffet } from '../schemas/index';
import { BORNES_MODIFICATEUR } from '../schemas/index';
import { estArmee } from './evaluation';

/** Part de score au plus qu'une faiblesse adverse ajoute à un achat qui l'exploite. */
export const FAIBLESSE_ACHAT = 0.3;

/** Part de score au plus que le kit du commandant ajoute à un type qu'il favorise. */
export const KIT_ACHAT = 0.3;

/**
 * Écart de multiplicateur qui vaut un effet « plein » : ×0,8 ou ×1,2 est un
 * effet entier, ×0,9 ou ×1,1 un demi. Pour un additif, 2 est entier, 1 demi.
 */
export const ECART_EFFET_PLEIN = 0.2;

/** Types armés du catalogue que ce filtre nomme, ou aucun s'il ne nomme rien. */
function typesDuFiltre(cat: Catalogue, filtre: FiltreEffet | undefined): CleUnite[] {
  if (!filtre || (!filtre.types && !filtre.mouvement)) return [];
  return cat.cles.filter((cle) => {
    const t = cat.unites[cle];
    if (!t || t.statut === 'retiree' || !estArmee(cat, cle)) return false;
    if (filtre.types && !filtre.types.includes(cle)) return false;
    if (filtre.mouvement && !filtre.mouvement.includes(t.typeMouvement)) return false;
    return true;
  });
}

/** Ampleur d'un modificateur, de 0 (rien) à 1 (plein), dans un sens ou dans l'autre. */
function ampleurModificateur(m: { quoi: EffetModificateur['modificateur']['quoi']; valeur: number }): number {
  const forme = BORNES_MODIFICATEUR[m.quoi].forme;
  const ampleur = forme === 'mult' ? Math.abs(1 - m.valeur) / ECART_EFFET_PLEIN : Math.abs(m.valeur) / 2;
  return Math.min(1, Math.max(0, ampleur));
}

/** Types armés adverses que la faiblesse touche : ceux de son filtre, ou aucun si elle ne nomme rien. */
export function typesAffaiblis(cat: Catalogue, faiblesse: EffetModificateur | null | undefined): CleUnite[] {
  if (!faiblesse || faiblesse.cible === 'economie' || faiblesse.cible === 'terrain') return [];
  return typesDuFiltre(cat, faiblesse.filtre);
}

/** Ampleur d'une faiblesse, de 0 (rien) à 1 (pleine), lue sur son chiffre et ses bornes. */
export function ampleurFaiblesse(faiblesse: EffetModificateur | null | undefined): number {
  if (!faiblesse) return 0;
  const { quoi, valeur } = faiblesse.modificateur;
  const forme = BORNES_MODIFICATEUR[quoi].forme;
  // Une faiblesse va toujours dans le mauvais sens : sous 1, ou négative.
  if (forme === 'mult' ? valeur >= 1 : valeur >= 0) return 0;
  return ampleurModificateur(faiblesse.modificateur);
}

/**
 * Multiplicateur d'achat d'un type face à des types adverses affaiblis : `1`
 * s'il ne les touche pas, jusqu'à `1 + FAIBLESSE_ACHAT` s'il les met hors jeu
 * d'un coup et que la faiblesse est pleine. L'apport est la base de dégâts
 * moyenne contre les types affaiblis, en part de 100.
 */
export function multiplicateurFaiblesse(
  cat: Catalogue, cle: CleUnite, affaiblis: readonly CleUnite[], ampleur: number,
): number {
  if (affaiblis.length === 0 || ampleur <= 0) return 1;
  let apport = 0;
  for (const s of affaiblis) apport += degatsBase(cat, cle, s);
  apport /= affaiblis.length;
  return 1 + FAIBLESSE_ACHAT * ampleur * Math.min(1, apport / 100);
}

/**
 * L'orientation d'achat d'un camp face à toutes les faiblesses adverses qu'on
 * lui donne : le produit des multiplicateurs, plafonné à `1 + FAIBLESSE_ACHAT`
 * pour que deux adversaires ne comptent pas double.
 */
export function orientationFaiblesse(
  cat: Catalogue, faiblesses: readonly (EffetModificateur | null | undefined)[],
): (cle: CleUnite) => number {
  const lues = faiblesses
    .map((f) => ({ affaiblis: typesAffaiblis(cat, f), ampleur: ampleurFaiblesse(f) }))
    .filter((f) => f.affaiblis.length > 0 && f.ampleur > 0);
  if (lues.length === 0) return () => 1;
  return (cle) => {
    let produit = 1;
    for (const f of lues) produit *= multiplicateurFaiblesse(cat, cle, f.affaiblis, f.ampleur);
    return Math.min(1 + FAIBLESSE_ACHAT, produit);
  };
}

/** Ampleur d'un effet de kit sur les types qu'il nomme : un instantané filtré vaut un effet plein. */
function ampleurEffet(e: EffetPouvoir): number {
  if ('modificateur' in e) return ampleurModificateur(e.modificateur);
  if ('reactiver' in e || 'ravitailler' in e) return 1;
  return 0;
}

/**
 * Bonus d'achat, par type, que le kit d'un commandant justifie : pour chaque
 * effet sur `mes_unites` qui nomme des types, le plus fort des effets qui les
 * nomment. Un effet sans filtre pousse tout le monde pareil et ne dit rien.
 */
export function typesFavorises(cat: Catalogue, commandant: CommandantMoteur | null | undefined): Map<CleUnite, number> {
  const bonus = new Map<CleUnite, number>();
  if (!commandant) return bonus;
  for (const e of [...commandant.pouvoir.effets, ...commandant.superPouvoir.effets]) {
    if (!('cible' in e) || e.cible !== 'mes_unites' || !('filtre' in e)) continue;
    const ampleur = ampleurEffet(e);
    if (ampleur <= 0) continue;
    for (const cle of typesDuFiltre(cat, e.filtre)) bonus.set(cle, Math.max(bonus.get(cle) ?? 0, ampleur));
  }
  return bonus;
}

/** L'orientation d'achat d'un camp vers ce que son propre kit favorise, plafonnée à `1 + KIT_ACHAT`. */
export function orientationKit(
  cat: Catalogue, commandant: CommandantMoteur | null | undefined,
): (cle: CleUnite) => number {
  const favoris = typesFavorises(cat, commandant);
  if (favoris.size === 0) return () => 1;
  return (cle) => 1 + KIT_ACHAT * (favoris.get(cle) ?? 0);
}

/**
 * L'orientation d'achat complète d'un camp : les faiblesses de ses adversaires
 * en lice, et son propre kit. Sans commandants, tout vaut `1`.
 */
export function orientationAchat(
  cat: Catalogue, etat: EtatPartie, camp: CampId, commandants: Commandants,
): (cle: CleUnite) => number {
  const adverses = orientationFaiblesse(cat, etat.camps
    .filter((c) => !sontAllies(etat, c.id, camp) && !c.elimine)
    .map((c) => commandants[c.id]?.faiblesse));
  const kit = orientationKit(cat, commandants[camp]);
  return (cle) => adverses(cle) * kit(cle);
}
