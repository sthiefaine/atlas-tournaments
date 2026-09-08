'use client';

/**
 * La vitrine des unités : une seule pièce, vue sous six angles à la fois —
 * face, profil gauche, profil droit, dos, dessus, et l'angle du jeu (68°).
 *
 * Le banc d'essai montre tout le catalogue dans une scène complète, ce qui est
 * ce qu'il faut pour juger un plateau et bien trop lent pour juger une figurine :
 * on y tourne autour d'une unité à coups de zoom, sans jamais la voir de face.
 * Ici, pas de terrain, pas de décor, pas de boucle d'animation : un socle, trois
 * lumières de studio, et un rendu **à la demande** — la scène ne se redessine
 * que lorsqu'un choix change ou que la fenêtre bouge.
 *
 * Six vues, un seul canevas : chaque tuile de la grille est un rectangle de
 * ciseaux du même moteur. Six contextes coûteraient six fois la géométrie et
 * les textures pour la même image. Le moteur est celui du jeu —
 * `WebGPURenderer`, WebGPU ou son dos WebGL 2, décidé avant de le construire
 * (`render3d/scene.ts`, `choisirBackend`) — et il s'initialise de façon
 * asynchrone : le studio expose `prete`, ne dessine rien avant, et redessine
 * de lui-même dès que le moteur est là.
 *
 * Depuis le préalable B0 de `doc/16-realisme.md` §3.1, la vitrine dit aussi
 * **ce qu'elle montre** — un modèle livré ou le placeholder —, laisse forcer un
 * niveau de détail, et joue les clips d'un modèle livré dans le même lecteur
 * que le jeu. La seule boucle est celle du lecteur : un
 * `requestAnimationFrame` tant qu'un clip joue, plus rien dès qu'on le fige.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import { chargerCatalogue } from '@/engine/index';
import { chargerCatalogueUnites, chargerPays } from '@/content/index';
import { chargerStyleNation } from '@/assets/styles';
import type { NiveauLod } from '@/assets/spec';
import { creerEnvironnement } from '@/render3d/environnement';
import { choisirBackend, creerMoteurWebGPU, moteur3dDisponible, type NavigateurGpu } from '@/render3d/scene';
import {
  Materiaux, chargerModele, construirePlaceholder, creerLecteurClips, forcerLod, monterModele,
  NOM_FIGURINE, NOMS_CLIPS, type LecteurClips, type NomClip,
} from '@/render3d/unites';
import type { CampId, CleUnite, CodePays } from '@/schemas/types';
import styles from './vitrine.module.css';

/** Les six angles, dans l'ordre où on les lit : les quatre élévations, le dessus, le jeu. */
const VUES = [
  { cle: 'face', titre: 'Face', ortho: true, direction: [1, 0, 0], haut: [0, 1, 0] },
  { cle: 'profil_gauche', titre: 'Profil gauche', ortho: true, direction: [0, 0, -1], haut: [0, 1, 0] },
  { cle: 'profil_droit', titre: 'Profil droit', ortho: true, direction: [0, 0, 1], haut: [0, 1, 0] },
  { cle: 'dos', titre: 'Dos', ortho: true, direction: [-1, 0, 0], haut: [0, 1, 0] },
  { cle: 'dessus', titre: 'Dessus', ortho: true, direction: [0, 1, 0], haut: [1, 0, 0] },
  { cle: 'jeu', titre: 'En jeu · 68°', ortho: false, direction: [0, Math.sin((68 * Math.PI) / 180), Math.cos((68 * Math.PI) / 180)], haut: [0, 1, 0] },
] as const;

type CleVue = (typeof VUES)[number]['cle'];

/** Ce que la vitrine sait de la pièce posée : livrée ou non, combien de niveaux, quels clips. */
interface EtatModele {
  livre: boolean;
  lods: number;
  /** Les clips connus que le fichier porte. */
  clips: NomClip[];
  /** Tous les noms de clips du fichier, connus ou non : on veut voir ce qu'on a reçu. */
  nomsFichier: string[];
}

