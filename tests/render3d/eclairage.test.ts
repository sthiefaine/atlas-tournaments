// L'éclairage 3D : les 48 combinaisons (saison × phase × météo) doivent rendre
// 48 jeux de paramètres **distincts** — sans quoi la nuit d'hiver sous la neige
// ressemblerait à un midi d'été — et **bornés** — sans quoi une carte graphique
// se retrouverait à afficher un soleil à trente fois l'intensité utile.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three/webgpu';

import { TANGAGE_DEFAUT, type EtatCamera } from '../../src/render3d/camera';
import {
  MS_TRANSITION, creerEclairage, directionSoleil, melangerParametres, parametresAmbiance, type ParametresAmbiance,
} from '../../src/render3d/eclairage';
import { DISTANCE_SOLEIL } from '../../src/render3d/ombres';
import { METEOS, PHASES_JOUR, SAISONS } from '../../src/schemas/index';

/** Les 48 combinaisons, avec leur clé lisible. */
function toutes(): { cle: string; p: ParametresAmbiance }[] {
  const sortie: { cle: string; p: ParametresAmbiance }[] = [];
  for (const saison of SAISONS) {
    for (const phase of PHASES_JOUR) {
      for (const meteo of METEOS) {
        sortie.push({ cle: `${saison}:${phase}:${meteo}`, p: parametresAmbiance(saison, phase, meteo) });
      }
    }
  }
  return sortie;
}

test('les 48 ambiances sont deux à deux distinctes', () => {
  const liste = toutes();
  assert.equal(liste.length, SAISONS.length * PHASES_JOUR.length * METEOS.length);
  assert.equal(liste.length, 48);
  const vues = new Map<string, string>();
  for (const { cle, p } of liste) {
    const empreinte = JSON.stringify(p);
    const deja = vues.get(empreinte);
    assert.equal(deja, undefined, `${cle} rend les mêmes paramètres que ${deja}`);
    vues.set(empreinte, cle);
  }
});

test('les ambiances sont mémorisées : même triplet, même objet', () => {
  assert.equal(
    parametresAmbiance('hiver', 'nuit', 'neige'),
    parametresAmbiance('hiver', 'nuit', 'neige'),
  );
});

test('tous les paramètres restent dans des bornes utilisables', () => {
  const hex = /^#[0-9a-f]{6}$/;
  for (const { cle, p } of toutes()) {
    assert.match(p.soleil.couleur, hex, `${cle} : couleur de soleil`);
    assert.match(p.hemisphere.ciel, hex, `${cle} : ciel hémisphérique`);
    assert.match(p.hemisphere.sol, hex, `${cle} : sol hémisphérique`);
    assert.match(p.ciel, hex, `${cle} : fond`);
    assert.match(p.brouillard.couleur, hex, `${cle} : brouillard`);
    // Le ciel est visible autour du plateau : un brouillard d'une autre teinte
    // que le fond dessinerait une couture au bord de la carte.
    assert.equal(p.brouillard.couleur, p.ciel, `${cle} : le brouillard fond vers le fond`);
    assert.match(p.teinteSol, hex, `${cle} : teinte du sol`);
    assert.match(p.eau.couleur, hex, `${cle} : eau`);

    assert.ok(p.soleil.intensite >= 0 && p.soleil.intensite <= 6, `${cle} : intensité du soleil`);
    assert.ok(p.soleil.elevation >= 12 && p.soleil.elevation <= 82, `${cle} : élévation`);
    assert.ok(p.soleil.azimut >= 0 && p.soleil.azimut < 360, `${cle} : azimut`);
    assert.ok(p.hemisphere.intensite >= 0 && p.hemisphere.intensite <= 3, `${cle} : hémisphérique`);
    assert.ok(p.brouillard.densite >= 0 && p.brouillard.densite <= 0.2, `${cle} : densité`);
    assert.ok(p.exposition >= 0.4 && p.exposition <= 1.8, `${cle} : exposition`);
    for (const [nom, v] of [
      ['neigeSol', p.neigeSol], ['mouille', p.mouille], ['oscillation', p.oscillation],
      ['fenetres', p.fenetres], ['eau.opacite', p.eau.opacite], ['eau.agitation', p.eau.agitation],
    ] as const) {
      assert.ok(v >= 0 && v <= 1, `${cle} : ${nom} hors de [0, 1] (${v})`);
    }
    assert.ok(p.particules.nombre >= 0 && p.particules.nombre <= 4000, `${cle} : particules`);
    assert.ok(p.particules.inclinaison >= 0 && p.particules.inclinaison <= 1, `${cle} : vent`);
    // L'environnement : une intensité qui ne dépasse jamais la lumière réelle,
    // et une teinte qui est une couleur.
    assert.ok(p.environnement.intensite > 0 && p.environnement.intensite <= 1, `${cle} : environnement (${p.environnement.intensite})`);
    assert.match(p.environnement.teinte, hex, `${cle} : teinte d'environnement`);
  }
});

