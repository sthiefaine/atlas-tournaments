/**
 * La **scène de dialogue**, posée par-dessus la carte (`BRIEF.md`, direction
 * artistique : « Le HUD est une surcouche HTML »).
 *
 * C'est la grammaire d'Advance Wars, et elle tient en quatre gestes : la carte
 * reste visible, deux barres noires disent « on écoute », le buste du commandant
 * entre par son côté — le joueur à gauche, l'adversaire à droite —, et le texte
 * se déroule lettre à lettre. Un clic complète la réplique, un second passe à la
 * suivante ; rien ne se joue tout seul, personne n'attend une temporisation.
 *
 * Pourquoi un fichier à part de `hud-html.ts` : le HUD se reconstruit
 * entièrement à chaque rafraîchissement, et un `innerHTML` reposé relancerait la
 * frappe du texte à chaque image. La scène vit donc à côté, et n'est rebâtie que
 * lorsque la **réplique** change.
 *
 * Comme le HUD, elle ne décide de rien : elle appelle l'`ApiDialogue` que
 * `jeu.ts` lui donne, et n'appelle jamais `t()` sur autre chose qu'une clé.
 */

import type { CampId, Emotion } from '../schemas/types';
import type { RepliqueEnAttente } from './dialogues';
import { paletteDe } from './palettes';

/** Ce que la scène peut demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiDialogue {
  /** La réplique à l'écran, ou `null` quand la file est vide. */
  replique(): RepliqueEnAttente | null;
  /** Nom affichable d'un locuteur, déjà traduit. */
  nomLocuteur(cle: string): string;
  t(cle: string, params?: Record<string, string | number>): string;
  /** Passe à la réplique suivante. */
  suivante(): void;
  /** Saute le reste de la file : le joueur a compris, il veut jouer. */
  passer(): void;
}

/** Ce que `monterDialogue` rend à son hôte. */
export interface DialogueHtml {
  /** Relit la file et remonte la scène si la réplique a changé. */
  rafraichir(): void;
  demonter(): void;
}

/** Millisecondes par caractère : assez lent pour se lire, assez vif pour ne pas peser. */
const MS_PAR_CARACTERE = 16;
/** Durée maximale d'une frappe : au-delà, on accélère plutôt que d'ennuyer. */
const MS_FRAPPE_MAX = 1600;

