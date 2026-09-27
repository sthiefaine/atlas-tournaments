/**
 * Le catalogue canon des flags (`content/flags.json`) : chaque entrée passe
 * `validerFlag`, le registre des auteurs le double exactement, et les flags de
 * portée commandant nomment des commandants **du registre** — pas ceux d'une
 * distribution retirée.
 *
 * Jusqu'au 26 septembre 2026, les cent vingt flags `cmd.*` portaient les noms de
 * l'ancienne distribution (Camille Aubertin, Hrefna Sigurðardóttir, Stavros
 * Kalogeris…), que `content/personnages.json` avait remplacée et que rien ne
 * lisait. Ils sont renommés ; ce test empêche la dérive de revenir.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

import { validerFlag } from '../../src/schemas/index';
import { personnagesCanon } from '../../src/serveur/personnages';

interface Catalogue {
  count: number;
  auteurs: Record<string, string>;
  auteurs_possibles: string[];
  flags: { cle: string; portee: string; paysCode?: string; commandantCle?: string; libelle: string; description: string }[];
}
const catalogue = JSON.parse(readFileSync('content/flags.json', 'utf8')) as Catalogue;

test('chaque flag du canon passe validerFlag, et le registre des auteurs le double exactement', () => {
  for (const f of catalogue.flags) {
    const r = validerFlag(f);
    assert.ok(r.ok, `${f.cle} : ${JSON.stringify(r)}`);
  }
  const cles = catalogue.flags.map((f) => f.cle);
  assert.equal(new Set(cles).size, cles.length, 'un flag en double');
  assert.deepEqual(Object.keys(catalogue.auteurs).sort(), [...cles].sort(), 'auteurs et flags divergent');
  for (const [cle, auteur] of Object.entries(catalogue.auteurs)) {
    assert.ok(catalogue.auteurs_possibles.includes(auteur), `${cle} : auteur inconnu ${auteur}`);
  }
  assert.equal(catalogue.count, catalogue.flags.length, 'le compte annoncé suit la liste');
});

test('les flags de commandant nomment les vingt-quatre commandants nationaux du registre', () => {
  const nationaux = personnagesCanon().filter((p) => p.role === 'commandant' && p.paysCode && p.paysCode !== 'atl');
  assert.equal(nationaux.length, 24);
  const parCle = new Map(nationaux.map((p) => [p.cle, p]));
  const couverts = new Set<string>();
  for (const f of catalogue.flags.filter((x) => x.portee === 'commandant')) {
    const p = parCle.get(f.commandantCle ?? '');
    assert.ok(p, `${f.cle} nomme ${f.commandantCle}, qui n’est pas un commandant national du registre`);
    assert.ok(f.libelle.endsWith(`— ${p.nom}`), `${f.cle} : « ${f.libelle} »`);
    assert.ok(f.description.includes(p.nom), `${f.cle} : « ${f.description} »`);
    couverts.add(p.cle);
  }
  assert.equal(couverts.size, 24, 'les cinq gabarits pour chacun des vingt-quatre');
});

test('aucun libellé ni aucune description ne cite l’ancienne distribution', () => {
  // Léa Wagener n'en fait pas partie : elle est revenue au registre comme adjointe
  // aux convois, et ses deux flags du Luxembourg disent vrai.
  const anciens = /Camille Aubertin|Hrefna|Gaudenz|Wieke|Stavros|Mizuki|Naran|Pemba|Prasetyo|Rohan|Idir|Aïssatou|Amani|Tuli|Voahangy|Dandara|Facundo|Nayra|Xóchitl|Émile Tremblay|Marlee|Hana Whitmore|Sitiveni/;
  for (const f of catalogue.flags) {
    assert.ok(!anciens.test(f.libelle), `${f.cle} : « ${f.libelle} »`);
    assert.ok(!anciens.test(f.description), `${f.cle} : « ${f.description} »`);
  }
  const registre = new Set(personnagesCanon().map((p) => p.cle));
  assert.ok(registre.has('lea_wagener'), 'les flags qui la citent parlent d’une personne du registre');
});
