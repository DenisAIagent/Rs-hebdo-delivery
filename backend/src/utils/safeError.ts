/**
 * Description d'une erreur sans danger pour les logs.
 *
 * Une erreur axios transporte la configuration de la requete : en-tete
 * Authorization, identifiants Basic (`config.auth`) et corps (`config.data`,
 * ou figure par exemple le refresh token Dropbox). On ne logue donc jamais
 * l'objet brut, seulement le statut et la reponse du service distant.
 */
export function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return String(error);

  const e = error as { message?: unknown; response?: { status?: unknown; data?: unknown } };
  const message = typeof e.message === 'string' ? e.message : 'Erreur inconnue';
  const status = e.response?.status;
  const data = e.response?.data;
  if (status === undefined && data === undefined) return message;

  let body = '';
  if (typeof data === 'string') body = data;
  else if (data !== undefined) {
    try {
      body = JSON.stringify(data);
    } catch {
      body = '[reponse non serialisable]';
    }
  }
  return `${message}${status !== undefined ? ` (HTTP ${String(status)})` : ''}${body ? ` — ${body.slice(0, 500)}` : ''}`;
}

/** Erreur simple portant uniquement la description sure (a relancer a la place d'une erreur axios). */
export function toSafeError(error: unknown): Error {
  return new Error(describeError(error));
}
