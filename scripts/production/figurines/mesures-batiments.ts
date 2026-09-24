/**
 * Les mesures d'un bâtiment cuit, et leur verdict contre la charte
 * (`charte.json`, `batiments` ; `doc/refonte/plan-batiments.md` §5, qui fait
 * foi). Pur, comme `mesures.ts`, dont ce module reprend la composition et les
 * mesures d'image : ce qui change pour un bâtiment, c'est ce qu'on regarde.
 *
 * - **Une seule vue**, `fixe` : le bâtiment regarde le joueur et ne se
 *   retourne pas. Son **ombre est cuite au sol** : l'alpha la compte, la page
 *   de couverture non — toute mesure de forme se prend donc sur la couverture,
 *   élargie de l'anneau du contour, jamais sur l'alpha.
 * - **L'équipe est le toit** : 30 à 45 % du bâtiment, éclairée.
 * - **Le coin du mât** reste libre (mesuré dans Blender, `fabriquer.py`).
 * - **Les fenêtres** s'allument en service et s'éteignent au désaffecté : la
 *   page d'émission le dit.
 * - **Rien ne bouge au repos**, hors une pièce déclarée mobile.
 */

import type { Bornes, Charte } from './charte';
import type { ClipFigurine } from './lot';
import type { Cadre, Regle } from './mesures';

/** Le genre d'une figurine de la vague des bâtiments : un bâtiment, ou le pont (un terrain, sans équipe ni mât). */
export type GenreBatiment = 'batiment' | 'pont';

/**
 * L'emprise du **modèle** dans une image cuite (couverture ≥ `seuil` : ni
 * l'ombre ni le contour), élargie de `anneau` pixels de chaque côté — le
 * contour cuit, que la couverture ne voit pas. Depuis le pivot, en pixels.
 */
export function empriseModele(c: Cadre, anneau: number, seuil = 128): { gauche: number; droite: number; dessus: number; dessous: number; largeur: number; hauteur: number } | null {
  if (!c.couverture) throw new Error('emprise d’un bâtiment sans page de couverture');
  let x0 = c.l;
  let x1 = -1;
  let y0 = c.h;
  let y1 = -1;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.l; x++) {
      if (c.couverture[y * c.l + x]! < seuil) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  return {
    gauche: c.px - x0 + anneau, droite: x1 + 1 - c.px + anneau, dessus: c.py - y0 + anneau, dessous: y1 + 1 - c.py + anneau,
    largeur: x1 - x0 + 1 + 2 * anneau, hauteur: y1 - y0 + 1 + 2 * anneau,
  };
}

/**
 * Les fenêtres allumées : parmi les pixels du modèle (couverture ≥ 128), la
 * part dont l'émission cuite (le plus fort de ses trois canaux) atteint
 * `seuil`. Zéro sans page d'émission.
 */
export function partEmission(c: Cadre, seuil: number): number {
  if (!c.couverture) throw new Error('émission d’un bâtiment sans page de couverture');
  let modele = 0;
  let allumes = 0;
  for (let p = 0; p < c.l * c.h; p++) {
    if (c.couverture[p]! < 128) continue;
    modele++;
    if (c.emission && Math.max(c.emission[p * 3]!, c.emission[p * 3 + 1]!, c.emission[p * 3 + 2]!) >= seuil) allumes++;
  }
  return modele ? allumes / modele : 0;
}

/** L'écart d'un nœud à sa pose de repos pendant le clip `repos`. */
export interface EcartRepos {
  noeud: string;
  /** La plus grande distance à la translation de repos, en mètres. */
  translation: number;
  /** Le plus grand angle, en degrés. */
  rotation: number;
  /** Le plus grand écart d'échelle à 1. */
  echelle: number;
}