/** Le bleu moins le rouge d'une couleur hexadécimale : positif, elle est froide. */
function froideur(couleur: string): number {
  return parseInt(couleur.slice(5, 7), 16) - parseInt(couleur.slice(1, 3), 16);
}

test('l’environnement suit l’ambiance : plus faible la nuit, plus terne l’hiver, bouché par la météo', () => {
  for (const saison of SAISONS) {
    for (const meteo of METEOS) {
      const jour = parametresAmbiance(saison, 'jour', meteo).environnement;
      const nuit = parametresAmbiance(saison, 'nuit', meteo).environnement;
      assert.ok(nuit.intensite < jour.intensite / 2, `la nuit éteint la pièce (${saison}, ${meteo})`);
      assert.notEqual(nuit.teinte, jour.teinte, `la nuit refroidit la teinte (${saison}, ${meteo})`);
    }
  }
  for (const phase of PHASES_JOUR) {
    for (const meteo of METEOS) {
      const ete = parametresAmbiance('ete', phase, meteo).environnement;
      const hiver = parametresAmbiance('hiver', phase, meteo).environnement;
      assert.ok(hiver.intensite < ete.intensite, `l'hiver réfléchit moins (${phase}, ${meteo})`);
      assert.ok(froideur(hiver.teinte) > froideur(ete.teinte), `l'hiver est plus froid (${phase}, ${meteo})`);
    }
    // Tout ce qui bouche le ciel atténue ; la canicule, elle, blanchit le ciel et renvoie plus.
    const clair = parametresAmbiance('printemps', phase, 'clair').environnement.intensite;
    for (const meteo of ['pluie', 'neige', 'brouillard', 'tempete'] as const) {
      assert.ok(parametresAmbiance('printemps', phase, meteo).environnement.intensite < clair, `${meteo} atténue (${phase})`);
    }
    assert.ok(parametresAmbiance('printemps', phase, 'canicule').environnement.intensite > clair, `la canicule renvoie plus (${phase})`);
    assert.ok(
      parametresAmbiance('printemps', phase, 'tempete').environnement.intensite
      < parametresAmbiance('printemps', phase, 'pluie').environnement.intensite,
      `la tempête bouche plus que la pluie (${phase})`,
    );
  }
  // L'ordre de grandeur de jour : un tiers de la pièce, pas la pièce entière —
  // à un, les ombres seraient aussi claires que les faces au soleil.
  const reference = parametresAmbiance('ete', 'jour', 'clair').environnement.intensite;
  assert.ok(reference >= 0.2 && reference <= 0.45, `référence de jour : ${reference}`);
});

