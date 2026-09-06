/**
 * Vérifie qu'une solution **légale et simple** gagne chaque mission de campagne
 * face à l'IA du scénario, puis que son rejeu donne la même empreinte.
 *
 * Ce n'est pas une mesure de difficulté humaine : le camp du joueur est tenu par
 * une heuristique courte — les capteurs vont vers la case d'objectif la plus
 * proche et capturent, le génie remet en service ce qui est désaffecté, les
 * autres unités frappent au mieux, et les usines recrutent. Si cette heuristique
 * ne gagne plus, c'est que la mission a changé de nature, pas de difficulté.
 */
import { readFileSync } from 'node:fs';
import {
  appliquer, chargerCatalogue, creerPartie, empreinte, enregistrerPartie, estDesaffecte, rejouer,
  restaurerRng, sceneDepuis, type Action, type EtatPartie, type Unite,
} from '../src/engine/index';
import { jouerTour, meilleureOption, meilleureProduction, POIDS_AGRESSIVE, POIDS_PONDEREE, strategie } from '../src/ai/index';
import { ciblesDepuis, terrainLogique } from '../src/engine/index';
import { casesAtteignables, cheminVers, coutEntree, portee, voisines } from '../src/engine/regles/mouvement';
import { cleCase, porte } from '../src/engine/types';
import { validerMapDef, validerScenario, type Case } from '../src/schemas/index';
import { resoudreCommandantsScenario } from '../src/content/commandants-jeu';

const manifeste = JSON.parse(readFileSync('content/campagne.json', 'utf8')) as { missions: { scenarioCle: string }[] };
const TOURS_MAX = 60;

/** Distance en pas de chaque case jusqu'à la cible, pour cette unité, sur la grille entière. */
function distancesVers(e: EtatPartie, cat: ReturnType<typeof chargerCatalogue>, u: Unite, cible: Case): Map<string, number> {
  const distances = new Map<string, number>();
  const file: Case[] = [cible];
  distances.set(cleCase(cible), 0);
  while (file.length) {
    const c = file.shift()!;
    for (const v of voisines(c)) {
      const k = cleCase(v);
      if (distances.has(k) || coutEntree(e, cat, u, v) === null) continue;
      distances.set(k, distances.get(cleCase(c))! + 1);
      file.push(v);
    }
  }
  return distances;
}

