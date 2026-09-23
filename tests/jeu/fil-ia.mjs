// Amorce d'un vrai thread pour `ia-thread.test.ts` : Node ne sait pas charger
// du TypeScript dans un `worker_threads` par ses seules options, on passe donc
// par l'API de tsx, qui lit le `tsconfig.json` (et l'alias `@/`) comme ailleurs.
import { tsImport } from 'tsx/esm/api';

await tsImport('./fil-ia.ts', import.meta.url);