test('la saison, la phase et la météo se lisent chacune dans les paramètres', () => {
  // La nuit baisse le soleil et allume les fenêtres, quelle que soit la météo.
  for (const meteo of METEOS) {
    const jour = parametresAmbiance('ete', 'jour', meteo);
    const nuit = parametresAmbiance('ete', 'nuit', meteo);
    assert.ok(nuit.soleil.intensite < jour.soleil.intensite, `nuit plus sombre (${meteo})`);
    assert.ok(nuit.fenetres > jour.fenetres, `fenêtres allumées la nuit (${meteo})`);
    assert.notEqual(nuit.soleil.couleur, jour.soleil.couleur);
  }
  // La saison change la couleur du soleil et la teinte du sol, de jour comme de nuit.
  for (const phase of PHASES_JOUR) {
    const couleurs = new Set(SAISONS.map((s) => parametresAmbiance(s, phase, 'clair').soleil.couleur));
    assert.equal(couleurs.size, SAISONS.length, `quatre soleils distincts (${phase})`);
    const sols = new Set(SAISONS.map((s) => parametresAmbiance(s, phase, 'clair').teinteSol));
    assert.equal(sols.size, SAISONS.length, `quatre sols distincts (${phase})`);
  }
  // L'hiver pose de la neige même par ciel clair ; la neige en pose davantage.
  assert.ok(parametresAmbiance('hiver', 'jour', 'clair').neigeSol > 0);
  assert.equal(parametresAmbiance('ete', 'jour', 'clair').neigeSol, 0);
  assert.equal(parametresAmbiance('ete', 'jour', 'neige').neigeSol, 1);
  // La météo se lit dans le brouillard, les particules et l'humidité.
  const densites = new Set(METEOS.map((m) => parametresAmbiance('ete', 'jour', m).brouillard.densite));
  assert.equal(densites.size, METEOS.length, 'six densités de brouillard distinctes');
  assert.equal(parametresAmbiance('ete', 'jour', 'clair').particules.calque, 'aucune');
  assert.equal(parametresAmbiance('ete', 'jour', 'pluie').particules.calque, 'pluie');
  assert.equal(parametresAmbiance('ete', 'jour', 'neige').particules.calque, 'neige');
  assert.equal(parametresAmbiance('ete', 'jour', 'brouillard').particules.calque, 'brume');
  assert.equal(parametresAmbiance('ete', 'jour', 'canicule').particules.calque, 'poussiere');
  const pluie = parametresAmbiance('ete', 'jour', 'pluie');
  const tempete = parametresAmbiance('ete', 'jour', 'tempete');
  assert.ok(tempete.particules.inclinaison > pluie.particules.inclinaison, 'la tempête couche la pluie');
  assert.ok(tempete.oscillation > pluie.oscillation, 'la tempête agite les arbres');
  assert.ok(pluie.mouille > 0.5, 'la pluie mouille les matières');
  assert.equal(parametresAmbiance('ete', 'jour', 'canicule').mouille, 0);
  assert.ok(
    parametresAmbiance('ete', 'jour', 'brouillard').brouillard.densite
    > parametresAmbiance('ete', 'jour', 'tempete').brouillard.densite,
    'le brouillard est ce qui bouche le plus',
  );
});

