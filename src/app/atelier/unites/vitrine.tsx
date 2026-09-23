'use client';

/**
 * La **vitrine des images cuites** : pour une unité, un bâtiment ou un décor,
 * toutes ses vues et tous ses clips, tels que le jeu les pose. C'est ici que le
 * propriétaire juge les sprites (décision du 23 septembre 2026, `BRIEF.md`,
 * « Sprites précalculés ») ; elle remplace les six angles 3D d'un modèle, qui
 * montraient une source, pas ce que le joueur voit.
 *
 * Elle lit **le manifeste du jeu** (`CHEMIN_MANIFESTE`) par le lecteur de la
 * peau (`lireManifeste`) : un manifeste refusé l'est ici comme en jeu, et la
 * vitrine dit pourquoi au lieu de se taire dans la console. Chaque animation se
 * joue dans sa toile — une vignette 2D, sans WebGL (`render2d/vignette.ts`) —
 * à la couleur d'équipe choisie, par la formule du nuanceur du jeu ; une entrée
 * absente du manifeste montre son **repli**, le dessin que le jeu poserait à sa
 * place. Un clip qui ne boucle pas — un tir, une capture — se rejoue après une
 * pause : en jeu il ne passe qu'une fois, ici on le manquerait.
 *
 * Toutes les toiles d'une entrée partagent une même enveloppe : le pivot — le
 * pied, au centre de la case — tombe au même endroit d'une vue à l'autre, et
 * l'échelle est commune. L'échelle se choisit en pixels par case, de 48 — le
 * plus petit que le jeu montre — à 256, la loupe : ce qu'on regarde se compare.
 *
 * Instrument d'auteur : ses libellés sont écrits en clair, comme ceux du banc
 * (`atelier.tsx`) ; il n'est pas traduit et n'a pas à l'être.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { chargerStylesNations } from '@/assets/styles';
import { chargerCatalogue, type Catalogue } from '@/engine/index';
import { nomTerrain, nomUnite } from '@/render/libelles';
import { echelleTaille } from '@/render/sprites/silhouettes';
import { chargerImageNavigateur, lireManifeste } from '@/render2d/atlas';
import {
  CHEMIN_MANIFESTE, ESSENCES_DECOR, idBatiment, idDecor, idUnite, PIXELS_PAR_CASE,
  type AnimationSprite, type EntreeSprite, type FamilleSprite, type ManifesteSprites,
} from '@/render2d/contrat';
import { creerPeintreRepli, fabriqueToileDocument } from '@/render2d/replis';
import {
  animationsOrdonnees, couleurEquipe, enveloppeEntree, enveloppeImage, LecteurVignettes, Vignettes,
  type Enveloppe, type ImagePrete,
} from '@/render2d/vignette';
import type { Rvb } from '@/render2d/unites';
import { TERRAINS_CAPTURABLES, type CampId, type CleTerrain, type CleUnite, type CodePays } from '@/schemas/types';

import { lirePreferences } from '../../preferences';
import styles from './vitrine.module.css';

/** Ce qu'on sait du manifeste : lu, absent, refusé — et pourquoi. */
type EtatManifeste =
  | { etat: 'lecture' }
  | { etat: 'absent' }
  | { etat: 'refuse'; motif: string }
  | { etat: 'lu'; manifeste: ManifesteSprites; ecartees: readonly string[] };

/** Une pièce qu'on peut regarder : une entrée cuite, ou le nom qu'elle aurait. */
interface Piece {
  id: string;
  libelle: string;
  cuite: boolean;
  /** Pour une unité : sa taille de silhouette et si elle vole — son ombre en dépend. */
  ombre?: { taille: number; air: boolean };
}

const FAMILLES: readonly (readonly [FamilleSprite, string])[] = [
  ['unite', 'Unités'], ['batiment', 'Bâtiments'], ['decor', 'Décor'], ['terrain', 'Terrain'],
];

/** Les échelles proposées, en pixels d'écran par case. */
const ECHELLES: readonly (readonly [number, string])[] = [
  [48, '48 px — le plus petit en jeu'], [64, '64 px — l’ouverture'], [96, '96 px — le double-tap'],
  [128, '128 px — un pour un'], [256, '256 px — la loupe'],
];

