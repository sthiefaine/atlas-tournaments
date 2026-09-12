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
      {!local ? <p role="note"><strong>Dépôt indisponible sur ce site.</strong> Copiez le prompt et demandez à votre agent de livrer les fichiers dans le projet, puis de les versionner et déployer. Le contrôle et la revue s’effectuent en développement.</p> : <p>Sélectionnez ensemble les GLB et les PNG du lot. Le contrôle démarre dès la sélection.</p>}
      <div>
        <button
          type="button"
          onClick={() => void copier()}
          className="border border-current px-3 py-2 text-sm hover:opacity-70"
        >
          {copie ? 'Commande copiée' : 'Copier la commande'}
        </button>
        <span className="ml-3 text-xs admin-secondaire">
          À coller dans le générateur, telle quelle. Elle est composée depuis la fiche : les noms et les dimensions doivent rester ceux du contrat.
        </span>
      </div>

      <details><summary>Commande alternative pour un générateur externe</summary><pre className="max-h-80 overflow-auto border border-current/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">{commande}</pre></details>

      <div>
        <label className="block text-sm">
          <span className="mb-1 block admin-secondaire">Déposer les fichiers livrés</span>
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
        <p className="mt-2 text-xs admin-secondaire">
          {!local ? "Dépôt disponible en développement uniquement ; versionner les fichiers avant déploiement. " : "24 Mio par fichier, 96 Mio par lot. "}
          Noms attendus : <span className="font-mono">{attendus.join(', ')}</span>.
          {' '}Un fichier dont le nom n’est pas dans cette liste n’est pas écrit — le dépôt ne reprend jamais un nom reçu.
        </p>
      </div>

      {envoi ? <p className="text-sm admin-secondaire">Contrôle en cours…</p> : null}

      {verdict ? (
        <div role="status" className="border border-current/30 p-3 text-sm">
          <p className={verdict.ok ? '' : 'admin-secondaire'}>
            <strong>{verdict.ok ? 'Conforme techniquement et déposé' : 'Refusé'}</strong>
            {verdict.ok && verdict.ecrits ? ` — ${verdict.ecrits.length} fichier(s) écrit(s).` : null}
          </p>
          {verdict.detail ? <p className="mt-1 text-xs admin-secondaire">{verdict.detail}</p> : null}
          {verdict.motifs.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {verdict.motifs.map((m, i) => <li key={i}>{m.code} — {m.detail}</li>)}
            </ul>
          ) : null}
          {verdict.inconnus.length > 0 ? (
            <p className="mt-2 text-xs admin-secondaire">
              Refusés, nom inattendu : <span className="font-mono">{verdict.inconnus.join(', ')}</span>
            </p>
          ) : null}
          {verdict.ok ? (
            <p className="mt-2 text-xs admin-secondaire">
              Le lot est réceptionné. L’approbation artistique et l’essai en jeu restent à confirmer dans l’étape suivante.
              {' '}<strong>Commiter le fichier</strong> : <span className="font-mono">public/</span> est cuit dans l’image, un dépôt non commité disparaît au déploiement suivant.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
