'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './carte.module.css';

interface Asset { id: string; famille: string; url: string | null; candidat: boolean }
/** Carte de bibliothèque : les modèles voisins sont chargés progressivement, pas les 900 kits à la fois. */
export default function CarteAssets({ assets }: { assets: Asset[] }): React.ReactElement {
  const toile = useRef<HTMLDivElement>(null);
  const aller = useRef<(id: string) => void>(() => {});
  const [famille, setFamille] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState<Asset | null>(null);
  const [erreur, setErreur] = useState('');
  const [charges, setCharges] = useState(0);
  const visibles = useMemo(() => assets.filter(a => (famille === 'tous' || a.famille === famille) && a.id.includes(recherche.toLowerCase().trim())), [assets, famille, recherche]);
  useEffect(() => {
    const conteneur = toile.current;
    if (!conteneur) return;
    let fini = false, nettoyer = () => {};
    setErreur(''); setCharges(0); setSelection(null);
    void Promise.all([import('three/webgpu'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'), import('meshoptimizer/meshopt_decoder.module.js'), import('@/render3d/scene'), import('@/render3d/modeles')]).then(async ([T, { OrbitControls }, { GLTFLoader }, { MeshoptDecoder }, { creerMoteurWebGPU }, { convertirMateriaux }]) => {
      if (fini) return;
      const renderer = creerMoteurWebGPU({ antialias: true });
      try { await renderer.init(); } catch (e) { renderer.dispose(); throw e; }
      if (fini) { renderer.dispose(); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      conteneur.appendChild(renderer.domElement);
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute("aria-label", "Carte des assets : flèches pour déplacer la vue");
      const scene = new T.Scene(); scene.background = new T.Color('#14262c');
      const camera = new T.PerspectiveCamera(45, 1, .05, 600);
      camera.position.set(7, 12, 12);
      const controle = new OrbitControls(camera, renderer.domElement);
      controle.target.set(5, 0, 4); controle.maxPolarAngle = Math.PI * .48; controle.minDistance = 2; controle.maxDistance = 150;
      controle.enableDamping = true; controle.listenToKeyEvents(renderer.domElement);
      let sale = true;
      scene.add(new T.HemisphereLight(0xffffff, 0x7b8873, 2.3));
      const soleil = new T.DirectionalLight(0xfff3db, 3); soleil.position.set(-6, 12, 8); scene.add(soleil);
      const colonnes = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(visibles.length))));
      const position = (i: number) => new T.Vector3((i % colonnes) * 2, 0, Math.floor(i / colonnes) * 2);
      aller.current = id => {
        const i = visibles.findIndex(a => a.id === id); if (i < 0) return;
        const decalage = camera.position.clone().sub(controle.target);
        controle.target.copy(position(i)); camera.position.copy(controle.target).add(decalage);
        setSelection(visibles[i] ?? null); sale = true;
      };
      const cases = new T.InstancedMesh(new T.BoxGeometry(1.65, .04, 1.65), new T.MeshStandardMaterial({ roughness: 1 }), visibles.length);
      const matrice = new T.Matrix4();
      visibles.forEach((a, i) => {
        const p = position(i); matrice.makeTranslation(p.x, -.025, p.z); cases.setMatrixAt(i, matrice);
        cases.setColorAt(i, new T.Color(a.url ? a.candidat ? '#a47b38' : '#388c76' : '#465258'));
      });
      scene.add(cases);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const presents = new Map<number, import('three').Object3D>();
      const enCours = new Set<number>(), echecs = new Set<number>();
      const liberer = (objet: import('three').Object3D) => {
        const textures = new Set<import('three').Texture>();
        objet.traverse(o => {
          if (!(o instanceof T.Mesh)) return;
          o.geometry.dispose();
          for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const valeur of Object.values(mat)) if (valeur instanceof T.Texture) textures.add(valeur);
            mat.dispose();
          }
        });
        textures.forEach(t => t.dispose());
      };
      // Les fichiers HD restent intacts ; seuls huit voisins occupent la mémoire graphique.
      const actualiser = () => {
        if (document.hidden) return;
        const proches = visibles.map((a, i) => ({ a, i, distance: position(i).distanceTo(controle.target) }))
          .filter(v => v.a.url && v.distance < 10).sort((a, b) => a.distance - b.distance).slice(0, 8);
        const voulus = new Set(proches.map(v => v.i));
        for (const [i, objet] of presents) if (!voulus.has(i)) { scene.remove(objet); liberer(objet); presents.delete(i); sale = true; }
        for (const { a, i } of proches) {
          if (enCours.size >= 2) break;
          if (presents.has(i) || enCours.has(i) || echecs.has(i)) continue;
          enCours.add(i);
          void loader.loadAsync(a.url!).then(gltf => {
            if (fini || position(i).distanceTo(controle.target) >= 10) { liberer(gltf.scene); return; }
            convertirMateriaux(gltf.scene);
            const boite = new T.Box3().setFromObject(gltf.scene), taille = boite.getSize(new T.Vector3()), centre = boite.getCenter(new T.Vector3());
            const facteur = 1.35 / Math.max(taille.x, taille.y, taille.z, .001);
            const groupe = new T.Group(); gltf.scene.position.sub(new T.Vector3(centre.x, boite.min.y, centre.z));
            groupe.add(gltf.scene); groupe.scale.setScalar(facteur); groupe.position.copy(position(i)); scene.add(groupe); presents.set(i, groupe); sale = true;
          }).catch(() => { echecs.add(i); if (!fini) setErreur(`Chargement impossible : ${a.id}. La case reste sélectionnable.`); })
            .finally(() => { enCours.delete(i); if (!fini) setCharges(presents.size); });
        }
        setCharges(presents.size);
      };
      const ray = new T.Raycaster(), souris = new T.Vector2();
      let depart = { x: 0, y: 0 };
      const bas = (e: PointerEvent) => { depart = { x: e.clientX, y: e.clientY }; };
      const haut = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        souris.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        ray.setFromCamera(souris, camera);
        const hit = ray.intersectObject(cases)[0];
        if (hit?.instanceId !== undefined) setSelection(visibles[hit.instanceId] ?? null);
      };
      renderer.domElement.addEventListener('pointerdown', bas); renderer.domElement.addEventListener('pointerup', haut);
      const resize = new ResizeObserver(() => { const w = conteneur.clientWidth, h = conteneur.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); sale = true; });
      resize.observe(conteneur);
      let frame = 0;
      const dessiner = () => { if (fini) return; const mouvement = controle.update(); if (!document.hidden && (mouvement || sale)) { renderer.render(scene, camera); sale = false; } frame = requestAnimationFrame(dessiner); };
      const intervalle = setInterval(actualiser, 600); actualiser(); dessiner();
      nettoyer = () => { aller.current = () => {}; clearInterval(intervalle); cancelAnimationFrame(frame); resize.disconnect(); controle.dispose(); renderer.domElement.removeEventListener('pointerdown', bas); renderer.domElement.removeEventListener('pointerup', haut); presents.forEach(liberer); cases.geometry.dispose(); (cases.material as import('three').Material).dispose(); renderer.dispose(); renderer.domElement.remove(); };
    }).catch(() => { if (!fini) setErreur('La carte exige WebGPU. Son démarrage a échoué sur cet appareil.'); });
    return () => { fini = true; nettoyer(); };
  }, [visibles]);
  return <main className={styles.page}>
    <header><Link href="/atelier">← Atelier</Link><h1>Carte des assets</h1><p>Glisser : tourner · clic droit + glisser : parcourir · molette : zoomer · cliquer une case : fiche.</p>
      <label>Famille <select value={famille} onChange={e => setFamille(e.target.value)}><option value="tous">Toutes</option>{[...new Set(assets.map(a => a.famille))].map(f => <option key={f}>{f}</option>)}</select></label>
      <label>Rechercher <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="ville, infanterie, forêt…" /></label>
      <label>Aller à <select value={selection?.id ?? ""} onChange={e => aller.current(e.target.value)}><option value="">Choisir un asset</option>{visibles.map(a => <option key={a.id} value={a.id}>{a.id}{a.url ? "" : " — manquant"}</option>)}</select></label>
      <p>{visibles.length} cases · {visibles.filter(a => a.url).length} GLB disponibles · {charges} chargés à proximité. Vert : actif · ocre : candidat · gris : manquant. Les modèles sont ramenés à la taille d’une case pour les comparer.</p>
    </header>
    <div className={styles.toile} ref={toile} aria-label="Carte 3D de la bibliothèque" />
    <aside aria-live="polite">{erreur && <p>{erreur}</p>}{selection ? <><strong>{selection.id}</strong><p>{selection.url ? selection.candidat ? 'Candidat — approbation artistique non établie.' : 'Modèle actif.' : 'GLB manquant : cette case ne représente pas un modèle livré.'}</p><Link href={`/admin/assets/${selection.id}`}>Ouvrir la fiche et le prompt Gemini →</Link></> : <p>Sélectionnez une case. Les huit modèles les plus proches se chargent progressivement ; déplacez la carte pour parcourir toute la bibliothèque.</p>}<Link href="/atelier?monde=3">Voir les unités et bâtiments à leur échelle en jeu →</Link></aside>
  </main>;
}
