'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  PREFERENCES_PAR_DEFAUT, effacerProgression, ecrirePreferences, lirePreferences,
  stockageDisponible, type Preferences,
} from '../preferences';

/**
 * L'îlot client des réglages : il lit et écrit `localStorage`, c'est sa seule
 * raison d'être cliente. Il ne connaît ni le canon ni `t()` — la page lui passe
 * des libellés déjà traduits.
 *
 * Le même sens unique que sur l'accueil : avant montage, on affiche les valeurs
 * par défaut ; après, celles du navigateur. Tant que `pret` est faux, les
 * commandes sont désactivées — basculer un interrupteur sur un état qu'on n'a
 * pas encore lu écraserait le choix précédent.
 */

export interface LibellesReglages {
  titre: string;
  retour: string;
  dialogues: string;
  dialoguesNote: string;
  animations: string;
  animationsNote: string;
  actif: string;
  inactif: string;
  stockage: string;
  stockageOk: string;
  stockageKo: string;
  effacer: string;
  effacerNote: string;
  effacerConfirmer: string;
  annuler: string;
  efface: string;
}

export default function Reglages({ libelles }: { libelles: LibellesReglages }): React.ReactElement {
  const [preferences, setPreferences] = useState<Preferences>({ ...PREFERENCES_PAR_DEFAUT });
  const [pret, setPret] = useState(false);
  const [stockage, setStockage] = useState(true);
  const [confirme, setConfirme] = useState(false);
  const [efface, setEfface] = useState(false);

  useEffect(() => {
    setPreferences(lirePreferences());
    setStockage(stockageDisponible());
    setPret(true);
  }, []);

  const changer = (partiel: Partial<Preferences>): void => {
    const suivant = { ...preferences, ...partiel };
    setPreferences(suivant);
    setStockage(ecrirePreferences(suivant));
    setEfface(false);
  };

  const interrupteur = (
    cle: 'dialogues' | 'animationsReduites', titre: string, note: string,
  ): React.ReactElement => {
    const actif = preferences[cle];
    return <div className="reglage-ligne">
      <button
        type="button" className="reglage-interrupteur" role="switch" aria-checked={actif}
        disabled={!pret} onClick={() => changer({ [cle]: !actif } as Partial<Preferences>)}
      >
        <span className="reglage-libelle">
          <strong>{titre}</strong>
          <span className="reglage-note">{note}</span>
        </span>
        <span className="reglage-glissiere" aria-hidden="true"><i /></span>
      </button>
      <span className="reglage-etat">{actif ? libelles.actif : libelles.inactif}</span>
    </div>;
  };

  return <main className="atlas-reglages">
    <header className="reglages-entete">
      <h1>{libelles.titre}</h1>
      <Link className="reglages-retour" href="/">{libelles.retour}</Link>
    </header>

    <section className="reglages-groupe">
      {interrupteur('dialogues', libelles.dialogues, libelles.dialoguesNote)}
      {interrupteur('animationsReduites', libelles.animations, libelles.animationsNote)}
    </section>

    <section className="reglages-groupe" aria-labelledby="reglage-stockage">
      <h2 id="reglage-stockage">{libelles.stockage}</h2>
      {/* En navigation privée, le joueur perd sa progression sans jamais
          l'apprendre : on le lui dit avant, pas après. */}
      <p className="reglage-note" role="status">{stockage ? libelles.stockageOk : libelles.stockageKo}</p>
      {efface ? <p className="reglage-note" role="status">{libelles.efface}</p> : null}
      {confirme
        ? <div className="reglage-danger">
          <p>{libelles.effacerNote}</p>
          <div className="reglage-actions">
            <button type="button" className="reglage-detruire" onClick={() => {
              setEfface(effacerProgression());
              setConfirme(false);
            }}>{libelles.effacerConfirmer}</button>
            <button type="button" onClick={() => setConfirme(false)}>{libelles.annuler}</button>
          </div>
        </div>
        : <button type="button" className="reglage-effacer" disabled={!pret} onClick={() => setConfirme(true)}>
          {libelles.effacer}
        </button>}
    </section>
  </main>;
}
