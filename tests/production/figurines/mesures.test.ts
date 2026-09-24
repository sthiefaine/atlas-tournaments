// Les mesures d'une figurine, sur des images construites à la main : la
// composition du nuanceur du jeu, la part d'équipe (couverture et masque),
// l'emprise depuis le pivot, la réduction à 48 pixels, les zones d'un seul
// tenant, l'agitation, les identifiants, et le verdict des règles.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHARTE } from '../../../scripts/production/figurines/charte';
import {
  agitation, classeDe, composantes, composer, emprise, empriseIds, equipeConnexe, fondUni, genreDe, iou, masseSombreEnBas, partEquipe, partEquipeEclairee,
  partsTeintes, pixelsTournants, reduireCadre, regles, silhouette, teinteDuPixel,
  type Cadre, type ImageIds, type Mesures,
} from '../../../scripts/production/figurines/mesures';

/** Un cadre `l × h`, pivot (`px`, `py`), rempli par une fonction : [r, g, b, a, masque, couverture]. */
function cadre(l: number, h: number, px: number, py: number, f: (x: number, y: number) => number[]): Cadre {
  const rgba = new Uint8Array(l * h * 4);
  const masque = new Uint8Array(l * h);
  const couverture = new Uint8Array(l * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [r, g, b, a, m, c] = f(x, y);
      const p = y * l + x;
      rgba.set([r!, g!, b!, a!], p * 4);
      masque[p] = m!;
      couverture[p] = c!;
    }
  }
  return { l, h, px, py, rgba, masque, couverture };
}

test('la composition est celle du nuanceur : c · a · mix(1, équipe, m) + fond · (1 − a)', () => {
  const c = cadre(2, 1, 0, 0, (x) => (x === 0 ? [255, 255, 255, 255, 255, 255] : [204, 102, 51, 128, 0, 255]));
  const f = fondUni(2, 1, [0.2, 0.4, 0.6]);
  composer(f, c, 0, 0, [0.25, 0.5, 1]);
  // Blanc sous un masque plein : la couleur d'équipe, exactement.
  assert.deepEqual([...f.rvb.subarray(0, 3)].map((v) => Number(v.toFixed(4))), [0.25, 0.5, 1]);
  // À demi transparent, sans masque : la couleur cuite posée à moitié sur le fond.
  const a = 128 / 255;
  assert.deepEqual([...f.rvb.subarray(3, 6)].map((v) => Number(v.toFixed(4))), [0.8 * a + 0.2 * (1 - a), 0.4 * a + 0.4 * (1 - a), 0.2 * a + 0.6 * (1 - a)].map((v) => Number(v.toFixed(4))));
});

test('le miroir retourne l’image autour du pivot, comme `empaqueter`', () => {
  // Une image de 4 × 1, pivot à 1 : le pixel rouge est à gauche du pivot, le vert à droite.
  const c = cadre(4, 1, 1, 0, (x) => (x === 0 ? [255, 0, 0, 255, 0, 255] : x === 3 ? [0, 255, 0, 255, 0, 255] : [0, 0, 0, 0, 0, 0]));
  const droit = fondUni(8, 1, [0, 0, 0]);
  composer(droit, c, 4, 0, null);
  assert.equal(droit.rvb[3 * 3], 1, 'rouge juste à gauche du pivot');
  assert.equal(droit.rvb[6 * 3 + 1], 1, 'vert deux pixels à droite');
  const miroir = fondUni(8, 1, [0, 0, 0]);
  composer(miroir, c, 4, 0, null, true);
  assert.equal(miroir.rvb[4 * 3], 1, 'rouge juste à droite du pivot');
  assert.equal(miroir.rvb[1 * 3 + 1], 1, 'vert à gauche');
});

test('la part d’équipe se compte sur le modèle, jamais sur le contour ni sur l’ombre', () => {
  // 10 pixels : 4 d'équipe, 2 de modèle neutre, 3 de contour (alpha plein, sans couverture), 1 vide.
  const c = cadre(10, 1, 0, 0, (x) => (x < 4 ? [255, 255, 255, 255, 255, 255] : x < 6 ? [60, 60, 60, 255, 0, 255] : x < 9 ? [21, 24, 29, 255, 0, 0] : [0, 0, 0, 0, 0, 0]));
  assert.deepEqual(partEquipe(c), { modele: 6, equipe: 4, part: 4 / 6 });
  // Cuites en blanc, les zones d'équipe disent la lumière reçue.
  assert.equal(partEquipeEclairee(c, 0.8), 1);
});

