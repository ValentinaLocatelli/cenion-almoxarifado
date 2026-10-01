import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Entrada,
  EntradaInput,
  Item,
  ItemInput,
  Saida,
  SaidaInput,
} from '@/types/estoque';
import { EstoqueContext } from '@/contexts/EstoqueContextStore';

export interface EstoqueState {
  itens: Item[];
  entradas: Entrada[];
  saidas: Saida[];
}

export interface EstoqueContextType extends EstoqueState {
  addEntrada: (input: EntradaInput) => void;
  updateEntrada: (id: string, input: EntradaInput) => void;
  removeEntrada: (id: string) => void;
  setEntradaObservacao: (id: string, observacao: string) => void;
  addSaida: (input: SaidaInput) => string | null;
  updateSaida: (id: string, input: SaidaInput) => string | null;
  removeSaida: (id: string) => void;
  setSaidaObservacao: (id: string, observacao: string) => void;
  addItem: (input: ItemInput) => void;
  updateItem: (id: string, input: ItemInput) => void;
  removeItem: (id: string) => void;
}

const STORAGE_KEY = 'cenion-almoxa-estoque-v1';
const EMPTY: EstoqueState = { itens: [], entradas: [], saidas: [] };

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function saldoDoItem(state: EstoqueState, itemId: string): number {
  const entradas = state.entradas
    .filter((entrada) => entrada.itemId === itemId)
    .reduce((total, entrada) => total + entrada.quantidade, 0);
  const saidas = state.saidas
    .filter((saida) => saida.itemId === itemId)
    .reduce((total, saida) => total + saida.quantidade, 0);
  return entradas - saidas;
}

function mensagemSaldoInsuficiente(saldo: number): string {
  return `Quantidade insuficiente em estoque. Saldo disponível: ${saldo} unidades.`;
}

const load = (): EstoqueState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<EstoqueState>;
    return {
      itens: parsed.itens ?? [],
      entradas: parsed.entradas ?? [],
      saidas: parsed.saidas ?? [],
    };
  } catch {
    return EMPTY;
  }
};

/** Acha o item pelo produto + modelo ou cria um novo (histórico de itens). */
function findOrCreateItem(
  itens: Item[],
  produto: string,
  modelo: string,
  now: string,
): { itens: Item[]; id: string } {
  const found = itens.find(
    (item) => norm(item.produto) === norm(produto) && norm(item.modelo) === norm(modelo),
  );
  if (found) return { itens, id: found.id };
  const created: Item = {
    id: uid(),
    produto: produto.trim(),
    modelo: modelo.trim(),
    createdAt: now,
    updatedAt: now,
  };
  return { itens: [...itens, created], id: created.id };
}

/**
 * Aplica a variação de quantidade (delta) no último registro do outro lado
 * para o mesmo item. Nunca deixa a quantidade ficar negativa.
 */
function mirrorDelta<T extends { itemId: string; quantidade: number; atualizacao: string }>(
  rows: T[],
  itemId: string,
  delta: number,
  now: string,
): T[] {
  if (delta === 0) return rows;
  let index = -1;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].itemId === itemId) {
      index = i;
      break;
    }
  }
  if (index === -1) return rows;
  return rows.map((row, i) =>
    i === index
      ? { ...row, quantidade: Math.max(0, row.quantidade + delta), atualizacao: now }
      : row,
  );
}

