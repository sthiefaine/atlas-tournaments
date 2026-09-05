import type { NextConfig } from "next";

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
};

export default nextConfig;
