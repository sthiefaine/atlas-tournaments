import Link from 'next/link';
import { redirect } from 'next/navigation';
import path from 'node:path';

import { commandeAsset, genererSpecs } from '@/assets/index';
import { chantier } from '@/serveur/chantier-assets';
import { nomsAttendus } from '@/serveur/depot-modeles';
import { lireInventaireModeles } from '@/serveur/modeles';

import { sessionCourante } from '../../session';
import { Bloc } from '../../ui';
import { Livraison } from '../[cle]/livraison';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Les identifiants livrés : un asset l'est dès que son niveau 0 est sur le disque. */
function livres(): Set<string> {
  const inventaire = lireInventaireModeles(path.resolve(process.cwd(), 'public', 'assets', 'modeles'));
  return new Set(
    Object.entries(inventaire.modeles).filter(([, n]) => n.includes(0)).map(([id]) => id),
  );
}

/** Une étape numérotée du mode d'emploi. */
function Etape({ n, titre, children }: { n: number; titre: string; children?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold">
        <span className="mr-2 inline-block w-6 text-center opacity-50">{n}</span>{titre}
      </h3>
      <div className="pl-8">{children}</div>
    </section>
  );
}

/**
 * **Le chantier** : un asset à la fois, quatre étapes, rien à savoir.
 *
 * La page des 973 spécifications dit *ce qui existe* ; celle-ci dit *quoi faire
 * maintenant*. La différence tient à une règle qu'on ne peut pas se rappeler à
 * chaque fois : un kit national se peint sur la géométrie de base, donc un kit
 * dont la base n'est pas livrée n'est pas à faire — il attend. L'ordre le sait,
 * et ne propose jamais un asset bloqué.
 */
export default async function Chantier() {
  if (!await sessionCourante()) redirect('/admin/login');

  const specs = genererSpecs();
  const faits = livres();
  const suite = chantier(specs, faits);
  const pret = suite.find((e) => e.bloquePar === null) ?? null;
  const enAttente = suite.filter((e) => e.bloquePar !== null).length;

  if (!pret) {
    return (
      <main>
        <h2 className="mb-2 text-lg">Le chantier</h2>
        <p className="text-sm opacity-70">
          {suite.length === 0
            ? `Les ${specs.length} assets du canon sont livrés.`
            : `${suite.length} asset(s) restent, tous en attente d’une géométrie de base. C’est un défaut d’ordonnancement : signalez-le.`}
        </p>
      </main>
    );
  }

  const spec = pret.spec;
  const suivants = suite.filter((e) => e.bloquePar === null && e.spec.id !== spec.id).slice(0, 5);

  return (
    <main>
      <h2 className="mb-1 text-lg">Le chantier</h2>
      <p className="mb-6 text-sm opacity-70">
        <strong>{faits.size} livré(s)</strong> sur {specs.length} · {suite.length} à produire,
        {' '}dont {enAttente} en attente d’une géométrie de base.
        {' '}<Link href="/admin/assets" className="underline underline-offset-4">Voir tout le catalogue</Link>
      </p>

      <Bloc titre={`À produire maintenant — ${spec.id}`} aide="Le premier asset que rien ne retient. Un kit n’apparaît ici qu’une fois sa géométrie de base livrée.">
        <Etape n={1} titre="Ce que c’est">
          <p className="text-sm">{spec.description.fr}</p>
          <p className="mt-2 text-xs opacity-60">
            Priorité {spec.priorite} · {spec.type} ·
            {' '}{spec.echelle.x.cible} × {spec.echelle.y.cible} × {spec.echelle.z.cible} m ·
            {' '}{spec.verification.lodRequis.length} niveau(x) de détail ·
            {' '}<Link href={`/admin/assets/${spec.id}`} className="underline underline-offset-4">sa fiche complète</Link>
          </p>
        </Etape>

        <Etape n={2} titre="Copier la commande, la donner au générateur" />
        <Etape n={3} titre="Déposer les fichiers qu’il rend">
          <Livraison id={spec.id} commande={commandeAsset(spec)} attendus={nomsAttendus(spec)} />
        </Etape>
        <Etape n={4} titre="Recharger la page">
          <p className="text-sm opacity-70">
            Accepté, l’asset disparaît de cette liste et le suivant prend sa place.
            {' '}Refusé, chaque motif est une consigne pour l’essai d’après.
          </p>
        </Etape>
      </Bloc>

      {suivants.length > 0 ? (
        <Bloc titre="Ensuite" aide="Les prochains que rien ne retient, dans l’ordre.">
          <ol className="space-y-1 text-sm">
            {suivants.map((e) => (
              <li key={e.spec.id}>
                <Link href={`/admin/assets/${e.spec.id}`} className="font-mono underline underline-offset-4">{e.spec.id}</Link>
                <span className="ml-2 text-xs opacity-60">priorité {e.spec.priorite} · {e.spec.type}</span>
              </li>
            ))}
          </ol>
        </Bloc>
      ) : null}
    </main>
  );
}