export function EstoqueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EstoqueState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível: segue só em memória */
    }
  }, [state]);

  const addEntrada = useCallback((input: EntradaInput) => {
    setState((s) => {
      const now = new Date().toISOString();
      const { itens, id } = findOrCreateItem(s.itens, input.produto, input.modelo, now);
      const entrada: Entrada = {
        id: uid(),
        itemId: id,
        fornecedor: input.fornecedor.trim(),
        local: input.local.trim(),
        quantidade: input.quantidade,
        dataEntrada: now,
        atualizacao: now,
        observacao: '',
      };
      return { ...s, itens, entradas: [...s.entradas, entrada] };
    });
  }, []);

  const updateEntrada = useCallback((id: string, input: EntradaInput) => {
    setState((s) => {
      const old = s.entradas.find((e) => e.id === id);
      if (!old) return s;
      const now = new Date().toISOString();
      const { itens, id: itemId } = findOrCreateItem(s.itens, input.produto, input.modelo, now);
      const delta = itemId === old.itemId ? input.quantidade - old.quantidade : 0;
      return {
        ...s,
        itens,
        entradas: s.entradas.map((e) =>
          e.id === id
            ? {
                ...e,
                itemId,
                fornecedor: input.fornecedor.trim(),
                local: input.local.trim(),
                quantidade: input.quantidade,
                atualizacao: now,
              }
            : e,
        ),
        saidas: mirrorDelta(s.saidas, itemId, delta, now),
      };
    });
  }, []);

  const removeEntrada = useCallback((id: string) => {
    setState((s) => ({ ...s, entradas: s.entradas.filter((e) => e.id !== id) }));
  }, []);

  const setEntradaObservacao = useCallback((id: string, observacao: string) => {
    setState((s) => ({
      ...s,
      entradas: s.entradas.map((e) => (e.id === id ? { ...e, observacao } : e)),
    }));
  }, []);

  const addSaida = useCallback((input: SaidaInput): string | null => {
    const existente = state.itens.find(
      (item) => norm(item.produto) === norm(input.produto) && norm(item.modelo) === norm(input.modelo),
    );
    const saldo = existente ? saldoDoItem(state, existente.id) : 0;
    if (input.quantidade > saldo) return mensagemSaldoInsuficiente(saldo);

    setState((s) => {
      const now = new Date().toISOString();
      const { itens, id } = findOrCreateItem(s.itens, input.produto, input.modelo, now);
      const saida: Saida = {
        id: uid(),
        itemId: id,
        tecnico: input.tecnico.trim(),
        quantidade: input.quantidade,
        dataSaida: now,
        atualizacao: now,
        observacao: '',
      };
      return { ...s, itens, saidas: [...s.saidas, saida] };
    });
    return null;
  }, [state]);

  const updateSaida = useCallback((id: string, input: SaidaInput): string | null => {
    const old = state.saidas.find((e) => e.id === id);
    if (!old) return null;
    const existente = state.itens.find(
      (item) => norm(item.produto) === norm(input.produto) && norm(item.modelo) === norm(input.modelo),
    );
    const itemDestinoId = existente?.id;
    const saldo = itemDestinoId ? saldoDoItem(state, itemDestinoId) : 0;
    const saldoDisponivel = itemDestinoId === old.itemId ? saldo + old.quantidade : saldo;
    if (input.quantidade > saldoDisponivel) return mensagemSaldoInsuficiente(saldoDisponivel);

    setState((s) => {
      const oldSaida = s.saidas.find((e) => e.id === id);
      if (!oldSaida) return s;
      const now = new Date().toISOString();
      const { itens, id: itemId } = findOrCreateItem(s.itens, input.produto, input.modelo, now);
      const delta = itemId === oldSaida.itemId ? input.quantidade - oldSaida.quantidade : 0;
      return {
        ...s,
        itens,
        saidas: s.saidas.map((e) =>
          e.id === id
            ? {
                ...e,
                itemId,
                tecnico: input.tecnico.trim(),
                quantidade: input.quantidade,
                atualizacao: now,
              }
            : e,
        ),
        entradas: mirrorDelta(s.entradas, itemId, delta, now),
      };
    });
    return null;
  }, [state]);

  const removeSaida = useCallback((id: string) => {
    setState((s) => ({ ...s, saidas: s.saidas.filter((e) => e.id !== id) }));
  }, []);

  const setSaidaObservacao = useCallback((id: string, observacao: string) => {
    setState((s) => ({
      ...s,
      saidas: s.saidas.map((e) => (e.id === id ? { ...e, observacao } : e)),
    }));
  }, []);

  const addItem = useCallback((input: ItemInput) => {
    setState((s) => {
      const now = new Date().toISOString();
      const { itens, id } = findOrCreateItem(s.itens, input.produto, input.modelo, now);
      return {
        ...s,
        itens: itens.map((item) =>
          item.id === id ? { ...item, quantidadeMinima: input.quantidadeMinima } : item,
        ),
      };
    });
  }, []);

  const updateItem = useCallback((id: string, input: ItemInput) => {
    setState((s) => {
      const now = new Date().toISOString();
      return {
        ...s,
        itens: s.itens.map((item) =>
          item.id === id
            ? {
                ...item,
                produto: input.produto.trim(),
                modelo: input.modelo.trim(),
                quantidadeMinima: input.quantidadeMinima,
                updatedAt: now,
              }
            : item,
        ),
        // entradas e saídas apontam para o item, então o nome muda nas duas tabelas ao mesmo tempo
        entradas: s.entradas.map((e) => (e.itemId === id ? { ...e, atualizacao: now } : e)),
        saidas: s.saidas.map((e) => (e.itemId === id ? { ...e, atualizacao: now } : e)),
      };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((s) => ({
      itens: s.itens.filter((item) => item.id !== id),
      entradas: s.entradas.filter((e) => e.itemId !== id),
      saidas: s.saidas.filter((e) => e.itemId !== id),
    }));
  }, []);

  const value = useMemo<EstoqueContextType>(
    () => ({
      ...state,
      addEntrada,
      updateEntrada,
      removeEntrada,
      setEntradaObservacao,
      addSaida,
      updateSaida,
      removeSaida,
      setSaidaObservacao,
      addItem,
      updateItem,
      removeItem,
    }),
    [
      state,
      addEntrada,
      updateEntrada,
      removeEntrada,
      setEntradaObservacao,
      addSaida,
      updateSaida,
      removeSaida,
      setSaidaObservacao,
      addItem,
      updateItem,
      removeItem,
    ],
  );

  return <EstoqueContext.Provider value={value}>{children}</EstoqueContext.Provider>;
}
