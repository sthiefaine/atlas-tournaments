// La couche du sol montée sur un contexte de papier : `maj` ne touche jamais au
// contexte, `dessiner` n'envoie que ce qui a changé, les transitions se jouent
// sur l'horloge de rendu et s'arrêtent, et tout se libère.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { copierEtat, type EtatPartie } from '../../../src/engine/index';
import { ambiance } from '../../../src/render/ambiance';
import type { VueInteraction } from '../../../src/render/rendu';
import {
  idDecor, niveauxBrouillard, VERSION_SPRITES, type ContexteImage, type ManifesteSprites, type OptionsSol,
} from '../../../src/render2d/contrat';
import { REPLI } from '../../../src/render2d/sol/decor';
import { creerSol, creerSolTerrain, DUREE_TRANSITION } from '../../../src/render2d/sol/index';
import type { Meteo, Saison } from '../../../src/schemas/types';
import { cat, partie, toutVu } from './aides';
import { creerGlFactice } from './gl-factice';

const GRILLE = ['PFFMP', 'PRRRC', 'WWSVP', 'WWSNP'];

function vueDe(e: EtatPartie, saison?: Saison, meteo?: Meteo): VueInteraction {
  return {
    catalogue: cat(),
    ambiance: ambiance(saison ?? e.climat.saison, e.climat.phase, meteo ?? e.climat.meteo),
  } as unknown as VueInteraction;
}

function contexte(gl: WebGL2RenderingContext, tempsMs: number, reduit = false): ContexteImage {
  return {
    gl, planVersDecoupe: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), echelle: 1,
    largeur: 640, hauteur: 480, tempsMs, reduit,
  };
}

function monter(options: Partial<OptionsSol> = {}, grille = GRILLE) {
  const f = creerGlFactice();
  const etat = partie(grille);
  const sol = creerSol(f.gl, etat, { biome: 'plaine', reduit: false, manifeste: null, ...options });
  return { f, etat, sol };
}

test('à la naissance : un programme, trois textures, les couches de détail envoyées une fois', () => {
  const { f } = monter();
  assert.equal(f.compter('linkProgram'), 1);
  assert.equal(f.compter('texImage2D'), 2, 'la grille et son double d’avant');
  assert.equal(f.compter('texImage3D'), 1, 'les onze couches de détail');
  assert.equal(f.compter('generateMipmap'), 1);
  assert.equal(f.vivants().texture, 3);
});

test('maj ne touche jamais au contexte ; une vue identique ne demande rien', () => {
  const { f, etat, sol } = monter();
  const vue = vueDe(etat);
  const avant = f.appels.length;
  assert.equal(sol.maj(etat, vue, toutVu(etat)), true, 'la première lecture demande une image');
  assert.equal(sol.maj(etat, vue, toutVu(etat)), false);
  const brouillard = niveauxBrouillard(etat.largeur, etat.hauteur, new Set(['0,0', '1,0']));
  assert.equal(sol.maj(etat, vue, brouillard), true, 'le brouillard tombe');
  assert.equal(sol.maj(etat, vue, new Uint8Array(brouillard)), false, 'un brouillard égal ne change rien');
  assert.equal(f.appels.length, avant, 'maj a parlé au contexte');
});

test('dessiner n’envoie que ce qui a changé, et une image au repos ne coûte que ses uniformes', () => {
  const { f, etat, sol } = monter();
  const vue = vueDe(etat);
  sol.maj(etat, vue, toutVu(etat));
  sol.dessiner(contexte(f.gl, 0));
  const i1 = f.appels.length;
  sol.dessiner(contexte(f.gl, 16));
  const parImage = f.appels.length - i1;
  assert.equal(f.compter('texSubImage2D', i1), 0);
  assert.equal(f.compter('texImage3D', i1), 0);
  assert.equal(f.compter('drawArrays', i1), 1, 'une seule passe');
  const i2 = f.appels.length;
  sol.dessiner(contexte(f.gl, 32));
  assert.equal(f.appels.length - i2, parImage, 'deux images au repos coûtent pareil');
  // Le brouillard change : un seul envoi, à l'image suivante.
  sol.maj(etat, vue, niveauxBrouillard(etat.largeur, etat.hauteur, new Set(['2,2'])));
  const i3 = f.appels.length;
  sol.dessiner(contexte(f.gl, 48));
  assert.equal(f.compter('texSubImage2D', i3), 1);
  assert.equal(f.compter('texImage2D', i3), 0, 'même taille : on réécrit, on ne réalloue pas');
});

