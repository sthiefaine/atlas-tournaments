/** Index d'un choix au clavier ; null laisse le navigateur traiter la touche. */
export function indexChoix(touche: string, actuel: number, total: number): number | null {
  if (total < 1) return null;
  switch (touche) {
    case 'ArrowRight':
    case 'ArrowDown': return (actuel + 1) % total;
    case 'ArrowLeft':
    case 'ArrowUp': return (actuel + total - 1) % total;
    case 'Home': return 0;
    case 'End': return total - 1;
    default: return null;
  }
}
