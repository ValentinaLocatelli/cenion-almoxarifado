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
import type { BusinessUnit } from '@/types';

interface ActiveUnitContextType {
  activeUnitId: string;
  activeUnitName: string;
  availableUnits: BusinessUnit[];
  canSwitchUnit: boolean;
  isLoading: boolean;
  setActiveUnitId: (unitId: string) => void;
  refreshUnits: () => Promise<void>;
}

const ActiveUnitContext = createContext<ActiveUnitContextType | undefined>(undefined);

function storageKeyForUser(userId: string): string {
  return `active_unit_id:${userId}`;
}

export function ActiveUnitProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [availableUnits, setAvailableUnits] = useState<BusinessUnit[]>([]);
  const [activeUnitId, setActiveUnitIdState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const refreshUnits = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setAvailableUnits([]);
      setActiveUnitIdState('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('business_units')
      .select('id,name,city,state,active')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Falha ao carregar unidades ativas:', error);
      setAvailableUnits([]);
      setActiveUnitIdState(user.unitId ?? '');
      setIsLoading(false);
      return;
    }

    const units = (data ?? []) as BusinessUnit[];
    setAvailableUnits(units);

    if (!isAdmin) {
      setActiveUnitIdState(user.unitId ?? '');
      setIsLoading(false);
      return;
    }

    const key = storageKeyForUser(user.id);
    const stored = localStorage.getItem(key) ?? '';
    const hasStored = units.some((unit) => unit.id === stored);

    if (hasStored) {
      setActiveUnitIdState(stored);
    } else if (units.length > 0) {
      setActiveUnitIdState(units[0].id);
    } else {
      setActiveUnitIdState('');
    }

    setIsLoading(false);
  }, [isAuthenticated, isAdmin, user]);

  useEffect(() => {
    void refreshUnits();
  }, [refreshUnits]);

  const setActiveUnitId = useCallback(
    (unitId: string) => {
      if (!user) return;

      if (!isAdmin) {
        setActiveUnitIdState(user.unitId ?? '');
        return;
      }

      const exists = availableUnits.some((unit) => unit.id === unitId);
      if (!exists) return;

      setActiveUnitIdState(unitId);
      localStorage.setItem(storageKeyForUser(user.id), unitId);
    },
    [availableUnits, isAdmin, user],
  );

  const activeUnitName = useMemo(
    () => availableUnits.find((unit) => unit.id === activeUnitId)?.name ?? 'Nenhuma unidade',
    [activeUnitId, availableUnits],
  );

  const value = useMemo<ActiveUnitContextType>(
    () => ({
      activeUnitId,
      activeUnitName,
      availableUnits,
      canSwitchUnit: isAdmin,
      isLoading,
      setActiveUnitId,
      refreshUnits,
    }),
    [activeUnitId, activeUnitName, availableUnits, isAdmin, isLoading, setActiveUnitId, refreshUnits],
  );

  return <ActiveUnitContext.Provider value={value}>{children}</ActiveUnitContext.Provider>;
}

export function useActiveUnit() {
  const context = useContext(ActiveUnitContext);
  if (!context) {
    throw new Error('useActiveUnit must be used within ActiveUnitProvider');
  }
  return context;
}