const PLACEHOLDER: EtatModele = { livre: false, lods: 0, clips: [], nomsFichier: [] };

/** Ce que `window.__atlasVitrine` expose en développement, pour un pilotage Playwright. */
interface PontVitrine {
  choisir(unite: string, pays: string | null, camp: number): void;
  pret(): boolean;
  /** Ce qui est posé : un modèle livré ou le placeholder, ses niveaux, ses clips. */
  modele(): { livre: boolean; lods: number; clips: string[] };
}

/**
 * Les versions de catalogue qu'on peut regarder. La dernière est le défaut :
 * une unité homologuée ce matin doit être visible ici sans changer de menu, et
 * les anciennes restent pour comparer une silhouette à ce qu'elle était. La
 * liste se **déduit** de `content/unites.json` : écrite à la main, elle s'était
 * arrêtée au 5 pendant que le canon passait au 6, et le furtif n'y était pas.
 */
const VERSION_CANON = chargerCatalogueUnites().catalogueVersion;
const VERSIONS_CATALOGUE: readonly number[] = Array.from({ length: VERSION_CANON }, (_, i) => i + 1);

export default function Vitrine(): React.ReactElement {
  const [version, setVersion] = useState<number>(VERSION_CANON);
  const [unite, setUnite] = useState<string>('infanterie');
  const [pays, setPays] = useState<string>('fr');
  const [camp, setCamp] = useState<CampId>(0);
  const [moteur, setMoteur] = useState<boolean | null>(null);
  const [rendues, setRendues] = useState(0);
  const [etatModele, setEtatModele] = useState<EtatModele>(PLACEHOLDER);
  const [lod, setLod] = useState<NiveauLod | null>(null);
  const [clip, setClip] = useState<NomClip | null>(null);
  const [fige, setFige] = useState(false);
  const grille = useRef<HTMLDivElement | null>(null);
  const canevas = useRef<HTMLCanvasElement | null>(null);
  const tuiles = useRef<Map<CleVue, HTMLDivElement>>(new Map());
  const studio = useRef<Studio | null>(null);
  const piece = useRef<THREE.Object3D | null>(null);
  const lecteur = useRef<LecteurClips | null>(null);
  const image = useRef<number | null>(null);
  const dernier = useRef(0);
  const figeRef = useRef(false);

  const catalogue = useMemo(() => chargerCatalogue(version), [version]);
  const nations = useMemo(() => chargerPays().map((p) => ({ code: p.code, nom: p.nom })), []);
  const uniteSure: CleUnite = catalogue.cles.includes(unite as CleUnite) ? (unite as CleUnite) : catalogue.cles[0]!;

  useEffect(() => { setMoteur(moteur3dDisponible()); }, []);

  // Le studio vit aussi longtemps que le canevas ; la pièce, elle, change. Le
  // moteur arrive après : la première planche se dessine quand il est prêt,
  // et c'est cette image-là que `pret()` compte.
  useEffect(() => {
    const c = canevas.current;
    if (!c || moteur !== true) return undefined;
    const s = creerStudio(c);
    studio.current = s;
    s.prete.then(() => {
      if (studio.current !== s) return;
      if (s.dessiner(tuiles.current, grille.current)) setRendues((n) => n + 1);
    }).catch((cause: unknown) => {
      if (studio.current !== s) return;
      console.error('Moteur 3D indisponible', cause);
      setMoteur(false);
    });
    return () => { s.dispose(); studio.current = null; };
  }, [moteur]);

  const arreterBoucle = useCallback((): void => {
    if (image.current !== null) cancelAnimationFrame(image.current);
    image.current = null;
    dernier.current = 0;
  }, []);

  /** Fait tourner le lecteur tant qu'un clip joue, et plus une image au-delà. */
  const lancerBoucle = useCallback((): void => {
    if (image.current !== null) return;
    const pas = (t: number): void => {
      image.current = null;
      const l = lecteur.current;
      const s = studio.current;
      if (!l || !s) return;
      const dt = dernier.current === 0 ? 1 / 60 : Math.min(0.1, (t - dernier.current) / 1000);
      dernier.current = t;
      const encore = l.avancer(dt);
      s.dessiner(tuiles.current, grille.current);
      setClip((c) => (c === l.courant ? c : l.courant));
      if (encore && !figeRef.current) image.current = requestAnimationFrame(pas);
      else dernier.current = 0;
    };
    image.current = requestAnimationFrame(pas);
  }, []);

  useEffect(() => {
    const s = studio.current;
    if (!s) return undefined;
    let vivant = true;
    const style = pays === '' ? null : chargerStyleNation(pays as CodePays);
    const silhouette = catalogue.unites[uniteSure]!.silhouette;
    const placeholder = construirePlaceholder(silhouette, camp, s.materiaux, style, uniteSure);
    s.poser(placeholder);
    piece.current = placeholder;
    setEtatModele(PLACEHOLDER);
    setClip(null);
    if (s.dessiner(tuiles.current, grille.current)) setRendues((n) => n + 1);
    // Un modèle livré remplace le placeholder, monté comme en jeu — même socle,
    // même teinte, même lecteur de clips ; un 404 laisse tout en place.
    void chargerModele(uniteSure, pays === '' ? null : (pays as CodePays)).then((modele) => {
      if (!vivant || !modele) return;
      const monte = monterModele(modele, camp, s.materiaux, style);
      s.poser(monte);
      piece.current = monte;
      const figurine = monte.getObjectByName(NOM_FIGURINE);
      const l = figurine ? creerLecteurClips(figurine, modele.clips) : null;
      lecteur.current = l;
      setEtatModele({
        livre: true, lods: modele.lods, clips: l ? [...l.clips] : [], nomsFichier: modele.clips.map((c) => c.name),
      });
      s.dessiner(tuiles.current, grille.current);
      if (l) {
        l.jouer('repos');
        setClip(l.courant);
        figeRef.current = false;
        setFige(false);
        lancerBoucle();
      }
    });
    return () => {
      vivant = false;
      arreterBoucle();
      lecteur.current?.dispose();
      lecteur.current = null;
    };
    // `moteur` est dans les dépendances parce que le studio n'existe qu'une fois
    // le moteur détecté, dans un effet qui court après celui-ci au premier rendu.
  }, [catalogue, uniteSure, pays, camp, moteur, arreterBoucle, lancerBoucle]);

  // Le niveau forcé s'applique à la pièce posée, quelle qu'elle soit : sans
  // `THREE.LOD` dedans, il n'y a rien à forcer et rien ne change.
  useEffect(() => {
    const p = piece.current;
    const s = studio.current;
    if (!p || !s) return;
    forcerLod(p, lod);
    s.dessiner(tuiles.current, grille.current);
  }, [lod, etatModele]);

  useEffect(() => {
    const g = grille.current;
    if (!g || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(() => studio.current?.dessiner(tuiles.current, g));
    obs.observe(g);
    return () => obs.disconnect();
  }, [moteur]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const g = globalThis as unknown as { __atlasVitrine?: PontVitrine };
    g.__atlasVitrine = {
      choisir: (u, p, c) => { setUnite(u); setPays(p ?? ''); setCamp((c === 1 ? 1 : 0) as CampId); },
      pret: () => rendues > 0,
      modele: () => ({ livre: etatModele.livre, lods: etatModele.lods, clips: [...etatModele.clips] }),
    };
    return () => { delete g.__atlasVitrine; };
  }, [rendues, etatModele]);

  function jouerClip(nom: NomClip): void {
    const l = lecteur.current;
    if (!l) return;
    l.jouer(nom);
    setClip(l.courant);
    figeRef.current = false;
    setFige(false);
    lancerBoucle();
  }

  function basculerFige(): void {
    const prochain = !figeRef.current;
    figeRef.current = prochain;
    setFige(prochain);
    if (!prochain) lancerBoucle();
  }

  const fiche = catalogue.unites[uniteSure]!;
  const nation = nations.find((n) => n.code === pays);
  const sansClips = !etatModele.livre || etatModele.clips.length === 0;

  return <div className={styles.vitrine}>
    <header className={styles.barre}>
      <div className={styles.titre}>
        <div className={styles.ariane}><Link href="/">Atlas</Link><span>/</span><Link href="/atelier">Atelier</Link><span>/</span><span>Vitrine</span></div>
        <h1>{fiche.nom}{nation ? ` · ${nation.nom}` : ' · sans nation'}</h1>
      </div>
      <Link href="/atelier" className={styles.lien}>Banc d’essai</Link>
    </header>

    <div className={styles.commandes}>
      <label>Unité
        <select value={uniteSure} onChange={(e) => setUnite(e.target.value)}>
          {catalogue.cles.map((cle) => <option key={cle} value={cle}>{catalogue.unites[cle]!.nom}</option>)}
        </select>
      </label>
      <label>Nation
        <select value={pays} onChange={(e) => setPays(e.target.value)}>
          <option value="">Aucune (palette du camp)</option>
          {nations.map((n) => <option key={n.code} value={n.code}>{n.nom}</option>)}
        </select>
      </label>
      <fieldset className={styles.camp}>
        <legend>Camp</legend>
        <label><input type="radio" name="camp" checked={camp === 0} onChange={() => setCamp(0)} /> Bleu</label>
        <label><input type="radio" name="camp" checked={camp === 1} onChange={() => setCamp(1)} /> Rouge</label>
      </fieldset>
      <label>Catalogue
        <select value={version} onChange={(e) => setVersion(Number(e.target.value))}>
          {VERSIONS_CATALOGUE.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <p className={styles.legende}>
        Silhouette : {fiche.silhouette.base} · {fiche.silhouette.corps}
        {fiche.silhouette.modules.length > 0 ? ` · ${fiche.silhouette.modules.join(', ')}` : ''} · taille {fiche.silhouette.taille}
      </p>
    </div>

    <div className={styles.modele} data-livre={etatModele.livre ? 'oui' : 'non'}>
      <span className={styles.badge}>{etatModele.livre ? 'Modèle livré' : 'Placeholder'}</span>
      <label>Niveau de détail
        <select
          value={lod === null ? 'auto' : String(lod)}
          disabled={!etatModele.livre || etatModele.lods <= 1}
          onChange={(e) => setLod(e.target.value === 'auto' ? null : (Number(e.target.value) as NiveauLod))}
        >
          <option value="auto">Automatique</option>
          {[0, 1, 2].filter((i) => i < etatModele.lods).map((i) => <option key={i} value={i}>lod{i}</option>)}
        </select>
      </label>
      <fieldset className={styles.clips} disabled={sansClips}>
        <legend>Clips{etatModele.livre && etatModele.nomsFichier.length > 0 ? ` · fichier : ${etatModele.nomsFichier.join(', ')}` : ''}</legend>
        {NOMS_CLIPS.map((nom) => <button
          key={nom}
          type="button"
          disabled={!etatModele.clips.includes(nom)}
          aria-pressed={clip === nom}
          onClick={() => jouerClip(nom)}
        >{nom}</button>)}
        <button type="button" aria-pressed={fige} onClick={basculerFige}>{fige ? 'Figé' : 'Figer'}</button>
      </fieldset>
    </div>

    {/* Le moteur exige WebGPU depuis le 9 septembre 2026 : le repli WebGL 2 a été
        retiré (`doc/10`, « Correction du jeu WebGPU »). Sans adaptateur, la
        vitrine ne montrait qu'une ligne perdue au milieu d'une planche vide et
        de contrôles qui ne répondaient plus — le lecteur croyait à une panne du
        site. Elle prend maintenant la place de la planche, nomme ce qui manque,
        et dit quoi faire : un écran d'échec qui n'indique pas la sortie n'en est
        pas un. */}
    {moteur === false ? <div className={styles.sansWebgl} role="alert">
      <h2>Cette page a besoin de WebGPU</h2>
      <p>
        Le navigateur n’expose aucun adaptateur WebGPU, et le moteur n’a plus de repli WebGL 2 :
        il ne peut pas se monter. Le reste du site fonctionne ; c’est la 3D qui s’arrête ici.
      </p>
      <ul>
        <li><strong>Chrome</strong> ou <strong>Edge</strong> à jour, sur ordinateur : WebGPU y est actif par défaut.</li>
        <li><strong>Safari 26</strong> ou plus récent, sur macOS et iOS.</li>
        <li><strong>Firefox</strong> : WebGPU n’est pas encore actif par défaut, il faut passer <code>dom.webgpu.enabled</code> à vrai dans <code>about:config</code>.</li>
        <li>Sur une machine sans carte graphique — machine virtuelle, rendu logiciel —, aucun adaptateur n’est proposé, quel que soit le navigateur.</li>
      </ul>
    </div> : null}

    <div className={styles.planche} ref={grille} hidden={moteur === false}>
      <canvas ref={canevas} className={styles.canevas} aria-hidden="true" />
      {VUES.map((v) => <div
        key={v.cle}
        className={styles.tuile}
        ref={(el) => { if (el) tuiles.current.set(v.cle, el); else tuiles.current.delete(v.cle); }}
        data-vue={v.cle}
      >
        <span>{v.titre}</span>
      </div>)}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// Le studio : un canevas, une scène, six caméras
// ---------------------------------------------------------------------------

interface Studio {
  readonly materiaux: Materiaux;
  /** Tenue quand le moteur est initialisé ; rejetée s'il ne démarre pas. */
  readonly prete: Promise<void>;
  poser(piece: THREE.Object3D): void;
  /** Dessine la planche ; rend faux — et ne fait rien — tant que le moteur n'est pas prêt. */
  dessiner(tuiles: ReadonlyMap<CleVue, HTMLElement>, cadre: HTMLElement | null): boolean;
  dispose(): void;
}

/** Marge autour de la pièce dans chaque vue, en fraction de sa plus grande cote. */
const MARGE = 1.18;

function creerStudio(canvas: HTMLCanvasElement): Studio {
  let renderer: THREE.WebGPURenderer | null = null;
  let environnement: ReturnType<typeof creerEnvironnement> | null = null;
  let vivant = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e3f52);
  // La même pièce de studio que le jeu (`render3d/environnement.ts`), à
  // intensité fixe : c'est elle que la tôle et le verre d'une figurine
  // reflètent, et la vitrine doit montrer ce que le plateau montrera. La carte
  // se cuit avec le moteur, plus bas ; l'intensité est une propriété de la scène.
  scene.environmentIntensity = 0.35;

  // Le moteur, comme en jeu : le dos décidé avant de construire, `init()`
  // attendu, l'environnement cuit après. Le test de ciseaux ne se pose
  // qu'ensuite : sur le dos WebGL, il touche un contexte qui n'existe pas avant.
  const prete: Promise<void> = (async () => {
    await choisirBackend(globalThis.navigator as NavigateurGpu | undefined);
    if (!vivant) throw new Error('Studio démonté avant que le moteur soit prêt.');
    const r = creerMoteurWebGPU({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    await r.init();
    if (!vivant) {
      r.dispose();
      throw new Error('Studio démonté avant que le moteur soit prêt.');
    }
    r.setScissorTest(true);
    environnement = creerEnvironnement(r);
    scene.environment = environnement.texture;
    renderer = r;
  })();
  prete.catch(() => undefined);

  // Trois lumières de studio : le ciel, une clé qui porte l'ombre, un débouchage froid.
  scene.add(new THREE.HemisphereLight(0xe8f0f8, 0x55643f, 0.85));
  const cle = new THREE.DirectionalLight(0xfff2dc, 1.7);
  cle.position.set(2.4, 4.2, 1.6);
  cle.castShadow = true;
  cle.shadow.mapSize.set(1024, 1024);
  cle.shadow.bias = -0.0006;
  cle.shadow.normalBias = 0.02;
  const cam = cle.shadow.camera;
  cam.left = -1.2; cam.right = 1.2; cam.top = 1.2; cam.bottom = -1.2; cam.near = 0.5; cam.far = 12;
  scene.add(cle);
  const debouchage = new THREE.DirectionalLight(0xcfe0ff, 0.45);
  debouchage.position.set(-2.5, 1.5, -2);
  scene.add(debouchage);

  // Un disque d'herbe rase pour porter l'ombre : sans sol, une pièce flotte.
  const sol = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 48),
    new THREE.MeshStandardMaterial({ color: 0x7d9457, roughness: 0.95, metalness: 0 }),
  );
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);

  const support = new THREE.Group();
  scene.add(support);
  const materiaux = new Materiaux();
  // Le fond entre les tuiles : le moteur veut une `Color`, pas un entier.
  const fond = new THREE.Color(0x0c1b21);
  const boite = new THREE.Box3();
  const centre = new THREE.Vector3();
  const taille = new THREE.Vector3();

  function poser(piece: THREE.Object3D): void {
    for (const ancien of [...support.children]) support.remove(ancien);
    piece.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    support.add(piece);
    boite.setFromObject(support);
    boite.getCenter(centre);
    boite.getSize(taille);
  }

  function dessiner(tuiles: ReadonlyMap<CleVue, HTMLElement>, cadre: HTMLElement | null): boolean {
    if (!renderer || !cadre || support.children.length === 0) return false;
    const rectCadre = cadre.getBoundingClientRect();
    const largeur = Math.max(1, Math.round(rectCadre.width));
    const hauteur = Math.max(1, Math.round(rectCadre.height));
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    renderer.setSize(largeur, hauteur, false);
    renderer.setScissorTest(false);
    renderer.setClearColor(fond, 1);
    renderer.clear();
    renderer.setScissorTest(true);
    const rayon = Math.max(taille.x, taille.y, taille.z) / 2 * MARGE;
    for (const vue of VUES) {
      const tuile = tuiles.get(vue.cle);
      if (!tuile) continue;
      const r = tuile.getBoundingClientRect();
      const x = Math.round(r.left - rectCadre.left);
      const yHaut = Math.round(r.top - rectCadre.top);
      const l = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      // WebGL compte depuis le bas : l'origine de la tuile se mesure au bas du cadre.
      const y = hauteur - yHaut - h;
      renderer.setViewport(x, y, l, h);
      renderer.setScissor(x, y, l, h);
      const aspect = l / h;
      const direction = new THREE.Vector3(vue.direction[0], vue.direction[1], vue.direction[2]).normalize();
      let camera: THREE.Camera;
      if (vue.ortho) {
        const o = new THREE.OrthographicCamera(-rayon * aspect, rayon * aspect, rayon, -rayon, 0.01, 20);
        o.position.copy(centre).addScaledVector(direction, 6);
        o.up.set(vue.haut[0], vue.haut[1], vue.haut[2]);
        o.lookAt(centre);
        camera = o;
      } else {
        const p = new THREE.PerspectiveCamera(40, aspect, 0.05, 40);
        // La distance qui fait tenir la sphère englobante dans le champ vertical.
        const distance = rayon / Math.sin((20 * Math.PI) / 180) * (aspect < 1 ? 1 / aspect : 1);
        p.position.copy(centre).addScaledVector(direction, distance);
        p.up.set(0, 1, 0);
        p.lookAt(centre);
        camera = p;
      }
      renderer.render(scene, camera);
    }
    return true;
  }

  return {
    materiaux,
    prete,
    poser,
    dessiner,
    dispose: () => {
      vivant = false;
      scene.environment = null;
      environnement?.dispose();
      environnement = null;
      // Un moteur non initialisé ne se libère pas ici : la chaîne
      // d'initialisation le jette elle-même en trouvant le studio démonté.
      renderer?.dispose();
      renderer = null;
      sol.geometry.dispose();
      (sol.material as THREE.Material).dispose();
    },
  };
}
