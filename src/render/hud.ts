/**
 * Le HUD : panneau d'unité et de terrain, journée et fonds, commandant et jauge,
 * le **Bulletin** (saison, phase, météo et prévision à deux journées), le menu de
 * production, le bouton de fin de tour et l'écran de fin.
 *
 * Trois règles d'internationalisation, appliquées à toute cette couche
 * (`09-i18n.md` §7) :
 *
 * 1. **aucun texte en dur** : tout passe par `t()`, y compris les libellés
 *    d'unités et de terrains, qui retombent sur le canon quand la clé n'est pas
 *    dans le bundle ;
 * 2. **mesurer, puis disposer** : chaque panneau tire sa largeur de
 *    `measureText`, bornée par un minimum et un maximum ; deux échappatoires
 *    dans cet ordre, réduire la police d'un cran (jusqu'à 85 %) puis tronquer
 *    avec une ellipse — jamais déborder ;
 * 3. **`Intl` pour tout** : nombres, dates et pluriels.
 *
 * Le HUD ne décide de rien : il rend la liste de ses **zones cliquables**, et
 * c'est le contrôleur qui en tire des actions.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, pvAffiches, terrainLogique } from '../engine/index';
import { nombre as nombreIntl, resoudre } from '../i18n/index';
import type { Case, CleTerrain, CleUnite, Meteo, PhaseJour, Saison } from '../schemas/types';
import type { Ambiance } from './ambiance';
import { paletteDe } from './palettes';
import {
  dessinerUnite, disque, ombre, polygone, rr, trait, type Pinceau,
} from './sprites/index';

/** Une zone cliquable du HUD, en pixels logiques d'écran. */
export interface ZoneHud {
  id: string;
  x: number;
  y: number;
  l: number;
  h: number;
  /** Donnée portée par la zone : clé d'unité à produire, type d'action… */
  donnee?: string;
}

/** Une entrée du menu contextuel d'actions. */
export interface OptionMenu {
  id: string;
  /** Clé de chaîne, jamais un texte. */
  cle: string;
  disponible: boolean;
}

/** Ce que le HUD a besoin de savoir pour se dessiner. */
export interface VueHud {
  etat: EtatPartie;
  catalogue: Catalogue;
  ambiance: Ambiance;
  locale: string;
  /** Le `t()` déjà lié à la langue. */
  t(cle: string, params?: Record<string, string | number>): string;
  largeur: number;
  hauteur: number;
  /** Case sous le curseur : c'est elle qui alimente le panneau d'inspection. */
  curseur: Case | null;
  selection: string | null;
  /** Menu contextuel d'actions, ancré sur une case. */
  menu: { ancre: Case; options: readonly OptionMenu[] } | null;
  /** Menu de production, ouvert sur un bâtiment. */
  production: { batiment: Case; unites: readonly CleUnite[] } | null;
  /** Vrai pendant que l'adversaire joue : le HUD se verrouille. */
  attenteIa: boolean;
  /** Message éphémère (refus, capture, mise hors jeu), déjà traduit. */
  annonce: string | null;
}

// ---------------------------------------------------------------------------
// Polices et mesure
// ---------------------------------------------------------------------------

/** Piles de polices système, une par script (`09-i18n.md` §7.2). */
export const PILES_POLICE: Readonly<Record<string, string>> = {
  latin: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  han_simplifie: "system-ui, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  kana_kanji: "system-ui, 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif",
};

/** La pile de polices d'une langue. Le cyrillique partage celle du latin. */
export function pilePolice(locale: string): string {
  if (locale.startsWith('zh')) return PILES_POLICE['han_simplifie'] ?? '';
  if (locale.startsWith('ja')) return PILES_POLICE['kana_kanji'] ?? '';
  return PILES_POLICE['latin'] ?? '';
}

/** Compose une déclaration `ctx.font`. */
export function police(taille: number, gras: boolean, locale: string): string {
  return `${gras ? 'bold ' : ''}${taille}px ${pilePolice(locale)}`;
}

/** Largeur d'un texte dans la police courante. */
export function mesurer(g: Pinceau, texte: string): number {
  return g.measureText(texte).width;
}

