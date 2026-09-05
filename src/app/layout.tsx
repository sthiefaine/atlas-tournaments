import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Atlas Tournament',
  description: 'Le tour du monde en une manche — tactique au tour par tour.',
};

/**
 * Mise en page racine. Aucune police n'est téléchargée : le jeu et le site
 * emploient des piles système avec repli, une par script (`09-i18n.md` §7.2), ce
 * qui évite une dépendance réseau au build comme à l'exécution.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
