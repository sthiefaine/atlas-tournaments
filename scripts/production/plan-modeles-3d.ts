/** Inventaire de la file séquentielle, sans confondre présence et qualité. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetSpec } from '../../src/assets/spec';
import { nomModele, nomTexture } from '../../src/assets/spec';
import { promptProduction } from '../../src/app/admin/assets/prompt-production';

const fichier = 'assets/production/plan-modeles-3d.json';
const ancien = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : null;
const optimises = JSON.parse(readFileSync('assets/production/optimisation-lod0.json', 'utf8')).assets as { id: string; actifSha256: string; triangles: number; revision: string }[];
const ordreFamille: Record<string, number> = { unite: 0, batiment: 1, decor: 2, terrain: 3, commandant: 4 };
const premiers = ['unite_antiair_base', 'unite_artillerie_base', 'unite_meridien_automate_base', 'unite_transport_base', 'unite_char_moyen_base', 'unite_char_lourd_base', 'unite_helico_base', 'unite_chasseur_base', 'unite_cuirasse_base'];
function consigneSequentielle(id: string): string {
  if (id === 'terrain_plaine') return 'MODÈLE EXCLU DE LA PRODUCTION : conserver le rendu procédural de la plaine. Ne pas générer ni activer un nouveau GLB.\n\n';
  return `CADRE DE CETTE FILE COMMANDÉE PAR LE PROPRIÉTAIRE
Un seul spécialiste et un seul modèle à la fois. Le coordinateur doit avoir poussé le précédent avant de commencer celui-ci.
Un GLB uploadé reste toujours prioritaire et immuable. Si la lecture authentifiée du stockage réussit et confirme l'absence de dépôt, et qu'aucun maître local n'existe, la création originale est autorisée dans cette commande globale. Cette autorisation remplace uniquement la demande générique de réclamer un GLB absent ci-dessous ; un stockage inaccessible n'est jamais une preuve d'absence et suspend la préparation.
Inspecter aussi l'ancien candidat et ses PNG avant de travailler. Le spécialiste écrit seulement dans scripts/production/modeles/${id}/ et tmp/production-sequentielle/${id}/. Il livre un README dans chacun de ces dossiers, une revue technique et les fichiers gelés après contrôle ciblé ; il ne modifie ni lot officiel, ni actif, ni registre, ni plan et ne fait aucune opération Git. Le coordinateur recontrôle les sources avant intégration, actualise le plan, puis commit et push ce modèle sur main avant le suivant. Aucun test général, rendu, capture, approbation artistique automatique ni FPS inventé.

CONTRAT GÉNÉRIQUE DE L'ASSET — appliquer avec le cadre de production ci-dessus
`;
}
function lireGlb(p: string) {
  if (!existsSync(p)) return null;
  const b = readFileSync(p), d = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  let triangles = 0;
  for (const m of d.meshes ?? []) for (const p of m.primitives ?? []) if ((p.mode ?? 4) === 4) triangles += d.accessors[p.indices ?? p.attributes.POSITION].count / 3;
  return { chemin: p, sha256: createHash('sha256').update(b).digest('hex'), triangles, octetsGlb: b.length };
}
const toutes = readdirSync('assets/specs').filter(n => n.endsWith('.json')).map(n => JSON.parse(readFileSync(path.join('assets/specs', n), 'utf8')) as AssetSpec);
const specs = toutes.filter(s => s.type !== 'kit' && s.variantes.nations.length === 0).sort((a, b) => {
  const pa = premiers.indexOf(a.id), pb = premiers.indexOf(b.id);
  if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
  return ordreFamille[a.type]! - ordreFamille[b.type]! || a.id.localeCompare(b.id);
});
const modeles = specs.map((s, index) => {
  const dossier = `assets/livraisons/${s.id}`, fichierSource = `${dossier}/source.json`;
  const provenance = existsSync(fichierSource) ? JSON.parse(readFileSync(fichierSource, 'utf8')) : null;
  const actif = lireGlb(`public/assets/modeles/${nomModele(s, 0)}`), candidat = lireGlb(`${dossier}/${nomModele(s, 0)}`);
  const deja = optimises.find(x => x.id === s.id && x.actifSha256 === actif?.sha256);
  const creation = existsSync(`${dossier}/creation-originale.json`) ? JSON.parse(readFileSync(`${dossier}/creation-originale.json`, 'utf8')) : null;
  const creationActive = creation?.fichiers?.some((f: { nom: string; sha256: string }) => f.nom === nomModele(s, 0) && f.sha256 === actif?.sha256);
  const ancienModele = ancien?.modeles?.find((x: { id: string }) => x.id === s.id);
  const suiviValide = ancienModele && ancienModele.actuel?.sha256 === actif?.sha256;
  const etat = deja || creationActive ? 'livre' : s.id === 'terrain_plaine' ? 'conserver_rendu_procedural' : provenance ? 'a_preparer_source_hd' : candidat ? 'a_retravailler' : 'a_creer';
  const requis = [nomModele(s, 0), ...s.textures.filter(t => t.obligatoire).map(t => nomTexture(s, t.canal))];
  const presents = requis.filter(n => existsSync(path.join(dossier, n)));
  const kitsActifs = s.type === 'unite' ? readdirSync('public/assets/modeles').filter(n => n.startsWith('kit_') && n.endsWith(`_${s.cle.replace(/_base$/, '')}_lod0.glb`)) : [];
  return {
    ordre: index + 1, id: s.id, famille: s.type, description: s.description.fr,
    etat: suiviValide ? ancienModele.etat : etat,
    specification: `assets/specs/${s.id}.json`, destination: dossier,
    source: {
      ...(provenance ? { nature: 'glb_uploade', nom: provenance.source, sha256: provenance.sha256 } : deja ? { nature: 'maitre_hd_archive', manifeste: `${dossier}/maitre.json` } : creation ? { nature: 'creation_originale', manifeste: `${dossier}/creation-originale.json` } : { nature: 'aucune_source_hd_identifiee', action: 'Rechercher un dépôt avant création ; conserver tout upload existant.' }),
      ...(ancienModele?.source?.verificationDistante ? { verificationDistante: ancienModele.source.verificationDistante } : {}),
    },
    actuel: actif, candidat, budgetTriangles: s.budget.lod0, fichiersRequis: requis,
    ...(kitsActifs.length ? { kitsActifsDependants: kitsActifs, consigneKits: 'Avant remplacement, vérifier la compatibilité de géométrie/UV/animations ; archiver les alias incompatibles pour que le jeu utilise la nouvelle base. Ne pas fabriquer de déclinaison hors commande.' } : {}),
    ordreDeTravail: ['lire_contrat_et_provenance', 'archiver_maitre', 'preparer_lod0_et_png', 'controler_lot', 'integrer', 'mettre_a_jour_plan', 'commit_et_push_main'],
    agent: { metier: 'Artiste technique 3D jeu vidéo', responsabilite: 'Une seule fiche à la fois ; modèle, UV, PBR, articulations et rapport honnête. Le coordinateur intègre et pousse après contrôle.' },
    suivi: suiviValide ? ancienModele.suivi : (deja || creationActive ? { commit: ['unite_infanterie_base', 'unite_char_leger_base', 'unite_barge_base', 'batiment_qg_base'].includes(s.id) ? 'ffbc057' : null, controle: 'ok', ...(deja ? { revision: deja.revision } : {}), approbationArtistique: false } : { commit: null, controle: 'non_effectue', approbationArtistique: false }),
    prompt: consigneSequentielle(s.id) + promptProduction(s, presents, provenance?.sha256 ? { revision: provenance.sha256 } : null),
  };
});
writeFileSync(fichier, JSON.stringify({
  version: 1, date: new Date().toISOString().slice(0, 10), objectif: 'Préparer les modèles communs un par un avec un spécialiste 3D, puis pousser chaque livraison sur main.',
  execution: { simultaneiteModeles: 1, sourceHdImmuable: true, lod: [0], pngExternes: true, remplacementDirectApresControle: true, approbationArtistiqueAutomatique: false, testsAutomatiques: false, controleLotTechnique: true, branche: 'main' },
  perimetre: { mode: 'modeles_communs', variantesNationales: 'hors_lot', variantesRegionales: 'suspendues', nombreExclu: toutes.length - specs.length, herbePlaine: 'Rendu de sol par défaut conservé, conformément au choix du propriétaire.' },
  verificationSources: ancien?.verificationSources ?? {
    date: '2026-09-16', depotLocal: 'inspecte', stockageDistant: 'non_interroge_jeton_non_configure_localement',
    regle: 'Ne jamais remplacer une source uploadée connue par un modèle procédural. Les modèles sans source HD identifiée restent explicitement à préparer/créer.',
  },
  total: modeles.length, familles: Object.fromEntries(Object.keys(ordreFamille).map(f => [f, modeles.filter(m => m.famille === f).length])),
  mesuresTelephone: 'en_attente_appareil_reel', modeles,
}, null, 2) + '\n');
console.log(JSON.stringify({ fichier, total: modeles.length, etats: Object.fromEntries([...new Set(modeles.map(m => m.etat))].map(e => [e, modeles.filter(m => m.etat === e).length])) }));
