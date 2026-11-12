import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { recoveryErrorMessage, requestPasswordRecovery, type RecoveryResult } from '@/lib/passwordRecovery';

/**
 * Painel "Esqueceu sua senha?" da tela de login. Arquivo IDÊNTICO no OS Management, no Produção e no Estoque.
 * Envia o link de redefinição por e-mail (Supabase) e nunca mostra senha; técnico recebe a orientação de pedir a um gestor.
 */
export function ForgotPasswordPanel({ initialIdentifier = '' }: { initialIdentifier?: string }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);

  const submit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      setResult(await requestPasswordRecovery(supabase.auth, identifier, window.location.origin));
    } catch (error) {
      setResult({ status: 'error', message: recoveryErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProblem = result?.status === 'error' || result?.status === 'invalid';

  return (
    <div className="rounded-lg border p-4 space-y-4" data-testid="forgot-password-panel">
      <p className="text-sm text-muted-foreground">
        Admin e supervisor: informe o e-mail cadastrado e enviaremos um link para criar uma nova senha. Técnicos: peça a
        redefinição ao seu supervisor ou administrador.
      </p>
      <div className="space-y-2">
        <Label htmlFor="recovery-identifier">E-mail cadastrado</Label>
        <Input
          id="recovery-identifier"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="admin@empresa.com"
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            setResult(null);
          }}
          onKeyDown={(event) => {
            // O painel fica dentro do formulário de login: Enter aqui pede o link, não tenta entrar.
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
        />
      </div>
      <Button type="button" className="w-full" onClick={() => void submit()} disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
      </Button>
      {result && (
        <p role="status" className={isProblem ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {result.message}
        </p>
      )}
    </div>
  );
}
