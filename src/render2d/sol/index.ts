/**
 * Le sol de la peau 2D (`creerSol`, contrat `FabriqueSol`) : le terrain par un
 * nuanceur, en **une seule passe** — matières, eau et rives, routes, rivières et
 * ponts, grille, décor de repli, brouillard — et le **placement** du décor, que
 * le lot de sprites peint dans le calque `volumes`.
 *
 * Le partage du travail, et c'est tout ce qu'il faut retenir :
 *
 * - `maj` ne touche **pas** au contexte WebGL. Elle relit la grille logique si
 *   `signatureTerrain` a bougé, pose le brouillard, suit l'ambiance, replace le
 *   décor — sur le processeur, sans rien envoyer. Un survol y repasse à chaque
 *   case ; il ne coûte qu'une comparaison de chaînes et d'octets.
 * - `dessiner` envoie ce qui a changé, fait avancer les transitions sur
 *   `tempsMs`, puis dessine. Rien n'y est alloué : les tableaux d'uniformes
 *   sont des vues prises une fois.
 *
 * Deux transitions, de 1,4 s chacune et instantanées sous animations réduites :
 * la **marée** (ou le chantier du génie) mêle les champs de l'ancien sol et du
 * nouveau — la rive glisse —, et l'**ambiance** (météo, saison) fait glisser
 * les couleurs. `enMouvement()` est vrai tant que l'une d'elles joue.
 *
 * L'eau ondule avec `tempsMs` à chaque image dessinée, mais ne **réclame**
 * jamais d'image elle-même : `ambiant()` dit au moteur qu'il reste de l'eau
 * vue, et c'est lui qui redessine à son pas d'ambiance (12 images par seconde).
 * Sous animations réduites, l'eau est immobile et `ambiant()` rend faux.
 *
 * Le mode tactique retire la végétation : les images cuites, le moteur les
 * filtre ; celle du repli, le nuanceur la retire sur `tactique(true)` — une
 * méthode hors contrat, proposée pour y entrer.
 *
 * État GL laissé derrière soi : le programme et les textures du sol liés
 * (unités 0 à 2), le mélange actif en alpha prémultiplié, aucun tableau de
 * sommets lié. Le moteur relie ce qu'il dessine ensuite.
 */

import type { Biome } from '../../schemas/types';
import type { EtatPartie } from '../../engine/index';
import {
  PIXELS_PAR_CASE, SIN_TANGAGE, type ContexteImage, type CoucheSol, type FabriqueSol,
  type InstanceSprite, type OptionsSol,
} from '../contrat';
import { couleursSol, DISPOSITION, formeVoie, melangerCouleurs } from './couleurs';
import { manifesteLisible, placerDecor, pontCuit, REPLI, repliDecor } from './decor';
import { couchesDetail, TAILLE_DETAIL } from './details';
import { envoyerCases, envoyerDetails, programme, textureCases, textureDetails } from './gl';
import { encoderCases, grilleBrute, poserBrouillard, type GrilleSol } from './grille';
import { LecteurTerrain } from './lecture';
import { NB_COUCHES, SOURCE_FRAGMENT_SOL, SOURCE_SOMMET_SOL, UNIFORMES_SOL, type UniformeSol } from './nuanceurs';
import { codeDe, tablesPoids } from './terrains';

/** La durée d'une transition de sol, marée ou ambiance, en millisecondes. */
export const DUREE_TRANSITION = 1400;

/**
 * La marge peinte au-dessus de la première rangée, en cases de plan : ce que
 * dépasse de la rangée 0 une frondaison ou une montagne du décor de repli.
 */
export const MARGE_HAUT = 0.4;

/**
 * La hauteur de la calotte de neige des montagnes de repli, en fraction de leur
 * hauteur, par biome. La météo en ajoute ; le désert n'en porte jamais.
 */
const SOMMETS: Readonly<Record<Biome, number>> = {
  plaine: 0.12, foret: 0.12, montagne: 0.3, desert: 0, jungle: 0.06,
  neige: 0.42, volcanique: 0.04, cotier: 0.1, archipel: 0.04, marais: 0.08,
};

/** Les terrains où l'eau se voit et ondule : la mer, la rivière, et le chenal sous un pont. */
const CODES_EAU: ReadonlySet<number> = new Set([codeDe('mer'), codeDe('riviere'), codeDe('pont')]);

