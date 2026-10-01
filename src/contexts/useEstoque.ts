import { useContext } from 'react';
import { EstoqueContext } from '@/contexts/EstoqueContextStore';

export function useEstoque() {
  const ctx = useContext(EstoqueContext);
  if (!ctx) throw new Error('useEstoque deve ser usado dentro de EstoqueProvider');
  return ctx;
}
