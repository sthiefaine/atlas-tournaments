/** Point d'entrée de la couche `db` : le client, le schéma, les requêtes. */

export { baseConfiguree, db, fermer, ping, pool } from './client';
export * as tables from './schema';
export * from './requetes/index';
