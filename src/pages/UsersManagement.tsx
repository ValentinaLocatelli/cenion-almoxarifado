import { useEffect, useState } from 'react';
import { Plus, Edit, UserCheck, UserX, Mail, Shield, Wrench, Loader2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppData } from '@/contexts/AppDataContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { BusinessUnit, User, UserPermissions, UserRole } from '@/types';

const TECH_EMAIL_DOMAIN = 'tecnico.cenion.com';

function getDefaultPermissionsByRole(role: UserRole): UserPermissions {
  if (role === 'ADMIN') {
    return {
      dashboardFinancial: true,
      manageBusinessUnits: true,
      manageUsers: true,
      canCreateTechnicians: true,
      manualOrderControl: true,
    };
  }

  if (role === 'SUPERVISOR') {
    return {
      dashboardFinancial: false,
      manageBusinessUnits: false,
      manageUsers: false,
      canCreateTechnicians: true,
      manualOrderControl: false,
    };
  }

  return {
    dashboardFinancial: false,
    manageBusinessUnits: false,
    manageUsers: false,
    canCreateTechnicians: false,
    manualOrderControl: false,
  };
}

function normalizePermissions(role: UserRole, permissions: UserPermissions): UserPermissions {
  if (role === 'ADMIN') return getDefaultPermissionsByRole(role);
  if (role === 'TECNICO') return getDefaultPermissionsByRole(role);

  const manageUsers = permissions.manageUsers;

  return {
    dashboardFinancial: permissions.dashboardFinancial,
    manageBusinessUnits: permissions.manageBusinessUnits,
    manageUsers,
    canCreateTechnicians: manageUsers ? permissions.canCreateTechnicians : false,
    manualOrderControl: permissions.manualOrderControl,
  };
}

