import Link from 'next/link';

import { bilanPriorites } from '@/assets/index';

import { Bloc, Etat, Ligne } from '../ui';

import { chargerCatalogueAssets } from './donnees';
import { STATUT_LIVRAISON } from './tri';

/**
 * La ligne « assets » du tableau de bord. Elle vient du canon, pas de la base,
 * donc elle s'affiche aussi quand la base manque : c'est le seul compteur du
 * tableau qui ne dépende de rien d'autre que du dépôt.
 */
export function ResumeAssets() {
  const { specs } = chargerCatalogueAssets();
  const p = bilanPriorites(specs);
  return (
    <Bloc titre="Assets 3D" aide="Les spécifications commandées au générateur externe, composées depuis le canon.">
      <Ligne>
        <Link href="/admin/assets" className="w-44 font-mono text-xs underline-offset-4 hover:underline">assets/specs</Link>
        <span>{specs.length} spécifications</span>
        <span className="text-xs opacity-60">{p[1]} en priorité 1 · {p[2]} en priorité 2 · {p[3]} en priorité 3</span>
        <span className="ml-auto"><Etat valeur={`0 livrée · ${STATUT_LIVRAISON}`} /></span>
      </Ligne>
    </Bloc>
  );
}
