/**
 * Les animations 3D posent le **clip logique** de chaque unité : `deplacement`
 * tant qu'elle glisse, `tir` et `touche` autour d'une attaque, `hors_jeu`,
 * `capture`, et `repos` dès que le geste finit — ou qu'on le coupe.
 *
 * Aucune scène ici : un contexte factice qui ne retient que les états visuels,
 * et les animations avancées à la main, comme la boucle le ferait.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { construireAnimations, MS_PAR_CASE, type ContexteAnimation } from '../../src/render3d/animations';
import type { CalqueUnites, EtatVisuel } from '../../src/render3d/unites';
import type { PriseChantier, PriseDrapeau } from '../../src/render3d/decor';
import type { EvenementJeu } from '../../src/engine/index';
import { partiePersonnalisee } from '../engine/aides';

/** Un calque d'unités réduit à ce que les animations touchent. */
function contexte(prise: PriseDrapeau | null = null, chantier: PriseChantier | null = null): {
  ctx: ContexteAnimation; visuel(id: string): EtatVisuel; retenues: string[]; liberees: string[];
} {
  const visuels = new Map<string, EtatVisuel>();
  const retenues: string[] = [];
  const liberees: string[] = [];
  const visuel = (id: string): EtatVisuel => {
    const memo = visuels.get(id);
    if (memo) return memo;
    const neuf: EtatVisuel = {
      dx: 0, dz: 0, dy: 0, cap: 0, recul: 0, secousse: 0, opacite: 1, affaissement: 0, clip: 'repos', clipDuree: 0,
    };
    visuels.set(id, neuf);
    return neuf;
  };
  const unites = {
    visuel,
    retenir: (u: { id: string }) => { retenues.push(u.id); },
    liberer: (id: string) => { liberees.push(id); },
  } as unknown as CalqueUnites;
  // Un document qui sait créer un canevas sans contexte : l'éclair de bouche s'en passe.
  const document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) } as unknown as Document;
  return {
    ctx: {
      unites, effets: new THREE.Group(), document, hauteurEn: () => 0,
      drapeau: () => prise, chantier: () => chantier, salir: () => undefined,
    },
    visuel, retenues, liberees,
  };
}

const etat = partiePersonnalisee(['....', '....'], {}, [
  { camp: 0, type: 'infanterie', x: 0, y: 0 },
  { camp: 1, type: 'infanterie', x: 1, y: 0 },
]);
const [mienne, sienne] = etat.unites.map((u) => u.id) as [string, string];

test('un déplacement pose deplacement pendant le glissement, repos à la fin', () => {
  const { ctx, visuel } = contexte();
  const evenements: EvenementJeu[] = [{
    type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 1 },
    chemin: [{ x: 0, y: 0 }, { x: 0, y: 1 }], interrompu: false,
  }];
  const { animations } = construireAnimations(evenements, etat, ctx);
  assert.equal(animations.length, 1);
  assert.equal(animations[0]!.duree, MS_PAR_CASE);
  animations[0]!.avancer(0.5);
  assert.equal(visuel(mienne).clip, 'deplacement');
  assert.equal(visuel(mienne).clipDuree, 0, 'la marche boucle à sa cadence propre');
  assert.notEqual(visuel(mienne).dz, 0);
  animations[0]!.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
  assert.equal(visuel(mienne).dz, 0);
});

test('une attaque pose tir sur l’attaquant, touche sur la cible, puis touche sur l’attaquant qui encaisse la riposte', () => {
  const { ctx, visuel } = contexte();
  const { animations } = construireAnimations([
    { type: 'attaque', attaquantId: mienne, cibleId: sienne, degats: 30, riposte: 10 },
  ], etat, ctx);
  const tir = animations.find((a) => a.nom === `tir:${mienne}`)!;
  const touche = animations.find((a) => a.nom === `touche:${sienne}`)!;
  const riposte = animations.find((a) => a.nom === `riposte:${mienne}`)!;
  assert.ok(tir && touche && riposte);

  tir.avancer(0.5);
  touche.avancer(0.5);
  riposte.avancer(0.2);
  assert.equal(visuel(mienne).clip, 'tir');
  assert.equal(visuel(mienne).clipDuree, tir.duree, 'le clip de tir est ajusté au geste');
  assert.equal(visuel(sienne).clip, 'touche');
  assert.equal(visuel(sienne).clipDuree, touche.duree);
  assert.equal(visuel(mienne).secousse, 0, 'la riposte attend que le tir soit parti');

  // Le tir finit, la riposte arrive : l'attaquant encaisse à son tour.
  tir.avancer(1);
  tir.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
  riposte.avancer(0.8);
  assert.equal(visuel(mienne).clip, 'touche');
  assert.ok(visuel(mienne).secousse > 0);
  riposte.terminer?.();
  touche.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
  assert.equal(visuel(sienne).clip, 'repos');
  assert.equal(visuel(mienne).secousse, 0);
});

