'use client';

import { useEffect, useRef, useState } from 'react';
import { Buste, Silhouette } from '../../buste-commandant';
import { actionClic, gesteClavier, type FicheRoster } from '@/render/roster-commandants';
import type { CampId } from '@/schemas/index';

/**
 * Le **vestiaire au briefing** : seize cases, un banc à prendre.
 *
 * Trois bancs se rendaient par trois boutons empilés (`optionsBanc`, le banc
 * prêté) ; seize ne le peuvent pas — on ne lit pas seize paragraphes pour en
 * choisir un. C'est donc une grille de figurines, dans la grammaire d'Advance
 * Wars : on parcourt les visages, on s'arrête sur un nom, **la case retenue
 * s'ouvre en pleine largeur** et dit ce qu'il change, et un second geste
 * l'emporte. La même case s'ouvre à 390 px, où la grille n'a qu'une colonne :
 * la mise en page change, la façon de choisir non.
 *
 * Le composant ne décide de rien et ne lit rien : la page lui passe des fiches
 * déjà composées et déjà traduites (`app/campagne/roster.ts`), et il rend la clé
 * retenue. Les trois états — jouable, verrouillé, secret — sont ceux de
 * `render/roster-commandants.ts`, y compris la règle qui compte le plus : un
 * secret fermé n'a **ni nom, ni buste, ni clé** dans le balisage.
 */

/** Tous les textes de l'écran, déjà traduits par la page. */
export interface LibellesVestiaire {
  /** Le surtitre : « Entraînement 7 · Choisissez votre commandant ». */
  surtitre: string;
  titre: string;
  note: string;
  /** « 7 sur 16 · 3 encore fermés ». */
  compte: string;
  grille: string;
  prendre: string;
  /** La plaque de la case du scénario. */
  defaut: string;
  /** La plaque d'un verrouillé : « À gagner ». */
  verrouille: string;
  /** Le nom qu'on donne à un secret fermé, faute d'en avoir un. */
  secret: string;
  indice: string;
  /** Le titre du détail : « Ce qu'il change ». */
  kit: string;
}

export interface ProprietesChoixCommandant {
  fiches: readonly FicheRoster[];
  libelles: LibellesVestiaire;
  /** La teinte des bustes : le camp du joueur. */
  camp: CampId;
  /** Le banc pris. La clé d'un commandant, jamais celle d'une case fermée. */
  surPrendre: (cle: string) => void;
  /** Le pied de l'écran : le lien de retour et les avis de la page. */
  children?: React.ReactNode;
}

export default function ChoixCommandant(
  { fiches, libelles, camp, surPrendre, children }: ProprietesChoixCommandant,
): React.ReactElement {
  // La case retenue à l'ouverture est celle du scénario : décliner reste un
  // geste de la grille, jamais un autre écran.
  const premier = fiches.find((f) => f.defaut) ?? fiches.find((f) => f.etat === 'jouable') ?? fiches[0];
  const [retenu, setRetenu] = useState(premier?.id ?? '');
  const grilleRef = useRef<HTMLUListElement>(null);

  // Le premier banc prend le focus à l'ouverture : la grille est le seul objet
  // de l'écran, et on doit pouvoir la parcourir sans chercher où appuyer.
  useEffect(() => {
    grilleRef.current?.querySelector<HTMLButtonElement>('.vestiaire-case[data-retenu="oui"]')?.focus();
  }, []);

  const allerA = (index: number): void => {
    const fiche = fiches[index];
    if (!fiche) return;
    setRetenu(fiche.id);
    grilleRef.current?.querySelectorAll<HTMLButtonElement>('.vestiaire-case')[index]?.focus();
  };

  const prendre = (fiche: FicheRoster | undefined): void => {
    if (fiche && fiche.etat === 'jouable' && fiche.cle !== '') surPrendre(fiche.cle);
  };

  return <section className="atlas-briefing atlas-vestiaire" role="dialog" aria-modal="true" aria-labelledby="titre-vestiaire" tabIndex={-1}>
    <div className="atlas-fiche-titre">
      <p className="campagne-kicker">
        <span className="atlas-balise" aria-hidden="true"><i /><i /><i /></span>{libelles.surtitre}
      </p>
      <h1 id="titre-vestiaire">{libelles.titre}</h1>
      <p className="campagne-progression">{libelles.compte}</p>
    </div>
    <p className="atlas-aide">{libelles.note}</p>

    <ul className="vestiaire-grille" ref={grilleRef} aria-label={libelles.grille}>
      {fiches.map((f, i) => {
        const estRetenu = f.id === retenu;
        return <li key={f.id} data-ouvert={estRetenu && f.etat === 'jouable' ? 'oui' : undefined}>
          <button
            type="button"
            className="vestiaire-case"
            data-etat={f.etat}
            data-retenu={estRetenu ? 'oui' : undefined}
            data-commandant={f.cle === '' ? undefined : f.cle}
            aria-pressed={f.etat === 'jouable' ? estRetenu : undefined}
            aria-disabled={f.etat === 'jouable' ? undefined : true}
            tabIndex={estRetenu ? 0 : -1}
            onClick={() => {
              const quoi = actionClic(f, retenu);
              if (quoi === 'selectionner') setRetenu(f.id);
              else if (quoi === 'prendre') prendre(f);
            }}
            onKeyDown={(e) => {
              const geste = gesteClavier(e.key, i, fiches.length);
              if (!geste) return;
              e.preventDefault();
              if (geste.type === 'aller') allerA(geste.index);
              else prendre(f);
            }}
          >
            {f.etat === 'secret'
              ? <Silhouette />
              : <Buste camp={camp} teinte={f.etat === 'verrouille'} />}
            <span className="vestiaire-nom">{f.etat === 'secret' ? libelles.secret : f.nom}</span>
            {f.style !== '' ? <span className="vestiaire-style">{f.style}</span> : null}
            {f.defaut ? <span className="vestiaire-plaque" data-plaque="defaut">{libelles.defaut}</span> : null}
            {f.etat === 'verrouille' ? <span className="vestiaire-plaque" data-plaque="verrouille">{libelles.verrouille}</span> : null}
            {f.porte !== '' ? <span className="vestiaire-porte">{f.porte}</span> : null}
          </button>

          {/* Le détail de la case retenue s'ouvre **là où elle est**, en pleine
              largeur de la grille : sur un téléphone il n'y a qu'une colonne et
              c'est déjà sous le nom, sur un écran la rangée s'ouvre sans que la
              case se déplace. Une colonne de détail à part aurait demandé deux
              mises en page, donc deux façons de lire un kit. */}
          {estRetenu && f.etat === 'jouable' ? <div className="vestiaire-detail">
            {f.gout !== '' ? <p className="vestiaire-gout">{f.gout}</p> : null}
            {f.lignes.length > 0 ? <>
              <p className="atlas-etiquette">{libelles.kit}</p>
              <ul className="vestiaire-kit">{f.lignes.map((l) => <li key={l}>{l}</li>)}</ul>
            </> : null}
            <button type="button" className="atlas-bouton" data-prendre={f.cle} onClick={() => prendre(f)}>
              {libelles.prendre}
            </button>
          </div> : null}
        </li>;
      })}
    </ul>
    {children}
  </section>;
}
