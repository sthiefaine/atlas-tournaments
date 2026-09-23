'use client';

/**
 * L'**aperçu** d'une unité ou d'un bâtiment dans le carnet en jeu : la vignette
 * cuite, animée — la pièce telle qu'elle paraît sur la carte, à la couleur du
 * joueur.
 *
 * C'était une scène 3D à part entière — un moteur WebGPU, une pièce de studio,
 * des contrôles d'orbite — qu'on montait pour une image de trois centimètres,
 * et qui ne ressemblait plus à rien de ce que le jeu montre depuis la bascule
 * aux images cuites (23 septembre 2026). C'est désormais une toile 2D, sans
 * WebGL : l'image du manifeste que le jeu pose (`render2d/vignette.ts`), son
 * repos qui respire à sa cadence, son ombre, le kit de la nation s'il est
 * cuit ; et tant que la page n'est pas arrivée — ou si l'entrée manque —, le
 * repli que le jeu poserait à sa place. La réserve est celle de la page : un
 * carnet qu'on rouvre retrouve ce qu'il avait lu.
 */

import { useEffect, useRef } from 'react';
import { chargerCatalogue } from '@/engine';
import { echelleTaille } from '@/render/sprites/silhouettes';
import { idBatiment, idUnite } from '@/render2d/contrat';
import { choisirAnimation } from '@/render2d/atlas';
import { couleurEquipe, LecteurVignettes, reserveNavigateur, type PisteVignette } from '@/render2d/vignette';
import type { CampId, CleUnite, CodePays } from '@/schemas/types';
import { lirePreferences } from '../../preferences';
import styles from './apercu-unite.module.css';

/** Une seule pièce sélectionnée. Fournir unite OU batiment (clé de terrain). */
export interface PropsApercuUnite {
  unite?: CleUnite;
  batiment?: string;
  pays?: CodePays | null;
  camp?: CampId;
  nom?: string;
}

export default function ApercuUnite({ unite, batiment, pays = null, camp = 0, nom = 'Figurine' }: PropsApercuUnite) {
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = toile.current;
    if (!c || (!unite && !batiment)) return undefined;
    const catalogue = chargerCatalogue();
    const reserve = reserveNavigateur(document, () => catalogue);
    // Le réglage de l'appareil est maître ; celui du joueur ne peut qu'ajouter :
    // sous animations réduites, la pièce se montre à l'arrêt.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches || lirePreferences().animationsReduites;
    const lecteur = new LecteurVignettes(reserve, reduit);
    const type = unite ? catalogue.unites[unite] : undefined;
    const piste: PisteVignette = {
      toile: c, id: '', animation: -1, equipe: couleurEquipe(camp, pays),
      marge: 12,
      // L'ombre d'une unité n'est pas cuite : c'est le jeu qui la pose, et
      // l'aperçu aussi, sous l'appareil qui vole comme sous le char.
      ombre: type ? { taille: echelleTaille(type.silhouette.taille), air: type.domaine === 'air' } : null,
      // Ce qui est peint se lit sur la toile — image cuite ou repli, et son
      // rang —, sans regarder l'image : c'est ce que vérifient les specs.
      surImage: (image, peinte) => {
        c.dataset['source'] = peinte ? (peinte.repli ? 'repli' : 'cuite') : 'aucune';
        c.dataset['image'] = String(image);
      },
    };
    /**
     * L'entrée et l'animation, relues quand le manifeste arrive : le kit de la
     * nation s'il est cuit, la base sinon — la règle du jeu —, et le repos d'une
     * unité tournée vers la droite, celui d'un bâtiment dans sa vue fixe.
     */
    const choisir = (): void => {
      const id = unite
        ? reserve.idPour('unite', unite, pays, idUnite(unite))
        : reserve.idPour('batiment', batiment!, pays, idBatiment(batiment!));
      const entree = reserve.entree(id);
      piste.id = id;
      piste.animation = entree ? choisirAnimation(entree, unite ? 'droite' : 'fixe', 'repos') : -1;
      lecteur.salir();
    };
    choisir();
    const retirer = lecteur.ajouter(piste);
    const desabonner = reserve.ecouter(() => {
      // Le manifeste a pu arriver : l'entrée n'est peut-être plus la même.
      const avant = `${piste.id}|${piste.animation}`;
      choisir();
      if (`${piste.id}|${piste.animation}` !== avant && piste.animation >= 0) void reserve.preparer(piste.id, [piste.animation]);
    });
    if (piste.animation >= 0) void reserve.preparer(piste.id, [piste.animation]);
    return () => {
      desabonner();
      retirer();
      lecteur.dispose();
    };
  }, [unite, batiment, pays, camp]);
  return <div className={styles.scene}>
    <canvas ref={toile} className={styles.canvas} role="img" aria-label={nom} data-apercu={unite ?? batiment ?? ''} />
  </div>;
}
