// L'atlas du lore : une page cliquable qui montre le monde, les saisons, les
// 200 épisodes, les personnages, les technologies, et laisse le propriétaire
// prendre chaque décision pour voir ce qu'elle déclenche. Les données viennent
// de `doc/refonte/lore-v2.json` (la proposition de la scénariste) posées sur
// les registres existants (fil, décisions nationales, finales, hors-série),
// qui servent de repli pour tout champ absent.
//   node scripts/lore-html.mjs <sortie.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const sortie = process.argv[2];
if (!sortie) { console.error('usage: node scripts/lore-html.mjs <sortie.html>'); process.exit(1); }
const lire = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fil = lire('doc/refonte/opus1-fil.json').lignes;
const nations = lire('doc/refonte/opus1-nations.json');
const tutos = lire('doc/refonte/opus1-tutoriels-final.json');
const hs = lire('doc/refonte/opus1-hors-serie.json');
const personnagesCanon = lire('content/personnages.json').personnages;
const lore = existsSync('doc/refonte/lore-v2.json') ? lire('doc/refonte/lore-v2.json') : null;
const nomPays = Object.fromEntries(['fr','lu','ch','nl','ma','sn','br','mx','in','jp','au','id','ar','ca','fj','gr','is','ke','mg','mn','na','np','nz','pe'].map((c) => [c, lire(`content/pays/${c}.json`).nom]));

// --- Repli depuis les registres -------------------------------------------
const parId = new Map();
for (const m of nations.missions) parId.set(m.id, m);
for (const t of tutos.tutoriels) parId.set(t.id, t);
for (const f of tutos.finales) parId.set(f.id, f);
for (const e of hs.episodes) parId.set(e.id, e);
const disparitionsPar = new Map((hs.disparitions ?? []).map((d) => [d.ou, d]));
const nomPerso = (cle) => personnagesCanon.find((p) => p.cle === cle)?.nom ?? cle;

function decisionDeRegistre(id) {
  const m = parId.get(id);
  if (!m) return null;
  if (m.choixConsequence) {
    const c = m.choixConsequence;
    return { question: c.retourNarratif ? `Décision · ${m.titre}` : `Décision · ${m.titre}`, options: c.options.map((o) => ({
      cle: o.id, texte: o.texte,
      consequences: o.effet ? [{ cible: o.effet.cible, effet: `${o.effet.type} : ${o.effet.valeur}` }] : [],
      ouvre: hs.episodes.filter((e) => JSON.stringify(e.ouverture ?? '').includes(`"${c.cle}"`) && JSON.stringify(e.ouverture ?? '').includes(`"${o.id}"`)).map((e) => e.id),
      ferme: [],
    })) };
  }
  if (m.choixImpact) {
    const ci = m.choixImpact;
    const choix = Array.isArray(ci.choix) ? ci.choix : String(ci.choix).split(/ ou /i);
    const effets = Array.isArray(ci.effets) ? ci.effets : [ci.effet ?? ''];
    return { question: Array.isArray(ci.choix) ? `Décision · ${m.titre}` : ci.choix, options: choix.map((t, i) => ({ cle: `option_${i + 1}`, texte: t.trim(), consequences: effets[i] ? [{ cible: null, effet: effets[i] }] : (effets[0] ? [{ cible: null, effet: effets[0] }] : []), ouvre: [], ferme: [] })) };
  }
  return null;
}

const episodesRepli = {};
for (const l of fil) {
  const m = parId.get(l.id) ?? {};
  const d = disparitionsPar.get(l.id);
  episodesRepli[l.id] = {
    titre: l.titre, resume: l.description || m.situation || m.apprentissage || '', enjeu: m.objectifGameplay?.conditionVictoire ?? m.objectifGameplay ?? l.objectif ?? '',
    technologies: [], personnages: (m.personnages ?? (m.adversairePrincipal ? [m.adversairePrincipal] : [])),
    decision: decisionDeRegistre(l.id), revelation: (m.revelations ?? [])[0] ?? null,
    disparition: d?.personnage ?? m.disparition ?? null, type: l.type, numero: l.numero, chapitre: l.chapitre, format: l.format, nation: m.nation ?? null,
    ouverture: l.type === 'hors_serie' ? (typeof m.ouverture === 'string' ? m.ouverture : JSON.stringify(m.ouverture ?? '')) : null,
  };
}
const saisonsRepli = [];
{
  let courant = null;
  for (const l of fil) {
    if (l.type === 'hors_serie') { courant?.episodes.push(l.id); continue; }
    const cle = l.saison === 0 ? 'prologue' : l.type === 'finale' ? `globale_${l.saison}` : `nationale_${l.saison}`;
    const titre = l.saison === 0 ? 'Prologue — les dix exercices' : l.type === 'finale' ? `Saison globale ${l.saison} — les finales` : `Saison nationale ${l.saison}`;
    if (!courant || courant.cle !== cle) { courant = { cle, titre, resume: '', episodes: [] }; saisonsRepli.push(courant); }
    courant.episodes.push(l.id);
  }
}

