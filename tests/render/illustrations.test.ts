// Les illustrations des dialogues (`render/illustrations.ts`) : chaque clé de la
// liste fermée rend un SVG, la syntaxe `[[img:cle]]` cohabite avec le gras, une
// marque douteuse se rend en texte, et la frappe lettre à lettre ne coupe rien.
//
// **On ne juge pas le dessin à l'œil** (consigne du dépôt) : on le tient par sa
// forme — bien formé, carré, sans NaN, avec de quoi être vu.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLES_ILLUSTRATION, type CleIllustration } from '../../src/schemas/types';
import {
  CLASSE_PICTOGRAMME, htmlRiche, illustrationSvg, MARQUE_IMAGE, pictogramme,
  segmenterRiche, texteNu, vignetteIllustration,
} from '../../src/render/illustrations';
import { htmlReplique } from '../../src/render/dialogue-html';
import { paletteDe } from '../../src/render/palettes';
import { dessinerUnite } from '../../src/render/sprites/silhouettes';
import { dessinerEnSvg } from '../../src/render/sprites/pinceau-svg';
import { chargerCatalogue } from '../../src/engine/catalogue';

/**
 * Une vérification de bonne formation, faite à la main : les balises
 * s'apparient, chaque valeur d'attribut est entre guillemets, et rien n'est
 * laissé ouvert. Un vrai analyseur XML serait une dépendance de plus pour
 * répondre à une question à laquelle vingt lignes répondent.
 */
function bienForme(svg: string): { ok: true } | { ok: false; motif: string } {
  const pile: string[] = [];
  const balise = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/g;
  let curseur = 0;
  for (let m = balise.exec(svg); m !== null; m = balise.exec(svg)) {
    // Entre deux balises, il ne doit rien rester qui ressemble à du balisage.
    const entre = svg.slice(curseur, m.index);
    if (entre.includes('<') || entre.includes('>')) return { ok: false, motif: `chevron nu : ${entre}` };
    curseur = m.index + m[0].length;
    const fermante = m[1] === '/';
    const nom = m[2] ?? '';
    const solitaire = m[4] === '/';
    if (solitaire) continue;
    if (fermante) {
      if (pile.pop() !== nom) return { ok: false, motif: `</${nom}> sans ouverture` };
    } else pile.push(nom);
  }
  const reste = svg.slice(curseur);
  if (reste.includes('<') || reste.includes('>')) return { ok: false, motif: `chevron nu : ${reste}` };
  if (pile.length > 0) return { ok: false, motif: `jamais refermé : ${pile.join(', ')}` };
  return { ok: true };
}

test('chaque clé de la liste fermée rend un SVG carré, bien formé et non vide', () => {
  for (const cle of CLES_ILLUSTRATION) {
    const svg = illustrationSvg(cle);
    const forme = bienForme(svg);
    assert.ok(forme.ok, `${cle} : ${forme.ok ? '' : forme.motif}`);
    assert.match(svg, /^<svg /, `${cle} ne commence pas par <svg`);
    assert.match(svg, /<\/svg>$/, `${cle} ne finit pas par </svg>`);
    // Le carré est ce qui fait que vingt-sept vignettes s'alignent dans une
    // phrase : une seule qui ne serait pas carrée décalerait sa ligne.
    assert.match(svg, /viewBox="0 0 48 48"/, `${cle} n'est pas carrée`);
    assert.ok(!svg.includes('NaN'), `${cle} porte un NaN`);
    assert.ok(!svg.includes('undefined'), `${cle} porte un undefined`);
    // Trois tracés au moins : la plaque, et de quoi dire quelque chose dessus.
    const traces = (svg.match(/<(path|rect|circle|g)\b/g) ?? []).length;
    assert.ok(traces >= 4, `${cle} n'a que ${traces} tracés`);
  }
});

test('sans nom la vignette se tait, avec un nom elle se présente', () => {
  const muette = illustrationSvg('case_verte');
  assert.match(muette, /aria-hidden="true"/);
  assert.ok(!muette.includes('<title>'));
  const nommee = illustrationSvg('case_verte', { titre: 'Case verte' });
  assert.match(nommee, /role="img"/);
  assert.match(nommee, /aria-label="Case verte"/);
  assert.match(nommee, /<title>Case verte<\/title>/);
  assert.ok(!nommee.includes('aria-hidden'));
});

