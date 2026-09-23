// L'atlas sans navigateur : la lecture du manifeste (et son refus net), le
// choix d'une animation, le rangement des replis, et la règle qui tient tout —
// une page qui n'est pas encore là laisse la place à son repli, sans retenir
// l'image, et n'est demandée qu'une fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Atlas, cadreAuTemps, choisirAnimation, Etageres, hexEquipe, lireManifeste,
  type ChargeurImage, type PeintreRepli, type SourceImage, type Televerseur,
} from '../../src/render2d/atlas';
import {
  PIXELS_PAR_CASE, TANGAGE_CARTE, VERSION_SPRITES, type EntreeSprite, type InstanceSprite,
} from '../../src/render2d/contrat';

/** Une entrée d'unité : trois vues au repos, une marche à droite. */
function entreeUnite(id = 'unite_char_leger_base'): EntreeSprite {
  const cadre = (x: number) => ({ page: 0, x, y: 0, l: 64, h: 64, px: 32, py: 56 });
  return {
    id, famille: 'unite', cle: 'char_leger',
    source: { fichier: 'public/assets/modeles/unite_char_leger_base_lod0.glb', sha256: 'abc' },
    pages: [{ couleur: 'assets/sprites/unites/char_leger.webp', masque: 'assets/sprites/unites/char_leger_masque.webp', largeur: 512, hauteur: 256 }],
    animations: [
      { vue: 'droite', clip: 'repos', boucle: true, ips: 12, cadres: [cadre(0), cadre(64), cadre(128)] },
      { vue: 'bas', clip: 'repos', boucle: true, ips: 12, cadres: [cadre(192)] },
      { vue: 'droite', clip: 'deplacement', boucle: true, ips: 12, cadres: [cadre(256), cadre(320)] },
    ],
  };
}

function manifesteBrut(entrees: Record<string, unknown> = { unite_char_leger_base: entreeUnite() }): Record<string, unknown> {
  return { version: VERSION_SPRITES, pixelsParCase: PIXELS_PAR_CASE, tangage: TANGAGE_CARTE, tangageProfil: 12, entrees };
}

test('un manifeste d’une autre version, ou d’une autre projection, est refusé net', () => {
  assert.equal(lireManifeste(null).ok, false);
  assert.equal(lireManifeste({ ...manifesteBrut(), version: VERSION_SPRITES + 1 }).ok, false);
  const tangage = lireManifeste({ ...manifesteBrut(), tangage: 45 });
  assert.equal(tangage.ok, false);
  if (!tangage.ok) assert.match(tangage.motif, /tangage/);
  assert.equal(lireManifeste({ ...manifesteBrut(), pixelsParCase: 0 }).ok, false);
});

test('une entrée mal formée est écartée seule, et nommée', () => {
  const mauvaise = { ...entreeUnite('unite_mauvaise_base'), pages: [{ couleur: '/abs.webp', largeur: 10, hauteur: 10 }] };
  const hors = entreeUnite('unite_hors_base');
  hors.animations[0]!.cadres[0] = { page: 0, x: 500, y: 0, l: 64, h: 64, px: 0, py: 0 };
  const cle = { ...entreeUnite('unite_x_base'), id: 'autre_id' };
  const lu = lireManifeste(manifesteBrut({
    unite_char_leger_base: entreeUnite(), unite_mauvaise_base: mauvaise, unite_hors_base: hors, unite_x_base: cle,
  }));
  assert.equal(lu.ok, true);
  if (!lu.ok) return;
  assert.deepEqual(Object.keys(lu.manifeste.entrees), ['unite_char_leger_base']);
  assert.deepEqual([...lu.ecartees].sort(), ['unite_hors_base', 'unite_mauvaise_base', 'unite_x_base']);
});

test('une animation absente retombe sur le repos de la vue, puis sur la droite', () => {
  const e = entreeUnite();
  assert.equal(choisirAnimation(e, 'droite', 'deplacement'), 2);
  assert.equal(choisirAnimation(e, 'bas', 'repos'), 1);
  assert.equal(choisirAnimation(e, 'bas', 'tir'), 1, 'pas de tir de face : le repos de face');
  assert.equal(choisirAnimation(e, 'haut', 'deplacement'), 2, 'pas de vue de dos : la droite');
  assert.equal(choisirAnimation(e, 'haut', 'tir'), 0);
});

