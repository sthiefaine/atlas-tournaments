/**
 * Le HUD en **HTML**, posé par-dessus le canvas (`BRIEF.md`, direction artistique
 * révisée : « Le HUD est une surcouche HTML »).
 *
 * Pourquoi sortir le HUD du canvas : les neuf langues du jeu n'ont pas la même
 * police ni la même métrique, et un texte dessiné au pinceau n'est ni
 * sélectionnable, ni lisible par un lecteur d'écran, ni redimensionnable par le
 * navigateur. Le DOM règle les trois d'un coup. Le HUD canvas (`hud.ts`) reste
 * disponible pour l'aperçu d'administration et le rendu hors écran.
 *
 * Les trois règles d'i18n de `hud.ts` restent en vigueur : **aucun texte en dur**
 * (tout passe par `t()`), `Intl` pour les nombres, et jamais de débordement — ici
 * c'est le CSS qui tronque (`text-overflow`) au lieu de `measureText`.
 *
 * Le HUD ne décide de rien : il appelle l'`ApiHud` que `jeu.ts` lui donne.
 */

import type { Catalogue, EtatPartie } from '../engine/index';
import { pvAffiches, terrainLogique } from '../engine/index';
import { nombre as nombreIntl } from '../i18n/index';
import type { CampId, Case, CleUnite, Meteo, Silhouette } from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { Phase } from './controleur';
import {
  libelleMeteo, libellePhase, libelleSaison, nomCommandant, nomTerrain, nomUnite,
  type OptionMenu,
} from './hud';
import { paletteDe } from './palettes';
import type { PointVue } from './rendu';
import { dessinerUnite } from './sprites/index';

/** Tout ce que le HUD lit : l'état, la vue d'interaction et la langue. */
export interface VueJeu {
  etat: EtatPartie;
  catalogue: Catalogue;
  ambiance: Ambiance;
  locale: string;
  /** Camp du joueur humain. */
  camp: CampId;
  phase: Phase;
  curseur: Case | null;
  selection: string | null;
  menu: { ancre: Case; options: readonly OptionMenu[] } | null;
  production: { batiment: Case; unites: readonly CleUnite[] } | null;
  attenteIa: boolean;
  /** Message éphémère, déjà traduit. */
  annonce: string | null;
}

/** Ce que le HUD peut demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiHud {
  vue(): VueJeu;
  t(cle: string, params?: Record<string, string | number>): string;
  finTour(): void;
  choisirSuite(id: string): void;
  choisirProduction(cle: CleUnite): void;
  jouerPouvoir(niveau: 'normal' | 'super'): void;
  annuler(): void;
  recommencer(): void;
  /** Position d'écran du centre d'une case : sert à ancrer le menu d'ordres. */
  versEcran(c: Case): PointVue | null;
}

/** Ce que `monterHudHtml` rend à son hôte. */
export interface HudHtml {
  /** Reconstruit le HUD depuis la vue courante. */
  rafraichir(): void;
  demonter(): void;
}

