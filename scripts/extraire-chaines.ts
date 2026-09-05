/**
 * `npm run extraire-chaines` — pousse les chaînes traduisibles vers `chaines_source`.
 *
 * Deux origines (`09-i18n.md` §3) :
 *
 *   - **interface** : `content/i18n/interface.fr.json`, écrit à la main, avec son
 *     contexte et sa longueur maximale ;
 *   - **canon** : les champs texte des JSON de `content/`, parcourus selon une
 *     **table de champs traduisibles** tenue à la main ci-dessous — jamais par
 *     devinette, sinon on traduirait des identifiants.
 *
 * Le script est **idempotent** : `sourceHash` est recalculé à chaque passage, et
 * une chaîne dont le texte n'a pas bougé n'est pas réécrite. Quand un texte change,
 * son empreinte change, `versionChaine` est incrémentée et les traductions de cette
 * clé basculent `perimee` — c'est ce qui garantit qu'une correction du français
 * finit par atteindre les huit autres langues.
 *
 * Sans `DATABASE_URL`, le script tourne à blanc : il collecte, compte et affiche,
 * sans rien écrire. C'est ce qui permet de le lancer en intégration continue.
 */

import {
  chargerArchetypes, chargerMecaniques, chargerTerrains, chargerUnites,
} from '../src/content/index';
import { CHAINES_INTERFACE } from '../src/i18n/index';
import { empreinteCourte } from '../src/db/requetes/communs';
import { REGEX_CLE_CHAINE } from '../src/schemas/index';

/** Une chaîne prête à être poussée. */
export interface ChaineExtraite {
  cle: string;
  texte: string;
  origine: 'interface' | 'canon';
  contexte: { ecran?: string; locuteur?: string; note?: string };
  longueurMax: number | null;
  pluriel: boolean;
  objetRef?: { type: string; cle: string; champ: string };
}

/**
 * La table des champs traduisibles du canon. Tenue à la main, volontairement :
 * ajouter un champ ici est une décision, pas un effet de bord.
 */
export function chainesDuCanon(): ChaineExtraite[] {
  const sortie: ChaineExtraite[] = [];

  for (const t of chargerTerrains()) {
    sortie.push({
      cle: `terrain.${t.cle}.nom`,
      texte: t.nom,
      origine: 'canon',
      contexte: { ecran: 'hud', note: 'Nom de terrain affiché dans le panneau de case.' },
      longueurMax: 24,
      pluriel: false,
    });
  }

  for (const u of chargerUnites()) {
    sortie.push({
      cle: `unite.${u.cle}.nom`,
      texte: u.nom,
      origine: 'canon',
      contexte: { ecran: 'menu_production', note: 'Nom d’unité, menu de production et panneau d’unité.' },
      longueurMax: 40,
      pluriel: false,
      objetRef: { type: 'UnitType', cle: u.cle, champ: 'nom' },
    });
    sortie.push({
      cle: `unite.${u.cle}.nom_court`,
      texte: u.nomCourt,
      origine: 'canon',
      contexte: { ecran: 'hud', note: 'Nom court, étiquette sous l’unité. Très contraint.' },
      longueurMax: 12,
      pluriel: false,
      objetRef: { type: 'UnitType', cle: u.cle, champ: 'nomCourt' },
    });
  }

  for (const a of chargerArchetypes()) {
    sortie.push({
      cle: `archetype.${a.cle}.libelle`,
      texte: a.libelle,
      origine: 'canon',
      contexte: { ecran: 'menu', note: 'Libellé d’archétype de commandant.' },
      longueurMax: 32,
      pluriel: false,
    });
  }

  for (const m of chargerMecaniques()) {
    sortie.push({
      cle: `${m.cle}.nom`,
      texte: m.nom,
      origine: 'canon',
      contexte: { ecran: 'hud', note: 'Nom de mécanique régionale, bandeau de match.' },
      longueurMax: 40,
      pluriel: false,
    });
    sortie.push({
      cle: `${m.cle}.description`,
      texte: m.description,
      origine: 'canon',
      contexte: { ecran: 'menu', note: 'Description de mécanique régionale, écran de briefing.' },
      longueurMax: 240,
      pluriel: false,
    });
  }

  return sortie;
}

