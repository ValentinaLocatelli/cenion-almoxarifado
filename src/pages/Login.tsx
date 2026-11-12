import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Battery, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ForgotPasswordPanel } from '@/components/auth/ForgotPasswordPanel';
import { RECOVERY_QUERY_PARAM } from '@/lib/passwordRecovery';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  // /login?recuperar=1 ("Pedir novo link" da tela de redefinição) já abre o painel de recuperação.
  const [showForgotPassword, setShowForgotPassword] = useState(searchParams.get(RECOVERY_QUERY_PARAM) === '1');
  const { login } = useAuth();
  const navigate = useNavigate();

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
            Cenion | Almoxarifado
          </h1>
          <p className="text-lg text-sidebar-foreground/70 mb-8">
            Controle de estoque do almoxarifado: entradas, saídas e itens por unidade
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
              <span className="text-xl font-bold">Almoxarifado</span>
            </div>
            <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Acesso de administradores e supervisores, com o mesmo e-mail e a mesma senha do Cenion OS Management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="identifier">E-mail</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="seu@email.com"
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
                <ForgotPasswordPanel initialIdentifier={identifier.includes('@') ? identifier.trim() : ''} />
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
