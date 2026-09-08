'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  destinationCampagne, nombreGagnees, sousLigneCampagne, type Epreuve,
} from './accueil-campagne';
import { victoiresDe } from './campagne/progression';
import { changerProfilActif, lireProfils, PROFILS, type EtatProfils, type Profil } from './preferences';
import { GESTES_PRECHARGEMENT } from './jeu/precharger';

/**
 * Le **bouton Campagne** de l'écran-titre, et le choix de sauvegarde.
 *
 * Il est client parce qu'il lit `localStorage`, et rien d'autre ne l'oblige à
 * l'être. Il ne connaît ni le canon, ni `t()` : la page, qui est un composant
 * serveur, lui passe des **libellés déjà traduits** et les six épreuves réduites
 * à ce qui s'affiche. C'est la règle du dépôt (`CLAUDE.md`, conventions), et
 * elle évite d'embarquer le récit des missions et les chaînes d'interface dans
 * le lot d'une page d'accueil.
 *
 * Il ne **décide** rien non plus : où mène le bouton, combien d'épreuves sont
 * derrière soi et ce que dit sa sous-ligne sont quatre fonctions pures de
 * `accueil-campagne.ts`, vérifiées par `tsx --test`. Ce fichier ne fait que lire
 * le navigateur et peindre — c'est ce que `parties-libres.ts` fait pour `/jeu`
 * et `itineraire.ts` pour le carnet.
 *
 * ## Le choix de sauvegarde
 *
 * Demandé par le propriétaire : « quand on met campagne, on a le choix entre les
 * deux sauvegardes et ensuite ça lance ». L'appareil porte deux profils
 * (`preferences.ts`) ; jusqu'ici l'écran-titre partait droit sur la prochaine
 * épreuve du profil **actif**, et changer de joueur demandait un détour par les
 * réglages. Le bouton ouvre donc un tiroir : les deux sauvegardes, chacune avec
 * sa jauge et l'épreuve où elle en est, et un appui lance la partie du profil
 * choisi — qui devient actif au passage.
 *
 * **Le geste unique survit quand même.** Le bouton reste un lien vers une vraie
 * destination : sans JavaScript, il mène à la campagne comme avant. C'est le
 * clic qui est intercepté une fois la page hydratée, jamais l'élément qui
 * change — un lien qui deviendrait bouton après coup ferait clignoter
 * l'affordance sans rien apprendre à personne.
 *
 * Le sens de l'hydratation reste **à sens unique** : le serveur rend l'état
 * neutre — jauge vide, aucun chiffre, destination `/campagne`, vraie dans tous
 * les cas —, le client l'enrichit après montage. Jamais l'inverse. Afficher
 * « 0 sur 6 » pendant deux cents millisecondes à quelqu'un qui a tout gagné
 * serait une affirmation fausse.
 *
 * Le curseur — le triangle posé à gauche de l'entrée — n'est pas ici : il est
 * en CSS sur `.menu-bouton`, permanent et animé sur Campagne, révélé au survol
 * et au clavier sur les autres. Une seule glyphe SVG a disparu avec lui, et
 * trois autres avec les vignettes des entrées secondaires : le repère d'un menu
 * de jeu est le curseur, pas une icône par ligne (revue du 8 septembre 2026).
 */

export type { Epreuve } from './accueil-campagne';

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
  /** Noms par défaut des profils, tant qu'ils ne sont pas nommés. */
  profilA: string;
  profilB: string;
  /** Contient `{nom}` : l'intitulé accessible de la pastille. */
  profilActif: string;
  /** Titre du tiroir des sauvegardes. */
  choisir: string;
  /** Referme le tiroir sans rien lancer. */
  retour: string;
}

