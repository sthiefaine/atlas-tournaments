/**
 * Point d'entrée des requêtes : un module nommé par table, jamais un fourre-tout.
 * On importe `import { prompts } from '@/db/requetes'` puis `prompts.promouvoir(…)`.
 */

export * as cartes from './cartes';
export * as chaines from './chaines';
export * as commandants from './commandants';
export * as communs from './communs';
export * as compteurs from './compteurs';
export * as depeches from './depeches';
export * as evenements from './evenements';
export * as glossaires from './glossaires';
export * as localesReq from './locales';
export * as memoire from './memoire';
export * as missions from './missions';
export * as pays from './pays';
export * as prompts from './prompts';
export * as reviews from './reviews';
export * as runs from './runs';
export * as scenarios from './scenarios';
export * as traductions from './traductions';
export * as unites from './unites';