/** Échappe un texte destiné à du HTML : le HUD n'injecte jamais de balise. */
function ech(texte: string): string {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** La feuille de style du HUD, injectée une seule fois par document. */
const STYLE = `
.atlas-hud{position:absolute;inset:0;pointer-events:none;font:14px/1.35 system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.atlas-hud *{box-sizing:border-box}
.atlas-hud .p{position:absolute;pointer-events:auto;background:rgba(16,20,29,.86);backdrop-filter:blur(9px);border:1px solid rgba(255,255,255,.09);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);overflow:hidden}
.atlas-hud .p>.bord{position:absolute;left:0;top:0;bottom:0;width:4px}
.atlas-hud .in{padding:10px 14px 11px 16px}
.atlas-hud .tt{font-weight:650;font-size:15px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atlas-hud .sb{font-size:12px;color:#9aa4b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.atlas-hud .partie{left:12px;top:12px;min-width:186px;max-width:320px}
.atlas-hud .bulletin{right:12px;top:12px;min-width:216px;max-width:340px}
.atlas-hud .bulletin .in{display:flex;gap:11px;align-items:flex-start;padding-left:14px}
.atlas-hud .bulletin svg{flex:0 0 auto;margin-top:2px}
.atlas-hud .jauge{right:12px;top:100px;width:224px}
.atlas-hud .jauge button{all:unset;display:block;width:100%;cursor:pointer}
.atlas-hud .barre{height:9px;border-radius:5px;background:rgba(255,255,255,.13);overflow:hidden;margin:7px 0 5px}
.atlas-hud .barre i{display:block;height:100%;border-radius:5px;transition:width .25s ease}
.atlas-hud .inspect{left:12px;bottom:12px;min-width:224px;max-width:390px}
.atlas-hud .inspect .in{display:flex;gap:10px;align-items:center;padding:9px 14px 9px 16px}
.atlas-hud .inspect canvas{flex:0 0 auto;width:46px;height:46px}
.atlas-hud .stats{font-size:12px;color:#b8c0d0;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atlas-hud .ordres{width:172px;padding:6px}
.atlas-hud .ordres button{all:unset;display:block;box-sizing:border-box;width:100%;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:14px}
.atlas-hud .ordres button:hover{background:rgba(255,255,255,.10)}
.atlas-hud .ordres button:focus-visible{outline:2px solid #7fb6ff;outline-offset:-2px}
.atlas-hud .fintour{right:12px;bottom:12px}
.atlas-hud .fintour button{all:unset;display:block;padding:12px 26px;border-radius:11px;font-weight:650;cursor:pointer;text-align:center;min-width:150px}
.atlas-hud .fintour button[disabled]{background:rgba(74,80,95,.85)!important;color:rgba(255,255,255,.5);cursor:default}
.atlas-hud .attente{left:50%;top:12px;transform:translateX(-50%);padding:0}
.atlas-hud .annonce{left:50%;bottom:104px;transform:translateX(-50%);max-width:70%}
.atlas-hud .voile{position:absolute;inset:0;pointer-events:auto;background:rgba(7,9,16,.72);display:flex;align-items:center;justify-content:center}
.atlas-hud .modale{position:relative;pointer-events:auto;background:rgba(16,20,29,.95);border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.6);width:330px;max-height:82%;display:flex;flex-direction:column;overflow:hidden}
.atlas-hud .modale h2{margin:0;padding:16px 18px 8px;font-size:17px;font-weight:650}
.atlas-hud .liste{overflow:auto;padding:2px 12px 6px;flex:1 1 auto}
.atlas-hud .liste button{all:unset;display:flex;box-sizing:border-box;width:100%;gap:10px;align-items:center;padding:7px 10px;border-radius:9px;cursor:pointer;margin-bottom:4px;background:rgba(255,255,255,.05)}
.atlas-hud .liste button:hover{background:rgba(255,255,255,.12)}
.atlas-hud .liste button[disabled]{opacity:.42;cursor:default}
.atlas-hud .liste canvas{flex:0 0 auto;width:38px;height:38px}
.atlas-hud .liste .cout{font-size:12px;color:#9aa4b8}
.atlas-hud .pied{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px 14px}
.atlas-hud .pied button{all:unset;padding:9px 18px;border-radius:9px;cursor:pointer;font-weight:600;background:rgba(255,255,255,.11)}
.atlas-hud .fin{text-align:center;padding:26px 24px 22px}
.atlas-hud .fin .grand{font-size:26px;font-weight:700;letter-spacing:-.01em}
`;

/** Injecte la feuille de style du HUD si le document ne l'a pas encore. */
function poserStyle(doc: Document): void {
  if (doc.getElementById('atlas-hud-style')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-hud-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Icône de météo : un petit SVG, dessiné par code comme le reste du jeu. */
function iconeMeteo(m: Meteo): string {
  const s = (contenu: string): string => `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">${contenu}</svg>`;
  const nuage = '<path d="M6 17h13a4 4 0 0 0 .3-8 6 6 0 0 0-11.5 1.4A3.4 3.4 0 0 0 6 17z" fill="#c3cbd8"/>';
  switch (m) {
    case 'clair':
      return s('<circle cx="13" cy="13" r="5.4" fill="#ffd66b"/><g stroke="#ffd66b" stroke-width="1.7" stroke-linecap="round"><path d="M13 2v3M13 21v3M2 13h3M21 13h3M5.2 5.2l2.1 2.1M18.7 18.7l2.1 2.1M20.8 5.2l-2.1 2.1M7.3 18.7l-2.1 2.1"/></g>');
    case 'pluie':
      return s(`${nuage}<g stroke="#7fb6ff" stroke-width="2" stroke-linecap="round"><path d="M9 19l-1.4 4M14 19l-1.4 4M19 19l-1.4 4"/></g>`);
    case 'tempete':
      return s(`${nuage}<path d="M13.5 18l-4.5 5h3.4l-1.4 4 5.5-6h-3.3l1.6-3z" fill="#ffd66b"/>`);
    case 'neige':
      return s(`${nuage}<g fill="#ffffff"><circle cx="9" cy="21" r="1.7"/><circle cx="14" cy="22.5" r="1.7"/><circle cx="19" cy="21" r="1.7"/></g>`);
    case 'brouillard':
      return s('<g stroke="#ccd7e0" stroke-width="2.6" stroke-linecap="round"><path d="M4 8h18M4 13h18M4 18h13"/></g>');
    case 'canicule':
      return s('<circle cx="13" cy="10" r="5" fill="#ff9a3c"/><g stroke="#ff9a3c" stroke-width="2" stroke-linecap="round" fill="none"><path d="M4 18c3-3 6 3 9 0s6 3 9 0M4 23c3-3 6 3 9 0s6 3 9 0"/></g>');
    default:
      return s('');
  }
}

/** Une vignette d'unité à peindre après insertion : le sprite vectoriel partagé. */
interface Vignette { id: string; silhouette: Silhouette; camp: CampId; taille: number }

/**
 * Monte le HUD HTML dans un conteneur (le même que le canvas, en position
 * relative). Rend `rafraichir()` et `demonter()`.
 */
export function monterHudHtml(conteneur: HTMLElement, api: ApiHud): HudHtml {
  const doc = conteneur.ownerDocument;
  poserStyle(doc);
  const racine = doc.createElement('div');
  racine.className = 'atlas-hud';
  racine.setAttribute('data-hud', 'html');
  conteneur.appendChild(racine);

  let vignettes: Vignette[] = [];

  // -------------------------------------------------------------------------
  // Panneaux
  // -------------------------------------------------------------------------

  function panneauPartie(v: VueJeu): string {
    const camp = v.etat.camps.find((c) => c.id === v.etat.campCourant);
    const journee = api.t('hud.journee', { n: Math.max(1, v.etat.journee) });
    const fonds = api.t('hud.fonds', { n: nombreIntl(v.locale, camp?.fonds ?? 0) });
    const bord = paletteDe(v.etat.campCourant).main;
    return `<div class="p partie" role="group" aria-label="${ech(api.t('hud.partie_en_cours'))}">`
      + `<span class="bord" style="background:${bord}"></span>`
      + `<div class="in"><div class="tt">${ech(journee)}</div><div class="sb">${ech(fonds)}</div></div></div>`;
  }

  function panneauBulletin(v: VueJeu): string {
    // Le Bulletin annonce **ce que le joueur voit** : il lit l'ambiance affichée,
    // qu'un aperçu peut avoir forcée, et non le climat brut de l'état.
    const a = v.ambiance;
    const c = v.etat.climat;
    const ligne1 = `${libelleSaison(api.t, a.saison)} · ${libellePhase(api.t, a.phase)}`;
    const ligne2 = libelleMeteo(api.t, a.meteo);
    const ligne3 = api.t('hud.bulletin', {
      j1: libelleMeteo(api.t, c.previsions[0]),
      j2: libelleMeteo(api.t, c.previsions[1]),
    });
    return `<div class="p bulletin" role="group" aria-label="${ech(api.t('hud.bulletin_titre'))}">`
      + `<div class="in">${iconeMeteo(a.meteo)}<div style="min-width:0">`
      + `<div class="tt">${ech(ligne1)}</div><div class="sb">${ech(ligne2)}</div>`
      + `<div class="sb">${ech(ligne3)}</div></div></div></div>`;
  }

  function panneauJauge(v: VueJeu): string {
    const camp = v.etat.camps.find((c) => c.id === v.camp);
    if (!camp) return '';
    const pal = paletteDe(v.camp);
    const nom = nomCommandant(v.locale, camp.commandantCle) || api.t('hud.commandant');
    const part = camp.jaugeMax > 0 ? Math.min(1, camp.jauge / camp.jaugeMax) : 0;
    const pleine = part >= 1;
    return `<div class="p jauge"><span class="bord" style="background:${pal.main}"></span>`
      + `<button type="button" data-action="pouvoir"><div class="in">`
      + `<div class="tt">${ech(nom)}</div>`
      + `<div class="barre"><i style="width:${Math.max(3, part * 100).toFixed(1)}%;background:${pleine ? '#ffd66b' : pal.light}"></i></div>`
      + `<div class="sb">${ech(api.t(pleine ? 'hud.pouvoir_pret' : 'hud.jauge_pouvoir'))}</div>`
      + `</div></button></div>`;
  }

  function panneauInspection(v: VueJeu): string {
    const c = v.curseur;
    if (!c) return '';
    const terrain = terrainLogique(v.etat, v.catalogue, c);
    if (terrain === null) return '';
    const unite = v.etat.unites.find((u) => !u.dansTransport && u.x === c.x && u.y === c.y);
    const type = unite ? v.catalogue.unites[unite.type] : undefined;
    const fiche = v.catalogue.terrains[terrain];
    const defense = api.t('hud.defense', { n: fiche?.defense ?? 0 });
    const titre = unite && type
      ? nomUnite(v.locale, v.catalogue, unite.type)
      : nomTerrain(v.locale, v.catalogue, terrain);
    const sousTitre = unite
      ? `${nomTerrain(v.locale, v.catalogue, terrain)} · ${defense}`
      : defense;
    const lignes: string[] = [];
    if (unite && type) {
      lignes.push(api.t('hud.points_de_vie', { n: pvAffiches(unite.pv) }));
      lignes.push(api.t('hud.mouvement', { n: type.mouvement }));
      if (unite.munitions !== null) lignes.push(api.t('hud.munitions', { n: unite.munitions }));
      if (unite.carburant !== null) lignes.push(api.t('hud.carburant', { n: unite.carburant }));
    }
    let icone = '';
    if (unite && type) {
      const id = `vg${vignettes.length}`;
      vignettes.push({ id, silhouette: type.silhouette, camp: unite.camp, taille: 46 });
      icone = `<canvas data-vignette="${id}" width="46" height="46"></canvas>`;
    }
    const bord = unite ? paletteDe(unite.camp).main : paletteDe(null).main;
    return `<div class="p inspect" role="group" aria-label="${ech(api.t('hud.panneau_unite'))}">`
      + `<span class="bord" style="background:${bord}"></span>`
      + `<div class="in">${icone}<div style="min-width:0">`
      + `<div class="tt">${ech(titre)}</div><div class="sb">${ech(sousTitre)}</div>`
      + (lignes.length > 0 ? `<div class="stats">${ech(lignes.join(' · '))}</div>` : '')
      + `</div></div></div>`;
  }

  function panneauOrdres(v: VueJeu): string {
    if (!v.menu || v.menu.options.length === 0) return '';
    const ancre = api.versEcran(v.menu.ancre);
    const largeur = racine.clientWidth || 800;
    const hauteur = racine.clientHeight || 600;
    const h = v.menu.options.length * 36 + 12;
    const x = Math.max(12, Math.min(largeur - 184, (ancre?.x ?? largeur / 2) + 34));
    const y = Math.max(12, Math.min(hauteur - h - 12, (ancre?.y ?? hauteur / 2) - h / 2));
    const boutons = v.menu.options.map((o) => (
      `<button type="button" data-action="suite" data-valeur="${ech(o.id)}"${o.disponible ? '' : ' disabled'}>`
      + `${ech(api.t(o.cle))}</button>`
    )).join('');
    return `<div class="p ordres" role="menu" aria-label="${ech(api.t('hud.menu_ordres'))}" `
      + `style="left:${Math.round(x)}px;top:${Math.round(y)}px">${boutons}</div>`;
  }

  function panneauFinTour(v: VueJeu): string {
    const actif = !v.attenteIa && !v.etat.partie.terminee && v.etat.campCourant === v.camp;
    const pal = paletteDe(v.camp);
    return `<div class="fintour" style="position:absolute;right:12px;bottom:12px;pointer-events:auto">`
      + `<button type="button" data-action="fin_tour"${actif ? '' : ' disabled'} `
      + `style="background:${pal.main};box-shadow:0 8px 22px rgba(0,0,0,.4)">`
      + `${ech(api.t('hud.fin_de_tour'))}</button></div>`;
  }

  function panneauAttente(v: VueJeu): string {
    if (!v.attenteIa) return '';
    const pal = paletteDe(v.camp === 0 ? 1 : 0);
    return `<div class="p attente"><span class="bord" style="background:${pal.main}"></span>`
      + `<div class="in"><div class="tt">${ech(api.t('hud.tour_adverse'))}</div></div></div>`;
  }

  function panneauAnnonce(v: VueJeu): string {
    if (!v.annonce) return '';
    return `<div class="p annonce"><div class="in"><div class="tt">${ech(v.annonce)}</div></div></div>`;
  }

  function modaleProduction(v: VueJeu): string {
    if (!v.production) return '';
    const fonds = v.etat.camps.find((c) => c.id === v.etat.campCourant)?.fonds ?? 0;
    const lignes = v.production.unites.map((cle) => {
      const type = v.catalogue.unites[cle];
      if (!type) return '';
      const abordable = type.cout <= fonds;
      const id = `vg${vignettes.length}`;
      vignettes.push({ id, silhouette: type.silhouette, camp: v.etat.campCourant, taille: 38 });
      return `<button type="button" data-action="produire" data-valeur="${ech(cle)}"${abordable ? '' : ' disabled'}>`
        + `<canvas data-vignette="${id}" width="38" height="38"></canvas><span style="min-width:0">`
        + `<span class="tt" style="display:block">${ech(nomUnite(v.locale, v.catalogue, cle))}</span>`
        + `<span class="cout">${ech(nombreIntl(v.locale, type.cout))}</span></span></button>`;
    }).join('');
    return `<div class="voile" data-action="fermer"><div class="modale" data-arret="1">`
      + `<h2>${ech(api.t('menu.production'))}</h2><div class="liste">${lignes}</div>`
      + `<div class="pied"><button type="button" data-action="fermer">${ech(api.t('menu.retour'))}</button></div>`
      + `</div></div>`;
  }

  function ecranFin(v: VueJeu): string {
    const fin = v.etat.partie;
    if (!fin.terminee) return '';
    const cle = fin.nul ? 'hud.match_nul'
      : fin.vainqueur === v.camp ? 'combat.manche_gagnee' : 'combat.manche_perdue';
    const pal = paletteDe(fin.vainqueur ?? null);
    return `<div class="voile"><div class="modale" style="width:390px"><div class="fin">`
      + `<div class="grand">${ech(api.t(cle))}</div>`
      + `<div class="sb" style="margin-top:6px">${ech(api.t('hud.journee', { n: Math.max(1, v.etat.journee) }))}</div>`
      + `</div><div class="pied" style="justify-content:center">`
      + `<button type="button" data-action="rejouer" style="background:${pal.main}">${ech(api.t('hud.rejouer'))}</button>`
      + `</div></div></div>`;
  }

  // -------------------------------------------------------------------------
  // Rendu et interaction
  // -------------------------------------------------------------------------

  function peindreVignettes(): void {
    for (const vg of vignettes) {
      const el = racine.querySelector(`canvas[data-vignette="${vg.id}"]`);
      if (!(el instanceof HTMLCanvasElement)) continue;
      const ratio = Math.min(2, doc.defaultView?.devicePixelRatio ?? 1);
      el.width = Math.round(vg.taille * ratio);
      el.height = Math.round(vg.taille * ratio);
      const g = el.getContext('2d');
      if (!g) continue;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, vg.taille, vg.taille);
      g.save();
      g.translate(vg.taille / 2, vg.taille / 2 + vg.taille * 0.1);
      const echelle = (vg.taille / 64) * 0.92;
      g.scale(echelle, echelle);
      dessinerUnite(g, vg.silhouette, paletteDe(vg.camp));
      g.restore();
    }
  }

  function rafraichir(): void {
    const v = api.vue();
    vignettes = [];
    racine.innerHTML = panneauPartie(v) + panneauBulletin(v) + panneauJauge(v)
      + panneauInspection(v) + panneauOrdres(v) + panneauFinTour(v)
      + panneauAttente(v) + panneauAnnonce(v) + modaleProduction(v) + ecranFin(v);
    peindreVignettes();
  }

  function surClic(e: Event): void {
    const cible = e.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-action]');
    if (!(bouton instanceof HTMLElement)) return;
    if (bouton.hasAttribute('disabled')) return;
    // Un clic dans la modale ne la ferme pas : seul le voile ferme.
    if (bouton.dataset['action'] === 'fermer' && cible.closest('[data-arret]') && cible !== bouton) return;
    e.preventDefault();
    e.stopPropagation();
    const valeur = bouton.dataset['valeur'] ?? '';
    switch (bouton.dataset['action']) {
      case 'fin_tour': api.finTour(); break;
      case 'suite': api.choisirSuite(valeur); break;
      case 'produire': api.choisirProduction(valeur); break;
      case 'pouvoir': api.jouerPouvoir('normal'); break;
      case 'fermer': api.annuler(); break;
      case 'rejouer': api.recommencer(); break;
      default: break;
    }
  }

  racine.addEventListener('click', surClic);
  rafraichir();

  return {
    rafraichir,
    demonter: () => {
      racine.removeEventListener('click', surClic);
      racine.remove();
    },
  };
}
