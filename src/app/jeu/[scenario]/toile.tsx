'use client';

import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n/index';
import {
  commandantsDuScenario, lireSauvegarde, monterJeu, preferenceDe,
  type Jeu, type Rendu,
} from '@/render/index';
import { creerRendu3d } from '@/render3d/index';
import type { MapDef, Scenario, StrategieIa } from '@/schemas/index';

import { adversaireIa } from '../adversaire';

/** Ce que la page passe à la toile. */
export interface ProprietesToile {
  scenario: Scenario;
  carte: MapDef;
  locale: string;
  /** `?rendu=2d|3d|auto` — `auto` prend la 3D quand WebGL 2 répond. */
  rendu?: string;
}

/** Le départ choisi par le joueur : partie neuve ou reprise de la sauvegarde. */
type Depart = 'neuf' | 'reprise';

/**
 * Le conteneur plein écran et son cycle de vie React.
 *
 * Tout le jeu vit dans `render/` et `render3d/` : ce composant ne fait que
 * **monter** et **démonter**. Il ne dessine rien, ne connaît aucune règle, et
 * n'appelle jamais `alert` ni `confirm`.
 *
 * C'est aussi lui qui relie les deux couches que l'architecture sépare :
 * `render/` n'a pas le droit d'importer `render3d/` (`02-architecture.md` §5),
 * la page fournit donc la fabrique 3D — exactement comme elle fournit l'IA.
 */
export default function Toile({
  scenario, carte, locale, rendu,
}: ProprietesToile): React.ReactElement {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [depart, setDepart] = useState<Depart | null>(null);
  const [reprisePossible, setReprisePossible] = useState(false);

  // Une sauvegarde locale existe : on demande au joueur avant de la remplacer.
  useEffect(() => {
    const sauvegarde = lireSauvegarde(scenario.code);
    if (sauvegarde && sauvegarde.actions.length > 0) setReprisePossible(true);
    else setDepart('neuf');
  }, [scenario.code]);

  useEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur || depart === null) return undefined;
    const ia = scenario.commandants.find((c) => c.ia)?.ia as StrategieIa | undefined;
    const commandants = commandantsDuScenario(scenario);
    let jeu: Jeu | null = null;
    try {
      jeu = monterJeu(conteneur, {
        scenario,
        carte,
        locale,
        commandants,
        adversaire: adversaireIa(ia, scenario.catalogueVersion, commandants),
        reprendre: depart === 'reprise',
        rendu: preferenceDe(rendu),
        fabriqueRendu: (): Rendu => creerRendu3d(),
      });
    } catch {
      // Un contexte graphique indisponible ne doit pas casser la page.
      jeu = null;
    }
    return () => jeu?.demonter();
  }, [depart, scenario, carte, locale, rendu]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#10131a]">
      <div
        ref={conteneurRef}
        aria-label={scenario.nom}
        className="relative h-full w-full touch-none outline-none"
        data-scenario={scenario.code}
        data-pret={depart === null ? '0' : '1'}
      />
      {depart === null && reprisePossible ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col gap-3 rounded-xl bg-[#141822]/95 p-6 text-white shadow-2xl">
            <p className="text-sm opacity-80">{scenario.nom}</p>
            <button
              type="button"
              className="rounded-md bg-[#3f86e0] px-5 py-2 text-sm font-semibold"
              onClick={() => setDepart('reprise')}
            >
              {t(locale, 'hud.reprendre')}
            </button>
            <button
              type="button"
              className="rounded-md border border-white/20 px-5 py-2 text-sm"
              onClick={() => setDepart('neuf')}
            >
              {t(locale, 'hud.nouvelle_partie')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
