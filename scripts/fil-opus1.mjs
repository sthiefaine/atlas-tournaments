// Compose le fil de l'opus 1 — chapitres, épisodes, hors-série — depuis les
// registres éditoriaux de `doc/refonte/`. Ne produit rien de jouable : c'est
// la table de lecture du propriétaire, régénérée à chaque changement des JSON.
//   node scripts/fil-opus1.mjs            → doc/refonte/opus1-fil.md
//   node scripts/fil-opus1.mjs --json     → écrit aussi doc/refonte/opus1-fil.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lire = (chemin) => JSON.parse(readFileSync(chemin, 'utf8'));
const tutos = lire('doc/refonte/opus1-tutoriels-final.json');
const nations = lire('doc/refonte/opus1-nations.json');
const pays = Object.fromEntries(
  ['fr','lu','ch','nl','ma','sn','br','mx','in','jp','au','id','ar','ca','fj','gr','is','ke','mg','mn','na','np','nz','pe']
    .map((c) => [c, lire(`content/pays/${c}.json`).nom]),
);
const perso = Object.fromEntries(lire('content/personnages.json').personnages.map((p) => [p.cle, p.nom]));
const horsSerie = existsSync('doc/refonte/opus1-hors-serie.json') ? lire('doc/refonte/opus1-hors-serie.json') : { episodes: [], disparitions: [] };

const SAISONS_NATIONALES = [['fr','lu','ch','nl'], ['ma','sn','br','mx'], ['in','jp','au','id']];
const nom = (cle) => perso[cle] ?? cle;
const disparitionsPar = new Map();
for (const d of horsSerie.disparitions ?? []) disparitionsPar.set(d.ou, d);
const hsParAncrage = new Map();
for (const e of horsSerie.episodes ?? []) {
  const liste = hsParAncrage.get(e.ancrage) ?? [];
  liste.push(e);
  hsParAncrage.set(e.ancrage, liste);
}

/** Une ligne du fil. `type` : tutoriel | national | finale | hors_serie. */
const lignes = [];
let numero = 0;
const pousser = (l) => { lignes.push({ ...l, numero: l.type === 'hors_serie' ? null : ++numero }); };
const ajouterHorsSerie = (ancrage) => {
  for (const e of hsParAncrage.get(ancrage) ?? []) {
    const d = disparitionsPar.get(e.id);
    pousser({
      type: 'hors_serie', id: e.id, chapitre: `Hors-série · ${pays[e.nation] ?? e.nation}`, saison: null,
      titre: e.titre, description: e.situation ?? '', format: e.objectifGameplay?.format ?? '',
      objectif: e.objectifGameplay?.conditionVictoire ?? e.objectifGameplay?.type ?? '',
      personnages: (e.personnages ?? []).map(nom), ouverture: typeof e.ouverture === 'string' ? e.ouverture : (e.ouverture?.description ?? e.ouverture?.resume ?? JSON.stringify(e.ouverture ?? '')),
      disparition: d ? nom(d.personnage) : (e.disparition ? nom(e.disparition) : null), statut: e.statut ?? 'conception',
    });
    // Un hors-série s'ancre souvent sur le hors-série précédent de son arc :
    // on déroule la chaîne juste après lui, dans l'ordre de l'arc.
    ajouterHorsSerie(e.id);
  }
};

// Chapitre 0 — les dix exercices.
for (const t of tutos.tutoriels) {
  pousser({ type: 'tutoriel', id: t.id, chapitre: 'Les dix exercices', saison: 0, titre: t.titre,
    description: t.apprentissage ? `${t.apprentissage}. ${t.objectifGameplay}` : t.objectifGameplay,
    format: '1v1', objectif: t.objectifGameplay, personnages: [], statut: t.statut });
  ajouterHorsSerie(t.id);
}
// Saisons nationales 1 à 3.
SAISONS_NATIONALES.forEach((codes, i) => {
  for (const code of codes) {
    const missions = nations.missions.filter((m) => m.nation === code).sort((a, b) => a.numero - b.numero);
    for (const m of missions) {
      const d = disparitionsPar.get(m.id);
      pousser({ type: 'national', id: m.id, chapitre: `${pays[code]} — ${m.chapitre}`, saison: i + 1, titre: m.titre,
        description: m.situation, format: m.objectifGameplay?.format ?? '', objectif: m.objectifGameplay?.conditionVictoire ?? '',
        personnages: (m.personnages ?? []).map(nom), choix: m.choixConsequence ? m.choixConsequence.options.map((o) => o.texte).join(' / ') : null,
        disparition: d ? nom(d.personnage) : null, statut: m.statut });
      ajouterHorsSerie(m.id);
    }
  }
});
// Les dix-huit finales, saisons globales 4 à 6.
for (const f of tutos.finales) {
  const d = disparitionsPar.get(f.id);
  pousser({ type: 'finale', id: f.id, chapitre: `Finales — saison ${f.saisonFinale}`, saison: f.saisonGlobale, titre: f.titre,
    description: `${f.carteIntention ?? ''} ${f.revelations?.length ? '— ' + f.revelations.join(' ') : ''}`.trim(),
    format: f.format ?? '', objectif: f.objectifGameplay, personnages: f.adversairePrincipal ? [nom(f.adversairePrincipal)] : [],
    choix: f.choixImpact?.choix ?? null, disparition: d ? nom(d.personnage) : null, statut: f.statut });
  ajouterHorsSerie(f.id);
}
// Hors-série sans ancrage reconnu : en queue, signalés.
const ancres = new Set(lignes.map((l) => l.id));
const orphelins = (horsSerie.episodes ?? []).filter((e) => !ancres.has(e.id));
for (const e of orphelins) hsParAncrage.set('__orphelin__', [...(hsParAncrage.get('__orphelin__') ?? []), e]);
ajouterHorsSerie('__orphelin__');