/** Les fonds : celui du jeu, une herbe, un damier qui montre les bords transparents. */
const FONDS: readonly (readonly [string, string])[] = [['sombre', 'Sombre'], ['herbe', 'Herbe'], ['damier', 'Damier']];

/** Les couleurs d'équipe qu'on peut poser : neutre, puis les quatre camps. */
const CAMPS: readonly (readonly [CampId | null, string])[] = [
  [null, 'Neutre'], [0, 'Camp 1'], [1, 'Camp 2'], [2, 'Camp 3'], [3, 'Camp 4'],
];

/** La marge autour de l'enveloppe d'une toile, en pixels CSS. */
const MARGE = 10;

/** Le manifeste du jeu, lu comme le jeu le lit — mais en disant ce qu'on en a fait. */
async function lireManifesteDuJeu(): Promise<EtatManifeste> {
  try {
    const reponse = await fetch(CHEMIN_MANIFESTE, { cache: 'no-cache' });
    if (!reponse.ok) return { etat: 'absent' };
    const lu = lireManifeste(await reponse.json());
    return lu.ok ? { etat: 'lu', manifeste: lu.manifeste, ecartees: lu.ecartees } : { etat: 'refuse', motif: lu.motif };
  } catch {
    return { etat: 'absent' };
  }
}

/** Les pièces d'une famille : ce que le jeu peut demander, cuit ou non, et ce que la cuisson a produit en plus. */
function piecesDe(famille: FamilleSprite, m: ManifesteSprites | null, cat: Catalogue): Piece[] {
  const entrees = Object.values(m?.entrees ?? {}).filter((e) => e.famille === famille);
  const cuites = new Set(entrees.map((e) => e.id));
  const variante = (e: EntreeSprite): string => (e.variante ? ` · ${e.variante.toUpperCase()}` : '');
  switch (famille) {
    case 'unite': {
      const unites = Object.values(cat.unites);
      const ombre = (cle: string): { taille: number; air: boolean } | undefined => {
        const u = cat.unites[cle as CleUnite];
        return u ? { taille: echelleTaille(u.silhouette.taille), air: u.domaine === 'air' } : undefined;
      };
      const bases = unites.map((u): Piece => ({
        id: idUnite(u.cle), libelle: nomUnite('fr', cat, u.cle), cuite: cuites.has(idUnite(u.cle)), ...(ombre(u.cle) ? { ombre: ombre(u.cle)! } : {}),
      }));
      const kits = entrees.filter((e) => !bases.some((b) => b.id === e.id)).map((e): Piece => ({
        id: e.id, libelle: `${nomUnite('fr', cat, e.cle as CleUnite) || e.cle}${variante(e)}`, cuite: true,
        ...(ombre(e.cle) ? { ombre: ombre(e.cle)! } : {}),
      }));
      return [...bases, ...kits];
    }
    case 'batiment': {
      const bases = TERRAINS_CAPTURABLES.map((cle): Piece => ({
        id: idBatiment(cle), libelle: nomTerrain('fr', cat, cle as CleTerrain) || cle, cuite: cuites.has(idBatiment(cle)),
      }));
      const nationaux = entrees.filter((e) => !bases.some((b) => b.id === e.id)).map((e): Piece => ({
        id: e.id, libelle: `${nomTerrain('fr', cat, e.cle as CleTerrain) || e.cle}${variante(e)}`, cuite: true,
      }));
      return [...bases, ...nationaux];
    }
    case 'decor': {
      const presentes = entrees.map((e): Piece => ({ id: e.id, libelle: e.id.replace(/^decor_/, '').replaceAll('_', ' '), cuite: true }));
      // Une essence que la cuisson n'a pas encore produite se montre en repli :
      // c'est ce que le sol posera à sa place.
      const manquantes = ESSENCES_DECOR.filter((essence) => !entrees.some((e) => e.cle === essence))
        .map((essence): Piece => ({ id: idDecor(essence, 'ete', 1), libelle: `${essence.replaceAll('_', ' ')} (attendue)`, cuite: false }));
      return [...presentes.sort((a, b) => a.id.localeCompare(b.id)), ...manquantes];
    }
    default:
      return entrees.map((e): Piece => ({ id: e.id, libelle: e.id.replaceAll('_', ' '), cuite: true }));
  }
}

