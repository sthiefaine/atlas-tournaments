/** Pictogrammes Atlas, partagés par la navigation ; aucun sprite à télécharger. */
const TRACES = {
  carte: 'M3 5 9 3l6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16M5 11l2 2m4-3 2-2m4 7 2-2',
  cube: 'm12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7.5 5.5l9 5',
  unites: 'M4 14h16l2 3-2 3H4l-2-3 2-3ZM7 14V9h9l2 5M12 9V6h9M6 17h.01M10 17h.01M14 17h.01M18 17h.01',
  batiments: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M8 10h1m6 0h1M11 7h2',
  commandants: 'M7 8a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0V8ZM3 21v-2c0-3 4-5 9-5s9 2 9 5v2M7 6h10',
  decors: 'm12 2 6 8h-3l5 7h-7v5h-2v-5H4l5-7H6l6-8Z',
  reglages: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  suivi: 'M5 4h14v17H5V4ZM9 3h6v3H9V3ZM8 11l2 2 5-5M8 17h8',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
} as const;
export type NomSigne = keyof typeof TRACES;
export function Signe({ nom, className }: { nom: NomSigne; className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TRACES[nom]} /></svg>;
}