/**
 * Ce que le clip `repos` fait bouger, nœud par nœud, hors des nœuds mobiles
 * ou tournants (`noeuds[].mobile`, `tournant`) : les pistes échantillonnées
 * par `bibliotheque.py` (valeurs absolues) contre la pose de repos de chaque
 * nœud (sa translation, aucune rotation, l'échelle 1). Vide pour un repos
 * immobile — ou sans clip de repos (le pont n'a aucun clip).
 */
export function ecartsRepos(clips: readonly ClipFigurine[],
  noeuds: readonly { nom: string; translation: readonly number[]; tournant: boolean; mobile?: boolean }[]): EcartRepos[] {
  const repos = clips.find((c) => c.nom === 'repos');
  if (!repos) return [];
  const parNom = new Map(noeuds.map((n) => [n.nom, n]));
  const ecarts = new Map<string, EcartRepos>();
  for (const p of repos.pistes) {
    const n = parNom.get(p.noeud);
    if (!n || n.tournant || n.mobile) continue;
    const e = ecarts.get(p.noeud) ?? { noeud: p.noeud, translation: 0, rotation: 0, echelle: 0 };
    for (const v of p.valeurs) {
      if (p.chemin === 'translation') e.translation = Math.max(e.translation, Math.hypot(v[0]! - n.translation[0]!, v[1]! - n.translation[1]!, v[2]! - n.translation[2]!));
      else if (p.chemin === 'rotation') e.rotation = Math.max(e.rotation, (2 * Math.acos(Math.min(1, Math.abs(v[3]!))) * 180) / Math.PI);
      else e.echelle = Math.max(e.echelle, ...v.map((s) => Math.abs(s - 1)));
    }
    ecarts.set(p.noeud, e);
  }
  return [...ecarts.values()].filter((e) => e.translation > 0 || e.rotation > 0 || e.echelle > 0);
}

/** Un bâtiment installé, pour la comparaison des hauteurs. */
export interface BatimentInstalle { id: string; cle: string; hauteur: number }

/**
 * « Le QG est le plus haut bâtiment du jeu » (charte §3.12) : la hauteur du
 * modèle (le haut de son emprise au repos, en mètres) contre les bâtiments
 * **figurines** déjà installés d'une autre clé — ceux d'avant la charte ne
 * disent rien de celle-ci. Un QG doit les dépasser tous ; un autre bâtiment
 * rester sous le plus bas des QG. Sans rien à comparer, une information.
 */
export function verdictHauteurQg(cle: string, hauteur: number, installes: readonly BatimentInstalle[]): { ok: boolean | null; texte: string } {
  const autres = installes.filter((b) => b.cle !== cle);
  const m = (v: number): string => `${v.toFixed(3)} m`;
  if (cle === 'qg') {
    const rivaux = autres.filter((b) => b.cle !== 'qg');
    if (!rivaux.length) return { ok: null, texte: `${m(hauteur)} ; aucun autre bâtiment figurine installé` };
    const plus = rivaux.reduce((a, b) => (b.hauteur > a.hauteur ? b : a));
    return { ok: hauteur > plus.hauteur, texte: `${m(hauteur)} ; le plus haut des autres : ${plus.id} ${m(plus.hauteur)}` };
  }
  const qgs = autres.filter((b) => b.cle === 'qg');
  if (!qgs.length) return { ok: null, texte: `${m(hauteur)} ; aucun QG figurine installé` };
  const bas = qgs.reduce((a, b) => (b.hauteur < a.hauteur ? b : a));
  return { ok: hauteur < bas.hauteur, texte: `${m(hauteur)} ; le plus bas des QG : ${bas.id} ${m(bas.hauteur)}` };
}

