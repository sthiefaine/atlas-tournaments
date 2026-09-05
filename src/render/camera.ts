/**
 * La caméra : position, zoom par paliers, conversions écran ↔ monde, glisser,
 * pincement et inertie légère (`02-architecture.md` §2, point 3).
 *
 * Le monde est en pixels de tuile (`TUILE` = 64), origine en haut à gauche, comme
 * dans la démo. L'écran est en pixels **logiques** : la couche HiDPI applique le
 * ratio, la caméra ne le connaît pas.
 *
 * Tout ici est pur au sens des tests : aucune fonction ne touche au DOM.
 */

/** Côté d'une tuile en unités monde (`02-architecture.md` §3.4). */
export const TUILE = 64;

/** Paliers de zoom : le cache de sprites n'est indexé que par ces valeurs. */
export const PALIERS_ZOOM = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** Un point, en écran comme en monde. */
export interface Point { x: number; y: number }

/** État de la caméra. Mutable : c'est un objet de rendu, pas un état de jeu. */
export interface Camera {
  /** Centre visé, en unités monde. */
  x: number;
  y: number;
  zoom: number;
  /** Vitesse résiduelle du glisser, en unités monde par seconde. */
  vx: number;
  vy: number;
  /** Bornes du monde, en unités monde. */
  monde: { largeur: number; hauteur: number };
  /** Taille de la fenêtre, en pixels logiques. */
  vue: { largeur: number; hauteur: number };
}

/** Crée une caméra centrée sur un monde de `largeur × hauteur` cases. */
export function creerCamera(cases: { largeur: number; hauteur: number }): Camera {
  const monde = { largeur: cases.largeur * TUILE, hauteur: cases.hauteur * TUILE };
  return {
    x: monde.largeur / 2,
    y: monde.hauteur / 2,
    zoom: 1,
    vx: 0,
    vy: 0,
    monde,
    vue: { largeur: 800, hauteur: 600 },
  };
}

/** Le palier de zoom le plus proche d'une valeur : la clé du cache de sprites. */
export function palierZoom(zoom: number): number {
  let meilleur: number = PALIERS_ZOOM[0];
  let ecart = Number.POSITIVE_INFINITY;
  for (const p of PALIERS_ZOOM) {
    const d = Math.abs(p - zoom);
    if (d < ecart) {
      ecart = d;
      meilleur = p;
    }
  }
  return meilleur;
}

/** Le zoom minimal qui garde le monde lisible dans la vue. */
export function zoomMinimal(cam: Camera): number {
  const parLargeur = cam.vue.largeur / Math.max(1, cam.monde.largeur);
  const parHauteur = cam.vue.hauteur / Math.max(1, cam.monde.hauteur);
  return Math.max(0.25, Math.min(1, Math.min(parLargeur, parHauteur) * 0.9));
}

/**
 * Recadre la caméra : le monde reste dans la vue, ou centré s'il y tient tout
 * entier. Sans cela, un glisser trop appuyé perd la carte hors de l'écran.
 */
export function limiter(cam: Camera): Camera {
  const min = zoomMinimal(cam);
  cam.zoom = Math.max(min, Math.min(PALIERS_ZOOM[PALIERS_ZOOM.length - 1] ?? 3, cam.zoom));
  const demiL = cam.vue.largeur / (2 * cam.zoom);
  const demiH = cam.vue.hauteur / (2 * cam.zoom);
  if (cam.monde.largeur <= demiL * 2) cam.x = cam.monde.largeur / 2;
  else cam.x = Math.max(demiL, Math.min(cam.monde.largeur - demiL, cam.x));
  if (cam.monde.hauteur <= demiH * 2) cam.y = cam.monde.hauteur / 2;
  else cam.y = Math.max(demiH, Math.min(cam.monde.hauteur - demiH, cam.y));
  return cam;
}

/** Déclare la taille de la vue, en pixels logiques, puis recadre. */
export function redimensionner(cam: Camera, largeur: number, hauteur: number): Camera {
  cam.vue = { largeur: Math.max(1, largeur), hauteur: Math.max(1, hauteur) };
  return limiter(cam);
}

/** Monde → écran. */
export function mondeVersEcran(cam: Camera, p: Point): Point {
  return {
    x: (p.x - cam.x) * cam.zoom + cam.vue.largeur / 2,
    y: (p.y - cam.y) * cam.zoom + cam.vue.hauteur / 2,
  };
}

