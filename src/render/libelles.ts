/**
 * Les **libellés** du jeu : le nom d'une unité, d'un terrain, d'un commandant,
 * et les mots d'une saison, d'une météo, d'une heure.
 *
 * Ce module est tout ce qui reste du HUD dessiné au canvas, retiré avec le rendu
 * vectoriel. Il ne dessine plus rien : il ne fait que résoudre des clés, ce dont
 * le HUD HTML a besoin comme en avait besoin celui d'avant.
 *
 * La règle d'internationalisation ne change pas (`09-i18n.md` §7) : **aucun
 * texte en dur**. Tout passe par `t()`, y compris les noms d'unités et de
 * terrains, qui retombent sur le canon quand la clé n'est pas dans le bundle —
 * un nom approximatif vaut mieux qu'une case vide.
 */

import type { Catalogue } from '../engine/index';
import { resoudre } from '../i18n/index';
import type {
  CibleEffet, CleTerrain, CleUnite, DureePouvoir, EffetPouvoir, FiltreEffet, Meteo, PhaseJour, Saison, Trait,
  TypeMouvement,
} from '../schemas/types';
import { BORNES_MODIFICATEUR, QUOI_INSTANTANES } from '../schemas/types';

/** Un `t()` déjà lié à la langue. */
export type Traduire = (cle: string, params?: Record<string, string | number>) => string;

/** Une entrée du menu contextuel d'actions. */
export interface OptionMenu {
  id: string;
  /** Clé de chaîne, jamais un texte. */
  cle: string;
  disponible: boolean;
  /**
   * Pour un débarquement, l'unité de la cale que l'entrée pose : le HUD la
   * nomme dans le libellé (`{unite}`) et la dessine, et la renvoie avec le
   * choix. Absent pour tout autre ordre.
   */
  passager?: string;
}

/** Nom d'une unité : la clé i18n d'abord, le canon en dernier repli. */
export function nomUnite(locale: string, cat: Catalogue, cle: CleUnite): string {
  return resoudre(locale, `unite.${cle}.nom`) ?? cat.unites[cle]?.nom ?? '';
}

/** Nom court d'une unité, pour les étiquettes très contraintes. */
export function nomCourtUnite(locale: string, cat: Catalogue, cle: CleUnite): string {
  return resoudre(locale, `unite.${cle}.nom_court`) ?? cat.unites[cle]?.nomCourt ?? '';
}

/** Nom d'un terrain. */
export function nomTerrain(locale: string, cat: Catalogue, cle: CleTerrain): string {
  return resoudre(locale, `terrain.${cle}.nom`) ?? cat.terrains[cle]?.nom ?? '';
}

/** Nom d'un commandant, par sa clé. */
export function nomCommandant(locale: string, cle: string | null): string {
  if (!cle) return '';
  return resoudre(locale, `commandant.${cle}.nom`) ?? '';
}

/** Libellé d'une saison. */
export function libelleSaison(t: Traduire, s: Saison): string {
  return t(`saison.${s}`);
}

/** Libellé d'une météo. */
export function libelleMeteo(t: Traduire, m: Meteo): string {
  return t(`meteo.${m}`);
}

/** Libellé d'une phase du jour. */
export function libellePhase(t: Traduire, p: PhaseJour): string {
  return t(p === 'nuit' ? 'hud.nuit' : 'hud.jour');
}

/** Libellé d'un type de mouvement (à pied, chenilles, aérien…). */
export function libelleMouvement(t: Traduire, m: TypeMouvement): string {
  return t(`mouvement.${m}`);
}

/** Libellé d'un trait d'unité : la liste fermée de `04-gameplay.md` §13.2. */
export function libelleTrait(t: Traduire, tr: Trait): string {
  return t(`trait.${tr}`);
}

/** De quoi nommer une unité ou un terrain quand un filtre les cite. */
export interface NomsPouvoir {
  unite?(cle: CleUnite): string;
  terrain?(cle: CleTerrain): string;
}

