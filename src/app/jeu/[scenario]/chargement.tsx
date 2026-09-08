'use client';

import { ETAPES_CHARGEMENT, type EtapePage } from './etapes-chargement';

/**
 * L'**écran de chargement** d'une mission.
 *
 * Il n'existait pas vraiment : une ligne de texte blanche au centre d'un cadre
 * vide, et surtout elle disparaissait au mauvais moment. Mesuré le 8 septembre
 * 2026 sur `/jeu/premier_contact` (serveur de développement, cache chaud) :
 * la ligne s'effaçait à l'instant où `monterJeu` rendait la main, et la première
 * image arrivait **3,3 s plus tard**. Entre les deux, l'écran était noir et rien
 * ne disait que le jeu travaillait encore. Pire, avant elle : la page de jeu est
 * entièrement cliente (`next/dynamic`, `ssr: false`), donc du premier octet
 * jusqu'à l'arrivée des modules il n'y avait **aucun balisage du tout** — 4,2 s
 * de page vide au premier chargement.
 *
 * Trois règles tiennent cet écran :
 *
 * 1. **Il est rendu par le serveur.** `toile-client.tsx` le pose à côté de la
 *    toile, pas dedans : c'est un composant client, donc rendu dans le HTML de
 *    la page, et il est là avant que la moindre ligne de moteur ne soit
 *    téléchargée. C'est lui qui porte le fond sombre du jeu.
 * 2. **Il ne ment pas.** Aucune jauge qui avance seule, aucune durée devinée :
 *    chaque étape est cochée par un fait — le module est arrivé, le plateau est
 *    bâti, le moteur graphique a démarré (`Rendu.mesurer().backend`), une image
 *    a été dessinée (`appels > 0`). Une jauge qui progresse toute seule est pire
 *    que rien : elle promet une fin qu'elle ne connaît pas.
 * 3. **Il ne traduit pas.** Ses libellés arrivent traduits, de la page serveur,
 *    comme ceux du bouton Campagne et de la liste des parties libres. Appeler
 *    `t()` ici ferait entrer les trois cent soixante-dix-neuf chaînes
 *    d'interface dans le **premier chargement** de `/jeu/[scenario]` — mesuré à
 *    quinze kilo-octets de plus —, pour cinq mots.
 */

/** Les cinq mots de l'écran, déjà traduits par la page. */
export interface LibellesChargement {
  /** Un libellé par étape, dans l'ordre d'`ETAPES_CHARGEMENT`. */
  etapes: readonly string[];
  /** Le nom de la liste, pour les lecteurs d'écran. */
  liste: string;
}

export function EcranChargement(
  { etape, libelles, titre }: {
    etape: EtapePage; libelles: LibellesChargement; titre?: string;
  },
): React.ReactElement | null {
  if (etape === 'pret') return null;
  const rang = ETAPES_CHARGEMENT.indexOf(etape);
  return <div className="atlas-chargement" role="status" aria-live="polite" data-etape={etape}>
    <div className="chargement-carte">
      {titre ? <p className="chargement-mission">{titre}</p> : null}
      <p className="chargement-etat">{libelles.etapes[rang]}</p>
      {/* Un ruban qui va et vient, pas une jauge : il dit qu'il se passe quelque
          chose, il ne promet pas un pourcentage qu'on ne connaît pas. */}
      <div className="chargement-jauge" aria-hidden="true"><span /></div>
      <ol className="chargement-etapes" aria-label={libelles.liste}>
        {ETAPES_CHARGEMENT.map((e, i) => <li
          key={e}
          data-fait={i < rang ? '1' : undefined}
          data-courant={i === rang ? '1' : undefined}
        ><span>{libelles.etapes[i]}</span></li>)}
      </ol>
    </div>
  </div>;
}
