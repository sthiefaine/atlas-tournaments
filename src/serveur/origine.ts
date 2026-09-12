/** Origines autorisées pour les écritures privées derrière le proxy.
 * SITE_URL est une configuration serveur, jamais un en-tête fourni par le client.
 */
export function origineAutorisee(req: Request, siteUrl = process.env.SITE_URL): boolean {
  const origine = req.headers.get('origin');
  if (!origine) return true; // Clients non navigateur déjà authentifiés.
  if (origine === new URL(req.url).origin) return true;
  if (!siteUrl) return false;
  try {
    const publique = new URL(siteUrl);
    return ['https:', 'http:'].includes(publique.protocol) && origine === publique.origin;
  } catch {
    return false;
  }
}
