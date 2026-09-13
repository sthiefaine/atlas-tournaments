import { redirect } from 'next/navigation';

/** Le jeu libre est retiré ; les parties sont accessibles depuis la campagne. */
export default function PageJeu(): never { redirect('/campagne'); }