/** Ce que `lignesPouvoir` peut recevoir en plus des effets. */
export interface OptionsLignesPouvoir {
  /** Les noms des unités et des terrains cités par un filtre ; à défaut, la clé de canon passe par `t()`. */
  noms?: NomsPouvoir;
  /** La durée du pouvoir : une dernière ligne la dit, sans quoi « Attaque +20 % » ne dit pas jusqu'à quand. */
  duree?: DureePouvoir;
}

/**
 * Vrai si l'effet s'applique **une fois** au déclenchement — soin, dégâts
 * directs, ravitaillement, réactivation, météo — plutôt que pour la durée du
 * pouvoir. Une lecture de la forme des données, pas une règle : c'est le moteur
 * qui décide ce qu'il en fait (`estInstantane`), le HUD n'a besoin que de
 * savoir s'il y a une prévision à demander.
 */
export function effetInstantane(effet: EffetPouvoir): boolean {
  if ('modificateur' in effet) return QUOI_INSTANTANES.includes(effet.modificateur.quoi);
  return !('poserTerrain' in effet);
}

/** Ce qu'un filtre d'effet restreint, en mots : « Char lourd, Char moyen », « à pied », « sur Ville, Usine ». */
function filtreDit(t: Traduire, filtre: FiltreEffet, noms: NomsPouvoir | undefined): string {
  const parts: string[] = [];
  const virgule = (l: readonly string[]): string => l.join(', ');
  if (filtre.types && filtre.types.length > 0) {
    parts.push(virgule(filtre.types.map((c) => noms?.unite?.(c) ?? t(`unite.${c}.nom`))));
  }
  if (filtre.mouvement && filtre.mouvement.length > 0) {
    parts.push(virgule(filtre.mouvement.map((m) => libelleMouvement(t, m).toLocaleLowerCase())));
  }
  if (filtre.surTerrain && filtre.surTerrain.length > 0) {
    parts.push(t('filtre.sur_terrain', { liste: virgule(filtre.surTerrain.map((c) => noms?.terrain?.(c) ?? t(`terrain.${c}.nom`))) }));
  }
  if (filtre.rayon) parts.push(t('filtre.rayon', { n: filtre.rayon.cases }));
  return parts.join(' · ');
}

/**
 * La cible d'un effet, en mots, restreinte par son filtre : « vos unités »,
 * « les unités adverses (à pied) ». Vide pour l'économie et le terrain, qui
 * n'ont pas de « pour qui ».
 */
export function cibleDite(t: Traduire, effet: { cible: CibleEffet; filtre?: FiltreEffet }, noms?: NomsPouvoir): string {
  if (effet.cible === 'economie' || effet.cible === 'terrain') return '';
  const base = t(`cible.${effet.cible}`);
  const filtre = effet.filtre ? filtreDit(t, effet.filtre, noms) : '';
  return filtre ? t('cible.precisee', { cible: base, filtre }) : base;
}

/** La durée d'un pouvoir, en mots. */
export function libelleDuree(t: Traduire, duree: DureePouvoir): string {
  if (duree === 'ce_tour') return t('duree.ce_tour');
  if (duree === 'tour_complet') return t('duree.tour_complet');
  return t('duree.journees', { n: duree.n });
}

/**
 * Ce qu'un pouvoir de commandant **fait**, une ligne par effet.
 *
 * On dépensait une ressource de match sans savoir ce qu'on achetait : la jauge
 * affichait le nom du commandant et le mot « Pouvoir », rien de plus. Les
 * effets sont pourtant des données (`EffetPouvoir`), et il suffit de les lire.
 *
 * La forme du chiffre vient de `BORNES_MODIFICATEUR` — le moteur sait déjà
 * lesquels de ses modificateurs sont des rapports et lesquels sont des
 * entiers. On ne redécide pas ici qu'une attaque se dit en pour cent : on le
 * demande, sinon la moindre borne changée ferait mentir cette ligne.
 *
 * Depuis les familles du 10 septembre 2026 (`04-gameplay.md` §7.2), chaque
 * famille a sa phrase : « +2 PV pour vos unités », « −25 % Prix d'achat »,
 * « Neige pendant deux journées », « Nouveau tour pour vos unités (Artillerie) ».
 * Tout effet qui n'est pas un modificateur était dit « modifie le terrain » —
 * ce qui était faux pour trois familles sur quatre. La cible et son filtre
 * sont dits quand ils ne vont pas de soi : « vos unités » sans filtre est le
 * cas de loin le plus fréquent et se tait.
 */