/** Échappe un texte destiné à du HTML : la scène n'injecte jamais de balise. */
function ech(texte: string): string {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** La feuille de style de la scène, injectée une seule fois par document. */
const STYLE = `
.atlas-scene{position:absolute;inset:0;z-index:20;pointer-events:auto;display:flex;flex-direction:column;justify-content:flex-end;font:15px/1.5 system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4edda;--encre:#132630;--papier:#f4edda;--signal:#ffd162;--teinte:#3f86e0}
.atlas-scene *{box-sizing:border-box}
.atlas-scene .bandes{position:absolute;left:0;right:0;height:8vh;min-height:34px;background:#060d12;pointer-events:none}
.atlas-scene .bandes.haut{top:0;border-bottom:2px solid #ffffff14;animation:atlas-bande-haut .32s ease-out both}
.atlas-scene .bandes.bas{bottom:0;border-top:2px solid #ffffff14;animation:atlas-bande-bas .32s ease-out both}
.atlas-scene .plateau{position:relative;z-index:1;display:flex;align-items:flex-end;gap:0;padding:0 max(14px,env(safe-area-inset-left,0px)) calc(8vh + 14px) max(14px,env(safe-area-inset-right,0px));width:100%}
.atlas-scene[data-cote='droite'] .plateau{flex-direction:row-reverse}
.atlas-scene .buste{flex:0 0 auto;width:132px;position:relative;filter:drop-shadow(4px 6px 0 #050d1266);animation:atlas-buste .34s cubic-bezier(.2,.9,.3,1.1) both}
.atlas-scene[data-cote='droite'] .buste{animation-name:atlas-buste-droite;transform:scaleX(-1)}
.atlas-scene .buste svg{display:block;width:100%;height:auto;border:2px solid var(--teinte);border-bottom:0;background:#1d3540}
.atlas-scene .boite{flex:1 1 auto;min-width:0;position:relative;background:var(--encre);border:2px solid #8ba0a6;border-left-width:0;box-shadow:5px 6px 0 #050d1255;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%);animation:atlas-boite .22s ease-out both}
.atlas-scene[data-cote='droite'] .boite{border-left-width:2px;border-right-width:0;clip-path:polygon(16px 0,100% 0,100% 100%,0 100%,0 16px)}
.atlas-scene .nom{display:flex;align-items:center;gap:10px;padding:7px 14px;background:var(--teinte);color:#0b1a22;font-weight:900;font-size:13px;letter-spacing:.13em;text-transform:uppercase}
.atlas-scene .nom .humeur{margin-left:auto;font-size:11px;letter-spacing:.1em;opacity:.72;font-weight:800}
.atlas-scene .texte{padding:14px 16px 16px;min-height:5.6em;white-space:pre-wrap;font-size:clamp(15px,1.7vw,18px)}
.atlas-scene .texte b{font-weight:inherit;visibility:hidden}
.atlas-scene .pied{display:flex;align-items:center;gap:10px;padding:0 14px 11px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9db3b6}
.atlas-scene .jalons{display:flex;gap:4px}
.atlas-scene .jalons i{width:16px;height:4px;background:#ffffff2e}
.atlas-scene .jalons i.faite{background:var(--signal)}
.atlas-scene .suite{margin-left:auto;display:flex;align-items:center;gap:7px;color:var(--signal);font-weight:850}
.atlas-scene[data-frappe='en_cours'] .suite{visibility:hidden}
.atlas-scene .suite span{animation:atlas-suite 1s steps(2,end) infinite}
.atlas-scene .passer{all:unset;position:absolute;z-index:2;top:calc(8vh + 12px);right:max(14px,env(safe-area-inset-right,0px));box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;cursor:pointer;background:#132630e6;border:1px solid #93a8ad70;color:#dbe7e4;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.atlas-scene .passer:hover{background:#23404d}
.atlas-scene button:focus-visible{outline:3px solid var(--signal);outline-offset:-3px}
@keyframes atlas-bande-haut{from{transform:translateY(-100%)}to{transform:none}}
@keyframes atlas-bande-bas{from{transform:translateY(100%)}to{transform:none}}
@keyframes atlas-buste{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes atlas-buste-droite{from{opacity:0;transform:scaleX(-1) translateX(-24px)}to{opacity:1;transform:scaleX(-1)}}
@keyframes atlas-boite{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes atlas-suite{to{opacity:.15}}
@media(max-width:620px){
  .atlas-scene .buste{width:88px}
  .atlas-scene .texte{min-height:6.4em;padding:12px 13px 14px}
  .atlas-scene .plateau{padding-bottom:calc(8vh + 10px)}
}
@media(max-height:460px){
  .atlas-scene .bandes{height:6vh;min-height:22px}
  .atlas-scene .buste{width:96px}
  .atlas-scene .texte{min-height:4.4em}
}
@media(prefers-reduced-motion:reduce){.atlas-scene *{animation:none!important}}
`;

/** Injecte la feuille de style de la scène si le document ne l'a pas encore. */
function poserStyle(doc: Document): void {
  if (doc.getElementById('atlas-scene-style')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-scene-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Traits du visage par émotion : sourcils et bouche, rien de plus. */
const VISAGES: Readonly<Record<Emotion, { sourcils: string; bouche: string }>> = {
  neutre: { sourcils: 'M58 76h14m18 0h14', bouche: 'M72 114h16' },
  joie: { sourcils: 'M58 74l14-4m18 0l14 4', bouche: 'M70 111q10 10 20 0' },
  colere: { sourcils: 'M58 70l14 7m18 0l14-7', bouche: 'M70 116q10-8 20 0' },
  surprise: { sourcils: 'M57 70h15m17 0h15', bouche: 'M74 110q6 12 12 0q-6-6-12 0' },
  doute: { sourcils: 'M58 78l14-8m18 4h14', bouche: 'M70 114q10 6 20-2' },
  triomphe: { sourcils: 'M58 72l14-5m18 5l14-5', bouche: 'M68 109q12 13 24 0' },
};

/**
 * Le buste d'un commandant, en SVG vectoriel : net à toute taille, sans une
 * seule requête réseau, et teinté par la palette de son camp. Les modèles réels
 * sont des `AssetSpec` de type `buste` non encore livrées (`11-assets-spec.md`
 * §10.3) ; celui-ci tient la place, et il la tient debout.
 */
function buste(camp: CampId | null, emotion: Emotion): string {
  const pal = paletteDe(camp);
  const visage = VISAGES[emotion] ?? VISAGES.neutre;
  return `<svg viewBox="0 0 160 190" aria-hidden="true">`
    + `<path fill="${pal.dark}" d="M0 0h160v190H0z"/>`
    + `<path stroke="#ffffff" opacity=".1" stroke-width="1" d="M0 32h160M0 64h160M0 96h160M0 128h160M0 160h160M32 0v190M64 0v190M96 0v190M128 0v190"/>`
    + `<path fill="${pal.main}" opacity=".55" d="M80 26 152 190H8z"/>`
    + `<path fill="#1b3540" d="M14 190v-24q4-28 45-33h42q41 5 46 33v24"/>`
    + `<path fill="#e6b88e" d="M66 108h28v33l-14 12-14-12z"/>`
    + `<path fill="#f1c7a0" d="M54 62h52v40q-3 26-26 27-23-4-26-27z"/>`
    + `<path fill="${pal.dark}" d="M46 100V58q0-28 34-28 34 0 35 31v12l-12-8-40 6-9 12z"/>`
    + `<path fill="${pal.main}" d="M39 54q-4-28 37-30 42-5 47 21l-13 16-55 4z"/>`
    + `<path fill="#12303a" d="m49 60 60-9 7 8-13 10-50 3z"/>`
    + `<path fill="${pal.light}" d="m70 36 6-4 6 4v9l-6 4-6-4z"/>`
    + `<path stroke="#3a3a3c" stroke-width="3" stroke-linecap="round" fill="none" d="${visage.sourcils}"/>`
    + `<path stroke="#8f5f50" stroke-width="3" stroke-linecap="round" fill="none" d="${visage.bouche}"/>`
    + `<path fill="${pal.main}" d="m60 133 20 21-17 15-16-30m56-6-20 21 17 15 16-30"/>`
    + `<path fill="${pal.light}" d="M112 160h16v4h-16zm0 8h16v4h-16z"/>`
    + `</svg>`;
}

/** Monte la scène de dialogue dans le conteneur du jeu. */
export function monterDialogue(conteneur: HTMLElement, api: ApiDialogue): DialogueHtml {
  const doc = conteneur.ownerDocument;
  poserStyle(doc);
  const racine = doc.createElement('div');
  racine.className = 'atlas-scene';
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-live', 'polite');
  racine.hidden = true;
  conteneur.appendChild(racine);

  const mouvementReduit = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  let cleAffichee: string | null = null;
  let frappe: ReturnType<typeof setInterval> | null = null;
  let complete = false;

  function arreterFrappe(): void {
    if (frappe !== null) clearInterval(frappe);
    frappe = null;
  }

  /** Révèle tout le texte d'un coup : c'est le premier clic du joueur pressé. */
  function toutReveler(): void {
    arreterFrappe();
    complete = true;
    for (const lettre of racine.querySelectorAll<HTMLElement>('.texte b')) {
      lettre.style.visibility = 'visible';
    }
    racine.dataset['frappe'] = 'finie';
  }

  /**
   * Lance la frappe. Chaque caractère est un `<b>` masqué que l'on révèle : le
   * texte occupe donc sa place définitive dès la première image, et la boîte ne
   * change pas de hauteur en cours de réplique.
   */
  function frapper(lettres: readonly HTMLElement[]): void {
    if (lettres.length === 0 || mouvementReduit?.matches) {
      toutReveler();
      return;
    }
    complete = false;
    racine.dataset['frappe'] = 'en_cours';
    const pas = Math.max(1, Math.ceil((lettres.length * MS_PAR_CARACTERE) / MS_FRAPPE_MAX));
    let i = 0;
    frappe = setInterval(() => {
      for (let k = 0; k < pas && i < lettres.length; k += 1, i += 1) {
        const lettre = lettres[i];
        if (lettre) lettre.style.visibility = 'visible';
      }
      if (i >= lettres.length) toutReveler();
    }, MS_PAR_CARACTERE * pas);
  }

  /** Un clic sur la scène : compléter la frappe, puis avancer. */
  function surClic(e: Event): void {
    const cible = e.target;
    if (cible instanceof Element && cible.closest('[data-action="passer"]')) {
      e.preventDefault();
      arreterFrappe();
      api.passer();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!complete) {
      toutReveler();
      return;
    }
    api.suivante();
  }

  function surTouche(e: KeyboardEvent): void {
    if (racine.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      arreterFrappe();
      api.passer();
      return;
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!complete) toutReveler();
    else api.suivante();
  }

  function batir(r: RepliqueEnAttente): void {
    const pal = paletteDe(r.camp);
    racine.style.setProperty('--teinte', pal.main);
    racine.dataset['cote'] = r.camp !== null && r.camp !== 0 ? 'droite' : 'gauche';
    // Une lettre par `<b>` : la frappe se contente de lever la visibilité.
    const lettres = [...r.texte].map((c) => `<b>${ech(c)}</b>`).join('');
    const jalons = Array.from(
      { length: r.total },
      (_, i) => `<i class="${i < r.rang ? 'faite' : ''}"></i>`,
    ).join('');
    racine.innerHTML = '<div class="bandes haut"></div><div class="bandes bas"></div>'
      + `<button type="button" class="passer" data-action="passer">${ech(api.t('dialogue.passer'))} <span aria-hidden="true">»</span></button>`
      + '<div class="plateau">'
      + `<div class="buste">${buste(r.camp, r.emotion)}</div>`
      + '<div class="boite">'
      + `<div class="nom">${ech(api.nomLocuteur(r.locuteur))}`
      + `<span class="humeur">${ech(api.t(`emotion.${r.emotion}`))}</span></div>`
      + `<p class="texte">${lettres}</p>`
      + `<div class="pied"><span class="jalons" aria-hidden="true">${jalons}</span>`
      + `<span class="suite">${ech(api.t('dialogue.suivant'))} <span aria-hidden="true">▶</span></span></div>`
      + '</div></div>';
    frapper([...racine.querySelectorAll<HTMLElement>('.texte b')]);
  }

  function rafraichir(): void {
    const r = api.replique();
    if (!r) {
      arreterFrappe();
      cleAffichee = null;
      racine.hidden = true;
      racine.innerHTML = '';
      return;
    }
    const cle = `${r.sceneCle}:${r.rang}`;
    racine.hidden = false;
    // Rebâtir sur une réplique inchangée relancerait la frappe à chaque image.
    if (cle === cleAffichee) return;
    cleAffichee = cle;
    arreterFrappe();
    batir(r);
  }

  racine.addEventListener('click', surClic);
  doc.addEventListener('keydown', surTouche);
  rafraichir();

  return {
    rafraichir,
    demonter: () => {
      arreterFrappe();
      racine.removeEventListener('click', surClic);
      doc.removeEventListener('keydown', surTouche);
      racine.remove();
    },
  };
}