test('la transition d’ambiance interpole sans jamais sortir des bornes', () => {
  assert.ok(MS_TRANSITION > 0 && MS_TRANSITION <= 2000);
  const a = parametresAmbiance('ete', 'jour', 'clair');
  const b = parametresAmbiance('hiver', 'nuit', 'neige');
  // Aux extrémités on retrouve les bornes (au flottant près sur les nombres).
  const debut = melangerParametres(a, b, 0);
  const fin = melangerParametres(a, b, 1);
  assert.equal(debut.ciel, a.ciel);
  assert.equal(debut.particules.calque, a.particules.calque);
  assert.ok(Math.abs(debut.soleil.intensite - a.soleil.intensite) < 1e-9);
  assert.ok(Math.abs(debut.neigeSol - a.neigeSol) < 1e-9);
  assert.equal(fin.ciel, b.ciel);
  assert.equal(fin.particules.calque, b.particules.calque);
  assert.ok(Math.abs(fin.soleil.intensite - b.soleil.intensite) < 1e-9);
  assert.ok(Math.abs(fin.brouillard.densite - b.brouillard.densite) < 1e-9);
  for (const t of [-1, 0.25, 0.5, 0.75, 2]) {
    const m = melangerParametres(a, b, t);
    const bas = Math.min(a.soleil.intensite, b.soleil.intensite);
    const haut = Math.max(a.soleil.intensite, b.soleil.intensite);
    assert.ok(m.soleil.intensite >= bas - 1e-9 && m.soleil.intensite <= haut + 1e-9);
    assert.ok(m.neigeSol >= 0 && m.neigeSol <= 1);
    assert.match(m.ciel, /^#[0-9a-f]{6}$/);
    // L'environnement s'interpole comme le reste : jamais hors des deux bornes.
    const basEnv = Math.min(a.environnement.intensite, b.environnement.intensite);
    const hautEnv = Math.max(a.environnement.intensite, b.environnement.intensite);
    assert.ok(m.environnement.intensite >= basEnv - 1e-9 && m.environnement.intensite <= hautEnv + 1e-9);
    assert.match(m.environnement.teinte, /^#[0-9a-f]{6}$/);
  }
  // Aux extrémités, l'environnement est exactement celui des bornes ; au milieu, la moyenne.
  assert.ok(Math.abs(debut.environnement.intensite - a.environnement.intensite) < 1e-9);
  assert.equal(debut.environnement.teinte, a.environnement.teinte);
  assert.ok(Math.abs(fin.environnement.intensite - b.environnement.intensite) < 1e-9);
  assert.equal(fin.environnement.teinte, b.environnement.teinte);
  const milieu = melangerParametres(a, b, 0.5).environnement.intensite;
  assert.ok(Math.abs(milieu - (a.environnement.intensite + b.environnement.intensite) / 2) < 1e-9);
  // À mi-chemin, le calque de particules a déjà basculé sur la cible.
  assert.equal(melangerParametres(a, b, 0.6).particules.calque, 'neige');
});

// ---------------------------------------------------------------------------
// La plomberie : ce que la boucle appelle à chaque image ne doit rien allouer
// ni rien recalculer quand rien n'a bougé — et `index.ts` s'appuie sur
// l'**identité** de ce qu'elle rend pour savoir si la carte d'ombre est à refaire.
// ---------------------------------------------------------------------------

/** Un document dont la toile n'a pas de contexte : `textureGrain` s'en passe. */
function documentSansToile(): Document {
  return {
    createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  } as unknown as Document;
}

function etatCamera(p: Partial<EtatCamera> = {}): EtatCamera {
  return { cible: { x: 8, z: 6 }, distance: 18, tangage: TANGAGE_DEFAUT, lacet: 0, ...p };
}

const CARTE = { largeur: 16, hauteur: 12 };

test('le cadre d’ombre est le même objet tant que ni la caméra ni le soleil n’ont bougé', () => {
  const scene = new THREE.Scene();
  const e = creerEclairage(scene, documentSansToile(), parametresAmbiance('ete', 'jour', 'clair'), () => 0, { tailleOmbre: 1024 });
  const a = e.cadrerOmbre(etatCamera(), 1.6, CARTE);
  // Soixante images de suite sans rien bouger : le même objet, pas une copie égale.
  for (let i = 0; i < 60; i++) assert.equal(e.cadrerOmbre(etatCamera(), 1.6, CARTE), a);
  // La caméra glisse d'un centième : nouveau cadre.
  const b = e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 } }), 1.6, CARTE);
  assert.notEqual(b, a);
  // Un quart de tour, un zoom, un autre écran : nouveau cadre à chaque fois.
  const c = e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 }, lacet: 1 }), 1.6, CARTE);
  assert.notEqual(c, b);
  const d = e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 }, lacet: 1, distance: 9 }), 1.6, CARTE);
  assert.notEqual(d, c);
  const f = e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 }, lacet: 1, distance: 9 }), 0.5, CARTE);
  assert.notEqual(f, d);
  // Et le soleil qui change — une autre ambiance, appliquée sans transition — aussi.
  e.viser(parametresAmbiance('hiver', 'nuit', 'clair'), true);
  const g = e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 }, lacet: 1, distance: 9 }), 0.5, CARTE);
  assert.notEqual(g, f);
  assert.equal(e.cadrerOmbre(etatCamera({ cible: { x: 8.01, z: 6 }, lacet: 1, distance: 9 }), 0.5, CARTE), g);
  e.dispose();
});