export default function UsersManagement() {
  const { user: currentUser, isAdmin, canCreateTechnicians } = useAuth();
  const { users, updateUserActive, refreshAll } = useAppData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'SUPERVISOR' | 'TECNICO'>('TECNICO');
  const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissionsByRole('TECNICO'));
  const [unitId, setUnitId] = useState<string>('NONE');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'SUPERVISOR' | 'TECNICO'>('TECNICO');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(getDefaultPermissionsByRole('TECNICO'));
  const [editUnitId, setEditUnitId] = useState<string>('NONE');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [resetPassword, setResetPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const createRoleOptions: UserRole[] = isAdmin ? ['ADMIN', 'SUPERVISOR', 'TECNICO'] : ['TECNICO'];
  const editRoleOptions: UserRole[] = isAdmin ? ['ADMIN', 'SUPERVISOR', 'TECNICO'] : ['TECNICO'];

  const resetForm = () => {
    setName('');
    setEmail('');
    setUsername('');
    const defaultRole: UserRole = 'TECNICO';
    setRole(defaultRole);
    setPermissions(getDefaultPermissionsByRole(defaultRole));
    setUnitId(isAdmin ? 'NONE' : (currentUser?.unitId ?? 'NONE'));
    setPassword('');
  };

  useEffect(() => {
    const loadUnits = async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id,name,city,state,active')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) {
        console.error('Falha ao carregar unidades:', error);
        return;
      }
      setUnits((data ?? []) as BusinessUnit[]);
    };

    void loadUnits();
  }, []);

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

  const sanitizeEmail = (value: string) => {
    const normalized = value
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();

    const withoutWrappers = normalized.replace(/[<>"'`]/g, '');
    const extracted =
      withoutWrappers.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/)?.[0]
      ?? withoutWrappers;

    return extracted.replace(/\s+/g, '');
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const sanitizeUsername = (value: string) =>
    value
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');
  const isMissingRpc = (error: unknown) => (error as { code?: string } | null)?.code === 'PGRST202';

  const confirmUserEmailAfterCreate = async (userId: string, userEmail: string) => {
    const { error: confirmError } = await supabase.rpc('admin_confirm_user_email', {
      p_user_id: userId,
    });

    if (!confirmError) return;
    if (!isMissingRpc(confirmError)) throw confirmError;

    const { error: updateError } = await supabase.rpc('admin_update_user_auth_credentials', {
      p_user_id: userId,
      p_email: userEmail,
      p_password: null,
    });

    if (!updateError) return;
    if (!isMissingRpc(updateError)) throw updateError;

    throw new Error(
      'Não foi possível confirmar o e-mail automaticamente. Execute os SQLs de suporte admin_confirm_user_email.sql e admin_update_user_auth_credentials.sql no Supabase.',
    );
  };

  const isMissingPermissionsColumn = (error: unknown) => {
    const typed = error as { code?: string; message?: string; details?: string } | null;
    const combined = `${typed?.message ?? ''} ${typed?.details ?? ''}`.toLowerCase();
    return combined.includes('permissions') && (typed?.code?.startsWith('PGRST') || typed?.code === '42703');
  };

  const isMissingMustChangePasswordColumn = (error: unknown) => {
    const typed = error as { code?: string; message?: string; details?: string } | null;
    const combined = `${typed?.message ?? ''} ${typed?.details ?? ''}`.toLowerCase();
    return combined.includes('must_change_password') && (typed?.code?.startsWith('PGRST') || typed?.code === '42703');
  };

  const savePermissions = async (userId: string, targetRole: UserRole, targetPermissions: UserPermissions) => {
    const normalized = normalizePermissions(targetRole, targetPermissions);
    const { error } = await supabase
      .from('users')
      .update({ permissions: normalized })
      .eq('id', userId);

    if (!error) return;
    if (isMissingPermissionsColumn(error)) {
      throw new Error(
        'Coluna permissions não encontrada na tabela users. Execute o SQL supabase/add_user_permissions.sql.',
      );
    }
    throw error;
  };

  const handleCreateRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setPermissions(getDefaultPermissionsByRole(nextRole));
    if (nextRole === 'ADMIN') {
      setUnitId('NONE');
      setUsername('');
    } else if (!isAdmin) {
      setUnitId(currentUser?.unitId ?? 'NONE');
    }
  };

  const handleEditRoleChange = (nextRole: UserRole) => {
    setEditRole(nextRole);
    setEditPermissions(getDefaultPermissionsByRole(nextRole));
    if (nextRole === 'ADMIN') {
      setEditUnitId('NONE');
      setEditUsername('');
    } else if (!isAdmin) {
      setEditUnitId(currentUser?.unitId ?? 'NONE');
    }
  };

  const handleCreateUser = async () => {
    if (!isAdmin && !canCreateTechnicians) {
      toast.error('Você não tem permissão para cadastrar usuários.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = sanitizeEmail(email);
    const trimmedUsername = sanitizeUsername(username || trimmedName);
    const targetRole: UserRole = isAdmin ? role : 'TECNICO';
    const targetPermissions = normalizePermissions(targetRole, permissions);
    const usesEmailLogin = targetRole === 'ADMIN' || targetRole === 'SUPERVISOR';
    const resolvedEmail = usesEmailLogin ? trimmedEmail : `${trimmedUsername}@${TECH_EMAIL_DOMAIN}`;
    const resolvedUnitId = targetRole === 'ADMIN'
      ? null
      : (isAdmin ? (unitId === 'NONE' ? null : unitId) : (currentUser?.unitId ?? null));

    if (!trimmedName) {
      toast.error('Informe o nome do usuário.');
      return;
    }

    if (usesEmailLogin) {
      if (!trimmedEmail) {
        toast.error(targetRole === 'ADMIN' ? 'Informe o e-mail do administrador.' : 'Informe o e-mail do supervisor.');
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        toast.error('E-mail inválido. Verifique o formato (ex: nome@empresa.com).');
        return;
      }
    } else {
      if (!trimmedUsername) {
        toast.error('Informe o login do técnico.');
        return;
      }
      if (!resolvedUnitId) {
        toast.error('Selecione a unidade do usuário.');
        return;
      }
    }

    if (password.length < 6) {
      toast.error('A senha inicial precisa ter pelo menos 6 caracteres.');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: resolvedEmail,
        password,
        options: {
          data: {
            name: trimmedName,
            role: targetRole,
            login: targetRole === 'TECNICO' ? trimmedUsername : null,
          },
        },
      });

      if (error || !data.user) {
        throw error ?? new Error('Não foi possível criar a conta no Auth.');
      }

      if (isAdmin) {
        await confirmUserEmailAfterCreate(data.user.id, resolvedEmail);
      }

      const createProfilePayload = {
        id: data.user.id,
        name: trimmedName,
        email: resolvedEmail,
        login: targetRole === 'TECNICO' ? trimmedUsername : null,
        role: targetRole,
        unit_id: resolvedUnitId,
        active: true,
        must_change_password: true,
      };
      let { error: profileError } = await supabase.from('users').upsert(createProfilePayload);

      if (profileError && isMissingMustChangePasswordColumn(profileError)) {
        const fallback = await supabase.from('users').upsert({
          ...createProfilePayload,
          must_change_password: undefined,
        });
        profileError = fallback.error;
        if (!fallback.error) {
          toast.warning('Usuário criado sem flag de troca obrigatória. Execute o SQL supabase/add_must_change_password.sql.');
        }
      }

      if (profileError) {
        throw profileError;
      }

      await savePermissions(data.user.id, targetRole, targetPermissions);

      await refreshAll();
      toast.success('Usuário criado com sucesso.');
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível criar o usuário.');
      toast.error(message);
      console.error('Falha ao criar usuário:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    const current = users.find((user) => user.id === userId);
    if (!current) return;
    if (!isAdmin && current.role !== 'TECNICO') {
      toast.error('Supervisor pode alterar status somente de técnicos.');
      return;
    }

    try {
      await updateUserActive(userId, !current.active);
      toast.success('Status do usuário atualizado');
    } catch {
      toast.error('Não foi possível atualizar o status do usuário');
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir usuários.');
      return;
    }

    if (targetUser.id === currentUser?.id) {
      toast.error('Você não pode excluir seu próprio usuário.');
      return;
    }

    const confirmed = window.confirm(`Excluir o usuário "${targetUser.name}" permanentemente?`);
    if (!confirmed) return;

    setDeletingUserId(targetUser.id);
    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_user', {
        p_user_id: targetUser.id,
      });

      if (rpcError && isMissingRpc(rpcError)) {
        const fallback = await supabase.from('users').delete().eq('id', targetUser.id);
        if (fallback.error) throw fallback.error;
        toast.warning('Usuário removido de public.users. Execute o SQL admin_delete_user.sql para remover também do Auth.');
      } else if (rpcError) {
        throw rpcError;
      }

      await refreshAll();
      toast.success('Usuário excluído com sucesso.');
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível excluir o usuário.');
      toast.error(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const openEditDialog = (user: User) => {
    if (!isAdmin && user.role !== 'TECNICO') {
      toast.error('Supervisor pode editar somente usuários técnicos.');
      return;
    }

    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPermissions(user.permissions);
    setEditUnitId(user.unitId ?? 'NONE');
    setEditActive(user.active);
    if (user.role === 'TECNICO') {
      setEditUsername(user.login ?? user.email.split('@')[0] ?? '');
      setEditEmail('');
    } else {
      setEditEmail(user.email);
      setEditUsername('');
    }
    setResetPassword('');
    setIsEditDialogOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    if (!isAdmin && editingUser.role !== 'TECNICO') {
      toast.error('Supervisor pode editar somente usuários técnicos.');
      return;
    }

    const trimmedName = editName.trim();
    const sanitizedEmail = sanitizeEmail(editEmail);
    const sanitizedUsername = sanitizeUsername(editUsername || editName);
    const targetRole: UserRole = isAdmin ? editRole : 'TECNICO';
    const targetPermissions = normalizePermissions(targetRole, editPermissions);
    const usesEmailLogin = targetRole === 'ADMIN' || targetRole === 'SUPERVISOR';
    const resolvedEmail = usesEmailLogin ? sanitizedEmail : `${sanitizedUsername}@${TECH_EMAIL_DOMAIN}`;
    const resolvedUnitId = targetRole === 'ADMIN'
      ? null
      : (isAdmin ? (editUnitId === 'NONE' ? null : editUnitId) : (currentUser?.unitId ?? null));
    const trimmedPassword = targetRole === 'TECNICO' ? resetPassword.trim() : '';

    if (!trimmedName) {
      toast.error('Informe o nome do usuário.');
      return;
    }

    if (usesEmailLogin) {
      if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
        toast.error(
          targetRole === 'ADMIN'
            ? 'Informe um e-mail válido para administrador.'
            : 'Informe um e-mail válido para supervisor.',
        );
        return;
      }
    } else if (!sanitizedUsername) {
      toast.error('Informe o login do técnico.');
      return;
    } else if (!resolvedUnitId) {
      toast.error('Selecione a unidade do usuário.');
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      toast.error('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error: profileError } = await supabase
        .from('users')
        .update({
          name: trimmedName,
          email: resolvedEmail,
          login: targetRole === 'TECNICO' ? sanitizedUsername : null,
          role: targetRole,
          unit_id: resolvedUnitId,
          active: editActive,
        })
        .eq('id', editingUser.id);

      if (profileError) {
        throw profileError;
      }

      if (isAdmin && (resolvedEmail !== editingUser.email || trimmedPassword)) {
        const { error: authError } = await supabase.rpc('admin_update_user_auth_credentials', {
          p_user_id: editingUser.id,
          p_email: resolvedEmail !== editingUser.email ? resolvedEmail : null,
          p_password: trimmedPassword || null,
        });

        if (authError && (authError as { code?: string }).code === 'PGRST202') {
          throw new Error(
            'Função RPC admin_update_user_auth_credentials não encontrada. Execute o SQL de suporte para atualização de credenciais.',
          );
        }
        if (authError) {
          throw authError;
        }
      }

      if (!isAdmin && targetRole === 'TECNICO' && trimmedPassword) {
        const { error: resetError } = await supabase.rpc('reset_technician_password', {
          p_login: sanitizedUsername,
          p_new_password: trimmedPassword,
        });

        if (resetError) {
          throw resetError;
        }
      }

      if (trimmedPassword) {
        let { error: forceChangeError } = await supabase
          .from('users')
          .update({ must_change_password: true })
          .eq('id', editingUser.id);

        if (forceChangeError && isMissingMustChangePasswordColumn(forceChangeError)) {
          forceChangeError = null;
          toast.warning('Senha atualizada, mas sem flag de troca obrigatória. Execute o SQL supabase/add_must_change_password.sql.');
        }

        if (forceChangeError) throw forceChangeError;
      }

      await savePermissions(editingUser.id, targetRole, targetPermissions);

      await refreshAll();
      toast.success('Usuário atualizado com sucesso.');
      setIsEditDialogOpen(false);
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível atualizar o usuário.');
      toast.error(message);
      console.error('Falha ao editar usuário:', error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getUserUnitLabel = (user: User) => {
    if (user.role === 'ADMIN') return 'Todas';
    if (!user.unitId) return '-';
    return units.find((unit) => unit.id === user.unitId)?.name ?? '-';
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Gestão de Usuários"
        description="Gerenciar usuários e permissões do sistema"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin && !canCreateTechnicians}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
                Defina os dados e a senha inicial. No primeiro acesso, o usuário deverá alterar a senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">Perfil</Label>
                <Select value={role} onValueChange={(value) => handleCreateRoleChange(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createRoleOptions.includes('ADMIN') && <SelectItem value="ADMIN">Administrador</SelectItem>}
                    {createRoleOptions.includes('SUPERVISOR') && <SelectItem value="SUPERVISOR">Supervisor</SelectItem>}
                    {createRoleOptions.includes('TECNICO') && <SelectItem value="TECNICO">Técnico</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  placeholder="Nome do usuário"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (Admin e Supervisor)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={role === 'TECNICO'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Login do Técnico</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="nome.sobrenome"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={role !== 'TECNICO'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitId">Unidade de Negócio</Label>
                <Select value={unitId} onValueChange={setUnitId} disabled={role === 'ADMIN' || !isAdmin}>
                  <SelectTrigger id="unitId">
                    <SelectValue placeholder="Selecione uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Selecione</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && role !== 'ADMIN' && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Permissões do Perfil</p>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="perm-financial" className="cursor-pointer">Dashboard Financeiro</Label>
                    <Checkbox
                      id="perm-financial"
                      checked={permissions.dashboardFinancial}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => ({ ...prev, dashboardFinancial: checked === true }))
                      }
                      disabled={role === 'TECNICO'}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="perm-units" className="cursor-pointer">Unidades de Negócio</Label>
                    <Checkbox
                      id="perm-units"
                      checked={permissions.manageBusinessUnits}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => ({ ...prev, manageBusinessUnits: checked === true }))
                      }
                      disabled={role === 'TECNICO'}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="perm-users" className="cursor-pointer">Menu Usuários</Label>
                    <Checkbox
                      id="perm-users"
                      checked={permissions.manageUsers}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => {
                          const manageUsers = checked === true;
                          return {
                            ...prev,
                            manageUsers,
                            canCreateTechnicians: manageUsers ? prev.canCreateTechnicians : false,
                          };
                        })
                      }
                      disabled={role === 'TECNICO'}
                    />
                  </div>
                  {role === 'SUPERVISOR' && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="perm-create-tech" className="cursor-pointer">Pode cadastrar técnicos</Label>
                        <Checkbox
                          id="perm-create-tech"
                          checked={permissions.canCreateTechnicians}
                          onCheckedChange={(checked) =>
                            setPermissions((prev) => ({ ...prev, canCreateTechnicians: checked === true }))
                          }
                          disabled={!permissions.manageUsers}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="perm-manual-os" className="cursor-pointer">Controle manual de OS</Label>
                        <Checkbox
                          id="perm-manual-os"
                          checked={permissions.manualOrderControl}
                          onCheckedChange={(checked) =>
                            setPermissions((prev) => ({ ...prev, manualOrderControl: checked === true }))
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Senha Inicial</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button onClick={() => void handleCreateUser()} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Administradores</p>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Técnicos</p>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'SUPERVISOR' || u.role === 'TECNICO').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuários Ativos</p>
              <p className="text-2xl font-bold">{users.filter(u => u.active).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Usuário</TableHead>
              <TableHead className="font-semibold">E-mail / Login</TableHead>
              <TableHead className="font-semibold">Perfil</TableHead>
              <TableHead className="font-semibold">Unidade de Negócio</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Criado em</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="data-table-row">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                      user.role === 'ADMIN' ? 'bg-primary' : 'bg-blue-500'
                    )}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {user.role === 'TECNICO' ? (user.login ?? user.email.split('@')[0]) : user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {user.role === 'ADMIN' ? 'Administrador' : user.role === 'SUPERVISOR' ? 'Supervisor' : 'Técnico'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getUserUnitLabel(user)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={cn(
                      user.active 
                        ? 'border-green-200 bg-green-50 text-green-700' 
                        : 'border-red-200 bg-red-50 text-red-700'
                    )}
                  >
                    {user.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(user.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(user)}
                      disabled={!isAdmin && user.role !== 'TECNICO'}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => void handleToggleActive(user.id)}
                      disabled={!isAdmin && user.role !== 'TECNICO'}
                    >
                      {user.active ? (
                        <UserX className="w-4 h-4 text-red-500" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-green-500" />
                      )}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void handleDeleteUser(user)}
                        disabled={deletingUserId === user.id || user.id === currentUser?.id}
                      >
                        {deletingUserId === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere dados, perfil, status e, se necessário, redefina senha inicial do técnico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Perfil</Label>
              <Select value={editRole} onValueChange={(value) => handleEditRoleChange(value as UserRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editRoleOptions.includes('ADMIN') && <SelectItem value="ADMIN">Administrador</SelectItem>}
                  {editRoleOptions.includes('SUPERVISOR') && <SelectItem value="SUPERVISOR">Supervisor</SelectItem>}
                  {editRoleOptions.includes('TECNICO') && <SelectItem value="TECNICO">Técnico</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-unitId">Unidade de Negócio</Label>
              <Select value={editUnitId} onValueChange={setEditUnitId} disabled={editRole === 'ADMIN' || !isAdmin}>
                <SelectTrigger id="edit-unitId">
                  <SelectValue placeholder="Selecione uma unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Selecione</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && editRole !== 'ADMIN' && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Permissões do Perfil</p>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="edit-perm-financial" className="cursor-pointer">Dashboard Financeiro</Label>
                  <Checkbox
                    id="edit-perm-financial"
                    checked={editPermissions.dashboardFinancial}
                    onCheckedChange={(checked) =>
                      setEditPermissions((prev) => ({ ...prev, dashboardFinancial: checked === true }))
                    }
                    disabled={editRole === 'TECNICO'}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="edit-perm-units" className="cursor-pointer">Unidades de Negócio</Label>
                  <Checkbox
                    id="edit-perm-units"
                    checked={editPermissions.manageBusinessUnits}
                    onCheckedChange={(checked) =>
                      setEditPermissions((prev) => ({ ...prev, manageBusinessUnits: checked === true }))
                    }
                    disabled={editRole === 'TECNICO'}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="edit-perm-users" className="cursor-pointer">Menu Usuários</Label>
                  <Checkbox
                    id="edit-perm-users"
                    checked={editPermissions.manageUsers}
                    onCheckedChange={(checked) =>
                      setEditPermissions((prev) => {
                        const manageUsers = checked === true;
                        return {
                          ...prev,
                          manageUsers,
                          canCreateTechnicians: manageUsers ? prev.canCreateTechnicians : false,
                        };
                      })
                    }
                    disabled={editRole === 'TECNICO'}
                  />
                </div>
                {editRole === 'SUPERVISOR' && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="edit-perm-create-tech" className="cursor-pointer">Pode cadastrar técnicos</Label>
                      <Checkbox
                        id="edit-perm-create-tech"
                        checked={editPermissions.canCreateTechnicians}
                        onCheckedChange={(checked) =>
                          setEditPermissions((prev) => ({ ...prev, canCreateTechnicians: checked === true }))
                        }
                        disabled={!editPermissions.manageUsers}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="edit-perm-manual-os" className="cursor-pointer">Controle manual de OS</Label>
                      <Checkbox
                        id="edit-perm-manual-os"
                        checked={editPermissions.manualOrderControl}
                        onCheckedChange={(checked) =>
                          setEditPermissions((prev) => ({ ...prev, manualOrderControl: checked === true }))
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail (Admin e Supervisor)</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="admin@empresa.com"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
                disabled={editRole === 'TECNICO'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-username">Login do Técnico</Label>
              <Input
                id="edit-username"
                placeholder="nome.sobrenome"
                value={editUsername}
                onChange={(event) => setEditUsername(event.target.value)}
                disabled={editRole !== 'TECNICO'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-active">Status</Label>
              <Select
                value={editActive ? 'ACTIVE' : 'INACTIVE'}
                onValueChange={(value) => setEditActive(value === 'ACTIVE')}
              >
                <SelectTrigger id="edit-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(isAdmin || currentUser?.role === 'SUPERVISOR') && editRole === 'TECNICO' && (
              <div className="space-y-2">
                <Label htmlFor="edit-password">Nova Senha do Técnico (opcional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button onClick={() => void handleSaveUserEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