test('une attaque sans riposte ne pose pas de touche sur l’attaquant', () => {
  const { ctx } = contexte();
  const { animations } = construireAnimations([
    { type: 'attaque', attaquantId: mienne, cibleId: sienne, degats: 30, riposte: 0 },
  ], etat, ctx);
  assert.deepEqual(animations.map((a) => a.nom).sort(), [`tir:${mienne}`, `touche:${sienne}`]);
});

test('une mise hors jeu pose hors_jeu, puis libère l’unité au repos', () => {
  const { ctx, visuel, retenues, liberees } = contexte();
  const { animations } = construireAnimations([
    { type: 'hors_jeu', uniteId: sienne, camp: 1, unite: 'infanterie' },
  ], etat, ctx);
  assert.deepEqual(retenues, [sienne]);
  animations[0]!.avancer(0.3);
  assert.equal(visuel(sienne).clip, 'hors_jeu');
  assert.equal(visuel(sienne).clipDuree, animations[0]!.duree);
  assert.ok(visuel(sienne).opacite < 1);
  animations[0]!.terminer?.();
  assert.equal(visuel(sienne).clip, 'repos', 'l’état final est juste même si l’on coupe');
  assert.deepEqual(liberees, [sienne]);
});

test('une capture pose capture pendant ses deux temps, acquise ou non', () => {
  const prise: PriseDrapeau = {
    seuil: 20, sommet: new THREE.Vector3(0, 1, 0), pied: new THREE.Vector3(),
    forcer: () => undefined, relacher: () => undefined,
  };
  const { ctx, visuel } = contexte(prise);
  const enCours = construireAnimations([
    { type: 'capture', uniteId: mienne, case: { x: 0, y: 0 }, points: 10, acquis: false, camp: 0 },
  ], etat, ctx).animations[0]!;
  enCours.avancer(0.5);
  assert.equal(visuel(mienne).clip, 'capture');
  assert.equal(visuel(mienne).clipDuree, enCours.duree);
  enCours.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');

  const acquise = construireAnimations([
    { type: 'capture', uniteId: mienne, case: { x: 0, y: 0 }, points: 20, acquis: true, camp: 0 },
  ], etat, ctx).animations[0]!;
  acquise.avancer(0.1);
  assert.equal(visuel(mienne).clip, 'capture');
  acquise.avancer(0.9);
  assert.equal(visuel(mienne).clip, 'capture');
  acquise.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
});

test('dans une même salve, le tir d’une unité attend la fin de son déplacement', () => {
  const { ctx, visuel } = contexte();
  // Un ordre « avancer puis tirer » : une seule salve, deux gestes de la même unité.
  const { animations } = construireAnimations([
    {
      type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 2 },
      chemin: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }], interrompu: false,
    },
    { type: 'attaque', attaquantId: mienne, cibleId: sienne, degats: 30, riposte: 10 },
  ], etat, ctx);
  const marche = animations.find((a) => a.nom === `deplacement:${mienne}`)!;
  const tir = animations.find((a) => a.nom === `tir:${mienne}`)!;
  const touche = animations.find((a) => a.nom === `touche:${sienne}`)!;
  const riposte = animations.find((a) => a.nom === `riposte:${mienne}`)!;
  const dureeMarche = 2 * MS_PAR_CASE;
  assert.equal(marche.duree, dureeMarche);
  assert.equal(tir.duree, dureeMarche + 260, 'le tir est retenu le temps de la marche');
  assert.equal(touche.duree, dureeMarche + 300, 'la cible encaisse quand le tir part, pas avant');
  assert.equal(riposte.duree, dureeMarche + 260 + 300, 'la riposte, après le tir');

  // À mi-marche, toutes les animations de la salve ont avancé du même temps :
  // seule la marche s'exprime, dans l'ordre où la boucle les appelle.
  const t = dureeMarche / 2;
  marche.avancer(t / marche.duree);
  tir.avancer(t / tir.duree);
  touche.avancer(t / touche.duree);
  riposte.avancer(t / riposte.duree);
  assert.equal(visuel(mienne).clip, 'deplacement', 'on marche, on ne tire pas encore');
  assert.equal(visuel(mienne).recul, 0);
  assert.equal(visuel(sienne).clip, 'repos', 'la cible n’a encore rien reçu');

  // La marche finit ; le tir commence juste après, et la cible encaisse.
  marche.avancer(1);
  marche.terminer?.();
  const t2 = dureeMarche + 100;
  tir.avancer(t2 / tir.duree);
  touche.avancer(t2 / touche.duree);
  riposte.avancer(t2 / riposte.duree);
  assert.equal(visuel(mienne).clip, 'tir');
  assert.equal(visuel(mienne).clipDuree, 260, 'la durée du geste, pas celle de l’attente');
  assert.equal(visuel(sienne).clip, 'touche');
  assert.equal(visuel(mienne).secousse, 0, 'pas encore de riposte');

  // Le tir finit ; la riposte se fait sentir.
  tir.avancer(1);
  tir.terminer?.();
  const t3 = dureeMarche + 260 + 100;
  riposte.avancer(t3 / riposte.duree);
  assert.equal(visuel(mienne).clip, 'touche');
  assert.ok(visuel(mienne).secousse > 0);
});

