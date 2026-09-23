// La météo de la peau 2D, en espace écran, et l'étalonnage d'ambiance.
//
// La météo : rien sous animations réduites, un nombre de particules qui suit la
// densité et l'écran sous un plafond (plus bas au doigt), des particules qui
// sont des fonctions du temps. L'étalonnage : **la règle de la nuit** — le sol
// reçoit le voile, les images du monde reçoivent une teinte qui rend la même
// couleur à moins de 0,05 près, une seule fois ; les pastilles, les marques, les
// ombres, les effets et la météo n'en reçoivent pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiance, type Particules } from '../../src/render/ambiance';
import { METEOS, PHASES_JOUR, SAISONS } from '../../src/schemas/types';
import { PIXELS_PAR_CASE, SIN_TANGAGE, versPlan, type InstanceSprite } from '../../src/render2d/contrat';
import { ID_EFFET, IDS_GOUTTE } from '../../src/render2d/effets';
import type { Pose } from '../../src/render2d/lot';
import {
  doitEtalonner, ETALONNAGE_NEUTRE, etalonnageAmbiance, etalonnageSurCanal, etalonnerPose, goutteDe, matriceEcran,
  Meteo2d, nombreParticules, PLAFOND_METEO, PLAFOND_METEO_TACTILE, voileSurCanal,
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

test('de jour par temps clair, rien ne change', () => {
  assert.equal(etalonnageAmbiance(ambiance('ete', 'jour', 'clair')), ETALONNAGE_NEUTRE);
  const pose: Pose = { calque: 'unites', ligne: 0, colonne: 0, instance: { entree: 'unite_char_leger_base', animation: -1, cadre: 0, x: 0, y: 0 } };
  etalonnerPose(pose, ETALONNAGE_NEUTRE);
  assert.equal(pose.instance.teinte, undefined);
  assert.equal(pose.instance.eclat, undefined);
});

test('le sol voilé et une image étalonnée rendent la même couleur, à 0,05 près, sous toutes les ambiances', () => {
  let pire = 0;
  for (const saison of SAISONS) {
    for (const phase of PHASES_JOUR) {
      for (const m of METEOS) {
        const a = ambiance(saison, phase, m);
        const e = etalonnageAmbiance(a);
        for (const c of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
          for (const canal of [0, 1, 2] as const) {
            const sol = voileSurCanal(c, canal, a.voile);
            const image = etalonnageSurCanal(c, canal, e);
            pire = Math.max(pire, Math.abs(sol - image));
          }
          // Le blanc tombe juste : c'est sur lui que l'œil juge une teinte.
          if (a.voile) {
            for (const canal of [0, 1, 2] as const) {
              assert.ok(Math.abs(voileSurCanal(1, canal, a.voile) - etalonnageSurCanal(1, canal, e)) < 1e-9, a.cle);
            }
          }
        }
      }
    }
  }
  assert.ok(pire <= 0.05, `écart maximal ${pire}`);
  // Et la nuit assombrit vraiment : le blanc d'une image n'est plus blanc.
  const nuit = etalonnageAmbiance(ambiance('printemps', 'nuit', 'clair'));
  assert.ok(etalonnageSurCanal(1, 0, nuit) < 0.75);
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
  assert.equal(doitEtalonner(pose('effets', ID_EFFET.eclair)), false, 'un effet est de la lumière');
  assert.equal(doitEtalonner(pose('meteo', IDS_GOUTTE[0]!)), false);
});

test('étalonner une pose ne touche pas une teinte partagée, et compose les éclats', () => {
  const e = etalonnageAmbiance(ambiance('hiver', 'nuit', 'neige'));
  const partagee = [0.6, 0.6, 0.58] as const;
  const p = pose('volumes', 'batiment_ville_base', { teinte: partagee, eclat: 0.5 });
  etalonnerPose(p, e);
  assert.deepEqual([...partagee], [0.6, 0.6, 0.58], 'la constante du désaffecté est intacte');
  assert.ok(Math.abs(p.instance.teinte![0] - 0.6 * e.teinte[0]) < 1e-12);
  assert.ok(Math.abs(p.instance.eclat! - (1 - 0.5 * (1 - e.eclat))) < 1e-12, 'deux mélanges vers le blanc font un mélange');
  const lisible = pose('unites', FORMES.pv(3, true));
  etalonnerPose(lisible, e);
  assert.equal(lisible.instance.teinte, undefined);
});

test('la nuit sur les unités : la figurine est étalonnée une fois, sa pastille et son ombre non', () => {
  const etat = partiePersonnalisee(['PPP'], {}, [{ camp: 0, type: 'infanterie', x: 1, y: 0, pv: 50 }]);
  const e = etalonnageAmbiance(ambiance('printemps', 'nuit', 'clair'));
  const r = posesUnites(etat, CAT, new Visuels(), {
    camp: 0, visibles: null, selection: null, equipe: () => [0, 0, 1], entree: (t) => `unite_${t}_base`,
    animation: () => null, tempsMs: 0, reduit: false,
  });
  for (const p of r.poses) etalonnerPose(p, e);
  const figurine = r.poses.find((p) => p.instance.entree === 'unite_infanterie_base')!;
  const pastille = r.poses.find((p) => p.instance.entree.startsWith('forme_pv_'))!;
  const ombre = r.poses.find((p) => p.calque === 'ombres_unites')!;
  assert.deepEqual(figurine.instance.teinte, e.teinte);
  assert.equal(pastille.instance.teinte, undefined);
  assert.equal(ombre.instance.teinte, undefined);
});
