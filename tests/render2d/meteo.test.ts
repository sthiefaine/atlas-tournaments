// La météo de la peau 2D, en espace écran, et l'étalonnage d'ambiance.
//
// La météo : rien sous animations réduites, un nombre de particules qui suit la
// densité et l'écran sous un plafond (plus bas au doigt), des particules qui
// sont des fonctions du temps. L'étalonnage : **la règle de la nuit** — le sol
// reçoit le voile, les images du monde reçoivent le même dans le lot, exactement
// et une seule fois (un réglage de l'appel de calque, un drapeau par pose) ; les
// pastilles, les marques, les ombres, les effets et la météo n'en reçoivent pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiance, type Particules } from '../../src/render/ambiance';
import { METEOS, PHASES_JOUR, SAISONS } from '../../src/schemas/types';
import { PIXELS_PAR_CASE, SIN_TANGAGE, versPlan, type InstanceSprite } from '../../src/render2d/contrat';
import { ID_EFFET, IDS_GOUTTE } from '../../src/render2d/effets';
import type { Pose } from '../../src/render2d/lot';
import { EMISSION_JOUR, EMISSION_NUIT } from '../../src/render2d/contrat';
import {
  doitEtalonner, etalonnerPose, goutteDe, matriceEcran, Meteo2d, nombreParticules, PLAFOND_METEO,
  PLAFOND_METEO_TACTILE, poidsEmission, voileDuLot, voileImageSurCanal, voileSurCanal,
} from '../../src/render2d/meteo';
import { FORMES } from '../../src/render2d/replis';
import { posesUnites, Visuels } from '../../src/render2d/unites';
import { CAT, partiePersonnalisee } from '../engine/aides';

const ECRAN = { largeur: 1280, hauteur: 800 };

function meteo(p: Particules, t: number, reduit = false, plafond = PLAFOND_METEO, nuit = false, vue = ECRAN): Pose[] {
  const sortie: Pose[] = [];
  new Meteo2d(plafond).poses(p, nuit, t, vue, reduit, sortie);
  return sortie;
}

const PLUIE = ambiance('printemps', 'jour', 'pluie').particules;
const TEMPETE = ambiance('printemps', 'jour', 'tempete').particules;
const NEIGE = ambiance('hiver', 'jour', 'neige').particules;
const BRUME = ambiance('automne', 'jour', 'brouillard').particules;
const POUSSIERE = ambiance('ete', 'jour', 'canicule').particules;

test('aucune météo sous animations réduites, ni par temps clair, ni sur un écran vide', () => {
  for (const p of [PLUIE, TEMPETE, NEIGE, BRUME, POUSSIERE]) {
    assert.ok(meteo(p, 1000).length > 0, p.type);
    assert.equal(meteo(p, 1000, true).length, 0, `${p.type} réduite`);
  }
  assert.equal(meteo(ambiance('printemps', 'jour', 'clair').particules, 1000).length, 0);
  assert.equal(meteo(PLUIE, 1000, false, PLAFOND_METEO, false, { largeur: 0, hauteur: 0 }).length, 0);
});

test('le nombre suit la densité et l’écran, sous un plafond — plus bas au doigt', () => {
  assert.ok(nombreParticules(TEMPETE, 1280, 800) > nombreParticules(PLUIE, 1280, 800), 'la tempête est plus dense');
  assert.ok(nombreParticules(PLUIE, 640, 400) < nombreParticules(PLUIE, 1280, 800), 'un petit écran en porte moins');
  const tempete = meteo(TEMPETE, 500).filter((p) => p.instance.entree !== ID_EFFET.anneau);
  assert.equal(tempete.length, Math.min(PLAFOND_METEO, nombreParticules(TEMPETE, 1280, 800)));
  const auDoigt = meteo(TEMPETE, 500, false, PLAFOND_METEO_TACTILE).filter((p) => p.instance.entree !== ID_EFFET.anneau);
  assert.equal(auDoigt.length, PLAFOND_METEO_TACTILE);
  assert.ok(PLAFOND_METEO_TACTILE < PLAFOND_METEO);
  assert.ok(nombreParticules(BRUME, 1280, 800) >= 3 && nombreParticules(BRUME, 1280, 800) < 20, 'quelques grandes nappes, pas une foule');
});

test('une particule est une fonction du temps : même heure, même image ; la pluie tombe et le vent la pousse', () => {
  const a = meteo(PLUIE, 1234).map((p) => [p.instance.x, p.instance.y]);
  const b = meteo(PLUIE, 1234).map((p) => [p.instance.x, p.instance.y]);
  assert.deepEqual(a, b);
  // Une goutte, 20 ms plus tard : plus bas, un peu plus à droite (elle ne reboucle pas sur un si petit pas).
  const avant = meteo(PLUIE, 1000);
  const apres = meteo(PLUIE, 1020);
  let descendues = 0;
  for (let i = 0; i < 50; i++) {
    const dy = apres[i]!.instance.y - avant[i]!.instance.y;
    const dx = apres[i]!.instance.x - avant[i]!.instance.x;
    if (dy > 0 && dx > 0) descendues += 1;
  }
  assert.ok(descendues >= 45, `${descendues} sur 50`);
});