test('l’image du moment : une boucle tourne, un clip s’arrête sur sa dernière image', () => {
  assert.equal(cadreAuTemps(3, 12, true, 0), 0);
  assert.equal(cadreAuTemps(3, 12, true, 1000 / 12 + 1), 1);
  assert.equal(cadreAuTemps(3, 12, true, (1000 / 12) * 4 + 1), 1);
  assert.equal(cadreAuTemps(3, 12, false, 99999), 2);
  assert.equal(cadreAuTemps(1, 12, true, 5000), 0);
  assert.equal(cadreAuTemps(5, 12, true, Number.NaN), 0);
});

test('les étagères rangent de gauche à droite, puis dessous, avec une marge, et refusent le trop-grand', () => {
  const e = new Etageres(100, 100, 4);
  assert.deepEqual(e.placer(40, 30), { x: 0, y: 0 });
  assert.deepEqual(e.placer(40, 20), { x: 44, y: 0 });
  assert.deepEqual(e.placer(40, 10), { x: 0, y: 34 }, 'étagère neuve sous la plus haute');
  assert.equal(e.placer(120, 10), null);
  assert.deepEqual(e.placer(90, 46), { x: 0, y: 48 });
  assert.equal(e.placer(10, 10), null, 'page pleine');
});

test('la couleur d’équipe fait la clé d’un repli', () => {
  assert.equal(hexEquipe([1, 0, 0.5]), 'ff0080');
  assert.equal(hexEquipe(null), 'blanc');
});

/** Un atlas à doublures : on compte ce qu'il demande au réseau, à WebGL et au peintre. */
function atlasEssai(chargeur?: ChargeurImage) {
  const journal = { creees: 0, posees: 0, supprimees: 0, peints: [] as string[], charges: [] as string[], arrivees: 0 };
  let n = 0;
  const televerseur: Televerseur = {
    creer: () => { journal.creees += 1; n += 1; return { n } as unknown as WebGLTexture; },
    poser: () => { journal.posees += 1; },
    supprimer: () => { journal.supprimees += 1; },
  };
  const peintre: PeintreRepli = {
    peindre: (id) => {
      journal.peints.push(id);
      return id.startsWith('inconnu') ? null : { source: {} as SourceImage, l: 50, h: 40, px: 25, py: 35, echelle: 0.5 };
    },
  };
  const enAttente: (() => void)[] = [];
  const charger: ChargeurImage = chargeur ?? ((chemin) => {
    journal.charges.push(chemin);
    return new Promise<SourceImage>((ok) => { enAttente.push(() => ok({} as SourceImage)); });
  });
  const atlas = new Atlas({ televerseur, charger, peintre, surArrivee: () => { journal.arrivees += 1; }, coteRepli: 256 });
  return { atlas, journal, relacher: () => { for (const r of enAttente.splice(0)) r(); } };
}

const instance = (entree: string, extra: Partial<InstanceSprite> = {}): InstanceSprite => ({ entree, animation: 0, cadre: 1, x: 0.5, y: 0.5, ...extra });

test('sans manifeste, tout est repli — peint une fois par entrée et par couleur', () => {
  const { atlas, journal } = atlasEssai();
  const a = atlas.resoudre(instance('unite_char_leger_base', { animation: -1, equipe: [1, 0, 0] }));
  const b = atlas.resoudre(instance('unite_char_leger_base', { animation: -1, equipe: [1, 0, 0] }));
  const c = atlas.resoudre(instance('unite_char_leger_base', { animation: -1, equipe: [0, 0, 1] }));
  assert.ok(a && b && c);
  assert.equal(a, b, 'le même repli sert deux fois');
  assert.notEqual(a, c, 'une autre couleur, un autre repli');
  assert.equal(a!.repli, true);
  assert.equal(a!.masque, false, 'un repli est peint à sa couleur : jamais de masque');
  assert.equal(journal.peints.length, 2);
  assert.equal(atlas.resoudre(instance('inconnu_x')), null, 'rien à peindre, rien à poser');
});

