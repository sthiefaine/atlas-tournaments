// Ports et stations radar (7 septembre 2026) : un port se pose sur une côte, à
// la distance d'un aéroport, l'image d'un port est un port, et les ports des
// camps se rejoignent par la même mer — sinon une flotte ne rencontre jamais
// l'adversaire. Sans ces paramètres, le générateur rend exactement les cartes
// d'avant : les empreintes ci-dessous ont été prises avant leur arrivée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { chargerTerrains } from '../../src/content/index';
import {
  PROFILS_BIOME, apercuTexte, creerCadre, creerRng, genererCarte, mesurer, verifierCarte,
} from '../../src/mapgen/index';
import { validerMapDef } from '../../src/schemas/index';
import {
  BIOMES, CARACTERE_PAR_TERRAIN, SYMETRIES, type Biome, type MapDef, type ParametresCarte,
  type Symetrie,
} from '../../src/schemas/types';

// ---------------------------------------------------------------------------
// Outils de lecture d'une carte
// ---------------------------------------------------------------------------

interface Case { x: number; y: number }

/** Toutes les cases portant ce caractère, en lecture haut-gauche. */
function cases(carte: MapDef, car: string): Case[] {
  const sortie: Case[] = [];
  for (let y = 0; y < carte.hauteur; y += 1) {
    const ligne = carte.grille[y] ?? '';
    for (let x = 0; x < carte.largeur; x += 1) if (ligne[x] === car) sortie.push({ x, y });
  }
  return sortie;
}

function caractere(carte: MapDef, x: number, y: number): string {
  return (carte.grille[y] ?? '')[x] ?? '';
}

function voisins4(carte: MapDef, c: Case): Case[] {
  return [{ x: c.x, y: c.y - 1 }, { x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 }]
    .filter((v) => v.x >= 0 && v.y >= 0 && v.x < carte.largeur && v.y < carte.hauteur);
}

/** Caractères franchissables par le mouvement `mer`, lus dans le canon (mer et port). */
const NAVIGABLES = new Set(chargerTerrains()
  .filter((t) => typeof t.couts.mer === 'number')
  .map((t) => t.car));

/** Étiquette de composante navigable par case, `-1` à terre. */
function composantesNavigables(carte: MapDef): Int32Array {
  const etiquettes = new Int32Array(carte.largeur * carte.hauteur).fill(-1);
  let numero = 0;
  for (let y = 0; y < carte.hauteur; y += 1) {
    for (let x = 0; x < carte.largeur; x += 1) {
      const depart = y * carte.largeur + x;
      if (etiquettes[depart] !== -1 || !NAVIGABLES.has(caractere(carte, x, y))) continue;
      const file: Case[] = [{ x, y }];
      etiquettes[depart] = numero;
      for (let tete = 0; tete < file.length; tete += 1) {
        for (const v of voisins4(carte, file[tete] as Case)) {
          const i = v.y * carte.largeur + v.x;
          if (etiquettes[i] !== -1 || !NAVIGABLES.has(caractere(carte, v.x, v.y))) continue;
          etiquettes[i] = numero;
          file.push(v);
        }
      }
      numero += 1;
    }
  }
  return etiquettes;
}

function proprietaire(carte: MapDef, c: Case): number | undefined {
  return carte.proprietaires[`${c.x},${c.y}`];
}

