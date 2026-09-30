import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  mapCompanyRow,
  mapHistoryRow,
  mapProductionOrderRow,
  mapServiceOrderRow,
  mapUserRow,
  toCompanyInsert,
  toCompanyPatch,
  toHistoryInsert,
  toProductionOrderInsert,
  toProductionOrderPatch,
  toServiceOrderPatch,
} from '@/lib/supabaseMappers';
import type { Company, OSHistory, ServiceOrder, User } from '@/types';
import type { ProductionOrder, ProductionOrderDraft } from '@/types/production';

interface AppDataContextType {
  users: User[];
  companies: Company[];
  orders: ServiceOrder[];
  productionOrders: ProductionOrder[];
  history: OSHistory[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  updateUserActive: (userId: string, active: boolean) => Promise<void>;
  createCompany: (
    payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { actorUserId?: string },
  ) => Promise<Company>;
  updateCompany: (
    companyId: string,
    payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { actorUserId?: string },
  ) => Promise<Company>;
  deleteCompany: (companyId: string) => Promise<void>;
  createOrder: (payload: Record<string, unknown>) => Promise<ServiceOrder>;
  createProductionOrder: (payload: ProductionOrderDraft & { unitId: string; actorUserId?: string }) => Promise<ProductionOrder>;
  updateProductionOrder: (
    orderId: string,
    payload: ProductionOrderDraft & { actorUserId?: string },
  ) => Promise<ProductionOrder>;
  deleteProductionOrder: (orderId: string) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateOrder: (orderId: string, patch: Partial<ServiceOrder>) => Promise<ServiceOrder>;
  createHistory: (entry: Omit<OSHistory, 'id'>) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const SERVICE_ORDER_LIST_COLUMNS = [
  'id',
  'unit_id',
  'omie_os_number',
  'client_name',
  'client_cnpj',
  'client_email',
  'client_phone',
  'contact_name',
  'product_type',
  'product_description',
  'serial_number',
  'status',
  'priority',
  'is_warranty',
  'technician_id',
  'technician_name',
  'problem_description',
  'solution_description',
  'technical_notes',
  'origin',
  'destination',
  'tracking_number',
  'tracking_link',
  'carrier',
  'delivery_date',
  'purchase_order_number',
  'approval_date',
  'invoice_number',
  'analysis_start_time',
  'analysis_end_time',
  'execution_start_time',
  'execution_end_time',
  'waiting_part_from_status',
  'waiting_part_description',
  'approval_decision',
  'quote_services',
  'quote_total_value',
  'created_at',
  'updated_at',
].join(',');

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const toAppError = useCallback((error: unknown, fallback: string): Error => {
    if (error instanceof Error && error.message) return error;
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const parts = [record.message, record.details, record.hint, record.code]
        .filter((part) => typeof part === 'string' && part.trim().length > 0)
        .map((part) => String(part));
      if (parts.length > 0) return new Error(parts.join(' | '));
    }
    return new Error(fallback);
  }, []);

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [history, setHistory] = useState<OSHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    setUsers((data ?? []).map((row) => mapUserRow(row as Record<string, unknown>)));
  }, []);

  const loadCompanies = useCallback(async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      if ((error as { code?: string }).code === '42P01') {
        setCompanies([]);
        return;
      }
      throw error;
    }
    setCompanies((data ?? []).map((row) => mapCompanyRow(row as Record<string, unknown>)));
  }, []);

      const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_orders')
      .select(SERVICE_ORDER_LIST_COLUMNS)
      .order('updated_at', { ascending: false });
      
    if (error) throw error;

    // Filtra no JavaScript ignorando maiúsculas/minúsculas e variações
    const rows = (data ?? []).map((row) => mapServiceOrderRow(row as Record<string, unknown>));
    const filteredRows = rows.filter(
      (os) => 
        os.status?.toLowerCase() !== 'finalizado' && 
        os.status?.toLowerCase() !== 'finalizado (técnico)' &&
        os.status?.toLowerCase() !== 'finalizado(técnico)'
    );

    setOrders(filteredRows);
  }, []);



  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase.from('os_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    setHistory((data ?? []).map((row) => mapHistoryRow(row as Record<string, unknown>)));
  }, []);

  const loadProductionOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_orders')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      if ((error as { code?: string }).code === '42P01') {
        setProductionOrders([]);
        return;
      }
      throw error;
    }
    setProductionOrders((data ?? []).map((row) => mapProductionOrderRow(row as Record<string, unknown>)));
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    const results = await Promise.allSettled([
      loadUsers(),
      loadCompanies(),
      loadOrders(),
      loadHistory(),
      loadProductionOrders(),
    ]);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const source = ['users', 'companies', 'service_orders', 'os_history', 'production_orders'][index];
        console.error(`Falha ao carregar ${source}:`, result.reason);
      }
    });

    setIsLoading(false);
  }, [loadUsers, loadCompanies, loadOrders, loadHistory, loadProductionOrders]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      setUsers([]);
      setCompanies([]);
      setOrders([]);
      setProductionOrders([]);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    void refreshAll();
  }, [isAuthLoading, isAuthenticated, refreshAll, user?.id]);

  const updateUserActive = useCallback(async (userId: string, active: boolean) => {
    const { error } = await supabase.from('users').update({ active }).eq('id', userId);
    if (error) throw error;
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, active } : user)));
  }, []);

  const createCompany = useCallback(
    async (
      payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { actorUserId?: string },
    ) => {
      const { data, error } = await supabase
        .from('companies')
        .insert(toCompanyInsert(payload))
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Falha ao criar empresa.');
      }

      const mapped = mapCompanyRow(data as Record<string, unknown>);
      setCompanies((prev) => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      return mapped;
    },
    [],
  );

  const updateCompany = useCallback(
    async (
      companyId: string,
      payload: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { actorUserId?: string },
    ) => {
      const { data, error } = await supabase
        .from('companies')
        .update(toCompanyPatch(payload))
        .eq('id', companyId)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Falha ao atualizar empresa.');
      }

      const mapped = mapCompanyRow(data as Record<string, unknown>);
      setCompanies((prev) =>
        prev
          .map((entry) => (entry.id === mapped.id ? mapped : entry))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      );
      return mapped;
    },
    [],
  );

  const deleteCompany = useCallback(async (companyId: string) => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (error) {
      throw toAppError(error, 'Falha ao excluir empresa.');
    }

    setCompanies((prev) => prev.filter((entry) => entry.id !== companyId));
  }, [toAppError]);

  const createOrder = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('service_orders')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Falha ao criar ordem de serviço.');
    }

    const mapped = mapServiceOrderRow(data as Record<string, unknown>);
    setOrders((prev) => [mapped, ...prev]);
    return mapped;
  }, []);

  const createProductionOrder = useCallback(async (payload: ProductionOrderDraft & { unitId: string; actorUserId?: string }) => {
    const { data, error } = await supabase
      .from('production_orders')
      .insert(toProductionOrderInsert(payload))
      .select('*')
      .single();

    if (error || !data) {
      throw toAppError(error, 'Falha ao criar ordem de producao.');
    }

    const mapped = mapProductionOrderRow(data as Record<string, unknown>);
    setProductionOrders((prev) => [...prev, mapped].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    return mapped;
  }, [toAppError]);

  const updateProductionOrder = useCallback(
    async (orderId: string, payload: ProductionOrderDraft & { actorUserId?: string }) => {
      const { data, error } = await supabase
        .from('production_orders')
        .update(toProductionOrderPatch(payload))
        .eq('id', orderId)
        .select('*')
        .single();

      if (error || !data) {
        throw toAppError(error, 'Falha ao atualizar ordem de producao.');
      }

      const mapped = mapProductionOrderRow(data as Record<string, unknown>);
      setProductionOrders((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
      return mapped;
    },
    [toAppError],
  );

  const deleteProductionOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase
      .from('production_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      throw toAppError(error, 'Falha ao excluir ordem de producao.');
    }

    setProductionOrders((prev) => prev.filter((item) => item.id !== orderId));
  }, [toAppError]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const { data, error, count } = await supabase
      .from('service_orders')
      .delete({ count: 'exact' })
      .eq('id', orderId)
      .select('id');

    if (error) {
      throw toAppError(error, 'Falha ao excluir ordem de serviço.');
    }

    if (!count || !data || data.length === 0) {
      throw new Error('Nenhuma OS foi excluída. Verifique permissões de exclusão.');
    }

    setOrders((prev) => prev.filter((item) => item.id !== orderId));
    setHistory((prev) => prev.filter((entry) => entry.osId !== orderId));
  }, [toAppError]);

  const updateOrder = useCallback(async (orderId: string, patch: Partial<ServiceOrder>) => {
    const payload = toServiceOrderPatch(patch);
    const { data, error } = await supabase
      .from('service_orders')
      .update(payload)
      .eq('id', orderId)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Falha ao atualizar ordem de serviço.');
    }

    const mapped = mapServiceOrderRow(data as Record<string, unknown>);
    setOrders((prev) => prev.map((order) => (order.id === mapped.id ? mapped : order)));
    return mapped;
  }, []);

  const createHistory = useCallback(async (entry: Omit<OSHistory, 'id'>) => {
    const resolvedUnitId = entry.unitId || orders.find((order) => order.id === entry.osId)?.unitId;
    if (!resolvedUnitId) {
      throw new Error('Não foi possível identificar a unidade da OS para registrar histórico.');
    }

    const { data, error } = await supabase
      .from('os_history')
      .insert(toHistoryInsert({ ...entry, unitId: resolvedUnitId }))
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Falha ao registrar histórico.');
    }

    const mapped = mapHistoryRow(data as Record<string, unknown>);
    setHistory((prev) => [mapped, ...prev]);
  }, [orders]);

  const value = useMemo<AppDataContextType>(
    () => ({
      users,
      companies,
      orders,
      productionOrders,
      history,
      isLoading,
      refreshAll,
      updateUserActive,
      createCompany,
      updateCompany,
      deleteCompany,
      createOrder,
      createProductionOrder,
      updateProductionOrder,
      deleteProductionOrder,
      deleteOrder,
      updateOrder,
      createHistory,
    }),
    [
      users,
      companies,
      orders,
      productionOrders,
      history,
      isLoading,
      refreshAll,
      updateUserActive,
      createCompany,
      updateCompany,
      deleteCompany,
      createOrder,
      createProductionOrder,
      updateProductionOrder,
      deleteProductionOrder,
      deleteOrder,
      updateOrder,
      createHistory,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