test('l’emprise se mesure depuis le pivot', () => {
  const c = cadre(20, 10, 8, 9, (x, y) => (x >= 2 && x < 17 && y >= 1 && y < 10 ? [0, 0, 0, 255, 0, 255] : [0, 0, 0, 0, 0, 0]));
  assert.deepEqual(emprise(c), { gauche: 6, droite: 9, dessus: 8, dessous: 1, largeur: 15, hauteur: 9 });
  assert.equal(emprise(cadre(3, 3, 1, 1, () => [0, 0, 0, 0, 0, 0])), null);
});

test('la réduction à 48 pixels moyenne les aires en prémultiplié, et garde le pivot sur un pixel', () => {
  // 8 × 8 blanc opaque à gauche, transparent à droite ; pivot au centre.
  const c = cadre(8, 8, 4, 4, (x) => (x < 4 ? [255, 255, 255, 255, 255, 255] : [0, 0, 0, 0, 0, 0]));
  const r = reduireCadre(c, 0.5);
  assert.equal(r.px, 2);
  assert.equal(r.py, 2);
  const a = (x: number, y: number) => r.rgba[(y * r.l + x) * 4 + 3];
  assert.equal(a(0, 0), 255);
  assert.equal(a(1, 1), 255);
  assert.equal(a(2, 1), 0);
  // La couleur d'un pixel à moitié couvert reste blanche (prémultipliée), son alpha est de moitié :
  // trois colonnes blanches sur quatre, le pixel réduit de droite en couvre une blanche et une vide.
  const bord = reduireCadre(cadre(4, 4, 2, 2, (x) => (x < 3 ? [255, 255, 255, 255, 0, 255] : [0, 0, 0, 0, 0, 0])), 0.5);
  const i = (0 * bord.l + bord.px) * 4;
  assert.deepEqual([...bord.rgba.subarray(i, i + 4)], [255, 255, 255, 128]);
  assert.deepEqual([...bord.rgba.subarray(i - 4, i)], [255, 255, 255, 255]);
});

test('les zones d’un seul tenant se comptent en 8-voisinage', () => {
  const b = new Uint8Array([
    1, 1, 0, 0, 0,
    0, 1, 0, 0, 1,
    0, 0, 1, 0, 1,
    0, 0, 0, 0, 1,
  ]);
  assert.deepEqual(composantes(b, 5, 4), { plusGrande: 4, total: 7, nombre: 2 });
  // Une équipe en deux bandes égales : la plus grande n'en porte que la moitié.
  const c = cadre(16, 16, 8, 8, (x) => (x < 5 || x >= 11 ? [255, 255, 255, 255, 255, 255] : [60, 60, 60, 255, 0, 255]));
  assert.ok(Math.abs(equipeConnexe(c, 0.5) - 0.5) < 0.01);
  const plein = cadre(16, 16, 8, 8, () => [255, 255, 255, 255, 255, 255]);
  assert.equal(equipeConnexe(plein, 0.375), 1);
});

test('l’agitation : nulle sur des images égales, mesurée sur ce qui bouge, sans ce qu’on exclut', () => {
  const carre = (dx: number) => cadre(12, 12, 6, 6, (x, y) => (x >= 2 + dx && x < 8 + dx && y >= 2 && y < 8 ? [40, 40, 40, 255, 0, 255] : [0, 0, 0, 0, 0, 0]));
  const fond: readonly [number, number, number] = [0.55, 0.66, 0.41];
  assert.deepEqual(agitation([carre(0), carre(0), carre(0)], [0.25, 0.5, 0.9], fond, 24, true), { moyenne: 0, pire: 0 });
  // Un pas d'un pixel : deux colonnes de six changent, sur une union de 7 × 6.
  const r = agitation([carre(0), carre(1)], [0.25, 0.5, 0.9], fond, 24, false);
  assert.ok(Math.abs(r.pire - 12 / 42) < 1e-9, String(r.pire));
  // Les pièces tournantes déclarées ne comptent pas.
  const sans = agitation([carre(0), carre(1)], [0.25, 0.5, 0.9], fond, 24, false, () => true);
  assert.equal(sans.pire, 0);
});

