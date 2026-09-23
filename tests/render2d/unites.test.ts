// Les poses des unités : ce qu'on dessine, dans quelle vue, à quelle opacité, et
// ce qui ne se dessine pas. Chaque règle vient de la 3D, qui l'a trouvée en
// jouant : on vérifie ici que la 2D la tient.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EtatPartie } from '../../src/engine/index';
import { ECUME_NAVIRE, OMBRE_UNITE, versPlan } from '../../src/render2d/contrat';
import { FORMES } from '../../src/render2d/replis';
import {
  HAUTEUR_VOL, OPACITE_FURTIVE, OPACITE_JOUEE, orientationVers, posesUnites, solSousUnite, Visuels,
  type OptionsPosesUnites,
} from '../../src/render2d/unites';
import { CAT, partiePersonnalisee } from '../engine/aides';

function etatEssai(): EtatPartie {
  return partiePersonnalisee(
    ['PPPPP', 'PPPPP', 'PPPPP'],
    {},
    [
      { camp: 0, type: 'infanterie', x: 0, y: 0 },
      { camp: 1, type: 'infanterie', x: 4, y: 0 },
      { camp: 0, type: 'helico', x: 2, y: 1 },
      { camp: 1, type: 'char_leger', x: 4, y: 2 },
    ],
  );
}

function options(extra: Partial<OptionsPosesUnites> = {}): OptionsPosesUnites {
  return {
    camp: 0, visibles: null, unitesVues: null, marques: null, selection: null,
    equipe: (camp) => (camp === 0 ? [0, 0, 1] : [1, 0, 0]),
    entree: (type) => `unite_${type}_base`,
    animation: () => null,
    tempsMs: 0,
    reduit: false,
    ...extra,
  };
}

const figurines = (poses: ReturnType<typeof posesUnites>['poses']) => poses.filter((p) => p.calque === 'unites' && p.instance.entree.startsWith('unite_'));

test('au repos, le camp 0 regarde vers la droite, l’autre vers la gauche', () => {
  const e = etatEssai();
  const r = posesUnites(e, CAT, new Visuels(), options());
  const [a, b] = [e.unites[0]!, e.unites[1]!];
  const de = (id: string) => figurines(r.poses).find((p) => p.instance.x === (e.unites.find((u) => u.id === id)!.x + 0.5) && p.instance.y === (e.unites.find((u) => u.id === id)!.y + 0.5))!.instance;
  assert.equal(de(a.id).miroir, false);
  assert.equal(de(b.id).miroir, true);
});

test('chaque unité a son ombre sur la case — même un appareil en vol, qui est au-dessus', () => {
  const e = etatEssai();
  const r = posesUnites(e, CAT, new Visuels(), options());
  const ombres = r.poses.filter((p) => p.calque === 'ombres_unites');
  assert.equal(ombres.length, 4);
  assert.ok(ombres.every((p) => p.instance.entree === FORMES.ombre && (p.instance.h ?? 0) === 0));
  const helico = e.unites[2]!;
  assert.equal(r.positions.get(helico.id)?.h, HAUTEUR_VOL);
  const pose = figurines(r.poses).find((p) => p.instance.x === helico.x + 0.5 && p.instance.y === helico.y + 0.5)!;
  assert.equal(pose.instance.h, HAUTEUR_VOL);
});

test('une unité qui a joué pâlit à 0,6 et porte le cadenas ; une furtive se voile pour son seul camp', () => {
  const e = etatEssai();
  const [a, b] = [e.unites[0]!, e.unites[1]!];
  a.etat = 'agi';
  b.furtive = true;
  const r = posesUnites(e, CAT, new Visuels(), options());
  const opaciteDe = (x: number, y: number) => figurines(r.poses).find((p) => p.instance.x === x + 0.5 && p.instance.y === y + 0.5)!.instance.opacite;
  assert.equal(opaciteDe(a.x, a.y), OPACITE_JOUEE);
  assert.equal(opaciteDe(b.x, b.y), 1, 'une furtive adverse vue au contact est entière');
  assert.ok(r.poses.some((p) => p.instance.entree === FORMES.pv(0, true)), 'le cadenas d’une unité intacte qui a joué');
  // Du point de vue du camp 1, sa furtive se voile.
  const r1 = posesUnites(e, CAT, new Visuels(), options({ camp: 1 }));
  const opacite1 = figurines(r1.poses).find((p) => p.instance.x === b.x + 0.5 && p.instance.y === b.y + 0.5)!.instance.opacite;
  assert.equal(opacite1, OPACITE_FURTIVE);
});

