import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { mapUserRow } from '@/lib/supabaseMappers';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isManager: boolean;
  isTechnician: boolean;
  canViewFinancialDashboard: boolean;
  canAccessBusinessUnits: boolean;
  canManageUsers: boolean;
  canCreateTechnicians: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TECH_EMAIL_DOMAIN = 'tecnico.cenion.com';

async function loadUserProfile(authUserId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', authUserId).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapUserRow(data as Record<string, unknown>);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await loadUserProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      void loadUserProfile(session.user.id)
        .then((profile) => setUser(profile))
        .catch(() => setUser(null));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const normalizeTechnicianLogin = (value: string) =>
    value
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');

  const login = useCallback(
    async (
      identifier: string,
      password: string,
    ): Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }> => {
    const raw = identifier.trim().toLowerCase();
    const isEmailLogin = raw.includes('@');
    const normalizedLogin = normalizeTechnicianLogin(raw);
    const resolvedEmail = isEmailLogin ? raw : `${normalizedLogin}@${TECH_EMAIL_DOMAIN}`;

    if (!resolvedEmail || resolvedEmail.startsWith('@')) {
      return { success: false, error: 'Informe e-mail (admin/supervisor) ou login (técnico).' };
    }

    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'] | null = null;
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'] | null = null;

    if (isEmailLogin) {
      const result = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
      data = result.data;
      error = result.error;
    } else {
      const candidateDomains = [TECH_EMAIL_DOMAIN];

      for (const domain of candidateDomains) {
        const candidateEmail = `${normalizedLogin}@${domain}`;
        const result = await supabase.auth.signInWithPassword({ email: candidateEmail, password });
        data = result.data;
        error = result.error;
        if (!result.error && result.data.user) {
          break;
        }
      }
    }

    if (error || !data.user) {
      return { success: false, error: error?.message ?? 'Falha ao autenticar.' };
    }

    const profile = await loadUserProfile(data.user.id);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      return {
        success: false,
        error: !profile
          ? 'Perfil não encontrado. Aguarde a criação do perfil ou fale com o administrador.'
          : 'Usuário inativo.',
      };
    }

    // O Cenion Produção usa a mesma autenticação do Cenion OS Management.
    // Portanto, qualquer usuário ativo (ADMIN, SUPERVISOR ou TECNICO)
    // pode entrar com o e-mail cadastrado no Supabase.
    // O login no formato nome.sobrenome continua disponível para técnicos
    // que usam o identificador técnico configurado neste projeto.

    setUser(profile);
    return { success: true, requiresPasswordChange: profile.mustChangePassword };
  },
  [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setUser(null);
      return;
    }

    const profile = await loadUserProfile(session.user.id);
    setUser(profile);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      refreshUserProfile,
      isAdmin: user?.role === 'ADMIN',
      isSupervisor: user?.role === 'SUPERVISOR',
      isManager: user?.role === 'ADMIN' || user?.role === 'SUPERVISOR',
      isTechnician: user?.role === 'TECNICO',
      canViewFinancialDashboard:
        user?.role === 'ADMIN'
        || (user?.role === 'SUPERVISOR' && user.permissions.dashboardFinancial),
      canAccessBusinessUnits:
        user?.role === 'ADMIN'
        || (user?.role === 'SUPERVISOR' && user.permissions.manageBusinessUnits),
      canManageUsers:
        user?.role === 'ADMIN'
        || (user?.role === 'SUPERVISOR' && user.permissions.manageUsers),
      canCreateTechnicians:
        user?.role === 'ADMIN'
        || (
          user?.role === 'SUPERVISOR'
          && user.permissions.manageUsers
          && user.permissions.canCreateTechnicians
        ),
    }),
    [user, isLoading, login, logout, refreshUserProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
