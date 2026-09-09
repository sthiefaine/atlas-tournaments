import { exigerRoutine } from '@/serveur/auth';
import { json } from '@/serveur/reponses';
import { personnagesPourActe } from '@/serveur/personnages';
export const dynamic = 'force-dynamic';
export async function GET(requete: Request) {
  const refus = exigerRoutine(requete);
  if (refus) return refus;
  const acte = new URL(requete.url).searchParams.get('acte') ?? '0';
  if (!/^[0-3]$/.test(acte)) return json({ error: 'acte_invalide', detail: 'acte doit être compris entre 0 et 3' }, 400);
  return json(personnagesPourActe(Number(acte)));
}
