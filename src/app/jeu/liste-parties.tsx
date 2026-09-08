'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cleSauvegardeDe, profilActif } from '../preferences';
import { GESTES_PRECHARGEMENT } from './precharger';
import { etatSauvegarde, type EtatSauvegarde } from './parties-libres';

/**
 * La liste des parties libres : le seul îlot client de `/jeu`.
 *
 * Il est client parce qu'il lit `localStorage` — la sauvegarde de chaque partie,
 * sous la clé du profil actif —, et rien d'autre ne l'oblige à l'être. Il ne
 * connaît ni le canon ni `t()` : la page lui passe des **libellés déjà
 * traduits** et des fiches réduites à ce qui s'affiche, comme l'accueil le fait
 * pour le bouton Campagne (`menu-campagne.tsx`).
 *
 * Même sens unique que partout : le serveur rend l'état neutre — « Jouer » sur
 * chaque fiche, aucun badge —, le client l'enrichit après montage. « Partie en
 * cours » ne s'affirme qu'une fois la sauvegarde lue, et n'est jamais retirée
 * par une hydratation qui arriverait trop tard.
 *
 * « Nouvelle partie » **oublie** la sauvegarde avant d'ouvrir la page de jeu :
 * hors campagne, c'est le seul chemin pour repartir de zéro avant la fin d'une
 * manche — la page de jeu ne propose « nouvelle partie » qu'aux missions.
 */

/** Une partie, réduite à ce que la fiche affiche. Tout est déjà traduit. */
export interface PartieAffichee {
  cle: string;
  href: string;
  /** Le biome et le catalogue, en surtitre. */
  surtitre: string;
  nom: string;
  /** La version du catalogue jouée : c'est elle qui dit si une sauvegarde se reprend. */
  catalogueVersion: number;
  /** Les pastilles : taille, camps, adversaire, limite de journées. */
  details: readonly string[];
}

/** Les textes de la liste, déjà traduits par la page. */
export interface LibellesParties {
  liste: string;
  jouer: string;
  reprendre: string;
  nouvellePartie: string;
  enCours: string;
}

export function ListeParties({ parties, versionMoteur, libelles }: {
  parties: readonly PartieAffichee[];
  versionMoteur: number;
  libelles: LibellesParties;
}): React.ReactElement {
  const [etats, setEtats] = useState<Readonly<Record<string, EtatSauvegarde>>>({});

  useEffect(() => {
    // `pageshow` et `storage` : le retour depuis une partie passe souvent par
    // le cache de navigation, qui ne rejoue pas le montage.
    const lire = (): void => {
      const profil = profilActif();
      const suivant: Record<string, EtatSauvegarde> = {};
      for (const p of parties) {
        let brut: string | null = null;
        try {
          brut = localStorage.getItem(cleSauvegardeDe(profil, p.cle));
        } catch {
          brut = null;
        }
        suivant[p.cle] = etatSauvegarde(brut, versionMoteur, p.catalogueVersion);
      }
      setEtats(suivant);
    };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => {
      window.removeEventListener('pageshow', lire);
      window.removeEventListener('storage', lire);
    };
  }, [parties, versionMoteur]);

  const oublier = (cle: string): void => {
    try {
      localStorage.removeItem(cleSauvegardeDe(profilActif(), cle));
    } catch {
      // Sans stockage, il n'y a rien à oublier : la page de jeu partira de zéro.
    }
  };

  return <ol className="jeu-libre-liste" aria-label={libelles.liste}>
    {parties.map((p) => {
      const enCours = etats[p.cle] === 'en_cours';
      return <li className="jeu-libre-partie" key={p.cle} data-etat={etats[p.cle] ?? 'inconnu'}>
        <p className="jeu-libre-surtitre">{p.surtitre}</p>
        <h2>{p.nom}</h2>
        {p.details.length > 0
          ? <ul className="jeu-libre-details">{p.details.map((d) => <li key={d}>{d}</li>)}</ul>
          : null}
        {enCours ? <p className="jeu-libre-badge" role="status">{libelles.enCours}</p> : null}
        <div className="jeu-libre-actions">
          {/* Le survol lance le téléchargement du moteur : c'est le seul moment
              où l'on sait avant le clic ce qui va être demandé. */}
          <Link className="jeu-libre-bouton" href={p.href} {...GESTES_PRECHARGEMENT}>{enCours ? libelles.reprendre : libelles.jouer}</Link>
          {enCours
            ? <Link className="jeu-libre-bouton secondaire" href={p.href} {...GESTES_PRECHARGEMENT} onClick={() => oublier(p.cle)}>{libelles.nouvellePartie}</Link>
            : null}
        </div>
      </li>;
    })}
  </ol>;
}
