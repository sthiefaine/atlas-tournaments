/**
 * Les bâtiments dans la chaîne des figurines (`doc/refonte/plan-batiments.md`,
 * qui fait foi) : ce qu'une commande veut dire, l'identifiant et le dossier de
 * chaque entrée, la fiche d'une entrée que le catalogue n'a pas encore, ce
 * qu'un module déclare savoir construire. Pur : des chaînes et des fiches en
 * entrée, des chaînes et des fiches en sortie ; `fabriquer.ts` et
 * `installer.ts` lisent et écrivent les fichiers.
 *
 *   npm run fabriquer:figurine -- --batiment ville [--etat desaffecte] [--variante fr]
 *
 * Un module de bâtiment (`batiments/<cle>.py`) fait **tous** les états du
 * bâtiment — le désaffecté est le même bâtiment endormi, jamais un autre
 * dessin — et le QG ses variantes nationales :
 *
 *   ETATS = ('base', 'desaffecte')          # ou ('base', 'inerte'), ou ('base',)
 *   VARIANTES = ('base', 'fr', 'lu')        # facultatif : ('base',)
 *   def construire(f, etat, variante): ...
 *   def animer(f, etat, variante): ...
 */

import type { AssetSpec } from '../../../src/assets/spec';
import type { VueSprite } from '../../../src/render2d/contrat';

/** Ce qu'une figurine peut être : la famille de la bibliothèque et de la cuisson. */
export type FamilleFigurine = 'unite' | 'batiment' | 'terrain';

/**
 * Les figurines de la vague des bâtiments qui ne sont pas des bâtiments : le
 * pont est un **terrain** (`terrain_pont`), cuit de face et de travers, sans
 * couleur d'équipe (plan §1 et §2).
 */
export const TERRAINS_FIGURINES: Readonly<Record<string, { id: string; vues: readonly VueSprite[] }>> = {
  pont: { id: 'terrain_pont', vues: ['fixe', 'travers'] },
};

/**
 * Le « type de base » d'un bâtiment dont le catalogue n'a pas encore la fiche
 * (plan §1) : la superusine se dérive de l'usine. Les autres, de leur propre
 * entrée `batiment_<cle>_base`.
 */
export const BASE_DE_DERIVATION: Readonly<Record<string, string>> = { superusine: 'usine' };

/** Une entrée à fabriquer : un état et une variante d'un bâtiment. */
export interface EntreeBatiment {
  /** La clé du module : `ville`, `qg`, `superusine`, `pont`. */
  cle: string;
  etat: string;
  variante: string;
  /** L'identifiant de l'asset : `batiment_ville_desaffecte`, `batiment_qg_fr`, `terrain_pont`. */
  id: string;
  famille: 'batiment' | 'terrain';
  /** Les vues de la cuisson. */
  vues: VueSprite[];
}

const REGEX_CLE = /^[a-z][a-z0-9]*$/;
const REGEX_MOT = /^[a-z][a-z0-9]*$/;

/**
 * L'identifiant d'un état et d'une variante (plan §1) : `batiment_<cle>_<suffixe>`,
 * le suffixe étant l'état s'il n'est pas `base`, sinon la variante. Un kit
 * national ne se désaffecte pas : les deux à la fois sont refusés. Le pont est
 * `terrain_pont`.
 */
export function idFigurineBatiment(cle: string, etat = 'base', variante = 'base'): string {
  if (!REGEX_CLE.test(cle)) throw new Error(`clé de bâtiment invalide : ${cle} (minuscules et chiffres, sans tiret bas)`);
  if (!REGEX_MOT.test(etat) || !REGEX_MOT.test(variante)) throw new Error(`état ou variante invalide : ${etat}, ${variante}`);
  if (etat !== 'base' && variante !== 'base') throw new Error(`${cle} : un état (${etat}) et une variante (${variante}) à la fois — un kit national ne se désaffecte pas`);
  const terrain = TERRAINS_FIGURINES[cle];
  if (terrain) {
    if (etat !== 'base' || variante !== 'base') throw new Error(`${cle} : un terrain n'a ni état ni variante`);
    return terrain.id;
  }
  return `batiment_${cle}_${etat !== 'base' ? etat : variante}`;
}

/** Les entrées qu'une commande demande : tous les états et variantes du module, ou ceux qu'on nomme. */
export function entreesBatiment(cle: string, declare: { etats: readonly string[]; variantes: readonly string[] },
  demande: { etat?: string | null; variante?: string | null } = {}): EntreeBatiment[] {
  if (demande.etat && !declare.etats.includes(demande.etat)) throw new Error(`${cle} : l'état ${demande.etat} n'est pas dans ETATS (${declare.etats.join(', ')})`);
  if (demande.variante && !declare.variantes.includes(demande.variante)) {
    throw new Error(`${cle} : la variante ${demande.variante} n'est pas dans VARIANTES (${declare.variantes.join(', ')})`);
  }
  const terrain = TERRAINS_FIGURINES[cle];
  const sortie: EntreeBatiment[] = [];
  for (const etat of demande.etat ? [demande.etat] : declare.etats) {
    for (const variante of demande.variante ? [demande.variante] : declare.variantes) {
      // Un état autre que la base ne se combine qu'avec la variante de base : le désaffecté est commun.
      if (etat !== 'base' && variante !== 'base') {
        if (demande.etat && demande.variante) idFigurineBatiment(cle, etat, variante);
        continue;
      }
      sortie.push({
        cle, etat, variante, id: idFigurineBatiment(cle, etat, variante),
        famille: terrain ? 'terrain' : 'batiment', vues: [...(terrain?.vues ?? ['fixe'])],
      });
    }
  }
  if (!sortie.length) throw new Error(`${cle} : rien à fabriquer`);
  return sortie;
}

