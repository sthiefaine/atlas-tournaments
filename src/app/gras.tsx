/**
 * Le **gras** des scénaristes dans une page : `**texte**` devient un `<b>`,
 * par `segmenter` (`render/gras.ts`) — jamais un `innerHTML` sur le texte brut.
 * Sans état ni effet : sert aussi bien à un composant serveur qu'à un client.
 */
import { segmenter } from '@/render/gras';

export function Gras({ texte }: { texte: string }): React.ReactElement {
  return <>{segmenter(texte).map((s, i) => (s.gras ? <b key={i}>{s.texte}</b> : <span key={i}>{s.texte}</span>))}</>;
}
