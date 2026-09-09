// Le roster des héros : un tableau par registre (nations, Atlas, civils, faction)
// composé depuis `content/personnages.json` et `content/commandants-capacites.json`,
// avec la liste des manques que le code peut constater (capacité absente, moins de
// trois faits, aucune mission). Document auteur : il contient les adversaires.
//   node scripts/roster-heros.mjs → doc/refonte/roster-heros.md
import { readFileSync, writeFileSync } from 'node:fs';

const lire = (chemin) => JSON.parse(readFileSync(chemin, 'utf8'));
const personnages = lire('content/personnages.json').personnages;
const capacites = Object.fromEntries(lire('content/commandants-capacites.json').commandants.map((c) => [c.cle, c]));
const pays = (code) => { try { return lire(`content/pays/${code}.json`); } catch { return null; } };
const nettoyer = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const prenom = (nomComplet) => nomComplet.split(' ')[0];
const effets = (bloc) => bloc ? `**${bloc.nom}** (${bloc.barres} barres) — ${nettoyer(bloc.description)}` : '—';

const nationaux = personnages.filter((p) => p.role === 'commandant' && p.paysCode && p.paysCode !== 'atl');
const faction = personnages.filter((p) => p.paysCode === 'atl');
const atlas = personnages.filter((p) => p.role === 'commandant' && !p.paysCode);
const civils = personnages.filter((p) => p.role === 'civil');

const ordre = ['fr','lu','ch','nl','ma','sn','br','mx','in','jp','au','id','ar','ca','fj','gr','is','ke','mg','mn','na','np','nz','pe'];
nationaux.sort((a, b) => ordre.indexOf(a.paysCode) - ordre.indexOf(b.paysCode));

const md = [];
md.push('# Le roster des héros — nations, Atlas, civils, faction');
md.push('');
md.push('Généré par `node scripts/roster-heros.mjs` depuis `content/personnages.json` (révision ' + lire('content/personnages.json').version + ') et `content/commandants-capacites.json`. **Document auteur** : il liste aussi la faction, dont la fonction et les liens ne sont jamais publics. Ne pas éditer à la main.');
md.push('');
md.push(`Personnages : **${personnages.length}** — ${nationaux.length} commandants nationaux (${nationaux.filter((p) => p.premierPlan).length} au premier plan), ${faction.length} de la faction, ${atlas.length} d'Atlas, ${civils.length} civils.`);
md.push('');
md.push('## Les 24 commandants nationaux');
md.push('');
md.push('| Nation | Prénom | Nom complet | Plan | Archétype (fiche pays) | Style | Passif | Pouvoir | Super pouvoir | Faits | Mission d\'entrée |');
md.push('|---|---|---|---|---|---|---|---|---|---:|---|');
const manques = [];
for (const p of nationaux) {
  const c = capacites[p.cle];
  const f = pays(p.paysCode);
  const faits = (p.historique ?? []).length;
  if (!c) manques.push(`${p.nom} (${p.paysCode}) : aucune capacité dans commandants-capacites.json`);
  if (faits < 3) manques.push(`${p.nom} (${p.paysCode}) : ${faits} fait(s) d'historique seulement`);
  if (!p.identiteTactique?.mission) manques.push(`${p.nom} (${p.paysCode}) : aucune mission d'entrée (identiteTactique.mission)`);
  md.push(`| ${f?.nom ?? p.paysCode} | **${prenom(p.nom)}** | ${p.nom} | ${p.premierPlan ? 'premier plan' : 'second plan'} | ${f?.archetypeCommandant ?? '—'} | ${nettoyer(c?.style ?? p.identiteTactique?.style)} | ${nettoyer(c?.descriptionPassif)} | ${effets(c?.pouvoir)} | ${effets(c?.superPouvoir)} | ${faits} | ${p.identiteTactique?.mission ? '`' + p.identiteTactique.mission + '`' : '—'} |`);
}
md.push('');
md.push('### Lore en trois lignes, par commandant');
md.push('');
for (const p of nationaux) {
  md.push(`**${p.nom}** — ${pays(p.paysCode)?.nom ?? p.paysCode}. ${nettoyer(p.fonction)}. *Motivation :* ${nettoyer(p.motivation)} *Croyance :* ${nettoyer(p.croyance)}`);
  for (const h of p.historique ?? []) md.push(`- ${h.repere} (acte ${h.acteRevelation}${h.confidentialite ? ', ' + h.confidentialite : ''}) : ${nettoyer(h.fait)}`);
  if (p.identiteTactique?.dilemme) md.push(`- *Dilemme :* ${nettoyer(p.identiteTactique.dilemme)}`);
  md.push('');
}
const bloc = (titre, liste, auteur) => {
  md.push(`## ${titre}`);
  md.push('');
  if (auteur) md.push('*Bible auteur : fonction, motivation et liens ne sont jamais sérialisés tels quels vers une interface publique.*');
  md.push('');
  md.push('| Prénom | Nom complet | Fonction | Style | Pouvoir | Super pouvoir | Faits |');
  md.push('|---|---|---|---|---|---|---:|');
  for (const p of liste) {
    const c = capacites[p.cle];
    md.push(`| **${prenom(p.nom)}** | ${p.nom} | ${nettoyer(p.fonction)} | ${nettoyer(c?.style ?? p.identiteTactique?.style ?? '—')} | ${effets(c?.pouvoir)} | ${effets(c?.superPouvoir)} | ${(p.historique ?? []).length} |`);
  }
  md.push('');
  for (const p of liste) {
    md.push(`**${p.nom}** — *Motivation :* ${nettoyer(p.motivation)} *Croyance :* ${nettoyer(p.croyance)}`);
    for (const h of p.historique ?? []) md.push(`- ${h.repere} (acte ${h.acteRevelation}${h.confidentialite ? ', ' + h.confidentialite : ''}) : ${nettoyer(h.fait)}`);
    md.push('');
  }
};
bloc('La Cinquième Manche et les Gris (8)', faction, true);
bloc('Atlas (2)', atlas, false);
md.push('## Les civils (3)');
md.push('');
for (const p of civils) {
  md.push(`**${p.nom}** — ${nettoyer(p.fonction)}. *Motivation :* ${nettoyer(p.motivation)} *Croyance :* ${nettoyer(p.croyance)}`);
  for (const h of p.historique ?? []) md.push(`- ${h.repere} (acte ${h.acteRevelation}) : ${nettoyer(h.fait)}`);
  md.push('');
}
md.push('## Ce que le code constate comme manque');
md.push('');
if (manques.length === 0) md.push('Aucun : chaque commandant national a une capacité, au moins trois faits et une mission d\'entrée.');
else for (const m of manques) md.push(`- ${m}`);
md.push('');
writeFileSync('doc/refonte/roster-heros.md', md.join('\n') + '\n');
console.log(`roster-heros.md : ${personnages.length} personnages, ${manques.length} manque(s)`);