export function lignesPouvoir(
  t: Traduire, effets: readonly EffetPouvoir[], options: OptionsLignesPouvoir = {},
): string[] {
  const lignes: string[] = [];
  const { noms } = options;
  for (const effet of effets) {
    if ('poserTerrain' in effet) {
      // Une pose de terrain : le pouvoir change la carte. On le dit sans
      // prétendre décrire une géométrie qu'un joueur verra de toute façon.
      lignes.push(t('hud.effet_terrain'));
      continue;
    }
    if ('meteo' in effet) {
      const meteo = libelleMeteo(t, effet.meteo.valeur);
      lignes.push(t(effet.meteo.journees >= 2 ? 'effet.meteo_deux' : 'effet.meteo', { meteo }));
      continue;
    }
    const cible = cibleDite(t, effet, noms);
    if ('ravitailler' in effet) {
      const { carburant, munitions } = effet.ravitailler;
      const cle = carburant && munitions ? 'effet.ravitailler'
        : carburant ? 'effet.ravitailler_carburant' : 'effet.ravitailler_munitions';
      lignes.push(t(cle, { cible }));
      continue;
    }
    if ('reactiver' in effet) {
      lignes.push(t('effet.reactiver', { cible }));
      continue;
    }
    // Les familles de la faction (`04-gameplay.md` §7.2, « Les familles de la
    // faction ») : une frappe sur une case choisie, un rayon sans case, une
    // impulsion. Elles se disent avec leurs chiffres — rayon, PV, nombre —
    // lus sur l'effet, jamais recopiés : c'est le kit qui parle.
    if ('frappe' in effet) {
      const { pv, rayon } = effet.frappe;
      lignes.push(rayon > 0 ? t('effet.frappe', { pv, rayon }) : t('effet.frappe_case', { pv }));
      continue;
    }
    if ('laser' in effet) {
      const { pv, nombre, choix } = effet.laser;
      const cle = nombre === 1 ? `effet.laser_${choix}_une` : `effet.laser_${choix}`;
      lignes.push(t(cle, { pv, n: nombre }));
      continue;
    }
    if ('iem' in effet) {
      const { rayon, abattre } = effet.iem;
      lignes.push(t(abattre ? 'effet.iem_abattre' : 'effet.iem', { rayon }));
      continue;
    }
    const { quoi, valeur } = effet.modificateur;
    if (quoi === 'soin' || quoi === 'degats_directs') {
      lignes.push(t(quoi === 'soin' ? 'effet.soin' : 'effet.degats_directs', { n: Math.abs(valeur), cible }));
      continue;
    }
    const quoiDit = t(`modificateur.${quoi}`);
    let ligne: string;
    if (BORNES_MODIFICATEUR[quoi].forme === 'mult') {
      const part = Math.round((valeur - 1) * 100);
      ligne = t('hud.effet_pourcent', { quoi: quoiDit, signe: part >= 0 ? '+' : '−', n: Math.abs(part) });
    } else {
      ligne = t('hud.effet_points', { quoi: quoiDit, signe: valeur >= 0 ? '+' : '−', n: Math.abs(valeur) });
    }
    // « vos unités » sans filtre va de soi ; toute autre cible se dit.
    const vaDeSoi = effet.cible === 'mes_unites' && !effet.filtre;
    lignes.push(vaDeSoi || cible === '' ? ligne : t('effet.pour', { effet: ligne, cible }));
  }
  if (options.duree && lignes.length > 0) lignes.push(libelleDuree(t, options.duree));
  return lignes;
}