test('les identifiants disent la teinte (R) et la pièce tournante (G), autour du pivot', () => {
  assert.equal(teinteDuPixel(10, 255), 0);
  assert.equal(teinteDuPixel(40, 255), 3);
  assert.equal(teinteDuPixel(40, 0), -1);
  // 4 × 2, pivot au pixel (2, 1) : deux pixels d'équipe en haut, un graphite et un graphite tournant en bas.
  const rgba = new Uint8Array([
    10, 0, 0, 255, 10, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 20, 0, 0, 255, 20, 255, 0, 255, 0, 0, 0, 0,
  ]);
  const ids: ImageIds = { l: 4, h: 2, x0: -2, y0: -1, rgba };
  const p = partsTeintes(ids, CHARTE);
  assert.equal(p.total, 4);
  assert.deepEqual(p.parts, { equipe: 0.5, graphite: 0.5 });
  assert.ok(p.centreY['graphite']! > p.centreY['equipe']!);
  assert.deepEqual([...pixelsTournants([ids])], ['0,0']);
  assert.deepEqual(empriseIds(ids), { gauche: 2, droite: 1, dessus: 1, largeur: 3, hauteur: 2 });
});

test('la masse sombre tient le bas sans compter les pièces qui tournent : un rotor graphite, en haut, ne la tire pas', () => {
  // 1 × 4, pivot en bas : en haut un rotor graphite (G = 255), puis deux pixels d'équipe, en bas un patin graphite.
  const rgba = new Uint8Array([20, 255, 0, 255, 10, 0, 0, 255, 10, 0, 0, 255, 20, 0, 0, 255]);
  const p = partsTeintes({ l: 1, h: 4, x0: 0, y0: -4, rgba }, CHARTE);
  assert.deepEqual(p.parts, { graphite: 0.5, equipe: 0.5 }, 'la palette compte tout, rotor compris');
  assert.deepEqual(p.partsFixes, { graphite: 1 / 3, equipe: 2 / 3 });
  assert.equal(p.centreYFixe['graphite'], 3);
  // Compté, le rotor mettait le centre sombre au milieu (1,5 contre 1,5) ; sans lui, le sombre est en bas.
  assert.ok(masseSombreEnBas(p, ['graphite', 'caoutchouc']));
  const sansTourner = partsTeintes({ l: 1, h: 4, x0: 0, y0: -4, rgba: rgba.map((v, i) => (i === 1 ? 0 : v)) }, CHARTE);
  assert.ok(!masseSombreEnBas(sansTourner, ['graphite', 'caoutchouc']), 'un rotor fixe, lui, compte');
});

test('l’ombre chinoise à 48 pixels : la silhouette calée sur le pivot, et l’intersection sur l’union', () => {
  // Un carré plein de 16 × 16 pixels cuits, pivot au milieu de son bas : 6 × 6 à 48 pixels par case.
  const carre = (l: number, h: number, px: number, py: number, x0: number, y0: number, cote: number): Cadre =>
    cadre(l, h, px, py, (x, y) => (x >= x0 && x < x0 + cote && y >= y0 && y < y0 + cote ? [0, 0, 0, 255, 0, 255] : [0, 0, 0, 0, 0, 0]));
  const a = silhouette(carre(16, 16, 8, 16, 0, 0, 16), 48, 128);
  assert.equal(a.size, 36);
  // Le même carré sur un autre canevas, au même endroit depuis le pivot : la même silhouette.
  const b = silhouette(carre(40, 30, 20, 26, 12, 10, 16), 48, 128);
  assert.equal(iou(a, b), 1);
  // Décalé d'une demi-largeur : un tiers en commun.
  const c = silhouette(carre(40, 30, 20, 26, 20, 10, 16), 48, 128);
  assert.ok(Math.abs(iou(a, c) - 1 / 3) < 0.05, String(iou(a, c)));
  assert.equal(iou(a, new Set()), 0);
  // La règle n'est qu'une information, et elle nomme la plus proche.
  const r = regles({ ...bonnes(), recouvrement: { unite: 'char_moyen', vue: 'droite', valeur: 0.86, droite: 0.86, bas: 0.7 } }, CHARTE);
  const regle = r.find((x) => x.id === 'recouvrement')!;
  assert.equal(regle.verdict, 'info');
  assert.match(String(regle.valeur), /0\.860 char_moyen \(droite\)/);
  assert.match(regle.attendu, /0\.80/);
  assert.ok(!regles(bonnes(), CHARTE).some((x) => x.id === 'recouvrement'), 'sans cuisson, pas de règle');
});

