// La page de lecture du fil, générée depuis `doc/refonte/opus1-fil.json`
// (produit par `fil-opus1.mjs --json`). Sortie : chemin passé en argument.
import { readFileSync, writeFileSync } from 'node:fs';
const sortie = process.argv[2];
if (!sortie) { console.error('usage: node scripts/fil-opus1-html.mjs <sortie.html>'); process.exit(1); }
const { lignes } = JSON.parse(readFileSync('doc/refonte/opus1-fil.json', 'utf8'));
const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const saisons = [];
let courant = null;
for (const l of lignes) {
  if (l.type === 'hors_serie') { courant?.lignes.push(l); continue; }
  const cle = l.saison === 0 ? 'Prologue' : l.type === 'finale' ? `Saison globale ${l.saison}` : `Saison nationale ${l.saison}`;
  if (!courant || courant.cle !== cle) { courant = { cle, lignes: [], chapitres: [] }; saisons.push(courant); }
  courant.lignes.push(l);
}
const disparitions = lignes.filter((l) => l.disparition);
const nbHs = lignes.filter((l) => l.type === 'hors_serie').length;
const nbPrincipaux = lignes.length - nbHs;

const ligneHtml = (l) => {
  const hs = l.type === 'hors_serie';
  const classes = [hs ? 'hs' : l.type, l.disparition ? 'deuil' : ''].join(' ');
  const extra = hs ? (l.ouverture ? `<span class="etiquette">Ouvert par</span> ${e(l.ouverture)}` : '') : (l.choix ? `<span class="etiquette">Choix</span> ${e(l.choix)}` : '');
  return `<tr class="${classes}" data-type="${hs ? 'hs' : 'principal'}" data-deuil="${l.disparition ? '1' : '0'}">
<td class="num">${hs ? '<span class="hs-marque" title="Hors-série">HS</span>' : l.numero}</td>
<td class="titre"><strong>${e(l.titre)}</strong>${l.disparition ? ` <span class="deuil-marque" title="Disparition">▭ ${e(l.disparition)}</span>` : ''}<br><code>${e(l.id)}</code></td>
<td class="format">${e(l.format)}</td>
<td class="desc">${e(l.description)}${l.objectif && l.objectif !== l.description ? `<span class="objectif">${e(l.objectif)}</span>` : ''}</td>
<td class="perso">${(l.personnages ?? []).map(e).join('<br>')}</td>
<td class="extra">${extra}</td>
</tr>`;
};

let corps = '';
for (const s of saisons) {
  let chapitre = null;
  let tableOuverte = false;
  corps += `<section id="${e(s.cle.replace(/\s+/g, '-').toLowerCase())}">
<h2>${e(s.cle)}</h2>`;
  for (const l of s.lignes) {
    if (l.type !== 'hors_serie' && l.chapitre !== chapitre) {
      if (tableOuverte) corps += '</tbody></table></div>';
      chapitre = l.chapitre;
      corps += `<h3>${e(chapitre)}</h3><div class="defile"><table><thead><tr><th>N°</th><th>Épisode</th><th>Format</th><th>Description courte</th><th>Personnages</th><th>Choix · ouverture</th></tr></thead><tbody>`;
      tableOuverte = true;
    }
    corps += ligneHtml(l);
  }
  if (tableOuverte) corps += '</tbody></table></div>';
  corps += '</section>';
}

const nav = saisons.map((s) => `<a href="#${e(s.cle.replace(/\s+/g, '-').toLowerCase())}">${e(s.cle)}<small>${s.lignes.filter((l) => l.type !== 'hors_serie').length} ép. · ${s.lignes.filter((l) => l.type === 'hors_serie').length} HS</small></a>`).join('');