test('le nom accessible et la légende sont échappés', () => {
  const svg = illustrationSvg('qg', { titre: 'a "b" <c> & d' });
  assert.match(svg, /aria-label="a &quot;b&quot; &lt;c&gt; &amp; d"/);
  assert.ok(bienForme(svg).ok);
  const vg = vignetteIllustration('qg', '<script>', (s) => s.replace(/</g, '&lt;'), () => 'QG');
  assert.match(vg, /<figcaption>&lt;script><\/figcaption>/);
});

test('une même clé rend deux fois la même chaîne : rien n’est tiré au sort', () => {
  for (const cle of ['duel', 'unite_char_leger', 'ville'] as const) {
    assert.equal(illustrationSvg(cle), illustrationSvg(cle), cle);
  }
});

test('les six figurines sont celles du canon, pas un second dessin', () => {
  // Le module recopie six silhouettes pour pouvoir composer sans état de
  // partie ; si le canon en change une, c'est ici que ça doit rougir.
  const catalogue = chargerCatalogue(0);
  for (const cle of ['infanterie', 'meca', 'genie', 'char_leger', 'artillerie', 'transport']) {
    const type = catalogue.unites[cle];
    assert.ok(type, `${cle} absente du catalogue 6`);
    // Le dessin du canon, passé au pinceau, doit rendre exactement le nôtre.
    const attendu = dessinerEnSvg('0 0 48 48', (g) => {
      g.save();
      g.translate(24, 27);
      g.scale(0.6, 0.6);
      dessinerUnite(g, type.silhouette, paletteDe(0));
      g.restore();
    }, { prefixeId: `il-unite_${cle}` });
    const notre = illustrationSvg(`unite_${cle}` as CleIllustration);
    const corps = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    assert.ok(corps(notre).endsWith(corps(attendu).replace(/^<defs>[\s\S]*?<\/defs>/, '')),
      `unite_${cle} n'est pas la silhouette du canon`);
  }
});

test('un pictogramme se découpe dans la phrase, et garde le gras qui l’entoure', () => {
  assert.deepEqual(segmenterRiche('les cases [[img:case_verte]] sont à lui'), [
    { genre: 'texte', texte: 'les cases ', gras: false },
    { genre: 'image', cle: 'case_verte', gras: false },
    { genre: 'texte', texte: ' sont à lui', gras: false },
  ]);
  assert.deepEqual(segmenterRiche('**le [[img:qg]] compte**'), [
    { genre: 'texte', texte: 'le ', gras: true },
    { genre: 'image', cle: 'qg', gras: true },
    { genre: 'texte', texte: ' compte', gras: true },
  ]);
  // Deux marques collées, et une phrase qui n'est qu'une image.
  assert.deepEqual(segmenterRiche('[[img:case_verte]][[img:case_rouge]]'), [
    { genre: 'image', cle: 'case_verte', gras: false },
    { genre: 'image', cle: 'case_rouge', gras: false },
  ]);
});

test('une marque mal fermée ou inconnue se rend telle quelle, jamais en faute', () => {
  for (const brut of [
    'reste [[img:case_verte ouvert',
    'clé absente [[img:tank_volant]] ici',
    'presque [[img:]] vide',
    'majuscules [[img:CASE_VERTE]] refusées',
    'un seul crochet [img:case_verte] ici',
  ]) {
    assert.deepEqual(segmenterRiche(brut), [{ genre: 'texte', texte: brut, gras: false }], brut);
  }
});

test('la regex partagée ne garde pas son curseur d’un appel à l’autre', () => {
  // `MARQUE_IMAGE` est globale : sans remise à zéro, un second découpage
  // reprendrait au milieu du premier et perdrait une image sur deux.
  MARQUE_IMAGE.lastIndex = 30;
  const a = segmenterRiche('a [[img:qg]] b');
  const b = segmenterRiche('a [[img:qg]] b');
  assert.deepEqual(a, b);
  assert.equal(a.filter((s) => s.genre === 'image').length, 1);
});

