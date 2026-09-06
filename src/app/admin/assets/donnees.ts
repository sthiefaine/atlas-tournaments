/**
 * Ce que les deux pages « Assets » chargent : le catalogue composé depuis le
 * canon, les fiches pays et régions qui donnent un nom aux territoires, et le
 * dossier `assets/specs/` s'il est présent sur le disque.
 *
 * Rien ne vient de la base : cette section doit marcher sans `DATABASE_URL`,
 * parce que le canon suffit à dire ce qui est commandé et que la base ne sait
 * rien des assets aujourd'hui.
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';

import { genererSpecs, slugRegion, type AssetSpec } from '@/assets/index';
import { chargerPays, chargerRegions } from '@/content/index';
import type { Cle, CodePays, Country, Region } from '@/schemas/index';

/** Le dossier versionné des spécifications, relatif à la racine du dépôt. */
export const DOSSIER_SPECS = 'assets/specs';

/** Le catalogue et de quoi nommer ses territoires. */
export interface CatalogueAssets {
  specs: AssetSpec[];
  paysParCode: Map<CodePays, Country>;
  /** Les régions d'un pays, par nom court (`bretagne`), tel qu'il entre dans un identifiant. */
  regionsParPays: Map<CodePays, Map<Cle, Region>>;
  codesPays: Set<string>;
}

let cache: CatalogueAssets | null = null;

/**
 * Le catalogue, composé une fois par processus : le canon est embarqué dans
 * l'image, il ne change pas sans redéploiement, et recomposer 565 spécifications
 * à chaque requête serait payer pour rien.
 */
export function chargerCatalogueAssets(): CatalogueAssets {
  if (cache) return cache;
  const paysParCode = new Map<CodePays, Country>();
  const regionsParPays = new Map<CodePays, Map<Cle, Region>>();
  for (const p of chargerPays()) {
    paysParCode.set(p.code, p);
    const regions = new Map<Cle, Region>();
    for (const r of chargerRegions(p.code)) regions.set(slugRegion(r.code), r);
    regionsParPays.set(p.code, regions);
  }
  cache = { specs: genererSpecs(), paysParCode, regionsParPays, codesPays: new Set(paysParCode.keys()) };
  return cache;
}

/**
 * Les fichiers de `assets/specs/`, ou `null` si le dossier n'existe pas. L'image
 * de production n'embarque pas `assets/` (`Dockerfile`) : l'absence du dossier
 * n'est pas une dérive, c'est un environnement où seul le canon fait foi.
 */
export function lireDossierSpecs(): string[] | null {
  try {
    return readdirSync(path.resolve(process.cwd(), DOSSIER_SPECS));
  } catch {
    return null;
  }
}
