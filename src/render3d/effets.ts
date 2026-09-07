/**
 * Les **effets transitoires** de la scène : éclairs de bouche, étincelles,
 * halos, poussière, anneaux de pouvoir, caisses de ravitaillement.
 *
 * Un effet est une image plate — un `Sprite` qui fait face à la caméra, ou un
 * quad **couché au sol** pour ce qui doit rester à plat (halo, anneau) — tirée
 * d'un **pool** de taille bornée : jamais plus de `CAPACITE` objets vivants,
 * un objet recyclé quand le pool est plein, aucune allocation par image. Les
 * textures sont procédurales, dessinées une fois par instance du module et
 * libérées au `dispose()` — le `textureEclair` global de `animations.ts` vivait
 * autrefois sans propriétaire et survivait au démontage du rendu.
 *
 * La **vie** d'un effet est une seule chose : `avancer(ms)`, appelé depuis la
 * boucle par `dessiner()`. Un effet naît avec une durée, dérive à sa vitesse,
 * enfle ou rétrécit, monte en opacité puis s'éteint, et rend sa place tout
 * seul ; celui qui l'a émis garde une poignée pour le **libérer plus tôt** —
 * c'est ce que fait un geste coupé au milieu. Rien ici ne porte d'ombre, ne
 * connaît le moteur ni ne décide quoi que ce soit : `animations.ts` dit quoi
 * émettre et où, ce module dit comment ça vit.
 *
 * `doc/10` §2 s'applique : des étincelles claires, de la poussière, de la
 * lumière — jamais de sang, de débris organiques ni de fumée noire.
 */

import * as THREE from 'three';

/** Les genres d'effets : un genre, une texture, un défaut de taille et de couleur. */
export type GenreEffet = 'eclair' | 'etincelle' | 'halo' | 'poussiere' | 'anneau' | 'caisse';

/** Ce qu'on demande au pool. Tout ce qui manque prend le défaut du genre. */
export interface SpecEffet {
  genre: GenreEffet;
  /** Position monde de départ. */
  position: { x: number; y: number; z: number };
  /** Durée de vie en millisecondes ; à 0, l'effet est retiré au premier pas. */
  duree: number;
  /** Teinte, en CSS ; le défaut dépend du genre. */
  couleur?: string;
  /** Échelle de départ et d'arrivée, en unités de scène (une case vaut 1). */
  taille?: number;
  tailleFin?: number;
  /** Vitesse en unités par seconde. */
  vitesse?: { x: number; y: number; z: number };
  /** Accélération vers le bas, en unités par seconde carrée. */
  gravite?: number;
  /** Opacité au sommet de la courbe. */
  opacite?: number;
  /**
   * Part de la durée passée à monter en opacité : 0 pour être plein dès le
   * départ et s'éteindre (un éclair), 0,5 pour un aller-retour symétrique.
   */
  montee?: number;
  /** Couché au sol plutôt que face à la caméra. Par défaut, seuls `halo` et `anneau` le sont. */
  plat?: boolean;
}

/** La poignée rendue à l'émetteur : de quoi savoir si l'effet vit et le libérer. */
export interface Effet {
  readonly vivant: boolean;
  /** Rend sa place au pool tout de suite. Idempotent. */
  liberer(): void;
}

/** Ce que `creerEffets` rend au rendu. */
export interface Effets {
  /** Le groupe `effets` de la scène : à ajouter une fois, il appartient au module. */
  readonly groupe: THREE.Group;
  /** Effets vivants à cet instant. */
  readonly vivants: number;
  /** Ce qu'on ne dépassera jamais. */
  readonly capacite: number;
  /** Fait naître un effet ; recycle le plus ancien si le pool est plein. */
  emettre(spec: SpecEffet): Effet;
  /**
   * Pose dans le groupe un objet qui n'est pas du pool — les pans d'une
   * palissade — pour que `couper()` le retire avec le reste. La géométrie et
   * la matière restent à l'émetteur, qui les libère.
   */
  attacher(objet: THREE.Object3D): void;
  detacher(objet: THREE.Object3D): void;
  /** Fait vivre les effets de `ms`. Rend vrai tant qu'il en reste un. */
  avancer(ms: number): boolean;
  /** Retire tout ce qui vit, sans rien libérer de la mémoire graphique. */
  couper(): void;
  /** Retire tout et libère textures, matériaux et géométrie. */
  dispose(): void;
}

/** Le nombre d'effets vivants qu'on ne dépasse jamais. */
export const CAPACITE = 64;

/** La part de la capacité réservée aux effets couchés au sol. */
const PART_PLATS = 0.25;