/** Ce que les règles d'un bâtiment lisent. */
export interface MesuresBatiment {
  id: string;
  cle: string;
  etat: string;
  variante: string;
  genre: GenreBatiment;
  /** La superusine des Gris : son emprise va jusqu'à 0,6 case, et elle seule porte de l'orange. */
  superusine: boolean;
  /** Part d'équipe, vue fixe, première image du repos (modèle seul). */
  equipe: number;
  equipeEclairee: number;
  equipeConnexe: number;
  /** Part d'équipe des identifiants, vue fixe ; null sans identifiants. */
  equipeIds: number | null;
  /** Débord latéral depuis le pivot, contour compris, toutes les images de carte, en cases. */
  debordLateral: number;
  /** Hauteur au-dessus du pivot, contour compris, toutes les images de carte, en cases. */
  hauteurAuDessusPivot: number;
  /** Largeur de la silhouette, vue fixe, contour compris, en cases (information). */
  largeur: number;
  /** Le plus grand |x| et le plus grand |z| du modèle au repos, en mètres. */
  emprise: { x: number; z: number };
  /** Le haut du modèle au repos, en mètres. */
  hauteurModele: number;
  basAuRepos: number;
  /** Le coin du mât, mesuré par `fabriquer.py` ; null pour le pont. */
  coinMat: { libre: boolean; hauteur: number | null; noeuds: string[] } | null;
  /** Parts des pixels du modèle dont l'émission atteint le seuil « allumé », puis le seuil « éteint ». */
  emission: { allumee: number; residuelle: number };
  /** Parts des teintes sur les identifiants, vue fixe. */
  palette: Record<string, number> | null;
  teintes: string[];
  triangles: number;
  materiaux: { trouves: string[]; attendus: string[]; max: number };
  piecesFines: { nom: string; epaisseur: number; fin: boolean }[];
  /** Ce que le repos fait bouger hors des pièces mobiles (`ecartsRepos`). */
  repos: EcartRepos[];
  /** Les nœuds qui ont le droit de bouger au repos. */
  mobiles: string[];
  agitation: { moyenne: number; pire: number };
  clarteHorsEquipe: number;
  controle: { ok: boolean; motifs: number };
  /** « Le QG le plus haut » : absent sans comparaison possible (le pont). */
  hauteurQg?: { ok: boolean | null; texte: string };
  /** L'ombre chinoise la plus proche parmi les bâtiments installés d'une autre clé ; null s'il n'y en a aucun. */
  recouvrement?: { batiment: string; valeur: number } | null;
  anomaliesCuisson?: string[];
}

const pct = (v: number): string => `${(v * 100).toFixed(1)} %`;

function dans(v: number, b: Bornes): boolean {
  return (b.min === undefined || v >= b.min - 1e-9) && (b.max === undefined || v <= b.max + 1e-9);
}