test('la météo tient dans l’écran et se pose dans son calque, en pixels d’écran', () => {
  for (const p of [PLUIE, NEIGE, POUSSIERE]) {
    for (const pose of meteo(p, 777)) {
      assert.equal(pose.calque, 'meteo');
      const plan = versPlan(pose.instance.x, pose.instance.y, pose.instance.h ?? 0);
      assert.ok(plan.X >= -60 && plan.X <= ECRAN.largeur + 60, `${p.type} x ${plan.X}`);
      assert.ok(plan.Y >= -60 && plan.Y <= ECRAN.hauteur + 60, `${p.type} y ${plan.Y}`);
    }
  }
  // La matrice de l'écran : le pixel (0, 0) va au coin haut-gauche de la découpe.
  const m = matriceEcran(1280, 800, new Float32Array(9));
  const proche = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
  assert.ok(proche(m[6]!, -1) && proche(m[7]!, 1));
  assert.ok(proche(m[0]! * 1280 + m[6]!, 1) && proche(m[4]! * 800 + m[7]!, -1));
  assert.ok(PIXELS_PAR_CASE > 0 && SIN_TANGAGE > 0);
});

test('le vent couche la pluie ; la tempête plus que l’averse ; la nuit l’assombrit', () => {
  assert.equal(goutteDe(620, 0), IDS_GOUTTE[0]);
  assert.equal(goutteDe(PLUIE.vitesse, PLUIE.vent), IDS_GOUTTE[1]);
  assert.equal(goutteDe(TEMPETE.vitesse, TEMPETE.vent), IDS_GOUTTE[2]);
  const jour = meteo(PLUIE, 500)[0]!.instance.teinte!;
  const nuit = meteo(PLUIE, 500, false, PLAFOND_METEO, true)[0]!.instance.teinte!;
  assert.ok(nuit[0] < jour[0] && nuit[2] < jour[2]);
});

test('les poses de la météo sont créées une fois et réécrites', () => {
  const m = new Meteo2d(40);
  const a: Pose[] = [];
  const b: Pose[] = [];
  m.poses(NEIGE, false, 100, ECRAN, false, a);
  m.poses(NEIGE, false, 200, ECRAN, false, b);
  assert.ok(a.length > 0);
  assert.equal(a[0], b[0], 'le même objet');
});

// --- L'étalonnage : la règle de la nuit ------------------------------------------

test('de jour par temps clair, rien ne change : un voile de part nulle, et aucune instance touchée', () => {
  const v = voileDuLot(ambiance('ete', 'jour', 'clair'));
  assert.equal(v[3], 0);
  const pose: Pose = { calque: 'unites', ligne: 0, colonne: 0, instance: { entree: 'unite_char_leger_base', animation: -1, cadre: 0, x: 0, y: 0 } };
  etalonnerPose(pose);
  assert.equal(pose.voilee, true, 'la figurine est du monde');
  assert.equal(pose.instance.teinte, undefined, 'l’instance n’est jamais touchée');
  assert.equal(pose.instance.eclat, undefined);
  for (const canal of [0, 1, 2] as const) assert.equal(voileImageSurCanal(0.37, 1, canal, v), 0.37);
});

test('le sol voilé et une image voilée rendent la même couleur, exactement, sous toutes les ambiances', () => {
  let pire = 0;
  const reglage = new Float32Array(4);
  for (const saison of SAISONS) {
    for (const phase of PHASES_JOUR) {
      for (const m of METEOS) {
        const a = ambiance(saison, phase, m);
        voileDuLot(a, reglage);
        for (const c of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
          for (const canal of [0, 1, 2] as const) {
            const sol = voileSurCanal(c, canal, a.voile);
            const image = voileImageSurCanal(c, 1, canal, reglage);
            pire = Math.max(pire, Math.abs(sol - image));
            // Prémultiplié : un pixel à demi couvert reçoit la moitié du voile, et le composé est juste.
            const demi = voileImageSurCanal(c * 0.5, 0.5, canal, reglage);
            assert.ok(Math.abs(demi - sol * 0.5) < 1e-6, a.cle);
          }
        }
      }
    }
  }
  // Le réglage est en flottants 32 bits : exact au millionième, là où la teinte
  // et l'éclat par instance s'écartaient jusqu'à 0,042.
  assert.ok(pire < 1e-6, `écart maximal ${pire}`);
  // Et la nuit assombrit vraiment : le blanc d'une image n'est plus blanc.
  assert.ok(voileImageSurCanal(1, 1, 0, voileDuLot(ambiance('printemps', 'nuit', 'clair'))) < 0.75);
});