// --- Fusion : lore-v2 par-dessus le repli -----------------------------------
const episodes = {};
for (const [id, r] of Object.entries(episodesRepli)) {
  const v = lore?.episodes?.[id] ?? {};
  episodes[id] = { ...r, ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && val !== null && val !== '')), type: r.type, numero: r.numero, chapitre: r.chapitre, format: r.format, nation: r.nation };
  if (v.decision === null && !r.decision) episodes[id].decision = null;
}
for (const [id, v] of Object.entries(lore?.episodes ?? {})) if (!episodes[id]) episodes[id] = { ...v, type: 'hors_serie', numero: null, chapitre: 'Hors du fil', format: '', nation: null };
const saisons = (lore?.saisons?.length ? lore.saisons : saisonsRepli).map((s) => ({ ...s, episodes: s.episodes.filter((id) => episodes[id]) }));
const monde = lore?.monde ?? { titre: 'Atlas Tournament — le monde (registres actuels)', premisse: 'La proposition de lore v2 n\'est pas encore posée : cette page montre les registres existants. Le propriétaire a tranché le 10 septembre 2026 : c\'est une guerre, une course à l\'énergie et aux nouvelles technologies ; les vilains veulent la fusion.', enjeu: '', ton: '', cequiChange: [], regles: [] };
const factions = lore?.factions ?? [];
const technologies = lore?.technologies ?? [];
const personnages = lore?.personnages ?? personnagesCanon.map((p) => ({ cle: p.cle, nom: p.nom, camp: p.paysCode ?? (p.role === 'civil' ? 'atlas' : 'atlas'), role: p.fonction, veut: p.motivation, craint: p.croyance, sort: 'inconnu', secret: null }));
const fins = lore?.fins ?? [];
const donnees = { monde, factions, technologies, personnages, saisons, episodes, fins, nomPays, genere: new Date().toISOString().slice(0, 10), source: lore ? 'lore-v2.json' : 'registres' };

const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nbDecisions = Object.values(episodes).filter((x) => x.decision).length;
const nbMorts = Object.values(episodes).filter((x) => x.disparition).length;

