/**
 * Le **gras** et les **pictogrammes** des scénaristes dans une page : `**texte**`
 * devient un `<b>`, `[[img:cle]]` la vignette de `render/illustrations.ts`, par
 * `segmenterRiche` — jamais un `innerHTML` posé sur le texte brut.
 *
 * Le seul `dangerouslySetInnerHTML` du composant ne porte **que** le SVG rendu
 * par `illustrationSvg` : une chaîne composée par notre propre code pur à partir
 * d'une clé de la liste fermée, jamais un morceau de contenu. Le texte, lui,
 * reste du texte que React échappe.
 *
 * Sans état ni effet : sert aussi bien à un composant serveur qu'à un client.
 */
import { CLASSE_PICTOGRAMME, illustrationSvg, segmenterRiche } from '@/render/illustrations';
import type { CleIllustration } from '@/schemas/types';

/** Un pictogramme dans une phrase. Le nom accessible est déjà traduit. */
function Pictogramme({ cle, nom }: { cle: CleIllustration; nom?: string }): React.ReactElement {
  return (
    <span
      className={CLASSE_PICTOGRAMME}
      dangerouslySetInnerHTML={{
        __html: illustrationSvg(cle, nom !== undefined ? { titre: nom } : {}),
      }}
    />
  );
}

/**
 * `nomIllustration` traduit `illustration.<cle>` ; sans lui les vignettes sont
 * décoratives et se taisent — c'est le bon défaut pour une page dont la phrase
 * dit déjà ce que l'image montre.
 */
export function Gras(
  { texte, nomIllustration }: { texte: string; nomIllustration?: (cle: CleIllustration) => string },
): React.ReactElement {
  return (
    <>
      {segmenterRiche(texte).map((s, i) => {
        if (s.genre === 'image') {
          const nom = nomIllustration ? nomIllustration(s.cle) : undefined;
          const image = nom !== undefined
            ? <Pictogramme cle={s.cle} nom={nom} />
            : <Pictogramme cle={s.cle} />;
          return s.gras ? <b key={i}>{image}</b> : <span key={i}>{image}</span>;
        }
        return s.gras ? <b key={i}>{s.texte}</b> : <span key={i}>{s.texte}</span>;
      })}
    </>
  );
}
