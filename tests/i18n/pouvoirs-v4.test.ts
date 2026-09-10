/**
 * Les chaînes des kits de révision 4 (`doc/refonte/pouvoirs-v4.json`, forme
 * exacte des kits en attendant `content/commandants-capacites.json`) : chaque
 * commandant a ses huit clés, au texte près, et chaque clé que `lignesPouvoir`,
 * le HUD et le splash peuvent demander existe. Une clé absente rendrait vide —
 * `t()` ne montre jamais une clé brute — et personne ne le verrait.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SOURCE_FR, chaineSource } from '../../src/i18n/source';
import { t } from '../../src/i18n/index';
import { repliqueDePouvoir } from '../../src/render/scenes-html';
import { CIBLES_EFFET, METEOS, QUOI_MODIFICATEUR } from '../../src/schemas/types';

interface KitV4 {
  cle: string;
  descriptionPassif: string;
  pouvoir: { nom: string; description: string };
  superPouvoir: { nom: string; description: string };
  faiblesse: { description: string };
  replique: { pouvoir: string; super: string };
}

const kits = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', '..', 'doc', 'refonte', 'pouvoirs-v4.json'), 'utf8')) as { commandants: KitV4[] }).commandants;

test('les 34 kits de révision 4 ont leurs huit chaînes, au texte près', () => {
  assert.equal(kits.length, 34);
  for (const k of kits) {
    const attendu: Record<string, string> = {
      pouvoir_v4: k.pouvoir.nom,
      super_v4: k.superPouvoir.nom,
      passif_v4: k.descriptionPassif,
      faiblesse_v4: k.faiblesse.description,
      pouvoir_v4_desc: k.pouvoir.description,
      super_v4_desc: k.superPouvoir.description,
      replique_pouvoir_v4: k.replique.pouvoir,
      replique_super_v4: k.replique.super,
    };
    for (const [suffixe, texte] of Object.entries(attendu)) {
      const cle = `commandant.${k.cle}.${suffixe}`;
      assert.equal(SOURCE_FR[cle], texte, cle);
    }
    // Le nom du kit tient sur le bouton de la jauge, et le splash trouve la réplique.
    assert.ok((chaineSource(`commandant.${k.cle}.pouvoir_v4`)?.longueurMax ?? 0) >= k.pouvoir.nom.length);
    const rp = repliqueDePouvoir(k.cle, `commandant.${k.cle}.pouvoir_v4`, 'normal');
    const rs = repliqueDePouvoir(k.cle, `commandant.${k.cle}.super_v4`, 'super');
    assert.ok(rp && SOURCE_FR[rp], `${k.cle} : réplique de pouvoir introuvable`);
    assert.ok(rs && SOURCE_FR[rs], `${k.cle} : réplique de super introuvable`);
    // Les noms des révisions d'avant restent.
    assert.ok(SOURCE_FR[`commandant.${k.cle}.pouvoir_v3`], `${k.cle} : le nom v3 a disparu`);
  }
});

test('chaque clé que lignesPouvoir, le HUD et les annonces peuvent demander existe', () => {
  const cles = [
    ...QUOI_MODIFICATEUR.map((q) => `modificateur.${q}`),
    ...CIBLES_EFFET.filter((c) => c !== 'economie' && c !== 'terrain').map((c) => `cible.${c}`),
    ...METEOS.map((m) => `meteo.${m}`),
    'cible.precisee', 'filtre.sur_terrain', 'filtre.rayon',
    'effet.soin', 'effet.degats_directs', 'effet.ravitailler', 'effet.ravitailler_carburant', 'effet.ravitailler_munitions',
    'effet.reactiver', 'effet.meteo', 'effet.meteo_deux', 'effet.pour',
    'duree.ce_tour', 'duree.tour_complet', 'duree.journees',
    'hud.effet_pourcent', 'hud.effet_points', 'hud.effet_terrain',
    'hud.passif', 'hud.faiblesse', 'hud.sans_passif',
    'hud.prevision', 'hud.prevision_soin', 'hud.prevision_degats', 'hud.prevision_reactivation',
    'hud.prevision_reactivation_une', 'hud.prevision_ravitaillement', 'hud.prevision_ravitaillement_une',
    'hud.prevision_meteo', 'hud.prevision_rien',
    'hud.meteo_forcee', 'hud.meteo_imposee', 'hud.reactivation', 'hud.reactivation_une', 'hud.reactivation_adverse',
    'hud.ravitaillement', 'hud.commandant', 'hud.jauge_pouvoir', 'hud.super_pouvoir',
    // Les familles de la faction : la ligne du kit, la visée, le télégraphage, l'impact, le protêt.
    'effet.frappe', 'effet.frappe_case', 'effet.laser_plus_cheres', 'effet.laser_plus_cheres_une',
    'effet.laser_plus_avancees', 'effet.laser_plus_avancees_une', 'effet.iem', 'effet.iem_abattre',
    'hud.pouvoir_annuler', 'hud.visee_pouvoir', 'hud.visee_pouvoir_choisir', 'hud.visee_pouvoir_rayon',
    'hud.visee_pouvoir_confirmer', 'hud.visee_pouvoir_adverses', 'hud.visee_pouvoir_adverses_une',
    'hud.visee_pouvoir_miennes', 'hud.visee_pouvoir_miennes_une', 'hud.visee_pouvoir_arretees',
    'hud.visee_pouvoir_arretees_une', 'hud.visee_pouvoir_abattues', 'hud.visee_pouvoir_abattues_une',
    'hud.visee_pouvoir_rien', 'hud.super_adverse_pret', 'hud.frappe_zone', 'hud.frappe_zone_une',
    'hud.frappe_zone_rien', 'hud.rayon_laser', 'hud.rayon_laser_une', 'hud.rayon_laser_rien', 'hud.iem_pouvoir',
    'hud.iem_pouvoir_une', 'hud.iem_pouvoir_abattues', 'hud.iem_pouvoir_abattue', 'hud.iem_pouvoir_rien', 'hud.protet',
  ];
  for (const cle of cles) assert.ok(SOURCE_FR[cle], `${cle} manque`);
  // Les gabarits se substituent : aucun marqueur ne survit à un appel complet.
  assert.equal(t('fr', 'effet.soin', { n: 2, cible: 'vos unités' }), '+2 PV pour vos unités');
  assert.equal(t('fr', 'hud.meteo_forcee', { commandant: 'Ariane Belloc', meteo: 'Neige' }), 'Ariane Belloc impose la météo : Neige');
  assert.equal(t('fr', 'hud.reactivation', { n: 3 }), '3 unités rejouent');
  assert.doesNotMatch(t('fr', 'hud.prevision', { liste: 'x' }), /[{}]/);
  assert.equal(t('fr', 'effet.iem_abattre', { rayon: 2 }), 'IEM : rayon 2, tout ce qui a un moteur est immobilisé un tour ; les appareils touchés sont perdus');
  assert.doesNotMatch(t('fr', 'hud.super_adverse_pret', { commandant: 'a', piece: 'b', pouvoir: 'c' }), /[{}]/);
});

test('les huit Gris ont leur super, sa description, sa réplique et sa pièce alignés sur doc/refonte/supers-vilains.json', () => {
  interface SuperVilain { cle: string; nom: string; description: string; replique: string; piece: { nom: string } }
  const supers = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', '..', 'doc', 'refonte', 'supers-vilains.json'), 'utf8')) as { supers: SuperVilain[] }).supers;
  assert.equal(supers.length, 8);
  for (const s of supers) {
    assert.equal(SOURCE_FR[`commandant.${s.cle}.super_v4`], s.nom, s.cle);
    assert.equal(SOURCE_FR[`commandant.${s.cle}.super_v4_desc`], s.description, s.cle);
    assert.equal(SOURCE_FR[`commandant.${s.cle}.replique_super_v4`], s.replique, s.cle);
    assert.equal(SOURCE_FR[`commandant.${s.cle}.piece_super`], s.piece.nom, `${s.cle} : la pièce, nommée par le télégraphage et le protêt`);
  }
});