/** Écran → monde. */
export function ecranVersMonde(cam: Camera, p: Point): Point {
  return {
    x: (p.x - cam.vue.largeur / 2) / cam.zoom + cam.x,
    y: (p.y - cam.vue.hauteur / 2) / cam.zoom + cam.y,
  };
}

/** Écran → case de la grille. La case peut être hors carte : c'est à l'appelant de voir. */
export function ecranVersCase(cam: Camera, p: Point): Point {
  const m = ecranVersMonde(cam, p);
  return { x: Math.floor(m.x / TUILE), y: Math.floor(m.y / TUILE) };
}

/** Centre d'une case, en unités monde. */
export function centreCase(c: Point): Point {
  return { x: c.x * TUILE + TUILE / 2, y: c.y * TUILE + TUILE / 2 };
}

/** Rectangle de cases visible, marges comprises : c'est le culling de la scène. */
export function casesVisibles(
  cam: Camera, cases: { largeur: number; hauteur: number }, marge = 1,
): { x0: number; y0: number; x1: number; y1: number } {
  const hg = ecranVersCase(cam, { x: 0, y: 0 });
  const bd = ecranVersCase(cam, { x: cam.vue.largeur, y: cam.vue.hauteur });
  return {
    x0: Math.max(0, hg.x - marge),
    y0: Math.max(0, hg.y - marge),
    x1: Math.min(cases.largeur - 1, bd.x + marge),
    y1: Math.min(cases.hauteur - 1, bd.y + marge),
  };
}

/** Déplace la caméra d'un glisser exprimé en pixels d'écran. */
export function glisser(cam: Camera, dxEcran: number, dyEcran: number): Camera {
  cam.x -= dxEcran / cam.zoom;
  cam.y -= dyEcran / cam.zoom;
  return limiter(cam);
}

/** Lance l'inertie depuis une vitesse en pixels d'écran par seconde. */
export function lancerInertie(cam: Camera, vxEcran: number, vyEcran: number): Camera {
  cam.vx = -vxEcran / cam.zoom;
  cam.vy = -vyEcran / cam.zoom;
  return cam;
}

/** Amortissement de l'inertie, par seconde : légère, comme demandé. */
export const FROTTEMENT = 0.004;

/** Fait avancer l'inertie de `ms` millisecondes. Rend vrai tant qu'elle bouge. */
export function avancerInertie(cam: Camera, ms: number): boolean {
  if (cam.vx === 0 && cam.vy === 0) return false;
  const dt = Math.max(0, ms) / 1000;
  cam.x += cam.vx * dt;
  cam.y += cam.vy * dt;
  const amorti = FROTTEMENT ** dt;
  cam.vx *= amorti;
  cam.vy *= amorti;
  if (Math.abs(cam.vx) < 4 && Math.abs(cam.vy) < 4) {
    cam.vx = 0;
    cam.vy = 0;
    limiter(cam);
    return false;
  }
  limiter(cam);
  return true;
}

/** Coupe net l'inertie : un doigt qui se pose arrête le déroulement. */
export function couperInertie(cam: Camera): void {
  cam.vx = 0;
  cam.vy = 0;
}

/**
 * Zoome autour d'un point d'écran : le point visé reste sous le doigt ou sous le
 * curseur. `facteur > 1` rapproche.
 */
export function zoomerAutour(cam: Camera, facteur: number, ancre: Point): Camera {
  const avant = ecranVersMonde(cam, ancre);
  cam.zoom = Math.max(0.25, Math.min(3, cam.zoom * facteur));
  limiter(cam);
  const apres = ecranVersMonde(cam, ancre);
  cam.x += avant.x - apres.x;
  cam.y += avant.y - apres.y;
  return limiter(cam);
}

/** Passe au palier de zoom suivant (`sens = +1`) ou précédent (`sens = -1`). */
export function zoomerPalier(cam: Camera, sens: number, ancre?: Point): Camera {
  const courant = palierZoom(cam.zoom);
  const i = PALIERS_ZOOM.indexOf(courant as (typeof PALIERS_ZOOM)[number]);
  const cible = PALIERS_ZOOM[Math.max(0, Math.min(PALIERS_ZOOM.length - 1, i + Math.sign(sens)))];
  if (cible === undefined) return cam;
  const centre = ancre ?? { x: cam.vue.largeur / 2, y: cam.vue.hauteur / 2 };
  return zoomerAutour(cam, cible / cam.zoom, centre);
}

/** Centre la caméra sur une case, sans animation. */
export function centrerSur(cam: Camera, c: Point): Camera {
  const centre = centreCase(c);
  cam.x = centre.x;
  cam.y = centre.y;
  couperInertie(cam);
  return limiter(cam);
}
