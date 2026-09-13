'use client';
import Link from 'next/link';
import type { Epreuve } from './accueil-campagne';
export type { Epreuve } from './accueil-campagne';
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

/** Un seul point d’entrée : profil, difficulté, puis carte, jamais lancement direct d’une mission. */
export function MenuCampagne({ libelles }: { epreuves: readonly Epreuve[]; libelles: LibellesCampagne }) {
  return <div className="menu-campagne"><Link className="menu-bouton menu-principal" href="/campagne/depart"><span className="menu-texte"><span className="menu-libelle">{libelles.campagne}</span><span className="menu-note">Choisir votre profil et reprendre l’aventure</span></span></Link></div>;
}
