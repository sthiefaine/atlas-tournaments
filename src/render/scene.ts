/**
 * La scène : l'ordre de dessin en couches et le culling par rectangle visible
 * (`02-architecture.md` §3.4).
 *
 * L'ordre est celui de la démo, et il ne change pas :
 *
 *     eau et vaguelettes → halo de sable → herbe → texture → routes → grille
 *     → surbrillances → décor → bâtiments → voile d'ambiance → unités et PV
 *     → curseur → brouillard → particules
 *
 * La scène **consomme** un `EtatPartie` : elle n'a aucune autorité, ne mute rien,
 * et ne connaît aucune unité par son nom — les unités sont composées depuis leur
 * silhouette.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, fnv1a, pvAffiches, signatureTerrain, terrainLogique } from '../engine/index';
import type { Case, CleTerrain } from '../schemas/types';
import type { Ambiance } from './ambiance';
import { alpha } from './ambiance';
import type { Camera } from './camera';
import { TUILE, casesVisibles, palierZoom } from './camera';
import { nationDe, paletteDe } from './palettes';
import {
  batiment, blitter, CacheSprites, cleSilhouette, cleSprite, dessinerTerrain,
  dessinerUnite, disque, foret, graineDe, halo, ombre, relief, rr, type CarteRendu,
  type Pinceau,
} from './sprites/index';

/** Ce qu'une surbrillance signifie : c'est sa couleur qui le dit au joueur. */
export type GenreSurbrillance = 'deplacement' | 'attaque' | 'capture' | 'production' | 'danger';

/** Une case mise en avant sous le curseur du joueur. */
export interface Surbrillance {
  case: Case;
  genre: GenreSurbrillance;
}

/**
 * Couleurs des surbrillances. Le vocabulaire est celui d'Advance Wars, et il
 * tient en une phrase : **vert, j'y vais ; rouge, j'y tire**. Les deux autres
 * genres s'en écartent volontairement — l'or pour un objectif, le bleu pour un
 * chantier —, sans quoi le joueur lirait un ordre là où il n'y en a pas.
 *
 * Les teintes sont franches et froides à dessein. Un vert de prairie posé sur
 * une prairie ne se voit pas : le vert du déplacement tire donc vers l'émeraude,
 * et le rouge vers le carmin, pour rester lisibles sur l'herbe comme sur le
 * sable — les deux fonds qui couvrent l'essentiel d'une carte.
 */
const COULEURS_SURBRILLANCE: Record<GenreSurbrillance, { fond: string; bord: string }> = {
  deplacement: { fond: 'rgba(40,236,150,0.44)', bord: 'rgba(228,255,242,0.85)' },
  attaque: { fond: 'rgba(255,38,64,0.62)', bord: 'rgba(255,222,224,0.9)' },
  capture: { fond: 'rgba(255,198,52,0.46)', bord: 'rgba(255,246,214,0.85)' },
  production: { fond: 'rgba(78,170,255,0.46)', bord: 'rgba(226,243,255,0.85)' },
  danger: { fond: 'rgba(255,60,60,0.3)', bord: 'rgba(255,170,170,0.55)' },
};

/**
 * Assombrissement passé **sous** la teinte. C'est lui qui fait la lisibilité :
 * une case allumée s'enfonce d'un cran par rapport à ses voisines, et la teinte
 * n'a plus qu'à dire laquelle des cinq lectures s'applique.
 */
const OMBRE_SURBRILLANCE = 'rgba(10,26,34,0.32)';

/** Position de rendu d'une unité en cours d'animation, en unités monde. */
export interface PositionAnimee { x: number; y: number; alpha: number }

