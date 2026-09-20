/** Vérifie les octets servis après déploiement, sans rendre la scène ni approuver l'art. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { estInventaireModeles } from '../../src/assets/spec';

async function verifier() {
  const id = process.argv[2];
  if (!id || !/^[a-z0-9_]+$/.test(id)) throw new Error('Identifiant de modèle requis');
  const lot = path.join('assets/livraisons', id);
  const validation = JSON.parse(readFileSync(path.join(lot, 'validation-lot.json'), 'utf8'));
  if (validation.id !== id || validation.verdict?.ok !== true) throw new Error('Lot contrôlé requis');
  const noms = validation.verdict.acceptes as unknown;
  if (!Array.isArray(noms) || !noms.length || noms.some(n => typeof n !== 'string' || !/^[a-z0-9_]+\.(glb|png)$/.test(n))) {
    throw new Error('Liste de fichiers GLB/PNG voisins requise');
  }
  const empreinte = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  const fichiers = (noms as string[]).map(nom => ({ nom, sha256: empreinte(readFileSync(path.join(lot, nom))) }));
  const glb = fichiers.find(f => f.nom === `${id}_lod0.glb`);
  if (!glb || empreinte(readFileSync(path.join('public/assets/modeles', glb.nom))) !== glb.sha256) {
    throw new Error('Le lot et le modèle actif diffèrent');
  }
  const domaine = 'atlas-tournament.clairdev.com';
  const resultats: { fichier: string; conforme: boolean; status?: number; erreur?: string }[] = [];
  for (let debut = 0; debut < fichiers.length; debut += 4) {
    const bloc = fichiers.slice(debut, debut + 4);
    const reponses = await Promise.allSettled(bloc.map(async fichier => {
      const r = await fetch(`https://${domaine}/assets/modeles/${fichier.nom}`, {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      return { fichier: fichier.nom, status: r.status, conforme: r.ok && empreinte(new Uint8Array(await r.arrayBuffer())) === fichier.sha256 };
    }));
    reponses.forEach((r, i) => resultats.push(r.status === 'fulfilled' ? r.value : {
      fichier: bloc[i]!.nom, conforme: false, erreur: r.reason instanceof Error ? r.reason.message : 'Lecture distante impossible',
    }));
  }
  let inventaire: { conforme: boolean; status?: number; erreur?: string };
  try {
    const r = await fetch(`https://${domaine}/api/modeles`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const contenu: unknown = r.ok ? await r.json() : null;
    inventaire = { status: r.status, conforme: r.ok && estInventaireModeles(contenu) && contenu.modeles[id]?.includes(0) === true };
  } catch (e) {
    inventaire = { conforme: false, erreur: e instanceof Error ? e.message : 'Inventaire distant impossible' };
  }
  const conforme = resultats.every(r => r.conforme) && inventaire.conforme;
  if (conforme) {
    // Relire après le réseau pour conserver une éventuelle mise à jour du coordinateur.
    const chemin = 'assets/production/plan-modeles-3d.json';
    const plan = JSON.parse(readFileSync(chemin, 'utf8'));
    const modele = plan.modeles.find((m: { id: string }) => m.id === id);
    if (!modele || modele.actuel?.sha256 !== glb.sha256) throw new Error('Inventaire actif modifié ou périmé');
    modele.suivi.deploiement = {
      date: new Date().toISOString(), domaine, glbEtPngConformesSha256: true,
      fichiersVerifies: fichiers.length, presentInventaireJeu: true, controleVisuel: false,
    };
    writeFileSync(chemin, JSON.stringify(plan, null, 2) + '\n');
  }
  console.log(JSON.stringify({ id, conforme, inventaire, resultats }));
  if (!conforme) process.exitCode = 2;
}
void verifier().catch(e => { console.error(e instanceof Error ? e.message : 'Vérification impossible'); process.exitCode = 1; });
