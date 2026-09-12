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

import type { CleIllustration } from '../schemas/types';
import type { RepliqueEnAttente } from './dialogues';
import {
  CLASSE_VIGNETTE, pictogramme, segmenterRiche, STYLE_ILLUSTRATIONS, vignetteIllustration,
} from './illustrations';
import { buste } from './buste';
import { paletteDe } from './palettes';

/** Ce que la scène peut demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiDialogue {
  /** La réplique à l'écran, ou `null` quand la file est vide. */
  replique(): RepliqueEnAttente | null;
  sonParole?(): void;
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
.atlas-scene{position:absolute;inset:0;z-index:20;pointer-events:auto;display:flex;flex-direction:column;justify-content:flex-end;font:15px/1.5 system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4edda;--encre:#132630;--papier:#f4edda;--signal:#ffd162;--lisere:#4d6a78;--teinte:#3f86e0;--ombre:8px 8px 0 #050d1288}
.atlas-scene *{box-sizing:border-box}
.atlas-scene .bandes{position:absolute;left:0;right:0;height:8vh;min-height:34px;background:#060d12;pointer-events:none}
.atlas-scene .bandes.haut{top:0;border-bottom:2px solid var(--lisere);animation:atlas-bande-haut .32s ease-out both}
.atlas-scene .bandes.bas{bottom:0;border-top:2px solid var(--lisere);animation:atlas-bande-bas .32s ease-out both}
.atlas-scene .plateau{position:relative;z-index:1;display:flex;align-items:flex-end;gap:0;padding:0 max(14px,env(safe-area-inset-left,0px)) calc(8vh + 14px) max(14px,env(safe-area-inset-right,0px));width:100%}
.atlas-scene[data-cote='droite'] .plateau{flex-direction:row-reverse}
.atlas-scene .buste{flex:0 0 auto;width:132px;position:relative;filter:drop-shadow(6px 6px 0 #050d12aa);animation:atlas-buste .34s cubic-bezier(.2,.9,.3,1.1) both}
.atlas-scene[data-cote='droite'] .buste{animation-name:atlas-buste-droite;transform:scaleX(-1)}
.atlas-scene .buste svg{display:block;width:100%;height:auto;border:2px solid var(--teinte);border-bottom:0;background:#1d3540}
/* La boîte est une **transmission**, comme le briefing d'ouverture : mêmes
   lignes de trame, même coin coupé, même ombre dure. C'est le meilleur objet
   visuel du jeu, et il n'y avait aucune raison qu'il s'arrête à la modale. */
.atlas-scene .boite{flex:1 1 auto;min-width:0;position:relative;background:repeating-linear-gradient(0deg,#fff0 0 39px,#98bcaa0d 40px),var(--encre);border:2px solid var(--lisere);border-left-width:0;box-shadow:var(--ombre);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%);animation:atlas-boite .22s ease-out both}
.atlas-scene[data-cote='droite'] .boite{border-left-width:2px;border-right-width:0;clip-path:polygon(16px 0,100% 0,100% 100%,0 100%,0 16px)}
.atlas-scene .nom{display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--teinte);color:#0b1a22;font-weight:900;font-size:13px;letter-spacing:.13em;text-transform:uppercase;clip-path:polygon(0 0,100% 0,100% 100%,14px 100%,0 calc(100% - 12px))}
.atlas-scene[data-cote='droite'] .nom{clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 14px) 100%,0 100%)}
/* L'humeur est une **étiquette**, pas une note en bas de page : elle se lit sur
   la même bande que le nom, en creux dans sa peinture. */
.atlas-scene .nom .humeur{margin-left:auto;padding:2px 8px;background:#0b1a2226;font-size:11px;letter-spacing:.1em;font-weight:800}
/* Le corps de la boîte : la vignette de la réplique à gauche du texte, et le
   texte qui garde toute sa place. C'est le retour à la ligne qui la couche
   quand la ligne devient trop courte — la mesure est au CSS, pas au montage,
   sinon la boîte déciderait de sa mise en page une fois pour toutes au moment
   où la réplique paraît, et un pivotement d'écran la laisserait fausse. */
.atlas-scene .corps{display:flex;flex-wrap:wrap;align-items:flex-start;gap:0 14px;padding:15px 16px 16px}
.atlas-scene .corps .texte{flex:1 1 14em;padding:0}
.atlas-scene .texte{min-height:5.6em;white-space:pre-wrap;font-size:clamp(15px,1.7vw,18px)}
.atlas-scene .texte b{font-weight:inherit;visibility:hidden}
/* Le gras des scénaristes (gras.ts) : la lettre hérite du poids de son
   segment, et la frappe ne fait que lever la visibilité — la balise ne se
   coupe jamais au milieu. Au signal, comme tout ce qui est mis en avant. */
.atlas-scene .texte strong{font-weight:900;color:var(--signal)}
.atlas-scene .pied{display:flex;align-items:center;gap:10px;padding:0 14px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9db3b6}
/* Les mêmes segments biseautés que la jauge de la campagne et que le bouton
   Campagne de l'écran-titre : deux mesures de la même chose — où j'en suis —
   doivent se ressembler. */
.atlas-scene .jalons{display:flex;gap:3px;transform:skewX(-15deg)}
.atlas-scene .jalons i{width:18px;height:5px;background:#ffffff2e}
.atlas-scene .jalons i.faite{background:var(--signal)}
.atlas-scene .suite{border:0;background:transparent;font:inherit;cursor:pointer;min-height:44px;padding:8px 10px;touch-action:manipulation;margin-left:auto;display:flex;align-items:center;gap:7px;color:var(--signal);font-weight:850}
.atlas-scene[data-frappe='en_cours'] .suite span{animation:none}
.atlas-scene .suite span{animation:atlas-suite 1s steps(2,end) infinite}
/* « Passer » est un bouton du jeu, donc il a une **épaisseur** qui s'écrase de
   deux pixels à l'appui et un coin coupé. Il était plat, à un liseré de 1 px :
   le seul bouton du produit à ne pas suivre la règle commune. */
.atlas-scene .passer{all:unset;position:absolute;z-index:2;top:calc(8vh + 12px);right:max(14px,env(safe-area-inset-right,0px));box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;cursor:pointer;background:#1a3340;border:1px solid var(--lisere);border-bottom:4px solid #09171d;color:#dbe7e4;font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);transition:background .1s,translate .06s,border-bottom-width .06s}
.atlas-scene .passer:hover{background:#26485a}
.atlas-scene .passer:active{translate:0 2px;border-bottom-width:2px}
.atlas-scene button:focus-visible{outline:3px solid var(--signal);outline-offset:-3px}
@keyframes atlas-bande-haut{from{transform:translateY(-100%)}to{transform:none}}
@keyframes atlas-bande-bas{from{transform:translateY(100%)}to{transform:none}}
@keyframes atlas-buste{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes atlas-buste-droite{from{opacity:0;transform:scaleX(-1) translateX(-24px)}to{opacity:1;transform:scaleX(-1)}}
@keyframes atlas-boite{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes atlas-suite{to{opacity:.15}}
@media(max-width:620px){
  .atlas-scene .bandes{height:12px;min-height:0}
  .atlas-scene .plateau,.atlas-scene[data-cote='droite'] .plateau{display:block;padding:0 max(12px,env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
  .atlas-scene .buste{width:52px;margin-left:12px}
  .atlas-scene[data-cote='droite'] .buste{margin-left:auto;margin-right:12px}
  .atlas-scene .boite,.atlas-scene[data-cote='droite'] .boite{border:2px solid var(--lisere);display:flex;flex-direction:column;max-height:calc(100dvh - 180px)}
  .atlas-scene .nom{padding:10px 12px;letter-spacing:.06em;flex-wrap:wrap;font-size:12px;flex:none}
  .atlas-scene .texte{min-height:0;margin:0;padding:16px;font-size:16px;line-height:1.55;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
  /* Sur un téléphone, la vignette se couche **au-dessus** du texte et se
     centre : à 390 px, une image de 96 px à côté ne laisserait pas de quoi
     lire une phrase française, qui est un tiers plus longue que l'anglaise. */
  .atlas-scene .corps{display:block;padding:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
  .atlas-scene .corps .texte{padding:12px 16px 16px;overflow:visible}
  .atlas-scene .corps .${CLASSE_VIGNETTE}{margin:12px auto 0;width:clamp(56px,22vw,84px)}
  .atlas-scene .pied{flex:none;padding:4px 6px 6px 14px;border-top:1px solid #ffffff18}
  .atlas-scene .suite{background:var(--signal);color:#132630;min-width:116px;font-size:13px;justify-content:center;letter-spacing:.06em}
  .atlas-scene .passer{top:auto;bottom:calc(12px + env(safe-area-inset-bottom));right:max(12px,env(safe-area-inset-right));font-size:12px}
}
@media(max-height:460px){
  .atlas-scene .bandes{height:6vh;min-height:22px}
  .atlas-scene .buste{width:96px}
  .atlas-scene .texte{min-height:4.4em}
}
@media(prefers-reduced-motion:reduce){.atlas-scene *{animation:none!important}}
${STYLE_ILLUSTRATIONS}`;

/**
 * Le HTML du texte d'une réplique : **une lettre par `<b>`**, que la frappe
 * révèle une à une, et les segments gras (`**…**`, `gras.ts`) dans un
 * `<strong>` qui enveloppe ses lettres. La frappe traverse ainsi un segment
 * gras sans jamais couper une balise : elle ne connaît que des `<b>`, et le
 * `<strong>` est posé une fois pour toutes. Pure et exportée pour le test.
 *
 * **Un pictogramme `[[img:cle]]` est une lettre de plus** (`illustrations.ts`) :
 * un seul `<b>` qui contient tout le SVG. C'est ce qui garantit que la frappe
 * ne le coupe jamais — elle ne sait pas qu'il existe, elle lève sa visibilité
 * comme celle d'un caractère, et le dessin paraît d'un coup à son tour.
 */
export function htmlReplique(texte: string, nomDe?: (cle: CleIllustration) => string): string {
  return segmenterRiche(texte)
    .map((s) => {
      const contenu = s.genre === 'image'
        ? `<b>${pictogramme(s.cle, nomDe)}</b>`
        : [...s.texte].map((c) => `<b>${ech(c)}</b>`).join('');
      return s.gras ? `<strong>${contenu}</strong>` : contenu;
    })
    .join('');
}

export { VISAGES, buste } from './buste';

/** Injecte la feuille de style de la scène si le document ne l'a pas encore. */
function poserStyle(doc: Document): void {
  if (doc.getElementById('atlas-scene-style')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-scene-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
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
    let dernierSon = 0;
    frappe = setInterval(() => {
      for (let k = 0; k < pas && i < lettres.length; k += 1, i += 1) {
        const lettre = lettres[i];
        if (lettre) {
          lettre.style.visibility = 'visible';
          if (/\p{L}/u.test(lettre.textContent ?? '') && Date.now() - dernierSon >= 90) {
            dernierSon = Date.now(); api.sonParole?.();
          }
        }
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
    if (e.target instanceof Element && e.target.closest('button')) return;
    e.preventDefault();
    if (!complete) toutReveler();
    else api.suivante();
  }

  function batir(r: RepliqueEnAttente): void {
    const pal = paletteDe(r.camp);
    racine.style.setProperty('--teinte', pal.main);
    racine.dataset['cote'] = r.camp !== null && r.camp !== 0 ? 'droite' : 'gauche';
    // Un `role="dialog"` sans nom accessible s'annonce « dialogue », et rien de
    // plus. Le nom du locuteur est le seul mot juste ici, et il est déjà
    // traduit : aucune clé nouvelle pour une information que la scène affiche.
    racine.setAttribute('aria-label', api.nomLocuteur(r.locuteur));
    // Une lettre par `<b>` : la frappe se contente de lever la visibilité.
    const nomIllu = (cle: CleIllustration): string => api.t(`illustration.${cle}`);
    const lettres = htmlReplique(r.texte, nomIllu);
    // La vignette de la réplique, quand elle en montre une : une image et sa
    // légende, dans la boîte, au-dessus du texte. C'est le CSS qui décide où
    // elle se pose et ce qu'elle mesure — jamais une décision prise ici.
    const vignette = r.illustration
      ? vignetteIllustration(r.illustration.cle, r.illustration.legende, ech, nomIllu)
      : '';
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
      + `<div class="corps">${vignette}<p class="texte">${lettres}</p></div>`
      + `<div class="pied"><span class="jalons" aria-hidden="true">${jalons}</span>`
      + `<button type="button" class="suite" data-action="suivante">${ech(api.t('dialogue.suivant'))} <span aria-hidden="true">▶</span></button></div>`
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
