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
 * ciseaux du même contexte WebGL. Six contextes coûteraient six fois la
 * géométrie et les textures pour la même image.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { chargerCatalogue } from '@/engine/index';
import { chargerPays } from '@/content/index';
import { chargerStyleNation } from '@/assets/styles';
import { creerEnvironnement } from '@/render3d/environnement';
import { Materiaux, chargerModele, construirePlaceholder, teinterModele } from '@/render3d/unites';
import { webgl2Disponible } from '@/render/rendu';
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

/** Ce que `window.__atlasVitrine` expose en développement, pour un pilotage Playwright. */
interface PontVitrine {
  choisir(unite: string, pays: string | null, camp: number): void;
  pret(): boolean;
}

const VERSIONS_CATALOGUE = [1, 2, 3] as const;

export default function Vitrine(): React.ReactElement {
  const [version, setVersion] = useState<number>(3);
  const [unite, setUnite] = useState<string>('infanterie');
  const [pays, setPays] = useState<string>('fr');
  const [camp, setCamp] = useState<CampId>(0);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [rendues, setRendues] = useState(0);
  const grille = useRef<HTMLDivElement | null>(null);
  const canevas = useRef<HTMLCanvasElement | null>(null);
  const tuiles = useRef<Map<CleVue, HTMLDivElement>>(new Map());
  const studio = useRef<Studio | null>(null);

  const catalogue = useMemo(() => chargerCatalogue(version), [version]);
  const nations = useMemo(() => chargerPays().map((p) => ({ code: p.code, nom: p.nom })), []);
  const uniteSure: CleUnite = catalogue.cles.includes(unite as CleUnite) ? (unite as CleUnite) : catalogue.cles[0]!;

  useEffect(() => { setWebgl(webgl2Disponible()); }, []);

  // Le studio vit aussi longtemps que le canevas ; la pièce, elle, change.
  useEffect(() => {
    const c = canevas.current;
    if (!c || webgl !== true) return undefined;
    const s = creerStudio(c);
    studio.current = s;
    return () => { s.dispose(); studio.current = null; };
  }, [webgl]);

  useEffect(() => {
    const s = studio.current;
    if (!s) return undefined;
    let vivant = true;
    const style = pays === '' ? null : chargerStyleNation(pays as CodePays);
    const silhouette = catalogue.unites[uniteSure]!.silhouette;
    const placeholder = construirePlaceholder(silhouette, camp, s.materiaux, style, uniteSure);
    s.poser(placeholder);
    s.dessiner(tuiles.current, grille.current);
    setRendues((n) => n + 1);
    // Un modèle livré remplace le placeholder, comme en jeu ; un 404 laisse tout en place.
    void chargerModele(uniteSure, pays === '' ? null : (pays as CodePays)).then((modele) => {
      if (!vivant || !modele) return;
      teinterModele(modele, camp);
      s.poser(modele);
      s.dessiner(tuiles.current, grille.current);
    });
    return () => { vivant = false; };
    // `webgl` est dans les dépendances parce que le studio n'existe qu'une fois
    // WebGL détecté, dans un effet qui court après celui-ci au premier rendu.
  }, [catalogue, uniteSure, pays, camp, webgl]);

  useEffect(() => {
    const g = grille.current;
    if (!g || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(() => studio.current?.dessiner(tuiles.current, g));
    obs.observe(g);
    return () => obs.disconnect();
  }, [webgl]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const g = globalThis as unknown as { __atlasVitrine?: PontVitrine };
    g.__atlasVitrine = {
      choisir: (u, p, c) => { setUnite(u); setPays(p ?? ''); setCamp((c === 1 ? 1 : 0) as CampId); },
      pret: () => rendues > 0,
    };
    return () => { delete g.__atlasVitrine; };
  }, [rendues]);

  const fiche = catalogue.unites[uniteSure]!;
  const nation = nations.find((n) => n.code === pays);

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

    {webgl === false && <p className={styles.sansWebgl}>Ce navigateur n’a pas WebGL 2 : la vitrine ne peut pas se monter.</p>}

    <div className={styles.planche} ref={grille}>
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
  poser(piece: THREE.Object3D): void;
  dessiner(tuiles: ReadonlyMap<CleVue, HTMLElement>, cadre: HTMLElement | null): void;
  dispose(): void;
}

/** Marge autour de la pièce dans chaque vue, en fraction de sa plus grande cote. */
const MARGE = 1.18;

function creerStudio(canvas: HTMLCanvasElement): Studio {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setScissorTest(true);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e3f52);
  // La même pièce de studio que le jeu (`render3d/environnement.ts`), à
  // intensité fixe : c'est elle que la tôle et le verre d'une figurine
  // reflètent, et la vitrine doit montrer ce que le plateau montrera.
  const environnement = creerEnvironnement(renderer);
  scene.environment = environnement.texture;
  scene.environmentIntensity = 0.35;

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

  function dessiner(tuiles: ReadonlyMap<CleVue, HTMLElement>, cadre: HTMLElement | null): void {
    if (!cadre || support.children.length === 0) return;
    const rectCadre = cadre.getBoundingClientRect();
    const largeur = Math.max(1, Math.round(rectCadre.width));
    const hauteur = Math.max(1, Math.round(rectCadre.height));
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    renderer.setSize(largeur, hauteur, false);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x0c1b21, 1);
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
  }

  return {
    materiaux,
    poser,
    dessiner,
    dispose: () => {
      scene.environment = null;
      environnement.dispose();
      renderer.dispose();
      sol.geometry.dispose();
      (sol.material as THREE.Material).dispose();
    },
  };
}
