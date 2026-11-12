/**
 * "Esqueceu sua senha?" das telas de login. Arquivo IDÊNTICO no OS Management, no Produção e no Estoque.
 *
 * Admin e supervisor recebem por e-mail um link do Supabase que abre /reset-password (a tela grava a senha nova com
 * updateUser). Nenhuma senha é gerada nem mostrada na tela: a antiga função request_manager_temporary_password devolvia a
 * senha nova para quem chamasse, sem login, e não é mais usada.
 * Técnico entra com login (nome.sobrenome@tecnico.cenion.com), que não recebe e-mail: a redefinição é feita por um gestor.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const TECH_LOGIN_EMAIL_DOMAIN = 'tecnico.cenion.com';

/** Parâmetro de /login que já abre o painel de recuperação (usado pelo "Pedir novo link" de /reset-password). */
export const RECOVERY_QUERY_PARAM = 'recuperar';

/** Mesma resposta para e-mail cadastrado ou não: a tela não revela quais e-mails existem. */
export const RECOVERY_SENT_MESSAGE =
  'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.';
export const TECHNICIAN_RECOVERY_MESSAGE =
  'Técnicos não recebem e-mail: peça ao seu supervisor ou administrador para redefinir a senha (Usuários → Editar).';
export const RECOVERY_INVALID_MESSAGE = 'Informe o e-mail cadastrado.';
export const RECOVERY_RATE_LIMIT_MESSAGE = 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.';
export const RECOVERY_ERROR_MESSAGE =
  'Não foi possível enviar o e-mail de recuperação agora. Tente de novo em alguns minutos ou fale com um administrador.';

// Caracteres invisíveis que o copiar/colar traz (zero-width space, joiner e BOM), montados por código de caractere.
const INVISIBLE_CHARS = new RegExp(
  `[${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200d)}${String.fromCharCode(0xfeff)}]`,
  'g',
);

export type RecoveryTarget = { kind: 'email'; email: string } | { kind: 'technician' } | { kind: 'invalid' };

export type RecoveryResult = { status: 'sent' | 'technician' | 'invalid' | 'error'; message: string };

type RecoveryAuthClient = Pick<SupabaseClient['auth'], 'resetPasswordForEmail'>;

export function classifyRecoveryIdentifier(value: string): RecoveryTarget {
  const raw = value
    .normalize('NFKC')
    .replace(INVISIBLE_CHARS, '')
    .trim()
    .toLowerCase();
  if (!raw) return { kind: 'invalid' };
  // Sem "@" é o login do técnico (nome.sobrenome).
  if (!raw.includes('@')) return { kind: 'technician' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { kind: 'invalid' };
  if (raw.endsWith(`@${TECH_LOGIN_EMAIL_DOMAIN}`)) return { kind: 'technician' };
  return { kind: 'email', email: raw };
}

export function recoveryRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/reset-password`;
}

export function recoveryErrorMessage(error: unknown): string {
  const record = (error && typeof error === 'object' ? error : {}) as { status?: number; code?: string; message?: string };
  const text = `${record.code ?? ''} ${record.message ?? ''}`.toLowerCase();
  if (record.status === 429 || text.includes('rate limit') || text.includes('rate_limit') || text.includes('security purposes')) {
    return RECOVERY_RATE_LIMIT_MESSAGE;
  }
  return RECOVERY_ERROR_MESSAGE;
}

export async function requestPasswordRecovery(
  auth: RecoveryAuthClient,
  identifier: string,
  origin: string,
): Promise<RecoveryResult> {
  const target = classifyRecoveryIdentifier(identifier);
  if (target.kind === 'invalid') return { status: 'invalid', message: RECOVERY_INVALID_MESSAGE };
  if (target.kind === 'technician') return { status: 'technician', message: TECHNICIAN_RECOVERY_MESSAGE };

  try {
    const { error } = await auth.resetPasswordForEmail(target.email, { redirectTo: recoveryRedirectUrl(origin) });
    if (error) return { status: 'error', message: recoveryErrorMessage(error) };
  } catch (error) {
    return { status: 'error', message: recoveryErrorMessage(error) };
  }
  return { status: 'sent', message: RECOVERY_SENT_MESSAGE };
}