/** Tout ce dont la scène a besoin pour dessiner une image. */
export interface VueScene {
  etat: EtatPartie;
  catalogue: Catalogue;
  camera: Camera;
  ambiance: Ambiance;
  cache: CacheSprites;
  /** Ratio de pixels courant : il entre dans la finesse des sprites du cache. */
  ratio: number;
  surbrillances: readonly Surbrillance[];
  chemin: readonly Case[];
  curseur: Case | null;
  selection: string | null;
  /** Cases visibles du camp du joueur, ou `null` quand il n'y a pas de brouillard. */
  visibles: ReadonlySet<string> | null;
  /** Positions de rendu des unités animées, par identifiant. */
  animees: ReadonlyMap<string, PositionAnimee>;
  /** Millisecondes écoulées depuis le montage : la seule horloge du rendu. */
  temps: number;
  /** Étiquette dessinée sur le QG, traduite par l'appelant. */
  etiquetteQg: string;
}

/** Vue « carte » d'un état, pour la couche terrain. */
export function carteDe(etat: EtatPartie, cat: Catalogue): CarteRendu {
  return {
    largeur: etat.largeur,
    hauteur: etat.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(etat, cat, { x, y }) ?? 'mer',
  };
}

/** Au-delà, une couche pleine carte coûte plus cher en mémoire qu'en dessin. */
const PIXELS_MAX_COUCHE = 8_000_000;

/** Peint la couche de fond (eau, sable, herbe, routes, grille) dans un pinceau. */
function peindreFond(g: Pinceau, vue: VueScene): void {
  dessinerTerrain(g, carteDe(vue.etat, vue.catalogue), vue.ambiance.palette, graineDe(vue.etat.graine), true);
}

/** Peint la couche de décor (forêts et reliefs) dans un pinceau. */
function peindreDecor(g: Pinceau, vue: VueScene): void {
  const { etat, catalogue } = vue;
  for (let y = 0; y < etat.hauteur; y += 1) {
    for (let x = 0; x < etat.largeur; x += 1) {
      const t = terrainLogique(etat, catalogue, { x, y });
      if (t === 'foret') foret(g, x * TUILE, y * TUILE, vue.ambiance.palette);
      else if (t === 'montagne') relief(g, x * TUILE, y * TUILE, vue.ambiance.palette);
    }
  }
}

/**
 * Dessine une couche pleine carte, en la mettant en cache tant qu'elle rentre
 * dans le budget de pixels. Au-delà, on la peint directement : mieux vaut
 * quelques milliers d'opérations qu'un canvas de cinquante mégaoctets.
 */
function coucheCarte(
  g: Pinceau, vue: VueScene, type: string, peindre: (p: Pinceau) => void,
): void {
  const L = vue.etat.largeur * TUILE;
  const H = vue.etat.hauteur * TUILE;
  const finesse = vue.cache.ratioPixels;
  if (L * finesse * H * finesse > PIXELS_MAX_COUCHE) {
    peindre(g);
    return;
  }
  const cle = cleSprite({
    type,
    // La signature du moteur porte la journée, le climat, les terrains posés et
    // l'état de la mécanique : c'est exactement ce qui peut changer l'image du
    // terrain sans changer la carte. Sans elle, une marée se peignait une fois
    // pour toutes au premier jour.
    cle: `${vue.etat.carteCle}-${fnv1a(signatureTerrain(vue.etat)).toString(36)}`,
    nation: '-',
    ambiance: vue.ambiance.cle,
    zoom: palierZoom(vue.camera.zoom),
  });
  const toile = vue.cache.obtenir(cle, L, H, (p) => peindre(p));
  blitter(g, toile, 0, 0);
}

/** Dessine les surbrillances de déplacement, d'attaque et de capture. */
function dessinerSurbrillances(g: Pinceau, vue: VueScene): void {
  for (const s of vue.surbrillances) {
    const couleurs = COULEURS_SURBRILLANCE[s.genre];
    rr(g, s.case.x * TUILE + 3, s.case.y * TUILE + 3, TUILE - 6, TUILE - 6, 8);
    g.fillStyle = OMBRE_SURBRILLANCE;
    g.fill();
    g.fillStyle = couleurs.fond;
    g.fill();
    g.strokeStyle = couleurs.bord;
    g.lineWidth = 2;
    g.stroke();
  }
}