for (const { scenarioCle } of manifeste.missions) {
  const vs = validerScenario(JSON.parse(readFileSync(`content/scenarios/${scenarioCle}.json`, 'utf8')));
  if (!vs.ok) throw new Error(JSON.stringify(vs));
  const s = vs.valeur;
  const vm = validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`, 'utf8')));
  if (!vm.ok) throw new Error(JSON.stringify(vm));
  const cat = chargerCatalogue(s.catalogueVersion);
  const commandants = resoudreCommandantsScenario(s);
  const scene = sceneDepuis(s, vm.valeur, commandants);
  const ia = strategie(s.commandants.find((c) => c.camp === 1)?.ia ?? 'ponderee');
  const objectif = s.victoire[0]!;
  // Trois joueurs simples, du plus lisible au plus brutal : le premier qui gagne
  // est la démonstration. Aucun n'est une mesure de difficulté humaine.
  const JOUEURS = ['heuristique', 'ponderee', 'agressive'] as const;
  let demonstration: { joueur: string; etat: EtatPartie; actions: Action[] } | null = null;
  for (const joueur of JOUEURS) {
  let e = creerPartie(scene, cat, `${s.code}:1`);
  const actions: Action[] = [];

  function agir(a: Action): boolean {
    const r = appliquer(e, a, cat, commandants);
    if (!r.ok) return false;
    e = r.etat;
    actions.push(a);
    return true;
  }

  /** Les cases que le joueur doit encore prendre, selon l'objectif. */
  function ciblesCapture(): Case[] {
    if (objectif.type === 'capturer') return objectif.cases.filter((c) => e.proprietaires[cleCase(c)] !== 0);
    if (objectif.type === 'capture_qg') {
      return e.camps.filter((c) => c.id !== 0 && c.qgCase !== null).map((c) => {
        const [x, y] = c.qgCase!.split(',');
        return { x: Number(x), y: Number(y) };
      });
    }
    return [];
  }

  /** Mène une unité vers la cible et capture si elle y arrive. */
  function progresserVers(u: Unite, cible: Case, capturer: boolean): boolean {
    const p = portee(e, cat, u);
    const distances = distancesVers(e, cat, u, cible);
    const libres = casesAtteignables(p).filter((c) => !e.unites.some((z) => z.id !== u.id && !z.dansTransport && z.x === c.x && z.y === c.y));
    libres.sort((a, b) => (distances.get(cleCase(a)) ?? 999) - (distances.get(cleCase(b)) ?? 999));
    const arrivee = libres[0];
    if (!arrivee) return false;
    const chemin = cheminVers(p, u, arrivee);
    if (!chemin) return false;
    const surCible = arrivee.x === cible.x && arrivee.y === cible.y;
    return agir({ type: 'ordre', uniteId: u.id, chemin, suite: capturer && surCible ? { type: 'capturer' } : { type: 'rien' } });
  }

  /** Tire sur un adversaire qui occupe une case d'objectif, depuis la meilleure case atteignable. */
  function frapperOccupant(u: Unite, objectifs: Case[]): boolean {
    const occupants = e.unites.filter((z) => z.camp !== 0 && !z.dansTransport && objectifs.some((o) => o.x === z.x && o.y === z.y));
    if (occupants.length === 0) return false;
    const p = portee(e, cat, u);
    const candidats = casesAtteignables(p)
      .filter((c) => !objectifs.some((o) => o.x === c.x && o.y === c.y))
      .filter((c) => !e.unites.some((z) => z.id !== u.id && !z.dansTransport && z.x === c.x && z.y === c.y));
    // Le terrain d'arrivée compte : on tire depuis la case la mieux défendue.
    candidats.sort((a, b) => (cat.terrains[terrainLogique(e, cat, b) ?? 'plaine']?.defense ?? 0) - (cat.terrains[terrainLogique(e, cat, a) ?? 'plaine']?.defense ?? 0));
    for (const c of candidats) {
      const aBouge = c.x !== u.x || c.y !== u.y;
      const cible = ciblesDepuis(e, cat, u, c, aBouge).find((z) => occupants.some((o) => o.id === z.id));
      if (!cible) continue;
      const chemin = cheminVers(p, u, c);
      if (chemin && agir({ type: 'ordre', uniteId: u.id, chemin, suite: { type: 'attaquer', cible: { x: cible.x, y: cible.y } } })) return true;
    }
    return false;
  }

  /** Quitte les cases d'objectif pour la case libre la plus proche d'un adversaire, et tire si possible. */
  function degager(u: Unite, objectifs: Case[]): void {
    const p = portee(e, cat, u);
    const adversaires = e.unites.filter((z) => z.camp !== 0 && !z.dansTransport);
    const libres = casesAtteignables(p)
      .filter((c) => !objectifs.some((o) => o.x === c.x && o.y === c.y))
      .filter((c) => !e.unites.some((z) => z.id !== u.id && !z.dansTransport && z.x === c.x && z.y === c.y));
    const proche = (c: Case): number => Math.min(999, ...adversaires.map((z) => Math.abs(z.x - c.x) + Math.abs(z.y - c.y)));
    libres.sort((a, b) => proche(a) - proche(b));
    for (const c of libres) {
      const chemin = cheminVers(p, u, c);
      if (!chemin) continue;
      const aBouge = c.x !== u.x || c.y !== u.y;
      const cible = ciblesDepuis(e, cat, u, c, aBouge)[0];
      if (agir({ type: 'ordre', uniteId: u.id, chemin, suite: cible ? { type: 'attaquer', cible } : { type: 'rien' } })) return;
    }
    agir({ type: 'ordre', uniteId: u.id, chemin: [{ x: u.x, y: u.y }], suite: { type: 'rien' } });
  }

  for (let tour = 0; tour < TOURS_MAX && !e.partie.terminee; tour += 1) {
    if (process.env['DEBUG_CAMPAGNE'] === scenarioCle && e.campCourant === 0) {
      const objets = ciblesCapture().map((c) => `${cleCase(c)}:${e.proprietaires[cleCase(c)] ?? '-'}`).join(' ');
      const troupes = e.unites.map((u) => `${u.camp}${u.type.slice(0, 3)}@${u.x},${u.y}/${u.pv}${u.pointsCapture ? '+' + u.pointsCapture : ''}`).join(' ');
      console.log(`  j${e.journee} fonds ${e.camps[0]!.fonds} cibles ${objets} | ${troupes}`);
    }
    if (e.campCourant !== 0) {
      const tourIa = jouerTour(e, ia, restaurerRng(e.graine, e.flux), cat, commandants);
      if (tourIa.refus.length) throw new Error(JSON.stringify(tourIa.refus));
      e = tourIa.etat;
      actions.push(...tourIa.actions);
      continue;
    }

    if (joueur !== 'heuristique' && scenarioCle !== 'pacte_du_col') {
      const tourJoueur = jouerTour(e, strategie(joueur), restaurerRng(e.graine, e.flux), cat, commandants);
      e = tourJoueur.etat;
      actions.push(...tourJoueur.actions);
      continue;
    }
    // Démonstration du raccourci du col : ouvrir la montagne, puis libérer l'approche.
    if (scenarioCle === 'pacte_du_col') {
      const genie = e.unites.find((u) => u.type === 'genie');
      if (genie && e.journee === 1) agir({ type: 'ordre', uniteId: genie.id, chemin: [{ x: genie.x, y: genie.y }], suite: { type: 'construire', cible: { x: 5, y: 2 } } });
      if (genie && e.journee === 2) agir({ type: 'ordre', uniteId: genie.id, chemin: [{ x: genie.x, y: genie.y }, { x: 4, y: 1 }], suite: { type: 'rien' } });
    }

    for (const id of e.unites.filter((u) => u.camp === 0 && !u.dansTransport).map((u) => u.id)) {
      if (e.partie.terminee) break;
      const u = e.unites.find((z) => z.id === id);
      if (!u || u.etat !== 'prete') continue;
      const type = cat.unites[u.type]!;
      const capteur = porte(type, 'capture') && type.capture;
      const batisseur = porte(type, 'genie');

      if (objectif.type === 'proteger' && id === objectif.uniteRef && objectif.destination) {
        progresserVers(u, objectif.destination, false);
        continue;
      }
      // Une capture entamée se termine avant tout : bouger remettrait les points à zéro.
      if (u.pointsCapture > 0 && agir({ type: 'ordre', uniteId: id, chemin: [{ x: u.x, y: u.y }], suite: { type: 'capturer' } })) continue;

      const cibles = ciblesCapture().filter((c) => batisseur ? estDesaffecte(e, c) : capteur && (!estDesaffecte(e, c) || !e.unites.some((z) => z.camp === 0 && z.type === 'genie')));
      if ((capteur || batisseur) && cibles.length > 0) {
        const distances = cibles.map((c) => ({ c, d: distancesVers(e, cat, u, c).get(cleCase(u)) ?? 999 }));
        distances.sort((a, b) => a.d - b.d);
        if (distances[0]!.d < 999 && progresserVers(u, distances[0]!.c, true)) continue;
      }
      // Un adversaire posé sur une case d'objectif est la cible prioritaire :
      // tant qu'il y reste, aucune capture ni remise en service n'est possible.
      if (frapperOccupant(u, ciblesCapture())) continue;
      // Les autres frappent au mieux, mais ne stationnent jamais sur une case
      // d'objectif : un char garé sur la ville à prendre bloque son propre capteur.
      const option = meilleureOption(e, cat, u, POIDS_AGRESSIVE);
      const a = option.action;
      const arrivee = a.type === 'ordre' ? a.chemin[a.chemin.length - 1]! : null;
      const objectifs = ciblesCapture();
      const gene = arrivee !== null && objectifs.some((c) => c.x === arrivee.x && c.y === arrivee.y);
      if (!gene && agir(a)) continue;
      degager(u, objectifs);
    }

    // Recruter tant qu'une usine est libre : l'économie fait partie de la solution.
    for (let i = 0; i < 4 && !e.partie.terminee; i += 1) {
      const achat = meilleureProduction(e, cat, 0, POIDS_PONDEREE);
      if (!achat || !agir(achat)) break;
    }
    if (!e.partie.terminee) agir({ type: 'finTour' });
  }

  const repetition = rejouer(scene, cat, enregistrerPartie(e, actions), commandants);
  if (repetition.refus.length || empreinte(repetition.etat) !== empreinte(e)) throw new Error(`${scenarioCle}: rejeu divergent`);
  console.log(`  ${joueur.padEnd(11)} ${JSON.stringify(e.partie)} journée ${e.journee}, ${actions.length} actions`);
  if (e.partie.vainqueur === 0) { demonstration = { joueur, etat: e, actions }; break; }
  }
  if (demonstration) {
    console.log(`${scenarioCle} : gagnée par ${demonstration.joueur} en ${demonstration.etat.journee} journées, rejeu conforme`);
  } else {
    console.log(`${scenarioCle} : AUCUN joueur simple ne gagne`);
    process.exitCode = 1;
  }
}
