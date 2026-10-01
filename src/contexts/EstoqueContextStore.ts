import { createContext } from 'react';
import type { EstoqueContextType } from '@/contexts/EstoqueContext';

export const EstoqueContext = createContext<EstoqueContextType | undefined>(undefined);