/**
 * Ajuste un texte à une largeur : on réduit la police d'un cran (jusqu'à 85 %),
 * puis on tronque avec une ellipse. On ne déborde jamais, on ne retourne jamais
 * à la ligne dans un panneau d'une ligne.
 */
export function ajuster(
  g: Pinceau, texte: string, largeurMax: number, taille: number, gras: boolean, locale: string,
): { texte: string; taille: number } {
  g.font = police(taille, gras, locale);
  if (mesurer(g, texte) <= largeurMax) return { texte, taille };
  const reduite = Math.max(9, Math.round(taille * 0.85));
  g.font = police(reduite, gras, locale);
  if (mesurer(g, texte) <= largeurMax) return { texte, taille: reduite };
  let coupe = texte;
  while (coupe.length > 1 && mesurer(g, `${coupe}…`) > largeurMax) coupe = coupe.slice(0, -1);
  return { texte: `${coupe}…`, taille: reduite };
}

/** Écrit un texte ajusté et rend la largeur réellement occupée. */
function ecrire(
  g: Pinceau, texte: string, x: number, y: number, largeurMax: number,
  taille: number, gras: boolean, couleur: string, locale: string,
): number {
  const a = ajuster(g, texte, largeurMax, taille, gras, locale);
  g.font = police(a.taille, gras, locale);
  g.fillStyle = couleur;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText(a.texte, x, y);
  return mesurer(g, a.texte);
}

// ---------------------------------------------------------------------------
// Libellés : jamais de texte en dur, toujours une clé
// ---------------------------------------------------------------------------

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
export function libelleSaison(t: VueHud['t'], s: Saison): string {
  return t(`saison.${s}`);
}

/** Libellé d'une météo. */
export function libelleMeteo(t: VueHud['t'], m: Meteo): string {
  return t(`meteo.${m}`);
}

/** Libellé d'une phase du jour. */
export function libellePhase(t: VueHud['t'], p: PhaseJour): string {
  return t(p === 'nuit' ? 'hud.nuit' : 'hud.jour');
}

// ---------------------------------------------------------------------------
// Fonds et briques de panneau
// ---------------------------------------------------------------------------

const FOND = 'rgba(20,24,34,0.92)';
const TEXTE = '#ffffff';
const TEXTE_DOUX = '#9aa3b5';

/** Panneau sombre à coins arrondis, avec son ombre douce. */
function panneau(g: Pinceau, x: number, y: number, l: number, h: number, bordCamp?: string): void {
  ombre(g, true, 14, 6);
  g.fillStyle = FOND;
  rr(g, x, y, l, h, 10);
  g.fill();
  ombre(g, false);
  if (bordCamp) {
    g.fillStyle = bordCamp;
    rr(g, x, y, 6, h, 3);
    g.fill();
  }
}