test('une cuisson qui a perdu des faces fait échouer la fabrication', () => {
  const regle = (anomaliesCuisson: string[] | undefined) => regles({ ...bonnes(), ...(anomaliesCuisson ? { anomaliesCuisson } : {}) }, CHARTE)
    .find((x) => x.id === 'cuisson_entiere');
  assert.equal(regle(undefined), undefined, 'sans cuisson, pas de règle');
  assert.equal(regle([])!.verdict, 'ok');
  const r = regle(['bas/deplacement, toute l\'animation : masque médian 0.00 pour 0.45 dans l\'animation la plus équipée'])!;
  assert.equal(r.verdict, 'echec');
  assert.match(String(r.valeur), /^1 : bas\/deplacement/);
});

test('le genre et la classe se lisent dans le canon', () => {
  assert.equal(genreDe({ domaine: 'terre', silhouette: { base: 'pattes' } }), 'fantassin');
  assert.equal(genreDe({ domaine: 'air', traits: ['vol'], silhouette: { base: 'rotor' } }), 'rotor');
  assert.equal(genreDe({ domaine: 'air', traits: ['vol'], silhouette: { base: 'ailes' } }), 'avion');
  assert.equal(genreDe({ domaine: 'air', traits: ['vol', 'drone', 'anti_air'], silhouette: { base: 'ailes' } }), 'drone');
  // Le veilleur des Gris : un drone qui ne le dit pas dans sa clé — c'est le trait qui compte.
  assert.equal(genreDe({ domaine: 'air', traits: ['vol', 'drone', 'brouilleur'], silhouette: { base: 'rotor' } }), 'drone');
  assert.equal(genreDe({ domaine: 'mer', traits: ['drone'], silhouette: { base: 'coque' } }), 'navire');
  assert.equal(genreDe({ domaine: 'terre', silhouette: { base: 'chenilles' } }), 'vehicule');
  assert.deepEqual([1, 2, 3].map(classeDe), ['petite', 'moyenne', 'grande']);
});

/** Des mesures qui passent toutes les règles d'un véhicule moyen. */
function bonnes(): Mesures {
  return {
    cle: 'char_leger', genre: 'vehicule', classe: 'moyenne', gris: false, largeurVisee: { min: 0.76, max: 0.79 },
    equipe: { droite: 0.55, bas: 0.5, haut: 0.6, profil: 0.4 }, equipeEclairee: 0.7, equipeConnexe: 0.95,
    largeurDroite: 0.78, hauteurDroite: 0.6, debordLateral: 0.4, hauteurAuDessusPivot: 0.5,
    agitation: { moyenne: 0.005, pire: 0.01 }, clarteHorsEquipe: 35,
    palette: { parts: { equipe: 0.55, graphite: 0.12, caoutchouc: 0.2, os: 0.09, acier_clair: 0.02 }, sombreEnBas: true },
    equipeIds: 0.56, triangles: 14000, materiaux: { trouves: ['mat_corps', 'mat_details'], attendus: ['mat_corps', 'mat_details'], max: 3 },
    teintes: ['equipe', 'graphite', 'caoutchouc', 'os', 'acier_clair'], piecesFines: [{ nom: 'antenne', epaisseur: 0.03, fin: true }],
    rotationRepos: { antenne: 1.6 }, tournants: [], basAuRepos: 0, controle: { ok: true, motifs: 0 },
  };
}