/**
 * Ce qu'un module de bâtiment déclare : `ETATS` et `VARIANTES`, des tuples de
 * chaînes littérales écrits sur une ligne (`('base',)` sans eux). Lu dans la
 * source, sans Python : c'est ce qui dit, avant Blender, combien d'entrées
 * fabriquer — et Blender revérifie l'état demandé contre le module chargé.
 */
export function declarationsModule(source: string): { etats: string[]; variantes: string[] } {
  const tuple = (nom: string): string[] | null => {
    const m = new RegExp(`^${nom}\\s*=\\s*[([]([^)\\]]*)[)\\]]`, 'm').exec(source);
    if (!m) return null;
    const mots = [...m[1]!.matchAll(/['"]([a-z][a-z0-9]*)['"]/g)].map((x) => x[1]!);
    if (!mots.length) throw new Error(`${nom} est vide ou illisible (un tuple de chaînes sur une ligne : ('base', 'desaffecte'))`);
    return mots;
  };
  const etats = tuple('ETATS') ?? ['base'];
  const variantes = tuple('VARIANTES') ?? ['base'];
  if (!etats.includes('base')) throw new Error('ETATS doit contenir « base » : le bâtiment en service');
  if (!variantes.includes('base')) throw new Error('VARIANTES doit contenir « base » : le bâtiment commun');
  return { etats, variantes };
}

/**
 * Les fiches à essayer, dans l'ordre, pour une entrée : la sienne
 * (`assets/specs/<id>.json`), puis celle de son type de base, dont elle se
 * dérivera (plan §1) — `batiment_<cle>_base`, et pour la superusine l'usine.
 */
export function fichesCandidates(e: Pick<EntreeBatiment, 'cle' | 'id'>): string[] {
  const noms = [e.id];
  if (e.id.startsWith('batiment_')) {
    noms.push(`batiment_${e.cle}_base`);
    const base = BASE_DE_DERIVATION[e.cle];
    if (base) noms.push(`batiment_${base}_base`);
  }
  return [...new Set(noms)];
}

/**
 * La fiche d'une entrée que le catalogue n'a pas encore (un désaffecté, la
 * superusine) : celle de son type de base, sous son identifiant — mêmes
 * nœuds, matériaux, cartes, clips et gabarits. C'est ce contre quoi elle se
 * contrôle en attendant que `src/assets/catalogue.ts` la compose.
 */
export function ficheDerivee(base: AssetSpec, id: string): AssetSpec {
  const m = /^([a-z]+)_(.+)$/.exec(id);
  if (!m || m[1] !== base.type) throw new Error(`${id} ne se dérive pas de ${base.id} (type ${base.type})`);
  return {
    ...base,
    id,
    cle: m[2]!,
    nommage: { ...base.nommage, exemples: base.nommage.exemples.map((x) => x.split(base.id).join(id)) },
  };
}

/** Le dossier d'un bâtiment sous les brouillons des figurines : ses entrées dedans, une par identifiant, et sa planche. */
export function dossierBatiment(cle: string): string {
  return `tmp/figurines/batiments/${cle}`;
}

/**
 * Le lot fabriqué d'un identifiant, là où `fabriquer.ts` le laisse : l'unité
 * dans `tmp/figurines/<cle>/lot`, le bâtiment et le pont dans
 * `tmp/figurines/batiments/<cle>/<id>/lot`.
 */
export function dossierLot(id: string): string {
  const unite = /^unite_([a-z0-9_]+)_base$/.exec(id);
  if (unite) return `tmp/figurines/${unite[1]}/lot`;
  for (const [cle, t] of Object.entries(TERRAINS_FIGURINES)) if (t.id === id) return `${dossierBatiment(cle)}/${id}/lot`;
  const batiment = /^batiment_([a-z][a-z0-9]*)_([a-z0-9_]+)$/.exec(id);
  if (batiment) return `${dossierBatiment(batiment[1]!)}/${id}/lot`;
  throw new Error(`identifiant sans figurine : ${id} (unite_<cle>_base, batiment_<cle>_<suffixe> ou terrain_pont)`);
}

/** Vrai si l'état d'une entrée éteint ses fenêtres : le désaffecté, la superusine prise (`charte.json`, `batiments.emission.eteints`). */
export function etatEteint(etat: string, eteints: readonly string[]): boolean {
  return eteints.includes(etat);
}