test('hors transition, `avancer` garde l’ambiance courante et ne repeint pas le fond', () => {
  const scene = new THREE.Scene();
  const depart = parametresAmbiance('printemps', 'jour', 'pluie');
  const e = creerEclairage(scene, documentSansToile(), depart, () => 0, { tailleOmbre: 1024 });
  const fond = scene.background;
  assert.ok(fond instanceof THREE.Color, 'le fond est une couleur');
  assert.equal(`#${fond.getHexString()}`, depart.ciel);
  const centre = new THREE.Vector3(5, 0, 4);
  // Les particules de pluie réclament une image à chaque fois, mais `courant`
  // reste le même objet : c'est sur cette identité que les matières décident
  // de ne pas se repeindre.
  for (let i = 0; i < 30; i++) {
    assert.equal(e.avancer(16, centre), true);
    assert.equal(e.courant, depart);
  }
  assert.equal(scene.background, fond, 'le fond est repeint, jamais remplacé');
  // Un changement d'ambiance sans transition : même objet de fond, autre couleur.
  const nuit = parametresAmbiance('hiver', 'nuit', 'neige');
  e.viser(nuit, true);
  assert.equal(scene.background, fond);
  assert.equal(`#${fond.getHexString()}`, nuit.ciel);
  assert.equal(e.courant, nuit);
  e.dispose();
});

test('le soleil suit la cible et la direction de l’ambiance courante, transition comprise', () => {
  const scene = new THREE.Scene();
  const ete = parametresAmbiance('ete', 'jour', 'clair');
  const e = creerEclairage(scene, documentSansToile(), ete, () => 0, { tailleOmbre: 1024 });
  const centre = new THREE.Vector3(3, 0, 7);
  e.avancer(16, centre);
  const attendu = centre.clone().add(directionSoleil(ete.soleil.elevation, ete.soleil.azimut, DISTANCE_SOLEIL));
  assert.ok(e.soleil.position.distanceTo(attendu) < 1e-9, 'la direction mise en cache est celle du départ');
  // Sans transition : la direction est rafraîchie tout de suite.
  const nuit = parametresAmbiance('hiver', 'nuit', 'clair');
  e.viser(nuit, true);
  e.avancer(16, centre);
  const attenduNuit = centre.clone().add(directionSoleil(nuit.soleil.elevation, nuit.soleil.azimut, DISTANCE_SOLEIL));
  assert.ok(e.soleil.position.distanceTo(attenduNuit) < 1e-9, 'la direction est celle de la nouvelle ambiance');
  // Avec transition : `courant` change d'objet à chaque image, le soleil bouge,
  // et le cadre d'ombre suit — c'est ce qui refait l'ombre pendant la transition.
  e.viser(ete);
  let precedent = e.courant;
  let cadre = e.cadrerOmbre(etatCamera(), 1.6, CARTE);
  const pas = MS_TRANSITION / 6;
  for (let i = 0; i < 5; i++) {
    assert.equal(e.avancer(pas, centre), true);
    assert.notEqual(e.courant, precedent);
    precedent = e.courant;
    const suivant = e.cadrerOmbre(etatCamera(), 1.6, CARTE);
    assert.notEqual(suivant, cadre, `image ${i} : le soleil a bougé, le cadre aussi`);
    cadre = suivant;
    const d = directionSoleil(e.courant.soleil.elevation, e.courant.soleil.azimut, DISTANCE_SOLEIL);
    assert.ok(e.soleil.position.distanceTo(centre.clone().add(d)) < 1e-9);
  }
  // La transition finie, tout se fige : même objet, même cadre.
  e.avancer(MS_TRANSITION, centre);
  assert.equal(e.courant, ete);
  const fige = e.cadrerOmbre(etatCamera(), 1.6, CARTE);
  assert.equal(e.avancer(16, centre), false, 'ciel clair : plus rien ne réclame d’image');
  assert.equal(e.courant, ete);
  assert.equal(e.cadrerOmbre(etatCamera(), 1.6, CARTE), fige);
  e.dispose();
});