/** Bouton du HUD : fond, libellé centré, état grisé. */
function bouton(
  g: Pinceau, zone: ZoneHud, texte: string, locale: string, actif: boolean, accent: string,
): void {
  ombre(g, actif, 10, 4);
  g.fillStyle = actif ? accent : 'rgba(70,76,90,0.85)';
  rr(g, zone.x, zone.y, zone.l, zone.h, 8);
  g.fill();
  ombre(g, false);
  const a = ajuster(g, texte, zone.l - 16, 14, true, locale);
  g.font = police(a.taille, true, locale);
  g.fillStyle = actif ? '#ffffff' : 'rgba(255,255,255,0.55)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(a.texte, zone.x + zone.l / 2, zone.y + zone.h / 2);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}

/** Petite icône de météo, dessinée par code comme le reste. */
function iconeMeteo(g: Pinceau, m: Meteo, x: number, y: number, r: number): void {
  switch (m) {
    case 'clair':
      disque(g, x, y, r * 0.6, '#ffd66b');
      g.strokeStyle = '#ffd66b';
      g.lineWidth = 1.5;
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
        g.lineTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
        g.stroke();
      }
      break;
    case 'pluie':
    case 'tempete':
      disque(g, x - r * 0.3, y - r * 0.2, r * 0.55, '#c3cbd8');
      disque(g, x + r * 0.35, y - r * 0.1, r * 0.45, '#c3cbd8');
      if (m === 'tempete') {
        polygone(g, [[x, y + r * 0.2], [x + r * 0.5, y + r * 0.2], [x - r * 0.1, y + r * 1.2],
          [x + r * 0.2, y + r * 0.55], [x - r * 0.3, y + r * 0.55]], '#ffd66b');
      } else {
        for (const dx of [-r * 0.4, 0, r * 0.4]) {
          trait(g, x + dx, y + r * 0.4, x + dx - 2, y + r * 1.1, '#7fb6ff', 2);
        }
      }
      break;
    case 'neige':
      disque(g, x, y - r * 0.2, r * 0.55, '#e6eef7');
      for (const dx of [-r * 0.45, 0, r * 0.45]) disque(g, x + dx, y + r * 0.8, 2, '#ffffff');
      break;
    case 'brouillard':
      for (let i = 0; i < 3; i += 1) {
        g.fillStyle = 'rgba(200,214,224,0.75)';
        rr(g, x - r, y - r * 0.5 + i * r * 0.5, r * 2, 3, 1.5);
        g.fill();
      }
      break;
    case 'canicule':
      disque(g, x, y - r * 0.2, r * 0.5, '#ff9a3c');
      g.strokeStyle = '#ff9a3c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - r * 0.7, y + r * 0.8);
      g.quadraticCurveTo(x, y + r * 0.3, x + r * 0.7, y + r * 0.8);
      g.stroke();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Les panneaux
// ---------------------------------------------------------------------------

/** Bandeau haut gauche : journée, fonds, camp qui joue. */
function bandeauPartie(g: Pinceau, vue: VueHud): void {
  const { etat, locale } = vue;
  const camp = etat.camps.find((c) => c.id === etat.campCourant);
  const journee = vue.t('hud.journee', { n: Math.max(1, etat.journee) });
  const fonds = vue.t('hud.fonds', { n: nombreIntl(locale, camp?.fonds ?? 0) });
  g.font = police(15, true, locale);
  const l = Math.max(190, Math.min(340, Math.max(mesurer(g, journee), mesurer(g, fonds)) + 40));
  panneau(g, 12, 12, l, 62, paletteDe(etat.campCourant).main);
  ecrire(g, journee, 26, 36, l - 34, 15, true, TEXTE, locale);
  ecrire(g, fonds, 26, 58, l - 34, 13, false, TEXTE_DOUX, locale);
}

/** Bandeau haut droit : le Bulletin d'Atlas — saison, phase, météo, prévisions. */
function bulletin(g: Pinceau, vue: VueHud): void {
  const { etat, locale } = vue;
  const c = etat.climat;
  const ligne1 = `${libelleSaison(vue.t, c.saison)} · ${libellePhase(vue.t, c.phase)}`;
  const ligne2 = libelleMeteo(vue.t, c.meteo);
  const ligne3 = vue.t('hud.bulletin', {
    j1: libelleMeteo(vue.t, c.previsions[0]),
    j2: libelleMeteo(vue.t, c.previsions[1]),
  });
  g.font = police(14, true, locale);
  const l = Math.max(210, Math.min(360, Math.max(
    mesurer(g, ligne1), mesurer(g, ligne2), mesurer(g, ligne3),
  ) + 74));
  const x = vue.largeur - l - 12;
  panneau(g, x, 12, l, 76);
  iconeMeteo(g, c.meteo, x + 30, 44, 16);
  ecrire(g, ligne1, x + 56, 34, l - 68, 14, true, TEXTE, locale);
  ecrire(g, ligne2, x + 56, 52, l - 68, 12, false, TEXTE_DOUX, locale);
  ecrire(g, ligne3, x + 14, 70, l - 26, 11, false, TEXTE_DOUX, locale);
}

/** Jauge de pouvoir du commandant, sous le bulletin. */
function jauge(g: Pinceau, vue: VueHud): ZoneHud[] {
  const { etat, locale } = vue;
  const camp = etat.camps.find((c) => c.id === 0);
  if (!camp) return [];
  const l = 220;
  const x = vue.largeur - l - 12;
  const y = 96;
  panneau(g, x, y, l, 58, paletteDe(0).main);
  const nom = nomCommandant(locale, camp.commandantCle) || vue.t('hud.commandant');
  ecrire(g, nom, x + 16, y + 22, l - 30, 13, true, TEXTE, locale);
  const barre = { x: x + 16, y: y + 32, l: l - 32, h: 10 };
  g.fillStyle = 'rgba(255,255,255,0.14)';
  rr(g, barre.x, barre.y, barre.l, barre.h, 5);
  g.fill();
  const part = camp.jaugeMax > 0 ? Math.min(1, camp.jauge / camp.jaugeMax) : 0;
  g.fillStyle = part >= 1 ? '#ffd66b' : paletteDe(0).light;
  rr(g, barre.x, barre.y, Math.max(2, barre.l * part), barre.h, 5);
  g.fill();
  ecrire(g, vue.t('hud.jauge_pouvoir'), x + 16, y + 52, l - 30, 11, false, TEXTE_DOUX, locale);
  return [{ id: 'pouvoir', x, y, l, h: 58 }];
}

/** Panneau bas gauche : l'unité et le terrain sous le curseur. */
function panneauInspection(g: Pinceau, vue: VueHud): void {
  const c = vue.curseur;
  if (!c) return;
  const { etat, catalogue, locale } = vue;
  const terrain = terrainLogique(etat, catalogue, c);
  if (terrain === null) return;
  const unite: Unite | undefined = etat.unites.find(
    (u) => !u.dansTransport && u.x === c.x && u.y === c.y,
  );
  const type = unite ? catalogue.unites[unite.type] : undefined;
  const t = catalogue.terrains[terrain];

  const lignes: string[] = [];
  if (unite && type) {
    lignes.push(vue.t('hud.points_de_vie', { n: pvAffiches(unite.pv) }));
    lignes.push(vue.t('hud.mouvement', { n: type.mouvement }));
    if (unite.munitions !== null) lignes.push(vue.t('hud.munitions', { n: unite.munitions }));
    if (unite.carburant !== null) lignes.push(vue.t('hud.carburant', { n: unite.carburant }));
  }
  const titre = unite && type ? nomUnite(locale, catalogue, unite.type) : nomTerrain(locale, catalogue, terrain);
  const defense = vue.t('hud.defense', { n: t?.defense ?? 0 });
  // Sans unité, le titre est déjà le terrain : on ne le répète pas en sous-titre.
  const sousTitre = unite ? `${nomTerrain(locale, catalogue, terrain)} · ${defense}` : defense;

  g.font = police(15, true, locale);
  const largeurTexte = Math.max(mesurer(g, titre), mesurer(g, sousTitre), mesurer(g, lignes.join(' · ')));
  const l = Math.max(220, Math.min(380, largeurTexte + (unite ? 92 : 40)));
  const h = 76;
  const y = vue.hauteur - h - 12;
  panneau(g, 12, y, l, h, unite ? paletteDe(unite.camp).main : paletteDe(null).main);

  let texteX = 26;
  if (unite && type) {
    g.save();
    g.translate(46, y + h / 2);
    g.scale(0.86, 0.86);
    dessinerUnite(g, type.silhouette, paletteDe(unite.camp));
    g.restore();
    texteX = 84;
  }
  ecrire(g, titre, texteX, y + 26, l - texteX - 12, 15, true, TEXTE, locale);
  ecrire(g, sousTitre, texteX, y + 46, l - texteX - 12, 12, false, TEXTE_DOUX, locale);
  if (lignes.length > 0) {
    ecrire(g, lignes.join(' · '), texteX, y + 64, l - texteX - 12, 12, false, TEXTE_DOUX, locale);
  }
}

/** Bouton de fin de tour, en bas à droite comme dans la démo. */
function boutonFinTour(g: Pinceau, vue: VueHud): ZoneHud[] {
  const l = 150;
  const h = 44;
  const zone: ZoneHud = { id: 'fin_tour', x: vue.largeur - l - 12, y: vue.hauteur - h - 12, l, h };
  bouton(g, zone, vue.t('hud.fin_de_tour'), vue.locale, !vue.attenteIa, paletteDe(0).main);
  return [zone];
}

/** Menu contextuel d'actions, ancré sur la case d'arrivée. */
function menuActions(g: Pinceau, vue: VueHud, versEcran: (c: Case) => { x: number; y: number }): ZoneHud[] {
  if (!vue.menu) return [];
  const options = vue.menu.options;
  if (options.length === 0) return [];
  const locale = vue.locale;
  g.font = police(14, true, locale);
  const l = Math.max(140, Math.min(240, Math.max(
    ...options.map((o) => mesurer(g, vue.t(o.cle))),
  ) + 34));
  const hLigne = 34;
  const h = options.length * hLigne + 12;
  const ancre = versEcran(vue.menu.ancre);
  const x = Math.max(12, Math.min(vue.largeur - l - 12, ancre.x + 36));
  const y = Math.max(12, Math.min(vue.hauteur - h - 12, ancre.y - h / 2));
  panneau(g, x, y, l, h);
  const zones: ZoneHud[] = [];
  options.forEach((o, i) => {
    const zy = y + 6 + i * hLigne;
    if (o.disponible) {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      rr(g, x + 6, zy, l - 12, hLigne - 4, 6);
      g.fill();
    }
    ecrire(
      g, vue.t(o.cle), x + 18, zy + 21, l - 30, 14, false,
      o.disponible ? TEXTE : 'rgba(255,255,255,0.35)', locale,
    );
    if (o.disponible) zones.push({ id: 'action', x: x + 6, y: zy, l: l - 12, h: hLigne - 4, donnee: o.id });
  });
  return zones;
}

/** Menu de production : les unités que le bâtiment sait produire, avec leur coût. */
function menuProduction(g: Pinceau, vue: VueHud): ZoneHud[] {
  if (!vue.production) return [];
  const { catalogue, locale } = vue;
  const unites = vue.production.unites;
  const fonds = vue.etat.camps.find((c) => c.id === vue.etat.campCourant)?.fonds ?? 0;
  const hLigne = 46;
  const l = 300;
  const h = Math.min(vue.hauteur - 40, unites.length * hLigne + 100);
  const x = Math.round((vue.largeur - l) / 2);
  const y = Math.round((vue.hauteur - h) / 2);
  panneau(g, x, y, l, h, paletteDe(vue.etat.campCourant).main);
  ecrire(g, vue.t('menu.production'), x + 20, y + 30, l - 40, 16, true, TEXTE, locale);
  const zones: ZoneHud[] = [];
  unites.forEach((cle, i) => {
    const type = catalogue.unites[cle];
    if (!type) return;
    const zy = y + 44 + i * hLigne;
    if (zy + hLigne > y + h - 52) return;
    const abordable = type.cout <= fonds;
    g.fillStyle = abordable ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)';
    rr(g, x + 12, zy, l - 24, hLigne - 6, 8);
    g.fill();
    g.save();
    g.translate(x + 44, zy + (hLigne - 6) / 2);
    g.scale(0.6, 0.6);
    dessinerUnite(g, type.silhouette, paletteDe(vue.etat.campCourant));
    g.restore();
    ecrire(
      g, nomUnite(locale, catalogue, cle), x + 76, zy + 20, l - 100, 14, true,
      abordable ? TEXTE : 'rgba(255,255,255,0.4)', locale,
    );
    ecrire(
      g, nombreIntl(locale, type.cout), x + 76, zy + 34, l - 100, 12, false,
      abordable ? TEXTE_DOUX : 'rgba(255,255,255,0.28)', locale,
    );
    if (abordable) zones.push({ id: 'produire', x: x + 12, y: zy, l: l - 24, h: hLigne - 6, donnee: cle });
  });
  const zoneRetour: ZoneHud = { id: 'fermer', x: x + l - 106, y: y + h - 40, l: 94, h: 30 };
  bouton(g, zoneRetour, vue.t('menu.retour'), locale, true, 'rgba(70,76,90,0.95)');
  zones.push(zoneRetour);
  return zones;
}

/** Bandeau « tour de l'adversaire », pendant que l'IA joue. */
function bandeauAttente(g: Pinceau, vue: VueHud): void {
  if (!vue.attenteIa) return;
  const texte = vue.t('hud.tour_adverse');
  g.font = police(15, true, vue.locale);
  const l = Math.max(200, mesurer(g, texte) + 56);
  const x = Math.round((vue.largeur - l) / 2);
  panneau(g, x, 12, l, 42, paletteDe(1).main);
  ecrire(g, texte, x + 20, 38, l - 34, 15, true, TEXTE, vue.locale);
}

/** L'annonce éphémère, au centre bas : capture, mise hors jeu, refus. */
function annonce(g: Pinceau, vue: VueHud): void {
  if (!vue.annonce) return;
  g.font = police(14, true, vue.locale);
  const l = Math.min(vue.largeur - 40, mesurer(g, vue.annonce) + 40);
  const x = Math.round((vue.largeur - l) / 2);
  const y = vue.hauteur - 112;
  panneau(g, x, y, l, 36);
  ecrire(g, vue.annonce, x + 20, y + 24, l - 40, 14, true, TEXTE, vue.locale);
}

/** L'écran de fin : manche gagnée, perdue ou nulle, et le bouton de sortie. */
function ecranFin(g: Pinceau, vue: VueHud): ZoneHud[] {
  const fin = vue.etat.partie;
  if (!fin.terminee) return [];
  g.fillStyle = 'rgba(8,10,18,0.7)';
  g.fillRect(0, 0, vue.largeur, vue.hauteur);
  const l = Math.min(420, vue.largeur - 40);
  const h = 170;
  const x = Math.round((vue.largeur - l) / 2);
  const y = Math.round((vue.hauteur - h) / 2);
  const cle = fin.nul ? 'hud.match_nul' : fin.vainqueur === 0 ? 'combat.manche_gagnee' : 'combat.manche_perdue';
  panneau(g, x, y, l, h, paletteDe(fin.vainqueur ?? null).main);
  ecrire(g, vue.t(cle), x + 28, y + 56, l - 56, 26, true, TEXTE, vue.locale);
  ecrire(
    g, vue.t('hud.journee', { n: Math.max(1, vue.etat.journee) }),
    x + 28, y + 84, l - 56, 13, false, TEXTE_DOUX, vue.locale,
  );
  const zone: ZoneHud = { id: 'rejouer', x: x + 28, y: y + h - 56, l: l - 56, h: 40 };
  bouton(g, zone, vue.t('hud.rejouer'), vue.locale, true, paletteDe(0).main);
  return [zone];
}

/**
 * Dessine tout le HUD et rend ses zones cliquables, de la plus haute à la plus
 * basse : le contrôleur teste dans cet ordre, donc un menu ouvert masque bien le
 * bouton qui est dessous.
 */
export function dessinerHud(
  g: Pinceau, vue: VueHud, versEcran: (c: Case) => { x: number; y: number },
): ZoneHud[] {
  g.save();
  g.textBaseline = 'alphabetic';
  bandeauPartie(g, vue);
  bulletin(g, vue);
  const zonesJauge = jauge(g, vue);
  panneauInspection(g, vue);
  const zonesFin = boutonFinTour(g, vue);
  const zonesMenu = menuActions(g, vue, versEcran);
  const zonesProduction = menuProduction(g, vue);
  bandeauAttente(g, vue);
  annonce(g, vue);
  const zonesEcranFin = ecranFin(g, vue);
  g.restore();
  return [...zonesEcranFin, ...zonesProduction, ...zonesMenu, ...zonesFin, ...zonesJauge];
}

/** Vrai si un point d'écran tombe dans une zone. */
export function dansZone(z: ZoneHud, p: { x: number; y: number }): boolean {
  return p.x >= z.x && p.x <= z.x + z.l && p.y >= z.y && p.y <= z.y + z.h;
}

/** La zone touchée par un point, la plus haute d'abord, ou `null`. */
export function zoneSous(zones: readonly ZoneHud[], p: { x: number; y: number }): ZoneHud | null {
  for (const z of zones) if (dansZone(z, p)) return z;
  return null;
}

/** Cases capturables sous une unité : sert au menu et au panneau (lecture seule). */
export function estBatiment(cat: Catalogue, terrain: CleTerrain): boolean {
  return cat.terrains[terrain]?.capturable === true;
}

/** Clé de case, réexportée pour les appelants du HUD. */
export { cleCase };
