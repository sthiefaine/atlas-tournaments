import Journal from './journal';
import { donneesJournal } from './donnees';
export const metadata = { title: 'Carnet de bord · Atlas' };
export default function PageJournal() { return <Journal {...donneesJournal()} />; }