/** Les chaînes d'interface, telles qu'elles sont écrites à la main. */
export function chainesDeLInterface(): ChaineExtraite[] {
  return CHAINES_INTERFACE.map((c) => ({
    cle: c.cle,
    texte: c.texte,
    origine: 'interface' as const,
    contexte: c.contexte,
    longueurMax: c.longueurMax,
    pluriel: c.pluriel,
  }));
}

/** Toutes les chaînes traduisibles, interface puis canon. */
export function collecterChaines(): ChaineExtraite[] {
  return [...chainesDeLInterface(), ...chainesDuCanon()];
}

/** Vérifications qui font échouer l'intégration continue. */
export function verifier(chaines: readonly ChaineExtraite[]): string[] {
  const fautes: string[] = [];
  const vues = new Map<string, string>();
  for (const c of chaines) {
    if (!REGEX_CLE_CHAINE.test(c.cle)) fautes.push(`clé mal formée : ${c.cle}`);
    if (c.texte.trim() === '') fautes.push(`texte vide : ${c.cle}`);
    if (c.longueurMax !== null && c.texte.length > c.longueurMax) {
      fautes.push(`le français dépasse déjà sa borne : ${c.cle} (${c.texte.length} > ${c.longueurMax})`);
    }
    const dejaVue = vues.get(c.cle);
    if (dejaVue !== undefined && dejaVue !== c.texte) {
      fautes.push(`clé réutilisée pour un autre texte : ${c.cle}`);
    }
    vues.set(c.cle, c.texte);
  }
  return fautes;
}

async function main(): Promise<void> {
  const chaines = collecterChaines();
  const fautes = verifier(chaines);
  for (const f of fautes) console.error(`[extraire-chaines] ✗ ${f}`);
  if (fautes.length > 0) process.exit(1);

  const parOrigine = new Map<string, number>();
  for (const c of chaines) parOrigine.set(c.origine, (parOrigine.get(c.origine) ?? 0) + 1);
  console.log(`[extraire-chaines] ${chaines.length} chaînes collectées :`);
  for (const [origine, n] of parOrigine) console.log(`  ${origine} : ${n}`);

  if (!process.env['DATABASE_URL']) {
    console.log('[extraire-chaines] DATABASE_URL absente : marche à blanc, rien n’est écrit.');
    console.log(`[extraire-chaines] exemple d’empreinte : ${chaines[0]?.cle} → ${empreinteCourte(chaines[0]?.texte ?? '')}`);
    return;
  }

  // L'import est différé : sans base, on ne charge même pas le pilote Postgres.
  const { chaines: requetes } = await import('../src/db/requetes/index');
  const { localesReq, traductions } = await import('../src/db/requetes/index');
  const { fermer } = await import('../src/db/client');

  let poussees = 0;
  let perimees = 0;
  for (const c of chaines) {
    const r = await requetes.poser({
      cle: c.cle,
      texte: c.texte,
      origine: c.origine,
      contexte: c.contexte,
      longueurMax: c.longueurMax,
      pluriel: c.pluriel,
      objetRef: c.objetRef ?? null,
    });
    if (r.change) poussees += 1;
    perimees += r.perimees;
  }

  // Toute langue cible reçoit ses lignes `manquante` pour les nouvelles chaînes.
  let semees = 0;
  for (const l of await localesReq.cibles()) semees += await traductions.semer(l.code);

  console.log(`[extraire-chaines] ${poussees} chaîne(s) écrite(s), ${perimees} traduction(s) périmée(s), ${semees} ligne(s) semée(s).`);
  await fermer();
}

// N'exécute rien à l'import : les tests importent les fonctions pures.
const lanceDirectement = process.argv[1] !== undefined && /extraire-chaines\.(ts|js)$/.test(process.argv[1]);
if (lanceDirectement) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