test('une page qui n’est pas encore là cède la place à son repli, n’est demandée qu’une fois, puis remplace le repli', async () => {
  const { atlas, journal, relacher } = atlasEssai();
  const lu = lireManifeste(manifesteBrut());
  assert.ok(lu.ok);
  if (!lu.ok) return;
  atlas.poserManifeste(lu.manifeste);
  const avant = atlas.resoudre(instance('unite_char_leger_base', { equipe: [1, 0, 0] }));
  atlas.resoudre(instance('unite_char_leger_base'));
  assert.equal(avant?.repli, true);
  // La couleur et le masque ensemble : deux fichiers, une seule demande de page.
  assert.deepEqual(journal.charges, ['/assets/sprites/unites/char_leger.webp', '/assets/sprites/unites/char_leger_masque.webp']);
  assert.equal(atlas.chargements, 1);
  relacher();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(atlas.chargements, 0);
  assert.equal(journal.arrivees, 1, 'l’arrivée réveille l’image');
  const apres = atlas.resoudre(instance('unite_char_leger_base', { equipe: [1, 0, 0] }));
  assert.ok(apres);
  assert.equal(apres!.repli, false);
  assert.equal(apres!.masque, true);
  assert.equal(apres!.echelle, 1);
  assert.equal(apres!.u0, 64 / 512);
  assert.equal(apres!.px, 32);
});

test('une page introuvable reste en repli, sans être redemandée à chaque image', async () => {
  const charges: string[] = [];
  const { atlas } = atlasEssai((chemin) => { charges.push(chemin); return Promise.reject(new Error('404')); });
  const lu = lireManifeste(manifesteBrut());
  if (!lu.ok) throw new Error('manifeste');
  atlas.poserManifeste(lu.manifeste);
  atlas.resoudre(instance('unite_char_leger_base'));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 5; i++) assert.equal(atlas.resoudre(instance('unite_char_leger_base'))?.repli, true);
  assert.equal(charges.filter((c) => c.endsWith('char_leger.webp')).length, 1);
});

test('le kit national d’une variante l’emporte sur la base, qui l’emporte sur le nom attendu', () => {
  const { atlas } = atlasEssai();
  const kit = { ...entreeUnite('kit_fr_char_leger'), variante: 'fr' };
  const lu = lireManifeste(manifesteBrut({ unite_char_leger_base: entreeUnite(), kit_fr_char_leger: kit }));
  if (!lu.ok) throw new Error('manifeste');
  atlas.poserManifeste(lu.manifeste);
  assert.equal(atlas.idPour('unite', 'char_leger', 'fr', 'unite_char_leger_base'), 'kit_fr_char_leger');
  assert.equal(atlas.idPour('unite', 'char_leger', 'lu', 'unite_char_leger_base'), 'unite_char_leger_base');
  assert.equal(atlas.idPour('unite', 'recon', 'fr', 'unite_recon_base'), 'unite_recon_base');
});

test('perdre le contexte oublie pages et replis, qui se refont à la demande', () => {
  const { atlas, journal } = atlasEssai();
  atlas.resoudre(instance('unite_char_leger_base', { animation: -1 }));
  assert.equal(atlas.nombreReplis, 1);
  atlas.perdre();
  assert.equal(atlas.nombreReplis, 0);
  atlas.resoudre(instance('unite_char_leger_base', { animation: -1 }));
  assert.equal(journal.peints.length, 2);
});

test('les replis s’empilent sur une page neuve quand la première est pleine', () => {
  const { atlas, journal } = atlasEssai();
  // Des replis de 50 × 40 sur des pages de 256 : quatre par étagère, six étagères.
  for (let i = 0; i < 30; i++) atlas.resoudre(instance('unite_char_leger_base', { animation: -1, equipe: [i / 30, 0, 0] }));
  assert.equal(journal.creees, 2, 'une seconde page s’est ouverte');
  atlas.dispose();
  assert.equal(journal.supprimees, 2);
});
