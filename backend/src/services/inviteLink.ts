/**
 * Verifie qu'un lien genere par Supabase ramene bien sur l'app.
 * Quand le redirectTo demande n'est pas dans la liste « Redirect URLs » du projet,
 * Supabase le remplace sans erreur par le Site URL (localhost:3000 par defaut) :
 * le destinataire tombe alors sur une page morte apres avoir consomme son lien.
 */
export function redirectsToApp(link: string, appUrl: string): boolean {
  try {
    const redirect = new URL(link).searchParams.get('redirect_to');
    if (!redirect) return false;
    return new URL(redirect).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