test('une unité du camp qui ne joue pas n’est jamais « jouée » : ce n’est qu’un reste du tour d’avant', () => {
  const e = etatEssai();
  e.unites[1]!.etat = 'agi';
  const r = posesUnites(e, CAT, new Visuels(), options());
  assert.ok(figurines(r.poses).every((p) => p.instance.opacite === 1));
});

test('la pastille de PV paraît sous 10 PV, et les PV retenus par un geste l’emportent sur l’état', () => {
  const e = etatEssai();
  const a = e.unites[0]!;
  a.pv = 43;
  const visuels = new Visuels();
  let r = posesUnites(e, CAT, visuels, options());
  assert.ok(r.poses.some((p) => p.instance.entree === FORMES.pv(5, false)));
  assert.equal(r.poses.filter((p) => p.instance.entree.startsWith('forme_pv_')).length, 1, 'les unités intactes n’en ont pas');
  visuels.visuel(a.id).pv = 8;
  r = posesUnites(e, CAT, visuels, options());
  assert.ok(r.poses.some((p) => p.instance.entree === FORMES.pv(8, false)));
});

test('une unité transportée ne se dessine pas', () => {
  const e = etatEssai();
  e.unites[0]!.dansTransport = e.unites[3]!.id;
  const r = posesUnites(e, CAT, new Visuels(), options());
  assert.equal(figurines(r.poses).length, 3);
  assert.equal(r.positions.has(e.unites[0]!.id), false);
});

test('on ne dessine que ce que le joueur voit : la case ne suffit pas', () => {
  const e = etatEssai();
  const [a, b, c, d] = e.unites as [typeof e.unites[0], typeof e.unites[0], typeof e.unites[0], typeof e.unites[0]];
  const visibles = new Set([`${a.x},${a.y}`, `${b.x},${b.y}`, `${c.x},${c.y}`]);
  // b est sur une case vue, mais le moteur dit qu'on ne le voit pas (tapi, furtif) ; d est sur une case cachée.
  const r = posesUnites(e, CAT, new Visuels(), options({ visibles, unitesVues: new Set([a.id, c.id, d.id]) }));
  const ids = [...r.positions.keys()];
  assert.deepEqual(ids.sort(), [a.id, c.id].sort());
});

test('une unité retenue se dessine où elle a été retenue, même sortie de l’état', () => {
  const e = etatEssai();
  const visuels = new Visuels();
  const sortie = e.unites[1]!;
  visuels.retenir(sortie);
  e.unites.splice(1, 1);
  let r = posesUnites(e, CAT, visuels, options({ visibles: new Set(['0,0']) }));
  assert.ok(r.positions.has(sortie.id), 'retenue, elle se voit malgré le brouillard : elle sort sous nos yeux');
  visuels.poserRetenue(sortie.id, { x: 3, y: 2 });
  r = posesUnites(e, CAT, visuels, options());
  assert.deepEqual(r.positions.get(sortie.id), { x: 3.5, y: 2.5, h: 0 });
  visuels.liberer(sortie.id);
  r = posesUnites(e, CAT, visuels, options());
  assert.equal(r.positions.has(sortie.id), false);
});

test('les décalages d’un geste déplacent la figurine, et la sélection pose l’anneau à ses pieds', () => {
  const e = etatEssai();
  const a = e.unites[0]!;
  const visuels = new Visuels();
  const v = visuels.visuel(a.id);
  v.dx = 0.5;
  v.dy = 0.25;
  v.orientation = 'bas';
  const r = posesUnites(e, CAT, visuels, options({ selection: a.id }));
  assert.deepEqual(r.selection, { x: a.x + 1, y: a.y + 0.75 });
  const pose = figurines(r.poses).find((p) => p.instance.x === a.x + 1)!;
  assert.equal(pose.instance.miroir, false);
  // Le point de plan d'une instance est bien celui de son sol décalé.
  assert.deepEqual(versPlan(pose.instance.x, pose.instance.y, 0), versPlan(a.x + 1, a.y + 0.75, 0));
});

test('une marque du télégraphage se pose au-dessus de l’unité désignée', () => {
  const e = etatEssai();
  const a = e.unites[0]!;
  const r = posesUnites(e, CAT, new Visuels(), options({ marques: new Map([[a.id, 'designee']]) }));
  const marque = r.poses.find((p) => p.instance.entree === FORMES.marque('designee'));
  assert.ok(marque);
  assert.ok((marque.instance.h ?? 0) > 0.9);
});

