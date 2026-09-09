'use client';

/**
 * La commande et le dépôt, sur la fiche d'un asset.
 *
 * C'est le seul endroit du site où le cycle entier d'un asset se joue : on
 * copie la commande, on la donne à un générateur, on rapporte le `.glb` et ses
 * textures, on les dépose, et le jeu les prend au prochain chargement de page.
 * Avant, ce cycle passait par trois outils et un fichier posé à la main dans
 * `public/assets/modeles/`.
 *
 * Client parce qu'il faut le presse-papiers et un envoi de fichiers ; la
 * commande, elle, est composée **sur le serveur** depuis la fiche et arrive
 * toute faite : rien de la spécification n'entre dans le paquet du navigateur.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Ce que la route de dépôt répond. */
interface Verdict {
  ok: boolean;
  motifs: { code: string; detail: string }[];
  acceptes: string[];
  inconnus: string[];
  ecrits?: string[];
  detail?: string;
}

export function Livraison({ id, commande, attendus, local = true }: {
  id: string;
  local?: boolean;
  commande: string;
  attendus: readonly string[];
}) {
  const router = useRouter();
  const [copie, setCopie] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  async function copier() {
    try {
      await navigator.clipboard.writeText(commande);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Sans presse-papiers — page servie en clair, permission refusée —, le
      // texte reste sélectionnable dans le bloc ci-dessous : rien n'est perdu.
      setCopie(false);
    }
  }

  async function deposer(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setEnvoi(true);
    setVerdict(null);
    const corps = new FormData();
    corps.set('id', id);
    for (const f of Array.from(fichiers)) corps.append('fichiers', f);
    try {
      const reponse = await fetch('/api/admin/modeles', { method: 'POST', body: corps });
      const brut = await reponse.json() as Partial<Verdict>;
      const resultat = { ok: false, motifs: [], acceptes: [], inconnus: [], ...brut };
      setVerdict(resultat);
      if (resultat.ok) router.refresh();
    } catch (cause) {
      setVerdict({ ok: false, motifs: [], acceptes: [], inconnus: [], detail: String(cause) });
    } finally {
      setEnvoi(false);
      if (champ.current) champ.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => void copier()}
          className="border border-current px-3 py-2 text-sm hover:opacity-70"
        >
          {copie ? 'Commande copiée' : 'Copier la commande'}
        </button>
        <span className="ml-3 text-xs opacity-60">
          À coller dans le générateur, telle quelle. Elle est composée depuis la fiche : les noms et les dimensions doivent rester ceux du contrat.
        </span>
      </div>

      <pre className="max-h-80 overflow-auto border border-current/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">{commande}</pre>

      <div>
        <label className="block text-sm">
          <span className="mb-1 block opacity-80">Déposer les fichiers livrés</span>
          <input
            ref={champ}
            type="file"
            multiple
            accept=".glb,.png"
            disabled={envoi || !local}
            onChange={(e) => void deposer(e.target.files)}
            className="text-sm"
          />
        </label>
        <p className="mt-2 text-xs opacity-60">
          {!local ? "Dépôt disponible en développement uniquement ; versionner les fichiers avant déploiement. " : "24 Mio par fichier, 96 Mio par lot. "}
          Noms attendus : <span className="font-mono">{attendus.join(', ')}</span>.
          {' '}Un fichier dont le nom n’est pas dans cette liste n’est pas écrit — le dépôt ne reprend jamais un nom reçu.
        </p>
      </div>

      {envoi ? <p className="text-sm opacity-70">Contrôle en cours…</p> : null}

      {verdict ? (
        <div className="border border-current/30 p-3 text-sm">
          <p className={verdict.ok ? '' : 'opacity-90'}>
            <strong>{verdict.ok ? 'Conforme techniquement et déposé' : 'Refusé'}</strong>
            {verdict.ok && verdict.ecrits ? ` — ${verdict.ecrits.length} fichier(s) écrit(s).` : null}
          </p>
          {verdict.detail ? <p className="mt-1 text-xs opacity-70">{verdict.detail}</p> : null}
          {verdict.motifs.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {verdict.motifs.map((m, i) => <li key={i}>{m.code} — {m.detail}</li>)}
            </ul>
          ) : null}
          {verdict.inconnus.length > 0 ? (
            <p className="mt-2 text-xs opacity-70">
              Refusés, nom inattendu : <span className="font-mono">{verdict.inconnus.join(', ')}</span>
            </p>
          ) : null}
          {verdict.ok ? (
            <p className="mt-2 text-xs opacity-70">
              Le jeu et <span className="font-mono">/atelier/unites</span> les prennent au prochain chargement.
              {' '}<strong>Commiter le fichier</strong> : <span className="font-mono">public/</span> est cuit dans l’image, un dépôt non commité disparaît au déploiement suivant.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