test('des mesures dans la charte passent toutes ses règles', () => {
  const r = regles(bonnes(), CHARTE);
  assert.deepEqual(r.filter((x) => x.verdict === 'echec').map((x) => x.id), []);
  assert.ok(r.some((x) => x.id === 'largeur_visee'));
  assert.ok(r.filter((x) => x.verdict === 'info').every((x) => ['equipe_profil', 'clarte_hors_equipe', 'debord_case', 'recouvrement'].includes(x.id)));
});

test('chaque écart à la charte tombe sur sa règle', () => {
  const echecs = (m: Partial<Mesures>): string[] => regles({ ...bonnes(), ...m }, CHARTE).filter((x) => x.verdict === 'echec').map((x) => x.id);
  assert.deepEqual(echecs({ equipe: { droite: 0.69, bas: 0.5, haut: 0.6, profil: null }, equipeIds: 0.69 }), ['equipe_droite']);
  assert.deepEqual(echecs({ equipe: { droite: 0.55, bas: 0.3, haut: 0.6, profil: null } }), ['equipe_bas']);
  assert.deepEqual(echecs({ largeurDroite: 0.85 }), ['largeur', 'largeur_visee']);
  assert.deepEqual(echecs({ debordLateral: 0.5 }), ['debord_lateral']);
  assert.deepEqual(echecs({ hauteurAuDessusPivot: 0.75 }), ['hauteur_pivot']);
  assert.deepEqual(echecs({ agitation: { moyenne: 0.1, pire: 0.155 } }), ['repos_agitation']);
  assert.deepEqual(echecs({ rotationRepos: { tourelle: 3 } }), ['repos_rotation']);
  assert.deepEqual(echecs({ rotationRepos: { radar: 180 }, tournants: ['radar'] }), [], 'une pièce tournante déclarée tourne');
  assert.deepEqual(echecs({ piecesFines: [{ nom: 'grille', epaisseur: 0.02, fin: false }] }), ['epaisseur']);
  assert.deepEqual(echecs({ teintes: ['equipe', 'graphite', 'caoutchouc', 'os', 'acier_clair', 'verre', 'feux'] }), ['teintes']);
  assert.deepEqual(echecs({ palette: { parts: { equipe: 0.6, graphite: 0.05, caoutchouc: 0.1, os: 0.2 }, sombreEnBas: false } }),
    ['palette_sombre', 'palette_os', 'palette_sombre_en_bas']);
  assert.deepEqual(echecs({ equipeIds: 0.8 }), ['equipe_coherente']);
  assert.deepEqual(echecs({ controle: { ok: false, motifs: 2 } }), ['controle_fiche']);
  // Un appareil : sa propre altitude, sa propre agitation, sa propre hauteur.
  assert.deepEqual(echecs({ genre: 'rotor', basAuRepos: 0.2, agitation: { moyenne: 0.1, pire: 0.12 }, hauteurAuDessusPivot: 0.8 }), []);
  assert.deepEqual(echecs({ genre: 'rotor', basAuRepos: 0.3 }), ['altitude']);
  // Un fantassin : sa part d'équipe et ses deux dimensions ; l'équipe éclairée n'est qu'une information.
  assert.deepEqual(echecs({ genre: 'fantassin', equipe: { droite: 0.42, bas: 0.5, haut: 0.5, profil: null }, equipeIds: 0.42, equipeEclairee: 0.3,
    largeurDroite: 0.5, hauteurDroite: 0.7, largeurVisee: undefined }), []);
  assert.deepEqual(echecs({ genre: 'fantassin', largeurDroite: 0.3, hauteurDroite: 0.6, largeurVisee: undefined }), ['largeur', 'hauteur']);
  // Les Gris : l'orange et l'apprêt se mesurent, pour eux seulement.
  assert.ok(regles({ ...bonnes(), gris: true }, CHARTE).some((x) => x.id === 'palette_orange' && x.verdict === 'echec'));
  assert.ok(!regles(bonnes(), CHARTE).some((x) => x.id === 'palette_orange'));
});
