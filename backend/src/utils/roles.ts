/**
 * Roles des comptes. Le CTO a les memes droits qu'un admin et recoit en plus
 * les alertes techniques du canari (services/canary.ts).
 */
export const ROLES = ['journalist', 'admin', 'cto'] as const;
export type Role = (typeof ROLES)[number];

/** Roles qui donnent acces a l'administration. */
export const ADMIN_ROLES: readonly Role[] = ['admin', 'cto'];

export function isValidRole(role: unknown): role is Role {
  return typeof role === 'string' && (ROLES as readonly string[]).includes(role);
}

export function isAdminRole(role: unknown): boolean {
  return typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role);
}