/** Épaisseur du corps de la flèche de déplacement, en pixels de tuile. */
const CORPS_FLECHE = 11;
/** Longueur de la pointe, mesurée depuis le centre de la case d'arrivée. */
const TETE_FLECHE = 19;
/** Demi-largeur de la base de la pointe. */
const AILE_FLECHE = 15;

/**
 * Dessine le chemin proposé en **flèche**, à la manière d'Advance Wars : un
 * corps coudé qui suit les cases traversées et une pointe sur la case
 * d'arrivée.
 *
 * Deux détails font toute la lisibilité. Le corps s'arrête **avant** la pointe
 * (`TETE_FLECHE`), sinon la jonction s'épaissit en bourrelet ; et tout est peint
 * deux fois, un liseré sombre puis un cœur blanc, pour que la flèche tienne
 * aussi bien sur le vert du déplacement que sur la neige.
 */
function dessinerChemin(g: Pinceau, vue: VueScene): void {
  if (vue.chemin.length < 2) return;
  const centre = (c: Case): { x: number; y: number } => ({
    x: c.x * TUILE + TUILE / 2, y: c.y * TUILE + TUILE / 2,
  });
  const points = vue.chemin.map(centre);
  const fin = points[points.length - 1];
  const precedent = points[points.length - 2];
  if (!fin || !precedent) return;

  // Direction du dernier pas : le chemin est orthogonal, donc un seul axe bouge.
  const dx = Math.sign(fin.x - precedent.x);
  const dy = Math.sign(fin.y - precedent.y);
  const corps = [...points.slice(0, -1), { x: fin.x - dx * TETE_FLECHE, y: fin.y - dy * TETE_FLECHE }];

  const tracerCorps = (): void => {
    g.beginPath();
    corps.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  };
  const tracerTete = (): void => {
    const bx = fin.x - dx * TETE_FLECHE;
    const by = fin.y - dy * TETE_FLECHE;
    g.beginPath();
    // Perpendiculaire au dernier pas : (dx, dy) → (−dy, dx).
    g.moveTo(fin.x + dx * 4, fin.y + dy * 4);
    g.lineTo(bx - dy * AILE_FLECHE, by + dx * AILE_FLECHE);
    g.lineTo(bx + dy * AILE_FLECHE, by - dx * AILE_FLECHE);
    g.closePath();
  };

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Liseré sombre, corps et pointe d'un seul trait de contour.
  g.strokeStyle = 'rgba(16,38,28,0.72)';
  g.lineWidth = CORPS_FLECHE + 6;
  tracerCorps();
  g.stroke();
  tracerTete();
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = 'rgba(16,38,28,0.72)';
  g.fill();
  // Cœur clair.
  g.strokeStyle = '#f4fff6';
  g.lineWidth = CORPS_FLECHE;
  tracerCorps();
  g.stroke();
  tracerTete();
  g.fillStyle = '#f4fff6';
  g.fill();
  g.restore();
}

/** Dessine les bâtiments, chacun blitté depuis le cache par terrain et nation. */
function dessinerBatiments(g: Pinceau, vue: VueScene): void {
  const { etat, catalogue } = vue;
  const fenetre = casesVisibles(vue.camera, etat);
  for (let y = fenetre.y0; y <= fenetre.y1; y += 1) {
    for (let x = fenetre.x0; x <= fenetre.x1; x += 1) {
      const t = terrainLogique(etat, catalogue, { x, y });
      if (t !== 'ville' && t !== 'usine' && t !== 'aeroport' && t !== 'qg') continue;
      const camp = etat.proprietaires[cleCase({ x, y })] ?? null;
      const nation = nationDe(camp);
      const cle = cleSprite({
        type: 'batiment',
        cle: t,
        nation,
        ambiance: vue.ambiance.cle,
        zoom: palierZoom(vue.camera.zoom),
      });
      const toile = vue.cache.obtenir(cle, TUILE + 16, TUILE + 16, (p) => {
        p.save();
        p.translate(8, 8);
        batiment(p, t, 0, 0, paletteDe(camp), vue.ambiance.palette, vue.etiquetteQg);
        p.restore();
      });
      blitter(g, toile, x * TUILE - 8, y * TUILE - 8);
      if (vue.ambiance.villesEclairees) halo(g, x * TUILE, y * TUILE, vue.ambiance.palette);
    }
  }
}

