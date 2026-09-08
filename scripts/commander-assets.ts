#!/usr/bin/env node
/**
 * `npm run commander` — une commande de générateur **par asset qui manque**.
 *
 * Manquant veut dire : le canon décrit l'asset, et `public/assets/modeles/` ne
 * porte pas ses fichiers. C'est la même lecture d'inventaire que le rendu fait
 * au chargement d'une page (`/api/modeles`), donc la liste ne peut pas mentir
 * sur ce qui est livré.
 *
 * Le texte est composé depuis la fiche par `commandeAsset` : c'est exactement
 * celui de `/admin/assets/<id>`. Cette commande-ci n'existe que pour en sortir
 * beaucoup d'un coup, quand on veut alimenter un générateur en série plutôt que
 * de copier fiche par fiche.
 *
 *     npm run commander                          # combien manquent, par type
 *     npm run commander -- --priorite 1 --liste  # lesquels, un par ligne
 *     npm run commander -- --id unite_artillerie_base   # la commande, à l'écran
 *     npm run commander -- --priorite 1 --sortie commandes/   # un fichier par asset
 *
 * Filtres cumulables : `--priorite 1|2|3`, `--type unite|kit|terrain|…`,
 * `--id <id>` (exact), `--limite N`. Sans `--sortie`, rien n'est écrit.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { commandeAsset, genererSpecs, type AssetSpec } from '../src/assets/index';
import { lireInventaireModeles } from '../src/serveur/modeles';

/** Un drapeau de la ligne de commande, ou `null`. */
function option(nom: string): string | null {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}

/** Vrai si le drapeau est présent, sans valeur. */
function present(nom: string): boolean {
  return process.argv.includes(`--${nom}`);
}

/**
 * Les assets que le canon décrit et que le disque ne porte pas.
 *
 * Un asset est livré dès que **son niveau 0 existe** : c'est le fichier que le
 * chargeur demande en premier, et un asset dont seuls les niveaux inférieurs
 * seraient là n'est de toute façon pas montrable.
 */
function manquants(specs: readonly AssetSpec[], livres: ReadonlySet<string>): AssetSpec[] {
  return specs.filter((s) => !livres.has(s.id));
}

function principal(): void {
  const dossierModeles = path.resolve(process.cwd(), 'public', 'assets', 'modeles');
  // L'inventaire rend « id → niveaux livrés » : un asset est livré dès que son
  // niveau 0 est là, celui que le chargeur demande en premier.
  const inventaire = lireInventaireModeles(dossierModeles);
  const livres = new Set<string>(
    Object.entries(inventaire.modeles)
      .filter(([, niveaux]) => niveaux.includes(0))
      .map(([id]) => id),
  );

  const specs = genererSpecs();
  let restants = manquants(specs, livres);

  const priorite = option('priorite');
  if (priorite !== null) restants = restants.filter((s) => String(s.priorite) === priorite);
  const type = option('type');
  if (type !== null) restants = restants.filter((s) => s.type === type);
  const id = option('id');
  if (id !== null) restants = restants.filter((s) => s.id === id);
  const limite = option('limite');
  if (limite !== null) restants = restants.slice(0, Math.max(0, Number(limite)));

  if (restants.length === 0) {
    console.log(`Rien ne manque avec ces filtres. ${specs.length - manquants(specs, livres).length} asset(s) livré(s) sur ${specs.length}.`);
    return;
  }

  const sortie = option('sortie');
  if (sortie !== null && sortie !== '') {
    const dossier = path.resolve(process.cwd(), sortie);
    mkdirSync(dossier, { recursive: true });
    for (const s of restants) {
      writeFileSync(path.join(dossier, `${s.id}.md`), `${commandeAsset(s)}\n`);
    }
    console.log(`${restants.length} commande(s) écrite(s) dans ${sortie}`);
    return;
  }

  if (present('liste')) {
    for (const s of restants) console.log(`${s.id}\tpriorité ${s.priorite}\t${s.type}`);
    return;
  }

  // Un seul asset visé : on veut sa commande, pas un compte.
  if (restants.length === 1) {
    console.log(commandeAsset(restants[0]!));
    return;
  }

  const parType = new Map<string, number>();
  for (const s of restants) parType.set(s.type, (parType.get(s.type) ?? 0) + 1);
  console.log(`${restants.length} asset(s) manquant(s) sur ${specs.length} :`);
  for (const [t, n] of [...parType].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${t}`);
  console.log('\n  --liste pour les nommer, --sortie <dossier> pour écrire une commande par asset,');
  console.log('  --id <id> pour en voir une seule. Filtres : --priorite, --type, --limite.');
}

principal();
