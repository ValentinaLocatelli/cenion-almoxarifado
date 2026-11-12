/**
 * Regra de sessão dos apps Cenion. Arquivo IDÊNTICO no OS Management, no Produção e no Estoque.
 *
 * Perfil ausente ou desativado não entra, mesmo que o navegador ainda guarde uma sessão válida (o bloqueio de inativo
 * existia só no formulário de login: quem já estava logado continuava dentro até a sessão acabar). Cada app pode, além
 * disso, aceitar só alguns papéis: o Estoque (almoxarifado) aceita só ADMIN e SUPERVISOR.
 */
export interface SessionProfile {
  active: boolean;
  role: string;
}

/** `null` = qualquer papel. */
export type AllowedRoles = readonly string[] | null;

export function isProfileAllowed<T extends SessionProfile>(
  profile: T | null | undefined,
  allowedRoles: AllowedRoles = null,
): profile is T {
  if (!profile || profile.active !== true) return false;
  return allowedRoles === null || allowedRoles.includes(profile.role);
}
