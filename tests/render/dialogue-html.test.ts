// La réplique se frappe lettre à lettre : chaque caractère est un `<b>` que la
// frappe révèle, et un segment gras (`**…**`) enveloppe **ses** lettres dans un
// `<strong>` posé une fois pour toutes — la frappe ne coupe jamais une balise.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { htmlReplique } from '../../src/render/dialogue-html';

test('une lettre par b, le gras dans un strong qui enveloppe ses lettres', () => {
  assert.equal(
    htmlReplique('Vu **ok** !'),
    '<b>V</b><b>u</b><b> </b><strong><b>o</b><b>k</b></strong><b> </b><b>!</b>',
  );
});

test('la frappe compte autant de b que de caractères, gras compris', () => {
  const texte = 'Prenez **la ville** avant la nuit.';
  const html = htmlReplique(texte);
  const lettres = html.match(/<b>/g)?.length ?? 0;
  assert.equal(lettres, [...texte.replace(/\*\*/g, '')].length);
  assert.equal(html.match(/<strong>/g)?.length, 1);
});

test('un gras jamais refermé se frappe tel quel et le texte est échappé', () => {
  assert.equal(htmlReplique('a **<'), '<b>a</b><b> </b><b>*</b><b>*</b><b>&lt;</b>');
});