test('un repos cuit et animé respire à la cadence de l’atlas — sauf joué ou sous réduction', () => {
  const e = etatEssai();
  const anime = options({ animation: () => ({ index: 3, cadres: 4, ips: 12, boucle: true }), tempsMs: 5000 });
  assert.equal(posesUnites(e, CAT, new Visuels(), anime).animees, true);
  assert.equal(posesUnites(e, CAT, new Visuels(), { ...anime, reduit: true }).animees, false);
  for (const u of e.unites) if (u.camp === 0) u.etat = 'agi';
  const r = posesUnites(e, CAT, new Visuels(), anime);
  const jouees = figurines(r.poses).filter((p) => p.instance.opacite === OPACITE_JOUEE);
  assert.ok(jouees.length > 0 && jouees.every((p) => p.instance.cadre === 0), 'une unité jouée se fige');
});

test('l’orientation d’un pas : la plus longue composante l’emporte', () => {
  assert.equal(orientationVers(1, 0, 'bas'), 'droite');
  assert.equal(orientationVers(-1, 0.2, 'bas'), 'gauche');
  assert.equal(orientationVers(0, 1, 'droite'), 'bas');
  assert.equal(orientationVers(0.1, -1, 'droite'), 'haut');
  assert.equal(orientationVers(0, 0, 'haut'), 'haut');
});

test('sous un navire, l’écume et non l’ombre : une ellipse claire, centrée sur la coque, qui pâlit avec lui', () => {
  // Une ombre sombre sur la mer noyait le graphite sous le pont (règle 13 de
  // l'artiste technique, charte §3.8) : sous ce qui flotte, le rendu pose l'écume.
  const e = partiePersonnalisee(
    ['WWWPP', 'WWWPP'],
    {},
    [
      { camp: 0, type: 'barge', x: 0, y: 0 },
      { camp: 0, type: 'cuirasse', x: 2, y: 1 },
      { camp: 1, type: 'infanterie', x: 4, y: 0 },
    ],
  );
  const [barge, cuirasse, fantassin] = e.unites as [typeof e.unites[0], typeof e.unites[0], typeof e.unites[0]];
  /** Ce que la pose d'une unité met sous elle : la pose se range à son pied, quel que soit son décalage. */
  const sous = (u: typeof barge) => {
    const r = posesUnites(e, CAT, new Visuels(), options());
    const trouvee = r.poses.find((q) => q.calque === 'ombres_unites' && q.colonne === u.x + 0.5 && q.ligne === u.y + 0.5);
    assert.ok(trouvee, `rien sous ${u.type}`);
    return trouvee.instance;
  };
  const b = sous(barge);
  assert.equal(b.entree, FORMES.ecume);
  assert.equal(b.x, barge.x + 0.5 + ECUME_NAVIRE.decalageX);
  assert.equal(b.y, barge.y + 0.5 + ECUME_NAVIRE.decalageY, 'centrée sur le pied : l’eau entoure la coque, elle ne dépend pas de la lumière');
  assert.equal(b.opacite, ECUME_NAVIRE.opacite);
  assert.equal(b.h ?? 0, 0, 'sur l’eau, jamais levée');
  // Un grand navire la pose plus large, à la taille de sa silhouette.
  assert.ok((sous(cuirasse).echelle ?? 1) > (b.echelle ?? 1));
  // Sur terre, l'ombre, décalée derrière l'unité comme avant.
  const f = sous(fantassin);
  assert.equal(f.entree, FORMES.ombre);
  assert.equal(f.y, fantassin.y + 0.5 + OMBRE_UNITE.decalageY);
  assert.equal(f.opacite, OMBRE_UNITE.opacite);
  // Un navire qui a joué pâlit, son écume avec lui.
  barge.etat = 'agi';
  assert.ok(Math.abs((sous(barge).opacite ?? 0) - ECUME_NAVIRE.opacite * OPACITE_JOUEE) < 1e-12);
});

test('solSousUnite : l’écume pour ce qui flotte, l’ombre pour tout le reste — un appareil n’est jamais en mer', () => {
  assert.deepEqual(solSousUnite({ domaine: 'mer' }), { entree: FORMES.ecume, forme: ECUME_NAVIRE });
  assert.deepEqual(solSousUnite({ domaine: 'terre' }), { entree: FORMES.ombre, forme: OMBRE_UNITE });
  assert.deepEqual(solSousUnite({ domaine: 'air' }), { entree: FORMES.ombre, forme: OMBRE_UNITE });
  // Les cinq navires du catalogue, et eux seuls.
  const navires = Object.values(CAT.unites).filter((t) => solSousUnite(t).entree === FORMES.ecume).map((t) => t.cle).sort();
  assert.deepEqual(navires, ['barge', 'cuirasse', 'drone_marin', 'porte_avions', 'sous_marin']);
});