/** Une toile animée : une animation d'une entrée (ou son repli), à une couleur. */
function Toile({ lecteur, id, animation, miroir, equipe, echelle, enveloppe, ombre, titre }: {
  lecteur: LecteurVignettes;
  id: string;
  animation: number;
  miroir: boolean;
  equipe: Rvb | null;
  /** Pixels CSS par pixel de plan. */
  echelle: number;
  enveloppe: Enveloppe | null;
  ombre: { taille: number; air: boolean } | null;
  titre: string;
}): React.ReactElement {
  const toile = useRef<HTMLCanvasElement>(null);
  const compteur = useRef<HTMLSpanElement>(null);
  const tuile = useRef<HTMLElement>(null);
  useEffect(() => {
    const c = toile.current;
    if (!c) return undefined;
    return lecteur.ajouter({
      toile: c, id, animation, equipe, miroir, zoom: echelle, marge: MARGE, enveloppe, ombre,
      // Le compteur et la source s'écrivent dans le DOM, pas dans l'état de
      // React : une douzaine de toiles à douze images par seconde ne doivent
      // pas refaire la page.
      surImage: (image: number, peinte: ImagePrete | null) => {
        if (compteur.current) compteur.current.textContent = String(image + 1);
        if (tuile.current) {
          tuile.current.dataset['image'] = String(image);
          tuile.current.dataset['source'] = peinte ? (peinte.repli ? 'repli' : 'cuite') : 'aucune';
        }
      },
    });
  }, [lecteur, id, animation, equipe, miroir, echelle, enveloppe, ombre]);
  // La toile a la taille de l'enveloppe à l'échelle choisie : toutes les toiles
  // d'une entrée ont donc la même, et le pivot au même endroit.
  const l = enveloppe ? Math.ceil((enveloppe.droite - enveloppe.gauche) * echelle + 2 * MARGE) : 160;
  const h = enveloppe ? Math.ceil((enveloppe.bas - enveloppe.haut) * echelle + 2 * MARGE) : 140;
  return <figure ref={tuile} className={styles.tuile} data-image="0" data-source="aucune">
    <canvas ref={toile} className={styles.toile} style={{ width: `${l}px`, height: `${h}px` }} role="img" aria-label={titre} />
    <figcaption><span>{titre}</span> <b>image <span ref={compteur}>1</span></b></figcaption>
  </figure>;
}

/** La légende d'une animation : sa vue, son clip, son nombre d'images et sa cadence. */
function legende(a: AnimationSprite, miroir: boolean): string {
  const vue = miroir ? 'gauche (droite retournée)' : a.vue;
  const cadence = Math.round(a.ips * 10) / 10;
  return `${vue} · ${a.clip} — ${a.cadres.length} image${a.cadres.length > 1 ? 's' : ''}, ${cadence} i/s, ${a.boucle ? 'en boucle' : 'une fois'}`;
}