export function MenuCampagne({ epreuves, libelles }: {
  epreuves: readonly Epreuve[];
  libelles: LibellesCampagne;
}) {
  const [profils, setProfils] = useState<EtatProfils | null>(null);
  // `null` tant que le navigateur n'a pas parlé : c'est ce qui distingue « pas
  // encore lu » de « lu, et vide ».
  const [victoires, setVictoires] = useState<Record<Profil, readonly string[]> | null>(null);
  const [choix, setChoix] = useState(false);

  useEffect(() => {
    // `pageshow` et `storage` : le retour depuis une mission ou les réglages
    // passe souvent par le cache de navigation, qui ne rejoue pas le montage.
    const lire = (): void => {
      setProfils(lireProfils());
      setVictoires({ a: victoiresDe('a'), b: victoiresDe('b') });
    };
    lire();
    window.addEventListener('pageshow', lire);
    window.addEventListener('storage', lire);
    return () => {
      window.removeEventListener('pageshow', lire);
      window.removeEventListener('storage', lire);
    };
  }, []);

  // Échap referme le tiroir : il occupe la place du menu, on doit pouvoir en
  // sortir sans choisir.
  useEffect(() => {
    if (!choix) return undefined;
    const surTouche = (e: KeyboardEvent): void => { if (e.key === 'Escape') setChoix(false); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [choix]);

  const pret = victoires !== null;
  /** Les victoires d'un profil, ou `null` tant que le navigateur n'a pas parlé. */
  const victoiresDu = (p: Profil): readonly string[] | null => victoires?.[p] ?? null;

  const nomDe = (p: Profil): string =>
    profils?.noms[p] || (p === 'a' ? libelles.profilA : libelles.profilB);

  const actif = profils?.actif ?? 'a';
  /** La pastille ne paraît que si l'appareil a réellement deux joueurs. */
  const nomProfil = profils && (profils.actif === 'b' || profils.noms[profils.actif] !== '')
    ? nomDe(profils.actif)
    : null;

  const jauge = (n: number): React.ReactElement => (
    <span className="menu-jauge" aria-hidden="true">
      {epreuves.map((e, i) => (
        <i key={e.cle} className={i < n ? 'faite' : ''} style={{ transitionDelay: `${i * 60}ms` }} />
      ))}
    </span>
  );

  if (choix) {
    return <div className="menu-sauvegardes" role="group" aria-label={libelles.choisir}>
      <p className="atlas-etiquette">{libelles.choisir}</p>
      {PROFILS.map((p) => (
        <Link
          key={p}
          className="menu-bouton menu-sauvegarde"
          data-actif={p === actif ? 'oui' : 'non'}
          href={destinationCampagne(epreuves, victoiresDu(p))}
          // Le profil devient actif **avant** la navigation : la page de jeu lit
          // le profil pour composer sa clé de sauvegarde, elle doit trouver le
          // bon. Un échec d'écriture ne bloque pas le départ — on jouera sur le
          // profil courant plutôt que de refuser d'entrer.
          onClick={() => { changerProfilActif(p); }}
          {...GESTES_PRECHARGEMENT}
        >
          <span className="menu-texte">
            <span className="menu-libelle">{nomDe(p)}</span>
            <span className="menu-note">{sousLigneCampagne(libelles, epreuves, victoiresDu(p))}</span>
          </span>
          {jauge(nombreGagnees(epreuves, victoiresDu(p)))}
        </Link>
      ))}
      <button type="button" className="menu-bouton menu-petit menu-retour" onClick={() => setChoix(false)}>
        <span className="menu-libelle">{libelles.retour}</span>
      </button>
    </div>;
  }

  return <div className="menu-campagne" data-pret={pret ? 'oui' : 'non'}>
    <Link
      className="menu-bouton menu-principal"
      href={destinationCampagne(epreuves, victoiresDu(actif))}
      // Hydraté, le clic ouvre le tiroir au lieu de partir ; sans JavaScript, le
      // lien fait ce qu'il a toujours fait.
      onClick={(e) => { if (pret) { e.preventDefault(); setChoix(true); } }}
      aria-haspopup="true"
      {...GESTES_PRECHARGEMENT}
    >
      {nomProfil !== null
        ? <span className="menu-profil" aria-label={libelles.profilActif.replace('{nom}', nomProfil)}>{nomProfil}</span>
        : null}
      <span className="menu-texte">
        <span className="menu-libelle">{libelles.campagne}</span>
        <span className="menu-note" aria-live="polite">
          {sousLigneCampagne(libelles, epreuves, victoiresDu(actif))}
        </span>
      </span>
      {jauge(nombreGagnees(epreuves, victoiresDu(actif)))}
    </Link>
    <Link className="menu-carnet" href="/campagne">{libelles.carnet}</Link>
  </div>;
}
