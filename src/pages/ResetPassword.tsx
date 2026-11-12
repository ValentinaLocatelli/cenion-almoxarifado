import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { RECOVERY_QUERY_PARAM } from '@/lib/passwordRecovery';

// Tela aberta pelo link do e-mail de "Esqueceu sua senha?" (o Supabase entrega a sessão de recuperação na URL).
// Arquivo idêntico no OS Management, no Produção e no Estoque.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  const requestNewLink = () => navigate(`/login?${RECOVERY_QUERY_PARAM}=1`);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error('A senha precisa ter ao menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLinkExpired(true);
        toast.error('Link inválido ou expirado. Peça um novo e-mail de recuperação.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', session.user.id);
      if (profileError) {
        const typed = profileError as { code?: string; message?: string; details?: string };
        const combined = `${typed.message ?? ''} ${typed.details ?? ''}`.toLowerCase();
        const isMissingColumn =
          combined.includes('must_change_password') && (typed.code?.startsWith('PGRST') || typed.code === '42703');
        if (!isMissingColumn) throw profileError;
      }

      // A sessão do link serve só para trocar a senha: a pessoa entra de novo com a senha nova.
      await supabase.auth.signOut();
      toast.success('Senha redefinida com sucesso. Entre com a nova senha.');
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível redefinir a senha.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redefinir Senha</CardTitle>
          <CardDescription>Defina uma nova senha para a sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Nova Senha'
              )}
            </Button>
            {linkExpired && (
              <p role="alert" className="text-sm text-destructive">
                O link deste e-mail venceu ou já foi usado.
              </p>
            )}
            <Button type="button" variant="link" className="w-full text-sm" onClick={requestNewLink}>
              Link vencido? Pedir novo link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