/** Position de rendu d'une unité : sa case, ou sa position animée. */
function positionDe(vue: VueScene, u: Unite): PositionAnimee {
  const animee = vue.animees.get(u.id);
  if (animee) return animee;
  return { x: u.x * TUILE + TUILE / 2, y: u.y * TUILE + TUILE / 2, alpha: 1 };
}

/** Dessine une unité et ses étiquettes de PV et de capture. */
function dessinerUnitePosee(g: Pinceau, vue: VueScene, u: Unite): void {
  const type = vue.catalogue.unites[u.type];
  if (!type) return;
  const pos = positionDe(vue, u);
  const nation = nationDe(u.camp);
  const cle = cleSprite({
    type: 'silhouette',
    cle: cleSilhouette(type.silhouette),
    nation,
    ambiance: vue.ambiance.cle,
    zoom: palierZoom(vue.camera.zoom),
  });
  const toile = vue.cache.obtenir(cle, TUILE + 24, TUILE + 24, (p) => {
    p.save();
    p.translate((TUILE + 24) / 2, (TUILE + 24) / 2);
    ombre(p, true, 7, 3);
    dessinerUnite(p, type.silhouette, paletteDe(u.camp));
    ombre(p, false);
    p.restore();
  });

  const opacite = pos.alpha * (u.etat === 'agi' && u.camp === vue.etat.campCourant ? 0.62 : 1);
  const avant = g.globalAlpha;
  g.globalAlpha = avant * opacite;
  blitter(g, toile, pos.x - (TUILE + 24) / 2, pos.y - (TUILE + 24) / 2);
  g.globalAlpha = avant;

  // Sélection : un anneau clair sous l'unité choisie.
  if (vue.selection === u.id) {
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(pos.x, pos.y + 16, 22, 8, 0, 0, Math.PI * 2);
    g.stroke();
  }

  const pv = pvAffiches(u.pv);
  const px = pos.x - TUILE / 2;
  const py = pos.y - TUILE / 2;
  if (pv < 10) {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    rr(g, px + 44, py + 46, 17, 15, 4);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(String(pv), px + 52.5, py + 57);
    g.textAlign = 'left';
  }
  if (u.pointsCapture > 0) {
    // La jauge porte la couleur du camp **qui capture**. Elle était peinte en
    // `#8ee0a4`, c'est-à-dire le clair du camp vert : une unité rouge affichait
    // une progression verte.
    g.fillStyle = 'rgba(20,24,34,0.75)';
    rr(g, px + 4, py + 46, 20, 14, 4);
    g.fill();
    g.fillStyle = paletteDe(u.camp).light;
    rr(g, px + 6, py + 48, Math.max(2, 16 * Math.min(1, u.pointsCapture / 20)), 10, 3);
    g.fill();
  }
  if (u.cargo.length > 0) {
    disque(g, px + 12, py + 14, 5, 'rgba(20,24,34,0.75)');
    disque(g, px + 12, py + 14, 2.5, '#ffffff');
  }
}

/** Le curseur : le double liseré blanc de la démo. */
function dessinerCurseur(g: Pinceau, c: Case, temps: number): void {
  const pulsation = 0.75 + 0.25 * Math.sin(temps / 320);
  g.strokeStyle = `rgba(255,255,255,${0.35 * pulsation})`;
  g.lineWidth = 7;
  rr(g, c.x * TUILE + 2, c.y * TUILE + 2, TUILE - 4, TUILE - 4, 8);
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  rr(g, c.x * TUILE + 2, c.y * TUILE + 2, TUILE - 4, TUILE - 4, 8);
  g.stroke();
}