test('une capture qui suit un déplacement attend, et tient le drapeau où il était pendant l’attente', () => {
  const forces: [number | null, number][] = [];
  const prise: PriseDrapeau = {
    seuil: 20, sommet: new THREE.Vector3(0, 1, 0), pied: new THREE.Vector3(),
    forcer: (camp, niveau) => { forces.push([camp, niveau]); }, relacher: () => undefined,
  };
  const { ctx, visuel } = contexte(prise);
  const { animations } = construireAnimations([
    {
      type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 0, y: 1 },
      chemin: [{ x: 0, y: 0 }, { x: 0, y: 1 }], interrompu: false,
    },
    { type: 'capture', uniteId: mienne, case: { x: 0, y: 1 }, points: 10, acquis: false, camp: 0 },
  ], etat, ctx);
  const marche = animations.find((a) => a.nom === `deplacement:${mienne}`)!;
  const capture = animations.find((a) => a.nom === 'capture:0,1')!;
  assert.equal(capture.duree, MS_PAR_CASE + 460, 'la capture est retenue le temps de la marche');
  marche.avancer(0.5);
  capture.avancer((MS_PAR_CASE / 2) / capture.duree);
  assert.equal(visuel(mienne).clip, 'deplacement', 'pendant l’attente, la capture ne pose pas son clip');
  assert.ok(forces.length > 0, 'mais elle tient déjà le drapeau à son départ');
  assert.equal(forces[forces.length - 1]![1], 0, 'au niveau d’avant : rien encore');
  marche.avancer(1);
  marche.terminer?.();
  capture.avancer((MS_PAR_CASE + 230) / capture.duree);
  assert.equal(visuel(mienne).clip, 'capture');
  assert.ok(forces[forces.length - 1]![1] > 0, 'le drapeau monte');
  capture.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
});

test('une remise en service puis la capture de la même case s’enchaînent pour la même unité', () => {
  const prise: PriseDrapeau = {
    seuil: 40, sommet: new THREE.Vector3(0, 1, 0), pied: new THREE.Vector3(),
    forcer: () => undefined, relacher: () => undefined,
  };
  const chantier: PriseChantier = { eclairer: () => undefined, relacher: () => undefined };
  const { ctx, visuel } = contexte(prise, chantier);
  const { animations } = construireAnimations([
    { type: 'remise_en_service', uniteId: mienne, case: { x: 0, y: 0 }, camp: 0, prime: 1000 },
    { type: 'capture', uniteId: mienne, case: { x: 0, y: 0 }, points: 40, acquis: true, camp: 0 },
  ], etat, ctx);
  const remise = animations.find((a) => a.nom === 'remise:0,0')!;
  const capture = animations.find((a) => a.nom === 'capture:0,0')!;
  assert.equal(remise.duree, 1200);
  assert.equal(capture.duree, 1200 + 1100, 'la palissade tombe, puis le drapeau monte');
  remise.avancer(0.5);
  capture.avancer(600 / capture.duree);
  assert.equal(visuel(mienne).clip, 'capture');
  remise.avancer(1);
  remise.terminer?.();
  capture.avancer(1300 / capture.duree);
  assert.equal(visuel(mienne).clip, 'capture');
  capture.terminer?.();
  assert.equal(visuel(mienne).clip, 'repos');
});

test('couper un geste en plein milieu laisse l’unité au repos et à sa place', () => {
  const { ctx, visuel } = contexte();
  const { animations } = construireAnimations([{
    type: 'deplacement', uniteId: mienne, de: { x: 0, y: 0 }, vers: { x: 3, y: 0 },
    chemin: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], interrompu: false,
  }], etat, ctx);
  animations[0]!.avancer(0.2);
  assert.equal(visuel(mienne).clip, 'deplacement');
  assert.notEqual(visuel(mienne).dx, 0);
  // C'est ce que `Boucle.viderFile()` fait sur un clic : `terminer` sans avoir fini.
  animations[0]!.terminer?.();
  assert.deepEqual([visuel(mienne).clip, visuel(mienne).dx, visuel(mienne).dz, visuel(mienne).dy], ['repos', 0, 0, 0]);
});