/** Ce que doit vérifier toute carte à ports : compte, côte, symétrie, mer commune. */
function verifierPorts(carte: MapDef, parametres: ParametresCarte, contexte: string): void {
  assert.ok(validerMapDef(carte).ok, `${contexte} : validerMapDef`);
  const rapport = verifierCarte(carte);
  assert.deepEqual(rapport.motifs.map((m) => m.code), [], `${contexte} : ${rapport.motifs.map((m) => m.detail).join(' ; ')}`);

  const ports = cases(carte, CARACTERE_PAR_TERRAIN.port);
  const possedes = ports.filter((c) => proprietaire(carte, c) !== undefined);
  assert.equal(possedes.length, (parametres.portsParCamp ?? 0) * carte.camps, `${contexte} : ports possédés`);
  for (let camp = 0; camp < carte.camps; camp += 1) {
    const miens = possedes.filter((c) => proprietaire(carte, c) === camp).length;
    assert.equal(miens, parametres.portsParCamp ?? 0, `${contexte} : ports du camp ${camp}`);
  }

  for (const port of ports) {
    assert.ok(voisins4(carte, port).some((v) => caractere(carte, v.x, v.y) === CARACTERE_PAR_TERRAIN.mer),
      `${contexte} : port (${port.x},${port.y}) sans mer voisine`);
  }

  // L'image d'un port est un port : l'orbite entière porte le même caractère.
  const cadre = creerCadre(parametres.symetrie, carte.camps, carte.largeur, carte.hauteur);
  for (const port of ports) {
    for (const image of cadre.orbite(port.y * carte.largeur + port.x)) {
      const x = image % carte.largeur;
      const y = Math.floor(image / carte.largeur);
      assert.equal(caractere(carte, x, y), CARACTERE_PAR_TERRAIN.port, `${contexte} : l'image (${x},${y}) du port (${port.x},${port.y}) n'est pas un port`);
    }
  }

  // Une seule mer pour tous les ports possédés.
  const etiquettes = composantesNavigables(carte);
  const mers = new Set(possedes.map((c) => etiquettes[c.y * carte.largeur + c.x]));
  assert.equal(mers.size, 1, `${contexte} : ${mers.size} mers distinctes pour les ports`);
  assert.equal(rapport.mesures['ports_relies'], 1, `${contexte} : ports_relies`);
  assert.equal(rapport.mesures['ports_sans_mer'], 0, `${contexte} : ports_sans_mer`);
}