const html = `<title>L'atlas du lore</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
:root{--fond:#12171c;--panneau:#1a2229;--panneau-2:#212b33;--filet:#2f3b45;--texte:#ebe4d4;--texte-2:#a9b1b8;--energie:#e0a03a;--energie-fond:#3a2d16;--gris:#9aa4ac;--orange:#d9782a;--decision:#58a882;--decision-fond:#1c3329;--mort:#c0656e;--mort-fond:#3a2226;--techno:#7fb7c9;--code:#8c98a3;--choisi:#e0a03a}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--fond:#efe7d6;--panneau:#f7f1e3;--panneau-2:#e8e0cd;--filet:#cbbfa4;--texte:#1b2630;--texte-2:#55606a;--energie:#b06f14;--energie-fond:#f3e2bf;--gris:#5c6670;--orange:#c4661f;--decision:#2f7a5b;--decision-fond:#dcefe4;--mort:#9c3f49;--mort-fond:#f1dadc;--techno:#2f6f73;--code:#5c6670;--choisi:#b06f14}}
:root[data-theme="light"]{--fond:#efe7d6;--panneau:#f7f1e3;--panneau-2:#e8e0cd;--filet:#cbbfa4;--texte:#1b2630;--texte-2:#55606a;--energie:#b06f14;--energie-fond:#f3e2bf;--gris:#5c6670;--orange:#c4661f;--decision:#2f7a5b;--decision-fond:#dcefe4;--mort:#9c3f49;--mort-fond:#f1dadc;--techno:#2f6f73;--code:#5c6670;--choisi:#b06f14}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--texte);font-family:"Source Serif 4",Georgia,serif;font-size:15px;line-height:1.45}
button{font:inherit;color:inherit;cursor:pointer}
.app{display:grid;grid-template-rows:auto 1fr;height:100vh;height:100svh}
header{display:flex;align-items:center;gap:18px;padding:10px 18px;border-bottom:2px solid var(--energie);background:var(--panneau)}
header h1{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:26px;text-transform:uppercase;letter-spacing:.03em;margin:0;line-height:1}
header h1 small{display:block;font-size:11px;letter-spacing:.14em;color:var(--texte-2);font-weight:500}
.onglets{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.onglets button{font-family:"Barlow Condensed",sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.06em;background:transparent;border:1px solid var(--filet);padding:6px 12px;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))}
.onglets button[aria-pressed="true"]{background:var(--energie);color:#12171c;border-color:var(--energie)}
.onglets button:focus-visible{outline:2px solid var(--energie);outline-offset:2px}
.compte{font-family:"Barlow Condensed",sans-serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--texte-2);font-variant-numeric:tabular-nums}
.compte b{color:var(--texte)}
main{display:grid;grid-template-columns:230px minmax(0,1fr) 380px;min-height:0}
main>*{min-height:0;overflow-y:auto}
nav{border-right:1px solid var(--filet);padding:12px 10px;background:var(--panneau)}
nav h2,aside h2,.vue h2{font-family:"Barlow Condensed",sans-serif;font-weight:500;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--texte-2);margin:12px 0 6px}
nav .saison{display:block;width:100%;text-align:left;background:transparent;border:0;border-left:3px solid var(--filet);padding:7px 10px;font-family:"Barlow Condensed",sans-serif;font-size:16px;letter-spacing:.03em}
nav .saison small{display:block;font-family:"Source Serif 4",serif;font-size:12px;color:var(--texte-2)}
nav .saison[aria-pressed="true"]{border-left-color:var(--energie);background:var(--panneau-2)}
nav .action{display:block;width:100%;margin-top:8px;background:transparent;border:1px solid var(--filet);padding:6px 10px;font-size:13px;text-align:left}
.centre{padding:14px 18px}
.liste{display:flex;flex-direction:column;gap:6px}
.ep{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:start;text-align:left;background:var(--panneau);border:1px solid var(--filet);border-left:4px solid var(--filet);padding:8px 10px;width:100%}
.ep.hs{border-left-color:var(--gris);margin-left:18px;width:calc(100% - 18px);background:var(--panneau-2)}
.ep.decision{border-left-color:var(--decision)}.ep.mort{border-left-color:var(--mort)}
.ep[aria-pressed="true"]{outline:2px solid var(--energie);outline-offset:-2px}
.ep .num{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:20px;color:var(--texte-2);font-variant-numeric:tabular-nums;text-align:right}
.ep .num.hs{font-size:12px;letter-spacing:.08em;color:var(--gris);padding-top:5px}
.ep .t{font-weight:600}.ep .r{font-size:13px;color:var(--texte-2);margin-top:2px}
.ep .marques{display:flex;flex-direction:column;gap:3px;align-items:flex-end}
.pastille{font-family:"Barlow Condensed",sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:0;clip-path:polygon(0 0,calc(100% - 4px) 0,100% 4px,100% 100%,4px 100%,0 calc(100% - 4px))}
.pastille.decision{background:var(--decision-fond);color:var(--decision)}.pastille.choisi{background:var(--energie-fond);color:var(--energie)}.pastille.mort{background:var(--mort-fond);color:var(--mort)}.pastille.techno{background:var(--panneau-2);color:var(--techno)}.pastille.ferme{background:var(--mort-fond);color:var(--mort)}.pastille.ouvert{background:var(--decision-fond);color:var(--decision)}
h3.chapitre{font-family:"Barlow Condensed",sans-serif;font-weight:500;font-size:18px;letter-spacing:.04em;color:var(--texte-2);margin:16px 0 6px}
aside{border-left:1px solid var(--filet);padding:14px 16px;background:var(--panneau)}
aside .titre{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:24px;line-height:1.05;text-wrap:balance;margin:0}
aside code{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--code)}
aside p{margin:8px 0}
.option{display:block;width:100%;text-align:left;background:var(--panneau-2);border:1px solid var(--filet);border-bottom-width:3px;padding:9px 12px;margin:6px 0;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))}
.option:active{transform:translateY(2px);border-bottom-width:1px}
.option[aria-pressed="true"]{background:var(--energie);color:#12171c;border-color:var(--energie)}
.option small{display:block;font-size:12px;color:inherit;opacity:.85;margin-top:3px}
.lien{background:transparent;border:0;padding:0;color:var(--techno);text-decoration:underline;text-underline-offset:2px;font-size:inherit}
.puce{display:inline-block;margin:2px 4px 2px 0}
.vue{padding:14px 18px}
.grille{display:flex;flex-wrap:wrap;gap:3px;margin:6px 0 14px}
.case{width:22px;height:22px;border:1px solid var(--filet);background:var(--panneau);font-size:0;position:relative;padding:0}
.case.s0{border-color:var(--texte-2)}.case.s1{background:#2b3a47}.case.s2{background:#3b3a2b}.case.s3{background:#2b3f36}.case.g4,.case.g5,.case.g6{background:#3f2b2b}
.case.hs{border-style:dashed}.case.decision::after{content:"";position:absolute;inset:6px;background:var(--decision)}.case.choisi::after{background:var(--energie)}.case.mort::before{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--mort)}
.case.ferme{opacity:.3}
.case[aria-pressed="true"]{outline:2px solid var(--energie)}
.cartes{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.carte{background:var(--panneau);border:1px solid var(--filet);padding:10px 12px}
.carte h4{font-family:"Barlow Condensed",sans-serif;font-size:18px;margin:0 0 4px}
.carte p{margin:4px 0;font-size:13px}
.carte .meta{font-family:"Barlow Condensed",sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--texte-2)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--filet);vertical-align:top;font-size:13px}th{font-family:"Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;font-weight:500;color:var(--texte-2)}
textarea{width:100%;min-height:120px;background:var(--panneau-2);color:var(--texte);border:1px solid var(--filet);font-family:"IBM Plex Mono",monospace;font-size:12px;padding:8px}
.premisse{max-width:70ch;font-size:16px}
.premisse p{margin:10px 0}
[hidden]{display:none!important}
@media (max-width:980px){main{grid-template-columns:1fr}nav,aside{border:0;border-bottom:1px solid var(--filet)}.app{height:auto}main>*{overflow:visible}header h1 small{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="app">
<header>
<h1><small>Atlas Tournament · proposition de lore v2 · ${e(donnees.genere)} · source ${e(donnees.source)}</small>L'atlas du lore</h1>
<span class="compte"><b>${Object.keys(episodes).length}</b> épisodes · <b>${nbDecisions}</b> décisions · <b>${nbMorts}</b> morts · <b id="cChoix">0</b> choix faits</span>
<div class="onglets" role="tablist">
<button data-onglet="fil" aria-pressed="true">Le fil</button><button data-onglet="monde">Le monde</button><button data-onglet="factions">Factions</button><button data-onglet="technos">Technologies</button><button data-onglet="persos">Personnages</button><button data-onglet="vue">Vue d'ensemble</button>
</div>
</header>
<main>
<nav id="nav"><h2>Saisons</h2><div id="saisons"></div><h2>Mes choix</h2><button class="action" id="effacer">Effacer mes choix</button></nav>
<section class="centre" id="centre"></section>
<aside id="detail"><h2>Épisode</h2><p class="premisse">Choisissez un épisode dans le fil. Les épisodes verts portent une décision ; cliquez une option pour voir ce qu'elle déclenche.</p></aside>
</main>
</div>
<script type="application/json" id="donnees">${JSON.stringify(donnees).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('donnees').textContent);
const CLE = 'atlas:lore-v2:choix';
let choix = {}; try { choix = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch {}
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(choix)); } catch {} };
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const nomP = (c) => (D.personnages.find((p) => p.cle === c) || {}).nom || c;
const nomT = (c) => (D.technologies.find((t) => t.cle === c) || {}).nom || c;
let onglet = 'fil', saisonCle = D.saisons[0]?.cle, selection = null;

// Ce que mes choix ouvrent et ferment.
function etatChoix() {
  const ouverts = new Set(), fermes = new Set(), cibles = new Map();
  for (const [id, cle] of Object.entries(choix)) {
    const ep = D.episodes[id]; const opt = ep?.decision?.options.find((o) => o.cle === cle); if (!opt) continue;
    for (const h of opt.ouvre || []) ouverts.add(h);
    for (const h of opt.ferme || []) fermes.add(h);
    for (const c of opt.consequences || []) if (c.cible) cibles.set(c.cible, [...(cibles.get(c.cible) || []), { de: id, effet: c.effet, option: opt.texte }]);
  }
  return { ouverts, fermes, cibles };
}
function rendreSaisons() {
  const s = document.getElementById('saisons'); s.innerHTML = '';
  for (const sa of D.saisons) {
    const b = document.createElement('button'); b.className = 'saison'; b.setAttribute('aria-pressed', String(sa.cle === saisonCle));
    const nd = sa.episodes.filter((id) => D.episodes[id]?.decision).length, nc = sa.episodes.filter((id) => choix[id]).length;
    b.innerHTML = esc(sa.titre) + '<small>' + sa.episodes.length + ' ép. · ' + nd + ' décisions · ' + nc + ' faites</small>';
    b.onclick = () => { saisonCle = sa.cle; onglet = 'fil'; rendre(); };
    s.appendChild(b);
  }
  document.getElementById('cChoix').textContent = Object.keys(choix).length;
}
function carteEpisode(id, etat) {
  const ep = D.episodes[id]; const b = document.createElement('button');
  const hs = ep.type === 'hors_serie';
  b.className = 'ep' + (hs ? ' hs' : '') + (ep.decision ? ' decision' : '') + (ep.disparition ? ' mort' : '');
  b.setAttribute('aria-pressed', String(selection === id));
  const marques = [];
  if (ep.decision) marques.push('<span class="pastille ' + (choix[id] ? 'choisi' : 'decision') + '">' + (choix[id] ? 'choisi' : 'décision') + '</span>');
  if (ep.disparition) marques.push('<span class="pastille mort">mort · ' + esc(nomP(ep.disparition)) + '</span>');
  if (hs && etat.ouverts.has(id)) marques.push('<span class="pastille ouvert">ouvert par un choix</span>');
  if (etat.fermes.has(id)) marques.push('<span class="pastille ferme">fermé par un choix</span>');
  if (etat.cibles.has(id)) marques.push('<span class="pastille choisi">conséquence reçue</span>');
  if ((ep.technologies || []).length) marques.push('<span class="pastille techno">' + ep.technologies.length + ' techno</span>');
  b.innerHTML = '<span class="num' + (hs ? ' hs' : '') + '">' + (hs ? 'HS' : ep.numero) + '</span><span><span class="t">' + esc(ep.titre) + '</span><span class="r">' + esc(ep.resume) + '</span></span><span class="marques">' + marques.join('') + '</span>';
  b.onclick = () => { selection = id; rendre(); };
  return b;
}
function rendreFil() {
  const c = document.getElementById('centre'); c.innerHTML = '';
  const sa = D.saisons.find((s) => s.cle === saisonCle); if (!sa) return;
  const etat = etatChoix();
  if (sa.resume) { const p = document.createElement('p'); p.className = 'premisse'; p.textContent = sa.resume; c.appendChild(p); }
  const liste = document.createElement('div'); liste.className = 'liste'; let chap = null;
  for (const id of sa.episodes) {
    const ep = D.episodes[id]; if (!ep) continue;
    if (ep.type !== 'hors_serie' && ep.chapitre !== chap) { chap = ep.chapitre; const h = document.createElement('h3'); h.className = 'chapitre'; h.textContent = chap; liste.appendChild(h); }
    liste.appendChild(carteEpisode(id, etat));
  }
  c.appendChild(liste);
}
function rendreDetail() {
  const a = document.getElementById('detail'); const etat = etatChoix();
  if (!selection || !D.episodes[selection]) { a.innerHTML = '<h2>Épisode</h2><p class="premisse">Choisissez un épisode dans le fil. Les épisodes verts portent une décision ; cliquez une option pour voir ce qu\\'elle déclenche.</p>'; return; }
  const ep = D.episodes[selection]; let h = '<h2>' + (ep.type === 'hors_serie' ? 'Hors-série' : 'Épisode ' + ep.numero) + ' · ' + esc(ep.format || '') + '</h2><p class="titre">' + esc(ep.titre) + '</p><code>' + esc(selection) + '</code>';
  h += '<p>' + esc(ep.resume) + '</p>';
  if (ep.enjeu) h += '<p><b>Enjeu.</b> ' + esc(ep.enjeu) + '</p>';
  if (ep.ouverture) h += '<p><b>S\\'ouvre si.</b> ' + esc(ep.ouverture) + '</p>';
  if (ep.revelation) h += '<p><b>Révélation.</b> ' + esc(ep.revelation) + '</p>';
  if (ep.disparition) h += '<p><span class="pastille mort">mort</span> ' + esc(nomP(ep.disparition)) + '</p>';
  if ((ep.personnages || []).length) h += '<h2>Personnages</h2><p>' + ep.personnages.map((p) => '<button class="lien puce" data-perso="' + esc(p) + '">' + esc(nomP(p)) + '</button>').join('') + '</p>';
  if ((ep.technologies || []).length) h += '<h2>Technologies</h2><p>' + ep.technologies.map((t) => '<span class="pastille techno puce">' + esc(nomT(t)) + '</span>').join('') + '</p>';
  const recues = etat.cibles.get(selection) || [];
  if (recues.length) h += '<h2>Conséquences reçues</h2>' + recues.map((r) => '<p><span class="pastille choisi">de ' + esc(D.episodes[r.de]?.titre || r.de) + '</span> ' + esc(r.effet) + '</p>').join('');
  if (ep.decision) {
    h += '<h2>Décision</h2><p>' + esc(ep.decision.question) + '</p>';
    for (const o of ep.decision.options) {
      const pris = choix[selection] === o.cle;
      const detail = [...(o.consequences || []).map((c) => (c.cible ? '→ ' + (D.episodes[c.cible]?.titre || c.cible) + ' : ' : '') + c.effet), ...(o.ouvre || []).map((x) => 'ouvre ' + (D.episodes[x]?.titre || x)), ...(o.ferme || []).map((x) => 'ferme ' + (D.episodes[x]?.titre || x))];
      h += '<button class="option" data-option="' + esc(o.cle) + '" aria-pressed="' + pris + '">' + esc(o.texte) + (detail.length ? '<small>' + detail.map(esc).join(' · ') + '</small>' : '') + '</button>';
    }
    if (choix[selection]) h += '<p><button class="lien" id="defaire">Revenir sur ce choix</button></p>';
  }
  a.innerHTML = h;
  for (const b of a.querySelectorAll('[data-option]')) b.onclick = () => { choix[selection] = b.dataset.option; sauver(); rendre(); };
  const df = a.querySelector('#defaire'); if (df) df.onclick = () => { delete choix[selection]; sauver(); rendre(); };
  for (const b of a.querySelectorAll('[data-perso]')) b.onclick = () => { onglet = 'persos'; document.body.dataset.perso = b.dataset.perso; rendre(); };
}
function rendreMonde() {
  const c = document.getElementById('centre'); const m = D.monde;
  let h = '<div class="premisse"><h2>Le monde</h2><p class="titre" style="font-family:Barlow Condensed,sans-serif;font-size:28px;font-weight:700;line-height:1.05">' + esc(m.titre) + '</p>' + esc(m.premisse).split('\\n').map((p) => '<p>' + p + '</p>').join('');
  if (m.enjeu) h += '<h2>Ce que gagne qui gagne</h2><p>' + esc(m.enjeu) + '</p>';
  if (m.ton) h += '<h2>Ton</h2><p>' + esc(m.ton) + '</p>';
  if ((m.cequiChange || []).length) h += '<h2>Ce qui change</h2><table><thead><tr><th>Avant</th><th>Après</th></tr></thead><tbody>' + m.cequiChange.map((x) => '<tr><td>' + esc(x.avant) + '</td><td>' + esc(x.apres) + '</td></tr>').join('') + '</tbody></table>';
  if ((m.regles || []).length) h += '<h2>Ce qui reste interdit</h2><ul>' + m.regles.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>';
  if ((D.fins || []).length) h += '<h2>Les fins</h2><div class="cartes">' + D.fins.map((f) => '<div class="carte"><h4>' + esc(f.nom) + '</h4><p>' + esc(f.resume) + '</p><p class="meta">condition</p><p>' + esc(f.condition) + '</p>' + (f.aubeDevient ? '<p class="meta">Aube devient</p><p>' + esc(f.aubeDevient) + '</p>' : '') + '</div>').join('') + '</div>';
  c.innerHTML = h + '</div>';
}
function rendreFactions() {
  const c = document.getElementById('centre');
  c.innerHTML = '<h2>Factions</h2><div class="cartes">' + (D.factions.length ? D.factions.map((f) => '<div class="carte"><h4>' + esc(f.nom) + '</h4><p class="meta">' + esc(f.nature || '') + '</p><p><b>But.</b> ' + esc(f.but) + '</p><p><b>Moyens.</b> ' + esc(f.moyens) + '</p>' + (f.chef ? '<p><b>Chef.</b> ' + esc(nomP(f.chef)) + '</p>' : '') + ((f.membres || []).length ? '<p><b>Membres.</b> ' + f.membres.map(nomP).map(esc).join(', ') + '</p>' : '') + ((f.armes || []).length ? '<p><b>Armes.</b> ' + f.armes.map(nomT).map(esc).join(', ') + '</p>' : '') + '</div>').join('') : '<p class="premisse">Les factions arrivent avec la proposition de lore v2.</p>') + '</div>';
}
function rendreTechnos() {
  const c = document.getElementById('centre');
  c.innerHTML = '<h2>La course aux technologies</h2>' + (D.technologies.length ? '<table><thead><tr><th>Technologie</th><th>Camp</th><th>Ce que c\\'est</th><th>En jeu</th><th>Apparaît</th><th>Capturable</th></tr></thead><tbody>' + D.technologies.map((t) => '<tr><td><b>' + esc(t.nom) + '</b></td><td>' + esc(t.camp) + '</td><td>' + esc(t.description) + '</td><td>' + esc(t.effetJeu || '') + '</td><td>' + (t.apparait ? '<button class="lien" data-ep="' + esc(t.apparait) + '">' + esc(D.episodes[t.apparait]?.titre || t.apparait) + '</button>' : '—') + '</td><td>' + (t.capturable ? 'oui' + (t.capturePar ? ' · <button class="lien" data-ep="' + esc(t.capturePar) + '">' + esc(D.episodes[t.capturePar]?.titre || t.capturePar) + '</button>' : '') : 'non') + '</td></tr>').join('') + '</tbody></table>' : '<p class="premisse">Les technologies arrivent avec la proposition de lore v2.</p>');
  for (const b of c.querySelectorAll('[data-ep]')) b.onclick = () => allerA(b.dataset.ep);
}
function rendrePersos() {
  const c = document.getElementById('centre'); const cible = document.body.dataset.perso;
  const groupes = {};
  for (const p of D.personnages) { const g = p.camp || '?'; (groupes[g] = groupes[g] || []).push(p); }
  let h = '<h2>Personnages</h2>';
  for (const [g, liste] of Object.entries(groupes)) {
    h += '<h3 class="chapitre">' + esc(D.nomPays[g] || (g === 'atl' ? 'La Cinquième Manche · les Gris' : g === 'atlas' ? 'Atlas' : g)) + '</h3><div class="cartes">';
    for (const p of liste) {
      const mort = String(p.sort || '').startsWith('meurt:');
      h += '<div class="carte" ' + (p.cle === cible ? 'style="outline:2px solid var(--energie)"' : '') + '><h4>' + esc(p.nom) + (mort ? ' <span class="pastille mort">meurt</span>' : '') + '</h4><p class="meta">' + esc(p.role || '') + '</p>' + (p.veut ? '<p><b>Veut.</b> ' + esc(p.veut) + '</p>' : '') + (p.craint ? '<p><b>Craint.</b> ' + esc(p.craint) + '</p>' : '') + (mort ? '<p><b>Meurt.</b> <button class="lien" data-ep="' + esc(p.sort.slice(6)) + '">' + esc(D.episodes[p.sort.slice(6)]?.titre || p.sort.slice(6)) + '</button></p>' : '') + (p.secret ? '<p><b>Secret (auteur).</b> ' + esc(p.secret) + '</p>' : '') + '</div>';
    }
    h += '</div>';
  }
  c.innerHTML = h; delete document.body.dataset.perso;
  for (const b of c.querySelectorAll('[data-ep]')) b.onclick = () => allerA(b.dataset.ep);
}
function rendreVue() {
  const c = document.getElementById('centre'); const etat = etatChoix();
  let h = '<div class="vue"><h2>Vue d\\'ensemble · ' + Object.keys(D.episodes).length + ' épisodes</h2><p class="premisse">Une case par épisode, dans l\\'ordre du fil. Le carré du milieu marque une décision (or : prise). La barre basse marque une mort. Une case pâle est fermée par un de vos choix ; une case en pointillé est un hors-série.</p>';
  for (const sa of D.saisons) {
    h += '<h3 class="chapitre">' + esc(sa.titre) + '</h3><div class="grille">';
    for (const id of sa.episodes) { const ep = D.episodes[id]; if (!ep) continue;
      const cls = ['case', sa.cle === 'prologue' ? 's0' : sa.cle.startsWith('nationale') ? 's' + sa.cle.slice(-1) : 'g' + sa.cle.slice(-1), ep.type === 'hors_serie' ? 'hs' : '', ep.decision ? 'decision' : '', choix[id] ? 'choisi' : '', ep.disparition ? 'mort' : '', etat.fermes.has(id) ? 'ferme' : ''].filter(Boolean).join(' ');
      h += '<button class="' + cls + '" data-ep="' + esc(id) + '" title="' + esc((ep.numero ? ep.numero + ' · ' : 'HS · ') + ep.titre) + '" aria-pressed="' + (selection === id) + '">' + esc(ep.titre) + '</button>';
    }
    h += '</div>';
  }
  const faits = Object.entries(choix).map(([id, cle]) => { const ep = D.episodes[id]; const o = ep?.decision?.options.find((x) => x.cle === cle); return ep && o ? { id, ep, o } : null; }).filter(Boolean);
  h += '<h2>Mes choix (' + faits.length + ')</h2>' + (faits.length ? '<table><thead><tr><th>Épisode</th><th>Choix</th><th>Ce que ça déclenche</th></tr></thead><tbody>' + faits.map((f) => '<tr><td><button class="lien" data-ep="' + esc(f.id) + '">' + esc(f.ep.titre) + '</button></td><td>' + esc(f.o.texte) + '</td><td>' + [...(f.o.consequences || []).map((x) => (x.cible ? (D.episodes[x.cible]?.titre || x.cible) + ' : ' : '') + x.effet), ...(f.o.ouvre || []).map((x) => 'ouvre ' + (D.episodes[x]?.titre || x)), ...(f.o.ferme || []).map((x) => 'ferme ' + (D.episodes[x]?.titre || x))].map(esc).join('<br>') + '</td></tr>').join('') + '</tbody></table>' : '<p class="premisse">Aucun choix encore : parcourez le fil et cliquez une option.</p>');
  const morts = Object.entries(D.episodes).filter(([, ep]) => ep.disparition);
  h += '<h2>Les morts</h2><table><tbody>' + morts.map(([id, ep]) => '<tr><td>' + esc(nomP(ep.disparition)) + '</td><td><button class="lien" data-ep="' + esc(id) + '">' + esc(ep.titre) + '</button></td><td>' + (etat.fermes.has(id) ? 'fermé par vos choix' : etat.ouverts.has(id) ? 'ouvert par vos choix' : ep.type === 'hors_serie' ? 'hors-série' : 'trame principale') + '</td></tr>').join('') + '</tbody></table>';
  h += '<h2>Exporter mes choix</h2><textarea readonly>' + esc(JSON.stringify(choix, null, 1)) + '</textarea></div>';
  c.innerHTML = h;
  for (const b of c.querySelectorAll('[data-ep]')) b.onclick = () => allerA(b.dataset.ep);
}
function allerA(id) { selection = id; const sa = D.saisons.find((s) => s.episodes.includes(id)); if (sa) saisonCle = sa.cle; onglet = 'fil'; rendre(); const el = document.querySelector('.ep[aria-pressed="true"]'); if (el) el.scrollIntoView({ block: 'center' }); }
function rendre() {
  for (const b of document.querySelectorAll('[data-onglet]')) b.setAttribute('aria-pressed', String(b.dataset.onglet === onglet));
  rendreSaisons();
  ({ fil: rendreFil, monde: rendreMonde, factions: rendreFactions, technos: rendreTechnos, persos: rendrePersos, vue: rendreVue })[onglet]();
  rendreDetail();
}
for (const b of document.querySelectorAll('[data-onglet]')) b.onclick = () => { onglet = b.dataset.onglet; rendre(); };
document.getElementById('effacer').onclick = () => { choix = {}; sauver(); rendre(); };
rendre();
</script>
`;
writeFileSync(sortie, html);
console.log(`${sortie} : ${Object.keys(episodes).length} épisodes, ${nbDecisions} décisions, ${nbMorts} morts, source ${donnees.source}`);
