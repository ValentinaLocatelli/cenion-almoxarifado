import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ChangePassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

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
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', user.id);
      if (profileError) {
        const typed = profileError as { code?: string; message?: string; details?: string };
        const combined = `${typed.message ?? ''} ${typed.details ?? ''}`.toLowerCase();
        const isMissingColumn =
          combined.includes('must_change_password') && (typed.code?.startsWith('PGRST') || typed.code === '42703');
        if (!isMissingColumn) throw profileError;
      }

      await supabase.auth.signOut();
      toast.success('Senha alterada com sucesso. Faça login novamente.');
      navigate('/login', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível alterar a senha.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>
            Primeiro acesso detectado. Defina sua nova senha para continuar.
          </CardDescription>
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
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login', { replace: true })}
              disabled={isLoading}
            >
              Voltar para Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
