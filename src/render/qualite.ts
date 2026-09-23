/**
 * Le **dos** qui dessine, tel que `Rendu.mesurer()` le déclare.
 *
 * Ce module portait la **qualité d'affichage** de la 3D — `auto` ou `basse`,
 * le réglage « Qualité d'affichage » de `/reglages` — et la décision que la peau
 * en tirait : allumer ou non sa chaîne de post-traitement (occlusion ambiante,
 * vignettage, grain), selon une calibration de ses premières images et la
 * cadence mesurée ensuite. La 3D temps réel a été retirée le 23 septembre 2026 ;
 * la peau des images cuites (`render2d/`) n'a pas de chaîne à allumer, le
 * réglage ne pilotait plus rien, et il est parti avec elle — une préférence
 * `qualite` encore enregistrée est ignorée (`app/preferences.ts`).
 *
 * Il ne reste que le nom du dos, sans three.js, pour que `render/` et la peau le
 * partagent sans que l'un importe l'autre.
 */

/** Le dos qui dessine : WebGL 2, celui de la peau 2D (décision du 23 septembre 2026). */
export type BackendRendu = 'webgl2';