test('les fenêtres : 0,06 le jour, 1 quand les villes s’éclairent — les valeurs du contrat', () => {
  assert.equal(poidsEmission(ambiance('ete', 'jour', 'clair')), EMISSION_JOUR);
  assert.equal(poidsEmission(ambiance('ete', 'nuit', 'clair')), EMISSION_NUIT);
  assert.equal(EMISSION_JOUR, 0.06);
  assert.equal(EMISSION_NUIT, 1);
});

/** Une pose de ce calque et de cette entrée. */
function pose(calque: Pose['calque'], entree: string, instance: Partial<InstanceSprite> = {}): Pose {
  return { calque, ligne: 0, colonne: 0, instance: { entree, animation: -1, cadre: 0, x: 0, y: 0, ...instance } };
}

test('ce qui reçoit l’étalonnage : le monde, jamais ce qui se lit, ni les ombres, les effets ou la météo', () => {
  assert.equal(doitEtalonner(pose('volumes', 'batiment_ville_base')), true);
  assert.equal(doitEtalonner(pose('volumes', FORMES.drapeau)), true, 'un drapeau est du monde');
  assert.equal(doitEtalonner(pose('volumes', 'decor_feuillu_ete_1')), true);
  assert.equal(doitEtalonner(pose('unites', 'unite_infanterie_base')), true);
  assert.equal(doitEtalonner(pose('unites', FORMES.pv(7, false))), false, 'la pastille se lit');
  assert.equal(doitEtalonner(pose('unites', FORMES.marque('designee'))), false);
  assert.equal(doitEtalonner(pose('volumes', FORMES.marque('menacee'))), false, 'la marque d’une usine aussi');
  assert.equal(doitEtalonner(pose('ombres_unites', FORMES.ombre)), false);
  assert.equal(doitEtalonner(pose('ombres_unites', FORMES.ecume)), true, 'l’écume d’un navire est de l’eau : elle reçoit la nuit');
  assert.equal(doitEtalonner(pose('effets', ID_EFFET.eclair)), false, 'un effet est de la lumière');
  assert.equal(doitEtalonner(pose('meteo', IDS_GOUTTE[0]!)), false);
});

test('marquer une pose ne touche ni sa teinte partagée ni son éclat, et deux marques n’assombrissent pas deux fois', () => {
  const partagee = [0.6, 0.6, 0.58] as const;
  const p = pose('volumes', 'batiment_ville_base', { teinte: partagee, eclat: 0.5 });
  etalonnerPose(p);
  etalonnerPose(p);
  assert.equal(p.voilee, true);
  assert.equal(p.instance.teinte, partagee, 'la constante du désaffecté est la même, intacte');
  assert.deepEqual([...partagee], [0.6, 0.6, 0.58]);
  assert.equal(p.instance.eclat, 0.5, 'l’éclat d’un coup reste celui du coup');
  const lisible = pose('unites', FORMES.pv(3, true));
  etalonnerPose(lisible);
  assert.equal(lisible.voilee, false);
});

test('la nuit sur les unités : la figurine est du monde, sa pastille et son ombre non', () => {
  const etat = partiePersonnalisee(['PPP'], {}, [{ camp: 0, type: 'infanterie', x: 1, y: 0, pv: 50 }]);
  const r = posesUnites(etat, CAT, new Visuels(), {
    camp: 0, visibles: null, selection: null, equipe: () => [0, 0, 1], entree: (t) => `unite_${t}_base`,
    animation: () => null, tempsMs: 0, reduit: false,
  });
  for (const p of r.poses) etalonnerPose(p);
  const figurine = r.poses.find((p) => p.instance.entree === 'unite_infanterie_base')!;
  const pastille = r.poses.find((p) => p.instance.entree.startsWith('forme_pv_'))!;
  const ombre = r.poses.find((p) => p.calque === 'ombres_unites')!;
  assert.equal(figurine.voilee, true);
  assert.equal(pastille.voilee, false);
  assert.equal(ombre.voilee, false);
  assert.equal(figurine.instance.teinte, undefined, 'la nuit n’est plus dans l’instance');
});

test('la nuit sur un navire : l’écume s’éteint avec la mer, sans quoi elle brillerait seule', () => {
  const etat = partiePersonnalisee(['WWW'], {}, [{ camp: 0, type: 'barge', x: 1, y: 0 }]);
  const r = posesUnites(etat, CAT, new Visuels(), {
    camp: 0, visibles: null, selection: null, equipe: () => [0, 0, 1], entree: (t) => `unite_${t}_base`,
    animation: () => null, tempsMs: 0, reduit: false,
  });
  for (const p of r.poses) etalonnerPose(p);
  const ecume = r.poses.find((p) => p.calque === 'ombres_unites')!;
  assert.equal(ecume.instance.entree, FORMES.ecume);
  assert.equal(ecume.voilee, true);
});
