'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireProgression } from './campagne/progression';

/**
 * Le **bouton Campagne** : le seul îlot client de l'écran-titre.
 *
 * Il est client parce qu'il lit la progression dans `localStorage`, et rien
 * d'autre ne l'oblige à l'être. Il ne connaît ni le canon, ni `t()` : la page,
 * qui est un composant serveur, lui passe des **libellés déjà traduits** et les
 * six épreuves réduites à ce qui s'affiche. C'est la même règle que pour les
 * rendus (`CLAUDE.md`, conventions) — et elle évite d'embarquer le récit des
 * missions et les deux cent trente chaînes d'interface dans le bundle d'une
 * page d'accueil.
 *
 * **Le geste unique n'a pas disparu, il a gagné son contexte.** Un écran-titre
 * doit pouvoir mener au jeu en un appui ; le bouton mène donc droit à la
 * prochaine épreuve non remportée, et affiche sur lui-même où l'on en est. Une
 * seconde cible, « Carnet », mène au choix libre d'une épreuve : sans elle,
 * relire un récit ou rejouer une mission deviendrait impossible depuis
 * l'accueil.
 *
 * Le sens de l'hydratation est **à sens unique** : le serveur rend l'état
 * neutre — jauge vide, aucun chiffre, destination `/campagne`, qui est vraie
 * dans tous les cas —, le client l'enrichit après montage. Jamais l'inverse.
 * Afficher « 0 sur 6 » pendant deux cents millisecondes à quelqu'un qui a tout
 * gagné serait une affirmation fausse, et une bascule « reprendre » → « entrer »
 * se lirait comme une progression perdue.
 */

/** Une épreuve, réduite à ce que le bouton affiche. */
export interface Epreuve {
  cle: string;
  titre: string;
}

/** Tous les textes du bouton, déjà traduits par la page. */
export interface LibellesCampagne {
  campagne: string;
  carnet: string;
  /** Sous-ligne du serveur et du joueur neuf : « Six épreuves · commencez ici ». */
  neuf: string;
  /** Sous-ligne « tout remporté ». */
  fini: string;
  /**
   * Sous-ligne en cours, une entrée par nombre de victoires possible (0 à six),
   * l'épreuve déjà interpolée. Un tableau borné plutôt qu'un `t()` embarqué :
   * les états sont énumérables, autant les énumérer.
   */
  etat: readonly string[];
}

export function MenuCampagne({ epreuves, libelles }: {
  epreuves: readonly Epreuve[];
  libelles: LibellesCampagne;
}) {
  const [victoires, setVictoires] = useState<readonly string[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    // `pageshow` et `storage` : le retour depuis une mission passe souvent par
    // le cache de navigation, qui ne rejoue pas le montage.
    const lire = (): void => {
      setVictoires(lireProgression().victoires);
      setPret(true);
    };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => {
      window.removeEventListener('pageshow', lire);
      window.removeEventListener('storage', lire);
    };
  }, []);

  const gagnees = epreuves.filter((e) => victoires.includes(e.cle)).length;
  const complet = gagnees >= epreuves.length && epreuves.length > 0;
  // La prochaine épreuve est la première non remportée ; une fois tout gagné, on
  // renvoie au carnet, seul endroit où l'on choisit laquelle rejouer.
  const prochaine = epreuves.find((e) => !victoires.includes(e.cle)) ?? epreuves[0];
  const destination = !pret || complet ? '/campagne' : `/jeu/${prochaine?.cle ?? ''}`;
  const note = !pret || gagnees === 0
    ? libelles.neuf
    : complet ? libelles.fini : libelles.etat[gagnees] ?? libelles.neuf;

  return <div className="menu-campagne" data-pret={pret ? 'oui' : 'non'}>
    <Link className="menu-bouton menu-principal" href={destination}>
      <svg className="menu-glyphe" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5l11 7-11 7z" fill="currentColor" />
      </svg>
      <span className="menu-texte">
        <strong>{libelles.campagne}</strong>
        <span className="menu-note" aria-live="polite">{note}</span>
      </span>
      <span className="menu-jauge" aria-hidden="true">
        {epreuves.map((e, i) => (
          <i key={e.cle} className={i < gagnees ? 'faite' : ''} style={{ transitionDelay: `${i * 60}ms` }} />
        ))}
      </span>
    </Link>
    <Link className="menu-carnet" href="/campagne">{libelles.carnet}</Link>
  </div>;
}
