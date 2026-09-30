import { useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUnit } from '@/contexts/ActiveUnitContext';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function roleLabel(role: 'ADMIN' | 'SUPERVISOR' | 'TECNICO') {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'SUPERVISOR') return 'Supervisor';
  return 'Técnico';
}

export default function Profile() {
  const { user, refreshUserProfile } = useAuth();
  const { availableUnits } = useActiveUnit();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const unitLabel = useMemo(() => {
    if (!user.unitId) return 'Todas as unidades';
    return availableUnits.find((unit) => unit.id === user.unitId)?.name ?? 'Unidade não encontrada';
  }, [availableUnits, user.unitId]);

  useEffect(() => {
    setDisplayName(user.name);
  }, [user.name]);

  const isMissingAvatarColumn = (error: unknown) => {
    const typed = error as { code?: string; message?: string; details?: string } | null;
    const combined = `${typed?.message ?? ''} ${typed?.details ?? ''}`.toLowerCase();
    return combined.includes('avatar_url') && (typed?.code?.startsWith('PGRST') || typed?.code === '42703');
  };

  const updateAvatar = async (avatarUrl: string | null) => {
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (error) {
      if (isMissingAvatarColumn(error)) {
        throw new Error('Coluna avatar_url não encontrada. Execute o SQL supabase/add_user_avatar_url.sql.');
      }
      throw error;
    }

    await refreshUserProfile();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    setIsSavingAvatar(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
        reader.readAsDataURL(file);
      });

      await updateAvatar(dataUrl);
      toast.success('Foto de perfil atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a foto.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await updateAvatar(null);
      toast.success('Foto removida com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a foto.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      toast.error('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
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

      setNewPassword('');
      setConfirmPassword('');
      await refreshUserProfile();
      toast.success('Senha alterada com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a senha.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      toast.error('Informe seu nome.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: trimmedName })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUserProfile();
      toast.success('Nome atualizado com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o nome.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Meu Perfil"
        description="Visualize seus dados, atualize sua foto e altere sua senha."
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
          <CardDescription>Login é somente leitura.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
              <AvatarFallback>
                <UserCircle2 className="h-10 w-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {isSavingAvatar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Alterar Foto
                </div>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(event) => void handleAvatarUpload(event)}
                disabled={isSavingAvatar}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRemoveAvatar()}
                disabled={isSavingAvatar || !user.avatarUrl}
              >
                Remover Foto
              </Button>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveProfile}>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Login</Label>
              <Input value={user.login ?? '-'} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Input value={roleLabel(user.role)} readOnly />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Unidade</Label>
              <Input value={unitLabel} readOnly />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar nome'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Troque sua senha de acesso atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
