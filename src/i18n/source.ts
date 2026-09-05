/**
 * Les chaînes d'interface **source**, en français, lues depuis
 * `content/i18n/interface.fr.json` (`09-i18n.md` §3.1).
 *
 * Elles sont importées statiquement, donc embarquées dans le bundle : une partie
 * doit pouvoir se jouer hors ligne, et le dernier repli de `t()` doit être
 * disponible sans réseau (`02-architecture.md` §3.5).
 *
 * Cette couche n'importe que `schemas` (`02-architecture.md` §5).
 */

import interfaceFr from '../../content/i18n/interface.fr.json';

/** Une chaîne d'interface source, telle qu'elle est écrite à la main. */
export interface ChaineInterface {
  cle: string;
  texte: string;
  contexte: { ecran?: string; locuteur?: string; note?: string };
  longueurMax: number | null;
  pluriel: boolean;
}

interface ChaineBrute {
  cle: string;
  texte: string;
  contexte?: { ecran?: string; locuteur?: string; note?: string };
  longueurMax?: number | null;
  pluriel?: boolean;
}

/** Les chaînes d'interface, normalisées et triées par clé. */
export const CHAINES_INTERFACE: readonly ChaineInterface[] = ((): ChaineInterface[] => {
  const brutes = (interfaceFr as { chaines: ChaineBrute[] }).chaines;
  return brutes
    .map((c) => ({
      cle: c.cle,
      texte: c.texte,
      contexte: c.contexte ?? {},
      longueurMax: c.longueurMax ?? null,
      pluriel: c.pluriel ?? false,
    }))
    .sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0));
})();

/** Le dictionnaire français plat : le dernier repli de `t()`. */
export const SOURCE_FR: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CHAINES_INTERFACE.map((c) => [c.cle, c.texte])),
);

/** Une chaîne source par sa clé. */
export function chaineSource(cle: string): ChaineInterface | undefined {
  return CHAINES_INTERFACE.find((c) => c.cle === cle);
}
