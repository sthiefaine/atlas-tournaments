/** Le budget dépend du dispositif de pointage, pas de la largeur de la page. */
export function appareilTactile(fenetre: Pick<Window, 'matchMedia'> | null | undefined): boolean {
  try {
    return fenetre?.matchMedia?.('(pointer: coarse)')?.matches === true;
  } catch {
    return false;
  }
}