// ---------------------------------------------------------------------------
// Les particules sous WebGPU : des quads instanciés, jamais des points
// ---------------------------------------------------------------------------

test('la neige tombe en quads instanciés face à la caméra : r170 ne dessine un point qu’à un pixel', () => {
  const scene = new THREE.Scene();
  const neige = parametresAmbiance('hiver', 'jour', 'neige');
  const e = creerEclairage(scene, documentSansToile(), neige, () => 0, { tailleOmbre: 1024 });
  let points = 0;
  e.groupe.traverse((o) => { if ((o as THREE.Points).isPoints) points += 1; });
  assert.equal(points, 0, 'aucun `Points` : le moteur WebGPU n’a pas de taille de point');
  const particules = e.groupe.getObjectByName('particules') as THREE.Mesh;
  assert.ok(particules instanceof THREE.Mesh, 'un seul maillage pour toutes les particules');
  const geo = particules.geometry as THREE.InstancedBufferGeometry;
  assert.ok(geo.isInstancedBufferGeometry, 'une position par instance');
  assert.ok(geo.getAttribute('instancePosition'), 'l’attribut que le nœud de position lit');
  const mat = particules.material as THREE.MeshBasicNodeMaterial;
  assert.ok(mat instanceof THREE.MeshBasicNodeMaterial);
  assert.ok(mat.positionNode, 'le quad se pose dans le plan de la caméra par un nœud de position');
  assert.equal(mat.depthWrite, false);
  assert.equal(mat.transparent, true);
  assert.equal(`#${mat.color.getHexString()}`, neige.particules.couleur);
  assert.equal(mat.opacity, neige.particules.opacite);

  // Le nombre d'instances tient lieu de plage de dessin, et suit l'ambiance.
  const centre = new THREE.Vector3(5, 0, 4);
  assert.equal(e.avancer(16, centre), true, 'la neige réclame une image');
  assert.equal(particules.visible, true);
  assert.equal(geo.instanceCount, neige.particules.nombre);
  const gouttes = e.groupe.getObjectByName('gouttes') as THREE.LineSegments;
  assert.equal(gouttes.visible, false, 'la pluie est un autre calque');

  // Par ciel clair, plus rien ; sous la pluie, ce sont les traînées qui vivent.
  e.viser(parametresAmbiance('ete', 'jour', 'clair'), true);
  assert.equal(particules.visible, false);
  e.viser(parametresAmbiance('automne', 'jour', 'tempete'), true);
  e.avancer(16, centre);
  assert.equal(particules.visible, false);
  assert.equal(gouttes.visible, true);
  assert.ok(gouttes.material instanceof THREE.LineBasicNodeMaterial, 'une traînée est une ligne à nœuds');
  assert.equal(gouttes.geometry.drawRange.count, parametresAmbiance('automne', 'jour', 'tempete').particules.nombre * 2);
  e.dispose();
});
