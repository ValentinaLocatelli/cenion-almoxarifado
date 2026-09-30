import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Battery, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object') {
      const typed = error as Record<string, unknown>;
      const parts = [typed.message, typed.details, typed.hint, typed.code]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .map((part) => String(part));
      if (parts.length > 0) return parts.join(' | ');
    }
    return fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(identifier, password);
      if (result.success) {
        toast.success('Login realizado com sucesso!');
        if (result.requiresPasswordChange) {
          navigate('/change-password');
          return;
        }
        navigate('/dashboard');
      } else {
        if (result.error?.toLowerCase().includes('email not confirmed')) {
          toast.error('E-mail não confirmado. Confirme seu e-mail para entrar.');
        } else {
          toast.error(result.error ?? 'Credenciais inválidas');
        }
      }
    } catch {
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminRecoveryEmail = async () => {
    const email = adminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Informe um e-mail válido de administrador ou supervisor.');
      return;
    }

    setIsSubmittingForgot(true);
    try {
      const { data, error } = await supabase.rpc('request_manager_temporary_password', {
        p_email: email,
      });
      if (error) throw error;

      const temporaryPassword = typeof data === 'string' ? data : null;
      if (temporaryPassword) {
        toast.success(`Senha temporária gerada: ${temporaryPassword}`);
      } else {
        toast.success('Se o e-mail existir para Admin/Supervisor ativo, a recuperação foi processada.');
      }
      setAdminEmail('');
      setShowForgotPassword(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível processar a recuperação de senha.'));
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
              <Battery className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-sidebar-foreground mb-4">
            Cenion | OS Manager
          </h1>
          <p className="text-lg text-sidebar-foreground/70 mb-8">
            Sistema de Gerenciamento de Ordens de Serviço para Manutenção de Baterias e Carregadores Industriais
          </p>
          <div className="flex items-center justify-center gap-6 text-sidebar-foreground/50">
            <div className="flex items-center gap-2">
              <Battery className="w-5 h-5" />
              <span>Baterias de Lítio</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <span>Carregadores</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
                <Battery className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">OS Manager</span>
            </div>
            <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Use o mesmo e-mail e a mesma senha cadastrados no Cenion OS Management. Técnicos também podem usar o login (nome.sobrenome), quando configurado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="identifier">E-mail ou Login (Técnico)</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="seu@email.com ou nome.sobrenome"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={() => setShowForgotPassword((current) => !current)}
              >
                Esqueceu sua senha?
              </Button>

              {showForgotPassword && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Disponível apenas para Admin/Supervisor. Será gerada uma senha temporária de acesso.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">E-mail do Admin/Supervisor</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@empresa.com"
                        value={adminEmail}
                        onChange={(event) => setAdminEmail(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void handleAdminRecoveryEmail()}
                      disabled={isSubmittingForgot}
                    >
                      {isSubmittingForgot ? 'Processando...' : 'Gerar Senha Temporária'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