/** Les règles d'un bâtiment (ou du pont), chacune avec sa valeur mesurée et son verdict. */
export function reglesBatiment(m: MesuresBatiment, charte: Charte): Regle[] {
  const B = charte.batiments;
  const r: Regle[] = [];
  const regle = (id: string, libelle: string, valeur: Regle['valeur'], attendu: string, ok: boolean | null): void => {
    r.push({ id, libelle, valeur, attendu, verdict: ok === null ? 'info' : ok ? 'ok' : 'echec' });
  };
  const eteint = B.emission.eteints.includes(m.etat);
  regle('controle_fiche', 'Le lot passe le contrôle du dépôt (controlerDepot)', m.controle.ok, 'ok', m.controle.ok);

  if (m.genre === 'pont') {
    regle('equipe_absente', 'Le pont n’a pas de couleur d’équipe (plan §2)', Number(m.equipe.toFixed(4)), '0', m.equipe === 0);
  } else {
    regle('equipe', 'Part d’équipe, vue fixe (le bâtiment seul : ni contour ni ombre)', Number(m.equipe.toFixed(4)), `${pct(B.equipe.min!)} à ${pct(B.equipe.max!)}`,
      dans(m.equipe, B.equipe));
    regle('equipe_eclairee', `Équipe portée par les dessus : part des pixels d’équipe qui reçoivent ≥ ${B.eclairee.lumiereMin} de lumière`,
      Number(m.equipeEclairee.toFixed(4)), `≥ ${pct(B.eclairee.partMin)}`, m.equipeEclairee >= B.eclairee.partMin);
    regle('equipe_connexe', 'Plus grande zone d’équipe d’un seul tenant à 48 px, part de l’équipe (information : plusieurs toits)', Number(m.equipeConnexe.toFixed(4)), 'information', null);
    if (m.equipeIds !== null) {
      const ecart = Math.abs(m.equipeIds - m.equipe);
      regle('equipe_coherente', 'Part d’équipe des identifiants contre celle du masque cuit (UV dans la bonne case)', Number(ecart.toFixed(4)), 'écart ≤ 5 points', ecart <= 0.05);
    }
    const lim = m.superusine ? B.superusine : B;
    regle('debord_lateral', 'Débord latéral depuis le pivot, contour compris, toutes les images (cases)', Number(m.debordLateral.toFixed(4)), `≤ ${lim.debordLateralMax}`,
      m.debordLateral <= lim.debordLateralMax + 1e-9);
    const emprise = Math.max(m.emprise.x, m.emprise.z);
    regle('emprise_sol', 'Emprise du modèle au repos : le plus grand |x| ou |z| (m)', Number(emprise.toFixed(4)), `≤ ${lim.empriseMax}`, emprise <= lim.empriseMax + 1e-9);
    regle('hauteur_pivot', 'Hauteur au-dessus du pivot, contour compris, toutes les images (cases)', Number(m.hauteurAuDessusPivot.toFixed(4)),
      `≤ ${B.hauteurAuDessusDuPivotMax}`, m.hauteurAuDessusPivot <= B.hauteurAuDessusDuPivotMax + 1e-9);
    if (m.hauteurQg) regle('hauteur_qg', 'Le QG est le plus haut bâtiment : hauteur du modèle contre les bâtiments figurines installés', m.hauteurQg.texte,
      m.cle === 'qg' ? 'au-dessus des autres' : 'sous le QG', m.hauteurQg.ok);
    regle('largeur', 'Largeur de la silhouette, vue fixe, contour compris (information)', Number(m.largeur.toFixed(4)), 'information', null);
    const c = m.coinMat;
    regle('coin_mat', `Coin du mât : rien au-dessus de ${B.mat.hauteurMax} m à moins de ${B.mat.rayon} m de (${B.mat.x} ; ${B.mat.z}), toutes les poses cuites`,
      c ? (c.libre ? 'libre' : `${c.hauteur} m (${c.noeuds.join(', ')})`) : 'non mesuré', 'libre', c?.libre ?? false);
    if (eteint) {
      regle('emission', `Fenêtres éteintes (${m.etat}) : pixels d’émission au-dessus de ${B.emission.seuilEteint} sur 255`, Number(m.emission.residuelle.toFixed(4)), 'aucun',
        m.emission.residuelle === 0);
    } else {
      regle('emission', `Fenêtres allumées : pixels d’émission d’au moins ${B.emission.seuilAllume} sur 255`, Number(m.emission.allumee.toFixed(4)), `≥ ${pct(B.emission.partMin)}`,
        m.emission.allumee >= B.emission.partMin);
    }
    const orange = m.palette?.['orange'] ?? 0;
    if (!m.superusine) regle('palette_orange', 'Pas d’orange hors de la superusine', Number(orange.toFixed(4)), '0', orange === 0);
    else if (eteint) regle('palette_orange', 'La superusine prise éteint son œil : plus d’orange', Number(orange.toFixed(4)), '0', orange === 0);
    else regle('palette_orange', 'La superusine en service montre son œil orange', Number(orange.toFixed(4)), '> 0', orange > 0);
  }
  regle('au_sol', 'Bas du modèle au repos (m)', Number(m.basAuRepos.toFixed(4)), '0 ± 0,01', Math.abs(m.basAuRepos) <= 0.01);

  const pire = m.repos.reduce((a, e) => ({
    translation: Math.max(a.translation, e.translation), rotation: Math.max(a.rotation, e.rotation), echelle: Math.max(a.echelle, e.echelle),
  }), { translation: 0, rotation: 0, echelle: 0 });
  const immobile = pire.translation <= B.repos.translationMax + 1e-12 && pire.rotation <= B.repos.rotationMaxDegres + 1e-9 && pire.echelle <= B.repos.echelleMax + 1e-12;
  const fautifs = m.repos.filter((e) => e.translation > B.repos.translationMax || e.rotation > B.repos.rotationMaxDegres || e.echelle > B.repos.echelleMax);
  regle('repos_immobile', `Repos : aucun nœud ne bouge hors des pièces mobiles${m.mobiles.length ? ` (${m.mobiles.join(', ')})` : ''}`,
    fautifs.length ? fautifs.map((e) => `${e.noeud} ${(e.translation * 1000).toFixed(1)} mm ${e.rotation.toFixed(2)}°`).join(', ') : 'immobile',
    'immobile', immobile);
  regle('repos_agitation', `Repos : pixels qui changent de plus de ${charte.repos.seuilNiveaux} niveaux d’une image à l’autre (pire paire)${m.mobiles.length ? ', pièces mobiles exclues' : ''}`,
    Number(m.agitation.pire.toFixed(4)), `≤ ${pct(B.repos.agitationMax)}`, m.agitation.pire <= B.repos.agitationMax + 1e-9);

  if (m.palette) {
    for (const [nom, v] of Object.entries(m.palette).sort((a, b) => b[1] - a[1])) {
      if (nom === 'orange' && m.genre !== 'pont') continue;
      regle(`palette_${nom}`, `Part de la teinte ${nom}, vue fixe (information)`, Number(v.toFixed(4)), 'information', null);
    }
  }
  regle('teintes', 'Teintes de la palette portées, équipe comprise', m.teintes.length, `≤ ${B.teintesMax}`, m.teintes.length <= B.teintesMax);
  regle('budget', 'Triangles', m.triangles, `≤ ${charte.budget.triangles}`, m.triangles <= charte.budget.triangles);
  const materiauxOk = m.materiaux.trouves.length <= m.materiaux.max && m.materiaux.attendus.every((n) => m.materiaux.trouves.includes(n));
  regle('materiaux', 'Matériaux, ceux de la fiche', m.materiaux.trouves.join(', '), m.materiaux.attendus.join(', '), materiauxOk);
  const fines = m.piecesFines.filter((p) => p.epaisseur < (p.fin ? charte.formes.epaisseurMinAntenne : charte.formes.epaisseurMin) - 1e-9);
  regle('epaisseur', `Pièces sous ${charte.formes.epaisseurMin} m (pièces fines : ${charte.formes.epaisseurMinAntenne} m)`,
    fines.map((p) => `${p.nom} ${p.epaisseur}`).join(', ') || 'aucune', 'aucune', fines.length === 0);
  regle('clarte_hors_equipe', 'Clarté L* moyenne hors équipe, cuite (information)', Number(m.clarteHorsEquipe.toFixed(1)), 'information', null);
  if (m.anomaliesCuisson !== undefined) {
    regle('cuisson_entiere', 'Aucune image cuite n’a perdu de faces (silhouette, masque, clarté)',
      m.anomaliesCuisson.length ? `${m.anomaliesCuisson.length} : ${m.anomaliesCuisson.slice(0, 3).join(' ; ')}` : 'aucune', 'aucune', m.anomaliesCuisson.length === 0);
  }
  if (m.recouvrement !== undefined) {
    const rc = m.recouvrement;
    regle('recouvrement', `Ombre chinoise à ${charte.recouvrement.pixelsParCase} px : IoU la plus forte contre un bâtiment installé d’une autre clé (vue fixe)`,
      rc ? `${rc.valeur.toFixed(3)} ${rc.batiment}` : 'aucun à comparer', `≤ ${charte.recouvrement.max.toFixed(2)} (information)`, null);
  }
  return r;
}