export default function VitrineImages(): React.ReactElement {
  const catalogue = useMemo(() => chargerCatalogue(), []);
  const nations = useMemo(() => chargerStylesNations().map((s) => s.code), []);
  const [manifeste, setManifeste] = useState<EtatManifeste>({ etat: 'lecture' });
  const [outils, setOutils] = useState<{ reserve: Vignettes; lecteur: LecteurVignettes } | null>(null);
  const [famille, setFamille] = useState<FamilleSprite>('unite');
  const [choix, setChoix] = useState<string>(idUnite('infanterie'));
  const [camp, setCamp] = useState<CampId | null>(0);
  const [pays, setPays] = useState<CodePays | ''>('');
  const [comparer, setComparer] = useState(false);
  const [gauche, setGauche] = useState(false);
  const [ombre, setOmbre] = useState(true);
  const [pixels, setPixels] = useState(128);
  const [fond, setFond] = useState('sombre');
  const [lecture, setLecture] = useState(true);

  // La réserve et le lecteur naissent avec la page et meurent avec elle. Une
  // vitrine montre une entrée entière, toutes couleurs comprises : son plafond
  // est plus haut que celui d'un carnet.
  useEffect(() => {
    const fabrique = fabriqueToileDocument(document);
    const reserve = new Vignettes({
      charger: chargerImageNavigateur, fabrique,
      peintre: creerPeintreRepli(fabrique, () => catalogue),
      // Le catalogue dit ce qui flotte : l'écume sous un navire, comme en jeu.
      domaine: (cle) => catalogue.unites[cle]?.domaine ?? null,
      plafondPixels: 12_000_000,
    });
    const lecteur = new LecteurVignettes(reserve);
    // Le réglage de l'appareil ou du joueur arrête la lecture au départ ; le
    // bouton la relance, puisqu'on vient ici pour regarder bouger.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches || lirePreferences().animationsReduites;
    setLecture(!reduit);
    lecteur.lire(!reduit);
    setOutils({ reserve, lecteur });
    let vivant = true;
    void lireManifesteDuJeu().then((m) => {
      if (!vivant) return;
      if (m.etat === 'lu') reserve.poserManifeste(m.manifeste);
      setManifeste(m);
    });
    return () => {
      vivant = false;
      lecteur.dispose();
      reserve.dispose();
      setOutils(null);
    };
  }, [catalogue]);

  useEffect(() => { outils?.lecteur.lire(lecture); }, [outils, lecture]);

  const m = manifeste.etat === 'lu' ? manifeste.manifeste : null;
  const pieces = useMemo(() => piecesDe(famille, m, catalogue), [famille, m, catalogue]);
  const piece = pieces.find((p) => p.id === choix) ?? pieces[0] ?? null;
  const entree = piece && m ? m.entrees[piece.id] ?? null : null;

  // Une entrée entière se prépare d'un coup : toutes ses pages, lues une fois.
  useEffect(() => {
    if (outils && entree) void outils.reserve.preparer(entree.id);
  }, [outils, entree]);

  const couleurs = useMemo<readonly { libelle: string; equipe: Rvb }[]>(() => (comparer
    ? CAMPS.map(([c, nom]) => ({ libelle: nom, equipe: couleurEquipe(c) }))
    : [{ libelle: CAMPS.find(([c]) => c === camp)?.[1] ?? '', equipe: couleurEquipe(camp, pays || null) }]), [comparer, camp, pays]);

  // Les toiles de l'entrée : chaque animation dans l'ordre des vues et des
  // clips, la gauche en plus si on la demande ; une entrée absente, son repli.
  const echelle = pixels / PIXELS_PAR_CASE;
  const rangees = useMemo(() => {
    if (!entree) return [];
    const liste: { cle: string; animation: number; miroir: boolean; titre: string }[] = [];
    for (const { index, animation } of animationsOrdonnees(entree)) {
      liste.push({ cle: `${index}`, animation: index, miroir: false, titre: legende(animation, false) });
      if (gauche && animation.vue === 'droite') liste.push({ cle: `${index}g`, animation: index, miroir: true, titre: legende(animation, true) });
    }
    return liste;
  }, [entree, gauche]);
  const echelleImages = m ? PIXELS_PAR_CASE / m.pixelsParCase : 1;
  const enveloppe = useMemo(() => (entree ? enveloppeEntree(entree, echelleImages, false) : null), [entree, echelleImages]);
  const enveloppeGauche = useMemo(() => (entree ? enveloppeEntree(entree, echelleImages, true) : null), [entree, echelleImages]);
  // Le repli se cadre sur lui-même : on le peint une fois pour connaître sa taille.
  const repli = useMemo(() => (outils && piece && !entree ? outils.reserve.repli(piece.id, couleurs[0]?.equipe ?? null) : null), [outils, piece, entree, couleurs]);
  const enveloppeRepli = repli ? enveloppeImage(repli, repli.echelle) : null;
  const ombreDe = ombre ? piece?.ombre ?? null : null;

  const etatManifeste = manifeste.etat === 'lecture' ? 'Lecture du manifeste…'
    : manifeste.etat === 'absent' ? 'Aucun manifeste : le jeu se joue tout en replis, et la vitrine les montre.'
      : manifeste.etat === 'refuse' ? `Manifeste refusé par le jeu : ${manifeste.motif}. Tout se joue en replis.`
        : `Manifeste lu : ${Object.keys(manifeste.manifeste.entrees).length} entrées cuites${manifeste.ecartees.length > 0 ? ` — écartées par le jeu : ${manifeste.ecartees.join(', ')}` : ''}.`;

  return <main className={styles.vitrine} data-vitrine="cuite" data-manifeste={manifeste.etat}>
    <header className={styles.barre}>
      <div className={styles.titre}>
        <nav aria-label="Fil d’Ariane" className={styles.ariane}><Link href="/">Atlas</Link><span aria-hidden="true">/</span><Link href="/atelier">Banc d’essai</Link><span aria-hidden="true">/</span><span>Images cuites</span></nav>
        <h1>Vitrine des images cuites</h1>
      </div>
      <Link href="/atelier" className={styles.lien}>← Le banc</Link>
    </header>

    <p className={styles.etat} role="status" data-etat={manifeste.etat}>{etatManifeste}</p>

    <div className={styles.commandes}>
      <label>Famille
        <select value={famille} onChange={(e) => { const f = e.target.value as FamilleSprite; setFamille(f); setChoix(piecesDe(f, m, catalogue)[0]?.id ?? ''); }}>
          {FAMILLES.map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
        </select>
      </label>
      <label>Pièce
        <select value={piece?.id ?? ''} onChange={(e) => setChoix(e.target.value)} data-choix="piece">
          {pieces.map((p) => <option key={p.id} value={p.id}>{p.libelle}{p.cuite ? '' : ' — repli'}</option>)}
        </select>
      </label>
      <fieldset className={styles.groupe} disabled={comparer}>
        <legend>Couleur d’équipe</legend>
        {CAMPS.map(([c, nom]) => <button key={nom} type="button" aria-pressed={camp === c} onClick={() => setCamp(c)}>{nom}</button>)}
      </fieldset>
      <label>Nation
        <select value={pays} onChange={(e) => setPays(e.target.value as CodePays | '')} disabled={comparer || camp === null}>
          <option value="">Aucune (palette du camp)</option>
          {nations.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
        </select>
      </label>
      <label>Échelle
        <select value={pixels} onChange={(e) => setPixels(Number(e.target.value))}>
          {ECHELLES.map(([px, nom]) => <option key={px} value={px}>{nom}</option>)}
        </select>
      </label>
      <fieldset className={styles.groupe}>
        <legend>Fond</legend>
        {FONDS.map(([cle, nom]) => <button key={cle} type="button" aria-pressed={fond === cle} onClick={() => setFond(cle)}>{nom}</button>)}
      </fieldset>
      <fieldset className={styles.groupe}>
        <legend>Montrer</legend>
        <button type="button" aria-pressed={lecture} onClick={() => setLecture((v) => !v)}>{lecture ? 'Pause' : 'Lire'}</button>
        <button type="button" aria-pressed={comparer} onClick={() => setComparer((v) => !v)}>Tous les camps</button>
        <button type="button" aria-pressed={gauche} onClick={() => setGauche((v) => !v)}>La gauche</button>
        <button type="button" aria-pressed={ombre} onClick={() => setOmbre((v) => !v)} disabled={!piece?.ombre}>Ombre du jeu</button>
      </fieldset>
    </div>

    {piece ? <section className={styles.fiche} data-cuite={entree ? 'oui' : 'non'} aria-label="Fiche de l’entrée">
      <strong>{piece.id}</strong>
      {entree ? <>
        <span>{entree.famille} · {entree.cle}{entree.variante ? ` · ${entree.variante}` : ''}</span>
        <span>source {entree.source.fichier} · {entree.source.sha256.slice(0, 12)}</span>
        <span>{entree.pages.map((p) => `${p.largeur}×${p.hauteur}${p.masque ? ' + masque' : ''}${p.emission ? ' + émission' : ''}`).join(' · ')}</span>
        <span>{entree.animations.length} animations · {entree.animations.reduce((n, a) => n + a.cadres.length, 0)} images</span>
      </> : <span>Aucune image cuite : le jeu pose ce repli à sa place, peint par le code.</span>}
    </section> : null}

    {outils && piece ? <section className={styles.planche} data-fond={fond} aria-label="Les images de l’entrée">
      {(entree ? rangees : [{ cle: 'repli', animation: -1, miroir: false, titre: 'repli — dessiné par le code' }]).map((r) => (
        <div key={`${piece.id}:${r.cle}`} className={styles.rangee}>
          {couleurs.map((c) => <Toile
            key={c.libelle}
            lecteur={outils.lecteur}
            id={piece.id}
            animation={r.animation}
            miroir={r.miroir}
            equipe={c.equipe}
            echelle={echelle}
            enveloppe={entree ? (r.miroir ? enveloppeGauche : enveloppe) : enveloppeRepli}
            ombre={ombreDe}
            titre={comparer ? `${r.titre} · ${c.libelle}` : r.titre}
          />)}
        </div>
      ))}
    </section> : null}
  </main>;
}