test('texteNu rend une phrase lisible à voix haute', () => {
  const t = 'prenez le **[[img:qg]]** avant [[img:brouillard]] la nuit';
  assert.equal(texteNu(t), 'prenez le  avant  la nuit');
  assert.equal(
    texteNu(t, (c) => (c === 'qg' ? 'QG' : 'brouillard')),
    'prenez le QG avant brouillard la nuit',
  );
});

test('htmlRiche pose un strong, un pictogramme, et échappe le reste', () => {
  const ech = (s: string): string => s.replace(/</g, '&lt;');
  const html = htmlRiche('a <b> **gras** [[img:curseur]]', ech);
  assert.match(html, /^a &lt;b> <strong>gras<\/strong> /);
  assert.match(html, new RegExp(`<span class="${CLASSE_PICTOGRAMME}"><svg `));
  assert.ok(bienForme(html.replace(/^a &lt;b> /, 'a ')).ok, html.slice(0, 80));
});

test('la frappe lettre à lettre ne coupe jamais un pictogramme', () => {
  const html = htmlReplique('va [[img:case_verte]] là', (c) => `nom ${c}`);
  // Chaque `<b>` est soit un caractère, soit **tout** le dessin : la frappe ne
  // connaît que des `<b>`, donc elle ne peut pas s'arrêter au milieu du SVG.
  const bs = [...html.matchAll(/<b>([\s\S]*?)<\/b>/g)].map((m) => m[1] ?? '');
  assert.equal(bs.filter((c) => c.includes('<svg')).length, 1);
  for (const contenu of bs) {
    const seul = [...contenu].length === 1;
    assert.ok(seul || contenu.includes('<svg'), `un <b> ni lettre ni dessin : ${contenu}`);
  }
  const dessin = bs.find((c) => c.includes('<svg')) ?? '';
  assert.ok(dessin.includes('</svg>'), 'le dessin est coupé');
  assert.match(dessin, /aria-label="nom case_verte"/);
  // Le nombre de lettres révélées reste celui du texte lu, plus une par image.
  assert.equal(bs.length, 'va  là'.length + 1);
});

test('le gras d’une réplique enveloppe le pictogramme sans le couper', () => {
  const html = htmlReplique('**[[img:qg]]**');
  assert.match(html, /^<strong><b><span class="/);
  assert.match(html, /<\/svg><\/span><\/b><\/strong>$/);
});

test('la vignette d’une réplique est une figure légendée', () => {
  const ech = (s: string): string => s;
  const avec = vignetteIllustration('case_or', 'Là où il faut aller', ech, () => 'Case or');
  assert.match(avec, /^<figure class="atlas-img-vignette">/);
  assert.match(avec, /<figcaption>Là où il faut aller<\/figcaption>/);
  assert.match(avec, /aria-label="Case or"/);
  assert.ok(bienForme(avec).ok);
  // Sans légende, pas de bloc vide : une figure sans légende reste une figure.
  const sans = vignetteIllustration('case_or', undefined, ech);
  assert.ok(!sans.includes('figcaption'));
  assert.ok(bienForme(sans).ok);
});

test('le pictogramme est enveloppé, et c’est le CSS qui le mesure', () => {
  const p = pictogramme('curseur');
  assert.match(p, new RegExp(`^<span class="${CLASSE_PICTOGRAMME}">`));
  // Aucune taille en dur sur la racine : c'est la feuille de style qui la
  // donne, de sorte que le même dessin serve à vingt pixels et à quatre-vingt-
  // seize sans qu'on le lui dise deux fois.
  const racine = /<svg[^>]*>/.exec(p)?.[0] ?? '';
  assert.ok(!/\swidth="/.test(racine), `une largeur est écrite en dur : ${racine}`);
  assert.ok(!/\sheight="/.test(racine), `une hauteur est écrite en dur : ${racine}`);
  assert.ok(!p.includes('style='), 'un style est écrit en dur');
});