/**
 * Ce que le mode tactique retire du décor de repli : la végétation — arbres et
 * hautes herbes —, jamais le relief, les rochers ni les ponts (la règle du
 * moteur 2D pour les images cuites, appliquée au repli du nuanceur).
 */
const VEGETATION_REPLI = REPLI.FORET | REPLI.HERBE_HAUTE;

/**
 * Le sol tel que ce lot le rend : le contrat, plus `tactique`, que le contrat ne
 * porte pas encore (ajout proposé) — le moteur 2D retire la végétation cuite en
 * mode tactique, mais ne peut pas dire au nuanceur de retirer celle du repli.
 */
export type CoucheSolTerrain = CoucheSol & {
  ambiant(): boolean;
  tactique(actif: boolean): void;
};

/** Une transition en cours : son départ est pris à la première image qui la dessine. */
interface Transition {
  debut: number | null;
  /** Avancement brut, dans [0, 1]. */
  brut: number;
}

/** Fait avancer une transition ; rend `null` quand elle est finie. */
function avancer(t: Transition | null, tempsMs: number, reduit: boolean): Transition | null {
  if (!t) return null;
  if (reduit) return null;
  if (t.debut === null) t.debut = tempsMs;
  t.brut = Math.max(0, Math.min(1, (tempsMs - t.debut) / DUREE_TRANSITION));
  return t.brut >= 1 ? null : t;
}

/** Une marée part vite et s'étale : l'étale de fin de course. */
function adoucir(brut: number): number {
  return 1 - (1 - brut) ** 3;
}

/**
 * Le sol, avec son type complet : ce que `creerSol` rend, `tactique` compris.
 * Le moteur qui veut le mode tactique appelle celle-ci, ou lit `tactique` en
 * facultatif sur ce que `creerSol` lui rend.
 */