/** Ce que doit vérifier toute carte à stations radar : compte, jamais collée à un QG. */
function verifierRadars(carte: MapDef, parametres: ParametresCarte, contexte: string): void {
  const radars = cases(carte, CARACTERE_PAR_TERRAIN.radar);
  const possedes = radars.filter((c) => proprietaire(carte, c) !== undefined);
  assert.equal(possedes.length, (parametres.radarsParCamp ?? 0) * carte.camps, `${contexte} : radars possédés`);
  const qg = cases(carte, CARACTERE_PAR_TERRAIN.qg);
  for (const radar of radars) {
    for (const q of qg) {
      const ecart = Math.max(Math.abs(radar.x - q.x), Math.abs(radar.y - q.y));
      assert.ok(ecart >= 2, `${contexte} : radar (${radar.x},${radar.y}) collé au QG (${q.x},${q.y})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Jeux de paramètres
// ---------------------------------------------------------------------------

const cotier: ParametresCarte = {
  largeur: 20, hauteur: 14, camps: 2, biome: 'cotier', ratioMer: 0.35, ratioRelief: 0.15,
  villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 1,
  portsParCamp: 1, radarsParCamp: 1, symetrie: 'axe_vertical', densiteRoutes: 0.5,
  mecanique: 'meca_marees',
};

const archipel: ParametresCarte = {
  largeur: 24, hauteur: 18, camps: 2, biome: 'archipel', ratioMer: 0.55, ratioRelief: 0.1,
  villesParCamp: 2, villesNeutres: 3, usinesParCamp: 1, aeroportsParCamp: 0,
  portsParCamp: 1, radarsParCamp: 1, symetrie: 'aucune', densiteRoutes: 0.15,
};

const GRAINES = [1, 2, 3, 4, 5, 6];

test('ports : chaque symétrie à deux camps pose un port par camp, côtier, symétrique, sur une mer commune', () => {
  for (const symetrie of SYMETRIES) {
    for (const graine of GRAINES) {
      const p = { ...cotier, symetrie };
      verifierPorts(genererCarte(p, graine), p, `cotier/${symetrie}/${graine}`);
      verifierRadars(genererCarte(p, graine), p, `cotier/${symetrie}/${graine}`);
    }
  }
  for (const graine of GRAINES) {
    verifierPorts(genererCarte(archipel, graine), archipel, `archipel/${graine}`);
    verifierRadars(genererCarte(archipel, graine), archipel, `archipel/${graine}`);
  }
});

test('ports : à trois et quatre camps, un port par camp plus un neutre sur le quadrant vide', () => {
  const trois: ParametresCarte = { ...archipel, camps: 3, symetrie: 'point', ratioMer: 0.5 };
  for (const graine of GRAINES) {
    const carte = genererCarte(trois, graine);
    verifierPorts(carte, trois, `archipel 3 camps/${graine}`);
    verifierRadars(carte, trois, `archipel 3 camps/${graine}`);
    // Le groupe de Klein a quatre quadrants : le quatrième porte un port neutre.
    const ports = cases(carte, CARACTERE_PAR_TERRAIN.port);
    assert.equal(ports.length, 4, `graine ${graine} : quatre ports en tout`);
    assert.equal(ports.filter((c) => proprietaire(carte, c) === undefined).length, 1, `graine ${graine} : un port neutre`);
  }
  const quatre: ParametresCarte = { ...archipel, largeur: 24, hauteur: 24, camps: 4, symetrie: 'rotation_90', ratioMer: 0.5, radarsParCamp: 0 };
  for (const graine of GRAINES) {
    verifierPorts(genererCarte(quatre, graine), quatre, `archipel 4 camps/${graine}`);
  }
});

test('ports : deux ports par camp, tous sur la même mer', () => {
  const deux: ParametresCarte = { ...cotier, portsParCamp: 2, radarsParCamp: 0, symetrie: 'point' };
  for (const graine of GRAINES) verifierPorts(genererCarte(deux, graine), deux, `deux ports/${graine}`);
});

test('ports : un biome presque sans mer reçoit quand même sa ceinture, et ses ports', () => {
  // Cinq pour cent de mer ne font pas une côte commune : la ceinture s'impose
  // (voir `relief.ts`), et c'est le prix d'un port demandé sur une forêt.
  const foret: ParametresCarte = { ...cotier, biome: 'foret', ratioMer: 0.05, ratioRelief: 0.3, symetrie: 'axe_horizontal', radarsParCamp: 0, mecanique: undefined };
  for (const graine of [1, 2, 3]) {
    const carte = genererCarte(foret, graine);
    verifierPorts(carte, foret, `foret/${graine}`);
    const bord = [...(carte.grille[0] ?? ''), ...(carte.grille[carte.hauteur - 1] ?? '')];
    assert.ok(bord.every((car) => car === CARACTERE_PAR_TERRAIN.mer), `foret/${graine} : la ceinture n'est pas de la mer`);
  }
});

test('ports : le déterminisme tient, et la carte enregistrée rejoue la même grille', () => {
  const a = genererCarte(cotier, 11);
  const b = genererCarte(cotier, 11);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const generation = a.generation;
  assert.ok(generation);
  assert.equal(generation.parametres.portsParCamp, 1);
  assert.equal(generation.parametres.radarsParCamp, 1);
  const rejouee = genererCarte(generation.parametres, Number(generation.graine));
  assert.deepEqual(rejouee.grille, a.grille);
  assert.deepEqual(rejouee.proprietaires, a.proprietaires);
});

test('ports : sans mer, les ports tombent à zéro ; hors bornes, ils sont ramenés dans les bornes', () => {
  const sansMer = genererCarte({ ...cotier, biome: 'plaine', ratioMer: 0, portsParCamp: 2, mecanique: undefined }, 5);
  assert.equal(sansMer.generation?.parametres.portsParCamp, 0, 'la correction est visible dans les paramètres recopiés');
  assert.equal(cases(sansMer, CARACTERE_PAR_TERRAIN.port).length, 0);
  assert.equal(mesurer(sansMer)['ports_par_camp'], 0);

  const trop = genererCarte({ ...cotier, portsParCamp: 7, radarsParCamp: -3 } as ParametresCarte, 5);
  assert.equal(trop.generation?.parametres.portsParCamp, 2);
  assert.equal(trop.generation?.parametres.radarsParCamp, 0);
  assert.ok(validerMapDef(trop).ok);
});

test('ports : le profil d\'un biome recommande un port sur les côtes, et ne l\'impose pas à un champ absent', () => {
  for (const biome of BIOMES) {
    assert.equal(PROFILS_BIOME[biome].portsParCamp, biome === 'cotier' || biome === 'archipel' ? 1 : 0, biome);
    assert.equal(PROFILS_BIOME[biome].radarsParCamp, 0, biome);
  }
  // Absent = 0, c'est le contrat du schéma : une côte sans le champ reste sans port.
  const sans = genererCarte({ largeur: 24, hauteur: 18, camps: 2, biome: 'cotier', symetrie: 'axe_vertical' } as ParametresCarte, 72);
  assert.equal(cases(sans, CARACTERE_PAR_TERRAIN.port).length, 0);
  assert.equal(sans.generation?.parametres.portsParCamp, 0);
});

test('ports : l\'aperçu nomme le port et la station radar, légende et propriétaires compris', () => {
  const carte = genererCarte(cotier, 3);
  const texte = apercuTexte(carte);
  const legende = texte.split('\n').find((l) => l.startsWith('Légende :')) ?? '';
  assert.ok(legende.includes('O port'), legende);
  assert.ok(legende.includes('T station radar'), legende);
  for (const port of cases(carte, CARACTERE_PAR_TERRAIN.port)) {
    assert.ok(texte.includes(`port (${port.x},${port.y})`), `port (${port.x},${port.y}) absent des propriétaires`);
  }
  for (const radar of cases(carte, CARACTERE_PAR_TERRAIN.radar)) {
    assert.ok(texte.includes(`station radar (${radar.x},${radar.y})`), `radar (${radar.x},${radar.y}) absent des propriétaires`);
  }
  assert.ok(texte.includes('ports_par_camp=1'));
  assert.ok(texte.includes('ports_relies=1'));
});

// ---------------------------------------------------------------------------
// Les vérifications navales, sur une carte écrite à la main
// ---------------------------------------------------------------------------

/** Une île rectangulaire cernée de mer, un port par camp sur la côte nord. */
function ile(grille: string[]): MapDef {
  return {
    cle: 'carte_test_ports', version: 1, statut: 'brouillon', source: 'humain',
    creeLe: '2026-09-07', majLe: '2026-09-07', code: 'carte_test_ports', nom: 'Île de test',
    largeur: 12, hauteur: 10, camps: 2, biome: 'cotier', grille,
    proprietaires: { '2,2': 0, '9,2': 1, '2,3': 0, '9,3': 1 },
    unitesDepart: [
      { camp: 0, type: 'infanterie', x: 1, y: 2 },
      { camp: 1, type: 'infanterie', x: 10, y: 2 },
    ],
  };
}

const SAINE = [
  'WWWWWWWWWWWW',
  'WPPOPPPPOPPW',
  'WPHPPPPPPHPW',
  'WPUPPPPPPUPW',
  'WPPPPPPPPPPW',
  'WPPPPPPPPPPW',
  'WPPPPPPPPPPW',
  'WPPPPPPPPPPW',
  'WPPPPPPPPPPW',
  'WWWWWWWWWWWW',
];

test('vérification : une île à deux ports côtiers reliés ne porte aucun motif', () => {
  const carte = ile(SAINE);
  carte.proprietaires['3,1'] = 0;
  carte.proprietaires['8,1'] = 1;
  const rapport = verifierCarte(carte);
  assert.deepEqual(rapport.motifs, []);
  assert.equal(rapport.mesures['ports_par_camp'], 1);
  assert.equal(rapport.mesures['ports_relies'], 1);
  assert.equal(rapport.mesures['ports_sans_mer'], 0);
});

test('vérification : un port sans case de mer voisine est une zone morte navale', () => {
  const grille = SAINE.slice();
  grille[1] = 'WPPPPPPPPPPW';
  grille[3] = 'WPUOPPPPOUPW';
  const carte = ile(grille);
  carte.proprietaires['3,3'] = 0;
  carte.proprietaires['8,3'] = 1;
  const rapport = verifierCarte(carte);
  const motif = rapport.motifs.find((m) => m.mesure['ports_sans_mer'] !== undefined);
  assert.ok(motif, rapport.motifs.map((m) => m.code).join(','));
  assert.equal(motif.code, 'port_sans_mer');
  assert.equal(motif.mesure['ports_sans_mer'], 2);
  assert.equal(rapport.ok, false);
});

test('vérification : deux ports côtiers sur deux mers séparées sont relevés comme isolés', () => {
  const grille = SAINE.slice();
  // La ceinture est coupée au nord et au sud : mer de l'ouest, mer de l'est.
  grille[0] = 'WWWWWPPWWWWW';
  grille[9] = 'WWWWWPPWWWWW';
  const carte = ile(grille);
  carte.proprietaires['3,1'] = 0;
  carte.proprietaires['8,1'] = 1;
  const rapport = verifierCarte(carte);
  const motif = rapport.motifs.find((m) => m.mesure['ports_isoles'] !== undefined);
  assert.ok(motif, rapport.motifs.map((m) => m.code).join(','));
  assert.equal(motif.code, 'ports_isoles');
  assert.equal(motif.mesure['ports_isoles'], 1);
  assert.equal(rapport.mesures['ports_sans_mer'], 0, 'chaque port touche bien sa mer');
  assert.equal(rapport.mesures['ports_relies'], 0);
});

// ---------------------------------------------------------------------------
// Non-régression : sans les paramètres, les cartes d'avant, au bit près
// ---------------------------------------------------------------------------

/** Empreinte de ce qui doit rester identique : grille, propriétaires, unités. */
function empreinte(carte: MapDef): string {
  return createHash('sha256')
    .update(JSON.stringify([carte.grille, carte.proprietaires, carte.unitesDepart]))
    .digest('hex')
    .slice(0, 16);
}

const bretagne: ParametresCarte = {
  largeur: 16, hauteur: 12, camps: 2, biome: 'cotier', ratioMer: 0.22, ratioRelief: 0.14,
  villesParCamp: 3, villesNeutres: 2, usinesParCamp: 1, aeroportsParCamp: 0,
  symetrie: 'axe_vertical', densiteRoutes: 0.6, mecanique: 'meca_marees',
};
const plaine: ParametresCarte = {
  largeur: 20, hauteur: 14, camps: 2, biome: 'plaine', ratioMer: 0.2, ratioRelief: 0.18,
  villesParCamp: 4, villesNeutres: 3, usinesParCamp: 1, aeroportsParCamp: 1,
  symetrie: 'axe_vertical', densiteRoutes: 0.6,
};
const archipelQuatre: ParametresCarte = {
  largeur: 24, hauteur: 18, camps: 4, biome: 'archipel', ratioMer: 0.5, ratioRelief: 0.1,
  villesParCamp: 2, villesNeutres: 4, usinesParCamp: 2, aeroportsParCamp: 1,
  symetrie: 'klein' as Symetrie, densiteRoutes: 0.2,
};

/** Prises le 7 septembre 2026 sur le générateur d'avant les ports (`MAPGEN_VERSION` 2). */
const EMPREINTES: Record<string, string> = {
  'bretagne/1': '1f062425e4ac6cfe',
  'bretagne/7': '4eb1cf3c42f02022',
  'bretagne/2026': 'e36324a41da5dae6',
  'plaine/1': '58be5ddea0365759',
  'plaine/7': '37a169df55f34874',
  'plaine/2026': '07452e8a9652a2a0',
  'archipel4/1': '84cac3cf4fb29dec',
  'archipel4/7': '6bf90a23615c27dc',
  'archipel4/2026': '740570580f92f99a',
  'preset_plaine/72': 'cb93d893b2b71077',
  'preset_foret/72': 'cd8e05169471d9b4',
  'preset_montagne/72': 'a62cde7f0018c902',
  'preset_desert/72': '59079b412b8a358e',
  'preset_jungle/72': '9752a20134e0cec0',
  'preset_neige/72': 'f83a190ff9b243dc',
  'preset_volcanique/72': '829658cf3b1a6c7c',
  'preset_cotier/72': '8ffb8e8c80114d78',
  'preset_archipel/72': 'ec6961904cde2dd8',
  'preset_marais/72': 'e143128d1af29d6c',
  'hasard4242/0/1304827818': '0189f3080511e5e6',
  'hasard4242/1/423026510': 'fc5d29842797cfee',
  'hasard4242/2/1824062806': '35cd288dd66d6982',
  'hasard4242/3/2132913528': '64e7679160329557',
  'hasard4242/4/235990312': 'ed80350a6c994b8e',
};

test('non-régression : sans ports ni radars, les cartes sont celles d\'avant, au bit près', () => {
  const relevees: Record<string, string> = {};
  for (const [nom, p] of [['bretagne', bretagne], ['plaine', plaine], ['archipel4', archipelQuatre]] as const) {
    for (const graine of [1, 7, 2026]) relevees[`${nom}/${graine}`] = empreinte(genererCarte(p, graine));
  }
  for (const biome of BIOMES as readonly Biome[]) {
    const p = { largeur: 24, hauteur: 18, camps: 2, biome, symetrie: 'axe_vertical' } as ParametresCarte;
    relevees[`preset_${biome}/72`] = empreinte(genererCarte(p, 72));
  }
  // Le même tirage que celui de la prise d'empreinte : les champs neufs n'y sont pas.
  const rng = creerRng(4242);
  for (let i = 0; i < 5; i += 1) {
    const p: ParametresCarte = {
      largeur: rng.entre(10, 40), hauteur: rng.entre(10, 30), camps: rng.entre(2, 4) as 2 | 3 | 4,
      biome: rng.choisir(BIOMES), ratioMer: rng.suivant() * 0.6, ratioRelief: rng.suivant() * 0.4,
      villesParCamp: rng.entre(2, 10), villesNeutres: rng.entre(0, 12), usinesParCamp: rng.entre(1, 3),
      aeroportsParCamp: rng.entre(0, 2), symetrie: rng.choisir(SYMETRIES), densiteRoutes: rng.suivant(),
    };
    const graine = rng.entier(2 ** 31);
    relevees[`hasard4242/${i}/${graine}`] = empreinte(genererCarte(p, graine));
  }
  assert.deepEqual(relevees, EMPREINTES);
});