/** Les défauts par genre : taille de départ, couleur, courbe d'opacité, à plat ou non. */
const DEFAUTS: Record<GenreEffet, { taille: number; couleur: string; opacite: number; montee: number; plat: boolean }> = {
  eclair: { taille: 0.7, couleur: '#ffffff', opacite: 1, montee: 0, plat: false },
  etincelle: { taille: 0.14, couleur: '#fff1c8', opacite: 1, montee: 0, plat: false },
  halo: { taille: 0.8, couleur: '#ffffff', opacite: 0.7, montee: 0.3, plat: true },
  poussiere: { taille: 0.9, couleur: '#f1e6cf', opacite: 0.55, montee: 0.4, plat: false },
  anneau: { taille: 0.6, couleur: '#ffffff', opacite: 0.8, montee: 0.1, plat: true },
  caisse: { taille: 0.16, couleur: '#e9d9b0', opacite: 0.95, montee: 0.2, plat: false },
};

/** Dessine la texture d'un genre : blanche ou presque, la couleur vient du matériau. */
function dessinerTexture(doc: Document, genre: GenreEffet): THREE.CanvasTexture {
  const c = doc.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.clearRect(0, 0, 64, 64);
    if (genre === 'eclair') {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,246,214,1)');
      grad.addColorStop(0.3, 'rgba(255,196,90,0.7)');
      grad.addColorStop(1, 'rgba(255,150,40,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    } else if (genre === 'etincelle') {
      // Un cœur blanc très serré : à l'échelle d'un dixième de case, c'est un point qui brille.
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.45, 'rgba(255,240,200,0.35)');
      grad.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    } else if (genre === 'anneau') {
      g.strokeStyle = 'rgba(255,255,255,1)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(32, 32, 26, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(32, 32, 26, 0, Math.PI * 2);
      g.stroke();
    } else if (genre === 'caisse') {
      // Une caisse stylisée : un carré plein, un liseré, une sangle.
      g.fillStyle = 'rgba(255,255,255,1)';
      g.fillRect(10, 10, 44, 44);
      g.strokeStyle = 'rgba(120,90,50,1)';
      g.lineWidth = 4;
      g.strokeRect(10, 10, 44, 44);
      g.fillStyle = 'rgba(120,90,50,0.9)';
      g.fillRect(29, 10, 6, 44);
    } else {
      // Halo et poussière : un disque doux, la poussière un peu plus diffuse.
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(genre === 'poussiere' ? 0.25 : 0.45, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Une place du pool : l'objet, sa matière, et ce qui le fait vivre. */
interface Place {
  objet: THREE.Sprite | THREE.Mesh;
  materiau: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
  plat: boolean;
  vivant: boolean;
  /** Incrémenté à chaque naissance : une poignée périmée ne libère pas le suivant. */
  generation: number;
  /** Ordre de naissance, pour recycler le plus ancien. */
  naissance: number;
  ecoule: number;
  duree: number;
  taille: number;
  tailleFin: number;
  opacite: number;
  montee: number;
  gravite: number;
  vitesse: THREE.Vector3;
}

/** Monte le pool. `doc` ne sert qu'à dessiner les textures. */
export function creerEffets(doc: Document, capacite = CAPACITE): Effets {
  const groupe = new THREE.Group();
  groupe.name = 'effets';

  const textures = new Map<GenreEffet, THREE.CanvasTexture>();
  const textureDe = (genre: GenreEffet): THREE.CanvasTexture => {
    const memo = textures.get(genre);
    if (memo) return memo;
    const tex = dessinerTexture(doc, genre);
    textures.set(genre, tex);
    return tex;
  };

  // Un seul quad pour tout ce qui se couche au sol, tourné une fois.
  const geoPlat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  const capacitePlats = Math.max(1, Math.round(capacite * PART_PLATS));
  const capaciteSprites = Math.max(1, capacite - capacitePlats);
  const sprites: Place[] = [];
  const plats: Place[] = [];
  const attaches = new Set<THREE.Object3D>();
  let compteur = 0;

  function creerPlace(plat: boolean): Place {
    let objet: THREE.Sprite | THREE.Mesh;
    let materiau: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
    if (plat) {
      materiau = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      });
      objet = new THREE.Mesh(geoPlat, materiau);
    } else {
      materiau = new THREE.SpriteMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      });
      objet = new THREE.Sprite(materiau);
    }
    objet.visible = false;
    objet.castShadow = false;
    objet.receiveShadow = false;
    groupe.add(objet);
    return {
      objet, materiau, plat, vivant: false, generation: 0, naissance: 0, ecoule: 0, duree: 1,
      taille: 1, tailleFin: 1, opacite: 1, montee: 0, gravite: 0, vitesse: new THREE.Vector3(),
    };
  }

  /** Une place libre du bon pool, créée si le pool n'est pas plein, sinon la plus ancienne vivante. */
  function placeLibre(plat: boolean): Place {
    const pool = plat ? plats : sprites;
    const cap = plat ? capacitePlats : capaciteSprites;
    const libre = pool.find((p) => !p.vivant);
    if (libre) return libre;
    if (pool.length < cap) {
      const neuve = creerPlace(plat);
      pool.push(neuve);
      return neuve;
    }
    let ancienne = pool[0]!;
    for (const p of pool) if (p.naissance < ancienne.naissance) ancienne = p;
    eteindre(ancienne);
    return ancienne;
  }

  function eteindre(p: Place): void {
    p.vivant = false;
    p.objet.visible = false;
    p.materiau.opacity = 0;
  }

  /** Applique à une place l'image de sa vie à l'instant `t` (0 → 1). */
  function poser(p: Place, t: number): void {
    const courbe = p.montee <= 0
      ? 1 - t
      : t < p.montee ? t / p.montee : (1 - t) / (1 - p.montee);
    p.materiau.opacity = Math.max(0, Math.min(1, courbe)) * p.opacite;
    const echelle = p.taille + (p.tailleFin - p.taille) * t;
    p.objet.scale.set(echelle, echelle, echelle);
  }

  function emettre(spec: SpecEffet): Effet {
    const defaut = DEFAUTS[spec.genre];
    const plat = spec.plat ?? defaut.plat;
    const p = placeLibre(plat);
    compteur += 1;
    p.vivant = true;
    p.generation += 1;
    p.naissance = compteur;
    p.ecoule = 0;
    p.duree = Math.max(0, spec.duree);
    p.taille = spec.taille ?? defaut.taille;
    p.tailleFin = spec.tailleFin ?? p.taille;
    p.opacite = spec.opacite ?? defaut.opacite;
    p.montee = spec.montee ?? defaut.montee;
    p.gravite = spec.gravite ?? 0;
    if (spec.vitesse) p.vitesse.set(spec.vitesse.x, spec.vitesse.y, spec.vitesse.z);
    else p.vitesse.set(0, 0, 0);
    p.materiau.map = textureDe(spec.genre);
    p.materiau.color.set(spec.couleur ?? defaut.couleur);
    p.materiau.needsUpdate = true;
    p.objet.position.set(spec.position.x, spec.position.y, spec.position.z);
    p.objet.visible = true;
    poser(p, 0);
    const generation = p.generation;
    return {
      get vivant(): boolean {
        return p.vivant && p.generation === generation;
      },
      liberer(): void {
        if (p.vivant && p.generation === generation) eteindre(p);
      },
    };
  }

  function avancer(ms: number): boolean {
    let encore = false;
    const dt = Math.max(0, ms) / 1000;
    for (const pool of [sprites, plats]) {
      for (const p of pool) {
        if (!p.vivant) continue;
        p.ecoule += Math.max(0, ms);
        if (p.duree <= 0 || p.ecoule >= p.duree) {
          eteindre(p);
          continue;
        }
        if (p.gravite !== 0) p.vitesse.y -= p.gravite * dt;
        if (p.vitesse.lengthSq() > 0) p.objet.position.addScaledVector(p.vitesse, dt);
        poser(p, p.ecoule / p.duree);
        encore = true;
      }
    }
    return encore;
  }

  function couper(): void {
    for (const p of sprites) if (p.vivant) eteindre(p);
    for (const p of plats) if (p.vivant) eteindre(p);
    for (const o of attaches) groupe.remove(o);
    attaches.clear();
  }

  return {
    groupe,
    get vivants(): number {
      let n = 0;
      for (const p of sprites) if (p.vivant) n += 1;
      for (const p of plats) if (p.vivant) n += 1;
      return n;
    },
    capacite: capaciteSprites + capacitePlats,
    emettre,
    attacher(objet): void {
      attaches.add(objet);
      groupe.add(objet);
    },
    detacher(objet): void {
      attaches.delete(objet);
      groupe.remove(objet);
    },
    avancer,
    couper,
    dispose(): void {
      couper();
      for (const p of [...sprites, ...plats]) {
        groupe.remove(p.objet);
        p.materiau.dispose();
      }
      sprites.length = 0;
      plats.length = 0;
      for (const t of textures.values()) t.dispose();
      textures.clear();
      geoPlat.dispose();
    },
  };
}