const html = `<title>Le fil de l'opus 1</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
:root{--papier:#efe7d6;--papier-2:#e4d9c2;--encre:#1b2630;--encre-2:#4a5560;--filet:#cbbfa4;--hs:#4f6b7a;--hs-fond:#e6e8e4;--vert:#2f7a5b;--finale:#2f6f73;--deuil:#6c6a75;--deuil-fond:#e6e2e7;--code:#5c6670}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--papier:#161d24;--papier-2:#1f2831;--encre:#ece5d5;--encre-2:#b7ad99;--filet:#3a4652;--hs:#9fb6c2;--hs-fond:#232c31;--vert:#6cc59a;--finale:#7fc3c7;--deuil:#a9a6b3;--deuil-fond:#2b2932;--code:#9aa6b2}}
:root[data-theme="dark"]{--papier:#161d24;--papier-2:#1f2831;--encre:#ece5d5;--encre-2:#b7ad99;--filet:#3a4652;--hs:#9fb6c2;--hs-fond:#232c31;--vert:#6cc59a;--finale:#7fc3c7;--deuil:#a9a6b3;--deuil-fond:#2b2932;--code:#9aa6b2}
body{margin:0;background:var(--papier);color:var(--encre);font-family:"Source Serif 4",Georgia,serif;font-size:15px;line-height:1.45}
.page{display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px;max-width:1440px;margin:0 auto;padding:32px 28px 80px}
header{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:3px solid var(--encre);padding-bottom:14px}
h1{font-family:"Barlow Condensed","Arial Narrow",sans-serif;font-weight:700;font-size:44px;line-height:.95;margin:0;letter-spacing:.01em;text-transform:uppercase}
h1 small{display:block;font-size:14px;letter-spacing:.14em;color:var(--encre-2);margin-bottom:6px}
.compte{display:flex;gap:22px;font-family:"Barlow Condensed",sans-serif;font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--encre-2);font-variant-numeric:tabular-nums}
.compte b{display:block;font-size:30px;color:var(--encre);line-height:1}
.compte .hs b{color:var(--hs)}.compte .deuil b{color:var(--deuil)}
nav{position:sticky;top:16px;align-self:start;display:flex;flex-direction:column;gap:6px}
nav a{font-family:"Barlow Condensed",sans-serif;font-weight:500;font-size:17px;text-transform:uppercase;letter-spacing:.05em;color:var(--encre);text-decoration:none;padding:8px 10px;border-left:3px solid var(--filet)}
nav a:hover,nav a:focus-visible{border-left-color:var(--hs);outline:none;background:var(--papier-2)}
nav a small{display:block;font-family:"Source Serif 4",serif;font-size:12px;text-transform:none;letter-spacing:0;color:var(--encre-2)}
.filtres{margin-top:18px;padding-top:14px;border-top:1px solid var(--filet);display:flex;flex-direction:column;gap:8px;font-size:13px}
.filtres label{display:flex;gap:8px;align-items:center;cursor:pointer}
main{min-width:0}
h2{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:30px;text-transform:uppercase;letter-spacing:.03em;margin:34px 0 4px;padding-top:12px;border-top:1px solid var(--filet);text-wrap:balance}
section:first-child h2{margin-top:0;border-top:0}
h3{font-family:"Barlow Condensed",sans-serif;font-weight:500;font-size:20px;letter-spacing:.04em;margin:18px 0 8px;color:var(--encre-2)}
.defile{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:900px}
th{font-family:"Barlow Condensed",sans-serif;font-weight:500;font-size:13px;letter-spacing:.1em;text-transform:uppercase;text-align:left;color:var(--encre-2);padding:6px 10px;border-bottom:2px solid var(--encre)}
td{vertical-align:top;padding:9px 10px;border-bottom:1px solid var(--filet)}
td.num{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:20px;text-align:right;width:40px;font-variant-numeric:tabular-nums;color:var(--encre-2)}
td.titre{width:230px}td.titre strong{font-weight:600}
td.titre code{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--code)}
td.format{font-family:"IBM Plex Mono",monospace;font-size:12px;width:40px;white-space:nowrap}
td.desc{max-width:460px}td.desc .objectif{display:block;font-style:italic;color:var(--encre-2);font-size:13px;margin-top:3px}
td.perso{width:150px;font-size:13px}td.extra{width:220px;font-size:13px;color:var(--encre-2)}
.etiquette{font-family:"Barlow Condensed",sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--vert);margin-right:4px}
tr.finale td.num{color:var(--finale)}
tr.hs td{background:var(--hs-fond)}
tr.hs td.num{padding-left:0}
.hs-marque{display:inline-block;font-family:"Barlow Condensed",sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;color:#fff;background:var(--hs);padding:2px 6px;clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))}
.hs .etiquette{color:var(--hs)}
tr.deuil td.titre{box-shadow:inset 4px 0 0 var(--deuil)}
.deuil-marque{display:inline-block;font-family:"Barlow Condensed",sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--deuil);background:var(--deuil-fond);padding:1px 6px;margin-left:4px}
body[data-filtre="hs"] tr[data-type="principal"]:not(.deuil){display:none}
body[data-filtre="deuil"] tr[data-deuil="0"]{display:none}
.note{font-size:13px;color:var(--encre-2);max-width:68ch;margin:10px 0 0}
@media (max-width:860px){.page{grid-template-columns:1fr;gap:16px}nav{position:static;flex-direction:row;flex-wrap:wrap}nav a{border-left:0;border-bottom:3px solid var(--filet)}.filtres{width:100%}}
@media (prefers-reduced-motion:no-preference){nav a{transition:border-color .15s}}
</style>
<div class="page">
<header>
<h1><small>Atlas Tournament · Ronde XIV</small>Le fil de l'opus 1</h1>
<div class="compte"><span><b>${nbPrincipaux}</b>épisodes</span><span class="hs"><b>${nbHs}</b>hors-série</span><span class="deuil"><b>${disparitions.length}</b>disparitions</span></div>
<p class="note">Un numéro est une position dans la trame principale, de 1 à ${nbPrincipaux}. Un hors-série n'en a pas : il s'insère après l'épisode qui l'ouvre, et sa colonne de droite dit à quelle condition. Une plaque posée à plat (▭) marque l'épisode où un chef de nation alliée disparaît, hors terrain ; le hors-série est en ardoise, jamais en orange, qui est la couleur du matériel à l'essai. Généré depuis les registres de <code>doc/refonte/</code>.</p>
</header>
<nav>${nav}
<div class="filtres"><label><input type="radio" name="f" value="tout" checked> Tout le fil</label><label><input type="radio" name="f" value="hs"> Hors-série et disparitions</label><label><input type="radio" name="f" value="deuil"> Les disparitions seules</label></div>
</nav>
<main>${corps}</main>
</div>
<script>
for(const r of document.querySelectorAll('input[name=f]')) r.addEventListener('change',()=>{document.body.dataset.filtre=r.value;});
</script>
`;
writeFileSync(sortie, html);
console.log(`${sortie} : ${lignes.length} lignes`);
