'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { creerMoteurWebGPU } from '@/render3d/scene';
import { creerEnvironnement, type Environnement } from '@/render3d/environnement';
import { parametresAmbiance } from '@/render3d/eclairage';
import type { NiveauLod } from '@/assets/spec';

import type { PropsInspection } from './types-inspection';
import { cheminInspection, PREFIXE_MODELES } from './chemins-inspection';
type Vue = 'jeu' | 'dessus' | 'trois_quarts';
interface Reglages { vue: Vue; reel: boolean; mosaique: boolean; lumiere: string; canal: string; clip: string; lecture: boolean; instant: number; equipe: string }
function liberation(objet: T.Object3D) {
  const materiaux = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>(), cartes = new Set<T.Texture>();
  objet.traverse((o) => { if (o instanceof T.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materiaux.add(m); } });
  for (const m of materiaux) { for (const v of Object.values(m)) if (v instanceof T.Texture) cartes.add(v); m.dispose(); }
  for (const g of geometries) g.dispose(); for (const c of cartes) c.dispose();
}
function Plateau({ url, prefixe, id, reglages }: { url: string; prefixe: string; id: string; reglages: Reglages }) {
  const conteneur = useRef<HTMLDivElement>(null), [etat, changerEtat] = useState('Chargement…');
  // Un adaptateur par panneau, conservé entre tous les réglages et LOD.
  const ressource = useRef<Promise<{ moteur: T.WebGPURenderer; environnement: Environnement }> | null>(null);
  useEffect(() => () => {
    const ancienne = ressource.current; ressource.current = null;
    void ancienne?.then(({ moteur, environnement }) => { environnement.dispose(); moteur.dispose(); }, () => {});
  }, []);
  useEffect(() => {
    const hote = conteneur.current; if (!hote) return;
    let ferme = false, image = 0;
    let observateur: ResizeObserver | undefined, scene: T.Scene | undefined, modele: T.Object3D | undefined;
    const extras: T.Material[] = [], textures: T.Texture[] = [];
    changerEtat('Chargement…');
    async function monter() {
      const gestion = new T.LoadingManager();
      const revision = new URL(url, location.href).searchParams.get('v');
      gestion.setURLModifier((adresse) => revision && !adresse.startsWith('blob:') && !adresse.includes('?') ? `${adresse}?v=${revision}` : adresse);
      const gltf = await new GLTFLoader(gestion).loadAsync(url); modele = gltf.scene;
      if (ferme) { liberation(modele); return; }
      ressource.current ??= (async () => {
        const moteur = creerMoteurWebGPU({ antialias: true, alpha: false });
        try { await moteur.init(); return { moteur, environnement: creerEnvironnement(moteur) }; }
        catch (e) { moteur.dispose(); throw e; }
      })();
      const { moteur: r, environnement } = await ressource.current;
      if (ferme) return;
      r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      hote!.append(r.domElement); r.domElement.setAttribute('aria-label', `Aperçu de ${id}`);
      r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
      scene = new T.Scene(); scene.background = new T.Color('#283237');
      scene.environment = environnement.texture;
      const neutre = reglages.lumiere === 'neutre', nuit = reglages.lumiere === 'nuit';
      const ambiance = parametresAmbiance('ete', nuit ? 'nuit' : 'jour', 'clair');
      const hemi = ambiance.hemisphere, soleil = ambiance.soleil;
      scene.add(new T.HemisphereLight(neutre ? '#ffffff' : hemi.ciel, neutre ? '#777777' : hemi.sol, neutre ? 1.5 : hemi.intensite));
      const lampe = new T.DirectionalLight(neutre ? '#ffffff' : soleil.couleur, neutre ? 2 : soleil.intensite);
      const el = T.MathUtils.degToRad(soleil.elevation), az = T.MathUtils.degToRad(soleil.azimut);
      lampe.position.set(Math.sin(az) * Math.cos(el) * 5, Math.sin(el) * 5, Math.cos(az) * Math.cos(el) * 5); scene.add(lampe);
      scene.environmentIntensity = neutre ? .7 : ambiance.environnement.intensite; r.toneMappingExposure = neutre ? 1 : ambiance.exposition;
      const chargeur = new T.TextureLoader(gestion);
      if (reglages.canal !== 'pbr') {
        const carte = await chargeur.loadAsync(`${prefixe}/${id}_${reglages.canal}.png`);
        if (ferme) { carte.dispose(); return; }
        textures.push(carte); carte.flipY = false;
        // En vue de carte seule, montrer les valeurs PNG telles qu'un éditeur les affiche.
        carte.colorSpace = T.SRGBColorSpace;
        const m = new T.MeshBasicMaterial({ map: carte, toneMapped: false }); extras.push(m);
        modele.traverse((o) => { if (o instanceof T.Mesh) { o.userData.materialOriginal = o.material; o.material = m; } });
      } else if (reglages.equipe) {
        const masque = await chargeur.loadAsync(`${prefixe}/${id}_masque_equipe.png`);
        if (ferme) { masque.dispose(); return; }
        textures.push(masque);
        const teinte = new T.Color(reglages.equipe).convertLinearToSRGB();
        const peints = new Map<T.Material, T.Material>();
        modele.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          o.userData.materialOriginal = o.material;
          o.material = (Array.isArray(o.material) ? o.material : [o.material]).map((original: T.MeshStandardMaterial) => {
            const deja = peints.get(original); if (deja) return deja;
            if (!original.map) return original;
            const toile = document.createElement('canvas'); toile.width = original.map.image.width; toile.height = original.map.image.height;
            const ctx = toile.getContext('2d')!; ctx.drawImage(original.map.image, 0, 0, toile.width, toile.height);
            const couleur = ctx.getImageData(0, 0, toile.width, toile.height); ctx.drawImage(masque.image, 0, 0, toile.width, toile.height);
            const pixels = ctx.getImageData(0, 0, toile.width, toile.height).data;
            for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 127) { const valeur = couleur.data[i]!; couleur.data[i] = valeur * teinte.r; couleur.data[i + 1] = valeur * teinte.g; couleur.data[i + 2] = valeur * teinte.b; }
            ctx.putImageData(couleur, 0, 0);
            const carte = new T.CanvasTexture(toile); carte.flipY = false; carte.colorSpace = T.SRGBColorSpace; textures.push(carte);
            const m = original.clone(); m.map = carte; extras.push(m); peints.set(original, m); return m;
          });
        });
      }
      if (ferme) return;
      const groupe = new T.Group(); scene.add(groupe);
      if (reglages.mosaique) for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) { const m = clone(modele); m.position.set(x - 1.5, 0, z - 1.5); m.rotation.y = ((x * 3 + z + x * z) % 4) * Math.PI / 2; groupe.add(m); }
      else groupe.add(modele);
      const boite = new T.Box3().setFromObject(groupe), centre = boite.getCenter(new T.Vector3()), taille = boite.getSize(new T.Vector3());
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, .01, 100);
      const elevation = T.MathUtils.degToRad(reglages.vue === 'dessus' ? 89.99 : reglages.vue === 'jeu' ? 65 : 30);
      const azimut = reglages.vue === 'trois_quarts' ? Math.PI / 4 : 0;
      camera.position.copy(centre).add(new T.Vector3(Math.sin(azimut) * Math.cos(elevation) * 10, Math.sin(elevation) * 10, Math.cos(azimut) * Math.cos(elevation) * 10)); camera.lookAt(centre);
      const mixer = new T.AnimationMixer(modele), clip = gltf.animations.find((a) => a.name === reglages.clip);
      if (clip) { const action = mixer.clipAction(clip); action.setLoop(['repos', 'deplacement'].includes(clip.name) ? T.LoopRepeat : T.LoopOnce, Infinity); action.clampWhenFinished = true; action.play(); mixer.setTime(reglages.instant * clip.duration); }
      function dessiner() { if (scene && !ferme) r.render(scene, camera); }
      function tailleVue() {
        const largeur = hote!.clientWidth, hauteur = hote!.clientHeight;
        if (!largeur || !hauteur) return;
        r.setSize(largeur, hauteur, false);
        const vertical = reglages.reel ? hauteur / 48 : Math.max(taille.y, taille.z, taille.x * hauteur / largeur) * 1.4;
        camera.left = -vertical * largeur / hauteur / 2; camera.right = -camera.left; camera.top = vertical / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix(); dessiner();
      }
      observateur = new ResizeObserver(tailleVue); observateur.observe(hote!); tailleVue();
      changerEtat('Prêt'); hote!.dataset.pret = 'true';
      let precedent = performance.now();
      function animer(maintenant: number) {
        if (ferme) return;
        if (!document.hidden && clip && reglages.lecture) { mixer.update(Math.min((maintenant - precedent) / 1000, .05)); dessiner(); }
        precedent = maintenant;
        if (clip && reglages.lecture) image = requestAnimationFrame(animer);
      }
      if (clip && reglages.lecture) image = requestAnimationFrame(animer);
    }
    void monter().catch((e: unknown) => { if (!ferme) changerEtat(`Aperçu indisponible : ${e instanceof Error ? e.message : String(e)}`); });
    return () => {
      ferme = true; cancelAnimationFrame(image); observateur?.disconnect(); delete hote.dataset.pret;
      if (modele) { modele.traverse((o) => { if (o instanceof T.Mesh && o.userData.materialOriginal) o.material = o.userData.materialOriginal; }); liberation(modele); }
      for (const m of extras) m.dispose(); for (const t of textures) t.dispose();
      hote.replaceChildren();
    };
  }, [url, prefixe, id, reglages]);
  return <div><p role="status" className="mb-1 text-xs">{etat}</p><div ref={conteneur} className="h-80 w-full overflow-hidden rounded bg-slate-900" /></div>;
}
export default function Inspection({ spec, fichiers, revision, precedente, reference, prefixe = PREFIXE_MODELES }: PropsInspection) {
  const [lod, choisirLod] = useState<NiveauLod>(0), [comparaison, comparer] = useState('aucune');
  const [reglages, regler] = useState<Reglages>({ vue: 'jeu', reel: false, mosaique: false, lumiere: 'neutre', canal: 'pbr', clip: '', lecture: false, instant: 0, equipe: '' });
  const modifier = <K extends keyof Reglages>(k: K, v: Reglages[K]) => regler((r) => ({ ...r, [k]: v }));
  const nom = `${spec.id}_lod${lod}.glb`, present = fichiers.includes(nom);
  const cote = comparaison === 'precedente' && precedente ? { id: spec.id, prefixe: `/api/admin/assets/${spec.id}/historique/${precedente}`, revision: precedente }
    : comparaison === 'reference' && reference ? { id: reference.id, prefixe: reference.prefixe ?? prefixe, revision: reference.revision } : null;
  return <div className="mt-4 space-y-3 text-sm">
    <p className="text-xs admin-secondaire">La conformité technique ne juge ni la silhouette ni l’absence d’ombre peinte. Comparer les trois vues avant d’approuver. L’éclairage de jeu reprend le soleil, l’hémisphère et l’environnement ; météo et post-traitement se vérifient dans l’atelier.</p>
    <div className="flex flex-wrap gap-3">
      <label>Vue <select aria-label="Vue" value={reglages.vue} onChange={(e) => modifier('vue', e.target.value as Vue)}><option value="jeu">Jeu 65°</option><option value="dessus">Dessus</option><option value="trois_quarts">Trois-quarts</option></select></label>
      <label>LOD <select aria-label="LOD" value={lod} onChange={(e) => choisirLod(Number(e.target.value) as NiveauLod)}>{spec.verification.lodRequis.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label>Éclairage <select aria-label="Éclairage" value={reglages.lumiere} onChange={(e) => modifier('lumiere', e.target.value)}><option value="neutre">Studio neutre</option><option value="jour">Jeu — été, jour</option><option value="nuit">Jeu — été, nuit</option></select></label>
      <label>Carte <select aria-label="Carte" value={reglages.canal} onChange={(e) => modifier('canal', e.target.value)}><option value="pbr">Matériau PBR</option>{spec.textures.filter((t) => fichiers.includes(`${spec.id}_${t.canal}.png`)).map((t) => <option key={t.canal}>{t.canal}</option>)}</select></label>
      <label><input type="checkbox" checked={reglages.reel} onChange={(e) => modifier('reel', e.target.checked)} /> Taille réelle : 48 px/m</label>
      {spec.type === 'terrain' ? <label><input type="checkbox" checked={reglages.mosaique} onChange={(e) => modifier('mosaique', e.target.checked)} /> Mosaïque 4×4, quarts de tour</label> : null}
      {spec.textures.some((t) => t.canal === 'masque_equipe') ? <label>Équipe <select aria-label="Équipe" value={reglages.equipe} onChange={(e) => modifier('equipe', e.target.value)}><option value="">Gris de base</option><option value="#008fd5">Bleu témoin</option><option value="#e55932">Orange témoin</option></select></label> : null}
      <label>Comparer <select aria-label="Comparer" value={comparaison} onChange={(e) => comparer(e.target.value)}><option value="aucune">Aucune</option>{precedente ? <option value="precedente">Version précédente</option> : null}{reference ? <option value="reference">{reference.approuvee ? 'Référence approuvée' : 'Candidat de référence'} : {reference.id}</option> : null}</select></label>
    </div>
    {spec.animations.length ? <div className="flex flex-wrap items-center gap-3"><label>Clip <select aria-label="Clip" value={reglages.clip} onChange={(e) => modifier('clip', e.target.value)}><option value="">Pose de construction</option>{spec.animations.map((a) => <option key={a.nom}>{a.nom}</option>)}</select></label><button disabled={!reglages.clip} onClick={() => modifier('lecture', !reglages.lecture)}>{reglages.lecture ? 'Pause' : 'Lire'}</button><label>Position <input type="range" min="0" max="1" step="0.01" value={reglages.instant} disabled={reglages.lecture || !reglages.clip} onChange={(e) => modifier('instant', Number(e.target.value))} /></label></div> : null}
    <div className={`grid gap-4 ${cote ? 'lg:grid-cols-2' : ''}`}>
      {present ? <Plateau url={cheminInspection(prefixe, nom, revision)} prefixe={prefixe} id={spec.id} reglages={reglages} /> : <p>LOD{lod} absent : déposer le lot pour voir le candidat.</p>}
      {cote ? <Plateau url={cheminInspection(cote.prefixe, `${cote.id}_lod${comparaison === 'reference' ? 0 : lod}.glb`, cote.revision)} prefixe={cote.prefixe} id={cote.id} reglages={{ ...reglages, equipe: '', canal: 'pbr', mosaique: false }} /> : null}
    </div>
  </div>;
}