/** Le brouillard : les cases jamais vues sont sombres, les cases hors vue voilées. */
function dessinerBrouillard(g: Pinceau, vue: VueScene): void {
  const visibles = vue.visibles;
  if (!visibles) return;
  const fenetre = casesVisibles(vue.camera, vue.etat);
  g.fillStyle = 'rgba(10,14,26,0.36)';
  for (let y = fenetre.y0; y <= fenetre.y1; y += 1) {
    for (let x = fenetre.x0; x <= fenetre.x1; x += 1) {
      if (visibles.has(`${x},${y}`)) continue;
      g.fillRect(x * TUILE, y * TUILE, TUILE, TUILE);
    }
  }
}

/**
 * Les particules d'ambiance, dessinées en coordonnées d'**écran** : la pluie
 * tombe sur la fenêtre, pas sur le monde, et ne bouge donc pas au glisser.
 */
export function dessinerParticules(g: Pinceau, vue: VueScene): void {
  const { particules } = vue.ambiance;
  if (particules.type === 'aucune' || particules.densite <= 0) return;
  const L = vue.camera.vue.largeur;
  const H = vue.camera.vue.hauteur;
  const nombre = Math.round((L * H) / 9000 * particules.densite);
  const t = vue.temps / 1000;
  g.save();
  if (particules.type === 'brume') {
    g.fillStyle = alpha('#e8f0f4', 0.05);
    for (let i = 0; i < Math.min(28, nombre); i += 1) {
      const x = ((i * 271 + t * particules.vent) % (L + 260)) - 130;
      const y = (i * 173) % H;
      g.beginPath();
      g.ellipse(x, y, 150, 34, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  for (let i = 0; i < nombre; i += 1) {
    const base = i * 9781;
    const x0 = base % (L + 200);
    const y0 = (base * 7) % H;
    const y = (y0 + t * particules.vitesse) % (H + 40);
    const x = ((x0 + t * particules.vent) % (L + 200)) - 100;
    if (particules.type === 'neige') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x + Math.sin(t + i) * 6, y, 2.2, 0, Math.PI * 2);
      g.fill();
    } else if (particules.type === 'poussiere') {
      g.fillStyle = 'rgba(255,226,160,0.35)';
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = 'rgba(200,225,255,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 3, y + 12);
      g.stroke();
    }
  }
  g.restore();
}

/**
 * Dessine une image complète de la scène, hors HUD. Le pinceau est laissé dans
 * l'état où il a été reçu : la caméra est posée et retirée ici.
 */
export function dessinerScene(g: Pinceau, vue: VueScene): void {
  const { camera, ambiance } = vue;
  g.save();
  g.fillStyle = ambiance.palette.eauBas;
  g.fillRect(0, 0, camera.vue.largeur, camera.vue.hauteur);

  g.translate(camera.vue.largeur / 2, camera.vue.hauteur / 2);
  g.scale(camera.zoom, camera.zoom);
  g.translate(-camera.x, -camera.y);

  coucheCarte(g, vue, 'fond', (p) => peindreFond(p, vue));
  dessinerSurbrillances(g, vue);
  coucheCarte(g, vue, 'decor', (p) => peindreDecor(p, vue));
  dessinerBatiments(g, vue);

  if (ambiance.voile) {
    g.fillStyle = alpha(ambiance.voile.couleur, ambiance.voile.alpha);
    g.fillRect(0, 0, vue.etat.largeur * TUILE, vue.etat.hauteur * TUILE);
  }

  dessinerChemin(g, vue);

  const ordonnees = [...vue.etat.unites]
    .filter((u) => !u.dansTransport)
    .filter((u) => !vue.visibles || vue.visibles.has(cleCase({ x: u.x, y: u.y })) || vue.animees.has(u.id))
    .sort((a, b) => positionDe(vue, a).y - positionDe(vue, b).y);
  for (const u of ordonnees) dessinerUnitePosee(g, vue, u);

  if (vue.curseur) dessinerCurseur(g, vue.curseur, vue.temps);
  dessinerBrouillard(g, vue);
  g.restore();

  dessinerParticules(g, vue);
}