export function creerSolTerrain(
  gl: WebGL2RenderingContext, etatInitial: EtatPartie, options: OptionsSol,
): CoucheSolTerrain {
  const biome = options.biome;
  const manifeste = manifesteLisible(options.manifeste);

  const prog = programme(gl, SOURCE_SOMMET_SOL, SOURCE_FRAGMENT_SOL);
  const u = {} as Record<UniformeSol, WebGLUniformLocation | null>;
  for (const nom of UNIFORMES_SOL) u[nom] = gl.getUniformLocation(prog, nom);

  const vao = gl.createVertexArray();
  const tampon = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const texCases = textureCases(gl);
  const texAvant = textureCases(gl);
  const texDetails = textureDetails(gl);

  // --- L'état côté processeur. À la naissance, la grille brute : le sol a de
  //     quoi peindre avant la première `maj`, qui apporte le catalogue.
  const lecteur = new LecteurTerrain();
  let grille: GrilleSol = grilleBrute(etatInitial);
  let largeur = grille.largeur;
  let hauteur = grille.hauteur;
  let octets = encoderCases(grille, null);
  let octetsAvant = octets.slice();
  let brouillard: Uint8Array | null = null;
  let saison = etatInitial.climat.saison;
  let meteo = etatInitial.climat.meteo;
  let repli = repliDecor(manifeste, biome, saison);
  const pont = pontCuit(manifeste);

  const cible = Float32Array.from(couleursSol(biome, saison, meteo));
  const depart = cible.slice();
  const courantes = cible.slice();
  // Des vues sur le tableau courant, prises une fois : aucune tranche par image.
  const vues = {
    matieres: courantes.subarray(DISPOSITION.matieres, DISPOSITION.neige),
    neige: courantes.subarray(DISPOSITION.neige, DISPOSITION.eau),
    eau: courantes.subarray(DISPOSITION.eau, DISPOSITION.feuillage),
    feuillage: courantes.subarray(DISPOSITION.feuillage, DISPOSITION.voie),
    voie: courantes.subarray(DISPOSITION.voie, DISPOSITION.climat),
  };

  let fondu: Transition | null = null;
  let transition: Transition | null = null;
  let volumes: InstanceSprite[] = [];
  let dernierReduit = options.reduit;
  let libere = false;
  /** Une case d'eau au moins est vue : l'eau ondule, le moteur doit la faire vivre. */
  let eauVue = false;
  let tactique = false;

  // Ce que `dessiner` doit envoyer avant de peindre.
  let casesSales = false;
  let avantSale = false;
  let reallouer = false;
  let detailsSales = false;
  let taillesSales = true;
  let couleursSales = true;
  let repliSale = true;

  // --- Les uniformes qui ne changent qu'avec le biome : posés une fois.
  gl.useProgram(prog);
  gl.uniform1i(u.uCases, 0);
  gl.uniform1i(u.uCasesAvant, 1);
  gl.uniform1i(u.uDetails, 2);
  const poids = tablesPoids();
  gl.uniform4fv(u.uPoidsA, poids.a);
  gl.uniform4fv(u.uPoidsB, poids.b);
  const voie = formeVoie(biome);
  gl.uniform4fv(u.uVoieForme, voie.forme);
  gl.uniform4fv(u.uVoieStyle, voie.style);
  gl.uniform1f(u.uSommets, SOMMETS[biome]);
  gl.uniform1i(u.uPontCuit, pont ? 1 : 0);
  gl.uniform1f(u.uFondu, 1);
  envoyerCases(gl, texCases, largeur, hauteur, octets, true);
  envoyerCases(gl, texAvant, largeur, hauteur, octetsAvant, true);
  // Les couches de détail à la naissance, pas à la première image : la
  // synthèse ne doit pas retenir l'image qui montre enfin la carte.
  envoyerDetails(gl, texDetails, TAILLE_DETAIL, NB_COUCHES, couchesDetail(biome, saison));

  const reduit = (): boolean => options.reduit || dernierReduit;

  function replacer(): void {
    volumes = placerDecor({ grille, biome, saison, manifeste, brouillard });
  }
  replacer();

  /** Relit, dans la texture de cases, s'il reste de l'eau hors du noir. */
  function mesurerEau(): void {
    eauVue = false;
    for (let i = 0; i < octets.length; i += 4) {
      if (CODES_EAU.has(octets[i]!) && octets[i + 3]! >= 128) {
        eauVue = true;
        return;
      }
    }
  }
  mesurerEau();

  /** Garde une copie du brouillard reçu : le moteur peut réutiliser son tableau. */
  function retenirBrouillard(niveaux: Uint8Array | null): void {
    if (!niveaux) {
      brouillard = null;
      return;
    }
    if (!brouillard || brouillard.length !== niveaux.length) brouillard = new Uint8Array(niveaux.length);
    brouillard.set(niveaux);
  }

  return {
    maj(etat, vue, niveauxRecus): boolean {
      if (libere) return false;
      let sale = false;
      let replace = false;
      const changement = lecteur.lire(etat, vue.catalogue);
      const neuve = lecteur.grille ?? grille;
      const niveaux = niveauxRecus && niveauxRecus.length === neuve.largeur * neuve.hauteur ? niveauxRecus : null;

      if (changement !== 'rien') {
        const memeTaille = neuve.largeur === largeur && neuve.hauteur === hauteur;
        if (changement === 'terrain' && memeTaille && !reduit()) {
          // Une marée : l'ancien sol reste lisible le temps que le nouveau le rejoigne.
          octetsAvant.set(octets);
          avantSale = true;
          fondu = { debut: null, brut: 0 };
        } else {
          fondu = null;
        }
        grille = neuve;
        if (!memeTaille) {
          largeur = neuve.largeur;
          hauteur = neuve.hauteur;
          octets = new Uint8Array(largeur * hauteur * 4);
          octetsAvant = new Uint8Array(largeur * hauteur * 4);
          reallouer = true;
          taillesSales = true;
        }
        encoderCases(grille, niveaux, octets);
        if (!fondu) {
          octetsAvant.set(octets);
          avantSale = true;
        }
        retenirBrouillard(niveaux);
        casesSales = true;
        replace = true;
        sale = true;
      } else if (poserBrouillard(octets, niveaux)) {
        retenirBrouillard(niveaux);
        casesSales = true;
        replace = true;
        sale = true;
      }

      // L'ambiance : la saison change les couches de détail et les variantes du
      // décor ; saison et météo font glisser les couleurs.
      const amb = vue.ambiance;
      if (amb.saison !== saison || amb.meteo !== meteo) {
        if (amb.saison !== saison) {
          saison = amb.saison;
          detailsSales = true;
          repli = repliDecor(manifeste, biome, saison);
          repliSale = true;
          replace = true;
        }
        meteo = amb.meteo;
        depart.set(courantes);
        cible.set(couleursSol(biome, saison, meteo));
        if (reduit()) {
          courantes.set(cible);
          transition = null;
        } else {
          transition = { debut: null, brut: 0 };
        }
        couleursSales = true;
        sale = true;
      }

      if (replace) {
        replacer();
        mesurerEau();
      }
      return sale;
    },

    volumes(): readonly InstanceSprite[] {
      return volumes;
    },

    enMouvement(): boolean {
      return fondu !== null || transition !== null;
    },

    // L'eau vue ondule avec l'horloge : elle a droit au pas d'ambiance du
    // moteur. Sous animations réduites elle ne bouge pas, et ne réclame rien.
    ambiant(): boolean {
      return !libere && eauVue && !reduit();
    },

    tactique(actif: boolean): void {
      if (actif === tactique) return;
      tactique = actif;
      repliSale = true;
    },

    dessiner(ctx: ContexteImage): void {
      if (libere || gl.isContextLost()) return;
      dernierReduit = ctx.reduit;
      const r = reduit();

      // Les transitions avancent sur l'horloge de rendu.
      fondu = avancer(fondu, ctx.tempsMs, r);
      const avantTransition = transition;
      transition = avancer(transition, ctx.tempsMs, r);
      if (avantTransition) {
        melangerCouleurs(depart, cible, transition ? adoucir(transition.brut) : 1, courantes);
        couleursSales = true;
      }

      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      if (casesSales) {
        envoyerCases(gl, texCases, largeur, hauteur, octets, reallouer);
        casesSales = false;
      }
      gl.bindTexture(gl.TEXTURE_2D, texCases);
      gl.activeTexture(gl.TEXTURE1);
      if (avantSale) {
        envoyerCases(gl, texAvant, largeur, hauteur, octetsAvant, reallouer);
        avantSale = false;
      }
      reallouer = false;
      gl.bindTexture(gl.TEXTURE_2D, texAvant);
      gl.activeTexture(gl.TEXTURE2);
      if (detailsSales) {
        envoyerDetails(gl, texDetails, TAILLE_DETAIL, NB_COUCHES, couchesDetail(biome, saison));
        detailsSales = false;
      }
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texDetails);

      if (taillesSales) {
        gl.uniform2i(u.uTaille, largeur, hauteur);
        gl.uniform4f(
          u.uRect, 0, -MARGE_HAUT * PIXELS_PAR_CASE,
          largeur * PIXELS_PAR_CASE, hauteur * PIXELS_PAR_CASE * SIN_TANGAGE,
        );
        taillesSales = false;
      }
      if (repliSale) {
        gl.uniform1i(u.uRepli, tactique ? repli & ~VEGETATION_REPLI : repli);
        repliSale = false;
      }
      if (couleursSales) {
        gl.uniform3fv(u.uCouleurs, vues.matieres);
        gl.uniform3fv(u.uNeigeCouleurs, vues.neige);
        gl.uniform3fv(u.uEau, vues.eau);
        gl.uniform3fv(u.uFeuillage, vues.feuillage);
        gl.uniform3fv(u.uVoie, vues.voie);
        couleursSales = false;
      }
      // L'écume enfle au passage du front de marée, puis retombe : c'est elle
      // qui raconte le mouvement, plus que le niveau lui-même (la 3D).
      const houle = fondu ? 1 + Math.sin(fondu.brut * Math.PI) * 1.1 : 1;
      const c = DISPOSITION.climat;
      gl.uniform4f(u.uClimat, courantes[c]!, courantes[c + 1]!, courantes[c + 2]!, courantes[c + 3]! * houle);
      gl.uniform1f(u.uFondu, fondu ? adoucir(fondu.brut) : 1);
      gl.uniform1f(u.uTemps, r ? 0 : ctx.tempsMs / 1000);
      gl.uniformMatrix3fv(u.uPlanVersDecoupe, false, ctx.planVersDecoupe);

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },

    dispose(): void {
      if (libere) return;
      libere = true;
      gl.deleteTexture(texCases);
      gl.deleteTexture(texAvant);
      gl.deleteTexture(texDetails);
      gl.deleteBuffer(tampon);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      volumes = [];
    },
  };
}

/** Ce que le contrat attend sous ce nom (`FabriqueSol`). */
export const creerSol: FabriqueSol = creerSolTerrain;
