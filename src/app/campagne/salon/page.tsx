import { redirect } from 'next/navigation';

/** Compatibilité des anciens liens : plus d’écran intermédiaire. */
export default function Salon(): never {
  redirect('/campagne');
}
