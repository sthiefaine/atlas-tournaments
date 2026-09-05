'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lireProgression } from './campagne/progression';

/**
 * La **convocation** : le seul îlot client de l'accueil.
 *
 * Il est client parce qu'il lit la progression dans `localStorage`, et rien
 * d'autre ne l'oblige à l'être. Il ne connaît ni le canon, ni `t()` : la page,
 * qui est un composant serveur, lui passe des **libellés déjà traduits** et les
 * six épreuves réduites à ce qui s'affiche. C'est la même règle que pour les
 * rendus (`CLAUDE.md`, conventions) — et elle évite d'embarquer le récit des
 * missions et les deux cents chaînes d'interface dans le bundle d'une page
 * d'accueil.
 *
 * Le sens de l'hydratation est **à sens unique** : le serveur rend l'état neutre
 * (« entrer dans la Ronde »), le client l'enrichit après montage. Jamais
 * l'inverse — afficher « reprendre » puis retomber sur « entrer » se lirait
 * comme une progression perdue.
 */

/** Une épreuve, réduite à ce que la carte affiche. */
export interface Epreuve {
  cle: string;
  titre: string;
  /** Nom du biome, déjà traduit. */
  biome: string;
}

/** Tous les textes de la carte, déjà traduits par la page. */
export interface LibellesConvocation {
  carnet: string;
  prochaine: string;
  terminee: string;
  entrer: string;
  reprendre: string;
  rejouer: string;
  /**
   * « n sur six épreuves remportées », une entrée par total possible, de 0 à 6.
   * Un tableau borné plutôt qu'un `t()` embarqué : les états sont énumérables,
   * autant les énumérer.
   */
  progression: readonly string[];
}

export function Convocation({ epreuves, libelles }: {
  epreuves: readonly Epreuve[];
  libelles: LibellesConvocation;
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
  const libelle = complet ? libelles.rejouer : gagnees > 0 ? libelles.reprendre : libelles.entrer;
  const destination = complet ? '/campagne' : `/jeu/${prochaine?.cle ?? ''}`;

  return <section className="atlas-convocation" data-pret={pret ? 'oui' : 'non'} aria-live="polite">
    <header className="convocation-entete">
      <span className="atlas-etiquette">{libelles.carnet}</span>
      <span className="convocation-compte">{libelles.progression[gagnees] ?? ''}</span>
    </header>

    <span className="convocation-jauge" role="img" aria-label={libelles.progression[gagnees] ?? ''}>
      {epreuves.map((e, i) => (
        <i key={e.cle} className={i < gagnees ? 'faite' : ''} style={{ transitionDelay: `${i * 60}ms` }} />
      ))}
    </span>

    {complet
      ? <p className="convocation-fin">{libelles.terminee}</p>
      : <div className="convocation-epreuve">
        <span className="atlas-etiquette">{libelles.prochaine}</span>
        <strong>{prochaine?.titre ?? ''}</strong>
        <span className="convocation-biome">{prochaine?.biome ?? ''}</span>
      </div>}

    <Link className="atlas-primaire" href={destination}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
      <span>{libelle}</span>
    </Link>
  </section>;
}
