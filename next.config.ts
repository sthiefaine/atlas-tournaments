import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * Le commit court de la mise en ligne, sans dépendre du binaire `git` : Coolify
 * fournit `SOURCE_COMMIT` au build ; à défaut, on lit `.git/HEAD` et sa
 * référence (ou `packed-refs`) dans le contexte de construction. Rien de tout
 * cela n'est disponible : la mention se contente de la date.
 */
function commitCourt(): string {
  const fourni = process.env['SOURCE_COMMIT'] ?? process.env['COMMIT_SHA'] ?? '';
  if (/^[0-9a-f]{7,40}$/i.test(fourni)) return fourni.slice(0, 7);
  try {
    const head = readFileSync('.git/HEAD', 'utf8').trim();
    if (!head.startsWith('ref: ')) return head.slice(0, 7);
    const ref = head.slice(5);
    try {
      return readFileSync(`.git/${ref}`, 'utf8').trim().slice(0, 7);
    } catch {
      const ligne = readFileSync('.git/packed-refs', 'utf8').split('\n').find((l) => l.endsWith(` ${ref}`));
      return ligne ? ligne.slice(0, 7) : '';
    }
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  /**
   * Le dossier de sortie est réglable par l'environnement.
   *
   * `next build` et `next dev` écrivent tous les deux dans `.next` et se
   * marchent dessus : construire pendant qu'un serveur de développement tourne
   * fait échouer la construction (`Cannot find module '[turbopack]_runtime.js'`)
   * et, pire, oblige à couper le serveur qu'on est en train d'utiliser.
   *
   * `NEXT_DIST_DIR=.next-build npm run build` construit donc à côté, sans
   * toucher à rien. La valeur par défaut reste `.next` : la production et le
   * `Dockerfile` ne changent pas.
   */
  distDir: process.env['NEXT_DIST_DIR'] || '.next',
  /**
   * Un seul three, le moteur WebGPU (7 septembre 2026). Le rendu importe
   * `three/webgpu` ; les compléments de three (`three/addons/*`) importent
   * `three`, qui désignerait sinon le moteur WebGL et une **seconde copie** du
   * cœur — deux classes `Mesh`, et `instanceof` qui ment. Les deux chemins
   * pointent donc vers le même fichier, pour webpack (`next build`) comme pour
   * Turbopack (`next dev`). Les tests font pareil : `tests/aides/resoudre-three.mjs`.
   */
  turbopack: {
    resolveAlias: { three: 'three/webgpu' },
  },
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias ?? {}), three$: 'three/webgpu' };
    return config;
  },
  /**
   * La mention de version (`src/app/version.ts`) : l'instant du build et le
   * commit, inscrits dans les bundles. Elle change à chaque `next build`, donc à
   * chaque push que Coolify déploie — aucune action GitHub, aucun fichier généré.
   */
  env: {
    ATLAS_VERSION_DATE: new Date().toISOString(),
    ATLAS_VERSION_COMMIT: commitCourt(),
  },
};

export default nextConfig;
