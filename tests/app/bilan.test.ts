// Le bilan de fin de manche : la seule note que le jeu donne au joueur, et donc
// la seule qui doive être juste. Ces tests travaillent sur une **vraie** partie
// — carte, moteur, unités de départ — parce que la moitié des chiffres du bilan
// se lisent sur des grandeurs de l'état (`produites`, `unites`, `proprietaires`)
// dont la forme exacte n'est pas devinable : `produites` est indexé
// « camp:unite », les unités embarquées comptent, les bâtiments désaffectés non.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  chargerCatalogue, creerPartie, reglagesParDefaut, sceneDeCarte, type EtatPartie,
} from '../../src/engine/index';
import { validerMapDef, type MapDef } from '../../src/schemas/index';
import { bilanDeFin, JOURNEES_REFERENCE } from '../../src/app/jeu/[scenario]/bilan';

const CAT = chargerCatalogue();

function carte(): MapDef {
  const chemin = path.resolve(import.meta.dirname, '..', 'engine', 'cartes', 'plaine.json');
  const r = validerMapDef(JSON.parse(readFileSync(chemin, 'utf8')) as unknown);
  if (!r.ok) throw new Error('carte de test invalide');
  return r.valeur;
}

/** Une partie neuve sur la plaine : quatre unités par camp, quatre bâtiments par camp. */
function partie(): EtatPartie {
  return creerPartie(sceneDeCarte(carte(), reglagesParDefaut({ meteoForcee: 'clair' })), CAT, 'bilan');
}

test('le bilan lit les faits de l’état, jamais une estimation', () => {
  const c = carte();
  const etat = partie();
  // Une manche gagnée à la troisième journée : le joueur a produit deux unités,
  // il lui reste ses quatre unités de départ — donc deux perdues —, et il ne
  // reste plus rien en face.
  etat.journee = 3;
  etat.reglages.limiteJournees = 10;
  etat.produites['0:infanterie'] = 2;
  etat.produites['1:infanterie'] = 3;
  etat.unites = etat.unites.filter((u) => u.camp === 0);
  const b = bilanDeFin(etat, c, 0);

  assert.equal(b.journees, 3);
  assert.equal(b.limite, 10);
  assert.equal(b.engagees, 6, 'quatre au départ, deux produites');
  assert.equal(b.survivantes, 4);
  assert.equal(b.perdues, 2, 'engagées moins debout : le journal n’a rien à dire ici');
  assert.equal(b.neutralisees, 7, 'quatre au départ plus trois produites, aucune debout');
  assert.equal(b.batiments, 4, 'les bâtiments tenus se comptent dans les propriétaires');
  // Deux journées consommées sur dix : il en reste huit dixièmes.
  assert.equal(b.rythme, 80);
  assert.equal(b.puissance, 100);
  assert.equal(b.tenue, 67);
  assert.equal(b.note, 82);
  assert.equal(b.rang, 'A');
});

test('le bilan ne lit pas le journal : c’est une fenêtre, pas une archive', () => {
  // `engine/etat.ts` tronque `journal` à 120 événements. Un bilan qui y
  // compterait les mises hors jeu serait juste sur une manche courte et faux sur
  // une longue — donc faux. Vider le journal ne doit rien changer.
  const c = carte();
  const avec = partie();
  avec.journee = 5;
  avec.produites['0:char_leger'] = 1;
  avec.unites = avec.unites.filter((u) => u.camp === 0);
  avec.journal = [{ type: 'fin_partie', vainqueur: 0, nul: false, motif: 'hors_jeu_total' }];
  const sans = { ...avec, journal: [] };
  assert.deepEqual(bilanDeFin(sans, c, 0), bilanDeFin(avec, c, 0));
});

test('sans échéance au scénario, la référence écrite sert — et les parts restent bornées', () => {
  const c = carte();
  const etat = partie();
  etat.reglages.limiteJournees = null;
  etat.journee = JOURNEES_REFERENCE / 2 + 1;
  assert.equal(bilanDeFin(etat, c, 0).limite, null);
  assert.equal(bilanDeFin(etat, c, 0).rythme, 50, 'la moitié de la référence consommée');

  // Au-delà de l'échéance, le rythme tombe à zéro : il ne devient jamais négatif.
  etat.reglages.limiteJournees = 4;
  etat.journee = 40;
  assert.equal(bilanDeFin(etat, c, 0).rythme, 0);

  // Le premier jour ne coûte rien : gagner le jour même est un sans-faute.
  etat.journee = 1;
  assert.equal(bilanDeFin(etat, c, 0).rythme, 100);
});

test('un camp sans force engagée ne pénalise pas : une part sur zéro vaut cent', () => {
  const c = carte();
  const etat = partie();
  // Une carte sans unité de départ ni production : rien à perdre, rien à abattre.
  const vide: MapDef = { ...c, unitesDepart: [] };
  etat.unites = [];
  etat.journee = 1;
  etat.reglages.limiteJournees = 10;
  const b = bilanDeFin(etat, vide, 0);
  assert.equal(b.tenue, 100);
  assert.equal(b.puissance, 100);
  assert.equal(b.rang, 'S', 'aucun dénominateur nul ne doit produire un NaN ni un rang faux');
});

test('les quatre paliers du rang se suivent, du sans-faute à la victoire coûteuse', () => {
  const c = carte();
  /** Une manche dont on choisit la journée et le nombre de survivants. */
  const note = (journee: number, survivants: number): ReturnType<typeof bilanDeFin> => {
    const etat = partie();
    etat.journee = journee;
    etat.reglages.limiteJournees = 20;
    etat.unites = etat.unites.filter((u) => u.camp === 0).slice(0, survivants);
    return bilanDeFin(etat, c, 0);
  };
  assert.equal(note(1, 4).rang, 'S', 'gagné le premier jour sans une égratignure');
  assert.equal(note(6, 3).rang, 'A');
  assert.equal(note(12, 2).rang, 'B');
  assert.equal(note(19, 1).rang, 'C', 'gagné au dernier moment, et presque seul');
  // La note est bien la moyenne des trois axes : la lire ailleurs serait un
  // second calcul, donc une seconde vérité.
  const b = note(6, 3);
  assert.equal(b.note, Math.round((b.rythme + b.puissance + b.tenue) / 3));
});