const md = [];
md.push('# Opus 1 — le fil : chapitres, épisodes et hors-série');
md.push('');
md.push('Généré par `node scripts/fil-opus1.mjs` depuis `opus1-tutoriels-final.json`, `opus1-nations.json` et `opus1-hors-serie.json`. **Ne pas éditer à la main** : corriger les registres, puis régénérer. Le numéro est la position dans la trame principale (1 à 172) ; un hors-série n\'en a pas, il s\'insère après l\'épisode qui l\'ouvre. Un ▭ (la plaque posée à plat) marque l\'épisode où un chef de nation alliée disparaît (hors terrain, décision du propriétaire du 9 septembre 2026).');
md.push('');
const principaux = lignes.filter((l) => l.type !== 'hors_serie').length;
const hs = lignes.filter((l) => l.type === 'hors_serie').length;
md.push(`Trame principale : **${principaux} épisodes** (${tutos.tutoriels.length} exercices, ${nations.missions.length} nationaux, ${tutos.finales.length} finales). Hors-série : **${hs}**${orphelins.length ? ` dont ${orphelins.length} sans ancrage reconnu (en queue)` : ''}. Disparitions : **${(horsSerie.disparitions ?? []).length}**.`);
md.push('');
let chapitreCourant = null;
for (const l of lignes) {
  if (l.type !== 'hors_serie' && l.chapitre !== chapitreCourant) {
    chapitreCourant = l.chapitre;
    const saison = l.saison === 0 ? 'Prologue' : l.type === 'finale' ? `Saison globale ${l.saison}` : `Saison nationale ${l.saison}`;
    md.push('');
    md.push(`## ${l.chapitre} · ${saison}`);
    md.push('');
    md.push('| N° | Épisode | Format | Description courte | Personnages | Choix / ouverture |');
    md.push('|---:|---|---|---|---|---|');
  }
  const titre = l.type === 'hors_serie' ? `↳ *HS* **${l.titre}**${l.disparition ? ' ▭' : ''}` : `**${l.titre}**${l.disparition ? ' ▭' : ''}`;
  const extra = l.type === 'hors_serie' ? `Ouvert par : ${l.ouverture || '—'}` : (l.choix ? `Choix : ${l.choix}` : '');
  const desc = `${l.description ?? ''}${l.disparition ? ` — *Disparition de ${l.disparition}.*` : ''}`.replace(/\|/g, '/').replace(/\s+/g, ' ');
  md.push(`| ${l.numero ?? '—'} | ${titre}<br><small>\`${l.id}\`</small> | ${l.format} | ${desc} | ${l.personnages.join(', ')} | ${extra.replace(/\|/g, '/')} |`);
}
md.push('');
md.push('## Lecture par saison');
md.push('');
md.push('| Saison | Chapitres | Épisodes | Hors-série ancrés | Disparitions |');
md.push('|---|---|---:|---:|---|');
const parSaison = new Map();
for (const l of lignes) {
  const cle = l.type === 'hors_serie' ? null : (l.saison === 0 ? 'Prologue' : l.type === 'finale' ? `Globale ${l.saison}` : `Nationale ${l.saison}`);
  if (!cle) continue;
  const s = parSaison.get(cle) ?? { chapitres: new Set(), episodes: 0, hs: 0, disparitions: [] };
  s.chapitres.add(l.chapitre); s.episodes += 1;
  if (l.disparition) s.disparitions.push(l.disparition);
  const chaine = (id) => { for (const e of hsParAncrage.get(id) ?? []) { s.hs += 1; if (e.disparition) s.disparitions.push(nom(e.disparition)); chaine(e.id); } };
  chaine(l.id);
  parSaison.set(cle, s);
}
for (const [cle, s] of parSaison) md.push(`| ${cle} | ${[...s.chapitres].map((c) => c.split(' — ')[0]).join(', ')} | ${s.episodes} | ${s.hs} | ${s.disparitions.join(', ') || '—'} |`);
md.push('');
writeFileSync('doc/refonte/opus1-fil.md', md.join('\n') + '\n');
if (process.argv.includes('--json')) writeFileSync('doc/refonte/opus1-fil.json', JSON.stringify({ genere: 'scripts/fil-opus1.mjs', lignes }, null, 1) + '\n');
console.log(`opus1-fil.md : ${principaux} épisodes principaux, ${hs} hors-série, ${(horsSerie.disparitions ?? []).length} disparitions`);
