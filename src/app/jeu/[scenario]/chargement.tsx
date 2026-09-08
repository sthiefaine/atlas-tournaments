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
 *
 * Ce qui a changé le 8 septembre au soir tient à un quatrième point, qui n'est
 * pas une règle mais un verdict : un ado l'a trouvé « ressemblant à un
 * installeur ». Il l'était — une pastille par étape, une coche quand c'est fait,
 * un ruban qui va et vient au-dessus. La liste **reste** (c'est l'honnêteté du
 * point 2), mais elle prend la forme que le jeu donne déjà à toute progression :
 * les quatre segments biseautés de la jauge de campagne, dont celui en cours
 * porte le ruban. Un seul mot est écrit en grand — l'étape courante ; les trois
 * autres restent lisibles par un lecteur d'écran, où ils servent encore, et
 * cessent d'encombrer un écran qu'on regarde deux secondes.
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
      {/* La balise de liaison : trois traits qui battent, comme le filet de
          fréquence du briefing radio. Aucun mot — donc aucune clé —, et le
          même vocabulaire que l'écran suivant. */}
      <span className="atlas-balise" aria-hidden="true"><i /><i /><i /></span>
      {titre ? <p className="chargement-mission">{titre}</p> : null}
      {/* Une étape = un segment. Ce que le segment dit est un **fait** ; ce que
          le ruban dit à l'intérieur du segment courant est « ça travaille ». Les
          deux sont vrais, et ils ne se contredisent plus : le ruban n'avance
          plus au-dessus d'une liste qui, elle, n'avance pas. */}
      <ol className="chargement-etapes" aria-label={libelles.liste}>
        {ETAPES_CHARGEMENT.map((e, i) => <li
          key={e}
          data-fait={i < rang ? '1' : undefined}
          data-courant={i === rang ? '1' : undefined}
        ><span>{libelles.etapes[i]}</span></li>)}
      </ol>
      <p className="chargement-etat">{libelles.etapes[rang]}</p>
    </div>
  </div>;
}