test('les réglages de dépaquetage sont rendus tels qu’on les a trouvés', () => {
  const { f, etat, sol } = monter();
  f.gl.pixelStorei(f.gl.UNPACK_FLIP_Y_WEBGL, true);
  f.gl.pixelStorei(f.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  sol.maj(etat, vueDe(etat), niveauxBrouillard(etat.largeur, etat.hauteur, new Set()));
  const i = f.appels.length;
  sol.dessiner(contexte(f.gl, 0));
  const poses = f.appels.slice(i).filter((a) => a.nom === 'pixelStorei');
  const envoi = f.appels.slice(i).findIndex((a) => a.nom === 'texSubImage2D');
  assert.ok(envoi > 0);
  // Pendant l'envoi : ni retournement ni prémultiplication — le brouillard est dans l'alpha.
  assert.deepEqual(poses.slice(0, 2).map((a) => a.args[1]), [false, false]);
  assert.equal(f.gl.getParameter(f.gl.UNPACK_FLIP_Y_WEBGL), true);
  assert.equal(f.gl.getParameter(f.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), true);
});

test('une marée se joue en 1,4 s sur l’horloge de rendu, puis s’arrête', () => {
  const { f, etat, sol } = monter({}, ['PVP', 'PVP', 'PPP']);
  const vue = vueDe(etat);
  sol.maj(etat, vue, toutVu(etat));
  sol.dessiner(contexte(f.gl, 1000));
  assert.equal(sol.enMouvement(), false);
  const suivant = copierEtat(etat);
  suivant.terrainsPoses = [{ case: '1,1', terrain: 'pont', jusqu: null }];
  assert.equal(sol.maj(suivant, vue, toutVu(suivant)), true);
  assert.equal(sol.enMouvement(), true);
  sol.dessiner(contexte(f.gl, 5000));
  sol.dessiner(contexte(f.gl, 5000 + DUREE_TRANSITION / 2));
  assert.equal(sol.enMouvement(), true, 'à mi-course');
  sol.dessiner(contexte(f.gl, 5000 + DUREE_TRANSITION + 1));
  assert.equal(sol.enMouvement(), false);
  // Un jour qui passe sans rien changer à la grille ne rejoue rien.
  const lendemain = copierEtat(suivant);
  lendemain.journee += 1;
  assert.equal(sol.maj(lendemain, vue, toutVu(lendemain)), false);
  assert.equal(sol.enMouvement(), false);
});

test('sous animations réduites, la marée se pose d’un coup', () => {
  const { etat, sol } = monter({ reduit: true }, ['PVP', 'PVP', 'PPP']);
  const vue = vueDe(etat);
  sol.maj(etat, vue, toutVu(etat));
  const suivant = copierEtat(etat);
  suivant.terrainsPoses = [{ case: '1,1', terrain: 'pont', jusqu: null }];
  sol.maj(suivant, vue, toutVu(suivant));
  assert.equal(sol.enMouvement(), false);
});

test('une averse fait glisser les couleurs ; animations réduites, elle les pose', () => {
  const { f, etat, sol } = monter();
  sol.maj(etat, vueDe(etat, 'ete', 'clair'), toutVu(etat));
  sol.dessiner(contexte(f.gl, 0));
  assert.equal(sol.maj(etat, vueDe(etat, 'ete', 'pluie'), toutVu(etat)), true);
  assert.equal(sol.enMouvement(), true);
  sol.dessiner(contexte(f.gl, 100));
  sol.dessiner(contexte(f.gl, 100 + DUREE_TRANSITION + 1));
  assert.equal(sol.enMouvement(), false);
  sol.maj(etat, vueDe(etat, 'ete', 'tempete'), toutVu(etat));
  sol.dessiner(contexte(f.gl, 3000, true));
  assert.equal(sol.enMouvement(), false, 'l’horloge réduite pose la fin tout de suite');
});

test('une autre saison refait les couches de détail, à l’image suivante', () => {
  const { f, etat, sol } = monter();
  sol.maj(etat, vueDe(etat, 'ete', 'clair'), toutVu(etat));
  sol.dessiner(contexte(f.gl, 0));
  sol.maj(etat, vueDe(etat, 'hiver', 'clair'), toutVu(etat));
  const i = f.appels.length;
  sol.dessiner(contexte(f.gl, 10));
  assert.equal(f.compter('texImage3D', i), 1);
});

test('une autre carte réalloue la grille sans transition', () => {
  const { f, etat, sol } = monter();
  sol.maj(etat, vueDe(etat), toutVu(etat));
  sol.dessiner(contexte(f.gl, 0));
  const autre = partie(['PPPPPPP', 'PPPPPPP']);
  assert.equal(sol.maj(autre, vueDe(autre), toutVu(autre)), true);
  assert.equal(sol.enMouvement(), false);
  const i = f.appels.length;
  sol.dessiner(contexte(f.gl, 16));
  assert.equal(f.compter('texImage2D', i), 2);
  const taille = f.appels.slice(i).find((a) => a.nom === 'uniform2i');
  assert.deepEqual(taille?.args.slice(1), [7, 2]);
});

test('les volumes : le même tableau tant que rien ne bouge, rien sous le noir', () => {
  const entrees: ManifesteSprites['entrees'] = {};
  for (const n of [1, 2]) {
    const id = idDecor('feuillu', 'toutes', n);
    entrees[id] = {
      id, famille: 'decor', cle: 'feuillu', source: { fichier: 'x.glb', sha256: '0' },
      pages: [{ couleur: 'x.webp', largeur: 1, hauteur: 1 }],
      animations: [{ vue: 'fixe', clip: 'repos', boucle: true, ips: 12, cadres: [{ page: 0, x: 0, y: 0, l: 1, h: 1, px: 0, py: 0 }] }],
    };
  }
  const manifeste: ManifesteSprites = { version: VERSION_SPRITES, pixelsParCase: 128, tangage: 50, tangageProfil: 12, entrees };
  const { etat, sol } = monter({ manifeste }, ['FFF', 'FFF']);
  const vue = vueDe(etat, 'ete', 'clair');
  sol.maj(etat, vue, toutVu(etat));
  const tous = sol.volumes();
  assert.ok(tous.length >= 18, `${tous.length} arbres pour six cases de forêt`);
  sol.maj(etat, vue, toutVu(etat));
  assert.equal(sol.volumes(), tous, 'le même tableau : rien n’est réalloué');
  sol.maj(etat, vue, niveauxBrouillard(3, 2, new Set(['0,0', '1,0', '2,0'])));
  const vus = sol.volumes();
  assert.ok(vus.length > 0 && vus.length < tous.length);
  assert.ok(vus.every((i) => i.y < 1), 'aucun arbre de la rangée cachée');
});

test('tout se libère, et une couche libérée ne dessine plus', () => {
  const { f, etat, sol } = monter();
  sol.maj(etat, vueDe(etat), toutVu(etat));
  sol.dispose();
  const v = f.vivants();
  assert.equal(v.texture, 0);
  assert.equal(v.tampon, 0);
  assert.equal(v.tableau, 0);
  assert.equal(v.programme, 0);
  const i = f.appels.length;
  sol.dessiner(contexte(f.gl, 0));
  assert.equal(sol.maj(etat, vueDe(etat), toutVu(etat)), false);
  assert.equal(f.appels.length, i);
  assert.deepEqual(sol.volumes(), []);
});

test('ambiant : vrai tant qu’une eau vue ondule, faux au sec, sous le noir ou au calme', () => {
  const { f, etat, sol } = monter({}, ['PWW', 'PVP', 'PPP']);
  const vue = vueDe(etat);
  sol.maj(etat, vue, toutVu(etat));
  assert.equal(sol.ambiant?.(), true, 'la mer et la rivière se voient');
  // Tout ce qui est eau passe sous le noir : plus rien n'ondule à l'écran.
  const sec = niveauxBrouillard(3, 3, new Set(['0,0', '0,1', '0,2', '1,2', '2,2']));
  assert.equal(sol.maj(etat, vue, sec), true);
  assert.equal(sol.ambiant?.(), false);
  sol.maj(etat, vue, toutVu(etat));
  assert.equal(sol.ambiant?.(), true);
  // L'horloge du moteur passe au calme : l'eau s'immobilise et ne réclame rien.
  sol.dessiner(contexte(f.gl, 0, true));
  assert.equal(sol.ambiant?.(), false);
  sol.dessiner(contexte(f.gl, 16, false));
  assert.equal(sol.ambiant?.(), true);
  sol.dispose();
  assert.equal(sol.ambiant?.(), false);

  const terre = monter({}, ['PPP', 'PFP']);
  terre.sol.maj(terre.etat, vueDe(terre.etat), toutVu(terre.etat));
  assert.equal(terre.sol.ambiant?.(), false, 'pas d’eau, rien à faire vivre');
  const calme = monter({ reduit: true }, ['PWW', 'PVP', 'PPP']);
  calme.sol.maj(calme.etat, vueDe(calme.etat), toutVu(calme.etat));
  assert.equal(calme.sol.ambiant?.(), false, 'animations réduites');
});

test('le mode tactique retire la végétation du repli, jamais la montagne', () => {
  const f = creerGlFactice();
  const etat = partie(['PFM', 'GPP']);
  const sol = creerSolTerrain(f.gl, etat, { biome: 'plaine', reduit: false, manifeste: null });
  sol.maj(etat, vueDe(etat), toutVu(etat));
  const repliPose = (depuis: number): number | undefined => {
    const appel = f.appels.slice(depuis).find((a) =>
      a.nom === 'uniform1i' && (a.args[0] as { uniforme?: string } | null)?.uniforme === 'uRepli');
    return appel?.args[1] as number | undefined;
  };
  let i = f.appels.length;
  sol.dessiner(contexte(f.gl, 0));
  assert.equal(repliPose(i), REPLI.FORET | REPLI.MONTAGNE | REPLI.HERBE_HAUTE);
  sol.tactique(true);
  i = f.appels.length;
  sol.dessiner(contexte(f.gl, 16));
  assert.equal(repliPose(i), REPLI.MONTAGNE, 'le relief reste, la végétation part');
  i = f.appels.length;
  sol.dessiner(contexte(f.gl, 32));
  assert.equal(repliPose(i), undefined, 'rien à renvoyer tant que rien ne change');
  sol.tactique(false);
  i = f.appels.length;
  sol.dessiner(contexte(f.gl, 48));
  assert.equal(repliPose(i), REPLI.FORET | REPLI.MONTAGNE | REPLI.HERBE_HAUTE);
  assert.equal(creerSol, creerSolTerrain as unknown, 'le nom du contrat est le même sol');
});
