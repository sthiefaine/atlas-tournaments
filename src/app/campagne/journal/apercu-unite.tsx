'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
import { chargerCatalogue } from '@/engine';
import { chargerStyleNation } from '@/assets/styles';
import { chargerModele, monterModele, construirePlaceholder, materiauxPropresDe, Materiaux } from '@/render3d/unites';
import { chargerInventaire, convertirMateriaux } from '@/render3d/modeles';
import { candidatsBatiment, libererBatimentsLivres } from '@/render3d/assets-environnement';
import { choisirBackend, creerMoteurWebGPU, type NavigateurGpu } from '@/render3d/scene';
import { creerEnvironnement } from '@/render3d/environnement';
import type { CleUnite, CodePays, CampId } from '@/schemas/types';
import styles from './apercu-unite.module.css';

/** Une seule pièce sélectionnée. Fournir unite OU batiment (clé de terrain). */
export interface PropsApercuUnite {
  unite?: CleUnite;
  batiment?: string;
  pays?: CodePays | null;
  camp?: CampId;
  nom?: string;
}

export default function ApercuUnite({ unite, batiment, pays = null, camp = 0, nom = 'Figurine' }: PropsApercuUnite) {
  const cadre = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState('Chargement…');
  useEffect(() => {
    const element = cadre.current, canevas = canvas.current;
    if (!element || !canevas) return;
    let vivant = true, image = 0;
    let renderer: THREE.WebGPURenderer | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let environnement: ReturnType<typeof creerEnvironnement> | null = null;
    const materiaux = new Materiaux();
    const batiments = new Map<string, THREE.Object3D>();
    const propres = new Set<THREE.Material>();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x46534a, 2));
    const soleil = new THREE.DirectionalLight(0xffedd3, 3);
    soleil.position.set(3, 5, 4); scene.add(soleil);
    const dessiner = () => {
      if (!vivant || !renderer || image) return;
      image = requestAnimationFrame(() => {
        image = 0;
        if (vivant && renderer) renderer.render(scene, camera);
      });
    };
    const cadrer = (objet: THREE.Object3D) => {
      scene.add(objet);
      objet.updateMatrixWorld(true);
      const boite = new THREE.Box3().setFromObject(objet);
      const centre = boite.getCenter(new THREE.Vector3());
      const taille = boite.getSize(new THREE.Vector3());
      const rayon = Math.max(taille.x, taille.y, taille.z, .3);
      camera.position.copy(centre).add(new THREE.Vector3(1.45, 1, 1.8).multiplyScalar(rayon));
      controls?.target.copy(centre);
      if (controls) { controls.minDistance = rayon * .9; controls.maxDistance = rayon * 5; controls.update(); }
      dessiner();
    };
    setMessage('Chargement…');
    void (async () => {
      await choisirBackend(globalThis.navigator as NavigateurGpu | undefined);
      if (!vivant) return;
      const moteur = creerMoteurWebGPU({ canvas: canevas, alpha: true, antialias: true });
      await moteur.init();
      if (!vivant) { moteur.dispose(); return; }
      renderer = moteur;
      moteur.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      moteur.setClearColor(0x000000, 0);
      moteur.toneMapping = THREE.ACESFilmicToneMapping;
      environnement = creerEnvironnement(moteur);
      scene.environment = environnement.texture;
      scene.environmentIntensity = .45;
      controls = new OrbitControls(camera, canevas);
      controls.enablePan = false;
      controls.maxPolarAngle = Math.PI * .49;
      controls.addEventListener('change', dessiner);
      const taille = () => {
        if (!renderer) return;
        const largeur = Math.max(1, element.clientWidth), hauteur = Math.max(1, element.clientHeight);
        renderer.setSize(largeur, hauteur, false);
        camera.aspect = largeur / hauteur; camera.updateProjectionMatrix(); dessiner();
      };
      observer = new ResizeObserver(taille); observer.observe(element); taille();
      if (unite) {
        const definition = chargerCatalogue().unites[unite];
        if (!definition) { setMessage('Modèle indisponible'); return; }
        const style = pays ? chargerStyleNation(pays) : null;
        const silhouette = construirePlaceholder(definition.silhouette, camp, materiaux, style, unite);
        cadrer(silhouette);
        const modele = await chargerModele(unite, pays);
        if (!vivant) return;
        if (modele) { scene.remove(silhouette); const monte = monterModele(modele, camp, materiaux, style);
          for (const materiau of materiauxPropresDe(monte)) propres.add(materiau);
          cadrer(monte); }
        setMessage('');
      } else if (batiment) {
        const inventaire = await chargerInventaire();
        if (!vivant) return;
        const id = candidatsBatiment(batiment, pays ?? undefined).find(c => inventaire?.modeles[c]?.includes(0));
        if (!id) { setMessage('Modèle à venir'); return; }
        const glb = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/assets/modeles/${id}_lod0.glb`);
        batiments.set(id, glb.scene);
        if (!vivant) { libererBatimentsLivres(batiments); batiments.clear(); return; }
        convertirMateriaux(glb.scene); cadrer(glb.scene); setMessage('');
      }
    })().catch(() => { if (vivant) setMessage('Aperçu indisponible'); });
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
      observer?.disconnect(); controls?.dispose();
      scene.environment = null;
      environnement?.dispose(); renderer?.dispose();
      // Les unités partagent leurs géométries et textures avec le jeu : ne pas les libérer ici.
      for (const materiau of propres) materiau.dispose();
      materiaux.dispose(); libererBatimentsLivres(batiments); batiments.clear();
    };
  }, [unite, batiment, pays, camp]);
  return <div className={styles.scene} ref={cadre}>
    <canvas ref={canvas} className={styles.canvas} aria-label={`${nom}, vue 3D : glisser pour tourner, pincer pour zoomer`} />
    {message && <span className={styles.message} role="status">{message}</span>}
    <span className={styles.geste}>Glisser pour tourner · Pincer pour zoomer</span>
  </div>;
}
